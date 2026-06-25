'use client'

import { type NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { ListOrdered, Table as TableIcon, BookMarked, Lightbulb, AlertTriangle } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame, SafeLatex, handleClass } from './canvasShared'

export function WorkedNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const steps = Array.isArray(d.steps) ? d.steps : []
  return (
    <CardFrame>
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-apple-blue/10 flex items-center justify-center shrink-0">
          <ListOrdered className="w-4 h-4 text-apple-blue" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2 text-[13px] text-gray-600 dark:text-gray-300">
        {steps.length > 0 ? (
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-apple-blue/10 text-apple-blue text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
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
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-apple-blue/10 flex items-center justify-center shrink-0">
          <TableIcon className="w-4 h-4 text-apple-blue" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-[12px] text-gray-400">No data.</p>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            {head && (
              <thead>
                <tr>
                  {head.map((c, i) => (
                    <th key={i} className="border border-gray-200 dark:border-gray-700 px-2 py-1 text-left font-semibold bg-gray-50 dark:bg-white/5">
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
                    <td key={ci} className="border border-gray-200 dark:border-gray-700 px-2 py-1">
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
        <span className={`text-[10px] font-bold uppercase tracking-wide ${s.color}`}>{d.title ?? s.label}</span>
      </div>
      <div className="text-[13px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
        <SafeLatex>{d.body}</SafeLatex>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
