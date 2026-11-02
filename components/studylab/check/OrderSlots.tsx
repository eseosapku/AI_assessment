'use client'
import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { OrderQuestion } from '@/lib/studylab/quiz'
import { clueStates } from '@/lib/studylab/quiz'
import { placeInto, clearAt, shuffledItems } from '@/lib/studylab/check/placement'
import { motionFor } from '@/lib/studylab/motionPresets'
import { playSound } from '@/lib/studylab/sound'
import { SafeLatex } from '../canvasShared'
import { ConditionList } from './ConditionList'
import { pairText } from '@/lib/studylab/activities/conditions'
import { onPartsKey, partTone, PartBadge, type PartsState } from './parts'

/**
 * Numbered places and the items, shuffled the same way every time. Pick an
 * item, then a place; pick a placed item and another place to swap the two.
 * The clues tick as the arrangement makes them true.
 */
export function OrderSlots({ q, value, onChange, state }: {
  q: OrderQuestion
  value: string[]
  onChange: (next: string[]) => void
  state: PartsState
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const reduced = useReducedMotion() ?? false
  const slide = motionFor('slide', reduced).transition
  const shown = useMemo(() => shuffledItems(q.items, q.id), [q.items, q.id])
  const met = clueStates(q, value)

  const pick = (item: string) => {
    if (state.locked) return
    // Straight to the next empty slot, unless it is one already placed, being moved.
    const empty = value.findIndex((v) => !v)
    if (empty !== -1 && !picked && !value.includes(item)) {
      playSound('drop')
      onChange(placeInto(value, empty, item))
      return
    }
    playSound('tap')
    setPicked(picked === item ? null : item)
  }
  const slot = (i: number) => {
    if (state.locked) return
    if (picked) {
      if (value[i] !== picked) playSound('drop')
      onChange(placeInto(value, i, picked))
      setPicked(null)
    } else if (value[i]) pick(value[i])
  }

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => onPartsKey(e, (part) => {
        const m = /^slot-(\d+)$/.exec(part)
        if (m && !state.locked) onChange(clearAt(value, Number(m[1]) - 1))
      })}
    >
      <ol aria-label="Places" className="flex flex-col gap-1.5">
        {q.items.map((want, i) => {
          const got = value[i]
          const right = got === want
          const tone = state.marked ? partTone(right, state.mode) : null
          const held = !!got && picked === got
          return (
            <li key={i} className="flex items-center gap-2">
              <span aria-hidden className="w-4 shrink-0 text-right text-[12px] font-bold tabular-nums text-ss-slate">{i + 1}</span>
              <button
                type="button"
                data-part={`slot-${i + 1}`}
                aria-label={`Place ${i + 1}: ${got || 'empty'}`}
                aria-pressed={held}
                disabled={state.locked}
                onClick={() => slot(i)}
                className="nodrag relative flex min-h-[38px] flex-1 items-center rounded-xl border-2 border-dashed px-3 py-1.5 text-left text-[13px] disabled:cursor-default"
                style={tone
                  ? { borderStyle: 'solid', borderColor: tone, backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)` }
                  : held ? { borderStyle: 'solid', borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' }
                  : got ? { borderStyle: 'solid', borderColor: 'var(--ss-line)' } : { borderColor: 'var(--ss-slate)' }}
              >
                {got && <motion.span layout="position" layoutId={`${q.id}-item-${got}`} transition={slide}><SafeLatex>{got}</SafeLatex></motion.span>}
                {state.marked && got && <PartBadge right={right} mode={state.mode} />}
              </button>
              {state.showAnswer && !right && <span className="max-w-[40%] text-[12px] text-ss-slate">→ {want}</span>}
            </li>
          )
        })}
      </ol>
      <div role="group" aria-label="Items" className="flex flex-wrap gap-2">
        {shown.map((item, k) =>
          value.includes(item) ? (
            <span key={k} aria-hidden className="rounded-lg border-2 border-dashed border-ss-line px-2.5 py-1 text-[13px] font-semibold text-transparent select-none">{item}</span>
          ) : (
            <motion.button
              key={k}
              layout="position"
              layoutId={`${q.id}-item-${item}`}
              transition={slide}
              type="button"
              data-part={`tile-${k + 1}`}
              aria-pressed={picked === item}
              disabled={state.locked}
              onClick={() => pick(item)}
              className="nodrag rounded-lg border-2 px-2.5 py-1 text-[13px] font-semibold disabled:cursor-default"
              style={picked === item ? { borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' } : { borderColor: 'var(--ss-line)' }}
            >{item}</motion.button>
          ),
        )}
      </div>
      <ConditionList items={(q.clues ?? []).map((c, i) => ({ text: pairText(c.before, c.after), met: met[i] }))} />
    </div>
  )
}
