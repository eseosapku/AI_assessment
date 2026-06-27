'use client'

import { createContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import Latex from 'react-latex-next'
import type { LucideIcon } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'

// Shared canvas primitives used by both the static node renderers (canvasNodes)
// and the interactive RunnableCodeCard. Lives in its own module so those two
// files don't form an import cycle.

export interface CanvasCallbacks {
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
  onDeleteNode: (id: string) => void
  onAskTutor: (id: string) => void
  onNodeResize: (id: string, dims: { x: number; y: number; width: number; height: number }) => void
}

export const CanvasContext = createContext<CanvasCallbacks>({
  onToggleGroup: () => {},
  onNodeDataChange: () => {},
  onDeleteNode: () => {},
  onAskTutor: () => {},
  onNodeResize: () => {},
})

// Render markdown emphasis: **bold** and *key term* (highlighted). Input is HTML-
// escaped first, then only our own tags are added — no injection surface.
function mdEmphasis(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<strong class="text-ss-accent">$1</strong>')
}

// Renders model card text: $…$ segments as KaTeX math, the rest as markdown
// emphasis. Coerces non-strings (the model occasionally sends a number/object).
export function SafeLatex({ children }: { children?: unknown }) {
  if (children == null) return null
  const text = typeof children === 'string' ? children : String(children)
  if (!text) return null
  const parts = text.split(/(\$[^$]+\$)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) {
          try {
            return <Latex key={i}>{p}</Latex>
          } catch {
            return <span key={i}>{p}</span>
          }
        }
        return p ? <span key={i} dangerouslySetInnerHTML={{ __html: mdEmphasis(p) }} /> : null
      })}
    </>
  )
}

export const handleClass = '!w-2 !h-2 !bg-[#0E8FD1]/70 !border-0'

// Per-kind tone for node header icon chips, in the dashboard's token language.
export type NodeTone = 'cyan' | 'amber' | 'green' | 'violet' | 'red'
const NODE_TONE: Record<NodeTone, { chip: string; icon: string }> = {
  cyan: { chip: 'bg-[color:var(--ss-accent)]/12', icon: 'text-ss-accent' },
  amber: { chip: 'bg-[color:var(--ss-warn)]/15', icon: 'text-ss-warn' },
  green: { chip: 'bg-[color:var(--ss-good)]/15', icon: 'text-ss-good' },
  violet: { chip: 'bg-violet-500/12', icon: 'text-violet-500' },
  red: { chip: 'bg-[color:var(--ss-bad)]/15', icon: 'text-ss-bad' },
}

// Unified card header: a tone-coded icon chip + bold title. Used by every
// lesson-card node so they read as one consistent system.
export function NodeHeader({ icon: Icon, title, tone = 'cyan' }: { icon: LucideIcon; title?: string; tone?: NodeTone }) {
  const t = NODE_TONE[tone]
  return (
    <div className="flex items-center gap-2.5 px-4 pt-4">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${t.chip}`}>
        <Icon className={`h-[18px] w-[18px] ${t.icon}`} strokeWidth={2} />
      </div>
      <h3 className="text-[14.5px] font-extrabold leading-tight text-ss-ink">{title}</h3>
    </div>
  )
}

export function CardFrame({
  children,
  accent = 'blue',
}: {
  children: React.ReactNode
  accent?: 'blue' | 'orange' | 'violet'
}) {
  const ring =
    accent === 'orange'
      ? 'border-[color:var(--ss-warn)]/35 dark:border-[color:var(--ss-warn)]/30'
      : accent === 'violet'
        ? 'border-violet-200 dark:border-violet-900/40'
        : 'border-ss-line'
  return (
    <div
      className={`sl-node-enter w-[300px] rounded-2xl bg-ss-panel border ${ring} shadow-[0_10px_34px_-14px_rgba(20,60,90,0.32)] overflow-hidden`}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      {children}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
