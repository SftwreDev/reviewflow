# ReviewFlow

Agent-powered code review app. Install directly from a git repository.

## Install from git

```bash
npm install <your-git-repo-url>
# or globally
npm install -g <your-git-repo-url>
```

The app builds on first run. Run:

```bash
reviewflow --port 3000
```

First run compiles the app, then starts it on the given port. The app reads `.claude/skills` from the project root where you run the command.

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
