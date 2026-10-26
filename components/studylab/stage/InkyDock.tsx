'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { Inky, type InkyMood } from '../inky/Inky'
import { SafeLatex } from '../canvasShared'
import { useMuted } from '@/lib/studylab/sound'
import { motionFor } from '@/lib/studylab/motionPresets'
import { latestLine, placeBubble, arrowBetween, type Rect } from '@/lib/studylab/bubble'
import { pointSelector } from '@/lib/studylab/point'
import type { ChatMessage } from '@/lib/studylab/types'

const COMPACT = { w: 240, h: 44 }

/**
 * Inky on the board, bottom-left, saying its latest line in a bubble.
 *
 * The chat is a drawer now and starts closed, so the tutor has to be readable
 * without opening anything. The bubble goes beside Inky, or above it, or
 * shrinks to a one-line pill -- whichever keeps it off the work in the
 * spotlight and off the bar under it.
 */
export function InkyDock({
  messages,
  suggestions,
  busy,
  working,
  quiet,
  hidden,
  focusIds,
  viewTick,
  onOpenChat,
  onAsk,
  onRetry,
  pointer = null,
  onReveal,
}: {
  messages: ChatMessage[]
  suggestions: string[]
  busy: boolean
  working: string
  /** A check is waiting to be answered: no chips, nothing to distract. */
  quiet: boolean
  /** The drawer is open and holds the conversation itself. */
  hidden: boolean
  /** What is in the spotlight, which the bubble must not cover. */
  focusIds: string[]
  /** Changes whenever the board's camera settles somewhere new. */
  viewTick: number
  onOpenChat: () => void
  onAsk: (text: string) => void
  onRetry: (action: Record<string, unknown>) => void
  /** The part the latest turn pointed at, until the next turn. */
  pointer?: { nodeId: string; part?: string } | null
  /** Brings a card into view: a part pointed at off screen. */
  onReveal?: (nodeId: string) => void
}) {
  const reduced = useReducedMotion() ?? false
  const line = latestLine(messages)
  const chips = !busy && !quiet && !hidden ? suggestions.slice(0, 3) : []

  // Inky talks for a moment when a new line arrives.
  const [talking, setTalking] = useState(false)
  const lastIndex = useRef<number | null>(null)
  useEffect(() => {
    if (!line || line.index === lastIndex.current) return
    const first = lastIndex.current === null
    lastIndex.current = line.index
    if (first) return
    setTalking(true)
    const t = setTimeout(() => setTalking(false), 2400)
    return () => clearTimeout(t)
  }, [line])
  const mood: InkyMood = busy
    ? 'thinking'
    : line && line.tone !== 'say'
      ? 'concerned'
      : talking
        ? 'talking'
        : 'idle'

  // Placement, measured against the board column this sits in.
  const rootRef = useRef<HTMLDivElement>(null)
  const inkyRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  // The part Inky is talking about. Found on the board, it glows, the bubble
  // keeps off it and the bubble's arrow reaches it; not found, nothing shows.
  const pointNode = pointer?.nodeId
  const pointPart = pointer?.part
  const pointKey = pointNode ? `${pointNode}|${pointPart ?? ''}` : ''
  const findPointed = useCallback((): HTMLElement | null => {
    const board = rootRef.current?.offsetParent as HTMLElement | null
    if (!board || !pointNode) return null
    return board.querySelector<HTMLElement>(pointSelector(pointNode, pointPart))
  }, [pointNode, pointPart])
  const [place, setPlace] = useState<{ x: number; y: number; compact: boolean; tail: 'left' | 'bottom'; w?: number } | null>(null)
  const measure = useCallback(() => {
    const board = rootRef.current?.offsetParent as HTMLElement | null
    const inky = inkyRef.current
    const bubble = bubbleRef.current
    if (!board || !inky || !bubble) return
    const origin = board.getBoundingClientRect()
    const rel = (r: DOMRect): Rect => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height })
    const avoid: Rect[] = []
    for (const id of focusIds) {
      const el = board.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
      if (el) avoid.push(rel(el.getBoundingClientRect()))
    }
    const dock = board.querySelector('[data-tour="lesson-continue"]')
    if (dock && dock.getBoundingClientRect().height > 0) avoid.push(rel(dock.getBoundingClientRect()))
    // The opening card, and anything else that marks itself as the stage's.
    board.querySelectorAll('[data-stage-avoid]').forEach((el) => avoid.push(rel(el.getBoundingClientRect())))
    const pointed = findPointed()
    if (pointed) avoid.push(rel(pointed.getBoundingClientRect()))
    setPlace(
      placeBubble({
        board: { x: 0, y: 0, w: origin.width, h: origin.height },
        inky: rel(inky.getBoundingClientRect()),
        avoid,
        size: { w: bubble.offsetWidth, h: bubble.offsetHeight },
        compact: COMPACT,
      }),
    )
  }, [focusIds, findPointed])

  // Every change re-measures from the full bubble: rendered unplaced (and
  // hidden) for a moment, measured, then placed -- all before the paint. A
  // bubble measured while it was the pill would think the full one fits.
  //
  // The counter is what makes a request always register: resetting `place` to
  // null alone did nothing when it was null already (the bubble was not drawn
  // while the chat was open), so it was never measured again and stayed
  // hidden -- line, chips and all -- after the chat closed.
  const text = busy ? working : line?.text
  const focusKey = focusIds.join('|')
  const [nonce, setNonce] = useState(0)
  const remeasure = useCallback(() => {
    setPlace(null)
    setNonce((n) => n + 1)
  }, [])
  useLayoutEffect(() => {
    remeasure()
  }, [text, chips.length, viewTick, hidden, focusKey, pointKey, remeasure])

  // The glow: on the part while it is pointed at. Kept on across camera moves
  // rather than set again, which would restart its pulse.
  const marked = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = findPointed()
    if (marked.current && marked.current !== el) marked.current.removeAttribute('data-pointed')
    if (el && !el.hasAttribute('data-pointed')) el.setAttribute('data-pointed', '')
    marked.current = el
  }, [findPointed, viewTick])
  useEffect(() => () => marked.current?.removeAttribute('data-pointed'), [])

  // A part pointed at off screen is brought into view, once -- after the
  // camera has framed the turn's new work, which may have brought it in.
  const revealed = useRef('')
  useEffect(() => {
    if (!pointKey || revealed.current === pointKey || !pointNode) return
    const t = setTimeout(() => {
      const board = rootRef.current?.offsetParent as HTMLElement | null
      const el = findPointed()
      if (!board || !el) return
      revealed.current = pointKey
      const r = el.getBoundingClientRect()
      const b = board.getBoundingClientRect()
      if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) onReveal?.(pointNode)
    }, 700)
    return () => clearTimeout(t)
  }, [pointKey, pointNode, findPointed, onReveal])

  // The arrow, from the placed bubble to the part.
  const [arrow, setArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  useLayoutEffect(() => {
    const board = rootRef.current?.offsetParent as HTMLElement | null
    const el = findPointed()
    const bubble = bubbleRef.current
    if (!board || !el || !bubble || !place || hidden) {
      setArrow(null)
      return
    }
    const origin = board.getBoundingClientRect()
    const rel = (r: DOMRect): Rect => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height })
    setArrow(arrowBetween(rel(bubble.getBoundingClientRect()), rel(el.getBoundingClientRect())))
  }, [place, findPointed, viewTick, hidden])
  useLayoutEffect(() => {
    if (!place) measure()
  }, [nonce, place, measure])
  useEffect(() => {
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [remeasure])

  // A long line is clamped to four lines; the rest is in the chat.
  const textRef = useRef<HTMLDivElement>(null)
  const [clamped, setClamped] = useState(false)
  useLayoutEffect(() => {
    const el = textRef.current
    setClamped(!!el && el.scrollHeight > el.clientHeight + 1)
  }, [text, place?.compact])

  const [muted, setMuted] = useMuted()
  const rise = motionFor('rise', reduced)

  return (
    <div ref={rootRef} data-tour="lesson-chat" className="pointer-events-none absolute inset-0 z-20">
      {/* What Inky says, for screen readers, from a region that stays put:
          the bubble is remounted for every line and can shrink to a pill. With
          the chat open, the chat is what speaks. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {hidden || !text ? null : busy ? text : <SafeLatex>{text}</SafeLatex>}
      </div>
      {arrow && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <marker id="inky-point" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--subject)" />
            </marker>
          </defs>
          <motion.path
            key={pointKey}
            d={`M${arrow.x1},${arrow.y1} L${arrow.x2},${arrow.y2}`}
            fill="none"
            stroke="var(--subject)"
            strokeWidth={2.5}
            strokeLinecap="round"
            markerEnd="url(#inky-point)"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </svg>
      )}
      {/* Inky, its chat button and the one sound switch. */}
      {/* Measured as one: the bubble must not cover Inky's buttons either. */}
      <div ref={inkyRef} className="pointer-events-auto absolute bottom-5 left-4 flex items-end gap-2">
        <Inky size={56} mood={mood} />
        <div className="mb-1 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onOpenChat}
            aria-label="Open the chat"
            title="Open the chat (/)"
            className="ss-press grid h-11 w-11 place-items-center rounded-full border border-ss-line bg-ss-panel text-ss-ink shadow-ss-panel"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            title={muted ? 'Sound off' : 'Sound on'}
            className="ss-press grid h-11 w-11 place-items-center rounded-full border border-ss-line bg-ss-panel text-ss-slate shadow-ss-panel"
          >
            {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* The bubble: measured where it is, then moved where it fits. */}
      {!hidden && text && (
        <div
          ref={bubbleRef}
          className="pointer-events-auto absolute w-max max-w-[320px]"
          style={place ? { left: place.x, top: place.y, visibility: 'visible' } : { left: 84, bottom: 20, visibility: 'hidden' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={busy ? 'busy' : (line?.index ?? 'none')}
              initial={rise.initial}
              animate={rise.animate}
              exit={rise.exit}
              transition={rise.transition}
              className="relative"
            >
              {place?.compact ? (
                <button
                  type="button"
                  onClick={onOpenChat}
                  style={{ width: place.w ?? COMPACT.w }}
                  className="flex h-11 items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 text-left text-[13px] font-semibold text-ss-ink shadow-[0_12px_30px_-14px_rgba(20,60,90,0.45)]"
                >
                  <span className="truncate">{firstSentence(text)}</span>
                </button>
              ) : (
                <div
                  className="rounded-2xl border bg-ss-panel px-4 py-3 shadow-[0_14px_36px_-16px_rgba(20,60,90,0.5)]"
                  style={{ borderColor: line && line.tone !== 'say' && !busy ? 'var(--ss-warn)' : 'var(--ss-line)' }}
                >
                  <div ref={textRef} className="line-clamp-4 text-[13.5px] leading-relaxed text-ss-ink">
                    {busy ? (
                      <span className="inline-flex items-center gap-2 font-semibold text-ss-slate">
                        <span className="inline-flex gap-1" aria-hidden>
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ss-slate motion-reduce:animate-none [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ss-slate motion-reduce:animate-none [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ss-slate motion-reduce:animate-none" />
                        </span>
                        {text}
                      </span>
                    ) : (
                      <SafeLatex>{text}</SafeLatex>
                    )}
                  </div>
                  {!busy && clamped && (
                    <button type="button" onClick={onOpenChat} className="mt-1 text-[12.5px] font-bold text-ss-subject-ink hover:underline">
                      More in the chat
                    </button>
                  )}
                  {!busy && line?.retryAction && (
                    <button
                      type="button"
                      onClick={() => onRetry(line.retryAction!)}
                      className="ss-press mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold"
                      style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Try again
                    </button>
                  )}
                </div>
              )}
              <Tail side={place?.tail ?? 'left'} compact={!!place?.compact} />
            </motion.div>
          </AnimatePresence>
          {chips.length > 0 && !place?.compact && (
            <div data-tour="lesson-chips" className="mt-2 flex flex-col items-start gap-1.5">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onAsk(c)}
                  className="ss-press rounded-full border border-ss-line bg-ss-panel px-3.5 py-1.5 text-left text-[12.5px] font-semibold text-ss-ink shadow-ss-panel hover:border-[color:var(--subject)]"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** The little point from the bubble toward Inky. */
function Tail({ side, compact }: { side: 'left' | 'bottom'; compact: boolean }) {
  const common = 'absolute h-3 w-3 rotate-45 border-ss-line bg-ss-panel'
  if (side === 'left') {
    return <span aria-hidden className={`${common} -left-1.5 border-b border-l`} style={{ bottom: compact ? 16 : 18 }} />
  }
  return <span aria-hidden className={`${common} -bottom-1.5 left-6 border-b border-r`} />
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?\n]*[.!?]?/)
  return (m?.[0] || text).trim()
}
