'use client'

import { useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame, SafeLatex } from './canvasShared'

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

  // The model sometimes stuffs a markdown image "![alt](url)" into the mermaid
  // field instead of diagram syntax — render it as an image.
  const imageMatch = src.match(/^!\[[^\]]*\]\((https?:\/\/[^)]+)\)$/)

  useEffect(() => {
    let cancelled = false
    if (!src.trim() || imageMatch) return
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
        {imageMatch ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageMatch[1]} alt={d.title || 'diagram'} className="w-full rounded-lg" />
        ) : error || !src ? (
          <p className="text-[12px] text-gray-400 italic">Diagram unavailable.</p>
        ) : (
          <div ref={ref} className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />
        )}
        {d.body && (
          <p className="mt-2 text-[12px] leading-relaxed text-ss-slate">
            <SafeLatex>{d.body}</SafeLatex>
          </p>
        )}
      </div>
    </CardFrame>
  )
}
