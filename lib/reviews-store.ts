import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { Review } from "@/lib/review-types"

const directory = path.join(process.env.HOME || ".", ".reviewflow", "reviews")

async function ensureDirectory() {
  await mkdir(directory, { recursive: true, mode: 0o700 })
}

export async function saveReview(review: Omit<Review, "id" | "createdAt">): Promise<Review> {
  await ensureDirectory()
  const record: Review = { ...review, id: randomUUID(), createdAt: new Date().toISOString() }
  await writeFile(path.join(directory, `${record.id}.json`), JSON.stringify(record, null, 2), {
    mode: 0o600,
  })
  return record
}

export async function listReviews(repo: string, number: number): Promise<Review[]> {
  await ensureDirectory()
  const files = await readdir(directory)
  const reviews: Review[] = []
  for (const file of files) {
    if (!file.endsWith(".json")) continue
    try {
      const review = JSON.parse(await readFile(path.join(directory, file), "utf8")) as Review
      if (review.repo === repo && review.number === number) reviews.push(review)
    } catch {
      // Ignore malformed records.
    }
  }
  return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listRepoReviews(repo: string): Promise<Review[]> {
  await ensureDirectory()
  const files = await readdir(directory)
  const reviews: Review[] = []
  for (const file of files) {
    if (!file.endsWith(".json")) continue
    try {
      const review = JSON.parse(await readFile(path.join(directory, file), "utf8")) as Review
      if (review.repo === repo) reviews.push(review)
    } catch {
      // Ignore malformed records.
    }
  }
  return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getReview(id: string): Promise<Review | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  try {
    return JSON.parse(await readFile(path.join(directory, `${id}.json`), "utf8")) as Review
  } catch {
    return null
  }
}

export async function markReviewPosted(review: Review, indexes: number[], url: string): Promise<Review> {
  const findingIndexes = [...new Set([...(review.posted?.findingIndexes ?? []), ...indexes])].sort(
    (a, b) => a - b
  )
  const record: Review = {
    ...review,
    posted: {
      url: url || review.posted?.url || "",
      at: new Date().toISOString(),
      findingIndexes,
    },
  }
  await writeFile(path.join(directory, `${record.id}.json`), JSON.stringify(record, null, 2), {
    mode: 0o600,
  })
  return record
}
