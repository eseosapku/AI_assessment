'use client'

import { useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame } from './canvasShared'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
      return m.default
    })
  }
  return mermaidReady
}

export function MermaidNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  // Strip markdown code fences / a stray leading "mermaid" line that the model
  // sometimes wraps the diagram in, which would otherwise fail to render.
  const src = (d.mermaid ?? '')
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^\s*mermaid\s*\n/i, '')
    .trim()

  useEffect(() => {
    let cancelled = false
    if (!src.trim()) return
    ;(async () => {
      try {
        const mermaid = await loadMermaid()
        const { svg } = await mermaid.render(`m-${id}-${Date.now()}`, src)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [src, id])

  return (
    <CardFrame accent="orange">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <GitBranch className="w-4 h-4 text-orange-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2">
        {error ? (
          <pre className="text-[11px] bg-gray-50 dark:bg-white/5 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{src}</pre>
        ) : (
          <div ref={ref} className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />
        )}
      </div>
    </CardFrame>
  )
}
