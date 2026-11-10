"use client"

import React, { useState } from "react"
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Bot,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MarkdownView } from "@/components/markdown-view"
import { Button } from "@/components/ui/button"
import type { PullRequestData, CheckRun } from "./pr-header"
import type { InlineComment } from "./diff-viewer"

export interface ReviewData {
  id: number
  user: {
    login: string
    avatar_url?: string
    type?: string
  }
  state: string
  submitted_at: string | null
  body: string
  html_url?: string
}

export interface IssueCommentData {
  id: number
  user: {
    login: string
    avatar_url?: string
  }
  created_at: string
  body: string
  html_url?: string
}

interface PROverviewProps {
  pr: PullRequestData
  reviews?: ReviewData[]
  comments?: IssueCommentData[]
  reviewComments?: InlineComment[]
  checks?: CheckRun[]
  onViewFilesClick?: () => void
}

export function PROverview({
  pr,
  reviews = [],
  comments = [],
  reviewComments = [],
  checks = [],
  onViewFilesClick,
}: PROverviewProps) {
  const [showAllChecks, setShowAllChecks] = useState(false)
  const [showInlineComments, setShowInlineComments] = useState(true)

  // Non-empty reviews
  const reviewsWithContent = reviews.filter((r) => r.body && r.body.trim().length > 0)
  const reviewsWithoutContent = reviews.filter((r) => !r.body || !r.body.trim().length)

  const successfulChecks = checks.filter((c) => c.conclusion === "success")
  const failedChecks = checks.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out"
  )

  const getReviewStateBadge = (state: string) => {
    switch (state.toUpperCase()) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="size-3" />
            <span>Approved</span>
          </Badge>
        )
      case "CHANGES_REQUESTED":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 text-[11px] font-semibold">
            <AlertCircle className="size-3" />
            <span>Changes Requested</span>
          </Badge>
        )
      case "COMMENTED":
        return (
          <Badge variant="outline" className="gap-1 text-[11px] font-semibold text-muted-foreground">
            <MessageSquare className="size-3" />
            <span>Commented</span>
          </Badge>
        )
      case "DISMISSED":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px]">
            <span>Dismissed</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {state}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. PR Description Card */}
      <Card className="overflow-hidden border-border/70 shadow-xs">
        <CardHeader className="bg-muted/30 border-b border-border/50 py-3.5 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar size="sm" className="size-7 border border-border">
                <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                <AvatarFallback>{pr.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{pr.user.login}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  Author
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {pr.created_at
                    ? `commented on ${new Date(pr.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "opened this pull request"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onViewFilesClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewFilesClick}
                  className="h-7 text-xs text-primary hover:text-primary gap-1"
                >
                  <FileCode className="size-3.5" />
                  <span>Files ({pr.changed_files})</span>
                </Button>
              )}
              <span className="text-xs font-mono text-muted-foreground">Description</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {pr.body && pr.body.trim() ? (
            <MarkdownView content={pr.body} className="leading-relaxed" />
          ) : (
            <p className="text-sm italic text-muted-foreground">No description provided.</p>
          )}
        </CardContent>
      </Card>

      {/* 2. Checks Status Card (if checks exist) */}
      {checks.length > 0 && (
        <Card className="border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Continuous Integration Checks</CardTitle>
                <Badge
                  variant={failedChecks.length > 0 ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {failedChecks.length > 0
                    ? `${failedChecks.length} Failed`
                    : `${successfulChecks.length}/${checks.length} Passed`}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllChecks(!showAllChecks)}
                className="h-7 text-xs text-muted-foreground gap-1"
              >
                {showAllChecks ? (
                  <>
                    <span>Hide details</span>
                    <ChevronDown className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Show details ({checks.length})</span>
                    <ChevronRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showAllChecks && (
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {checks.map((check, idx) => (
                  <div
                    key={`${check.name}-${idx}`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/30 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
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
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <span>Log</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 3. Conversation & Reviews Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Reviews & Discussion ({reviewsWithContent.length + comments.length + reviewComments.length})
            </h3>
          </div>

          {reviewComments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInlineComments(!showInlineComments)}
              className="h-7 text-xs"
            >
              {showInlineComments ? "Hide code comments" : `Show code comments (${reviewComments.length})`}
            </Button>
          )}
        </div>

        {/* State summaries for reviews without text (like simple Approvals) */}
        {reviewsWithoutContent.length > 0 && (
          <div className="flex flex-wrap gap-2 py-1">
            {reviewsWithoutContent.map((r) => (
              <div
                key={r.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-foreground"
              >
                <Avatar size="sm" className="size-4">
                  <AvatarImage src={r.user.avatar_url} alt={r.user.login} />
                  <AvatarFallback>{r.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{r.user.login}</span>
                {getReviewStateBadge(r.state)}
                {r.submitted_at && (
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(r.submitted_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Full reviews timeline */}
        <div className="space-y-4">
          {reviewsWithContent.map((review) => (
            <Card key={review.id} className="overflow-hidden border-border/70 shadow-xs">
              <CardHeader className="bg-muted/30 border-b border-border/50 py-3 px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm" className="size-7 border border-border">
                      <AvatarImage src={review.user.avatar_url} alt={review.user.login} />
                      <AvatarFallback>
                        {review.user.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {review.user.login}
                      </span>
                      {review.user.type === "Bot" && (
                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-4">
                          <Bot className="size-2.5" />
                          <span>Bot</span>
                        </Badge>
                      )}
                      {getReviewStateBadge(review.state)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {review.submitted_at && (
                      <span>
                        submitted on{" "}
                        {new Date(review.submitted_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {review.html_url && (
                      <a
                        href={review.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground inline-flex items-center gap-1"
                        title="View on GitHub"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <MarkdownView content={review.body} className="leading-relaxed" />
              </CardContent>
            </Card>
          ))}

          {/* General Issue comments */}
          {comments.map((comment) => (
            <Card key={comment.id} className="overflow-hidden border-border/70 shadow-xs">
              <CardHeader className="bg-muted/30 border-b border-border/50 py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm" className="size-7 border border-border">
                      <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
                      <AvatarFallback>
                        {comment.user.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-sm text-foreground">
                      {comment.user.login}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      commented on{" "}
                      {new Date(comment.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {comment.html_url && (
                    <a
                      href={comment.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <MarkdownView content={comment.body} />
              </CardContent>
            </Card>
          ))}

          {/* Inline review comments list (if toggled) */}
          {showInlineComments && reviewComments.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FileCode className="size-3.5" />
                <span>Inline Code Review Comments ({reviewComments.length})</span>
              </div>

              {reviewComments.map((comment) => (
                <Card
                  key={comment.id}
                  className="overflow-hidden border-border/70 bg-card shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <CardHeader className="py-2.5 px-4 bg-muted/40 border-b border-border/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" className="size-5">
                          <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
                          <AvatarFallback>
                            {comment.user.login.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground">{comment.user.login}</span>
                        <span>on</span>
                        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border/50">
                          {comment.path}
                          {comment.line ? `:${comment.line}` : ""}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        {comment.created_at && (
                          <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                        )}
                        {comment.html_url && (
                          <a
                            href={comment.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <MarkdownView content={comment.body} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty discussion state */}
          {reviewsWithContent.length === 0 &&
            comments.length === 0 &&
            reviewComments.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 p-8 text-center">
                <MessageSquare className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">No review comments yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Once reviewers submit feedback or you run an AI Review, comments will appear here.
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
