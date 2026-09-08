// components/studylab/activities/BalanceActivity.tsx
'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, BalancePayload } from '@/lib/studylab/activities/types'
import { sideTotal, type BalanceWork } from '@/lib/studylab/activities/patterns/balance'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { ActivityFrame } from './ActivityFrame'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

type Item = BalancePayload['left'][number]
type Target = 'left' | 'right' | 'pool'
const TARGETS: Target[] = ['left', 'right', 'pool']

// Beam geometry for the "0 0 300 190" viewBox. The stand is static; the beam,
// hangers and pan glyphs live in one rotating group pivoted at BEAM.pivot.
const BEAM = { pivotX: 150, pivotY: 60, halfSpan: 95, hangDown: 35 }

// A pan is anchored at `top: 50%` of the ~246px-tall beam box (see the pan
// containers below), leaving ~120px of headroom before it would grow past
// the container and into the pool strip beneath it. `lib/studylab/
// activities/patterns/balance.ts` caps each authored group to what that
// headroom can hold without this ever engaging in normal use; this is only
// the backstop for a payload that slips past that cap, or a student who
// drags more onto one pan than the material was authored to hold — it
// scrolls internally past the cap rather than drawing over the beam.
const PAN_MAX_HEIGHT = '120px'

/** Picture-first: an image stands in for the item, the label is caption/fallback. */
function ItemArt({ item }: { item: Item }) {
  const src = item.imageUrl ? assetUrl(item.imageUrl) : null
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.label}
      width={20}
      height={20}
      className="shrink-0 rounded border border-ss-line bg-ss-panel object-contain p-0.5"
      style={{ width: 20, height: 20 }}
    />
  )
}

function Chip({ item, showWeight, dragging, itemProps }: {
  item: Item; showWeight: boolean; dragging: boolean
  itemProps: ReturnType<ReturnType<typeof useActivityDrag>['itemProps']>
}) {
  return (
    <motion.span
      data-item={item.id} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: dragging ? 0.5 : 1 }}
      {...itemProps}
      className="nodrag flex cursor-grab items-center gap-1 touch-none rounded-lg bg-[color:var(--ss-accent)]/10 px-1.5 py-1 text-[12px] font-semibold leading-tight text-ss-accent active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)]"
    >
      <ItemArt item={item} />
      <span>{item.label}</span>
      {showWeight && (
        <span className="text-[12px] font-bold opacity-70">
          {item.weight > 0 ? `+${item.weight}` : item.weight}
        </span>
      )}
    </motion.span>
  )
}

export function BalanceActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as BalancePayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as BalanceWork
  const left = work.left ?? []
  const right = work.right ?? []

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of [...payload.left, ...payload.right, ...payload.pool]) map.set(i.id, i)
    return map
  }, [payload])

  // No accepts() for balance: any item may land on either pan, so a move is
  // just "remove from wherever it was, then add to the new spot" — an item
  // never lives in two places and never disappears when it lands nowhere new.
  const place = (itemId: string, target: string) => {
    if (target !== 'left' && target !== 'right' && target !== 'pool') return
    const nextLeft = left.filter((x) => x !== itemId)
    const nextRight = right.filter((x) => x !== itemId)
    if (target === 'left') nextLeft.push(itemId)
    else if (target === 'right') nextRight.push(itemId)
    a.setWork({ left: nextLeft, right: nextRight })
  }

  const drag = useActivityDrag(place)

  const leftItems = left.map((x) => itemsById.get(x)).filter((x): x is Item => !!x)
  const rightItems = right.map((x) => itemsById.get(x)).filter((x): x is Item => !!x)
  const poolItems = seededShuffle(
    [...itemsById.values()].filter((i) => !left.includes(i.id) && !right.includes(i.id)),
    spec.seed ?? 1,
  )

  const leftTotal = sideTotal(payload, left)
  const rightTotal = sideTotal(payload, right)
  // The beam's own physical statement of the difference — this IS the feedback,
  // so nothing else in the UI should also announce "balanced"/"unbalanced".
  const tiltDeg = Math.max(-12, Math.min(12, (leftTotal - rightTotal) * 3))
  const showWeight = payload.mode === 'weights'

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div className="flex flex-col gap-3">
        <div className="relative w-full" style={{ aspectRatio: '300 / 190' }}>
          <svg viewBox="0 0 300 190" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {/* Static stand: this never rotates, only the beam does. */}
            <polygon points="130,150 170,150 150,60" className="fill-ss-line" />
            <line x1="105" y1="150" x2="195" y2="150" className="stroke-ss-line" strokeWidth={4} strokeLinecap="round" />
            <motion.g
              style={{ transformOrigin: `${BEAM.pivotX}px ${BEAM.pivotY}px` }}
              animate={{ rotate: -tiltDeg }}
              transition={{ type: 'spring', stiffness: 130, damping: 16 }}
            >
              <line
                x1={BEAM.pivotX - BEAM.halfSpan} y1={BEAM.pivotY}
                x2={BEAM.pivotX + BEAM.halfSpan} y2={BEAM.pivotY}
                className="stroke-ss-ink" strokeWidth={4} strokeLinecap="round"
              />
              <circle cx={BEAM.pivotX} cy={BEAM.pivotY} r={5} className="fill-ss-ink" />
              {/* Left hanger + pan glyph */}
              <line
                x1={BEAM.pivotX - BEAM.halfSpan} y1={BEAM.pivotY}
                x2={BEAM.pivotX - BEAM.halfSpan} y2={BEAM.pivotY + BEAM.hangDown}
                className="stroke-ss-slate" strokeWidth={2}
              />
              <path
                d={`M ${BEAM.pivotX - BEAM.halfSpan - 25},${BEAM.pivotY + BEAM.hangDown} Q ${BEAM.pivotX - BEAM.halfSpan},${BEAM.pivotY + BEAM.hangDown + 20} ${BEAM.pivotX - BEAM.halfSpan + 25},${BEAM.pivotY + BEAM.hangDown}`}
                className="fill-none stroke-ss-slate" strokeWidth={3} strokeLinecap="round"
              />
              {/* Right hanger + pan glyph */}
              <line
                x1={BEAM.pivotX + BEAM.halfSpan} y1={BEAM.pivotY}
                x2={BEAM.pivotX + BEAM.halfSpan} y2={BEAM.pivotY + BEAM.hangDown}
                className="stroke-ss-slate" strokeWidth={2}
              />
              <path
                d={`M ${BEAM.pivotX + BEAM.halfSpan - 25},${BEAM.pivotY + BEAM.hangDown} Q ${BEAM.pivotX + BEAM.halfSpan},${BEAM.pivotY + BEAM.hangDown + 20} ${BEAM.pivotX + BEAM.halfSpan + 25},${BEAM.pivotY + BEAM.hangDown}`}
                className="fill-none stroke-ss-slate" strokeWidth={3} strokeLinecap="round"
              />
            </motion.g>
          </svg>

          {/* Interactive pans. Positioned absolutely so they sit under their own
              hanger on the beam drawn by the sibling SVG below — the parent has
              no flex/grid, so without an explicit position these would stack in
              normal block flow instead of sitting side by side. No fixed
              `height` is set, so each pan is sized to its content and grows
              downward as chips wrap onto more rows, up to PAN_MAX_HEIGHT — the
              cap in balance.ts's isPayload keeps normal use well under that,
              so this only ever scrolls for a payload or a drag that slips
              past the cap (see PAN_MAX_HEIGHT above). They also ride a small
              synced translateY so they read as attached to the tilting beam,
              but stay level so their chips stay legible. */}
          <motion.div
            {...drag.dropTargetProps('left')}
            animate={{ y: tiltDeg * 1.1 }}
            transition={{ type: 'spring', stiffness: 130, damping: 16 }}
            style={{ left: '4%', width: '33%', top: '50%', maxHeight: PAN_MAX_HEIGHT }}
            className={`absolute flex min-h-[96px] flex-wrap content-start gap-2 overflow-y-auto rounded-xl border-2 border-dashed p-2 transition-colors hover:border-[color:var(--ss-accent)]/50 motion-reduce:transition-none ${
              drag.overId === 'left' ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10' : 'border-ss-line'
            }`}
          >
            <p className="mb-1 shrink-0 text-center text-[12px] font-bold uppercase tracking-wide text-ss-slate">Left</p>
            <div className="flex flex-wrap content-start justify-center gap-1">
              {leftItems.map((item) => (
                <Chip
                  key={item.id} item={item} showWeight={showWeight}
                  dragging={drag.dragId === item.id}
                  itemProps={drag.itemProps(item.id, TARGETS)}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            {...drag.dropTargetProps('right')}
            animate={{ y: -(tiltDeg * 1.1) }}
            transition={{ type: 'spring', stiffness: 130, damping: 16 }}
            style={{ left: '63%', width: '33%', top: '50%', maxHeight: PAN_MAX_HEIGHT }}
            className={`absolute flex min-h-[96px] flex-wrap content-start gap-2 overflow-y-auto rounded-xl border-2 border-dashed p-2 transition-colors hover:border-[color:var(--ss-accent)]/50 motion-reduce:transition-none ${
              drag.overId === 'right' ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10' : 'border-ss-line'
            }`}
          >
            <p className="mb-1 shrink-0 text-center text-[12px] font-bold uppercase tracking-wide text-ss-slate">Right</p>
            <div className="flex flex-wrap content-start justify-center gap-1">
              {rightItems.map((item) => (
                <Chip
                  key={item.id} item={item} showWeight={showWeight}
                  dragging={drag.dragId === item.id}
                  itemProps={drag.itemProps(item.id, TARGETS)}
                />
              ))}
            </div>
          </motion.div>
        </div>

        <div
          {...drag.dropTargetProps('pool')}
          className={`flex min-h-[44px] flex-wrap gap-2 rounded-lg border-t pt-2 transition-colors motion-reduce:transition-none ${
            drag.overId === 'pool' ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10' : 'border-ss-line'
          }`}
        >
          {poolItems.map((item) => (
            <Chip
              key={item.id} item={item} showWeight={showWeight}
              dragging={drag.dragId === item.id}
              itemProps={drag.itemProps(item.id, TARGETS)}
            />
          ))}
          {poolItems.length === 0 && (
            <span className="text-[12px] italic text-ss-slate">All placed — press Check.</span>
          )}
        </div>
      </div>
    </ActivityFrame>
  )
}
