import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

const ROOT = path.join(process.env.HOME || ".", ".reviewflow")
const ADDRESSED_DIR = path.join(ROOT, "addressed-feedback")
const REPO_RE = /^[\w.-]+\/[\w.-]+$/

const recordSchema = z.object({
  kind: z.enum(["inline", "issue", "review"]),
  id: z.number().int(),
  author: z.string(),
  /** Comment body at the time it was addressed. Used to detect later edits. */
  body: z.string(),
  location: z.string().optional(),
  status: z.enum(["fixed", "partial", "declined"]),
  reply: z.string(),
  sha: z.string(),
  addressedAt: z.string(),
})
const fileSchema = z.object({
  repo: z.string(),
  number: z.number().int(),
  records: z.array(recordSchema),
})

export type AddressedFeedbackKind = z.infer<typeof recordSchema>["kind"]
export type AddressedFeedbackStatus = z.infer<typeof recordSchema>["status"]
export type AddressedFeedback = z.infer<typeof recordSchema>

function fileFor(repo: string, number: number) {
  if (!REPO_RE.test(repo) || !Number.isInteger(number) || number < 1)
    throw new Error("Invalid repository or pull request")
  return path.join(ADDRESSED_DIR, `${repo.replace("/", "__")}-${number}.json`)
}

export async function listAddressedFeedback(repo: string, number: number): Promise<AddressedFeedback[]> {
  try {
    const parsed = fileSchema.parse(JSON.parse(await readFile(fileFor(repo, number), "utf8")))
    return parsed.records.sort((a, b) => b.addressedAt.localeCompare(a.addressedAt))
  } catch {
    return []
  }
}

/** Upserts records by `kind:id`, so re-addressing a comment replaces its previous record. */
export async function recordAddressedFeedback(
  repo: string,
  number: number,
  records: AddressedFeedback[]
): Promise<void> {
  if (records.length === 0) return
  const existing = await listAddressedFeedback(repo, number)
  const merged = new Map(existing.map((record) => [`${record.kind}:${record.id}`, record]))
  for (const record of records) merged.set(`${record.kind}:${record.id}`, record)
  await mkdir(ADDRESSED_DIR, { recursive: true, mode: 0o700 })
  const payload: z.infer<typeof fileSchema> = {
    repo,
    number,
    records: [...merged.values()].sort((a, b) => b.addressedAt.localeCompare(a.addressedAt)),
  }
  await writeFile(fileFor(repo, number), JSON.stringify(payload, null, 2), { mode: 0o600 })
}
