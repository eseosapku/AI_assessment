'use client'
import type { ReactNode } from 'react'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'
import type { Group, MaterialSpec } from '@/lib/studylab/material/types'

export function MaterialFrame({
  spec,
  displays,
  groups,
  pool,
  controls,
  says,
}: {
  spec: MaterialSpec
  displays?: ReactNode
  /** Render prop: one group zone's slot grid. */
  groups: (group: Group) => ReactNode
  pool?: ReactNode
  controls?: ReactNode
  says?: string[]
}) {
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
            className="min-w-0 flex-1 rounded-lg border-2 p-2"
            style={{ borderColor: 'var(--ss-line)', backgroundColor: 'var(--ss-canvas)' }}
          >
            <div className="mb-1.5 text-[12px] font-bold text-ss-ink">{group.label}</div>
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
