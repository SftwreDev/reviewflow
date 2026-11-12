"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins, MessageSquareWarning } from "lucide-react"

export function MetricsCards({
  totalTokenCost,
  totalTokens,
  feedbackTokenCost,
  feedbackTokens,
  feedbackRuns,
  unresolvedPrCount,
  totalReviews,
}: {
  totalTokenCost: number
  totalTokens: number
  feedbackTokenCost: number
  feedbackTokens: number
  feedbackRuns: number
  unresolvedPrCount: number
  totalReviews: number
}) {
  return (
    <div className="grid grid-cols-1 gap-3 px-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 text-xs">
            <Coins className="size-3.5 text-primary" />
            Agent Review Cost
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            ${totalTokenCost.toFixed(4)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] text-muted-foreground">
            {totalTokens.toLocaleString()} tokens across {totalReviews} review{totalReviews === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 text-xs">
            <Coins className="size-3.5 text-primary" />
            Address Feedback Cost
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            ${feedbackTokenCost.toFixed(4)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] text-muted-foreground">
            {feedbackTokens.toLocaleString()} tokens across {feedbackRuns} run{feedbackRuns === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 text-xs">
            <MessageSquareWarning className="size-3.5 text-amber-500" />
            PRs Needing Attention
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {unresolvedPrCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] text-muted-foreground">
            Open PRs with comments or change requests
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
