import { createDecipheriv } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
const directory = path.join(process.env.HOME || ".", ".reviewflow")
export async function readCredential(name: "github-token" | "claude-key"): Promise<string | null> {
  try {
    const [data, key] = await Promise.all([readFile(path.join(directory, name)), readFile(path.join(directory, "credential-key"))])
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12))
    decipher.setAuthTag(data.subarray(12, 28))
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()
  } catch { return null }
}
