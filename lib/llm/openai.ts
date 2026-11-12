import { OpenAI } from "openai"
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions"
import { readFile, writeFile, readdir } from "node:fs/promises"
import { realpath } from "node:fs/promises"
import path from "node:path"
import type { LLMProvider, LLMCapabilities, LLMQueryOptions, LLMEvent } from "@/lib/llm"
import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk"

const MODEL_CACHE_TTL_MS = 60_000
const modelCache = new Map<string, { at: number; data: LLMCapabilities }>()

type ModelListEntry = {
  id?: unknown
  name?: unknown
  description?: unknown
  owned_by?: unknown
}

// OpenAI's /models endpoint also exposes models that cannot drive chat completions.
// Exclude those so every option in the picker is usable by the review agent.
function isChatCapable(id: string): boolean {
  return !/embedding|moderation|whisper|tts|transcrib|dall-e|image|audio|realtime|sora|diariz/i.test(id)
}

function parseModels(provider: "openai" | "openrouter", payload: unknown): LLMCapabilities["models"] {
  const data = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []

  return data
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return []
      const model = entry as ModelListEntry
      if (typeof model.id !== "string" || !model.id) return []
      if (provider === "openai" && !isChatCapable(model.id)) return []
      const description =
        typeof model.description === "string" && model.description.trim()
          ? model.description
          : typeof model.owned_by === "string" && model.owned_by
            ? `Owned by ${model.owned_by}`
            : ""
      return [
        {
          value: model.id,
          displayName: typeof model.name === "string" && model.name.trim() ? model.name : model.id,
          description,
        },
      ]
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

const TOOL_DEFS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "Read",
      description: "Read a file from the worktree",
      parameters: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "Write",
      description: "Write a file to the worktree",
      parameters: {
        type: "object",
        properties: { file_path: { type: "string" }, content: { type: "string" } },
        required: ["file_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Edit",
      description: "Replace a string in a file",
      parameters: {
        type: "object",
        properties: { file_path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } },
        required: ["file_path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Glob",
      description: "List files matching a directory",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "Grep",
      description: "Search file contents (unimplemented, use Read)",
      parameters: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] },
    },
  },
]

export class OpenAIProvider implements LLMProvider {
  name: "openai" | "openrouter"
  private baseURL: string
  private apiKey: string

  constructor(name: "openai" | "openrouter", baseURL: string, apiKey: string) {
    this.name = name
    this.baseURL = baseURL
    this.apiKey = apiKey
  }

  async getCapabilities(force = false): Promise<LLMCapabilities> {
    const cacheKey = `${this.name}:${this.apiKey}`
    const cached = modelCache.get(cacheKey)
    if (!force && cached && Date.now() - cached.at < MODEL_CACHE_TTL_MS) return cached.data

    const auth = { configured: true, device: false, source: "api-key" as const }
    try {
      const res = await fetch(`${this.baseURL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`${this.name} returned ${res.status}`)
      const data: LLMCapabilities = {
        models: parseModels(this.name, await res.json()),
        skills: [],
        auth,
      }
      modelCache.set(cacheKey, { at: Date.now(), data })
      return data
    } catch (error) {
      return {
        models: [],
        skills: [],
        auth,
        error: error instanceof Error ? error.message : `Failed to load ${this.name} models`,
      }
    }
  }

  async *execute(options: LLMQueryOptions): AsyncGenerator<LLMEvent, void, unknown> {
    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL })
    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: options.prompt }]
    let turns = 0

    while (turns < options.maxTurns) {
      turns++
      const res = await client.chat.completions.create(
        {
          model: options.model,
          messages,
          tools: TOOL_DEFS,
          tool_choice: "auto",
          response_format: options.outputFormat
            ? { type: "json_schema", json_schema: { name: "output", schema: options.outputFormat.schema as Record<string, unknown> } }
            : undefined,
        },
        { signal: options.abort.signal }
      )
      const msg = res.choices[0].message
      messages.push(msg as unknown as ChatCompletionMessageParam)

      const content: Extract<LLMEvent, { type: "assistant" }>["message"]["content"] = []
      if (msg.content) content.push({ type: "text", text: msg.content })
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          content.push({ type: "tool_use", name: tc.function.name, input: JSON.parse(tc.function.arguments) as unknown })
        }
      }
      if (content.length > 0) yield { type: "assistant", message: { content } }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const result = await this.executeTool(tc.function.name, JSON.parse(tc.function.arguments) as unknown, options.worktree, options.abort, options.canUseTool)
          messages.push({ role: "tool", tool_call_id: tc.id, content: result })
        }
      } else {
        const usage = res.usage
          ? {
              inputTokens: res.usage.prompt_tokens,
              outputTokens: res.usage.completion_tokens,
              cacheCreationInputTokens: 0,
              cacheReadInputTokens: res.usage.prompt_tokens_details?.cached_tokens ?? 0,
              totalTokens: res.usage.total_tokens,
              totalCostUsd: 0,
            }
          : undefined
        if (msg.content) {
          let structured_output: unknown
          try {
            structured_output = JSON.parse(msg.content)
          } catch {
            structured_output = undefined
          }
          yield { type: "result", subtype: "success", result: msg.content, structured_output, usage }
        }
        break
      }
    }
  }

  private async executeTool(name: string, args: unknown, worktree: string, abort: AbortController, canUseTool?: CanUseTool): Promise<string> {
    const input = args as Record<string, unknown>
    if (canUseTool) {
      const allowed = await canUseTool(name, input, { signal: abort.signal, toolUseID: "", requestId: "" })
      if (!allowed) return "Denied: Permission check failed"
      if (allowed.behavior === "deny") return `Denied: ${"message" in allowed ? allowed.message : "Denied"}`
    }
    const root = await realpath(worktree)
    switch (name) {
      case "Read": {
        const file = path.resolve(root, String(input.file_path))
        return await readFile(file, "utf8")
      }
      case "Write": {
        const file = path.resolve(root, String(input.file_path))
        await writeFile(file, String(input.content ?? ""))
        return "Wrote file"
      }
      case "Edit": {
        const file = path.resolve(root, String(input.file_path))
        const content = await readFile(file, "utf8")
        const newContent = content.replace(String(input.old_string), String(input.new_string ?? ""))
        await writeFile(file, newContent)
        return "Edited file"
      }
      case "Glob": {
        const dir = path.resolve(root, String(input.path ?? "."))
        const files = await readdir(dir)
        return files.join("\n")
      }
      default:
        return "Unknown tool"
    }
  }
}
