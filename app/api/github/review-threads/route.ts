import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { listReviewThreads } from "@/lib/github-threads"
import { REPO_RE } from "@/lib/fix-sessions"

export const runtime = "nodejs"

/** Resolved review threads on a pull request, used to hide feedback that is already handled. */
export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo")
  const number = Number(request.nextUrl.searchParams.get("number"))
  if (!repo || !REPO_RE.test(repo) || !Number.isInteger(number) || number < 1)
    return NextResponse.json({ error: "Invalid repository or pull request" }, { status: 400 })

  const token = await readCredential("github-token")
  if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })

  try {
    const threads = await listReviewThreads(token, repo, number)
    const resolvedCommentIds = [...new Set(threads.filter((thread) => thread.isResolved).flatMap((thread) => thread.commentIds))]
    return NextResponse.json({ resolvedCommentIds })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load review threads" },
      { status: 502 }
    )
  }
}
