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
never collide. Nothing is installed globally. Set `REVIEWFLOW_NO_SHIM=1` to skip the launcher and use
`npx reviewflow` instead.

Global install (adds to your npm global bin instead):

```bash
npm install -g https://github.com/SftwreDev/reviewflow.git
reviewflow --port 3001
```

What ships is a prebuilt Next.js standalone server (`dist/`, built by `prepare` while npm clones the
repository). The only npm dependency is `@anthropic-ai/claude-agent-sdk`, so an install is ~435 MB and
takes about a minute; starting the server afterwards is instant and needs no build. The app does not
touch the host project's React or Next.js, so any project version works.

`prepare` builds the bundle with the repository's own dev dependencies. To skip it, set
`REVIEWFLOW_SKIP_BUILD=1`. In the repository itself, `node bin/reviewflow.js` rebuilds `dist/` from
source when a source file changed, then serves it.

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
