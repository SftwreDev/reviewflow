import { randomUUID } from "node:crypto"
import type { JobEvent, JobKind, JobSnapshot, JobStatus } from "@/lib/job-types"

export type { JobEvent, JobKind, JobSnapshot, JobStatus }

export type BackgroundJob = {
  id: string
  kind: JobKind
  repo: string
  number: number
  status: JobStatus
  createdAt: string
  updatedAt: string
  logs: string[]
  result?: unknown
  error?: string
  events: JobEvent[]
  listeners: Set<(event: JobEvent) => void>
  abort: AbortController
}

const MAX_LOGS = 2_000
const MAX_JOBS = 40
const MAX_JOB_AGE_MS = 24 * 60 * 60 * 1000

// A dev-mode module reload must not orphan running jobs: keep the registry on globalThis.
const globalForJobs = globalThis as unknown as { __reviewflowJobs?: Map<string, BackgroundJob> }
const jobs = (globalForJobs.__reviewflowJobs ??= new Map<string, BackgroundJob>())

function prune() {
  const now = Date.now()
  for (const job of jobs.values()) {
    if (job.status !== "running" && now - Date.parse(job.updatedAt) > MAX_JOB_AGE_MS) jobs.delete(job.id)
  }
  if (jobs.size <= MAX_JOBS) return
  const finished = [...jobs.values()]
    .filter((job) => job.status !== "running")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  for (const job of finished) {
    if (jobs.size <= MAX_JOBS) break
    jobs.delete(job.id)
  }
}

function emit(job: BackgroundJob, event: JobEvent) {
  if (event.type === "log") {
    job.logs.push(event.message)
    if (job.logs.length > MAX_LOGS) job.logs.splice(0, job.logs.length - MAX_LOGS)
  }
  job.events.push(event)
  job.updatedAt = new Date().toISOString()
  for (const listener of job.listeners) {
    try {
      listener(event)
    } catch {
      // A broken subscriber must never interrupt the job.
    }
  }
}

export function snapshot(job: BackgroundJob): JobSnapshot {
  return {
    id: job.id,
    kind: job.kind,
    repo: job.repo,
    number: job.number,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    logs: job.logs,
    result: job.result,
    error: job.error,
    eventCount: job.events.length,
  }
}

export function getJob(id: string): BackgroundJob | null {
  return jobs.get(id) ?? null
}

/** Drops a finished job so a completed run is not re-shown after the user approved or discarded it. */
export function forgetJob(id: string) {
  jobs.delete(id)
}

export function findJob(kind: JobKind, repo: string, number: number): BackgroundJob | null {
  let latest: BackgroundJob | null = null
  for (const job of jobs.values()) {
    if (job.kind !== kind || job.repo !== repo || job.number !== number) continue
    if (job.status === "running") return job
    if (!latest || job.updatedAt > latest.updatedAt) latest = job
  }
  return latest
}

/**
 * Starts a detached agent run and returns immediately. The HTTP request that triggered it may be
 * aborted at any time; the run keeps going and its events stay available for later streams.
 * One running job per kind and PR: a second start returns the existing job.
 */
export function startJob<T>(options: {
  kind: JobKind
  repo: string
  number: number
  resultEvent: (result: T) => JobEvent
  run: (context: {
    send: (event: JobEvent) => void
    abort: AbortController
    job: BackgroundJob
  }) => Promise<T>
}): { job: BackgroundJob; resumed: boolean } {
  prune()
  const existing = [...jobs.values()].find(
    (job) =>
      job.kind === options.kind &&
      job.repo === options.repo &&
      job.number === options.number &&
      job.status === "running"
  )
  if (existing) return { job: existing, resumed: true }

  const now = new Date().toISOString()
  const job: BackgroundJob = {
    id: randomUUID(),
    kind: options.kind,
    repo: options.repo,
    number: options.number,
    status: "running",
    createdAt: now,
    updatedAt: now,
    logs: [],
    events: [],
    listeners: new Set(),
    abort: new AbortController(),
  }
  jobs.set(job.id, job)

  void (async () => {
    try {
      const result = await options.run({
        send: (event) => emit(job, event),
        abort: job.abort,
        job,
      })
      if (job.abort.signal.aborted) return
      job.result = result
      job.status = "done"
      emit(job, options.resultEvent(result))
    } catch (error) {
      if (job.abort.signal.aborted) return
      job.status = "error"
      job.error = error instanceof Error ? error.message : "Agent failed"
      emit(job, { type: "error", error: job.error })
    }
  })()

  return { job, resumed: false }
}

/** Writes all events from `from` on, then follows the job until it reaches a terminal state. */
export function jobStream(job: BackgroundJob, from = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let listener: ((event: JobEvent) => void) | null = null
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        if (listener) job.listeners.delete(listener)
        try {
          controller.close()
        } catch {
          // Already closed by the client.
        }
      }
      const write = (event: JobEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          close()
        }
      }

      const start = Math.max(0, Math.min(from, job.events.length))
      for (let index = start; index < job.events.length; index += 1) write(job.events[index])
      if (job.status !== "running") {
        close()
        return
      }

      listener = (event) => {
        write(event)
        if (event.type === "result" || event.type === "error") close()
      }
      job.listeners.add(listener)
    },
    cancel() {
      if (listener) job.listeners.delete(listener)
    },
  })
}
