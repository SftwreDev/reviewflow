# ReviewFlow

Agent-powered code review app. Install directly from a git repository.

## Install from git

```bash
# into a project
npm install https://github.com/SftwreDev/reviewflow.git
npx reviewflow --port 3000

# or globally (puts `reviewflow` on your PATH)
npm install -g https://github.com/SftwreDev/reviewflow.git
reviewflow --port 3000
```

A project-local install does not add `reviewflow` to your PATH, so call it with `npx reviewflow`
(or add `"reviewflow": "reviewflow --port 3000"` to your `package.json` scripts).

The app builds on first run and rebuilds when its source changes. Because Next.js will not compile
TypeScript inside `node_modules`, a local install builds from a copy in `.reviewflow-app/` next to your
`node_modules` (git-ignored). The app reads `.claude/skills` from the directory where you run the command.

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
