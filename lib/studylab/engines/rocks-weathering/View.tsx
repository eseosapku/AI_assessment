'use client'
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CrystalsConfig, FizzConfig, RocksConfig, RocksState, SampleId } from './config'
import {
  GRAIN_AT, madeText, rocksWeatheringEngine, SAMPLES, STOP_COOLING, STOP_NAMES, stopOf, taggedOf, TARGET_STOP, testedOf, working,
} from './config'

type Props = SceneViewProps<RocksConfig, RocksState>

// A quiet light plate in both themes; the picture keeps its own material colours. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#243447'
const SOFT = '#475569'
const HAIR = '#A8B5C2'
const SKY = '#E3EEF6'
const SOIL = '#8A6A4B'
const STRATA = ['#BDB09B', '#AA9D88', '#9A8D7A', '#8B7F6E', '#7A6F61', '#6E6458']
const STRATA_LINE = '#74695B'
const MAGMA = '#EE7B30'
const MAGMA_CORE = '#F7A94B'
const MAGMA_EDGE = '#B8481A'
const ACCENT = '#D98324'
const ACCENT_FILL = '#FBE3B4'
const ACID = '#5FB6CC'
const FONT = 'system-ui, sans-serif'

// Literal geometry (config.ts imports this file, so it cannot be read from there at load).
export const W = 360
export const H = 372
export const STOP_Y = [40, 80, 120, 160, 200]
export const ROW_X = 192
export const ROW_W = 152
export const ROW_H = 36
export const BLOB_X = 100
export const CIRCLE = { r: 52, y: 292, mine: 96, target: 264 }
const GRAIN_PX = [7, 10, 16, 24, 34]

// ---------------------------------------------------------------------------
// Crystals: a tessellation of jittered quads, bigger or smaller, in the same few mineral colours.

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const MINERAL = ['#D9A89A', '#D9A89A', '#D9A89A', '#EFEAE0', '#EFEAE0', '#EFEAE0', '#9AA0A8', '#9AA0A8', '#3B3F46', '#C9BBA9']

export function grainCells(size: number, r: number): { d: string; fill: string }[] {
  const n = Math.ceil(r / size) + 1
  const vert = (i: number, j: number) => ({ x: i * size + (hash(i, j, 1) - 0.5) * size * 0.7, y: j * size + (hash(i, j, 2) - 0.5) * size * 0.7 })
  const out: { d: string; fill: string }[] = []
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const p = [vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)]
      const cx = (p[0].x + p[2].x) / 2
      const cy = (p[0].y + p[2].y) / 2
      if (Math.hypot(cx, cy) > r + size) continue
      out.push({ d: `M${p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('L')}Z`, fill: MINERAL[Math.floor(hash(i, j, 3) * MINERAL.length)] })
    }
  }
  return out
}

function Grains({ stop, cx, cy, clip }: { stop: number; cx: number; cy: number; clip: string }) {
  const cells = useMemo(() => grainCells(GRAIN_PX[stop], CIRCLE.r), [stop])
  return <g transform={`translate(${cx} ${cy})`} clipPath={`url(#${clip})`}>
    {cells.map((c, i) => <path key={i} d={c.d} fill={c.fill} stroke="#2B2F36" strokeWidth={stop === 0 ? 0.5 : 0.9} strokeLinejoin="round" />)}
  </g>
}

function Magma({ y, stop }: { y: number; stop: number }) {
  const flat = stop === 0
  const ry = flat ? 11 : 16
  return <g pointerEvents="none">
    <ellipse cx={BLOB_X} cy={y} rx={flat ? 58 : 56} ry={ry} fill={MAGMA} stroke={MAGMA_EDGE} strokeWidth={2} />
    <ellipse cx={BLOB_X + 4} cy={y} rx={flat ? 40 : 38} ry={ry - 6} fill={MAGMA_CORE} />
    <text x={BLOB_X + 4} y={y + 4} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill="#5A1E08">Magma</text>
    {/* A visible grip: the pocket slides up and down. */}
    <path d={`M${BLOB_X - 44} ${y - 2} l5 -6 l5 6 Z M${BLOB_X - 44} ${y + 2} l5 6 l5 -6 Z`} fill="#5A1E08" />
  </g>
}

function CrystalsView({ config, state, setState, marked, reduced, locked }: Props & { config: CrystalsConfig }) {
  const id = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const stop = stopOf(state)
  const y = STOP_Y[stop]
  const move = (to: number) => { if (!locked) setState({ stop: Math.max(0, Math.min(4, to)) }) }
  const nearest = (clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.height === 0) return stop
    const sy = ((clientY - box.top) / box.height) * H
    let best = 0
    STOP_Y.forEach((v, i) => { if (Math.abs(v - sy) < Math.abs(STOP_Y[best] - sy)) best = i })
    return best
  }
  const dragging = useRef(false)
  const down = (e: PointerEvent<SVGGElement>) => {
    if (locked) return
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    move(nearest(e.clientY))
  }
  const drag = (e: PointerEvent<SVGGElement>) => { if (dragging.current) move(nearest(e.clientY)) }
  const up = () => { dragging.current = false }
  const key = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    move(e.key === 'Home' ? 0 : e.key === 'End' ? 4 : stop + by)
  }
  const seen = `A cross-section of the ground. A pocket of magma sits at ${STOP_NAMES[stop].toLowerCase()}, and it ${STOP_COOLING[stop]}. Below, a close-up of the rock it makes with ${['tiny', 'small', 'medium', 'large', 'very large'][stop]} crystals, beside the target rock.`
  return <div className="relative w-full">
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
      <defs>
        <clipPath id={`${id}-section`}><rect x={10} y={10} width={340} height={222} rx={10} /></clipPath>
        <clipPath id={`${id}-mine`}><circle r={CIRCLE.r} /></clipPath>
      </defs>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <g clipPath={`url(#${id}-section)`}>
        <rect x={10} y={10} width={340} height={40} fill={SKY} />
        <rect x={10} y={50} width={340} height={8} fill={SOIL} />
        {STRATA.map((c, i) => <rect key={i} x={10} y={58 + i * 30} width={340} height={30} fill={c} />)}
        {STRATA.map((_, i) => <path key={i} d={`M10 ${58 + i * 30} H350`} stroke={STRATA_LINE} strokeWidth={1} opacity={0.5} />)}
      </g>
      <rect x={10} y={10} width={340} height={222} rx={10} fill="none" stroke={HAIR} strokeWidth={1.2} />
      <path d="M10 50 H350" stroke="#5E8A4A" strokeWidth={3} />
      {/* depth rows: each says how fast the magma cools there */}
      {STOP_Y.map((v, i) => <g key={i} fontFamily={FONT} pointerEvents="none">
        <rect x={ROW_X} y={v - ROW_H / 2} width={ROW_W} height={ROW_H} rx={8} fill="#FFFFFF" stroke={i === stop ? ACCENT : HAIR} strokeWidth={i === stop ? 2.4 : 1.2} />
        <text x={ROW_X + 9} y={v - 3} fontSize={12} fontWeight={800} fill={INK}>{STOP_NAMES[i]}</text>
        <text x={ROW_X + 9} y={v + 12} fontSize={12} fontWeight={600} fill={SOFT}>{STOP_COOLING[i]}</text>
      </g>)}
      <path d={`M${BLOB_X + 58} ${y} H${ROW_X}`} stroke={ACCENT} strokeWidth={2} strokeDasharray="3 3" pointerEvents="none" />
      <g style={{ transform: `translateY(${y}px)`, transition: reduced ? undefined : 'transform 600ms ease' }}>
        <Magma y={0} stop={stop} />
      </g>
      {/* the handle: the pocket itself is grabbed */}
      <g role="slider" tabIndex={locked ? -1 : 0} aria-label="Magma depth" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={4} aria-valuenow={stop}
        aria-valuetext={`${STOP_NAMES[stop]}, ${STOP_COOLING[stop]}`} onKeyDown={key} onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={up}
        className="rw-handle outline-none" style={{ touchAction: 'none', cursor: locked ? 'default' : 'grab' }}>
        <rect x={BLOB_X - 62} y={y - 22} width={124} height={44} fill="transparent" />
      </g>
      {/* close-ups */}
      <g fontFamily={FONT} textAnchor="middle">
        <Grains stop={stop} cx={CIRCLE.mine} cy={CIRCLE.y} clip={`${id}-mine`} />
        <circle cx={CIRCLE.mine} cy={CIRCLE.y} r={CIRCLE.r} fill="none" stroke={SOFT} strokeWidth={2} />
        <Grains stop={TARGET_STOP[config.target]} cx={CIRCLE.target} cy={CIRCLE.y} clip={`${id}-mine`} />
        <circle cx={CIRCLE.target} cy={CIRCLE.y} r={CIRCLE.r} fill="none" stroke={SOFT} strokeWidth={2} strokeDasharray="5 4" />
        <text x={CIRCLE.mine} y={360} fontSize={13} fontWeight={800} fill={INK}>Your rock</text>
        <text x={CIRCLE.target} y={360} fontSize={13} fontWeight={800} fill={INK}>Target rock</text>
      </g>
    </svg>
    {STOP_Y.map((v, i) => <button key={i} type="button" disabled={locked} aria-label={`Put the magma at ${STOP_NAMES[i].toLowerCase()}`} aria-pressed={i === stop}
      onClick={() => move(i)} className="nodrag absolute touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default"
      style={{ left: `${(ROW_X / W) * 100}%`, top: `${((v - ROW_H / 2) / H) * 100}%`, width: `${(ROW_W / W) * 100}%`, height: `${(ROW_H / H) * 100}%`, border: 0, background: 'transparent', cursor: locked ? 'default' : 'pointer' }} />)}
  </div>
}

// ---------------------------------------------------------------------------
// Fizz: a tray of rocks, a dropper over each.

const SPECKS: [number, number, string][] = [[26, 58, '#3B3F46'], [34, 50, '#F4EFE6'], [42, 66, '#B0766A'], [50, 54, '#3B3F46'], [58, 46, '#F4EFE6'], [62, 64, '#B0766A'], [70, 56, '#3B3F46'], [76, 66, '#F4EFE6'], [46, 72, '#F4EFE6'], [30, 70, '#B0766A'], [66, 72, '#3B3F46'], [54, 62, '#F4EFE6']]
const VESICLES: [number, number, number][] = [[32, 58, 2.6], [46, 52, 2], [60, 60, 3], [72, 56, 2], [40, 68, 2.2], [56, 70, 2.4], [24, 66, 1.8]]

function RockArt({ id }: { id: SampleId }) {
  if (id === 'limestone') return <g>
    <path d="M14 70 L19 52 L34 44 L58 41 L80 48 L88 62 L83 75 L22 77 Z" fill="#D8D2BE" stroke="#8C8670" strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M18 60 H85 M16 68 H86" stroke="#B3AC95" strokeWidth={1.4} />
    <circle cx={58} cy={53} r={6} fill="none" stroke="#9A9380" strokeWidth={1.6} /><circle cx={58} cy={53} r={2.6} fill="none" stroke="#9A9380" strokeWidth={1.4} />
  </g>
  if (id === 'chalk') return <g>
    <path d="M16 68 Q14 50 36 45 Q58 39 78 48 Q90 57 85 70 Q80 77 50 77 Q22 77 16 68 Z" fill="#F3F1EA" stroke="#B8B4A6" strokeWidth={1.6} />
    <ellipse cx={62} cy={61} rx={8} ry={5.5} fill="#4B5058" stroke="#2F3338" strokeWidth={1.2} />
    <path d="M26 56 Q34 52 42 55" stroke="#D8D5C8" strokeWidth={1.4} fill="none" />
  </g>
  if (id === 'marble') return <g>
    <path d="M13 66 Q16 48 40 44 Q66 39 82 51 Q91 66 80 75 Q50 81 20 75 Z" fill="#F0EEEA" stroke="#A9A6A0" strokeWidth={1.6} />
    <path d="M22 56 Q38 64 46 50 T78 56 M28 72 Q50 62 72 72" stroke="#98A0AB" strokeWidth={1.5} fill="none" />
  </g>
  if (id === 'granite') return <g>
    <path d="M13 68 L22 50 L44 42 L70 44 L87 58 L83 75 L24 77 Z" fill="#CDBDB5" stroke="#6E6560" strokeWidth={1.6} strokeLinejoin="round" />
    {SPECKS.map(([x, y, c], i) => <rect key={i} x={x} y={y} width={5 + (i % 3)} height={4 + (i % 2)} rx={1} fill={c} />)}
  </g>
  if (id === 'basalt') return <g>
    <path d="M15 70 L24 52 L46 43 L74 46 L87 62 L79 77 L22 77 Z" fill="#4A5058" stroke="#2A2E34" strokeWidth={1.6} strokeLinejoin="round" />
    {VESICLES.map(([x, y, r], i) => <ellipse key={i} cx={x + 6} cy={y + 2} rx={r} ry={r * 0.8} fill="#2C3036" />)}
  </g>
  return <g>
    <path d="M11 62 L27 46 L84 40 L91 56 L75 77 L17 77 Z" fill="#6E7A89" stroke="#3F4854" strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M17 66 L84 52 M20 72 L80 62 M30 52 L86 46" stroke="#566170" strokeWidth={1.4} />
  </g>
}

const BUBBLES: [number, number, number][] = [[28, 46, 2.6], [40, 41, 3.2], [52, 44, 2.4], [64, 40, 3], [74, 46, 2.6], [46, 36, 2.2], [60, 34, 2]]

function Sample({ id, config, state, setState, marked, reduced, locked, plays, drip, wide, wrong }: Props & { config: FizzConfig; id: SampleId; plays: number; drip(): void; wide: boolean; wrong: boolean }) {
  const tested = testedOf(config, state).includes(id)
  const tagged = taggedOf(config, state).includes(id)
  const fizz = SAMPLES[id].fizz
  const playing = plays > 0 && !reduced
  const toggle = () => {
    if (locked || !tested) return
    const now = taggedOf(config, state)
    setState({ ...state, tagged: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] })
  }
  const btn = 'nodrag h-7 whitespace-nowrap rounded-lg border-2 px-1 text-[12px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return <div className={`flex min-w-0 items-center gap-1 rounded-xl p-1 ${wide ? 'flex-row gap-1.5' : 'flex-col'}`} style={{ background: PLATE, border: `1.5px solid ${marked !== 'idle' && wrong ? ACCENT : PLATE_EDGE}` }}>
    <svg viewBox="0 0 100 84" className={`block h-auto select-none ${wide ? 'w-[40%] shrink-0' : 'w-full'}`} role="img"
      aria-label={`${SAMPLES[id].name}${tested ? (fizz ? ', fizzed when acid was added' : ', no fizz when acid was added') : ', not tested'}`}>
      {/* dropper */}
      <ellipse cx={50} cy={6} rx={6} ry={5} fill="#B4513A" stroke="#7A2F1E" strokeWidth={1.2} />
      <path d="M46 10 H54 L52 26 H48 Z" fill="#E8F2F7" stroke="#7B8D99" strokeWidth={1.2} />
      <path d="M48.6 14 H51.4 L50.6 24 H49.4 Z" fill={ACID} />
      {playing && <circle key={`drop-${plays}`} className="rw-fall" cx={50} cy={29} r={2.8} fill={ACID} />}
      <RockArt id={id} />
      {tested && !fizz && <ellipse cx={52} cy={45} rx={7} ry={2.4} fill={ACID} opacity={0.55} />}
      {tested && fizz && BUBBLES.map(([x, y, r], i) => <circle key={`${plays}-${i}`} className={playing ? 'rw-rise' : undefined} style={playing ? { animationDelay: `${0.5 + i * 0.12}s` } : undefined}
        cx={x} cy={y} r={r} fill="#FFFFFF" stroke="#6E9DBB" strokeWidth={1.1} />)}
      <path d="M4 79.5 H96" stroke={HAIR} strokeWidth={1.2} />
    </svg>
    <div className={`flex min-w-0 flex-col items-center gap-1 ${wide ? 'min-w-0 flex-1' : 'w-full'}`}>
    <p className="m-0 text-[13px] font-extrabold leading-none" style={{ color: INK }}>{SAMPLES[id].name}</p>
    <p key={`res-${plays}`} className={`m-0 text-[12px] font-bold leading-none ${playing ? 'rw-show' : ''}`} style={{ color: tested ? (fizz ? '#9A5B0F' : SOFT) : '#64748B', minHeight: 12 }}>
      {tested ? (fizz ? 'Fizzes' : 'No fizz') : 'Not tested'}
    </p>
    <button type="button" disabled={locked} aria-label={`Add acid to ${SAMPLES[id].name.toLowerCase()}`} onClick={drip} className={`${btn} w-full border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]`}>Add acid</button>
    <button type="button" disabled={locked || !tested} aria-pressed={tagged} aria-label={`${tagged ? 'Unmark' : 'Mark'} ${SAMPLES[id].name.toLowerCase()} as worn away by rain`} onClick={toggle}
      className={`${btn} w-full ${tagged ? '' : 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]'}`}
      style={tagged ? { background: ACCENT_FILL, borderColor: ACCENT, color: INK } : undefined}>Wears away</button>
    </div>
  </div>
}

function FizzView(props: Props & { config: FizzConfig }) {
  const { config, state, marked } = props
  const [plays, setPlays] = useState<Record<string, number>>({})
  const ids = config.samples.filter((s): s is SampleId => Object.prototype.hasOwnProperty.call(SAMPLES, s))
  const wide = ids.length === 4
  const cols = wide ? 2 : 3
  const wrongIds = marked === 'wrong' ? rocksWeatheringEngine.check(config, state).wrongIds : []
  const drip = (id: SampleId) => () => {
    if (props.locked) return
    setPlays((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }))
    const tested = testedOf(config, state)
    if (!tested.includes(id)) props.setState({ ...state, tested: [...tested, id] })
  }
  return <div className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
    {ids.map((id) => <Sample key={id} {...props} config={config} id={id} plays={plays[id] ?? 0} drip={drip(id)} wide={wide} wrong={wrongIds.includes(id)} />)}
  </div>
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  const [head, ...rest] = text.split('. ')
  return <p className="m-0 w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[12px] font-semibold leading-snug text-ss-slate" aria-live="polite">
    <strong className="block font-extrabold text-ss-ink">{head}{rest.length ? '.' : ''}</strong>{rest.length ? <span className="block">{rest.join('. ')}</span> : null}
  </p>
}

export function RocksWeatheringView(props: Props) {
  const { config, state, marked } = props
  const good = marked === 'right' || marked === 'shown'
  const text = good ? working(config, state) : marked === 'wrong' ? madeText(config, state) : ''
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
    <style>{`
      @keyframes rw-fall{0%{transform:translateY(0);opacity:1}75%{transform:translateY(17px);opacity:1}100%{transform:translateY(17px);opacity:0}}
      @keyframes rw-rise{0%{transform:translateY(8px);opacity:0}30%{opacity:1}100%{transform:translateY(-6px);opacity:1}}
      @keyframes rw-show{from{opacity:0}to{opacity:1}}
      .rw-fall{animation:rw-fall .7s ease-in both}
      .rw-rise{animation:rw-rise 1.1s ease-out both}
      .rw-show{animation:rw-show .4s ease-out .8s both}
      .rw-handle:focus-visible{outline:2px solid var(--subject);outline-offset:2px}
      @media (prefers-reduced-motion:reduce){.rw-fall,.rw-rise,.rw-show{animation:none}}
    `}</style>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      {config.task === 'crystals' ? <CrystalsView {...props} config={config} /> : <FizzView {...props} config={config} />}
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">
        {config.task === 'crystals' ? 'Slide the magma and compare the crystals in the two rocks.' : 'Acid on a rock: watch what happens.'}
      </figcaption>
    </figure>
    <Verdict marked={marked} text={text} />
  </div>
}
