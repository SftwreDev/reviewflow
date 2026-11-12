import { appendFile, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import type { TokenUsage } from "@/lib/review-types"

const directory = path.join(process.env.HOME || ".", ".reviewflow")
const file = path.join(directory, "fix-usage.jsonl")

export type FixUsageRecord = {
  repo: string
  number: number
  model: string
  usage?: TokenUsage
  createdAt: string
}

export async function recordFixUsage(record: Omit<FixUsageRecord, "createdAt">): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const entry: FixUsageRecord = { ...record, createdAt: new Date().toISOString() }
  await appendFile(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
}

export async function listFixUsage(repo: string): Promise<FixUsageRecord[]> {
  try {
    const text = await readFile(file, "utf8")
    return text
      .split("\n")
      .flatMap((line) => {
        if (!line.trim()) return []
        try {
          const record = JSON.parse(line) as FixUsageRecord
          return record.repo === repo ? [record] : []
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}
