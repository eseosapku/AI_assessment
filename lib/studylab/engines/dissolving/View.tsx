'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { DissolvingConfig, DissolvingState } from './config'
import {
  coldSpoons, dissolvingEngine, isSoluble, madeText, solidLeft, SOLUTE_G, spoonCount, strokesNeeded, strokeCount,
  temperatureOf, totalMass, working,
} from './config'

type Props = SceneViewProps<DissolvingConfig, DissolvingState>

// A light glassware panel in both themes, as measure-shape's cylinder has. Flat colours, no gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#64748B'
const GLASS = '#718395'
const GLASS_LIGHT = '#EAF2F7'
const WATER = '#D6EBF6'
const WATER_LINE = '#77A9C4'
const SPOON = '#AAB7C4'
const SPOON_DARK = '#66788A'
const SPOON_LIGHT = '#EDF2F7'
const ACCENT = '#2F7FB8'
const WARM = '#C65D45'
const FONT = 'system-ui, sans-serif'

// Literals, not top-level reads of config constants: config imports this file while it registers the engine.
export const W = 360
export const H = 232
const WATER_TOP = 74
const BEAKER_BOTTOM = 181
const MOUND_Y = 176

const MATERIAL = {
  sugar: { fill: '#FFFFFF', edge: '#94A3B8', name: 'sugar' },
  salt: { fill: '#E8EDF2', edge: '#8796A5', name: 'salt' },
  sand: { fill: '#D5B16C', edge: '#8A682F', name: 'sand' },
  chalk: { fill: '#E8E5DC', edge: '#92908A', name: 'chalk' },
} as const
type MaterialName = keyof typeof MATERIAL

const ease = (reduced: boolean) => (reduced ? undefined : { transition: 'transform 800ms ease, opacity 500ms ease' })
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const ACTION = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** One grain's fixed place on the mound; only the mound's scale changes as solid dissolves. */
const GRAINS = [
  [-23, -3], [-13, -5], [-2, -4], [10, -4], [22, -2], [-17, -10], [-6, -11], [6, -9], [17, -8], [-8, -17], [3, -17], [1, -23],
] as const

function Crystal({ x, y, size, edge, fill, turn = 0 }: { x: number; y: number; size: number; edge: string; fill: string; turn?: number }) {
  return <rect x={x - size / 2} y={y - size * 0.38} width={size} height={size * 0.76} rx={size * 0.12} fill={fill} stroke={edge} strokeWidth={0.9} transform={`rotate(${turn} ${x} ${y})`} />
}

/** A real little mound, not dots standing for one: crystals on a heaped bed of the same material. */
function SolidPile({ material, left, lumps, reduced }: { material: MaterialName; left: number; lumps: boolean; reduced: boolean }) {
  if (left <= 0) return null
  const f = Math.max(0.08, Math.min(1, left / 10))
  const look = MATERIAL[material]
  const count = Math.max(1, Math.ceil(f * (lumps ? 5 : GRAINS.length)))
  return (
    <g data-solid-pile={material} data-left={left} transform={`translate(180 ${MOUND_Y}) scale(${0.55 + 0.45 * f} ${0.28 + 0.72 * f})`} style={ease(reduced)}>
      <path d="M -34 0 Q -29 -10 -17 -13 Q -8 -26 1 -27 Q 14 -22 20 -13 Q 31 -9 35 0 Z" fill={look.fill} stroke={look.edge} strokeWidth={1.2} strokeLinejoin="round" />
      {Array.from({ length: count }, (_, i) => {
        const p = GRAINS[(i * 5) % GRAINS.length]
        return <Crystal key={i} x={p[0]} y={p[1]} size={lumps ? 10 : 5.4} edge={look.edge} fill={look.fill} turn={(i % 3 - 1) * 13} />
      })}
    </g>
  )
}

/** The water and its meniscus. It stays colourless: a sugar solution is not blue dye. */
function Water() {
  return (
    <g>
      <path d={`M 111 ${WATER_TOP + 2} Q 180 ${WATER_TOP + 7} 249 ${WATER_TOP + 2} L 244 166 Q 243 176 233 177 L 127 177 Q 117 176 116 166 Z`} fill={WATER} />
      <path d={`M 111 ${WATER_TOP + 2} Q 180 ${WATER_TOP - 3} 249 ${WATER_TOP + 2} Q 180 ${WATER_TOP + 9} 111 ${WATER_TOP + 2}`} fill={GLASS_LIGHT} stroke={WATER_LINE} strokeWidth={1.2} />
      <path d="M 124 87 L 127 156" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.75} />
    </g>
  )
}

/** A borosilicate beaker with a pouring lip, thick base and graduation ticks. */
function BeakerGlass() {
  return (
    <g fill="none" stroke={GLASS} strokeLinecap="round" strokeLinejoin="round">
      <path d="M 103 33 L 109 164 Q 110 184 130 185 L 230 185 Q 250 184 251 164 L 257 42 L 270 35 L 256 30" strokeWidth={2.5} />
      <path d="M 104 30 L 252 30" strokeWidth={2.5} />
      <path d="M 116 170 Q 180 181 244 170" strokeWidth={1.2} opacity={0.65} />
      <g strokeWidth={1.4}>
        <path d="M 113 79 H 126 M 114 96 H 121 M 115 113 H 128 M 116 130 H 123 M 117 147 H 130" />
      </g>
      <path d="M 106 39 L 110 76" stroke={GLASS_LIGHT} strokeWidth={3} />
    </g>
  )
}

function Thermometer({ temperature }: { temperature: number }) {
  const h = 15 + ((temperature - 20) / 40) * 48
  return (
    <g transform="translate(290 62)" fontFamily={FONT} aria-hidden="true">
      <rect x={-5} y={0} width={10} height={87} rx={5} fill="#FFFFFF" stroke={GLASS} strokeWidth={1.5} />
      <rect x={-1.8} y={72 - h} width={3.6} height={h} rx={1.8} fill={WARM} style={{ transition: 'y 700ms ease, height 700ms ease' }} />
      <circle cx={0} cy={78} r={7} fill={WARM} stroke="#A34A38" strokeWidth={1} />
      {[12, 32, 52].map((y) => <path key={y} d={`M 6 ${y} h 5`} stroke={SOFT} strokeWidth={1.2} />)}
      <text x={0} y={105} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{temperature} °C</text>
    </g>
  )
}

function Spoon({ dx, active, reduced, onDown, onMove, onUp, onClick, onKey, disabled }: {
  dx: number; active: boolean; reduced: boolean; disabled: boolean
  onDown(e: PointerEvent<SVGGElement>): void; onMove(e: PointerEvent<SVGGElement>): void; onUp(e: PointerEvent<SVGGElement>): void
  onClick(): void; onKey(e: KeyboardEvent<SVGGElement>): void
}) {
  return (
    <g
      data-spoon-handle role="button" tabIndex={disabled ? -1 : 0} aria-label="Stir the spoon once. Drag sideways, or press Space."
      aria-disabled={disabled || undefined} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onClick={onClick} onKeyDown={onKey} className="nodrag touch-none outline-none focus-visible:outline-none"
      style={{ cursor: disabled ? 'default' : 'grab' }}
    >
      <g transform={`translate(${dx} 0)`} style={active || dx !== 0 ? { transition: reduced ? undefined : 'transform 260ms ease' } : undefined}>
        {/* a broad invisible grip, then the visible stainless-steel spoon */}
        <path d="M 239 10 L 190 111" stroke="transparent" strokeWidth={34} />
        <ellipse cx={178} cy={133} rx={20} ry={28} fill="transparent" />
        <path d="M 237 13 L 189 113" stroke={SPOON_DARK} strokeWidth={9} strokeLinecap="round" />
        <path d="M 236 12 L 188 111" stroke={SPOON} strokeWidth={6} strokeLinecap="round" />
        <path d="M 234 12 L 188 108" stroke={SPOON_LIGHT} strokeWidth={1.7} strokeLinecap="round" />
        <ellipse cx={179} cy={130} rx={12} ry={20} transform="rotate(23 179 130)" fill={SPOON} stroke={SPOON_DARK} strokeWidth={1.5} />
        <ellipse cx={178} cy={128} rx={7.5} ry={14.5} transform="rotate(23 178 128)" fill={SPOON_LIGHT} stroke={SPOON_DARK} strokeWidth={0.8} />
        {/* visible grip marks, so the handle reads as movable without relying on a cursor */}
        <path d="M 226 31 l 8 3 M 222 39 l 8 3 M 218 47 l 8 3" stroke={SPOON_DARK} strokeWidth={1.4} strokeLinecap="round" />
        <rect x={204} y={29} width={54} height={17} rx={5} fill="transparent" />
      </g>
    </g>
  )
}

/** Three still-able frames of a stir: crystals travel around the beaker, then settle or are too small to see. */
function Swirl({ material, phase, lumps }: { material: MaterialName; phase: number; lumps: boolean }) {
  const look = MATERIAL[material]
  const points = [
    [[143, 107], [167, 91], [210, 103], [222, 137], [157, 148], [200, 153]],
    [[211, 92], [227, 122], [197, 151], [150, 142], [137, 113], [177, 89]],
    [[174, 97], [218, 118], [187, 148], [145, 125], [206, 105], [159, 150]],
  ][phase]
  return (
    <g data-swirl={phase} opacity={phase === 2 ? 0.62 : 0.9} pointerEvents="none">
      {points.map(([x, y], i) => <Crystal key={i} x={x} y={y} size={lumps ? 9 : 5.5} edge={look.edge} fill={look.fill} turn={i * 23} />)}
      <path d={phase === 1 ? 'M 139 127 Q 172 157 215 135' : 'M 147 113 Q 179 87 214 111'} fill="none" stroke={WATER_LINE} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
    </g>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <p className="m-0 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
    </p>
  )
}

const g = (n: number) => `${Number(n.toFixed(1))} g`

export function DissolvingView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? dissolvingEngine.solve(config) : (state ?? {})
  const material: MaterialName = config.task === 'stir' && config.substance in MATERIAL ? config.substance as MaterialName : 'sugar'
  const lumps = config.task === 'stir' && config.pieces === 'lumps'
  const strokes = strokeCount(config, now)
  const need = strokesNeeded(config)
  const spoons = spoonCount(config, now)
  const temperature = temperatureOf(config, now)
  const left = solidLeft(config, now)
  const stirringDone = config.task === 'stir' && strokes >= need
  const [dragX, setDragX] = useState<number | null>(null)
  const [swirl, setSwirl] = useState<number | null>(null)
  const drag = useRef<{ id: number; last: number; travel: number } | null>(null)
  const suppressClick = useRef(false)
  const previousStrokes = useRef(strokes)

  useEffect(() => {
    if (previousStrokes.current === strokes) return
    previousStrokes.current = strokes
    if (reduced) { setSwirl(null); return }
    setSwirl(0)
    const a = setTimeout(() => setSwirl(1), 300)
    const b = setTimeout(() => setSwirl(2), 600)
    const c = setTimeout(() => setSwirl(null), 950)
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c) }
  }, [strokes, reduced])

  const stir = () => {
    if (locked || config.task !== 'stir' || strokeCount(config, now) >= need) return
    setState({ ...now, strokes: Math.min(need, strokes + 1) })
  }
  const onDown = (e: PointerEvent<SVGGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, last: e.clientX, travel: 0 }
    setDragX(0)
  }
  const onMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const svg = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const delta = (e.clientX - d.last) * (W / svg.width)
    d.last = e.clientX
    d.travel += Math.abs(delta)
    setDragX((x) => Math.max(-30, Math.min(30, (x ?? 0) + delta)))
  }
  const onUp = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    suppressClick.current = d.travel >= 30
    drag.current = null
    setDragX(null)
    // Thirty SVG pixels of travel in either direction is a generous, visible stir, not a fine-motor target.
    if (d.travel >= 30) stir()
  }
  const onClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return }
    stir()
  }
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key.startsWith('Arrow')) e.stopPropagation()
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      stir()
    }
  }

  const addSpoon = () => {
    if (locked || config.task !== 'saturate') return
    const limit = coldSpoons(config)
    if (spoons >= limit) return
    const next = spoons + 1
    setState({ ...now, spoons: next, temperature, sawCold: now.sawCold === true || (temperature === 20 && next >= limit) })
  }
  const setTemperature = (next: number) => {
    if (locked || config.task !== 'saturate') return
    setState({ ...now, spoons, temperature: next, sawCold: now.sawCold === true || (next === 20 && spoons >= coldSpoons(config)) })
  }

  const dx = dragX ?? (swirl === null ? 0 : [0, 16, -12][swirl])
  const seen = config.task === 'stir'
    ? `A glass beaker with 20 grams of water and 10 grams of ${material}, at ${temperature} degrees Celsius. A spoon is in the water. ${g(left)} of solid is visible. The combined mass of water and solid is ${totalMass()} grams.`
    : `A glass beaker with ${config.water} grams of water at ${temperature} degrees Celsius. ${spoons * 10} grams of sugar has been added. ${g(left)} of solid is visible at the bottom.`
  const verdict = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const caption = config.task === 'stir'
    ? `${lumps ? 'Lumps' : 'Grains'} of ${material} in 20 g of water`
    : `${config.water} g of water · each spoonful is 10 g of sugar`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none" fontFamily={FONT}>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <text x={24} y={25} fontSize={12} fontWeight={700} fill={SOFT}>{config.task === 'stir' ? 'Stirring test' : 'Sugar and water'}</text>
          <Water />
          {swirl !== null && config.task === 'stir' && <Swirl material={material} phase={swirl} lumps={lumps} />}
          <SolidPile material={material} left={left} lumps={lumps} reduced={reduced} />
          {config.task === 'stir' && (
            <Spoon dx={dx} active={swirl !== null} reduced={reduced} disabled={locked || stirringDone} onDown={onDown} onMove={onMove} onUp={onUp} onClick={onClick} onKey={onKey} />
          )}
          <BeakerGlass />
          <text x={133} y={119} fontSize={12} fontWeight={700} fill={SOFT}>{config.task === 'stir' ? 20 : config.water} g</text>
          <text x={180} y={209} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>water</text>
          <Thermometer temperature={temperature} />
          {config.task === 'saturate' && (
            <g transform="translate(54 103)" aria-hidden="true">
              <path d="M -22 -28 Q 0 -35 22 -28 L 18 30 Q 0 36 -18 30 Z" fill="#FFFFFF" stroke={GLASS} strokeWidth={1.6} />
              <path d="M -21 -18 Q 0 -11 21 -18 L 18 30 Q 0 36 -18 30 Z" fill="#F4F6F8" />
              <ellipse cx={0} cy={-28} rx={22} ry={6} fill="#E2E8F0" stroke={GLASS} strokeWidth={1.4} />
              {[[-9, -26], [1, -28], [10, -25], [-3, -23]].map(([x, y], i) => <Crystal key={i} x={x} y={y} size={5} fill="#FFFFFF" edge="#94A3B8" />)}
              <text x={0} y={54} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>sugar</text>
            </g>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
      </figure>

      {config.task === 'stir' ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Spoon</span>
          <button type="button" aria-label="Stir once" disabled={locked || stirringDone} onClick={stir} className={ACTION}>{stirringDone ? 'Stirred' : 'Stir once'}</button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Sugar</span>
            <button type="button" aria-label="Add a 10 g spoonful of sugar" disabled={locked || spoons >= coldSpoons(config)} onClick={addSpoon} className={ACTION}>
              {spoons >= coldSpoons(config) ? 'Spoonful added' : 'Add 10 g spoonful'}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Water temperature</span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Cool the water" disabled={locked || temperature <= 20} onClick={() => setTemperature(Math.max(20, temperature - 20))} className={STEP}>−</button>
              <span className="min-w-[54px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{temperature} °C</span>
              <button type="button" aria-label="Warm the water" disabled={locked || temperature >= 60} onClick={() => setTemperature(Math.min(60, temperature + 20))} className={STEP}>+</button>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
        {config.task === 'stir' ? (
          <><Readout label="Solid left" value={g(left)} /><Readout label="Total mass" value={`${totalMass()} g`} /></>
        ) : (
          <><Readout label="Sugar added" value={g(spoons * 10)} /><Readout label="Solid at bottom" value={g(left)} /></>
        )}
      </div>
      {config.task === 'stir' && !stirringDone && (
        <p className="m-0 text-center text-[12px] font-semibold text-ss-slate">Drag the spoon sideways, or press Stir once.</p>
      )}
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="m-0 text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
