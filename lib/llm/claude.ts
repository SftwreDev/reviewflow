import { query } from "@anthropic-ai/claude-agent-sdk"
import { getClaudeCapabilities } from "@/lib/claude"
import type { LLMProvider, LLMCapabilities, LLMQueryOptions, LLMEvent, TokenUsage } from "@/lib/llm"

export class ClaudeProvider implements LLMProvider {
  name = "claude" as const

  async getCapabilities(force = false): Promise<LLMCapabilities> {
    const caps = await getClaudeCapabilities(force)
    return {
      models: caps.models,
      skills: caps.skills,
      auth: caps.auth,
      account: caps.account,
      error: caps.error,
    }
  }

  async *execute(options: LLMQueryOptions): AsyncGenerator<LLMEvent, void, unknown> {
    const q = query({
      prompt: options.prompt,
      options: {
        model: options.model,
        cwd: options.cwd ?? options.worktree,
        tools: options.tools ?? ["Read", "Edit", "Write", "Glob", "Grep"],
        canUseTool: options.canUseTool,
        permissionMode: "default",
        settingSources: [],
        maxTurns: options.maxTurns,
        abortController: options.abort,
        env: options.env ?? (options.apiKey ? { ...process.env, ANTHROPIC_API_KEY: options.apiKey } : { ...process.env }),
        outputFormat: options.outputFormat ? { type: "json_schema" as const, schema: options.outputFormat.schema as Record<string, unknown> } : undefined,
        skills: options.skills,
        includePartialMessages: options.includePartialMessages,
      },
    })

    try {
      for await (const message of q) {
        if (message.type === "assistant") {
          yield {
            type: "assistant",
            message: {
              content: message.message.content.map((block: unknown) => {
                if (typeof block !== "object" || block === null) return { type: "text" as const, text: "" }
                const b = block as { type: string; text?: string; name?: string; input?: unknown }
                if (b.type === "text") return { type: "text" as const, text: b.text ?? "" }
                if (b.type === "tool_use") return { type: "tool_use" as const, name: b.name ?? "", input: b.input }
                return { type: "text" as const, text: "" }
              }),
            },
          }
        } else if (message.type === "result" && message.subtype === "success") {
          const u = message.usage
          const usage: TokenUsage | undefined = u
            ? {
                inputTokens: u.input_tokens ?? 0,
                outputTokens: u.output_tokens ?? 0,
                cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
                cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
                totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
                totalCostUsd: message.total_cost_usd ?? 0,
              }
            : undefined
          yield { type: "result", subtype: "success", result: message.result, structured_output: message.structured_output, usage }
        } else if (message.type === "result") {
          yield { type: "error", error: `Agent stopped: ${message.subtype}` }
        }
      }
    } finally {
      q.close()
    }
  }
}
