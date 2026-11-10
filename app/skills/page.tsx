import { Suspense } from "react"
import { AppProvider } from "@/lib/app-context"
import { AppShell } from "@/components/app-shell"
import { SpaView } from "@/components/spa-view"
import { LoaderCircle } from "lucide-react"

export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AppProvider initialTab="skills">
        <AppShell>
          <SpaView />
        </AppShell>
      </AppProvider>
    </Suspense>
  )
}
