'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, FileQuestion, Search } from 'lucide-react'
import { subjectArt } from '@/lib/studio/subjectArt'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { matchesSearch, placeOf, stepWords, type HubLesson } from '@/lib/studylab/hubLessons'

const PAGE = 12

/** A lesson's own trail, small: what is behind them, where they are, what is left. */
export function TrailDots({ lesson, large = false }: { lesson: HubLesson; large?: boolean }) {
  const place = placeOf(lesson)
  const steps = lesson.steps ?? []
  if (place.kind !== 'underway' || steps.length === 0) return null
  const dot = large ? 14 : 8
  return (
    <span role="img" aria-label={stepWords(lesson, place)} className="flex min-w-0 flex-1 items-center">
      {steps.map((step, i) => {
        const current = i + 1 === place.at
        const behind = i + 1 < place.at
        return (
          <span key={i} className={`flex items-center ${i === 0 ? '' : 'flex-1'}`} style={{ maxWidth: i === 0 ? undefined : large ? 96 : 28 }}>
            {i > 0 && <span className="h-[2px] flex-1" style={{ background: behind || current ? 'var(--subject)' : 'var(--ss-line)' }} />}
            <span
              className="shrink-0 rounded-full"
              style={{
                width: dot,
                height: dot,
                background: behind ? 'var(--subject)' : 'var(--ss-panel)',
                border: `${large ? 3 : 2}px solid ${behind || current ? 'var(--subject)' : 'var(--ss-line)'}`,
              }}
            />
          </span>
        )
      })}
    </span>
  )
}

function Art({ lesson, size }: { lesson: HubLesson; size: number }) {
  if (lesson.origin === 'homework' && lesson.thumb) {
    // The page they photographed is what they will recognise it by.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={lesson.thumb} alt="" aria-hidden className="shrink-0 rounded-lg border border-ss-line bg-white object-cover object-top" style={{ width: size, height: size }} />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={subjectArt(lesson.subject)} alt="" aria-hidden className="shrink-0 object-contain" style={{ width: size, height: size }} />
}

/** The lesson to carry on with, looking as the card at work does in a lesson. */
export function CarryOn({ lesson, onOpen }: { lesson: HubLesson; onOpen: (id: string) => void }) {
  const place = placeOf(lesson)
  return (
    <section aria-label="Your next lesson" className="ss-lesson ss-hub-focus" style={subjectStyle(lesson.subject ?? lesson.title)}>
      <div className="flex items-start gap-4">
        <Art lesson={lesson} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="ss-hub-focus-title">{lesson.title}</h2>
          {lesson.subject && <p className="mt-0.5 text-[14px] font-semibold text-ss-slate">{lesson.subject}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          {place.kind === 'underway' && (
            <>
              <TrailDots lesson={lesson} large />
              <p className="mt-2.5 text-[14.5px] text-ss-ink">
                <span className="font-bold">{stepWords(lesson, place)}</span>
                {place.title ? `: ${place.title}` : ''}
              </p>
            </>
          )}
          {place.kind === 'new' && <p className="text-[14.5px] text-ss-ink">Not started yet.</p>}
        </div>
        <button type="button" onClick={() => onOpen(lesson.id)} className="ss-trail-go ss-hub-go">
          {place.kind === 'new' ? 'Start' : 'Continue'}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </section>
  )
}

function LessonCard({ lesson, onOpen }: { lesson: HubLesson; onOpen: (id: string) => void }) {
  const place = placeOf(lesson)
  const date = formatDate(lesson.updated_at)
  return (
    <button type="button" onClick={() => onOpen(lesson.id)} className="ss-lesson ss-hub-card" style={subjectStyle(lesson.subject ?? lesson.title)}>
      <Art lesson={lesson} size={40} />
      <span className="flex min-h-[72px] min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-[14.5px] font-bold leading-snug text-ss-ink">{lesson.title}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ss-slate">
          {lesson.origin === 'homework' && <FileQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{lesson.origin === 'homework' ? 'Homework' : lesson.subject}</span>
        </span>
        <span className="mt-auto flex items-center gap-3 pt-2 text-[12.5px] text-ss-slate">
          {place.kind === 'completed' && (
            <span className="flex flex-1 items-center gap-1 font-semibold text-ss-good">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Completed
            </span>
          )}
          {place.kind === 'new' && <span className="flex-1">Not started</span>}
          {place.kind === 'underway' && (place.total ? <TrailDots lesson={lesson} /> : <span className="flex-1">{stepWords(lesson, place)}</span>)}
          {date && <span className="ml-auto shrink-0">{date}</span>}
        </span>
      </span>
    </button>
  )
}

/** Everything else, a few at a time: on a long list the page is for finding one lesson, not reading them all. */
export function LessonShelf({
  inProgress,
  completed,
  onOpen,
  onBuild,
}: {
  inProgress: HubLesson[]
  completed: HubLesson[]
  onOpen: (id: string) => void
  onBuild: (topic: string) => void
}) {
  const [shelf, setShelf] = useState<'progress' | 'completed'>('progress')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const active = shelf === 'progress' && inProgress.length === 0 ? 'completed' : shelf === 'completed' && completed.length === 0 ? 'progress' : shelf
  const lessons = active === 'progress' ? inProgress : completed
  const found = useMemo(() => lessons.filter((l) => matchesSearch(l, query)), [lessons, query])
  const visible = found.slice(0, shown)
  const left = found.length - visible.length

  const pick = (next: 'progress' | 'completed') => {
    setShelf(next)
    setShown(PAGE)
  }

  return (
    <section data-tour="learnspace-list" aria-label="Your lessons" className="mt-10">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1">
          {inProgress.length > 0 && <ShelfTab label="In progress" count={inProgress.length} on={active === 'progress'} onPick={() => pick('progress')} />}
          {completed.length > 0 && <ShelfTab label="Completed" count={completed.length} on={active === 'completed'} onPick={() => pick('completed')} />}
        </div>
        {(inProgress.length + completed.length) > PAGE && (
          <label className="ss-hub-search ml-auto">
            <Search className="h-4 w-4 shrink-0 text-ss-slate" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
              aria-label="Find a lesson"
              placeholder="Find a lesson"
            />
          </label>
        )}
      </div>

      {found.length > 0 ? (
        <div className="ss-hub-grid mt-4">
          {visible.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onOpen={onOpen} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-ss-line px-6 py-8 text-center">
          <p className="text-[14.5px] font-bold text-ss-ink">No lesson here matches &ldquo;{query.trim()}&rdquo;.</p>
          <button type="button" onClick={() => onBuild(query.trim())} className="mt-2 text-[14px] font-bold text-ss-accent hover:underline">
            Build a lesson on it
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {left > 0 ? (
          <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="ss-hub-side">
            Show {Math.min(left, PAGE * 2)} more
          </button>
        ) : <span />}
      </div>
    </section>
  )
}

function ShelfTab({ label, count, on, onPick }: { label: string; count: number; on: boolean; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick} className="ss-hub-tab" data-on={on}>
      {label} <span className="tabular-nums font-semibold text-ss-slate">{count}</span>
    </button>
  )
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
