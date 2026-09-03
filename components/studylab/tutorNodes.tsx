'use client'

import { type NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { ListOrdered, Table as TableIcon, BookMarked, Lightbulb, AlertTriangle } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame, NodeHeader, SafeLatex, handleClass } from './canvasShared'
import { splitMarkdownTable } from '@/lib/studylab/markdownTable'

export function WorkedNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const steps = Array.isArray(d.steps) ? d.steps : []
  return (
    <CardFrame>
      <NodeHeader icon={ListOrdered} title={d.title} tone="green" />
      <div className="px-4 pb-4 pt-2 text-[13px] text-ss-slate">
        {steps.length > 0 ? (
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[color:var(--ss-good)]/15 text-ss-good text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="pt-0.5"><SafeLatex>{s}</SafeLatex></span>
              </li>
            ))}
          </ol>
        ) : d.body ? (
          <div className="whitespace-pre-wrap"><SafeLatex>{d.body}</SafeLatex></div>
        ) : null}
      </div>
    </CardFrame>
  )
}

export function TableNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const rows = (Array.isArray(d.rows) ? d.rows : []).filter((r) => Array.isArray(r))
  const [head, ...body] = rows
  return (
    <CardFrame>
      <NodeHeader icon={TableIcon} title={d.title} tone="cyan" />
      <div className="px-4 pb-4 pt-2 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-[12px] text-ss-slate">No data.</p>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            {head && (
              <thead>
                <tr>
                  {head.map((c, i) => (
                    <th key={i} className="border border-ss-line px-2 py-1 text-left font-semibold bg-ss-chip">
                      <SafeLatex>{c}</SafeLatex>
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-ss-line px-2 py-1">
                      <SafeLatex>{c}</SafeLatex>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </CardFrame>
  )
}

const CALLOUT_STYLES = {
  definition: { ring: 'border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-900/10', icon: BookMarked, color: 'text-indigo-500', label: 'Definition' },
  tip: { ring: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10', icon: Lightbulb, color: 'text-emerald-500', label: 'Tip' },
  warning: { ring: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10', icon: AlertTriangle, color: 'text-amber-500', label: 'Watch out' },
} as const

export function CalloutNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const variant = d.variant ?? 'definition'
  const s = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.definition
  const Icon = s.icon
  return (
    <div className={`sl-node-enter w-[280px] rounded-2xl border shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] p-3.5 ${s.ring}`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${s.color}`} />
        <span className={`text-[12px] font-bold uppercase tracking-wide ${s.color}`}>{d.title ?? s.label}</span>
      </div>
      <div className="text-[13px] text-ss-ink whitespace-pre-wrap">
        <SafeLatex>{d.body}</SafeLatex>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

/**
 * The question the learner was set, on the board beside their working.
 *
 * Deliberately unlike every other card. The rest of the board is the tutor's
 * writing; this is a transcription of the student's own sheet, and the whole
 * step hangs off it — so it reads as a quotation, not as an explanation: a rule
 * down the side, the printed number as its label, and no icon chip pretending
 * it is another kind of teaching.
 */
/**
 * A question's text, with any table in it rendered as a table.
 *
 * The pump question is a sentence and then four rows of costs and lifetimes,
 * and that table IS the question — as a run of markdown pipes it was the least
 * readable thing on the board, in the one card the learner has to read most
 * carefully.
 */
function QuestionBody({ text }: { text: string }) {
  const split = splitMarkdownTable(text)
  if (!split) {
    return (
      <div className="mt-1 whitespace-pre-wrap text-[13.5px] font-medium leading-relaxed text-ss-ink">
        <SafeLatex>{text}</SafeLatex>
      </div>
    )
  }
  const [head, ...body] = split.rows
  return (
    <div className="mt-1 space-y-2 text-[13.5px] font-medium leading-relaxed text-ss-ink">
      {split.before && (
        <div className="whitespace-pre-wrap">
          <SafeLatex>{split.before}</SafeLatex>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border border-ss-line bg-ss-chip px-2 py-1 text-left font-semibold">
                  <SafeLatex>{c}</SafeLatex>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="border border-ss-line px-2 py-1 tabular-nums">
                    <SafeLatex>{c}</SafeLatex>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {split.after && (
        <div className="whitespace-pre-wrap">
          <SafeLatex>{split.after}</SafeLatex>
        </div>
      )}
    </div>
  )
}

export function QuestionNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <div className="sl-node-enter w-[380px] rounded-2xl border border-ss-line bg-ss-panel shadow-sm">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex gap-3 px-4 py-3.5">
        <span aria-hidden className="w-1 shrink-0 rounded-full bg-ss-accent" />
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-accent">
            {d.title ?? 'Question'}
          </p>
          <QuestionBody text={d.body ?? ''} />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
