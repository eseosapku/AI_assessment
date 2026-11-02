'use client'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { FillQuestion } from '@/lib/studylab/quiz'
import { placeInto, clearAt, sentenceParts } from '@/lib/studylab/check/placement'
import { motionFor } from '@/lib/studylab/motionPresets'
import { playSound } from '@/lib/studylab/sound'
import { SafeLatex } from '../canvasShared'
import { onPartsKey, partTone, PartBadge, type PartsState } from './parts'

const same = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

/**
 * A sentence with blanks and a bank of tiles. Pick a tile, then a blank; a
 * tile flies in and leaves its gap in the bank. A filled blank picked with no
 * tile in hand gives its tile back.
 */
export function FillBlanks({ q, value, onChange, state }: {
  q: FillQuestion
  value: string[]
  onChange: (next: string[]) => void
  state: PartsState
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const reduced = useReducedMotion() ?? false
  const slide = motionFor('slide', reduced).transition

  // A tile goes straight to the next empty blank: tapping it and then the blank was
  // two steps, and after the first nothing seemed to have happened.
  const tile = (t: string) => {
    if (state.locked) return
    const empty = value.findIndex((v) => !v)
    if (empty !== -1 && !picked) {
      playSound('drop')
      onChange(placeInto(value, empty, t))
      return
    }
    playSound('tap')
    setPicked(picked === t ? null : t)
  }

  const blank = (i: number) => {
    if (state.locked) return
    if (picked) {
      playSound('drop')
      onChange(placeInto(value, i, picked))
      setPicked(null)
    } else if (value[i]) onChange(clearAt(value, i))
  }

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => onPartsKey(e, (part) => {
        const m = /^blank-(\d+)$/.exec(part)
        if (m && !state.locked) onChange(clearAt(value, Number(m[1]) - 1))
      })}
    >
      <p className="text-[14px] leading-[2.1]">
        {sentenceParts(q.text).map((p, k) => {
          if ('text' in p) return <SafeLatex key={k}>{p.text}</SafeLatex>
          const i = p.blank
          const got = value[i]
          const right = same(got, q.answer[i])
          const tone = state.marked ? partTone(right, state.mode) : null
          return (
            <span key={k} className="relative inline-block align-baseline">
              <button
                type="button"
                data-part={`blank-${i + 1}`}
                aria-label={`Blank ${i + 1}: ${got || 'empty'}`}
                disabled={state.locked}
                onClick={() => blank(i)}
                className="nodrag mx-0.5 inline-flex min-w-[64px] items-center justify-center rounded-lg border-2 border-dashed px-2 py-0.5 text-[13.5px] font-semibold disabled:cursor-default"
                style={tone
                  ? { borderStyle: 'solid', borderColor: tone, backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)` }
                  : got ? { borderStyle: 'solid', borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' } : { borderColor: 'var(--ss-slate)' }}
              >
                {got ? <motion.span layout="position" layoutId={`${q.id}-tile-${got}`} transition={slide}>{got}</motion.span> : ' '}
              </button>
              {state.marked && got && <PartBadge right={right} mode={state.mode} />}
              {state.showAnswer && !right && (
                <span className="ml-1 text-[12px] text-ss-slate">→ {q.answer[i]}</span>
              )}
            </span>
          )
        })}
      </p>
      <div role="group" aria-label="Tiles" className="flex flex-wrap gap-2">
        {q.tiles.map((t, k) =>
          value.includes(t) ? (
            // The gap a placed tile leaves, so the bank does not close up.
            <span key={k} aria-hidden className="rounded-lg border-2 border-dashed border-ss-line px-2.5 py-1 text-[13px] font-semibold text-transparent select-none">{t}</span>
          ) : (
            <motion.button
              key={k}
              layout="position"
              layoutId={`${q.id}-tile-${t}`}
              transition={slide}
              type="button"
              data-part={`tile-${k + 1}`}
              aria-pressed={picked === t}
              disabled={state.locked}
              onClick={() => tile(t)}
              className="nodrag rounded-lg border-2 px-2.5 py-1 text-[13px] font-semibold disabled:cursor-default"
              style={picked === t ? { borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' } : { borderColor: 'var(--ss-line)' }}
            >{t}</motion.button>
          ),
        )}
      </div>
    </div>
  )
}
