'use client'

import { type NodeProps } from '@xyflow/react'
import { Check } from 'lucide-react'

/**
 * The area of the board one step of the lesson occupies.
 *
 * Sits behind everything, takes no clicks, and is never saved — it is a reading
 * of where the cards already are, not part of the board. Its whole job is to
 * make the lesson's structure something you can see rather than something you
 * have to reconstruct: which cards belong together, which step you are in, and
 * how much of the board is behind you.
 *
 * Colour carries state so the board answers "where am I" the same way the rail
 * does, from across the room.
 */
export function StepRegionNode({ data }: NodeProps) {
  const d = data as unknown as {
    step: number
    title: string
    status: 'done' | 'current' | 'upcoming'
    width: number
    height: number
  }

  const current = d.status === 'current'
  const done = d.status === 'done'
  const accent = done ? 'var(--ss-good)' : current ? 'var(--ss-accent)' : 'var(--ss-slate)'

  // Filled, not just outlined. A one-pixel line in --ss-line disappears against
  // the dotted canvas, which left the titles floating with no area under them —
  // the regions were there and could not be seen. `color-mix` keeps the tint
  // derived from the tokens, so both themes stay correct.
  const fill = current
    ? 'color-mix(in srgb, var(--ss-accent) 9%, transparent)'
    : done
      ? 'color-mix(in srgb, var(--ss-panel) 62%, transparent)'
      : 'color-mix(in srgb, var(--ss-panel) 34%, transparent)'

  const stroke = current
    ? 'var(--ss-accent)'
    : 'color-mix(in srgb, var(--ss-slate) 34%, transparent)'

  return (
    <div
      aria-hidden
      style={{
        width: d.width,
        height: d.height,
        background: fill,
        borderColor: stroke,
        borderWidth: current ? 2 : 1,
        borderStyle: current ? 'solid' : 'dashed',
      }}
      className="pointer-events-none rounded-[28px] transition-colors"
    >
      <div className="flex items-center gap-2 px-5 pt-3">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[12px] font-black text-white"
          style={{ backgroundColor: accent }}
        >
          {done ? <Check className="h-3 w-3" strokeWidth={4} /> : d.step}
        </span>
        <span
          className="truncate text-[13px] font-extrabold tracking-tight"
          style={{ color: current ? 'var(--ss-ink)' : 'var(--ss-slate)' }}
        >
          {d.title}
        </span>
      </div>
    </div>
  )
}
