import type { CanUseTool, AccountInfo } from "@anthropic-ai/claude-agent-sdk"

export type LLMProviderName = "claude" | "openai" | "openrouter"

export type LLMCapabilities = {
  models: { value: string; displayName: string; description: string }[]
  skills: { name: string; description: string }[]
  auth: {
    configured: boolean
    device: boolean
    source: "api-key" | "device" | "none"
  }
  account?: AccountInfo
  error?: string
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  totalTokens: number
  totalCostUsd: number
}

export type LLMQueryOptions = {
  prompt: string
  model: string
  worktree: string
  apiKey: string | null
  abort: AbortController
  maxTurns: number
  tools?: string[]
  canUseTool?: CanUseTool
  outputFormat?: { type: "json_schema"; schema: unknown }
  cwd?: string
  skills?: string[]
  includePartialMessages?: boolean
  env?: Record<string, string | undefined>
}

export type AgentOptions = Omit<LLMQueryOptions, "prompt">

export type LLMEvent =
  | { type: "assistant"; message: { content: Array<{ type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown }> } }
  | { type: "result"; subtype: "success"; result: string; structured_output?: unknown; usage?: TokenUsage }
  | { type: "error"; error: string }

export interface LLMProvider {
  name: LLMProviderName
  getCapabilities(force?: boolean): Promise<LLMCapabilities>
  execute(options: LLMQueryOptions): AsyncGenerator<LLMEvent, void, unknown>
}

export const PROVIDER_NAMES: LLMProviderName[] = ["claude", "openai", "openrouter"]
