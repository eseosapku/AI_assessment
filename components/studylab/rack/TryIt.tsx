'use client'

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Kana } from '@/components/studylab/kana/Kana'
import { pickPracticeEntry } from '@/lib/studylab/practice-card'

// The engines, xyflow and katex are a big download, so they load only for a chapter that has a card.
const LiveCard = dynamic(() => import('@/components/studylab/rack/LiveCard'), {
  ssr: false,
  loading: () => <div className="ss-rack-try-card" style={{ minHeight: 160 }} aria-busy="true" />,
})

/** A failed chunk or a throw from an engine must not reach the app's error screen. */
class CardBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) {
    console.error('Practice card failed:', error)
    this.props.onError()
  }
  render() { return this.state.failed ? null : this.props.children }
}

/**
 * A real practice card for the chapter, played here with nothing saved, or when
 * no card fits (or it fails to load), five quick questions to warm up on. `names`
 * runs from the selected section to the chapter itself; `bookName` is the
 * chapter's real book, which decides the colour family the card was judged under.
 */
export default function TryIt({ names, subject, bookName, onQuiz, busy }: {
  names: string[]
  subject: string
  bookName: string
  onQuiz: (count: number) => void
  busy: boolean
}) {
  const key = names.join('|')
  const entry = useMemo(() => pickPracticeEntry(names, bookName), [key, bookName]) // eslint-disable-line react-hooks/exhaustive-deps
  const entryKey = entry ? `${entry.engineId}:${entry.exampleIndex}` : ''
  const [failed, setFailed] = useState<string | null>(null)
  const card = entry && failed !== entryKey ? entry : null
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (!busy) setPressed(false)
  }, [busy])

  return (
    <section className={`ss-rack-try${card ? ' ss-rack-try-panel' : ''}`} aria-label={card ? 'Try it with me first' : 'A quick one to warm up'}>
      <div className="ss-rack-try-h">
        <Kana pose="happy" size={44} simple />
        <h3>{card ? 'Try it with me first' : 'A quick one to warm up'}</h3>
      </div>
      {card ? (
        <CardBoundary key={entryKey} onError={() => setFailed(entryKey)}>
          <LiveCard engineId={card.engineId} exampleIndex={card.exampleIndex} subject={subject} />
        </CardBoundary>
      ) : (
        <div className="ss-rack-try-quiet">
          <p>Five quick questions show me where you stand.</p>
          <button type="button" className="ss-rack-go" disabled={busy} aria-busy={busy && pressed ? true : undefined} onClick={() => { setPressed(true); onQuiz(5) }}>
            {busy && pressed ? (<><Loader2 className="ss-rack-spin" aria-hidden="true" />Building your quiz…</>) : 'Quiz me'}
          </button>
          {busy && pressed && <span className="sr-only" role="status">Building your quiz. This can take up to half a minute.</span>}
        </div>
      )}
    </section>
  )
}
