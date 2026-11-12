export async function ghRest<T>(token: string, endpoint: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data && typeof data.message === "string" ? data.message : "request failed"
    throw new Error(`GitHub ${response.status}: ${message}`)
  }
  return data as T
}

type GraphQlError = { message?: string }

export async function ghGraphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T
    errors?: GraphQlError[]
    message?: string
  }
  if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}: ${payload.message ?? "request failed"}`)
  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).filter(Boolean).join(", ") || "request failed"
    throw new Error(`GitHub GraphQL: ${message}`)
  }
  if (!payload.data) throw new Error("GitHub GraphQL: empty response")
  return payload.data
}
