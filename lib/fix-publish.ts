import { ghRest } from "@/lib/github-rest"
import { cleanupSession, pushHead, type FixSession } from "@/lib/fix-sessions"

export type PublishResult = { sha: string; posted: number; failed: string[] }

/**
 * Pushes the workspace once, removes it, then posts the queued replies. A rejected push throws and
 * leaves the workspace (and its queue) intact so the user can sync and retry.
 */
export async function publishQueue(session: FixSession, token: string): Promise<PublishResult> {
  const sha = await pushHead(session, token)
  const queue = session.queue
  // The branch is pushed: the worktree is no longer needed regardless of how replies go.
  await cleanupSession(session.id)

  const failed: string[] = []
  let posted = 0
  const general: { author: string; body: string }[] = []
  for (const commit of queue) {
    const suffix = `\n\n_Addressed in ${commit.sha.slice(0, 7)}._`
    for (const reply of commit.replies) {
      const text = reply.status === "declined" ? reply.body : reply.body + suffix
      if (reply.kind === "inline") {
        try {
          await ghRest(token, `/repos/${session.repo}/pulls/${session.number}/comments/${reply.id}/replies`, {
            method: "POST",
            body: { body: text },
          })
          posted++
        } catch (error) {
          failed.push(`inline #${reply.id}: ${error instanceof Error ? error.message : "failed"}`)
        }
      } else {
        const author = session.targets.find((t) => t.kind === reply.kind && t.id === reply.id)?.author ?? "reviewer"
        general.push({ author, body: text })
      }
    }
  }
  if (general.length) {
    const text = general.map((r) => `**Re @${r.author}:** ${r.body}`).join("\n\n")
    try {
      await ghRest(token, `/repos/${session.repo}/issues/${session.number}/comments`, { method: "POST", body: { body: text } })
      posted += general.length
    } catch (error) {
      failed.push(`general comment: ${error instanceof Error ? error.message : "failed"}`)
    }
  }
  return { sha, posted, failed }
}
