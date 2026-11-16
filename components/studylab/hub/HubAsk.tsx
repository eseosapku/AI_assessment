'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { KanaLive } from '@/components/studylab/trail/KanaLive'

/** Shown to someone with no lessons yet: the kind of question that works best. */
const SUGGESTIONS: Array<{ topic: string; subject: string }> = [
  { topic: 'Why leaves are green', subject: 'Biology' },
  { topic: 'Completing the square', subject: 'Mathematics' },
  { topic: 'How a transistor switches', subject: 'Physics' },
  { topic: 'Why prices settle where they do', subject: 'Economics' },
]

/**
 * Kana asks, on the page, and the answer is the lesson: no dialog in between. She stands
 * on the same line as the box she is asking about, as she stands on the dock in a lesson.
 */
export function HubAsk({
  userId,
  seedSubject,
  fill,
  firstTime,
  demoSeen,
  onCreated,
  onHomework,
}: {
  userId: string
  /** Arriving from "Study this" on a weak subject: the lesson is pitched at that subject. */
  seedSubject: string
  /** A topic handed in from elsewhere on the page. `at` lets the same one be sent twice. */
  fill: { topic: string; at: number } | null
  firstTime: boolean
  demoSeen: boolean
  onCreated: (id: string) => void
  onHomework: () => void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!seedSubject) return
    setSubject(seedSubject)
    input.current?.focus()
  }, [seedSubject])

  useEffect(() => {
    if (!fill) return
    setTitle(fill.topic)
    input.current?.focus()
  }, [fill])

  const ready = title.trim().length > 0

  const submit = async () => {
    if (!ready || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title: title.trim(), subject: subject.trim(), origin: 'scratch' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not build that lesson. Try again.')
      setTitle('')
      setSubject('')
      onCreated(json.data.id)
    } catch (err: any) {
      setError(err.message || 'Could not build that lesson. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="hub-ask" className="ss-hub-ask">
      <KanaLive pose="open" size={150} crop onPoke={() => input.current?.focus()} className="ss-hub-kana" />

      <div className="min-w-0">
        <h1 id="hub-ask" className="ss-hub-title">What do you want to learn?</h1>

        <form
          data-tour="learnspace-new"
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="ss-hub-field">
            {subject && (
              <span className="ss-hub-seed">
                <span className="truncate">{subject}</span>
                <button type="button" aria-label={`Not just ${subject}`} onClick={() => setSubject('')}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            )}
            <input
              ref={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="What do you want to learn?"
              aria-describedby="hub-ask-hint"
              placeholder="Name what confused you"
            />
          </div>
          <div className="flex grow gap-2 sm:grow-0">
            <button type="submit" aria-disabled={!ready || submitting} className="ss-hub-build grow sm:grow-0" data-ready={ready}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {submitting ? 'Building…' : 'Build my lesson'}
            </button>
            <button type="button" data-tour="learnspace-homework" onClick={onHomework} className="ss-hub-side grow sm:grow-0">
              <Upload className="h-4 w-4" aria-hidden />
              Homework help
            </button>
          </div>
        </form>
      </div>

      <div className="ss-hub-ask-foot">
        {error ? (
          <p role="alert" className="mt-2 text-[13.5px] font-semibold text-ss-bad">{error}</p>
        ) : (
          <p id="hub-ask-hint" className="mt-2 text-[13.5px] text-ss-slate">
            The narrower the better: &ldquo;why leaves are green&rdquo; gets you an answer, &ldquo;photosynthesis&rdquo; a tour.
            {!demoSeen && (
              <>
                {' '}
                <a href="/studylab/demo" className="font-bold text-ss-accent hover:underline">See how a lesson works</a>
              </>
            )}
          </p>
        )}

        {firstTime && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Topics to try">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.topic}
                type="button"
                onClick={() => {
                  setTitle(s.topic)
                  setSubject(s.subject)
                  input.current?.focus()
                }}
                className="rounded-full border border-ss-line px-3 py-1.5 text-[13px] font-semibold text-ss-ink hover:border-ss-accent"
              >
                {s.topic}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
