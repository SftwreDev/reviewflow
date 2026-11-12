import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { ghRest } from "@/lib/github-rest"
import { publishQueue } from "@/lib/fix-publish"
import {
  assertNotMerging,
  commitStaged,
  loadSession,
  normalizeFeedbackId,
  saveSession,
  type FeedbackId,
  type FeedbackKind,
  type QueuedReply,
} from "@/lib/fix-sessions"
import { sameOrigin } from "@/lib/same-origin"
export const runtime = "nodejs"

type Reply = { kind: FeedbackKind; id: FeedbackId; body: string }

/**
 * Commits the agent's pending changes. With `push: false` the commit is queued locally (replies are
 * held until the push); with `push: true` the whole queue is pushed right away.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown
    commitMessage?: unknown
    replies?: unknown
    push?: unknown
  } | null
  if (!body || typeof body.sessionId !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const message = typeof body.commitMessage === "string" ? body.commitMessage.trim() : ""
  if (!message) return NextResponse.json({ error: "Commit message is required" }, { status: 400 })

  const session = await loadSession(body.sessionId).catch(() => null)
  if (!session) return NextResponse.json({ error: "Fix session not found or expired" }, { status: 404 })
  const token = await readCredential("github-token")
  if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })

  // Replies are user-edited text; only accept ones that belong to this session's feedback items.
  const replies: QueuedReply[] = []
  for (const r of (Array.isArray(body.replies) ? body.replies : []) as Reply[]) {
    if (!r || typeof r.body !== "string" || !r.body.trim()) continue
    const id = normalizeFeedbackId(r.kind, r.id)
    if (!session.targets.some((t) => t.kind === r.kind && normalizeFeedbackId(t.kind, t.id) === id)) continue
    const status = session.results.find((x) => x.kind === r.kind && normalizeFeedbackId(x.kind, x.id) === id)?.status ?? "partial"
    replies.push({ kind: r.kind, id, body: r.body, status })
  }

  try {
    await assertNotMerging(session.id)
    const who = await ghRest<{ login: string; id: number }>(token, "/user")
    const sha = await commitStaged(session, message, { login: who.login, userId: who.id })
    if (!sha) throw new Error("No changes to commit")
    // Record every target selected for this run, not just results the model returned. Declined
    // targets are addressed too: they leave the inbox and show under "Addressed feedback" with
    // their reply. Only targets the user did not select stay in the inbox.
    const runTargets = session.lastTargets ?? session.targets
    const addressed = runTargets.map((target) => {
      const id = normalizeFeedbackId(target.kind, target.id)
      const result = session.results.find(
        (x) => x.kind === target.kind && normalizeFeedbackId(x.kind, x.id) === id
      )
      return { kind: target.kind, id, status: result?.status ?? ("declined" as const) }
    })
    session.queue.push({ sha, message, replies, addressed })
    session.summary = ""
    session.results = []
    session.lastTargets = []
    await saveSession(session)
    if (body.push !== true) return NextResponse.json({ queued: session.queue.length, sha })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commit failed" }, { status: 502 })
  }

  try {
    const published = await publishQueue(session, token)
    return NextResponse.json({ pushed: true, ...published })
  } catch (error) {
    // The commit is already queued, so "Push all" can be retried after syncing.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Push failed", queued: session.queue.length },
      { status: 502 }
    )
  }
}
