'use client'
import { SafeLatex } from '../canvasShared'
import type { Control } from '@/lib/studylab/material/types'

export function ControlView({
  control,
  value,
  onChange,
}: {
  control: Control
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label className="nodrag flex flex-col gap-1 text-[12px] font-semibold text-ss-ink">
      <span>
        <SafeLatex>{control.label}</SafeLatex>
        {control.unit ? ` (${control.unit})` : ''}: {value}
      </span>
      <input
        type="range"
        className="nodrag"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
