import { NextRequest, NextResponse } from "next/server"
import { getJob, jobStream } from "@/lib/background-jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** NDJSON replay + live tail of a job. Reconnecting never restarts the agent run. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  const job = getJob(id)
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const from = Math.max(0, Number(request.nextUrl.searchParams.get("from")) || 0)
  return new Response(jobStream(job, from), {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  })
}
