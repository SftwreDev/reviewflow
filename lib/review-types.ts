export type Finding = {
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info" | string
  filePath: string
  lineNumber: number | null
  problem: string
  evidence: string
  impact: string
  solution: string
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  totalTokens: number
  totalCostUsd: number
}

export type ReviewPost = {
  url: string
  at: string
  findingIndexes: number[]
}

export type Review = {
  id: string
  repo: string
  number: number
  headSha: string
  model: string
  skills: string[]
  customPrompt: string
  findings: Finding[]
  tokenUsage?: TokenUsage
  posted?: ReviewPost
  createdAt: string
}

/** Stable feedback id for a finding in an in-house agent review. */
export function agentFeedbackId(reviewId: string, index: number) {
  return `${reviewId}:${index}`
}

export function parseAgentFeedbackId(id: string): { reviewId: string; index: number } | null {
  const separator = id.lastIndexOf(":")
  if (separator < 1) return null
  const index = Number(id.slice(separator + 1))
  if (!Number.isInteger(index) || index < 0) return null
  return { reviewId: id.slice(0, separator), index }
}

/** Body used both for display and to detect whether a finding changed after it was addressed. */
export function agentFindingBody(finding: Finding) {
  return `${finding.title}\n\n${finding.problem}`
}
