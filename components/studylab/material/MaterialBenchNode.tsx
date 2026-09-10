'use client'
import type { NodeProps } from '@xyflow/react'
import type { MaterialSpec } from '@/lib/studylab/material/types'
import { MaterialRenderer } from './MaterialRenderer'

export type MaterialBenchData = {
  spec: MaterialSpec
  resetKey: string
  label: string
}

export function MaterialBenchNode({ data }: NodeProps) {
  const d = data as unknown as MaterialBenchData
  return (
    <div className="sl-node-enter">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ss-slate">{d.label}</div>
      <MaterialRenderer spec={d.spec} resetKey={d.resetKey} />
    </div>
  )
}
