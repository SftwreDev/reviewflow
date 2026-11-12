import { NextRequest, NextResponse } from "next/server"
import { listFixUsage } from "@/lib/fix-usage"
import { REPO_RE } from "@/lib/fix-sessions"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo")
  if (!repo || !REPO_RE.test(repo)) {
    return NextResponse.json({ error: "Invalid repository" }, { status: 400 })
  }

  const records = await listFixUsage(repo)
  let totalTokens = 0
  let totalTokenCost = 0
  for (const record of records) {
    totalTokens += record.usage?.totalTokens ?? 0
    totalTokenCost += record.usage?.totalCostUsd ?? 0
  }

  return NextResponse.json({
    totalTokens,
    totalTokenCost,
    totalRuns: records.length,
  })
}
