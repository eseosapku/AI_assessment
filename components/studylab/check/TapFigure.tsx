'use client'
import { useMemo } from 'react'
import type { TapQuestion } from '@/lib/studylab/quiz'
import { regionsFor } from '@/lib/studylab/check/diagramRegions'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { toggle } from '@/lib/studylab/check/placement'
import { playSound } from '@/lib/studylab/sound'
import { onPartsKey, partTone, PartBadge, type PartsState } from './parts'
import { ResultBadge } from './ResultBadge'

/** Small parts still get a target a finger can hit (WCAG 2.5.8). */
const MIN_TARGET = 24

/**
 * The diagram with a ring on every mapped spot. The rings are numbered in
 * reading order and never named, so the picture asks the question; tapping
 * one picks its part (every spot of it lights), tapping again lets it go.
 * Where spots nest, the smaller sits on top, so a tap goes to it.
 */
export function TapFigure({ q, value, onChange, state }: {
  q: TapQuestion
  value: string[]
  onChange: (next: string[]) => void
  state: PartsState
}) {
  const map = regionsFor(q.figure)
  const url = assetUrl(q.figure)
  const spots = useMemo(() => {
    if (!map) return []
    const all = map.regions.flatMap((r) => r.spots.map((s) => ({ ...s, id: r.id })))
    const bySize = [...all].sort((a, b) => b.r - a.r)
    const seen = new Set<string>()
    return all
      .sort((a, b) => a.y - b.y || a.x - b.x)
      // One badge a part: its first spot carries it, the rest just take the colour.
      .map((s, n) => ({ ...s, n: n + 1, z: bySize.indexOf(s) + 1, first: !seen.has(s.id) && !!seen.add(s.id) }))
  }, [map])

  if (!map || !url) return <p className="text-[13px] text-ss-slate">This picture could not be shown.</p>

  return (
    <div
      role="group"
      aria-label="Parts of the picture"
      className="relative mx-auto w-full max-w-[300px]"
      onKeyDown={(e) => onPartsKey(e)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a catalogue picture at its own size */}
      <img src={url} alt="" width={map.width} height={map.height} className="block h-auto w-full select-none rounded-xl" draggable={false} />
      {spots.map((s) => {
        const on = value.includes(s.id)
        const want = q.answer.includes(s.id)
        // Marked: what was tapped shows right or wrong; shown: the parts asked for.
        const tone =
          state.marked && on ? partTone(want, state.mode)
          : state.showAnswer && want ? 'var(--ss-good)'
          : on ? 'var(--subject)'
          : null
        return (
          <button
            key={`${s.id}-${s.n}`}
            type="button"
            data-part={`region-${s.id}`}
            aria-label={`Part ${s.n}`}
            aria-pressed={on}
            disabled={state.locked}
            onClick={() => { if (!state.locked) { playSound('tap'); onChange(toggle(value, s.id)) } }}
            className="nodrag absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default"
            style={{
              left: `${(s.x / map.width) * 100}%`,
              top: `${(s.y / map.height) * 100}%`,
              width: `${((2 * s.r) / map.width) * 100}%`,
              minWidth: MIN_TARGET,
              zIndex: s.z,
              borderStyle: tone && !on ? 'dashed' : 'solid',
              borderColor: tone ?? 'var(--ss-slate)',
              // A pale halo keeps the ring readable on any colour of the drawing.
              boxShadow: '0 0 0 2px color-mix(in srgb, var(--ss-panel) 80%, transparent)',
              backgroundColor: tone && on ? `color-mix(in srgb, ${tone} 22%, transparent)` : 'transparent',
            }}
          >
            {s.first && state.marked && on && <PartBadge right={want} mode={state.mode} />}
            {s.first && state.showAnswer && want && !on && <ResultBadge kind="answer" />}
          </button>
        )
      })}
    </div>
  )
}
