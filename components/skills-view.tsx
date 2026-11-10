"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MarkdownView } from "@/components/markdown-view"
import {
  Sparkles,
  Trash2,
  Pencil,
  Plus,
  LoaderCircle,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react"

export type Skill = { name: string; description: string; content: string }

export function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Skill | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newContent, setNewContent] = useState("")
  const [viewing, setViewing] = useState<string | null>(null)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/skills")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load skills")
      setSkills(data.skills || [])
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

  async function save(name: string, content: string) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", name, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save skill")
      setEditing(null)
      setCreating(false)
      setNewName("")
      setNewContent("")
      await loadSkills()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save skill")
    } finally {
      setBusy(false)
    }
  }

  async function remove(name: string) {
    if (!confirm(`Are you sure you want to delete skill "${name}"?`)) return
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
      await loadSkills()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete skill")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Skills Directory</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage custom instructions in <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">.claude/skills</code>.
            Skills are referenced by the review agent during analysis.
          </p>
        </div>

        <Button
          onClick={() => setCreating(true)}
          size="sm"
          className="gap-1.5 text-xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Skill</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {creating && (
        <Card className="border-border/70 shadow-xs overflow-hidden">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">Create New Skill</h3>
            <Input
              placeholder="Skill name (e.g. security-audit, django-rules)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs font-mono"
            />
            <Textarea
              placeholder="SKILL.md content with instructions, examples, or rules..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-40 font-mono text-xs leading-relaxed"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void save(newName, newContent)}
                disabled={busy || !newName.trim() || !newContent.trim()}
                className="gap-1.5 text-xs cursor-pointer"
              >
                {busy && <LoaderCircle className="size-3.5 animate-spin" />}
                <span>Save Skill</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreating(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-xs gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          <span>Loading skills directory...</span>
        </div>
      ) : (
        <div className="grid gap-3">
          {skills.map((skill) => (
            <Card
              key={skill.name}
              className="border-border/70 shadow-xs overflow-hidden hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {skill.name}
                      </span>
                      {skill.description && (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0">
                          {skill.description}
                        </Badge>
                      )}
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {skill.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewing(viewing === skill.name ? null : skill.name)}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      title={viewing === skill.name ? "Hide content" : "View content"}
                    >
                      {viewing === skill.name ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(skill)}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Edit skill"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => void remove(skill.name)}
                      title="Delete skill"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {editing?.name === skill.name && (
                  <div className="pt-2 space-y-3 border-t border-border/50">
                    <Textarea
                      value={editing.content}
                      onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                      className="min-h-40 font-mono text-xs leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void save(editing.name, editing.content)}
                        disabled={busy}
                        className="gap-1.5 text-xs cursor-pointer"
                      >
                        {busy && <LoaderCircle className="size-3.5 animate-spin" />}
                        <span>Save Changes</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(null)}
                        className="text-xs cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {viewing === skill.name && (
                  <div className="pt-3 border-t border-border/50">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <MarkdownView content={skill.content} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {skills.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-12 text-center space-y-2">
              <Sparkles className="mx-auto size-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">No skills found</p>
              <p className="text-xs text-muted-foreground">
                Create a skill to provide specialized instructions during automated code reviews.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
