'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { StoryConfig, StoryState } from './config'
import { STAGE_NAMES, levelsOf, madeArc, storyOf } from './config'

type Props = SceneViewProps<StoryConfig, StoryState>

// A page in a young writer's planning book, on the same quiet plate as measure-shape.
// The plate keeps these colours in both themes. No gradients, shadows or decoration.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#243447'
const SOFT = '#52657A'
const TRACK = '#DCE4EC'
const PAPER = '#FFFDF7'
const PAPER_EDGE = '#AAB8C6'
const BLUE = '#347DB5'
const BLUE_EDGE = '#225A86'
const GRIP = '#E4EAF0'
const SKY = '#DCECF3'
const SKIN = '#D99A6C'
const HAIR = '#5B4035'
const SHIRT = '#D8784D'
const GREEN = '#6E9672'
const GREEN_DARK = '#446C4B'
const YELLOW = '#E6B950'
const RED = '#C96757'
const SEA = '#73A9C4'
const SAND = '#E7D6AE'
const GREY = '#8999A9'
const DARK = '#3E4B59'
const WHITE = '#FFFFFF'

// Literals, not config constants: config and View import each other (rule 41).
export const W = 360
export const H = 342
export const CARD_W = 62
export const CARD_H = 68
export const CENTRES = [52, 116, 180, 244, 308]
export const TRACK_TOP = 64
export const TRACK_BOTTOM = 272
export const ROW_STEP = 46
export const levelY = (level: number) => TRACK_BOTTOM - (level - 1) * ROW_STEP
const f = (n: number) => n.toFixed(1)

/** Every card stays on the plate and every track stays behind its own card. */
export const cardBox = (i: number, level: number) => ({ left: CENTRES[i] - CARD_W / 2, right: CENTRES[i] + CARD_W / 2, top: levelY(level) - CARD_H / 2, bottom: levelY(level) + CARD_H / 2 })
export const arcPath = (levels: number[]) => levels.map((v, i) => `${i ? 'L' : 'M'}${CENTRES[i]} ${f(levelY(v))}`).join(' ')

/** Short, readable lines; a space, never a broken word. */
function wordsOf(text: string): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > 12 && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// ---------------------------------------------------------------------------
// Tiny story pictures. Each is a real little scene, not a number or a stage icon.

function Person({ x, y, pull = false }: { x: number; y: number; pull?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={-9} r={3.4} fill={SKIN} stroke={INK} strokeWidth={0.65} />
      <path d="M -3 -11 Q 0 -15 3 -11" fill={HAIR} />
      <path d="M -3 -5 L -3 3 L 3 3 L 3 -5 Z" fill={SHIRT} stroke={INK} strokeWidth={0.65} />
      <path d={pull ? 'M -2 -3 L 5 -7 M 2 -3 L 7 -6' : 'M -2 -3 L -5 2 M 2 -3 L 5 2'} fill="none" stroke={SKIN} strokeWidth={1.5} />
      <path d="M -2 3 L -3 9 M 2 3 L 4 9" fill="none" stroke={DARK} strokeWidth={1.8} />
    </g>
  )
}
function Ground() {
  return <><rect x={5} y={24} width={48} height={6} rx={2} fill={SAND} /><path d="M 6 24 H 52" stroke={GREEN} strokeWidth={1.4} /></>
}
function Kite({ x = 36, y = 9, loose = false }: { x?: number; y?: number; loose?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${loose ? 24 : -10})`} strokeLinejoin="round">
      <path d="M 0 -7 L 6 0 L 0 8 L -6 0 Z" fill={YELLOW} stroke={BLUE_EDGE} strokeWidth={0.9} />
      <path d="M 0 -7 V 8 M -6 0 H 6" stroke={BLUE_EDGE} strokeWidth={0.65} />
      <path d="M 0 8 Q 5 11 0 14 Q -4 17 1 20" fill="none" stroke={RED} strokeWidth={0.8} />
    </g>
  )
}
function Boat({ x = 36, y = 21 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}><path d="M -10 0 H 10 L 6 5 H -6 Z" fill={RED} stroke={INK} strokeWidth={0.7} /><path d="M 0 0 V -14 L 8 -2 H 0 Z" fill={WHITE} stroke={INK} strokeWidth={0.7} /><path d="M -2 -12 L -9 -2 H -2 Z" fill={SKY} stroke={INK} strokeWidth={0.7} /></g>
}
function Robot({ x = 34, y = 13, stopped = false }: { x?: number; y?: number; stopped?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth={0.7}>
      <path d="M 0 -12 V -16" /><circle cy={-17} r={1.5} fill={stopped ? GREEN : RED} />
      <rect x={-7} y={-12} width={14} height={10} rx={2} fill={GREY} />
      <circle cx={-3} cy={-8} r={1.2} fill={WHITE} /><circle cx={3} cy={-8} r={1.2} fill={WHITE} />
      <rect x={-8} y={0} width={16} height={11} rx={2} fill={SKY} />
      <circle cx={0} cy={4} r={2.2} fill={stopped ? GREEN : RED} />
      <path d="M -8 3 H -11 M 8 3 H 11" /><circle cx={-5} cy={13} r={2.5} fill={DARK} /><circle cx={5} cy={13} r={2.5} fill={DARK} />
    </g>
  )
}
function Flower({ x = 12, y = 18 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}><path d="M 0 2 V 13 M 0 8 Q -7 4 -6 10 Q -3 12 0 8" fill={GREEN} stroke={GREEN_DARK} strokeWidth={0.8} /><circle cy={-2} r={5} fill={YELLOW} stroke={INK} strokeWidth={0.7} /><circle cy={-2} r={2} fill={HAIR} /></g>
}
function Turtle({ x = 31, y = 22 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`} stroke={GREEN_DARK} strokeWidth={0.7}><ellipse rx={9} ry={5.5} fill={GREEN} /><path d="M -6 -3 L 6 3 M -6 3 L 6 -3 M 0 -5 V 5" fill="none" /><circle cx={11} cy={-1} r={3} fill={GREEN} /><path d="M -6 4 L -8 7 M 5 4 L 7 7 M -7 -4 L -9 -6" /></g>
}
function Violin({ x = 34, y = 12 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(-24)`} stroke={INK} strokeWidth={0.7}><path d="M 0 4 V -15" strokeWidth={2} /><path d="M 0 -2 C -8 -8 -10 1 -4 3 C -11 5 -7 14 0 10 C 7 14 11 5 4 3 C 10 1 8 -8 0 -2 Z" fill={SHIRT} /><path d="M 0 -14 V 9 M -2 -14 H 2" fill="none" stroke={YELLOW} strokeWidth={0.6} /></g>
}

function StoryArt({ art }: { art: string }) {
  let body: ReactNode
  switch (art) {
    case 'kite': body = <><Ground /><Person x={14} y={15} /><Kite /><path d="M 17 12 Q 29 16 36 16" fill="none" stroke={SOFT} strokeWidth={0.65} /></>; break
    case 'wind': body = <><Ground /><Person x={10} y={15} pull /><Kite x={39} y={8} loose /><path d="M 17 7 H 28 M 20 12 H 33 M 14 17 H 24" stroke={SEA} strokeWidth={1} strokeLinecap="round" /></>; break
    case 'pull': body = <><Ground /><Person x={16} y={15} pull /><Kite x={39} y={7} /><path d="M 22 9 L 35 9" stroke={SOFT} strokeWidth={0.8} /></>; break
    case 'catch': body = <><Ground /><Person x={22} y={15} pull /><Kite x={36} y={15} /><path d="M 7 10 Q 12 5 18 8" fill="none" stroke={SEA} strokeWidth={1} /></>; break
    case 'home': body = <><Ground /><path d="M 34 17 L 43 10 L 52 17 V 27 H 34 Z" fill={PAPER} stroke={INK} strokeWidth={0.8} /><path d="M 32 17 L 43 8 L 54 17" fill="none" stroke={RED} strokeWidth={2.4} /><Person x={16} y={16} /><Kite x={7} y={9} /></>; break
    case 'lamp': body = <><path d="M 35 8 H 48 L 46 26 H 37 Z" fill={PAPER} stroke={INK} strokeWidth={0.8} /><path d="M 33 8 H 50 L 46 3 H 37 Z" fill={RED} stroke={INK} strokeWidth={0.8} /><rect x={38} y={10} width={7} height={6} fill={YELLOW} /><Person x={17} y={16} /></>; break
    case 'boat': body = <><rect x={5} y={24} width={48} height={6} fill={SEA} /><Boat /><path d="M 7 7 H 23 M 11 11 H 20" stroke={GREY} strokeWidth={2} strokeLinecap="round" /></>; break
    case 'crank': body = <><path d="M 36 8 H 48 L 46 27 H 38 Z" fill={PAPER} stroke={INK} strokeWidth={0.8} /><circle cx={42} cy={13} r={5} fill={YELLOW} stroke={INK} strokeWidth={0.8} /><path d="M 42 13 H 49 V 18" fill="none" stroke={DARK} strokeWidth={1.5} /><Person x={18} y={16} pull /></>; break
    case 'beam': body = <><rect x={5} y={25} width={48} height={5} fill={SEA} /><path d="M 8 6 L 29 12 L 8 18 Z" fill={YELLOW} opacity={0.65} /><path d="M 5 5 H 12 L 11 26 H 6 Z" fill={PAPER} stroke={INK} strokeWidth={0.8} /><Boat x={42} y={22} /></>; break
    case 'calm': body = <><rect x={5} y={25} width={48} height={5} fill={SEA} /><Boat x={39} y={20} /><path d="M 8 7 Q 15 2 22 7" fill="none" stroke={GREY} strokeWidth={1.2} /><path d="M 13 12 Q 18 9 24 12" fill="none" stroke={GREY} strokeWidth={1} /></>; break
    case 'robot': body = <><Ground /><Flower /><Robot /><Person x={48} y={16} /></>; break
    case 'sunflower': body = <><Ground /><Flower x={9} /><Robot x={34} /><path d="M 20 18 H 25" stroke={RED} strokeWidth={1.4} /></>; break
    case 'stop': body = <><Ground /><Flower x={8} /><Robot x={35} /><Person x={52} y={16} pull /><circle cx={35} cy={17} r={4} fill="none" stroke={RED} strokeWidth={1.2} /></>; break
    case 'safe': body = <><Ground /><Flower x={10} /><Robot x={36} stopped /><path d="M 19 8 L 23 12 L 30 3" fill="none" stroke={GREEN_DARK} strokeWidth={1.7} /></>; break
    case 'garden': body = <><Ground /><Flower x={8} /><Flower x={20} /><Robot x={40} stopped /><path d="M 29 12 Q 24 14 22 18 M 35 12 Q 30 15 29 19" fill="none" stroke={SEA} strokeWidth={1} /></>; break
    case 'egg': body = <><Ground /><ellipse cx={32} cy={21} rx={9} ry={5} fill={SAND} stroke={INK} strokeWidth={0.7} /><path d="M 25 19 L 29 15 L 32 19 L 36 14 L 40 19" fill={WHITE} stroke={INK} strokeWidth={0.7} /><Turtle x={17} y={23} /></>; break
    case 'ring': body = <><Ground /><Turtle x={39} /><ellipse cx={20} cy={19} rx={8} ry={5} fill="none" stroke={GREY} strokeWidth={3} /><path d="M 6 27 H 52" stroke={SEA} strokeWidth={2} /></>; break
    case 'lift': body = <><Ground /><Person x={18} y={15} pull /><ellipse cx={34} cy={8} rx={7} ry={4} fill="none" stroke={GREY} strokeWidth={2.5} /><Turtle x={40} y={24} /></>; break
    case 'waves': body = <><rect x={5} y={20} width={48} height={10} fill={SEA} /><path d="M 5 21 Q 12 17 19 21 T 33 21 T 47 21" fill="none" stroke={WHITE} strokeWidth={1.4} /><Turtle x={29} y={21} /></>; break
    case 'beach': body = <><Ground /><path d="M 38 25 Q 44 21 53 24 V 30 H 38 Z" fill={SEA} /><path d="M 8 8 Q 12 4 16 8 Q 20 4 24 8" fill="none" stroke={GREY} strokeWidth={1} /></>; break
    case 'violin': body = <><Ground /><Person x={14} y={16} /><Violin /><path d="M 42 4 V 25 M 38 25 H 46" stroke={DARK} strokeWidth={1.2} /><rect x={36} y={3} width={12} height={9} fill={WHITE} stroke={INK} strokeWidth={0.7} /></>; break
    case 'music': body = <><Ground /><Violin x={15} y={12} /><path d="M 32 7 L 47 5 L 49 18 L 34 20 Z" fill={WHITE} stroke={INK} strokeWidth={0.7} /><path d="M 35 10 L 45 8 M 36 13 L 46 11 M 36 16 L 43 15" stroke={SOFT} strokeWidth={0.7} /><path d="M 27 4 H 32 M 26 9 H 30" stroke={SEA} strokeWidth={1} /></>; break
    case 'play': body = <><Ground /><Person x={16} y={16} /><Violin x={34} y={12} /><circle cx={45} cy={5} r={1.7} fill={BLUE_EDGE} /><path d="M 46 5 V 12 M 46 5 L 50 4" stroke={BLUE_EDGE} strokeWidth={1} /></>; break
    case 'clap': body = <><Ground /><Person x={14} y={16} /><Violin x={30} y={11} /><path d="M 39 12 Q 35 7 39 4 M 45 13 Q 50 7 45 3 M 41 17 Q 47 18 49 14" fill="none" stroke={SKIN} strokeWidth={2} strokeLinecap="round" /></>; break
    default: body = <><Ground /><Person x={16} y={16} /><Violin x={34} y={12} /><path d="M 39 4 L 49 6 L 47 15 L 37 13 Z" fill={WHITE} stroke={INK} strokeWidth={0.7} /><path d="M 7 5 Q 12 1 17 5" fill="none" stroke={GREEN} strokeWidth={1.2} /></>
  }
  return <g transform="translate(0 -1)" strokeLinecap="round" strokeLinejoin="round">{body}</g>
}

// ---------------------------------------------------------------------------

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ stage, level, locked, set }: { stage: string; level: number; locked: boolean; set(next: number): void }) {
  return (
    <div className="flex w-full items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{stage} tension</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Less tension in the ${stage.toLowerCase()}`} disabled={locked || level <= 1} onClick={() => set(level - 1)} className={STEP}>−</button>
        <span className="min-w-[28px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{level}</span>
        <button type="button" aria-label={`More tension in the ${stage.toLowerCase()}`} disabled={locked || level >= 5} onClick={() => set(level + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

function StoryCard({ i, level, text, art, live, reduced, selected, onStart, onMove, onEnd, onKey, onSelect }: {
  i: number; level: number; text: string; art: string; live: boolean; reduced: boolean; selected: boolean
  onSelect(): void
  onStart(e: PointerEvent<SVGGElement>): void; onMove(e: PointerEvent<SVGGElement>): void; onEnd(): void; onKey(e: KeyboardEvent<SVGGElement>): void
}) {
  const y = levelY(level)
  const lines = wordsOf(text)
  const clip = useId().replace(/:/g, '')
  return (
    <g
      data-story-card={i} transform={`translate(${CENTRES[i]} ${f(y)})`}
      role={live ? 'slider' : undefined} tabIndex={live ? 0 : -1}
      aria-label={live ? `${STAGE_NAMES[i]}: ${text} Drag up or down, or use the arrow keys` : undefined}
      aria-orientation={live ? 'vertical' : undefined} aria-valuemin={live ? 1 : undefined} aria-valuemax={live ? 5 : undefined}
      aria-valuenow={live ? level : undefined} aria-valuetext={live ? `${level} out of 5 tension` : undefined}
      aria-disabled={live ? undefined : true}
      onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} onKeyDown={onKey} onFocus={onSelect}
      className={live ? 'nodrag cursor-grab touch-none outline-none focus-visible:outline-none active:cursor-grabbing' : ''}
      style={reduced ? undefined : { transition: 'transform 650ms cubic-bezier(.2,.75,.25,1)' }}
    >
      <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={6} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.25} />
      {/* A clipped picture and a folded paper corner make each event a real little story card. */}
      <rect x={-25} y={-30} width={50} height={31} rx={3} fill={SKY} stroke="#C2D5DF" strokeWidth={0.7} />
      <defs><clipPath id={clip}><rect x={-24.5} y={0} width={49} height={30} rx={2.5} /></clipPath></defs>
      <g transform="translate(0 -29)" clipPath={`url(#${clip})`}><g transform="translate(-29 0)"><StoryArt art={art} /></g></g>
      <path d={`M ${CARD_W / 2 - 7} ${-CARD_H / 2} L ${CARD_W / 2} ${-CARD_H / 2 + 7} H ${CARD_W / 2 - 7} Z`} fill="#E9E3D4" />
      {lines.map((line, k) => (
        <text key={k} x={0} y={lines.length === 1 ? 12 : 5 + k * 16} textAnchor="middle" fontSize={12} fontWeight={650} fill={INK} fontFamily="system-ui, sans-serif">{line}</text>
      ))}
      {live && (
        <g aria-hidden="true" transform={`translate(0 ${CARD_H / 2 - 4})`}>
          <rect x={-15} y={-3} width={30} height={6} rx={3} fill={GRIP} />
          <path d="M -8 -1 H 8 M -8 1 H 8" stroke={SOFT} strokeWidth={0.8} />
        </g>
      )}
      <rect x={-CARD_W / 2 - 2} y={-CARD_H / 2 - 2} width={CARD_W + 4} height={CARD_H + 4} rx={8} fill="none" stroke="var(--subject)" strokeWidth={1.7} className={selected ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100'} pointerEvents="none" />
      {/* A generous finger target, including the grip below the paper. */}
      <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H + 7} fill="transparent" />
    </g>
  )
}

export function StoryStructureView({ config, state, setState, marked, reduced, locked }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ i: number; startY: number; startLevel: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState<number | null>(null)
  const [selected, setSelected] = useState(0)
  const id = useId()
  const shown = marked === 'shown' ? { levels: [1, 3, 5, 3, 1] } : state
  const levels = levelsOf(shown)
  const story = storyOf(config)
  const live = !locked && marked !== 'shown'
  const said = marked === 'idle' ? null : madeArc(config, shown)

  // SVG path `d` is not CSS-animatable. Ease its points for about a second so the eye
  // sees the mountain being pulled into shape; reduced motion gets the same still frame.
  const lastArc = useRef(arcPath(levels))
  useEffect(() => {
    const from = CENTRES.map((_, i) => Number(lastArc.current.split(' ')[i * 2 + 1]))
    const to = levels.map(levelY)
    if (from.every((v, i) => Math.abs(v - to[i]) < 0.1)) return
    if (reduced) {
      svg.current?.querySelectorAll('[data-arc], [data-arc-edge]').forEach((el) => el.setAttribute('d', arcPath(levels)))
      lastArc.current = arcPath(levels)
      return
    }
    let raf = 0
    const started = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 650)
      const k = 1 - (1 - t) ** 3
      const path = to.map((v, i) => `${i ? 'L' : 'M'}${CENTRES[i]} ${f(from[i] + (v - from[i]) * k)}`).join(' ')
      svg.current?.querySelectorAll('[data-arc], [data-arc-edge]').forEach((el) => el.setAttribute('d', path))
      lastArc.current = path
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [levels, reduced])

  const setLevel = (i: number, next: number) => {
    if (!live) return
    const to = Math.max(1, Math.min(5, Math.round(next)))
    if (to === levels[i]) return
    setState({ levels: levels.map((v, k) => (k === i ? to : v)) })
  }
  const fromPointer = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current
    const el = svg.current
    if (!d || !el || !live) return
    const box = el.getBoundingClientRect()
    const py = ((e.clientY - box.top) / box.height) * H
    const next = d.startLevel + Math.round((d.startY - py) / ROW_STEP)
    if (next !== d.startLevel) d.moved = true
    setLevel(d.i, next)
  }
  const start = (i: number) => (e: PointerEvent<SVGGElement>) => {
    if (!live || e.button !== 0) return
    const box = svg.current!.getBoundingClientRect()
    const py = ((e.clientY - box.top) / box.height) * H
    drag.current = { i, startY: py, startLevel: levels[i], moved: false }
    setSelected(i)
    setHeld(i)
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const end = () => { drag.current = null; setHeld(null) }
  const onKey = (i: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (!live) return
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    setLevel(i, e.key === 'Home' ? 1 : e.key === 'End' ? 5 : levels[i] + by)
  }
  const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
  const description = `${story.title}. Five story event cards in reading order: ${story.beats.map((b, i) => `${STAGE_NAMES[i]}, ${b.text}, tension ${levels[i]} out of 5`).join('; ')}. A blue line joins the cards.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" style={{ color: INK }} onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={description} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <text x={17} y={23} fontSize={13} fontWeight={750} fill={INK} fontFamily="system-ui, sans-serif">Reader’s tension</text>
          <text x={343} y={23} textAnchor="end" fontSize={12} fontWeight={700} fill={BLUE_EDGE} fontFamily="system-ui, sans-serif">low to high</text>
          {/* One track per event: the card slides, and its height is the answer back. */}
          {CENTRES.map((x, i) => (
            <g key={x}>
              <line x1={x} x2={x} y1={TRACK_TOP} y2={TRACK_BOTTOM} stroke={TRACK} strokeWidth={3} strokeLinecap="round" />
              {[1, 2, 3, 4, 5].map((v) => <circle key={v} cx={x} cy={levelY(v)} r={2.1} fill={PLATE_EDGE} />)}
            </g>
          ))}
          <path data-arc-edge d={arcPath(levels)} fill="none" stroke={BLUE_EDGE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <path data-arc d={arcPath(levels)} fill="none" stroke={BLUE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          {story.beats.map((beat, i) => (
            <StoryCard
              key={`${config.story}-${i}`} i={i} level={levels[i]} text={beat.text} art={beat.art} live={live} reduced={reduced || held === i} selected={selected === i}
              onStart={start(i)} onMove={fromPointer} onEnd={end} onKey={onKey(i)} onSelect={() => setSelected(i)}
            />
          ))}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Drag an event, or tap it and use + / −. The line bends with it.
        </figcaption>
      </figure>
      <Stepper stage={STAGE_NAMES[selected]} level={levels[selected]} locked={!live} set={(n) => setLevel(selected, n)} />
      <p id={id} className="sr-only" aria-live="polite">{held === null ? '' : `${STAGE_NAMES[held]} tension ${levels[held]} out of 5.`}</p>
      {said && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said.lead}</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{said.detail}</p>
        </div>
      )}
    </div>
  )
}
