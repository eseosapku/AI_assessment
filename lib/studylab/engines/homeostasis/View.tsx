'use client'
import { useId, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { HomeostasisConfig, HomeostasisState, Vessels } from './config'
import {
  bandText, bloodCount, glucagonOf, heatLoss, homeostasisEngine, insulinOf, madeText, readingOf, readingText, shiverOf, storeCount,
  sweatOf, vesselsOf, working,
} from './config'

type Props = SceneViewProps<HomeostasisConfig, HomeostasisState>
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const HAIR = '#DCE3EA'
const BLUE = '#2563A8'
const BAND = '#D9EADF'
const BAND_EDGE = '#56836A'
const BLOOD = '#D98282'
const BLOOD_DARK = '#8F414B'
const VESSEL = '#F4C5BC'
const GOLD = '#E8B94E'
const GOLD_EDGE = '#795314'
const LIVER = '#A8584E'
const LIVER_DARK = '#713832'
const PANCREAS = '#E4B878'
const SKIN = '#F0C9AC'
const EPIDERMIS = '#E5B493'
const DERMIS = '#F4D6BC'
const SWEAT = '#74A9C7'
const MUSCLE = '#C97B70'
const W = 360
const H = 242

const INSULIN = '#2F6FB0'
const GLUCAGON = '#8A4FB3'
const HEAT = '#D9622B'
const ease = (reduced: boolean) => reduced ? undefined : { transition: 'transform 750ms ease, opacity 500ms ease, stroke-width 500ms ease' }
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const WIDE = 'nodrag inline-flex h-8 flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-extrabold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const SEG = 'nodrag inline-flex h-7 select-none items-center justify-center whitespace-nowrap rounded-md px-2 text-[12px] font-extrabold touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const LEVEL_WORDS = ['none', 'some', 'lots']

function Scale({ config, state }: { config: HomeostasisConfig; state: HomeostasisState }) {
  const glucose = config.task === 'glucose'
  const min = glucose ? 0 : 34
  const max = glucose ? 12 : 40
  const top = 38
  const bottom = 177
  const x = 302
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top)
  const band = glucose ? { low: 4, high: 6 } : { low: 36.5, high: 37.5 }
  const value = readingOf(config, state)
  const at = y(Math.max(min, Math.min(max, value)))
  const ticks = glucose ? [0, 2, 4, 6, 8, 10, 12] : [34, 35, 36, 37, 38, 39, 40]
  return (
    <g fontFamily="system-ui, sans-serif">
      <text x={302} y={17} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{glucose ? 'Blood glucose' : 'Core temperature'}</text>
      <rect x={287} y={y(band.high)} width={30} height={y(band.low) - y(band.high)} fill={BAND} stroke={BAND_EDGE} strokeWidth={1} />
      <line x1={x} x2={x} y1={top} y2={bottom} stroke={INK} strokeWidth={2} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x} x2={x + 7} y1={y(t)} y2={y(t)} stroke={INK} strokeWidth={1.3} />
          <text x={x + 10} y={y(t) + 4} fontSize={12} fontWeight={600} fill={SOFT}>{t}</text>
        </g>
      ))}
      <g style={{ transition: 'transform 750ms ease' }} transform={`translate(0 ${at.toFixed(1)})`}>
        <line x1={282} x2={309} y1={0} y2={0} stroke={BLUE} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M 274 -6 L 283 0 L 274 6 Z" fill={BLUE} />
      </g>
      <text data-ink="" x={302} y={202} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK} data-reading="">{value.toFixed(1)}</text>
      <text x={302} y={218} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{glucose ? 'mmol/L' : '°C'}</text>
    </g>
  )
}

function Hex({ x, y }: { x: number; y: number }) {
  return <path d="M -6 -3.5 L 0 -7 L 6 -3.5 L 6 3.5 L 0 7 L -6 3.5 Z" transform={`translate(${x} ${y})`} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1.2} />
}

function GlucosePicture({ config, state, reduced }: { config: HomeostasisConfig; state: HomeostasisState; reduced: boolean }) {
  const blood = bloodCount(config, state)
  const store = storeCount(config, state)
  const insulin = insulinOf(state)
  const glucagon = glucagonOf(state)
  const bloodSlots = Array.from({ length: 12 }, (_, i) => ({ x: 47 + (i % 2) * 24, y: 58 + Math.floor(i / 2) * 22 }))
  const storeSlots = Array.from({ length: 12 }, (_, i) => ({ x: 150 + (i % 4) * 21, y: 134 + Math.floor(i / 4) * 19 }))
  // A dose flies from where it is made (or injected) to the liver, which it acts on.
  const from = config.diabetes ? { x: 30, y: 214 } : { x: 158, y: 60 }
  return (
    <g>
      <style>{'@keyframes hm-fly { from { transform: translate(var(--fx), var(--fy)); opacity: 1 } 80% { opacity: 1 } to { transform: translate(0, 0); opacity: 0 } }'}</style>
      {/* A short wide vein: wall, lumen and tapered branches. */}
      <path d="M 27 43 Q 59 30 91 43 L 91 187 Q 59 202 27 187 Z" fill={VESSEL} stroke={BLOOD_DARK} strokeWidth={2} />
      <path d="M 34 48 Q 59 39 84 48 L 84 181 Q 59 192 34 181 Z" fill={BLOOD} />
      <text x={59} y={27} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>blood</text>
      {/* Pancreas: an irregular, lobed gland. */}
      <path d="M 112 51 C 119 37 137 36 146 44 C 157 35 174 39 177 49 C 193 45 208 53 204 63 C 193 72 175 69 162 70 C 146 76 128 71 116 68 C 108 65 107 57 112 51 Z" fill={PANCREAS} stroke="#815D2F" strokeWidth={1.8} />
      {[124, 139, 155, 172, 188].map((x) => <path key={x} d={`M ${x} 49 q -5 8 1 16`} fill="none" stroke="#B38349" strokeWidth={1.2} />)}
      <text x={158} y={88} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{config.diabetes ? 'pancreas: no insulin' : 'pancreas'}</text>
      {/* Liver: the large right lobe and smaller left lobe, with a fissure and gall bladder. */}
      <path d="M 121 126 C 126 106 153 101 176 108 C 195 98 226 105 237 119 C 244 132 234 154 220 169 C 204 187 177 194 151 183 C 131 178 115 158 121 126 Z" fill={LIVER} stroke={LIVER_DARK} strokeWidth={2} />
      <path d="M 173 178 C 169 188 174 199 182 195 C 190 190 185 180 180 176 Z" fill="#80945B" stroke="#4F6037" strokeWidth={1.3} />
      <text data-light="" x={214} y={124} textAnchor="middle" fontSize={12} fontWeight={700} fill="#FFFFFF">liver</text>
      {/* The same twelve gold particles move between the blood and the liver store. */}
      {Array.from({ length: 12 }, (_, i) => {
        const dest = i < blood ? bloodSlots[i] : storeSlots[i - blood]
        return <g key={i} style={ease(reduced)} transform={`translate(${dest.x} ${dest.y})`}><Hex x={0} y={0} /></g>
      })}
      {!reduced && insulin > 0 && <circle key={`i${insulin}`} cx={186} cy={128} r={5} fill={INSULIN} stroke="#FFFFFF" strokeWidth={1.2}
        style={{ animation: 'hm-fly 800ms ease-in both', ['--fx' as string]: `${from.x - 186}px`, ['--fy' as string]: `${from.y - 128}px` }} />}
      {!reduced && glucagon > 0 && <circle key={`g${glucagon}`} cx={186} cy={128} r={5} fill={GLUCAGON} stroke="#FFFFFF" strokeWidth={1.2}
        style={{ animation: 'hm-fly 800ms ease-in both', ['--fx' as string]: `${158 - 186}px`, ['--fy' as string]: `${60 - 128}px` }} />}
      <text x={180} y={215} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>liver store: {store}</text>
      <g transform="translate(40 226)">
        <Hex x={0} y={-4} />
        <text x={11} y={0} fontSize={12} fontWeight={700} fill={SOFT}>glucose</text>
      </g>
    </g>
  )
}

function SkinPicture({ state, reduced }: { state: HomeostasisState; reduced: boolean }) {
  const vessels = vesselsOf(state)
  const width = vessels === 'wide' ? 15 : vessels === 'narrow' ? 5 : 9
  const sweat = [0, 2, 5][sweatOf(state)]
  const shiver = shiverOf(state)
  const heat = heatLoss(state)
  return (
    <g>
      {/* Heat leaving the skin: more arrows, more heat lost. */}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M ${152 + i * 26} 40 c -5 -5 5 -9 0 -14 c -5 -5 5 -9 0 -14`} fill="none" stroke={HEAT} strokeWidth={2.2} strokeLinecap="round"
          opacity={i < heat ? 1 : 0} style={reduced ? undefined : { transition: 'opacity 500ms ease' }} />
      ))}
      {[0, 1, 2, 3].map((i) => <path key={`h${i}`} d={`M ${147 + i * 26} 17 l 5 -6 l 5 6`} fill="none" stroke={HEAT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" opacity={i < heat ? 1 : 0} />)}
      <text x={140} y={20} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>heat lost</text>
      {/* Epidermis and dermis in a large skin section. */}
      <path d="M 20 47 Q 68 38 116 47 T 255 47 L 255 83 L 20 83 Z" fill={EPIDERMIS} stroke="#AD785E" strokeWidth={1.4} />
      <path d="M 20 83 L 255 83 L 255 213 L 20 213 Z" fill={DERMIS} stroke="#AD785E" strokeWidth={1.4} />
      <path d="M 20 82 Q 43 91 65 83 T 111 83 T 157 83 T 203 83 T 255 83" fill="none" stroke="#AD785E" strokeWidth={1.3} />
      <text x={26} y={104} fontSize={12} fontWeight={700} fill={SOFT}>skin</text>
      {/* Sweat gland: a coiled tubule leading to a pore. */}
      <path d="M 68 169 C 44 164 47 143 66 148 C 86 153 78 175 60 172 C 42 168 48 146 67 150 C 82 154 78 165 68 164 C 58 163 60 151 70 154 C 85 159 78 131 76 112 L 73 61" fill="none" stroke="#9E7184" strokeWidth={5} strokeLinecap="round" />
      <path d="M 68 169 C 44 164 47 143 66 148 C 86 153 78 175 60 172 C 42 168 48 146 67 150 C 82 154 78 165 68 164 C 58 163 60 151 70 154 C 85 159 78 131 76 112 L 73 61" fill="none" stroke="#E9C6D2" strokeWidth={2.2} strokeLinecap="round" />
      <ellipse cx={73} cy={46} rx={4} ry={3} fill="#8F625C" />
      <text x={31} y={198} fontSize={12} fontWeight={700} fill={SOFT}>sweat gland</text>
      {/* Sweat reaches and spreads on the surface. */}
      {Array.from({ length: sweat }, (_, i) => {
        const x = 62 + i * 15
        const y = 38 + (i % 2) * 2
        return <path key={i} d={`M ${x} ${y - 10} C ${x - 7} ${y + 1} ${x - 5} ${y + 6} ${x} ${y + 6} C ${x + 5} ${y + 6} ${x + 7} ${y + 1} ${x} ${y - 10} Z`} fill={SWEAT} stroke="#376F91" strokeWidth={1.1} />
      })}
      {/* A branching skin blood vessel; its width responds. */}
      <path d="M 130 197 C 134 174 145 155 157 137 C 171 117 172 96 181 75 M 153 144 C 139 126 127 119 116 105 M 168 112 C 190 111 210 101 223 88" fill="none" stroke={BLOOD_DARK} strokeWidth={width + 4} strokeLinecap="round" strokeLinejoin="round" style={ease(reduced)} />
      <path d="M 130 197 C 134 174 145 155 157 137 C 171 117 172 96 181 75 M 153 144 C 139 126 127 119 116 105 M 168 112 C 190 111 210 101 223 88" fill="none" stroke={BLOOD} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={ease(reduced)} />
      <text x={177} y={211} fontSize={12} fontWeight={700} fill={SOFT}>blood vessel</text>
      {/* Skeletal muscle below the dermis; it shakes when shivering. */}
      <g>
        {shiver > 0 && !reduced && <animateTransform attributeName="transform" type="translate" values={`-${shiver * 1.5} 0;${shiver * 1.5} 0;-${shiver * 1.5} 0`} dur={shiver > 1 ? '0.25s' : '0.5s'} repeatCount="indefinite" />}
        <path d="M 183 160 Q 216 148 246 163 L 246 195 Q 216 183 183 193 Z" fill={MUSCLE} stroke="#884D49" strokeWidth={1.5} />
        {[170, 178, 186].map((y) => <path key={y} d={`M 189 ${y} Q 217 ${y - 9} 240 ${y}`} fill="none" stroke="#E6A096" strokeWidth={1.4} />)}
      </g>
      <text x={222} y={147} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>muscle</text>
      {shiver > 0 && <path d="M 180 156 l -6 -5 M 184 151 l -2 -7 M 249 156 l 6 -5" fill="none" stroke={SOFT} strokeWidth={1.5} strokeLinecap="round" />}
    </g>
  )
}

function Stepper({ label, value, set, locked }: { label: string; value: number; set(n: number): void; locked: boolean }) {
  const id = useId()
  return <div className="flex min-h-7 items-center justify-between gap-2">
    <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
    <span className="flex items-center gap-1" role="group" aria-labelledby={id}>
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} disabled={locked || value <= 0} onClick={() => set(value - 1)} className={STEP}>−</button>
      <span className="min-w-[44px] text-center text-[14px] font-extrabold text-ss-ink" aria-live="polite">{LEVEL_WORDS[value]}</span>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={locked || value >= 2} onClick={() => set(value + 1)} className={STEP}>+</button>
    </span>
  </div>
}

export function HomeostasisView({ config, state, setState, marked, reduced, locked }: Props) {
  const shown = marked === 'shown'
  const now = shown ? homeostasisEngine.solve(config) : state
  const put = (next: Partial<HomeostasisState>) => { if (!locked) setState({ ...now, ...next }) }
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
  const value = readingText(config, now)
  const glucose = config.task === 'glucose'
  const insulin = insulinOf(now)
  const glucagon = glucagonOf(now)
  const seen = glucose
    ? `A blood vessel, pancreas and liver. Gold glucose particles move between the blood and the liver store. Blood glucose is ${value}. The normal band is ${bandText(config)}.`
    : `A skin section with a sweat gland, blood vessel and muscle, with heat arrows leaving the surface. Core temperature is ${value}. The normal band is ${bandText(config)}.`
  const said = marked === 'right' || shown ? working(config, now) : marked === 'wrong' ? madeText(config, state) : ''
  const vessels = vesselsOf(now)
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <svg data-homeostasis="" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
          <style>{`svg[data-homeostasis][data-homeostasis] text[fill] { fill: ${SOFT} !important; } svg[data-homeostasis][data-homeostasis] text[data-light] { fill: #FFFFFF !important; } svg[data-homeostasis][data-homeostasis] text[data-ink] { fill: ${INK} !important; }`}</style>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          {glucose ? <GlucosePicture config={config} state={now} reduced={reduced} /> : <SkinPicture state={now} reduced={reduced} />}
          <Scale config={config} state={now} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Bring the blue marker into the green normal band.</figcaption>
      </figure>
      {glucose ? <>
        <div className="flex gap-2">
          <button type="button" className={WIDE} disabled={locked || bloodCount(config, now) <= 1} onClick={() => put({ insulin: insulin + 1 })}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: INSULIN }} />{config.diabetes ? 'Inject insulin' : 'Release insulin'}
          </button>
          <button type="button" className={WIDE} disabled={locked || bloodCount(config, now) >= 12} onClick={() => put({ glucagon: glucagon + 1 })}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: GLUCAGON }} />Release glucagon
          </button>
        </div>
        <p className="m-0 text-center text-[12px] font-bold text-ss-slate">Given so far: {insulin} insulin, {glucagon} glucagon</p>
      </> : <div className="flex flex-col gap-1.5">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Skin blood vessels</span>
          <span role="group" aria-label="Skin blood vessels" className="inline-flex gap-1 rounded-lg border-2 border-ss-line p-0.5">
            {(['narrow', 'normal', 'wide'] as Vessels[]).map((v) => <button key={v} type="button" aria-pressed={vessels === v} disabled={locked} onClick={() => put({ vessels: v })}
              className={`${SEG} ${vessels === v ? 'bg-[color:var(--subject)] text-white' : 'bg-transparent text-ss-ink hover:bg-ss-line'}`}>{v === 'narrow' ? 'Narrower' : v === 'wide' ? 'Wider' : 'Normal'}</button>)}
          </span>
        </div>
        <Stepper label="Sweating" value={sweatOf(now)} set={(n) => put({ sweat: n })} locked={locked} />
        <Stepper label="Shivering" value={shiverOf(now)} set={(n) => put({ shiver: n })} locked={locked} />
      </div>}
      <p className="sr-only" aria-live="polite">{glucose ? 'Blood glucose' : 'Core temperature'} {value}.</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>
        </div>
      )}
    </div>
  )
}
