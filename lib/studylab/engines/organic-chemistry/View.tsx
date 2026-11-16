'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Family, Molecule, OrganicConfig, OrganicState } from './config'
import { carbonValence, madeText, moleculeOf, startingMolecule, targetMolecule, working } from './config'

type Props = SceneViewProps<OrganicConfig, OrganicState>
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const BOND = '#475569'
const TILE = '#FFFFFF'
const ACCENT = '#2563A8'
const PALE = '#E5EEF6'
const ORANGE = '#D97925'
const ORANGE_EDGE = '#8A4315'
const GLASS = '#E8F0F5'
const FONT = 'system-ui, sans-serif'
const W = 360
const H = 222
// These three are the polymer geometry in config.ts, written out because the files import each other.
const PW = 360
const PH = 238
const PC = [76, 180, 284]

const STEP = 'nodrag inline-flex h-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold leading-none text-ss-ink whitespace-nowrap touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const SMALL = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40'
const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
const f = (n: number) => n.toFixed(1)

type Atom = { key: string; x: number; y: number; label: string; kind?: 'C' | 'H' | 'O' | 'Br' | 'Cl'; active?: boolean }
type Bond = { a: string; b: string; order: number; id?: string }
export type Drawing = { atoms: Atom[]; bonds: Bond[] }

/** Carbon centres: a gently branching, readable displayed formula, not a force simulation. */
export function carbonPoints(n: number): { x: number; y: number }[] {
  if (n === 1) return [{ x: 180, y: 94 }]
  if (n === 2) return [{ x: 150, y: 94 }, { x: 210, y: 94 }]
  if (n === 3) return [{ x: 112, y: 94 }, { x: 180, y: 94 }, { x: 248, y: 94 }]
  return [{ x: 76, y: 94 }, { x: 144, y: 94 }, { x: 212, y: 94 }, { x: 280, y: 94 }]
}

/** Every H and functional-group atom is derived from the carbon graph. */
export function moleculeDrawing(m: Molecule, supplied?: { x: number; y: number }[]): Drawing {
  let points = supplied ?? carbonPoints(m.n)
  if (!supplied && m.n === 4) {
    const centre = [0, 1, 2, 3].find((i) => m.edges.filter(([a, b]) => a === i || b === i).length === 3)
    if (centre !== undefined) {
      const others = [0, 1, 2, 3].filter((i) => i !== centre)
      points = [...carbonPoints(4)]
      points[centre] = { x: 180, y: 82 }
      points[others[0]] = { x: 112, y: 82 }
      points[others[1]] = { x: 248, y: 82 }
      points[others[2]] = { x: 180, y: 137 }
    }
  }
  const atoms: Atom[] = points.map((p, i) => ({ key: `c${i}`, x: p.x, y: p.y, label: 'C', kind: 'C' }))
  const bonds: Bond[] = m.edges.map(([a, b, order]) => ({ a: `c${a}`, b: `c${b}`, order, id: `bond-${a}-${b}` }))
  points.forEach((p, i) => {
    const neighbours = m.edges.filter(([a, b]) => a === i || b === i).map(([a, b]) => points[a === i ? b : a])
    const directions = [{ x: 0, y: -43 }, { x: 0, y: 43 }, { x: -43, y: 0 }, { x: 43, y: 0 }]
    let free = directions.filter((d) => !neighbours.some((q) => Math.abs((q.x - p.x) * d.y - (q.y - p.y) * d.x) < 4 && (q.x - p.x) * d.x + (q.y - p.y) * d.y > 0))
    const family = m.groups[i]
    const added = m.additions?.[i]
    let needed = family === 'acid' ? [{ label: 'O', double: true }, { label: 'OH', double: false }] : family === 'alcohol' ? [{ label: 'OH', double: false }] : added ? [{ label: added, double: false }] : []
    const hCount = Math.max(0, 4 - carbonValence(m, i))
    // A branched carbon has its branch below, so its hydrogens point out to the sides.
    if (neighbours.some((q) => q.y > p.y + 4) && free.some((d) => d.x === -43)) {
      free = [...free.filter((d) => d.x !== 0), { x: 0, y: -43 }]
    }
    needed = [...needed, ...Array.from({ length: hCount }, () => ({ label: 'H', double: false }))]
    needed.forEach((a, k) => {
      const d = free[k] ?? directions[k % 4]
      const key = `g${i}-${k}`
      if (a.label === 'OH') {
        atoms.push({ key: `${key}o`, x: p.x + d.x * 0.65, y: p.y + d.y * 0.65, label: 'O', kind: 'O' })
        atoms.push({ key: `${key}h`, x: p.x + d.x * 1.18, y: p.y + d.y * 1.18, label: 'H', kind: 'H' })
        bonds.push({ a: `c${i}`, b: `${key}o`, order: 1 }, { a: `${key}o`, b: `${key}h`, order: 1 })
      } else {
        atoms.push({ key, x: p.x + d.x, y: p.y + d.y, label: a.label, kind: a.label === 'O' ? 'O' : a.label === 'Br' ? 'Br' : a.label === 'Cl' ? 'Cl' : 'H' })
        bonds.push({ a: `c${i}`, b: key, order: a.double ? 2 : 1 })
      }
    })
  })
  return { atoms, bonds }
}

function AtomTile({ atom, selected, onSelect, label }: { atom: Atom; selected?: boolean; onSelect?: () => void; label?: string }) {
  const carbon = atom.kind === 'C'
  const r = carbon ? 13 : atom.label === 'Br' ? 12 : 10
  const colour = atom.kind === 'Br' ? ORANGE : atom.kind === 'O' ? '#B94B48' : atom.kind === 'Cl' ? '#477A4C' : carbon ? INK : SOFT
  const body = <>
    <circle r={r + 3} fill="transparent" />
    <circle r={r} fill={carbon ? PALE : TILE} stroke={selected ? ACCENT : colour} strokeWidth={selected ? 3 : 1.4} />
    <text y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={carbon ? 14 : 12} fontWeight={carbon ? 800 : 700} fill={colour}>{atom.label}</text>
  </>
  if (!onSelect) return <g transform={`translate(${f(atom.x)} ${f(atom.y)})`} aria-hidden="true">{body}</g>
  return <g transform={`translate(${f(atom.x)} ${f(atom.y)})`} role="button" tabIndex={0} aria-label={label ?? `Carbon ${atom.key.slice(1)}`} onClick={onSelect} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect() } }} className="cursor-pointer outline-none focus-visible:outline-none">{body}{selected && <circle r={18} fill="none" stroke={ACCENT} strokeWidth={1.5} />}</g>
}

function Bonds({ drawing, onBond, opened }: { drawing: Drawing; onBond?: (id: string) => void; opened?: boolean }) {
  const byKey = new Map(drawing.atoms.map((a) => [a.key, a]))
  return <g>{drawing.bonds.map((b) => {
    const a = byKey.get(b.a)!
    const z = byKey.get(b.b)!
    const dx = z.x - a.x
    const dy = z.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const trimA = a.kind === 'C' ? 14 : 11
    const trimB = z.kind === 'C' ? 14 : 11
    const x1 = a.x + dx / len * trimA
    const y1 = a.y + dy / len * trimA
    const x2 = z.x - dx / len * trimB
    const y2 = z.y - dy / len * trimB
    const ox = -dy / len * 3
    const oy = dx / len * 3
    const secondOpened = opened && b.order === 2
    const lines = b.order === 2 ? <><line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} /><line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy} strokeDasharray={secondOpened ? '3 5' : undefined} opacity={secondOpened ? 0.3 : 1} /></> : <line x1={x1} y1={y1} x2={x2} y2={y2} />
    const hit = onBond && b.id ? <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="transparent" strokeWidth={24} pointerEvents="stroke" className="cursor-pointer" onClick={() => onBond!(b.id!)} /> : null
    return <g key={`${b.a}-${b.b}`} stroke={BOND} strokeWidth={2} strokeLinecap="round" role={onBond && b.id ? 'button' : undefined} tabIndex={onBond && b.id ? 0 : undefined} aria-label={onBond && b.id ? `Change bond between carbon ${Number(b.a.slice(1)) + 1} and carbon ${Number(b.b.slice(1)) + 1}` : undefined} onKeyDown={onBond && b.id ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onBond(b.id!) } } : undefined} className="outline-none">{lines}{hit}</g>
  })}</g>
}

function Formula({ drawing, onCarbon, onBond, selected, opened }: { drawing: Drawing; onCarbon?: (i: number) => void; onBond?: (id: string) => void; selected?: number; opened?: boolean }) {
  return <g><Bonds drawing={drawing} onBond={onBond} opened={opened} />{drawing.atoms.map((a) => <AtomTile key={a.key} atom={a} selected={a.key === `c${selected}`} onSelect={a.kind === 'C' && onCarbon ? () => onCarbon(Number(a.key.slice(1))) : undefined} label={a.kind === 'C' ? `Select carbon ${Number(a.key.slice(1)) + 1}` : undefined} />)}</g>
}

function Panel({ height = H, label, children }: { height?: number; label: string; children: ReactNode }) {
  return <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="block h-auto w-full select-none" onKeyDown={keepArrows}><rect x={0.75} y={0.75} width={W - 1.5} height={height - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />{children}</svg>
}

function Text({ x, y, children, colour = SOFT, anchor = 'middle', size = 12 }: { x: number; y: number; children: string; colour?: string; anchor?: 'start' | 'middle' | 'end'; size?: number }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize={size} fontWeight={700} fill={colour}>{children}</text>
}

function BuildCard({ config, state, setState, locked, reduced }: Props & { config: Extract<OrganicConfig, { task: 'build' }> }) {
  const start = startingMolecule(config)
  const m = moleculeOf(state, start)
  const [selected, setSelected] = useState(0)
  const drawing = moleculeDrawing(m)
  const canAdd = m.n < 4 && carbonValence(m, selected) < 4
  const set = (next: Molecule) => { if (!locked) setState({ n: next.n, edges: next.edges, groups: next.groups }) }
  const add = () => {
    if (!canAdd) return
    set({ ...m, n: m.n + 1, edges: [...m.edges, [selected, m.n, 1]] })
    setSelected(m.n)
  }
  const remove = () => {
    if (m.n <= 1) return
    const gone = m.n - 1
    set({ n: gone, edges: m.edges.filter(([a, b]) => a !== gone && b !== gone), groups: Object.fromEntries(Object.entries(m.groups).filter(([k]) => Number(k) !== gone)) })
    setSelected(Math.min(selected, gone - 1))
  }
  const bond = (id: string) => {
    const i = m.edges.findIndex((e) => `bond-${e[0]}-${e[1]}` === id)
    if (i < 0) return
    const e = m.edges[i]
    const order = e[2] === 1 ? 2 : 1
    const next = { ...m, edges: m.edges.map((x, j) => j === i ? [x[0], x[1], order] as [number, number, number] : x) }
    if ([e[0], e[1]].every((c) => carbonValence(next, c) <= 4)) set(next)
  }
  const functional = config.family === 'alcohol' || config.family === 'acid'
  const group = m.groups[selected]
  const toggleGroup = () => {
    if (!functional) return
    const groups = { ...m.groups }
    if (group) delete groups[selected]
    else {
      const next = { ...m, groups: { ...groups, [selected]: config.family as Family } }
      if (carbonValence(next, selected) > 4) return
      groups[selected] = config.family as Family
    }
    set({ ...m, groups })
  }
  const formulaBits = `${m.n} carbon${m.n === 1 ? '' : 's'}, ${m.edges.length} carbon–carbon bond${m.edges.length === 1 ? '' : 's'}.`
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <Panel label={`Displayed formula under construction: ${formulaBits} Hydrogen atoms fill unused carbon bonds.`}>
        <Text x={18} y={22} anchor="start">Displayed formula</Text>
        <Text x={342} y={22} anchor="end">C has 4 bonds</Text>
        <g style={reduced ? undefined : { transition: 'opacity 250ms ease' }}><Formula drawing={drawing} selected={selected} onCarbon={setSelected} onBond={locked ? undefined : bond} /></g>
        <Text x={180} y={205}>Tap C to select · tap a bond to change it</Text>
      </Panel>
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">Unused carbon bonds carry H automatically.</figcaption>
    </figure>
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Carbon {selected + 1} selected</span>
        <span className="flex items-center gap-1">
          <button type="button" className={SMALL} aria-label="Remove last carbon" disabled={locked || m.n <= 1} onClick={remove}>−</button>
          <span className="min-w-[24px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{m.n}</span>
          <button type="button" className={SMALL} aria-label="Add a carbon to the selected carbon" disabled={locked || !canAdd} onClick={add}>+</button>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">{functional ? `Functional group on C${selected + 1}` : 'Bond orders'}</span>
        {functional ? <button type="button" className={STEP} aria-label={`${group ? 'Remove' : 'Place'} ${config.family === 'acid' ? 'carboxyl COOH' : 'hydroxyl OH'} group on carbon ${selected + 1}`} disabled={locked} onClick={toggleGroup}>{group ? 'Remove' : 'Place'} {config.family === 'acid' ? '–COOH' : '–OH'}</button> : <span className="text-[12px] font-semibold text-ss-slate">single ↔ double</span>}
        <button type="button" className={STEP} aria-label="Reset molecule" disabled={locked} onClick={() => { set(start); setSelected(0) }}>Reset</button>
      </div>
    </div>
  </div>
}

function ReagentDrawing({ kind, x, y }: { kind: string; x: number; y: number }) {
  const atoms: Atom[] = kind === 'bromine' ? [{ key: 'r1', x: x - 18, y, label: 'Br', kind: 'Br' }, { key: 'r2', x: x + 18, y, label: 'Br', kind: 'Br' }]
    : kind === 'hydrogen' ? [{ key: 'r1', x: x - 15, y, label: 'H', kind: 'H' }, { key: 'r2', x: x + 15, y, label: 'H', kind: 'H' }]
      : [{ key: 'r1', x: x - 23, y, label: 'H', kind: 'H' }, { key: 'r2', x, y, label: 'O', kind: 'O' }, { key: 'r3', x: x + 25, y, label: 'H', kind: 'H' }]
  const bonds: Bond[] = kind === 'steam' ? [{ a: 'r1', b: 'r2', order: 1 }, { a: 'r2', b: 'r3', order: 1 }] : [{ a: 'r1', b: 'r2', order: 1 }]
  return <g><Bonds drawing={{ atoms, bonds }} />{atoms.map((a) => <AtomTile key={a.key} atom={a} />)}</g>
}

function Tube({ colourless, reduced }: { colourless: boolean; reduced: boolean }) {
  return <g transform="translate(294 58)">
    <path d="M -22 -32 V 38 Q -22 52 0 52 Q 22 52 22 38 V -32" fill={GLASS} stroke={INK} strokeWidth={2} />
    <path d="M -19 -2 V 38 Q -19 48 0 48 Q 19 48 19 38 V -2 Z" fill={colourless ? '#F5F8FA' : '#E7A254'} style={{ transition: reduced ? undefined : 'fill 800ms ease' }} />
    <path d="M -19 -2 Q 0 4 19 -2" fill="none" stroke={colourless ? EDGE : ORANGE_EDGE} strokeWidth={1.5} />
    <line x1={-27} y1={-32} x2={27} y2={-32} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
    <path d="M -15 -26 V 25" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
    <Text x={0} y={70} colour={ORANGE_EDGE}>bromine water</Text>
  </g>
}

function AdditionCard({ config, state, setState, locked, reduced }: Props & { config: Extract<OrganicConfig, { task: 'add' }> }) {
  const added = state.added === true
  const m = startingMolecule(config)
  if (added) {
    m.edges[0][2] = 1
    m.additions = config.reagent === 'steam' ? { 0: 'H', 1: 'OH' } : config.reagent === 'bromine' ? { 0: 'Br', 1: 'Br' } : { 0: 'H', 1: 'H' }
  }
  const points = carbonPoints(m.n)
  const product = moleculeDrawing(m, points)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [held, setHeld] = useState(false)
  const svg = useRef<HTMLDivElement>(null)
  const react = () => { if (!locked && !added) setState({ added: true }) }
  const target = { x: (points[0].x + points[1].x) / 2, y: 94 }
  const start = { x: 91, y: 157 }
  const reagentAt = drag ?? start
  const down = (e: PointerEvent) => {
    if (locked || added) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setHeld(true)
    const box = svg.current!.getBoundingClientRect()
    setDrag({ x: (e.clientX - box.left) / box.width * W, y: (e.clientY - box.top) / box.height * H })
  }
  const move = (e: PointerEvent) => {
    if (!drag && !held) return
    const box = svg.current!.getBoundingClientRect()
    const p = { x: (e.clientX - box.left) / box.width * W, y: (e.clientY - box.top) / box.height * H }
    if (Math.hypot(p.x - target.x, p.y - target.y) < 62) { setDrag(null); setHeld(false); react() } else setDrag(p)
  }
  const release = () => { setDrag(null); setHeld(false) }
  const label = added ? 'The second bond of C=C has opened. One part of the reagent is attached to each carbon.' : `An alkene with a carbon–carbon double bond. A ${config.reagent} molecule is below it${config.reagent === 'bromine' ? ', beside a tube of orange bromine water' : ''}.`
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <div ref={svg}>
        <Panel label={label}>
          <Text x={18} y={22} anchor="start">{added ? 'Addition product' : 'Alkene + reagent'}</Text>
          <Text x={target.x} y={34} colour={ACCENT}>{added ? 'one bond opened' : 'C=C double bond'}</Text>
          {config.reagent === 'bromine' && <Tube colourless={added} reduced={reduced} />}
          <Formula drawing={product} opened={added} />
          {!added && <ellipse cx={target.x} cy={96} rx={60} ry={40} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4 5" opacity={drag ? 1 : 0.45} />}
          {!added && <g data-reagent="true" role="button" tabIndex={0} aria-label={`Add ${config.reagent} to the double bond`} onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onClick={react} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); react() } }} className="cursor-grab touch-none outline-none"><rect x={35} y={126} width={115} height={62} rx={12} fill="transparent" /><ReagentDrawing kind={config.reagent} x={reagentAt.x} y={reagentAt.y} /><Text x={92} y={199} colour={ACCENT}>drag me onto C=C</Text></g>}
          {added && <Text x={180} y={211} colour={ACCENT}>new bonds to both carbons</Text>}
        </Panel>
      </div>
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">{added ? 'The atoms from the reagent are now in the product.' : 'Or tap the reagent to add it: no careful aim needed.'}</figcaption>
    </figure>
    {config.reagent === 'bromine' && <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-bold text-ss-slate">Bromine water</span><span className="text-[15px] font-extrabold text-ss-ink">{added ? 'colourless' : 'orange'}</span></div>}
    {!added && <button type="button" className={STEP} aria-label={`React ${config.reagent} with the alkene`} disabled={locked} onClick={react}>Add {config.reagent === 'bromine' ? 'Br₂' : config.reagent === 'hydrogen' ? 'H₂' : 'steam'}</button>}
  </div>
}

function PolymerCard({ config, state, setState, marked, locked }: Props & { config: Extract<OrganicConfig, { task: 'polymer' }> }) {
  const joined = Array.isArray(state.joined) ? state.joined.filter((j) => Number.isInteger(j) && j >= 0 && j < 3) : []
  const opened = new Set(joined)
  const all = joined.length === 3
  const mono = config.monomer
  const toggle = (i: number) => {
    if (locked) return
    if (!opened.has(i)) setState({ joined: [...joined, i] })
    else if (!all) setState({ joined: joined.filter((j) => j !== i) })
  }
  const parts = PC.map((cx, i) => {
    const local = mono === 'propene' ? [{ x: cx - 15, y: 105 }, { x: cx + 15, y: 105 }, { x: cx + 45, y: 105 }] : [{ x: cx - 17, y: 105 }, { x: cx + 17, y: 105 }]
    const m: Molecule = { n: mono === 'propene' ? 3 : 2, edges: mono === 'propene' ? [[0, 1, 2], [1, 2, 1]] : [[0, 1, 2]], groups: {} }
    const d = moleculeDrawing(m, local)
    if (mono === 'chloroethene' || mono === 'pvc' || mono === 'vinyl-chloride') {
      const h = d.atoms.find((a) => a.kind === 'H' && a.key.startsWith('g0-'))
      if (h) { h.label = 'Cl'; h.kind = 'Cl' }
    }
    return { d, i }
  })
  const atoms = parts.flatMap((p) => p.d.atoms.map((a) => ({ ...a, key: `${p.i}-${a.key}` })))
  const bonds = parts.flatMap((p) => p.d.bonds.map((b) => ({ ...b, a: `${p.i}-${b.a}`, b: `${p.i}-${b.b}` })))
  for (let i = 0; i < 2; i++) if (opened.has(i) && opened.has(i + 1)) bonds.push({ a: `${i}-c1`, b: `${i + 1}-c0`, order: 1 })
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <svg viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={`Three ${mono} monomers. ${joined.length} double bonds opened. ${all ? 'They form one continuous carbon chain.' : 'Some remain separate.'}`} className="block h-auto w-full select-none">
        <rect x={0.75} y={0.75} width={PW - 1.5} height={PH - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
        <Text x={18} y={22} anchor="start">{all ? 'One polymer chain' : 'Three monomers'}</Text>
        {parts.map(({ d, i }) => <g key={i}>
          <Formula drawing={{ atoms: d.atoms.map((a) => ({ ...a, key: `${i}-${a.key}` })), bonds: d.bonds.map((b) => ({ ...b, a: `${i}-${b.a}`, b: `${i}-${b.b}` })) }} opened={opened.has(i)} />
          <g role="button" tabIndex={0} aria-label={`${opened.has(i) ? 'Opened' : 'Open'} double bond in monomer ${i + 1}`} onClick={() => toggle(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(i) } }} className="cursor-pointer outline-none"><rect x={PC[i] - 43} y={78} width={86} height={59} fill="transparent" /><Text x={PC[i]} y={50} colour={opened.has(i) ? ACCENT : SOFT}>{opened.has(i) ? 'opened' : `monomer ${i + 1}`}</Text></g>
        </g>)}
        {[0, 1].map((i) => !opened.has(i) || !opened.has(i + 1) ? <g key={i} role="button" tabIndex={0} aria-label={`Join monomer ${i + 1} to monomer ${i + 2}`} onClick={() => { if (!opened.has(i)) toggle(i); if (!opened.has(i + 1)) toggle(i + 1) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!opened.has(i)) toggle(i); if (!opened.has(i + 1)) toggle(i + 1) } }} className="cursor-pointer outline-none"><line x1={PC[i] + 17} y1={105} x2={PC[i + 1] - 17} y2={105} stroke={ACCENT} strokeWidth={2} strokeDasharray="3 4" /><Text x={(PC[i] + PC[i + 1]) / 2} y={78} colour={ACCENT}>join</Text></g> : opened.has(i) && opened.has(i + 1) ? <line key={i} x1={PC[i] + 17} y1={105} x2={PC[i + 1] - 17} y2={105} stroke={BOND} strokeWidth={2} /> : null)}
        <Text x={180} y={218}>{all ? 'Every monomer is joined; no atoms were lost.' : 'Tap each C=C, then tap each join.'}</Text>
        {marked !== 'idle' && all && <g><path d="M 36 168 V 184 H 324 V 168" fill="none" stroke={ACCENT} strokeWidth={1.5} /><Text x={180} y={201} colour={ACCENT}>repeat unit, with bonds continuing</Text></g>}
      </svg>
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">Addition joins the whole monomer into one long chain.</figcaption>
    </figure>
    <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-bold text-ss-slate">Double bonds opened</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{joined.length} / 3</span></div>
    {!all && <button type="button" className={STEP} aria-label="Open all three double bonds and join the chain" disabled={locked} onClick={() => setState({ joined: [0, 1, 2] })}>Join all three</button>}
  </div>
}

export function OrganicChemistryView(props: Props) {
  const { config, state, marked } = props
  const current = marked === 'shown' || marked === 'right' ? (config.task === 'build' ? (() => { const t = targetMolecule(config); return { n: t.n, edges: t.edges, groups: t.groups } })() : config.task === 'add' ? { added: true } : { joined: [0, 1, 2] }) : state
  return <div className="flex flex-col gap-2">
    {config.task === 'build' ? <BuildCard {...props} config={config} state={current} /> : config.task === 'add' ? <AdditionCard {...props} config={config} state={current} /> : <PolymerCard {...props} config={config} state={current} />}
    {marked !== 'idle' && <div className="w-full max-w-[380px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite"><p className="text-[13px] font-extrabold leading-snug text-ss-ink">{marked === 'wrong' ? madeText(config, state) : working(config)}</p></div>}
  </div>
}
