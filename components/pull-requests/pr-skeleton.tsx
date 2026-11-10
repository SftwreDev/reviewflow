import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function PRDetailSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Skeleton */}
      <div className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <span className="text-muted-foreground/40">/</span>
            <Skeleton className="h-4 w-32 rounded" />
            <span className="text-muted-foreground/40">/</span>
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-2/3 max-w-xl rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-border/50">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      </div>

      {/* 2. Tabs Skeleton */}
      <div className="border-b border-border/70 pb-px">
        <div className="flex gap-4">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* 3. Content Card Skeleton */}
      <Card className="overflow-hidden border-border/70 shadow-xs">
        <CardHeader className="bg-muted/30 border-b border-border/50 py-3.5 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            </div>
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/6 rounded" />
          <div className="pt-2">
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
