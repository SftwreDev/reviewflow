"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MarkdownView } from "@/components/markdown-view"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Sparkles,
  Trash2,
  Pencil,
  Plus,
  LoaderCircle,
  Eye,
  Search,
  Check,
  Copy,
  ShieldCheck,
  GitPullRequest,
  Database,
  Rocket,
  LayoutGrid,
  List,
  ArrowRight,
  BookOpen,
  Terminal,
  X,
  AlertCircle,
  Maximize2,
  Minimize2,
  Bookmark,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type Skill = {
  name: string
  description: string
  content: string
}

interface ParsedSkill {
  frontmatter: Record<string, string>
  body: string
  headings: { id: string; text: string; level: number }[]
}

function parseSkillContent(raw: string): ParsedSkill {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const frontmatter: Record<string, string> = {}
  let body = raw

  if (fmMatch) {
    const yaml = fmMatch[1]
    body = raw.slice(fmMatch[0].length).trim()
    for (const line of yaml.split("\n")) {
      const colon = line.indexOf(":")
      if (colon > 0) {
        const k = line.slice(0, colon).trim()
        const v = line.slice(colon + 1).trim()
        frontmatter[k] = v
      }
    }
  }

  // Extract h2 and h3 headings for Table of Contents
  const headings: { id: string; text: string; level: number }[] = []
  const headingMatches = body.matchAll(/^(#{2,3})\s+(.+)$/gm)
  for (const match of headingMatches) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    headings.push({ id, text, level })
  }

  return { frontmatter, body, headings }
}

function getSkillIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("index") || n.includes("search") || n.includes("find")) {
    return {
      icon: <Search className="size-4 text-sky-500 dark:text-sky-400" />,
      bg: "bg-sky-500/10 border-sky-500/20",
      tag: "Index & Search",
    }
  }
  if (
    n.includes("ci") ||
    n.includes("test") ||
    n.includes("check") ||
    n.includes("validate") ||
    n.includes("guard")
  ) {
    return {
      icon: <ShieldCheck className="size-4 text-emerald-500 dark:text-emerald-400" />,
      bg: "bg-emerald-500/10 border-emerald-500/20",
      tag: "Validation & CI",
    }
  }
  if (
    n.includes("pr") ||
    n.includes("pull") ||
    n.includes("review") ||
    n.includes("merge") ||
    n.includes("graduate")
  ) {
    return {
      icon: <GitPullRequest className="size-4 text-purple-500 dark:text-purple-400" />,
      bg: "bg-purple-500/10 border-purple-500/20",
      tag: "Pull Requests",
    }
  }
  if (
    n.includes("schema") ||
    n.includes("db") ||
    n.includes("migration") ||
    n.includes("database")
  ) {
    return {
      icon: <Database className="size-4 text-amber-500 dark:text-amber-400" />,
      bg: "bg-amber-500/10 border-amber-500/20",
      tag: "Database & Schema",
    }
  }
  if (n.includes("release") || n.includes("deploy") || n.includes("ship")) {
    return {
      icon: <Rocket className="size-4 text-rose-500 dark:text-rose-400" />,
      bg: "bg-rose-500/10 border-rose-500/20",
      tag: "Deployment",
    }
  }
  return {
    icon: <Sparkles className="size-4 text-primary" />,
    bg: "bg-primary/10 border-primary/20",
    tag: "Workflow Skill",
  }
}

export function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillsDir, setSkillsDir] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Search and view preferences
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null)
  const [copiedRaw, setCopiedRaw] = useState(false)

  // Drawer Preview State with width expansion
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [previewTab, setPreviewTab] = useState<"rendered" | "raw">("rendered")

  // Create / Edit modal state
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formName, setFormName] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formTab, setFormTab] = useState<"edit" | "preview">("edit")

  const loadSkills = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/skills")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load skills")
      setSkills(data.skills || [])
      if (data.directory) setSkillsDir(data.directory)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load skills")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (mounted) void loadSkills()
    }, 0)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [loadSkills])

  // Filter skills
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills
    const q = searchQuery.toLowerCase()
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.content.toLowerCase().includes(q)
    )
  }, [skills, searchQuery])

  // Parse currently selected skill
  const parsedSelected = useMemo(() => {
    if (!selectedSkill) return null
    return parseSkillContent(selectedSkill.content)
  }, [selectedSkill])

  // Save handler
  async function handleSave(name: string, content: string) {
    if (!name.trim() || !content.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", name: name.trim(), content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save skill")

      setIsCreating(false)
      setEditingSkill(null)
      setFormName("")
      setFormContent("")
      await loadSkills()

      // If updating currently previewed skill, refresh it
      if (selectedSkill?.name === name) {
        setSelectedSkill({ name, description: "", content })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save skill")
    } finally {
      setBusy(false)
    }
  }

  // Delete handler
  async function handleDelete(name: string) {
    if (!confirm(`Are you sure you want to delete skill "${name}"? This removes its SKILL.md directory.`)) {
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete skill")

      if (selectedSkill?.name === name) {
        setSelectedSkill(null)
      }
      await loadSkills()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete skill")
    } finally {
      setBusy(false)
    }
  }

  const handleCopyCommand = async (e: React.MouseEvent, skillName: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`/${skillName}`)
      setCopiedSkill(skillName)
      setTimeout(() => setCopiedSkill(null), 2000)
    } catch {
      // Ignore
    }
  }

  const handleCopyRaw = async () => {
    if (!selectedSkill) return
    try {
      await navigator.clipboard.writeText(selectedSkill.content)
      setCopiedRaw(true)
      setTimeout(() => setCopiedRaw(false), 2000)
    } catch {
      // Ignore
    }
  }

  const openEdit = (e: React.MouseEvent, skill: Skill) => {
    e.stopPropagation()
    setEditingSkill(skill)
    setFormName(skill.name)
    setFormContent(skill.content)
    setIsCreating(false)
    setFormTab("edit")
  }

  const openCreate = () => {
    setIsCreating(true)
    setEditingSkill(null)
    setFormName("")
    setFormContent(
      `---\nname: my-new-skill\ndescription: Describe when the agent should use this skill and what problem it solves.\n---\n\n# My New Skill\n\nInstructions and procedures for the review agent:\n\n1. **Step 1**: ...\n2. **Step 2**: ...\n`
    )
    setFormTab("edit")
  }

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header Hero Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-gradient-to-r from-primary/5 via-card to-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Agent Skills</h2>
                <Badge variant="outline" className="font-mono text-[11px] py-0 px-2">
                  {skills.length} available
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                <span>Autonomous capabilities loaded from</span>
                <code
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border/50 truncate max-w-sm inline-block"
                  title={skillsDir || ".claude/skills"}
                >
                  {skillsDir ? skillsDir.split("/").slice(-3).join("/") : ".claude/skills"}
                </code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={openCreate}
            size="sm"
            className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Skill</span>
          </Button>
        </div>
      </div>

      {/* 2. Search, Filter & View Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills by name, keywords, or instructions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-muted-foreground font-mono">
            {filteredSkills.length} of {skills.length} skills
          </span>

          <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Skills Cards Display */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-xs gap-2">
          <LoaderCircle className="size-5 animate-spin" />
          <span>Loading agent skills...</span>
        </div>
      ) : filteredSkills.length > 0 ? (
        viewMode === "grid" ? (
          /* Grid View: 2 or 3 responsive columns */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill) => {
              const meta = getSkillIcon(skill.name)
              const wordCount = skill.content.split(/\s+/).filter(Boolean).length

              return (
                <div
                  key={skill.name}
                  onClick={() => setSelectedSkill(skill)}
                  className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-2xs hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-3">
                    {/* Card Top: Icon, Name & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                            meta.bg
                          )}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate"
                            title={skill.name}
                          >
                            {skill.name}
                          </h3>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            /{skill.name}
                          </span>
                        </div>
                      </div>

                      {/* Top Action Buttons */}
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleCopyCommand(e, skill.name)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          title="Copy command"
                        >
                          {copiedSkill === skill.name ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openEdit(e, skill)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          title="Edit skill"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(skill.name)
                          }}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                          title="Delete skill"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Description Paragraph */}
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {skill.description || "No description provided in frontmatter."}
                    </p>
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">
                      {meta.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80 group-hover:text-foreground transition-colors">
                      <span>{wordCount} words</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs divide-y divide-border/40">
            {filteredSkills.map((skill) => {
              const meta = getSkillIcon(skill.name)
              const wordCount = skill.content.split(/\s+/).filter(Boolean).length

              return (
                <div
                  key={skill.name}
                  onClick={() => setSelectedSkill(skill)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.bg
                      )}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {skill.name}
                        </span>
                        <span className="rounded bg-muted/80 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                          /{skill.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {skill.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-mono text-[11px] hidden md:inline">
                      {wordCount} words
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSkill(skill)}
                        className="h-7 px-2 text-xs cursor-pointer"
                      >
                        <Eye className="size-3.5 mr-1" />
                        <span>View</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openEdit(e, skill)}
                        className="h-7 px-2 text-xs cursor-pointer"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(skill.name)
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Empty state */
        <div className="rounded-xl border border-dashed border-border/80 p-16 text-center space-y-3">
          <BookOpen className="mx-auto size-10 text-muted-foreground/40 mb-2" />
          <h3 className="text-base font-semibold text-foreground">
            {searchQuery ? "No matching skills found" : "No agent skills configured"}
          </h3>
          <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
            {searchQuery
              ? `No skills matched "${searchQuery}". Try searching for another keyword or clear your filter.`
              : `No skills found in ${skillsDir ? skillsDir.split("/").slice(-3).join("/") : ".claude/skills"}. ReviewFlow reads .claude/skills from the project root where the app was executed.`}
          </p>
          {searchQuery ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs cursor-pointer"
            >
              Clear Search
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={openCreate}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Create First Skill</span>
            </Button>
          )}
        </div>
      )}

      {/* 4. Slide-out Sheet for Full Skill Preview with Expand Option */}
      <Sheet
        open={Boolean(selectedSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
            setIsExpanded(false)
          }
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            "w-full overflow-y-auto p-0 flex flex-col bg-card transition-all duration-300 ease-in-out shadow-2xl",
            isExpanded
              ? "data-[side=right]:sm:max-w-5xl lg:data-[side=right]:sm:max-w-6xl xl:data-[side=right]:sm:max-w-7xl max-w-[94vw]!"
              : "data-[side=right]:sm:max-w-2xl"
          )}
        >
          {selectedSkill && parsedSelected && (
            <div className="flex flex-col h-full">
              {/* Sheet Header */}
              <SheetHeader className="p-6 border-b border-border/60 bg-muted/20">
                <div className="flex items-start justify-between gap-3 pr-10">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                        <Terminal className="size-4" />
                      </div>
                      <SheetTitle className="font-mono text-lg font-bold text-foreground truncate">
                        {selectedSkill.name}
                      </SheetTitle>
                      <SheetDescription className="sr-only">
                        Detailed preview of agent skill and documentation
                      </SheetDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span className="rounded bg-muted px-2 py-0.5 border border-border/50 text-[11px] text-foreground font-medium">
                        /{selectedSkill.name}
                      </span>
                      <span>•</span>
                      <span title={skillsDir ? `${skillsDir}/${selectedSkill.name}/SKILL.md` : undefined}>
                        {skillsDir ? skillsDir.split("/").slice(-2).join("/") : ".claude/skills"}/{selectedSkill.name}/SKILL.md
                      </span>
                    </div>
                  </div>

                  {/* Panel Width Expand Toggle Button */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs hover:bg-muted"
                      title={isExpanded ? "Collapse to standard width" : "Expand panel width for better preview"}
                    >
                      {isExpanded ? (
                        <>
                          <Minimize2 className="size-3.5 text-primary" />
                          <span className="hidden sm:inline">Normal width</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="size-3.5 text-primary" />
                          <span className="hidden sm:inline">Expand panel</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Description Callout Box */}
                {(selectedSkill.description || parsedSelected.frontmatter.description) && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <Info className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-primary block text-[11px] uppercase tracking-wider mb-1">
                          When & Why to Use
                        </span>
                        <p className="text-foreground/90 leading-relaxed">
                          {selectedSkill.description || parsedSelected.frontmatter.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-border/40">
                  <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("rendered")}
                      className={cn(
                        "rounded px-3 py-1 font-medium transition-colors cursor-pointer",
                        previewTab === "rendered"
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Formatted Guide
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("raw")}
                      className={cn(
                        "rounded px-3 py-1 font-medium transition-colors cursor-pointer",
                        previewTab === "raw"
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Raw Source
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleCopyCommand(e, selectedSkill.name)}
                      className="h-8 text-xs gap-1.5 cursor-pointer"
                    >
                      {copiedSkill === selectedSkill.name ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          <span className="text-emerald-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy /{selectedSkill.name}</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => openEdit(e, selectedSkill)}
                      className="h-8 text-xs gap-1.5 cursor-pointer"
                    >
                      <Pencil className="size-3" />
                      <span>Edit</span>
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Sheet Body with Responsive TOC in Expanded View */}
              <div className="flex-1 p-6 overflow-y-auto">
                {previewTab === "rendered" ? (
                  <div className={cn("grid gap-6", isExpanded && parsedSelected.headings.length > 0 ? "lg:grid-cols-[1fr_220px]" : "grid-cols-1")}>
                    {/* Main Documentation Body */}
                    <div className="min-w-0 space-y-4">
                      {/* Horizontal Jump Pills in standard mode */}
                      {!isExpanded && parsedSelected.headings.length > 0 && (
                        <div className="pb-3 border-b border-border/50">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Quick Sections
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {parsedSelected.headings.map((h) => (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => scrollToHeading(h.id)}
                                className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                              >
                                {h.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rendered Markdown Body (without raw YAML frontmatter) */}
                      <MarkdownView content={parsedSelected.body} />
                    </div>

                    {/* Sticky Table of Contents Sidebar (in Expanded view) */}
                    {isExpanded && parsedSelected.headings.length > 0 && (
                      <div className="hidden lg:block">
                        <div className="sticky top-0 rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider pb-2 border-b border-border/50">
                            <Bookmark className="size-3.5 text-primary" />
                            <span>Contents</span>
                          </div>

                          <nav className="space-y-1 text-xs">
                            {parsedSelected.headings.map((h) => (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => scrollToHeading(h.id)}
                                className={cn(
                                  "w-full text-left rounded px-2 py-1 transition-colors truncate block text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer",
                                  h.level === 3 && "pl-4 text-[11px]"
                                )}
                                title={h.text}
                              >
                                {h.text}
                              </button>
                            ))}
                          </nav>

                          <div className="pt-3 border-t border-border/50 space-y-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <span>Skill File:</span>
                              <span className="font-mono text-foreground">SKILL.md</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Total Words:</span>
                              <span className="font-mono text-foreground">
                                {selectedSkill.content.split(/\s+/).filter(Boolean).length}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Raw Source Code Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        Raw contents of .claude/skills/{selectedSkill.name}/SKILL.md
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyRaw}
                        className="h-7 text-xs gap-1.5 cursor-pointer"
                      >
                        {copiedRaw ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy Source</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/40 p-4 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed text-foreground/90">
                      {selectedSkill.content}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 5. Create / Edit Skill Modal */}
      {(isCreating || editingSkill) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-3xl border-border/80 shadow-2xl overflow-hidden bg-card flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isCreating ? "Create Agent Skill" : `Edit Skill: ${editingSkill?.name}`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Stored as <code className="font-mono">.claude/skills/&lt;name&gt;/SKILL.md</code>
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setEditingSkill(null)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Skill Identifier Name
                </label>
                <Input
                  placeholder="e.g. security-audit, database-migration, fast-rebase"
                  value={formName}
                  disabled={!isCreating}
                  onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Alphanumeric characters, dashes, and underscores only. Invoked via{" "}
                  <code className="font-mono">/{formName || "skill-name"}</code>.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    SKILL.md Definition
                  </label>
                  <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormTab("edit")}
                      className={cn(
                        "rounded px-2.5 py-0.5 font-medium transition-colors cursor-pointer",
                        formTab === "edit"
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormTab("preview")}
                      className={cn(
                        "rounded px-2.5 py-0.5 font-medium transition-colors cursor-pointer",
                        formTab === "preview"
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {formTab === "edit" ? (
                  <Textarea
                    placeholder="YAML frontmatter and markdown documentation..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="min-h-72 font-mono text-xs leading-relaxed"
                  />
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-5 min-h-72 overflow-y-auto max-h-96">
                    <MarkdownView content={formContent} />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/20 px-6 py-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCreating(false)
                  setEditingSkill(null)
                }}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave(formName, formContent)}
                disabled={busy || !formName.trim() || !formContent.trim()}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                {busy && <LoaderCircle className="size-3.5 animate-spin" />}
                <span>{isCreating ? "Create Skill" : "Save Changes"}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
