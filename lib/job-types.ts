export type JobKind = "review" | "fix"

export type JobStatus = "running" | "done" | "error"

export type JobEvent =
  | { type: "log"; message: string }
  | { type: "result"; result: unknown }
  | { type: "error"; error: string }

/** Wire shape for both `/api/jobs` snapshots and `/api/jobs/stream` replay resumes. */
export type JobSnapshot = {
  id: string
  kind: JobKind
  repo: string
  number: number
  status: JobStatus
  createdAt: string
  updatedAt: string
  logs: string[]
  result?: unknown
  error?: string
  eventCount: number
}
