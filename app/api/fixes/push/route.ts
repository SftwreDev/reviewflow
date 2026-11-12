import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { publishQueue } from "@/lib/fix-publish"
import { assertNotMerging, git, loadSession, worktreePath } from "@/lib/fix-sessions"
export const runtime = "nodejs"

/** Pushes all queued local commits in one push, then posts the queued replies and removes the workspace. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null
  if (!body || typeof body.sessionId !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const session = await loadSession(body.sessionId).catch(() => null)
  if (!session) return NextResponse.json({ error: "Fix session not found" }, { status: 404 })
  const token = await readCredential("github-token")
  if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })
  try {
    await assertNotMerging(session.id)
    if ((await git(["status", "--porcelain"], { cwd: worktreePath(session.id) })).trim())
      throw new Error("There are uncommitted agent changes. Approve or discard them first.")
    return NextResponse.json(await publishQueue(session, token))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push failed" }, { status: 502 })
  }
}
