"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  FileCode2,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export interface PullRequestData {
  number: number
  title: string
  body: string | null
  merged_at: string | null
  draft: boolean
  state: string
  created_at?: string
  updated_at?: string
  html_url: string
  user: {
    login: string
    avatar_url?: string
  }
  head: {
    sha: string
    ref: string
  }
  base: {
    ref: string
  }
  additions: number
  deletions: number
  changed_files: number
  commits?: number
}

export interface CheckRun {
  name: string
  status: string
  conclusion: string | null
  started_at?: string
  completed_at?: string
  html_url?: string
}

interface PRHeaderProps {
  pr: PullRequestData
  repo: string
  checks?: CheckRun[]
  onRefresh?: () => void
  refreshing?: boolean
  onRunAgentReviewClick?: () => void
  onBack?: () => void
}

export function PRHeader({
  pr,
  repo,
  checks = [],
  onRefresh,
  refreshing = false,
  onRunAgentReviewClick,
  onBack,
}: PRHeaderProps) {
  const [copiedSha, setCopiedSha] = useState(false)
  const [copiedBranch, setCopiedBranch] = useState(false)

  const isMerged = Boolean(pr.merged_at)
  const isDraft = pr.draft
  const isOpen = pr.state === "open" && !isMerged

  const successfulChecks = checks.filter((c) => c.conclusion === "success").length
  const failedChecks = checks.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out"
  ).length
  const inProgressChecks = checks.filter((c) => c.status === "in_progress" || c.status === "queued").length

  const copyBranch = async () => {
    try {
      await navigator.clipboard.writeText(pr.head.ref)
      setCopiedBranch(true)
      setTimeout(() => setCopiedBranch(false), 2000)
    } catch {
      // Ignore
    }
  }

  const copySha = async () => {
    try {
      await navigator.clipboard.writeText(pr.head.sha)
      setCopiedSha(true)
      setTimeout(() => setCopiedSha(false), 2000)
    } catch {
      // Ignore
    }
  }

  return (
    <header className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs max-w-full min-w-0">
        {/* Navigation & Actions Top Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Pull Requests</span>
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>Pull Requests</span>
              </Link>
            )}
            <span>/</span>
            <span className="font-medium text-foreground">{repo}</span>
            <span>/</span>
            <span className="font-semibold text-primary">#{pr.number}</span>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="h-8 gap-1.5 text-xs font-medium shadow-2xs"
              >
                <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </Button>
            )}

            {onRunAgentReviewClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRunAgentReviewClick}
                className="h-8 gap-1.5 text-xs font-medium shadow-2xs hover:border-primary/50"
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>AI Review</span>
              </Button>
            )}

            <a
              href={pr.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
            >
              <span>View on GitHub</span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </div>
        </div>

        {/* PR State Badge & Title */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {pr.title}
            </span>
            <span className="text-2xl sm:text-3xl font-light text-muted-foreground">
              #{pr.number}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            {/* Status Badge */}
            {isMerged ? (
              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1.5 py-1 px-2.5 text-xs font-semibold">
                <GitMerge className="size-3.5" />
                <span>Merged</span>
              </Badge>
            ) : isDraft ? (
              <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30 gap-1.5 py-1 px-2.5 text-xs font-semibold">
                <FileCode2 className="size-3.5" />
                <span>Draft</span>
              </Badge>
            ) : isOpen ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-2.5 text-xs font-semibold">
                <GitPullRequest className="size-3.5" />
                <span>Open</span>
              </Badge>
            ) : (
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1.5 py-1 px-2.5 text-xs font-semibold">
                <GitPullRequestClosed className="size-3.5" />
                <span>Closed</span>
              </Badge>
            )}

            {/* Author info */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Avatar size="sm" className="size-5">
                <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                <AvatarFallback>{pr.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{pr.user.login}</span>
              <span>wants to merge into</span>
              <span className="inline-flex items-center gap-1 rounded bg-muted/80 px-2 py-0.5 font-mono text-xs text-foreground font-semibold border border-border/50">
                {pr.base.ref}
              </span>
              <span>from</span>
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary font-semibold border border-primary/20">
                {pr.head.ref}
              </span>

              <button
                type="button"
                onClick={copyBranch}
                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={copiedBranch ? "Copied branch!" : "Copy branch name"}
                aria-label="Copy branch name"
              >
                {copiedBranch ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Head commit:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {pr.head.sha.slice(0, 7)}
            </code>
            <button
              type="button"
              onClick={copySha}
              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              title={copiedSha ? "Copied SHA" : "Copy full SHA"}
              aria-label="Copy commit SHA"
            >
              {copiedSha ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>

          <span className="text-border">|</span>

          {/* Diffs additions/deletions */}
          <div className="flex items-center gap-2 font-mono">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{pr.additions.toLocaleString()}
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              -{pr.deletions.toLocaleString()}
            </span>
            <span className="text-muted-foreground font-sans">
              across {pr.changed_files} {pr.changed_files === 1 ? "file" : "files"}
            </span>
          </div>

          {checks.length > 0 && (
            <>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                {failedChecks > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                    <XCircle className="size-3.5" />
                    <span>{failedChecks} checks failed</span>
                  </span>
                ) : inProgressChecks > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <Clock className="size-3.5 animate-spin" />
                    <span>{inProgressChecks} in progress</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    <span>{successfulChecks}/{checks.length} checks passed</span>
                  </span>
                )}
              </div>
            </>
          )}

          {pr.created_at && (
            <>
              <span className="text-border">|</span>
              <span>
                Opened{" "}
                {new Date(pr.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </header>
  )
}
