'use client'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Pace, RespirationConfig, RespirationState } from './config'
import {
  addGlucose, advanceMuscle, advanceYeast, limeAppearance, madeText, muscleOf, oxygenFor, working, yeastOf,
} from './config'

type Props = SceneViewProps<RespirationConfig, RespirationState>

// A quiet, light laboratory plate in both themes. Flat material colours, as on measure-shape.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#334155'
const SOFT = '#475569'
const GLASS = '#EAF2F7'
const WATER = '#DCEEF5'
const WATER_LINE = '#82B5C9'
const BLOOD = '#C85B64'
const BLOOD_DARK = '#9F3F4B'
const OXYGEN = '#398AC5'
const OXYGEN_DARK = '#24638F'
const CELL = '#F4D9C9'
const CELL_EDGE = '#B87867'
const LACTIC = '#D58A28'
const LACTIC_DARK = '#8B5715'
const YEAST = '#E7D4A7'
const YEAST_EDGE = '#AA8951'
const OIL = '#F4E8B9'
const RUBBER = '#64748B'
const SKIN = '#C98E68'
const SKIN_EDGE = '#875E47'
const SHIRT = '#3E8EA6'
const SHORTS = '#334E68'
const SHOE = '#475569'

// These are literals because config.ts imports this file while it is being initialised (brief rule 41).
export const W = 360
export const H = 240
const FONT = 'system-ui, sans-serif'
const ease = (reduced: boolean): CSSProperties => (reduced ? {} : { transition: 'all 700ms ease, fill 700ms ease, opacity 700ms ease' })
const text = (x: number, y: number, value: string, anchor: 'start' | 'middle' | 'end' = 'start', fill = SOFT) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={650} fill={fill} fontFamily={FONT}>{value}</text>
)

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const ACTION = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function stopArrows(e: KeyboardEvent) {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

/** One limb pivots at its real joint; pace changes its pose and each five-second stage swaps the stride. */
function Runner({ pace, seconds, reduced }: { pace: Pace; seconds: number; reduced: boolean }) {
  const stride = pace === 'rest' ? 0 : pace === 'walk' ? 17 : pace === 'jog' ? 29 : 42
  const side = Math.floor(seconds / 5) % 2 === 0 ? 1 : -1
  const swing = stride * side
  const lean = pace === 'sprint' ? 13 : pace === 'jog' ? 6 : 0
  const bob = pace !== 'rest' && side < 0 ? 2 : 0
  const backArm = pace === 'rest' ? 'M-7 45 L-13 70 L-13 96' : 'M0 45 L-3 72 L13 88'
  const nearArm = pace === 'rest' ? 'M8 43 L14 69 L15 96' : 'M2 43 L4 69 L-10 84'
  const backLeg = pace === 'rest' ? 'M-3 79 L-8 105 L-10 123' : 'M0 79 L-2 105 L-5 123'
  const nearLeg = pace === 'rest' ? 'M3 82 L8 105 L10 124' : 'M0 82 L4 105 L8 124'
  return (
    <g transform={`translate(69 ${49 + bob})`} style={ease(reduced)} aria-hidden="true">
      <ellipse cx={4} cy={129} rx={48} ry={4} fill={HAIR} />
      <g transform={`rotate(${lean} 0 65)`} style={ease(reduced)}>
        {/* Rear arm and leg, then torso, then the near limbs. */}
        <g transform={`rotate(${-swing * 0.75} 0 45)`} style={ease(reduced)}>
          <path d={backArm} fill="none" stroke={SKIN_EDGE} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <path d={backArm} fill="none" stroke={SKIN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform={`rotate(${swing} 0 79)`} style={ease(reduced)}>
          <path d={backLeg} fill="none" stroke={SKIN_EDGE} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          <path d={backLeg} fill="none" stroke={SKIN} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pace === 'rest' ? 'M-15 123 L0 123' : 'M-7 123 L8 123'} stroke={SHOE} strokeWidth={7} strokeLinecap="round" />
        </g>
        <path d="M-12 35 Q0 29 12 37 L10 76 Q0 82 -10 76 Z" fill={SHIRT} stroke="#286779" strokeWidth={1.5} />
        <path d="M-10 73 L11 73 L14 88 L1 89 L-2 82 L-5 89 L-16 86 Z" fill={SHORTS} stroke="#263E52" strokeWidth={1.3} />
        <path d="M-1 34 L-1 26" stroke={SKIN} strokeWidth={7} strokeLinecap="round" />
        <circle cx={0} cy={17} r={13} fill={SKIN} stroke={SKIN_EDGE} strokeWidth={1.2} />
        <path d="M-12 18 Q-13 1 2 3 Q13 4 12 13 L6 9 L-4 9 L-8 18 Z" fill="#493A33" />
        <circle cx={7} cy={16} r={1.2} fill={INK} />
        <path d="M12 21 L16 22 L11 24" fill={SKIN} stroke={SKIN_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <g transform={`rotate(${swing * 0.85} 2 43)`} style={ease(reduced)}>
          <path d={nearArm} fill="none" stroke={SKIN_EDGE} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <path d={nearArm} fill="none" stroke={SKIN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform={`rotate(${-swing} 0 82)`} style={ease(reduced)}>
          <path d={nearLeg} fill="none" stroke={SKIN_EDGE} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          <path d={nearLeg} fill="none" stroke={SKIN} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pace === 'rest' ? 'M8 124 L24 124' : 'M6 124 L22 124'} stroke={SHOE} strokeWidth={7} strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

function Mito({ x, y, turn }: { x: number; y: number; turn: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} aria-hidden="true">
      <rect x={-13} y={-6} width={26} height={12} rx={6} fill="#E7B9A6" stroke={CELL_EDGE} strokeWidth={1.2} />
      <path d="M-8 0 L-5 -3 L-1 3 L3 -3 L7 2" fill="none" stroke={CELL_EDGE} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function MusclePicture({ state, reduced }: { state: RespirationState; reduced: boolean }) {
  const s = muscleOf(state)
  const recovering = s.pace === 'rest' && s.lactic > 0
  const o = oxygenFor(s.pace, recovering)
  const label = s.pace === 'rest' ? 'Resting' : s.pace === 'walk' ? 'Walking' : s.pace === 'jog' ? 'Jogging' : 'Sprinting'
  const lacticSpots = [[225, 63], [258, 71], [274, 101], [236, 117], [206, 97], [254, 127]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, ${s.seconds} seconds elapsed. A runner and a close-up of one muscle cell with its blood supply. Oxygen supply ${o.supply}, muscle demand ${o.demand}. Lactic acid reading ${s.lactic}.`} className="block h-auto w-full select-none" data-scene="muscle">
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      {text(16, 23, `${label} — ${s.seconds} s`, 'start', INK)}
      {text(344, 23, 'one muscle cell', 'end')}
      <Runner pace={s.pace} seconds={s.seconds} reduced={reduced} />
      {s.pace === 'sprint' && (
        <g stroke="#9DB4C2" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M18 74 H38" /><path d="M11 88 H33" /><path d="M19 102 H36" />
        </g>
      )}
      {/* The muscle-cell cutaway: membrane, cytoplasm and mitochondria. Amber drops are the learner's lactic-acid model. */}
      <path d="M191 48 C213 28 274 31 300 54 C327 78 316 121 291 139 C263 158 208 147 187 124 C168 102 171 70 191 48 Z" fill={CELL} stroke={CELL_EDGE} strokeWidth={2} />
      <path d="M195 53 C216 37 270 37 294 58" fill="none" stroke="#FFF7F0" strokeWidth={3} strokeLinecap="round" />
      <Mito x={215} y={65} turn={-22} /><Mito x={281} y={83} turn={28} /><Mito x={223} y={128} turn={12} />
      {lacticSpots.slice(0, s.lactic).map(([x, y], i) => (
        <g key={i} style={ease(reduced)}>
          <path d={`M${x} ${y - 6} C${x - 7} ${y + 2} ${x - 6} ${y + 8} ${x} ${y + 8} C${x + 6} ${y + 8} ${x + 7} ${y + 2} ${x} ${y - 6} Z`} fill={LACTIC} stroke={LACTIC_DARK} strokeWidth={1} />
          <path d={`M${x - 2} ${y + 1} Q${x - 3} ${y + 4} ${x - 1} ${y + 5}`} fill="none" stroke="#F8D8A5" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      ))}
      {s.lactic > 0 ? text(243, 162, 'lactic acid', 'middle', LACTIC_DARK) : text(243, 162, s.sprinted ? 'lactic acid cleared' : 'no lactic acid yet', 'middle')}
      {/* A red capillary carries named blue oxygen discs toward the cell. */}
      <path d="M18 193 C91 179 145 183 191 186 C236 190 284 181 337 187 L337 211 C276 205 237 216 188 210 C129 202 80 207 18 217 Z" fill="#F4C9CC" stroke={BLOOD_DARK} strokeWidth={1.6} />
      <path d="M20 199 C97 187 141 193 190 195 C246 199 282 190 335 196" fill="none" stroke="#F9E2E3" strokeWidth={3} strokeLinecap="round" />
      {Array.from({ length: o.supply }, (_, i) => {
        const x = 54 + i * 38 + (Math.floor(s.seconds / 5) % 2) * 10
        const y = 201 + (i % 2) * 5
        return <circle key={i} cx={x} cy={y} r={6} fill={OXYGEN} stroke={OXYGEN_DARK} strokeWidth={1.2} style={ease(reduced)} />
      })}
      {text(21, 235, 'blood', 'start', BLOOD_DARK)}
      {text(95, 235, 'blue discs: oxygen', 'start', OXYGEN_DARK)}
      {text(340, 235, `muscle needs ${o.demand}`, 'end', INK)}
    </svg>
  )
}

function Bubble({ x, y, r = 3 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#FFFFFF" fillOpacity={0.72} stroke={WATER_LINE} strokeWidth={1.1} />
}

function YeastPicture({ state, reduced }: { state: RespirationState; reduced: boolean }) {
  const s = yeastOf(state)
  const look = limeAppearance(state)
  const active = s.spoons > 0 && s.minutes > 0
  const bubbles = active ? Math.min(8, 2 + s.minutes * 2 + s.spoons - 1) : 0
  const flaskBubbles = [[101, 177], [121, 184], [136, 170], [91, 161], [115, 153], [130, 143], [105, 133], [122, 122]]
  const tubeBubbles = s.minutes > 0 ? [[157, 54], [183, 54], [211, 68], [235, 91], [267, 109], [281, 134]] : []
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Yeast mixture with ${s.spoons} glucose ${s.spoons === 1 ? 'spoon' : 'spoons'}, under oil to keep oxygen out. ${s.minutes} minutes elapsed. A delivery tube leads to ${look} limewater.`} className="block h-auto w-full select-none" data-scene="yeast">
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      {text(16, 22, s.spoons === 0 ? (s.minutes === 0 ? 'Ready to investigate' : `${s.minutes} min — nothing added`) : `${s.minutes} ${s.minutes === 1 ? 'minute' : 'minutes'} with glucose`, 'start', INK)}
      {/* Warm-water bath behind the flask, with a real waterline and glass wall. */}
      <path d="M42 96 L48 205 Q49 215 59 216 H166 Q176 215 177 205 L183 96" fill={GLASS} fillOpacity={0.72} stroke="#8DA6B5" strokeWidth={1.6} />
      <path d="M46 124 H179 L175 204 Q174 211 165 211 H60 Q52 211 51 204 Z" fill={WATER} stroke="none" />
      <path d="M46 124 Q112 119 179 124" fill="none" stroke={WATER_LINE} strokeWidth={1.5} />
      <path d="M42 96 Q112 91 183 96" fill="none" stroke="#8DA6B5" strokeWidth={1.6} />
      {/* Conical flask, suspension and an oil layer. */}
      <path d="M98 42 H130 V103 L161 181 Q168 202 147 204 H82 Q61 202 68 181 L98 103 Z" fill={PLATE} fillOpacity={0.82} stroke="#718B9C" strokeWidth={2} strokeLinejoin="round" />
      <path d="M78 145 H151 L161 181 Q167 199 147 200 H82 Q65 199 70 182 Z" fill={YEAST} stroke={YEAST_EDGE} strokeWidth={1.1} />
      <path d="M85 121 Q114 117 143 121 L151 145 H78 Z" fill={OIL} stroke="#C8B472" strokeWidth={1} />
      <path d="M78 145 Q113 140 151 145" fill="none" stroke="#B79B52" strokeWidth={1.3} />
      <path d="M87 126 Q113 123 140 126" fill="none" stroke="#FFF9DF" strokeWidth={2} strokeLinecap="round" />
      <path d="M74 184 Q112 179 157 184" fill="none" stroke="#F2E5C6" strokeWidth={2} strokeLinecap="round" />
      {/* Added glucose is visible as pale crystals in the suspension, then gradually disperses. */}
      {[[88, 181], [104, 188], [121, 178], [137, 187], [96, 169], [114, 184], [130, 192], [145, 177], [107, 173]].slice(0, s.spoons * 3).map(([x, y], i) => (
        <rect key={i} x={x - 2} y={y - 2} width={4} height={4} rx={0.7} transform={`rotate(${i * 23} ${x} ${y})`} fill="#FFF9E9" stroke="#BFA873" strokeWidth={0.7} opacity={Math.max(0.3, 1 - s.minutes * 0.2)} data-glucose={i} />
      ))}
      <path d="M104 49 V100 L75 180" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      <rect x={94} y={36} width={41} height={16} rx={3} fill={RUBBER} stroke="#405266" strokeWidth={1.2} />
      <path d="M99 39 H130" stroke="#94A3B8" strokeWidth={1.2} />
      {/* Delivery tube: thick glass edge, light bore, then bubbles along its actual route. */}
      <path d="M115 44 H158 Q172 44 184 52 L238 88 Q254 98 273 98 H283 V153" fill="none" stroke="#7E99AA" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M115 44 H158 Q172 44 184 52 L238 88 Q254 98 273 98 H283 V153" fill="none" stroke="#F4FAFC" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {flaskBubbles.slice(0, bubbles).map(([x, y], i) => <Bubble key={i} x={x} y={y - (active && !reduced ? (s.minutes % 2) * 3 : 0)} r={i % 3 === 0 ? 3.6 : 2.7} />)}
      {tubeBubbles.slice(0, Math.min(tubeBubbles.length, bubbles)).map(([x, y], i) => <Bubble key={i} x={x} y={y} r={2.8} />)}
      {/* Limewater in a test tube. Cloudiness is a suspension, not a blue/green result light. */}
      <path d="M260 104 V194 Q260 211 282 211 Q304 211 304 194 V104" fill={GLASS} fillOpacity={0.8} stroke="#718B9C" strokeWidth={2} />
      <path d="M264 135 H300 V194 Q300 207 282 207 Q264 207 264 194 Z" fill={look === 'clear' ? '#F3F7F8' : look === 'cloudy' ? '#E9ECE7' : '#F4F1DF'} stroke={look === 'clear' ? '#C7D5DB' : '#C5C3AD'} strokeWidth={1} style={ease(reduced)} />
      <path d="M264 135 Q282 131 300 135 Q282 140 264 135" fill={look === 'clear' ? '#F7FAFA' : '#F5F3E7'} stroke="#B8C7CB" strokeWidth={1} />
      {look === 'cloudy' && [[273, 154], [290, 164], [276, 180], [291, 193], [284, 147]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill="#FFFFFF" opacity={0.65} />)}
      {s.minutes > 0 && <Bubble x={282} y={177} r={3.5} />}
      {/* The event, not merely a count: a new bubble rises from the yeast and traverses the tube in one calm stage. */}
      {active && !reduced && (
        <circle key={`travelling-${s.minutes}`} cx={0} cy={0} r={3.4} fill="#FFFFFF" fillOpacity={0.9} stroke={WATER_LINE} strokeWidth={1.1}>
          <animateMotion dur="1.35s" fill="freeze" path="M115 181 C115 149 115 101 115 55 L157 55 Q171 55 183 63 L237 99 Q253 109 272 109 H282 V180" />
        </circle>
      )}
      <path d="M258 104 H306" stroke="#718B9C" strokeWidth={2} strokeLinecap="round" />
      <path d="M267 110 V187" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
      {/* Direct labels, clear of the glass and of one another. */}
      {text(17, 70, 'oil keeps', 'start')}{text(17, 85, 'oxygen out', 'start')}
      <path d="M70 85 L88 119" fill="none" stroke={SOFT} strokeWidth={1} />
      {text(18, 235, 'yeast mixture', 'start', YEAST_EDGE)}
      {text(129, 235, 'warm water', 'start', OXYGEN_DARK)}
      {text(282, 229, `limewater: ${look}`, 'middle', INK)}
      {s.spoons > 0 && s.minutes === 0 && text(338, 23, 'glucose added', 'end', YEAST_EDGE)}
    </svg>
  )
}

function Verdict({ marked, children }: { marked: SceneMarked; children: string }) {
  if (marked === 'idle') return null
  const lead = children.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="m-0 text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : children}</p>
      {lead?.[2] && <p className="mb-0 mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

function LacticMeter({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-3 w-3 rounded-full border" style={{ background: i < value ? LACTIC : 'transparent', borderColor: i < value ? LACTIC_DARK : '#CBD5E1' }} />)}
    </span>
  )
}

export function RespirationView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = state ?? {}
  const muscle = muscleOf(now)
  const yeast = yeastOf(now)
  const isYeast = config.task === 'yeast'
  const oxygen = oxygenFor(muscle.pace, muscle.pace === 'rest' && muscle.lactic > 0)
  const paces: Pace[] = ['rest', 'walk', 'jog', 'sprint']
  const paceIndex = paces.indexOf(muscle.pace)
  const paceName = muscle.pace.charAt(0).toUpperCase() + muscle.pace.slice(1)
  const setPace = (index: number) => {
    if (!locked) setState({ ...muscle, pace: paces[Math.max(0, Math.min(3, index))] })
  }
  const verdict = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, now) : ''

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={stopArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        {isYeast ? <YeastPicture state={now} reduced={reduced} /> : <MusclePicture state={now} reduced={reduced} />}
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">
          {isYeast ? 'Watch the bubbles reach the limewater.' : 'Exercise the muscle, then let it recover.'}
        </figcaption>
      </figure>

      {isYeast ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Glucose</span>
            <span className="flex items-center gap-2">
              <span className="min-w-[62px] text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{yeast.spoons} {yeast.spoons === 1 ? 'spoon' : 'spoons'}</span>
              <button type="button" data-action="add-glucose" aria-label="Add a spoon of glucose" disabled={locked || yeast.spoons >= 3} onClick={() => setState(addGlucose(now))} className={ACTION}>Add glucose</button>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Time with glucose</span>
            <span className="flex items-center gap-2">
              <span className="min-w-[62px] text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{yeast.minutes} min</span>
              <button type="button" data-action="wait-minute" aria-label="Wait one minute" disabled={locked || yeast.spoons === 0 || yeast.minutes >= 4} onClick={() => setState(advanceYeast(now))} className={ACTION}>Wait 1 minute</button>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
            <span className="text-[12px] font-bold text-ss-slate">Goal: show yeast respiring</span>
            {locked ? <span className="text-[12px] font-semibold text-ss-slate">Mixture complete</span> : (yeast.spoons > 0 || yeast.minutes > 0) ? (
              <button type="button" data-action="fresh-yeast" aria-label="Start a fresh yeast mixture" onClick={() => setState({ spoons: 0, minutes: 0 })} className={ACTION}>Fresh mixture</button>
            ) : <span className="text-[12px] font-semibold text-ss-slate">Add glucose to begin</span>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Exercise pace</span>
            <span className="flex items-center gap-1.5">
              <button type="button" data-action="slower" aria-label="Choose a slower exercise pace" disabled={locked || paceIndex <= 0} onClick={() => setPace(paceIndex - 1)} className={STEP}>−</button>
              <span className="w-[58px] text-center text-[15px] font-extrabold text-ss-ink">{paceName}</span>
              <button type="button" data-action="faster" aria-label="Choose a faster exercise pace" disabled={locked || paceIndex >= 3} onClick={() => setPace(paceIndex + 1)} className={STEP}>+</button>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Lactic acid</span>
            <span className="flex items-center gap-2"><LacticMeter value={muscle.lactic} /><span className="w-4 text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{muscle.lactic}</span></span>
          </div>
          <div className="grid grid-cols-2 items-center gap-3 border-t border-ss-line pt-1.5">
            <p className="m-0 flex flex-col"><span className="text-[12px] font-bold text-ss-slate">Breathing</span><span className="text-[12px] font-semibold text-ss-ink">{muscle.lactic > 0 && muscle.pace === 'rest' ? 'Deep and fast' : oxygen.breathing}</span></p>
            <button type="button" data-action="next-five" aria-label="Advance five seconds" disabled={locked} onClick={() => setState(advanceMuscle(now))} className={`${ACTION} justify-self-end`}>Next 5 seconds</button>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {isYeast
          ? `${yeast.spoons} glucose ${yeast.spoons === 1 ? 'spoon' : 'spoons'}, ${yeast.minutes} ${yeast.minutes === 1 ? 'minute' : 'minutes'}. Limewater ${limeAppearance(now)}.`
          : `${paceName}, ${muscle.seconds} seconds. Lactic acid ${muscle.lactic}. Breathing ${oxygen.breathing}.`}
      </span>
      <Verdict marked={marked}>{verdict}</Verdict>
    </div>
  )
}
