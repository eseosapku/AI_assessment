// components/studylab/activities/ComposeActivity.tsx
'use client'
import { useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, ComposePayload } from '@/lib/studylab/activities/types'
import { composeModule, joinCount, joinId, type ComposeWork } from '@/lib/studylab/activities/patterns/compose'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { shakeElement } from '@/lib/studylab/activities/motion'
import { ActivityFrame } from './ActivityFrame'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

type Part = ComposePayload['parts'][number]

// Ring geometry for the "0 0 300 220" viewBox shared with Balance/Compare, so
// the molecule/structure sits centred and scales with the card.
const RING = { cx: 150, cy: 112, r: 76 }

function ringPos(i: number, n: number) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2 // first part at top, going clockwise
  return { x: RING.cx + RING.r * Math.cos(angle), y: RING.cy + RING.r * Math.sin(angle) }
}

/** Picture-first: an image stands in for the part, the label is caption/fallback. */
function PartArt({ part }: { part: Part }) {
  const src = part.imageUrl ? assetUrl(part.imageUrl) : null
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={part.label}
      width={20}
      height={20}
      className="shrink-0 rounded border border-ss-line bg-ss-panel object-contain p-0.5"
      style={{ width: 20, height: 20 }}
    />
  )
}

export function ComposeActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as ComposePayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as ComposeWork
  const joins = work.joins ?? []
  const rootRef = useRef<HTMLDivElement>(null)

  // Ring order is shuffled for visual variety (never reveals the answer — the
  // legal pairing is a label rule, not a position rule) but stable per seed.
  const ordered = useMemo(() => seededShuffle(payload.parts, spec.seed ?? 1), [payload.parts, spec.seed])
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    ordered.forEach((part, i) => map.set(part.id, ringPos(i, ordered.length)))
    return map
  }, [ordered])

  const wrongJoinIds = new Set(a.wrongIds)
  const partIds = payload.parts.map((p) => p.id)

  const attemptJoin = (itemId: string, targetId: string) => {
    // Control of error: an illegal, duplicate, or slot-exhausted join is
    // refused outright — the piece flashes back with NO verdict text, but the
    // refusal is recorded so the tutor still learns the misconception.
    if (!composeModule.accepts!(payload, work, { itemId, targetId })) {
      // Scoped to this activity instance — a document-wide query would match
      // the wrong card when two `compose` activities reuse a short part id.
      // CSS.escape guards ids that came from model output.
      const el = rootRef.current?.querySelector(`[data-item="${CSS.escape(itemId)}"]`)
      shakeElement(el, [
        { transform: 'translate(-50%, -50%)' },
        { transform: 'translate(calc(-50% - 6px), -50%)' },
        { transform: 'translate(calc(-50% + 6px), -50%)' },
        { transform: 'translate(-50%, -50%)' },
      ])
      a.recordReject(itemId, targetId)
      return
    }
    a.setWork({ joins: [...joins, [itemId, targetId]] })
  }

  const drag = useActivityDrag(attemptJoin)

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div ref={rootRef} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Build</p>
          <p className="text-[12px] font-bold text-ss-accent">
            {payload.target.label}
            {payload.target.formula ? ` (${payload.target.formula})` : ''}
          </p>
        </div>

        <div className="relative w-full" style={{ aspectRatio: '300 / 220' }}>
          <svg viewBox="0 0 300 220" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {joins.map(([a1, a2], i) => {
              const p1 = positions.get(a1)
              const p2 = positions.get(a2)
              if (!p1 || !p2) return null
              const wrong = wrongJoinIds.has(joinId(a1, a2))
              return (
                <line
                  key={`${joinId(a1, a2)}-${i}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  className={wrong ? 'stroke-red-500 dark:stroke-red-400' : 'stroke-[color:var(--ss-accent)]'}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {ordered.map((part) => {
            const pos = positions.get(part.id)!
            const used = joinCount(joins, part.id)
            const full = used >= part.slots
            const over = drag.overId === part.id
            // itemProps() carries the follow-cursor `style` (position:fixed while
            // this part is the active drag) — it MUST win over the ring-position
            // `left`/`top` below while dragging, so it is spread last rather than
            // being clobbered by a later `style` prop (see drag-fix-report.md).
            const itemP = drag.itemProps(part.id, partIds.filter((pid) => pid !== part.id))
            return (
              <div
                key={part.id}
                data-item={part.id}
                {...itemP}
                {...drag.dropTargetProps(part.id)}
                style={{ left: `${(pos.x / 300) * 100}%`, top: `${(pos.y / 220) * 100}%`, ...itemP.style }}
                className="nodrag absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ss-accent)] focus-visible:ring-offset-1"
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: drag.dragId === part.id ? 0.5 : 1 }}
                  className={`flex flex-col items-center gap-0.5 rounded-full border-2 px-2.5 py-1.5 text-center shadow-sm transition-colors motion-reduce:transition-none ${
                    over
                      ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10'
                      : full
                        ? 'border-[color:var(--ss-accent)]/70 bg-[color:var(--ss-accent)]/10'
                        : 'border-dashed border-ss-line bg-ss-panel hover:border-[color:var(--ss-accent)]/50'
                  }`}
                >
                  <PartArt part={part} />
                  <span className="whitespace-nowrap text-[12px] font-semibold leading-tight text-ss-ink">{part.label}</span>
                  {part.slots > 1 && (
                    <span className="text-[12px] font-bold text-ss-slate">{used}/{part.slots}</span>
                  )}
                </motion.div>
              </div>
            )
          })}
        </div>

        {joins.length === 0 && (
          <span className="text-[12px] italic text-ss-slate">Drag one part onto another to bond them.</span>
        )}
      </div>
    </ActivityFrame>
  )
}
