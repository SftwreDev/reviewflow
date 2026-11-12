"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCheck,
  Clock,
  GitPullRequest,
  MessageSquare,
  Wrench,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/app-context"
import {
  NOTIFICATIONS_CHANGED_EVENT,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notification-types"
import { cn } from "@/lib/utils"

const KIND_STYLES: Record<
  NotificationKind,
  { icon: LucideIcon; label: string; className: string }
> = {
  pr_opened: {
    icon: GitPullRequest,
    label: "New pull request",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pr_comments: {
    icon: MessageSquare,
    label: "New comments",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  changes_requested: {
    icon: AlertTriangle,
    label: "Changes requested",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  review_completed: {
    icon: Bot,
    label: "Agent review finished",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  feedback_addressed: {
    icon: Wrench,
    label: "Feedback addressed",
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  pr_stale: {
    icon: Clock,
    label: "Stale pull request",
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
}

const SOUND_STORAGE_KEY = "reviewflow:notification-sound"
const soundListeners = new Set<() => void>()

function subscribeSound(callback: () => void) {
  soundListeners.add(callback)
  return () => {
    soundListeners.delete(callback)
  }
}

function getSoundSnapshot() {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

function getSoundServerSnapshot() {
  return true
}

function relativeTime(iso: string) {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return ""
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function NotificationsPanel() {
  const { repo, openPr } = useApp()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const soundEnabled = useSyncExternalStore(
    subscribeSound,
    getSoundSnapshot,
    getSoundServerSnapshot
  )
  const audioContextRef = useRef<AudioContext | null>(null)
  const knownNotifications = useRef<{ repo: string; ids: Set<string> } | null>(null)

  const playBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) return
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context
      if (context.state === "suspended") void context.resume()

      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, now)
      oscillator.frequency.setValueAtTime(660, now + 0.12)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
      oscillator.start(now)
      oscillator.stop(now + 0.34)
    } catch {
      // Audio is optional.
    }
  }, [])

  const load = useCallback(async () => {
    if (!repo) return
    setLoading(true)
    try {
      const response = await fetch(
        `/api/notifications?repo=${encodeURIComponent(repo)}`,
        {
          cache: "no-store",
        }
      )
      const data = (await response.json().catch(() => ({}))) as {
        notifications?: AppNotification[]
        error?: string
      }
      if (!response.ok)
        throw new Error(data.error || `Request failed with ${response.status}`)
      const list = data.notifications ?? []
      const known = knownNotifications.current
      if (known && known.repo === repo) {
        const fresh = list.some(
          (notification) => !notification.readAt && !known.ids.has(notification.id)
        )
        if (fresh && getSoundSnapshot()) playBeep()
      }
      knownNotifications.current = {
        repo,
        ids: new Set(list.map((notification) => notification.id)),
      }
      setNotifications(list)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications")
    } finally {
      setLoading(false)
    }
  }, [repo, playBeep])

  useEffect(() => {
    if (!repo) return
    const timer = setTimeout(() => void load(), 0)
    const interval = setInterval(() => {
      if (!document.hidden) void load()
    }, 60_000)
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
    }
  }, [repo, load])

  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    return () =>
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
  }, [load])

  useEffect(() => {
    const unlock = () => {
      try {
        const AudioContextClass = window.AudioContext
        if (!AudioContextClass) return
        const context = audioContextRef.current ?? new AudioContextClass()
        audioContextRef.current = context
        if (context.state === "suspended") void context.resume()
        // iOS/Safari only unlock audio that actually starts inside a gesture.
        const buffer = context.createBuffer(1, 1, 22_050)
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.start(0)
      } catch {
        // Audio is optional.
      }
    }
    window.addEventListener("pointerdown", unlock, { once: true, capture: true })
    window.addEventListener("keydown", unlock, { once: true, capture: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const toggleSound = () => {
    const next = !getSoundSnapshot()
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off")
    } catch {
      // Preference persistence is optional.
    }
    for (const listener of soundListeners) listener()
    if (next) playBeep()
  }

  const visible = notifications.filter(
    (notification) => notification.repo === repo
  )
  const unread = visible.filter((notification) => !notification.readAt).length

  async function post(action: "read" | "read-all", ids?: string[]) {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, repo, ids }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      throw new Error(data.error || "Could not update notifications")
    }
  }

  async function markAllRead() {
    if (unread === 0) return
    const readAt = new Date().toISOString()
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.readAt || notification.repo !== repo
          ? notification
          : { ...notification, readAt }
      )
    )
    try {
      await post("read-all")
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update notifications"
      )
      void load()
    }
  }

  function openNotification(notification: AppNotification) {
    setOpen(false)
    if (!notification.readAt) {
      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item
        )
      )
      void post("read", [notification.id]).catch(() => void load())
    }
    openPr(notification.number, notification.repo)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
    >
      <PopoverTrigger
        className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={
          unread > 0 ? `${unread} unread notifications` : "Notifications"
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-4 font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(400px,calc(100vw-2rem))] p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={toggleSound}
              aria-label={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
              title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
              className="h-6 w-6 p-0"
            >
              {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="gap-1 text-[11px]"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          </div>
        </div>

        <div className="max-h-[min(70vh,420px)] overflow-y-auto p-1.5">
          {loading && visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              Loading...
            </p>
          ) : visible.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Bell className="mx-auto mb-2 size-6 text-muted-foreground/40" />
              <p className="text-xs font-medium text-foreground">
                No notifications yet
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {repo
                  ? "New PRs, review activity, and finished agent runs appear here."
                  : "Select a repository to see notifications."}
              </p>
            </div>
          ) : (
            visible.map((notification) => {
              const style = KIND_STYLES[notification.kind]
              const Icon = style.icon
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                    !notification.readAt && "bg-primary/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                      style.className
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs",
                          notification.readAt
                            ? "font-medium text-foreground/80"
                            : "font-semibold text-foreground"
                        )}
                      >
                        {style.label}
                      </span>
                      {!notification.readAt && (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      #{notification.number}
                      {notification.title ? ` · ${notification.title}` : ""}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {notification.detail}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground/70">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>

        {error && (
          <p className="border-t border-border/60 px-3 py-2 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
