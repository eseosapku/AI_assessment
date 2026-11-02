'use client'
import { SafeLatex } from '../canvasShared'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { motionFor } from '@/lib/studylab/motionPresets'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'
import type { Group, MaterialSpec } from '@/lib/studylab/material/types'

export function MaterialFrame({
  spec,
  displays,
  groups,
  pool,
  controls,
  says,
  solved = false,
}: {
  spec: MaterialSpec
  displays?: ReactNode
  /** Render prop: one group zone's slot grid. */
  groups: (group: Group) => ReactNode
  pool?: ReactNode
  controls?: ReactNode
  says?: string[]
  /** Solved: every group closes, a lid with a tick dropping over it. */
  solved?: boolean
}) {
  const reduced = useReducedMotion() ?? false
  const zoneMax = MATERIAL_BOX.slotPx * MATERIAL_BOX.maxRows
    + MATERIAL_BOX.slotGapPx * Math.max(0, MATERIAL_BOX.maxRows - 1)

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        width: MATERIAL_BOX.widthPx,
        maxWidth: MATERIAL_BOX.widthPx,
        maxHeight: MATERIAL_BOX.heightPx,
        overflow: 'hidden',
      }}
    >
      {displays}
      <div className="flex min-h-0 flex-1" style={{ gap: MATERIAL_BOX.gridGapPx }}>
        {spec.groups.map((group) => (
          <div
            key={group.id}
            className="relative min-w-0 flex-1 rounded-lg border-2 p-2 transition-colors duration-200 motion-reduce:transition-none"
            style={{ borderColor: solved ? 'var(--ss-good)' : 'var(--ss-line)', backgroundColor: 'var(--ss-canvas)' }}
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-ss-ink">
              <SafeLatex>{group.label}</SafeLatex>
              {solved && (
                <motion.span
                  data-lid
                  aria-hidden
                  {...motionFor('close', reduced)}
                  style={{ transformOrigin: 'top', backgroundColor: 'var(--ss-good)' }}
                  className="ml-auto grid h-4 w-4 place-items-center rounded-full"
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </motion.span>
              )}
            </div>
            <div
              className="nowheel min-h-0 overflow-y-auto"
              style={{ maxHeight: zoneMax }}
            >
              {groups(group)}
            </div>
          </div>
        ))}
      </div>
      {pool}
      {controls}
      {says && says.length > 0 ? (
        <ul className="space-y-0.5 text-[12px] font-medium text-ss-slate">
          {says.map((say, index) => (
            <li key={`${index}-${say}`}>{say}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
