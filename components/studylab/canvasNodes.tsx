'use client'

import { useContext } from 'react'
import type { ComponentType } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { BookOpen, GitBranch, Layers, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import type { BlockType } from '@/lib/studylab/blocks'
import { CanvasContext, CardFrame, SafeLatex, handleClass } from './canvasShared'
import { RunnableCodeNode } from './RunnableCodeCard'

// Re-export so existing importers (StudyCanvas) keep working.
export { CanvasContext } from './canvasShared'

export function ConceptNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <CardFrame>
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-apple-blue/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-apple-blue" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300 space-y-2">
        {d.body && (
          <div className="whitespace-pre-wrap">
            <SafeLatex>{d.body}</SafeLatex>
          </div>
        )}
        {d.items && d.items.length > 0 && (
          <ul className="space-y-1.5 mt-1">
            {d.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-apple-blue shrink-0" />
                <span><SafeLatex>{item}</SafeLatex></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardFrame>
  )
}

export function DiagramNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <CardFrame accent="orange">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <GitBranch className="w-4 h-4 text-orange-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2 text-[13px] text-gray-600 dark:text-gray-300">
        {d.svg ? (
          <div
            className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: d.svg }}
          />
        ) : d.body ? (
          <div className="whitespace-pre-wrap"><SafeLatex>{d.body}</SafeLatex></div>
        ) : null}
      </div>
    </CardFrame>
  )
}

export function StepGroupNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onToggleGroup } = useContext(CanvasContext)
  const collapsed = d.collapsed !== false
  return (
    <button
      onClick={() => onToggleGroup(id)}
      className="w-[260px] text-left rounded-2xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-[#1c1c1e] border border-emerald-200 dark:border-emerald-800/50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] px-4 py-3.5 hover:border-emerald-400 transition-colors"
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] leading-tight truncate">{d.label}</p>
          <p className="text-[11px] text-apple-dark-gray flex items-center gap-1">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {d.cardIds?.length ?? 0} cards · {collapsed ? 'click to expand' : 'click to collapse'}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </button>
  )
}

export function ImageNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <CardFrame accent="violet">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4 text-violet-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title || 'My work'}</h3>
      </div>
      <div className="px-4 pb-4 pt-2">
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt={d.title || 'Student work'}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="h-24 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-apple-dark-gray text-xs">
            Image unavailable
          </div>
        )}
        {d.body && <p className="mt-2 text-[12px] text-gray-500"><SafeLatex>{d.body}</SafeLatex></p>}
      </div>
    </CardFrame>
  )
}

export const studyNodeTypes: Partial<Record<BlockType, ComponentType<NodeProps>>> = {
  concept: ConceptNode,
  code: RunnableCodeNode,
  diagram: DiagramNode,
  stepGroup: StepGroupNode,
  image: ImageNode,
}
