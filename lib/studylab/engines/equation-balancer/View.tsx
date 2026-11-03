'use client'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Atoms, EquationConfig, EquationState } from './config'
import {
  COEF_MAX, COEF_MIN, DRAW_ATOMS_MAX, HAVE_MAX, atomTotal, balanceSaid, countAtoms, parseFormula, quantitiesOf, quantitiesSaid, smallestCoefficients,
} from './config'

type Props = SceneViewProps<EquationConfig, EquationState>
type Quantities = Extract<EquationConfig, { task: 'quantities' }>

// A quiet light plate in both themes, like measure-shape's: the molecules keep their own colours.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const HAIR = '#E2E8F0'
const INK = '#1E293B'
const SOFT = '#475569'
const ACCENT = '#1F6397'
const OUTLINE = '#334155'
const DARK_TEXT = '#16202A'

// ---------------------------------------------------------------------------
// The usual model colours: oxygen red, carbon black, hydrogen white, nitrogen blue, chlorine green, sulfur yellow.

const COLOURS: Record<string, string> = {
  H: '#FFFFFF', C: '#3B424B', N: '#3F5FD0', O: '#D63A30', F: '#8CCB5E', S: '#E8C42E', Cl: '#23863D', Br: '#9C3B2A', I: '#7B3FA0',
  P: '#E8892E', Na: '#8A5CF0', K: '#7A4FD6', Li: '#B070E8', Mg: '#3E8E41', Ca: '#5E8F5A', Fe: '#B85D18', Cu: '#A8622A', Zn: '#6F7F99',
  Al: '#C9B3B3', Ag: '#C5CCD4', Pb: '#575961', Si: '#CDAE86', B: '#EBAE84', He: '#D9FFFF', Ne: '#B3E3F5', Ar: '#80D1E3',
}
const FALLBACK = ['#4F8FBF', '#BF6F9A', '#7FA33A', '#C79A3E', '#7A74C9', '#3FA595']
export function elementColour(el: string): string {
  if (COLOURS[el]) return COLOURS[el]
  let h = 0
  for (const ch of el) h = (h * 31 + ch.charCodeAt(0)) % 997
  return FALLBACK[h % FALLBACK.length]
}

const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
/** Whichever of white or dark ink reads better on this colour. */
function textOn(hex: string): string {
  const l = luminance(hex)
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance(DARK_TEXT) + 0.05) ? '#FFFFFF' : DARK_TEXT
}
/** The colour a little darker, for the edge of a bar. */
function darker(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.6).toString(16).padStart(2, '0')
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`
}
const edgeOf = (el: string) => (el === 'H' ? '#94A3B8' : darker(elementColour(el)))

// ---------------------------------------------------------------------------
// One molecule: touching spheres, as in a space-filling model. Few atoms are drawn one each, a small molecule in its real
// shape (water bent, carbon dioxide straight); many are drawn as one ball per element, with the count in it.

/** Ball radii in the picture, hydrogen smallest. */
const RADII: Record<string, number> = { H: 9, C: 11, N: 10.5, O: 10.5, F: 10, S: 12, P: 12, Cl: 12, Br: 13, I: 14, Na: 13, K: 14, Li: 12, Mg: 12, Ca: 12.5, Al: 12, Fe: 12, Cu: 12, Zn: 12 }
const radiusOf = (el: string) => RADII[el] ?? 12
export const GR = 18
export const GPITCH = 37
/** Atoms that sit in a straight line between two others. */
const STRAIGHT = new Set(['C', 'Be', 'Mg', 'Ca', 'Zn', 'Hg', 'Ba', 'Sr'])

export type Ball = { el: string; x: number; y: number; r: number; n?: number }
export type Layout = { w: number; h: number; balls: Ball[] }

const fit = (list: string[], at: { x: number; y: number }[]): Layout => {
  const rs = list.map(radiusOf)
  const x0 = Math.min(...at.map((p, i) => p.x - rs[i]))
  const y0 = Math.min(...at.map((p, i) => p.y - rs[i]))
  const x1 = Math.max(...at.map((p, i) => p.x + rs[i]))
  const y1 = Math.max(...at.map((p, i) => p.y + rs[i]))
  return { w: x1 - x0 + 0.01, h: y1 - y0 + 0.01, balls: list.map((el, i) => ({ el, x: Math.round((at[i].x - x0 + 1e-6) * 1e4) / 1e4, y: Math.round((at[i].y - y0 + 1e-6) * 1e4) / 1e4, r: rs[i] })) }
}

/** Where each ball of a molecule sits. */
export function moleculeLayout(atoms: Atoms): Layout {
  const total = atomTotal(atoms)
  if (total <= DRAW_ATOMS_MAX) {
    const list = Object.entries(atoms).flatMap(([el, n]) => Array.from({ length: n }, () => el))
    const k = list.length
    const rs = list.map(radiusOf)
    if (k === 1) return fit(list, [{ x: 0, y: 0 }])
    if (k === 2) return fit(list, [{ x: 0, y: 0 }, { x: rs[0] + rs[1], y: 0 }])
    // One atom of its own element in the middle, the rest round it: water, carbon dioxide, ammonia, methane.
    const centre = list.findIndex((el) => atoms[el] === 1 && el !== 'H')
    const outer = list.map((_, i) => i).filter((i) => i !== centre)
    if (centre >= 0 && k <= 5 && outer.every((i) => list[i] === list[outer[0]])) {
      const m = outer.length
      const angles = m === 2 ? (STRAIGHT.has(list[centre]) ? [180, 0] : [142, 38]) : m === 3 ? [-90, 30, 150] : [-135, -45, 135, 45]
      const at = list.map(() => ({ x: 0, y: 0 }))
      outer.forEach((i, j) => {
        const d = rs[centre] + rs[i] + 0.05
        const a = (angles[j] * Math.PI) / 180
        at[i] = { x: d * Math.cos(a), y: d * Math.sin(a) }
      })
      return fit(list, at)
    }
    const cols = k <= 4 ? 2 : 3
    const rows = Math.ceil(k / cols)
    const cell = 2 * Math.max(...rs)
    const at = list.map((_, i) => {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, k - row * cols)
      return { x: ((cols - inRow) * cell) / 2 + (i - row * cols) * cell + cell / 2, y: row * cell + cell / 2 }
    })
    return { w: cols * cell, h: rows * cell, balls: list.map((el, i) => ({ el, x: at[i].x, y: at[i].y, r: rs[i] })) }
  }
  const groups = Object.entries(atoms)
  const cols = Math.min(3, groups.length)
  const rows = Math.ceil(groups.length / cols)
  const balls = groups.map(([el, n], i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, groups.length - row * cols)
    const col = i - row * cols
    const pad = ((cols - inRow) * GPITCH) / 2
    return { el, n, x: pad + col * GPITCH + GPITCH / 2, y: row * GPITCH + GPITCH / 2, r: GR }
  })
  return { w: cols * GPITCH, h: rows * GPITCH, balls }
}

function Molecule({ atoms, ghost, fresh }: { atoms: Atoms; ghost?: boolean; fresh?: boolean }) {
  const { w, h, balls } = moleculeLayout(atoms)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className={fresh ? 'eb-in' : undefined} style={{ flexShrink: 0, overflow: 'visible' }}>
      {balls.map((b, i) => {
        if (ghost) return <circle key={i} cx={b.x} cy={b.y} r={b.r - 1} fill="none" stroke={SOFT} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
        const fill = elementColour(b.el)
        const ink = textOn(fill)
        return (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r={b.r - 0.6} fill={fill} stroke={OUTLINE} strokeWidth="1.25" />
            {b.el !== 'H' && <ellipse cx={b.x - b.r * 0.32} cy={b.y - b.r * 0.4} rx={b.r * 0.34} ry={b.r * 0.2} fill="#FFFFFF" opacity="0.28" transform={`rotate(-35 ${b.x - b.r * 0.32} ${b.y - b.r * 0.4})`} />}
            {b.n === undefined ? (
              <text x={b.x} y={b.y + 4.2} textAnchor="middle" fontSize="12" fontWeight="800" fill={ink}>{b.el}</text>
            ) : (
              <>
                <text x={b.x} y={b.y - 1.5} textAnchor="middle" fontSize="12" fontWeight="800" fill={ink}>{b.el}</text>
                <text x={b.x} y={b.y + 11} textAnchor="middle" fontSize="12" fontWeight="800" fill={ink}>{`×${b.n}`}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** A formula with its small numbers lowered. They are plain text, with nothing to press. */
export function Formula({ f, size = 'text-[14px]' }: { f: string; size?: string }) {
  const parts = f.replace(/\s+/g, '').split(/(\d+)/)
  return (
    <span className={`whitespace-nowrap font-extrabold ${size}`}>
      {parts.map((p, i) => (i % 2 === 1 ? <sub key={i} className="text-[12px] leading-[0]">{p}</sub> : <span key={i}>{p}</span>))}
    </span>
  )
}

/** The equation, written properly: the numbers in front are the ones the learner sets. */
function Equation({ formulas, nr, co, label }: { formulas: string[]; nr: number; co: number[]; label?: string }) {
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 pb-1" style={{ color: INK }} aria-label={label}>
      {formulas.flatMap((f, j) => {
        const bits: ReactNode[] = []
        if (j === nr) bits.push(<span key={`a${j}`} className="text-[20px] font-extrabold" style={{ color: SOFT }}>{'→'}</span>)
        else if (j > 0) bits.push(<span key={`p${j}`} className="text-[20px] font-extrabold" style={{ color: SOFT }}>+</span>)
        bits.push(
          <span key={`f${j}`} className="whitespace-nowrap">
            {co[j] > 1 ? <span className="mr-0.5 text-[22px] font-extrabold tabular-nums" style={{ color: ACCENT }}>{co[j]}</span> : null}
            <Formula f={f} size="text-[20px]" />
          </span>,
        )
        return bits
      })}
    </p>
  )
}

// ---------------------------------------------------------------------------

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 text-[16px] font-extrabold leading-none touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const ON_PLATE: CSSProperties = { borderColor: EDGE, background: '#FFFFFF', color: INK }
const ON_CARD = 'border-ss-line bg-ss-panel text-ss-ink'

function Stepper({ less, more, value, min, max, locked, set, plate }: {
  less: string; more: string; value: number; min: number; max: number; locked: boolean; set: (v: number) => void; plate?: boolean
}) {
  const style = plate ? ON_PLATE : undefined
  const cls = `${STEP} ${plate ? '' : ON_CARD}`
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label={less} disabled={locked || value <= min} onClick={() => set(value - 1)} className={cls} style={style}>{'−'}</button>
      <span className={`min-w-[20px] text-center text-[15px] font-extrabold tabular-nums ${plate ? '' : 'text-ss-ink'}`} style={plate ? { color: INK } : undefined} aria-hidden="true">{value}</span>
      <button type="button" aria-label={more} disabled={locked || value >= max} onClick={() => set(value + 1)} className={cls} style={style}>+</button>
    </span>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle' || !text) return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

/** A small heading inside the plate, with a hairline running on from it. */
function Side({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: SOFT }}>
      {arrow && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 1.5 V10 M2.5 6.5 L6 10 L9.5 6.5" />
        </svg>
      )}
      {children}
      <span className="h-px flex-1" style={{ background: HAIR }} />
    </p>
  )
}

const STYLE = `.eb-in{animation:eb-in .8s ease-out}@keyframes eb-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.eb-in{animation:none}}`

const stopArrows = (e: KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

const molecules = (f: string, n: number, opts: { fresh: boolean; ghost?: boolean }) => {
  const atoms = parseFormula(f)
  if (!atoms) return null
  return Array.from({ length: n }, (_, i) => <Molecule key={`${opts.ghost ? 'g' : 'm'}${i}`} atoms={atoms} ghost={opts.ghost} fresh={opts.fresh} />)
}

const Tray = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[28px] min-w-0 flex-1 flex-wrap content-center items-center gap-x-2.5 gap-y-1.5">{children}</div>
)

const Name = ({ f }: { f: string }) => (
  <span className="w-[68px] shrink-0" style={{ color: INK }}><Formula f={f} size="text-[13px]" /></span>
)

const Plate = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full flex-col gap-1.5 rounded-2xl border px-3 py-2.5" style={{ background: PLATE, borderColor: EDGE }}>{children}</div>
)

const Caption = ({ children }: { children: ReactNode }) => <figcaption className="text-center text-[12px] font-bold text-ss-slate">{children}</figcaption>

// ---------------------------------------------------------------------------
// balance

const BAR_GRID = 'grid grid-cols-[22px_1fr_28px_1fr_22px] items-center gap-x-1.5'

function Balance({ config, state, setState, marked, reduced, locked }: Props) {
  const n = config.reactants.length + config.products.length
  const nr = config.reactants.length
  const all = config.reactants.concat(config.products)
  const co = Array.from({ length: n }, (_, j) => (Number.isInteger(state?.co?.[j]) ? Math.max(COEF_MIN, Math.min(COEF_MAX, state.co[j])) : 1))
  const set = (j: number, v: number) => {
    if (locked || v < COEF_MIN || v > COEF_MAX) return
    setState({ ...state, co: co.map((c, k) => (k === j ? v : c)) })
  }
  const counts = countAtoms(config, co)
  const best = smallestCoefficients(config.reactants, config.products)
  const solved = 'co' in best ? countAtoms(config, best.co) : counts
  const peak = Math.max(1, ...solved.flatMap((c) => [c.left, c.right]))
  const unit = Math.min(16, 118 / Math.max(peak * 2, ...counts.flatMap((c) => [c.left, c.right])))
  const row = (f: string, j: number) => (
    <div key={`${j}-${f}`} className="flex w-full items-center gap-2">
      <div className="flex w-[92px] shrink-0 flex-col items-center gap-1" style={{ color: INK }}>
        <Formula f={f} size="text-[13px]" />
        <Stepper
          less={`Take one ${f} molecule away`} more={`Add one ${f} molecule`} value={co[j]} min={COEF_MIN} max={COEF_MAX}
          locked={locked} set={(v) => set(j, v)} plate
        />
      </div>
      <Tray>{molecules(f, co[j], { fresh: !reduced })}</Tray>
    </div>
  )
  const barBase = 'h-2.5 shrink-0 rounded-sm'
  const grow = reduced ? '' : ' transition-[width] duration-700 ease-out'
  const bar = (el: string, count: number) => ({ width: count * unit, background: elementColour(el), border: `1px solid ${edgeOf(el)}` })
  const good = marked === 'right' || marked === 'shown'
  return (
    <>
      <figure className="flex w-full flex-col gap-1.5">
        <Plate>
          <Equation formulas={all} nr={nr} co={co} />
          {config.reactants.map((f, j) => row(f, j))}
          <Side arrow>products</Side>
          {config.products.map((f, j) => row(f, nr + j))}
          <div className="mt-1 flex flex-col gap-1 border-t pt-2" style={{ borderColor: HAIR }} role="img"
            aria-label={`Atoms counted on each side: ${counts.map((c) => `${c.el} ${c.left} on the reactant side, ${c.right} on the product side`).join('; ')}.`}>
            <div className={`${BAR_GRID} text-[12px] font-bold`} style={{ color: SOFT }}>
              <span className="col-span-2 text-right">reactant atoms</span><span />
              <span className="col-span-2">product atoms</span>
            </div>
            {counts.map((c) => (
              <div key={c.el} className={BAR_GRID}>
                <span className="text-right text-[13px] font-extrabold tabular-nums" style={{ color: INK }}>{c.left}</span>
                <div className="flex justify-end"><div className={barBase + grow} style={bar(c.el, c.left)} /></div>
                <span className="flex h-[22px] w-[28px] items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: elementColour(c.el), color: textOn(elementColour(c.el)), border: `1.25px solid ${OUTLINE}` }}>{c.el}</span>
                <div className="flex justify-start"><div className={barBase + grow} style={bar(c.el, c.right)} /></div>
                <span className="text-[13px] font-extrabold tabular-nums" style={{ color: INK }}>{c.right}</span>
              </div>
            ))}
          </div>
        </Plate>
        <Caption>Change the number in front of a formula: whole molecules come and go.</Caption>
      </figure>
      <span className="sr-only" aria-live="polite">{all.map((f, j) => `${co[j]} ${f}`).join(', ')}</span>
      <Verdict marked={marked} text={marked === 'wrong' || good ? balanceSaid(config, co) : ''} />
    </>
  )
}

// ---------------------------------------------------------------------------
// quantities

function Run({ config, state, setState, marked, reduced, locked }: Props & { config: Quantities }) {
  const { co, max } = quantitiesOf(config)
  const runs = Number.isInteger(state?.runs) ? Math.max(0, Math.min(HAVE_MAX, state.runs)) : 0
  const set = (v: number) => {
    if (locked || v < 0 || v > HAVE_MAX) return
    setState({ ...state, runs: v })
  }
  const made = Math.min(runs, max)
  const nr = config.reactants.length
  const good = marked === 'right' || marked === 'shown'
  return (
    <>
      <figure className="flex w-full flex-col gap-1.5">
        <Plate>
          <Equation formulas={config.reactants.concat(config.products)} nr={nr} co={co} label="The balanced equation" />
          <Side>we have</Side>
          {config.reactants.map((f, i) => {
            const left = config.have[i] - runs * co[i]
            return (
              <div key={f} className="flex w-full items-center gap-2">
                <Name f={f} />
                <Tray>
                  {molecules(f, Math.max(0, left), { fresh: false })}
                  {left < 0 ? molecules(f, Math.min(6, -left), { fresh: false, ghost: true }) : null}
                </Tray>
              </div>
            )
          })}
          <Side arrow>made</Side>
          {config.products.map((f, k) => (
            <div key={f} className="flex w-full items-center gap-2">
              <Name f={f} />
              <Tray>{molecules(f, made * co[nr + k], { fresh: !reduced })}</Tray>
            </div>
          ))}
        </Plate>
        <Caption>Each run uses up molecules on the left and makes the products.</Caption>
      </figure>
      <div className="flex w-full items-center justify-between gap-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Times it runs</span>
        <Stepper less="Run the reaction one time fewer" more="Run the reaction one more time" value={runs} min={0} max={HAVE_MAX} locked={locked} set={set} />
      </div>
      <span className="sr-only" aria-live="polite">{`${runs} ${runs === 1 ? 'run' : 'runs'}`}</span>
      <Verdict marked={marked} text={marked === 'wrong' || good ? quantitiesSaid(config, runs) : ''} />
    </>
  )
}

/** The scene's balls named in words, for the screen reader. */
function describe(config: EquationConfig): string {
  return config.task === 'balance'
    ? 'The equation, then each molecule drawn as touching atom spheres in the usual model colours with its symbol, a plus and a minus beside each formula, and a bar for each element on each side.'
    : 'The balanced equation, a tray of reactant molecules drawn as touching atom spheres with their symbols, the products made, and a plus and a minus for how many times the reaction runs.'
}

export function EquationBalancerView(props: Props) {
  const { config } = props
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={stopArrows}>
      <style>{STYLE}</style>
      <span className="sr-only">{describe(config)}</span>
      {config.task === 'quantities' ? <Run {...props} config={config} /> : <Balance {...props} />}
    </div>
  )
}
