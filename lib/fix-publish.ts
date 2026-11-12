import { ghRest } from "@/lib/github-rest"
import { resolveReviewThreadsForComments } from "@/lib/github-threads"
import { recordAddressedFeedback, type AddressedFeedback } from "@/lib/addressed-feedback"
import { addNotification } from "@/lib/notifications-store"
import { cleanupSession, normalizeFeedbackId, pushHead, type FixSession } from "@/lib/fix-sessions"

export type PublishResult = { sha: string; posted: number; resolved: number; failed: string[] }

/**
 * Pushes the workspace once, removes it, then posts the queued replies. A rejected push throws and
 * leaves the workspace (and its queue) intact so the user can sync and retry.
 */
export async function publishQueue(session: FixSession, token: string): Promise<PublishResult> {
  const sha = await pushHead(session, token)
  const queue = session.queue
  // The branch is pushed: the worktree is no longer needed regardless of how replies go.
  await cleanupSession(session.id)

  const addressedAt = new Date().toISOString()
  const addressed: AddressedFeedback[] = []
  for (const commit of queue) {
    for (const item of commit.addressed ?? []) {
      const id = normalizeFeedbackId(item.kind, item.id)
      const target = session.targets.find((t) => t.kind === item.kind && normalizeFeedbackId(t.kind, t.id) === id)
      // Sessions created before address tracking have no body fingerprint, so leave any existing record alone.
      if (!target || target.body === undefined) continue
      const reply = commit.replies.find((r) => r.kind === item.kind && normalizeFeedbackId(r.kind, r.id) === id)
      addressed.push({
        kind: item.kind,
        id,
        author: target.author,
        body: target.body,
        location: target.location,
        status: item.status,
        reply: reply?.body ?? "",
        sha: commit.sha,
        addressedAt,
      })
    }
  }
  // The push already succeeded; a local bookkeeping failure must not turn it into a push error.
  await recordAddressedFeedback(session.repo, session.number, addressed).catch(() => {})
  const fixed = addressed.filter((item) => item.status !== "declined").length
  await addNotification({
    key: `feedback_addressed:${session.repo}#${session.number}:${sha}`,
    repo: session.repo,
    number: session.number,
    kind: "feedback_addressed",
    title: "",
    detail:
      fixed > 0
        ? `Feedback addressed and pushed · ${fixed} item${fixed === 1 ? "" : "s"}`
        : "Feedback fixes pushed",
  }).catch(() => null)

  const failed: string[] = []
  let posted = 0
  const general: { author: string; body: string }[] = []
  for (const commit of queue) {
    const suffix = `\n\n_Addressed in ${commit.sha.slice(0, 7)}._`
    for (const reply of commit.replies) {
      const text = reply.status === "declined" ? reply.body : reply.body + suffix
      if (reply.kind === "agent") {
        // In-house review findings have no GitHub comment to reply to.
        continue
      }
      const replyId = normalizeFeedbackId(reply.kind, reply.id)
      if (reply.kind === "inline" && typeof replyId === "number") {
        try {
          await ghRest(token, `/repos/${session.repo}/pulls/${session.number}/comments/${replyId}/replies`, {
            method: "POST",
            body: { body: text },
          })
          posted++
        } catch (error) {
          failed.push(`inline #${replyId}: ${error instanceof Error ? error.message : "failed"}`)
        }
      } else {
        const author =
          session.targets.find(
            (t) => t.kind === reply.kind && normalizeFeedbackId(t.kind, t.id) === normalizeFeedbackId(reply.kind, reply.id)
          )?.author ?? "reviewer"
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

  // Mark GitHub review conversations resolved for every inline comment whose fix is now pushed.
  const inlineIds = [
    ...new Set(
      queue.flatMap((commit) =>
        (commit.addressed ?? [])
          .filter((item) => item.kind === "inline" && item.status !== "declined")
          .map((item) => normalizeFeedbackId("inline", item.id))
          .filter((id): id is number => typeof id === "number")
      )
    ),
  ]
  const resolution = await resolveReviewThreadsForComments(token, session.repo, session.number, inlineIds)
  return { sha, posted, resolved: resolution.resolved, failed: [...failed, ...resolution.failed] }
}
