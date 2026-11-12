import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Ship a self-contained server so installs do not depend on the host project's React/deps.
  output: "standalone",
  // The Claude Agent SDK bundles a large native CLI per platform; keep it a normal npm dependency so
  // npm resolves the right binary instead of tracing one platform's copy into the bundle.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
}

export default nextConfig
