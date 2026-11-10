import { query, type AccountInfo, type Query } from "@anthropic-ai/claude-agent-sdk"
import { readCredential } from "@/lib/credentials"
import { access } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type ClaudeModel = {
  value: string
  displayName: string
  description: string
}

export type ClaudeSkill = {
  name: string
  description: string
  argumentHint?: string
}

export type ClaudeCapabilities = {
  models: ClaudeModel[]
  skills: ClaudeSkill[]
  auth: {
    configured: boolean
    device: boolean
    source: "api-key" | "device" | "none"
  }
  account?: AccountInfo
  error?: string
}

export async function hasClaudeCodeAuth(): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY) return true
  const home = process.env.HOME || "."
  const candidates = [
    path.join(home, ".claude.json"),
    path.join(home, ".claude", ".credentials.json"),
    path.join(home, ".config", "claude", "credentials.json"),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return true
    } catch {
      // keep checking
    }
  }
  if (process.platform === "darwin") {
    try {
      await execFileAsync("security", ["find-generic-password", "-s", "Claude Code-credentials"])
      return true
    } catch {
      // no keychain login
    }
  }
  return false
}

export async function readClaudeModel(): Promise<string | null> {
  return readCredential("claude-model")
}

let cache: { at: number; data: ClaudeCapabilities } | null = null

export async function getClaudeCapabilities(force = false): Promise<ClaudeCapabilities> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.data

  const apiKey = await readCredential("claude-key")
  const device = await hasClaudeCodeAuth()
  const auth = {
    configured: Boolean(apiKey),
    device,
    source: (apiKey ? "api-key" : device ? "device" : "none") as ClaudeCapabilities["auth"]["source"],
  }

  let q: Query | null = null
  try {
    q = query({
      prompt: "capabilities",
      options: {
        env: apiKey ? { ...process.env, ANTHROPIC_API_KEY: apiKey } : { ...process.env },
        tools: [],
        maxTurns: 1,
        cwd: process.env.REVIEWFLOW_PROJECT_ROOT || process.cwd(),
      },
    })
    const init = await q.initializationResult()
    const data: ClaudeCapabilities = {
      models: init.models.map((m) => ({
        value: m.value,
        displayName: m.displayName,
        description: m.description,
      })),
      skills: init.commands.map((c) => ({
        name: c.name,
        description: c.description,
        argumentHint: c.argumentHint,
      })),
      auth,
      account: init.account as AccountInfo,
    }
    cache = { at: Date.now(), data }
    return data
  } catch (error) {
    return {
      models: [],
      skills: [],
      auth,
      error: error instanceof Error ? error.message : "Failed to connect to Claude",
    }
  } finally {
    q?.close()
  }
}
