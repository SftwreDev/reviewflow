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
async function graphql(token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}: ${body.message}`)
  if (body.errors)
    throw new Error(`GitHub GraphQL error: ${body.errors.map((e: { message: string }) => e.message).join(", ")}`)
  return body.data
}
async function originOK(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
}
type Author = { author: { login: string } | null }
function commentedByMe(
  node: {
    issueComments?: { nodes: Author[] }
    reviews?: { nodes: (Author & { body: string })[] }
    reviewThreads?: { nodes: { comments: { nodes: Author[] } }[] }
  },
  login: string
) {
  const mine = (n: Author) => n.author?.login === login
  return Boolean(
    node.issueComments?.nodes.some(mine) ||
    node.reviews?.nodes.some((r) => mine(r) && r.body.trim()) ||
    node.reviewThreads?.nodes.some((t) => t.comments.nodes.some(mine))
  )
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
    const [owner, name] = repo.split("/")
    const pulls: {
      number: number
      title: string
      state: string
      draft: boolean
      merged_at: string | null
      html_url: string
      user: { login: string }
      created_at: string
      updated_at: string
      head: { ref: string; sha: string }
      base: { ref: string }
      requested_reviewers: { login: string }[]
      labels?: { name: string; color: string }[]
      comments?: number
      review_comments?: number
      reviewDecision?: string | null
      commentedByMe?: boolean
    }[] = []
    let after: string | null = null
    for (let i = 0; i < 10; i++) {
      const result = await graphql(
        token,
        `query($owner: String!, $name: String!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            pullRequests(first: $first, after: $after, states: [OPEN, CLOSED], orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                number
                title
                state
                isDraft
                mergedAt
                url
                author { login }
                createdAt
                updatedAt
                headRefName
                headRefOid
                baseRefName
                labels(first: 10) { nodes { name color } }
                reviewDecision
                comments(first: 0) { totalCount }
                issueComments: comments(last: 30) { nodes { author { login } } }
                reviews(last: 30) { nodes { author { login } body } }
                reviewThreads(first: 100) { nodes { isResolved comments(first: 10) { nodes { author { login } } } } }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        { owner, name, first: 100, after }
      )
      const connection = result.repository.pullRequests
      for (const node of connection.nodes) {
        pulls.push({
          number: node.number,
          title: node.title,
          state: node.state.toLowerCase(),
          draft: node.isDraft,
          merged_at: node.mergedAt,
          html_url: node.url,
          user: { login: node.author?.login ?? "" },
          created_at: node.createdAt,
          updated_at: node.updatedAt,
          head: { ref: node.headRefName, sha: node.headRefOid },
          base: { ref: node.baseRefName },
          requested_reviewers: [],
          labels: node.labels?.nodes?.map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })) ?? [],
          comments: node.comments?.totalCount ?? 0,
          review_comments: node.reviewThreads?.nodes?.filter((n: { isResolved: boolean }) => !n.isResolved).length ?? 0,
          reviewDecision: node.reviewDecision ?? null,
          commentedByMe: commentedByMe(node, who.login),
        })
      }
      if (!connection.pageInfo.hasNextPage) break
      after = connection.pageInfo.endCursor
    }
    return NextResponse.json({ pulls, user: who.login })
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
