import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, readdir, readlink, realpath, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const ROOT = path.join(process.env.HOME || ".", ".reviewflow")
const REPOS_DIR = path.join(ROOT, "repos")
const WORKTREES_DIR = path.join(ROOT, "worktrees")
const SESSIONS_DIR = path.join(ROOT, "fix-sessions")
const STALE_MS = 24 * 60 * 60 * 1000
const MAX_DIFF_CHARS = 400_000
const SYNC_DEPTHS = [50, 500, 5000]
const CONFLICT_MARKER_RE = /^(<{7}|>{7})( |$)/m

export const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type FeedbackKind = "inline" | "issue" | "review"
export type FixResult = {
  kind: FeedbackKind
  id: number
  status: "fixed" | "partial" | "declined"
  reply: string
}
export type QueuedReply = { kind: FeedbackKind; id: number; body: string; status: FixResult["status"] }
export type QueuedCommit = { sha: string; message: string; replies: QueuedReply[] }
export type Identity = { login: string; userId: number }

/**
 * One long-lived workspace per PR. `queue` holds local commits not yet pushed; `summary`/`results`
 * describe the latest agent run whose changes are still uncommitted.
 */
export type FixSession = {
  id: string
  repo: string
  number: number
  headRepo: string
  headRef: string
  /** Last known tip of the remote PR branch. Local commits are everything after it. */
  baseSha: string
  createdAt: string
  model: string
  skills: string[]
  targets: { kind: FeedbackKind; id: number; author: string }[]
  summary: string
  results: FixResult[]
  queue: QueuedCommit[]
  /** Remote tip being merged while a conflicted merge is in progress. */
  mergeRemoteSha?: string
}

export type SessionStatus = {
  id: string
  headRef: string
  queue: { sha: string; message: string }[]
  dirty: boolean
  merging: boolean
  conflicts: string[]
}

export function worktreePath(id: string) {
  if (!SESSION_ID_RE.test(id)) throw new Error("Invalid session id")
  return path.join(WORKTREES_DIR, id)
}

function sessionFile(id: string) {
  if (!SESSION_ID_RE.test(id)) throw new Error("Invalid session id")
  return path.join(SESSIONS_DIR, `${id}.json`)
}

// Isolated from the user's git config (signing, credential helpers, hooks). The token is passed
// through the environment so it never appears in argv, remote URLs or .git/config.
export async function git(args: string[], opts: { cwd?: string; token?: string } = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  }
  if (opts.token) {
    env.GIT_CONFIG_COUNT = "1"
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader"
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${opts.token}`).toString("base64")}`
  }
  try {
    const { stdout } = await execFileAsync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: opts.cwd,
      env,
      maxBuffer: 64 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string; message?: string }
    throw new Error(e.stderr?.trim() || e.stdout?.trim() || e.message || "git failed")
  }
}

function bareRepoDir(repo: string) {
  return path.join(REPOS_DIR, `${repo.replace("/", "__")}.git`)
}

function remoteUrl(repo: string) {
  return `https://github.com/${repo}.git`
}

function identityArgs(who: Identity) {
  return ["-c", `user.name=${who.login}`, "-c", `user.email=${who.userId}+${who.login}@users.noreply.github.com`, "-c", "commit.gpgsign=false"]
}

// ---------------------------------------------------------------------------------------------
// Session records
// ---------------------------------------------------------------------------------------------

export async function saveSession(session: FixSession) {
  await mkdir(SESSIONS_DIR, { recursive: true, mode: 0o700 })
  await writeFile(sessionFile(session.id), JSON.stringify(session), { mode: 0o600 })
}

export async function loadSession(id: string): Promise<FixSession | null> {
  try {
    const session = JSON.parse(await readFile(sessionFile(id), "utf8")) as FixSession
    session.queue ??= []
    return session
  } catch {
    return null
  }
}

async function listSessionIds(): Promise<string[]> {
  try {
    return (await readdir(SESSIONS_DIR)).map((f) => f.replace(/\.json$/, "")).filter((id) => SESSION_ID_RE.test(id))
  } catch {
    return []
  }
}

export async function findSession(repo: string, number: number): Promise<FixSession | null> {
  for (const id of await listSessionIds()) {
    const session = await loadSession(id)
    if (session && session.repo === repo && session.number === number) return session
  }
  return null
}

/** Removes the worktree (and its git metadata) and the session record, including any queued commits. Never throws. */
export async function cleanupSession(id: string) {
  const dir = worktreePath(id)
  const session = await loadSession(id)
  const bare = session ? bareRepoDir(session.headRepo) : null
  if (bare) await git(["worktree", "remove", "--force", dir], { cwd: bare }).catch(() => {})
  await rm(dir, { recursive: true, force: true }).catch(() => {})
  if (bare) await git(["worktree", "prune"], { cwd: bare }).catch(() => {})
  await rm(sessionFile(id), { force: true }).catch(() => {})
}

/** Removes abandoned sessions. Sessions holding unpushed commits or a merge in progress are never auto-removed. */
export async function cleanupStaleSessions() {
  for (const id of await listSessionIds()) {
    const session = await loadSession(id)
    if (!session) {
      await cleanupSession(id)
      continue
    }
    const holdsWork = session.queue.length > 0 || session.mergeRemoteSha
    if (!holdsWork && Date.now() - Date.parse(session.createdAt) > STALE_MS) await cleanupSession(id)
  }
}

// ---------------------------------------------------------------------------------------------
// Worktree lifecycle
// ---------------------------------------------------------------------------------------------

/** Fetches the PR branch into a cached bare repo and checks it out in a fresh detached worktree. */
export async function createWorktree(opts: {
  headRepo: string
  headRef: string
  token: string
}): Promise<{ id: string; worktree: string; baseSha: string }> {
  if (!REPO_RE.test(opts.headRepo)) throw new Error("Invalid head repository")
  await git(["check-ref-format", `refs/heads/${opts.headRef}`])
  const id = randomUUID()
  const bare = bareRepoDir(opts.headRepo)
  await mkdir(REPOS_DIR, { recursive: true, mode: 0o700 })
  await mkdir(WORKTREES_DIR, { recursive: true, mode: 0o700 })
  if (!(await lstat(bare).catch(() => null))) await git(["init", "--bare", bare])
  const localRef = `refs/reviewflow/${id}`
  await git(
    ["fetch", "--no-tags", "--depth=1", "--force", remoteUrl(opts.headRepo), `+refs/heads/${opts.headRef}:${localRef}`],
    { cwd: bare, token: opts.token }
  )
  const baseSha = (await git(["rev-parse", localRef], { cwd: bare })).trim()
  const worktree = worktreePath(id)
  try {
    await git(["worktree", "add", "--detach", worktree, baseSha], { cwd: bare })
  } finally {
    await git(["update-ref", "-d", localRef], { cwd: bare }).catch(() => {})
  }
  return { id, worktree, baseSha }
}

/**
 * The agent's file tools follow symlinks. Remove tracked symlinks that point outside the worktree
 * and mark them skip-worktree so the removal is never staged or committed. Idempotent.
 */
export async function neutralizeEscapingSymlinks(id: string) {
  const dir = await realpath(worktreePath(id))
  const entries = (await git(["ls-files", "-s", "-z"], { cwd: dir })).split("\0").filter(Boolean)
  for (const entry of entries) {
    const [meta, file] = entry.split("\t")
    if (!meta.startsWith("120000")) continue
    const link = path.join(dir, file)
    const target = path.resolve(path.dirname(link), await readlink(link).catch(() => "/"))
    if (target === dir || target.startsWith(dir + path.sep)) continue
    await git(["update-index", "--skip-worktree", "--", file], { cwd: dir })
    await rm(link, { force: true })
  }
}

async function isMerging(dir: string) {
  return git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd: dir }).then(
    () => true,
    () => false
  )
}

export async function listConflicts(id: string): Promise<string[]> {
  const out = await git(["diff", "--name-only", "--diff-filter=U", "-z"], { cwd: worktreePath(id) })
  return out.split("\0").filter(Boolean)
}

export async function sessionStatus(session: FixSession): Promise<SessionStatus> {
  const dir = worktreePath(session.id)
  const merging = await isMerging(dir)
  return {
    id: session.id,
    headRef: session.headRef,
    queue: session.queue.map(({ sha, message }) => ({ sha, message })),
    dirty: (await git(["status", "--porcelain"], { cwd: dir })).trim().length > 0,
    merging,
    conflicts: merging ? await listConflicts(session.id) : [],
  }
}

export async function assertNotMerging(id: string) {
  if (await isMerging(worktreePath(id)))
    throw new Error("A merge with the remote branch is in progress. Resolve it or abort it first.")
}

/** Drops uncommitted changes (an unapproved agent run). Queued commits are kept. */
export async function resetPending(id: string) {
  const dir = worktreePath(id)
  await git(["reset", "--hard", "HEAD"], { cwd: dir })
  await git(["clean", "-fd"], { cwd: dir })
}

export async function stageAndDiff(id: string) {
  const dir = worktreePath(id)
  await git(["add", "-A"], { cwd: dir })
  const files = (await git(["diff", "--cached", "--name-only"], { cwd: dir })).split("\n").filter(Boolean)
  const full = await git(["diff", "--cached", "--no-color", "--no-ext-diff"], { cwd: dir })
  return {
    files,
    diff: full.slice(0, MAX_DIFF_CHARS),
    truncated: full.length > MAX_DIFF_CHARS,
  }
}

// ---------------------------------------------------------------------------------------------
// Commit / push
// ---------------------------------------------------------------------------------------------

/** Commits whatever is staged/changed. Returns the new sha, or null when there was nothing to commit. */
export async function commitStaged(session: FixSession, message: string, who: Identity): Promise<string | null> {
  const dir = worktreePath(session.id)
  await git(["add", "-A"], { cwd: dir })
  if (!(await git(["diff", "--cached", "--name-only"], { cwd: dir })).trim()) return null
  await git([...identityArgs(who), "commit", "--no-verify", "-m", message], { cwd: dir })
  return (await git(["rev-parse", "HEAD"], { cwd: dir })).trim()
}

/** Plain push (no force): a branch that moved since the last sync is rejected as non-fast-forward. */
export async function pushHead(session: FixSession, token: string): Promise<string> {
  const dir = worktreePath(session.id)
  const sha = (await git(["rev-parse", "HEAD"], { cwd: dir })).trim()
  if (sha === session.baseSha) throw new Error("Nothing to push")
  try {
    await git(["push", remoteUrl(session.headRepo), `HEAD:refs/heads/${session.headRef}`], { cwd: dir, token })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push failed"
    throw new Error(/non-fast-forward|fetch first|rejected/i.test(message) ? `${message}\n\nThe remote branch has new commits. Use "Sync with remote" first.` : message)
  }
  return sha
}

// ---------------------------------------------------------------------------------------------
// Sync with remote (git fetch + git pull) and merge-conflict handling
// ---------------------------------------------------------------------------------------------

export type SyncResult = {
  status: "up-to-date" | "fast-forwarded" | "merged" | "conflict"
  remoteSha: string
  conflicts: string[]
}

export async function syncWithRemote(session: FixSession, token: string, who: Identity): Promise<SyncResult> {
  const dir = worktreePath(session.id)
  await assertNotMerging(session.id)
  if ((await git(["status", "--porcelain"], { cwd: dir })).trim())
    throw new Error("There are uncommitted agent changes. Approve or discard them before syncing.")

  const ref = `refs/reviewflow/sync-${session.id}`
  let remoteSha = ""
  try {
    // The cache is shallow, so deepen until the remote tip and our work share a merge base.
    let found = false
    for (const depth of SYNC_DEPTHS) {
      await git(
        ["fetch", "--no-tags", `--depth=${depth}`, "--force", remoteUrl(session.headRepo), `+refs/heads/${session.headRef}:${ref}`],
        { cwd: dir, token }
      )
      remoteSha = (await git(["rev-parse", ref], { cwd: dir })).trim()
      if (remoteSha === session.baseSha) break
      if (await git(["merge-base", "HEAD", remoteSha], { cwd: dir }).then(() => true, () => false)) {
        found = true
        break
      }
    }
    if (!remoteSha) throw new Error("Could not fetch the remote branch")
    const isAncestor = (a: string, b: string) => git(["merge-base", "--is-ancestor", a, b], { cwd: dir }).then(() => true, () => false)
    if (remoteSha === session.baseSha || (await isAncestor(remoteSha, "HEAD"))) {
      session.baseSha = remoteSha
      await saveSession(session)
      return { status: "up-to-date", remoteSha, conflicts: [] }
    }
    if (!found && !(await isAncestor("HEAD", remoteSha)))
      throw new Error("Could not find common history with the remote branch (it diverged too far).")

    if (await isAncestor("HEAD", remoteSha)) {
      await git(["merge", "--ff-only", remoteSha], { cwd: dir })
      session.baseSha = remoteSha
      await saveSession(session)
      await neutralizeEscapingSymlinks(session.id)
      return { status: "fast-forwarded", remoteSha, conflicts: [] }
    }

    session.mergeRemoteSha = remoteSha
    await saveSession(session)
    try {
      await git(
        [...identityArgs(who), "merge", "--no-edit", "-m", `Merge remote changes from ${session.headRef}`, remoteSha],
        { cwd: dir }
      )
    } catch (error) {
      const conflicts = await listConflicts(session.id)
      if (conflicts.length === 0) {
        await git(["merge", "--abort"], { cwd: dir }).catch(() => {})
        delete session.mergeRemoteSha
        await saveSession(session)
        throw error
      }
      await neutralizeEscapingSymlinks(session.id)
      return { status: "conflict", remoteSha, conflicts }
    }
    session.baseSha = remoteSha
    delete session.mergeRemoteSha
    await saveSession(session)
    await neutralizeEscapingSymlinks(session.id)
    return { status: "merged", remoteSha, conflicts: [] }
  } finally {
    await git(["update-ref", "-d", ref], { cwd: dir }).catch(() => {})
  }
}

export async function abortMerge(session: FixSession) {
  await git(["merge", "--abort"], { cwd: worktreePath(session.id) })
  delete session.mergeRemoteSha
  await saveSession(session)
}

async function conflictFilePath(id: string, file: string) {
  if (!(await listConflicts(id)).includes(file)) throw new Error("File is not in conflict")
  const full = path.join(worktreePath(id), file)
  const stat = await lstat(full).catch(() => null)
  if (stat?.isSymbolicLink()) throw new Error("Refusing to edit a symlink")
  return full
}

export async function readConflictFile(id: string, file: string): Promise<{ content: string; binary: boolean; missing: boolean }> {
  const full = await conflictFilePath(id, file)
  const buffer = await readFile(full).catch(() => null)
  if (!buffer) return { content: "", binary: false, missing: true }
  const binary = buffer.includes(0)
  return { content: binary ? "" : buffer.toString("utf8"), binary, missing: false }
}

/** ours = my local fixes, theirs = the remote branch. Returns the files still in conflict. */
export async function resolveConflictFile(
  id: string,
  file: string,
  mode: "ours" | "theirs" | "manual",
  content?: string
): Promise<string[]> {
  const dir = worktreePath(id)
  const full = await conflictFilePath(id, file)
  if (mode === "manual") {
    if (typeof content !== "string") throw new Error("Missing content")
    if (CONFLICT_MARKER_RE.test(content)) throw new Error("The file still contains conflict markers (<<<<<<< or >>>>>>>)")
    await writeFile(full, content, "utf8")
    await git(["add", "--", file], { cwd: dir })
  } else {
    try {
      await git(["checkout", `--${mode}`, "--", file], { cwd: dir })
      await git(["add", "--", file], { cwd: dir })
    } catch {
      // That side deleted the file: resolving to it means deleting.
      await git(["rm", "-f", "--", file], { cwd: dir })
    }
  }
  return listConflicts(id)
}

/** Conflicted files that still contain conflict markers (e.g. an agent resolution that missed one). */
export async function filesWithMarkers(id: string): Promise<string[]> {
  const dir = worktreePath(id)
  const out: string[] = []
  for (const file of await listConflicts(id)) {
    const buffer = await readFile(path.join(dir, file)).catch(() => null)
    if (buffer && CONFLICT_MARKER_RE.test(buffer.toString("utf8"))) out.push(file)
  }
  return out
}

/** Combined diff of unresolved/resolved-but-unstaged conflict files, for review. */
export async function conflictDiff(id: string) {
  const full = await git(["diff", "--no-color", "--no-ext-diff"], { cwd: worktreePath(id) })
  return { diff: full.slice(0, MAX_DIFF_CHARS), truncated: full.length > MAX_DIFF_CHARS }
}

/** Stages files the agent resolved (no markers left) and creates the merge commit. */
export async function completeMerge(session: FixSession, who: Identity): Promise<string> {
  const dir = worktreePath(session.id)
  if (!(await isMerging(dir))) throw new Error("No merge in progress")
  for (const file of await listConflicts(session.id)) {
    const buffer = await readFile(path.join(dir, file)).catch(() => null)
    if (buffer && CONFLICT_MARKER_RE.test(buffer.toString("utf8")))
      throw new Error(`${file} still contains conflict markers`)
    if (buffer) await git(["add", "--", file], { cwd: dir })
    else await git(["rm", "-f", "--", file], { cwd: dir })
  }
  if ((await listConflicts(session.id)).length) throw new Error("Some files are still in conflict")
  await git([...identityArgs(who), "commit", "--no-verify", "--no-edit"], { cwd: dir })
  if (session.mergeRemoteSha) session.baseSha = session.mergeRemoteSha
  delete session.mergeRemoteSha
  await saveSession(session)
  await neutralizeEscapingSymlinks(session.id)
  return (await git(["rev-parse", "HEAD"], { cwd: dir })).trim()
}
