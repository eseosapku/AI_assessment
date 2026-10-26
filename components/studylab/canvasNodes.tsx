'use client'

import { useContext } from 'react'
import type { ComponentType } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { BookOpen, GitBranch, Check, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import type { BlockType } from '@/lib/studylab/blocks'
import { CanvasContext, CardFrame, NodeHeader, SafeLatex, handleClass } from './canvasShared'
import { StepRegionNode } from './StepRegionNode'
import { PracticeNode } from './PracticeNode'
import { RunnableCodeNode } from './RunnableCodeCard'
import { WebSandboxNode } from './WebSandboxCard'
import { StickyNode, NoteNode, ChecklistNode, FlashcardNode, PhotoNode, FrameNode, ResourceBoardNode } from './freeformNodes'
import { QuizNode, CheckpointHeaderNode } from './QuizNode'
import { WorkedNode, TableNode, CalloutNode, QuestionNode } from './tutorNodes'
import { MermaidNode } from './MermaidNode'
import { ActivityNode } from './activities/ActivityNode'
import { MaterialBoardNode } from './material/MaterialBoardNode'

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

/**
 * A finished station, folded down to one tile on the board's path: ticked in
 * the lesson's colour, and opening back up to its cards when tapped.
 */
export function StepGroupNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onToggleGroup } = useContext(CanvasContext)
  const collapsed = d.collapsed !== false
  const count = d.cardIds?.length ?? 0
  return (
    <button
      onClick={() => onToggleGroup(id)}
      className="sl-node-enter ss-press w-[260px] rounded-2xl border-2 px-4 py-3.5 text-left shadow-[0_10px_30px_-14px_rgba(20,60,90,0.35)] transition-colors"
      style={{ borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' }}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
        >
          <Check className="h-4.5 w-4.5" strokeWidth={3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ss-subject-ink">
            Station{typeof d.step === 'number' ? ` ${d.step}` : ''}
          </p>
          <p className="truncate text-[14px] font-bold leading-tight text-ss-ink">{d.label}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-ss-slate">
            {collapsed ? <ChevronRight className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
            {count} {count === 1 ? 'card' : 'cards'} · {collapsed ? 'open it' : 'fold it'}
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
  activity: ActivityNode,
  material: MaterialBoardNode,
  checkpointHeader: CheckpointHeaderNode,
  worked: WorkedNode,
  table: TableNode,
  callout: CalloutNode,
  mermaid: MermaidNode,
  web: WebSandboxNode,
  question: QuestionNode,
}
