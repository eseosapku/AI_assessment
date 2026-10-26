'use client'
import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { AtomConfig, AtomState } from './config'
import { builtName, chargeText, configString, drawable, electronsLine, ionSuffix, made, madeSentence, MAX_NEUTRONS, MAX_PROTONS, SHELL_CAPS, totalElectrons } from './config'

// One scene look in both themes: the atom sits on its own dark panel, so its
// colours are its own. Each part is at least 5:1 against the panel.
const PANEL = '#0F1C2E'
const PROTON = '#F0605A'
const NEUTRON = '#B8C2D1'
const ELECTRON = '#56C7F5'
const RING = 'rgba(255,255,255,0.5)'
const LABEL = 'rgba(255,255,255,0.8)'

const W = 216
const C = W / 2
/** Shell radii, inner to outer. */
const RADII = [46, 63, 80, 97]
const NUCLEON = 4.4
const SPACING = 4.6
const E_R = 5.5
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
/** A pair's two electrons sit this far either side of their compass point, in degrees. */
const PAIR = 11

/**
 * The nucleus as a sunflower of nucleons, protons spread evenly through it.
 * Index 0 is at the middle; the list is drawn outside-in so the middle sits on top.
 */
export function nucleons(protons: number, neutrons: number): { x: number; y: number; proton: boolean }[] {
  const n = protons + neutrons
  return Array.from({ length: n }, (_, i) => {
    const r = n === 1 ? 0 : SPACING * Math.sqrt(i + 0.5)
    const a = i * GOLDEN
    const proton = Math.floor(((i + 1) * protons) / n) - Math.floor((i * protons) / n) === 1
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a), proton }
  })
}

/**
 * Where a shell's electrons sit. A two-electron shell puts them top and
 * bottom; an eight-electron shell fills the four compass points singly, then
 * pairs them, the way they are drawn in class. Adding one never moves another
 * by more than half a pair's gap.
 */
export function electronAngles(count: number, capacity: number): number[] {
  if (capacity <= 2) return [-90, 90].slice(0, count)
  const points = [-90, 0, 90, 180]
  const per = points.map((_, k) => (count > k ? 1 : 0) + (count > k + 4 ? 1 : 0))
  return points.flatMap((p, k) => (per[k] === 2 ? [p - PAIR, p + PAIR] : per[k] === 1 ? [p] : []))
}

const at = (r: number, deg: number) => ({ x: C + r * Math.cos((deg * Math.PI) / 180), y: C + r * Math.sin((deg * Math.PI) / 180) })
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/**
 * One count the learner sets: a spin button (arrows, Page Up/Down, Home, End)
 * between a take-away and an add button that repeat while held.
 */
function Counter({ label, noun, value, max, set, locked, fixed }: {
  label: string; noun: string; value: number; max: number; set(next: number): void; locked: boolean; fixed?: boolean
}) {
  const id = useId()
  const latest = useRef({ value, max, set, locked })
  latest.current = { value, max, set, locked }
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
    const next = Math.max(0, Math.min(l.max, l.value + by))
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
    // A hold has already added its run; the click that ends it adds nothing more.
    if (held.current) { held.current = false; return }
    bump(by)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they set the count.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') bump(-latest.current.value)
    else if (e.key === 'End') bump(latest.current.max - latest.current.value)
    else bump(by)
  }

  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      {fixed ? (
        <span className="w-[92px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
      ) : (
        <span className="flex items-center gap-1">
          <button
            type="button" tabIndex={-1} aria-label={`Take away ${article(noun)} ${noun}`} className={button}
            disabled={locked || value <= 0}
            onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(-1)}
          >−</button>
          <span
            role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id}
            aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-valuetext={plural(value, noun)}
            aria-disabled={locked || undefined} onKeyDown={onKey}
            className="nodrag min-w-[28px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          >{value}</span>
          <button
            type="button" tabIndex={-1} aria-label={`Add ${article(noun)} ${noun}`} className={button}
            disabled={locked || value >= max}
            onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(1)}
          >+</button>
        </span>
      )}
    </div>
  )
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

/** A symbol written the standard way: mass number over atomic number on its left, the charge on its right. */
function Nuclide({ z, mass, symbol, charge }: { z: number; mass: number; symbol: string; charge: number }) {
  return (
    <span className="inline-flex shrink-0 items-center font-extrabold text-ss-ink" aria-hidden="true">
      <span className="flex flex-col items-end text-[12px] leading-[1.15] tabular-nums">
        <span>{mass}</span>
        <span>{z}</span>
      </span>
      <span className="ml-0.5 text-[28px] leading-none">{symbol}</span>
      {charge !== 0 && <span className="ml-0.5 self-start text-[13px] leading-none">{ionSuffix(charge)}</span>}
    </span>
  )
}

export function AtomView({ config, state: raw, setState, marked, locked }: SceneViewProps<AtomConfig, AtomState>) {
  const state = drawable(raw)
  const { protons, neutrons, shells } = state
  const electrons = totalElectrons(shells)
  const charge = protons - electrons
  const fixedNucleus = config.task.kind === 'build-ion'
  const named = marked !== 'idle'

  const put = (next: Partial<AtomState>) => {
    if (locked) return
    setState({ ...state, ...next })
  }
  const setShell = (i: number, n: number) => put({ shells: shells.map((x, j) => (j === i ? n : x)) })

  const nucleus = nucleons(protons, neutrons)
  const core = protons + neutrons
  const seen = `An atom: ${plural(protons, 'proton')} and ${plural(neutrons, 'neutron')} in the nucleus, ${plural(electrons, 'electron')} round it${electrons ? `, arranged ${configString(shells).split(',').join(', ')} from the inner shell out` : ''}.`

  const m = made(state)
  return (
    <div className="nodrag flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-center gap-3">
        <figure className="flex w-[184px] shrink-0 flex-col gap-1.5">
          <svg viewBox={`0 0 ${W} ${W}`} className="w-full touch-none select-none" role="img" aria-label={seen}>
            <rect width={W} height={W} rx={16} fill={PANEL} />
            {RADII.map((r, i) => (
              <g key={r}>
                <circle cx={C} cy={C} r={r} fill="none" stroke={RING} strokeWidth={1.5} />
                {/* A tap on a shell adds an electron to it; the counters do the same by key. */}
                <circle
                  cx={C} cy={C} r={r} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke"
                  className={locked || shells[i] >= SHELL_CAPS[i] ? '' : 'cursor-pointer'}
                  onClick={() => shells[i] < SHELL_CAPS[i] && setShell(i, shells[i] + 1)}
                />
                {/* The shell's number, on the diagonal where no electron sits. */}
                <g pointerEvents="none">
                  <circle cx={at(r, 45).x} cy={at(r, 45).y} r={8} fill={PANEL} />
                  <text x={at(r, 45).x} y={at(r, 45).y + 4.5} textAnchor="middle" fill={LABEL} fontSize={14.5} fontWeight={700}>{i + 1}</text>
                </g>
              </g>
            ))}
            {core === 0 ? (
              // Where the nucleus will be, while it is empty.
              <circle cx={C} cy={C} r={10} fill="none" stroke={RING} strokeWidth={1.5} strokeDasharray="3 3" />
            ) : (
              [...nucleus].reverse().map((p, k) => (
                <g key={k}>
                  <circle cx={p.x} cy={p.y} r={NUCLEON} fill={p.proton ? PROTON : NEUTRON} stroke={PANEL} strokeWidth={0.8} />
                  {p.proton && <path d={`M ${p.x - 2.2} ${p.y} H ${p.x + 2.2} M ${p.x} ${p.y - 2.2} V ${p.y + 2.2}`} stroke="#FFFFFF" strokeWidth={1.3} />}
                </g>
              ))
            )}
            {shells.map((count, i) =>
              electronAngles(count, SHELL_CAPS[i]).map((deg, k) => {
                const e = at(RADII[i], deg)
                return (
                  <g key={`${i}-${k}`} className={locked ? '' : 'cursor-pointer'} onClick={() => setShell(i, shells[i] - 1)}>
                    <circle cx={e.x} cy={e.y} r={9} fill="transparent" />
                    <circle cx={e.x} cy={e.y} r={E_R} fill={ELECTRON} />
                    <path d={`M ${e.x - 2.4} ${e.y} H ${e.x + 2.4}`} stroke={PANEL} strokeWidth={1.4} />
                  </g>
                )
              }),
            )}
          </svg>
          <figcaption className="flex flex-wrap justify-center gap-x-2.5 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
            <span className="flex items-center gap-1"><Dot color={PROTON} sign="+" />Proton</span>
            <span className="flex items-center gap-1"><Dot color={NEUTRON} />Neutron</span>
            <span className="flex items-center gap-1"><Dot color={ELECTRON} sign="−" />Electron</span>
          </figcaption>
        </figure>

        <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Nucleus</p>
          <Counter label="Protons" noun="proton" value={protons} max={MAX_PROTONS} set={(n) => put({ protons: n })} locked={locked} fixed={fixedNucleus} />
          <Counter label="Neutrons" noun="neutron" value={neutrons} max={MAX_NEUTRONS} set={(n) => put({ neutrons: n })} locked={locked} fixed={fixedNucleus} />
          <p className="mt-1.5 flex items-baseline justify-between text-[12px] font-bold uppercase tracking-widest text-ss-slate">
            Electrons <span className="text-[13px] normal-case tracking-normal tabular-nums text-ss-ink">{electrons}</span>
          </p>
          {shells.map((count, i) => (
            <Counter key={i} label={`Shell ${i + 1}`} noun="electron" value={count} max={SHELL_CAPS[i]} set={(n) => setShell(i, n)} locked={locked} />
          ))}
          <p className="mt-1.5 flex items-baseline justify-between border-t border-ss-line pt-1.5" aria-live="polite">
            <span className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Charge</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{chargeText(charge)}</span>
          </p>
        </div>
      </div>

      <div aria-live="polite">
        {named && (
          <div className="flex items-center gap-3 rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
            {m.element && <Nuclide z={m.element.z} mass={m.mass} symbol={m.element.symbol} charge={m.charge} />}
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-snug text-ss-ink">
                {/* "sodium-23" stays on one line: a non-breaking hyphen. */}
                {(marked === 'wrong' ? madeSentence(state) : builtName(state)).replace(/-(?=\d)/g, '\u2011')}
              </p>
              <p className="text-[12px] font-semibold text-ss-slate">
                {m.element && <span className="sr-only">{`${m.element.symbol}${m.charge ? ` ${chargeText(m.charge)}` : ''}, mass number ${m.mass}, atomic number ${m.element.z}. `}</span>}
                {electronsLine(state)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Dot({ color, sign }: { color: string; sign?: '+' | '−' }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <circle cx={6} cy={6} r={5.5} fill={color} />
      {sign && <path d={sign === '+' ? 'M 3.5 6 H 8.5 M 6 3.5 V 8.5' : 'M 3.5 6 H 8.5'} stroke={sign === '+' ? '#FFFFFF' : PANEL} strokeWidth={1.4} />}
    </svg>
  )
}
