"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MarkdownView } from "@/components/markdown-view"
import { Badge } from "@/components/ui/badge"

export interface InlineComment {
  id: number
  user: {
    login: string
    avatar_url?: string
  }
  body: string
  created_at?: string
  line: number | null
  path?: string
  html_url?: string
  in_reply_to_id?: number | null
}

interface DiffLine {
  type: "meta" | "add" | "delete" | "context"
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

interface SplitRow {
  left?: {
    lineNumber?: number
    content: string
    type: "delete" | "context"
  }
  right?: {
    lineNumber?: number
    content: string
    type: "add" | "context"
  }
  meta?: string
}

function parseUnifiedDiff(patch: string): DiffLine[] {
  const lines: DiffLine[] = []
  if (!patch) return lines

  const rawLines = patch.split("\n")
  let oldLine = 0
  let newLine = 0

  for (const line of rawLines) {
    if (line.startsWith("\\ No newline at end of file")) {
      continue
    }

    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      lines.push({
        type: "meta",
        content: line,
      })
      continue
    }

    if (line.startsWith("+")) {
      lines.push({
        type: "add",
        content: line.slice(1),
        newLineNumber: newLine++,
      })
    } else if (line.startsWith("-")) {
      lines.push({
        type: "delete",
        content: line.slice(1),
        oldLineNumber: oldLine++,
      })
    } else if (line.startsWith(" ")) {
      lines.push({
        type: "context",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      })
    } else if (line) {
      lines.push({
        type: "context",
        content: line,
      })
    }
  }

  return lines
}

function toSplitRows(unifiedLines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0

  while (i < unifiedLines.length) {
    const line = unifiedLines[i]

    if (line.type === "meta") {
      rows.push({ meta: line.content })
      i++
      continue
    }

    if (line.type === "context") {
      rows.push({
        left: {
          lineNumber: line.oldLineNumber,
          content: line.content,
          type: "context",
        },
        right: {
          lineNumber: line.newLineNumber,
          content: line.content,
          type: "context",
        },
      })
      i++
      continue
    }

    const deletes: DiffLine[] = []
    const adds: DiffLine[] = []

    while (i < unifiedLines.length && unifiedLines[i].type === "delete") {
      deletes.push(unifiedLines[i])
      i++
    }

    while (i < unifiedLines.length && unifiedLines[i].type === "add") {
      adds.push(unifiedLines[i])
      i++
    }

    const count = Math.max(deletes.length, adds.length)
    for (let j = 0; j < count; j++) {
      const del = deletes[j]
      const add = adds[j]
      rows.push({
        left: del
          ? {
              lineNumber: del.oldLineNumber,
              content: del.content,
              type: "delete",
            }
          : undefined,
        right: add
          ? {
              lineNumber: add.newLineNumber,
              content: add.content,
              type: "add",
            }
          : undefined,
      })
    }
  }

  return rows
}

interface DiffViewerProps {
  patch: string
  filename: string
  mode?: "unified" | "split"
  comments?: InlineComment[]
}

export function DiffViewer({
  patch,
  mode = "unified",
  comments = [],
}: DiffViewerProps) {
  const unifiedLines = parseUnifiedDiff(patch)
  const splitRows = mode === "split" ? toSplitRows(unifiedLines) : []

  // Group comments by target line number
  const commentsByLine = new Map<number, InlineComment[]>()
  for (const c of comments) {
    if (c.line !== null) {
      const existing = commentsByLine.get(c.line) || []
      existing.push(c)
      commentsByLine.set(c.line, existing)
    }
  }

  if (!patch) {
    return (
      <div className="rounded-md border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        Binary file or patch unavailable for this file.
      </div>
    )
  }

  return (
    <div className="diff-viewer overflow-hidden rounded-md border border-border/70 bg-card font-mono text-xs shadow-xs">
      {mode === "unified" ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {unifiedLines.map((line, idx) => {
                if (line.type === "meta") {
                  return (
                    <tr
                      key={idx}
                      className="border-y border-border/50 bg-muted/60 text-muted-foreground select-none"
                    >
                      <td colSpan={3} className="px-3 py-1 font-mono text-[11px] font-semibold text-primary/70">
                        {line.content}
                      </td>
                    </tr>
                  )
                }

                const lineComments =
                  (line.newLineNumber && commentsByLine.get(line.newLineNumber)) ||
                  (line.oldLineNumber && commentsByLine.get(line.oldLineNumber)) ||
                  []

                const isAdd = line.type === "add"
                const isDelete = line.type === "delete"

                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={cn(
                        "group transition-colors",
                        isAdd && "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-500/15",
                        isDelete && "bg-rose-500/10 text-rose-950 dark:text-rose-100 hover:bg-rose-500/15",
                        !isAdd && !isDelete && "hover:bg-muted/40 text-foreground/90"
                      )}
                    >
                      <td
                        className={cn(
                          "w-12 border-r border-border/40 px-2 py-0.5 text-right font-mono text-[11px] select-none",
                          isDelete ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium" : "text-muted-foreground/60"
                        )}
                      >
                        {line.oldLineNumber || ""}
                      </td>
                      <td
                        className={cn(
                          "w-12 border-r border-border/40 px-2 py-0.5 text-right font-mono text-[11px] select-none",
                          isAdd ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground/60"
                        )}
                      >
                        {line.newLineNumber || ""}
                      </td>
                      <td className="relative px-3 py-0.5 whitespace-pre font-mono leading-relaxed overflow-x-auto">
                        <span
                          className={cn(
                            "inline-block w-4 font-semibold select-none",
                            isAdd && "text-emerald-600 dark:text-emerald-400",
                            isDelete && "text-rose-600 dark:text-rose-400",
                            !isAdd && !isDelete && "text-transparent"
                          )}
                        >
                          {isAdd ? "+" : isDelete ? "-" : " "}
                        </span>
                        <span>{line.content}</span>
                      </td>
                    </tr>

                    {lineComments.length > 0 && (
                      <tr>
                        <td colSpan={3} className="border-y border-border/60 bg-muted/30 p-3">
                          <div className="space-y-3 font-sans">
                            {lineComments.map((comment) => (
                              <InlineCommentCard key={comment.id} comment={comment} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Split view */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-border/60 bg-muted/60 font-medium text-muted-foreground">
                <th colSpan={2} className="w-1/2 px-3 py-1.5 text-left text-xs font-semibold">
                  Original
                </th>
                <th colSpan={2} className="w-1/2 border-l border-border/60 px-3 py-1.5 text-left text-xs font-semibold">
                  Modified
                </th>
              </tr>
            </thead>
            <tbody>
              {splitRows.map((row, idx) => {
                if (row.meta) {
                  return (
                    <tr
                      key={idx}
                      className="border-y border-border/50 bg-muted/60 text-muted-foreground select-none"
                    >
                      <td colSpan={4} className="px-3 py-1 font-mono text-[11px] font-semibold text-primary/70">
                        {row.meta}
                      </td>
                    </tr>
                  )
                }

                const left = row.left
                const right = row.right
                const leftComments = left?.lineNumber ? commentsByLine.get(left.lineNumber) || [] : []
                const rightComments = right?.lineNumber ? commentsByLine.get(right.lineNumber) || [] : []

                return (
                  <React.Fragment key={idx}>
                    <tr className="border-b border-border/20">
                      {/* Left side (Original / Deletion) */}
                      <td
                        className={cn(
                          "w-12 border-r border-border/40 px-2 py-0.5 text-right font-mono text-[11px] select-none",
                          left?.type === "delete"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium"
                            : "text-muted-foreground/60"
                        )}
                      >
                        {left?.lineNumber || ""}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-0.5 whitespace-pre font-mono leading-relaxed overflow-x-auto",
                          left?.type === "delete"
                            ? "bg-rose-500/10 text-rose-950 dark:text-rose-100"
                            : "text-foreground/90"
                        )}
                      >
                        {left?.content ?? ""}
                      </td>

                      {/* Right side (Modified / Addition) */}
                      <td
                        className={cn(
                          "w-12 border-l border-r border-border/40 px-2 py-0.5 text-right font-mono text-[11px] select-none",
                          right?.type === "add"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium"
                            : "text-muted-foreground/60"
                        )}
                      >
                        {right?.lineNumber || ""}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-0.5 whitespace-pre font-mono leading-relaxed overflow-x-auto",
                          right?.type === "add"
                            ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                            : "text-foreground/90"
                        )}
                      >
                        {right?.content ?? ""}
                      </td>
                    </tr>

                    {(leftComments.length > 0 || rightComments.length > 0) && (
                      <tr>
                        <td colSpan={4} className="border-y border-border/60 bg-muted/30 p-3 font-sans">
                          <div className="space-y-3">
                            {[...leftComments, ...rightComments].map((c) => (
                              <InlineCommentCard key={c.id} comment={c} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function InlineCommentCard({ comment }: { comment: InlineComment }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="size-6">
            <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
            <AvatarFallback>{comment.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-xs text-foreground">{comment.user.login}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
            Inline Comment
          </Badge>
          {comment.line && (
            <span className="text-[11px] text-muted-foreground">Line {comment.line}</span>
          )}
        </div>
        {comment.created_at && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <div className="pt-2 text-xs">
        <MarkdownView content={comment.body} />
      </div>
    </div>
  )
}
