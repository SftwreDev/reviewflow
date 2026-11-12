export type NotificationKind =
  | "pr_opened"
  | "pr_comments"
  | "changes_requested"
  | "review_completed"
  | "feedback_addressed"
  | "pr_stale"

export type AppNotification = {
  id: string
  key: string
  repo: string
  number: number
  kind: NotificationKind
  title: string
  detail: string
  createdAt: string
  readAt: string | null
}

export type NotificationInput = {
  key: string
  repo: string
  number: number
  kind: NotificationKind
  title?: string
  detail: string
}

export const NOTIFICATIONS_CHANGED_EVENT = "reviewflow:notifications-changed"

/** Lets the header refresh immediately once a run or push for this tab completes. */
export function announceNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  }
}
