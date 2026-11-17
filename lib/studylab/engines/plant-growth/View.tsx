'use client'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { PlantConfig, PlantState } from './config'
import { conditionsOf, liveCaption, madeText, outcomeOf, plantGrowthEngine, working } from './config'

type Props = SceneViewProps<PlantConfig, PlantState>
type Pt = { x: number; y: number }

// A quiet, light windowsill in both themes. The materials keep their own colours, as measure-shape's glass does.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#475569'
const GLASS = '#E8F1F5'
const GLASS_EDGE = '#94A3B8'
const WATER = '#4A90C2'
const SOIL = '#66503B'
const SOIL_LIGHT = '#8A6B4D'
const POT = '#C77C54'
const POT_EDGE = '#8F5138'
const GREEN = '#4F8A4C'
const GREEN_DARK = '#316437'
const GREEN_LIGHT = '#79A85B'
const PALE = '#D2C768'
const YELLOW = '#D9BC4E'
const STEM = '#668B45'
const COTTON = '#FFFFFF'
const BEAN = '#B98B62'
const BEAN_EDGE = '#79573D'
const CAN = '#6E91A8'
const CAN_EDGE = '#3F6177'
const BOTTLE = '#F1E7D2'
const BOTTLE_EDGE = '#8B7355'
const FONT = 'system-ui, sans-serif'
const STEP = 'nodrag flex min-h-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export const plantPanel = { width: 360, height: 256 }
export const waterStart = { x: 58, y: 155 }
export const soilTarget = { x: 157, y: 215 }

function WateringCan({ tipped = false }: { tipped?: boolean }) {
  return (
    <svg viewBox="0 0 76 62" className="block h-[52px] w-[64px] overflow-visible" aria-hidden="true">
      <g transform={tipped ? 'rotate(-24 36 32)' : undefined}>
        {/* handle, spout, body and top opening: a small real metal watering can */}
        <path d="M48 24 C70 13 74 45 52 43" fill="none" stroke={CAN_EDGE} strokeWidth={7} />
        <path d="M49 25 C65 18 68 40 53 39" fill="none" stroke={PLATE} strokeWidth={3} />
        <path d="M23 33 L5 19 L1 24 L22 43 Z" fill={CAN} stroke={CAN_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M1 19 L8 17 L12 22 L4 27 Z" fill={CAN_EDGE} />
        <path d="M20 25 L51 25 L48 55 L23 55 Z" fill={CAN} stroke={CAN_EDGE} strokeWidth={1.8} strokeLinejoin="round" />
        <ellipse cx={35.5} cy={25} rx={15.5} ry={4.5} fill={CAN_EDGE} />
        <ellipse cx={35.5} cy={25} rx={10} ry={2.4} fill={WATER} />
        <path d="M27 34 L27 48" stroke="#A9C1D0" strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {tipped && <path d="M6 27 Q0 39 5 51" fill="none" stroke={WATER} strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />}
    </svg>
  )
}

function FeedBottle({ mineral, tipped = false }: { mineral: 'nitrate' | 'magnesium'; tipped?: boolean }) {
  return (
    <svg viewBox="0 0 42 68" className="block h-[58px] w-[36px] overflow-visible" aria-hidden="true">
      <g transform={tipped ? 'rotate(-28 20 35)' : undefined}>
        <path d="M15 8 H27 V16 L31 22 V59 Q31 63 27 63 H15 Q11 63 11 59 V22 L15 16 Z" fill={BOTTLE} stroke={BOTTLE_EDGE} strokeWidth={1.6} />
        <rect x={14} y={3} width={14} height={8} rx={2} fill={mineral === 'nitrate' ? '#7C9B78' : '#9B829F'} stroke={BOTTLE_EDGE} strokeWidth={1.2} />
        <rect x={13} y={30} width={16} height={22} rx={2} fill="#FFFFFF" stroke={BOTTLE_EDGE} strokeWidth={1} />
        <path d="M16 46 H26" stroke={BOTTLE_EDGE} strokeWidth={1.2} />
      </g>
      {tipped && <path d="M7 18 Q0 30 5 42" fill="none" stroke={WATER} strokeWidth={2.5} strokeDasharray="2 5" strokeLinecap="round" />}
    </svg>
  )
}

/** A real pointer drag, with tap and Enter as the generous non-drag alternative. */
function DragThing({ id, label, start, target, active, locked, reduced, onUse, children }: {
  id: string; label: string; start: Pt; target: Pt; active: boolean; locked: boolean; reduced: boolean; onUse(): void; children(pouring: boolean): ReactNode
}) {
  const [at, setAt] = useState(start)
  const [pouring, setPouring] = useState(false)
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)
  const suppress = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => { setAt(pouring ? target : start) }, [pouring, start.x, start.y, target.x, target.y])
  const use = () => {
    const adding = !active
    onUse()
    if (timer.current) clearTimeout(timer.current)
    if (adding && !reduced) {
      setPouring(true)
      timer.current = setTimeout(() => setPouring(false), 850)
    } else setPouring(false)
  }
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (locked || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y, moved: false }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const scale = 360 / e.currentTarget.parentElement!.getBoundingClientRect().width
    const x = Math.max(22, Math.min(338, d.px + (e.clientX - d.x) * scale))
    const y = Math.max(28, Math.min(232, d.py + (e.clientY - d.y) * scale))
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
    setAt({ x, y })
  }
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) {
      suppress.current = true
      if (Math.hypot(at.x - target.x, at.y - target.y) < 76) use()
      else setAt(start)
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key.startsWith('Arrow')) {
      e.preventDefault(); e.stopPropagation()
      const dx = e.key === 'ArrowLeft' ? -12 : e.key === 'ArrowRight' ? 12 : 0
      const dy = e.key === 'ArrowUp' ? -12 : e.key === 'ArrowDown' ? 12 : 0
      setAt((p) => ({ x: Math.max(22, Math.min(338, p.x + dx)), y: Math.max(28, Math.min(232, p.y + dy)) }))
    }
  }
  return (
    <button
      type="button" data-drag={id} aria-label={label} disabled={locked}
      className="nodrag absolute z-10 flex touch-none items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default"
      style={{ left: `${(at.x / 360) * 100}%`, top: `${(at.y / 256) * 100}%`, transform: 'translate(-50%, -50%)', width: 66, height: 62, background: 'transparent', border: 0, padding: 0, cursor: locked ? 'default' : 'grab' }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setAt(start) }} onKeyDown={key}
      onClick={() => { if (suppress.current) { suppress.current = false; return } use() }}
    >{children(pouring)}</button>
  )
}

function BlindCord({ closed, locked, reduced, toggle }: { closed: boolean; locked: boolean; reduced: boolean; toggle(): void }) {
  const [pull, setPull] = useState(0)
  const start = useRef<{ y: number; moved: boolean } | null>(null)
  const suppress = useRef(false)
  const y = (closed ? 109 : 67) + pull
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (locked || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, moved: false }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return
    const scale = 276 / e.currentTarget.parentElement!.getBoundingClientRect().height
    const next = Math.max(-22, Math.min(35, (e.clientY - start.current.y) * scale))
    if (Math.abs(next) > 4) start.current.moved = true
    setPull(next)
  }
  const up = () => {
    if (start.current?.moved) {
      suppress.current = true
      if ((closed && pull > 13) || (!closed && pull < -13)) toggle()
    }
    start.current = null; setPull(0)
  }
  return (
    <>
      <svg viewBox="0 0 360 256" className="pointer-events-none absolute inset-0 h-auto w-full" aria-hidden="true">
        <line x1={329} x2={329} y1={22} y2={y - 4} stroke={SOFT} strokeWidth={1.5} />
      </svg>
      <button
        type="button" data-drag="blind" aria-label={closed ? 'Blind cord. Pull down or press Enter to open the blind' : 'Blind cord. Pull up or press Enter to close the blind'} disabled={locked}
        className="nodrag absolute z-10 touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        style={{ left: `${(329 / 360) * 100}%`, top: `${(y / 256) * 100}%`, width: 28, height: 34, transform: 'translate(-50%, -50%)', border: 0, background: 'transparent', padding: 0, cursor: locked ? 'default' : 'grab' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setPull(0) }}
        onKeyDown={(e) => { if (e.key.startsWith('Arrow')) { e.preventDefault(); e.stopPropagation(); if (e.key === 'ArrowDown' && closed) toggle(); if (e.key === 'ArrowUp' && !closed) toggle() } }}
        onClick={() => { if (suppress.current) { suppress.current = false; return } toggle() }}
      >
        <svg viewBox="0 0 28 34" aria-hidden="true"><ellipse cx={14} cy={17} rx={7} ry={10} fill="#FFFFFF" stroke={SOFT} strokeWidth={2} /><path d="M14 10 V24" stroke={SOFT} strokeWidth={1.5} /></svg>
      </button>
    </>
  )
}

function Window({ closed, reduced }: { closed: boolean; reduced: boolean }) {
  return (
    <g>
      <rect x={225} y={34} width={118} height={127} rx={3} fill="#FFFFFF" stroke={GLASS_EDGE} strokeWidth={2} />
      <rect x={231} y={40} width={106} height={115} fill={closed ? '#D8DEE3' : '#DCEEF5'} />
      {!closed && <>
        <circle cx={315} cy={62} r={12} fill="#E7C968" stroke="#B79B45" strokeWidth={1.2} />
        <path d="M231 132 Q253 105 278 127 Q309 91 337 119 V155 H231 Z" fill="#B7CDA7" />
        <path d="M284 40 V155 M231 98 H337" stroke="#FFFFFF" strokeWidth={4} />
      </>}
      {/* roller blind: horizontal fabric folds, never a dark stage */}
      <rect x={228} y={35} width={112} height={closed ? 119 : 24} rx={2} fill="#E7E1D7" stroke="#A79E90" strokeWidth={1.4} style={reduced ? undefined : { transition: 'height 700ms ease' }} />
      {closed && [58, 80, 102, 124, 146].map((y) => <line key={y} x1={230} x2={338} y1={y} y2={y} stroke="#C7BFB3" strokeWidth={1} />)}
      <rect x={224} y={29} width={120} height={8} rx={3} fill="#B4A898" />
      <text x={335} y={177} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{closed ? 'Blind closed' : 'Blind open'}</text>
    </g>
  )
}

function Thermometer({ warm }: { warm: boolean }) {
  return (
    <g fontFamily={FONT}>
      <text x={29} y={34} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Air</text>
      <rect x={24} y={43} width={10} height={50} rx={5} fill="#FFFFFF" stroke={GLASS_EDGE} strokeWidth={1.5} />
      <circle cx={29} cy={94} r={8} fill={warm ? '#C9785D' : '#6D9DB9'} stroke={GLASS_EDGE} strokeWidth={1.2} />
      <line x1={29} x2={29} y1={warm ? 57 : 79} y2={94} stroke={warm ? '#C9785D' : '#6D9DB9'} strokeWidth={5} strokeLinecap="round" />
      {[51, 63, 75, 87].map((y) => <line key={y} x1={35} x2={40} y1={y} y2={y} stroke={GLASS_EDGE} strokeWidth={1.2} />)}
      <text x={29} y={116} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>{warm ? '22°C' : '4°C'}</text>
    </g>
  )
}

function Leaf({ x, y, angle, size = 1, colour = GREEN, veins = false, droop = false }: {
  x: number; y: number; angle: number; size?: number; colour?: string; veins?: boolean; droop?: boolean
}) {
  const vein = veins ? GREEN_DARK : '#376B38'
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size} ${droop ? size * 0.78 : size})`}>
      <path d="M0 0 C-18-14-22-37 0-55 C22-37 18-14 0 0 Z" fill={colour} stroke={veins ? GREEN_DARK : '#3E713D'} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M0-1 V-49 M0-14 L-10-24 M0-23 L10-34 M0-32 L-7-40" fill="none" stroke={vein} strokeWidth={veins ? 2.2 : 1.15} strokeLinecap="round" />
      {!veins && <path d="M-3-10 Q-12-26-3-42" fill="none" stroke="#A5C184" strokeWidth={1.1} strokeLinecap="round" opacity={colour === PALE || colour === YELLOW ? 0.5 : 0.75} />}
    </g>
  )
}

function Roots({ x, y, long = false }: { x: number; y: number; long?: boolean }) {
  return (
    <g fill="none" stroke="#F4F0DF" strokeWidth={2.4} strokeLinecap="round">
      <path d={`M${x} ${y} Q${x - 3} ${y + 14} ${x + 2} ${y + (long ? 34 : 25)}`} />
      <path d={`M${x} ${y + 12} L${x - 10} ${y + 21} M${x + 1} ${y + 19} L${x + 10} ${y + 27}`} strokeWidth={1.5} />
    </g>
  )
}

function Germination({ outcome }: { outcome: string }) {
  const sprouted = outcome === 'sprout-dark' || outcome === 'sprout-light'
  const pale = outcome === 'sprout-dark'
  const top = pale ? 62 : 100
  return (
    <g>
      {/* glass dish and cotton wool, visibly not soil */}
      <ellipse cx={157} cy={215} rx={67} ry={11} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.6} />
      <path d="M90 195 V214 Q91 228 157 228 Q223 228 224 214 V195" fill={GLASS} fillOpacity={0.45} stroke={GLASS_EDGE} strokeWidth={1.6} />
      <path d="M99 196 Q103 179 119 187 Q130 173 143 185 Q158 172 171 185 Q188 176 196 190 Q214 187 216 204 Q207 219 157 219 Q108 219 99 206 Z" fill={COTTON} stroke="#C8D0D5" strokeWidth={1.4} />
      {sprouted && <Roots x={157} y={189} long={pale} />}
      <path d="M143 184 Q137 167 151 163 Q169 163 174 179 Q174 193 157 196 Q146 195 143 184 Z" fill={BEAN} stroke={BEAN_EDGE} strokeWidth={1.7} />
      <path d="M157 166 Q151 176 157 186" fill="none" stroke={BEAN_EDGE} strokeWidth={2} strokeLinecap="round" />
      {sprouted && <>
        <path d={pale ? 'M157 172 Q149 130 158 100 Q165 77 157 63' : 'M157 172 Q149 145 158 101'} fill="none" stroke={pale ? PALE : STEM} strokeWidth={pale ? 3.5 : 5.5} strokeLinecap="round" />
        {pale ? <>
          <path d="M157 65 Q145 52 147 43 Q158 43 161 59" fill={PALE} stroke="#A99E48" strokeWidth={1.2} />
          <path d="M158 64 Q168 48 177 50 Q176 61 160 68" fill={PALE} stroke="#A99E48" strokeWidth={1.2} />
        </> : <>
          <Leaf x={156} y={top + 4} angle={-64} size={0.68} colour={GREEN_LIGHT} />
          <Leaf x={158} y={top + 3} angle={61} size={0.7} colour={GREEN} />
        </>}
      </>}
      <ellipse cx={157} cy={196} rx={67} ry={11} fill="none" stroke={GLASS_EDGE} strokeWidth={1.6} />
      <path d="M91 200 Q93 216 105 220" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      <text x={157} y={247} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>cotton wool</text>
    </g>
  )
}

function PotPlant({ outcome, kind, mineral = false }: { outcome: string; kind: PlantConfig['kind']; mineral?: boolean }) {
  const dark = outcome === 'etiolated'
  const wilt = outcome === 'wilted'
  const slow = outcome === 'slow'
  const deficient = outcome === 'nitrate-deficient' || outcome === 'magnesium-deficient'
  const magnesium = kind === 'magnesium' && deficient
  const top = dark ? 58 : slow || deficient ? 128 : 89
  const stemColour = dark ? PALE : STEM
  const mainColour = dark ? PALE : magnesium ? YELLOW : deficient ? GREEN_LIGHT : GREEN
  const lowerColour = dark ? PALE : deficient ? YELLOW : GREEN_LIGHT
  return (
    <g transform={mineral ? 'translate(22 0)' : undefined}>
      {/* roots are inside the soil, with only the plant's real above-ground parts shown */}
      <path d={wilt ? 'M169 217 Q163 170 184 143 Q197 129 188 117' : dark ? 'M169 217 Q160 151 169 102 Q174 75 168 58' : `M169 217 Q160 157 169 ${top}`} fill="none" stroke={stemColour} strokeWidth={dark ? 3.5 : slow || deficient ? 4.5 : 6} strokeLinecap="round" />
      {wilt ? <>
        <path d="M177 157 Q145 145 132 166" fill="none" stroke={STEM} strokeWidth={3.5} />
        <Leaf x={133} y={165} angle={-115} size={0.82} colour="#8E9B52" droop />
        <path d="M184 143 Q207 143 214 166" fill="none" stroke={STEM} strokeWidth={3.5} />
        <Leaf x={214} y={165} angle={112} size={0.83} colour="#8E9B52" droop />
        <Leaf x={188} y={119} angle={26} size={0.7} colour="#9AA45D" droop />
      </> : dark ? <>
        <Leaf x={169} y={105} angle={-68} size={0.55} colour={PALE} />
        <Leaf x={169} y={76} angle={57} size={0.48} colour={PALE} />
        <path d="M168 61 Q157 48 160 40 Q170 43 171 57" fill={PALE} stroke="#A99E48" strokeWidth={1.2} />
      </> : <>
        <path d={`M165 176 Q140 161 127 153 M166 143 Q190 131 205 118`} fill="none" stroke={stemColour} strokeWidth={3.2} strokeLinecap="round" />
        <Leaf x={130} y={156} angle={-69} size={slow || deficient ? 0.66 : 0.86} colour={lowerColour} veins={magnesium} />
        <Leaf x={202} y={121} angle={64} size={slow || deficient ? 0.67 : 0.9} colour={mainColour} veins={magnesium} />
        <Leaf x={169} y={top + 8} angle={-21} size={slow || deficient ? 0.64 : 0.86} colour={mainColour} veins={magnesium} />
        {!slow && !deficient && <Leaf x={165} y={174} angle={74} size={0.76} colour={GREEN_LIGHT} />}
      </>}
      {/* terracotta rim, soil, tapered pot and base */}
      <path d="M118 219 L127 264 Q169 273 211 264 L220 219 Z" fill={POT} stroke={POT_EDGE} strokeWidth={1.8} />
      <path d="M130 258 Q169 266 208 258" fill="none" stroke="#DB9A72" strokeWidth={2} />
      <rect x={111} y={207} width={116} height={22} rx={5} fill={POT} stroke={POT_EDGE} strokeWidth={1.8} />
      <ellipse cx={169} cy={211} rx={52} ry={9} fill={SOIL} stroke={POT_EDGE} strokeWidth={1.4} />
      {[{ x: 137, y: 209 }, { x: 157, y: 214 }, { x: 185, y: 208 }, { x: 201, y: 213 }].map((p) => <ellipse key={p.x} cx={p.x} cy={p.y} rx={4} ry={1.8} fill={SOIL_LIGHT} />)}
      <text x={169} y={248} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill="#623D2D">soil</text>
    </g>
  )
}

function describe(config: PlantConfig, state: PlantState): string {
  const c = conditionsOf(config, state)
  const thing = config.kind === 'germinate' ? 'A bean on cotton wool in a clear glass dish' : 'A young bean plant in a terracotta pot of soil'
  const feed = (config.kind === 'nitrate' || config.kind === 'magnesium') ? ` Two feed bottles, nitrate and magnesium; ${c.feed ? `${c.feed} has been poured` : 'neither has been poured'}.` : ''
  return `${thing}. The blind is ${c.blind ? 'closed' : 'open'}, the air is ${c.warm ? 'warm, 22 degrees Celsius' : 'cold, 4 degrees Celsius'}, and ${c.water ? 'water has been added' : 'no water has been added'}.${feed} ${liveCaption(config, state)}`
}

export function PlantGrowthView({ config, state, setState, marked, reduced, locked }: Props) {
  const shown = marked === 'shown' ? plantGrowthEngine.solve(config) : state
  const c = conditionsOf(config, shown)
  const outcome = outcomeOf(config, shown)
  const mineral = config.kind === 'nitrate' || config.kind === 'magnesium'
  const germ = config.kind === 'germinate'
  const put = (next: Partial<PlantState>) => {
    if (!locked) setState({ water: c.water, blind: c.blind, warm: c.warm, feed: c.feed, ...next })
  }
  const verdict = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, shown) : ''
  const goal = germ ? 'Aim: make the bean sprout' : 'Aim: green, upright growth'
  const feedTarget = { x: 213, y: 199 }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" style={mineral ? { '--subject': '#547E96' } as CSSProperties : undefined}>
      <style>{`.pg-change{animation:pgReveal 700ms ease-out}@keyframes pgReveal{from{opacity:.2}to{opacity:1}}@media(prefers-reduced-motion:reduce){.pg-change{animation:none}}`}</style>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox="0 0 360 256" role="img" aria-label={describe(config, shown)} className="block h-auto w-full select-none" fontFamily={FONT}>
            <rect x={0.75} y={0.75} width={358.5} height={254.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
            <text x={180} y={22} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>{goal}</text>
            <Thermometer warm={c.warm} />
            <Window closed={c.blind} reduced={reduced} />
            <g key={`${outcome}-${c.feed}`} className={reduced ? '' : 'pg-change'}>
              {germ ? <Germination outcome={outcome} /> : <PotPlant outcome={outcome} kind={config.kind} mineral={mineral} />}
            </g>
            {c.water && !germ && <path d={mineral ? 'M157 207 Q167 199 177 207' : 'M135 207 Q145 199 155 207'} fill="none" stroke={WATER} strokeWidth={2} strokeLinecap="round" />}
          </svg>
          <div className="absolute inset-0">
            {!mineral && <BlindCord closed={c.blind} locked={locked} reduced={reduced} toggle={() => put({ blind: !c.blind })} />}
            {!mineral && <DragThing
              id="water" label={germ ? 'Watering can. Drag it to the cotton wool, or press Enter to water' : 'Watering can. Drag it to the soil, or press Enter to water'}
              start={waterStart} target={germ ? { x: 216, y: 199 } : feedTarget} active={c.water} locked={locked} reduced={reduced} onUse={() => put({ water: !c.water })}
            >{(pouring) => <WateringCan tipped={pouring} />}</DragThing>}
            {mineral && (['nitrate', 'magnesium'] as const).map((name, i) => (
              <div key={name}>
                <DragThing
                  id={`feed-${name}`} label={`${name} feed bottle. Drag it to the soil, or press Enter to pour`} start={{ x: 32 + i * 62, y: 159 }} target={{ x: 235, y: 199 }}
                  active={c.feed === name} locked={locked} reduced={reduced} onUse={() => put({ feed: c.feed === name ? '' : name })}
                >{(pouring) => <FeedBottle mineral={name} tipped={pouring} />}</DragThing>
                <span className="pointer-events-none absolute whitespace-nowrap text-center text-[12px] font-bold text-ss-slate" style={{ left: `${((32 + i * 62) / 360) * 100}%`, top: '78%', transform: 'translateX(-50%)' }}>{name === 'nitrate' ? 'Nitrate' : 'Magnesium'}</span>
              </div>
            ))}
          </div>
        </div>
        <figcaption className="min-h-[32px] text-center text-[12px] font-bold leading-snug text-ss-slate" aria-live="polite">{liveCaption(config, shown)}</figcaption>
      </figure>

      <div className="flex flex-col gap-1 border-t border-ss-line pt-1.5">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Water</span>
          <span className="text-[15px] font-extrabold text-ss-ink">{c.water ? 'Added' : 'None'}</span>
        </p>
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Light</span>
          <span className="text-[15px] font-extrabold text-ss-ink">{c.blind ? 'Dark' : 'Light'}</span>
        </p>
      </div>
      {!mineral && <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Air temperature</span>
        <span className="flex gap-1.5" role="group" aria-label="Air temperature">
          <button type="button" aria-label="Set cold air, 4 degrees Celsius" aria-pressed={!c.warm} disabled={locked} onClick={() => put({ warm: false })} className={STEP} style={!c.warm ? { borderColor: 'var(--subject)' } : undefined}>4°C cold</button>
          <button type="button" aria-label="Set warm air, 22 degrees Celsius" aria-pressed={c.warm} disabled={locked} onClick={() => put({ warm: true })} className={STEP} style={c.warm ? { borderColor: 'var(--subject)' } : undefined}>22°C warm</button>
        </span>
      </div>}
      {mineral && <p className="text-center text-[12px] font-semibold text-ss-slate">Feed used: <span className="font-extrabold text-ss-ink">{c.feed ? c.feed : 'none yet'}</span></p>}

      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
