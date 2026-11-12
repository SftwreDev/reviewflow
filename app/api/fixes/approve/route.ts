import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { ghRest } from "@/lib/github-rest"
import { publishQueue } from "@/lib/fix-publish"
import {
  assertNotMerging,
  commitStaged,
  loadSession,
  saveSession,
  type FeedbackKind,
  type QueuedReply,
} from "@/lib/fix-sessions"
import { sameOrigin } from "@/lib/same-origin"
export const runtime = "nodejs"

type Reply = { kind: FeedbackKind; id: number; body: string }

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
    if (!session.targets.some((t) => t.kind === r.kind && t.id === r.id)) continue
    const status = session.results.find((x) => x.kind === r.kind && x.id === r.id)?.status ?? "partial"
    replies.push({ kind: r.kind, id: r.id, body: r.body, status })
  }

  try {
    await assertNotMerging(session.id)
    const who = await ghRest<{ login: string; id: number }>(token, "/user")
    const sha = await commitStaged(session, message, { login: who.login, userId: who.id })
    if (!sha) throw new Error("No changes to commit")
    const addressed = session.results
      .filter((result) => result.status !== "declined")
      .map((result) => ({ kind: result.kind, id: result.id, status: result.status }))
    session.queue.push({ sha, message, replies, addressed })
    session.summary = ""
    session.results = []
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
