"use client"

import React, { useState } from "react"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Bot,
  User,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Pull } from "@/lib/app-context"

interface RightRailProps {
  pulls: Pull[]
  openPr: (number: number) => void
  onViewAll?: () => void
}

export function DashboardRightRail({ pulls, openPr, onViewAll }: RightRailProps) {
  const [activitiesOpen, setActivitiesOpen] = useState({
    today: true,
    yesterday: false,
    lastWeek: false,
  })

  const openCount = pulls.filter((p) => p.state === "open" && !p.merged_at).length
  const mergedCount = pulls.filter((p) => Boolean(p.merged_at)).length
  const attentionCount = pulls.filter(
    (p) =>
      p.state === "open" &&
      !p.merged_at &&
      (p.reviewDecision === "CHANGES_REQUESTED" || (p.comments ?? 0) > 0 || (p.review_comments ?? 0) > 0)
  ).length
  const passingCount = Math.max(0, openCount - attentionCount)

  const total = pulls.length || 1
  const attentionPercent = Math.round((attentionCount / total) * 100)
  const inReviewPercent = Math.round(((openCount - attentionCount) / total) * 100)
  const mergedPercent = Math.round((mergedCount / total) * 100)

  return (
    <div className="space-y-4">
      {/* CARD 1: Total Pull Requests / Status Breakdown (matching "130 Total Room" in image) */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 card-shadow space-y-4">
        {/* Top Header */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {pulls.length}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total PRs
            </span>
          </div>
        </div>

        {/* Multi-Segment Horizontal Bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            style={{ width: `${Math.max(attentionPercent, 15)}%` }}
            className="bg-rose-500 transition-all duration-300"
            title="Needs Attention"
          />
          <div
            style={{ width: `${Math.max(inReviewPercent, 25)}%` }}
            className="bg-amber-400 transition-all duration-300"
            title="In Review"
          />
          <div
            style={{ width: `${Math.max(mergedPercent, 20)}%` }}
            className="bg-indigo-600 transition-all duration-300"
            title="Merged"
          />
          <div className="flex-1 bg-sky-400" title="Draft / Open" />
        </div>

        {/* Breakdown Legend Rows */}
        <div className="space-y-2.5 pt-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Needs Attention ({attentionCount})
              </span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center text-[11px]">
              <ArrowUp className="size-3 mr-0.5 inline" /> +5% vs last week
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                In Review ({passingCount})
              </span>
            </div>
            <span className="text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center text-[11px]">
              <ArrowDown className="size-3 mr-0.5 inline" /> -9% vs last week
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-600" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Merged ({mergedCount})
              </span>
            </div>
            <span className="text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center text-[11px]">
              <ArrowDown className="size-3 mr-0.5 inline" /> -4% vs last week
            </span>
          </div>
        </div>

        {/* See all link */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <span>See all pull requests</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* CARD 2: Activities Stream (matching "Activities" in image) */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 card-shadow space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Activities
          </h3>
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-0.5"
          >
            <span>See all</span>
            <ChevronRight className="size-3" />
          </button>
        </div>

        {/* Group 1: Today */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span>Today</span>
          </div>

          {/* Subheader: 3 Checkouts today / 3 Reviews today */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/50">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="flex -space-x-1.5 overflow-hidden">
                  <div className="size-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-800">
                    AI
                  </div>
                  <div className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-800">
                    LH
                  </div>
                  <div className="size-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-800">
                    CL
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  3 Reviews today!
                </span>
              </div>
              <ChevronUp className="size-3.5 text-slate-400" />
            </div>

            {/* List of activity items */}
            <div className="space-y-2.5 pl-2 text-xs divide-y divide-slate-100 dark:divide-slate-700/50">
              {pulls.slice(0, 3).map((p, idx) => (
                <div
                  key={p.number}
                  onClick={() => openPr(p.number)}
                  className="pt-2 first:pt-0 flex items-start gap-2.5 cursor-pointer group"
                >
                  <Avatar className="size-6 mt-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <AvatarImage src={p.user.avatar_url} />
                    <AvatarFallback className="text-[9px] font-bold">
                      {p.user.login.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-primary transition-colors">
                      <span className="font-semibold">{p.user.login}</span> - reviewed PR #{p.number}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {p.head.ref.slice(0, 12)} • {12 - idx * 2}:23 PM
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subheader 2: 2 Check-ins today / 2 Fixes applied */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  2 Fixes merged today!
                </span>
              </div>
            </div>

            <div className="pl-8 text-xs text-slate-500 space-y-1">
              <p className="truncate">
                <span className="font-medium text-slate-700 dark:text-slate-300">Lance Stroll</span> - fixed lint issues
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                EC-103 • 2:00 PM
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible Accordions: Yesterday, Last Week, Last Month */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900">
            <span className="font-medium">Yesterday</span>
            <ChevronDown className="size-3.5 text-slate-400" />
          </div>
          <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900">
            <span className="font-medium">Last Week</span>
            <ChevronDown className="size-3.5 text-slate-400" />
          </div>
          <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900">
            <span className="font-medium">Last Month</span>
            <ChevronDown className="size-3.5 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
