'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { FoodConfig, FoodState, Nutrient, Reagent } from './config'
import {
  NUTRIENT_NAMES, NUTRIENTS, REAGENT_FOR, REAGENT_NAMES, REAGENTS, actionName, completed, finalStage,
  foodTestsEngine, liquidColour, madeText, nutrientFor, observation, positive, safeNutrient, safeReagent,
  selectedNutrients, stageName, stageOf, working,
} from './config'

type Props = SceneViewProps<FoodConfig, FoodState>

// The picture keeps its own quiet light colours in both themes, like measure-shape's instrument panel.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#475569'
const GLASS = '#64748B'
const GLASS_LIGHT = '#FFFFFF'
const WATER = '#A9D4E5'
const WATER_EDGE = '#6FA9BF'
const BATH = '#D5DDE3'
const BATH_EDGE = '#64748B'
const BOTTLE = '#DCE5E8'
const CAP = '#475569'
const LABEL = '#FFFFFF'
const FONT = 'system-ui, sans-serif'

// Written as literals because config.ts imports this file while it registers the engine (rule 41).
export const W = 360
export const H = 200
const TUBE_X = 175
const TUBE_Y = 43
const BATH_X = 276

const ACTION = 'nodrag min-h-8 w-full whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-extrabold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none'

function ReagentChoice({ value, locked, set }: { value: Reagent; locked: boolean; set(next: Reagent): void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-bold text-ss-slate">Pick up a reagent</span>
      <div role="group" aria-label="Reagent" className="flex flex-wrap gap-1.5">
        {REAGENTS.map((r) => {
          const on = r === value
          return (
            <button
              key={r} type="button" aria-pressed={on} disabled={locked} onClick={() => set(r)}
              className={`nodrag flex min-h-8 items-center gap-1.5 rounded-lg border-2 px-2 text-[12px] font-extrabold touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${on ? 'border-[color:var(--subject)] bg-ss-panel text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]'}`}
            >
              <span aria-hidden className="inline-block h-3 w-2 rounded-[2px] border border-ss-line" style={{ background: SWATCH[r] }} />
              {REAGENT_NAMES[r]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The colour of each reagent as it sits in its bottle, for the chip beside its name. */
const SWATCH: Record<Reagent, string> = { iodine: '#A8622C', benedict: '#367DAC', biuret: '#367DAC', ethanol: '#E8F0F1', dcpip: '#367DAC' }

/** A reagent bottle with a real shoulder, screw cap, dropper and paper label. */
function Bottle({ reagent, pouring, sampleBottle, waterBottle }: { reagent: Reagent; pouring: boolean; sampleBottle: boolean; waterBottle: boolean }) {
  const liquid = sampleBottle ? '#E9E5D5' : waterBottle ? '#D8E9EF' : reagent === 'iodine' ? '#A8622C' : reagent === 'ethanol' ? '#E8F0F1' : '#367DAC'
  return (
    <g data-bottle={reagent}>
      <path d="M48 73 H84 L90 86 V139 Q90 146 83 146 H49 Q42 146 42 139 V86 Z" fill={BOTTLE} stroke={GLASS} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M46 118 H86 V139 Q86 142 82 142 H50 Q46 142 46 139 Z" fill={liquid} opacity={0.72} />
      <rect x={49} y={61} width={34} height={16} rx={3} fill={CAP} />
      {[53, 60, 67, 74, 79].map((x) => <line key={x} x1={x} x2={x} y1={64} y2={74} stroke="#94A3B8" strokeWidth={1.3} />)}
      <path d="M80 68 H104 L130 78" fill="none" stroke={GLASS} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M82 68 H103 L128 77" fill="none" stroke={GLASS_LIGHT} strokeWidth={2} strokeLinecap="round" />
      <rect x={43} y={90} width={46} height={23} rx={2} fill={LABEL} stroke="#CBD5E1" strokeWidth={0.8} />
      <text x={66} y={105.5} textAnchor="middle" fontFamily={FONT} fontSize={reagent === 'benedict' && !waterBottle && !sampleBottle ? 10.5 : 12} fontWeight={700} fill={INK}>{waterBottle ? 'water' : sampleBottle ? 'sample' : reagent === 'benedict' ? 'Benedict' : REAGENT_NAMES[reagent]}</text>
      <path d="M47 86 V135" stroke={GLASS_LIGHT} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
    </g>
  )
}

/** The electric water bath: outer case, water surface, simple control and a labelled temperature. */
function WaterBath() {
  return (
    <g data-water-bath="1">
      <rect x={BATH_X - 48} y={111} width={96} height={70} rx={8} fill={BATH} stroke={BATH_EDGE} strokeWidth={1.8} />
      <rect x={BATH_X - 42} y={117} width={84} height={48} rx={4} fill={WATER} stroke={WATER_EDGE} strokeWidth={1.3} />
      <path d={`M${BATH_X - 40} 128 Q${BATH_X - 28} 123 ${BATH_X - 16} 128 T${BATH_X + 8} 128 T${BATH_X + 32} 128 T${BATH_X + 40} 128`} fill="none" stroke={GLASS_LIGHT} strokeWidth={1.5} opacity={0.8} />
      <rect x={BATH_X - 42} y={167} width={84} height={10} rx={3} fill={BATH} />
      <circle cx={BATH_X + 29} cy={172} r={3.2} fill={SOFT} />
      <text x={BATH_X - 35} y={175.5} fontFamily={FONT} fontSize={12} fontWeight={700} fill={INK}>80 °C</text>
      <text x={BATH_X} y={194} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>water bath</text>
    </g>
  )
}

function TestTube({ colour, cloudy, clipId, inBath, rim, holder }: { colour: string; cloudy: boolean; clipId: string; inBath: boolean; rim: boolean; holder: boolean }) {
  return (
    <g data-test-tube="1" transform={inBath ? `translate(${BATH_X - TUBE_X} 16)` : undefined}>
      <g transform={`translate(${TUBE_X} ${TUBE_Y})`}>
        <path d="M-25 0 V98 Q-25 128 0 132 Q25 128 25 98 V0" fill={GLASS_LIGHT} fillOpacity={0.66} stroke={GLASS} strokeWidth={rim ? 2.1 : 0} strokeLinecap="round" />
        <path d="M-25 0 V98 Q-25 128 0 132 Q25 128 25 98" fill="none" stroke={GLASS} strokeWidth={2.1} strokeLinecap="round" />
        <path d="M25 98 V0" fill="none" stroke={GLASS} strokeWidth={2.1} strokeLinecap="round" />
        <g clipPath={`url(#${clipId})`}>
          <rect data-liquid="1" x={-22} y={39} width={44} height={94} fill={colour} />
          <ellipse data-meniscus="1" cx={0} cy={39} rx={22} ry={4.2} fill={colour} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
          {cloudy && (
            <g data-emulsion="1">
              <rect x={-22} y={39} width={44} height={94} fill="#F5F5F0" opacity={0.72} />
              <ellipse cx={0} cy={39} rx={22} ry={4.2} fill="#F5F5F0" opacity={0.8} />
              <path d="M-16 55 H16 M-17 72 H17 M-17 91 H17 M-14 108 H14" stroke="#FFFFFF" strokeWidth={5} opacity={0.35} />
            </g>
          )}
        </g>
        <path d="M-19 10 V92 Q-19 111 -10 118" fill="none" stroke={GLASS_LIGHT} strokeWidth={3} strokeLinecap="round" opacity={0.72} />
        {rim && <ellipse cx={0} cy={0} rx={25} ry={4.5} fill={PLATE} fillOpacity={0.35} stroke={GLASS} strokeWidth={1.8} />}
        {holder && (
          <g data-tube-holder="1">
            <rect x={-31} y={-9} width={62} height={9} rx={3} fill={CAP} />
            <path d="M31 -5 H48 V-24" fill="none" stroke={CAP} strokeWidth={5} strokeLinecap="round" />
          </g>
        )}
      </g>
    </g>
  )
}

function AnswerButtons({ value, disabled, set }: { value: boolean | null; disabled: boolean; set(next: boolean): void }) {
  const base = 'nodrag min-h-8 flex-1 whitespace-nowrap rounded-lg border-2 px-2 text-[12px] font-extrabold touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-45'
  return (
    <div className="flex items-center gap-2">
      <span className="mr-auto text-[12px] font-bold text-ss-slate">Conclusion</span>
      {[true, false].map((v) => (
        <button
          key={String(v)} type="button" aria-label={v ? 'Present' : 'Not detected'} aria-pressed={value === v} disabled={disabled}
          onClick={() => set(v)}
          className={`${base} ${value === v ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate'}`}
        >{v ? 'Present' : 'Not detected'}</button>
      ))}
    </div>
  )
}

function NutrientChecks({ config, now, found, disabled, toggle }: { config: FoodConfig; now: FoodState; found: Nutrient[]; disabled: boolean; toggle(n: Nutrient): void }) {
  return (
    <div className="border-t border-ss-line pt-1.5">
      <p className="m-0 mb-1 flex items-baseline justify-between text-[12px] font-bold text-ss-slate">
        <span>Results: tick each nutrient found</span>
        <span className="text-[12px] font-bold text-ss-slate">tests done <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{REAGENTS.filter((r) => completed(now, r)).length} of 5</span></span>
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {NUTRIENTS.map((n) => {
          const r = REAGENT_FOR[n]
          return (
            <label key={n} className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-ss-ink">
              <input
                type="checkbox" aria-label={NUTRIENT_NAMES[n]} checked={found.includes(n)} onChange={() => toggle(n)} disabled={disabled}
                className="nodrag h-4 w-4 shrink-0 accent-[color:var(--subject)]"
              />
              <span className="shrink-0">{NUTRIENT_NAMES[n]}</span>
              {completed(now, r) && <span className="ml-auto pl-1 text-[12px] font-normal text-ss-slate" data-result={r}>{observation(config.sample, r, finalStage(r))}</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function FoodTestsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? foodTestsEngine.solve(config) : state
  const reagent = safeReagent(now.reagent)
  const stage = stageOf(now, reagent)
  const sample = config.sample
  const [pouring, setPouring] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipId = `food-tube-${useId().replace(/:/g, '')}`
  const finished = marked === 'right' || marked === 'shown'
  const disabled = locked || finished || pouring

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const put = (next: FoodState) => { if (!locked && !finished) setState(next) }
  const chooseReagent = (next: Reagent) => put({ ...now, reagent: next })
  const act = () => {
    if (disabled) return
    if (stage >= finalStage(reagent)) {
      put({ ...now, stages: { ...now.stages, [reagent]: 0 }, answer: config.task === 'test' ? null : now.answer })
      return
    }
    const next = { ...now, stages: { ...now.stages, [reagent]: stage + 1 } }
    // Each stage is a still frame under reduced motion; the following stage needs another press.
    if (reduced) { put(next); return }
    const svg = document.getElementById(`food-tests-${clipId}`) as unknown as SVGSVGElement | null
    const bottle = svg?.querySelector<SVGGElement>('[data-bottle]')
    const tube = svg?.querySelector<SVGGElement>('[data-test-tube]')
    const liquid = svg?.querySelectorAll<SVGGraphicsElement>('[data-liquid], [data-meniscus]')
    const heat = reagent === 'benedict' && stage >= 1
    const afterPour = () => {
      if (bottle) bottle.style.transform = 'translate(0px, 0px) rotate(0deg)'
      if (stage === 0) put(next)
      if (reagent === 'benedict' && stage === 1) {
        // Lower first, then warm: the colour develops while the tube is visibly in the bath.
        timer.current = setTimeout(() => {
          put(next)
          liquid?.forEach((el) => { el.style.transition = 'fill 700ms ease' })
          timer.current = setTimeout(() => { setPouring(false); timer.current = null }, 800)
        }, 600)
        return
      }
      if (reagent === 'benedict' && stage === 2) {
        // The developed colour stays in the tube while it is lifted out.
        timer.current = setTimeout(() => {
          put(next)
          timer.current = setTimeout(() => { setPouring(false); timer.current = null }, 650)
        }, 600)
        return
      }
      if (stage === 0) liquid?.forEach((el) => { el.style.transition = 'fill 700ms ease' })
      timer.current = setTimeout(() => { setPouring(false); timer.current = null }, 620)
    }
    if (bottle) {
      bottle.style.transition = 'transform 280ms ease'
      bottle.style.transform = 'translate(43px, -13px) rotate(28deg)'
      bottle.style.transformOrigin = '73px 68px'
    }
    if (reagent === 'benedict' && stage === 1 && tube) {
      tube.style.transition = 'transform 600ms ease'
      tube.style.transform = `translate(${BATH_X - TUBE_X}px, 16px)`
    }
    if (reagent === 'benedict' && stage === 2 && tube) {
      tube.style.transition = 'transform 600ms ease'
      tube.style.transform = 'translate(0px, 0px)'
    }
    setPouring(true)
    timer.current = setTimeout(afterPour, heat ? 100 : 420)
  }
  const toggle = (n: Nutrient) => {
    const found = selectedNutrients(now)
    put({ ...now, found: found.includes(n) ? found.filter((x) => x !== n) : [...found, n] })
  }

  const seen = observation(sample, reagent, stage)
  const inBath = reagent === 'benedict' && stage === 2
  const cloudy = reagent === 'ethanol' && stage >= 2 && positive(sample, 'fat')
  const needed = config.task === 'test' ? REAGENT_FOR[safeNutrient(config.nutrient)] : null
  const answerReady = needed ? completed(now, needed) : false
  const text = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const completedCount = REAGENTS.filter((r) => completed(now, r)).length
  const description = `A ${reagent === 'dcpip' ? 'food extract' : reagent === 'ethanol' && stage === 1 ? 'water' : REAGENT_NAMES[reagent]} dropper bottle beside a glass tube. The tube is ${seen}.${reagent === 'benedict' ? ' An electric water bath stands to the right.' : ''}`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={(e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg id={`food-tests-${clipId}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} className="block h-auto w-full select-none">
          <defs>
            <clipPath id={clipId}><path d="M-22 3 V98 Q-22 125 0 129 Q22 125 22 98 V3 Z" /></clipPath>
          </defs>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {reagent === 'benedict' && <WaterBath />}
          <TestTube colour={liquidColour(sample, reagent, stage)} cloudy={cloudy} clipId={clipId} inBath={inBath} rim={!inBath} holder={inBath} />
          <Bottle reagent={reagent} pouring={pouring} sampleBottle={reagent === 'dcpip'} waterBottle={reagent === 'ethanol' && stage === 1} />
          {pouring && !reduced && (
            <g fill={reagent === 'iodine' ? '#A8622C' : reagent === 'dcpip' || (reagent === 'ethanol' && stage === 1) ? '#D8E4DF' : '#367DAC'} data-drops="1">
              <path d="M173 66 C167 75 167 80 173 81 C179 80 179 75 173 66 Z" />
              <path d="M173 87 C169 93 169 97 173 98 C177 97 177 93 173 87 Z" />
            </g>
          )}
          <text x={inBath ? 140 : TUBE_X} y={190} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{reagent === 'dcpip' && stage === 0 ? 'DCPIP tube' : sample.name}</text>
          <text x={66} y={165} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>dropper bottle</text>
          <text x={22} y={25} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{stageName(reagent, stage)}</text>
        </svg>
        <figcaption className="flex items-baseline justify-center gap-1.5 text-center text-[12px] font-bold text-ss-slate" aria-live="polite">
          <span>Appearance</span><span className="text-ss-ink" data-appearance={seen}>{seen}</span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-2">
        <ReagentChoice value={reagent} locked={disabled} set={chooseReagent} />
        <button type="button" aria-label={actionName(reagent, stage)} disabled={disabled} onClick={act} className={ACTION}>{actionName(reagent, stage)}</button>
      </div>

      {config.task === 'identify' ? (
        <NutrientChecks config={config} now={now} found={selectedNutrients(now)} disabled={disabled} toggle={toggle} />
      ) : (
        <AnswerButtons value={typeof now.answer === 'boolean' ? now.answer : null} disabled={disabled || !answerReady} set={(answer) => put({ ...now, answer })} />
      )}

      <span className="sr-only" aria-live="polite">{`The ${REAGENT_NAMES[reagent]} tube is ${seen}. ${completedCount} of 5 tests completed.`}</span>
      {marked !== 'idle' && (
        <p className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
      )}
    </div>
  )
}
