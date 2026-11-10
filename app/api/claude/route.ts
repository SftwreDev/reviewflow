import { NextRequest, NextResponse } from "next/server"
import { getClaudeCapabilities } from "@/lib/claude"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1"
  try {
    return NextResponse.json(await getClaudeCapabilities(force))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Claude capabilities" },
      { status: 500 }
    )
  }
}
