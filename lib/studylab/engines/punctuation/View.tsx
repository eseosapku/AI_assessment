'use client'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Mark, PunctConfig, PunctState, SceneKind } from './config'
import { MARK_NAME, MARK_TEXT, displayParts, madeText, meaningText, passageOf, sentenceText, slotsOf } from './config'

type Props = SceneViewProps<PunctConfig, PunctState>

// A sheet of writing paper on a quiet plate, with the same colours in both themes. The picture is an illustration
// of what the sentence says, never a correctness signal. Flat colour only, with hairline edges and no shadows.
export const W = 360
export const H = 158
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const PAPER = '#FFFFFF'
const INK = '#263548'
const SOFT = INK
const ACCENT = '#B65C38'
const ACCENT_DARK = '#874127'
const BLUE = '#5B8FAE'
const BLUE_DARK = '#35647D'
const SKIN = '#D9A079'
const HAIR = '#543B35'
const GREY_HAIR = '#D4D8DB'
const DRESS = '#8A6F9C'
const SHIRT = '#4F82A4'
const GREEN = '#65876A'
const WOOD = '#B98957'
const WOOD_EDGE = '#7B5738'
const DOG = '#C58C50'
const DOG_DARK = '#795331'
const BONE = '#F1E6CF'
const RED = '#A95349'
const YELLOW = '#D5A944'

const FONT = 'system-ui, sans-serif'
const SERIF = 'Georgia, serif'

const tileClass = 'nodrag flex h-9 w-12 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg border-2 bg-white font-serif text-[27px] font-bold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] active:cursor-grabbing disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none'

function Person({ x, y, grandma = false, mood = 'calm', scale = 1 }: { x: number; y: number; grandma?: boolean; mood?: 'calm' | 'puzzled' | 'alarmed'; scale?: number }) {
  const hair = grandma ? GREY_HAIR : HAIR
  const cloth = grandma ? DRESS : SHIRT
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fontFamily={FONT}>
      {/* body, neck, head and hair: a small person rather than an icon */}
      <path d="M-17 47 Q-16 27 0 25 Q16 27 17 47 Z" fill={cloth} stroke={INK} strokeWidth={1.2} />
      <rect x={-4} y={18} width={8} height={10} rx={3} fill={SKIN} />
      <ellipse cx={0} cy={4} rx={15} ry={18} fill={SKIN} stroke={INK} strokeWidth={1.1} />
      <path d={grandma ? 'M-15 2 Q-18-16 0-17 Q18-16 15 3 Q10-9 0-8 Q-10-9-15 2' : 'M-15 1 Q-17-17 0-17 Q17-17 15 3 Q8-11-3-8 Q-10-5-15 1'} fill={hair} stroke={INK} strokeWidth={1} />
      {grandma && <><circle cx={-12} cy={-10} r={6} fill={GREY_HAIR} stroke={INK} strokeWidth={1} /><path d="M-12 1 Q-6-3-1 1 M1 1 Q6-3 12 1 M-1 1 H1" fill="none" stroke={SOFT} strokeWidth={1.2} /><circle cx={-6.5} cy={1} r={5} fill="none" stroke={SOFT} strokeWidth={1.2} /><circle cx={6.5} cy={1} r={5} fill="none" stroke={SOFT} strokeWidth={1.2} /></>}
      {!grandma && <><circle cx={-5.5} cy={2} r={1.3} fill={INK} /><circle cx={5.5} cy={2} r={1.3} fill={INK} /></>}
      {mood === 'puzzled' && <><path d="M-9-4 L-3-6 M3-5 L9-3" stroke={INK} strokeWidth={1.3} strokeLinecap="round" /><path d="M-4 12 Q0 8 4 12" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" /></>}
      {mood === 'alarmed' && <><path d="M-9-5 L-3-7 M3-7 L9-5" stroke={INK} strokeWidth={1.3} strokeLinecap="round" /><ellipse cx={0} cy={11} rx={4} ry={5} fill={INK} /></>}
      {mood === 'calm' && <path d={grandma ? 'M-5 10 Q0 15 5 10' : 'M-4 10 Q0 13 4 10'} fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />}
    </g>
  )
}

function Bowl({ x, y, food = true }: { x: number; y: number; food?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {food && <path d="M-14 0 Q-10-10-4-5 Q0-13 5-5 Q12-10 14 0" fill={YELLOW} stroke={WOOD_EDGE} strokeWidth={1} />}
      <path d="M-18 0 Q-16 16 0 16 Q16 16 18 0 Z" fill="#E9F0F4" stroke={BLUE_DARK} strokeWidth={1.4} />
      <ellipse cx={0} cy={0} rx={18} ry={4} fill="#F8FBFC" stroke={BLUE_DARK} strokeWidth={1.4} />
    </g>
  )
}

function Table({ y = 117 }: { y?: number }) {
  return <g><rect x={44} y={y} width={272} height={9} rx={2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.2} /><path d={`M64 ${y + 9} L58 151 M296 ${y + 9} L302 151`} stroke={WOOD_EDGE} strokeWidth={7} strokeLinecap="round" /></g>
}

function GrandmaScene({ invited }: { invited: boolean }) {
  return (
    <g data-scene-state={invited ? 'invited' : 'food'}>
      <Table />
      <Person x={82} y={58} />
      {invited ? <><Person x={270} y={55} grandma /><Bowl x={82} y={111} /><Bowl x={270} y={111} /></> : <><Bowl x={82} y={111} /><ellipse cx={250} cy={111} rx={48} ry={10} fill="#EDF2F5" stroke={BLUE_DARK} strokeWidth={1.5} /><Person x={250} y={83} grandma scale={0.72} /><path d="M218 103 Q250 120 282 103" fill="#EDF2F5" stroke={BLUE_DARK} strokeWidth={1.3} /><circle cx={218} cy={108} r={3} fill={GREEN} /><circle cx={283} cy={109} r={3} fill={GREEN} /></>}
      <text x={82} y={151} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>Mia</text>
      <text x={invited ? 270 : 250} y={invited ? 104 : 145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT} stroke={PLATE} strokeWidth={3} paintOrder="stroke">Grandma</text>
    </g>
  )
}

function Sandwich({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><path d="M-22 12 L0-13 L22 12 Z" fill="#E8C785" stroke={WOOD_EDGE} strokeWidth={1.4} /><path d="M-17 7 L0-8 L17 7" fill="none" stroke={GREEN} strokeWidth={4} strokeLinejoin="round" /><path d="M-13 10 L0-2 L13 10" fill="none" stroke={RED} strokeWidth={3} /></g>
}
function Fruit({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><circle cx={0} cy={3} r={15} fill={RED} stroke="#7D3C36" strokeWidth={1.3} /><path d="M0-11 Q-1-21 6-23" fill="none" stroke={WOOD_EDGE} strokeWidth={3} strokeLinecap="round" /><path d="M3-18 Q13-24 16-15 Q8-12 3-18" fill={GREEN} /></g>
}
function Socks({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} fill="#738CA8" stroke={INK} strokeWidth={1.2}><path d="M-15-19 H-2 V2 Q-2 8 6 9 L12 10 Q16 18 7 20 H-8 Q-15 18-15 11 Z" /><path d="M3-22 H15 V-2 Q15 3 21 5 Q27 12 18 15 H7 Q2 12 3 6 Z" fill="#91A8C0" /><path d="M-15-14 H-2 M3-17 H15" stroke="#E9F0F4" strokeWidth={3} /></g>
}
function Torch({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y}) rotate(-18)`}><path d="M-8-20 H8 L6-7 H-6 Z" fill="#697887" stroke={INK} strokeWidth={1.2} /><rect x={-5} y={-8} width={10} height={30} rx={3} fill={YELLOW} stroke={INK} strokeWidth={1.2} /><rect x={-7} y={-23} width={14} height={5} rx={2} fill={INK} /><circle cx={0} cy={1} r={2} fill={INK} /></g>
}
function ShelfScene({ commas }: { commas: number }) {
  const xs = commas === 2 ? [48, 133, 218, 305] : commas === 1 ? [48, 127, 188, 274] : [48, 122, 167, 237]
  return (
    <g data-scene-state={`separations-${commas}`}>
      <rect x={24} y={116} width={312} height={8} rx={2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.2} />
      <path d="M38 124 V146 M322 124 V146" stroke={WOOD_EDGE} strokeWidth={6} />
      <Socks x={xs[0]} y={84} /><Sandwich x={xs[1]} y={86} /><Fruit x={xs[2]} y={85} /><Torch x={xs[3]} y={86} />
      {['socks', 'sandwiches', 'fruit', 'torch'].map((t, i) => <text key={t} x={xs[i]} y={145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT} stroke={PLATE} strokeWidth={3} paintOrder="stroke">{t}</text>)}
    </g>
  )
}

function Cloud({ x, y, rain = true }: { x: number; y: number; rain?: boolean }) {
  return <g transform={`translate(${x} ${y})`}><path d="M-32 12 Q-42-3-28-11 Q-24-29-7-25 Q6-39 20-23 Q39-22 38-5 Q49 10 30 13 Z" fill="#C6D3DD" stroke={BLUE_DARK} strokeWidth={1.4} />{rain && <g stroke={BLUE} strokeWidth={2.4} strokeLinecap="round"><path d="M-23 24 L-28 36 M-3 24 L-8 36 M17 24 L12 36 M32 23 L27 34" /></g>}</g>
}
function WeatherScene({ pause }: { pause: boolean }) {
  return <g data-scene-state={pause ? 'pause' : 'run-on'}><Cloud x={pause ? 67 : 118} y={54} /><circle cx={pause ? 278 : 235} cy={45} r={19} fill={YELLOW} stroke="#A17B27" strokeWidth={1.3} /><path d="M25 123 Q90 109 150 124 T330 120" fill="none" stroke={GREEN} strokeWidth={4} strokeLinecap="round" /><Person x={pause ? 226 : 255} y={91} scale={0.72} /><path d="M150 30 V126" stroke={EDGE} strokeWidth={1.4} strokeDasharray="3 5" /><text x={72} y={145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>after the storm</text><text x={254} y={145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>we went outside</text></g>
}

function ExtraScene({ enclosed }: { enclosed: boolean }) {
  return <g data-scene-state={enclosed ? 'enclosed' : 'loose'}><Person x={92} y={67} /><path d="M52 126 H308" stroke={WOOD_EDGE} strokeWidth={5} strokeLinecap="round" /><g transform={`translate(${enclosed ? 235 : 191} ${enclosed ? 66 : 91})`}><rect x={-38} y={-25} width={76} height={50} rx={6} fill="#F3E5C8" stroke={WOOD_EDGE} strokeWidth={1.5} /><path d="M-13-25 V-34 H13 V-25" fill="none" stroke={WOOD_EDGE} strokeWidth={4} /><rect x={-28} y={-13} width={56} height={24} rx={3} fill={PAPER} stroke={BLUE_DARK} strokeWidth={1.2} /><text x={0} y={4} textAnchor="middle" fontSize={13} fontWeight={800} fill={BLUE_DARK} fontFamily={FONT}>LEEDS</text></g>{enclosed && <g stroke={ACCENT} strokeWidth={2} fill="none" strokeLinecap="round"><path d="M183 30 Q172 65 183 101 M287 30 Q298 65 287 101" /></g>}<text x={92} y={146} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>my brother</text><text x={235} y={137} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>the extra detail</text></g>
}

function DogShape({ x, y, wag = false, flip = false }: { x: number; y: number; wag?: boolean; flip?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}><path d={wag ? 'M-24 4 Q-47-13-38-29' : 'M-24 5 Q-43 0-39 18'} fill="none" stroke={DOG_DARK} strokeWidth={7} strokeLinecap="round" /><ellipse cx={0} cy={5} rx={29} ry={19} fill={DOG} stroke={DOG_DARK} strokeWidth={1.4} /><path d="M-18 17 V34 M13 17 V34" stroke={DOG_DARK} strokeWidth={7} strokeLinecap="round" /><circle cx={25} cy={-8} r={17} fill={DOG} stroke={DOG_DARK} strokeWidth={1.4} /><path d="M17-20 Q4-22 8-3 Q14 6 20-3" fill={DOG_DARK} /><ellipse cx={38} cy={-3} rx={10} ry={7} fill="#D7A56C" /><circle cx={43} cy={-6} r={3} fill={INK} /><circle cx={29} cy={-12} r={2} fill={INK} /><path d="M20 5 Q27 12 34 5" fill="none" stroke={RED} strokeWidth={3} /></g>
}
function Bone({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y}) rotate(-12)`} fill={BONE} stroke={WOOD_EDGE} strokeWidth={1.2}><path d="M-20-5 Q-28-12-32-5 Q-34 1-28 3 Q-34 9-28 13 Q-21 16-17 8 H17 Q21 16 28 13 Q34 9 28 3 Q34-1 32-5 Q28-12 20-5 Z" /></g>
}
function DogsScene({ plural, linked }: { plural: boolean; linked: boolean }) {
  return <g data-scene-state={linked ? 'linked' : 'apart'}><DogShape x={plural ? 86 : 105} y={79} />{plural && <DogShape x={218} y={82} flip />}<Bone x={plural ? 151 : 220} y={linked ? 122 : 48} />{linked && <path d={plural ? 'M120 111 Q150 96 151 113 M185 112 Q170 97 157 113' : 'M151 105 Q190 91 212 115'} fill="none" stroke={ACCENT} strokeWidth={1.8} strokeDasharray="3 3" />}<path d="M30 137 H330" stroke={GREEN} strokeWidth={3} strokeLinecap="round" /><text x={plural ? 152 : 105} y={151} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>{plural ? 'two dogs' : 'one dog'}</text></g>
}
function RainScene({ contracted }: { contracted: boolean }) {
  return <g data-scene-state={contracted ? 'shortened' : 'two-words'}><Cloud x={180} y={57} rain /><path d="M31 124 Q112 112 180 125 T330 121" fill="none" stroke={GREEN} strokeWidth={4} strokeLinecap="round" /><g transform="translate(180 106)"><rect x={-54} y={-15} width={108} height={30} rx={5} fill={PAPER} stroke={EDGE} strokeWidth={1.3} /><text x={0} y={6} textAnchor="middle" fontSize={18} fontWeight={700} fill={INK} fontFamily={SERIF}>{contracted ? 'it’s raining' : 'it is raining'}</text></g></g>
}
function TailScene({ removed }: { removed: boolean }) {
  return <g data-scene-state={removed ? 'wagging' : 'still'}><DogShape x={174} y={79} wag={removed} /><path d="M31 136 H330" stroke={GREEN} strokeWidth={3} strokeLinecap="round" /><text x={174} y={151} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>the dog’s tail</text></g>
}

function SpeechScene({ slots }: { slots: (Mark | null)[] }) {
  const open = slots[1] === 'openQuote'
  const close = slots[3] === 'closeQuote'
  const q = slots[2] === 'question'
  const left = open ? 68 : 88
  const right = close ? 303 : 282
  return <g data-scene-state={`${open ? 'open' : 'no-open'}-${close ? 'close' : 'no-close'}`}><Person x={48} y={71} /><path d={`M${left + 10} 34 H${right - 10} Q${right} 34 ${right} 44 V91 Q${right} 101 ${right - 10} 101 H103 L82 117 L86 101 H${left + 10} Q${left} 101 ${left} 91 V44 Q${left} 34 ${left + 10} 34 Z`} fill={PAPER} stroke={BLUE_DARK} strokeWidth={1.7} strokeDasharray={open && close ? undefined : '5 4'} /><text x={(left + right) / 2 + 4} y={61} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK} fontFamily={SERIF}>Where is my book{q ? '?' : ''}</text><text x={190} y={83} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>Maya’s exact words</text><text x={48} y={145} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>Maya</text></g>
}

function EndPicture({ id, mark }: { id: string; mark: Mark | null }) {
  const mood = id === 'asking' ? 'puzzled' : id === 'warning' ? 'alarmed' : 'calm'
  return <g data-scene-state={mark ?? 'none'}><Person x={180} y={66} mood={mood} /><text x={180} y={135} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>{id === 'asking' ? 'Mia asks' : id === 'warning' ? 'Mia shouts' : 'Mia tells us calmly'}</text><text x={260} y={76} textAnchor="middle" fontSize={mark ? 37 : 12} fontWeight={800} fill={mark ? ACCENT_DARK : SOFT} fontFamily={mark ? SERIF : FONT}>{mark ? MARK_TEXT[mark] : 'end mark'}</text></g>
}
function BoundaryScene({ split }: { split: boolean }) {
  return (
    <g data-scene-state={split ? 'separate' : 'joined'}>
      <g transform={`translate(${split ? 83 : 128} 72)`}>
        <rect x={-66} y={-38} width={132} height={76} rx={8} fill={PAPER} stroke={EDGE} strokeWidth={1.4} />
        <Cloud x={0} y={-8} rain={false} />
        <text x={0} y={29} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>The rain stopped{split ? '.' : ','}</text>
      </g>
      <g transform={`translate(${split ? 270 : 232} 72)`}>
        <rect x={-66} y={-38} width={132} height={76} rx={8} fill={PAPER} stroke={EDGE} strokeWidth={1.4} />
        <circle cx={0} cy={-9} r={16} fill={YELLOW} stroke="#A17B27" strokeWidth={1.2} />
        <text x={0} y={29} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>{split ? 'W' : 'w'}e went outside.</text>
      </g>
      <path d="M25 137 H335" stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

function MeaningPicture({ kind, id, slots }: { kind: SceneKind; id: string; slots: (Mark | null)[] }) {
  if (kind === 'grandma') return <GrandmaScene invited={slots[0] === 'comma'} />
  if (kind === 'shelf') return <ShelfScene commas={slots.filter((m) => m === 'comma').length} />
  if (kind === 'weather') return <WeatherScene pause={slots[0] === 'comma'} />
  if (kind === 'extra') return <ExtraScene enclosed={slots.every((m) => m === 'comma')} />
  if (kind === 'dogs') return <DogsScene plural={id === 'two-dogs'} linked={slots[0] === 'apostrophe'} />
  if (kind === 'rain') return <RainScene contracted={slots[0] === 'apostrophe'} />
  if (kind === 'tail') return <TailScene removed={slots[0] === null} />
  if (kind === 'speech') return <SpeechScene slots={slots} />
  if (kind === 'boundary') return <BoundaryScene split={slots[0] === 'fullStop'} />
  return <EndPicture id={id} mark={slots[0]} />
}

function describe(id: string, goal: string, meaning: string, sentence: string): string {
  return `The sentence says: ${sentence}. ${goal} ${meaning}`
}

export function PunctuationView({ config, state, setState, marked, reduced, locked }: Props) {
  const p = passageOf(config)
  const now = marked === 'shown' ? { slots: [...p.target], held: null } : state
  const slots = slotsOf(config, now)
  const parts = displayParts(config, now)
  const held = now.held ?? null
  const finished = marked === 'right' || marked === 'shown'
  const disabled = locked || finished
  const [drag, setDrag] = useState<{ mark: Mark; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const meaning = meaningText(config, now)
  const sentence = sentenceText(config, now, true)

  const put = (slot: number, mark: Mark | null) => {
    if (disabled) return
    const next = [...slots]
    next[slot] = mark
    setState({ slots: next, held: null })
  }
  const choose = (mark: Mark) => {
    if (disabled) return
    setState({ slots, held: held === mark ? null : mark })
  }
  const pressSlot = (i: number) => {
    if (disabled) return
    if (held) put(i, held)
    else if (slots[i]) put(i, null)
  }

  const down = (mark: Mark) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    suppressClick.current = false
    setDrag({ mark, x: e.clientX, y: e.clientY, moved: false })
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4 })
  }
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    if (drag.moved) {
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]')
      let index = hit ? Number(hit.getAttribute('data-slot')) : -1
      if (!(index >= 0 && index < slots.length)) {
        // A dropped tile only has to land near a gap, not on a hairline apostrophe.
        const candidates = [...document.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => {
          const r = el.getBoundingClientRect()
          return { index: Number(el.dataset.slot), distance: Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) }
        }).sort((a, b) => a.distance - b.distance)
        if (candidates[0]?.distance <= 34) index = candidates[0].index
      }
      if (index >= 0 && index < slots.length) put(index, drag.mark)
      suppressClick.current = true
    }
    setDrag(null)
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="rounded-2xl border border-ss-line bg-ss-panel p-2">
          <div className="rounded-lg border border-ss-line px-3 py-2" style={{ backgroundColor: PAPER }}>
            <p className={`m-0 text-center font-serif leading-[1.75] ${reduced ? '' : 'transition-all duration-500'}`} style={{ color: INK, fontSize: p.id === 'speech' ? 18 : p.id === 'boundary' ? 20 : 22 }} aria-label={`Sentence: ${sentence}`}>
              {parts.map((part, i) => {
                const mark = i < slots.length ? slots[i] : undefined
                if (mark === undefined) return <span key={i} className={p.scene === 'boundary' && i === 1 && slots[0] === 'fullStop' ? 'block' : undefined}>{part}</span>
                const boundaryBreak = p.scene === 'boundary' && i === 1 && slots[0] === 'fullStop'
                return <span key={i} className={`${boundaryBreak ? 'block' : ''} ${p.id === 'speech' && i >= 2 ? 'whitespace-nowrap' : ''}`}>{i > 0 && boundaryBreak ? '' : part}<button
                  type="button" data-slot={i} aria-label={`Gap ${i + 1}${mark ? `, ${MARK_NAME[mark]}` : ', empty'}${held ? `; place ${MARK_NAME[held]}` : ''}`}
                  disabled={disabled} onClick={() => pressSlot(i)}
                  className={`nodrag mx-0 inline-flex h-8 touch-manipulation select-none items-center justify-center rounded-sm px-0 align-[-5px] font-serif text-[25px] font-bold leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--subject)] disabled:cursor-default ${mark ? '' : 'border-b-2 border-dashed border-ss-slate bg-ss-chip text-ss-slate'} ${held && !disabled ? 'ring-1 ring-[color:var(--subject)]' : ''}`}
                  style={{ color: mark ? ACCENT_DARK : undefined, width: 24 }}
                >{mark ? MARK_TEXT[mark] : ' '}</button></span>
              })}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(p.id, p.goal, meaning, sentence)} className="mt-1.5 block h-auto w-full select-none [&_text]:fill-current" style={{ color: INK }} data-scene={p.scene}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={10} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
            <g className={reduced ? undefined : 'transition-all duration-700'}>
              <MeaningPicture kind={p.scene} id={p.id} slots={slots} />
            </g>
          </svg>
        </div>
        <figcaption className="px-1 text-center text-[12px] font-bold leading-snug text-ss-slate">
          <span>{p.goal}</span><br /><span className="font-semibold">{meaning}</span>
        </figcaption>
      </figure>

      <div className="flex items-end justify-center gap-2 border-t border-ss-line pt-2" aria-label="Punctuation marks">
        {p.marks.map((mark) => (
          <div key={mark} className="flex min-w-0 flex-col items-center gap-0.5">
            <button
              type="button" data-mark={mark} aria-label={`${MARK_NAME[mark]} tile${held === mark ? ', selected' : ''}`} aria-pressed={held === mark}
              disabled={disabled} onPointerDown={down(mark)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } choose(mark) }} className={tileClass}
              style={{ borderColor: EDGE, color: INK, backgroundColor: PAPER }}
            >{MARK_TEXT[mark]}</button>
            <span className="max-w-[72px] text-center text-[12px] font-semibold leading-[1.1] text-ss-slate">{mark === 'openQuote' ? 'open speech' : mark === 'closeQuote' ? 'close speech' : MARK_NAME[mark]}</span>
          </div>
        ))}
      </div>
      {marked === 'idle' && <p className="m-0 text-center text-[12px] font-semibold text-ss-slate">Drag a mark into a gap, or tap a mark then a gap.<br />Tap a placed mark to remove it.</p>}
      <span className="sr-only" aria-live="polite">{meaning}</span>

      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="m-0 text-[13px] font-extrabold leading-snug text-ss-ink">{marked === 'wrong' ? madeText(config, now) : p.right}</p>

        </div>
      )}
      {drag && drag.moved && <div aria-hidden="true" className="pointer-events-none fixed z-50 flex h-11 w-11 items-center justify-center rounded-lg border-2 bg-white font-serif text-[30px] font-bold" style={{ left: drag.x - 22, top: drag.y - 22, borderColor: ACCENT, color: INK }}>{MARK_TEXT[drag.mark]}</div>}
    </div>
  )
}
