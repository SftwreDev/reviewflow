"use client"

import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy, ExternalLink, Hash } from "lucide-react"
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
        className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[0.88em] font-medium text-foreground border border-border/60"
        {...props}
      >
        {children}
      </code>
    )
  }

  const codeString = String(children).replace(/\n$/, "")
  const lang = match ? match[1] : ""
  const lines = codeString.split("\n")

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
    <div className="relative my-3 rounded-xl border border-border/70 bg-muted/40 font-mono text-xs overflow-hidden shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/70 px-3.5 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-rose-500/40" />
            <span className="size-2 rounded-full bg-amber-500/40" />
            <span className="size-2 rounded-full bg-emerald-500/40" />
          </div>
          <span className="font-semibold uppercase tracking-wider text-[10px] text-foreground/80 font-mono">
            {lang || "code"}
          </span>
          {lines.length > 1 && (
            <span className="text-[10px] text-muted-foreground/60 font-sans">
              • {lines.length} lines
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-500 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 leading-relaxed bg-background/50">
        <pre className="m-0 font-mono text-xs text-foreground/90 leading-relaxed">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content || !content.trim()) {
    return <span className="text-sm italic text-muted-foreground">No content</span>
  }

  return (
    <div className={cn("markdown-content text-sm text-foreground/90 break-words leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const text = String(children)
            const id = slugify(text)
            return (
              <h1
                id={id}
                className="mt-6 mb-3 text-xl font-bold tracking-tight text-foreground border-b border-border/70 pb-2 first:mt-0 scroll-mt-6"
              >
                {children}
              </h1>
            )
          },
          h2: ({ children }) => {
            const text = String(children)
            const id = slugify(text)
            return (
              <h2
                id={id}
                className="mt-6 mb-2.5 text-base font-bold tracking-tight text-foreground border-b border-border/40 pb-1.5 first:mt-0 scroll-mt-6 flex items-center gap-2 group"
              >
                <span>{children}</span>
                <a
                  href={`#${id}`}
                  className="opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground hover:text-foreground"
                  aria-label="Link to section"
                >
                  <Hash className="size-3.5" />
                </a>
              </h2>
            )
          },
          h3: ({ children }) => {
            const text = String(children)
            const id = slugify(text)
            return (
              <h3
                id={id}
                className="mt-4 mb-2 text-sm font-semibold text-foreground first:mt-0 scroll-mt-6"
              >
                {children}
              </h3>
            )
          },
          h4: ({ children }) => (
            <h4 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2.5 text-sm leading-relaxed text-foreground/90 first:mt-0 last:mb-0">
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
            <blockquote className="my-3.5 border-l-4 border-primary/60 bg-muted/30 py-2.5 pl-4 pr-3 text-xs leading-relaxed text-foreground/90 rounded-r-lg shadow-2xs">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-t border-border/60" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-border/70 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border/70 bg-muted/70 text-foreground font-semibold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/40 bg-card/40">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-foreground text-xs">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 text-foreground/90 align-top leading-relaxed">{children}</td>
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
