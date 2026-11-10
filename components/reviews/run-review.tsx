"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarkdownView } from "@/components/markdown-view"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/app-context"

export type Finding = {
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info" | string
  filePath: string
  lineNumber: number | null
  problem: string
  evidence: string
  impact: string
  solution: string
}

interface RunReviewProps {
  repo: string
  number: number
  headSha: string
  onJumpToFile?: (filePath: string) => void
}

export function RunReview({ repo, number, headSha, onJumpToFile }: RunReviewProps) {
  const { claudeModel, claudeModels, claudeSkills } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ headSha: string; findings: Finding[] } | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [copiedFixIndex, setCopiedFixIndex] = useState<number | null>(null)
  const [fetchedSkills, setFetchedSkills] = useState<{ name: string; description: string }[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState("")
  const [overrideModel, setOverrideModel] = useState<string>("")

  const effectiveModel = overrideModel || claudeModel || claudeModels[0]?.value || ""

  useEffect(() => {
    if (claudeSkills.length > 0) return
    let active = true
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.skills)) setFetchedSkills(d.skills)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [claudeSkills])

  const skills = claudeSkills.length > 0 ? claudeSkills : fetchedSkills

  async function run() {
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, number, skills: selectedSkills, customPrompt, model: effectiveModel }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Review failed")
      setResult(data)
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
    <div className="space-y-6">
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
      <Card className="border-border/70 shadow-xs">
        <CardContent className="space-y-3 p-4">
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
                No models loaded. Configure Claude in Settings or refresh capabilities.
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Skills to use</p>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <label key={skill.name} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={selectedSkills.includes(skill.name)}
                    onCheckedChange={(checked) => {
                      setSelectedSkills((prev) =>
                        checked ? [...prev, skill.name] : prev.filter((s) => s !== skill.name)
                      )
                    }}
                  />
                  {skill.name}
                </label>
              ))}
              {skills.length === 0 && (
                <span className="text-xs text-muted-foreground">No skills available.</span>
              )}
            </div>
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

      {/* 2. Review Results or Onboarding Card */}
      {result ? (
        <div className="space-y-5">
          {/* Commit SHA status */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
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

            <span className="text-muted-foreground">
              Total findings: <strong className="text-foreground">{findings.length}</strong>
            </span>
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
                  className="overflow-hidden border-border/70 shadow-xs"
                >
                  {/* Finding Header */}
                  <CardHeader className="bg-muted/30 border-b border-border/50 py-3.5 px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {getSeverityBadge(finding.severity)}
                        <span className="font-bold text-sm text-foreground">{finding.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 font-mono text-xs text-foreground border border-border/60">
                          <FileCode className="size-3 text-muted-foreground" />
                          <span>
                            {finding.filePath}
                            {finding.lineNumber ? `:${finding.lineNumber}` : ""}
                          </span>
                        </span>

                        {onJumpToFile && (
                          <button
                            type="button"
                            onClick={() => onJumpToFile(finding.filePath)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                          >
                            <span>Jump to diff</span>
                            <ArrowRight className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-xs">
                    {/* Problem */}
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Problem
                      </h4>
                      <MarkdownView content={finding.problem} />
                    </div>

                    {/* Evidence */}
                    {finding.evidence && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Evidence in Code
                        </h4>
                        <div className="rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed text-foreground/90">
                          {finding.evidence}
                        </div>
                      </div>
                    )}

                    {/* Impact */}
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Potential Impact
                      </h4>
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-amber-950 dark:text-amber-200">
                        <MarkdownView content={finding.impact} />
                      </div>
                    </div>

                    {/* Suggested Solution */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Suggested Fix
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyFix(finding.solution, idx)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                      <div className="rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs overflow-x-auto leading-relaxed">
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
