"use client"

import React, { useState } from "react"
import {
  MessageSquare,
  FileCode2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
} from "lucide-react"
import { PRHeader, type PullRequestData, type CheckRun } from "./pr-header"
import { PROverview, type ReviewData, type IssueCommentData } from "./pr-overview"
import { PRFilesView, type ChangedFile } from "./pr-files-view"
import { RunReview } from "@/components/reviews/run-review"
import { AddressFeedback } from "@/components/reviews/address-feedback"
import { useApp } from "@/lib/app-context"
import type { InlineComment } from "./diff-viewer"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface PRDetailClientProps {
  pr: PullRequestData
  repo: string
  files: ChangedFile[]
  reviews: ReviewData[]
  comments: IssueCommentData[]
  reviewComments: InlineComment[]
  checks: CheckRun[]
  onBack?: () => void
}

export function PRDetailClient({
  pr,
  repo,
  files = [],
  reviews = [],
  comments = [],
  reviewComments = [],
  checks = [],
  onBack,
}: PRDetailClientProps) {
  const { user, openPr, refreshActivePr, isLoadingPr } = useApp()
  const [activeTab, setActiveTab] = useState<"overview" | "files" | "ai" | "fix" | "checks">("overview")
  const canFix = Boolean(user) && pr.user.login === user && pr.state === "open" && !pr.merged_at

  const successfulChecks = checks.filter((c) => c.conclusion === "success").length
  const failedChecks = checks.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out"
  ).length

  const handleJumpToFile = (filePath: string) => {
    setActiveTab("files")
    setTimeout(() => {
      const el = document.getElementById(`file-${filePath}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  const totalDiscussions = reviews.filter((r) => r.body && r.body.trim().length > 0).length +
    comments.length +
    reviewComments.length

  return (
    <div className="space-y-6 max-w-full min-w-0 overflow-x-hidden">
      {/* 1. PR Header */}
      <PRHeader
        pr={pr}
        repo={repo}
        checks={checks}
        onRefresh={() => void refreshActivePr()}
        refreshing={isLoadingPr}
        onRunAgentReviewClick={() => setActiveTab("ai")}
        onBack={onBack}
      />

      {/* 2. Navigation Tabs */}
      <div className="border-b border-border/70 pb-px">
        <nav className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-xs transition-all",
              activeTab === "overview"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="size-4" />
            <span>Overview & Discussion</span>
            {totalDiscussions > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {totalDiscussions}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-xs transition-all",
              activeTab === "files"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCode2 className="size-4" />
            <span>Files Changed</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
              {files.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-xs transition-all",
              activeTab === "ai"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="size-4 text-primary" />
            <span>AI Code Review</span>
          </button>

          {canFix && (
            <button
              type="button"
              onClick={() => setActiveTab("fix")}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-xs transition-all",
                activeTab === "fix"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Wrench className="size-4 text-primary" />
              <span>Address Feedback</span>
            </button>
          )}
          {checks.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("checks")}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-xs transition-all",
                activeTab === "checks"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldCheck className="size-4" />
              <span>CI Checks</span>
              <Badge
                variant={failedChecks > 0 ? "destructive" : "secondary"}
                className="px-1.5 py-0 text-[10px] h-4"
              >
                {failedChecks > 0 ? `${failedChecks} failed` : `${successfulChecks}/${checks.length}`}
              </Badge>
            </button>
          )}
        </nav>
      </div>

      {/* 3. Tab Content */}
      <div className="pt-1">
        {activeTab === "overview" && (
          <PROverview
            pr={pr}
            reviews={reviews}
            comments={comments}
            reviewComments={reviewComments}
            checks={checks}
            onViewFilesClick={() => setActiveTab("files")}
          />
        )}

        {activeTab === "files" && (
          <PRFilesView
            files={files}
            comments={reviewComments}
            prHtmlUrl={pr.html_url}
          />
        )}

        {activeTab === "ai" && (
          <RunReview
            repo={repo}
            number={pr.number}
            headSha={pr.head.sha}
            onJumpToFile={handleJumpToFile}
          />
        )}

        {activeTab === "fix" && canFix && (
          <AddressFeedback
            repo={repo}
            pr={pr}
            reviews={reviews}
            comments={comments}
            reviewComments={reviewComments}
            onReload={() => openPr(pr.number)}
          />
        )}
        {activeTab === "checks" && (
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
            <div className="bg-muted/40 p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Continuous Integration Checks</h3>
                <p className="text-xs text-muted-foreground">
                  Commit <code className="font-mono">{pr.head.sha.slice(0, 7)}</code>
                </p>
              </div>
              <Badge
                variant={failedChecks > 0 ? "destructive" : "secondary"}
                className="text-xs font-semibold"
              >
                {failedChecks > 0
                  ? `${failedChecks} Failed`
                  : `${successfulChecks}/${checks.length} Passed`}
              </Badge>
            </div>
            <div className="divide-y divide-border/40">
              {checks.map((check, idx) => (
                <div
                  key={`${check.name}-${idx}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {check.conclusion === "success" ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : check.conclusion === "failure" || check.conclusion === "timed_out" ? (
                      <AlertCircle className="size-4 text-rose-500 shrink-0" />
                    ) : (
                      <Clock className="size-4 text-amber-500 animate-spin shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate">{check.name}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground capitalize">
                      {check.conclusion || check.status}
                    </span>
                    {check.html_url && (
                      <a
                        href={check.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        Details
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
