'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { Kana } from '@/components/studylab/kana/Kana'
import { pickPracticeCard } from '@/lib/studylab/practice-card'
import { subjectStyle } from '@/lib/studylab/subjectFamily'

const Card = ActivityNode as unknown as React.ComponentType<{ id: string; data: unknown }>
const noop = { onToggleGroup: () => {}, onNodeDataChange: () => {}, onDeleteNode: () => {}, onAskTutor: () => {}, onNodeResize: () => {} }

/** The width every scene card is designed at. */
const CARD_WIDTH = 460

/**
 * A real practice card for the chapter, played here with nothing saved, or when
 * no card fits, five quick questions to warm up on. `names` runs from the
 * selected section to the chapter itself. The side column is narrower than a
 * card, so the card is scaled to fit and can open at full size.
 */
export default function TryIt({ names, subject, onQuiz, busy }: {
  names: string[]
  subject: string
  onQuiz: (count: number) => void
  busy: boolean
}) {
  const key = names.join('|')
  const card = useMemo(() => pickPracticeCard(names, subject), [key, subject]) // eslint-disable-line react-hooks/exhaustive-deps
  const spec = useMemo(() => card && ({
    pattern: 'scene', prompt: card.example.prompt, payload: { engine: card.engineId, config: card.example.config }, success: { kind: 'scene' },
    intent: { goal: 'x', isolates: 'position', apparatus: `scene:${card.engineId}`, why: 'x' },
  }), [card])

  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const show = () => { setOpen(true); dlg.current?.showModal() }
  const hide = () => { dlg.current?.close(); setOpen(false) }

  const fit = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const el = fit.current
    if (!el) return
    const seen = new ResizeObserver(([entry]) => setZoom(Math.min(1, entry.contentRect.width / CARD_WIDTH)))
    seen.observe(el)
    return () => seen.disconnect()
  }, [card])

  const live = card && spec && (
    <CanvasContext.Provider value={noop as never}>
      <ReactFlowProvider>
        <Card id={`tryit-${card.engineId}`} data={{ spec }} key={`${card.engineId}:${card.example.prompt}`} />
      </ReactFlowProvider>
    </CanvasContext.Provider>
  )

  return (
    <section className={`ss-rack-try${card ? ' ss-rack-try-panel' : ''}`} aria-label={card ? 'Try it with me first' : 'A quick one to warm up'}>
      <div className="ss-rack-try-h">
        <Kana pose="happy" size={44} simple />
        <h3>{card ? 'Try it with me first' : 'A quick one to warm up'}</h3>
      </div>
      {card && spec ? (
        <>
          <div ref={fit} style={subjectStyle(subject)} className="ss-rack-try-card ss-lesson">
            {!open && <div style={{ width: CARD_WIDTH, zoom }}>{live}</div>}
          </div>
          {zoom < 1 && <button type="button" className="ss-rack-try-more" onClick={show}>Make it bigger</button>}
          <dialog ref={dlg} className="ss-rack-try-dlg" aria-label="Try it with me first" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dlg.current) hide() }}>
            <div style={subjectStyle(subject)} className="ss-rack-try-card ss-lesson">{open && live}</div>
            <button type="button" className="ss-rack-q" onClick={hide}>Close</button>
          </dialog>
        </>
      ) : (
        <div className="ss-rack-try-quiet">
          <p>Five quick questions show me where you stand.</p>
          <button type="button" className="ss-rack-go" disabled={busy} onClick={() => onQuiz(5)}>Quiz me</button>
        </div>
      )}
    </section>
  )
}
