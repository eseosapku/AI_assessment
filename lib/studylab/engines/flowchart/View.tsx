'use client'
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { FcConfig, FcState, FlowChart, FlowInput, Machine, Pt, Route } from './config'
import {
  atOf, bezAt, capOf, chartFor, edgeLabelAt, edgePoints, flowchartEngine, inputValues, isMachine, machineEdgeGeometry, machineEdgeText, madeText, nodeOf, outline,
  pressesOf, routeOf, runChart, stateOf, statesVisited, textOfEnd, valueText, working,
} from './config'

type Props = SceneViewProps<FcConfig, FcState>

// A chart is not a dark subject: a quiet plate, as network-sim's and measure-shape's are, with real flowchart shapes on it.
// The plate keeps its own colours in both themes, so each part keeps its contrast against it. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const LINE = '#94A3B8'
const FONT = 'system-ui, sans-serif'
const NODE = '#FFFFFF'
// The one accent: the path the token has taken, and the shape it stands in.
const ACCENT = '#2563EB'
const ACCENT_SOFT = '#DBEAFE'
const ACCENT_DEEP = '#1E3A8A'
// The token is a small yellow counter, as network-sim's packets are.
const TOKEN = '#F6C453'
const TOKEN_EDGE = '#7A4E08'

export const W = 360
/** How fast the token walks, in plate units a second. The test checks it agrees with the config's timing. */
export const SPEED = 200
const f1 = (n: number) => n.toFixed(1)
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

// ---------------------------------------------------------------------------
// The token's walk in time.

export function durationOf(route: Route): number {
  let d = 0
  for (const s of route.segs) d += s.len / SPEED + s.pause
  return d
}

/** How far along its route the token is after `t` seconds, pausing a moment as it reaches each diamond. */
export function lengthAt(route: Route, t: number): number {
  let time = 0
  let L = 0
  for (const s of route.segs) {
    const d = s.len / SPEED
    if (t < time + d) return L + (t - time) * SPEED
    time += d
    L += s.len
    if (s.pause) {
      if (t < time + s.pause) return L
      time += s.pause
    }
  }
  return L
}

export function pointAt(route: Route, L: number, start: Pt): Pt {
  let acc = 0
  for (const s of route.segs) {
    if (L <= acc + s.len) return lerp(s.a, s.b, s.len ? (L - acc) / s.len : 0)
    acc += s.len
  }
  const last = route.segs[route.segs.length - 1]
  return last ? last.b : start
}

function trailPath(route: Route, L: number): string {
  let d = ''
  let acc = 0
  for (const s of route.segs) {
    if (acc >= L) break
    const e = lerp(s.a, s.b, Math.min(1, (L - acc) / s.len))
    if (!d) d = `M ${f1(s.a.x)} ${f1(s.a.y)}`
    d += ` L ${f1(e.x)} ${f1(e.y)}`
    acc += s.len
  }
  return d
}

/** Seconds since the key last changed, up to `duration`: the token's clock. Still under reduced motion. */
function useElapsed(key: string, duration: number, reduced: boolean): number {
  const [clock, setClock] = useState<{ key: string; t: number }>({ key, t: 0 })
  useEffect(() => {
    if (reduced || duration <= 0) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(duration, (now - t0) / 1000)
      setClock({ key, t })
      if (t < duration) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, duration, reduced])
  if (reduced || duration <= 0) return duration
  return clock.key === key ? clock.t : 0
}

// ---------------------------------------------------------------------------
// Drawing.

function Arrow({ at, from, fill }: { at: Pt; from: Pt; fill: string }) {
  const angle = (Math.atan2(at.y - from.y, at.x - from.x) * 180) / Math.PI
  return <polygon points="0,0 -7,-3.6 -7,3.6" transform={`translate(${f1(at.x)} ${f1(at.y)}) rotate(${f1(angle)})`} fill={fill} />
}

function ShapeText({ x, y, children, fill }: { x: number; y: number; children: string; fill: string }) {
  return <text x={f1(x)} y={f1(y + 0.5)} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={fill} fontFamily={FONT}>{children}</text>
}

function Shape({ chart, id, visited, reached }: { chart: FlowChart; id: string; visited: boolean; reached: boolean }) {
  const n = nodeOf(chart, id)
  const fill = reached ? ACCENT : visited ? ACCENT_SOFT : NODE
  const stroke = reached ? ACCENT_DEEP : visited ? ACCENT : SOFT
  const strokeWidth = visited ? 2 : 1.6
  const text = reached ? '#FFFFFF' : INK
  return (
    <g data-node={id} data-visited={visited ? '1' : '0'}>
      {n.kind === 'start' || n.kind === 'out' ? (
        <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={n.h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <polygon points={outline(n).map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      )}
      <ShapeText x={n.kind === 'input' ? n.x : n.x} y={n.y} fill={text}>{n.text}</ShapeText>
    </g>
  )
}

function TokenMark({ at }: { at: Pt }) {
  return <circle cx={f1(at.x)} cy={f1(at.y)} r={7} fill={TOKEN} stroke={TOKEN_EDGE} strokeWidth={1.6} data-token="1" />
}

function Swatch({ kind }: { kind: 'token' | 'path' | 'state' }) {
  if (kind === 'token') {
    return (
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <circle cx={7} cy={7} r={5.2} fill={TOKEN} stroke={TOKEN_EDGE} strokeWidth={1.4} />
      </svg>
    )
  }
  if (kind === 'state') {
    return (
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <circle cx={7} cy={7} r={5.6} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={1.6} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0" aria-hidden="true">
      <line x1={0} x2={18} y1={4} y2={4} stroke={ACCENT} strokeWidth={3.4} strokeLinecap="round" />
    </svg>
  )
}

const Named = ({ kind, children }: { kind: 'token' | 'path' | 'state'; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

// ---------------------------------------------------------------------------
// Controls, in aligned atom-style rows.

const button =
  'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function InputRow({ input, index, onChange, locked }: { input: FlowInput; index: number; onChange(next: number): void; locked: boolean }) {
  const id = useId()
  const values = inputValues(input)
  const max = values.length - 1
  if (input.kind === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-1.5">
        <span id={id} className="text-[12px] font-bold text-ss-slate">{input.label}</span>
        <span role="group" aria-labelledby={id} className="flex items-center gap-1">
          {['No', 'Yes'].map((word, k) => (
            <button
              key={word} type="button" aria-pressed={index === k} aria-label={`${input.label}: ${word}`} disabled={locked} onClick={() => onChange(k)}
              className={`nodrag h-7 min-w-[48px] touch-manipulation select-none whitespace-nowrap rounded-lg border-2 px-2.5 text-[13px] font-extrabold transition-colors disabled:cursor-not-allowed motion-reduce:transition-none ${index === k ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]'}`}
            >{word}</button>
          ))}
        </span>
      </div>
    )
  }
  const bump = (by: number) => onChange(Math.max(0, Math.min(max, index + by)))
  const slider = values.length > 6
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they change the value.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') onChange(0)
    else if (e.key === 'End') onChange(max)
    else bump(by)
  }
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="shrink-0 text-[12px] font-bold text-ss-slate">{input.label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <button type="button" tabIndex={-1} aria-label={`Lower ${input.label.toLowerCase()}`} className={button} disabled={locked || index <= 0} onClick={() => bump(-1)}>−</button>
        {slider && (
          <input
            type="range" min={0} max={max} step={1} value={index} disabled={locked} aria-labelledby={id} aria-valuetext={valueText(input, index)}
            onChange={(e) => onChange(Number(e.target.value))} onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}
            className="nodrag h-5 min-w-0 flex-1 cursor-pointer touch-none accent-[color:var(--subject)] disabled:cursor-not-allowed"
          />
        )}
        <span
          role={slider ? undefined : 'spinbutton'} tabIndex={slider || locked ? -1 : 0} aria-labelledby={slider ? undefined : id}
          aria-valuenow={slider ? undefined : index} aria-valuemin={slider ? undefined : 0} aria-valuemax={slider ? undefined : max} aria-valuetext={slider ? undefined : valueText(input, index)}
          aria-disabled={locked || undefined} onKeyDown={slider ? undefined : onKey}
          className={`nodrag rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${slider ? 'w-[56px]' : 'w-[96px]'}`}
          data-input={input.id}
        >{valueText(input, index)}</span>
        <button type="button" tabIndex={-1} aria-label={`Raise ${input.label.toLowerCase()}`} className={button} disabled={locked || index >= max} onClick={() => bump(1)}>+</button>
      </span>
    </div>
  )
}

function Readout({ items }: { items: { label: string; value: string; tag?: string }[] }) {
  return (
    <div className={`grid gap-x-6 border-t border-ss-line pt-1.5 ${items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {items.map((it) => (
        <p key={it.label} className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">{it.label}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-readout={it.tag}>{it.value}</span>
        </p>
      ))}
    </div>
  )
}

function Result({ marked, said }: { marked: string; said: string }) {
  if (marked === 'idle') return null
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// A flowchart or a key.

function RunCard({ chart, config, state, setState, marked, reduced, locked }: Props & { chart: FlowChart }) {
  const now = marked === 'shown' ? (flowchartEngine.solve(config) as FcState) : state
  const at = atOf(chart, now)
  const atKey = chart.inputs.map((i) => at[i.id]).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the walk changes only when the inputs do
  const run = useMemo(() => runChart(chart, at), [chart, atKey])
  const route = useMemo(() => routeOf(chart, run), [chart, run])
  const t = useElapsed(`${chart.id}:${atKey}`, durationOf(route), reduced)
  const L = lengthAt(route, t)
  const arrived = L >= route.total - 0.5
  const token = pointAt(route, L, capOf(nodeOf(chart, 'start')))
  const endText = textOfEnd(chart, run.end)
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const set = (id: string, next: number) => {
    if (locked) return
    setState({ at: { ...at, [id]: next } })
  }
  const asks = chart.nodes.filter((n) => n.kind === 'decision').length
  const settings = chart.inputs.map((i) => `${i.label.toLowerCase()} ${valueText(i, at[i.id])}`).join(', ')
  const label = `${chart.kind === 'key' ? 'A key' : 'A flowchart'}, ${chart.name.toLowerCase()}, with ${asks} questions and ${chart.nodes.filter((n) => n.kind === 'out').length} possible ends. Settings: ${settings}. The token ends at ${endText}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.fc-kbd]:block [&:has([role=spinbutton]:focus-visible)_.fc-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${chart.H}`} role="img" aria-label={label} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={chart.H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {chart.edges.map((e, k) => {
            const pts = edgePoints(chart, e)
            return (
              <g key={k} data-edge={k}>
                <polyline points={pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')} fill="none" stroke={LINE} strokeWidth={1.8} strokeLinejoin="round" />
                <Arrow at={pts[pts.length - 1]} from={pts[pts.length - 2]} fill={LINE} />
              </g>
            )
          })}
          <path d={trailPath(route, L)} fill="none" stroke={ACCENT} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" data-trail="1" />
          {run.edges.map((k) => {
            const pts = edgePoints(chart, chart.edges[k])
            return route.edgeEnd[k] <= L ? <Arrow key={k} at={pts[pts.length - 1]} from={pts[pts.length - 2]} fill={ACCENT} /> : null
          })}
          {chart.nodes.map((n) => {
            const visited = (route.nodeAt[n.id] ?? Infinity) <= L && run.nodes.includes(n.id)
            return <Shape key={n.id} chart={chart} id={n.id} visited={visited} reached={arrived && n.id === run.end} />
          })}
          <g aria-hidden="true" fontFamily={FONT}>
            {chart.edges.map((e, k) => {
              if (e.when === undefined) return null
              const p = edgeLabelAt(chart, e)
              const taken = run.edges.includes(k) && route.edgeStart[k] <= L
              return (
                <text
                  key={k} x={f1(p.x)} y={f1(p.y)} textAnchor={p.anchor} dominantBaseline="central" fontSize={12} fontWeight={taken ? 800 : 700} fill={taken ? ACCENT_DEEP : SOFT}
                  stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-branch={e.when ? 'yes' : 'no'}
                >{e.when ? 'Yes' : 'No'}</text>
              )
            })}
          </g>
          <TokenMark at={token} />
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named kind="token">Token</Named>
          <Named kind="path">Path taken</Named>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {chart.inputs.map((i) => <InputRow key={i.id} input={i} index={at[i.id]} locked={locked} onChange={(next) => set(i.id, next)} />)}
        {marked === 'idle' && <Readout items={[{ label: chart.readout, value: arrived ? endText : '…', tag: 'end' }]} />}
      </div>

      <p className="fc-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the controls. Arrow keys change a value.</p>
      <span className="sr-only" aria-live="polite">{`The token ends at ${endText}.`}</span>
      <Result marked={marked} said={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// A state machine.

function MachineCard({ chart, config, state, setState, marked, reduced, locked }: Props & { chart: Machine }) {
  const now = marked === 'shown' ? (flowchartEngine.solve(config) as FcState) : state
  const presses = pressesOf(chart, now)
  const states = statesVisited(chart, presses)
  const n = presses.length
  const key = `${chart.id}:${presses.join(',')}`
  const last = n > 0 ? { from: states[n - 1], to: states[n], ev: presses[n - 1] } : null
  const lastEdge = last ? chart.edges.findIndex((e) => e.from === last.from && e.on.includes(last.ev)) : -1
  const DUR = 0.7
  const t = useElapsed(key, last && lastEdge >= 0 ? DUR : 0, reduced)
  const travelling = last !== null && lastEdge >= 0 && t < DUR
  const here = travelling ? last!.from : states[n]
  const rest = (id: string): Pt => {
    const s = stateOf(chart, id)
    return { x: s.x, y: s.y + chart.r * 0.48 }
  }
  let token = rest(here)
  if (travelling && last) {
    const g = machineEdgeGeometry(chart, chart.edges[lastEdge])
    const u = t / DUR
    token = u < 0.2 ? lerp(rest(last.from), g.p0, u / 0.2) : u < 0.8 ? bezAt(g, (u - 0.2) / 0.6) : lerp(g.p1, rest(last.to), (u - 0.8) / 0.2)
  }
  const nowName = textOfEnd(chart, states[n])
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const press = (ev: string) => {
    if (locked || n >= 12) return
    setState({ presses: [...presses, ev] })
  }
  const label = `A state machine, ${chart.name.toLowerCase()}, with ${chart.states.length} states: ${chart.states.map((s) => s.text).join(', ')}. The token is in ${nowName}.`
  const cols = chart.events.length + 1

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.fc-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${chart.H}`} role="img" aria-label={label} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={chart.H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {chart.edges.map((e, k) => {
            const g = machineEdgeGeometry(chart, e)
            const hot = k === lastEdge
            const colour = hot ? ACCENT : LINE
            return (
              <g key={k} data-edge={k} data-hot={hot ? '1' : '0'}>
                <path d={`M ${f1(g.p0.x)} ${f1(g.p0.y)} C ${f1(g.c1.x)} ${f1(g.c1.y)} ${f1(g.c2.x)} ${f1(g.c2.y)} ${f1(g.p1.x)} ${f1(g.p1.y)}`} fill="none" stroke={colour} strokeWidth={hot ? 3 : 1.8} strokeLinecap="round" />
                <Arrow at={g.p1} from={g.c2} fill={colour} />
              </g>
            )
          })}
          {chart.states.map((s) => {
            const on = s.id === here
            return (
              <g key={s.id} data-state={s.id} data-here={on ? '1' : '0'}>
                <circle cx={s.x} cy={s.y} r={chart.r} fill={on ? ACCENT_SOFT : NODE} stroke={on ? ACCENT : SOFT} strokeWidth={on ? 2.4 : 1.6} />
                <ShapeText x={s.x} y={s.y - chart.r * 0.22} fill={INK}>{s.text}</ShapeText>
              </g>
            )
          })}
          <g aria-hidden="true" fontFamily={FONT}>
            {chart.edges.map((e, k) => {
              const g = machineEdgeGeometry(chart, e)
              return (
                <text
                  key={k} x={f1(g.label.x)} y={f1(g.label.y)} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={k === lastEdge ? 800 : 700} fill={k === lastEdge ? ACCENT_DEEP : SOFT}
                  stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-arrow-label={k}
                >{machineEdgeText(chart, e)}</text>
              )
            })}
          </g>
          <TokenMark at={token} />
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named kind="token">Token</Named>
          <Named kind="state">Current state</Named>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {chart.events.map((ev) => (
            <button
              key={ev.id} type="button" aria-label={ev.label} disabled={locked || n >= 12} onClick={() => press(ev.id)}
              className="nodrag h-8 touch-manipulation select-none whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-extrabold text-ss-ink transition-colors hover:border-[color:var(--subject)] focus-visible:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >{ev.label}</button>
          ))}
          <button
            type="button" aria-label="Start again" disabled={locked || n === 0} onClick={() => !locked && setState({ presses: [] })}
            className="nodrag h-8 touch-manipulation select-none whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-bold text-ss-slate transition-colors hover:border-[color:var(--subject)] focus-visible:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >Start again</button>
        </div>
        {marked === 'idle' && <Readout items={[{ label: 'Now in', value: travelling ? '…' : nowName, tag: 'now' }, { label: 'Presses', value: String(n), tag: 'presses' }]} />}
      </div>

      <p className="fc-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the buttons. Enter presses one.</p>
      <span className="sr-only" aria-live="polite">{`The machine is in ${nowName}.`}</span>
      <Result marked={marked} said={said} />
    </div>
  )
}

export function FlowchartView(props: Props) {
  const chart = chartFor(props.config)
  return isMachine(chart) ? <MachineCard {...props} chart={chart} /> : <RunCard {...props} chart={chart} />
}
