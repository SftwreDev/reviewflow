import { redirect } from "next/navigation"

export default function PullRequestsPage() {
  redirect("/?tab=pulls")
}
