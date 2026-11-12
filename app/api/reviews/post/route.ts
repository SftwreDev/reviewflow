import { NextRequest, NextResponse } from "next/server"
import { readCredential } from "@/lib/credentials"
import { getReview, markReviewPosted } from "@/lib/reviews-store"
import { sameOrigin } from "@/lib/same-origin"

export const runtime = "nodejs"

function formatReviewBody(findings: { title: string; severity: string; filePath: string; lineNumber: number | null; problem: string; evidence: string; impact: string; solution: string }[]): string {
  if (findings.length === 0) return "AI review found no evidence-backed findings."
  return findings
    .map(
      (f) =>
        `## ${f.title}\n\n**Severity:** ${f.severity}\n\n**Location:** \`${f.filePath}${f.lineNumber ? `:${f.lineNumber}` : ""}\`\n\n### Problem\n\n${f.problem}\n\n### Evidence\n\n> ${f.evidence.replace(/\n/g, "\n> ")}\n\n### Impact\n\n${f.impact}\n\n### Suggested fix\n\n${f.solution}`
    )
    .join("\n\n---\n\n")
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })

  const body = (await request.json().catch(() => null)) as {
    reviewId?: unknown
    repo?: unknown
    number?: unknown
    event?: unknown
    findingIndexes?: unknown
  } | null
  if (
    !body ||
    typeof body.reviewId !== "string" ||
    typeof body.repo !== "string" ||
    !/^[\w.-]+\/[\w.-]+$/.test(body.repo) ||
    typeof body.number !== "number" ||
    !Number.isInteger(body.number) ||
    body.number < 1
  )
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const event = body.event === "APPROVE" || body.event === "REQUEST_CHANGES" ? body.event : "COMMENT"
  const review = await getReview(body.reviewId)
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })
  if (review.repo !== body.repo || review.number !== body.number)
    return NextResponse.json({ error: "Review does not belong to this pull request" }, { status: 400 })

  let selectedIndexes = review.findings.map((_, index) => index)
  if (body.findingIndexes !== undefined) {
    if (
      !Array.isArray(body.findingIndexes) ||
      body.findingIndexes.length === 0 ||
      !body.findingIndexes.every(
        (index) => Number.isInteger(index) && index >= 0 && index < review.findings.length
      )
    )
      return NextResponse.json({ error: "Invalid finding selection" }, { status: 400 })
    selectedIndexes = [...new Set(body.findingIndexes as number[])].sort((a, b) => a - b)
  }

  const alreadyPosted =
    review.findings.length === 0
      ? Boolean(review.posted)
      : Boolean(review.posted) &&
        selectedIndexes.some((index) => review.posted!.findingIndexes.includes(index))
  if (alreadyPosted) {
    return NextResponse.json(
      { error: "Selected findings were already posted to this PR", posted: review.posted },
      { status: 409 }
    )
  }

  const findings = selectedIndexes.map((index) => review.findings[index])

  const token = await readCredential("github-token")
  if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })

  const res = await fetch(`https://api.github.com/repos/${body.repo}/pulls/${body.number}/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, body: formatReviewBody(findings) }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json(
      { error: err.message || `GitHub rejected review (${res.status})` },
      { status: res.status }
    )
  }
  const posted = (await res.json()) as { html_url?: string }
  const url = posted.html_url ?? ""
  const updated = await markReviewPosted(review, selectedIndexes, url).catch(() => null)
  return NextResponse.json({
    review: posted,
    posted:
      updated?.posted ?? {
        url,
        at: new Date().toISOString(),
        findingIndexes: selectedIndexes,
      },
  })
}
