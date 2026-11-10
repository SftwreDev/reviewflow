import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
const dataDir = path.join(process.env.HOME || ".", ".reviewflow")
const tokenPath = path.join(dataDir, "github-token")
const keyPath = path.join(dataDir, "credential-key")
async function key() {
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  try { return await readFile(keyPath) } catch {
    const secret = randomBytes(32)
    await writeFile(keyPath, secret, { mode: 0o600, flag: "wx" })
    return secret
  }
}
async function getToken() {
  try {
    const [raw, secret] = await Promise.all([readFile(tokenPath), key()])
    const iv = raw.subarray(0, 12)
    const decipher = createDecipheriv("aes-256-gcm", secret, iv)
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()
  } catch { return null }
}
async function saveToken(token: string) {
  const secret = await key(), iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", secret, iv)
  const encrypted = Buffer.concat([cipher.update(token), cipher.final()])
  await writeFile(tokenPath, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 })
}
async function api(token: string, endpoint: string) {
  const response = await fetch(`https://api.github.com${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" })
  const body = await response.json()
  if (!response.ok) throw new Error(response.status === 403 ? `GitHub denied request (rate limit or permission): ${body.message}` : `GitHub ${response.status}: ${body.message}`)
  return body
}
async function originOK(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
}
export async function GET(request: NextRequest) {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: "GitHub token not configured" }, { status: 401 })
    const who = await api(token, "/user")
    const p = request.nextUrl.searchParams
    if (p.has("repos")) {
      const all: { id: number; full_name: string; owner: { login: string }; name: string; private: boolean; description: string | null }[] = []
      for (let page = 1; page <= 10; page++) {
        const result = await api(token, `/user/repos?per_page=100&sort=updated&page=${page}&affiliation=owner,collaborator,organization_member`) as typeof all
        all.push(...result)
        if (result.length < 100) break
      }
      return NextResponse.json({ user: who, repositories: all.map((r) => ({ id: r.id, full_name: r.full_name, owner: r.owner.login, name: r.name, private: r.private, description: r.description })) })
    }
    const repo = p.get("repo"), number = p.get("number")
    if (!repo) return NextResponse.json({ user: { login: who.login, avatar_url: who.avatar_url } })
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 })
    if (p.has("labels")) {
      const labels = await api(token, `/repos/${repo}/labels?per_page=100`)
      return NextResponse.json({ labels })
    }
    if (number) {
      const pr = await api(token, `/repos/${repo}/pulls/${Number(number)}`)
      const pages: unknown[] = []
      for (let page = 1; page <= 10; page++) {
        const files = (await api(token, `/repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`)) as unknown[]
        pages.push(...files)
        if (files.length < 100) break
      }
      const [reviews, comments, reviewComments, checks] = await Promise.all([
        api(token, `/repos/${repo}/pulls/${number}/reviews`).catch(() => []),
        api(token, `/repos/${repo}/issues/${number}/comments`).catch(() => []),
        api(token, `/repos/${repo}/pulls/${number}/comments`).catch(() => []),
        api(token, `/repos/${repo}/commits/${pr.head.sha}/check-runs`).catch(() => ({ check_runs: [] })),
      ])
      return NextResponse.json({
        pr,
        files: pages,
        reviews,
        comments,
        reviewComments,
        checks: checks?.check_runs || [],
      })
    }
    const pulls: { number: number; user: { login: string }; labels?: { name: string; color: string }[] }[] = []
    for (const state of ["open", "closed"]) for (let page = 1; page <= 10; page++) {
      const batch = (await api(token, `/repos/${repo}/pulls?state=${state}&per_page=100&page=${page}&sort=updated&direction=desc`)) as { number: number; user: { login: string }; labels?: { name: string; color: string }[] }[]
      pulls.push(...batch.filter((pr) => pr.user.login === who.login))
      if (batch.length < 100) break
    }
    const seen = new Map(pulls.map(pr => [pr.number, pr]))
    return NextResponse.json({ pulls: [...seen.values()], user: who.login })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub request failed" }, { status: 502 }) }
}
export async function POST(request: NextRequest) {
  if (!(await originOK(request))) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  try {
    const data = await request.json()
    if (data.action === "remove") { const { unlink } = await import("node:fs/promises"); await unlink(tokenPath).catch(() => {}); return NextResponse.json({ ok: true }) }
    if (typeof data.token !== "string" || data.token.length < 10 || data.token.length > 500) return NextResponse.json({ error: "Enter valid GitHub token" }, { status: 400 })
    const who = await api(data.token, "/user")
    if (data.action === "test") return NextResponse.json({ login: who.login, avatar_url: who.avatar_url })
    await saveToken(data.token)
    return NextResponse.json({ login: who.login, avatar_url: who.avatar_url })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub validation failed" }, { status: 400 }) }
}
