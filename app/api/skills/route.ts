import { NextRequest, NextResponse } from "next/server"
import { deleteSkill, getSkill, listSkills, saveSkill } from "@/lib/skills"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")
  try {
    if (name) {
      const skill = await getSkill(name)
      if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 })
      return NextResponse.json({ skill })
    }
    return NextResponse.json({ skills: await listSkills() })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load skills" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string
      name?: string
      content?: string
    } | null
    if (!body || typeof body.action !== "string")
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })

    if (body.action === "save" && typeof body.name === "string" && typeof body.content === "string") {
      await saveSkill(body.name, body.content)
      return NextResponse.json({ ok: true })
    }
    if (body.action === "delete" && typeof body.name === "string") {
      await deleteSkill(body.name)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save skill" },
      { status: 500 }
    )
  }
}
