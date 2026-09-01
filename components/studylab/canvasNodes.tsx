'use client'

import { useContext } from 'react'
import type { ComponentType } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { BookOpen, GitBranch, Layers, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import type { BlockType } from '@/lib/studylab/blocks'
import { CanvasContext, CardFrame, NodeHeader, SafeLatex, handleClass } from './canvasShared'
import { StepRegionNode } from './StepRegionNode'
import { PracticeNode } from './PracticeNode'
import { RunnableCodeNode } from './RunnableCodeCard'
import { WebSandboxNode } from './WebSandboxCard'
import { StickyNode, NoteNode, ChecklistNode, FlashcardNode, PhotoNode, FrameNode, ResourceBoardNode } from './freeformNodes'
import { QuizNode, CheckpointHeaderNode } from './QuizNode'
import { WorkedNode, TableNode, CalloutNode } from './tutorNodes'
import { MermaidNode } from './MermaidNode'

// Re-export so existing importers (StudyCanvas) keep working.
export { CanvasContext } from './canvasShared'

export function ConceptNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <CardFrame>
      <NodeHeader icon={BookOpen} title={d.title} tone="cyan" />
      <div className="px-4 pb-4 pt-2 text-[13px] leading-relaxed text-ss-slate space-y-2">
        {d.body && (
          <div className="whitespace-pre-wrap">
            <SafeLatex>{d.body}</SafeLatex>
          </div>
        )}
        {d.items && d.items.length > 0 && (
          <ul className="space-y-1.5 mt-1">
            {d.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ss-accent shrink-0" />
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
      <NodeHeader icon={GitBranch} title={d.title} tone="amber" />
      <div className="px-4 pb-4 pt-2 text-[13px] text-ss-slate">
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
          <p className="text-[12px] text-ss-slate flex items-center gap-1">
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
      <NodeHeader icon={ImageIcon} title={d.title || 'My work'} tone="violet" />
      <div className="px-4 pb-4 pt-2">
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt={d.title || 'Student work'}
            className="w-full rounded-xl border border-ss-line"
          />
        ) : (
          <div className="h-24 rounded-xl bg-ss-chip flex items-center justify-center text-ss-slate text-xs">
            Image unavailable
          </div>
        )}
        {d.body && <p className="mt-2 text-[12px] text-ss-slate"><SafeLatex>{d.body}</SafeLatex></p>}
      </div>
    </CardFrame>
  )
}

export const studyNodeTypes: Partial<Record<BlockType, ComponentType<NodeProps>>> = {
  concept: ConceptNode,
  practice: PracticeNode,
  // Derived at render time, never stored — see lib/studylab/stepRegions.
  stepRegion: StepRegionNode,
  code: RunnableCodeNode,
  diagram: DiagramNode,
  stepGroup: StepGroupNode,
  image: ImageNode,
  sticky: StickyNode,
  note: NoteNode,
  checklist: ChecklistNode,
  scratchpad: RunnableCodeNode,
  flashcard: FlashcardNode,
  photo: PhotoNode,
  frame: FrameNode,
  resources: ResourceBoardNode,
  quiz: QuizNode,
  checkpointHeader: CheckpointHeaderNode,
  worked: WorkedNode,
  table: TableNode,
  callout: CalloutNode,
  mermaid: MermaidNode,
  web: WebSandboxNode,
}
