'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Axis, Change, Force, ForcesConfig, ForcesState, FmaTask, MakeTask, ResultantTask, SceneDef, Sign, Way } from './config'
import {
  CHANGES, CHANGE_NAMES, FIND_LABEL, UNIT_LABEL, UNIT_SPOKEN,
  axisOf, fmaCase, fmaGivens, fmaSaid, makeForces, makeRange, makeSaid, makeScenario, motionText, readAnswer, readChange, readSize, readSteps, readWay,
  resultantSaid, resultantScenario, signOf, stepForKey, truthOf, waysFor, wayOf, wayPhrase, aimText,
} from './config'

// The scene's own drawing sits on a pale plate in both themes, like a figure in a book, so every part that carries meaning is
// over 3:1 on it. The controls around it use the design tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const WITH = '#1D4ED8'
const AGAINST = '#C2410C'
const RESULT = '#047857'
const FLOOR = '#64748B'
const FONT = 'system-ui, sans-serif'

const f = (v: number) => Math.round(v * 10) / 10

// ---------------------------------------------------------------------------
// Where everything sits: pure, so the tests can hold it to the bar (arrows and labels inside the card and apart, each
// label nearer its own arrow than any other).

export const CARD_W = 360
const PAD = 10
export const LABEL_H = 32
/** A label's box ends this far above its arrow's line: nearer than the next lane's arrow, which is a lane (25 either side) away. */
export const LABEL_GAP = 8
const HEAD_L = 9
const HEAD_W = 6
const LANE = 25

export const textW = (text: string, size: number, bold = false): number => Math.ceil(text.length * size * (bold ? 0.62 : 0.58)) + 2

export type Pt = { x: number; y: number }
export type Rect = { x0: number; y0: number; x1: number; y1: number }
export type Spec = { id: number; name: string; value: string; way: Way; steps: number; role: 'with' | 'against'; adjustable?: boolean }
export type Lay = Spec & {
  tail: Pt
  tip: Pt
  /** The label's box, and where its two lines are anchored. */
  label: Rect & { tx: number; anchor: 'middle' | 'start' | 'end' }
}
export type ResultLay = { tail: Pt; tip: Pt; steps: number; zero: boolean; way: Way | 'none'; value: string; label: Rect & { tx: number; anchor: 'middle' | 'start' | 'end' } }
export type ScaleBar = { x0: number; y0: number; x1: number; y1: number; text: string; tx: number; ty: number }
export type Layout = {
  w: number
  h: number
  axis: Axis
  cx: number
  cy: number
  box: Rect
  floorY: number | null
  arrows: Lay[]
  scale: ScaleBar | null
  /** The resultant, to draw once marked (the room for it is always kept). */
  result: ResultLay | null
}

export type LayoutOptions = {
  /** Draw a scale bar of this many newtons per bar (null for none). */
  scaleBar: boolean
  /** Keep room for the resultant arrow, and place it if given. */
  keepResult: boolean
  result?: { steps: number; way: Way | 'none'; value: string } | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function labelFor(spec: { name: string; value: string }): { w: number } {
  return { w: Math.max(textW(spec.name, 12), textW(spec.value, 14, true)) + 6 }
}

/** The picture for an object and its forces. */
export function layoutScene(scene: SceneDef, specs: readonly Spec[], opts: LayoutOptions): Layout {
  const px = scene.px
  const scaleN = 4 * scene.unit
  if (scene.axis === 'horizontal') {
    const bw = 88
    const bh = 68
    const cx = CARD_W / 2
    const x0 = cx - bw / 2
    const x1 = cx + bw / 2
    const posCount = specs.filter((s) => signOf(s.way) === 1).length
    const negCount = specs.length - posCount
    const maxLanes = Math.max(1, posCount, negCount)
    const top = (maxLanes === 2 ? LANE : 0) + LABEL_GAP + LABEL_H
    const cy = PAD + top + 2
    const seen = { pos: 0, neg: 0 }
    const arrows: Lay[] = specs.map((s) => {
      const sign = signOf(s.way)
      const count = sign === 1 ? posCount : negCount
      const k = sign === 1 ? seen.pos++ : seen.neg++
      const y = cy + (count === 1 ? 0 : k === 0 ? -LANE : LANE)
      const tail = { x: sign === 1 ? x1 : x0, y }
      const tip = { x: tail.x + sign * s.steps * px, y }
      const { w } = labelFor(s)
      const mid = (tail.x + tip.x) / 2
      const lo = sign === 1 ? x1 + 2 : 6
      const hi = sign === 1 ? CARD_W - 6 : x0 - 2
      const c = clamp(mid, lo + w / 2, hi - w / 2)
      const y0 = y - LABEL_GAP - LABEL_H
      return { ...s, tail, tip, label: { x0: c - w / 2, x1: c + w / 2, y0, y1: y0 + LABEL_H, tx: c, anchor: 'middle' } }
    })
    const boxBottom = cy + bh / 2
    const yr = boxBottom + 6 + LABEL_GAP + LABEL_H
    let result: ResultLay | null = null
    if (opts.result) {
      const r = opts.result
      const sign: Sign = r.way === 'none' ? 1 : signOf(r.way)
      const len = r.way === 'none' ? 0 : r.steps * px
      const tail = { x: cx, y: yr }
      const tip = { x: cx + sign * len, y: yr }
      const w = Math.max(textW('Resultant', 12), textW(r.value, 14, true)) + 6
      const c = clamp(r.way === 'none' ? cx : (tail.x + tip.x) / 2, 6 + w / 2, CARD_W - 6 - w / 2)
      const y0 = yr - LABEL_GAP - LABEL_H
      result = { tail, tip, steps: r.steps, zero: r.way === 'none', way: r.way, value: r.value, label: { x0: c - w / 2, x1: c + w / 2, y0, y1: y0 + LABEL_H, tx: c, anchor: 'middle' } }
    }
    const scaleY = (opts.keepResult ? yr : boxBottom + 14) + 30
    const scale: ScaleBar | null = opts.scaleBar
      ? { x0: 16, y0: scaleY, x1: 16 + 4 * px, y1: scaleY, text: `= ${scaleN} N`, tx: 16 + 4 * px + 8, ty: scaleY + 4 }
      : null
    const h = (scale ? scaleY + 14 : opts.keepResult ? yr + 14 : boxBottom + 14) + PAD
    return { w: CARD_W, h, axis: 'horizontal', cx, cy, box: { x0, y0: cy - bh / 2, x1, y1: boxBottom }, floorY: boxBottom, arrows, scale, result }
  }
  // Vertical: forces up from the top of the object and down from its foot.
  const bw = 64
  const bh = 96
  const cx = CARD_W / 2
  // Room for arrows up and down, only where there can be one (a lone downward arrow needs none above).
  const full = scene.hi * px + 6
  const roomUp = opts.keepResult || specs.some((s) => signOf(s.way) === 1) ? full : 8
  const roomDown = opts.keepResult || specs.some((s) => signOf(s.way) === -1) ? full : 8
  const y0 = PAD + roomUp
  const y1 = y0 + bh
  const h = y1 + roomDown + PAD
  const cy = (y0 + y1) / 2
  const arrows: Lay[] = specs.map((s) => {
    const sign = signOf(s.way)
    const tail = { x: cx, y: sign === 1 ? y0 : y1 }
    const tip = { x: cx, y: tail.y - sign * s.steps * px }
    const { w } = labelFor(s)
    const mid = (tail.y + tip.y) / 2
    const lo = sign === 1 ? PAD : y1 + 2
    const hi = sign === 1 ? y0 - 2 : h - PAD
    const top = clamp(mid - LABEL_H / 2, lo, hi - LABEL_H)
    const xl = cx + 14
    return { ...s, tail, tip, label: { x0: xl, x1: xl + w, y0: top, y1: top + LABEL_H, tx: xl + 3, anchor: 'start' } }
  })
  let result: ResultLay | null = null
  if (opts.result) {
    const r = opts.result
    const sign: Sign = r.way === 'none' ? 1 : signOf(r.way)
    const len = r.way === 'none' ? 0 : r.steps * px
    const xr = cx - 70
    const tail = { x: xr, y: cy }
    const tip = { x: xr, y: cy - sign * len }
    const w = Math.max(textW('Resultant', 12), textW(r.value, 14, true)) + 6
    const mid = r.way === 'none' ? cy : (tail.y + tip.y) / 2
    const top = clamp(mid - LABEL_H / 2, PAD, h - PAD - LABEL_H)
    const xr1 = xr - 12
    result = { tail, tip, steps: r.steps, zero: r.way === 'none', way: r.way, value: r.value, label: { x0: xr1 - w, x1: xr1, y0: top, y1: top + LABEL_H, tx: xr1 - 3, anchor: 'end' } }
  }
  const sy1 = h - PAD
  const scale: ScaleBar | null = opts.scaleBar
    ? { x0: 22, y0: sy1 - 4 * px, x1: 22, y1: sy1, text: `= ${scaleN} N`, tx: 32, ty: sy1 - 2 * px + 4 }
    : null
  return { w: CARD_W, h, axis: 'vertical', cx, cy, box: { x0: cx - bw / 2, y0, x1: cx + bw / 2, y1 }, floorY: null, arrows, scale, result }
}

/** The steps an arrow has when its end is at a point (a pointer's place in the drawing), kept within what the force may be. */
export function stepsFromPoint(arrow: { tail: Pt; way: Way }, pt: Pt, px: number, lo: number, hi: number): number {
  const sign = signOf(arrow.way)
  const along = axisOf(arrow.way) === 'horizontal' ? (pt.x - arrow.tail.x) * sign : (arrow.tail.y - pt.y) * sign
  return clamp(Math.round(along / px), lo, hi)
}

// ---------------------------------------------------------------------------
// Drawing: the objects, the arrows and the labels.

function Arrow({ tail, tip, color, dashed }: { tail: Pt; tip: Pt; color: string; dashed?: boolean }) {
  const dx = Math.sign(tip.x - tail.x)
  const dy = Math.sign(tip.y - tail.y)
  const bx = tip.x - dx * HEAD_L
  const by = tip.y - dy * HEAD_L
  const px = dy * HEAD_W
  const py = dx * HEAD_W
  return (
    <g aria-hidden="true">
      <line x1={f(tail.x)} y1={f(tail.y)} x2={f(bx)} y2={f(by)} stroke={color} strokeWidth={4} strokeDasharray={dashed ? '6 4' : undefined} />
      <polygon points={`${f(tip.x)},${f(tip.y)} ${f(bx + px)},${f(by + py)} ${f(bx - px)},${f(by - py)}`} fill={color} />
    </g>
  )
}

function Label({ label, name, value, color }: { label: Lay['label']; name: string; value: string; color: string }) {
  return (
    <g aria-hidden="true" fontFamily={FONT} textAnchor={label.anchor}>
      <text x={f(label.tx)} y={f(label.y0 + 12)} fontSize={12} fill={SOFT}>{name}</text>
      <text x={f(label.tx)} y={f(label.y0 + 28)} fontSize={14} fontWeight={800} fill={color}>{value}</text>
    </g>
  )
}

/** The box, drawn to fill an 88 by 68 space (or 64 by 96 upright) centred on cx, cy. */
function Figure({ scene, cx, cy, facing }: { scene: SceneDef; cx: number; cy: number; facing: Sign }) {
  if (scene.id === 'box') {
    return (
      <g aria-hidden="true">
        <rect x={cx - 42} y={cy - 28} width={84} height={62} rx={4} fill="#D6A55B" stroke="#7A4B12" strokeWidth={2} />
        <path d={`M ${cx - 42} ${cy - 28} L ${cx + 42} ${cy + 34} M ${cx + 42} ${cy - 28} L ${cx - 42} ${cy + 34}`} stroke="#7A4B12" strokeWidth={1.5} />
        <rect x={cx - 32} y={cy - 19} width={64} height={44} fill="none" stroke="#7A4B12" strokeWidth={1.5} />
      </g>
    )
  }
  if (scene.id === 'car') {
    return (
      <g aria-hidden="true" transform={`translate(${cx} 0) scale(${facing} 1) translate(${-cx} 0)`}>
        <path d={`M ${cx - 44} ${cy + 20} V ${cy - 2} Q ${cx - 44} ${cy - 8} ${cx - 38} ${cy - 8} H ${cx - 20} L ${cx - 10} ${cy - 24} H ${cx + 12} L ${cx + 24} ${cy - 8} H ${cx + 38} Q ${cx + 44} ${cy - 8} ${cx + 44} ${cy - 2} V ${cy + 20} Z`} fill="#64748B" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d={`M ${cx - 6} ${cy - 20} H ${cx + 10} L ${cx + 19} ${cy - 8} H ${cx - 6} Z`} fill="#E2E8F0" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={cx + 40} cy={cy + 2} r={3} fill="#FDE047" stroke={INK} strokeWidth={1} />
        {[-26, 26].map((dx) => (
          <g key={dx}>
            <circle cx={cx + dx} cy={cy + 22} r={11} fill="#1E293B" stroke={INK} strokeWidth={1.5} />
            <circle cx={cx + dx} cy={cy + 22} r={4} fill="#CBD5E1" />
          </g>
        ))}
      </g>
    )
  }
  if (scene.id === 'boat') {
    return (
      <g aria-hidden="true" transform={`translate(${cx} 0) scale(${facing} 1) translate(${-cx} 0)`}>
        <path d={`M ${cx - 42} ${cy + 4} H ${cx + 44} L ${cx + 28} ${cy + 26} H ${cx - 34} Z`} fill="#B45309" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <rect x={cx - 14} y={cy - 14} width={28} height={18} fill="#F8FAFC" stroke={INK} strokeWidth={1.5} />
        <rect x={cx - 9} y={cy - 10} width={8} height={8} fill="#93C5FD" stroke={INK} strokeWidth={1} />
        <line x1={cx + 20} y1={cy + 4} x2={cx + 20} y2={cy - 24} stroke={INK} strokeWidth={2} />
        <path d={`M ${cx + 20} ${cy - 24} L ${cx + 34} ${cy - 19} L ${cx + 20} ${cy - 14} Z`} fill="#DC2626" stroke={INK} strokeWidth={1} />
        <path d={`M ${cx - 44} ${cy + 26} q 11 -7 22 0 t 22 0 t 22 0 t 22 0 V ${cy + 34} H ${cx - 44} Z`} fill="#BFDBFE" stroke="#2563EB" strokeWidth={1.5} />
      </g>
    )
  }
  // The skydiver, falling face down with arms and legs out.
  const top = cy - 48
  return (
    <g aria-hidden="true">
      <path d={`M ${cx - 9} ${top + 30} L ${cx - 30} ${top + 24} M ${cx + 9} ${top + 30} L ${cx + 30} ${top + 24} M ${cx - 6} ${top + 60} L ${cx - 19} ${top + 88} M ${cx + 6} ${top + 60} L ${cx + 19} ${top + 88}`} stroke="#0F766E" strokeWidth={6} strokeLinecap="round" fill="none" />
      <rect x={cx - 10} y={top + 22} width={20} height={40} rx={7} fill="#0F766E" stroke={INK} strokeWidth={1.5} />
      <rect x={cx - 6} y={top + 28} width={12} height={20} rx={2} fill="#F59E0B" stroke={INK} strokeWidth={1} />
      <circle cx={cx} cy={top + 12} r={9} fill="#F5C9A3" stroke={INK} strokeWidth={1.5} />
      <path d={`M ${cx - 9} ${top + 11} A 9 9 0 0 1 ${cx + 9} ${top + 11} Z`} fill="#1E3A8A" stroke={INK} strokeWidth={1} />
    </g>
  )
}

function Scale({ s }: { s: ScaleBar }) {
  const vertical = s.x0 === s.x1
  return (
    <g aria-hidden="true">
      <line x1={s.x0} y1={s.y0} x2={s.x1} y2={s.y1} stroke={INK} strokeWidth={2} />
      {vertical ? (
        <path d={`M ${s.x0 - 4} ${s.y0} H ${s.x0 + 4} M ${s.x0 - 4} ${s.y1} H ${s.x0 + 4}`} stroke={INK} strokeWidth={2} />
      ) : (
        <path d={`M ${s.x0} ${s.y0 - 4} V ${s.y0 + 4} M ${s.x1} ${s.y0 - 4} V ${s.y0 + 4}`} stroke={INK} strokeWidth={2} />
      )}
      <text x={s.tx} y={s.ty} fontSize={12} fontFamily={FONT} fill={SOFT}>{s.text}</text>
    </g>
  )
}

const colorOf = (a: { role: 'with' | 'against' }) => (a.role === 'with' ? WITH : AGAINST)

/** The drawing: floor, object, arrows, the scale and (once marked) the resultant. `children` go over the top (a make card's handle). */
function Drawing({ layout, scene, facing, children }: { layout: Layout; scene: SceneDef; facing: Sign; children?: ReactNode }) {
  return (
    <>
      <rect width={layout.w} height={layout.h} rx={14} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {layout.floorY !== null && scene.id !== 'boat' && <line x1={6} y1={layout.floorY} x2={layout.w - 6} y2={layout.floorY} stroke={FLOOR} strokeWidth={2} aria-hidden="true" />}
      <Figure scene={scene} cx={layout.cx} cy={layout.cy} facing={facing} />
      {layout.arrows.map((a) => (
        <g key={a.id}>
          <Arrow tail={a.tail} tip={a.tip} color={colorOf(a)} />
          <Label label={a.label} name={a.name} value={a.value} color={colorOf(a)} />
        </g>
      ))}
      {layout.result && (
        <g>
          {layout.result.zero ? (
            <circle cx={layout.result.tail.x} cy={layout.result.tail.y} r={5} fill={RESULT} aria-hidden="true" />
          ) : (
            <Arrow tail={layout.result.tail} tip={layout.result.tip} color={RESULT} dashed />
          )}
          <Label label={layout.result.label} name="Resultant" value={layout.result.value} color={RESULT} />
        </g>
      )}
      {layout.scale && <Scale s={layout.scale} />}
      {children}
    </>
  )
}

// ---------------------------------------------------------------------------
// Pieces of the card.

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5 text-center text-[14px] font-bold leading-snug text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
/** A chosen option, set inline: as classes, the base's border-ss-line won and a pick looked like no pick. */
const CHOSEN = { borderColor: 'var(--subject)', background: 'color-mix(in srgb, var(--subject) 14%, transparent)' }

/** The board moves a selected card with the arrows; inside the scene they belong to the scene. */
const keepArrows = (e: KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

function Said({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div aria-live="polite" className="flex w-full flex-col items-center gap-1 text-center">
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? 'text-[15px] font-extrabold leading-snug text-ss-ink' : 'text-[13px] font-semibold leading-snug text-ss-slate'}>
          {line}
        </p>
      ))}
    </div>
  )
}

const CHIP = 'rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1 text-[14px] font-extrabold text-ss-ink'

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label={label}>
      {items.map((c) => <li key={c} className={CHIP}>{c}</li>)}
    </ul>
  )
}

type Option<T extends string> = { id: T; text: string }

/** One of a few, as radio buttons with a single stop on Tab and the arrow keys to move. */
function Choice<T extends string>({ label, options, value, onPick, locked, columns }: {
  label: string; options: Option<T>[]; value: T | ''; onPick(id: T): void; locked: boolean; columns: 1 | 3
}) {
  const id = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (step === undefined || locked) return
    e.preventDefault()
    e.stopPropagation()
    const at = options.findIndex((o) => o.id === value)
    // With nothing chosen yet, forward lands on the first and back on the last.
    const next = options[((at < 0 ? (step > 0 ? -1 : 0) : at) + step + options.length) % options.length]
    onPick(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p id={`${id}-l`} className="text-[14px] font-extrabold leading-snug text-ss-ink">{label}</p>
      <div role="radiogroup" aria-labelledby={`${id}-l`} className={columns === 3 ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
        {options.map((o, i) => {
          const chosen = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-disabled={locked || undefined}
              tabIndex={chosen || (!value && i === 0) ? 0 : -1}
              ref={(el) => { refs.current[o.id] = el }}
              onClick={() => { if (!locked) onPick(o.id) }}
              onKeyDown={onKey}
              className={`${BUTTON} ${columns === 1 ? 'justify-start text-left' : ''}`}
              style={chosen ? CHOSEN : undefined}
            >
              {o.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NumberField({ label, unit, value, onChange, locked, hint }: {
  label: string; unit: string; value: string; onChange(v: string): void; locked: boolean; hint: string
}) {
  const id = useId()
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={`${id}-n`} className="text-[14px] font-extrabold leading-snug text-ss-ink">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-n`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          readOnly={locked}
          aria-readonly={locked || undefined}
          aria-describedby={`${id}-h`}
          onChange={(e) => onChange(e.target.value.slice(0, 14))}
          // The board's own keys stay out of the box.
          onKeyDown={(e) => e.stopPropagation()}
          className="nodrag nowheel w-32 rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-center text-[16px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)]"
        />
        <span className="text-[15px] font-extrabold text-ss-ink" aria-hidden="true">{unit}</span>
      </div>
      <p id={`${id}-h`} className="text-[12px] font-semibold text-ss-slate">{hint}</p>
    </div>
  )
}

const Unshown = (): ReactNode => <p className="text-[13px] font-semibold text-ss-slate">This card could not be drawn.</p>

/** What the forces are, as a sentence for a screen reader: the givens, never the resultant. */
const spokenForces = (fs: readonly { name: string; n: number; way: Way }[]) => fs.map((x) => `${x.name}, ${x.n} newtons ${wayPhrase(x.way)}`).join('; ')

const specsOf = (fs: readonly Force[], adjust?: number): Spec[] =>
  fs.map((x) => ({ id: x.id, name: x.name, value: `${x.n} N`, way: x.way, steps: x.steps, role: x.side, adjustable: x.id === adjust }))

const facingOf = (m: SceneDefFacing): Sign => (m === 'rest' ? 1 : signOf(m))
type SceneDefFacing = 'rest' | Way

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const SCALE_NOTE = 'Arrows are drawn to the scale shown.'
const lineNote = (scene: SceneDef) =>
  scene.axis === 'horizontal'
    ? 'Only the forces along the line are drawn: up and down, the weight and the support balance.'
    : 'Only the forces up and down are drawn.'

// ---------------------------------------------------------------------------
// resultant: find the resultant, then say what happens to the motion.

function ResultantCard({ task, state, setState, marked, locked }: {
  task: ResultantTask; state: ForcesState; setState(next: ForcesState): void; marked: SceneMarked; locked: boolean
}) {
  const s = resultantScenario(task)
  if (!s) return <Unshown />
  const scene = s.scene
  const truth = truthOf(s)
  const named = marked !== 'idle'
  const size = readSize(state)
  const way = readWay(state, scene.axis)
  const change = readChange(state)
  const layout = layoutScene(scene, specsOf(s.forces), {
    scaleBar: true,
    keepResult: true,
    result: named ? { steps: truth.size / scene.unit, way: truth.way, value: `${truth.size} N` } : null,
  })
  const lines = named ? resultantSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []
  const write = (patch: ForcesState) => setState({ size, way, change, ...patch })
  const ways = waysFor(scene.axis).map((w) => ({ id: w.id, text: w.label }))
  const alt = `${cap(scene.article)} ${scene.noun}, ${motionText(s.motion)}. Its forces: ${spokenForces(s.forces)}. ${SCALE_NOTE}`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <Chips label="Starting motion" items={[`Starts ${motionText(s.motion)}`]} />
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="block w-full" style={{ maxWidth: layout.w }} role="img" aria-label={alt}>
          <Drawing layout={layout} scene={scene} facing={facingOf(s.motion === 'rest' ? wayOf(scene.axis, s.dsign) : s.motion)} />
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {SCALE_NOTE} {lineNote(scene)}
        </figcaption>
      </figure>
      <NumberField
        label="Resultant force"
        unit="N"
        value={size}
        locked={locked}
        hint="Type a number of newtons."
        onChange={(v) => write({ size: v })}
      />
      <Choice label="Direction of the resultant" options={ways} value={way} locked={locked} columns={3} onPick={(id) => write({ way: id })} />
      <Choice
        label="What happens to its motion?"
        options={CHANGES.map((c): Option<Change> => ({ id: c, text: CHANGE_NAMES[c] }))}
        value={change}
        locked={locked}
        columns={1}
        onPick={(id) => write({ change: id })}
      />
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// make: set one force so the resultant meets the aim.

function MakeCard({ task, state, setState, marked, locked }: {
  task: MakeTask; state: ForcesState; setState(next: ForcesState): void; marked: SceneMarked; locked: boolean
}) {
  const m = makeScenario(task)
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef(false)
  const [focused, setFocused] = useState(false)
  const [said, setSaid] = useState('')
  if (!m || !task.target) return <Unshown />
  const scene = m.scene
  const [lo, hi] = makeRange(m)
  const steps = readSteps(m, state)
  const forces = makeForces(m, steps)
  const named = marked !== 'idle'
  const live = !locked
  const net = forces.reduce((a, x) => a + x.sign * x.n, 0)
  const layout = layoutScene(scene, specsOf(forces, m.adjust), {
    scaleBar: true,
    keepResult: true,
    // The learner's own resultant is drawn only once marked.
    result: named ? { steps: Math.abs(net) / scene.unit, way: net === 0 ? 'none' : wayOf(scene.axis, net > 0 ? 1 : -1), value: `${Math.abs(net)} N` } : null,
  })
  const adj = layout.arrows[m.adjust]
  // The ring the learner holds sits on the arrowhead, so it never covers the label above the arrow.
  const along = { x: Math.sign(adj.tip.x - adj.tail.x), y: Math.sign(adj.tip.y - adj.tail.y) }
  const grip = { x: adj.tip.x - along.x * 8, y: adj.tip.y - along.y * 8 }
  const outward = signOf(adj.way)
  const slotName = adj.name.toLowerCase()
  const spoken = (k: number) => `${k * scene.unit} newtons ${wayPhrase(adj.way)}`
  const set = (k: number) => {
    const next = Math.max(lo, Math.min(hi, k))
    if (next === steps) return
    setState({ steps: next })
    setSaid(`The ${slotName} is now ${spoken(next)}.`)
  }
  const fromPointer = (e: PointerEvent) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const pt = { x: ((e.clientX - box.left) / box.width) * layout.w, y: ((e.clientY - box.top) / box.height) * layout.h }
    set(stepsFromPoint(adj, pt, scene.px, lo, hi))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    let to: number | null = null
    if (e.key === 'Home') to = lo
    else if (e.key === 'End') to = hi
    else {
      const d = stepForKey(e.key, outward, scene.axis)
      if (d !== null) to = steps + d
    }
    if (to === null) return
    e.preventDefault()
    e.stopPropagation()
    set(to)
  }
  const horizontal = scene.axis === 'horizontal'
  const reach = hi * scene.px
  const hit = horizontal
    ? { x: Math.min(adj.tail.x, adj.tail.x + outward * reach) - 6, y: adj.tail.y - 22, w: reach + 12, h: 44 }
    : { x: adj.tail.x - 22, y: Math.min(adj.tail.y, adj.tail.y - outward * reach) - 6, w: 44, h: reach + 12 }
  const lines = named ? makeSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []
  const alt = `${cap(scene.article)} ${scene.noun}, ${motionText(m.motion)}. Its forces: ${spokenForces(forces)}. ${SCALE_NOTE}`
  const stepN = scene.unit
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <Chips label="The card" items={[`Starts ${motionText(m.motion)}`, `Aim: ${aimText(task.target)}`]} />
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        <svg
          ref={svg}
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className={`block w-full select-none ${live ? 'touch-none' : ''}`}
          style={{ maxWidth: layout.w }}
          role="group"
          aria-label={alt}
        >
          <Drawing layout={layout} scene={scene} facing={facingOf(m.motion === 'rest' ? wayOf(scene.axis, m.dsign) : m.motion)}>
            <g
              role="slider"
              tabIndex={live ? 0 : -1}
              aria-label={`The ${slotName}. Drag the end of its arrow, or use the arrow keys to change it by ${stepN} newtons`}
              aria-valuemin={lo * stepN}
              aria-valuemax={hi * stepN}
              aria-valuenow={steps * stepN}
              aria-valuetext={spoken(steps)}
              aria-orientation={horizontal ? 'horizontal' : 'vertical'}
              aria-readonly={!live || undefined}
              onKeyDown={onKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onPointerDown={(e) => {
                if (!live) return
                grab.current = true
                e.currentTarget.setPointerCapture?.(e.pointerId)
                fromPointer(e)
              }}
              onPointerMove={(e) => { if (grab.current) fromPointer(e) }}
              onPointerUp={() => { grab.current = false }}
              onPointerCancel={() => { grab.current = false }}
              className={`outline-none focus-visible:outline-none ${live ? 'cursor-grab' : ''}`}
            >
              <rect x={f(hit.x)} y={f(hit.y)} width={f(hit.w)} height={f(hit.h)} fill="transparent" />
              {focused && live && <circle cx={f(grip.x)} cy={f(grip.y)} r={11} fill="none" stroke="var(--subject)" strokeWidth={3} />}
              <circle cx={f(grip.x)} cy={f(grip.y)} r={6.5} fill="#FFFFFF" stroke={colorOf(adj)} strokeWidth={2.5} aria-hidden="true" />
            </g>
          </Drawing>
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {SCALE_NOTE} {lineNote(scene)}
          {live ? ` Drag the ring on the arrowhead of the ${slotName}, or click it and use the arrow keys (one step is ${stepN} N).` : ''}
        </figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">{said}</p>
      {live && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" className={BUTTON} disabled={steps <= lo} onClick={() => set(steps - 1)}>Shorter</button>
          <button type="button" className={BUTTON} disabled={steps >= hi} onClick={() => set(steps + 1)}>Longer</button>
        </div>
      )}
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// f-ma: work out one quantity.

function FmaCard({ task, state, setState, marked, locked }: {
  task: FmaTask; state: ForcesState; setState(next: ForcesState): void; marked: SceneMarked; locked: boolean
}) {
  const c = fmaCase(task)
  if (!c) return <Unshown />
  const scene = c.scene
  const named = marked !== 'idle'
  // The force is drawn when it is given; when it is what to find, the picture holds only the object.
  const given = c.F !== null && c.find !== 'force'
  const specs: Spec[] = given
    ? [{ id: 0, name: 'Resultant force', value: `${c.F} N`, way: c.way, steps: Math.min(scene.hi, Math.round(90 / scene.px)), role: 'with' }]
    : []
  const layout = layoutScene(scene, specs, { scaleBar: false, keepResult: false })
  const lines = named ? fmaSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []
  const answer = readAnswer(state)
  const hint = c.unit === 'accel' ? 'Type a number. You may add m/s².' : c.unit === 'mass' ? 'Type a number of kilograms.' : 'Type a number of newtons.'
  const alt = `${cap(scene.article)} ${scene.noun}. ${fmaGivens(c).join('. ')}.`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <Chips label="What the card gives" items={fmaGivens(c)} />
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="block w-full" style={{ maxWidth: layout.w }} role="img" aria-label={alt}>
          <Drawing layout={layout} scene={scene} facing={c.way === 'left' || c.way === 'right' ? signOf(c.way) : 1} />
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {given ? 'The arrow shows the resultant force on it.' : 'Only the object is drawn.'}
        </figcaption>
      </figure>
      <NumberField
        label={`${FIND_LABEL[c.find]} (${UNIT_LABEL[c.unit]})`}
        unit={UNIT_LABEL[c.unit]}
        value={answer}
        locked={locked}
        hint={hint}
        onChange={(v) => setState({ answer: v })}
      />
      <p className="sr-only">{`Answer in ${UNIT_SPOKEN[c.unit]}.`}</p>
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ForcesView({ config, state, setState, marked, locked }: SceneViewProps<ForcesConfig, ForcesState>) {
  const task = config.task
  const s: ForcesState = state && typeof state === 'object' ? state : {}
  const common = { state: s, setState, marked, locked }
  if (task.kind === 'resultant') return <ResultantCard task={task} {...common} />
  if (task.kind === 'make') return <MakeCard task={task} {...common} />
  return <FmaCard task={task} {...common} />
}

