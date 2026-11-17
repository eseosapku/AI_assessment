'use client'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ShadowsConfig, ShadowsState } from './config'
import { clock, madeDistance, madeText, madeTime, shadowHeight, shadowLength, shadowsEngine, working } from './config'

type Props = SceneViewProps<ShadowsConfig, ShadowsState>

// A quiet light bench in both themes. Colours belong to the materials; no gradients, glows or drop shadows.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#334155'
const SOFT = '#64748B'
const WOOD = '#B98250'
const WOOD_EDGE = '#78502E'
const WOOD_LIGHT = '#D9AA75'
const AMBER = '#D99A2B'
const RAY = '#E9BC61'
const SHADOW = '#667085'
const SHADOW_EDGE = '#4B5563'
const BLUE = '#2F7FB8'
const WHITE = '#FFFFFF'
const SKY = '#EAF3F8'
const GROUND = '#E9E3D5'
const SUN = '#E8B647'
const SUN_EDGE = '#A86F16'

export const W = 360
export const H = 264
export const BENCH_Y = 216
export const OBJECT_X = 218
export const SCREEN_X = 326
export const LAMP_MIN_X = 48
export const LAMP_MAX_X = 160
export const GROUND_Y = 204
export const STICK_X = 180
export const STICK_H = 74
export const SHADOW_SCALE = 0.58
/** The front view of the screen, drawn at a smaller scale so the tallest shadow fits. */
const FRONT_X = 296
const FRONT_W = 56
const FRONT_K = 0.6

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const f1 = (v: number) => v.toFixed(1)
export const dayPos = (time: number) => ({
  x: STICK_X + 146 * Math.cos(((time - 6) * Math.PI) / 12),
  y: GROUND_Y - 146 * Math.sin(((time - 6) * Math.PI) / 12),
})
export const lampX = (distance: number) => OBJECT_X - distance * 5.5
export const distanceAtX = (x: number) => clamp((OBJECT_X - x) / 5.5, 6, 30)
export const timeAtX = (x: number) => clamp(12 - (Math.acos(clamp((x - STICK_X) / 146, -1, 1)) * 12) / Math.PI, 8, 16)
export const timeAtPoint = (x: number, y: number) => {
  const angle = Math.atan2(GROUND_Y - y, x - STICK_X)
  return clamp(6 + (angle * 12) / Math.PI, 8, 16)
}

/**
 * A side-view rabbit cut from thin wood. The same local outline is used on the screen, scaled by similar triangles.
 * Local x/y are in drawing units, with the puppet's feet at y=0 and its tallest ear at y=-112.
 */
const RABBIT = 'M -22 0 L -25 -9 L -22 -19 L -29 -31 L -29 -45 L -23 -53 L -22 -65 L -17 -72 L -15 -92 L -10 -111 L -5 -110 L -3 -86 L 1 -79 L 5 -102 L 10 -112 L 14 -108 L 13 -84 L 12 -70 L 19 -61 L 23 -48 L 21 -38 L 28 -32 L 24 -25 L 15 -23 L 11 -13 L 15 0 L 6 0 L 2 -10 L -5 -10 L -8 0 Z'

function Rabbit({ x, y, scale = 1, shadow = false }: { x: number; y: number; scale?: number; shadow?: boolean }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${scale * 96 / 112})`}>
      <path d={RABBIT} fill={shadow ? SHADOW : WOOD} stroke={shadow ? SHADOW_EDGE : WOOD_EDGE} strokeWidth={shadow ? 1.4 / scale : 1.8} strokeLinejoin="round" />
      {!shadow && (
        <g fill="none" stroke={WOOD_EDGE} strokeLinecap="round">
          <path d="M -11 -67 Q 1 -60 13 -68 M -10 -52 Q 0 -46 16 -52 M -16 -34 Q -2 -29 12 -34" strokeWidth={1.1} opacity={0.55} />
          <circle cx={15} cy={-48} r={2.2} fill={WOOD_EDGE} stroke="none" />
          <path d="M 22 -31 L 29 -29 M 21 -28 L 29 -25" strokeWidth={1} />
        </g>
      )}
    </g>
  )
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Warm metal barrel, head and switch; the white ring is the part to hold. */}
      <path d="M -26 -12 L 2 -12 L 10 -20 L 20 -20 L 20 20 L 10 20 L 2 12 L -26 12 Z" fill="#8492A6" stroke="#475569" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M 11 -18 L 18 -18 L 18 18 L 11 18 Z" fill="#D6DEE7" stroke="#475569" strokeWidth={1.2} />
      <rect x={18} y={-15} width={3} height={30} rx={1} fill="#F2D78B" stroke={AMBER} strokeWidth={1} />
      <rect x={-19} y={-17} width={9} height={6} rx={2} fill="#475569" />
      <path d="M -22 -7 H -5 M -22 0 H -8 M -22 7 H -5" stroke="#C7D0DA" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={-4} cy={0} r={11} fill={WHITE} stroke={BLUE} strokeWidth={2} />
      <path d="M -8 -4 V 4 M -4 -4 V 4 M 0 -4 V 4" stroke={BLUE} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
}

function Readout({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <p className="m-0 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}{unit && <span className="ml-1 text-[12px] font-bold text-ss-slate">{unit}</span>}</span>
    </p>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ label, value, less, more, down, up, locked }: { label: string; value: string; less: string; more: string; down(): void; up(): void; locked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked} onClick={down} className={STEP}>{'\u2212'}</button>
        <span className="min-w-[76px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{value}</span>
        <button type="button" aria-label={more} disabled={locked} onClick={up} className={STEP}>+</button>
      </span>
    </div>
  )
}

function SizeBench({ config, state, setState, locked }: { config: Extract<ShadowsConfig, { task: 'size' }>; state: ShadowsState; setState(next: ShadowsState): void; locked: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const d = madeDistance(config, state)
  const h = shadowHeight(d)
  const x = lampX(d)
  // The screen is drawn from the same geometry: 12 cm is 96 units and 10 cm is 80 screen units.
  const pxPerCm = 8
  const scale = h / 12
  const screenGap = 55
  const screenX = OBJECT_X + screenGap
  const lampY = BENCH_Y - (d / (d + 10)) * 48
  const sourceX = x + 20
  const project = (localX: number, localY: number) => {
    const atX = OBJECT_X + localX * 96 / 112
    const atY = BENCH_Y + localY * 96 / 112
    const k = (screenX - sourceX) / (atX - sourceX)
    return { x: atX, y: atY, screenY: lampY + k * (atY - lampY) }
  }
  const topRay = project(10, -112)
  const footRay = project(15, 0)
  const move = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    setState({ distance: Math.round(distanceAtX(((clientX - box.left) / box.width) * W) * 2) / 2 })
  }
  const down = (e: PointerEvent<SVGGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    move(e.clientX)
  }
  const key = (e: KeyboardEvent<SVGGElement>) => {
    const by = ({ ArrowLeft: 0.5, ArrowDown: 0.5, ArrowRight: -0.5, ArrowUp: -0.5, PageDown: 2.5, PageUp: -2.5 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (!locked) setState({ distance: e.key === 'Home' ? 30 : e.key === 'End' ? 6 : clamp(d + by, 6, 30) })
  }
  const described = `A torch shines at an opaque wooden rabbit puppet, which casts a ${f1(h)} centimetre shadow on a screen. Two blue marks are ${config.height} centimetres apart. The torch is ${d} centimetres from the rabbit. Drag the torch's white grip left or right to change the shadow.`
  return (
    <>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={described} className="block h-auto w-full touch-none select-none">
        <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
        <text x={18} y={24} fontSize={12} fontWeight={700} fill={SOFT}>Shadow bench</text>
        {/* The screen: card on a wooden foot, with its lit and unlit regions visible. */}
        <rect x={screenX - 2} y={34} width={12} height={BENCH_Y - 34} rx={2} fill="#FBF3D5" stroke="#94A3B8" strokeWidth={1.4} />
        {/* Side on, the shadow is the dark stretch of screen between where the two edge rays land. */}
        <rect x={screenX - 1.3} y={Math.max(35, topRay.screenY)} width={10.6} height={BENCH_Y - Math.max(35, topRay.screenY)} fill={SHADOW} />
        <rect x={screenX - 8} y={BENCH_Y} width={24} height={6} rx={2} fill={WOOD_EDGE} />
        {/* The same screen seen from the front, at a smaller scale: the outline, and the goal marks beside it. */}
        <text x={FRONT_X + FRONT_W / 2} y={30} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>front</text>
        <rect x={FRONT_X} y={38} width={FRONT_W} height={BENCH_Y - 38} rx={3} fill="#FBF3D5" stroke="#94A3B8" strokeWidth={1.2} />
        <g clipPath="url(#front-screen)">
          <Rabbit x={FRONT_X + FRONT_W / 2 + 4} y={BENCH_Y} scale={scale * FRONT_K} shadow />
        </g>
        <clipPath id="front-screen"><rect x={FRONT_X} y={38} width={FRONT_W} height={BENCH_Y - 38} rx={3} /></clipPath>
        <path d={`M ${FRONT_X + 3} ${BENCH_Y - config.height * pxPerCm * FRONT_K} H ${FRONT_X + 13} M ${FRONT_X + 3} ${BENCH_Y - 1} H ${FRONT_X + 13}`} fill="none" stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
        <text x={FRONT_X + 4} y={BENCH_Y - config.height * pxPerCm * FRONT_K - 6} fontSize={12} fontWeight={700} fill={BLUE} stroke="#FBF3D5" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">goal</text>
        {/* One source point, with straight rays past the puppet's highest and lowest points. */}
        <path d={`M ${sourceX} ${lampY} L ${topRay.x} ${topRay.y} L ${screenX - 3} ${topRay.screenY}`} fill="none" stroke={RAY} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${sourceX} ${lampY} L ${footRay.x} ${footRay.y} L ${screenX - 3} ${footRay.screenY}`} fill="none" stroke={RAY} strokeWidth={2.2} strokeLinecap="round" />
        {/* Bench and ruler, all in centimetres. */}
        <rect x={18} y={BENCH_Y} width={326} height={7} rx={2} fill="#D7C7B2" stroke="#A8957E" strokeWidth={1} />
        {[10, 15, 20, 25, 30].map((cm) => {
          const tx = lampX(cm)
          return <g key={cm}><path d={`M ${tx} 228 V 232`} stroke={SOFT} strokeWidth={1} /><text x={tx} y={244} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT}>{cm}</text></g>
        })}
        <text x={106} y={258} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>torch to rabbit (cm)</text>
        <text x={OBJECT_X} y={258} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>rabbit</text>
        <text x={screenX} y={258} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>screen</text>
        <Rabbit x={OBJECT_X} y={BENCH_Y} />
        <Torch x={x} y={lampY} />
        <text x={x - 4} y={105} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>torch</text>
        {!locked && <path d={`M ${x - 37} 119 H ${x + 29} M ${x - 37} 119 L ${x - 31} 114 M ${x - 37} 119 L ${x - 31} 124 M ${x + 29} 119 L ${x + 23} 114 M ${x + 29} 119 L ${x + 23} 124`} fill="none" stroke={BLUE} strokeWidth={1.5} strokeLinecap="round" />}
        <g data-torch-handle role="slider" tabIndex={locked ? -1 : 0} aria-label="Torch distance from the rabbit" aria-valuemin={6} aria-valuemax={30} aria-valuenow={d} aria-valuetext={`${d} centimetres`} onPointerDown={down} onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && move(e.clientX)} onKeyDown={key} className="nodrag cursor-grab outline-none focus-visible:outline-none" transform={`translate(${x - 4} ${lampY})`}>
          <circle r={22} fill="transparent" stroke="transparent" strokeWidth={2} className="focus-visible:stroke-[#2F7FB8]" />
        </g>
      </svg>
      <div className="grid grid-cols-2 gap-x-5">
        <Readout label="Shadow height" value={f1(h)} unit="cm" />
        <Readout label="Goal" value={String(config.height)} unit="cm" />
      </div>
      <Stepper label="Torch distance" value={`${d} cm`} less="Move torch nearer the rabbit" more="Move torch away from the rabbit" locked={locked} down={() => setState({ distance: clamp(d - 0.5, 6, 30) })} up={() => setState({ distance: clamp(d + 0.5, 6, 30) })} />
    </>
  )
}

function Sun({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4
        return <path key={k} d={`M ${19 * Math.cos(a)} ${19 * Math.sin(a)} L ${25 * Math.cos(a)} ${25 * Math.sin(a)}`} stroke={SUN_EDGE} strokeWidth={2} strokeLinecap="round" />
      })}
      <circle r={14} fill={SUN} stroke={SUN_EDGE} strokeWidth={1.6} />
      <circle r={20} fill={WHITE} fillOpacity={0.88} stroke={BLUE} strokeWidth={1.8} />
      <path d="M -4 -3 V 3 M 0 -3 V 3 M 4 -3 V 3" stroke={BLUE} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
}

function DayBench({ state, setState, locked }: { state: ShadowsState; setState(next: ShadowsState): void; locked: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const t = madeTime(state)
  const p = dayPos(t)
  const len = shadowLength(t)
  const px = len * SHADOW_SCALE
  const endX = STICK_X - px
  const topX = STICK_X + 7.14
  const topY = GROUND_Y - STICK_H
  const tipX = p.x + ((topX - p.x) * (GROUND_Y - p.y)) / (topY - p.y)
  const move = (clientX: number, clientY: number) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const px = ((clientX - box.left) / box.width) * W
    const py = ((clientY - box.top) / box.height) * H
    setState({ time: Math.round(timeAtPoint(px, py) * 4) / 4 })
  }
  const down = (e: PointerEvent<SVGGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    move(e.clientX, e.clientY)
  }
  const key = (e: KeyboardEvent<SVGGElement>) => {
    const by = ({ ArrowLeft: -0.25, ArrowDown: -0.25, ArrowRight: 0.25, ArrowUp: 0.25, PageDown: -1, PageUp: 1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (!locked) setState({ time: e.key === 'Home' ? 8 : e.key === 'End' ? 16 : clamp(t + by, 8, 16) })
  }
  const described = `The Sun is at ${clock(t)}. A vertical wooden stick casts a ${Math.round(len)} centimetre shadow pointing ${t < 12 ? 'west, left' : t > 12 ? 'east, right' : 'a short way left'}. Drag the Sun along its path to change the shadow.`
  return (
    <>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={described} className="block h-auto w-full touch-none select-none">
        <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={SKY} stroke={EDGE} strokeWidth={1.5} />
        <text x={18} y={24} fontSize={12} fontWeight={700} fill={SOFT}>Shadow stick</text>
        <path d="M 34 204 A 146 146 0 0 1 326 204" fill="none" stroke="#9CB4C2" strokeWidth={1.6} strokeDasharray="5 6" />
        <rect x={1} y={GROUND_Y} width={358} height={59} fill={GROUND} />
        <path d={`M 0 ${GROUND_Y} H 360`} stroke="#B5AA96" strokeWidth={1.4} />
        <text x={18} y={226} fontSize={12} fontWeight={700} fill={SOFT}>west</text>
        <text x={342} y={226} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>east</text>
        {/* The ray reaches the stick's top; its straight continuation meets the ground at the shadow's tip. */}
        <path d={`M ${p.x} ${p.y} L ${topX} ${topY} L ${tipX} ${GROUND_Y}`} fill="none" stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
        <path d={`M ${STICK_X} ${GROUND_Y} L ${endX} ${GROUND_Y} L ${endX + (t <= 12 ? 7 : -7)} ${GROUND_Y - 3} L ${STICK_X} ${GROUND_Y - 3} Z`} fill={SHADOW} stroke={SHADOW_EDGE} strokeWidth={1} />
        {/* A real round wooden stick, its foot and end grain. */}
        <ellipse cx={STICK_X} cy={GROUND_Y + 2} rx={12} ry={4} fill="#C3B59D" />
        <rect x={STICK_X - 5} y={GROUND_Y - STICK_H} width={10} height={STICK_H} rx={3} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.4} />
        <path d={`M ${STICK_X - 1} ${GROUND_Y - STICK_H + 7} V ${GROUND_Y - 9} M ${STICK_X + 3} ${GROUND_Y - STICK_H + 13} V ${GROUND_Y - 18}`} stroke={WOOD_LIGHT} strokeWidth={1.2} strokeLinecap="round" />
        <ellipse cx={STICK_X} cy={GROUND_Y - STICK_H} rx={5} ry={2.4} fill={WOOD_LIGHT} stroke={WOOD_EDGE} strokeWidth={1} />
        <text x={STICK_X + 18} y={GROUND_Y - 26} fontSize={12} fontWeight={700} fill={SOFT}>stick</text>
        <text x={(STICK_X + endX) / 2} y={GROUND_Y + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={SHADOW_EDGE}>shadow</text>
        <Sun x={p.x} y={p.y} />
        <text x={p.x} y={p.y - 31} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Sun</text>
        {!locked && <path d={`M ${p.x - 35} ${p.y + 32} H ${p.x + 35} M ${p.x - 35} ${p.y + 32} L ${p.x - 29} ${p.y + 27} M ${p.x - 35} ${p.y + 32} L ${p.x - 29} ${p.y + 37} M ${p.x + 35} ${p.y + 32} L ${p.x + 29} ${p.y + 27} M ${p.x + 35} ${p.y + 32} L ${p.x + 29} ${p.y + 37}`} fill="none" stroke={BLUE} strokeWidth={1.5} strokeLinecap="round" />}
        <g data-sun-handle role="slider" tabIndex={locked ? -1 : 0} aria-label="Time of day" aria-valuemin={8} aria-valuemax={16} aria-valuenow={t} aria-valuetext={clock(t)} onPointerDown={down} onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && move(e.clientX, e.clientY)} onKeyDown={key} className="nodrag cursor-grab outline-none focus-visible:outline-none" transform={`translate(${p.x} ${p.y})`}>
          <circle r={29} fill="transparent" stroke="transparent" strokeWidth={2} className="focus-visible:stroke-[#2F7FB8]" />
        </g>
      </svg>
      <Readout label="Shadow length" value={String(Math.round(len))} unit="cm" />
      <Stepper label="Time of day" value={clock(t)} less="Move the Sun 15 minutes earlier" more="Move the Sun 15 minutes later" locked={locked} down={() => setState({ time: clamp(t - 0.25, 8, 16) })} up={() => setState({ time: clamp(t + 0.25, 8, 16) })} />
    </>
  )
}

export function ShadowsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? shadowsEngine.solve(config) : state
  const text = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        {config.task === 'size'
          ? <SizeBench config={config} state={now} setState={setState} locked={locked || marked === 'right' || marked === 'shown'} />
          : <DayBench state={now} setState={setState} locked={locked || marked === 'right' || marked === 'shown'} />}
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {config.task === 'size' ? 'The puppet blocks the light; its outline appears on the screen.' : 'Move the Sun: watch the shadow’s length and direction.'}
        </figcaption>
      </figure>
      {marked !== 'idle' && <p className="m-0 rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>}
      {reduced && <span className="sr-only">The picture is still. Each drag or button press updates the shadow.</span>}
    </div>
  )
}
