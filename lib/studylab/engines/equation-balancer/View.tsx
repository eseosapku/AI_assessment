'use client'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Atoms, EquationConfig, EquationState } from './config'
import {
  COEF_MAX, COEF_MIN, DRAW_ATOMS_MAX, HAVE_MAX, atomTotal, balanceSaid, countAtoms, parseFormula, quantitiesOf, quantitiesSaid, smallestCoefficients,
} from './config'

type Props = SceneViewProps<EquationConfig, EquationState>
type Quantities = Extract<EquationConfig, { task: 'quantities' }>

const INK = 'var(--ss-ink, #16202A)'
/** The balls keep one dark outline and dark letters in both themes, on pastel fills that stand out from either card. */
const BALL_INK = '#16202A'

const KNOWN: Record<string, string> = {
  H: '#FFFFFF', C: '#B8C0C8', N: '#8DB4F7', O: '#F4908A', S: '#F2D45C', Cl: '#8ED08B', Na: '#C9A6F2', K: '#E0B0F0', Ca: '#F5B97A',
  Mg: '#9AD9C8', Fe: '#E0A070', Cu: '#E8A87C', Zn: '#B5C4D6', Al: '#D9D2C0', P: '#F7B26B', Br: '#D98A7A', Li: '#E3B6F5', Ag: '#D5DCE3',
}
const FALLBACK = ['#9FD3F0', '#F0B8D4', '#C8E08A', '#F0CE8A', '#B9B3F0', '#8FE0D0']
export function elementColour(el: string): string {
  if (KNOWN[el]) return KNOWN[el]
  let h = 0
  for (const ch of el) h = (h * 31 + ch.charCodeAt(0)) % 997
  return FALLBACK[h % FALLBACK.length]
}

// ---------------------------------------------------------------------------
// One molecule: balls drawn atom by atom, or one ball per element when there are many.

export const R = 11
export const PITCH = 24
export const GR = 16
export const GPITCH = 36

export type Ball = { el: string; x: number; y: number; r: number; n?: number }
export type Layout = { w: number; h: number; balls: Ball[] }

/** Where each ball of a molecule sits. Few atoms are drawn one each; many are drawn as one ball per element, with the count in it. */
export function moleculeLayout(atoms: Atoms): Layout {
  const total = atomTotal(atoms)
  if (total <= DRAW_ATOMS_MAX) {
    const list = Object.entries(atoms).flatMap(([el, n]) => Array.from({ length: n }, () => el))
    const k = list.length
    const cols = k === 1 ? 1 : k <= 4 ? 2 : 3
    const rows = Math.ceil(k / cols)
    const balls = list.map((el, i) => {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, k - row * cols)
      const col = i - row * cols
      const pad = ((cols - inRow) * PITCH) / 2
      return { el, x: pad + col * PITCH + PITCH / 2, y: row * PITCH + PITCH / 2, r: R }
    })
    return { w: cols * PITCH, h: rows * PITCH, balls }
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className={fresh ? 'eb-in' : undefined} style={{ flexShrink: 0 }}>
      {balls.map((b, i) =>
        ghost ? (
          <circle key={i} cx={b.x} cy={b.y} r={b.r - 1} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
        ) : (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r={b.r - 0.75} fill={elementColour(b.el)} stroke={BALL_INK} strokeWidth="1.5" />
            {b.n === undefined ? (
              <text x={b.x} y={b.y + 4.2} textAnchor="middle" fontSize="12" fontWeight="800" fill={BALL_INK}>{b.el}</text>
            ) : (
              <>
                <text x={b.x} y={b.y - 1} textAnchor="middle" fontSize="12" fontWeight="800" fill={BALL_INK}>{b.el}</text>
                <text x={b.x} y={b.y + 11} textAnchor="middle" fontSize="12" fontWeight="800" fill={BALL_INK}>{`×${b.n}`}</text>
              </>
            )}
          </g>
        ),
      )}
    </svg>
  )
}

/** A formula with its small numbers lowered. They are plain text, with nothing to press. */
export function Formula({ f }: { f: string }) {
  const parts = f.replace(/\s+/g, '').split(/(\d+)/)
  return (
    <span className="whitespace-nowrap text-[18px] font-extrabold text-ss-ink">
      {parts.map((p, i) => (i % 2 === 1 ? <sub key={i} className="text-[12px]">{p}</sub> : <span key={i}>{p}</span>))}
    </span>
  )
}

function Tap({ label, sign, off, onTap }: { label: string; sign: '+' | '-'; off: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={off}
      onClick={onTap}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ss-panel outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40"
      style={{ border: `2.5px solid ${INK}` }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d={sign === '+' ? 'M8 2 V14 M2 8 H14' : 'M2 8 H14'} />
      </svg>
    </button>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle' || !text) return null
  return <p className="max-w-[360px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

const Label = ({ children }: { children: ReactNode }) => <p className="w-full text-[13px] font-extrabold text-ss-slate">{children}</p>

function DownArrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex w-full items-center gap-1.5 text-[13px] font-extrabold text-ss-slate">
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 2 V13 M2.5 8.5 L7 13 L11.5 8.5" />
      </svg>
      {children}
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
  <div className="flex min-h-[48px] min-w-0 flex-1 flex-wrap content-center items-center gap-x-2.5 gap-y-1.5">{children}</div>
)

// ---------------------------------------------------------------------------
// balance

function Balance({ config, state, setState, marked, reduced, locked }: Props) {
  const n = config.reactants.length + config.products.length
  const co = Array.from({ length: n }, (_, j) => (Number.isInteger(state?.co?.[j]) ? Math.max(COEF_MIN, Math.min(COEF_MAX, state.co[j])) : 1))
  const set = (j: number, v: number) => {
    if (locked || v < COEF_MIN || v > COEF_MAX) return
    setState({ ...state, co: co.map((c, k) => (k === j ? v : c)) })
  }
  const counts = countAtoms(config, co)
  const best = smallestCoefficients(config.reactants, config.products)
  const solved = 'co' in best ? countAtoms(config, best.co) : counts
  const peak = Math.max(1, ...solved.flatMap((c) => [c.left, c.right]))
  const unit = Math.min(22, 128 / Math.max(peak * 2, ...counts.flatMap((c) => [c.left, c.right])))
  const row = (f: string, j: number) => (
    <div key={`${j}-${f}`} className="flex w-full items-center gap-2">
      <div className="flex w-[136px] shrink-0 flex-col items-center gap-1">
        <Formula f={f} />
        <div className="flex items-center gap-1">
          <Tap label={`Take one ${f} molecule away`} sign="-" off={locked || co[j] <= COEF_MIN} onTap={() => set(j, co[j] - 1)} />
          <span className="w-7 text-center text-[22px] font-extrabold tabular-nums text-ss-ink">{co[j]}</span>
          <Tap label={`Add one ${f} molecule`} sign="+" off={locked || co[j] >= COEF_MAX} onTap={() => set(j, co[j] + 1)} />
        </div>
      </div>
      <Tray>{molecules(f, co[j], { fresh: !reduced })}</Tray>
    </div>
  )
  const barBase = 'h-4 shrink-0 rounded-sm'
  const grow = reduced ? '' : ' transition-[width] duration-700 ease-out'
  const good = marked === 'right' || marked === 'shown'
  return (
    <>
      <Label>reactants</Label>
      {config.reactants.map((f, j) => row(f, j))}
      <DownArrow>products</DownArrow>
      {config.products.map((f, j) => row(f, config.reactants.length + j))}
      <div className="mt-1 w-full border-t-2 border-ss-line pt-2" role="img"
        aria-label={`Atoms counted on each side: ${counts.map((c) => `${c.el} ${c.left} on the reactant side, ${c.right} on the product side`).join('; ')}.`}>
        <div className="mb-1 grid grid-cols-[1fr_32px_1fr] text-[13px] font-extrabold text-ss-slate">
          <span className="text-right">reactant atoms</span><span />
          <span>product atoms</span>
        </div>
        {counts.map((c) => (
          <div key={c.el} className="grid grid-cols-[1fr_32px_1fr] items-center gap-y-1 py-0.5">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{c.left}</span>
              <div className={barBase + grow} style={{ width: c.left * unit, background: elementColour(c.el), border: `1.5px solid ${BALL_INK}` }} />
            </div>
            <svg width="32" height="26" viewBox="0 0 32 26" aria-hidden="true">
              <circle cx="16" cy="13" r="11.25" fill={elementColour(c.el)} stroke={BALL_INK} strokeWidth="1.5" />
              <text x="16" y="17.2" textAnchor="middle" fontSize="12" fontWeight="800" fill={BALL_INK}>{c.el}</text>
            </svg>
            <div className="flex items-center gap-1.5">
              <div className={barBase + grow} style={{ width: c.right * unit, background: elementColour(c.el), border: `1.5px solid ${BALL_INK}` }} />
              <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{c.right}</span>
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">{config.reactants.concat(config.products).map((f, j) => `${co[j]} ${f}`).join(', ')}</span>
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
  const equation = (
    <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-ss-ink" aria-label="The balanced equation">
      {config.reactants.concat(config.products).flatMap((f, j) => {
        const bits: ReactNode[] = []
        if (j === nr) bits.push(<span key={`a${j}`} className="text-[18px] font-extrabold">{'→'}</span>)
        else if (j > 0) bits.push(<span key={`p${j}`} className="text-[18px] font-extrabold">+</span>)
        bits.push(
          <span key={`f${j}`} className="whitespace-nowrap">
            {co[j] > 1 ? <span className="mr-0.5 text-[18px] font-extrabold">{co[j]}</span> : null}<Formula f={f} />
          </span>,
        )
        return bits
      })}
    </p>
  )
  const good = marked === 'right' || marked === 'shown'
  return (
    <>
      {equation}
      <Label>reactants we have</Label>
      {config.reactants.map((f, i) => {
        const left = config.have[i] - runs * co[i]
        return (
          <div key={f} className="flex w-full items-center gap-2">
            <div className="flex w-[100px] shrink-0 justify-center"><Formula f={f} /></div>
            <Tray>
              {molecules(f, Math.max(0, left), { fresh: false })}
              {left < 0 ? molecules(f, Math.min(6, -left), { fresh: false, ghost: true }) : null}
            </Tray>
          </div>
        )
      })}
      <div className="flex items-center gap-2 py-1">
        <Tap label="Run the reaction one time fewer" sign="-" off={locked || runs <= 0} onTap={() => set(runs - 1)} />
        <span className="flex min-w-[96px] flex-col items-center leading-tight">
          <span className="text-[22px] font-extrabold tabular-nums text-ss-ink">{runs}</span>
          <span className="whitespace-nowrap text-[13px] font-extrabold text-ss-slate">{runs === 1 ? 'run' : 'runs'}</span>
        </span>
        <Tap label="Run the reaction one more time" sign="+" off={locked || runs >= HAVE_MAX} onTap={() => set(runs + 1)} />
      </div>
      <DownArrow>made</DownArrow>
      {config.products.map((f, k) => (
        <div key={f} className="flex w-full items-center gap-2">
          <div className="flex w-[100px] shrink-0 justify-center"><Formula f={f} /></div>
          <Tray>{molecules(f, made * co[nr + k], { fresh: !reduced })}</Tray>
        </div>
      ))}
      <span className="sr-only" aria-live="polite">{`${runs} ${runs === 1 ? 'run' : 'runs'}`}</span>
      <Verdict marked={marked} text={marked === 'wrong' || good ? quantitiesSaid(config, runs) : ''} />
    </>
  )
}

/** The scene's balls named in words, for the screen reader. */
function describe(config: EquationConfig): string {
  return config.task === 'balance'
    ? 'Molecules drawn as labelled atom balls, with a plus and a minus beside each formula, and a bar for each element on each side.'
    : 'A tray of reactant molecules drawn as labelled atom balls, a plus and a minus for how many times the reaction runs, and the products made.'
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
