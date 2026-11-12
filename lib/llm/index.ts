import { readCredential } from "@/lib/credentials"
import { ClaudeProvider } from "./claude"
import { OpenAIProvider } from "./openai"
import type { LLMProvider, LLMProviderName } from "@/lib/llm"

export async function getProvider(): Promise<LLMProvider> {
  const providerName = ((await readCredential("llm-provider")) as LLMProviderName | null) ?? "claude"
  if (providerName === "openai" || providerName === "openrouter") {
    const specificKey = await readCredential(providerName === "openai" ? "openai-key" : "openrouter-key")
    const genericKey = await readCredential("llm-key")
    const apiKey = specificKey ?? genericKey
    if (!apiKey) throw new Error(`No API key configured for ${providerName}`)
    const baseURL = providerName === "openai" ? "https://api.openai.com/v1" : "https://openrouter.ai/api/v1"
    return new OpenAIProvider(providerName, baseURL, apiKey)
  }
  return new ClaudeProvider()
}

export async function getProviderName(): Promise<LLMProviderName> {
  return ((await readCredential("llm-provider")) as LLMProviderName | null) ?? "claude"
}

export async function getDefaultModel(): Promise<string | null> {
  const providerName = await getProviderName()
  const preferred = await readCredential(providerName === "claude" ? "claude-model" : "llm-model")
  return preferred ?? (await readCredential(providerName === "claude" ? "llm-model" : "claude-model"))
}
