import { NextRequest, NextResponse } from "next/server"
import { getProvider } from "@/lib/llm/index"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1"
  try {
    const provider = await getProvider()
    return NextResponse.json(await provider.getCapabilities(force))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load capabilities" },
      { status: 500 }
    )
  }
}
