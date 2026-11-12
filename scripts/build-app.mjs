// Builds a self-contained Next.js server (webpack: Turbopack mangles the serverExternalPackages
// specifier into a non-existent hashed name, so the SDK fails to load at runtime) into .next/standalone, so the installed package never needs
// the host project's dependency tree: React and Next ship prebuilt here. Runs from `prepare`, which
// npm executes inside its clone for git installs, so every consumer gets the same build.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
if (process.env.REVIEWFLOW_SKIP_BUILD === "1") process.exit(0)

const nextBin = path.join(appRoot, "node_modules", "next", "dist", "bin", "next")
if (!existsSync(nextBin)) {
  console.error("ReviewFlow: dependencies are missing, run npm install first.")
  process.exit(1)
}

execFileSync(process.execPath, [nextBin, "build", "--webpack"], { cwd: appRoot, stdio: "inherit" })

const standalone = path.join(appRoot, ".next", "standalone")
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("ReviewFlow: next build produced no standalone server.")
  process.exit(1)
}

// next build leaves public/ and the static chunks out of the standalone bundle.
rmSync(path.join(standalone, "public"), { recursive: true, force: true })
cpSync(path.join(appRoot, "public"), path.join(standalone, "public"), { recursive: true })
rmSync(path.join(standalone, ".next", "static"), { recursive: true, force: true })
cpSync(path.join(appRoot, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true })

// npm skips dot-directories in the files list, so ship the bundle under dist/.
const dist = path.join(appRoot, "dist")
rmSync(dist, { recursive: true, force: true })
cpSync(standalone, dist, { recursive: true })
