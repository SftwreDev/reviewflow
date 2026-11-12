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
