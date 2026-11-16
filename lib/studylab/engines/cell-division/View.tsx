'use client'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Allocation, ChromosomeId, DivisionConfig, DivisionState, Side } from './config'
import { cellDivisionEngine, CHROMOSOMES, complete, madeText, PAIRS, setSide, sidesOf, working } from './config'

type Props = SceneViewProps<DivisionConfig, DivisionState>
type Pt = { x: number; y: number }

// A quiet microscope plate, not a dark stage. The cell and chromosomes keep their material colours in both themes.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const CELL = '#E8F2EE'
const CELL_EDGE = '#64867C'
const CELL_INNER = '#F4F8F3'
const INK = '#334155'
const SOFT = '#64748B'
const FIBRE = '#9AAFA8'
const POLE = '#718A81'
const BLUE = '#4E83B4'
const BLUE_DARK = '#315F89'
const BLUE_LIGHT = '#91B8D5'
const OCHRE = '#C18A45'
const OCHRE_DARK = '#8B5E2B'
const OCHRE_LIGHT = '#E3BB7F'
const WHITE = '#FFFFFF'
const FONT = 'system-ui, sans-serif'
const LABEL_STYLE = { fill: SOFT, color: SOFT } as const

export const W = 360
export const H = 258
const ROW_Y = [88, 162]
const HOME: Record<ChromosomeId, Pt> = {
  'long-blue': { x: 140, y: 88 }, 'short-blue': { x: 220, y: 88 },
  'long-ochre': { x: 140, y: 162 }, 'short-ochre': { x: 220, y: 162 },
}
const SIDE_X = { left: 78, right: 282 }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const f1 = (n: number) => n.toFixed(1)
const isLong = (id: ChromosomeId) => id.startsWith('long')
const isBlue = (id: ChromosomeId) => id.endsWith('blue')

/** The parent cell, or the two membranes after its waist has pinched. */
function cellPath(divided: boolean, waist = 0): string {
  if (!divided) return 'M 180 27 C 102 27 31 56 27 129 C 31 202 102 231 180 231 C 258 231 329 202 333 129 C 329 56 258 27 180 27 Z'
  const w = waist
  return `M ${176 - w * 0.35} 32 C 101 29 38 60 34 129 C 38 198 101 229 ${176 - w * 0.35} 226 C ${184 - w * 0.2} 196 ${184 - w * 0.2} 62 ${176 - w * 0.35} 32 Z`
}
function rightCellPath(): string {
  return 'M 184 32 C 259 29 322 60 326 129 C 322 198 259 229 184 226 C 176 196 176 62 184 32 Z'
}

/** One copied chromosome: two substantial chromatids joined at a visible centromere. */
function ChromosomeShape({ id, reduced = false, small = false }: { id: ChromosomeId; reduced?: boolean; small?: boolean }) {
  const blue = isBlue(id)
  const main = blue ? BLUE : OCHRE
  const dark = blue ? BLUE_DARK : OCHRE_DARK
  const light = blue ? BLUE_LIGHT : OCHRE_LIGHT
  const len = isLong(id) ? 25 : 19
  const width = small ? 4.4 : 7
  const spread = small ? 7 : 11
  const d1 = `M ${-spread} ${-len} C ${-spread + 1} ${-len * 0.55} -2 ${-len * 0.2} 0 0 C 2 ${len * 0.2} ${spread} ${len * 0.55} ${spread} ${len}`
  const d2 = `M ${spread} ${-len} C ${spread - 1} ${-len * 0.55} 2 ${-len * 0.2} 0 0 C -2 ${len * 0.2} ${-spread} ${len * 0.55} ${-spread} ${len}`
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d1} stroke={dark} strokeWidth={width + 1.8} />
      <path d={d2} stroke={dark} strokeWidth={width + 1.8} />
      <path d={d1} stroke={main} strokeWidth={width} />
      <path d={d2} stroke={main} strokeWidth={width} />
      <path d={`M ${-spread + 0.5} ${-len + 2} C ${-spread + 1.5} ${-len * 0.55} -2 ${-len * 0.2} 0 0`} stroke={light} strokeWidth={small ? 1.1 : 1.7} opacity={0.8} />
      <circle r={small ? 3.1 : 4.5} fill={dark} stroke={light} strokeWidth={small ? 0.8 : 1.2} />
      <circle r={small ? 1.1 : 1.6} fill={light} stroke="none" />
    </g>
  )
}

/** A gamete's single chromatid, with a tiny exchanged tip in the other parental colour. */
function GameteChromosome({ id, swap = false, vertical = false }: { id: ChromosomeId; swap?: boolean; vertical?: boolean }) {
  const main = isBlue(id) ? BLUE : OCHRE
  const dark = isBlue(id) ? BLUE_DARK : OCHRE_DARK
  const tip = isBlue(id) ? OCHRE : BLUE
  const len = isLong(id) ? 16 : 12
  return (
    <g transform={vertical ? 'rotate(90)' : undefined} aria-hidden="true">
      <line x1={0} y1={-len} x2={0} y2={len} stroke={dark} strokeWidth={5.4} strokeLinecap="round" />
      <line x1={0} y1={-len} x2={0} y2={len} stroke={main} strokeWidth={3.8} strokeLinecap="round" />
      {swap && <line x1={0} y1={-len} x2={0} y2={-len + 5} stroke={tip} strokeWidth={3.8} strokeLinecap="round" />}
      <circle r={2.4} fill={dark} />
    </g>
  )
}

function Pole({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={POLE} strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
      <line x1={-7} y1={0} x2={7} y2={0} /><line x1={0} y1={-7} x2={0} y2={7} />
      <line x1={-5} y1={-5} x2={5} y2={5} /><line x1={5} y1={-5} x2={-5} y2={5} />
      <circle r={2.5} fill={POLE} stroke="none" />
    </g>
  )
}

function Handle({ mitosis }: { mitosis: boolean }) {
  return (
    <g aria-hidden="true">
      <rect className="cd-focus" x={mitosis ? -12 : -19} y={mitosis ? -19 : -11} width={mitosis ? 24 : 38} height={mitosis ? 38 : 22} rx={11} fill="none" stroke={INK} strokeWidth={2} visibility="hidden" />
      <rect x={mitosis ? -9 : -17} y={mitosis ? -17 : -9} width={mitosis ? 18 : 34} height={mitosis ? 34 : 18} rx={9} fill={WHITE} stroke={SOFT} strokeWidth={1.3} />
      <path d={mitosis ? 'M 0 -11 V 11 M -4 -7 L 0 -12 L 4 -7 M -4 7 L 0 12 L 4 7' : 'M -11 0 H 11 M -7 -4 L -12 0 L -7 4 M 7 -4 L 12 0 L 7 4'} fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** Chromosome positions before division. X copies at one pole separate sideways just enough to be read as two chromatids. */
function positionOf(id: ChromosomeId, allocation: Allocation, drag: { id: ChromosomeId; p: Pt } | null): Pt {
  if (drag?.id === id) return drag.p
  const side = allocation[id]
  // Two blue above two ochre: visibly neither division's answer, with every handle separate.
  if (side === 'none') return HOME[id]
  if (side === 'equator') return { x: [105, 150, 210, 255][CHROMOSOMES.indexOf(id)], y: 129 }
  const second = id.endsWith('ochre')
  return { x: SIDE_X[side] + (second ? 20 : -20), y: ROW_Y[isLong(id) ? 0 : 1] }
}

function cellDescription(task: DivisionConfig['task'], allocation: Allocation, divided: boolean): string {
  if (divided) return task === 'mitosis' ? 'Two daughter cells contain the chromosome sets allocated by the learner.' : 'Four gametes contain single chromatids, some with small exchanged colour tips.'
  const at = CHROMOSOMES.map((id) => `${id.replace('-', ' ')} ${allocation[id] === 'none' ? 'away from a pole' : allocation[id] === 'equator' ? 'on the equator' : `at the ${allocation[id]} pole`}`).join('; ')
  return `A model cell with two copied homologous chromosome pairs and spindle poles. ${at}. ${task === 'mitosis' ? 'Drag the white handles onto the equator.' : 'Drag the white handles left or right.'}`
}

function keySide(e: KeyboardEvent, task: DivisionConfig['task'], id: ChromosomeId, side: Side, set: (id: ChromosomeId, side: Side) => void) {
  const next = task === 'mitosis'
    ? e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ' ? 'equator' : e.key === 'Home' ? 'none' : null
    : e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowDown' || e.key === 'Home' ? 'none' : null
  if (!next) return
  e.preventDefault()
  e.stopPropagation()
  set(id, next)
}

function ParentScene({ config, allocation, divided, set, drag, begin, move, end, locked, reduced }: {
  config: DivisionConfig; allocation: Allocation; divided: boolean; set(id: ChromosomeId, side: Side): void
  drag: { id: ChromosomeId; p: Pt } | null; begin(e: PointerEvent, id: ChromosomeId): void; move(e: PointerEvent): void; end(): void
  locked: boolean; reduced: boolean
}) {
  const ease: CSSProperties = reduced ? {} : { transition: 'transform 650ms cubic-bezier(.2,.75,.25,1)' }
  return (
    <g>
      <path d={cellPath(divided)} fill={CELL} stroke={CELL_EDGE} strokeWidth={3} />
      {divided && <path d={rightCellPath()} fill={CELL} stroke={CELL_EDGE} strokeWidth={3} />}
      <path d={cellPath(false)} fill="none" stroke={CELL_INNER} strokeWidth={1.3} transform="translate(0 2) scale(.985 .97) translate(2.7 4)" opacity={0.9} />
      {!divided && <><Pole x={43} y={129} /><Pole x={317} y={129} /></>}
      {config.task === 'mitosis' && !divided && <>
        <line x1={180} y1={52} x2={180} y2={207} stroke={FIBRE} strokeWidth={1.4} strokeDasharray="4 5" />
        <text style={LABEL_STYLE} x={180} y={54} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700}>equator</text>
      </>}
      {CHROMOSOMES.map((id) => {
        const p = positionOf(id, allocation, drag)
        const side = allocation[id]
        if (side === 'equator') return <g key={`f${id}`} stroke={FIBRE} strokeWidth={1.2}><line x1={43} y1={129} x2={f1(p.x)} y2={f1(p.y)} /><line x1={317} y1={129} x2={f1(p.x)} y2={f1(p.y)} /></g>
        const poleX = side === 'right' ? 317 : 43
        return <line key={`f${id}`} x1={poleX} y1={129} x2={f1(p.x)} y2={f1(p.y)} stroke={FIBRE} strokeWidth={1.2} />
      })}
      {CHROMOSOMES.map((id) => {
        const p = positionOf(id, allocation, drag)
        return (
          <g
            key={id} data-chromosome={id} role="slider" tabIndex={locked || divided ? -1 : 0}
            aria-label={`${isLong(id) ? 'Long' : 'Short'} ${isBlue(id) ? 'blue' : 'ochre'} copied chromosome. ${allocation[id] === 'none' ? 'Not placed' : allocation[id] === 'equator' ? 'On the equator' : `At the ${allocation[id]} pole`}. ${config.task === 'mitosis' ? 'Drag onto the equator, or press an up or down arrow key.' : 'Drag or use left and right arrow keys.'}`}
            aria-valuemin={-1} aria-valuemax={1} aria-valuenow={allocation[id] === 'left' ? -1 : allocation[id] === 'right' || allocation[id] === 'equator' ? 1 : 0}
            aria-valuetext={allocation[id] === 'none' ? 'Not placed' : allocation[id] === 'equator' ? 'On the equator' : `${allocation[id]} pole`}
            aria-disabled={locked || divided || undefined}
            className={`nodrag outline-none ${locked || divided ? '' : 'cursor-grab active:cursor-grabbing'} [&:focus-visible_.cd-focus]:visible`}
            style={{ ...ease, touchAction: 'none', transform: `translate(${f1(p.x)}px, ${f1(p.y)}px)` }}
            onPointerDown={(e) => !locked && !divided && begin(e, id)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
            onKeyDown={(e) => !locked && !divided && keySide(e, config.task, id, allocation[id], set)}
          >
            <rect x={-34} y={-39} width={68} height={79} fill="transparent" />
            <ChromosomeShape id={id} />
            <g transform={config.task === 'mitosis' ? 'translate(34 0)' : 'translate(0 37)'}><Handle mitosis={config.task === 'mitosis'} /></g>
          </g>
        )
      })}
      {!divided && (
        <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle" aria-hidden="true">
          <text style={LABEL_STYLE} x={67} y={49}>left pole</text><text style={LABEL_STYLE} x={293} y={49}>right pole</text>
        </g>
      )}
    </g>
  )
}

function Daughters({ meiosis, allocation, reduced, motionClass = '' }: { meiosis: boolean; allocation: Allocation; reduced: boolean; motionClass?: string }) {
  const ease: CSSProperties = reduced ? {} : { transition: 'opacity 600ms ease, transform 750ms ease' }
  return (
    <g className={motionClass} style={ease} data-daughters="1">
      <path d={cellPath(true)} fill={CELL} stroke={CELL_EDGE} strokeWidth={3} />
      <path d={rightCellPath()} fill={CELL} stroke={CELL_EDGE} strokeWidth={3} />
      {(['left', 'right'] as const).map((side) => (
        <g key={side} data-daughter={side} transform={`translate(${side === 'left' ? 105 : 255} 129)`}>
          <ellipse rx={47} ry={68} fill="none" stroke={CELL_INNER} strokeWidth={1.2} />
          {meiosis ? CHROMOSOMES.filter((id) => allocation[id] === side).map((id, j, list) => (
            <g key={id} transform={`translate(${(j - (list.length - 1) / 2) * 25} ${j % 2 ? 25 : -20}) scale(.62)`}><ChromosomeShape id={id} small /></g>
          )) : CHROMOSOMES.map((id, j, list) => (
            <g key={id} data-chromatid={id} transform={`translate(${(j - (list.length - 1) / 2) * 17} ${isLong(id) ? -17 : 27})`}><GameteChromosome id={id} /></g>
          ))}
        </g>
      ))}
    </g>
  )
}

function Gametes({ allocation, reduced, motionClass = '' }: { allocation: Allocation; reduced: boolean; motionClass?: string }) {
  const cells: { x: number; y: number; ids: ChromosomeId[] }[] = []
  // Each intermediate cell divides twice: its two gametes receive one chromatid from every copied chromosome at that pole.
  for (const side of ['left', 'right'] as const) {
    const ids = CHROMOSOMES.filter((id) => allocation[id] === side)
    for (const vertical of ['top', 'bottom'] as const) {
      cells.push({ x: side === 'left' ? 102 : 258, y: vertical === 'top' ? 77 : 181, ids })
    }
  }
  return (
    <g className={motionClass} data-gametes="1" style={reduced ? {} : { transition: 'opacity 650ms ease' }}>
      {cells.map((cell, k) => (
        <g key={k} transform={`translate(${cell.x} ${cell.y})`}>
          <path d="M 0 -49 C -36 -49 -58 -32 -58 0 C -58 32 -36 49 0 49 C 36 49 58 32 58 0 C 58 -32 36 -49 0 -49 Z" fill={CELL} stroke={CELL_EDGE} strokeWidth={2.4} />
          <ellipse rx={49} ry={40} fill="none" stroke={CELL_INNER} strokeWidth={1.2} />
          {cell.ids.map((id, j, list) => {
            // Spread however many chromatids arrived, so a wrong division with three on one side still shows all three.
            const at = j - (list.length - 1) / 2
            return <g key={id} transform={`translate(${at * (list.length > 2 ? 18 : 28)} 0) rotate(${at * (list.length > 2 ? 8 : 24)})`}><GameteChromosome id={id} swap={(k + j) % 2 === 0} /></g>
          })}
          <text style={LABEL_STYLE} x={0} y={37} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700}>{`gamete ${k + 1}`}</text>
        </g>
      ))}
    </g>
  )
}

/** Metaphase becomes anaphase: the sister chromatids of every X visibly travel from the equator to opposite poles. */
function Anaphase({ moving }: { moving: boolean }) {
  return (
    <g data-anaphase="1">
      <path d={cellPath(false)} fill={CELL} stroke={CELL_EDGE} strokeWidth={3} />
      <Pole x={43} y={129} /><Pole x={317} y={129} />
      {CHROMOSOMES.map((id, i) => {
        const y = isLong(id) ? 100 : 158
        const fromX = [105, 150, 210, 255][i]
        return (
          <g key={id} data-anaphase-chromosome={id}>
            {(['left', 'right'] as const).map((side) => {
              const x = (side === 'left' ? 84 : 276) + (isBlue(id) ? -11 : 11)
              const from = { '--dx': `${fromX - x}px`, '--dy': `${129 - y}px` } as CSSProperties
              return <g key={side}>
                <line x1={side === 'left' ? 43 : 317} y1={129} x2={x} y2={y} stroke={FIBRE} strokeWidth={1.2} />
                <g className={moving ? 'cd-pull' : ''} style={from}>
                  <g transform={`translate(${x} ${y})`}><GameteChromosome id={id} /></g>
                </g>
              </g>
            })}
          </g>
        )
      })}
    </g>
  )
}

/** The two stages each division plays, in order, with the words that name them on the plate and on the stage buttons. */
const STAGES = {
  mitosis: [{ chip: 'Pulled apart', title: 'The copies are pulled to opposite poles' }, { chip: 'Two cells', title: 'Two identical cells' }],
  meiosis: [{ chip: '1st division', title: '1st division: the cell splits in two' }, { chip: '2nd division', title: '2nd division: the copies separate' }],
} as const
type Phase = 'parent' | 'to1' | 's1' | 'to2' | 's2'

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

export function CellDivisionView({ config, state, setState, marked, reduced, locked }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const current = marked === 'shown' ? cellDivisionEngine.solve(config) : state
  const allocation = sidesOf(current)
  const [drag, setDrag] = useState<{ id: ChromosomeId; p: Pt } | null>(null)
  const [phase, setPhase] = useState<Phase>(current.divided ? 's2' : 'parent')
  const wasDivided = useRef(Boolean(current.divided))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const stopTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  // Dividing plays both stages slowly enough to follow, each named on the plate, then the stage buttons can replay either one.
  useEffect(() => {
    if (!current.divided) { wasDivided.current = false; stopTimers(); setPhase('parent'); return }
    if (wasDivided.current) { setPhase((p) => (p === 'to1' || p === 'to2' ? 's2' : p)); return }
    wasDivided.current = true
    if (reduced) { setPhase('s2'); return }
    setPhase('to1')
    timers.current = [setTimeout(() => setPhase('s1'), 900), setTimeout(() => setPhase('to2'), 3100), setTimeout(() => setPhase('s2'), 4000)]
    return stopTimers
  }, [current.divided, config.task, reduced])

  const set = (id: ChromosomeId, side: Side) => {
    if (locked) return
    setDrag(null)
    setState(setSide(current, id, side))
  }
  const toStage = (e: PointerEvent): Pt | null => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: q.x, y: q.y }
  }
  const begin = (e: PointerEvent, id: ChromosomeId) => {
    const p = toStage(e)
    if (!p) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ id, p })
  }
  const move = (e: PointerEvent) => {
    if (!drag) return
    const p = toStage(e)
    if (p) setDrag({ id: drag.id, p: { x: clamp(p.x, 48, 312), y: clamp(p.y, 61, 198) } })
  }
  const end = () => {
    if (!drag) return
    const p = drag.p
    if (config.task === 'mitosis') set(drag.id, Math.abs(p.x - 180) <= 48 && p.y >= 76 && p.y <= 184 ? 'equator' : 'none')
    else set(drag.id, p.x < 135 ? 'left' : p.x > 225 ? 'right' : 'none')
  }
  const ready = complete(config, { ...current, divided: false })
  const allPlaced = config.task === 'mitosis' ? ready : CHROMOSOMES.every((id) => allocation[id] !== 'none')
  const divided = Boolean(current.divided)
  const text = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, current) : ''
  const stages: readonly { chip: string; title: string }[] = STAGES[config.task]
  const stage: number = phase === 'to1' || phase === 's1' ? 0 : phase === 'to2' || phase === 's2' ? 1 : -1

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={cellDescription(config.task, allocation, divided)} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {!reduced && <style>{`.cd-old{animation:cd-old 900ms ease-in both}.cd-new{animation:cd-new 900ms ease-out both}.cd-pull{animation:cd-pull 900ms cubic-bezier(.3,.7,.3,1) both}@keyframes cd-old{to{opacity:0}}@keyframes cd-new{from{opacity:0}}@keyframes cd-pull{from{transform:translate(var(--dx),var(--dy))}}`}</style>}
          {(phase === 'parent' || phase === 'to1') && <g className={phase === 'to1' ? 'cd-old' : ''}><ParentScene config={config} allocation={allocation} divided={false} set={set} drag={drag} begin={begin} move={move} end={end} locked={locked || phase === 'to1'} reduced={reduced} /></g>}
          {(phase === 'to1' || phase === 's1' || phase === 'to2') && <g className={phase === 'to1' ? 'cd-new' : phase === 'to2' ? 'cd-old' : ''}>
            {config.task === 'mitosis' ? <Anaphase moving={phase === 'to1' && !reduced} /> : <Daughters meiosis allocation={allocation} reduced={reduced} />}
          </g>}
          {(phase === 'to2' || phase === 's2') && <g className={phase === 'to2' ? 'cd-new' : ''}>
            {config.task === 'mitosis' ? <Daughters meiosis={false} allocation={allocation} reduced={reduced} /> : <Gametes allocation={allocation} reduced={reduced} />}
          </g>}
          {(() => {
            const title = stage < 0 ? 'model: two chromosome pairs' : stages[stage].title
            const w = Math.round(title.length * 6.6 + 22)
            return (
              <g fontFamily={FONT} fontSize={12} fontWeight={700} aria-hidden="true">
                <rect x={180 - w / 2} y={6} width={w} height={20} rx={10} fill={PLATE} stroke={stage < 0 ? 'none' : PLATE_EDGE} />
                <text style={stage < 0 ? LABEL_STYLE : { fill: INK, color: INK }} x={180} y={20.5} textAnchor="middle">{title}</text>
              </g>
            )
          })()}
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span className="flex items-center gap-1 whitespace-nowrap"><i className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} />Blue homologue</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><i className="h-2.5 w-2.5 rounded-full" style={{ background: OCHRE }} />Ochre homologue</span>
          <span className="whitespace-nowrap">X = copied chromosome</span>
        </figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-2">
        {stage < 0 ? <span className="text-[12px] font-bold text-ss-slate">{config.task === 'mitosis' ? 'Cell division' : 'First, then second division'}</span> : (
          <div className="flex gap-1.5" role="group" aria-label="Replay a stage">
            {stages.map((s, i) => (
              <button
                key={s.chip} type="button" aria-pressed={stage === i}
                onClick={() => { stopTimers(); setPhase(i === 0 ? 's1' : 's2') }}
                className={`nodrag h-8 whitespace-nowrap rounded-lg border-2 bg-ss-panel px-2.5 text-[12px] font-extrabold touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] motion-reduce:transition-none ${stage === i ? 'border-[color:var(--subject)] text-ss-ink' : 'border-ss-line text-ss-slate hover:border-[color:var(--subject)]'}`}
              >{`${i + 1}. ${s.chip}`}</button>
            ))}
          </div>
        )}
        <button
          type="button" aria-label={divided && marked === 'wrong' ? 'Undo division' : config.task === 'mitosis' ? 'Divide the cell' : 'Divide twice'} disabled={locked || !allPlaced || (divided && marked !== 'wrong')}
          onClick={() => { if (!locked) setState({ ...current, divided: divided && marked === 'wrong' ? false : true }) }}
          className="nodrag h-8 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-extrabold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >{divided && marked === 'wrong' ? 'Undo division' : config.task === 'mitosis' ? 'Divide the cell' : 'Divide twice'}</button>
      </div>
      <span className="sr-only" aria-live="polite">{divided ? stage >= 0 ? `${stages[stage].title}.` : '' : ready ? 'The chromosome sets can now be divided.' : config.task === 'mitosis' ? 'Move every copied chromosome onto the equator.' : 'Move each copied chromosome to a pole.'}</span>
      <Verdict marked={marked} text={text} />
    </div>
  )
}
