"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import type { PullRequestData, CheckRun } from "@/components/pull-requests/pr-header"
import type { ChangedFile } from "@/components/pull-requests/pr-files-view"
import type { ReviewData, IssueCommentData } from "@/components/pull-requests/pr-overview"
import type { InlineComment } from "@/components/pull-requests/diff-viewer"
import type { TokenUsage } from "@/lib/review-types"
import { toast } from "sonner"

export type Repo = { full_name: string; private: boolean; description: string | null }

export type Pull = {
  number: number
  title: string
  state: string
  draft: boolean
  merged_at: string | null
  html_url: string
  user: { login: string; avatar_url?: string }
  created_at: string
  updated_at: string
  head: { ref: string; sha: string }
  base: { ref: string }
  requested_reviewers: { login: string }[]
  labels?: { name: string; color: string }[]
  comments?: number
  review_comments?: number
  reviewDecision?: string | null
  commentedByMe?: boolean
}

export type RepoLabel = { name: string; color: string }

export interface PRDetailData {
  pr?: PullRequestData
  files?: ChangedFile[]
  reviews?: ReviewData[]
  comments?: IssueCommentData[]
  reviewComments?: InlineComment[]
  checks?: CheckRun[]
  error?: string
}

export type TabType = "dashboard" | "pulls" | "skills" | "settings"

interface AppContextType {
  repo: string
  repos: Repo[]
  user: string
  pulls: Pull[]
  repoLabels: RepoLabel[]
  reviewHistory: {
    number: number
    headSha: string
    createdAt: string
    tokenUsage?: TokenUsage
  }[]
  activeTab: TabType
  activePrId: number | null
  activePrData: PRDetailData | null
  isLoadingPulls: boolean
  isLoadingPr: boolean
  status: string
  statusType: "info" | "success" | "error"
  setActiveTab: (tab: TabType) => void
  openPr: (number: number, targetRepo?: string) => void
  closePr: () => void
  selectRepo: (repo: string) => Promise<void>
  refreshPulls: () => Promise<void>
  refreshActivePr: () => Promise<void>
  saveGithubToken: (token: string, action: string) => Promise<void>
  saveClaudeKey: (key: string, action: string) => Promise<void>
  saveClaudeModel: (model: string) => Promise<void>
  claudeModel: string
  claudeCodeAuth: boolean
  claudeModels: { value: string; displayName: string; description: string }[]
  claudeSkills: { name: string; description: string }[]
  refreshClaudeCapabilities: () => Promise<void>
  disconnectGithub: () => Promise<void>
  removeClaudeKey: () => Promise<void>
  clearStatus: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return ctx
}

export function AppProvider({
  children,
  initialPrId,
  initialRepo,
  initialTab,
}: {
  children: React.ReactNode
  initialPrId?: number | null
  initialRepo?: string
  initialTab?: TabType
}) {
  const [repo, setRepo] = useState(initialRepo || "")
  const [repos, setRepos] = useState<Repo[]>([])
  const [user, setUser] = useState("")
  const [pulls, setPulls] = useState<Pull[]>([])
  const [repoLabels, setRepoLabels] = useState<RepoLabel[]>([])
  const [reviewHistory, setReviewHistory] = useState<
    { number: number; headSha: string; createdAt: string; tokenUsage?: TokenUsage }[]
  >([])
  const [claudeModel, setClaudeModel] = useState("")
  const [claudeCodeAuth, setClaudeCodeAuth] = useState(false)
  const [claudeModels, setClaudeModels] = useState<
    { value: string; displayName: string; description: string }[]
  >([])
  const [claudeSkills, setClaudeSkills] = useState<{ name: string; description: string }[]>([])
  const [activeTab, setActiveTabState] = useState<TabType>(initialTab || "dashboard")
  const [activePrId, setActivePrId] = useState<number | null>(initialPrId ?? null)
  const [activePrData, setActivePrData] = useState<PRDetailData | null>(null)
  const [isLoadingPulls, setIsLoadingPulls] = useState(false)
  const [isLoadingPr, setIsLoadingPr] = useState(false)
  const [status, setStatus] = useState("")
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info")

  // Cache PR details in memory: key is `${repo}#${number}`
  const prCache = useRef<Map<string, PRDetailData>>(new Map())
  // Track previous pull counts to detect new comments/change requests
  const prevPullsRef = useRef<Pull[]>([])

  const clearStatus = useCallback(() => {
    setStatus("")
  }, [])

  const req = useCallback(async (url: string, body?: unknown) => {
    const r = await fetch(
      url,
      body
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}
    )
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || "Request failed")
    return d
  }, [])

  const loadPullsForRepo = useCallback(
    async (repoName: string) => {
      if (!repoName) return
      setIsLoadingPulls(true)
      try {
        const [d, l, r] = await Promise.all([
          req(`/api/github?repo=${encodeURIComponent(repoName)}`),
          req(`/api/github?repo=${encodeURIComponent(repoName)}&labels=1`),
          req(`/api/reviews?repo=${encodeURIComponent(repoName)}`),
        ])
        const newPulls = (d.pulls || []) as Pull[]
        const previous = prevPullsRef.current
        if (previous.length > 0) {
          for (const p of newPulls) {
            const old = previous.find((x) => x.number === p.number)
            if (!old) continue
            const oldComments = (old.comments ?? 0) + (old.review_comments ?? 0)
            const newComments = (p.comments ?? 0) + (p.review_comments ?? 0)
            if (newComments > oldComments) {
              toast.info(`PR #${p.number} has ${newComments - oldComments} new comment(s)`, {
                description: p.title,
              })
            }
          }
        }
        prevPullsRef.current = newPulls
        setPulls(newPulls)
        setRepoLabels(l.labels || [])
        setReviewHistory(r.reviews || [])
      } catch (e) {
        setStatus((e as Error).message)
        setStatusType("error")
      } finally {
        setIsLoadingPulls(false)
      }
    },
    [req]
  )

  const loadPrData = useCallback(
    async (prNumber: number, targetRepo: string, bypassCache = false) => {
      const cacheKey = `${targetRepo}#${prNumber}`
      if (!bypassCache && prCache.current.has(cacheKey)) {
        setActivePrData(prCache.current.get(cacheKey)!)
        setIsLoadingPr(false)
        return
      }

      setIsLoadingPr(true)
      try {
        const data = await req(
          `/api/github?repo=${encodeURIComponent(targetRepo)}&number=${prNumber}`
        )
        prCache.current.set(cacheKey, data)
        setActivePrData(data)
      } catch (e) {
        const errorMsg = (e as Error).message
        setActivePrData({ error: errorMsg })
        setStatus(errorMsg)
        setStatusType("error")
      } finally {
        setIsLoadingPr(false)
      }
    },
    [req]
  )

  // SPA navigation to PR detail
  const openPr = useCallback(
    (number: number, targetRepo?: string) => {
      const selectedRepo = targetRepo || repo
      setActivePrId(number)

      // Update URL without full page reload
      const newUrl = `/pull-requests/${number}?repo=${encodeURIComponent(selectedRepo)}`
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.pushState({ prId: number, repo: selectedRepo }, "", newUrl)
      }

      void loadPrData(number, selectedRepo)
    },
    [repo, loadPrData]
  )

  // Close PR detail and return to list
  const closePr = useCallback(() => {
    setActivePrId(null)
    setActivePrData(null)

    const newUrl = activeTab === "dashboard" ? "/" : `/?tab=${activeTab}`
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.pushState({ tab: activeTab }, "", newUrl)
    }
  }, [activeTab])

  // Switch tabs
  const setActiveTab = useCallback(
    (tab: TabType) => {
      setActiveTabState(tab)
      if (activePrId !== null) {
        setActivePrId(null)
        setActivePrData(null)
      }

      const newUrl = tab === "dashboard" ? "/" : `/?tab=${tab}`
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.pushState({ tab }, "", newUrl)
      }
    },
    [activePrId]
  )

  const selectRepo = useCallback(
    async (repoName: string) => {
      setRepo(repoName)
      try {
        await req("/api/settings", { action: "repo", repo: repoName })
        await loadPullsForRepo(repoName)
        setStatus(`Active repository set to ${repoName}`)
        setStatusType("success")
      } catch (e) {
        setStatus((e as Error).message)
        setStatusType("error")
      }
    },
    [req, loadPullsForRepo]
  )

  const refreshPulls = useCallback(async () => {
    if (repo) {
      await loadPullsForRepo(repo)
    }
  }, [repo, loadPullsForRepo])

  const refreshActivePr = useCallback(async () => {
    if (activePrId && repo) {
      await loadPrData(activePrId, repo, true)
    }
  }, [activePrId, repo, loadPrData])

  const saveGithubToken = useCallback(
    async (tokenVal: string, action: string) => {
      try {
        const d = await req("/api/github", { action, token: tokenVal })
        setUser(d.login)
        if (action === "save") {
          const rs = await req("/api/github?repos=1")
          setRepos(rs.repositories || [])
          if (repo) await loadPullsForRepo(repo)
        }
        setStatus(`GitHub connected as ${d.login}`)
        setStatusType("success")
      } catch (e) {
        setStatus((e as Error).message)
        setStatusType("error")
      }
    },
    [req, repo, loadPullsForRepo]
  )

  const saveClaudeKey = useCallback(
    async (keyVal: string, action: string) => {
      try {
        await req("/api/settings", { action, key: keyVal })
        setStatus(
          action === "claude-test" ? "Claude connection verified" : "Claude API key saved"
        )
        setStatusType("success")
      } catch (e) {
        setStatus((e as Error).message)
        setStatusType("error")
      }
    },
    [req]
  )

  const saveClaudeModel = useCallback(
    async (model: string) => {
      try {
        await req("/api/settings", { action: "claude-model", model })
        setClaudeModel(model)
        setStatus("Claude model saved")
        setStatusType("success")
      } catch (e) {
        setStatus((e as Error).message)
        setStatusType("error")
      }
    },
    [req]
  )

  const refreshClaudeCapabilities = useCallback(async () => {
    try {
      const d = await req("/api/claude?force=1")
      setClaudeModels(d.models || [])
      setClaudeSkills(d.skills || [])
      setClaudeCodeAuth(Boolean(d.auth?.device) || Boolean(d.auth?.configured))
      if (d.error) {
        setStatus(d.error)
        setStatusType("error")
      }
    } catch (e) {
      setStatus((e as Error).message)
      setStatusType("error")
    }
  }, [req])

  const disconnectGithub = useCallback(async () => {
    try {
      await req("/api/github", { action: "remove" })
      setUser("")
      setRepos([])
      setPulls([])
      setStatus("GitHub disconnected")
      setStatusType("info")
    } catch (e) {
      setStatus((e as Error).message)
      setStatusType("error")
    }
  }, [req])

  const removeClaudeKey = useCallback(async () => {
    try {
      await req("/api/settings", { action: "claude-remove" })
      setStatus("Claude key removed")
      setStatusType("info")
    } catch (e) {
      setStatus((e as Error).message)
      setStatusType("error")
    }
  }, [req])

  // Poll for PR updates to detect new comments/change requests
  useEffect(() => {
    if (!repo) return
    const interval = setInterval(() => {
      void loadPullsForRepo(repo)
    }, 60_000)
    return () => clearInterval(interval)
  }, [repo, loadPullsForRepo])

  // Initial load
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const s = await req("/api/settings")
        if (!mounted) return
        setClaudeModel(s.claudeModel || "")
        setClaudeCodeAuth(Boolean(s.claudeCodeAuth))
        const activeRepoName = initialRepo || s.repo
        if (activeRepoName) setRepo(activeRepoName)

        const g = await req("/api/github").catch(() => null)
        if (!mounted) return
        if (g?.user?.login) {
          setUser(g.user.login)
          const rs = await req("/api/github?repos=1").catch(() => ({ repositories: [] }))
          if (mounted) setRepos(rs.repositories || [])
        }

        if (activeRepoName) {
          void loadPullsForRepo(activeRepoName)
        }

        if (initialPrId && activeRepoName) {
          void loadPrData(initialPrId, activeRepoName)
        }

        void refreshClaudeCapabilities()
      } catch (e) {
        if (mounted) {
          setStatus((e as Error).message)
          setStatusType("error")
        }
      }
    }

    const timer = setTimeout(() => {
      void init()
    }, 0)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [initialPrId, initialRepo, loadPrData, loadPullsForRepo, req, refreshClaudeCapabilities])

  // Handle browser Back / Forward buttons (popstate)
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname
      const params = new URLSearchParams(window.location.search)
      const prMatch = path.match(/^\/pull-requests\/(\d+)$/)

      if (prMatch) {
        const id = parseInt(prMatch[1], 10)
        const targetRepo = params.get("repo") || repo
        setActivePrId(id)
        if (targetRepo) {
          void loadPrData(id, targetRepo)
        }
      } else {
        setActivePrId(null)
        setActivePrData(null)
        const tabParam = params.get("tab") as TabType | null
        if (tabParam) {
          setActiveTabState(tabParam)
        } else {
          setActiveTabState("dashboard")
        }
      }
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [repo, loadPrData])

  return (
    <AppContext.Provider
      value={{
        repo,
        repos,
        user,
        pulls,
        repoLabels,
        reviewHistory,
        activeTab,
        activePrId,
        activePrData,
        isLoadingPulls,
        isLoadingPr,
        status,
        statusType,
        setActiveTab,
        openPr,
        closePr,
        selectRepo,
        refreshPulls,
        refreshActivePr,
        saveGithubToken,
        saveClaudeKey,
        saveClaudeModel,
        claudeModel,
        claudeCodeAuth,
        claudeModels,
        claudeSkills,
        refreshClaudeCapabilities,
        disconnectGithub,
        removeClaudeKey,
        clearStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
