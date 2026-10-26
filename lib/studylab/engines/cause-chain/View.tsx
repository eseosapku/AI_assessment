'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { CauseChainConfig, CauseChainState, Effect, Link, LinkStatus } from './config'
import { effectChoices, judge, labelOf, learnerLinks, propagation, ringOrder, sentence, withLink, withoutLink } from './config'

// The ring, in its own units: the cards sit round an ellipse, the start on the left.
const W = 360
const CARD_W = 100
const CARD_H = 52
const RX = W / 2 - CARD_W / 2 - 2
const PAD = 6
/** How tall the ring is for each number of cards: enough that neighbours never touch (pinned by the tests). */
const RY: Record<number, number> = { 3: 80, 4: 100, 5: 112, 6: 124, 7: 140 }
/** The space between a card's edge and an arrow's end. */
const GAP = 3
/** How long each step of the chain takes to light once it is marked. */
const STEP_MS = 650

type Pt = { x: number; y: number }

/** The ring's height, its centre, and where each card's centre sits, clockwise from the left. */
export function ringGeometry(n: number): { w: number; h: number; centre: Pt; slots: Pt[]; card: { w: number; h: number } } {
  const ry = RY[n] ?? 140
  const angles = Array.from({ length: n }, (_, k) => (2 * Math.PI * k) / n)
  const reach = Math.max(0, ...angles.map((t) => Math.abs(Math.sin(t)))) * ry
  const h = Math.round(2 * (reach + CARD_H / 2 + PAD))
  const centre = { x: W / 2, y: h / 2 }
  return {
    w: W, h, centre, card: { w: CARD_W, h: CARD_H },
    slots: angles.map((t) => ({ x: centre.x - RX * Math.cos(t), y: centre.y - ry * Math.sin(t) })),
  }
}

const unit = (x: number, y: number): Pt => {
  const m = Math.hypot(x, y)
  return m < 1e-9 ? { x: 0, y: 0 } : { x: x / m, y: y / m }
}

/** Where a ray from a card's centre along `d` leaves the card, just outside it. */
function border(c: Pt, d: Pt): Pt {
  const sx = Math.abs(d.x) < 1e-6 ? Infinity : (CARD_W / 2 + GAP) / Math.abs(d.x)
  const sy = Math.abs(d.y) < 1e-6 ? Infinity : (CARD_H / 2 + GAP) / Math.abs(d.y)
  const s = Math.min(sx, sy)
  return { x: c.x + d.x * s, y: c.y + d.y * s }
}

const f = (v: number) => v.toFixed(1)

/**
 * An arrow from one card to another: it leaves each card between the way to
 * the other card and the way to the ring's middle, so arrows bow inward, clear
 * of the neighbours, and arrows to different cards leave at different places.
 * Returns the line, its head, and where the effect's sign sits on it.
 */
export function arrowGeometry(a: Pt, b: Pt, centre: Pt): { d: string; head: string; badge: Pt; curve: [Pt, Pt, Pt, Pt] } {
  const ab = unit(b.x - a.x, b.y - a.y)
  const ca = unit(centre.x - a.x, centre.y - a.y)
  const cb = unit(centre.x - b.x, centre.y - b.y)
  let da = unit(ca.x + ab.x, ca.y + ab.y)
  let db = unit(cb.x - ab.x, cb.y - ab.y)
  if (da.x === 0 && da.y === 0) da = ab
  if (db.x === 0 && db.y === 0) db = { x: -ab.x, y: -ab.y }
  const p0 = border(a, da)
  const p3 = border(b, db)
  const k = Math.min(56, Math.max(18, Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.35))
  const p1 = { x: p0.x + da.x * k, y: p0.y + da.y * k }
  const p2 = { x: p3.x + db.x * k, y: p3.y + db.y * k }
  // The head points along the line's last stretch; the line stops inside it.
  const u = unit(p3.x - p2.x, p3.y - p2.y)
  const n = { x: -u.y, y: u.x }
  const base = { x: p3.x - u.x * 9, y: p3.y - u.y * 9 }
  const end = { x: p3.x - u.x * 7, y: p3.y - u.y * 7 }
  const head = `M ${f(p3.x)} ${f(p3.y)} L ${f(base.x + n.x * 5)} ${f(base.y + n.y * 5)} L ${f(base.x - n.x * 5)} ${f(base.y - n.y * 5)} Z`
  const d = `M ${f(p0.x)} ${f(p0.y)} C ${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(end.x)} ${f(end.y)}`
  // The sign sits a little before halfway, so signs on arrows crossing in the middle do not meet.
  const t = 0.42
  const m = 1 - t
  const badge = {
    x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
    y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
  }
  return { d, head, badge, curve: [p0, p1, p2, p3] }
}

const STATUS_WORDS: Record<LinkStatus, string> = {
  right: 'fits the chain',
  reversed: 'runs the wrong way',
  opposite: 'has the opposite effect',
  extra: 'extra, not marked',
}
const STATUS_COLOUR: Record<LinkStatus, string> = {
  right: 'var(--ss-good)',
  reversed: 'var(--ss-bad)',
  opposite: 'var(--ss-bad)',
  extra: 'var(--ss-slate)',
}

const sign = (e: Effect) => (e === 'decreases' ? '−' : '+')
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`
const keyOf = (l: Link) => `${l.from}>${l.to}`
const plural = (k: number, one: string, many: string) => (k === 1 ? one : many)

export function CauseChainView({ config, state, setState, marked, reduced, locked }: SceneViewProps<CauseChainConfig, CauseChainState>) {
  const ring = ringOrder(config)
  const start = ring[0]
  const geo = ringGeometry(ring.length)
  const at = new Map(ring.map((id, i) => [id, geo.slots[i]]))
  const label = (id: string) => labelOf(config, id)
  const mine = learnerLinks(config, state)
  const choices = effectChoices(config)

  const done = marked !== 'idle'
  const verdict = done ? judge(config, state) : null
  const spread = done ? propagation(config, state) : null
  const last = spread ? Math.max(0, ...spread.order.map((o) => o.at)) : 0

  const [from, setFrom] = useState<string | null>(null)
  const [pair, setPair] = useState<{ from: string; to: string } | null>(null)
  const [said, setSaid] = useState('')
  const [tick, setTick] = useState(0)
  const cards = useRef<Record<string, HTMLButtonElement | null>>({})

  // Once marked, the chain lights from the start a step at a time; all at once under reduced motion.
  useEffect(() => {
    if (marked === 'idle' || reduced) return
    let t = 0
    const timer = window.setInterval(() => {
      t += 1
      setTick(t)
      if (t >= last) window.clearInterval(timer)
    }, STEP_MS)
    return () => {
      window.clearInterval(timer)
      setTick(0)
    }
  }, [marked, reduced, last])
  const lit = marked === 'idle' ? -1 : reduced ? Number.POSITIVE_INFINITY : tick

  // Solving ends whatever the learner had half chosen; after a wrong mark they carry on.
  const editing = !locked
  const picking = editing ? from : null
  const open = editing ? pair : null

  const reached = (id: string) => !!spread && spread.depth.has(id) && spread.depth.get(id)! <= lit
  const existing = open ? mine.find((l) => (l.from === open.from && l.to === open.to) || (l.from === open.to && l.to === open.from)) : undefined

  const tap = (id: string) => {
    if (locked) return
    if (open || !picking) {
      setPair(null)
      setFrom(id)
      setSaid(`${label(id)} chosen. Now choose the factor it affects.`)
      return
    }
    if (picking === id) {
      setFrom(null)
      setSaid(`${label(id)} no longer chosen.`)
      return
    }
    setFrom(null)
    setPair({ from: picking, to: id })
    setSaid(`How does ${label(picking)} affect ${label(id)}?`)
  }
  const cancel = () => {
    const back = open?.from ?? picking
    setPair(null)
    setFrom(null)
    setSaid('Cancelled.')
    if (back) cards.current[back]?.focus()
  }
  const choose = (effect: Effect) => {
    if (!open || locked) return
    const link = { from: open.from, to: open.to, effect }
    setState(withLink(state, link))
    setPair(null)
    setSaid(`Linked: ${sentence(config, link)}.`)
    cards.current[open.to]?.focus()
  }
  const remove = (a: string, b: string) => {
    if (locked) return
    const gone = mine.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a))
    setState(withoutLink(state, a, b))
    setPair(null)
    setSaid(gone ? `Removed: ${sentence(config, gone)}.` : 'Removed.')
  }

  const onCardKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Escape' && (picking || open)) {
      e.preventDefault()
      e.stopPropagation()
      cancel()
      return
    }
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move round the ring.
    e.preventDefault()
    e.stopPropagation()
    const n = ring.length
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + step + n) % n
    cards.current[ring[j]]?.focus()
  }

  // The learner's links, with how each was marked; once marked, the chain's own links first, in the order they light.
  const statusOf = new Map(verdict?.judged.map((j) => [keyOf(j.link), j.status]) ?? [])
  const stepOf = new Map(spread?.order.map((o) => [keyOf(o.link), o.at]) ?? [])
  const rank = (s: LinkStatus | undefined) => (s === 'right' ? 0 : s === 'reversed' || s === 'opposite' ? 1 : 2)
  const rows = mine.map((link) => ({ link, status: statusOf.get(keyOf(link)), step: stepOf.get(keyOf(link)) }))
  if (done) rows.sort((a, b) => rank(a.status) - rank(b.status) || (a.step ?? 99) - (b.step ?? 99))

  const look = (status: LinkStatus | undefined, step: number | undefined) => {
    if (!done || !status) return { stroke: 'var(--subject)', width: 2.5, opacity: 1 }
    if (status === 'right' && step !== undefined && step > lit) return { stroke: 'var(--ss-slate)', width: 2.5, opacity: 0.55 }
    if (status === 'right') return { stroke: 'var(--ss-good)', width: step !== undefined ? 3.5 : 2.5, opacity: 1 }
    if (status === 'extra') return { stroke: 'var(--ss-slate)', width: 2, opacity: 0.8 }
    return { stroke: 'var(--ss-bad)', width: 2.5, opacity: 1 }
  }
  const fade = reduced ? undefined : 'stroke 250ms, fill 250ms, opacity 250ms'

  const counts = verdict
    ? {
        right: verdict.judged.filter((j) => j.status === 'right').length,
        against: verdict.judged.filter((j) => j.status === 'reversed' || j.status === 'opposite').length,
        // Links of the chain with nothing drawn between their two factors: a wrong one is already flagged.
        missing: verdict.missing.filter((s) => !mine.some((l) => (l.from === s.from && l.to === s.to) || (l.from === s.to && l.to === s.from))).length,
      }
    : null
  const whole = !!verdict?.ok

  return (
    <div
      className="nodrag flex flex-col gap-3"
      onKeyDown={(e) => {
        // The board moves a selected card with the arrows; inside the scene they belong to the scene.
        if (e.key.startsWith('Arrow')) e.stopPropagation()
      }}
    >
      {editing && !open && (
        <p className="text-[12px] font-semibold text-ss-slate">
          {picking ? `${label(picking)} chosen: now tap the factor it affects.` : 'Tap a factor, then the factor it affects.'}
        </p>
      )}

      <div
        role="group"
        aria-label="The factors. Choose one, then the factor it affects; the arrow keys move between them."
        className="relative mx-auto w-full max-w-[360px] rounded-2xl bg-ss-chip"
        style={{ aspectRatio: `${geo.w} / ${geo.h}` }}
      >
        <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {[...rows].reverse().map(({ link, status, step }) => {
            const a = at.get(link.from)
            const b = at.get(link.to)
            if (!a || !b) return null
            const g = arrowGeometry(a, b, geo.centre)
            const s = look(status, step)
            return (
              <g key={keyOf(link)} data-link={keyOf(link)} opacity={s.opacity} style={{ transition: fade }}>
                <path d={g.d} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" strokeDasharray={link.effect === 'decreases' ? '6 4' : undefined} style={{ transition: fade }} />
                <path d={g.head} fill={s.stroke} style={{ transition: fade }} />
                <circle cx={g.badge.x} cy={g.badge.y} r={9} fill="var(--ss-panel)" stroke={s.stroke} strokeWidth={1.5} style={{ transition: fade }} />
                <text x={g.badge.x} y={g.badge.y} dy="0.35em" textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--ss-ink)">{sign(link.effect)}</text>
              </g>
            )
          })}
        </svg>

        {ring.map((id, i) => {
          const c = at.get(id)!
          const chosen = picking === id || open?.from === id || open?.to === id
          const on = reached(id)
          const ringColour = on ? 'var(--ss-good)' : chosen ? 'var(--subject)' : undefined
          return (
            <button
              key={id}
              ref={(el) => {
                cards.current[id] = el
              }}
              type="button"
              lang="en"
              disabled={locked}
              aria-pressed={picking === id}
              aria-label={`${label(id)}${id === start ? ', the start' : ''}${on ? ', reached from the start' : ''}`}
              onClick={() => tap(id)}
              onKeyDown={(e) => onCardKey(e, i)}
              className="nodrag absolute flex touch-manipulation items-center justify-center overflow-hidden rounded-xl px-1 text-center text-[12px] font-bold leading-[14px] text-ss-ink disabled:cursor-default"
              style={{
                left: pct(c.x - CARD_W / 2, geo.w),
                top: pct(c.y - CARD_H / 2, geo.h),
                width: pct(CARD_W, geo.w),
                height: pct(CARD_H, geo.h),
                borderStyle: 'solid',
                borderWidth: id === start ? 2 : 1.5,
                borderColor: on ? 'var(--ss-good)' : id === start || chosen ? 'var(--subject)' : 'var(--ss-slate)',
                backgroundColor: on ? 'color-mix(in srgb, var(--ss-good) 14%, var(--ss-panel))' : chosen ? 'var(--subject-soft)' : 'var(--ss-panel)',
                boxShadow: ringColour ? `0 0 0 2px ${ringColour}` : undefined,
                transition: reduced ? undefined : 'background-color 250ms, border-color 250ms, box-shadow 250ms',
                hyphens: 'auto',
                overflowWrap: 'break-word',
              }}
            >
              <span className="line-clamp-3">{label(id)}</span>
            </button>
          )
        })}
        {start && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full border bg-ss-panel px-1.5 text-[12px] font-extrabold uppercase leading-[16px] tracking-wide text-ss-subject-ink"
            // Above the card, clear of its label; nothing leads into the start, so no arrow comes this way.
            style={{ left: pct(at.get(start)!.x - CARD_W / 2 + 4, geo.w), top: `calc(${pct(at.get(start)!.y - CARD_H / 2, geo.h)} - 20px)`, borderColor: 'var(--subject)' }}
          >
            Start
          </span>
        )}
      </div>

      {open && (
        <div
          role="group"
          aria-label={`How does ${label(open.from)} affect ${label(open.to)}?`}
          className="rounded-xl border-[1.5px] bg-ss-panel p-2.5"
          style={{ borderColor: 'var(--subject)' }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            cancel()
          }}
        >
          <p className="mb-2 text-[13px] font-bold text-ss-ink">
            {label(open.from)} <span aria-hidden="true">→</span> {label(open.to)}
          </p>
          <div className="flex flex-wrap gap-2">
            {choices.map((effect, i) => (
              <button
                key={effect}
                type="button"
                // The choice opens where the learner's attention is: on the first effect.
                autoFocus={i === 0}
                onClick={() => choose(effect)}
                className="nodrag rounded-full border-[1.5px] bg-ss-panel px-3 py-1.5 text-[12px] font-bold text-ss-ink"
                style={{ borderColor: 'var(--subject)' }}
              >
                <span aria-hidden="true" className="mr-1 text-[14px]">{sign(effect)}</span>
                {effect}
              </button>
            ))}
            {existing && (
              <button type="button" onClick={() => remove(open.from, open.to)} className="nodrag rounded-full border-[1.5px] border-ss-line px-3 py-1.5 text-[12px] font-semibold text-ss-slate">
                Remove link
              </button>
            )}
            <button type="button" onClick={cancel} className="nodrag rounded-full px-3 py-1.5 text-[12px] font-semibold text-ss-slate">
              Cancel
            </button>
          </div>
        </div>
      )}

      {done && counts && (
        <div className="text-[12px] font-semibold leading-snug" role="status">
          {whole ? (
            <p className="font-extrabold text-ss-ink">The chain from {label(start)}, a step at a time:</p>
          ) : (
            <>
              <p className="font-extrabold text-ss-ink">
                {mine.length === 0
                  ? 'You made no links.'
                  : `You made ${mine.length} ${plural(mine.length, 'link', 'links')}: ${counts.right} ${plural(counts.right, 'fits', 'fit')} the chain${counts.against ? `, ${counts.against} ${plural(counts.against, 'goes', 'go')} against it` : ''}.`}
              </p>
              {counts.missing > 0 && <p className="text-ss-slate">{counts.missing} more {plural(counts.missing, 'link is', 'links are')} needed.</p>}
            </>
          )}
        </div>
      )}

      <div>
        {!(done && whole) && <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ss-slate">Your links</p>}
        {rows.length === 0 ? (
          <p className="text-[12px] text-ss-slate">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label={done && whole ? `The chain from ${label(start)}` : 'Your links'}>
            {rows.map(({ link, status, step }) => {
              const shown = !(done && status === 'right' && step !== undefined && step > lit)
              return (
                <li
                  key={keyOf(link)}
                  className="flex min-h-[32px] items-center gap-2 rounded-lg px-2 py-1 text-[12px]"
                  style={{
                    backgroundColor: done && status === 'right' && step !== undefined && shown ? 'color-mix(in srgb, var(--ss-good) 12%, var(--ss-panel))' : 'var(--ss-panel)',
                    opacity: shown ? 1 : 0.45,
                    transition: reduced ? undefined : 'opacity 250ms, background-color 250ms',
                  }}
                >
                  {done && whole && step !== undefined && <span className="w-4 shrink-0 text-right font-extrabold tabular-nums text-ss-slate">{step}</span>}
                  <span className="flex-1 font-semibold text-ss-ink">
                    {label(link.from)}{' '}
                    <span className="whitespace-nowrap rounded-full px-1.5 font-bold" style={{ color: 'var(--ss-ink)', backgroundColor: 'var(--ss-chip)' }}>
                      <span aria-hidden="true">{sign(link.effect)} </span>
                      {link.effect}
                    </span>{' '}
                    {label(link.to)}
                  </span>
                  {done && status && (!whole || status === 'extra') && (
                    <span className="shrink-0 text-right font-bold" style={{ color: STATUS_COLOUR[status] }}>{STATUS_WORDS[status]}</span>
                  )}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => remove(link.from, link.to)}
                      aria-label={`Remove: ${sentence(config, link)}`}
                      className="nodrag shrink-0 rounded-md border border-ss-line px-2 py-1 text-[12px] font-semibold text-ss-slate"
                    >
                      Remove
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  )
}
