#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
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

function installedVersion(from, name) {
  try {
    return JSON.parse(readFileSync(from.resolve(`${name}/package.json`), "utf8")).version
  } catch {
    return null
  }
}

// A local install inherits the host's React whenever the majors differ, but the app's JSX and the
// host's Next.js end up on two separate React copies (invalid hook calls, duplicate type errors).
// Refuse up front, before a multi-minute build, instead of surfacing a Turbopack module error.
if (inNodeModules) {
  const ownReact = installedVersion(require, "react")
  const hostReact = installedVersion(createRequire(path.join(projectRoot, "package.json")), "react")
  const ownMajor = ownReact?.split(".")[0]
  const hostMajor = hostReact?.split(".")[0]
  if (ownMajor && hostMajor && ownMajor !== hostMajor) {
    console.error(
      `ReviewFlow runs on React ${ownMajor}, but ${projectRoot} resolves React ${hostReact}.\n` +
        `Next.js cannot build this app against two React majors, so a project-local install only works\n` +
        `when the host is already on React ${ownMajor}. Pick one:\n\n` +
        `  install ReviewFlow globally, keeping its own React tree:\n` +
        `    npm install -g --no-audit --no-fund https://github.com/SftwreDev/reviewflow.git\n` +
        `    reviewflow --port ${port}\n\n` +
        `  or upgrade this project to React ${ownMajor}:\n` +
        `    npm install react@${ownMajor} react-dom@${ownMajor} @types/react@${ownMajor} @types/react-dom@${ownMajor}\n`,
    )
    process.exit(1)
  }
}

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

function isLink(target) {
  try {
    return lstatSync(target).isSymbolicLink()
  } catch {
    return false
  }
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
  // npm nests the dependencies whose versions clash with the host under this package's own
  // node_modules. The staged copy sits beside the host's node_modules instead of under this package,
  // so those nested copies would be invisible to it: symlink ours in front of the host's tree, and
  // plain lookup still falls through to whatever npm hoisted.
  const ownModules = path.join(appRoot, "node_modules")
  const bridge = path.join(buildRoot, "node_modules")
  if (inNodeModules && existsSync(ownModules)) {
    if (existsSync(bridge) || isLink(bridge)) {
      if (isLink(bridge)) unlinkSync(bridge)
      else rmSync(bridge, { recursive: true, force: true })
    }
    symlinkSync(ownModules, bridge, "dir")
  }
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
