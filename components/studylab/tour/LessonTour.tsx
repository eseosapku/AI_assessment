'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Kana } from '../kana/Kana'
import { hasSeenDemo, markDemoSeen } from '@/lib/studylab/demoGate'
import { placeCard, type Box } from '@/lib/studylab/tour/place'
import { stepsPresent, type TourStep } from '@/lib/studylab/tour/steps'
import { boxOf, findAnchor, reducedMotion, useFollow } from './useFollow'

const PAD = 8
const GLIDE_MS = 260
const CARD_W = 344

/** The board step points at the card in front, not the whole board, so the dimming means something. */
function findStepTarget(step: TourStep): HTMLElement | null {
  if (step.anchor === 'lesson-board') return document.querySelector<HTMLElement>('.ss-trail-frame[data-role="focus"]') ?? findAnchor('lesson-board')
  return step.anchor ? findAnchor(step.anchor) : null
}

function visibleAnchors(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-tour]'))
    .filter((el) => boxOf(el))
    .map((el) => el.getAttribute('data-tour') ?? '')
}

/**
 * The first-lesson introduction. Kana offers a tour in a small card; if it is
 * accepted, one fixed overlay dims the screen and cuts a hole round one real
 * control at a time. Its position is read straight from the control every frame
 * and written into two elements, so nothing on the board re-renders.
 */
export function LessonTour({ ready, replay, onActive }: {
  /** The opening animation is over and the lesson is on screen. */
  ready: boolean
  /** Bumped by the Board menu to play the tour again. */
  replay: number
  onActive: (active: boolean) => void
}) {
  const [mode, setMode] = useState<'off' | 'offer' | 'tour'>('off')
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const offered = useRef(false)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => onActive(mode !== 'off'), [mode, onActive])

  // Offered once, on a first lesson, a moment after the lesson is on screen.
  useEffect(() => {
    if (!ready || offered.current || hasSeenDemo()) return
    offered.current = true
    const t = setTimeout(() => setMode('offer'), 700)
    return () => clearTimeout(t)
  }, [ready])

  const begin = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null
    setSteps(stepsPresent(visibleAnchors()))
    setIndex(0)
    setMode('tour')
  }, [])
  const lastReplay = useRef(replay)
  useEffect(() => {
    if (replay !== lastReplay.current) {
      lastReplay.current = replay
      begin()
    }
  }, [replay, begin])

  const end = useCallback(() => {
    setMode('off')
    requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus({ preventScroll: true }))
  }, [])
  const accept = useCallback(() => {
    markDemoSeen()
    begin()
  }, [begin])
  const decline = useCallback(() => {
    markDemoSeen()
    setMode('off')
  }, [])

  if (!mounted || mode === 'off') return null
  if (mode === 'offer') return createPortal(<Offer onAccept={accept} onDecline={decline} />, document.body)
  return createPortal(<Tour steps={steps} index={index} setIndex={setIndex} onEnd={end} />, document.body)
}

function Offer({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus({ preventScroll: true }), [])
  return (
    <div role="dialog" aria-label="Show me around" className="ss-tour-offer ss-tour-pop">
      <div className="flex items-start gap-3">
        <div className="shrink-0" aria-hidden>
          <Kana pose="happy" size={56} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[17px] font-bold leading-snug text-ss-ink">First time here?</p>
          <p className="mt-1 text-[15px] leading-snug text-ss-slate">Let me show you around. It takes a minute.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onDecline} className="ss-press ss-tour-ghost">
          I&rsquo;ll explore
        </button>
        <button ref={first} type="button" onClick={onAccept} className="ss-press ss-tour-primary">
          Show me around
        </button>
      </div>
    </div>
  )
}

function Tour({ steps, index, setIndex, onEnd }: { steps: TourStep[]; index: number; setIndex: (i: number) => void; onEnd: () => void }) {
  const step = steps[index]
  const last = index === steps.length - 1
  const hole = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const glide = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<Box | null>(null)

  const find = useMemo(() => (step ? () => (step.anchor ? findStepTarget(step) : null) : null), [step])

  // Writes the cut-out and the card straight into the DOM.
  const draw = useCallback((box: Box | null) => {
    boxRef.current = box
    const h = hole.current
    const c = card.current
    if (!h || !c) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const target = box
      ? (() => {
          const x = Math.max(0, box.x - PAD)
          const y = Math.max(0, box.y - PAD)
          return { x, y, w: Math.min(vw, box.x + box.w + PAD) - x, h: Math.min(vh, box.y + box.h + PAD) - y }
        })()
      : { x: vw / 2, y: vh / 2, w: 0, h: 0 }
    h.style.width = `${target.w}px`
    h.style.height = `${target.h}px`
    h.style.transform = `translate(${target.x}px, ${target.y}px)`
    const p = placeCard(box ? target : null, { w: c.offsetWidth, h: c.offsetHeight }, { w: vw, h: vh })
    c.style.transform = `translate(${p.x}px, ${p.y}px)`
  }, [])
  useFollow(find, draw)
  // The closing card has nothing to follow: centre it.
  useEffect(() => {
    if (step && !step.anchor) draw(null)
  }, [step, draw])

  // A new step glides; while it follows a moving control the transition is off, so it never trails behind.
  useEffect(() => {
    const els = [hole.current, card.current]
    if (!reducedMotion()) {
      els.forEach((e) => e?.classList.add('ss-tour-glide'))
      if (glide.current) clearTimeout(glide.current)
      glide.current = setTimeout(() => els.forEach((e) => e?.classList.remove('ss-tour-glide')), GLIDE_MS + 40)
    }
    next.current?.focus({ preventScroll: true })
    return () => {
      if (glide.current) clearTimeout(glide.current)
    }
  }, [index])

  const go = useCallback(
    (to: number) => {
      if (to >= steps.length) onEnd()
      else setIndex(Math.max(0, to))
    },
    [steps.length, setIndex, onEnd],
  )

  // Esc skips; Tab stays inside the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onEnd()
      } else if (e.key === 'Tab') {
        const items = Array.from(card.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
        if (items.length === 0) return
        const i = items.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onEnd])

  if (!step) return null
  return (
    <>
      {/* Blocks every click, the lit control's too: Next is what moves on. */}
      <div className="ss-tour-block" aria-hidden onPointerDown={(e) => e.preventDefault()} />
      <div ref={hole} className="ss-tour-hole" aria-hidden />
      <div ref={card} role="dialog" aria-modal="true" aria-label="Tour" aria-describedby="ss-tour-body" className="ss-tour-card" style={{ width: CARD_W }}>
        <div className="flex items-start gap-3" aria-live="polite" aria-atomic="true">
          <div className="shrink-0" aria-hidden>
            <Kana pose="happy" size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-bold leading-snug text-ss-ink">{step.title}</p>
            <p id="ss-tour-body" className="mt-1 text-[15px] leading-snug text-ss-slate">
              {step.body}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`} role="img">
            {steps.map((s, i) => (
              <span key={s.id} className="h-2 rounded-full" style={{ width: i === index ? 18 : 8, background: i === index ? 'var(--subject)' : 'var(--ss-slate)', opacity: i === index ? 1 : 0.35, transition: 'width 160ms ease-out' }} />
            ))}
          </div>
          <button type="button" onClick={onEnd} className="min-h-[44px] rounded-lg px-2 text-[14px] font-semibold text-ss-slate hover:text-ss-ink">
            Skip tour
          </button>
        </div>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="ss-press ss-tour-ghost">
            Back
          </button>
          <button ref={next} type="button" onClick={() => go(index + 1)} className="ss-press ss-tour-primary">
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
