'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Landmark, Pt, SymConfig, SymState } from './config'
import {
  drawnLines, fitsAt, flapAt, foldLayout, foldParts, isSymmetryLine, lineId, madeMarks, madeText, saidNone, sameSide, stepOf, symmetryEngine, turn, turnLayout, working,
} from './config'

type Props = SceneViewProps<SymConfig, SymState>

// Paper and card on a quiet light plate, as measure-shape's and network-sim's are: the plate keeps its own colours in both
// themes, so each part keeps its contrast against it. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const GRID = '#E7ECF2'
const INK = '#1E293B'
const SOFT = '#475569'
// Orange craft card: a strong front, a paler back that shows once a part is folded over, and a darker cut edge.
const CARD = '#F0A05A'
const CARD_EDGE = '#A85A1C'
const CARD_BACK = '#FBE3C8'
const PENCIL = '#334155'
// Tracing paper: white, part see-through, with a grey edge; the pin is a steel drawing pin.
const TRACE = '#FFFFFF'
const TRACE_EDGE = '#94A3B8'
/** The tab is the same paper, over the plate, where its see-through white looks plain white. */
const TAB = '#FCFDFE'
const RED = '#DC2626'
const PIN = '#475569'
const PIN_HI = '#CBD5E1'
const FONT = 'system-ui, sans-serif'

// Written out here, because config.ts and this file import each other (the tests check they agree).
export const W = 360
export const H = 270
const CX = 180
const CY = 135
export const HIT = 32
const TAB_OUT = 15
const TURN_ROOM = 130
/** How far a drawn pencil line runs past the card's edge at each end. */
export const LINE_PAST = 14
const FOLD_MS = 900

const f1 = (n: number) => n.toFixed(1)
const pathOf = (pts: Pt[]) => `M ${pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(' L ')} Z`
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const nameOf = (m: Landmark) => (m.kind === 'corner' ? `corner ${m.n}` : `the middle of side ${m.n}`)

/** A number that eases to its aim at an even pace; with reduced motion it is there at once. */
function useTween(aim: number, reduced: boolean, ms: number): number {
  const [t, setT] = useState(aim)
  const now = useRef(aim)
  useEffect(() => {
    if (reduced) {
      now.current = aim
      setT(aim)
      return
    }
    let raf = 0
    let last = 0
    const tick = (time: number) => {
      const dt = last ? Math.min(50, time - last) : 16
      last = time
      const next = aim > now.current ? Math.min(aim, now.current + dt / ms) : Math.max(aim, now.current - dt / ms)
      now.current = next
      setT(next)
      if (next !== aim) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [aim, reduced, ms])
  return reduced ? aim : t
}

/** Squared paper on a light plate with a hairline edge. */
function Plate({ children, label, svgRef, onPointerDown, onPointerMove, onPointerUp, grab }: {
  children: ReactNode; label: string; svgRef?: Ref<SVGSVGElement>; grab?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void; onPointerMove?: (e: ReactPointerEvent<SVGSVGElement>) => void; onPointerUp?: (e: ReactPointerEvent<SVGSVGElement>) => void
}) {
  const lines: number[] = []
  for (let v = 20; v < W - 8; v += 20) lines.push(v)
  return (
    <svg
      ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      className={`block h-auto w-full select-none ${grab ? 'touch-none' : ''}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <g stroke={GRID} strokeWidth={1}>
        {lines.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={10} y2={H - 10} />)}
        {lines.filter((y) => y < H - 8).map((y) => <line key={`y${y}`} x1={10} x2={W - 10} y1={y} y2={y} />)}
      </g>
      {children}
    </svg>
  )
}

/** A pencil line of symmetry, dashed, running a little past the card at each end. */
function PencilLine({ a, b }: { a: Pt; b: Pt }) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / d
  const uy = (b.y - a.y) / d
  return (
    <line
      x1={f1(a.x - ux * LINE_PAST)} y1={f1(a.y - uy * LINE_PAST)} x2={f1(b.x + ux * LINE_PAST)} y2={f1(b.y + uy * LINE_PAST)}
      stroke={PENCIL} strokeWidth={2.2} strokeDasharray="8 5" strokeLinecap="round" data-pencil="1"
    />
  )
}

const BUTTON = 'nodrag inline-flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  const lead = text.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : text}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// fold: tap two dots and the card folds along the line between them.

function FoldCard({ config, state, setState, marked, reduced, locked }: Props) {
  const shape = config.shape
  const lay = foldLayout(shape)
  const now = marked === 'shown' ? symmetryEngine.solve(config) : state
  const lines = drawnLines(config, now)
  const none = saidNone(now)
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished
  const byId = new Map(lay.marks.map((m) => [m.id, m]))
  const sides = lay.corners.length
  const clip = `sy-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const [sel, setSel] = useState<string | null>(null)
  const [fold, setFold] = useState<{ a: string; b: string } | null>(null)
  /** Every fold leaves a crease in the card, as paper does, so the learner can see where they have tried. */
  const [creases, setCreases] = useState<string[]>([])
  const [aim, setAim] = useState(0)
  const t = useTween(aim, reduced, FOLD_MS)
  useEffect(() => {
    if (aim === 0 && t === 0 && fold) setFold(null)
  }, [aim, t, fold])
  // Marked, the card lies flat again.
  useEffect(() => {
    if (!live) {
      setSel(null)
      setAim(0)
    }
  }, [live])

  const foldId = fold ? lineId(fold.a, fold.b) : null
  const parts = fold ? foldParts(lay.corners, byId.get(fold.a)!.at, byId.get(fold.b)!.at) : null
  const flap = parts ? flapAt(parts, t) : null
  const over = t > 0.5
  const folded = aim === 1 && fold !== null

  const tap = (id: string) => {
    if (!live || fold) return
    if (sel === null) setSel(id)
    else if (sel === id) setSel(null)
    else if (sameSide(sel, id, sides)) setSel(id)
    else {
      setFold({ a: sel, b: id })
      setSel(null)
      setAim(1)
      const made = lineId(sel, id)
      if (!creases.includes(made)) setCreases([...creases, made])
    }
  }
  const keep = () => {
    if (!foldId || locked) return
    const next = lines.includes(foldId) ? lines.filter((x) => x !== foldId) : [...lines, foldId]
    setState({ lines: next, none: false })
    setAim(0)
  }
  const ask = (m: Landmark) => {
    if (sel === null) return `Start a fold at ${nameOf(m)}`
    if (sel === m.id) return `Let go of ${nameOf(m)}`
    if (sameSide(sel, m.id, sides)) return `Start the fold at ${nameOf(m)} instead`
    return `Fold from ${nameOf(byId.get(sel)!)} to ${nameOf(m)}`
  }

  const caption = finished
    ? `${cap(shape)} cut from card${lines.length ? ', with its lines of symmetry drawn' : ''}.`
    : folded
      ? 'Folded. Does the folded part cover the rest exactly, with nothing sticking out?'
      : sel
        ? 'Now tap a second dot: the card folds along the line between the two.'
        : none
          ? `${cap(shape)} cut from card. You said it has no lines of symmetry.`
          : `${cap(shape)} cut from card. Tap two dots to fold it along the line between them.`
  const seen = fold && parts
    ? `Folded along the line from ${nameOf(byId.get(fold.a)!)} to ${nameOf(byId.get(fold.b)!)}. ${isSymmetryLine(shape, foldId!) ? 'The folded part covers the rest exactly.' : 'Part of the card sticks out past the edge.'}`
    : `${say(lines.length, 'pencil line', 'pencil lines')} drawn.`
  const label = `${cap(article(shape))} ${shape} cut from orange card, lying on squared paper, with a dot on every corner and the middle of every side. ${seen}`
  const said = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, now) : ''

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.sy-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <Plate label={label}>
            {parts && flap ? (
              <g strokeLinejoin="round">
                {/* Folded, the pencil shows only on the part still lying flat: the rest went over with the card. */}
                <clipPath id={clip}><path d={pathOf(parts.stay)} /></clipPath>
                <path d={pathOf(parts.stay)} fill={CARD} stroke={CARD_EDGE} strokeWidth={1.6} data-part="stay" />
                <g clipPath={`url(#${clip})`}>
                  {lines.map((id) => { const [a, b] = id.split('-'); return <PencilLine key={id} a={byId.get(a)!.at} b={byId.get(b)!.at} /> })}
                </g>
                <path d={pathOf(flap)} fill={over ? CARD_BACK : CARD} stroke={CARD_EDGE} strokeWidth={1.6} data-part="flap" data-over={over ? '1' : '0'} />
              </g>
            ) : (
              <g strokeLinejoin="round">
                <path d={pathOf(lay.corners)} fill={CARD} stroke={CARD_EDGE} strokeWidth={1.6} data-part="whole" />
                {creases.filter((id) => !lines.includes(id)).map((id) => {
                  const [a, b] = id.split('-').map((x) => byId.get(x)!.at)
                  return <line key={id} x1={f1(a.x)} y1={f1(a.y)} x2={f1(b.x)} y2={f1(b.y)} stroke={CARD_EDGE} strokeOpacity={0.5} strokeWidth={1.2} data-crease={id} />
                })}
                {lines.map((id) => { const [a, b] = id.split('-'); return <PencilLine key={id} a={byId.get(a)!.at} b={byId.get(b)!.at} /> })}
              </g>
            )}
            {live && !fold && lay.marks.map((m) => {
              const on = sel === m.id
              return on ? (
                <circle key={m.id} cx={f1(m.at.x)} cy={f1(m.at.y)} r={7} style={{ fill: 'var(--subject)' }} stroke="#FFFFFF" strokeWidth={2} data-dot-mark={m.id} data-on="1" />
              ) : (
                <circle key={m.id} cx={f1(m.at.x)} cy={f1(m.at.y)} r={5} fill="#FFFFFF" stroke={SOFT} strokeWidth={1.8} data-dot-mark={m.id} data-on="0" />
              )
            })}
          </Plate>
          {live && !fold && lay.marks.map((m) => (
            <button
              key={m.id} type="button" aria-label={ask(m)} aria-pressed={sel === m.id} data-dot={m.id} onClick={() => tap(m.id)}
              className="nodrag absolute touch-manipulation rounded-full outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
              style={{ left: `${(m.at.x / W) * 100}%`, top: `${(m.at.y / H) * 100}%`, width: HIT, height: HIT, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
            />
          ))}
        </div>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">{caption}</figcaption>
      </figure>

      <div className="flex min-h-7 items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <p className="flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Lines of symmetry drawn</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-lines={lines.length}>{lines.length}</span>
        </p>
        <span className="flex items-center gap-1.5">
          {live && folded && (
            <>
              <button type="button" className={BUTTON} onClick={() => setAim(0)} data-act="unfold">Unfold</button>
              <button type="button" className={BUTTON} onClick={keep} data-act="keep">{foldId && lines.includes(foldId) ? 'Rub out this line' : 'Draw this line'}</button>
            </>
          )}
          {live && !fold && lines.length === 0 && (
            <button
              type="button" className={BUTTON} aria-pressed={none} data-act="none"
              style={none ? { borderColor: 'var(--subject)', color: 'var(--subject)' } : undefined}
              onClick={() => !locked && setState({ lines: [], none: !none })}
            >It has none</button>
          )}
        </span>
      </div>

      <p className="sy-kbd hidden text-[12px] font-semibold text-ss-slate">Tab to a dot and press Enter, then do the same at a second dot to fold.</p>
      <span className="sr-only" aria-live="polite">{seen}</span>
      <Verdict marked={marked} text={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// turn: tracing paper pinned at the centre, turned one full turn; mark under the red dot each time it fits.

/** A round arrow, clockwise; mirrored, it turns back. */
function TurnIcon({ back }: { back?: boolean }) {
  // Three quarters of a circle from lower left round the top to lower right, and a head pointing on round.
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" style={back ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M 3.67 10.5 A 5 5 0 1 1 10.5 12.33" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M 7.6 14.0 L 9.0 9.8 L 12.0 14.9 Z" fill="currentColor" />
    </svg>
  )
}

function TurnCard({ config, state, setState, marked, reduced, locked }: Props) {
  const shape = config.shape
  const lay = turnLayout(shape)
  const step = stepOf(shape)
  const now = marked === 'shown' ? symmetryEngine.solve(config) : state
  const marks = madeMarks(config, now)
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished

  const [angle, setAngle] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  const grip = useRef<{ last: number; rot: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const shown = marked === 'shown' ? 0 : drag ?? angle
  const settled = marked === 'shown' ? 0 : angle
  const here = ((settled % 360) + 360) % 360
  const markedHere = marks.includes(here)
  const reading = drag === null ? settled : Math.max(0, Math.min(360, Math.round(drag / step) * step))

  const setTo = (deg: number) => { if (live) setAngle(Math.max(0, Math.min(360, deg))) }
  const toggleMark = () => {
    if (!live) return
    setState({ marks: markedHere ? marks.filter((m) => m !== here) : [...marks, here].sort((a, b) => a - b) })
  }

  const pointerAngle = (e: ReactPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W
    const y = ((e.clientY - box.top) / box.height) * H
    return { deg: (Math.atan2(y - CY, x - CX) * 180) / Math.PI, far: Math.hypot(x - CX, y - CY) }
  }
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!live || e.button !== 0) return
    const p = pointerAngle(e)
    // Only the tracing paper and its tab turn; a press on the plate around it does nothing.
    if (p.far > lay.disc + TAB_OUT + 4) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    grip.current = { last: p.deg, rot: angle }
    setDrag(angle)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = grip.current
    if (!g) return
    const p = pointerAngle(e)
    let d = p.deg - g.last
    if (d > 180) d -= 360
    if (d < -180) d += 360
    g.last = p.deg
    g.rot = Math.max(0, Math.min(360, g.rot + d))
    setDrag(g.rot)
  }
  const up = () => {
    const g = grip.current
    if (!g) return
    grip.current = null
    setAngle(Math.max(0, Math.min(360, Math.round(g.rot / step) * step)))
    setDrag(null)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!e.key.startsWith('Arrow')) return
    // The board moves a selected card with the arrows; here they turn the tracing.
    e.stopPropagation()
    e.preventDefault()
    setTo(settled + (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : -step))
  }

  const spin = drag !== null || reduced ? undefined : 'transform 600ms cubic-bezier(0.33, 1, 0.68, 1)'
  const turning = { transform: `rotate(${f1(shown)}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box' as const, transition: spin }
  const dotAt = lay.corners[lay.dot]
  const tabIn = lay.disc - 7
  const tabOut = lay.disc + TAB_OUT
  const gripX = CX + (lay.disc + tabOut) / 2
  // The way it has come so far, as an arc just inside the tab's reach.
  const arcR = lay.disc + 4
  const arc = (deg: number) => {
    if (deg <= 0.5) return ''
    if (deg >= 359.5) return `M ${f1(CX + arcR)} ${CY} A ${f1(arcR)} ${f1(arcR)} 0 1 1 ${f1(CX - arcR)} ${CY} A ${f1(arcR)} ${f1(arcR)} 0 1 1 ${f1(CX + arcR)} ${CY}`
    const r = (deg * Math.PI) / 180
    return `M ${f1(CX + arcR)} ${CY} A ${f1(arcR)} ${f1(arcR)} 0 ${deg > 180 ? 1 : 0} 1 ${f1(CX + arcR * Math.cos(r))} ${f1(CY + arcR * Math.sin(r))}`
  }
  const lies = fitsAt(shape, settled)
  const seen = `Turned ${settled} degrees. ${lies ? 'The traced outline lies exactly on the card’s edge.' : 'The traced outline crosses the card’s edge.'} ${say(marks.length, 'mark', 'marks')} made.`
  const label = `${cap(article(shape))} ${shape} cut from orange card, under a disc of tracing paper pinned at its centre. The shape is traced on the paper, with a red dot at one corner. ${seen}`
  const said = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, now) : ''
  const caption = finished
    ? `${cap(shape)} under tracing paper, with a mark for each place it fits.`
    : settled >= 360
      ? 'One full turn: the red dot is back at the start.'
      : `${cap(shape)} under tracing paper. Turn it one full turn, and mark under the red dot each time it fits.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate label={label} svgRef={svgRef} grab={live} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          {/* Where the tab started, and the way the tracing has turned since. */}
          <path d={`M ${CX + TURN_ROOM + 2} ${CY} l 9 -5.5 v 11 Z`} fill={SOFT} data-start="1" />
          <text x={CX + TURN_ROOM + 1} y={CY - 13} fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>start</text>
          <path d={arc(shown)} fill="none" style={{ stroke: 'var(--subject)' }} strokeWidth={3} strokeLinecap="round" data-arc="1" />
          <path d={pathOf(lay.corners)} fill={CARD} stroke={CARD_EDGE} strokeWidth={1.6} strokeLinejoin="round" data-part="card" />
          <g style={turning} data-turned={f1(shown)}>
            <circle cx={CX} cy={CY} r={f1(lay.disc)} fill={TRACE} fillOpacity={0.55} stroke={TRACE_EDGE} strokeWidth={1.3} />
          </g>
          {marks.map((m) => {
            const p = turn(dotAt, lay.pin, m)
            return <circle key={m} cx={f1(p.x)} cy={f1(p.y)} r={9.5} fill="none" stroke={PENCIL} strokeWidth={2} data-mark={m} />
          })}
          <g style={turning}>
            <path d={pathOf(lay.corners)} fill="none" stroke={PENCIL} strokeWidth={1.8} strokeLinejoin="round" data-trace="1" />
            <circle cx={f1(dotAt.x)} cy={f1(dotAt.y)} r={5.5} fill={RED} stroke="#FFFFFF" strokeWidth={1.5} data-red="1" />
            {/* The tab: the handle on the tracing paper, with an arrow each way round. */}
            <g data-tab="1">
              <rect x={f1(CX + tabIn)} y={CY - 13} width={f1(tabOut - tabIn)} height={26} rx={7} fill={TAB} stroke={TRACE_EDGE} strokeWidth={1.3} />
              <path
                d={`M ${f1(gripX)} ${CY - 7.5} V ${CY + 7.5} M ${f1(gripX - 3.4)} ${CY - 4.2} L ${f1(gripX)} ${CY - 7.8} L ${f1(gripX + 3.4)} ${CY - 4.2} M ${f1(gripX - 3.4)} ${CY + 4.2} L ${f1(gripX)} ${CY + 7.8} L ${f1(gripX + 3.4)} ${CY + 4.2}`}
                fill="none" stroke={SOFT} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
              />
            </g>
          </g>
          {/* The drawing pin through the middle. */}
          <circle cx={CX} cy={CY} r={6.5} fill={PIN} />
          <circle cx={CX - 1.8} cy={CY - 1.8} r={2.2} fill={PIN_HI} />
          <text x={14} y={20} fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>tracing paper</text>
          {live && <circle cx={CX} cy={CY} r={f1(lay.disc + TAB_OUT)} fill="transparent" style={{ cursor: drag === null ? 'grab' : 'grabbing' }} data-grip="1" />}
        </Plate>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5 border-t border-ss-line pt-1.5">
        {live && <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Turned</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label={`Turn back ${step} degrees`} className={STEP} disabled={!live || settled <= 0} onClick={() => setTo(settled - step)} data-act="back"><TurnIcon back /></button>
            <span className="min-w-[44px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-angle={reading}>{reading}°</span>
            <button type="button" aria-label={`Turn on ${step} degrees`} className={STEP} disabled={!live || settled >= 360} onClick={() => setTo(settled + step)} data-act="on"><TurnIcon /></button>
          </span>
        </div>}
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Marks made</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-marks={marks.length}>{marks.length}</span>
          </p>
          {live && (
            <button type="button" className={BUTTON} onClick={toggleMark} disabled={drag !== null} data-act="mark">
              {markedHere ? 'Rub out this mark' : 'Mark under the red dot'}
            </button>
          )}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{seen}</span>
      <Verdict marked={marked} text={said} />
    </div>
  )
}

const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a')

export function SymmetryView(props: Props) {
  return props.config.task === 'turn' ? <TurnCard {...props} /> : <FoldCard {...props} />
}
