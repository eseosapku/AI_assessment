'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { getEngine } from '@/lib/studylab/engines'
import { examplesOf } from '@/lib/studylab/engines/examples'
import { subjectStyle } from '@/lib/studylab/subjectFamily'

const Card = ActivityNode as unknown as React.ComponentType<{ id: string; data: unknown }>
const noop = { onToggleGroup: () => {}, onNodeDataChange: () => {}, onDeleteNode: () => {}, onAskTutor: () => {}, onNodeResize: () => {} }

/** The width every scene card is designed at (the frame is w-[420px]). */
const CARD_WIDTH = 420
/** Below this the card fills its column at full size, as the Trail does, instead of being scaled down. */
const PHONE = '(max-width: 699px)'

/**
 * The live practice card, played here with nothing saved. Everything that pulls in the engines,
 * xyflow and katex lives in this file so the rack only loads it when a card exists. It throws if
 * the engine or example is missing, which TryIt's boundary turns into the quiet quiz panel.
 */
export default function LiveCard({ engineId, exampleIndex, subject }: { engineId: string; exampleIndex: number; subject: string }) {
  const found = useMemo(() => {
    const engine = getEngine(engineId)
    const example = engine ? examplesOf(engine)[exampleIndex] : undefined
    if (!engine || !example) throw new Error(`No practice card for ${engineId}:${exampleIndex}`)
    return { engine, example }
  }, [engineId, exampleIndex])

  const spec = useMemo(() => ({
    pattern: 'scene', prompt: found.example.prompt, payload: { engine: found.engine.id, config: found.example.config }, success: { kind: 'scene' },
    intent: { goal: 'x', isolates: 'position', apparatus: `scene:${found.engine.id}`, why: 'x' },
  }), [found])

  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const show = () => { setOpen(true); dlg.current?.showModal() }
  const hide = () => { dlg.current?.close(); setOpen(false) }

  const fit = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [phone, setPhone] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const el = fit.current
    if (!el) return
    const mq = window.matchMedia(PHONE)
    const measure = (width: number) => {
      setPhone(mq.matches)
      setZoom(mq.matches ? 1 : Math.min(1, width / CARD_WIDTH))
      setOverflows(mq.matches && el.scrollWidth > el.clientWidth + 1)
    }
    const seen = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    seen.observe(el)
    measure(el.clientWidth)
    return () => seen.disconnect()
  }, [])

  const live = (
    <CanvasContext.Provider value={noop as never}>
      <ReactFlowProvider>
        <Card id={`tryit-${found.engine.id}`} data={{ spec }} key={`${found.engine.id}:${found.example.prompt}`} />
      </ReactFlowProvider>
    </CanvasContext.Provider>
  )

  return (
    <>
      <div ref={fit} style={subjectStyle(subject)} className="ss-rack-try-card ss-lesson">
        {!open && <div style={phone ? undefined : { width: CARD_WIDTH, zoom }}>{live}</div>}
      </div>
      {(phone ? overflows : zoom < 1) && <button type="button" className="ss-rack-try-more" onClick={show}>Make it bigger</button>}
      <dialog ref={dlg} className="ss-rack-try-dlg" aria-label="Try it with me first" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dlg.current) hide() }}>
        <div style={subjectStyle(subject)} className="ss-rack-try-card ss-lesson">{open && live}</div>
        <button type="button" className="ss-rack-q" onClick={hide}>Close</button>
      </dialog>
    </>
  )
}
