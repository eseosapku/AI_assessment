'use client'
import type { SceneViewProps } from '../types'
import type { GateAt, GateKind, LGConfig, LGState, Wire } from './config'
import {
  CHOICES, cleanState, defOf, kindsOf, lampOf, layoutOf, logicGatesEngine, madeText, rowIndex, rowSwitches, rowsOf, slotsOf, wantedRow, wiresOf, working, yourRow,
} from './config'

type Props = SceneViewProps<LGConfig, LGState>

// A circuit on a quiet plate that keeps its colours in both themes, as network-sim's does. One accent: blue for a wire that
// carries a 1. The lamp is amber because a lit bulb is. No gradients, glows or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const HIGH = '#2563EB'
const HIGH_EDGE = '#1E3A8A'
const LOW = '#94A3B8'
const BASE = '#E2E8F0'
const BULB_ON = '#FBBF24'
const BULB_EDGE = '#B45309'
const BULB_OFF = '#EEF2F6'
const BULB_OFF_EDGE = '#64748B'

export const W = 360
export const H = 200
/** The real button over each switch. */
export const SWITCH_W = 66
export const SWITCH_H = 40
/** How long a change takes to cross one gate, so a flip is seen travelling. */
const STEP_MS = 220

const f1 = (n: number) => n.toFixed(1)

// The standard distinctive symbols, drawn from the input side (x = 0) with the centre line at y = 0.
const AND_BODY = 'M0 -22 H26 A22 22 0 0 1 26 22 H0 Z'
const OR_BODY = 'M0 -22 H10 C28 -22 42 -10 50 0 C42 10 28 22 10 22 H0 C9 10 9 -10 0 -22 Z'
const NOT_BODY = 'M0 -16 L36 0 L0 16 Z'
const XOR_BACK = 'M-6 -22 C3 -10 3 10 -6 22'

function GateSymbol({ kind }: { kind: GateKind }) {
  const body = kind === 'AND' || kind === 'NAND' ? AND_BODY : kind === 'NOT' ? NOT_BODY : OR_BODY
  const bubble = kind === 'NAND' ? 52 : kind === 'NOR' ? 54 : kind === 'NOT' ? 40 : null
  return (
    <g fill="#FFFFFF" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      <path d={body} />
      {kind === 'XOR' && <path d={XOR_BACK} fill="none" />}
      {bubble !== null && <circle cx={bubble} cy={0} r={4} />}
    </g>
  )
}

const wirePath = (w: Wire) => {
  const endX = w.b.x + 3
  return w.a.y === w.b.y ? `M${f1(w.a.x)} ${f1(w.a.y)} H${f1(endX)}` : `M${f1(w.a.x)} ${f1(w.a.y)} H${f1(w.mx)} V${f1(w.b.y)} H${f1(endX)}`
}

/** A wire: thick and blue with dots running along it when it carries a 1, thin and grey when it carries a 0. */
function WireLine({ wire, high, reduced }: { wire: Wire; high: boolean; reduced: boolean }) {
  const d = wirePath(wire)
  const delay = wire.fromDepth * STEP_MS
  const ease = reduced ? undefined : `stroke ${STEP_MS}ms ease ${delay}ms, stroke-width ${STEP_MS}ms ease ${delay}ms`
  return (
    <g data-wire={`${wire.from}>${wire.to}`} data-high={high ? '1' : '0'}>
      <path d={d} fill="none" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: high ? HIGH : LOW, strokeWidth: high ? 4.5 : 3, transition: ease }} />
      {high && <path d={d} fill="none" strokeLinecap="round" stroke="#FFFFFF" strokeWidth={1.6} strokeDasharray="1 11" className={reduced ? undefined : 'lg-flow'} />}
    </g>
  )
}

/** A lever switch: a hinge, a lever and a contact. Closed, the lever lies on the contact and the wire beyond it carries a 1. */
function LeverSwitch({ name, y, on, reduced }: { name: string; y: number; on: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : 'transform 200ms ease'
  return (
    <g data-switch={name} data-on={on ? '1' : '0'}>
      <rect x={12} y={y - 13} width={60} height={26} rx={5} fill={BASE} stroke={SOFT} strokeWidth={1.4} />
      <g style={{ transformOrigin: `26px ${y}px`, transform: `rotate(${on ? 0 : -34}deg)`, transition: ease }}>
        <line x1={26} y1={y} x2={61} y2={y} stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
        <circle cx={61} cy={y} r={3.2} fill={INK} />
      </g>
      <circle cx={26} cy={y} r={4} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
      <circle cx={64} cy={y} r={3.4} fill={on ? HIGH : '#FFFFFF'} stroke={on ? HIGH_EDGE : INK} strokeWidth={1.6} />
      <text x={42} y={y - 18} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} fontFamily={FONT}>{name}</text>
    </g>
  )
}

/** A lamp: a glass bulb with a filament and a screw base. Lit, it is amber and gives off rays. */
function Lamp({ x, y, lit, reduced }: { x: number; y: number; lit: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : 'fill 220ms ease'
  return (
    <g data-lamp={lit ? '1' : '0'} transform={`translate(${x} ${y})`}>
      {lit && (
        <g stroke={BULB_EDGE} strokeWidth={2} strokeLinecap="round">
          {[-160, -125, -90, -55, -20, 180, 0].map((a) => {
            const r = (a * Math.PI) / 180
            return <line key={a} x1={f1(Math.cos(r) * 21)} y1={f1(Math.sin(r) * 21)} x2={f1(Math.cos(r) * 27)} y2={f1(Math.sin(r) * 27)} />
          })}
        </g>
      )}
      <circle cx={0} cy={0} r={16} style={{ fill: lit ? BULB_ON : BULB_OFF, transition: ease }} stroke={lit ? BULB_EDGE : BULB_OFF_EDGE} strokeWidth={2} />
      <path d="M-6 9 V0 L-3 -5 L0 2 L3 -5 L6 0 V9" fill="none" stroke={lit ? BULB_EDGE : BULB_OFF_EDGE} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <rect x={-8} y={15} width={16} height={9} rx={2} fill={LOW} stroke={SOFT} strokeWidth={1.4} />
    </g>
  )
}

function GateMark({ gate, kind, label }: { gate: GateAt; kind: GateKind; label: string }) {
  return (
    <g data-gate={gate.id} data-kind={kind}>
      <g transform={`translate(${f1(gate.left)} ${f1(gate.cy)})`}><GateSymbol kind={kind} /></g>
      {label && <text x={f1(gate.cx)} y={f1(gate.cy + 36)} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>{label}</text>}
    </g>
  )
}

function describe(config: LGConfig, sw: boolean[], lit: boolean): string {
  const def = defOf(config)
  const n = def.gates.length
  const sws = def.inputs.map((name, i) => `${name} is ${sw[i] ? 'on' : 'off'}`).join(', ')
  return `A circuit of ${def.inputs.length === 1 ? 'one switch' : `${def.inputs.length} switches`} feeding ${n === 1 ? 'one logic gate' : `${n} logic gates`} and a lamp. ${sws}. The lamp is ${lit ? 'lit' : 'off'}.`
}

const stepBtn = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export function LogicGatesView({ config, state, setState, marked, reduced, locked }: Props) {
  const finished = marked === 'right' || marked === 'shown'
  const now = cleanState(config, marked === 'shown' ? logicGatesEngine.solve(config) : state)
  const def = defOf(config)
  const layout = layoutOf(config)
  const kinds = kindsOf(config, now.picks)
  const wires = wiresOf(config, now.sw, now.picks)
  const lit = lampOf(config, now.sw, now.picks)
  const slots = slotsOf(def)
  const build = config.task === 'build'
  const frozen = locked || finished
  const here = rowIndex(now.sw)
  const total = rowsOf(def)
  const want = wantedRow(config)
  const yours = yourRow(config, now.picks)
  const lampRow = build ? yours : wantedRow({ task: 'build', circuit: config.circuit })
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)

  const flip = (i: number) => {
    if (frozen) return
    const sw = now.sw.map((b, k) => (k === i ? !b : b))
    const row = rowIndex(sw)
    setState({ ...now, sw, seen: [...new Set([...now.seen, row])].sort((a, b) => a - b) })
  }
  const step = (slot: number, by: number) => {
    if (frozen) return
    const picks = now.picks.map((p, k) => (k === slot ? (p + by + CHOICES.length) % CHOICES.length : p))
    setState({ ...now, picks })
  }
  // The light task's gates are all named under the symbol. On build only the several changeable gates carry a number.
  const labelOf = (gate: GateAt) => {
    if (!build) return gate.kind
    if (gate.kind === 'NOT') return 'NOT'
    return slots.length > 1 ? `Gate ${gate.slot + 1}` : ''
  }
  const rowsShown = (r: number) => finished || now.seen.includes(r)
  const cols = Array.from({ length: total }, (_, r) => r)
  const cell = (r: number) => `h-6 w-7 text-center align-middle ${r === here ? 'bg-ss-chip' : ''}`
  const digit = (v: boolean) => <span className={`text-[13px] font-extrabold ${v ? 'text-[#1D4ED8]' : 'text-ss-slate'}`}>{v ? 1 : 0}</span>

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, now.sw, lit)} className="block h-auto w-full select-none">
            {!reduced && <style>{'@keyframes lg-flow{to{stroke-dashoffset:-12}}.lg-flow{animation:lg-flow 1.1s linear infinite}'}</style>}
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {layout.wires.map((w) => (
              <WireLine key={`${w.from}>${w.to}`} wire={w} high={Boolean(wires[w.from])} reduced={reduced} />
            ))}
            {layout.inputs.map((i, k) => <LeverSwitch key={i.name} name={i.name} y={i.y} on={now.sw[k]} reduced={reduced} />)}
            {layout.gates.map((gt) => <GateMark key={gt.id} gate={gt} kind={kinds[gt.id]} label={labelOf(gt)} />)}
            <Lamp x={layout.lamp.x} y={layout.lamp.y} lit={lit} reduced={reduced} />
            <text x={layout.lamp.x} y={layout.lamp.y + 42} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>Lamp</text>
          </svg>
          {layout.inputs.map((i, k) => (
            <button
              key={i.name}
              type="button"
              aria-label={`Switch ${i.name} is ${now.sw[k] ? 'on' : 'off'}. Press to turn it ${now.sw[k] ? 'off' : 'on'}.`}
              disabled={frozen}
              onClick={() => flip(k)}
              className="nodrag absolute touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
              style={{ left: `${(42 / W) * 100}%`, top: `${(i.y / H) * 100}%`, width: `${(SWITCH_W / W) * 100}%`, height: `${(SWITCH_H / H) * 100}%`, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: frozen ? 'default' : 'pointer' }}
            />
          ))}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0"><line x1={0} x2={18} y1={4} y2={4} stroke={HIGH} strokeWidth={4.5} strokeLinecap="round" /></svg>
            Wire carrying 1
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0"><line x1={0} x2={18} y1={4} y2={4} stroke={LOW} strokeWidth={3} strokeLinecap="round" /></svg>
            Wire carrying 0
          </span>
        </figcaption>
      </figure>

      {build && (
        <div className="flex flex-col gap-1.5">
          {slots.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-1.5">
              <span className="text-[12px] font-bold text-ss-slate">{slots.length > 1 ? `Gate ${i + 1}` : 'Gate'}</span>
              <span className="flex items-center gap-1">
                <button type="button" aria-label={`Previous kind of gate${slots.length > 1 ? ` for gate ${i + 1}` : ''}`} className={stepBtn} disabled={frozen} onClick={() => step(i, -1)}>‹</button>
                <span className="min-w-[56px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{kinds[s.id]}</span>
                <button type="button" aria-label={`Next kind of gate${slots.length > 1 ? ` for gate ${i + 1}` : ''}`} className={stepBtn} disabled={frozen} onClick={() => step(i, 1)}>›</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <table className="w-full border-collapse" aria-label="Truth table of the settings tried">
        <tbody>
          {def.inputs.map((name, k) => (
            <tr key={name}>
              <th scope="row" className="h-6 pr-2 text-left text-[12px] font-bold text-ss-slate">{name}</th>
              {cols.map((r) => <td key={r} className={cell(r)}><span className="text-[13px] font-semibold tabular-nums text-ss-ink">{rowSwitches(def.inputs.length, r)[k] ? 1 : 0}</span></td>)}
            </tr>
          ))}
          {build && (
            <tr className="border-t border-ss-line">
              <th scope="row" className="h-6 pr-2 text-left text-[12px] font-bold text-ss-slate">Wanted</th>
              {cols.map((r) => <td key={r} className={cell(r)}>{digit(want[r])}</td>)}
            </tr>
          )}
          <tr className={build ? '' : 'border-t border-ss-line'}>
            <th scope="row" className="h-6 pr-2 text-left text-[12px] font-bold text-ss-slate">{build ? 'Yours' : 'Lamp'}</th>
            {cols.map((r) => <td key={r} className={cell(r)}>{rowsShown(r) ? digit(lampRow[r]) : <span className="text-[13px] font-semibold text-ss-line">·</span>}</td>)}
          </tr>
        </tbody>
      </table>

      <span className="sr-only" aria-live="polite">{`${def.inputs.map((name, i) => `${name} ${now.sw[i] ? 'on' : 'off'}`).join(', ')}. The lamp is ${lit ? 'lit' : 'off'}.`}</span>
      {marked !== 'idle' && said && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
