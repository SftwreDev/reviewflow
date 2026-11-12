import { NextRequest, NextResponse } from "next/server"
import { cleanupSession, loadSession, resetPending, sessionStatus } from "@/lib/fix-sessions"
import { sameOrigin } from "@/lib/same-origin"
export const runtime = "nodejs"

/**
 * Default: drop the uncommitted agent run (queued commits survive; the workspace is removed only if
 * nothing else is in it). `all: true`: remove the workspace including every queued commit.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; all?: unknown } | null
  if (!body || typeof body.sessionId !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  try {
    const session = await loadSession(body.sessionId)
    if (!session) return NextResponse.json({ cleaned: true })
    if (body.all === true) {
      await cleanupSession(session.id)
      return NextResponse.json({ cleaned: true })
    }
    const status = await sessionStatus(session)
    // A merge in progress is resolved or aborted explicitly; resetting would silently abort it.
    if (status.merging) return NextResponse.json({ cleaned: false, merging: true })
    if (session.queue.length === 0) {
      await cleanupSession(session.id)
      return NextResponse.json({ cleaned: true })
    }
    await resetPending(session.id)
    return NextResponse.json({ cleaned: false, queued: session.queue.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid session" }, { status: 400 })
  }
}
