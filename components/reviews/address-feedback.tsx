"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CloudUpload,
  GitCommitHorizontal,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { SkillsMultiSelect } from "@/components/reviews/run-review"
import { DiffBlock } from "@/components/reviews/diff-block"
import { MergeConflicts } from "@/components/reviews/merge-conflicts"
import { postJson } from "@/lib/post-json"
import type { PullRequestData } from "@/components/pull-requests/pr-header"
import type { IssueCommentData, ReviewData } from "@/components/pull-requests/pr-overview"
import type { InlineComment } from "@/components/pull-requests/diff-viewer"
import { useApp } from "@/lib/app-context"
import { cn } from "@/lib/utils"

type Kind = "inline" | "issue" | "review"
type Item = { key: string; kind: Kind; id: number; author: string; body: string; location?: string }
type FixResult = { kind: Kind; id: number; status: "fixed" | "partial" | "declined"; reply: string }
type FixOutcome = {
  id: string | null
  summary: string
  results: FixResult[]
  files: string[]
  diff: string
  truncated: boolean
  hasChanges: boolean
}
type Phase = "idle" | "running" | "review" | "done"
type Workspace = {
  id: string
  headRef: string
  queue: { sha: string; message: string }[]
  dirty: boolean
  merging: boolean
  conflicts: string[]
}
type BusyAction = "approve" | "discard" | "sync" | "push" | "discardAll"

const keyOf = (kind: Kind, id: number) => `${kind}:${id}`

const STATUS_STYLES: Record<FixResult["status"], string> = {
  fixed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  declined: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
}

interface AddressFeedbackProps {
  repo: string
  pr: PullRequestData
  reviews: ReviewData[]
  comments: IssueCommentData[]
  reviewComments: InlineComment[]
  onReload: () => void
}

export function AddressFeedback({ repo, pr, reviews, comments, reviewComments, onReload }: AddressFeedbackProps) {
  const { user, claudeModel, claudeModels } = useApp()
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [outcome, setOutcome] = useState<FixOutcome | null>(null)
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [postReplies, setPostReplies] = useState(true)
  const [commitMessage, setCommitMessage] = useState("")
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [pushNow, setPushNow] = useState(false)
  const [notice, setNotice] = useState("")
  const [done, setDone] = useState<{ sha: string; posted: number; failed: string[] } | null>(null)
  const [skills, setSkills] = useState<{ name: string; description: string }[]>([])
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState("")
  const [overrideModel, setOverrideModel] = useState("")
  const sessionRef = useRef<string | null>(null)

  const effectiveModel = overrideModel || claudeModel || claudeModels[0]?.value || ""

  const refreshWorkspace = useCallback(async () => {
    try {
      const response = await fetch(`/api/fixes?repo=${encodeURIComponent(repo)}&number=${pr.number}`)
      const data = (await response.json()) as { session?: Workspace | null }
      setWorkspace(data.session ?? null)
      return data.session ?? null
    } catch {
      return null
    }
  }, [repo, pr.number])

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    for (const c of reviewComments) {
      if (c.in_reply_to_id || c.user.login === user) continue
      list.push({
        key: keyOf("inline", c.id),
        kind: "inline",
        id: c.id,
        author: c.user.login,
        body: c.body,
        location: c.path ? `${c.path}${c.line ? `:${c.line}` : ""}` : undefined,
      })
    }
    for (const r of reviews) {
      if (!r.body?.trim() || r.user.login === user) continue
      list.push({ key: keyOf("review", r.id), kind: "review", id: r.id, author: r.user.login, body: r.body, location: `Review · ${r.state.toLowerCase().replace("_", " ")}` })
    }
    for (const c of comments) {
      if (c.user.login === user) continue
      list.push({ key: keyOf("issue", c.id), kind: "issue", id: c.id, author: c.user.login, body: c.body, location: "Conversation" })
    }
    return list
  }, [reviewComments, reviews, comments, user])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.key)))

  useEffect(() => {
    let active = true
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.skills)) setSkills(d.skills)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSkills(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Restore the local workspace (unpushed commits / merge state). Uncommitted leftovers of an
  // abandoned agent run are dropped; they can never be reviewed again.
  useEffect(() => {
    let active = true
    void (async () => {
      const session = await refreshWorkspace()
      if (!active || !session || !session.dirty || session.merging) return
      await postJson("/api/fixes/discard", { sessionId: session.id }).catch(() => {})
      if (active) await refreshWorkspace()
    })()
    return () => {
      active = false
    }
  }, [refreshWorkspace])

  // Leaving the tab with an unapproved run drops that run only; queued commits stay on disk.
  useEffect(() => {
    return () => {
      const id = sessionRef.current
      if (!id) return
      void fetch("/api/fixes/discard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
        keepalive: true,
      })
    }
  }, [])

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  async function run() {
    setPhase("running")
    setError("")
    setLogs([])
    setOutcome(null)
    setDone(null)
    try {
      const response = await fetch("/api/fixes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo,
          number: pr.number,
          targets: items.filter((i) => selected.has(i.key)).map(({ kind, id }) => ({ kind, id })),
          skills: selectedSkills,
          customPrompt,
          model: effectiveModel,
        }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Request failed with ${response.status}`)
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Agent stream unavailable")
      const decoder = new TextDecoder()
      let buffer = ""
      let final: FixOutcome | null = null
      let streamError = ""
      while (true) {
        const { done: finished, value } = await reader.read()
        if (finished) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          let parsed: { type?: string; message?: string; session?: FixOutcome; error?: string }
          try {
            parsed = JSON.parse(line)
          } catch {
            continue
          }
          if (parsed.type === "log" && parsed.message) setLogs((prev) => [...prev, parsed.message as string])
          else if (parsed.type === "result" && parsed.session) final = parsed.session
          else if (parsed.type === "error") streamError = parsed.error || "Fix agent failed"
        }
      }
      if (streamError) throw new Error(streamError)
      if (!final) throw new Error("Agent finished without a result")
      sessionRef.current = final.id
      setOutcome(final)
      setReplies(Object.fromEntries(final.results.map((r) => [keyOf(r.kind, r.id), r.reply])))
      setCommitMessage(`Address review feedback\n\n${final.summary}`.trim())
      setPhase(final.hasChanges ? "review" : "idle")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fix agent failed")
      setPhase("idle")
    }
  }

  async function approve() {
    if (!outcome?.id) return
    setBusyAction("approve")
    setError("")
    setNotice("")
    try {
      const data = await postJson<{ pushed?: boolean; queued?: number; sha?: string; posted?: number; failed?: string[] }>(
        "/api/fixes/approve",
        {
          sessionId: outcome.id,
          commitMessage,
          push: pushNow,
          replies: postReplies
            ? outcome.results.map((r) => ({ kind: r.kind, id: r.id, body: replies[keyOf(r.kind, r.id)] ?? "" }))
            : [],
        }
      )
      sessionRef.current = null
      if (data.pushed && data.sha) {
        setDone({ sha: data.sha, posted: data.posted ?? 0, failed: data.failed ?? [] })
        setPhase("done")
      } else {
        setNotice(`Committed locally (${data.queued ?? 1} unpushed). Replies are posted when you push.`)
        setOutcome(null)
        setPhase("idle")
      }
      await refreshWorkspace()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed")
      // The commit may already be queued locally even though the push failed.
      const session = await refreshWorkspace()
      if (session && !session.dirty) {
        sessionRef.current = null
        setOutcome(null)
        setPhase("idle")
      }
    } finally {
      setBusyAction(null)
    }
  }

  async function discard() {
    if (!outcome?.id) return
    setBusyAction("discard")
    try {
      await postJson("/api/fixes/discard", { sessionId: outcome.id })
      sessionRef.current = null
      setOutcome(null)
      setPhase("idle")
      await refreshWorkspace()
    } finally {
      setBusyAction(null)
    }
  }

  async function syncRemote() {
    if (!workspace) return
    setBusyAction("sync")
    setError("")
    setNotice("")
    try {
      const result = await postJson<{ status: string; conflicts: string[] }>("/api/fixes/sync", { sessionId: workspace.id, action: "pull" })
      const messages: Record<string, string> = {
        "up-to-date": `Already up to date with origin/${workspace.headRef}.`,
        "fast-forwarded": `Pulled new remote commits (fast-forward) from origin/${workspace.headRef}.`,
        merged: `Merged new remote commits from origin/${workspace.headRef} into your local fixes.`,
        conflict: `Remote changes conflict with your local fixes in ${result.conflicts.length} file(s). Resolve them below.`,
      }
      setNotice(messages[result.status] ?? "Synced.")
      await refreshWorkspace()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      setBusyAction(null)
    }
  }

  async function pushAll() {
    if (!workspace) return
    setBusyAction("push")
    setError("")
    setNotice("")
    try {
      const data = await postJson<{ sha: string; posted: number; failed: string[] }>("/api/fixes/push", { sessionId: workspace.id })
      setDone({ sha: data.sha, posted: data.posted, failed: data.failed })
      setPhase("done")
      await refreshWorkspace()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Push failed")
    } finally {
      setBusyAction(null)
    }
  }

  async function discardAll() {
    if (!workspace) return
    if (!window.confirm(`Discard ${workspace.queue.length} unpushed local commit(s)? This cannot be undone.`)) return
    setBusyAction("discardAll")
    setError("")
    try {
      await postJson("/api/fixes/discard", { sessionId: workspace.id, all: true })
      setNotice("Local commits discarded.")
      await refreshWorkspace()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discard failed")
    } finally {
      setBusyAction(null)
    }
  }

  const running = phase === "running"
  const authorOf = (r: FixResult) => items.find((i) => i.kind === r.kind && i.id === r.id)

  return (
    <div className="space-y-6 max-w-full min-w-0">
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                  <Wrench className="size-4" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Address Feedback with Agent</h3>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {effectiveModel || "Claude default"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                The agent edits a local git worktree of <code className="font-mono">{pr.head.ref}</code> to resolve
                the comments you select. Nothing is pushed or posted until you say so: keep several fixes as local
                commits, sync with the remote, then push them all at once.
              </p>
            </div>
            <Button
              onClick={() => void run()}
              disabled={running || phase === "review" || selected.size === 0 || Boolean(workspace?.merging)}
              className="gap-2 font-medium shrink-0 shadow-xs"
            >
              {running ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Agent working...</span>
                </>
              ) : (
                <>
                  <Wrench className="size-4" />
                  <span>Address {selected.size} comment{selected.size === 1 ? "" : "s"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
        {error && (
          <div className="border-t border-destructive/20 bg-destructive/10 px-6 py-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {notice && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-800 dark:text-sky-200">{notice}</div>
      )}

      {workspace?.merging && (
        <MergeConflicts
          sessionId={workspace.id}
          headRef={workspace.headRef}
          conflicts={workspace.conflicts}
          agent={{ skills: selectedSkills, customPrompt, model: effectiveModel }}
          onChanged={() => void refreshWorkspace()}
          onCompleted={(sha) => {
            setNotice(`Merge committed (${sha.slice(0, 7)}). Review, then Push all.`)
            void refreshWorkspace()
          }}
          onAborted={() => {
            setNotice("Sync aborted. Your local commits are unchanged.")
            void refreshWorkspace()
          }}
        />
      )}

      {workspace && !workspace.merging && workspace.queue.length > 0 && phase !== "done" && (
        <Card className="border-primary/30 bg-primary/5 shadow-xs">
          <CardHeader className="space-y-1 py-3">
            <div className="flex items-center gap-2">
              <GitCommitHorizontal className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {workspace.queue.length} local commit{workspace.queue.length === 1 ? "" : "s"}, not pushed
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Queued on <code className="font-mono">{workspace.headRef}</code>. Replies to reviewers are posted after the push.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <ul className="space-y-1 text-xs">
              {workspace.queue.map((c) => (
                <li key={c.sha} className="flex gap-2">
                  <code className="font-mono text-muted-foreground">{c.sha.slice(0, 7)}</code>
                  <span className="truncate">{c.message.split("\n")[0]}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" disabled={busyAction !== null || phase !== "idle"} onClick={() => void syncRemote()}>
                {busyAction === "sync" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {busyAction === "sync" ? "Fetching & merging..." : "Sync with remote"}
              </Button>
              <Button className="gap-2" disabled={busyAction !== null || phase !== "idle"} onClick={() => void pushAll()}>
                {busyAction === "push" ? <LoaderCircle className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
                {busyAction === "push" ? "Pushing..." : "Push all"}
              </Button>
              <Button variant="ghost" className="gap-2" disabled={busyAction !== null || phase !== "idle"} onClick={() => void discardAll()}>
                {busyAction === "discardAll" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Discard all
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "idle" || running ? (
        <>
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <h3 className="text-sm font-semibold">Feedback to address ({items.length})</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" disabled={running} onClick={() => setSelected(new Set(items.map((i) => i.key)))}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" disabled={running} onClick={() => setSelected(new Set())}>
                  Select none
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-96 space-y-2 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments from other people on this pull request.</p>
              ) : (
                items.map((item) => (
                  <label
                    key={item.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-xs hover:bg-muted/40",
                      selected.has(item.key) && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <Checkbox checked={selected.has(item.key)} disabled={running} onCheckedChange={() => toggle(item.key)} className="mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">@{item.author}</span>
                        {item.location && <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">{item.location}</code>}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-muted-foreground line-clamp-4">{item.body}</p>
                    </div>
                  </label>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs overflow-visible">
            <CardContent className="space-y-3 p-4 overflow-visible">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Agent Options</h3>
              </div>
              <div>
                <label htmlFor="fix-model" className="mb-1 block text-xs text-muted-foreground">
                  Model
                </label>
                <select
                  id="fix-model"
                  value={overrideModel}
                  onChange={(e) => setOverrideModel(e.target.value)}
                  disabled={running}
                  className="flex h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50"
                >
                  <option value="">Use settings default</option>
                  {claudeModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.displayName} ({m.value})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-foreground">Agent Skills to Enforce</label>
                  {selectedSkills.length > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">{selectedSkills.length} selected</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Selected skills are injected into the agent&apos;s instructions and applied to every change it makes.
                </p>
                <SkillsMultiSelect skills={skills} selected={selectedSkills} onChange={setSelectedSkills} isLoading={loadingSkills} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Optional extra instructions</p>
                <Textarea
                  placeholder="Additional instructions for the agent..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={running}
                  className="min-h-20 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {(running || logs.length > 0) && phase !== "done" && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="py-3">
            <h3 className="text-sm font-semibold">Live Agent Logs</h3>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
              {logs.join("\n") || "Starting…"}
            </pre>
          </CardContent>
        </Card>
      )}

      {phase === "idle" && outcome && !outcome.hasChanges && (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="space-y-2 p-4 text-xs">
            <p className="font-semibold text-foreground">The agent made no code changes.</p>
            <p className="text-muted-foreground">{outcome.summary}</p>
          </CardContent>
        </Card>
      )}

      {phase === "review" && outcome && (
        <div className="space-y-5">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="py-3">
              <h3 className="text-sm font-semibold">Summary</h3>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 text-xs">
              <p className="whitespace-pre-wrap text-muted-foreground">{outcome.summary}</p>
              <div className="flex flex-wrap gap-1">
                {outcome.files.map((f) => (
                  <code key={f} className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
                    {f}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="py-3">
              <h3 className="text-sm font-semibold">Proposed changes</h3>
            </CardHeader>
            <CardContent className="p-0">
              <DiffBlock diff={outcome.diff} className="max-h-[32rem]" />
              {outcome.truncated && (
                <p className="border-t border-border/50 px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  Diff display truncated. The full change set is still what will be committed.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <h3 className="text-sm font-semibold">Replies to reviewers</h3>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={postReplies} onCheckedChange={(v) => setPostReplies(Boolean(v))} />
                Post replies after pushing
              </label>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {outcome.results.map((r) => {
                const k = keyOf(r.kind, r.id)
                return (
                  <div key={k} className="space-y-1.5 rounded-md border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className={cn("text-[10px] font-semibold uppercase", STATUS_STYLES[r.status])}>{r.status}</Badge>
                      <span className="font-semibold">@{authorOf(r)?.author ?? "reviewer"}</span>
                      {authorOf(r)?.location && <code className="font-mono text-[10px] text-muted-foreground">{authorOf(r)?.location}</code>}
                    </div>
                    <Textarea
                      value={replies[k] ?? ""}
                      onChange={(e) => setReplies((prev) => ({ ...prev, [k]: e.target.value }))}
                      disabled={!postReplies}
                      className="min-h-16 text-xs"
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs">
            <CardContent className="space-y-3 p-4">
              <div>
                <label htmlFor="fix-commit" className="mb-1 block text-xs text-muted-foreground">
                  Commit message ({pushNow ? <>pushed to <code className="font-mono">{pr.head.ref}</code>, no force-push</> : "committed locally, pushed later with Push all"})
                </label>
                <Textarea id="fix-commit" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="min-h-20 font-mono text-xs" />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={pushNow} onCheckedChange={(v) => setPushNow(Boolean(v))} />
                Push immediately after approving (otherwise keep it local and push all fixes at once)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void approve()} disabled={busyAction !== null || !commitMessage.trim()} className="gap-2">
                  {busyAction === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <GitCommitHorizontal className="size-4" />}
                  {busyAction === "approve" ? (pushNow ? "Pushing..." : "Committing...") : pushNow ? "Approve, commit & push" : "Approve & keep local"}
                </Button>
                <Button variant="outline" onClick={() => void discard()} disabled={busyAction !== null} className="gap-2">
                  {busyAction === "discard" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Discard changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "done" && done && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardContent className="space-y-2 p-4 text-xs">
            <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="size-4" />
              Pushed <code className="font-mono">{done.sha.slice(0, 7)}</code> to {pr.head.ref}. Local workspace cleaned up.
            </p>
            {done.posted > 0 && <p className="text-muted-foreground">{done.posted} repl{done.posted === 1 ? "y" : "ies"} posted.</p>}
            {done.failed.length > 0 && (
              <p className="text-destructive">Some replies failed: {done.failed.join("; ")}</p>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReload}>
              Reload pull request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
