import { Suspense } from "react"
import { AppProvider } from "@/lib/app-context"
import { AppShell } from "@/components/app-shell"
import { SpaView } from "@/components/spa-view"
import { LoaderCircle } from "lucide-react"

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; settings?: string }>
}) {
  const sp = searchParams ? await searchParams : {}
  const initialTab =
    (sp?.tab as "dashboard" | "pulls" | "settings") || (sp?.settings ? "settings" : "dashboard")

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AppProvider initialTab={initialTab}>
        <AppShell>
          <SpaView />
        </AppShell>
      </AppProvider>
    </Suspense>
  )
}
