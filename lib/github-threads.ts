import { ghGraphql } from "@/lib/github-rest"

export type ReviewThread = {
  id: string
  isResolved: boolean
  commentIds: number[]
}

const THREADS_QUERY = `query ReviewThreads($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 100) { nodes { databaseId } }
        }
      }
    }
  }
}`

const RESOLVE_THREAD_MUTATION = `mutation ResolveReviewThread($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}`

type ThreadsPage = {
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: {
          id: string
          isResolved: boolean
          comments: { nodes: { databaseId: number | null }[] }
        }[]
      }
    } | null
  } | null
}

function splitRepo(repo: string): [string, string] {
  const [owner, name] = repo.split("/")
  if (!owner || !name) throw new Error("Invalid repository")
  return [owner, name]
}

export async function listReviewThreads(token: string, repo: string, number: number): Promise<ReviewThread[]> {
  const [owner, name] = splitRepo(repo)
  const threads: ReviewThread[] = []
  let after: string | null = null
  while (true) {
    const data: ThreadsPage = await ghGraphql<ThreadsPage>(token, THREADS_QUERY, { owner, name, number, after })
    const connection = data.repository?.pullRequest?.reviewThreads
    if (!connection) return []
    for (const node of connection.nodes) {
      threads.push({
        id: node.id,
        isResolved: node.isResolved,
        commentIds: node.comments.nodes
          .map((comment) => comment.databaseId)
          .filter((id): id is number => typeof id === "number"),
      })
    }
    if (!connection.pageInfo.hasNextPage) break
    if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) break
    after = connection.pageInfo.endCursor
  }
  return threads
}

/** Resolves every unresolved review thread that contains one of `commentIds`. */
export async function resolveReviewThreadsForComments(
  token: string,
  repo: string,
  number: number,
  commentIds: number[]
): Promise<{ resolved: number; failed: string[] }> {
  const wanted = new Set(commentIds)
  if (wanted.size === 0) return { resolved: 0, failed: [] }

  let threads: ReviewThread[]
  try {
    threads = await listReviewThreads(token, repo, number)
  } catch (error) {
    return {
      resolved: 0,
      failed: [`resolve conversations: ${error instanceof Error ? error.message : "failed"}`],
    }
  }

  let resolved = 0
  const failed: string[] = []
  for (const thread of threads) {
    if (thread.isResolved) continue
    if (!thread.commentIds.some((id) => wanted.has(id))) continue
    try {
      await ghGraphql(token, RESOLVE_THREAD_MUTATION, { threadId: thread.id })
      resolved++
    } catch (error) {
      const ids = thread.commentIds.join(", ")
      failed.push(`resolve thread (${ids}): ${error instanceof Error ? error.message : "failed"}`)
    }
  }
  return { resolved, failed }
}
