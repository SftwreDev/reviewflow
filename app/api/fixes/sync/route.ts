import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { ghRest } from "@/lib/github-rest"
import {
  abortMerge,
  completeMerge,
  conflictDiff,
  filesWithMarkers,
  listConflicts,
  loadSession,
  readConflictFile,
  resolveConflictFile,
  syncWithRemote,
} from "@/lib/fix-sessions"
export const runtime = "nodejs"

/**
 * pull     git fetch + merge of the remote PR branch into the local workspace
 * read     one conflicted file's content
 * resolve  keep mine ("ours") / take remote ("theirs") / manual edit for one conflicted file
 * diff     combined diff of the current conflict state
 * complete create the merge commit once every conflict is resolved
 * abort    git merge --abort
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown
    action?: unknown
    file?: unknown
    mode?: unknown
    content?: unknown
  } | null
  if (!body || typeof body.sessionId !== "string" || typeof body.action !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const session = await loadSession(body.sessionId).catch(() => null)
  if (!session) return NextResponse.json({ error: "Fix session not found" }, { status: 404 })

  try {
    switch (body.action) {
      case "pull":
      case "complete": {
        const token = await readCredential("github-token")
        if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })
        const who = await ghRest<{ login: string; id: number }>(token, "/user")
        const identity = { login: who.login, userId: who.id }
        if (body.action === "pull") return NextResponse.json(await syncWithRemote(session, token, identity))
        return NextResponse.json({ sha: await completeMerge(session, identity) })
      }
      case "abort":
        await abortMerge(session)
        return NextResponse.json({ aborted: true })
      case "read":
        if (typeof body.file !== "string") break
        return NextResponse.json(await readConflictFile(session.id, body.file))
      case "resolve": {
        if (typeof body.file !== "string" || !["ours", "theirs", "manual"].includes(body.mode as string)) break
        const content = typeof body.content === "string" ? body.content : undefined
        const conflicts = await resolveConflictFile(session.id, body.file, body.mode as "ours" | "theirs" | "manual", content)
        return NextResponse.json({ conflicts })
      }
      case "diff":
        return NextResponse.json({
          ...(await conflictDiff(session.id)),
          conflicts: await listConflicts(session.id),
          markers: await filesWithMarkers(session.id),
        })
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 502 })
  }
}
