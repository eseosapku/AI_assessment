'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, Minus, Search, Sparkles, X } from 'lucide-react'
import {
  buildWall,
  filterWall,
  priorityTiles,
  wallSummary,
  type MasteryStatus,
  type WallTile,
} from '@/lib/studylab/wall'
import { canonicalSubject } from '@/lib/canonical-subject'

/**
 * How each status looks and reads.
 *
 * Colour is never the only signal: every chip also carries a glyph, so a screen
 * whose entire job is "find the red ones" still works for someone who cannot
 * separate red from green.
 */
const STATUS: Record<
  MasteryStatus,
  { label: string; hint: string; chip: string; glyph: 'check' | 'dash' | 'cross' | 'none' }
> = {
  gap: {
    label: 'Gap',
    hint: 'Getting these wrong — start here',
    chip: 'border-[color:var(--ss-bad)]/45 bg-[color:var(--ss-bad)]/[0.09] text-ss-ink',
    glyph: 'cross',
  },
  developing: {
    label: 'Shaky',
    hint: 'Half right — worth another look',
    chip: 'border-[color:var(--ss-warn)]/45 bg-[color:var(--ss-warn)]/[0.10] text-ss-ink',
    glyph: 'dash',
  },
  mastered: {
    label: 'Solid',
    hint: 'You are getting these right',
    chip: 'border-[color:var(--ss-good)]/40 bg-[color:var(--ss-good)]/[0.08] text-ss-ink',
    glyph: 'check',
  },
  not_assessed: {
    label: 'Not tested',
    hint: 'No quiz has covered this yet',
    chip: 'border-dashed border-ss-line bg-ss-chip text-ss-slate',
    glyph: 'none',
  },
}

const BADGE: Record<MasteryStatus, string> = {
  gap: 'bg-[color:var(--ss-bad)] text-white',
  developing: 'bg-[color:var(--ss-warn)] text-white',
  mastered: 'bg-[color:var(--ss-good)] text-white',
  not_assessed: 'bg-ss-line text-ss-slate',
}

function Glyph({ kind }: { kind: 'check' | 'dash' | 'cross' | 'none' }) {
  if (kind === 'check') return <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
  if (kind === 'dash') return <Minus className="h-3 w-3" strokeWidth={3.5} aria-hidden />
  if (kind === 'cross') return <X className="h-3 w-3" strokeWidth={3.5} aria-hidden />
  return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" aria-hidden />
}

/**
 * The gap map, without the map.
 *
 * The original drew subject → topic → subtopic on a pan-and-zoom graph canvas
 * for what is, on live data, a median of twelve assessed topics. The first
 * replacement over-corrected: a grid of unlabelled coloured squares, which
 * showed the *shape* of a student's knowledge and nothing else. You could not
 * tell what a tile was without tapping it, and eighty-eight untested greys
 * drowned the eight that mattered.
 *
 * So the tiles carry their names, sit under their topic headings, and untested
 * ones stay out of the way until asked for. With ninety-six of them a search
 * box is not a nicety either — it is the only way to reach a particular topic
 * without reading the lot.
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
  const all = useMemo(() => buildWall(subjects, canonicalSubject), [subjects])
  const totals = useMemo(() => wallSummary(all), [all])
  const priorities = useMemo(() => priorityTiles(all, 3), [all])

  const [query, setQuery] = useState('')
  const [showUntested, setShowUntested] = useState(false)
  const [selected, setSelected] = useState<WallTile | null>(null)

  // Searching should reach an untested topic too — otherwise looking for one
  // by name silently finds nothing.
  const sections = useMemo(
    () => filterWall(all, { query, includeUntested: showUntested || query.trim().length > 0 }),
    [all, query, showUntested],
  )

  if (all.length === 0) {
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

  return (
    <div className="space-y-6">
      {/* Counts first, then the two controls that make ninety-six topics
          navigable: find one by name, or bring the untested ones in. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {(['gap', 'developing', 'mastered', 'not_assessed'] as MasteryStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ss-ink">
            <span className={`grid h-5 w-5 place-items-center rounded-[6px] ${BADGE[s]}`} aria-hidden>
              <Glyph kind={STATUS[s].glyph} />
            </span>
            <span className="tabular-nums">{totals[s]}</span>
            <span className="font-semibold text-ss-slate">{STATUS[s].label}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ss-slate" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a topic…"
            aria-label="Find a topic"
            className="w-full rounded-full border border-ss-line bg-ss-panel py-2.5 pl-9 pr-4 text-[13.5px] font-semibold text-ss-ink placeholder:font-medium placeholder:text-ss-slate focus:border-ss-accent focus:outline-none"
          />
        </div>
        {totals.not_assessed > 0 && (
          <button
            type="button"
            onClick={() => setShowUntested((v) => !v)}
            aria-pressed={showUntested}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-bold transition-colors ${
              showUntested
                ? 'border-ss-accent bg-[color:var(--ss-accent)]/10 text-ss-accent'
                : 'border-ss-line text-ss-slate hover:border-ss-accent hover:text-ss-accent'
            }`}
          >
            {showUntested ? 'Hide' : 'Show'} {totals.not_assessed} not tested
          </button>
        )}
      </div>

      {/* The work, lifted out so it is not something you have to go and find. */}
      {priorities.length > 0 && !query.trim() && (
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

      {sections.length === 0 ? (
        <p className="rounded-[16px] border border-ss-line bg-ss-chip px-5 py-8 text-center text-[13.5px] font-semibold text-ss-slate">
          Nothing matches “{query}”.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.subject} aria-labelledby={`wall-${section.subject}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ss-line pb-2">
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

            <div className="space-y-4">
              {section.groups.map((group) => (
                <div key={group.topic || '_'}>
                  {group.topic && (
                    <p className="mb-1.5 text-[12.5px] font-bold text-ss-slate">{group.topic}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {group.tiles.map((tile) => {
                      const cfg = STATUS[tile.status]
                      const pct = typeof tile.accuracy === 'number' ? Math.round(tile.accuracy) : null
                      return (
                        <button
                          key={tile.key}
                          type="button"
                          onClick={() => setSelected(tile)}
                          aria-label={`${tile.label}: ${cfg.label}${pct !== null ? `, ${pct}%` : ''}`}
                          className={`inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:border-ss-accent ${cfg.chip} ${
                            selected?.key === tile.key ? 'ring-2 ring-ss-accent ring-offset-1 ring-offset-[color:var(--ss-panel)]' : ''
                          }`}
                        >
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${BADGE[tile.status]}`} aria-hidden>
                            <Glyph kind={cfg.glyph} />
                          </span>
                          <span className="truncate text-[13px] font-bold">{tile.label}</span>
                          {pct !== null && (
                            <span className="shrink-0 text-[12px] font-extrabold tabular-nums opacity-70">{pct}%</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Detail for one chip. A panel rather than a hover card: there is no
          hover on a phone, and this is a phone-first screen. */}
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
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${BADGE[selected.status]}`}
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
    </div>
  )
}
