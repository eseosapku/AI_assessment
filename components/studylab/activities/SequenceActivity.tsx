// components/studylab/activities/SequenceActivity.tsx
'use client'
import { moved } from '@/lib/studylab/activities/patterns/sequence'
import { SafeLatex } from '../canvasShared'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, SequencePayload } from '@/lib/studylab/activities/types'
import type { SequenceWork } from '@/lib/studylab/activities/patterns/sequence'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { ActivityFrame } from './ActivityFrame'
import { ConditionList } from '@/components/studylab/check/ConditionList'
import { conditionsFor } from '@/lib/studylab/activities/conditions'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

type Item = SequencePayload['items'][number]

/** Picture-first: an image stands in for the step, the label is caption/fallback. */
function StepArt({ item }: { item: Item }) {
  const src = item.imageUrl ? assetUrl(item.imageUrl) : null
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.label}
      width={48}
      height={48}
      className="shrink-0 rounded-lg border border-ss-line bg-ss-panel object-contain p-1"
      style={{ width: 48, height: 48 }}
    />
  )
}

export function SequenceActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as SequencePayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as SequenceWork
  const order = work.order ?? []
  const rootRef = useRef<HTMLDivElement>(null)
  const byId = new Map(payload.items.map((i) => [i.id, i]))

  // No control of error at drop time: a wrong order is left to stand until Check.
  const reorder = (itemId: string, targetId: string) => {
    const next = moved(order, itemId, targetId)
    if (next !== order) a.setWork({ order: next })
  }

  const drag = useActivityDrag(reorder)
  const vertical = payload.orientation !== 'horizontal'

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div className="flex flex-col gap-3">
      <div ref={rootRef} className={`flex gap-2 ${vertical ? 'flex-col' : 'flex-row flex-wrap'}`}>
        {order.map((itemId, idx) => {
          const item = byId.get(itemId)
          if (!item) return null
          const wrong = a.wrongIds.includes(itemId)
          const targets = order.filter((tid) => tid !== itemId)
          return (
            <motion.div
              key={itemId} data-item={itemId}
              {...drag.itemProps(itemId, targets)}
              {...drag.dropTargetProps(itemId)}
              className={`nodrag flex cursor-grab items-center gap-2.5 touch-none rounded-xl border px-3 py-2 shadow-sm transition-colors motion-reduce:transition-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${
                wrong
                  ? 'border-red-400/40 bg-red-500/10'
                  : drag.overId === itemId
                    ? 'border-[color:var(--ss-accent)] bg-[color:var(--ss-accent)]/10'
                    : 'border-ss-line bg-ss-panel hover:border-[color:var(--ss-accent)]/50'
              } ${drag.dragId === itemId ? 'opacity-50' : ''}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--ss-accent)]/10 text-[12px] font-bold text-ss-accent">
                {idx + 1}
              </span>
              <StepArt item={item} />
              <span className={`text-[12.5px] font-semibold ${wrong ? 'text-red-600 dark:text-red-400' : 'text-ss-ink'}`}>
                <SafeLatex>{item.label}</SafeLatex>
              </span>
            </motion.div>
          )
        })}
      </div>
      <ConditionList items={conditionsFor('sequence', payload, { order })} label="Rules" />
      </div>
    </ActivityFrame>
  )
}
