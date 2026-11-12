// Project-local installs link the CLI into <project>/node_modules/.bin, which is not on PATH, so
// `reviewflow` would not resolve. Put one static launcher on PATH instead: it walks up from the
// current directory and runs the copy installed in that project, so no global install is needed and
// two projects on different versions never fight over the shim.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const SHIM = `#!/bin/sh
# reviewflow launcher: runs the copy installed in the current project.
dir=$(pwd -P)
while [ "$dir" != "/" ]; do
  if [ -f "$dir/node_modules/reviewflow/bin/reviewflow.js" ]; then
    exec node "$dir/node_modules/reviewflow/bin/reviewflow.js" "$@"
  fi
  dir=$(dirname "$dir")
done
echo "reviewflow: not installed in this project." >&2
echo "Install it with: npm install https://github.com/SftwreDev/reviewflow.git" >&2
exit 1
`

if (process.env.npm_config_global === "true" || process.env.REVIEWFLOW_NO_SHIM === "1") process.exit(0)

const home = os.homedir()
const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
const preferred = path.join(home, ".local", "bin")
const target = dirs.includes(preferred) ? preferred : dirs.find((dir) => dir.startsWith(home + path.sep) && !dir.includes(`${path.sep}node_modules${path.sep}`))

if (!target) {
  console.log(`ReviewFlow: no writable bin directory on PATH. Run it with node_modules/.bin/reviewflow.`)
  process.exit(0)
}

const file = path.join(target, "reviewflow")
try {
  mkdirSync(target, { recursive: true })
  if (existsSync(file) && readFileSync(file, "utf8") === SHIM) process.exit(0)
  writeFileSync(file, SHIM)
  chmodSync(file, 0o755)
  console.log(`ReviewFlow: added launcher ${file}`)
} catch (error) {
  console.log(`ReviewFlow: could not write ${file} (${error.message}). Run node_modules/.bin/reviewflow instead.`)
}
