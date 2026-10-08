'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Minus, Search, Sparkles, X } from 'lucide-react'
import {
  buildWall,
  filterWall,
  priorityTiles,
  unplacedQuizzes,
  wallSummary,
  type MasteryStatus,
  type UnplacedSubject,
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
    chip: 'border-dashed border-ss-line bg-transparent text-ss-slate opacity-80',
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

export interface UnlinkedResults { count: number; average: number | null; last: string | null }

/** The same bands the gap-map API colours a topic by. */
function statusForScore(p: number | null): MasteryStatus {
  if (p === null) return 'not_assessed'
  return p >= 80 ? 'mastered' : p >= 50 ? 'developing' : 'gap'
}

function shortDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function ScorePill({ score }: { score: number | null }) {
  const s = statusForScore(score)
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-extrabold tabular-nums ${BADGE[s]}`}>
      <Glyph kind={STATUS[s].glyph} />
      {score === null ? '—' : `${Math.round(score)}%`}
    </span>
  )
}

/**
 * Quizzes that could not colour the wall, with their scores.
 *
 * A quiz colours the wall only when it recorded the chapters it covered, and
 * most taken before July 2026 did not -- nor do teacher-set ones, which are
 * saved without a quiz behind them. Those students saw every chapter "not
 * tested", or a message telling them to take a quiz they had already taken.
 */
function QuizResults({ unplaced, unlinked, lead }: { unplaced: UnplacedSubject[]; unlinked: UnlinkedResults | null; lead: boolean }) {
  return (
    <section aria-labelledby="wall-quiz-results" className="rounded-[20px] border border-ss-line bg-ss-chip p-5 sm:p-6">
      <h3 id="wall-quiz-results" className="text-[16px] font-extrabold text-ss-ink">
        {lead ? 'Your quiz results' : 'Quizzes the wall cannot show'}
      </h3>
      <p className="mt-1 max-w-2xl text-[13.5px] font-medium text-ss-slate">
        These quizzes did not record which chapters they covered, so they cannot colour the wall. Your scores
        are here. A quiz you take on a textbook&apos;s chapters fills the wall in by itself.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {unplaced.map((s) => (
          <div key={s.subject} className="min-w-0 rounded-[16px] border border-ss-line bg-ss-panel p-4">
            <p className="truncate text-[14.5px] font-extrabold text-ss-ink" title={s.subject}>{s.subject}</p>
            <p className="text-[12.5px] font-semibold text-ss-slate">
              {s.quizzes.length} {s.quizzes.length === 1 ? 'quiz' : 'quizzes'}
              {s.average !== null ? ` · average ${s.average}%` : ''}
            </p>
            <ul className="mt-3 space-y-1.5">
              {s.quizzes.slice(0, 5).map((q, i) => (
                <li key={q.id || `${s.subject}-${i}`} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-semibold text-ss-ink" title={q.label}>
                    {q.label}
                    {q.created_at && <span className="ml-2 font-medium text-ss-slate">{shortDate(q.created_at)}</span>}
                  </span>
                  <ScorePill score={q.percentage} />
                </li>
              ))}
            </ul>
            {s.quizzes.length > 5 && (
              <p className="mt-2 text-[12px] font-semibold text-ss-slate">and {s.quizzes.length - 5} more</p>
            )}
          </div>
        ))}
        {unlinked && (
          <div className="min-w-0 rounded-[16px] border border-ss-line bg-ss-panel p-4">
            <p className="text-[14.5px] font-extrabold text-ss-ink">Other quizzes</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-semibold text-ss-slate">
                {unlinked.count} {unlinked.count === 1 ? 'quiz' : 'quizzes'}
                {unlinked.last ? `, latest ${shortDate(unlinked.last)}` : ''}
              </p>
              {unlinked.average !== null && <ScorePill score={unlinked.average} />}
            </div>
            <p className="mt-2 text-[13px] font-medium text-ss-slate">
              These were not linked to a subject, such as quizzes a teacher set, so they cannot appear on the wall.
              The score is your average across them.
            </p>
          </div>
        )}
      </div>
    </section>
  )
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
  canQuiz,
  busy = false,
  unlinked = null,
}: {
  /** Raw `textbooks` array from the gap-map API. */
  subjects: readonly unknown[]
  /** Results saved with no quiz behind them, from the gap-map API's `unlinked_results`. */
  unlinked?: UnlinkedResults | null
  onStudy: (tile: WallTile) => void
  onQuiz?: (tile: WallTile) => void
  /**
   * Whether this topic can be quizzed at all. A topic with no textbook or no
   * topic id behind it has nothing to generate from, and offering the button
   * there would promise a quiz that cannot be built.
   */
  canQuiz?: (tile: WallTile) => boolean
  busy?: boolean
}) {
  const all = useMemo(() => buildWall(subjects, canonicalSubject), [subjects])
  const unplaced = useMemo(() => unplacedQuizzes(subjects, canonicalSubject), [subjects])
  const totals = useMemo(() => wallSummary(all), [all])
  const priorities = useMemo(() => priorityTiles(all, 3), [all])

  // Below this, "Fix these first" is showing the same chips that are visible a
  // few lines down — the wall already sorts gaps to the front. Three cards
  // above a three-chip wall is the same information twice.
  const assessedCount = totals.gap + totals.developing + totals.mastered
  const worthLifting = assessedCount > 8

  const [query, setQuery] = useState('')
  // On by default: what is left is the point. The first wall hid these and a
  // student with six of forty topics tested, all correct, saw "6 of 6 solid"
  // and read it as being on track.
  const [showUntested, setShowUntested] = useState(true)
  const [selected, setSelected] = useState<WallTile | null>(null)

  // Switching subject used to leave the panel open on a topic from the subject
  // you just left. Keyed on the tile still existing rather than on the subject
  // prop, so a topic that disappears for any reason takes the panel with it.
  useEffect(() => {
    if (!selected) return
    if (!all.some((section) => section.tiles.some((t) => t.key === selected.key))) {
      setSelected(null)
    }
  }, [all, selected])

  // Searching should reach an untested topic too — otherwise looking for one
  // by name silently finds nothing.
  const sections = useMemo(
    () => filterWall(all, { query, includeUntested: showUntested || query.trim().length > 0 }),
    [all, query, showUntested],
  )

  const hasUnplaced = unplaced.length > 0 || !!unlinked

  if (all.length === 0) {
    // Quizzes taken but none of them placeable: show them, not an invitation
    // to take the quiz they already took.
    if (hasUnplaced) return <QuizResults unplaced={unplaced} unlinked={unlinked} lead />
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
      {/* Nothing on the wall is coloured: the results come first, or the
          student reads a wall of "not tested" as their quizzes being lost. */}
      {hasUnplaced && assessedCount === 0 && <QuizResults unplaced={unplaced} unlinked={unlinked} lead />}

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
        {/* A bordered pill of grey text read as a caption rather than a control.
            It carries an icon, a filled state and a switch now, so it looks
            like something that does something. */}
        {totals.not_assessed > 0 && (
          <button
            type="button"
            onClick={() => setShowUntested((v) => !v)}
            aria-pressed={showUntested}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2.5 text-[13px] font-extrabold transition-colors ${
              showUntested
                ? 'border-ss-accent bg-[color:var(--ss-accent)]/[0.10] text-ss-accent'
                : 'border-ss-line bg-ss-chip text-ss-ink hover:border-ss-accent'
            }`}
          >
            {showUntested ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            <span>
              {totals.not_assessed} not tested
              <span className="ml-1.5 font-bold opacity-70">{showUntested ? 'shown' : 'hidden'}</span>
            </span>
            <span
              aria-hidden
              className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                showUntested ? 'bg-ss-accent' : 'bg-ss-line'
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                  showUntested ? 'left-3.5' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        )}
      </div>

      {/* The work, lifted out so it is not something you have to go and find. */}
      {priorities.length > 0 && worthLifting && !query.trim() && (
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
                  ? `${section.solidRatio.solid} of ${section.solidRatio.assessed} tested topics solid`
                  : 'Nothing tested yet'}
                {section.counts.gap > 0 && (
                  <span className="ml-2 font-bold text-ss-bad">
                    {section.counts.gap} {section.counts.gap === 1 ? 'gap' : 'gaps'}
                  </span>
                )}
              </p>
            </div>

            {/* How much of the subject has been seen at all. Without this,
                "6 of 6 solid" reads as finished when it means six of forty. */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12.5px] font-bold text-ss-ink">
                  {section.coverage.tested} of {section.coverage.total} topics quizzed so far
                </p>
                <p className="text-[12px] font-semibold text-ss-slate">
                  {section.coverage.total - section.coverage.tested} still to go
                </p>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ss-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={section.coverage.total}
                aria-valuenow={section.coverage.tested}
                aria-label={`${section.subject}: ${section.coverage.tested} of ${section.coverage.total} topics quizzed`}
              >
                <div
                  className="h-full rounded-full bg-ss-accent"
                  style={{
                    width: `${section.coverage.total > 0 ? (section.coverage.tested / section.coverage.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {section.groups.map((group) => (
                <div key={group.topic || '_'}>
                  {group.topic && (
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[12.5px] font-bold text-ss-ink">{group.topic}</p>
                      <p className="text-[12px] font-semibold text-ss-slate">
                        {group.tiles.filter((t) => t.status !== 'not_assessed').length} of{' '}
                        {group.tiles.length} quizzed
                      </p>
                    </div>
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

      {/* Some subjects coloured, others only quizzes that recorded no
          chapters: those results after the wall, not lost. */}
      {hasUnplaced && assessedCount > 0 && <QuizResults unplaced={unplaced} unlinked={unlinked} lead={false} />}

      {/* Detail for one chip. A panel rather than a hover card: there is no
          hover on a phone, and this is a phone-first screen. */}
      {selected && (
        /* The panel used to float with a four-unit gap beneath it, so the wall
           scrolled visibly through the gap and it read as stuck rather than
           deliberate. The sticky element is this band, painted in the page's
           own surface and fading at its top edge; nothing passes under it. */
        <div className="sticky bottom-0 z-20 -mx-1 bg-gradient-to-t from-[color:var(--ss-panel)] from-70% to-transparent px-1 pb-4 pt-6">
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${selected.label} detail`}
          className="overflow-hidden rounded-[20px] border-2 border-[color:var(--ss-ink)]/10 bg-ss-panel shadow-[0_24px_48px_-20px_rgba(22,32,42,0.45)]"
        >
          {/* A bar in the topic's own colour, so the panel announces itself
              against a page of white cards instead of becoming another one. */}
          <span aria-hidden className={`block h-1.5 w-full ${BADGE[selected.status]}`} />

          <div className="flex items-start justify-between gap-4 p-5 pb-0">
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
              <p className="mt-1.5 text-[13px] font-medium text-ss-slate">
                {STATUS[selected.status].hint}
                {selected.status === 'not_assessed'
                  ? ' — quiz yourself to find out where you stand.'
                  : ' Study it, then retake to see the score move.'}
              </p>
            </div>
            {/* A small grey glyph was easy to miss; this is a real target with
                a border and a word beside it. */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ss-line px-3 py-1.5 text-[12.5px] font-bold text-ss-slate transition-colors hover:border-ss-bad hover:text-ss-bad"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2 p-5 pt-4">
            <button
              type="button"
              onClick={() => onStudy(selected)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {busy ? 'Building…' : 'Build me a lesson'}
            </button>
            {onQuiz && (!canQuiz || canQuiz(selected)) && (
              <button
                type="button"
                onClick={() => onQuiz(selected)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ss-line px-5 py-2.5 text-[13.5px] font-bold text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent disabled:opacity-60"
              >
                {selected.status === 'not_assessed' ? 'Quiz me on this' : 'Retake this topic'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
