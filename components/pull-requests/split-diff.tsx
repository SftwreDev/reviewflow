"use client"
import { useRef } from "react"
import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"
type Row = { left: string; right: string; leftNo?: number; rightNo?: number; kind: "context" | "delete" | "add" | "meta" }
function rowsFromPatch(patch: string): Row[] {
  const rows: Row[] = []
  let oldNo = 0, newNo = 0
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -(\d+)/)
    if (hunk) { oldNo = Number(hunk[1]); newNo = Number(line.match(/\+(\d+)/)?.[1] || 0); rows.push({ left: line, right: line, kind: "meta" }); continue }
    if (line.startsWith("\\ No newline")) continue
    if (line.startsWith("-")) rows.push({ left: line.slice(1), right: "", leftNo: oldNo++, kind: "delete" })
    else if (line.startsWith("+")) rows.push({ left: "", right: line.slice(1), rightNo: newNo++, kind: "add" })
    else if (line.startsWith(" ")) rows.push({ left: line.slice(1), right: line.slice(1), leftNo: oldNo++, rightNo: newNo++, kind: "context" })
  }
  const paired: Row[] = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== "delete") { paired.push(rows[i]); continue }
    const deletes: Row[] = [], adds: Row[] = []
    while (i < rows.length && rows[i].kind === "delete") deletes.push(rows[i++])
    while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++])
    i--
    for (let j = 0; j < Math.max(deletes.length, adds.length); j++) paired.push({ left: deletes[j]?.left || "", leftNo: deletes[j]?.leftNo, right: adds[j]?.right || "", rightNo: adds[j]?.rightNo, kind: deletes[j] ? "delete" : "add" })
  }
  return paired
}
export function SplitDiff({ patch, filename }: { patch: string; filename: string }) {
  const rows = rowsFromPatch(patch), language = filename.split(".").pop() || "text"
  const left = useRef<HTMLDivElement>(null), right = useRef<HTMLDivElement>(null)
  const sync = (source: "left" | "right") => {
    const from = source === "left" ? left.current : right.current
    const to = source === "left" ? right.current : left.current
    if (from && to && Math.abs(to.scrollTop - from.scrollTop) > 1) to.scrollTop = from.scrollTop
  }
  const pane = (side: "left" | "right") => <div ref={side === "left" ? left : right} onScroll={() => sync(side)} className="max-h-[70vh] min-w-0 overflow-auto overscroll-contain font-mono text-xs">{rows.map((row,index)=>row.kind==="meta"?<div key={index} className="sticky left-0 bg-muted px-3 py-1 text-muted-foreground">{row.left}</div>:<div key={index} className={`grid grid-cols-[3rem_minmax(0,1fr)] ${row.kind==="delete"&&side==="left"?"bg-red-500/15":""} ${row.kind==="add"&&side==="right"?"bg-green-500/15":""}`}><span className="select-none px-2 text-right text-muted-foreground">{side==="left"?row.leftNo:row.rightNo}</span><SyntaxHighlighter language={language} style={atomOneDark} PreTag="span" CodeTag="span" customStyle={{margin:0,padding:"2px 8px",background:"transparent",fontSize:"inherit",whiteSpace:"pre",minHeight:"1.5em"}}>{side==="left"?row.left:row.right}</SyntaxHighlighter></div>)}</div>
  return <div className="mt-2 overflow-hidden rounded-md border text-xs"><div className="grid grid-cols-2 border-b bg-muted font-medium"><div className="px-3 py-2">Before</div><div className="border-l px-3 py-2">After</div></div><div className="grid grid-cols-2 divide-x">{pane("left")}{pane("right")}</div></div>
}
