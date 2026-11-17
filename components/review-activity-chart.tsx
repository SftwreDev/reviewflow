"use client"

import React, { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts"
import { CheckSquare, Square, ChevronDown, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReviewActivityChartProps {
  reviewHistory?: { createdAt: string }[]
  fixRuns?: number
}

const monthlyData = [
  { month: "Jan 2026", reviews: 18, fixes: 8, spend: "$42" },
  { month: "Feb 2026", reviews: 29, fixes: 14, spend: "$85" },
  { month: "Mar 2026", reviews: 22, fixes: 11, spend: "$64" },
  { month: "Apr 2026", reviews: 45, fixes: 24, spend: "$142", active: true },
  { month: "May 2026", reviews: 31, fixes: 15, spend: "$92" },
  { month: "Jun 2026", reviews: 38, fixes: 19, spend: "$118" },
  { month: "July 2026", reviews: 34, fixes: 16, spend: "$105" },
]

export function ReviewActivityChart({
  reviewHistory = [],
  fixRuns = 0,
}: ReviewActivityChartProps) {
  const [metric, setMetric] = useState<"reviews" | "fixes">("reviews")
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(3)

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 card-shadow space-y-4">
      {/* Header matching "Financial Activity" in the image */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Review Activity
            </h3>
            <button
              type="button"
              className="sm:hidden text-slate-400 hover:text-slate-600 p-1"
            >
              <MoreVertical className="size-4" />
            </button>
          </div>

          {/* Sub-tabs: Revenue & Expenses style */}
          <div className="flex items-center gap-4 mt-2 border-b border-transparent">
            <button
              type="button"
              onClick={() => setMetric("reviews")}
              className={cn(
                "flex items-center gap-1.5 pb-1 text-xs font-semibold transition-colors cursor-pointer border-b-2",
                metric === "reviews"
                  ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {metric === "reviews" ? (
                <CheckSquare className="size-3.5 text-slate-900 dark:text-white" />
              ) : (
                <Square className="size-3.5 text-slate-400" />
              )}
              <span>Agent Reviews</span>
            </button>

            <button
              type="button"
              onClick={() => setMetric("fixes")}
              className={cn(
                "flex items-center gap-1.5 pb-1 text-xs font-semibold transition-colors cursor-pointer border-b-2",
                metric === "fixes"
                  ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {metric === "fixes" ? (
                <CheckSquare className="size-3.5 text-slate-900 dark:text-white" />
              ) : (
                <Square className="size-3.5 text-slate-400" />
              )}
              <span>Auto Fixes</span>
            </button>
          </div>
        </div>

        {/* Timeframe dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer bg-white dark:bg-slate-800"
          >
            <span>Monthly Activity</span>
            <ChevronDown className="size-3 text-slate-400" />
          </button>
          <button
            type="button"
            className="hidden sm:inline-flex text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={monthlyData}
            margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state) => {
              if (state && state.activeTooltipIndex !== undefined) {
                setHoveredIndex(Number(state.activeTooltipIndex))
              }
            }}
            onMouseLeave={() => setHoveredIndex(3)}
          >
            <defs>
              <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="softGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e0e7ff" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#eef2ff" stopOpacity={0.4} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="#f1f5f9"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(val) => `${val}`}
            />

            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-slate-900 text-white rounded-xl px-3 py-1.5 shadow-xl text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-300">
                        <span className="size-1.5 rounded-full bg-indigo-400" />
                        <span>Total {metric === "reviews" ? "Reviews" : "Fixes"}</span>
                      </div>
                      <p className="text-xs font-bold font-mono mt-0.5">
                        {metric === "reviews" ? data.reviews : data.fixes} runs
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />

            <Bar
              dataKey={metric}
              radius={[8, 8, 0, 0]}
              barSize={52}
            >
              {monthlyData.map((entry, index) => {
                const isSelected = hoveredIndex === index
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isSelected ? "url(#activeGradient)" : "url(#softGradient)"}
                    className="transition-all duration-200 cursor-pointer"
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
