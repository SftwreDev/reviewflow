#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const projectRoot = process.cwd()
const args = process.argv.slice(2)
const portIndex = args.indexOf("--port")
const port = portIndex !== -1 ? args[portIndex + 1] : "3000"
const env = { ...process.env, REVIEWFLOW_PROJECT_ROOT: projectRoot, PORT: port }
const server = path.join(appRoot, "dist", "server.js")
const installed = appRoot.split(path.sep).includes("node_modules")

function run(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, stdio: "inherit", env })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))))
  })
}

// Installs ship a prebuilt standalone server (dist/, produced by scripts/build-app.mjs during
// `prepare`), so starting one never builds, never reads the host project's dependency tree, and never
// cares which React or Next.js version the host uses.
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

// A source checkout has to build its own bundle; an install already contains one.
if (!installed) {
  const stamp = path.join(appRoot, "dist", "reviewflow-source.sha1")
  const fingerprint = sourceFingerprint()
  if (!existsSync(server) || !existsSync(stamp) || readFileSync(stamp, "utf8") !== fingerprint) {
    console.log(existsSync(server) ? "ReviewFlow: source changed, rebuilding app..." : "ReviewFlow: first run, building app...")
    await run(process.execPath, [path.join(appRoot, "scripts", "build-app.mjs")], appRoot)
    writeFileSync(stamp, fingerprint)
  }
}

if (!existsSync(server)) {
  console.error("ReviewFlow: prebuilt server missing; reinstall the package.")
  process.exit(1)
}

await run(process.execPath, [server], projectRoot).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
