"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Sparkles,
  LoaderCircle,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Check,
  Copy,
  FileCode,
  ArrowRight,
  Info,
  Bug,
  SlidersHorizontal,
  ChevronDown,
  Search,
  X,
  Send,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { MarkdownView } from "@/components/markdown-view"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/app-context"
import { announceNotificationsChanged } from "@/lib/notification-types"

import type { Finding, Review } from "@/lib/review-types"

export type { Finding }

interface SkillsMultiSelectProps {
  skills: { name: string; description: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  isLoading?: boolean
}

export function SkillsMultiSelect({ skills, selected, onChange, isLoading }: SkillsMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSkill = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((s) => s !== name)
        : [...selected, name]
    )
  }

  const selectAll = () => {
    const allFiltered = filteredSkills.map((s) => s.name)
    onChange(Array.from(new Set([...selected, ...allFiltered])))
  }

  const clearAll = () => {
    onChange([])
  }

  const removeSkill = (name: string) => {
    onChange(selected.filter((s) => s !== name))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        {/* Dropdown Trigger */}
        <PopoverTrigger
          className={cn(
            "flex h-9 w-full max-w-md items-center justify-between rounded-lg border bg-background px-3 text-xs shadow-xs transition-colors hover:bg-muted/40 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring text-left",
            open ? "border-ring ring-1 ring-ring" : "border-input"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            {isLoading ? (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <LoaderCircle className="size-3 animate-spin" />
                Loading skills...
              </span>
            ) : selected.length === 0 ? (
              <span className="text-muted-foreground">Select skills for agent review (optional)...</span>
            ) : (
              <span className="font-medium text-foreground">
                {selected.length === 1 ? "1 skill enabled" : `${selected.length} skills enabled`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4">
                {selected.length}
              </Badge>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </PopoverTrigger>

        {/* Dropdown Menu Popup - Portaled outside container */}
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(480px,calc(100vw-2rem))] p-0 shadow-2xl border-border/80 bg-popover rounded-xl"
        >
          {/* Search and Quick Actions */}
          <div className="p-2 space-y-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter skills by name or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-muted/40 border-border/60"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span>
                {filteredSkills.length} of {skills.length} available
              </span>
              <div className="flex items-center gap-2 font-medium">
                {filteredSkills.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                )}
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-muted-foreground hover:text-destructive hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Skills Scrollable List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-border/20">
            {filteredSkills.map((skill) => {
              const isChecked = selected.includes(skill.name)
              return (
                <div
                  key={skill.name}
                  onClick={() => toggleSkill(skill.name)}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-left select-none pt-2",
                    isChecked
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted/60 text-foreground/90"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleSkill(skill.name)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        /{skill.name}
                      </span>
                      {isChecked && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-primary/15 text-primary border-primary/30"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    {skill.description ? (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {skill.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">
                        No description provided
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {filteredSkills.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-muted-foreground">
                {skills.length === 0 ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">No skills configured in project</p>
                    <p className="text-[11px] text-muted-foreground">
                      Create review skills in the Skills tab or add SKILL.md folders to{" "}
                      <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">.claude/skills</code>.
                    </p>
                  </div>
                ) : (
                  "No matching skills found"
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected skill chips with quick remove buttons */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {selected.map((skillName) => (
            <Badge
              key={skillName}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-mono bg-muted/90 hover:bg-muted border border-border/70 group"
            >
              <span>/{skillName}</span>
              <button
                type="button"
                onClick={() => removeSkill(skillName)}
                className="rounded p-0.5 hover:bg-destructive/20 hover:text-destructive cursor-pointer transition-colors"
                title={`Remove /${skillName}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-muted-foreground hover:text-destructive hover:underline ml-1 cursor-pointer"
            >
              Clear all ({selected.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface RunReviewProps {
  repo: string
  number: number
  headSha: string
  onJumpToFile?: (filePath: string) => void
}

export function RunReview({ repo, number, headSha, onJumpToFile }: RunReviewProps) {
  const { llmProvider, claudeModel, claudeModels, llmModel } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ id?: string; headSha: string; findings: Finding[]; appliedSkills?: string[] } | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [copiedFixIndex, setCopiedFixIndex] = useState<number | null>(null)
  const [copiedReview, setCopiedReview] = useState(false)
  const [skills, setSkills] = useState<{ name: string; description: string }[]>([])
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState("")
  const [overrideModel, setOverrideModel] = useState<string>("")
  const [posting, setPosting] = useState(false)
  const [postedUrl, setPostedUrl] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [history, setHistory] = useState<Review[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const settingsModel = llmProvider === "claude" ? claudeModel : llmModel
  const effectiveModel = overrideModel || settingsModel || claudeModels[0]?.value || ""

  useEffect(() => {
    let active = true
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.skills)) setSkills(d.skills)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSkills(false)
      })
    return () => {
      active = false
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(
        `/api/reviews?repo=${encodeURIComponent(repo)}&number=${number}`
      )
      if (!response.ok) return
      const data = await response.json()
      if (Array.isArray(data.reviews)) setHistory(data.reviews)
    } catch {
      // History is best-effort.
    } finally {
      setHistoryLoading(false)
    }
  }, [repo, number])

  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (mounted) void loadHistory()
    }, 0)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [loadHistory])

  async function run() {
    setBusy(true)
    setError("")
    setResult(null)
    setLogs([])
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, number, skills: selectedSkills, customPrompt, model: effectiveModel }),
      })
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({ error: `Request failed with ${response.status}` }))) as { error?: string }
        throw new Error(errData.error || "Review failed")
      }

      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/x-ndjson")) {
        const reader = response.body?.getReader()
        if (!reader) throw new Error("Review stream unavailable")
        const decoder = new TextDecoder()
        let buffer = ""
        let finalReview: { id?: string; headSha?: string; findings?: Finding[]; skills?: string[] } | null = null
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line) as {
                type?: string
                message?: unknown
                review?: { id?: string; headSha?: string; findings?: Finding[]; skills?: string[] }
                error?: string
              }
              if (parsed.type === "log") {
                const message =
                  typeof parsed.message === "string" ? parsed.message : JSON.stringify(parsed.message)
                setLogs((prev) => [...prev, message])
              } else if (parsed.type === "result" && parsed.review) {
                finalReview = parsed.review
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Review failed")
              }
            } catch (err) {
              if (err instanceof Error && !err.message.includes("JSON")) throw err
            }
          }
        }
        if (finalReview) {
          setResult({
            id: finalReview.id,
            headSha: finalReview.headSha || headSha,
            findings: finalReview.findings || [],
            appliedSkills: finalReview.skills || selectedSkills,
          })
          announceNotificationsChanged()
          void loadHistory()
          return
        }
      }

      const data = (await response.json()) as {
        headSha?: string
        findings?: Finding[]
        appliedSkills?: string[]
        review?: { id?: string; headSha?: string; findings?: Finding[]; skills?: string[] }
      }
      setResult({
        id: data.review?.id,
        headSha: data.headSha || data.review?.headSha || headSha,
        findings: data.findings || data.review?.findings || [],
        appliedSkills: data.appliedSkills || data.review?.skills || selectedSkills,
      })
      announceNotificationsChanged()
      void loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed")
    } finally {
      setBusy(false)
    }
  }

  const copyFix = async (solution: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(solution)
      setCopiedFixIndex(idx)
      setTimeout(() => setCopiedFixIndex(null), 2000)
    } catch {
      // Ignore
    }
  }
  const copyReview = async () => {
    const text = findings.length
      ? findings.map((finding) => `## ${finding.title}\n\n**Severity:** ${finding.severity}\n\n**Location:** \`${finding.filePath}${finding.lineNumber ? `:${finding.lineNumber}` : ""}\`\n\n### Problem\n\n${finding.problem}\n\n### Evidence\n\n> ${finding.evidence.replace(/\n/g, "\n> ")}\n\n### Impact\n\n${finding.impact}\n\n### Suggested fix\n\n${finding.solution}`).join("\n\n---\n\n")
      : "AI review found no evidence-backed findings."
    try {
      await navigator.clipboard.writeText(text)
      setCopiedReview(true)
      setTimeout(() => setCopiedReview(false), 2000)
    } catch {
      setError("Could not copy review results to clipboard")
    }
  }

  const postToPr = async (event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES") => {
    if (!result?.id) return
    setPosting(true)
    setError("")
    try {
      const response = await fetch("/api/reviews/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewId: result.id, repo, number, event }),
      })
      const data = (await response.json().catch(() => ({}))) as { review?: { html_url?: string }; error?: string }
      if (!response.ok) throw new Error(data.error || `Failed to post review (${response.status})`)
      setPostedUrl(data.review?.html_url ?? "posted")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post review to PR")
    } finally {
      setPosting(false)
    }
  }

  const findings = result?.findings || []
  const criticalCount = findings.filter((f) => f.severity === "critical").length
  const highCount = findings.filter((f) => f.severity === "high").length
  const mediumCount = findings.filter((f) => f.severity === "medium").length
  const lowCount = findings.filter((f) => f.severity === "low" || f.severity === "info").length

  const filteredFindings = findings.filter((f) => {
    if (severityFilter === "all") return true
    if (severityFilter === "critical") return f.severity === "critical"
    if (severityFilter === "high") return f.severity === "high"
    if (severityFilter === "medium") return f.severity === "medium"
    if (severityFilter === "low") return f.severity === "low" || f.severity === "info"
    return true
  })

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 uppercase tracking-wider text-[10px] font-bold">
            Critical
          </Badge>
        )
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 uppercase tracking-wider text-[10px] font-bold">
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 uppercase tracking-wider text-[10px] font-bold">
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 uppercase tracking-wider text-[10px] font-bold">
            Low
          </Badge>
        )
      case "info":
        return (
          <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-bold">
            Info
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">
            {severity}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-full min-w-0">
      {/* 1. Header Banner */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="text-lg font-bold text-foreground">AI Agent Code Review</h3>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {effectiveModel || "Claude default"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Autonomous code review agent auditing PR diffs for correctness, security vulnerabilities,
                regression hazards, edge cases, and performance regressions. Read-only, zero filesystem access.
              </p>
            </div>

            <Button
              onClick={() => void run()}
              disabled={busy}
              className="gap-2 font-medium shrink-0 shadow-xs"
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Auditing Diff...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>{result ? "Re-run Agent Review" : "Run Agent Review"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="border-t border-destructive/20 bg-destructive/10 px-6 py-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* Review Options */}
      <Card className="border-border/70 shadow-xs overflow-visible">
        <CardContent className="space-y-3 p-4 overflow-visible">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Review Options</h3>
          </div>
          <div>
            <label htmlFor="review-model" className="mb-1 block text-xs text-muted-foreground">
              Model
            </label>
            <select
              id="review-model"
              value={overrideModel}
              onChange={(e) => setOverrideModel(e.target.value)}
              className="flex h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50"
            >
              <option value="">Use settings default</option>
              {claudeModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.displayName} ({m.value})
                </option>
              ))}
            </select>
            {claudeModels.length === 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                No models loaded. Configure a provider key in Settings, then refresh.
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground">
                Agent Skills to Enforce
              </label>
              {selectedSkills.length > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedSkills.length} selected
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Select skills from your project. Selected skills are directly injected into the review instructions and strictly enforced by the agent.
            </p>
            <SkillsMultiSelect
              skills={skills}
              selected={selectedSkills}
              onChange={setSelectedSkills}
              isLoading={loadingSkills}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Optional extra instructions</p>
            <Textarea
              placeholder="Additional instructions for the review..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-20 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Review History */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Review History</h3>
            {historyLoading && <LoaderCircle className="size-3 animate-spin text-muted-foreground" />}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="max-h-56 space-y-2 overflow-y-auto p-4">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No previous reviews.</p>
          ) : (
            history.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => {
                  setResult({ headSha: review.headSha, findings: review.findings })
                  setLogs([])
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-xs hover:bg-muted/40"
              >
                <span className="font-medium">{new Date(review.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {review.model} · {review.findings.length} findings
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Live Logs */}
      {(busy || logs.length > 0) && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="py-3">
            <h3 className="text-sm font-semibold">Live Agent Logs</h3>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
              {logs.join("\n") || "Starting…"}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* 2. Review Results or Onboarding Card */}
      {result ? (
        <div className="space-y-5 max-w-full min-w-0">
          {/* Commit SHA status & Applied Skills */}
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Reviewed commit:</span>
              <code className="rounded bg-background px-1.5 py-0.5 font-mono font-semibold text-foreground border border-border/50">
                {result.headSha.slice(0, 10)}
              </code>
              {result.headSha !== headSha ? (
                <Badge variant="destructive" className="text-[10px]">
                  Outdated (new commits pushed)
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                  Current with Head
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {result.appliedSkills && result.appliedSkills.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">Applied Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.appliedSkills.map((name) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="font-mono text-[10px] bg-background border-primary/30 text-primary font-semibold py-0"
                      >
                        /{name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <span className="text-muted-foreground">
                Total findings: <strong className="text-foreground">{findings.length}</strong>
              </span>
              <Button variant="outline" size="sm" onClick={() => void copyReview()} className="h-7 gap-1.5 text-xs">
                {copiedReview ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedReview ? "Copied" : "Copy Results"}
              </Button>
              {result.id ? (
                postedUrl ? (
                  <a
                    href={postedUrl.startsWith("http") ? postedUrl : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    <Check className="size-3.5" />
                    Posted to PR
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={posting}
                    onClick={() => void postToPr("COMMENT")}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {posting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {posting ? "Posting..." : "Post to PR"}
                  </Button>
                )
              ) : null}
            </div>
          </div>

          {/* Severity Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                severityFilter === "critical"
                  ? "border-red-500 bg-red-500/10 ring-1 ring-red-500"
                  : "border-border/70 bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400">
                <span>Critical</span>
                <ShieldAlert className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{criticalCount}</p>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === "high" ? "all" : "high")}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                severityFilter === "high"
                  ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500"
                  : "border-border/70 bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
                <span>High</span>
                <AlertTriangle className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{highCount}</p>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === "medium" ? "all" : "medium")}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                severityFilter === "medium"
                  ? "border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500"
                  : "border-border/70 bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                <span>Medium</span>
                <Bug className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{mediumCount}</p>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === "low" ? "all" : "low")}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                severityFilter === "low"
                  ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                  : "border-border/70 bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>Low / Info</span>
                <Info className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{lowCount}</p>
            </button>
          </div>

          {/* Findings List */}
          {filteredFindings.length > 0 ? (
            <div className="space-y-4">
              {filteredFindings.map((finding, idx) => (
                <Card
                  key={`${finding.filePath}-${finding.lineNumber}-${idx}`}
                  className="overflow-hidden border-border/70 shadow-xs max-w-full min-w-0"
                >
                  {/* Finding Header */}
                  <CardHeader className="bg-muted/30 border-b border-border/50 py-3.5 px-5 max-w-full min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {getSeverityBadge(finding.severity)}
                        <span className="font-bold text-sm text-foreground break-words">{finding.title}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 font-mono text-xs text-foreground border border-border/60 max-w-[280px] sm:max-w-md truncate min-w-0">
                          <FileCode className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {finding.filePath}
                            {finding.lineNumber ? `:${finding.lineNumber}` : ""}
                          </span>
                        </span>

                        {onJumpToFile && (
                          <button
                            type="button"
                            onClick={() => onJumpToFile(finding.filePath)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 ml-1 cursor-pointer"
                          >
                            <span>Jump to diff</span>
                            <ArrowRight className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-xs max-w-full min-w-0">
                    {/* Problem */}
                    <div className="max-w-full min-w-0 break-words">
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Problem
                      </h4>
                      <MarkdownView content={finding.problem} />
                    </div>

                    {/* Evidence */}
                    {finding.evidence && (
                      <div className="max-w-full min-w-0">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Evidence in Code
                        </h4>
                        <div className="rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed text-foreground/90 max-w-full min-w-0">
                          {finding.evidence}
                        </div>
                      </div>
                    )}

                    {/* Impact */}
                    <div className="max-w-full min-w-0">
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Potential Impact
                      </h4>
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-amber-950 dark:text-amber-200 max-w-full min-w-0 break-words">
                        <MarkdownView content={finding.impact} />
                      </div>
                    </div>

                    {/* Suggested Solution */}
                    <div className="max-w-full min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Suggested Fix
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyFix(finding.solution, idx)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        >
                          {copiedFixIndex === idx ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy Fix</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs overflow-x-auto leading-relaxed max-w-full min-w-0">
                        <MarkdownView content={finding.solution} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 p-12 text-center">
              <ShieldCheck className="mx-auto size-10 text-emerald-500/80 mb-2" />
              <p className="text-sm font-semibold text-foreground">
                No findings match the selected filter
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {findings.length === 0
                  ? "Great job! The AI review found no concrete bugs or security issues in this diff."
                  : "Switch to 'All' or another severity level to view other findings."}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Review haven't been run yet */
        <Card className="border-border/70 border-dashed bg-card/50 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Sparkles className="size-6" />
          </div>
          <h4 className="text-base font-semibold text-foreground">
            No agent review executed for this commit yet
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
            Click <strong>&quot;Run Agent Review&quot;</strong> above to analyze the pull request diff with
            Claude Sonnet 4.5. The model will verify edge cases, logic errors, regressions, and security flaws.
          </p>
        </Card>
      )}
    </div>
  )
}
