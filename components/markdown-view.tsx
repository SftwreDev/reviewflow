"use client"

import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarkdownViewProps {
  content: string
  className?: string
}

function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentProps<"code"> & { inline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || "")
  const isInline = !match && !String(children).includes("\n")

  if (isInline) {
    return (
      <code
        className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground border border-border/60"
        {...props}
      >
        {children}
      </code>
    )
  }

  const codeString = String(children).replace(/\n$/, "")
  const lang = match ? match[1] : ""

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="relative my-3 rounded-lg border border-border/70 bg-muted/40 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3 leading-relaxed">
        <pre className="m-0 font-mono text-xs text-foreground/90">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  )
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content || !content.trim()) {
    return <span className="text-sm italic text-muted-foreground">No content</span>
  }

  return (
    <div className={cn("markdown-content text-sm text-foreground/90 break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-3 text-lg font-bold tracking-tight text-foreground border-b border-border/60 pb-1.5 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-base font-semibold tracking-tight text-foreground border-b border-border/40 pb-1 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2.5 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2 text-sm leading-relaxed text-foreground/90 first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 ml-5 list-disc space-y-1 text-sm leading-relaxed text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 ml-5 list-decimal space-y-1 text-sm leading-relaxed text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed marker:text-muted-foreground">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-3 border-primary/50 bg-muted/30 py-1 pl-3 pr-2 text-sm italic text-muted-foreground rounded-r">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-t border-border/60" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border/60 bg-muted/60">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/40">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-foreground/90 align-top">{children}</td>
          ),
          a: ({ href, children }) => {
            const isExternal = href?.startsWith("http://") || href?.startsWith("https://")
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer noopener" : undefined}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-baseline gap-0.5 transition-colors"
              >
                <span>{children}</span>
                {isExternal && <ExternalLink className="size-3 inline self-center opacity-70" />}
              </a>
            )
          },
          code: ({ className, children, ...props }: React.ComponentProps<"code">) => (
            <CodeBlock className={className} {...props}>
              {children}
            </CodeBlock>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
