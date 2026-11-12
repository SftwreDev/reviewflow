"use client"

import { useState } from "react"
import { AlertTriangle, Bot, Check, GitMerge, LoaderCircle, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { DiffBlock } from "@/components/reviews/diff-block"
import { postJson as post } from "@/lib/post-json"

type Resolution = { summary: string; diff: string; truncated: boolean; markers: string[]; conflicts: string[] }

interface MergeConflictsProps {
  sessionId: string
  headRef: string
  conflicts: string[]
  agent: { skills: string[]; customPrompt: string; model: string }
  onChanged: () => void
  onCompleted: (sha: string) => void
  onAborted: () => void
}

export function MergeConflicts({ sessionId, headRef, conflicts, agent, onChanged, onCompleted, onAborted }: MergeConflictsProps) {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ file: string; content: string; binary: boolean } | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [resolution, setResolution] = useState<Resolution | null>(null)

  const sync = (action: string, extra: Record<string, unknown> = {}) => post<Record<string, unknown>>("/api/fixes/sync", { sessionId, action, ...extra })

  async function run<T>(label: string, task: () => Promise<T>): Promise<T | undefined> {
    setBusy(label)
    setError("")
    try {
      return await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setBusy(null)
    }
  }

  const resolveFile = (file: string, mode: "ours" | "theirs") =>
    run(`${mode}:${file}`, async () => {
      await sync("resolve", { file, mode })
      setEditing(null)
      onChanged()
    })

  const openEditor = (file: string) =>
    run(`edit:${file}`, async () => {
      const data = (await sync("read", { file })) as { content: string; binary: boolean }
      setEditing({ file, content: data.content, binary: data.binary })
    })

  const saveEditor = () =>
    editing &&
    run("save", async () => {
      await sync("resolve", { file: editing.file, mode: "manual", content: editing.content })
      setEditing(null)
      onChanged()
    })

  const resolveWithAgent = () =>
    run("agent", async () => {
      setLogs([])
      setResolution(null)
      const response = await fetch("/api/fixes/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...agent }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Request failed (${response.status})`)
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Agent stream unavailable")
      const decoder = new TextDecoder()
      let buffer = ""
      let final: Resolution | null = null
      let streamError = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          let parsed: { type?: string; message?: string; resolution?: Resolution; error?: string }
          try {
            parsed = JSON.parse(line)
          } catch {
            continue
          }
          if (parsed.type === "log" && parsed.message) setLogs((prev) => [...prev, parsed.message as string])
          else if (parsed.type === "result" && parsed.resolution) final = parsed.resolution
          else if (parsed.type === "error") streamError = parsed.error || "Conflict resolution failed"
        }
      }
      if (streamError) throw new Error(streamError)
      if (!final) throw new Error("Agent finished without a result")
      setResolution(final)
    })

  const finish = () =>
    run("complete", async () => {
      const data = (await sync("complete")) as { sha: string }
      onCompleted(data.sha)
    })

  const abort = () =>
    run("abort", async () => {
      await sync("abort")
      onAborted()
    })

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
      <CardHeader className="space-y-1 py-3">
        <div className="flex items-center gap-2">
          <GitMerge className="size-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold">Merge conflicts with origin/{headRef}</h3>
          <Badge variant="secondary" className="text-[10px]">
            {conflicts.length} file{conflicts.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          The remote branch changed the same lines as your local fixes. <strong>Mine</strong> is your local version,{" "}
          <strong>Remote</strong> is what is on GitHub. Resolve every file, then finish the merge. Nothing is pushed yet.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="whitespace-pre-wrap break-words">{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {conflicts.map((file) => {
            const agentEdited = resolution && !resolution.markers.includes(file)
            return (
              <div key={file} className="space-y-2 rounded-md border border-border/60 bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs">{file}</code>
                    {agentEdited && <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px]">Agent resolved, review below</Badge>}
                    {resolution?.markers.includes(file) && <Badge variant="destructive" className="text-[10px]">Markers remain</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy !== null} onClick={() => void resolveFile(file, "ours")}>
                      {busy === `ours:${file}` ? <LoaderCircle className="size-3 animate-spin" /> : null}
                      Keep mine
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy !== null} onClick={() => void resolveFile(file, "theirs")}>
                      {busy === `theirs:${file}` ? <LoaderCircle className="size-3 animate-spin" /> : null}
                      Take remote
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy !== null} onClick={() => void openEditor(file)}>
                      Edit manually
                    </Button>
                  </div>
                </div>
                {editing?.file === file &&
                  (editing.binary ? (
                    <p className="text-xs text-muted-foreground">Binary file: choose Keep mine or Take remote.</p>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={editing.content}
                        onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                        spellCheck={false}
                        className="min-h-64 font-mono text-[11px] leading-relaxed"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Remove the <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code> and <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> lines and keep the code you want.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 gap-1.5 text-[11px]" disabled={busy !== null} onClick={() => void saveEditor()}>
                          {busy === "save" ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Save as resolved
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )
          })}
          {conflicts.length === 0 && <p className="text-xs text-emerald-700 dark:text-emerald-300">All files resolved. Finish the merge to continue.</p>}
        </div>

        {(busy === "agent" || logs.length > 0) && !resolution && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground">{logs.join("\n") || "Starting…"}</pre>
        )}

        {resolution && (
          <div className="space-y-2 overflow-hidden rounded-md border border-border/60 bg-background">
            <p className="whitespace-pre-wrap px-3 pt-3 text-xs text-muted-foreground">{resolution.summary}</p>
            {resolution.diff ? <DiffBlock diff={resolution.diff} className="max-h-96" /> : null}
            {resolution.truncated && <p className="px-3 pb-2 text-[11px] text-amber-700 dark:text-amber-300">Diff truncated.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" disabled={busy !== null || conflicts.length === 0} onClick={() => void resolveWithAgent()}>
            {busy === "agent" ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
            {busy === "agent" ? "Agent resolving..." : "Resolve all with agent"}
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={() => void finish()}>
            {busy === "complete" ? <LoaderCircle className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
            Finish merge
          </Button>
          <Button variant="ghost" className="gap-2" disabled={busy !== null} onClick={() => void abort()}>
            {busy === "abort" ? <LoaderCircle className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Abort sync
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
