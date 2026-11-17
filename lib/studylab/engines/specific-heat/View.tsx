'use client'
import { useId, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { HeatConfig, HeatState, MaterialName } from './config'
import { energyFor, madeText, temperatureFor, working } from './config'

type Props = SceneViewProps<HeatConfig, HeatState>

// One light apparatus plate in both themes, as on the measuring cylinder. Every material keeps its own colour.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#263B52'
const SOFT = '#53657A'
const GLASS = '#E7EEF5'
const WATER = '#5B9FD8'
const WATER_EDGE = '#367CB8'
const WATER_LIGHT = '#A8D1EC'
const METAL = '#AEB9C4'
const METAL_EDGE = '#657688'
const METAL_LIGHT = '#DCE3E9'
const METAL_DARK = '#8795A3'
const MERCURY = '#D94B45'
const MERCURY_DARK = '#A83232'
const GOAL = '#C2762A'
const COIL = '#B8473F'
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 250
export const TEMP_TOP = 46
export const TEMP_BOTTOM = 172
export const TEMP_MIN = 20
export const TEMP_MAX = 160
export const SCALE_X = 210
export const WATER_X = 70
export const METAL_X = 290
const TEMP_X = { water: 106, aluminium: 254 }
const DASH_Y = 30

export const yForTemp = (t: number) => TEMP_BOTTOM - ((Math.max(TEMP_MIN, Math.min(TEMP_MAX, t)) - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * (TEMP_BOTTOM - TEMP_TOP)
export const formatTemp = (t: number) => `${Math.round(t)}`
export const formatEnergy = (e: number) => `${Number(e.toFixed(1))}`

const ease = (reduced: boolean) => reduced ? undefined : { transition: 'y 850ms ease, cy 850ms ease, height 850ms ease, fill 450ms ease' }
const coilEase = (reduced: boolean) => reduced ? undefined : { transition: 'stroke 500ms ease' }

/** The apparatus's thermometer, with a real glass stem, bulb, graduations and moving alcohol column. */
function Thermometer({ material, temp, goal, reduced }: { material: MaterialName; temp: number; goal: number | null; reduced: boolean }) {
  const x = TEMP_X[material]
  const y = yForTemp(temp)
  const gy = goal === null ? null : yForTemp(goal)
  const ticks = [20, 40, 60, 80, 100, 120, 140, 160]
  const outward = material === 'water' ? 1 : -1
  return (
    <g fontFamily={FONT}>
      {/* The thin glass sheath and its pale backing keep the scale readable. */}
      <rect x={x - 8} y={TEMP_TOP - 10} width={16} height={TEMP_BOTTOM - TEMP_TOP + 13} rx={8} fill="#FFFFFF" stroke={EDGE} strokeWidth={1.4} />
      <rect x={x - 3.5} y={TEMP_TOP - 2} width={7} height={TEMP_BOTTOM - TEMP_TOP + 5} rx={3.5} fill="#EEF2F6" />
      <rect data-column={material} x={x - 2.2} y={y} width={4.4} height={Math.max(0, TEMP_BOTTOM - y)} fill={MERCURY} style={ease(reduced)} />
      <circle data-bulb={material} cx={x} cy={TEMP_BOTTOM + 1} r={6.5} fill={MERCURY} stroke={MERCURY_DARK} strokeWidth={1.2} style={ease(reduced)} />
      <rect x={x - 6.3} y={TEMP_TOP - 8} width={3} height={TEMP_BOTTOM - TEMP_TOP + 3} rx={1.5} fill="#FFFFFF" opacity={0.72} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x + outward * 9} x2={x + outward * (t % 40 === 0 ? 16 : 13)} y1={yForTemp(t)} y2={yForTemp(t)} stroke={SOFT} strokeWidth={1.2} />
          {t % 40 === 0 && <text x={x + outward * 20} y={yForTemp(t) + 4} textAnchor={outward === 1 ? 'start' : 'end'} fontSize={12} fontWeight={650} fill={SOFT}>{t}</text>}
        </g>
      ))}
      {gy !== null && goal !== null && (
        <g>
          <line x1={x - 14} x2={x + 12} y1={gy} y2={gy} stroke={GOAL} strokeWidth={1.8} strokeDasharray="4 3" />

        </g>
      )}
    </g>
  )
}

/** A glass beaker, with a pouring lip, graduations, a flat water surface and a visible base. */
function Beaker() {
  return (
    <g>
      <path d="M38 65 H42 V163 Q42 172 53 172 H88 Q99 172 99 163 V65 H103" fill={GLASS} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M44 94 Q70 90 97 94 V163 Q97 169 88 169 H53 Q44 169 44 163 Z" fill={WATER} />
      <ellipse cx={70.5} cy={94} rx={26.5} ry={4} fill={WATER_LIGHT} stroke={WATER_EDGE} strokeWidth={1} />
      <path d="M49 101 V158 Q49 164 55 165" fill="none" stroke={WATER_LIGHT} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      <path d="M38 65 H49 M92 65 H103" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {[108, 122, 136, 150].map((y, i) => <line key={y} x1={83} x2={i % 2 ? 89 : 94} y1={y} y2={y} stroke={WATER_EDGE} strokeWidth={1.3} />)}
      <path d="M45 164 Q70 168 96 164" fill="none" stroke={WATER_EDGE} strokeWidth={1.2} opacity={0.7} />
    </g>
  )
}

/** A solid aluminium block: machined top, two visible faces and fine brushed-metal lines. */
function AluminiumBlock() {
  return (
    <g strokeLinejoin="round">
      <path d="M251 110 L263 99 H322 L310 110 Z" fill={METAL_LIGHT} stroke={METAL_EDGE} strokeWidth={1.6} />
      <path d="M310 110 L322 99 V159 L310 170 Z" fill={METAL_DARK} stroke={METAL_EDGE} strokeWidth={1.6} />
      <rect x={251} y={110} width={59} height={60} rx={2} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.6} />
      {[121, 132, 143, 154, 163].map((y) => <line key={y} x1={258} x2={301} y1={y} y2={y} stroke={METAL_LIGHT} strokeWidth={1.2} opacity={0.75} />)}
      <path d="M258 114 V164" stroke="#EEF2F5" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <text x={280.5} y={145} textAnchor="middle" fontFamily={FONT} fontSize={19} fontWeight={750} fill={METAL_EDGE}>Al</text>
    </g>
  )
}

/** An electric hotplate: insulated feet, dark housing, control knob and a coil that reddens with power. */
function Heater({ x, energy, reduced }: { x: number; energy: number; reduced: boolean }) {
  const hot = energy > 0
  return (
    <g>
      <rect x={x - 43} y={176} width={86} height={22} rx={5} fill="#465466" stroke={INK} strokeWidth={1.5} />
      <rect x={x - 35} y={197} width={12} height={4} rx={1.5} fill={INK} />
      <rect x={x + 23} y={197} width={12} height={4} rx={1.5} fill={INK} />
      <path d={`M${x - 29} 183 h8 l5 7 h8 l5 -7 h8 l5 7 h8 l5 -7 h8`} fill="none" stroke={hot ? COIL : '#929DAA'} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" style={coilEase(reduced)} />
      <circle cx={x + 32} cy={192} r={4} fill="#D8DEE5" stroke={INK} strokeWidth={1} />
      <line x1={x + 32} y1={192} x2={x + 34} y2={189} stroke={INK} strokeWidth={1.2} />
    </g>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function EnergyControl({ material, config, value, set, locked }: { material: MaterialName | null; config: HeatConfig; value: number; set(v: number): void; locked: boolean }) {
  const id = useId()
  const label = material ? `Energy to ${material}` : 'Energy to each sample'
  const name = material ?? 'each'
  const setStep = (v: number) => set(Math.max(0, Math.min(180, v)))
  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') e.stopPropagation()
  }
  const drag = (e: PointerEvent<HTMLInputElement>) => {
    // Native range handles mouse, touch and keyboard; this only keeps the board still while dragging.
    e.stopPropagation()
  }
  return (
    <div className="flex flex-col gap-1" data-control={name}>
      <div className="flex items-center justify-between gap-2">
        <label id={id} htmlFor={`${id}-range`} className="text-[12px] font-bold text-ss-slate">{label}</label>
        <span className="flex items-center gap-1">
          <button type="button" aria-label={`Use 3 kJ less energy for ${name}`} disabled={locked || value <= 0} onClick={() => setStep(value - 3)} className={STEP}>−</button>
          <span className="min-w-[64px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">{formatEnergy(value)} kJ</span>
          <button type="button" aria-label={`Use 3 kJ more energy for ${name}`} disabled={locked || value >= 180} onClick={() => setStep(value + 3)} className={STEP}>+</button>
        </span>
      </div>
      <input
        id={`${id}-range`} aria-labelledby={id} type="range" min={0} max={180} step={3} value={value} disabled={locked}
        onChange={(e) => setStep(Number(e.target.value))} onKeyDown={keyDown} onPointerDown={drag}
        className="nodrag h-5 w-full cursor-pointer touch-none accent-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

function describe(config: HeatConfig, wt: number, at: number): string {
  return `${config.mass} kg of water at ${formatTemp(wt)} degrees Celsius in a beaker, and ${config.mass} kg of aluminium at ${formatTemp(at)} degrees Celsius in a block. Both start at 20 degrees. ${config.task === 'match' ? `Each has its own energy control. Both goals are ${config.target} degrees.` : `One control gives both samples the same energy. The goal is ${config.target} degrees for ${config.material}.`}`
}

export function SpecificHeatView({ config, state, setState, marked, reduced, locked }: Props) {
  const waterEnergy = energyFor(config, state, 'water')
  const aluminiumEnergy = energyFor(config, state, 'aluminium')
  const waterTemp = temperatureFor(config, state, 'water')
  const aluminiumTemp = temperatureFor(config, state, 'aluminium')
  const verdict = marked === 'right' || marked === 'shown' ? working(config, state) : null
  const wrong = marked === 'wrong' ? madeText(config, state) : ''
  const setEnergy = (material: MaterialName | null, value: number) => {
    if (locked) return
    if (material === null) setState({ energy: value })
    else setState(config.task === 'match' ? { water: waterEnergy, aluminium: aluminiumEnergy, [material]: value } : { energy: value })
  }
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, waterTemp, aluminiumTemp)} className="block h-auto w-full select-none" fontFamily={FONT}>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          {/* The goal strip spans the whole apparatus: these are temperatures, not amounts of heat. */}
          <line x1={16} x2={W - 16} y1={DASH_Y} y2={DASH_Y} stroke={EDGE} strokeWidth={1} />
          <text x={180} y={20} textAnchor="middle" fontSize={12} fontWeight={750} fill={SOFT}>Temperature (°C)</text>
          <Thermometer material="water" temp={waterTemp} goal={config.task === 'match' || config.material === 'water' ? config.target : null} reduced={reduced} />
          <Thermometer material="aluminium" temp={aluminiumTemp} goal={config.task === 'match' || config.material === 'aluminium' ? config.target : null} reduced={reduced} />
          <Beaker />
          <AluminiumBlock />
          <Heater x={WATER_X} energy={waterEnergy} reduced={reduced} />
          <Heater x={METAL_X} energy={aluminiumEnergy} reduced={reduced} />
          <text x={WATER_X} y={220} textAnchor="middle" fontSize={13} fontWeight={750} fill={INK}>Water</text>
          <text x={METAL_X} y={220} textAnchor="middle" fontSize={13} fontWeight={750} fill={INK}>Aluminium</text>
          <text x={WATER_X} y={238} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>{config.mass} kg</text>
          <text x={METAL_X} y={238} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>{config.mass} kg</text>
        </svg>
        <figcaption className="flex items-center justify-center gap-8 text-center text-[12px] font-bold text-ss-slate" aria-hidden="true">
          <span className="flex items-baseline gap-1.5"><span>Water</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-temp="water">{formatTemp(waterTemp)} °C</span></span>
          <span className="flex items-baseline gap-1.5"><span>Aluminium</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-temp="aluminium">{formatTemp(aluminiumTemp)} °C</span></span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {config.task === 'match' ? (
          <>
            <EnergyControl material="water" config={config} value={waterEnergy} set={(v) => setEnergy('water', v)} locked={locked} />
            <EnergyControl material="aluminium" config={config} value={aluminiumEnergy} set={(v) => setEnergy('aluminium', v)} locked={locked} />
          </>
        ) : <EnergyControl material={null} config={config} value={waterEnergy} set={(v) => setEnergy(null, v)} locked={locked} />}
        <p className="m-0 text-center text-[12px] font-semibold text-ss-slate">
          {config.task === 'match' ? `Goal: both at ${config.target} °C. Heat each sample separately.` : `Goal: ${config.material} at ${config.target} °C. Both get the same energy.`}
        </p>
      </div>
      <span className="sr-only" aria-live="polite">Water {formatTemp(waterTemp)} degrees Celsius. Aluminium {formatTemp(aluminiumTemp)} degrees Celsius.</span>
      <Verdict marked={marked} lead={verdict?.lead ?? ''} detail={verdict?.detail ?? ''} wrong={wrong} />
    </div>
  )
}

function Verdict({ marked, lead, detail, wrong }: { marked: SceneMarked; lead: string; detail: string; wrong: string }) {
  if (marked === 'idle') return null
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="m-0 text-[13px] font-extrabold leading-snug text-ss-ink">{marked === 'wrong' ? wrong : lead}</p>
      {marked !== 'wrong' && <p className="mb-0 mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{detail}</p>}
    </div>
  )
}
