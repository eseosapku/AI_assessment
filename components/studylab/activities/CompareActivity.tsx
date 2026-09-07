// components/studylab/activities/CompareActivity.tsx
'use client'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, ComparePayload } from '@/lib/studylab/activities/types'
import type { CompareWork } from '@/lib/studylab/activities/patterns/compare'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { ActivityFrame } from './ActivityFrame'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

type Item = ComparePayload['items'][number]
type Region = 'left' | 'both' | 'right'
const REGIONS: Region[] = ['left', 'both', 'right']

// Zone widths for a 300x220 viewBox holding two r=100 circles at cx=110
// (left) / cx=180 (right), cy=110 (see task-14 report for the geometry).
// The zones no longer carry a fixed position/height — they grow with their
// content in normal flow — so only `width` still constrains them. Keys are
// the fixed 'left'|'both'|'right' literal union, not model-controlled, so a
// plain object is safe here.
const ZONES: Record<Region, { width: string }> = {
  left: { width: '19.3%' },
  both: { width: '32.7%' },
  right: { width: '19.3%' },
}

/** Picture-first: an image stands in for the item, the label is caption/fallback. */
function ItemArt({ item }: { item: Item }) {
  const src = item.imageUrl ? assetUrl(item.imageUrl) : null
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.label}
      width={22}
      height={22}
      className="shrink-0 rounded border border-ss-line bg-ss-panel object-contain p-0.5"
      style={{ width: 22, height: 22 }}
    />
  )
}

function Chip({ item, wrong, dragging, itemProps }: {
  item: Item; wrong: boolean; dragging: boolean
  itemProps: ReturnType<ReturnType<typeof useActivityDrag>['itemProps']>
}) {
  return (
    <motion.span
      data-item={item.id} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: dragging ? 0.5 : 1 }}
      {...itemProps}
      className={`nodrag flex cursor-grab items-center gap-1 touch-none rounded-lg px-1.5 py-1 text-[12px] font-semibold leading-tight active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${
        wrong ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-[color:var(--ss-accent)]/10 text-ss-accent'
      }`}
    >
      <ItemArt item={item} />
      <span>{item.label}</span>
    </motion.span>
  )
}

export function CompareActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as ComparePayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as CompareWork
  const assign = work.assign ?? {}

  // No control of error here (no accepts()): a wrong placement stands until
  // Check, then is highlighted via wrongIds — never rejected at drop time.
  const place = (itemId: string, region: string) => {
    if (region !== 'left' && region !== 'both' && region !== 'right') return
    a.setWork({ assign: { ...assign, [itemId]: region } })
  }

  const drag = useActivityDrag(place)
  const unplaced = seededShuffle(payload.items.filter((i) => !assign[i.id]), spec.seed ?? 1)
  const byRegion = (r: Region) => payload.items.filter((i) => assign[i.id] === r)
  const zoneLabel = (r: Region) => (r === 'left' ? payload.sets[0].label : r === 'right' ? payload.sets[1].label : 'Both')

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div className="flex flex-col gap-3">
        <div className="relative w-full" style={{ aspectRatio: '300 / 220' }}>
          <svg viewBox="0 0 300 220" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <circle cx={110} cy={110} r={100} className="fill-ss-accent stroke-ss-accent" fillOpacity={0.1} strokeOpacity={0.6} strokeWidth={2} />
            <circle cx={180} cy={110} r={100} className="fill-ss-warn stroke-ss-warn" fillOpacity={0.12} strokeOpacity={0.6} strokeWidth={2} />
            <text x={80} y={26} textAnchor="middle" className="fill-ss-ink" style={{ fontSize: 13, fontWeight: 700 }}>
              {payload.sets[0].label}
            </text>
            <text x={210} y={26} textAnchor="middle" className="fill-ss-ink" style={{ fontSize: 13, fontWeight: 700 }}>
              {payload.sets[1].label}
            </text>
          </svg>

          {REGIONS.map((region) => (
            <div
              key={region}
              {...drag.dropTargetProps(region)}
              style={{ width: ZONES[region].width }}
              className={`flex min-h-[96px] flex-wrap content-start gap-2 rounded-lg border border-dashed p-2 transition-colors hover:border-[color:var(--ss-accent)]/50 motion-reduce:transition-none ${
                drag.overId === region ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10' : 'border-ss-line'
              }`}
            >
              <p className="mb-0.5 shrink-0 text-center text-[12px] font-bold uppercase tracking-wide text-ss-slate">
                {zoneLabel(region)}
              </p>
              <div className="flex flex-wrap content-start justify-center gap-1">
                {byRegion(region).map((item) => (
                  <Chip
                    key={item.id}
                    item={item}
                    wrong={a.wrongIds.includes(item.id)}
                    dragging={drag.dragId === item.id}
                    itemProps={drag.itemProps(item.id, REGIONS)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-h-[40px] flex-wrap gap-2 border-t border-ss-line pt-2">
          {unplaced.map((item) => (
            <Chip
              key={item.id}
              item={item}
              wrong={false}
              dragging={drag.dragId === item.id}
              itemProps={drag.itemProps(item.id, REGIONS)}
            />
          ))}
          {unplaced.length === 0 && (
            <span className="text-[12px] italic text-ss-slate">All placed — press Check.</span>
          )}
        </div>
      </div>
    </ActivityFrame>
  )
}
