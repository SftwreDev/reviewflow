import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"
import { hasClaudeCodeAuth } from "@/lib/claude"
import { sameOrigin } from "@/lib/same-origin"
export const runtime = "nodejs"
const dir = path.join(process.env.HOME || ".", ".reviewflow")
async function secret(name: string, value?: string) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const file = path.join(dir, name), keyFile = path.join(dir, "credential-key")
  let key: Buffer
  try { key = await readFile(keyFile) } catch { key = randomBytes(32); await writeFile(keyFile, key, { mode: 0o600, flag: "wx" }) }
  if (value !== undefined) { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv), data = Buffer.concat([cipher.update(value), cipher.final()]); await writeFile(file, Buffer.concat([iv, cipher.getAuthTag(), data]), { mode: 0o600 }); return }
  try { const data = await readFile(file), decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString() } catch { return null }
}
export async function GET() {
  return NextResponse.json({
    claudeConfigured: Boolean(await secret("claude-key")),
    claudeModel: (await secret("claude-model")) || null,
    claudeCodeAuth: await hasClaudeCodeAuth(),
    repo: await readFile(path.join(dir, "repo"), "utf8").catch(() => ""),
  })
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const data = body as Record<string, unknown>
    if (data.action === "repo" && typeof data.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(data.repo)) { await mkdir(dir, { recursive: true, mode: 0o700 }); await writeFile(path.join(dir, "repo"), data.repo, { mode: 0o600 }); return NextResponse.json({ ok: true }) }
    if (data.action === "claude-remove") { const { unlink } = await import("node:fs/promises"); await unlink(path.join(dir, "claude-key")).catch(() => {}); return NextResponse.json({ ok: true }) }
    if (data.action === "claude-save" && typeof data.key === "string" && data.key.length > 10 && data.key.length < 500) { await secret("claude-key", data.key); return NextResponse.json({ ok: true }) }
    if (data.action === "claude-model" && typeof data.model === "string" && data.model.length > 0 && data.model.length < 200) { await secret("claude-model", data.model); return NextResponse.json({ ok: true }) }
    if (data.action === "claude-test") {
      const apiKey = typeof data.key === "string" ? data.key : await secret("claude-key")
      if (apiKey) {
        const res = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } })
        if (!res.ok) return NextResponse.json({ error: `Anthropic returned ${res.status}` }, { status: 400 })
        return NextResponse.json({ ok: true, source: "api-key" })
      }
      if (await hasClaudeCodeAuth()) return NextResponse.json({ ok: true, source: "device" })
      return NextResponse.json({ error: "Claude API key not configured and no Claude Code login found" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch { return NextResponse.json({ error: "Settings operation failed" }, { status: 500 }) }
}
