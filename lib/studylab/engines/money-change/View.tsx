'use client'
import { useId, useRef, type CSSProperties, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Currency, Item, MoneyConfig, MoneyState } from './config'
import { coinsOf, currencyOf, drawable, fmt, goalOf, itemOf, madeText, moneyChangeEngine, paidPieces, pieceName, reachedOf, runningOf, startOf, working } from './config'

type Props = SceneViewProps<MoneyConfig, MoneyState>

// A shop counter is not a dark subject: a quiet light plate, as measure-shape's and network-sim's are, with real money on
// it. The plate keeps its own colours in both themes, so every coin keeps its contrast. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1E293B'
const SOFT = '#475569'
const FAINT = '#64748B'
const FONT = 'system-ui, sans-serif'
const TRACK = '#CBD5E1'
const HOP_LINE = '#94A3B8'
const TICK = '#64748B'
// A manila card price tag, and its string.
const TAG = '#FBF1D9'
const TAG_EDGE = '#B08F4E'
const STRING = '#9C8456'
// The till: a dark plastic drawer of coin wells.
const DRAWER = '#3F4957'
const DRAWER_EDGE = '#2B323C'
const WELL = '#56616F'
const WELL_BACK = '#343C47'
// Coin metals: face, rim, inner ring and the ink of the value.
type Metal = { face: string; edge: string; ring: string; ink: string }
const COPPER: Metal = { face: '#CD8A57', edge: '#8A4A22', ring: '#B06C3A', ink: '#3A1C08' }
const SILVER: Metal = { face: '#DFE4EA', edge: '#7C8796', ring: '#B2BBC6', ink: '#1E2933' }
const GOLD: Metal = { face: '#E6BE58', edge: '#977116', ring: '#C99B2E', ink: '#3A2905' }
// Notes, by value: plain flat colours, no national designs.
const NOTE_COLOURS: Record<number, { face: string; edge: string; line: string; light: string; ink: string }> = {
  500: { face: '#9BCDB9', edge: '#3F7E68', line: '#5E9F88', light: '#C6E4D8', ink: '#123A2D' },
  1000: { face: '#F2BC8A', edge: '#A9612A', line: '#D08A4C', light: '#F8D9BC', ink: '#45210A' },
  2000: { face: '#C2B0E0', edge: '#6F55A0', line: '#8F78BE', light: '#DDD3EF', ink: '#2A1A47' },
}

// ---------------------------------------------------------------------------
// Geometry, in viewBox units. Written out here, not read from config.ts: the two files import each other (the test checks
// they agree).

export const W = 360
export const H = 284
/** The counting line: one row across the counter, from its first tick to its last. */
export const X0 = 28
export const LAST = 330
export const LINE_Y = 152
/** The widest step between ticks; with more coins the step closes up so the row still fits. */
export const MAX_STEP = 50
export const ON_COUNTER = 8
/** How high each hop rises, and the gap between its top and the coin above it. */
export const HOP = 13
export const COIN_GAP = 4
/** Labels under a tick: their baseline below the line, and a second line for when the ticks are close. */
export const LABEL_DY = 18
export const LABEL_DY2 = 34
export const TILL = { x: 8, y: 210, w: 344, h: 66 }
export const TILL_LABEL_Y = 203
/** The top coin of each stack in the till. */
export const STACK_Y = 238
export const ITEM_Y = 46
export const TOP_LABEL_Y = 88
export const TAG_W = 72
export const TAG_H = 32
export const NOTE_W = 76
export const NOTE_H = 40

/** The step between ticks when `n` coins are on the counter. */
export const stepFor = (n: number) => Math.min(MAX_STEP, (LAST - X0) / Math.max(1, n))
/** Where coin `i` of `n` leaves from: its tick. */
export const slotOf = (i: number, n: number) => ({ x: X0 + stepFor(n) * i, y: LINE_Y })
/** The coin itself, resting just above the top of its hop, so the whole jump shows under it. */
export const coinCentre = (i: number, n: number, r: number) => ({ x: X0 + stepFor(n) * (i + 0.5), y: LINE_Y - HOP - COIN_GAP - r })
/** The tick it lands on, where the count is written. */
export const tickAfter = (i: number, n: number) => ({ x: X0 + stepFor(n) * (i + 1), y: LINE_Y })
/** Close ticks write every other count a line lower, so no two touch; the first goes low, clear of the start. */
export function labelDrop(labels: string[], n: number): boolean {
  return labels.some((s) => textWidth(s, 12) + 6 > stepFor(n))
}
export const labelY = (i: number, dropped: boolean) => LINE_Y + (dropped && i % 2 === 0 ? LABEL_DY2 : LABEL_DY)

/** Each coin's size, near the real coins' order of size: a bigger coin is not worth more. A full counter draws its coins a
 *  little smaller, so neighbours never touch. */
export function radiusOf(cur: Currency, value: number, n = 0): number {
  return baseRadius(cur, value) * Math.min(1, (stepFor(n) - 3) / 36)
}
function baseRadius(cur: Currency, value: number): number {
  const pounds: Record<number, number> = { 1: 16, 2: 17.5, 5: 15, 10: 17, 20: 16.5, 50: 18, 100: 17, 200: 18 }
  const dollars: Record<number, number> = { 1: 16, 5: 17, 10: 15.5, 25: 17.5, 50: 18, 100: 17.5, 200: 18 }
  return (cur === 'dollars' ? dollars : pounds)[value] ?? 17
}

/** The till's wells, smallest coin on the left. */
export function wellsOf(values: number[]) {
  const inner = TILL.w - 12
  const gap = 3
  const w = (inner - gap * (values.length - 1)) / values.length
  return values.map((value, k) => ({ value, x: TILL.x + 6 + k * (w + gap), y: TILL.y + 5, w, h: TILL.h - 10, cx: TILL.x + 6 + k * (w + gap) + w / 2, cy: STACK_Y }))
}

/** Where the item and its tag sit: to the left when the customer's money is beside them, in the middle when not. */
export const itemX = (task: MoneyConfig['task']) => (task === 'change' ? 58 : 122)
export const tagX = (task: MoneyConfig['task']) => itemX(task) + 54

/** The customer's money: one or two notes and coins, biggest first, lying together on the right. */
export function paidLayout(pieces: number[]): { value: number; note: boolean; x: number; y: number }[] {
  const note = (v: number) => v >= 500
  if (pieces.length <= 1) return pieces.map((v) => ({ value: v, note: note(v), x: 290, y: 46 }))
  const [a, b] = pieces
  if (note(a) && note(b)) return [{ value: a, note: true, x: 306, y: 32 }, { value: b, note: true, x: 270, y: 52 }]
  if (note(a)) return [{ value: a, note: true, x: 278, y: 44 }, { value: b, note: false, x: 324, y: 54 }]
  return [{ value: a, note: false, x: 272, y: 46 }, { value: b, note: false, x: 310, y: 46 }]
}

/** About how wide a short label is: digits and most letters near 0.6 of the font size, a point much less. */
export function textWidth(s: string, size: number): number {
  return [...s].reduce((w, ch) => w + size * (ch === '.' || ch === ' ' ? 0.3 : /[il]/.test(ch) ? 0.3 : /[mw]/.test(ch) ? 0.85 : 0.6), 0)
}

export type Box = { name: string; x: number; y: number; w: number; h: number; text?: boolean }

/** Every label and solid thing in the picture, so a test can prove none touch another and all are inside the plate. */
export function layoutOf(config: MoneyConfig, coins: number[]): Box[] {
  const cur = currencyOf(config)
  const boxes: Box[] = []
  const tx = tagX(config.task)
  const itemName = itemLabel(itemOf(config))
  boxes.push({ name: 'item label', x: itemX(config.task) - textWidth(itemName, 12) / 2, y: TOP_LABEL_Y - 10, w: textWidth(itemName, 12), h: 13, text: true })
  boxes.push({ name: 'tag', x: tx, y: ITEM_Y - TAG_H / 2, w: TAG_W, h: TAG_H })
  boxes.push({ name: 'price label', x: tx + TAG_W / 2 - textWidth('price', 12) / 2, y: TOP_LABEL_Y - 10, w: textWidth('price', 12), h: 13, text: true })
  if (config.task === 'change') {
    const laid = paidLayout(paidPieces(config))
    for (const p of laid) {
      if (p.note) boxes.push({ name: `paid ${p.value}`, x: p.x - NOTE_W / 2, y: p.y - NOTE_H / 2, w: NOTE_W, h: NOTE_H })
      else { const r = radiusOf(cur, p.value); boxes.push({ name: `paid ${p.value}`, x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }) }
    }
    const mid = laid.length ? (Math.min(...laid.map((p) => p.x)) + Math.max(...laid.map((p) => p.x))) / 2 : 290
    boxes.push({ name: 'paid label', x: mid - textWidth('paid', 12) / 2, y: TOP_LABEL_Y - 10, w: textWidth('paid', 12), h: 13, text: true })
  }
  const start = fmt(cur, startOf(config))
  const chipW = textWidth(start, 12) + 12
  boxes.push({ name: 'start', x: X0 - chipW / 2, y: LINE_Y + 6, w: chipW, h: 18, text: true })
  const run = runningOf(config, coins)
  const n = coins.length
  const labels = run.map((v) => fmt(cur, v))
  const dropped = labelDrop(labels, n)
  coins.forEach((v, i) => {
    const r = radiusOf(cur, v, n)
    const c = coinCentre(i, n, r)
    boxes.push({ name: `coin ${i}`, x: c.x - r, y: c.y - r, w: 2 * r, h: 2 * r })
    const t = tickAfter(i, n)
    boxes.push({ name: `count ${i}`, x: t.x - textWidth(labels[i], 12) / 2, y: labelY(i, dropped) - 10, w: textWidth(labels[i], 12), h: 13, text: true })
  })
  const tillWord = config.task === 'change' ? 'till' : 'your coins'
  boxes.push({ name: 'till label', x: TILL.x + 4, y: TILL_LABEL_Y - 10, w: textWidth(tillWord, 12), h: 13, text: true })
  boxes.push({ name: 'till', x: TILL.x, y: TILL.y, w: TILL.w, h: TILL.h })
  return boxes
}

// ---------------------------------------------------------------------------
// Drawing.

const f1 = (n: number) => Number(n.toFixed(2))

function metalOf(cur: Currency, value: number): Metal {
  if (value <= 2 || (cur === 'dollars' && value === 1)) return COPPER
  if (value === 100) return GOLD
  return SILVER
}
type Shape = 'round' | 'seven' | 'twelve' | 'two-metal'
function shapeOf(cur: Currency, value: number): Shape {
  if (value === 200) return 'two-metal'
  if (cur === 'pounds' && (value === 20 || value === 50)) return 'seven'
  if (cur === 'pounds' && value === 100) return 'twelve'
  return 'round'
}

/** A seven-sided coin whose sides bulge outwards, so it still rolls: the UK 20p and 50p. */
export function sevenPath(r: number): string {
  const pts = Array.from({ length: 7 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7; return { x: r * Math.cos(a), y: r * Math.sin(a) } })
  let d = `M ${f1(pts[0].x)} ${f1(pts[0].y)}`
  for (let k = 1; k <= 7; k++) {
    const p = pts[k % 7]
    const a = -Math.PI / 2 + ((k - 0.5) * 2 * Math.PI) / 7
    d += ` Q ${f1(1.02 * r * Math.cos(a))} ${f1(1.02 * r * Math.sin(a))} ${f1(p.x)} ${f1(p.y)}`
  }
  return `${d} Z`
}
function polygonPath(r: number, n: number): string {
  return `${Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + Math.PI / n + (k * 2 * Math.PI) / n; return `${k ? 'L' : 'M'} ${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}` }).join(' ')} Z`
}

type OutlineProps = { shape: Shape; r: number; fill: string; stroke?: string; strokeWidth?: number; strokeOpacity?: number; strokeLinejoin?: 'round'; transform?: string }
function Outline({ shape, r, ...rest }: OutlineProps) {
  if (shape === 'seven') return <path d={sevenPath(r)} {...rest} />
  if (shape === 'twelve') return <path d={polygonPath(r, 12)} {...rest} />
  return <circle r={r} {...rest} />
}

/** A flat coin seen from above: rim, inner ring and its value. The £2 and $2 have a gold ring round a silver middle. */
function Coin({ cur, value, r: given }: { cur: Currency; value: number; r?: number }) {
  const r = given ?? radiusOf(cur, value)
  const shape = shapeOf(cur, value)
  const name = pieceName(cur, value)
  if (shape === 'two-metal') {
    return (
      <g>
        <circle r={r} fill={GOLD.face} stroke={GOLD.edge} strokeWidth={1.5} />
        <circle r={r * 0.68} fill={SILVER.face} stroke={SILVER.edge} strokeWidth={1} />
        <text y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={12} fontWeight={800} fill={SILVER.ink}>{name}</text>
      </g>
    )
  }
  const m = metalOf(cur, value)
  return (
    <g>
      <Outline shape={shape} r={r} fill={m.face} stroke={m.edge} strokeWidth={1.5} strokeLinejoin="round" />
      <Outline shape={shape} r={r - 2.6} fill="none" stroke={m.ring} strokeWidth={1} strokeLinejoin="round" />
      <text y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={12} fontWeight={800} fill={m.ink} letterSpacing={-0.2}>{name}</text>
    </g>
  )
}

/** A short stack of one coin in a well of the till: the edges of two more show under the top one. */
function Stack({ cur, value }: { cur: Currency; value: number }) {
  const shape = shapeOf(cur, value)
  const r = radiusOf(cur, value)
  const edge = shape === 'two-metal' ? GOLD.edge : metalOf(cur, value).edge
  return (
    <g>
      <Outline shape={shape} r={r} transform="translate(0 5)" fill={edge} />
      <Outline shape={shape} r={r} transform="translate(0 2.5)" fill={edge} stroke={PLATE} strokeOpacity={0.35} strokeWidth={0.8} />
      <Coin cur={cur} value={value} />
    </g>
  )
}

/** A banknote, flat: a border, a round emblem, a thread and its value. */
function Note({ cur, value }: { cur: Currency; value: number }) {
  const c = NOTE_COLOURS[value] ?? NOTE_COLOURS[500]
  return (
    <g>
      <rect x={-NOTE_W / 2} y={-NOTE_H / 2} width={NOTE_W} height={NOTE_H} rx={3} fill={c.face} stroke={c.edge} strokeWidth={1.4} />
      <rect x={-NOTE_W / 2 + 4} y={-NOTE_H / 2 + 4} width={NOTE_W - 8} height={NOTE_H - 8} rx={2} fill="none" stroke={c.line} strokeWidth={1} />
      <circle cx={-20} cy={0} r={10} fill={c.light} stroke={c.line} strokeWidth={1} />
      <circle cx={-20} cy={0} r={5} fill="none" stroke={c.line} strokeWidth={1} />
      <line x1={-4} x2={-4} y1={-NOTE_H / 2} y2={NOTE_H / 2} stroke={c.edge} strokeWidth={1} strokeDasharray="3 2" />
      <text x={16} y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={c.ink}>{pieceName(cur, value)}</text>
    </g>
  )
}

/** A swing tag of manila card with a punched hole: the price. */
function PriceTag({ x, y, text }: { x: number; y: number; text: string }) {
  const w = TAG_W
  const h = TAG_H
  return (
    <g>
      <path d={`M ${x + 13} ${y} H ${x + w - 4} Q ${x + w} ${y} ${x + w} ${y + 4} V ${y + h - 4} Q ${x + w} ${y + h} ${x + w - 4} ${y + h} H ${x + 13} L ${x} ${y + h / 2} Z`} fill={TAG} stroke={TAG_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx={x + 9} cy={y + h / 2} r={2.6} fill={PLATE} stroke={TAG_EDGE} strokeWidth={1.2} />
      <text x={x + w / 2 + 5} y={y + h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK}>{text}</text>
    </g>
  )
}

/** The item's name, written under it. */
export const itemLabel = (item: Item) => (item === 'car' ? 'toy car' : item)

/** Where on each item its tag's string is tied. */
const TIES: Record<Item, { x: number; y: number }> = {
  apple: { x: 5, y: -31 }, ball: { x: 19, y: -19 }, book: { x: 26, y: -22 }, car: { x: 34, y: -2 }, pencil: { x: 45, y: 0 },
}

function ItemDrawing({ item, clip }: { item: Item; clip: string }) {
  switch (item) {
    case 'apple':
      return (
        <g>
          <path d="M 0 -18 C 10 -27 31 -22 30 0 C 29 22 14 31 0 26 C -14 31 -29 22 -30 0 C -31 -22 -10 -27 0 -18 Z" fill="#D9473B" stroke="#9C2A21" strokeWidth={1.6} />
          <path d="M -17 -12 C -21 -6 -21 3 -18 9" fill="none" stroke="#EE8A7F" strokeWidth={4} strokeLinecap="round" />
          <path d="M 0 -18 Q 1 -25 5 -31" fill="none" stroke="#6B4423" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M 3 -25 Q 15 -35 25 -27 Q 14 -18 3 -25 Z" fill="#5E9E44" stroke="#3F7330" strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M 5 -25 Q 14 -28 22 -27" fill="none" stroke="#3F7330" strokeWidth={0.9} />
        </g>
      )
    case 'ball': {
      // A football: a dark pentagon in the middle, five more cut off by the rim, white panels between, joined by seams.
      const R = 27
      const mid = Array.from({ length: 5 }, (_, k) => -Math.PI / 2 + (k * 2 * Math.PI) / 5)
      const rims = mid.map((a) => a + Math.PI / 5)
      const rimPent = (b: number) => Array.from({ length: 5 }, (_, j) => { const t = b + Math.PI + (j * 2 * Math.PI) / 5; return { x: 25 * Math.cos(b) + 9 * Math.cos(t), y: 25 * Math.sin(b) + 9 * Math.sin(t) } })
      const nearest = (pts: { x: number; y: number }[], p: { x: number; y: number }) => pts.reduce((best, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? q : best))
      const seams = mid.flatMap((a, k) => {
        const v = { x: 8.5 * Math.cos(a), y: 8.5 * Math.sin(a) }
        const j = { x: 16 * Math.cos(a), y: 16 * Math.sin(a) }
        return [[v, j], [j, nearest(rimPent(rims[k]), j)], [j, nearest(rimPent(rims[(k + 4) % 5]), j)]]
      })
      return (
        <g>
          <defs><clipPath id={clip}><circle r={R - 0.8} /></clipPath></defs>
          <circle r={R} fill="#FFFFFF" />
          <g clipPath={`url(#${clip})`}>
            <path d={polygonPathAt(0, 0, 8.5, 5, -Math.PI / 2)} fill="#334155" />
            {rims.map((b) => <path key={b} d={`${rimPent(b).map((p, i) => `${i ? 'L' : 'M'} ${f1(p.x)} ${f1(p.y)}`).join(' ')} Z`} fill="#334155" />)}
            {seams.map(([p, q], i) => <line key={i} x1={f1(p.x)} y1={f1(p.y)} x2={f1(q.x)} y2={f1(q.y)} stroke="#64748B" strokeWidth={1.2} strokeLinecap="round" />)}
          </g>
          <circle r={R} fill="none" stroke="#475569" strokeWidth={1.6} />
        </g>
      )
    }
    case 'book':
      return (
        <g>
          <rect x={-28} y={-21} width={60} height={50} rx={3} fill="#F3EBD6" stroke="#B9A77F" strokeWidth={1.2} />
          {[22, 25, 28].map((x) => <line key={x} x1={x} x2={x} y1={-16} y2={24} stroke="#D9CCA8" strokeWidth={0.9} />)}
          <rect x={-32} y={-25} width={60} height={50} rx={3} fill="#3E7CB1" stroke="#24557F" strokeWidth={1.5} />
          <rect x={-32} y={-25} width={10} height={50} rx={2} fill="#2D6596" />
          <rect x={-15} y={-14} width={36} height={16} rx={2} fill="#E6EFF8" />
          <line x1={-10} x2={16} y1={-8.5} y2={-8.5} stroke="#3E7CB1" strokeWidth={2} strokeLinecap="round" />
          <line x1={-10} x2={8} y1={-3.5} y2={-3.5} stroke="#3E7CB1" strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )
    case 'car':
      return (
        <g>
          {[[-24, -21], [12, -21], [-24, 15], [12, 15]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={13} height={6} rx={2} fill="#1F2937" />)}
          <rect x={-35} y={-17} width={70} height={34} rx={11} fill="#E0563F" stroke="#A3341F" strokeWidth={1.5} />
          <path d="M 7 -12 L 15 -10 Q 17 0 15 10 L 7 12 Z" fill="#BFD9EC" stroke="#5B7A90" strokeWidth={1} strokeLinejoin="round" />
          <path d="M -15 -11 L -21 -9 Q -22 0 -21 9 L -15 11 Z" fill="#BFD9EC" stroke="#5B7A90" strokeWidth={1} strokeLinejoin="round" />
          <rect x={-14} y={-12} width={21} height={24} rx={4} fill="#C84A35" />
          <circle cx={32} cy={-10} r={2.6} fill="#FDE68A" stroke="#A3341F" strokeWidth={0.8} />
          <circle cx={32} cy={10} r={2.6} fill="#FDE68A" stroke="#A3341F" strokeWidth={0.8} />
        </g>
      )
    case 'pencil':
      return (
        <g>
          <rect x={-52} y={-7.5} width={11} height={15} rx={3.5} fill="#E79AAB" stroke="#B8667A" strokeWidth={1} />
          <rect x={-42} y={-8.5} width={11} height={17} rx={1} fill="#C3C9D1" stroke="#7C8796" strokeWidth={1} />
          {[-38.5, -34.5].map((x) => <line key={x} x1={x} x2={x} y1={-8.5} y2={8.5} stroke="#7C8796" strokeWidth={0.9} />)}
          <path d="M 24 -8 L 46 0 L 24 8 Z" fill="#EDCB95" stroke="#B48A4E" strokeWidth={1} strokeLinejoin="round" />
          <path d="M 39 -2.6 L 46 0 L 39 2.6 Z" fill="#374151" />
          <rect x={-31} y={-8} width={55} height={16} fill="#F2C230" stroke="#B88A0E" strokeWidth={1} />
          <rect x={-31} y={-8} width={55} height={5} fill="#F7D872" />
          <rect x={-31} y={3} width={55} height={5} fill="#DCA81C" />
        </g>
      )
  }
}

function polygonPathAt(cx: number, cy: number, r: number, n: number, turn: number): string {
  return `${Array.from({ length: n }, (_, k) => { const a = turn + (k * 2 * Math.PI) / n; return `${k ? 'L' : 'M'} ${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}` }).join(' ')} Z`
}

/** Keeps each coin's identity while the list changes, so a coin taken back lets the others slide along, and only a coin just
 *  tapped flies in from the till. */
function useCoinIds(coins: number[]): { ids: number[]; born: number } {
  const memo = useRef<{ coins: number[]; ids: number[]; next: number; born: number } | null>(null)
  if (memo.current === null) memo.current = { coins, ids: coins.map((_, i) => i), next: coins.length, born: coins.length }
  const m = memo.current
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
  if (!same(m.coins, coins)) {
    if (coins.length === m.coins.length + 1 && same(m.coins, coins.slice(0, -1))) m.ids = [...m.ids, m.next++]
    else {
      const gone = coins.length === m.coins.length - 1 ? m.coins.findIndex((_, i) => same([...m.coins.slice(0, i), ...m.coins.slice(i + 1)], coins)) : -1
      if (gone >= 0) m.ids = m.ids.filter((_, i) => i !== gone)
      else {
        m.ids = coins.map(() => m.next++)
        m.born = m.next
      }
    }
    m.coins = coins
  }
  return { ids: m.ids, born: m.born }
}

const MOTION = `
@keyframes mc-fly { from { transform: translate(var(--mc-dx), var(--mc-dy)) } to { transform: translate(0px, 0px) } }
@keyframes mc-fade { from { opacity: 0 } to { opacity: 1 } }
.mc-fly { animation: mc-fly 640ms cubic-bezier(.3,.75,.3,1) both }
.mc-late { animation: mc-fade 280ms ease-out 520ms both }
@media (prefers-reduced-motion: reduce) { .mc-fly, .mc-late { animation: none } }
`

/** The hop from one tick to the next, `step` wide, and its arrowhead where it lands. */
export function hopPath(from: number, step: number): string {
  return `M ${f1(from)} ${LINE_Y} Q ${f1(from + step / 2)} ${LINE_Y - 2 * HOP} ${f1(from + step)} ${LINE_Y}`
}
function hopHead(from: number, step: number): string {
  const a = Math.atan2(4 * HOP, step)
  const tip = from + step
  const back = (turn: number) => ({ x: tip - 6 * Math.cos(a + turn), y: LINE_Y - 6 * Math.sin(a + turn) })
  const p = back(0.5)
  const q = back(-0.5)
  return `M ${f1(p.x)} ${f1(p.y)} L ${f1(tip)} ${LINE_Y} L ${f1(q.x)} ${f1(q.y)}`
}

function describe(config: MoneyConfig, coins: number[]): string {
  const cur = currencyOf(config)
  const item = itemOf(config)
  const what = `${item === 'apple' ? 'An' : 'A'} ${item === 'car' ? 'toy car' : item} with a price tag of ${fmt(cur, config.price)}.`
  const paid = config.task === 'change' ? ` The customer has paid with ${paidPieces(config).map((v) => pieceName(cur, v)).join(' and ')}.` : ''
  const till = ` Below, ${config.task === 'change' ? 'a till' : 'a tray of your coins'}: ${coinsOf(config).map((v) => pieceName(cur, v)).join(', ')}.`
  const run = runningOf(config, coins)
  const line = coins.length
    ? ` On the counter, counting on from ${fmt(cur, startOf(config))}: ${coins.map((c, i) => `${pieceName(cur, c)} makes ${fmt(cur, run[i])}`).join(', ')}.`
    : ` No coins are on the counter yet; the count starts at ${fmt(cur, startOf(config))}.`
  return `${what}${paid}${till}${line}`
}

const HIT = 'nodrag absolute touch-manipulation outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default disabled:hover:ring-0'

function Readout({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{children}</span>
    </p>
  )
}

export function MoneyChangeView({ config, state, setState, marked, reduced, locked }: Props) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const cur = currencyOf(config)
  const item = itemOf(config)
  const now = marked === 'shown' ? moneyChangeEngine.solve(config) : state
  const coins = drawable(config, now)
  const { ids, born } = useCoinIds(coins)
  const run = runningOf(config, coins)
  const finished = marked === 'right' || marked === 'shown'
  const canAct = !locked && !finished
  const full = coins.length >= ON_COUNTER
  const wells = wellsOf(coinsOf(config))
  const change = config.task === 'change'

  const add = (v: number) => {
    if (!canAct || full) return
    setState({ coins: [...coins, v] })
  }
  const remove = (i: number) => {
    if (!canAct) return
    setState({ coins: coins.filter((_, j) => j !== i) })
  }

  const ix = itemX(config.task)
  const tx = tagX(config.task)
  const tie = TIES[item]
  const hole = { x: tx + 9, y: ITEM_Y - TAG_H / 2 + TAG_H / 2 }
  const knot = { x: ix + tie.x, y: ITEM_Y + tie.y }
  const sag = { x: (knot.x + hole.x) / 2, y: Math.max(knot.y, hole.y) + 10 }
  const laid = change ? paidLayout(paidPieces(config)) : []
  const paidMid = laid.length ? (Math.min(...laid.map((p) => p.x)) + Math.max(...laid.map((p) => p.x))) / 2 : 290
  const startText = fmt(cur, startOf(config))
  const chipW = textWidth(startText, 12) + 12

  const said = marked === 'right' || marked === 'shown' ? working(config, coins) : marked === 'wrong' ? madeText(config, coins) : ''
  const lead = said.match(/^(Yes\. [\s\S]*?\.)\s+([\s\S]*)$/)
  const reached = reachedOf(config, coins)
  const dropped = labelDrop(run.map((x) => fmt(cur, x)), coins.length)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.mc-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, coins)} className="block h-auto w-full select-none" data-task={config.task}>
            <style>{MOTION}</style>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />

            {/* The till, first, so a coin lifted out of it flies over everything. */}
            <text x={TILL.x + 4} y={TILL_LABEL_Y} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{change ? 'till' : 'your coins'}</text>
            <rect x={TILL.x} y={TILL.y} width={TILL.w} height={TILL.h} rx={9} fill={DRAWER} stroke={DRAWER_EDGE} strokeWidth={1.5} />
            {wells.map((w) => (
              <g key={w.value} data-well={w.value}>
                <rect x={f1(w.x)} y={w.y} width={f1(w.w)} height={w.h} rx={6} fill={WELL} />
                <rect x={f1(w.x + 3)} y={w.y} width={f1(w.w - 6)} height={3} rx={1.5} fill={WELL_BACK} />
                <g transform={`translate(${f1(w.cx)} ${w.cy})`}><Stack cur={cur} value={w.value} /></g>
              </g>
            ))}

            {/* The item, tied to its price tag. */}
            <g transform={`translate(${ix} ${ITEM_Y})`} data-item={item}><ItemDrawing item={item} clip={`mc-ball-${clip}`} /></g>
            <text x={ix} y={TOP_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{itemLabel(item)}</text>
            <path d={`M ${f1(knot.x)} ${f1(knot.y)} Q ${f1(sag.x)} ${f1(sag.y)} ${f1(hole.x)} ${f1(hole.y)}`} fill="none" stroke={STRING} strokeWidth={1.3} strokeLinecap="round" />
            <PriceTag x={tx} y={ITEM_Y - TAG_H / 2} text={fmt(cur, config.price)} />
            <text x={tx + TAG_W / 2} y={TOP_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>price</text>

            {/* What the customer handed over. */}
            {laid.map((p) => (
              <g key={`${p.value}-${p.x}`} transform={`translate(${p.x} ${p.y})`} data-paid={p.value}>
                {p.note ? <Note cur={cur} value={p.value} /> : <Coin cur={cur} value={p.value} />}
              </g>
            ))}
            {change && <text x={paidMid} y={TOP_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>paid</text>}

            {/* The counting line on the counter: it starts at the price, or at nothing. */}
            <line x1={X0} x2={LAST} y1={LINE_Y} y2={LINE_Y} stroke={TRACK} strokeWidth={2} strokeLinecap="round" />
            <line x1={X0} x2={X0} y1={LINE_Y - 7} y2={LINE_Y + 6} stroke={TICK} strokeWidth={1.8} strokeLinecap="round" />
            <g data-start>
              <rect x={f1(X0 - chipW / 2)} y={LINE_Y + 6} width={f1(chipW)} height={18} rx={4} fill={TAG} stroke={TAG_EDGE} strokeWidth={1.1} />
              <text x={X0} y={LINE_Y + 15.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={12} fontWeight={800} fill={INK}>{startText}</text>
            </g>

            {/* Before the first coin, a faint dashed jump shows where a coin goes. */}
            {coins.length === 0 && canAct && (
              <g data-ghost aria-hidden="true" fill="none" stroke={TRACK} strokeWidth={1.6} strokeDasharray="3 3">
                <path d={hopPath(X0, MAX_STEP)} />
                <circle cx={X0 + MAX_STEP / 2} cy={LINE_Y - HOP - COIN_GAP - 16} r={16} />
              </g>
            )}

            {coins.map((v, i) => {
              const n = coins.length
              const step = stepFor(n)
              const from = slotOf(i, n).x
              const c = coinCentre(i, n, radiusOf(cur, v, n))
              const t = tickAfter(i, n)
              const fresh = !reduced && ids[i] >= born
              const w = wells.find((x) => x.value === v) ?? wells[0]
              const latest = i === n - 1
              const ease = reduced ? undefined : '450ms ease'
              const arc = hopPath(from, step)
              const head = hopHead(from, step)
              const fly = fresh ? ({ '--mc-dx': `${f1(w.cx - c.x)}px`, '--mc-dy': `${f1(w.cy - c.y)}px` } as CSSProperties) : undefined
              return (
                <g key={ids[i]} data-coin={i} data-value={v}>
                  <g className={fresh ? 'mc-late' : undefined}>
                    <path d={arc} style={{ d: `path("${arc}")`, transition: ease && `d ${ease}` } as CSSProperties} fill="none" stroke={HOP_LINE} strokeWidth={1.7} />
                    <path d={head} style={{ d: `path("${head}")`, transition: ease && `d ${ease}` } as CSSProperties} fill="none" stroke={HOP_LINE} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                    <g style={{ transform: `translate(${f1(t.x)}px, ${LINE_Y}px)`, transition: ease && `transform ${ease}` }}>
                      <line x1={0} x2={0} y1={-6} y2={6} stroke={TICK} strokeWidth={1.8} strokeLinecap="round" />
                    </g>
                    <g style={{ transform: `translate(${f1(t.x)}px, ${labelY(i, dropped)}px)`, transition: ease && `transform ${ease}` }}>
                      <text x={0} y={0} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={latest ? 800 : 600} fill={latest ? INK : FAINT} data-count={run[i]}>{fmt(cur, run[i])}</text>
                    </g>
                  </g>
                  <g style={{ transform: `translate(${f1(c.x)}px, ${f1(c.y)}px)`, transition: ease && `transform ${ease}` }}>
                    <g className={fresh ? 'mc-fly' : undefined} style={fly}><Coin cur={cur} value={v} r={radiusOf(cur, v, n)} /></g>
                  </g>
                </g>
              )
            })}
          </svg>

          {canAct && wells.map((w) => (
            <button
              key={w.value} type="button" disabled={full}
              aria-label={change ? `Count out a ${pieceName(cur, w.value)} coin from the till` : `Put a ${pieceName(cur, w.value)} coin on the counter`}
              onClick={() => add(w.value)} className={`${HIT} rounded-lg`}
              style={{ left: `${(w.x / W) * 100}%`, top: `${(w.y / H) * 100}%`, width: `${(w.w / W) * 100}%`, height: `${(w.h / H) * 100}%`, border: 'none', background: 'transparent', padding: 0, cursor: full ? 'default' : 'pointer' }}
            />
          ))}
          {canAct && coins.map((v, i) => {
            const c = coinCentre(i, coins.length, radiusOf(cur, v, coins.length))
            return (
              <button
                key={ids[i]} type="button"
                aria-label={`Put the ${pieceName(cur, v)} back ${change ? 'in the till' : 'with your coins'}`}
                onClick={() => remove(i)} className={`${HIT} rounded-full`}
                style={{ left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%`, width: `${(38 / W) * 100}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
              />
            )
          })}
        </div>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">
          {change
            ? 'Tap a coin in the till to count it out from the price. Tap a coin on the counter to put it back.'
            : 'Tap one of your coins to put it on the counter. Tap a coin on the counter to take it back.'}
        </figcaption>
      </figure>

      <div className="flex items-baseline justify-between gap-3 border-t border-ss-line pt-1.5">
        <Readout name="Counted up to"><span data-reached={reached}>{fmt(cur, reached)}</span></Readout>
        {config.fewest && <Readout name="Coins">{coins.length}</Readout>}
        <Readout name={change ? 'Paid' : 'Price'}>{fmt(cur, goalOf(config))}</Readout>
      </div>

      <p className="mc-kbd hidden text-[12px] font-semibold text-ss-slate">Tab to a coin, then Enter to move it.</p>
      <span className="sr-only" aria-live="polite">{`Counted up to ${fmt(cur, reached)}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
