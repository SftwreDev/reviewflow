import { NextRequest, NextResponse } from "next/server"
import { findJob, forgetJob, getJob, snapshot, type JobKind } from "@/lib/background-jobs"
import { sameOrigin } from "@/lib/same-origin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

/** Snapshot of a job by id, or the latest job for a kind + pull request. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (id) {
    const job = getJob(id)
    return job ? NextResponse.json({ job: snapshot(job) }) : NextResponse.json({ job: null })
  }

  const kind = request.nextUrl.searchParams.get("kind")
  const repo = request.nextUrl.searchParams.get("repo")
  const number = Number(request.nextUrl.searchParams.get("number"))
  if (
    (kind !== "review" && kind !== "fix") ||
    !repo ||
    !REPO_RE.test(repo) ||
    !Number.isInteger(number) ||
    number < 1
  ) {
    return NextResponse.json({ error: "Invalid job lookup" }, { status: 400 })
  }

  const job = findJob(kind as JobKind, repo, number)
  return NextResponse.json({ job: job ? snapshot(job) : null })
}

/** Removes a finished job after its outcome was approved or discarded. */
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  const job = getJob(id)
  if (!job) return NextResponse.json({ ok: true })
  if (job.status === "running") return NextResponse.json({ error: "Job is still running" }, { status: 409 })
  forgetJob(id)
  return NextResponse.json({ ok: true })
}
