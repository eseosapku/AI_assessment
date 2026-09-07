// components/studylab/activities/SortActivity.tsx
'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, SortPayload } from '@/lib/studylab/activities/types'
import { sortModule, type SortWork } from '@/lib/studylab/activities/patterns/sort'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { shakeElement } from '@/lib/studylab/activities/motion'
import { ActivityFrame } from './ActivityFrame'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

type Item = SortPayload['items'][number]

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

export function SortActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as SortPayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as SortWork
  const assign = work.assign ?? {}
  const rootRef = useRef<HTMLDivElement>(null)

  const place = (itemId: string, binId: string) => {
    // Control of error: the bin refuses an item that does not belong to it. The
    // refusal is recorded (not shown as a verdict) so the tutor still learns the
    // misconception — the student only sees the piece spring back.
    if (!sortModule.accepts!(payload, work, { itemId, targetId: binId })) {
      // Scoped to this activity instance — a document-wide query would match the
      // wrong card when two `sort` activities on the same canvas reuse a short
      // item id (LLM-authored payloads commonly do). CSS.escape guards against
      // ids containing characters that would otherwise break the attribute
      // selector (or throw) since ids come from model output.
      const el = rootRef.current?.querySelector(`[data-item="${CSS.escape(itemId)}"]`)
      shakeElement(el, [
        { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' },
      ])
      a.recordReject(itemId, binId)
      return
    }
    a.setWork({ assign: { ...assign, [itemId]: binId } })
  }

  const drag = useActivityDrag(place)
  const binIds = payload.bins.map((b) => b.id)
  const unplaced = seededShuffle(payload.items.filter((i) => !assign[i.id]), spec.seed ?? 1)

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div ref={rootRef} className="flex flex-col gap-3">
        <div className="flex min-h-[44px] flex-wrap gap-2">
          {unplaced.map((item) => (
            <motion.span
              key={item.id} data-item={item.id}
              {...drag.itemProps(item.id, binIds)}
              className={`nodrag flex cursor-grab items-center gap-1.5 active:cursor-grabbing touch-none rounded-lg border border-ss-line bg-ss-panel px-2.5 py-1.5 text-[12px] font-semibold text-ss-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${drag.dragId === item.id ? 'opacity-50' : ''}`}
            >
              <ItemArt item={item} />
              {item.label}
            </motion.span>
          ))}
          {unplaced.length === 0 && (
            <span className="text-[12px] italic text-ss-slate">All placed — press Check.</span>
          )}
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(payload.bins.length, 3)}, minmax(0,1fr))` }}>
          {payload.bins.map((bin) => {
            const mine = payload.items.filter((i) => assign[i.id] === bin.id)
            return (
              <div
                key={bin.id} {...drag.dropTargetProps(bin.id)}
                className={`min-h-[84px] rounded-xl border-2 border-dashed p-2 transition-colors hover:border-[color:var(--ss-accent)]/50 motion-reduce:transition-none ${
                  drag.overId === bin.id ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10' : 'border-ss-line'
                }`}
              >
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-ss-slate">{bin.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {mine.map((i) => (
                    <motion.span
                      key={i.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold ${a.wrongIds.includes(i.id) ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-[color:var(--ss-accent)]/10 text-ss-accent'}`}
                    >
                      <ItemArt item={i} />
                      {i.label}
                    </motion.span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ActivityFrame>
  )
}
