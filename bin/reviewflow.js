#!/usr/bin/env node
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, "..")
const projectRoot = process.cwd()
const nextBin = path.join(appRoot, "node_modules", "next", "dist", "bin", "next")
const args = process.argv.slice(2)
const portIndex = args.indexOf("--port")
const port = portIndex !== -1 ? args[portIndex + 1] : "3000"
const env = { ...process.env, REVIEWFLOW_PROJECT_ROOT: projectRoot }

function run(nextArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...nextArgs], {
      cwd: appRoot,
      stdio: "inherit",
      env,
    })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`next exited ${code}`))))
  })
}

if (!existsSync(path.join(appRoot, ".next", "BUILD_ID"))) {
  console.log("ReviewFlow: first run, building app...")
  await run(["build"])
}
await run(["start", "-p", port])
