'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { Board, Cable, Chip, NetConfig, NetNode, NetState, Pt, Sim, Tag } from './config'
import {
  boardOf, chipAt, madeCables, madeText, midOf, networkSimEngine, nodeBoxOf, nodeOf, onlyWays, reaches, rewire, routeCables, routesOf, stepSim, stillSim, upCables, working,
} from './config'

type Props = SceneViewProps<NetConfig, NetState>

// A network is not a dark subject: a quiet plate, as measure-shape's and bonding's are, with real machines on it.
// The plate keeps its own colours in both themes, so each part keeps its contrast against it. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// Patch cable: a coloured sheath with a darker edge, and bare copper where it has been cut.
const SHEATH = {
  lit: { edge: '#1E3A8A', core: '#3B82F6' },
  weak: { edge: '#991B1B', core: '#F87171' },
  idle: { edge: '#64748B', core: '#CBD5E1' },
  cut: { edge: '#94A3B8', core: '#E2E8F0' },
}
const COPPER = '#B45309'
const OFFER = '#94A3B8'
const PLUG = '#E2E8F0'
// Machines: dark casings, a screen, green lights when traffic is passing.
const CASE = '#334155'
const CASE_OFF = '#94A3B8'
const SCREEN_ON = '#BFDBFE'
const SCREEN_IDLE = '#E2E8F0'
const SCREEN_DARK = '#1E293B'
const TEXT_ON = '#1D4ED8'
const TEXT_IDLE = '#94A3B8'
const LED_ON = '#22C55E'
const LED_OFF = '#64748B'
const PORT = '#0F172A'
// A packet is a small parcel: its number on a darker band, then the one letter it carries.
const PARCEL = '#F6C453'
const PARCEL_BAND = '#E3A21A'
const PARCEL_EDGE = '#7A4E08'

export const W = 360
export const H = 236
const CHIP_W = 34
const CHIP_H = 24
const CUT_GAP = 30
/** The real button over each cable's clip. */
export const DISC_HIT = 34

const f1 = (n: number) => n.toFixed(1)
const toDeg = (r: number) => (r * 180) / Math.PI

export const slotWidth = (n: number) => (n <= 6 ? 38 : 32)

type Look = 'lit' | 'weak' | 'idle' | 'cut' | 'offer'

/** Where a cable meets a machine's casing, along the line towards `to`. */
function edgePoint(node: NetNode, to: Pt): Pt {
  const dx = to.x - node.x
  const dy = to.y - node.y
  const box = nodeBoxOf(node.kind)
  const long = Math.hypot(dx, dy) || 1
  const reach = Math.min(dx === 0 ? Infinity : box.w / Math.abs(dx), dy === 0 ? Infinity : (dy < 0 ? box.up : box.down) / Math.abs(dy))
  const out = 4 / long
  return { x: node.x + dx * (reach + out), y: node.y + dy * (reach + out) }
}

/** A patch cable, plugged in at both ends. Cut, it parts in the middle with the copper showing. */
function CableLine({ board, cable, look, reduced }: { board: Board; cable: Cable; look: Look; reduced: boolean }) {
  const a = nodeOf(board, cable.a)
  const b = nodeOf(board, cable.b)
  const long = Math.hypot(a.x - b.x, a.y - b.y) || 1
  const angle = toDeg(Math.atan2(b.y - a.y, b.x - a.x))
  const mid = midOf(board, cable)
  if (look === 'offer') {
    const dash = `${f1((4 / long) * 100)} ${f1((6 / long) * 100)}`
    return <line pathLength={100} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-cable={cable.id} data-look={look} stroke={OFFER} strokeWidth={2} strokeDasharray={dash} />
  }
  const gapPx = look === 'cut' ? Math.min(CUT_GAP, long * 0.5) : 0
  const gap = (gapPx / long) * 100
  const dash = `${f1((100 - gap) / 2)} ${f1(gap)} ${f1((100 - gap) / 2)}`
  const ease = reduced ? undefined : { transition: 'stroke 700ms ease, stroke-dasharray 500ms ease-out' }
  const colours = SHEATH[look]
  const pa = edgePoint(a, b)
  const pb = edgePoint(b, a)
  return (
    <g>
      <line pathLength={100} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={6} data-cable={cable.id} data-look={look} style={{ stroke: colours.edge, strokeDasharray: dash, ...ease }} />
      <line pathLength={100} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={3.4} style={{ stroke: colours.core, strokeDasharray: dash, ...ease }} />
      {/* The plugs, where the cable meets each machine. */}
      {a.kind !== 'joint' && <rect x={-4.5} y={-4} width={9} height={8} rx={1.5} fill={PLUG} stroke={SOFT} strokeWidth={1.2} transform={`translate(${f1(pa.x)} ${f1(pa.y)}) rotate(${f1(angle)})`} />}
      {b.kind !== 'joint' && <rect x={-4.5} y={-4} width={9} height={8} rx={1.5} fill={PLUG} stroke={SOFT} strokeWidth={1.2} transform={`translate(${f1(pb.x)} ${f1(pb.y)}) rotate(${f1(angle)})`} />}
      {look === 'cut' && (
        <g transform={`translate(${f1(mid.x)} ${f1(mid.y)}) rotate(${f1(angle)})`} stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" data-frayed="1">
          {[-1, 1].map((side) => (
            <g key={side} transform={`scale(${side} 1)`}>
              <line x1={gapPx / 2} y1={-1.6} x2={gapPx / 2 - 6} y2={-4.2} />
              <line x1={gapPx / 2} y1={0} x2={gapPx / 2 - 7} y2={0} />
              <line x1={gapPx / 2} y1={1.6} x2={gapPx / 2 - 6} y2={4.2} />
            </g>
          ))}
        </g>
      )}
      {/* The way a one-way cable runs: a small arrowhead just past its clip, gone once it is cut. */}
      {cable.oneWay && look !== 'cut' && (
        <path
          d="M -4 -5.5 L 4 0 L -4 5.5" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          transform={`translate(${f1(mid.x + ((b.x - a.x) / long) * 18)} ${f1(mid.y + ((b.y - a.y) / long) * 18)}) rotate(${f1(angle)})`}
        />
      )}
    </g>
  )
}

/** A desktop computer: casing, screen, neck and foot. A lit screen shows lines of text; a dead one is dark. */
function Computer({ node, screen, dead, reduced }: { node: NetNode; screen: 'on' | 'idle' | 'dark'; dead: boolean; reduced: boolean }) {
  const glass = screen === 'on' ? SCREEN_ON : screen === 'idle' ? SCREEN_IDLE : SCREEN_DARK
  const lines = screen === 'on' ? TEXT_ON : TEXT_IDLE
  const casing = dead ? CASE_OFF : CASE
  const ease = reduced ? undefined : { transition: 'fill 700ms ease' }
  return (
    <g transform={`translate(${node.x} ${node.y})`} data-node={node.id} data-on={screen === 'on' ? '1' : '0'}>
      <rect x={-5} y={10} width={10} height={6} style={{ fill: casing, ...ease }} />
      <rect x={-13} y={15} width={26} height={4} rx={2} style={{ fill: casing, ...ease }} />
      <rect x={-21} y={-17} width={42} height={29} rx={3.5} style={{ fill: casing, ...ease }} />
      <rect x={-18} y={-14} width={36} height={22} rx={1.5} style={{ fill: glass, ...ease }} />
      {screen !== 'dark' && (
        <g stroke={lines} strokeWidth={1.8} strokeLinecap="round">
          <line x1={-13} y1={-9} x2={9} y2={-9} />
          <line x1={-13} y1={-4} x2={13} y2={-4} />
          <line x1={-13} y1={1} x2={3} y2={1} />
        </g>
      )}
    </g>
  )
}

/** A router: a low box with two aerials and a row of lights, which come on while it is passing traffic. */
function Router({ node, busy, dead, reduced }: { node: NetNode; busy: boolean; dead: boolean; reduced: boolean }) {
  const casing = dead ? CASE_OFF : CASE
  const ease = reduced ? undefined : { transition: 'fill 700ms ease' }
  return (
    <g transform={`translate(${node.x} ${node.y})`} data-node={node.id} data-busy={busy ? '1' : '0'}>
      <g stroke={casing} strokeWidth={2.4} strokeLinecap="round">
        <line x1={-12} y1={-8} x2={-15} y2={-19} />
        <line x1={12} y1={-8} x2={15} y2={-19} />
      </g>
      <rect x={-19} y={-9} width={38} height={18} rx={4} style={{ fill: casing, ...ease }} />
      {[-10, -3.3, 3.3, 10].map((x) => <circle key={x} cx={x} cy={0} r={2.1} style={{ fill: busy ? LED_ON : LED_OFF, ...ease }} />)}
    </g>
  )
}

/** A network switch: a wide box with a row of ports, each with its light. */
function Switch({ node, busy, reduced }: { node: NetNode; busy: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'fill 700ms ease' }
  return (
    <g transform={`translate(${node.x} ${node.y})`} data-node={node.id} data-busy={busy ? '1' : '0'}>
      <rect x={-26} y={-11} width={52} height={22} rx={3.5} fill={CASE} />
      {[-18, -9, 0, 9, 18].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={-2} width={6} height={7} rx={0.8} fill={PORT} />
          <circle cx={x} cy={-6.2} r={1.6} style={{ fill: busy ? LED_ON : LED_OFF, ...ease }} />
        </g>
      ))}
    </g>
  )
}

function NodeMark({ node, busy, on, dead, end, reduced }: { node: NetNode; busy: boolean; on: boolean; dead: boolean; end?: -1 | 1; reduced: boolean }) {
  if (node.kind === 'joint') {
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        {end && <rect x={end * 11 - 4} y={-6.5} width={8} height={13} rx={2} fill={SOFT} data-terminator="1" />}
        <rect x={-6} y={-6} width={12} height={12} rx={2} fill={PLUG} stroke={SOFT} strokeWidth={1.4} />
      </g>
    )
  }
  if (node.kind === 'router') return <Router node={node} busy={busy} dead={dead} reduced={reduced} />
  if (node.kind === 'switch') return <Switch node={node} busy={busy} reduced={reduced} />
  return <Computer node={node} reduced={reduced} dead={dead} screen={on ? 'on' : dead || node.kind === 'receiver' ? 'dark' : 'idle'} />
}

/** A packet: a parcel with its number on a band, and the letter it carries. */
function ChipMark({ board, chip, word, reduced }: { board: Board; chip: Chip; word: string; reduced: boolean }) {
  const p = chipAt(board, chip)
  const falling = chip.fell >= 0
  const drop = falling && !reduced ? chip.fell * 30 : 0
  const opacity = falling ? Math.max(0, 1 - chip.fell / 0.6) : 1
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y + drop)})`} opacity={opacity} data-chip={chip.k} fontFamily={FONT}>
      <rect x={-CHIP_W / 2} y={-CHIP_H / 2} width={CHIP_W} height={CHIP_H} rx={3} fill={PARCEL} stroke={PARCEL_EDGE} strokeWidth={1.5} />
      <path d={`M ${-CHIP_W / 2 + 0.75} ${-CHIP_H / 2 + 3} a 2.25 2.25 0 0 1 2.25 -2.25 H -3.5 V ${CHIP_H / 2 - 0.75} H ${-CHIP_W / 2 + 3} a 2.25 2.25 0 0 1 -2.25 -2.25 Z`} fill={PARCEL_BAND} />
      <line x1={-3.5} x2={-3.5} y1={-CHIP_H / 2} y2={CHIP_H / 2} stroke={PARCEL_EDGE} strokeWidth={1} />
      <text x={-10} y={0.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={INK}>{chip.k + 1}</text>
      <text x={6.5} y={0.5} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill={INK}>{[...word][chip.k]}</text>
    </g>
  )
}

function Names({ tags }: { tags: Tag[] }) {
  return (
    <g aria-hidden="true" fontFamily={FONT}>
      {tags.map((t) => (
        <text key={t.text} x={f1(t.x)} y={f1(t.y)} textAnchor={t.anchor} fontSize={13} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{t.text}</text>
      ))}
    </g>
  )
}

/** The handle on the cable: a small clip that sits on the sheath, under the parcels. A cross takes the cable away, a plus puts it there. */
function Clip({ at, adds }: { at: Pt; adds: boolean }) {
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)})`} aria-hidden="true" data-clip={adds ? 'plus' : 'cross'}>
      <rect x={-8} y={-8} width={16} height={16} rx={4} fill="#FFFFFF" stroke={SOFT} strokeWidth={1.4} />
      <path d={adds ? 'M -4 0 H 4 M 0 -4 V 4' : 'M -3 -3 L 3 3 M 3 -3 L -3 3'} fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
    </g>
  )
}

/** The real control over each clip: see-through, and bigger than the clip, so a finger cannot miss. */
function CableButton({ at, label, disabled, onPress }: { at: Pt; label: string; disabled: boolean; onPress(): void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className="nodrag absolute touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
      style={{ left: `${(at.x / W) * 100}%`, top: `${(at.y / H) * 100}%`, width: DISC_HIT, height: DISC_HIT, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: disabled ? 'default' : 'pointer' }}
    />
  )
}

const ask = (board: Board, c: Cable, config: NetConfig, there: boolean) => {
  const a = nodeOf(board, c.a).name
  const b = nodeOf(board, c.b).name
  if (config.task === 'cut') return `${there ? 'Cut' : 'Mend'} the cable between ${a} and ${b}`
  return `${there ? 'Take up' : 'Lay'} the cable between ${a} and ${b}`
}

function useSim(board: Board, up: Set<string>, word: string, reduced: boolean): Sim {
  const n = [...word].length
  const key = useMemo(() => [...up].sort().join(','), [up])
  const still = useMemo(() => stillSim(board, up, n), [board, up, n])
  const [sim, setSim] = useState(still)
  const live = useRef(still)
  const seen = useRef(key)
  const links = useRef(up)
  links.current = up
  useEffect(() => {
    if (reduced) return
    if (seen.current !== key) {
      seen.current = key
      live.current = rewire(board, up, live.current)
    }
  }, [key, reduced, board, up])
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      live.current = stepSim(board, links.current, live.current, dt)
      setSim(live.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [board, reduced])
  return reduced ? still : sim
}

function describe(board: Board, config: NetConfig, through: boolean, routes: number): string {
  const what = config.task === 'cut'
    ? `A network of ${board.cables.length} cables joins a sender to a receiver.`
    : 'A sender and a receiver are joined by one line of cables, with dotted lines where more could be laid.'
  const going = through ? `Numbered packets carrying ${config.message} are reaching the receiver, along ${routes === 1 ? 'one route' : `${routes} routes`}.` : 'Nothing is reaching the receiver.'
  return `${what} ${going}`
}

/** A short length of the cable or parcel, beside its name under the picture. */
function Swatch({ kind }: { kind: 'lit' | 'weak' | 'idle' | 'offer' | 'packet' }) {
  if (kind === 'packet') {
    return (
      <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0" aria-hidden="true">
        <rect x={0.75} y={0.75} width={14.5} height={10.5} rx={2} fill={PARCEL} stroke={PARCEL_EDGE} strokeWidth={1.2} />
        <line x1={6} x2={6} y1={1} y2={11} stroke={PARCEL_EDGE} strokeWidth={1} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0" aria-hidden="true">
      {kind === 'offer' ? (
        <line x1={0} x2={18} y1={4} y2={4} stroke={OFFER} strokeWidth={2} strokeDasharray="4 3" />
      ) : (
        <>
          <line x1={0} x2={18} y1={4} y2={4} stroke={SHEATH[kind].edge} strokeWidth={6} />
          <line x1={0} x2={18} y1={4} y2={4} stroke={SHEATH[kind].core} strokeWidth={3.4} />
        </>
      )}
    </svg>
  )
}

const Named = ({ kind, children }: { kind: 'lit' | 'weak' | 'idle' | 'offer' | 'packet'; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

/** The word as it stands at the receiver: a place for each packet, filled when that one lands. */
function Slots({ word, arrived, reduced }: { word: string; arrived: boolean[]; reduced: boolean }) {
  const letters = [...word]
  const width = slotWidth(letters.length)
  return (
    <span className="flex items-center gap-[3px]">
      {letters.map((l, k) => {
        const got = arrived[k]
        return (
          <span
            key={k} data-slot={k} data-got={got ? '1' : '0'}
            className={`flex h-7 items-center justify-center gap-[3px] rounded-md border-2 tabular-nums ${got ? '' : 'border-ss-line bg-ss-panel text-ss-slate'} ${reduced ? '' : 'transition-colors duration-300'}`}
            style={got ? { width, background: PARCEL, borderColor: PARCEL_EDGE, color: INK } : { width }}
          >
            <span className="text-[12px] font-bold">{k + 1}</span>
            <span className={`text-[15px] ${got ? 'font-extrabold' : 'font-semibold'}`}>{l}</span>
          </span>
        )
      })}
    </span>
  )
}

export function NetworkSimView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? networkSimEngine.solve(config) : state
  const board = boardOf(config)
  const made = madeCables(config, now)
  const madeKey = made.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the set changes only when the learner's cables do
  const up = useMemo(() => upCables(config, now), [config, madeKey])
  const word = config.message
  const sim = useSim(board, up, word, reduced)
  const routes = routesOf(board, up)
  const lit = useMemo(() => routeCables(board, routes), [board, routes])
  const busy = useMemo(() => new Set(routes.flat()), [routes])
  const through = routes.length > 0
  const weak = useMemo(() => (config.task === 'lay' ? onlyWays(board, up) : []), [config.task, board, up])
  // Dimmed when it is joined to neither end, as a computer is when its own cable is cut.
  const hanging = useMemo(() => new Set(board.nodes.filter((n) => !reaches(board, up, 'S', n.id) && !reaches(board, up, n.id, 'T')).map((n) => n.id)), [board, up])
  const finished = marked === 'right' || marked === 'shown'
  const showHandles = !locked && !finished

  const toggle = (id: string) => {
    if (locked) return
    const next = made.includes(id) ? made.filter((x) => x !== id) : [...made, id]
    setState(config.task === 'cut' ? { cuts: next } : { laid: next })
  }
  const lookOf = (c: Cable): Look => {
    if (config.task === 'cut' && made.includes(c.id)) return 'cut'
    if (config.task === 'lay' && !up.has(c.id)) return 'offer'
    if (weak.includes(c.id)) return 'weak'
    return lit.has(c.id) ? 'lit' : 'idle'
  }
  /** The cable is in place, so its clip takes it away. */
  const thereNow = (c: Cable) => up.has(c.id)
  // Across the card from left to right, so the tab order says nothing about which cables matter.
  const handles = board.cables.filter((c) => !c.fixed).slice().sort((a, b) => midOf(board, a).x - midOf(board, b).x || midOf(board, a).y - midOf(board, b).y)
  const endOf = (n: NetNode): -1 | 1 | undefined => (config.task === 'cut' && config.network === 'bus' ? (n.id === 'J1' ? -1 : n.id === 'J4' ? 1 : undefined) : undefined)
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.ns-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(board, config, through, routes.length)} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {board.cables.map((c) => <CableLine key={c.id} board={board} cable={c} look={lookOf(c)} reduced={reduced} />)}
            {showHandles && handles.map((c) => <Clip key={c.id} at={midOf(board, c)} adds={!thereNow(c)} />)}
            {/* The parcels go under the machines, so each one visibly passes through a router and into the receiver. */}
            {sim.chips.map((c) => <ChipMark key={`${c.k}-${c.path.join('')}-${c.fell >= 0 ? 'f' : 'a'}`} board={board} chip={c} word={word} reduced={reduced} />)}
            {board.nodes.map((n) => (
              <NodeMark
                key={n.id} node={n} reduced={reduced} end={endOf(n)} busy={busy.has(n.id)} dead={hanging.has(n.id)}
                on={n.kind === 'sender' ? true : n.kind === 'receiver' ? through : false}
              />
            ))}
            <Names tags={board.tags} />
          </svg>
          {showHandles && handles.map((c) => (
            <CableButton key={c.id} at={midOf(board, c)} label={ask(board, c, config, thereNow(c))} disabled={locked} onPress={() => toggle(c.id)} />
          ))}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {weak.length > 0 && <Named kind="weak">Only way</Named>}
          <Named kind="lit">{config.task === 'cut' ? 'Route in use' : 'Route'}</Named>
          {config.task === 'cut' ? <Named kind="idle">Not in use</Named> : <Named kind="offer">Could lay</Named>}
          <Named kind="packet">Packet</Named>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Arrived</span>
          <Slots word={word} arrived={sim.arrived} reduced={reduced} />
        </div>
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Routes in use</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-routes={routes.length}>{through ? routes.length : 'None'}</span>
          </p>
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">{config.task === 'cut' ? 'Cables cut' : 'Cables laid'}</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{made.length}</span>
          </p>
        </div>
      </div>

      <p className="ns-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between cables. Enter changes the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{through ? `${word} is reaching the receiver along ${routes.length === 1 ? 'one route' : `${routes.length} routes`}.` : 'Nothing is reaching the receiver.'}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
