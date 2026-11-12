# ReviewFlow

Agent-powered code review app. Install directly from a git repository.

## Install from git

Inside the project you want to review:

```bash
npm install https://github.com/SftwreDev/reviewflow.git
reviewflow --port 3001
```

The install adds a `reviewflow` launcher to the first writable directory on your `PATH` under your
home (preferring `~/.local/bin`). The launcher walks up from the current directory and runs the copy
installed in that project, so a plain local install is enough and two projects on different versions
never collide. Nothing is installed globally. Uninstall the dependency and the launcher just reports
that the project has no ReviewFlow.

Set `REVIEWFLOW_NO_SHIM=1` to skip the launcher, then call `npx reviewflow` or
`node_modules/.bin/reviewflow`.

Global install (adds to your npm global bin instead):

```bash
npm install -g https://github.com/SftwreDev/reviewflow.git
reviewflow --port 3001
```

A local install builds against the host project's dependency tree, so the host must be on the same
React major ReviewFlow ships (React 19 — also the Next.js 16 baseline). On React 17/18 npm nests
ReviewFlow's React under `node_modules/reviewflow/node_modules`, two React copies end up in one
build, and the CLI stops before building with the upgrade command printed. Global installs are
unaffected: they keep their own tree.

The app builds on first run and rebuilds when its source changes. Because Next.js will not compile
TypeScript inside `node_modules`, a local install builds from a copy in `.reviewflow-app/` next to your
`node_modules` (git-ignored). The app reads `.claude/skills` from the directory where you run the command.

The install is large on purpose: `@anthropic-ai/claude-agent-sdk` ships a bundled Claude Code CLI
(~340 MB) and Next.js adds ~200 MB, so a fresh tree is ~1.1 GB / ~540 packages. Add
`--no-audit --no-fund` to skip the audit round-trip.

## Agent Review options

- **Skills**: pick skills from `.claude/skills` to use during the review.
- **Optional prompt**: add extra instructions for the review agent.

## Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
