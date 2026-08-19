'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, Minus, Sparkles, X } from 'lucide-react'
import { buildWall, priorityTiles, wallSummary, type MasteryStatus, type WallTile } from '@/lib/studylab/wall'
import { canonicalSubject } from '@/lib/canonical-subject'

/**
 * How each status looks and reads.
 *
 * Colour is never the only signal: every tile also carries a glyph and a
 * distinct fill weight, so the wall is legible to someone who cannot separate
 * red from green — which on a screen whose entire job is "find the red ones"
 * would otherwise be the difference between usable and useless.
 */
const STATUS: Record<
  MasteryStatus,
  { label: string; hint: string; tile: string; glyph: 'check' | 'dash' | 'cross' | 'none' }
> = {
  mastered: {
    label: 'Solid',
    hint: 'You are getting these right',
    tile: 'bg-[color:var(--ss-good)] text-white border-[color:var(--ss-good)]',
    glyph: 'check',
  },
  developing: {
    label: 'Shaky',
    hint: 'Half right — worth another look',
    tile: 'bg-[color:var(--ss-warn)] text-white border-[color:var(--ss-warn)]',
    glyph: 'dash',
  },
  gap: {
    label: 'Gap',
    hint: 'Getting these wrong — start here',
    tile: 'bg-[color:var(--ss-bad)] text-white border-[color:var(--ss-bad)]',
    glyph: 'cross',
  },
  not_assessed: {
    label: 'Not tested',
    hint: 'No quiz has covered this yet',
    tile: 'border-dashed border-ss-line bg-ss-chip text-ss-slate',
    glyph: 'none',
  },
}

function Glyph({ kind }: { kind: 'check' | 'dash' | 'cross' | 'none' }) {
  if (kind === 'check') return <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
  if (kind === 'dash') return <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
  if (kind === 'cross') return <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
  return null
}

/**
 * The gap map, without the map.
 *
 * The original drew subject → topic → subtopic on a pan-and-zoom graph canvas.
 * The median student has twelve assessed topics; the busiest has ninety. Every
 * one of those fits on one screen, so the panning, zooming and expanding was
 * pure cost — which is what made it feel unintuitive rather than informative.
 *
 * The concept is unchanged: find the gaps, study them, prove they closed. Only
 * the shape is different. Your knowledge is a wall, the gaps are the holes, and
 * tapping a hole builds the lesson that fills it.
 */
export function KnowledgeWall({
  subjects,
  onStudy,
  onQuiz,
  busy = false,
}: {
  /** Raw `textbooks` array from the gap-map API. */
  subjects: readonly unknown[]
  onStudy: (tile: WallTile) => void
  onQuiz?: (tile: WallTile) => void
  busy?: boolean
}) {
  const sections = useMemo(() => buildWall(subjects, canonicalSubject), [subjects])
  const totals = useMemo(() => wallSummary(sections), [sections])
  const priorities = useMemo(() => priorityTiles(sections, 3), [sections])
  const [selected, setSelected] = useState<WallTile | null>(null)

  if (sections.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-ss-line bg-ss-chip p-10 text-center">
        <h3 className="text-[17px] font-extrabold text-ss-ink">Your wall is empty — for now</h3>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] font-medium text-ss-slate">
          Every topic you get quizzed on appears here, coloured by how you did. Take one quiz and the
          first bricks go up.
        </p>
      </div>
    )
  }

  const assessed = totals.gap + totals.developing + totals.mastered

  return (
    <div className="space-y-7">
      {/* Where you stand, in one line, before any detail. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {(['mastered', 'developing', 'gap', 'not_assessed'] as MasteryStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-2 text-[13px] font-bold text-ss-ink">
            <span
              className={`grid h-5 w-5 place-items-center rounded-[6px] border-2 ${STATUS[s].tile}`}
              aria-hidden
            >
              <Glyph kind={STATUS[s].glyph} />
            </span>
            <span className="tabular-nums">{totals[s]}</span>
            <span className="font-semibold text-ss-slate">{STATUS[s].label}</span>
          </span>
        ))}
      </div>

      {/* The work, lifted out so it is not something you have to go and find. */}
      {priorities.length > 0 && (
        <section aria-labelledby="wall-priority">
          <h3 id="wall-priority" className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-ss-bad">
            Fix these first
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {priorities.map((tile) => (
              <div
                key={tile.key}
                className="flex flex-col rounded-[16px] border border-[color:var(--ss-bad)]/35 bg-[color:var(--ss-bad)]/[0.06] p-4"
              >
                <p className="text-[14.5px] font-extrabold leading-snug text-ss-ink">{tile.label}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-ss-slate">
                  {tile.parentTopic ?? 'Topic'}
                  {typeof tile.accuracy === 'number' ? ` · ${Math.round(tile.accuracy)}%` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => onStudy(tile)}
                  disabled={busy}
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-ss-accent px-4 py-2 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {busy ? 'Building…' : 'Build me a lesson'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The wall itself. */}
      {sections.map((section) => (
        <section key={section.subject} aria-labelledby={`wall-${section.subject}`}>
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`wall-${section.subject}`} className="text-[15.5px] font-extrabold text-ss-ink">
              {section.subject}
            </h3>
            <p className="text-[12.5px] font-semibold text-ss-slate">
              {section.solidRatio
                ? `${section.solidRatio.solid} of ${section.solidRatio.assessed} solid`
                : 'Not tested yet'}
              {section.counts.gap > 0 && (
                <span className="ml-2 font-bold text-ss-bad">
                  {section.counts.gap} {section.counts.gap === 1 ? 'gap' : 'gaps'}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`wall-${section.subject}`}>
            {section.tiles.map((tile) => {
              const cfg = STATUS[tile.status]
              const pct = typeof tile.accuracy === 'number' ? `, ${Math.round(tile.accuracy)}%` : ''
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => setSelected(tile)}
                  aria-label={`${tile.label}: ${cfg.label}${pct}`}
                  title={`${tile.label} — ${cfg.label}${pct}`}
                  className={`grid h-11 w-11 place-items-center rounded-[9px] border-2 transition-transform hover:scale-110 focus-visible:scale-110 ${cfg.tile} ${
                    selected?.key === tile.key ? 'ring-2 ring-ss-ink ring-offset-2 ring-offset-[color:var(--ss-panel)]' : ''
                  }`}
                >
                  <Glyph kind={cfg.glyph} />
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {/* Detail for one tile. A panel rather than a hover card: on a phone
          there is no hover, and this is a phone-first screen. */}
      {selected && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${selected.label} detail`}
          className="sticky bottom-4 rounded-[18px] border border-ss-line bg-ss-panel p-5 shadow-ss-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[12px] font-bold ${STATUS[selected.status].tile}`}
              >
                <Glyph kind={STATUS[selected.status].glyph} />
                {STATUS[selected.status].label}
              </span>
              <h4 className="mt-2 text-[17px] font-extrabold leading-snug text-ss-ink">{selected.label}</h4>
              <p className="mt-1 text-[13px] font-semibold text-ss-slate">
                {[
                  selected.parentTopic,
                  typeof selected.accuracy === 'number' ? `${Math.round(selected.accuracy)}% correct` : null,
                  selected.attempts > 0
                    ? `${selected.attempts} ${selected.attempts === 1 ? 'attempt' : 'attempts'}`
                    : 'Never quizzed',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-ss-slate">{STATUS[selected.status].hint}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-ss-slate hover:bg-ss-chip hover:text-ss-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStudy(selected)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {busy ? 'Building…' : 'Build me a lesson'}
            </button>
            {onQuiz && (
              <button
                type="button"
                onClick={() => onQuiz(selected)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-ss-line px-5 py-2.5 text-[13.5px] font-bold text-ss-ink transition-colors hover:border-ss-accent disabled:opacity-60"
              >
                Quiz me on this
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-[12.5px] font-medium text-ss-slate">
        {assessed} {assessed === 1 ? 'topic' : 'topics'} tested so far. Tap any tile for detail.
      </p>
    </div>
  )
}
