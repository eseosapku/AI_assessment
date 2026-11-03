'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { FmConfig, FmState, Q, Step } from './config'
import { fmEngine, fmt, madeText, outputOf, plusText, readState, stages, stepSpoken, stepText, tilesAt, working } from './config'

type Props = SceneViewProps<FmConfig, FmState>

// A machine is not a dark subject: a quiet plate, as measure-shape's and bonding's are, with the real thing on it. The plate
// keeps its own colours in both themes, so each part keeps its contrast against it. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// The machine: painted teal housings on a steel frame, a dark rubber belt, cream paper tickets.
const BODY = '#2F7F79'
const BODY_EDGE = '#1F5B56'
const PAINT_LIP = '#256A65'
const TUNNEL = '#1E293B'
const STEEL = '#94A3B8'
const STEEL_DK = '#64748B'
const BELT = '#475569'
const BELT_TREAD = '#64748B'
const TICKET = '#FFF3CF'
const TICKET_EDGE = '#B68A1E'
const PLATE_CREAM = '#FFF8E6'
const PLATE_BUSY = '#FFE08A'
const TILE = '#8FCBC4'
const TILE_EDGE = '#2F7F79'
const GHOST = '#94A3B8'

// ---------------------------------------------------------------------------
// Geometry (viewBox pixels). Exported for the tests. The ranges below are written out because config.ts and this file import
// each other (the test checks they agree).

export const W = 360
export const H_INVERSE = 176
export const H_PATTERN = 292
export const HOPPER_X = 40
export const TRAY_X = 320
export const BELT_Y = 96
export const TICKET_Y = 85
const STEP_RANGE = { min: 1, max: 6 }
const X_RANGE = { min: -20, max: 50 }
const A_RANGE = { min: 1, max: 9 }
const B_RANGE = { min: -4, max: 9 }

export const stationCentres = (count: number): number[] => (count <= 1 ? [181] : count === 2 ? [133, 229] : [106, 181, 256])
export const stationWidth = (count: number) => (count >= 3 ? 52 : 60)
/** A ticket is as wide as its number is long, and never shrinks the number. */
export const ticketWidth = (text: string) => Math.max(34, 12 + 8 * [...text].length)

// The ride: one ticket drops from the hopper, walks along the belt, stops under each station while it works, and ends in the tray.
export const SPEED = 84
export const DWELL = 0.6
export const DROP = 0.45
export const HOLD = 1.3

export type Ride = { x: number; y: number; stage: number; busy: number }
/** Where the ticket is `t` seconds into a ride, and how many stations it has been through; null once it is in the tray. */
export function rideAt(centres: number[], t: number): Ride | null {
  if (t < DROP) return { x: HOPPER_X, y: 62 + (TICKET_Y - 62) * (t / DROP), stage: 0, busy: -1 }
  let left = t - DROP
  let x = HOPPER_X
  const stops = [...centres, TRAY_X - 4]
  for (let k = 0; k < stops.length; k++) {
    const dist = stops[k] - x
    const move = dist / SPEED
    if (left < move) return { x: x + dist * (left / move), y: TICKET_Y, stage: k, busy: -1 }
    left -= move
    x = stops[k]
    if (k < centres.length) {
      if (left < DWELL) return { x, y: TICKET_Y, stage: left < DWELL / 2 ? k : k + 1, busy: k }
      left -= DWELL
    }
  }
  return null
}
export const cycleOf = (centres: number[]) => DROP + (TRAY_X - 4 - HOPPER_X) / SPEED + DWELL * centres.length + HOLD

const minus = (n: number) => (n < 0 ? `−${-n}` : String(n))

function useCycle(cycle: number, key: string, reduced: boolean): number | null {
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      setT(((now - start) / 1000) % cycle)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cycle, key, reduced])
  return reduced ? null : t
}

// ---------------------------------------------------------------------------
// The parts.

/** A paper ticket with its number, centred on x, y. */
function Ticket({ x, y, text, kind = 'paper' }: { x: number; y: number; text: string; kind?: 'paper' | 'small' | 'wanted' }) {
  const w = ticketWidth(text)
  const h = kind === 'small' ? 20 : 22
  const wanted = kind === 'wanted'
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} fontFamily={FONT} data-ticket={kind}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={wanted ? PLATE : kind === 'small' ? PLATE_CREAM : TICKET} stroke={wanted ? SOFT : TICKET_EDGE} strokeWidth={1.5} strokeDasharray={wanted ? '4 3' : undefined} />
      {!wanted && <rect x={-w / 2 + 3} y={-h / 2 + 3} width={w - 6} height={h - 6} rx={1.5} fill="none" stroke={TICKET_EDGE} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.55} />}
      <text x={0} y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill={wanted ? SOFT : INK}>{text}</text>
    </g>
  )
}

/** A station: a painted housing with a tunnel the belt runs through, and a plate saying its sum. */
function Housing({ cx, w, plate, busy }: { cx: number; w: number; plate: string; busy: boolean }) {
  return (
    <g data-station={plate}>
      <rect x={cx - w / 2} y={38} width={w} height={76} rx={6} fill={BODY} stroke={BODY_EDGE} strokeWidth={1.5} />
      <rect x={cx - w / 2 - 3} y={34} width={w + 6} height={9} rx={3} fill={PAINT_LIP} />
      <rect x={cx - 21} y={47} width={42} height={20} rx={4} fill={busy ? PLATE_BUSY : PLATE_CREAM} stroke={BODY_EDGE} strokeWidth={1.2} data-plate={busy ? 'busy' : 'idle'} />
      <text x={cx} y={62} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK} fontFamily={FONT}>{plate}</text>
      <rect x={cx - w / 2 + 6} y={70} width={w - 12} height={26} rx={3} fill={TUNNEL} />
      <rect x={cx - w / 2 + 4} y={108} width={w - 8} height={8} rx={2} fill={BODY_EDGE} />
    </g>
  )
}

function Belt() {
  const treads: number[] = []
  for (let x = 20; x < 292; x += 14) treads.push(x)
  return (
    <g aria-hidden="true">
      {[14, 296].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={BELT_Y + 6} r={9} fill={STEEL} stroke={STEEL_DK} strokeWidth={1.5} />
          <circle cx={cx} cy={BELT_Y + 6} r={2.5} fill={STEEL_DK} />
        </g>
      ))}
      <rect x={14} y={BELT_Y} width={282} height={12} fill={BELT} />
      {treads.map((x) => <line key={x} x1={x} y1={BELT_Y + 2} x2={x} y2={BELT_Y + 10} stroke={BELT_TREAD} strokeWidth={1.5} />)}
    </g>
  )
}

/** The hopper: a steel funnel with the ticket that was fed in sitting at its mouth. */
function Hopper({ text }: { text: string }) {
  return (
    <g data-part="hopper">
      <polygon points="8,36 72,36 52,80 28,80" fill={STEEL_DK} />
      <Ticket x={HOPPER_X} y={45} text={text} />
      <polygon points="16.2,54 63.8,54 52,80 28,80" fill={STEEL} stroke={STEEL_DK} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={4} y={33} width={72} height={5} rx={2.5} fill={STEEL_DK} />
      <rect x={33} y={80} width={14} height={12} fill={STEEL} stroke={STEEL_DK} strokeWidth={1.2} />
    </g>
  )
}

/** The tray at the end of the belt, with the ticket that came out. */
function Tray({ text }: { text: string }) {
  return (
    <g data-part="tray">
      <rect x={288} y={66} width={64} height={48} rx={4} fill={STEEL_DK} />
      <Ticket x={TRAY_X} y={82} text={text} />
      <rect x={286} y={91} width={68} height={23} rx={4} fill={STEEL} stroke={STEEL_DK} strokeWidth={1.5} />
    </g>
  )
}

function Label({ x, y, anchor = 'middle', children }: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={13} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" fontFamily={FONT} aria-hidden="true">{children}</text>
  )
}

// The pattern's tiles. Tiles stand on a line, the fixed ones at the left and one more group arriving at the right with each step.
export const TILE_SIZE = 22
export const TILE_PITCH = 25
export const FIG_X = 24
export const FIG_BASE = 256
export const CAP_GAP = 12
export const capHeight = (a: number) => Math.max(2, a)
export const capColumns = (a: number, b: number) => (b > 0 ? Math.ceil(b / capHeight(a)) : 0)

type Tile = { x: number; y: number; ghost: boolean }
/** Every tile of the figure at step n, bottom row first, and the dashed outlines of any that are missing. */
export function figureTiles(a: number, b: number, n: number): Tile[] {
  const out: Tile[] = []
  const cols = capColumns(a, b)
  const cap = capHeight(a)
  const put = (col: number, row: number, ghost = false, gap = 0) => out.push({ x: FIG_X + col * TILE_PITCH + gap, y: FIG_BASE - (row + 1) * TILE_PITCH + (TILE_PITCH - TILE_SIZE), ghost })
  for (let i = 0; i < b; i++) put(Math.floor(i / cap), i % cap)
  const gap = cols > 0 ? CAP_GAP : 0
  for (let g = 0; g < n; g++) {
    for (let r = 0; r < a; r++) {
      const missing = g === 0 && b < 0 && r >= a + b
      put(cols + g, r, missing, gap)
    }
  }
  return out
}

function Figure({ a, b, n }: { a: number; b: number; n: number }) {
  const tiles = figureTiles(a, b, n)
  const count = tilesAt(a, b, n)
  return (
    <g data-part="figure" data-tiles={count}>
      <line x1={FIG_X - 6} y1={FIG_BASE + 2} x2={W - 24} y2={FIG_BASE + 2} stroke={PLATE_EDGE} strokeWidth={2} strokeLinecap="round" />
      {tiles.map((t, i) => (
        <rect
          key={i} x={t.x} y={t.y} width={TILE_SIZE} height={TILE_SIZE} rx={3}
          fill={t.ghost ? 'none' : TILE} stroke={t.ghost ? GHOST : TILE_EDGE} strokeWidth={t.ghost ? 1.5 : 1.5} strokeDasharray={t.ghost ? '3 3' : undefined}
          data-tile={t.ghost ? 'missing' : 'tile'}
        />
      ))}
      <Label x={FIG_X - 4} y={H_PATTERN - 14} anchor="start">{`Step ${n}: ${count} ${count === 1 ? 'tile' : 'tiles'}`}</Label>
    </g>
  )
}

// ---------------------------------------------------------------------------
// One number the learner sets: a spin button between a lower and a raise button that repeat while held.

function Stepper({ label, noun, value, min, max, set, locked }: { label: string; noun: string; value: number; min: number; max: number; set(next: number): void; locked: boolean }) {
  const id = useId()
  const latest = useRef({ value, min, max, set, locked })
  latest.current = { value, min, max, set, locked }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  const bump = (by: number): boolean => {
    const l = latest.current
    if (l.locked) return false
    const next = Math.max(l.min, Math.min(l.max, l.value + by))
    if (next === l.value) return false
    l.set(next)
    return true
  }
  const hold = (by: number) => (e: PointerEvent) => {
    if (e.button !== 0) return
    held.current = false
    stop()
    const tick = (wait: number) => {
      timer.current = setTimeout(() => {
        held.current = true
        if (bump(by)) tick(90)
        else stop()
      }, wait)
    }
    tick(450)
  }
  const press = (by: number) => () => {
    // A hold has already moved the number; the click that ends it moves nothing more.
    if (held.current) { held.current = false; return }
    bump(by)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they set the number.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') bump(latest.current.min - latest.current.value)
    else if (e.key === 'End') bump(latest.current.max - latest.current.value)
    else bump(by)
  }

  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button" tabIndex={-1} aria-label={`Lower the ${noun}`} className={button}
          disabled={locked || value <= min}
          onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(-1)}
        >−</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id}
          aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={minus(value)}
          aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[34px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{minus(value)}</span>
        <button
          type="button" tabIndex={-1} aria-label={`Raise the ${noun}`} className={button}
          disabled={locked || value >= max}
          onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(1)}
        >+</button>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------

function describe(config: FmConfig, steps: Step[], s: FmState, out: Q, want: Q | null): string {
  if (config.task === 'inverse') {
    const list = steps.map((st, i) => `step ${i + 1} ${stepSpoken(st)}`).join(', ')
    return `A function machine with ${steps.length === 1 ? 'one station' : `${steps.length} stations`}: ${list}. ${fmt({ n: s.x, d: 1 })} is fed in and ${fmt(out)} comes out. The number wanted is ${want ? fmt(want) : 'not shown'}.`
  }
  const count = tilesAt(config.times, config.plus, s.x)
  return `A growing pattern of tiles, shown at step ${s.x}, with ${count} ${count === 1 ? 'tile' : 'tiles'}. Beside it, a machine that multiplies by ${s.a}, then ${s.b >= 0 ? 'adds' : 'takes away'} ${Math.abs(s.b)}, turns step ${s.x} into ${fmt(out)}.`
}

export function FunctionMachineView({ config, state, setState, marked, reduced, locked }: Props) {
  const solved = marked === 'shown' ? fmEngine.solve(config) : state
  const read = readState(config, solved)
  const now = marked === 'shown' && config.task === 'pattern' ? { ...read, x: readState(config, state).x } : read
  const inverse = config.task === 'inverse'
  const steps: Step[] = inverse ? config.steps : [{ op: '×', by: now.a }, { op: '+', by: now.b }]
  const centres = stationCentres(steps.length)
  const width = stationWidth(steps.length)
  const stage = stages(steps, now.x)
  const out = outputOf(steps, now.x)
  const want = inverse ? outputOf(config.steps, config.input) : null
  const plates = inverse ? steps.map(stepText) : [`×${now.a}`, plusText(now.b)]

  const cycle = cycleOf(centres)
  const t = useCycle(cycle, `${now.x}|${now.a}|${now.b}|${plates.join()}`, reduced)
  const ride = t === null ? null : rideAt(centres, t)

  const put = (next: Partial<FmState>) => {
    if (locked) return
    setState({ ...readState(config, state), ...next })
  }
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const said = finished ? working(config, now) : null
  const miss = marked === 'wrong' ? madeText(config, now) : ''
  const H = inverse ? H_INVERSE : H_PATTERN

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.fm-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, steps, now, out, want)} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {centres.map((cx, k) => <Housing key={k} cx={cx} w={width} plate={plates[k]} busy={ride !== null && ride.busy === k} />)}
          <Belt />
          <Hopper text={fmt(stage[0])} />
          <Tray text={fmt(out)} />
          {ride && <Ticket x={ride.x} y={ride.y} text={fmt(stage[Math.min(ride.stage, stage.length - 1)])} />}
          <Label x={HOPPER_X} y={22}>{inverse ? 'Input' : 'Step'}</Label>
          <Label x={TRAY_X} y={22}>Output</Label>
          {inverse && centres.map((cx, k) => (
            <g key={k} data-after={k + 1}>
              <line x1={cx} y1={116} x2={cx} y2={124} stroke={STEEL} strokeWidth={2} strokeLinecap="round" />
              <Ticket x={cx} y={134} text={fmt(stage[k + 1])} kind="small" />
              <Label x={cx} y={162}>{`step ${k + 1}`}</Label>
            </g>
          ))}
          {inverse && want && (
            <g data-wanted={fmt(want)}>
              <Ticket x={TRAY_X} y={134} text={fmt(want)} kind="wanted" />
              <Label x={TRAY_X} y={162}>Wanted</Label>
            </g>
          )}
          {config.task === 'pattern' && <Figure a={config.times} b={config.plus} n={now.x} />}
        </svg>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {inverse
            ? 'The small tickets show the number after each step. The dashed ticket is the number wanted.'
            : `The tray shows what your machine gives for this step.${config.task === 'pattern' && config.plus < 0 ? ' A dashed square is a tile that is missing.' : ''}`}
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {inverse ? (
          <Stepper label="Feed in" noun="number fed in" value={now.x} min={X_RANGE.min} max={X_RANGE.max} set={(x) => put({ x })} locked={frozen} />
        ) : (
          <>
            <Stepper label="Step" noun="step number" value={now.x} min={STEP_RANGE.min} max={STEP_RANGE.max} set={(x) => put({ x })} locked={locked} />
            <div className="grid grid-cols-2 gap-x-6">
              <Stepper label="Times" noun="multiplier" value={now.a} min={A_RANGE.min} max={A_RANGE.max} set={(a) => put({ a })} locked={frozen} />
              <Stepper label="Add" noun="number added" value={now.b} min={B_RANGE.min} max={B_RANGE.max} set={(b) => put({ b })} locked={frozen} />
            </div>
          </>
        )}
      </div>

      <p className="fm-kbd hidden text-[12px] font-semibold text-ss-slate">Tab to a number, then the arrow keys change it.</p>
      <span className="sr-only" aria-live="polite">
        {inverse ? `${fmt({ n: now.x, d: 1 })} fed in, ${fmt(out)} out, ${fmt(want ?? out)} wanted.` : `Step ${now.x}, ${config.task === 'pattern' ? tilesAt(config.times, config.plus, now.x) : 0} tiles, machine gives ${fmt(out)}.`}
      </span>
      {(said || miss) && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said ? said.lead : miss}</p>
          {said && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{said.detail}</p>}
        </div>
      )}
    </div>
  )
}
