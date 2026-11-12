import { NextRequest, NextResponse } from "next/server"
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications-store"
import { sameOrigin } from "@/lib/same-origin"

export const runtime = "nodejs"
const REPO_RE = /^[\w.-]+\/[\w.-]+$/

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo")
  if (repo && !REPO_RE.test(repo)) {
    return NextResponse.json({ error: "Invalid repository" }, { status: 400 })
  }
  try {
    return NextResponse.json({
      notifications: await listNotifications(repo || undefined),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load notifications",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as {
    action?: unknown
    repo?: unknown
    ids?: unknown
  } | null
  if (!body || (body.action !== "read" && body.action !== "read-all")) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
  const repo = typeof body.repo === "string" ? body.repo : undefined
  if (repo && !REPO_RE.test(repo)) {
    return NextResponse.json({ error: "Invalid repository" }, { status: 400 })
  }
  const ids =
    body.action === "read" && Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : undefined
  if (body.action === "read" && (!ids || ids.length === 0)) {
    return NextResponse.json(
      { error: "No notifications selected" },
      { status: 400 }
    )
  }
  const changed = await markNotificationsRead({
    repo: body.action === "read-all" ? repo : undefined,
    ids,
  })
  return NextResponse.json({ ok: true, changed })
}
