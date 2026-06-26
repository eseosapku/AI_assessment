'use client'

import { createContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import Latex from 'react-latex-next'
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
    .replace(/\*([^*\n]+)\*/g, '<strong class="text-apple-blue">$1</strong>')
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

export const handleClass = '!w-2 !h-2 !bg-apple-blue/60 !border-0'

export function CardFrame({
  children,
  accent = 'blue',
}: {
  children: React.ReactNode
  accent?: 'blue' | 'orange' | 'violet'
}) {
  const ring =
    accent === 'orange'
      ? 'border-orange-200 dark:border-orange-900/40'
      : accent === 'violet'
        ? 'border-violet-200 dark:border-violet-900/40'
        : 'border-gray-200 dark:border-gray-700'
  return (
    <div
      className={`sl-node-enter w-[300px] rounded-2xl bg-white dark:bg-[#1c1c1e] border ${ring} shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] overflow-hidden`}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      {children}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
