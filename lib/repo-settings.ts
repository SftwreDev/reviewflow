import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.join(process.env.HOME || ".", ".reviewflow")
const FILE = path.join(ROOT, "base-branch")

/**
 * Branch name accepted by `git check-ref-format refs/heads/<name>` without needing a git process.
 * Rejects option-like names and every character git forbids.
 */
export function isValidBranchName(name: string): boolean {
  if (name.length === 0 || name.length > 200) return false
  if (!/^(?!-)(?!.*\.\.)(?!.*@\{)(?!.*\/\/)(?!.*[~^:?*\[\\\s])[A-Za-z0-9._/-]+$/.test(name)) return false
  return !name.endsWith("/") && !name.endsWith(".") && !name.endsWith(".lock")
}

export async function readBaseBranch(): Promise<string> {
  const name = (await readFile(FILE, "utf8").catch(() => "")).trim()
  return isValidBranchName(name) ? name : ""
}

export async function writeBaseBranch(name: string): Promise<void> {
  if (!isValidBranchName(name)) throw new Error("Invalid branch name")
  await mkdir(ROOT, { recursive: true, mode: 0o700 })
  await writeFile(FILE, name, { mode: 0o600 })
}
