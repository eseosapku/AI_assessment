'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { BondingConfig, BondingState, IonicAtom, Metal, Molecule, MoleculeId, NonMetal } from './config'
import {
  MOLECULES, bondSummary, chargeText, compoundName, configText, covalentCounts, covalentFaults,
  covalentLabel, formulaCounts, ionicAtoms, ionicFaults, ionicFormula, ionicLabel, moveElectron, originOf, outer,
  readPairs, readShells, sharePair, startShells, unshared, unsharePair,
} from './config'

// The scene is drawn on paper in both themes, so its colours are its own. Ink,
// ring, dot and cross are each over 6:1 on the paper, and dot and cross differ
// in shape as well as colour.
const PAPER = '#FFFDF7'
const EDGE = '#D8D2C4'
const INK = '#1E2733'
const RING = '#566273'
const DOT = '#1D5FB8'
const CROSS = '#B42318'
const W = 360

type Mark = 'dot' | 'cross'
type Spot = { x: number; y: number; r: number }

const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (r: number, deg: number) => ({ x: r * Math.cos(rad(deg)), y: r * Math.sin(rad(deg)) })

function Electron({ x, y, mark }: { x: number; y: number; mark: Mark }) {
  if (mark === 'dot') return <circle cx={x} cy={y} r={3.7} fill={DOT} />
  const s = 3.5
  return <path d={`M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x + s} ${y - s} L ${x - s} ${y + s}`} stroke={CROSS} strokeWidth={2.3} strokeLinecap="round" />
}

/** A formula with real subscripts: "Al2O3". */
function Formula({ text }: { text: string }) {
  return <>{text.split(/(\d+)/).map((p, i) => (/^\d+$/.test(p) ? <sub key={i} className="text-[12px]">{p}</sub> : p))}</>
}

/**
 * Picking and dropping, shared by both scenes. An atom is a button: pick it,
 * then pick another, and `link(from, to)` runs. Dragging from one atom to
 * another does the same. Arrow keys move between atoms, Escape puts back.
 */
function useLinking(spots: Spot[], locked: boolean, link: (from: number, to: number) => void, onPick: (i: number | null) => void) {
  const svg = useRef<SVGSVGElement>(null)
  const atomEls = useRef<(SVGGElement | null)[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ from: number; x: number; y: number } | null>(null)
  const press = useRef<{ from: number; x: number; y: number; moved: boolean } | null>(null)
  // A drag ends in a click on some browsers; that click is not a pick.
  const quietUntil = useRef(0)

  const toSvg = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const spotAt = (p: { x: number; y: number }) => {
    let best: number | null = null
    let bestD = Infinity
    spots.forEach((s, i) => {
      const d = Math.hypot(p.x - s.x, p.y - s.y)
      if (d <= s.r + 10 && d < bestD) { best = i; bestD = d }
    })
    return best
  }
  const pick = (i: number | null) => { setPicked(i); onPick(i) }

  const activate = (i: number) => {
    if (locked) return
    if (picked === null) return pick(i)
    if (picked === i) return pick(null)
    setPicked(null)
    link(picked, i)
  }

  const atom = (i: number) => ({
    ref: (el: SVGGElement | null) => { atomEls.current[i] = el },
    role: 'button',
    tabIndex: locked ? -1 : 0,
    'aria-pressed': picked === i,
    'aria-disabled': locked || undefined,
    onFocus: () => setFocused(i),
    onBlur: () => setFocused((f) => (f === i ? null : f)),
    onPointerDown: (e: PointerEvent) => {
      if (locked) return
      const p = toSvg(e)
      if (p) press.current = { from: i, ...p, moved: false }
    },
    onClick: () => {
      if (Date.now() < quietUntil.current) return
      activate(i)
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        activate(i)
        return
      }
      if (e.key === 'Escape' && picked !== null) {
        e.stopPropagation()
        pick(null)
        return
      }
      const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
      if (step === undefined) return
      // The board moves a selected card with the arrows; here they move between atoms.
      e.preventDefault()
      e.stopPropagation()
      atomEls.current[(i + step + spots.length) % spots.length]?.focus()
    },
    className: `outline-none focus-visible:outline-none ${locked ? '' : 'cursor-pointer'}`,
  })

  const surface = {
    ref: svg,
    onPointerMove: (e: PointerEvent) => {
      const pr = press.current
      const p = pr && toSvg(e)
      if (!pr || !p) return
      if (!pr.moved && Math.hypot(p.x - pr.x, p.y - pr.y) > 6) pr.moved = true
      if (pr.moved) setGhost({ from: pr.from, ...p })
    },
    onPointerUp: (e: PointerEvent) => {
      const pr = press.current
      press.current = null
      setGhost(null)
      if (!pr?.moved) return
      quietUntil.current = Date.now() + 400
      const p = toSvg(e)
      const to = p ? spotAt(p) : null
      if (to !== null && to !== pr.from) {
        setPicked(null)
        link(pr.from, to)
      }
    },
    onPointerCancel: () => { press.current = null; setGhost(null) },
  }

  return { picked, focused, ghost, atom, surface }
}

/** Rings drawn round an atom: solid when focused, dashed when picked. */
function Rings({ r, focused, picked }: { r: number; focused: boolean; picked: boolean }) {
  return (
    <>
      {focused && <circle r={r + 5} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      {picked && <circle r={r + 9} fill="none" stroke="var(--subject)" strokeWidth={2.5} strokeDasharray="5 4" />}
    </>
  )
}

function Footer({ named, solved, marked, wrong, right, status, hint, onReset, locked }: {
  named: boolean; solved: boolean; marked: SceneMarked; wrong: string[]; right: ReactNode; status: string; hint: string; onReset: () => void; locked: boolean
}) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <div aria-live="polite" className="w-full text-center">
        {named && solved && <p className="text-[15px] font-extrabold leading-snug text-ss-ink">{right}</p>}
        {marked === 'wrong' && (
          <ul className="flex flex-col gap-0.5 text-[13px] font-bold leading-snug text-ss-ink">
            {wrong.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </div>
      {!locked && <p aria-live="polite" className="min-h-[18px] text-center text-[12px] font-semibold leading-snug text-ss-slate">{status || hint}</p>}
      {!locked && (
        <button type="button" onClick={onReset} className="nodrag rounded-full border border-ss-line bg-ss-chip px-3 py-1 text-[12px] font-bold text-ss-slate">
          Start again
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ionic: metal atoms on top, non-metal atoms below

const IR = 30
const ROWS = [64, 180] as const
const IH = 248
/** The four places on a shell: top, right, bottom, left. */
const PLACES = [-90, 0, 90, 180]

function ionicSpot(a: IonicAtom): Spot {
  const xs = a.of === 1 ? [180] : a.of === 2 ? [130, 230] : [80, 180, 280]
  return { x: xs[a.col] ?? 180, y: ROWS[a.row], r: IR }
}

/** Where the s-th of n electrons sits: one at each place first, then pairs, as dot-and-cross diagrams draw them. */
function slot(s: number, n: number) {
  const place = s % 4
  const two = n > place + 4
  return polar(IR, PLACES[place] + (two ? (s < 4 ? -14 : 14) : 0))
}

function IonicScene({ metal, nonmetal, state, setState, marked, locked }: {
  metal: Metal; nonmetal: NonMetal; state: BondingState; setState: (s: BondingState) => void; marked: SceneMarked; locked: boolean
}) {
  const atoms = ionicAtoms(metal, nonmetal)
  const shells = readShells(atoms, state) ?? startShells(atoms)
  const spots = atoms.map(ionicSpot)
  const markOf = (id: string): Mark => (atoms[originOf(id)]?.metal ? 'cross' : 'dot')
  const [status, setStatus] = useState('')
  const solved = atoms.every((a, i) => (a.metal ? shells[i].length === 0 : shells[i].length === 8))
  const named = marked !== 'idle'

  const link = (from: number, to: number) => {
    const m = moveElectron(atoms, shells, from, to)
    if ('refused' in m) return setStatus(m.refused)
    setStatus(`Moved an electron from the ${ionicLabel(atoms[from])} to the ${ionicLabel(atoms[to])}, which now has ${m.next[to].length} in its outer shell.`)
    setState({ shells: m.next })
  }
  const l = useLinking(spots, locked, link, (i) => setStatus(i === null
    ? 'Put back.'
    : shells[i].length ? `Picked an electron from the ${ionicLabel(atoms[i])}. Now pick the atom to move it to.` : `The ${ionicLabel(atoms[i])} has no electrons in its outer shell to move.`))

  /** Own electrons first, in their places, then the ones that arrived. */
  const shown = (i: number) => [
    ...shells[i].filter((e) => originOf(e) === i).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1])),
    ...shells[i].filter((e) => originOf(e) !== i),
  ]
  const moving = (i: number) => shells[i][shells[i].length - 1]

  const [m, n] = formulaCounts(metal, nonmetal)
  const ion = (el: Metal | NonMetal, count: number, charge: number) => (
    <span className="whitespace-nowrap">{count > 1 ? `${count} ` : ''}{el}<sup className="text-[12px]">{chargeText(charge)}</sup></span>
  )
  const right = (
    <>
      {ion(metal, m, outer(metal))} and {ion(nonmetal, n, outer(nonmetal) - 8)} ions: {compoundName(metal, nonmetal)}, <Formula text={ionicFormula(metal, nonmetal)} />
    </>
  )

  return (
    <div className="nodrag flex flex-col items-center gap-2">
      <svg
        {...l.surface}
        viewBox={`0 0 ${W} ${IH}`}
        className="w-full max-w-[380px] touch-none select-none"
        role="group"
        aria-label="Metal atoms above, non-metal atoms below, each with its outer shell of electrons"
      >
        <rect x={0.5} y={0.5} width={W - 1} height={IH - 1} rx={16} fill={PAPER} stroke={EDGE} />
        {atoms.map((a, i) => {
          const s = spots[i]
          const list = shown(i)
          const count = list.length
          const from = count - list.filter((e) => originOf(e) !== i).length
          const charge = outer(a.el) - count
          const label = `The ${ionicLabel(a)}: ${count} electron${count === 1 ? '' : 's'} in its outer shell${count > from ? `, ${count - from} of them moved from another atom` : ''}. Configuration ${configText(a.el, count)}.`
          const lift = l.picked === i ? list.indexOf(moving(i)) : -1
          return (
            <g key={i}>
              <g {...l.atom(i)} transform={`translate(${s.x} ${s.y})`} aria-label={label}>
                <circle r={IR + 10} fill="transparent" />
                <Rings r={IR} focused={l.focused === i} picked={l.picked === i} />
                <circle r={IR} fill="none" stroke={RING} strokeWidth={1.6} strokeDasharray={count === 0 ? '4 4' : undefined} />
                <text y={6} textAnchor="middle" fontSize={18} fontWeight={800} fill={INK}>{a.el}</text>
                {list.map((e, k) => {
                  const p = slot(k, count)
                  return (
                    <g key={e}>
                      {k === lift && <circle cx={p.x} cy={p.y} r={7.5} fill="none" stroke="var(--subject)" strokeWidth={2} />}
                      <Electron x={p.x} y={p.y} mark={markOf(e)} />
                    </g>
                  )
                })}
                {named && solved && (
                  <g aria-hidden>
                    <path d={`M ${-IR - 3} ${-IR - 7} h -6 v ${2 * IR + 14} h 6`} fill="none" stroke={INK} strokeWidth={1.8} />
                    <path d={`M ${IR + 3} ${-IR - 7} h 6 v ${2 * IR + 14} h -6`} fill="none" stroke={INK} strokeWidth={1.8} />
                    <text x={IR + 10} y={-IR - 9} fontSize={16} fontWeight={800} fill={INK}>{chargeText(charge)}</text>
                  </g>
                )}
              </g>
              <text x={s.x} y={s.y + IR + 22} textAnchor="middle" fontSize={14} fontWeight={700} fill={RING} aria-hidden>{configText(a.el, count)}</text>
            </g>
          )
        })}
        {l.ghost && shells[l.ghost.from]?.length ? (
          <g pointerEvents="none" aria-hidden>
            <line x1={spots[l.ghost.from].x} y1={spots[l.ghost.from].y} x2={l.ghost.x} y2={l.ghost.y} stroke="var(--subject)" strokeWidth={2} strokeDasharray="3 4" />
            <circle cx={l.ghost.x} cy={l.ghost.y} r={9} fill={PAPER} stroke="var(--subject)" strokeWidth={2} />
            <Electron x={l.ghost.x} y={l.ghost.y} mark={markOf(moving(l.ghost.from))} />
          </g>
        ) : null}
      </svg>
      <Footer
        named={named} solved={solved} marked={marked} locked={locked} status={status}
        wrong={ionicFaults(atoms, shells)} right={right}
        hint="Drag an electron from one atom to another, or pick an atom and then where its electron goes."
        onReset={() => { setStatus('Back to the start.'); setState({ shells: startShells(atoms) }) }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Covalent: the molecule's atoms, apart until they share a pair

const CH = 250
const rOf = (el: string) => (el === 'H' ? 32 : 38)
/** How far two shells overlap once they share, and the gap between them before. */
const OVERLAP = 16
const GAP = 12

/** Where each atom's centre sits: a bonded neighbour closes in until the shells overlap. */
function covalentSpots(mol: Molecule, pairs: number[]): Spot[] {
  const cx = W / 2
  const cy = CH / 2
  const r = mol.atoms.map(rOf)
  const dist = (j: number, bonded: boolean) => r[0] + r[j + 1] + (bonded ? -OVERLAP : GAP)
  if (mol.atoms.length === 2) {
    const u = polar(1, mol.dirs[0])
    const d = dist(0, pairs[0] > 0)
    return [{ x: cx - (u.x * d) / 2, y: cy - (u.y * d) / 2, r: r[0] }, { x: cx + (u.x * d) / 2, y: cy + (u.y * d) / 2, r: r[1] }]
  }
  // The centre atom stays put: the box of the atoms set apart is centred.
  const apart = [{ x: 0, y: 0 }, ...mol.dirs.map((deg, j) => polar(dist(j, false), deg))]
  const xs = apart.flatMap((p, i) => [p.x - r[i], p.x + r[i]])
  const ys = apart.flatMap((p, i) => [p.y - r[i], p.y + r[i]])
  const ox = cx - (Math.min(...xs) + Math.max(...xs)) / 2
  const oy = cy - (Math.min(...ys) + Math.max(...ys)) / 2
  return [
    { x: ox, y: oy, r: r[0] },
    ...mol.dirs.map((deg, j) => {
      const p = polar(dist(j, pairs[j] > 0), deg)
      return { x: ox + p.x, y: oy + p.y, r: r[j + 1] }
    }),
  ]
}

function CovalentScene({ molecule, state, setState, marked, locked, reduced }: {
  molecule: MoleculeId; state: BondingState; setState: (s: BondingState) => void; marked: SceneMarked; locked: boolean; reduced: boolean
}) {
  const mol = MOLECULES[molecule]
  const start = mol.dirs.map(() => 0)
  const pairs = readPairs(mol, state) ?? start
  const spots = covalentSpots(mol, pairs)
  const counts = covalentCounts(mol, pairs)
  // The centre atom's electrons are dots, its neighbours' crosses; a pair of like atoms is one of each.
  const markOf = (i: number): Mark => (i === 0 ? 'dot' : 'cross')
  const [status, setStatus] = useState('')
  const [lensFocus, setLensFocus] = useState<number | null>(null)
  const solved = mol.atoms.every((el, i) => counts[i] === (el === 'H' ? 2 : 8))
  const named = marked !== 'idle'
  const glide = reduced ? undefined : 'transform 220ms ease-out'

  const link = (a: number, b: number) => {
    const m = sharePair(mol, pairs, a, b)
    if ('refused' in m) return setStatus(m.refused)
    setStatus(`The ${covalentLabel(mol, a)} and the ${covalentLabel(mol, b)} now share a pair, one electron from each.`)
    setState({ pairs: m.next })
  }
  const unlink = (j: number) => {
    if (locked) return
    const m = unsharePair(pairs, j)
    if ('refused' in m) return setStatus(m.refused)
    setStatus(`Took a shared pair back: the ${covalentLabel(mol, 0)} and the ${covalentLabel(mol, j + 1)} each keep their own electron.`)
    setState({ pairs: m.next })
  }
  const l = useLinking(spots, locked, link, (i) => setStatus(i === null
    ? 'Put back.'
    : `Picked the ${covalentLabel(mol, i)}. Now pick an atom next to it to share a pair with.`))

  const lens = (j: number) => {
    const a = spots[0]
    const b = spots[j + 1]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
    const mid = (d - b.r + a.r) / 2
    return { x: a.x + u.x * mid, y: a.y + u.y * mid, u }
  }
  const right = (
    <>
      {mol.name.charAt(0).toUpperCase() + mol.name.slice(1)}, <Formula text={molecule} />: {bondSummary(pairs)}
    </>
  )

  return (
    <div className="nodrag flex flex-col items-center gap-2">
      <svg
        {...l.surface}
        viewBox={`0 0 ${W} ${CH}`}
        className="w-full max-w-[380px] touch-none select-none"
        role="group"
        aria-label="The atoms of the molecule, each with its outer shell of electrons"
      >
        <rect x={0.5} y={0.5} width={W - 1} height={CH - 1} rx={16} fill={PAPER} stroke={EDGE} />
        {mol.atoms.map((el, i) => {
          const s = spots[i]
          const shared = counts[i] - outer(el)
          const label = `The ${covalentLabel(mol, i)}: ${counts[i]} electron${counts[i] === 1 ? '' : 's'} in its outer shell${shared ? `, ${2 * shared} of them in shared pairs` : ''}.`
          return (
            <g key={i} style={{ transform: `translate(${s.x}px, ${s.y}px)`, transition: glide }}>
              <g {...l.atom(i)} aria-label={label}>
                <circle r={s.r} fill="transparent" />
                <Rings r={s.r} focused={l.focused === i} picked={l.picked === i} />
                <circle r={s.r} fill="none" stroke={RING} strokeWidth={1.6} />
                <text y={6} textAnchor="middle" fontSize={18} fontWeight={800} fill={INK}>{el}</text>
                {unshared(mol, pairs, i).flatMap(({ angle, n }) =>
                  (n === 2 ? [angle - 14, angle + 14] : [angle]).map((deg) => {
                    const p = polar(s.r, deg)
                    return <Electron key={deg} x={p.x} y={p.y} mark={markOf(i)} />
                  }))}
              </g>
            </g>
          )
        })}
        {pairs.map((order, j) => {
          if (!order) return null
          const c = lens(j)
          const v = { x: -c.u.y, y: c.u.x }
          return (
            <g
              key={j}
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-label={`${order} shared pair${order === 1 ? '' : 's'} between the ${covalentLabel(mol, 0)} and the ${covalentLabel(mol, j + 1)}. Press Enter to take one back.`}
              aria-disabled={locked || undefined}
              className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-pointer'}`}
              onClick={() => unlink(j)}
              onFocus={() => setLensFocus(j)}
              onBlur={() => setLensFocus((f) => (f === j ? null : f))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault()
                  e.stopPropagation()
                  unlink(j)
                } else if (e.key.startsWith('Arrow')) {
                  e.stopPropagation()
                }
              }}
            >
              <circle cx={c.x} cy={c.y} r={15} fill="transparent" />
              {lensFocus === j && <circle cx={c.x} cy={c.y} r={19} fill="none" stroke="var(--subject)" strokeWidth={3} />}
              {Array.from({ length: order }, (_, k) => {
                const off = (k - (order - 1) / 2) * 13
                const px = c.x + v.x * off
                const py = c.y + v.y * off
                return (
                  <g key={k}>
                    <Electron x={px - c.u.x * 5} y={py - c.u.y * 5} mark={markOf(0)} />
                    <Electron x={px + c.u.x * 5} y={py + c.u.y * 5} mark={markOf(j + 1)} />
                  </g>
                )
              })}
            </g>
          )
        })}
        {l.ghost && (
          <g pointerEvents="none" aria-hidden>
            <line x1={spots[l.ghost.from].x} y1={spots[l.ghost.from].y} x2={l.ghost.x} y2={l.ghost.y} stroke="var(--subject)" strokeWidth={2} strokeDasharray="3 4" />
            <circle cx={l.ghost.x} cy={l.ghost.y} r={9} fill={PAPER} stroke="var(--subject)" strokeWidth={2} />
            <Electron x={l.ghost.x} y={l.ghost.y} mark={markOf(l.ghost.from)} />
          </g>
        )}
      </svg>
      <Footer
        named={named} solved={solved} marked={marked} locked={locked} status={status}
        wrong={covalentFaults(mol, pairs)} right={right}
        hint="Drag from one atom to the next, or pick one and then the other, to share a pair: one electron from each. Tap a shared pair to take it back."
        onReset={() => { setStatus('Back to the start.'); setState({ pairs: start }) }}
      />
    </div>
  )
}

/** The scene: an ionic compound to make by moving electrons, or a molecule to make by sharing them. */
export function BondingView({ config, state, setState, marked, reduced, locked }: SceneViewProps<BondingConfig, BondingState>) {
  const set = (s: BondingState) => setState(s)
  const task = config.task
  if (task.kind === 'make-covalent') {
    return <CovalentScene molecule={task.molecule} state={state ?? {}} setState={set} marked={marked} locked={locked} reduced={reduced} />
  }
  return <IonicScene metal={task.metal} nonmetal={task.nonmetal} state={state ?? {}} setState={set} marked={marked} locked={locked} />
}
