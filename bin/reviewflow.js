#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, "..")
const projectRoot = process.cwd()
const require = createRequire(import.meta.url)
// npm hoists dependencies into the host project's node_modules on a local install, so don't assume
// next lives under this package's own node_modules.
const nextBin = require.resolve("next/dist/bin/next")
const nodeModulesDir = path.dirname(path.dirname(require.resolve("next/package.json")))
const args = process.argv.slice(2)
const portIndex = args.indexOf("--port")
const port = portIndex !== -1 ? args[portIndex + 1] : "3000"
const env = { ...process.env, REVIEWFLOW_PROJECT_ROOT: projectRoot }

// Next.js treats everything under node_modules as an already-compiled dependency and refuses to
// compile TypeScript/TSX there. When installed from git the app sits in node_modules, so build from
// a staged copy right next to it: Node's normal lookup then finds the installed dependencies and
// Next's workspace-root detection covers both, with no symlinks.
const inNodeModules = appRoot.split(path.sep).includes("node_modules")
const buildRoot = inNodeModules ? path.join(path.dirname(nodeModulesDir), ".reviewflow-app") : appRoot

// Content fingerprint of everything that affects the build. npm normalises file
// mtimes in packed tarballs, so hash contents rather than stat info.
const SOURCE_ENTRIES = [
  "app",
  "components",
  "hooks",
  "lib",
  "public",
  "package.json",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
]
const STAGED_ENTRIES = [...SOURCE_ENTRIES, "components.json", "next-env.d.ts"]

function collect(entry, hash) {
  const full = path.join(appRoot, entry)
  if (!existsSync(full)) return
  let names
  try {
    names = readdirSync(full).sort()
  } catch {
    hash.update(entry).update(readFileSync(full)) // plain file
    return
  }
  for (const name of names) collect(path.join(entry, name), hash)
}

function sourceFingerprint() {
  const hash = createHash("sha1")
  for (const entry of SOURCE_ENTRIES) collect(entry, hash)
  return hash.digest("hex")
}

function stageSources() {
  mkdirSync(buildRoot, { recursive: true })
  // Keep the staged build (and anything it generates) out of the host project's git status.
  writeFileSync(path.join(buildRoot, ".gitignore"), "*\n")
  for (const entry of STAGED_ENTRIES) {
    rmSync(path.join(buildRoot, entry), { recursive: true, force: true })
    if (existsSync(path.join(appRoot, entry))) cpSync(path.join(appRoot, entry), path.join(buildRoot, entry), { recursive: true })
  }
}

const stampPath = path.join(buildRoot, ".next", "reviewflow-source.sha1")

function run(nextArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...nextArgs], {
      cwd: buildRoot,
      stdio: "inherit",
      env,
    })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`next exited ${code}`))))
  })
}

const fingerprint = sourceFingerprint()
const built = existsSync(path.join(buildRoot, ".next", "BUILD_ID"))
const stale = !built || !existsSync(stampPath) || readFileSync(stampPath, "utf8") !== fingerprint
if (stale) {
  console.log(built ? "ReviewFlow: source changed, rebuilding app..." : "ReviewFlow: first run, building app...")
  if (inNodeModules) stageSources()
  await run(["build"])
  writeFileSync(stampPath, fingerprint)
}
await run(["start", "-p", port])
