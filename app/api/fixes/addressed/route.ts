import { NextRequest, NextResponse } from "next/server"
import { listAddressedFeedback } from "@/lib/addressed-feedback"
import { REPO_RE } from "@/lib/fix-sessions"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo")
  const number = Number(request.nextUrl.searchParams.get("number"))
  if (!repo || !REPO_RE.test(repo) || !Number.isInteger(number) || number < 1)
    return NextResponse.json({ error: "Invalid repository or pull request" }, { status: 400 })
  return NextResponse.json({ records: await listAddressedFeedback(repo, number) })
}
