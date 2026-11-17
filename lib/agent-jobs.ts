"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import type { JobEvent, JobKind, JobSnapshot, JobStatus } from "@/lib/job-types"

export type ClientJob = {
  id: string | null
  status: "idle" | JobStatus
  logs: string[]
  result?: unknown
  error: string
}

const EMPTY: ClientJob = { id: null, status: "idle", logs: [], error: "" }

// Module-level so a running stream and its logs survive tab/PR navigation. The server keeps the
// actual agent run; this is only the reattachable view.
const states = new Map<string, ClientJob>()
const listeners = new Map<string, Set<() => void>>()
const streams = new Map<string, { id: string; controller: AbortController }>()
const retries = new Map<string, number>()
const syncing = new Set<string>()
const MAX_RETRIES = 5

export function jobKey(kind: JobKind, repo: string, number: number) {
  return `${kind}:${repo}#${number}`
}

function getState(key: string): ClientJob {
  return states.get(key) ?? EMPTY
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener()
}

function update(key: string, patch: Partial<ClientJob>) {
  states.set(key, { ...getState(key), ...patch })
  notify(key)
}

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set<() => void>()
  set.add(listener)
  listeners.set(key, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(key)
  }
}

function applyEvent(key: string, event: JobEvent) {
  retries.set(key, 0)
  if (event.type === "log") {
    const state = getState(key)
    update(key, { logs: [...state.logs, event.message] })
  } else if (event.type === "result") {
    update(key, { status: "done", result: event.result, error: "" })
  } else {
    update(key, { status: "error", error: event.error })
  }
}

async function attach(key: string, id: string, from: number) {
  const current = streams.get(key)
  if (current?.id === id) return
  current?.controller.abort()

  const controller = new AbortController()
  streams.set(key, { id, controller })

  try {
    const response = await fetch(`/api/jobs/stream?id=${encodeURIComponent(id)}&from=${from}`, {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok || !response.body) throw new Error("Job stream unavailable")
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          applyEvent(key, JSON.parse(line) as JobEvent)
        } catch {
          // Ignore a malformed frame; the job keeps running server-side.
        }
      }
    }
  } catch {
    // Aborted by a newer attachment. Otherwise the stream dropped; retry below.
  } finally {
    if (streams.get(key)?.controller === controller) streams.delete(key)
  }

  if (streams.get(key)?.id === id) return
  const state = getState(key)
  if (state.id !== id || state.status !== "running") return

  const attempt = (retries.get(key) ?? 0) + 1
  retries.set(key, attempt)
  if (attempt > MAX_RETRIES) {
    update(key, { status: "error", error: "Lost connection to the background agent run" })
    return
  }
  setTimeout(() => {
    if (getState(key).id === id && getState(key).status === "running") {
      void attach(key, id, getState(key).logs.length)
    }
  }, Math.min(4000, 500 * attempt))
}

function applySnapshot(key: string, job: JobSnapshot) {
  // A live stream for the same job already holds fresher logs than the snapshot.
  const streamed = streams.get(key)
  if (streamed?.id === job.id) return
  update(key, {
    id: job.id,
    status: job.status,
    logs: job.logs,
    result: job.result,
    error: job.error ?? "",
  })
  if (job.status === "running") {
    retries.set(key, 0)
    void attach(key, job.id, job.eventCount)
  }
}

/** Pulls the server's current job state and reattaches to its stream when it is still running. */
export async function syncJob(kind: JobKind, repo: string, number: number) {
  const key = jobKey(kind, repo, number)
  if (syncing.has(key)) return
  syncing.add(key)
  try {
    const response = await fetch(
      `/api/jobs?kind=${kind}&repo=${encodeURIComponent(repo)}&number=${number}`,
      { cache: "no-store" }
    )
    if (!response.ok) return
    const data = (await response.json()) as { job?: JobSnapshot | null }
    if (data.job) {
      applySnapshot(key, data.job)
      return
    }
    if (getState(key).status === "running") {
      update(key, { status: "error", error: "Background job no longer available" })
    }
  } catch {
    // Offline or server restarting; the next mount/focus retries.
  } finally {
    syncing.delete(key)
  }
}

/** Starts (or joins) a detached server job and tails its events from the beginning. */
export async function startJob(
  kind: JobKind,
  repo: string,
  number: number,
  payload: unknown
): Promise<void> {
  const key = jobKey(kind, repo, number)
  const endpoint = kind === "review" ? "/api/reviews" : "/api/fixes"
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = (await response.json().catch(() => ({}))) as { jobId?: string; error?: string }
  if (!response.ok || !data.jobId) throw new Error(data.error || "Could not start agent run")

  const existing = getState(key)
  if (existing.id !== data.jobId) update(key, { id: data.jobId, status: "running", logs: [], error: "", result: undefined })
  else update(key, { status: "running", error: "" })
  retries.set(key, 0)
  void attach(key, data.jobId, existing.id === data.jobId ? existing.logs.length : 0)
}

/** Clears a finished run once its outcome has been approved or discarded. */
export async function dismissJob(kind: JobKind, repo: string, number: number) {
  const key = jobKey(kind, repo, number)
  const id = getState(key).id
  if (!id) return
  streams.get(key)?.controller.abort()
  streams.delete(key)
  try {
    await fetch(`/api/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" })
  } catch {
    // The job expires on its own; local state still needs clearing.
  }
  if (getState(key).id === id) {
    update(key, { id: null, status: "idle", logs: [], result: undefined, error: "" })
  }
}

export function useAgentJob(kind: JobKind, repo: string, number: number): ClientJob {
  const key = jobKey(kind, repo, number)
  const state = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    useCallback(() => getState(key), [key]),
    useCallback(() => getState(key), [key])
  )

  useEffect(() => {
    void syncJob(kind, repo, number)
  }, [kind, repo, number])

  return state
}
