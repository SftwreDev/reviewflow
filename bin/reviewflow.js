#!/usr/bin/env node
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, "..")
const projectRoot = process.cwd()
const nextBin = path.join(appRoot, "node_modules", "next", "dist", "bin", "next")
const args = process.argv.slice(2)
const portIndex = args.indexOf("--port")
const port = portIndex !== -1 ? args[portIndex + 1] : "3000"

const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
  cwd: appRoot,
  stdio: "inherit",
  env: { ...process.env, REVIEWFLOW_PROJECT_ROOT: projectRoot },
})
child.on("exit", (code) => process.exit(code ?? 0))
