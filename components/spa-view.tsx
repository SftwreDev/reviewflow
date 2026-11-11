"use client"

import React, { useState, useMemo } from "react"
import { useApp } from "@/lib/app-context"
import { PRDetailClient } from "@/components/pull-requests/pr-detail-client"
import { PRDetailSkeleton } from "@/components/pull-requests/pr-skeleton"
import { SkillsView } from "@/components/skills-view"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  RefreshCw,
  Bot,
  GitBranch,
  LoaderCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function SpaView() {
  const {
    repo,
    repos,
    user,
    pulls,
    repoLabels,
    reviewHistory,
    activeTab,
    activePrId,
    activePrData,
    isLoadingPulls,
    isLoadingPr,
    status,
    statusType,
    setActiveTab,
    openPr,
    closePr,
    selectRepo,
    refreshPulls,
    saveGithubToken,
    saveClaudeKey,
    saveClaudeModel,
    claudeModel,
    claudeCodeAuth,
    claudeModels,
    refreshClaudeCapabilities,
    disconnectGithub,
    removeClaudeKey,
    clearStatus,
  } = useApp()

  const [query, setQuery] = useState("")
  const [repoSearch, setRepoSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "merged" | "closed">("all")
  const [selectedLabel, setSelectedLabel] = useState("")
  const [githubTokenInput, setGithubTokenInput] = useState("")
  const [claudeKeyInput, setClaudeKeyInput] = useState("")

  // Filter pulls by query and state
  const visiblePulls = useMemo(() => {
    return pulls.filter((p) => {
      const matchesQuery =
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        String(p.number).includes(query) ||
        p.head.ref.toLowerCase().includes(query.toLowerCase())
      if (!matchesQuery) return false

      if (statusFilter === "open") return p.state === "open" && !p.merged_at
      if (statusFilter === "merged") return Boolean(p.merged_at)
      if (statusFilter === "closed") return p.state === "closed" && !p.merged_at
      return true
    }).filter((p) => {
      if (!selectedLabel) return true
      return p.labels?.some((l) => l.name === selectedLabel)
    })
  }, [pulls, query, statusFilter, selectedLabel])

  const openCount = useMemo(
    () => pulls.filter((p) => p.state === "open" && !p.merged_at).length,
    [pulls]
  )
  const mergedCount = useMemo(
    () => pulls.filter((p) => Boolean(p.merged_at)).length,
    [pulls]
  )
  const closedCount = useMemo(
    () => pulls.filter((p) => p.state === "closed" && !p.merged_at).length,
    [pulls]
  )

  // 1. If currently viewing a PR detail
  if (activePrId !== null) {
    if (isLoadingPr && !activePrData?.pr) {
      return <PRDetailSkeleton />
    }

    if (activePrData?.pr) {
      return (
        <div className="animate-in fade-in duration-150 max-w-full min-w-0">
          <PRDetailClient
            pr={activePrData.pr}
            repo={repo}
            files={activePrData.files || []}
            reviews={activePrData.reviews || []}
            comments={activePrData.comments || []}
            reviewComments={activePrData.reviewComments || []}
            checks={activePrData.checks || []}
            onBack={closePr}
          />
        </div>
      )
    }

    if (activePrData?.error) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-4 my-8 animate-in fade-in duration-150">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Could not display pull request #{activePrId}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {activePrData.error}
            </p>
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={closePr} className="gap-1.5 text-xs">
              <ArrowLeft className="size-3.5" />
              <span>Back to pull requests</span>
            </Button>
          </div>
        </div>
      )
    }

    return <PRDetailSkeleton />
  }

  // 2. Main List / Dashboard / Settings View
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* View Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <nav className="flex gap-2">
          {(
            [
              ["dashboard", "Dashboard"],
              ["pulls", "My Pull Requests"],
              ["skills", "Agent Skills"],
              ["settings", "Settings"],
            ] as const
          ).map(([tabKey, label]) => (
            <Button
              key={tabKey}
              variant={activeTab === tabKey ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tabKey)}
              className="text-xs font-medium cursor-pointer"
            >
              {label}
            </Button>
          ))}
        </nav>

        {activeTab !== "settings" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshPulls()}
              disabled={isLoadingPulls || !repo}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5", isLoadingPulls && "animate-spin")} />
              <span>Refresh</span>
            </Button>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      {status && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs transition-colors",
            statusType === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : statusType === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-border/70 bg-muted/40 text-muted-foreground"
          )}
        >
          {statusType === "error" ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : statusType === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : null}
          <span className="flex-1">{status}</span>
          <button
            type="button"
            onClick={clearStatus}
            className="text-xs opacity-70 hover:opacity-100 p-0.5 rounded cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Tab: Skills */}
      {activeTab === "skills" ? (
        <SkillsView />
      ) : activeTab === "settings" ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* GitHub Settings Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="size-4 text-primary" />
                  <span>GitHub Integration</span>
                </CardTitle>
                {user ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                    Connected: {user}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Not configured
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Personal access token with <code>repo</code> scope, encrypted locally with AES-256-GCM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubTokenInput}
                onChange={(e) => setGithubTokenInput(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await saveGithubToken(githubTokenInput, "save")
                    setGithubTokenInput("")
                  }}
                  disabled={!githubTokenInput.trim()}
                >
                  Save Token
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void saveGithubToken(githubTokenInput, "test")}
                  disabled={!githubTokenInput.trim()}
                >
                  Test Connection
                </Button>
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => void disconnectGithub()}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Claude Settings Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-4 text-primary" />
                <span>Claude API Configuration</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Anthropic API key used by the autonomous review agent. Leave blank to use the
                Claude Code login on this device.
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[11px]">
                  {claudeCodeAuth ? "Claude Code auth detected" : "No device login detected"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="sk-ant-api03-xxxxxxxx"
                value={claudeKeyInput}
                onChange={(e) => setClaudeKeyInput(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await saveClaudeKey(claudeKeyInput, "claude-save")
                    setClaudeKeyInput("")
                  }}
                  disabled={!claudeKeyInput.trim()}
                >
                  Save API Key
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void saveClaudeKey(claudeKeyInput, "claude-test")}
                >
                  Test API Key
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => void removeClaudeKey()}
                >
                  Remove Key
                </Button>
              </div>
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="claude-model" className="text-xs font-medium text-foreground">
                    Review model
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => void refreshClaudeCapabilities()}
                  >
                    <RefreshCw className="size-3" />
                    Refresh models
                  </Button>
                </div>
                <select
                  id="claude-model"
                  value={claudeModel}
                  onChange={(e) => void saveClaudeModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50"
                >
                  <option value="">Use default</option>
                  {claudeModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.displayName} ({m.value})
                    </option>
                  ))}
                </select>
                {claudeModels.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No models loaded. Save a key or log in with Claude Code, then refresh.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Repository Card */}
          <Card className="md:col-span-2 border-border/70 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Active Repository</CardTitle>
                  <CardDescription className="text-xs">
                    Select which repository ReviewFlow monitors and reviews.
                  </CardDescription>
                </div>
                {repo && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    Active: {repo}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {repos
                  .filter((r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                  .map((r) => {
                    const isCurrent = r.full_name === repo
                    return (
                      <button
                        key={r.full_name}
                        type="button"
                        onClick={() => void selectRepo(r.full_name)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors text-xs cursor-pointer",
                          isCurrent
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/60 hover:bg-muted/50"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-foreground">{r.full_name}</span>
                          <span className="block truncate text-muted-foreground mt-0.5">
                            {r.description || "No description"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {r.private ? "Private" : "Public"}
                          </Badge>
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[10px]">
                              Active
                            </Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                {repos.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {user
                      ? "No repositories found for this account."
                      : "Save your GitHub token above to view repositories."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Tab: Dashboard or Pull Requests */
        <>
          {/* Quick Stat Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Authored PRs</span>
                  <GitPullRequest className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {pulls.length}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-xs font-medium">Open</span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{openCount}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <span className="text-xs font-medium">Merged</span>
                  <GitMerge className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {mergedCount}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-xs font-medium">Closed</span>
                  <GitPullRequestClosed className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {closedCount}
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search PR title, number, or branch..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Label filter temporarily hidden. */}

            {/* Status Filter Buttons */}
            <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
              {(
                [
                  ["all", "All"],
                  ["open", `Open (${openCount})`],
                  ["merged", `Merged (${mergedCount})`],
                  ["closed", `Closed (${closedCount})`],
                ] as const
              ).map(([statusKey, label]) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setStatusFilter(statusKey)}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors cursor-pointer",
                    statusFilter === statusKey
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pull Requests List Card */}
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-3.5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Pull Requests ({visiblePulls.length})
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {repo ? `Repository: ${repo}` : "No repository active"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPulls && !pulls.length ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-xs">
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Loading pull requests...</span>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {visiblePulls.map((p) => {
                    const isMerged = Boolean(p.merged_at)
                    const isDraft = p.draft
                    const isOpen = p.state === "open" && !isMerged
                    const isAiReviewed = reviewHistory.some((r) => r.number === p.number) || p.labels?.some((l) => l.name === "ai-reviewed")

                    return (
                      <button
                        key={p.number}
                        type="button"
                        onClick={() => openPr(p.number)}
                        className="group flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {isMerged ? (
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1 text-[10px] font-semibold">
                                <GitMerge className="size-3" />
                                <span>Merged</span>
                              </Badge>
                            ) : isDraft ? (
                              <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30 text-[10px]">
                                Draft
                              </Badge>
                            ) : isOpen ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px] font-semibold">
                                <GitPullRequest className="size-3" />
                                <span>Open</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 text-[10px] font-semibold">
                                <GitPullRequestClosed className="size-3" />
                                <span>Closed</span>
                              </Badge>
                            )}

                            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                              #{p.number} {p.title}
                            </span>
                            {isAiReviewed && (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]">
                                AI Reviewed
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                              {p.head.ref} → {p.base.ref}
                            </span>
                            <span>•</span>
                            <span>by {p.user.login}</span>
                            <span>•</span>
                            <span>
                              Updated{" "}
                              {new Date(p.updated_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 font-medium">
                            <span>View Details</span>
                            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })}

                  {!visiblePulls.length && !isLoadingPulls && (
                    <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                      <GitPullRequest className="mx-auto size-8 opacity-40 mb-2" />
                      <p className="font-medium text-foreground text-sm">
                        {repo ? "No pull requests found" : "No repository selected"}
                      </p>
                      <p>
                        {repo
                          ? query
                            ? "No pull requests match your search criteria."
                            : "No authored pull requests found in this repository."
                          : "Configure your GitHub token and select a repository in Settings."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
