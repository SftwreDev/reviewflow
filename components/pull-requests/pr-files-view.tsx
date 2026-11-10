"use client"

import React, { useState, useMemo } from "react"
import {
  FileDiff,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Search,
  ExternalLink,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DiffViewer, type InlineComment } from "./diff-viewer"
import { cn } from "@/lib/utils"

export interface ChangedFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes?: number
  patch?: string
  raw_url?: string
  blob_url?: string
}

interface PRFilesViewProps {
  files: ChangedFile[]
  comments?: InlineComment[]
  prHtmlUrl?: string
}

export function PRFilesView({
  files = [],
  comments = [],
  prHtmlUrl,
}: PRFilesViewProps) {
  const [filterQuery, setFilterQuery] = useState("")
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified")
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({})
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  // Filter files by filename
  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return files
    const q = filterQuery.toLowerCase()
    return files.filter((f) => f.filename.toLowerCase().includes(q))
  }, [files, filterQuery])

  // Total additions and deletions
  const totals = useMemo(() => {
    return files.reduce(
      (acc, f) => {
        acc.additions += f.additions
        acc.deletions += f.deletions
        return acc
      },
      { additions: 0, deletions: 0 }
    )
  }, [files])

  // Toggle collapse single file
  const toggleCollapse = (filename: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [filename]: !prev[filename],
    }))
  }

  // Expand all / Collapse all
  const expandAll = () => setCollapsedFiles({})
  const collapseAll = () => {
    const all: Record<string, boolean> = {}
    for (const f of files) all[f.filename] = true
    setCollapsedFiles(all)
  }

  // Copy path handler
  const copyPath = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename)
      setCopiedFile(filename)
      setTimeout(() => setCopiedFile(null), 2000)
    } catch {
      // Ignore
    }
  }

  // File status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "added":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
            Added
          </Badge>
        )
      case "removed":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-semibold">
            Deleted
          </Badge>
        )
      case "modified":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold">
            Modified
          </Badge>
        )
      case "renamed":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-semibold">
            Renamed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Control Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Filter ${files.length} changed files...`}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {filteredFiles.length} of {files.length} files
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Diff Mode Toggle */}
          <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDiffMode("unified")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                diffMode === "unified"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setDiffMode("split")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                diffMode === "split"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Split
            </button>
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="h-8 px-2.5 text-xs font-medium"
            >
              Expand all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="h-8 px-2.5 text-xs font-medium"
            >
              Collapse all
            </Button>
          </div>
        </div>
      </div>

      {/* 2. File list quick jump & File cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Quick Jump Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-4 rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Files ({filteredFiles.length})
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">+{totals.additions}</span>{" "}
                <span className="text-rose-600 dark:text-rose-400">-{totals.deletions}</span>
              </span>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto space-y-1 pr-1">
              {filteredFiles.map((file) => {
                const parts = file.filename.split("/")
                const filename = parts.pop()
                const folder = parts.join("/")
                const fileCommentsCount = comments.filter((c) => c.path === file.filename).length

                return (
                  <button
                    key={file.filename}
                    type="button"
                    onClick={() => scrollToElement(`file-${file.filename}`)}
                    className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {filename}
                      </span>
                      {folder && (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {folder}/
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                      {fileCommentsCount > 0 && (
                        <span className="rounded bg-primary/10 px-1 text-primary font-semibold">
                          {fileCommentsCount}
                        </span>
                      )}
                      <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
                      <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* File Diffs List */}
        <div className="space-y-5 min-w-0">
          {filteredFiles.map((file) => {
            const isCollapsed = Boolean(collapsedFiles[file.filename])
            const fileComments = comments.filter((c) => c.path === file.filename)
            const parts = file.filename.split("/")
            const basename = parts.pop()
            const dirname = parts.join("/")

            return (
              <div
                key={file.filename}
                id={`file-${file.filename}`}
                className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs scroll-mt-20"
              >
                {/* File Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/40 px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(file.filename)}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                      aria-label={isCollapsed ? "Expand file" : "Collapse file"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>

                    <div className="flex items-baseline gap-1.5 truncate text-xs">
                      {dirname && (
                        <span className="text-muted-foreground truncate">{dirname}/</span>
                      )}
                      <span className="font-semibold text-foreground text-sm">{basename}</span>
                    </div>

                    {getStatusBadge(file.status)}

                    {fileComments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4">
                        <span>{fileComments.length}</span>
                        <span>{fileComments.length === 1 ? "comment" : "comments"}</span>
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Additions / Deletions count */}
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{file.additions}
                      </span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{file.deletions}
                      </span>
                    </div>

                    {/* Copy file path */}
                    <button
                      type="button"
                      onClick={() => copyPath(file.filename)}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Copy file path"
                    >
                      {copiedFile === file.filename ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>

                    {file.blob_url && (
                      <a
                        href={file.blob_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="View file on GitHub"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Diff Viewer Body */}
                {!isCollapsed && (
                  <div className="p-3">
                    {file.patch ? (
                      <DiffViewer
                        patch={file.patch}
                        filename={file.filename}
                        mode={diffMode}
                        comments={fileComments}
                      />
                    ) : (
                      <div className="rounded-md border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                        Binary or empty file. Patch unavailable.{" "}
                        {prHtmlUrl && (
                          <a
                            href={prHtmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            View on GitHub
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {filteredFiles.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-12 text-center">
              <FileDiff className="mx-auto size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No files match your search</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for a different file name or clear your filter.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
