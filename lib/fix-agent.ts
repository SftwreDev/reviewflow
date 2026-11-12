import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk"
import type { AgentOptions } from "@/lib/llm"
import { realpath } from "node:fs/promises"
import path from "node:path"

export const AGENT_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"]

/** Restricts the agent's file tools to the session worktree (and never `.git`). */
export function worktreeGuard(worktree: string): CanUseTool {
  return async (toolName, input) => {
    if (!AGENT_TOOLS.includes(toolName)) return { behavior: "deny", message: `${toolName} is not available` }
    const raw = input.file_path ?? input.path
    if (raw === undefined) return { behavior: "allow" }
    if (typeof raw !== "string") return { behavior: "deny", message: "Invalid path" }
    const root = await realpath(worktree)
    const resolved = path.resolve(root, raw)
    // Resolve symlinks on the deepest existing ancestor so new files can still be created.
    let existing = resolved
    let tail = ""
    for (;;) {
      try {
        existing = await realpath(existing)
        break
      } catch {
        tail = path.join(path.basename(existing), tail)
        const parent = path.dirname(existing)
        if (parent === existing) break
        existing = parent
      }
    }
    const relative = path.relative(root, path.join(existing, tail))
    if (relative.startsWith("..") || path.isAbsolute(relative))
      return { behavior: "deny", message: "Path is outside the PR worktree" }
    if (relative === ".git" || relative.startsWith(`.git${path.sep}`))
      return { behavior: "deny", message: "Git metadata is off limits" }
    return { behavior: "allow" }
  }
}

export function describeToolUse(name: string, input: unknown) {
  const detail =
    input && typeof input === "object"
      ? Object.entries(input).find(([key]) => ["file_path", "path", "pattern"].includes(key))?.[1]
      : undefined
  return `${name}${typeof detail === "string" ? ` ${detail}` : ""}`
}

export function agentOptions(opts: {
  model: string
  worktree: string
  apiKey: string | null
  abort: AbortController
  maxTurns: number
}): AgentOptions {
  return {
    model: opts.model,
    worktree: opts.worktree,
    apiKey: opts.apiKey,
    abort: opts.abort,
    maxTurns: opts.maxTurns,
    tools: AGENT_TOOLS,
    canUseTool: worktreeGuard(opts.worktree),
  }
}
