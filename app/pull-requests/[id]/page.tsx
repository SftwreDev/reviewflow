import { Suspense } from "react"
import { AppProvider } from "@/lib/app-context"
import { AppShell } from "@/components/app-shell"
import { SpaView } from "@/components/spa-view"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { LoaderCircle } from "lucide-react"

async function getSavedRepo(): Promise<string> {
  try {
    const dir = path.join(process.env.HOME || ".", ".reviewflow")
    return (await readFile(path.join(dir, "repo"), "utf8")).trim()
  } catch {
    return ""
  }
}

export default async function PullDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ repo?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  let repo = sp.repo || ""

  if (!repo) {
    repo = await getSavedRepo()
  }

  const parsedId = parseInt(id, 10)

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AppProvider initialPrId={Number.isNaN(parsedId) ? null : parsedId} initialRepo={repo}>
        <AppShell>
          <SpaView />
        </AppShell>
      </AppProvider>
    </Suspense>
  )
}
