import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import type {
  AppNotification,
  NotificationInput,
  NotificationKind,
} from "@/lib/notification-types"

const ROOT = path.join(process.env.HOME || ".", ".reviewflow")
const STORE_FILE = path.join(ROOT, "notifications.json")
const STATE_FILE = path.join(ROOT, "notification-state.json")
const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const MAX_NOTIFICATIONS = 300
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

const notificationSchema = z.object({
  id: z.string(),
  key: z.string(),
  repo: z.string(),
  number: z.number().int().positive(),
  kind: z.enum([
    "pr_opened",
    "pr_comments",
    "changes_requested",
    "review_completed",
    "feedback_addressed",
    "pr_stale",
  ]),
  title: z.string(),
  detail: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})
const storeSchema = z.object({ notifications: z.array(notificationSchema) })
type NotificationStore = z.infer<typeof storeSchema>

const pullSnapshotSchema = z.object({
  updatedAt: z.string(),
  comments: z.number().int().nonnegative(),
  reviewComments: z.number().int().nonnegative(),
  reviewDecision: z.string().nullable(),
  open: z.boolean(),
  headSha: z.string(),
  title: z.string(),
})
type PullSnapshot = z.infer<typeof pullSnapshotSchema>
const stateSchema = z.object({
  repos: z.record(
    z.string(),
    z.object({
      seeded: z.boolean(),
      pulls: z.record(z.string(), pullSnapshotSchema),
    })
  ),
})
type NotificationState = z.infer<typeof stateSchema>

export type NotificationPull = {
  number: number
  title: string
  state: string
  merged_at: string | null
  created_at: string
  updated_at: string
  head: { sha: string }
  user: { login: string }
  comments?: number
  review_comments?: number
  reviewDecision?: string | null
  reviewerActivity?: boolean
}

let chain: Promise<unknown> = Promise.resolve()

/** Serialize read-modify-write cycles so concurrent polls do not drop notifications. */
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = chain.then(work, work)
  chain = result.catch(() => undefined)
  return result
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return null
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(ROOT, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(data, null, 2), { mode: 0o600 })
  await rename(temporary, file)
}

async function readStore(): Promise<NotificationStore> {
  const parsed = storeSchema.safeParse(await readJson(STORE_FILE))
  return parsed.success ? parsed.data : { notifications: [] }
}

async function readState(): Promise<NotificationState> {
  const parsed = stateSchema.safeParse(await readJson(STATE_FILE))
  return parsed.success ? parsed.data : { repos: {} }
}

async function appendLocked(
  inputs: NotificationInput[]
): Promise<AppNotification[]> {
  if (inputs.length === 0) return []
  const store = await readStore()
  const known = new Set(
    store.notifications.map((notification) => notification.key)
  )
  const added: AppNotification[] = []
  const now = new Date().toISOString()
  for (const input of inputs) {
    if (known.has(input.key)) continue
    known.add(input.key)
    added.push({
      id: randomUUID(),
      key: input.key,
      repo: input.repo,
      number: input.number,
      kind: input.kind as NotificationKind,
      title: input.title ?? "",
      detail: input.detail,
      createdAt: now,
      readAt: null,
    })
  }
  if (added.length === 0) return []
  store.notifications = [...added, ...store.notifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_NOTIFICATIONS)
  await writeJson(STORE_FILE, store)
  return added
}

export async function addNotification(
  input: NotificationInput
): Promise<AppNotification | null> {
  const [notification] = await serialize(() => appendLocked([input]))
  return notification ?? null
}

export async function listNotifications(
  repo?: string
): Promise<AppNotification[]> {
  const store = await readStore()
  return store.notifications
    .filter((notification) => !repo || notification.repo === repo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function markNotificationsRead(options: {
  repo?: string
  ids?: string[]
}): Promise<number> {
  return serialize(async () => {
    const store = await readStore()
    const ids = options.ids ? new Set(options.ids) : null
    const now = new Date().toISOString()
    let changed = 0
    for (const notification of store.notifications) {
      if (notification.readAt) continue
      if (
        ids
          ? !ids.has(notification.id)
          : options.repo && notification.repo !== options.repo
      )
        continue
      notification.readAt = now
      changed++
    }
    if (changed > 0) await writeJson(STORE_FILE, store)
    return changed
  })
}

/**
 * Compares the fresh GitHub pull list with the previous snapshot and records real changes.
 * The first sync for a repo only seeds the snapshot, except for PRs already stale (they are
 * actionable now). Notification keys make every event idempotent across polls.
 */
export async function syncPullNotifications(
  repo: string,
  pulls: NotificationPull[],
  viewerLogin: string
): Promise<AppNotification[]> {
  if (!REPO_RE.test(repo)) return []
  return serialize(async () => {
    const state = await readState()
    const previousRepo = state.repos[repo]
    const previous = previousRepo?.pulls ?? {}
    const seeded = previousRepo?.seeded ?? false
    const now = Date.now()
    const next: Record<string, PullSnapshot> = {}
    const events: NotificationInput[] = []

    for (const pull of pulls) {
      const open = pull.state === "open" && !pull.merged_at
      const comments = pull.comments ?? 0
      const reviewComments = pull.review_comments ?? 0
      const reviewDecision = pull.reviewDecision ?? null
      const title = pull.title
      next[String(pull.number)] = {
        updatedAt: pull.updated_at,
        comments,
        reviewComments,
        reviewDecision,
        open,
        headSha: pull.head.sha,
        title,
      }

      const old = previous[String(pull.number)]
      if (seeded) {
        if (open && !old?.open) {
          events.push({
            key: `pr_opened:${repo}#${pull.number}:${pull.created_at}`,
            repo,
            number: pull.number,
            kind: "pr_opened",
            title,
            detail: "New pull request opened",
          })
        }
        if (old) {
          const newComments = Math.max(0, comments - old.comments)
          const newThreads = Math.max(0, reviewComments - old.reviewComments)
          if (newComments + newThreads > 0) {
            const parts: string[] = []
            if (newComments > 0)
              parts.push(
                `${newComments} new comment${newComments === 1 ? "" : "s"}`
              )
            if (newThreads > 0)
              parts.push(
                `${newThreads} new code comment${newThreads === 1 ? "" : "s"}`
              )
            events.push({
              key: `pr_comments:${repo}#${pull.number}:${pull.updated_at}`,
              repo,
              number: pull.number,
              kind: "pr_comments",
              title,
              detail: parts.join(" · "),
            })
          }
          if (
            reviewDecision === "CHANGES_REQUESTED" &&
            old.reviewDecision !== "CHANGES_REQUESTED"
          ) {
            events.push({
              key: `changes_requested:${repo}#${pull.number}:${pull.updated_at}`,
              repo,
              number: pull.number,
              kind: "changes_requested",
              title,
              detail: "A reviewer requested changes",
            })
          }
        }
      }

      const updatedAt = Date.parse(pull.updated_at)
      const hasOpenFeedback =
        reviewDecision === "CHANGES_REQUESTED" ||
        reviewComments > 0 ||
        (reviewDecision !== "APPROVED" && Boolean(pull.reviewerActivity))
      const authoredByViewer =
        Boolean(viewerLogin) && pull.user.login === viewerLogin
      if (
        open &&
        authoredByViewer &&
        hasOpenFeedback &&
        Number.isFinite(updatedAt) &&
        now - updatedAt > STALE_AFTER_MS
      ) {
        const days = Math.max(
          3,
          Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000))
        )
        events.push({
          key: `pr_stale:${repo}#${pull.number}:${pull.head.sha}:${pull.updated_at}`,
          repo,
          number: pull.number,
          kind: "pr_stale",
          title,
          detail: `No GitHub activity for ${days} days with open feedback`,
        })
      }
    }

    state.repos[repo] = { seeded: true, pulls: next }
    await writeJson(STATE_FILE, state)
    return appendLocked(events)
  })
}
