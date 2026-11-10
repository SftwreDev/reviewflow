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

export type Review = {
  id: string
  repo: string
  number: number
  headSha: string
  model: string
  skills: string[]
  customPrompt: string
  findings: Finding[]
  createdAt: string
}
