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
  createdAt: string
}
