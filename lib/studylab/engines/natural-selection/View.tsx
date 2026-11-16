'use client'
import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { NaturalSelectionConfig, SelectionState } from './config'
import {
  HUNT_LIMIT, barkOf, cellAlive, cellResistant, countsNow, doseOf, eatenOf, generationOf, madeText,
  naturalSelectionEngine, offspringColours, offspringResistant, parentColour, working,
} from './config'

type Props = SceneViewProps<NaturalSelectionConfig, SelectionState>

// The picture keeps its own quiet colours in both themes, like measure-shape's instrument plate.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const PALE_WING = '#D7CEB8'
const PALE_EDGE = '#514B42'
const DARK_WING = '#454A47'
const DARK_EDGE = '#171C1A'
const BODY = '#302C26'
const GOLD = '#C89432'
const GOLD_EDGE = '#765417'
const CELL = '#B9DDE1'
const CELL_EDGE = '#326B75'
const RESISTANT = '#F1D58E'
const RESISTANT_EDGE = '#8A601C'
const DEAD = '#E6E7E3'
const DEAD_EDGE = '#8A918D'
const GLASS = '#E7F0F2'

// Literal viewBox constants: config.ts imports this file, so no config constant is read while it loads.
export const W = 360
export const H = 244
const POSITIONS = [
  { x: 56, y: 65, turn: -17 }, { x: 126, y: 57, turn: 9 }, { x: 202, y: 65, turn: -7 }, { x: 280, y: 57, turn: 16 },
  { x: 47, y: 157, turn: 13 }, { x: 120, y: 150, turn: -10 }, { x: 195, y: 158, turn: 11 }, { x: 275, y: 149, turn: -13 },
  { x: 91, y: 207, turn: 5 }, { x: 239, y: 207, turn: -7 },
]
const CELL_POSITIONS = [
  { x: 105, y: 83, turn: -25 }, { x: 179, y: 67, turn: 15 }, { x: 254, y: 86, turn: 62 },
  { x: 79, y: 132, turn: 22 }, { x: 146, y: 119, turn: -52 }, { x: 216, y: 128, turn: -9 }, { x: 285, y: 139, turn: 32 },
  { x: 111, y: 177, turn: 52 }, { x: 182, y: 181, turn: -17 }, { x: 248, y: 178, turn: 24 },
]
const BIRD_START = { x: 321, y: 207 }
const BIRD_PERCH = { x: 313, y: 36 }
const ACTION = 'nodrag flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 py-1 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none'
const ease = (reduced: boolean, what = 'all', ms = 650): CSSProperties | undefined => reduced ? undefined : { transition: `${what} ${ms}ms ease` }

/** A peppered moth at rest: four scalloped wings, peppering, a furry thorax, abdomen and antennae. */
function Moth({ x, y, turn, colour, eaten, reduced, label, onDarkBark }: {
  x: number; y: number; turn: number; colour: 'pale' | 'dark'; eaten: boolean; reduced: boolean; label: string; onDarkBark: boolean
}) {
  // Camouflage is the lesson: a moth the colour of its bark gets edges and flecks in the bark's own tones, so it is
  // findable but hard to spot, while the other colour keeps its strong outline and stands out.
  const hidden = (colour === 'dark') === onDarkBark
  const wing = colour === 'pale' ? PALE_WING : DARK_WING
  const edge = hidden ? (colour === 'dark' ? '#3A3B36' : '#ADA791') : colour === 'pale' ? PALE_EDGE : DARK_EDGE
  const fleck = hidden ? (colour === 'dark' ? '#5C5D56' : '#BAB49E') : colour === 'pale' ? '#6B6458' : '#A5ACA4'
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} style={ease(reduced, 'opacity', 450)} opacity={eaten ? 0 : 1} aria-label={label}>
      <g fill={wing} stroke={edge} strokeWidth={1.25} strokeLinejoin="round">
        <path d="M -3 1 C -14 1 -27 7 -25 17 C -22 23 -10 20 -2 10 Z" />
        <path d="M 3 1 C 14 1 27 7 25 17 C 22 23 10 20 2 10 Z" />
        <path d="M -2 -4 C -10 -20 -28 -22 -29 -8 C -31 -1 -25 5 -14 8 L -2 5 Z" />
        <path d="M 2 -4 C 10 -20 28 -22 29 -8 C 31 -1 25 5 14 8 L 2 5 Z" />
      </g>
      <g fill="none" stroke={fleck} strokeWidth={0.9} opacity={0.85}>
        <path d="M -4 -2 Q -15 -9 -25 -8 M 4 -2 Q 15 -9 25 -8 M -4 3 Q -15 0 -25 1 M 4 3 Q 15 0 25 1" />
        <path d="M -5 7 Q -15 9 -21 15 M 5 7 Q 15 9 21 15" />
      </g>
      <g fill={fleck}>
        {[[-19,-13],[-12,-7],[-23,-4],[-12,11],[-7,6],[19,-13],[12,-7],[23,-4],[12,11],[7,6]].map(([a,b], i) => <circle key={i} cx={a} cy={b} r={1.05} />)}
      </g>
      <path d="M -1 -9 Q -8 -17 -11 -14 M 1 -9 Q 8 -17 11 -14" fill="none" stroke={BODY} strokeWidth={1.1} strokeLinecap="round" />
      <ellipse cx={0} cy={6} rx={2.7} ry={10} fill={BODY} />
      <ellipse cx={0} cy={-3} rx={4.3} ry={6} fill={edge} />
      <path d="M -2 -6 L 2 -4 M -3 -2 L 3 0 M -2 2 L 2 4" stroke={fleck} strokeWidth={0.8} />
    </g>
  )
}

/** A small bird, drawn as the actual predator rather than a cross standing for an event. */
function Bird({ x, y, turn, reduced }: { x: number; y: number; turn: number; reduced: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} style={ease(reduced, 'transform', 650)} aria-hidden="true">
      <path d="M -5 6 L -15 15 L -4 12 L 1 8" fill="#65736A" stroke="#2C3A31" strokeWidth={1.1} />
      <ellipse cx={0} cy={0} rx={10} ry={8} fill="#839487" stroke="#2C3A31" strokeWidth={1.2} />
      <circle cx={8} cy={-5} r={6} fill="#93A293" stroke="#2C3A31" strokeWidth={1.1} />
      <path d="M 13 -6 L 22 -3 L 13 -1 Z" fill="#C49A4B" stroke="#6C5226" strokeWidth={0.8} />
      <circle cx={10} cy={-7} r={1.35} fill="#111814" />
      <path d="M -6 -4 Q -12 3 -1 5 Q 5 4 5 -1 Q -1 -5 -6 -4" fill="#566A5D" stroke="#34473A" strokeWidth={0.9} />
      <path d="M -4 1 Q -1 2 2 0 M -5 4 Q -2 5 1 3" fill="none" stroke="#B5C0B5" strokeWidth={0.9} />
    </g>
  )
}

function BarkDrawing({ dark, reduced }: { dark: boolean; reduced: boolean }) {
  const base = dark ? '#55524B' : '#C8C3AE'
  const deep = dark ? '#333631' : '#8D8A77'
  const ridge = dark ? '#716B5F' : '#E0D9C1'
  const lichen = dark ? '#8B9380' : '#E7E8D2'
  return (
    <g style={ease(reduced, 'fill')}>
      <rect x={12} y={12} width={336} height={220} rx={13} fill={base} />
      <g fill="none" strokeLinecap="round">
        <path d="M 32 17 Q 19 52 31 86 T 25 154 T 34 226 M 96 14 Q 108 49 92 88 T 103 151 T 93 229 M 171 16 Q 158 51 169 85 T 160 154 T 172 229 M 252 16 Q 266 47 249 83 T 259 154 T 250 228 M 328 15 Q 314 49 329 86 T 320 151 T 330 229" stroke={deep} strokeWidth={5} />
        <path d="M 37 15 Q 27 54 39 83 M 102 91 Q 96 122 108 150 M 178 91 Q 166 122 175 155 M 257 158 Q 250 189 258 224 M 318 158 Q 326 186 319 224" stroke={ridge} strokeWidth={2.5} />
        <path d="M 15 110 L 38 104 M 82 36 L 108 31 M 152 196 L 181 190 M 236 42 L 264 35 M 310 116 L 344 110" stroke={deep} strokeWidth={2} />
      </g>
      <g fill={lichen} stroke={deep} strokeWidth={0.7} opacity={dark ? 0.55 : 1}>
        <path d="M 44 32 Q 49 22 58 28 Q 68 24 70 34 Q 77 40 68 46 Q 59 52 52 46 Q 39 47 44 32 Z" />
        <path d="M 140 99 Q 145 88 154 94 Q 164 89 168 99 Q 176 104 167 111 Q 158 118 151 111 Q 137 113 140 99 Z" />
        <path d="M 293 181 Q 299 169 308 177 Q 318 172 322 182 Q 329 190 318 195 Q 308 201 302 194 Q 288 195 293 181 Z" />
        <path d="M 211 28 Q 216 21 223 25 Q 232 22 235 30 Q 239 37 231 41 Q 222 46 217 40 Q 207 41 211 28 Z" />
      </g>
    </g>
  )
}

/** A bacterial cell: capsule, cytoplasm, coiled DNA and small surface pili. */
function Bacterium({ x, y, turn, resistant, alive, newborn, reduced }: {
  x: number; y: number; turn: number; resistant: boolean; alive: boolean; newborn: boolean; reduced: boolean
}) {
  const fill = !alive ? DEAD : resistant ? RESISTANT : CELL
  const edge = !alive ? DEAD_EDGE : resistant ? RESISTANT_EDGE : CELL_EDGE
  const dna = !alive ? '#9CA39F' : resistant ? '#94691F' : '#397781'
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} style={ease(reduced, 'opacity', newborn ? 750 : 550)} opacity={alive || newborn ? 1 : 0.32}>
      <g stroke={edge} strokeWidth={1} strokeLinecap="round">
        {[-15,-8,0,8,15].map((a) => <g key={a}><line x1={a} y1={-9} x2={a + 1} y2={-13} /><line x1={a} y1={9} x2={a - 1} y2={13} /></g>)}
      </g>
      <rect x={-23} y={-11} width={46} height={22} rx={11} fill={fill} stroke={edge} strokeWidth={1.5} />
      <rect x={-19} y={-7.5} width={38} height={15} rx={7.5} fill="none" stroke={edge} strokeWidth={0.65} opacity={0.55} />
      <path d="M -11 0 C -9 -7 -2 7 2 0 S 11 -6 11 1 S 3 6 -1 0 S -9 -5 -11 0" fill="none" stroke={dna} strokeWidth={1.25} strokeLinecap="round" />
      <circle cx={-14} cy={-3} r={1.4} fill={dna} opacity={0.7} />
      <circle cx={14} cy={4} r={1.2} fill={dna} opacity={0.7} />
      {!alive && <path d="M -4 -10 L -1 -4 L -6 1 L 1 4 L -1 10" fill="none" stroke="#66706B" strokeWidth={1.8} strokeLinecap="round" />}
    </g>
  )
}

function Dish({ children }: { children: ReactNode }) {
  return (
    <g>
      <circle cx={180} cy={122} r={108} fill={GLASS} stroke="#718892" strokeWidth={2.2} />
      <circle cx={180} cy={122} r={99} fill="#F2F6F4" stroke="#A5B7BA" strokeWidth={1.4} />
      <path d="M 97 72 A 99 99 0 0 1 151 29 M 235 210 A 99 99 0 0 0 271 171" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      {children}
    </g>
  )
}

function AntibioticDrop({ dosed, reduced }: { dosed: boolean; reduced: boolean }) {
  return (
    <g transform={`translate(180 ${dosed ? 115 : 31})`} style={ease(reduced, 'transform', 700)} opacity={dosed ? 0 : 1}>
      <path d="M 0 -11 C -3 -5 -8 0 -8 5 A 8 8 0 0 0 8 5 C 8 0 3 -5 0 -11 Z" fill="#B9A5C9" stroke="#655074" strokeWidth={1.2} />
      <path d="M -3 2 Q -5 5 -2 7" fill="none" stroke="#F7F3FA" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  )
}

function Verdict({ text }: { text: string }) {
  if (!text) return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

function keepArrows(e: KeyboardEvent) {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

function HuntCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<NaturalSelectionConfig, { task: 'hunt' }> }) {
  const now = marked === 'shown' ? naturalSelectionEngine.solve(config) as SelectionState : state ?? {}
  const eaten = eatenOf(now)
  const generation = generationOf(now)
  const dark = barkOf(config) === 'dark'
  const colours = offspringColours(config, now)
  const latest = eaten[eaten.length - 1]
  const latestIndex = latest ? Number(latest.slice(1)) : -1
  const target = latestIndex >= 0 ? POSITIONS[latestIndex] : BIRD_START
  const bird = generation ? BIRD_PERCH : latest ? { x: target.x, y: target.y - 9 } : BIRD_START
  const live = !locked && !generation
  const [focused, setFocused] = useState<string | null>(null)
  const counts = countsNow(config, now)
  const atLimit = eaten.length >= HUNT_LIMIT

  const eat = (id: string) => {
    if (!live || eaten.includes(id) || atLimit) return
    setState({ ...now, eaten: [...eaten, id] })
  }
  const reproduce = () => {
    if (!locked && !generation && eaten.length === HUNT_LIMIT) setState({ ...now, generation: 1 })
  }
  const seen = `Ten peppered moths on ${dark ? 'soot-dark' : 'pale lichen-covered'} bark. ${eaten.length ? `${eaten.length} eaten by the bird.` : 'None eaten yet.'} ${generation ? 'The survivors have produced the next generation of ten moths.' : ''}`
  const caption = generation ? `${counts.pale} pale · ${counts.dark} dark · offspring` : `${counts.pale} pale · ${counts.dark} dark · ${eaten.length} eaten`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <BarkDrawing dark={dark} reduced={reduced} />
            {POSITIONS.map((p, i) => (
              <Moth key={i} {...p} onDarkBark={dark} colour={generation ? colours[i] : parentColour(`m${i}`)} eaten={!generation && eaten.includes(`m${i}`)} reduced={reduced} label={`${generation ? colours[i] : parentColour(`m${i}`)} moth ${i + 1}`} />
            ))}
            <Bird {...bird} turn={latest && !generation ? -22 : 0} reduced={reduced} />
          </svg>
          {live && POSITIONS.map((p, i) => {
            const id = `m${i}`
            const gone = eaten.includes(id)
            return (
              <button
                key={id} type="button" aria-label={`Eat ${parentColour(id)} moth ${i + 1}`} disabled={gone || atLimit}
                onClick={() => eat(id)} onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}
                className="absolute h-[64px] w-[66px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none disabled:cursor-default focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, background: 'transparent', border: 'none' }}
              >{focused === id && <span className="sr-only">Press Enter to eat this moth</span>}</button>
            )
          })}
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[12px] font-bold text-ss-slate">
          <span>{dark ? 'Soot-dark bark' : 'Pale, lichen-covered bark'}</span>
          <span className="tabular-nums">{caption}</span>
        </figcaption>
      </figure>
      <div className="flex w-full items-center justify-between gap-2 border-t border-ss-line pt-2">
        <span className="text-[12px] font-bold text-ss-slate">{generation ? 'Survivors reproduced' : atLimit ? 'Four moths eaten' : `Bird may eat ${HUNT_LIMIT - eaten.length} more`}</span>
        {!generation && eaten.length === HUNT_LIMIT && (
          <button type="button" className={ACTION} disabled={locked} onClick={reproduce} aria-label="Let the surviving moths reproduce">
            Let survivors reproduce
          </button>
        )}
      </div>
      {marked !== 'idle' && <Verdict text={marked === 'wrong' ? madeText(config, state) : working(config, now)} />}
    </div>
  )
}

function ResistanceCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<NaturalSelectionConfig, { task: 'resistance' }> }) {
  const now = marked === 'shown' ? naturalSelectionEngine.solve(config) as SelectionState : state ?? {}
  const dosed = doseOf(now) === 1
  const generation = generationOf(now) === 1
  const counts = countsNow(config, now)
  const giveDose = () => {
    if (!locked && !dosed) setState({ ...now, dose: 1 })
  }
  const reproduce = () => {
    if (!locked && dosed && !generation) setState({ ...now, generation: 1 })
  }
  const seen = `A Petri dish with ten bacterial cells: ${counts.resistant} resistant and ${counts.susceptible} susceptible${dosed ? ' after treatment' : ''}. ${generation ? 'The survivors have reproduced to fill the dish.' : dosed ? `${counts.alive} cells survived.` : 'No antibiotic has been given.'}`
  const text = marked === 'wrong' ? madeText(config, state) : working(config, now)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <Dish>
            {CELL_POSITIONS.map((p, i) => {
              const id = `b${i}`
              const resistant = offspringResistant(config, id, now)
              return <Bacterium key={id} {...p} resistant={resistant} alive={generation || cellAlive(config, id, now)} newborn={generation && !cellResistant(config, id)} reduced={reduced} />
            })}
          </Dish>
          {!generation && <AntibioticDrop dosed={dosed} reduced={reduced} />}
        </svg>
        <figcaption className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-[12px] font-bold text-ss-slate">
          <span className="flex items-center gap-1.5"><svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><rect x="1" y="1" width="14" height="10" rx="5" fill={RESISTANT} stroke={RESISTANT_EDGE} /></svg>Resistant</span>
          <span className="flex items-center gap-1.5"><svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><rect x="1" y="1" width="14" height="10" rx="5" fill={CELL} stroke={CELL_EDGE} /></svg>Susceptible</span>
          <span className="flex items-center gap-1.5"><svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M 6 1 C 4 5 1 7 1 10 A 5 5 0 0 0 11 10 C 11 7 8 5 6 1 Z" fill="#B9A5C9" stroke="#655074" /></svg>Antibiotic</span>
        </figcaption>
      </figure>
      <div className="flex w-full items-center justify-between gap-2 border-t border-ss-line pt-2">
        <span className="text-[12px] font-bold tabular-nums text-ss-slate">{generation ? 'Next generation shown' : dosed ? `${counts.alive} ${counts.alive === 1 ? 'survivor' : 'survivors'}` : 'Untreated population'}</span>
        <span className="flex gap-1.5">
          {!dosed && <button type="button" className={ACTION} disabled={locked} onClick={giveDose} aria-label="Give the antibiotic dose">Give antibiotic dose</button>}
          {dosed && <button type="button" className={ACTION} disabled={locked || generation} onClick={reproduce} aria-label="Let the surviving bacteria reproduce">{generation ? 'Reproduced' : 'Let survivors reproduce'}</button>}
        </span>
      </div>
      {marked !== 'idle' && <Verdict text={text} />}
    </div>
  )
}

export function NaturalSelectionView(props: Props) {
  return props.config.task === 'hunt'
    ? <HuntCard {...props} config={props.config} />
    : <ResistanceCard {...props} config={props.config} />
}
