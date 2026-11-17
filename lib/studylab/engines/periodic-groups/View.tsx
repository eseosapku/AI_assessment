'use client'
import type { CSSProperties } from 'react'
import type { SceneViewProps } from '../types'
import type { PeriodicConfig, PeriodicState } from './config'
import {
  addedOf, alkaliOf, answerOf, displaces, equationOf, halideOf, halogenOf, madeText,
  periodicGroupsEngine, stageOf, working,
} from './config'

type Props = SceneViewProps<PeriodicConfig, PeriodicState>

// A light laboratory plate in both themes. Material colours stay the same in dark mode; no gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const GLASS = '#E4EDF0'
const GLASS_EDGE = '#6E8792'
const GLASS_HI = '#FFFFFF'
const WATER = '#C9E3EC'
const WATER_EDGE = '#6A9BAD'
const INK = '#263640'
const SOFT = '#52646F'
const BENCH = '#D8E0E4'
const BENCH_EDGE = '#A9B6BD'
const METAL = '#C5CED4'
const METAL_EDGE = '#687983'
const PAPER = '#EEE9DD'
const PAPER_EDGE = '#A79E8C'
const CERAMIC = '#E8ECEE'
const CERAMIC_EDGE = '#7D8D96'
const CLEAR = '#E6EFF1'
const LILAC = '#9B78C6'
const LILAC_EDGE = '#67458D'
const FLAME_CORE = '#E8DDF4'
const FONT = 'system-ui, sans-serif'

// Literals, deliberately not top-level reads from config (the two modules initialise one another).
export const W = 360
export const H = 268

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const RUN = 'nodrag flex h-8 items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default motion-reduce:transition-none'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const METAL_CHOICES = ['lithium', 'potassium', 'sodium'] as const
export const HALOGEN_CHOICES = ['bromine', 'chlorine', 'iodine'] as const

function Bench() {
  return <path d="M 35 241 H 326 L 333 249 H 28 Z" fill={BENCH} stroke={BENCH_EDGE} strokeWidth={1.2} strokeLinejoin="round" aria-hidden="true" />
}

function TroughBack() {
  return (
    <g aria-hidden="true">
      <path d="M 117 91 L 124 222 Q 125 231 136 232 H 320 Q 330 231 331 222 L 338 91" fill={GLASS} fillOpacity={0.5} stroke={GLASS_EDGE} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 123 99 L 129 219 Q 130 225 139 226 H 314" fill="none" stroke={GLASS_HI} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  )
}

function Water() {
  return (
    <g aria-hidden="true">
      <path d="M 121 137 Q 227 130 334 137 L 328 218 Q 327 226 317 226 H 139 Q 130 226 129 218 Z" fill={WATER} />
      <path d="M 121 137 Q 227 130 334 137 Q 227 145 121 137 Z" fill={WATER} stroke={WATER_EDGE} strokeWidth={0.9} />
      <path d="M 125 138 Q 227 143 330 138" fill="none" stroke={GLASS_HI} strokeWidth={1.1} opacity={0.75} />
    </g>
  )
}

function TroughFront() {
  return (
    <g aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 112 87 L 118 96 M 118 96 H 337 Q 343 96 341 90 L 338 85 H 121 L 112 82 Z" fill={GLASS} fillOpacity={0.76} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d="M 122 90 H 335" stroke={GLASS_HI} strokeWidth={1.8} />
      <path d="M 117 97 L 124 222 Q 125 232 136 233 H 320 Q 331 232 332 222 L 338 97" stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d="M 133 228 Q 139 230 149 230 H 311" stroke={GLASS_HI} strokeWidth={2.1} />
      <path d="M 325 153 L 321 211" stroke={GLASS_HI} strokeWidth={2.4} opacity={0.8} />
    </g>
  )
}

function WrappedSample({ gone }: { gone: boolean }) {
  return (
    <g aria-hidden="true">
      {/* A shallow watch glass, with the small paper-wrapped sample on it. */}
      <path d="M 18 181 Q 57 199 98 181 Q 91 203 58 204 Q 26 202 18 181 Z" fill={GLASS} fillOpacity={0.6} stroke={GLASS_EDGE} strokeWidth={1.4} />
      <path d="M 18 181 Q 57 166 98 181 Q 57 194 18 181 Z" fill={GLASS} fillOpacity={0.35} stroke={GLASS_EDGE} strokeWidth={1.2} />
      <path d="M 26 183 Q 57 191 89 182" fill="none" stroke={GLASS_HI} strokeWidth={1.6} />
      {!gone && <g transform="translate(58 166)">
        <path d="M -21 7 L -15 -13 L 15 -13 L 22 7 L 12 17 H -13 Z" fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M -15 -13 L -5 -5 H 8 L 15 -13 M -21 7 L -8 4 L -13 17 M 22 7 L 9 4 L 12 17" fill="none" stroke={PAPER_EDGE} strokeWidth={1} />
        <text x={0} y={5} textAnchor="middle" fontSize={12} fontWeight={800} fill={SOFT}>?</text>
      </g>}
    </g>
  )
}

function SampleInWater({ config, stage, reduced }: { config: PeriodicConfig; stage: number; reduced: boolean }) {
  if (config.task !== 'water' || stage === 0) return null
  const m = alkaliOf(config.metal)
  // The final still has no metal left; the gas and the last of the flame remain visible.
  const x = stage === 1 ? 213 : m.id === 'lithium' ? 224 : m.id === 'sodium' ? 253 : 280
  const y = 137
  const bubbles = stage < 2 ? [] : Array.from({ length: stage === 3 ? Math.ceil(m.bubbles / 2) : m.bubbles }, (_, i) => ({
    x: x + [-18, 18, -24, 10, 25, -10, 5, -28, 29, -4, 15][i],
    y: 133 - (i % 4) * 15,
    r: 2.6 + (i % 3) * 0.7,
    phase: i / Math.max(1, m.bubbles),
  }))
  const ease: CSSProperties = reduced ? {} : { transition: 'transform 850ms cubic-bezier(.22,.7,.25,1)' }
  return (
    <g aria-hidden="true">
      {stage < 3 && <g data-metal-sample transform={`translate(${x} ${y})`} style={ease}>
        {m.melts && stage >= 2 ? (
          <>
            <ellipse cx={0} cy={0} rx={13} ry={8.5} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.4} />
            <path d="M -8 -2 Q -2 -7 7 -4" fill="none" stroke={GLASS_HI} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M -12 3 L -9 -9 L 4 -13 L 13 -4 L 9 7 L -4 10 Z" fill={METAL} stroke={METAL_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
            <path d="M -8 -6 L 3 -9 L 8 -4" fill="none" stroke={GLASS_HI} strokeWidth={1.8} strokeLinecap="round" />
          </>
        )}
        {m.flame && stage === 2 && <g transform="translate(0 -10)">
          <path d="M 0 2 C -17 -7 -12 -20 -4 -31 C -5 -20 1 -20 1 -38 C 15 -22 16 -9 0 2 Z" fill={LILAC} stroke={LILAC_EDGE} strokeWidth={1.2} />
          <path d="M 0 0 C -7 -6 -5 -13 0 -21 C 7 -12 7 -5 0 0 Z" fill={FLAME_CORE} />
        </g>}
      </g>}
      {m.flame && stage === 3 && <path d="M 251 127 C 243 119 250 112 254 105 C 261 115 262 122 251 127 Z" fill={LILAC} stroke={LILAC_EDGE} strokeWidth={1} opacity={0.8} />}
      {bubbles.map((b, i) => (
        <circle key={i} data-water-bubble={i} cx={b.x} cy={reduced ? b.y : b.y - b.phase * 20} r={b.r} fill={GLASS_HI} fillOpacity={0.78} stroke={WATER_EDGE} strokeWidth={1.1}>
          {!reduced && <>
            <animate attributeName="cy" values={`${b.y + 23};${b.y - 29}`} dur={`${1.6 + b.phase}s`} begin={`${-b.phase * 1.6}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${1.6 + b.phase}s`} begin={`${-b.phase * 1.6}s`} repeatCount="indefinite" />
          </>}
        </circle>
      ))}
    </g>
  )
}

function WaterPicture({ config, stage, tested, reduced }: { config: PeriodicConfig; stage: number; tested: boolean; reduced: boolean }) {
  const m = config.task === 'water' ? alkaliOf(config.metal) : null
  const seen = !tested
    ? 'A small paper-wrapped unknown metal sample on a watch glass beside a glass trough of cold water.'
    : stage === 1 ? 'The unknown sample is floating on the cold water.' : stage === 2
      ? `${m!.melts ? 'The sample has melted into a silvery ball.' : 'The sample has kept its solid shape.'} Gas bubbles are rising${m!.speed ? ' and the sample is moving over the water' : ''}${m!.flame ? ', with a lilac flame above it' : ''}.`
      : 'The sample has reacted away, leaving gas bubbles and a clear, colourless solution.'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none" fontFamily={FONT}>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <text x={22} y={30} fontSize={12.5} fontWeight={750} fill={INK}>Unknown sample</text>
      <text x={22} y={47} fontSize={12} fontWeight={600} fill={SOFT}>Group I metal</text>
      <text x={224} y={61} textAnchor="middle" fontSize={12.5} fontWeight={750} fill={INK}>Cold water</text>
      <Bench />
      <TroughBack />
      <Water />
      <WrappedSample gone={tested} />
      <SampleInWater config={config} stage={tested ? stage : 0} reduced={reduced} />
      <TroughFront />
      <text x={57} y={223} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>Watch glass</text>
      <text x={228} y={258} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>Glass trough</text>
    </svg>
  )
}

function Well({ x, colour, test, reduced }: { x: number; colour: string; test?: boolean; reduced: boolean }) {
  const ease: CSSProperties = reduced ? {} : { transition: 'fill 900ms ease' }
  return (
    <g transform={`translate(${x} 0)`} aria-hidden="true">
      {/* A thick porcelain dimple dish: elliptical rim, sloping bowl and a small foot. */}
      <path d="M -59 157 Q -55 209 -38 216 H 38 Q 55 209 59 157 Z" fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth={1.5} />
      <ellipse cx={0} cy={157} rx={59} ry={21} fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth={1.5} />
      <ellipse cx={0} cy={158} rx={46} ry={14.5} fill={GLASS_HI} stroke={CERAMIC_EDGE} strokeWidth={1.1} />
      <ellipse cx={0} cy={160} rx={39} ry={11.5} fill={colour} stroke={test ? '#745437' : GLASS_EDGE} strokeWidth={test ? 1.2 : 0.8} style={ease} />
      <path d="M -28 160 Q 0 167 28 160" fill="none" stroke={GLASS_HI} strokeWidth={1.1} opacity={0.55} />
      <path d="M -37 215 Q 0 221 37 215" fill="none" stroke={CERAMIC_EDGE} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  )
}

function Dropper({ x, liquid, stage, reduced }: { x: number; liquid: string; stage: number; reduced: boolean }) {
  const ease: CSSProperties = reduced ? {} : { transition: 'transform 900ms cubic-bezier(.22,.7,.25,1)' }
  return (
    <g transform={`translate(${x} 0)`} style={ease} aria-hidden="true" data-dropper>
      {/* Rubber teat, glass barrel and a narrow tip. The coloured reagent is visible inside. */}
      <path d="M -10 26 Q -11 11 0 9 Q 11 11 10 26 L 7 35 H -7 Z" fill={SOFT} stroke={INK} strokeWidth={1.2} />
      <path d="M -5 15 Q 0 11 5 15" fill="none" stroke={GLASS_HI} strokeWidth={1.5} opacity={0.5} />
      <path d="M -8 34 H 8 L 6 76 L 2 100 H -2 L -6 76 Z" fill={GLASS} fillOpacity={0.75} stroke={GLASS_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M -4 49 H 4 L 3 77 L 0 87 L -3 77 Z" fill={liquid} />
      <path d="M -4 39 L -3 71" stroke={GLASS_HI} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M -9 34 H 9 V 42 H -9 Z" fill={CERAMIC} stroke={GLASS_EDGE} strokeWidth={1.1} />
      {stage > 0 && <g>
        <path d="M 0 105 C -5 111 -5 115 0 116 C 5 115 5 111 0 105 Z" fill={liquid} stroke={GLASS_EDGE} strokeWidth={0.7} />
        <circle cx={0} cy={130} r={3.4} fill={liquid} stroke={GLASS_EDGE} strokeWidth={0.7} />
      </g>}
    </g>
  )
}

export function halideColours(config: PeriodicConfig, added: string | null, stage: number): { control: string; test: string; product: boolean } {
  const h = halogenOf(added ?? 'chlorine')
  if (stage < 1) return { control: CLEAR, test: CLEAR, product: false }
  const product = config.task === 'halide' && stage >= 2 && displaces(added ?? '', config.halide)
  return {
    control: h.liquid,
    test: product ? halogenOf(halideOf(config.halide).halogen).liquid : stage >= 2 ? h.liquid : CLEAR,
    product,
  }
}

function HalidePicture({ config, added, stage, reduced }: { config: PeriodicConfig; added: string | null; stage: number; reduced: boolean }) {
  const h = halogenOf(added ?? 'chlorine')
  const salt = config.task === 'halide' ? halideOf(config.halide) : halideOf('potassium-bromide')
  const colours = halideColours(config, added, stage)
  const x = stage === 0 ? 180 : stage === 1 ? 92 : 268
  const same = stage >= 2 && !colours.product
  const seen = `A dropper of ${h.name} water above two porcelain wells, one a distilled-water control and one ${salt.name} solution. ${stage === 0 ? 'Neither well has had drops added.' : stage === 1 ? 'The control well is now coloured by the diluted halogen water; the halide well is still colourless.' : same ? 'Both wells have the same colour.' : 'The control and test wells now have different colours.'}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none" fontFamily={FONT}>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <text x={180} y={120} textAnchor="middle" fontSize={12.5} fontWeight={750} fill={INK}>{cap(h.name)} water</text>
      <text x={92} y={255} textAnchor="middle" fontSize={12.5} fontWeight={750} fill={INK}>Water control</text>
      <text x={268} y={255} textAnchor="middle" fontSize={12.5} fontWeight={750} fill={INK}>{cap(salt.name.split(' ')[0])} {salt.name.split(' ')[1]}</text>
      <path d="M 35 216 H 326 L 333 223 H 28 Z" fill={BENCH} stroke={BENCH_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
      <Well x={92} colour={colours.control} reduced={reduced} />
      <Well x={268} colour={colours.test} test={colours.product} reduced={reduced} />
      <Dropper x={x} liquid={h.liquid} stage={stage} reduced={reduced} />
      <text x={92} y={238} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>Compare dilution</text>
      <text x={268} y={238} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>Halide test</text>
      <text x={180} y={141} textAnchor="middle" fontSize={12} fontWeight={650} fill={SOFT}>Two drops each</text>
    </svg>
  )
}

function Choices({ kind, selected, disabled, choose }: { kind: 'metal' | 'halogen'; selected: string | null; disabled: boolean; choose(id: string): void }) {
  const choices = kind === 'metal' ? METAL_CHOICES : HALOGEN_CHOICES
  return (
    <div className="flex items-center gap-1.5" aria-label={kind === 'metal' ? 'Name the sample' : 'Name the halogen in the original halide'}>
      <span className="shrink-0 text-[12px] font-bold text-ss-slate">{kind === 'metal' ? 'Sample is' : 'Halogen was'}</span>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {choices.map((id) => (
          <button key={id} type="button" data-choice={id} aria-label={`Choose ${id}`} aria-pressed={selected === id} disabled={disabled} onClick={() => choose(id)}
            className={`${RUN} !px-1 ${selected === id ? 'border-[color:var(--subject)] bg-ss-chip' : ''}`}>{cap(id)}</button>
        ))}
      </div>
    </div>
  )
}

export function PeriodicGroupsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? periodicGroupsEngine.solve(config) : state
  const stage = stageOf(config, now)
  const tested = now?.tested === true
  const added = addedOf(now)
  const answer = answerOf(now)
  const good = marked === 'right' || marked === 'shown'
  const canHandle = !locked && !good
  const finished = marked !== 'idle'
  const verdict = good ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const colours = halideColours(config, added, stage)

  const put = (next: PeriodicState) => { if (canHandle) setState(next) }
  const advanceWater = () => {
    if (config.task !== 'water') return
    put({ tested: true, stage: clamp(tested ? stage + 1 : 1, 1, 3), answer })
  }
  const advanceHalide = () => {
    if (config.task !== 'halide' || !added) return
    put({ added, stage: clamp(stage + 1, 1, 2), answer: null })
  }
  const cycle = (by: number) => {
    if (config.task !== 'halide') return
    const current = HALOGEN_CHOICES.indexOf((added ?? 'chlorine') as (typeof HALOGEN_CHOICES)[number])
    const next = HALOGEN_CHOICES[(clamp(current, 0, 2) + by + 3) % 3]
    put({ added: next, stage: 0, answer: null })
  }

  let caption = ''
  if (config.task === 'water') {
    const m = alkaliOf(config.metal)
    caption = !tested ? 'Drop the sample in. Watch what it does.'
      : stage === 1 ? 'It floats on the water.'
      : stage === 2 ? `${m.melts ? 'A silvery ball moves over the water.' : 'The solid stays in shape.'} Bubbles rise${m.flame ? '; a lilac flame burns.' : '.'}`
      : 'The sample has reacted. Name it from what you saw.'
  } else {
    caption = stage === 0 ? 'Test plain water first, then the halide.'
      : stage === 1 ? 'The control shows dilution. Now test the halide.'
      : colours.product ? 'The test well changed colour, not just the control.'
      : 'Both wells look the same. Try a different halogen water.'
  }

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        {config.task === 'water'
          ? <WaterPicture config={config} stage={stage} tested={tested} reduced={reduced} />
          : <HalidePicture config={config} added={added} stage={stage} reduced={reduced} />}
        <figcaption className="min-h-[18px] text-center text-[12px] font-bold leading-snug text-ss-slate">{caption}</figcaption>
      </figure>

      {config.task === 'water' ? (
        stage < 3 ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">{!tested ? 'Test the sample' : stage === 1 ? 'Stage 1 of 3: floating' : 'Stage 2 of 3: reacting'}</span>
            <button type="button" data-action="water-stage" aria-label={!tested ? 'Drop the sample into the cold water' : stage === 1 ? 'Watch the sample reacting' : 'Finish the reaction'} disabled={!canHandle} onClick={advanceWater} className={RUN}>
              {!tested ? 'Drop it in' : stage === 1 ? 'Watch it react' : 'Finish reacting'}
            </button>
          </div>
        ) : <Choices kind="metal" selected={answer} disabled={!canHandle} choose={(id) => put({ tested: true, stage: 3, answer: id })} />
      ) : (
        <>
          {stage < 2 && <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12px] font-bold text-ss-slate">Halogen water</span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Previous halogen water" disabled={!canHandle} onClick={() => cycle(-1)} className={STEP}>‹</button>
              <span className="w-[72px] text-center text-[15px] font-extrabold text-ss-ink" data-reagent={added ?? 'chlorine'}>{cap(added ?? 'chlorine')}</span>
              <button type="button" aria-label="Next halogen water" disabled={!canHandle} onClick={() => cycle(1)} className={STEP}>›</button>
            </span>
          </div>}
          {stage < 2 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-ss-slate">{stage === 0 ? 'First: control' : 'Next: halide'}</span>
              <button type="button" data-action="halide-stage" aria-label={stage === 0 ? 'Add two drops to the water control' : `Add two drops to the ${config.task === 'halide' ? halideOf(config.halide).name : 'halide'}`} disabled={!canHandle} onClick={advanceHalide} className={RUN}>
                {stage === 0 ? 'Add to control' : 'Add to halide'}
              </button>
            </div>
          ) : colours.product ? (
            <Choices kind="halogen" selected={answer} disabled={!canHandle} choose={(id) => put({ added, stage: 2, answer: id })} />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-ss-slate">No new halogen seen</span>
              <button type="button" data-action="change-reagent" aria-label="Change the halogen water and start the test again" disabled={!canHandle} onClick={() => put({ added, stage: 0, answer: null })} className={RUN}>Change reagent</button>
            </div>
          )}
        </>
      )}

      {finished && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
          {good && <p className="mt-1 text-[12px] font-semibold leading-snug text-ss-slate">{equationOf(config, added)}</p>}
        </div>
      )}
    </div>
  )
}
