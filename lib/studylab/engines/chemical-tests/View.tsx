'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { ChemicalConfig, ChemicalState, DetectorId, Precipitate, ReagentId } from './config'
import {
  CORRECT_DETECTOR, DETECTOR_NAMES, FLAME_COLOURS, MAX_DROPS, REAGENT_NAMES, SPECIES_NAMES,
  chemicalTestsEngine, detectorOf, gasEvent, gasStage, madeText, observationAt, reagentsFor,
  safeFlame, safeGas, safeSolution, stageOf, working, resultOf, CATIONS, ANIONS, FLAMES, GASES,
} from './config'

type Props = SceneViewProps<ChemicalConfig, ChemicalState>

// The same quiet plate in both themes. Apparatus colours are material colours, never theme-dependent.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#263442'
const SOFT = '#526273'
const GLASS = '#E4EDF3'
const GLASS_EDGE = '#60798C'
const LIQUID = '#DCEAF1'
const WHITE = '#FFFFFF'
const RUBBER = '#3F4A54'
const METAL = '#8999A5'
const METAL_DARK = '#53616C'
const WOOD = '#C79A61'
const WOOD_EDGE = '#785B3B'
const BLUE_FLAME = '#4B82C3'
const BLUE_INNER = '#B7D9EF'
const LITMUS_RED = '#D66A75'
const LITMUS_BLUE = '#537FC0'
const ACCENT = '#216E9C'
const FONT = 'system-ui, sans-serif'

export const PANEL_WIDTH = 360
export const SOLUTION_HEIGHT = 260
export const FLAME_HEIGHT = 250
export const GAS_HEIGHT = 250

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const ACTION = 'nodrag inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 py-1 text-[13px] font-extrabold text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40'

const PPT_COLOURS: Record<Precipitate, { fill: string; edge: string }> = {
  white: { fill: '#F8F8F1', edge: '#929D9F' },
  cream: { fill: '#E5D2A9', edge: '#A18B63' },
  yellow: { fill: '#E4C84C', edge: '#9B842E' },
  'light blue': { fill: '#72B9D9', edge: '#397B9E' },
  green: { fill: '#72976B', edge: '#496745' },
  'red-brown': { fill: '#A66048', edge: '#704232' },
}

const ease = (reduced: boolean, property = 'fill') => reduced ? undefined : { transition: `${property} 650ms ease, opacity 650ms ease` }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Plate({ height, label, children }: { height: number; label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${PANEL_WIDTH} ${height}`} role="img" aria-label={label} className="block h-auto w-full select-none" fontFamily={FONT} style={{ color: INK }}>
      <rect x={0.75} y={0.75} width={PANEL_WIDTH - 1.5} height={height - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {children}
    </svg>
  )
}

function Stepper({ label, value, previous, next, locked }: { label: string; value: string; previous(): void; next(): void; locked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} disabled={locked} onClick={previous} className={STEP}>−</button>
        <span className="min-w-0 flex-1 text-center text-[13px] font-extrabold leading-tight text-ss-ink" aria-live="polite">{value}</span>
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} disabled={locked} onClick={next} className={STEP}>+</button>
      </span>
    </div>
  )
}

function Identify({ task, value, set, locked }: { task: ChemicalConfig['task']; value: string; set(value: string): void; locked: boolean }) {
  const id = useId()
  const ids = task === 'solution' ? [...CATIONS, ...ANIONS] : task === 'flame' ? [...FLAMES] : [...GASES]
  const options = ids.slice().sort((a, b) => SPECIES_NAMES[a].localeCompare(SPECIES_NAMES[b]))
  return (
    <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-2">
      <label htmlFor={id} className="shrink-0 text-[12px] font-bold text-ss-slate">{task === 'gas' ? 'Gas present' : 'Ion present'}</label>
      <select
        id={id} aria-label={task === 'gas' ? 'Select the gas present' : 'Select the ion present'} value={value} disabled={locked}
        onChange={(e) => set(e.target.value)}
        className="nodrag min-w-0 max-w-[225px] rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-[13px] font-bold text-ss-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--subject)]"
      >
        <option value="">Choose after testing</option>
        {options.map((id) => <option key={id} value={id}>{cap(SPECIES_NAMES[id])}</option>)}
      </select>
    </div>
  )
}

function Verdict({ marked, text }: { marked: Props['marked']; text: string }) {
  if (marked === 'idle') return null
  return <p aria-live="polite" className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

// ---------------------------------------------------------------------------
// Solution tests.

function ReagentBottle({ name, stage, reduced }: { name: string; stage: number; reduced: boolean }) {
  const words = name.split(' ')
  return (
    <g>
      <rect x={156} y={16} width={80} height={59} rx={10} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.8} />
      <rect x={169} y={8} width={54} height={19} rx={3} fill={RUBBER} />
      {[176, 184, 192, 200, 208, 216].map((x) => <line key={x} x1={x} y1={10} x2={x} y2={25} stroke="#73808A" strokeWidth={1.2} />)}
      <rect x={164} y={37} width={64} height={27} rx={3} fill={WHITE} stroke={PLATE_EDGE} />
      <text x={196} y={48} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{words[0]}</text>
      <text x={196} y={60} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{words.slice(1).join(' ')}</text>
      <path d="M190 74 V94 Q190 101 196 101 Q202 101 202 94 V74" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d="M196 76 V98" stroke={LIQUID} strokeWidth={4} strokeLinecap="round" />
      {stage > 0 && (
        <ellipse key={stage} cx={196} cy={106} rx={3.3} ry={5} fill="#9FC6D8" style={reduced ? undefined : { animation: 'ct-drop 650ms ease-in both' }} />
      )}
    </g>
  )
}

function PrecipitateLayer({ colour, stage, reduced }: { colour: Precipitate; stage: number; reduced: boolean }) {
  const c = PPT_COLOURS[colour]
  const deep = stage >= 2 ? 34 : 19
  const grains = [
    [174, 218], [187, 224], [204, 217], [218, 225], [179, 208], [198, 207], [216, 198], [185, 197], [202, 188],
  ]
  return (
    <g style={reduced ? undefined : { transition: 'opacity 650ms ease' }}>
      <path d={`M166 ${228 - deep} Q179 ${224 - deep} 194 ${228 - deep} Q210 ${232 - deep} 226 ${227 - deep} L226 217 Q226 232 196 234 Q166 232 166 217 Z`} fill={c.fill} stroke={c.edge} strokeWidth={1.1} />
      <path d="M166 138 Q181 133 196 138 T226 138 V224 Q196 217 166 224 Z" fill={c.fill} opacity={0.58} />
      {grains.slice(0, stage >= 2 ? 9 : 6).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={c.fill} stroke={c.edge} strokeWidth={0.7} />)}
    </g>
  )
}

function SolutionTube({ sample, reagent, stage, reduced, id }: { sample: string; reagent: ReagentId; stage: number; reduced: boolean; id: string }) {
  const acid = reagent === 'dilute-acid'
  const observed = acid ? stage >= 2 : stage >= 1
  const result = resultOf(sample, reagent)
  const precipitate = result.precipitate
  const dissolving = stage >= MAX_DROPS && result.dissolves
  const darkBlue = stage >= MAX_DROPS && result.solution === 'dark blue'
  const bubbling = acid && stage >= 2 && result.gas === 'carbon dioxide'
  const milky = acid && stage >= MAX_DROPS && result.gas === 'carbon dioxide'
  return (
    <g>
      <defs>
        <clipPath id={`${id}-tube`}><path d="M164 105 V216 Q164 235 196 235 Q228 235 228 216 V105 Z" /></clipPath>
      </defs>
      <path d="M164 103 V216 Q164 236 196 236 Q228 236 228 216 V103" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={2} />
      <g clipPath={`url(#${id}-tube)`}>
        <path d="M165 135 Q180 131 196 135 Q212 139 227 135 V236 H165 Z" fill={darkBlue ? '#317FAE' : LIQUID} style={ease(reduced)} />
        <path d="M165 135 Q180 131 196 135 Q212 139 227 135" fill="none" stroke="#83A7B9" strokeWidth={1.4} />
        {precipitate && !dissolving && observed && <PrecipitateLayer colour={precipitate} stage={stage} reduced={reduced} />}
        {bubbling && [[176, 202, 4], [196, 213, 3], [216, 190, 4], [184, 178, 3], [204, 160, 3.5], [178, 149, 2.5]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={WHITE} fillOpacity={0.7} stroke="#7CA3B6" strokeWidth={1} style={reduced ? undefined : { animation: `ct-bubble 900ms ${i * 80}ms ease-out both` }} />
        ))}
      </g>
      <path d="M156 102 H236" stroke={GLASS_EDGE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M173 109 V213" stroke={WHITE} strokeOpacity={0.75} strokeWidth={3} strokeLinecap="round" />
      <rect x={140} y={241} width={112} height={7} rx={3} fill={METAL_DARK} />
      <path d="M149 239 H243" stroke="#A9B5BD" strokeWidth={1.5} />
      <text x={acid ? 140 : 244} y={176} textAnchor={acid ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={SOFT}>unknown</text>
      <text x={acid ? 140 : 244} y={191} textAnchor={acid ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={SOFT}>solution</text>
      {acid && (
        <g>
          <path d="M214 111 H243 Q253 111 253 121 V145 Q253 153 262 153 H278 V174" fill="none" stroke={GLASS_EDGE} strokeWidth={5} strokeLinejoin="round" />
          <path d="M214 111 H243 Q253 111 253 121 V145 Q253 153 262 153 H278 V174" fill="none" stroke={GLASS} strokeWidth={2.5} strokeLinejoin="round" />
          <path d="M269 155 V214 Q269 229 285 229 Q301 229 301 214 V155" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.7} />
          <path d="M271 181 Q285 177 299 181 V215 Q299 227 285 227 Q271 227 271 215 Z" fill={milky ? '#F4F3E9' : LIQUID} style={ease(reduced)} />
          <text x={285} y={246} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>limewater</text>
        </g>
      )}
    </g>
  )
}

function SolutionCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<ChemicalConfig, { task: 'solution' }> }) {
  const id = useId().replace(/:/g, '')
  const sample = safeSolution(config.sample)
  const reagents = reagentsFor(sample)
  const selected = state.reagent && (reagents as readonly string[]).includes(state.reagent) ? state.reagent as ReagentId : reagents[0]
  const stage = stageOf(state, selected)
  const index = reagents.indexOf(selected)
  const answer = typeof state.answer === 'string' ? state.answer : ''
  const observation = observationAt(sample, selected, stage)
  const setReagent = (next: number) => {
    if (locked) return
    const r = reagents[(next + reagents.length) % reagents.length]
    setState({ ...state, reagent: r })
  }
  const addDrop = () => {
    if (locked || stage >= MAX_DROPS) return
    setState({ ...state, reagent: selected, tests: { ...state.tests, [selected]: stage + 1 } })
  }
  const phase = stage === 0 ? 'not added' : stage === 1 ? selected === 'dilute-acid' ? 'acidified' : 'a little' : stage === 2 ? 'more added' : 'excess'
  return (
    <>
      <style>{'@keyframes ct-drop{0%{transform:translateY(-8px);opacity:0}25%{opacity:1}100%{transform:translateY(20px);opacity:0}}@keyframes ct-bubble{0%{transform:translateY(8px);opacity:.3}100%{transform:translateY(-10px);opacity:1}}'}</style>
      <figure className="m-0 flex flex-col gap-1.5">
        <Plate height={SOLUTION_HEIGHT} label={`A dropper bottle of ${REAGENT_NAMES[selected].toLowerCase()} above a test tube of unknown solution. ${observation}`}>
          <ReagentBottle name={REAGENT_NAMES[selected]} stage={stage} reduced={reduced} />
          <SolutionTube sample={sample} reagent={selected} stage={stage} reduced={reduced} id={id} />
        </Plate>
        <figcaption className="min-h-[32px] text-center text-[12px] font-bold leading-snug text-ss-slate">{observation}</figcaption>
      </figure>
      <Stepper label="Reagent" value={REAGENT_NAMES[selected]} locked={locked} previous={() => setReagent(index - 1)} next={() => setReagent(index + 1)} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={ACTION} aria-label={`Add a drop of ${REAGENT_NAMES[selected].toLowerCase()}`} disabled={locked || stage >= MAX_DROPS} onClick={addDrop}>Add a drop</button>
        <span className="text-[12px] font-bold text-ss-slate" data-stage={stage}>{cap(phase)}</span>
      </div>
      <Identify task="solution" value={answer} locked={locked} set={(answer) => setState({ ...state, answer })} />
      <Verdict marked={marked} text={marked === 'idle' ? '' : marked === 'wrong' ? madeText(config, state) : working(config, state)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Flame test.

function Burner({ sample, heated, reduced }: { sample: string; heated: boolean; reduced: boolean }) {
  const flame = FLAME_COLOURS[safeFlame(sample)]
  const outer = heated ? flame.colour : BLUE_FLAME
  const inner = heated ? flame.inner : BLUE_INNER
  return (
    <g>
      <path d="M161 133 C151 108 168 94 180 53 C185 80 204 102 197 133 Z" fill={outer} style={ease(reduced)} />
      <path d="M173 133 C169 115 179 103 182 84 C190 105 192 117 188 133 Z" fill={inner} style={ease(reduced)} />
      <rect x={168} y={130} width={25} height={78} rx={4} fill={METAL} stroke={METAL_DARK} strokeWidth={2} />
      <rect x={164} y={184} width={33} height={17} rx={3} fill={METAL_DARK} />
      <circle cx={181} cy={191} r={5} fill={PLATE} stroke={METAL_DARK} strokeWidth={2} />
      <rect x={143} y={205} width={75} height={13} rx={5} fill={METAL_DARK} />
      <path d="M151 205 H211" stroke="#A9B5BD" strokeWidth={2} />
      <path d="M194 194 H224" stroke={METAL_DARK} strokeWidth={6} strokeLinecap="round" />
      <text x={180} y={238} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Bunsen burner</text>
    </g>
  )
}

function FlameCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<ChemicalConfig, { task: 'flame' }> }) {
  const sample = safeFlame(config.sample)
  const heated = state.heated === true
  const [loop, setLoop] = useState({ x: 246, y: 88 })
  const [dragging, setDragging] = useState(false)
  const moved = useRef(false)
  const svg = useRef<SVGSVGElement>(null)
  const answer = typeof state.answer === 'string' ? state.answer : ''
  const at = heated && !dragging ? { x: 181, y: 88 } : loop
  const flameName = heated ? FLAME_COLOURS[sample].name : 'blue'
  const setHeat = (yes: boolean) => {
    if (locked) return
    setState({ ...state, heated: yes })
    if (!yes) setLoop({ x: 246, y: 88 })
  }
  const point = (e: PointerEvent) => {
    const el = svg.current
    if (!el || locked) return
    const b = el.getBoundingClientRect()
    const x = Math.max(115, Math.min(302, ((e.clientX - b.left) / b.width) * PANEL_WIDTH))
    const y = Math.max(45, Math.min(160, ((e.clientY - b.top) / b.height) * FLAME_HEIGHT))
    setLoop({ x, y })
    if (x >= 145 && x <= 216 && y >= 55 && y <= 136 && !heated) setState({ ...state, heated: true })
  }
  const onKey = (e: KeyboardEvent) => {
    if (locked) return
    const d = ({ ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] } as Record<string, number[]>)[e.key]
    if (d) {
      e.preventDefault(); e.stopPropagation()
      const next = { x: Math.max(115, Math.min(302, at.x + d[0])), y: Math.max(45, Math.min(160, at.y + d[1])) }
      setLoop(next)
      if (next.x >= 145 && next.x <= 216 && next.y >= 55 && next.y <= 136) setState({ ...state, heated: true })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopPropagation(); setHeat(!heated)
    }
  }
  return (
    <>
      <figure className="m-0 flex flex-col gap-1.5">
        <div className="relative">
          <svg ref={svg} viewBox={`0 0 ${PANEL_WIDTH} ${FLAME_HEIGHT}`} role="group" aria-label={`A nichrome wire loop and a Bunsen burner. The flame is ${flameName}.`} className="block h-auto w-full touch-none select-none" fontFamily={FONT} style={{ color: INK }}>
            <rect x={0.75} y={0.75} width={PANEL_WIDTH - 1.5} height={FLAME_HEIGHT - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <Burner sample={sample} heated={heated} reduced={reduced} />
            <g>
              <rect x={32} y={151} width={64} height={65} rx={8} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.8} />
              <rect x={42} y={143} width={44} height={14} rx={3} fill={RUBBER} />
              <rect x={39} y={170} width={50} height={28} rx={3} fill={WHITE} stroke={PLATE_EDGE} />
              <text x={64} y={181} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>unknown</text>
              <text x={64} y={194} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>sample</text>
            </g>
            <g
              role="slider" tabIndex={locked ? -1 : 0} aria-label="Wire loop. Drag it into the flame, use arrow keys, or press Enter" aria-valuetext={heated ? 'The loop is in the flame' : 'The loop is out of the flame'}
              onKeyDown={onKey} className="outline-none focus-visible:outline-none" style={{ cursor: locked ? 'default' : dragging ? 'grabbing' : 'grab' }}
              onPointerDown={(e) => { if (locked) return; moved.current = false; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId) }}
              onPointerMove={(e) => { if (dragging) { moved.current = true; point(e) } }}
              onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
              onClick={() => { if (!moved.current) setHeat(!heated); moved.current = false }}
            >
              <path d={`M${at.x} ${at.y} L${Math.min(326, at.x + 94)} ${Math.min(176, at.y + 47)}`} stroke="#687985" strokeWidth={2.4} />
              <ellipse cx={at.x} cy={at.y} rx={11} ry={8} fill="none" stroke={METAL_DARK} strokeWidth={2.4} />
              <g transform={`translate(${Math.min(315, at.x + 78)} ${Math.min(163, at.y + 39)}) rotate(27)`}>
                <rect x={-7} y={-19} width={14} height={38} rx={6} fill={RUBBER} stroke={INK} strokeWidth={1.2} />
                <path d="M-3 -12 V10" stroke="#74818B" strokeWidth={2} strokeLinecap="round" />
              </g>
              <circle cx={at.x} cy={at.y} r={24} fill="transparent" />
              {!locked && <path d={`M${at.x - 17} ${at.y - 15} l5 -5 M${at.x - 17} ${at.y - 15} h7 M${at.x - 17} ${at.y - 15} v7`} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />}
            </g>
          </svg>
        </div>
        <figcaption className="min-h-[18px] text-center text-[12px] font-bold text-ss-slate">{heated ? `The flame is ${flameName}. What metal ion is present?` : 'Put the wire loop into the flame and watch.'}</figcaption>
      </figure>
      <Identify task="flame" value={answer} locked={locked} set={(answer) => setState({ ...state, answer })} />
      <Verdict marked={marked} text={marked === 'idle' ? '' : marked === 'wrong' ? madeText(config, state) : working(config, state)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Gas tests.

function GasTube({ children }: { children?: ReactNode }) {
  return (
    <g>
      <path d="M153 52 V199 Q153 222 180 222 Q207 222 207 199 V52" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={2} />
      <path d="M147 51 H213" stroke={GLASS_EDGE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M159 61 V193" stroke={WHITE} strokeOpacity={0.75} strokeWidth={3} strokeLinecap="round" />
      <text x={222} y={139} fontSize={12} fontWeight={700} fill={SOFT}>unknown gas</text>
      {children}
    </g>
  )
}

function Splint({ event, stage, reduced }: { event: string; stage: number; reduced: boolean }) {
  const relit = stage >= 2 && event === 'relights'
  const pop = stage >= 2 && event === 'pop'
  const out = stage >= 2 && event === 'splint-out'
  return (
    <g transform={stage === 0 ? 'translate(-48 48)' : undefined} style={reduced ? undefined : { transition: 'transform 650ms ease' }}>
      <path d="M45 125 L166 70" stroke={WOOD_EDGE} strokeWidth={9} strokeLinecap="round" />
      <path d="M45 123 L166 68" stroke={WOOD} strokeWidth={6} strokeLinecap="round" />
      <path d="M52 120 L69 113" stroke="#E2C496" strokeWidth={1.4} />
      {!out && <circle cx={166} cy={69} r={5} fill={relit ? '#F2A640' : '#B8573E'} style={ease(reduced)} />}
      {out && <path d="M166 63 C157 52 174 48 165 36 C158 27 174 24 169 15" fill="none" stroke="#94A3B8" strokeWidth={2.3} strokeLinecap="round" />}
      {relit && <path d="M166 73 C150 63 163 52 166 36 C172 52 183 61 172 73 Z" fill="#E6983F" style={ease(reduced)} />}
      {pop && (
        <g stroke="#C97735" strokeWidth={2.4} strokeLinecap="round">
          <path d="M166 49 V35 M148 56 L137 46 M184 56 L195 46 M145 72 H130 M187 72 H202" />
          <path d="M158 49 L153 40 M176 49 L181 40" />
          <path d="M156 78 L166 63 L174 78 Z" fill="#F2B14F" stroke="none" />
        </g>
      )}
      <text x={72} y={145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>splint</text>
    </g>
  )
}

function GasApparatus({ detector, stage, event, reduced }: { detector: DetectorId; stage: number; event: string; reduced: boolean }) {
  const litmusColour = stage < 2 ? LITMUS_RED : event === 'blue-litmus' ? LITMUS_BLUE : event === 'bleached-litmus' ? '#FAFAF5' : LITMUS_RED
  if (detector === 'glowing-splint') return <GasTube><Splint event={event} stage={stage} reduced={reduced} /></GasTube>
  if (detector === 'damp-red-litmus') {
    return (
      <GasTube>
        <g transform={stage === 0 ? 'translate(-78 36)' : undefined} style={reduced ? undefined : { transition: 'transform 650ms ease' }}>
          <path d="M166 22 H185 V89 Q175 96 166 89 Z" fill={litmusColour} stroke={stage >= 2 && event === 'bleached-litmus' ? '#9AA5AC' : '#9B4D5B'} strokeWidth={1.4} style={ease(reduced)} />
          <path d="M171 27 V83" stroke={WHITE} strokeOpacity={0.35} strokeWidth={2} />
          <text x={176} y={15} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>damp litmus</text>
        </g>
      </GasTube>
    )
  }
  const milky = stage >= 2 && event === 'milky'
  return (
    <g>
      <GasTube />
      <path d="M205 62 H235 Q246 62 246 74 V109 Q246 117 255 117 H278 V143" fill="none" stroke={GLASS_EDGE} strokeWidth={6} strokeLinejoin="round" />
      <path d="M205 62 H235 Q246 62 246 74 V109 Q246 117 255 117 H278 V143" fill="none" stroke={GLASS} strokeWidth={3} strokeLinejoin="round" />
      <path d="M263 126 V199 Q263 219 285 219 Q307 219 307 199 V126" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={2} />
      <path d="M265 157 Q285 152 305 157 V200 Q305 217 285 217 Q265 217 265 200 Z" fill={milky ? '#F4F3E9' : LIQUID} style={ease(reduced)} />
      {stage > 0 && [[281, 191, 3], [290, 180, 4], [280, 167, 2.5], [291, 151, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={WHITE} fillOpacity={0.75} stroke="#8AA8B6" />)}
      <text x={285} y={239} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>limewater</text>
    </g>
  )
}

function GasCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<ChemicalConfig, { task: 'gas' }> }) {
  const sample = safeGas(config.sample)
  const stage = gasStage(state)
  const stored = detectorOf(state)
  const detector: DetectorId = stored ?? 'glowing-splint'
  const detectors = Object.keys(DETECTOR_NAMES) as DetectorId[]
  const index = detectors.indexOf(detector)
  const event = gasEvent(sample, detector)
  const answer = typeof state.answer === 'string' ? state.answer : ''
  const observation = stage < 2 ? stage === 1 ? `${DETECTOR_NAMES[detector]} is at the gas. See the result.` : 'Choose a test tool and bring it to the gas.' : ({
    pop: 'A squeaky pop, with a tiny flash.', relights: 'The glowing splint bursts into flame.', milky: 'The limewater turns milky.',
    'blue-litmus': 'The damp red litmus turns blue.', 'bleached-litmus': 'The damp red litmus is bleached white.',
    'splint-out': 'The splint goes out.', 'no-change': 'No visible change.',
  } as Record<string, string>)[event]
  const act = () => {
    if (locked) return
    if (stage === 0) setState({ ...state, detector, stage: 1 })
    else if (stage === 1) setState({ ...state, detector, stage: 2 })
    else setState({ ...state, detector, stage: 1 })
  }
  const change = (next: number) => {
    if (locked) return
    const d = detectors[(next + detectors.length) % detectors.length]
    setState({ ...state, detector: d, stage: 0 })
  }
  const action = stage === 0 ? `Use ${DETECTOR_NAMES[detector].toLowerCase()}` : stage === 1 ? 'See the result' : 'Test again'
  return (
    <>
      <figure className="m-0 flex flex-col gap-1.5">
        <Plate height={GAS_HEIGHT} label={`A tube of unknown gas and ${DETECTOR_NAMES[detector].toLowerCase()}. ${observation}`}>
          <GasApparatus detector={detector} stage={stage} event={event} reduced={reduced} />
        </Plate>
        <figcaption className="min-h-[18px] text-center text-[12px] font-bold text-ss-slate">{observation}</figcaption>
      </figure>
      <Stepper label="Test tool" value={DETECTOR_NAMES[detector]} locked={locked} previous={() => change(index - 1)} next={() => change(index + 1)} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={ACTION} onClick={act} disabled={locked}>{action}</button>
        <span className="text-[12px] font-bold text-ss-slate">{stage === 0 ? 'ready' : stage === 1 ? 'test applied' : 'result seen'}</span>
      </div>
      <Identify task="gas" value={answer} locked={locked} set={(answer) => setState({ ...state, answer })} />
      <Verdict marked={marked} text={marked === 'idle' ? '' : marked === 'wrong' ? madeText(config, state) : working(config, state)} />
    </>
  )
}

export function ChemicalTestsView(props: Props) {
  const { config, marked } = props
  const state = marked === 'shown' ? chemicalTestsEngine.solve(config) : props.state ?? chemicalTestsEngine.initial(config)
  const next = { ...props, state }
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      {config.task === 'solution' ? <SolutionCard {...next} config={config} />
        : config.task === 'flame' ? <FlameCard {...next} config={config} />
          : <GasCard {...next} config={config} />}
    </div>
  )
}
