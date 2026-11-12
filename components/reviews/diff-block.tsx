import { cn } from "@/lib/utils"

export function DiffBlock({ diff, className }: { diff: string; className?: string }) {
  return (
    <pre className={cn("overflow-auto border-t border-border/50 bg-muted/20 p-0 font-mono text-[11px] leading-relaxed", className)}>
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre px-4",
            line.startsWith("+") && !line.startsWith("+++") && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            line.startsWith("-") && !line.startsWith("---") && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
            (line.startsWith("@@") || line.startsWith("diff --")) && "bg-primary/10 font-semibold text-primary"
          )}
        >
          {line || " "}
        </div>
      ))}
    </pre>
  )
}
