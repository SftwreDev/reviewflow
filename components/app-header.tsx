"use client"

import React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationsPanel } from "@/components/notifications-panel"
import { useApp } from "@/lib/app-context"
import { FolderGit2, ChevronRight, GitPullRequest } from "lucide-react"

export function AppHeader() {
  const { repo, repos, selectRepo, user, activePrId, closePr } = useApp()

  return (
    <header className="flex h-14 w-full max-w-full shrink-0 items-center justify-between border-b border-border/70 px-4 lg:px-6 bg-background/95 backdrop-blur-xs sticky top-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />

        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={closePr}
            className="flex items-center gap-1.5 font-semibold tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <FolderGit2 className="size-4 text-primary" />
            <span>ReviewFlow</span>
          </button>

          {repo && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              <select
                aria-label="Select active repository"
                value={repo}
                onChange={(e) => void selectRepo(e.target.value)}
                className="h-7 max-w-[180px] sm:max-w-[240px] truncate rounded-md border border-border/60 bg-muted/40 px-2 text-xs font-mono font-medium text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {repos.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
                {!repos.some((r) => r.full_name === repo) && repo && (
                  <option value={repo}>{repo}</option>
                )}
              </select>
            </>
          )}

          {activePrId && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0 hidden sm:inline" />
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary hidden sm:inline-flex">
                <GitPullRequest className="size-3" />
                <span>#{activePrId}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationsPanel />
        {user && (
          <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 text-xs py-1">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{user}</span>
          </Badge>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
