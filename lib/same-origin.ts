import type { NextRequest } from "next/server"

/**
 * CSRF guard for state-changing routes: the browser's Origin must match the Host the request was sent
 * to. `request.url` is unusable here — a standalone Next server derives it from its bind address, so
 * an app opened at localhost looks cross-origin and every POST fails with "Invalid origin".
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
