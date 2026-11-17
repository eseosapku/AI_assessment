'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Activity, OpportunityConfig, OpportunityState } from './config'
import { choiceOf, madeText, outputAt, pickedOf, wheatWorkers, workersOf, working } from './config'

type Props = SceneViewProps<OpportunityConfig, OpportunityState>

// Quiet real materials, the same in both themes. No gradients, shadows or neon.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#64748B'
const PAPER = '#FFFFFF'
const ACCENT = '#2F7FB8'
const ACCENT_DARK = '#1F6397'
const GREEN = '#3E7C59'
const GREEN_DARK = '#285C3E'
const SOIL = '#B9895C'
const WHEAT = '#D7AA4B'
const LEAF = '#5D8B54'
const SKIN = '#C98E68'
const SHIRT = '#4F86B5'
const TROUSER = '#42536A'
const FONT = 'system-ui, sans-serif'

// Written here, not imported, because config.ts and this file import each other (rule 41). Tests check agreement.
export const W = 360
export const CHOICE_H = 220
export const PPC_H = 270

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const stopArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

function ActivityDrawing({ kind }: { kind: string }) {
  const common = { width: 42, height: 36, viewBox: '0 0 42 36', 'aria-hidden': true as const }
  if (kind === 'cinema') return (
    <svg {...common}>
      <rect x={3} y={5} width={36} height={26} rx={4} fill="#465A78" />
      <rect x={7} y={9} width={28} height={14} rx={1.5} fill="#C7DCEB" />
      <path d="M18 10.5 27 16 18 21.5Z" fill={ACCENT_DARK} />
      <circle cx={11} cy={28} r={2} fill="#F4C95D" /><circle cx={16} cy={28} r={2} fill="#F4C95D" /><circle cx={21} cy={28} r={2} fill="#F4C95D" />
    </svg>
  )
  if (kind === 'football') return (
    <svg {...common}>
      <circle cx={21} cy={18} r={15} fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
      <path d="m21 10 6 4.5-2.3 7h-7.4l-2.3-7Z" fill={INK} />
      <path d="m21 10-1-6m7 10.5 7-2m-9.3 9 4 6m-11.4-6-4 6m4.7-13-7-2" fill="none" stroke={INK} strokeWidth={1.5} />
      <path d="m8 10 7 2.5m-2 15 4.3-6m11.4 6-4-6m9.4-9-7 2" fill="none" stroke={INK} strokeWidth={1.5} />
    </svg>
  )
  if (kind === 'study') return (
    <svg {...common}>
      <path d="M4 7q9-3 17 2v23q-8-5-17-2Zm34 0q-9-3-17 2v23q8-5 17-2Z" fill="#E8F1F7" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M21 9v23" stroke={INK} strokeWidth={1.4} />
      <path d="M8 12q5-1 9 1m-9 4q5-1 9 1m-9 4q5-1 9 1m8-10q4-2 9-1m-9 5q4-2 9-1m-9 5q4-2 9-1" fill="none" stroke={ACCENT} strokeWidth={1.2} strokeLinecap="round" />
      <path d="m29 4 8 8" stroke="#C88D37" strokeWidth={3} strokeLinecap="round" /><path d="m37 12 2 2" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
  return (
    <svg {...common}>
      <path d="M8 16h26l-3 15H11Z" fill="#F1E3D0" stroke={INK} strokeWidth={1.4} />
      <path d="M10 22h22" stroke="#B87A45" strokeWidth={3} />
      <path d="M34 18h3a4 4 0 0 1 0 8h-4" fill="none" stroke={INK} strokeWidth={1.5} />
      <path d="M16 12c-4-4 3-4 0-8m7 8c-4-4 3-4 0-8" fill="none" stroke={SOFT} strokeWidth={1.5} strokeLinecap="round" />
      <path d="M6 33h31" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function ChoiceCard({ activity, selected, locked, onPick, onDragStart }: {
  activity: Activity; selected: boolean; locked: boolean; onPick(): void; onDragStart(e: PointerEvent<HTMLButtonElement>): void
}) {
  return (
    <button
      type="button" data-choice={activity.id} aria-label={`Give up ${activity.name}`} disabled={locked}
      onClick={onPick} onPointerDown={onDragStart}
      className={`nodrag flex w-[108px] shrink-0 touch-manipulation select-none flex-col items-center rounded-xl border-2 px-1 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${selected ? 'border-[#2F7FB8] bg-[#EDF5FA]' : 'border-ss-line bg-ss-panel'} disabled:cursor-default`}
    >
      <ActivityDrawing kind={activity.id} />
      <span className="whitespace-nowrap text-[12px] font-extrabold text-ss-ink">{activity.name}</span>
      <span className="whitespace-nowrap text-[12px] font-semibold text-ss-slate">{activity.detail}</span>
    </button>
  )
}

function ChoiceView({ config, state, setState, marked, locked, reduced }: Props & { config: Extract<OpportunityConfig, { task: 'choice' }> }) {
  const c = choiceOf(config)
  const picked = pickedOf(state)
  const chosen = c.options.find((o) => o.id === picked)
  const [dragging, setDragging] = useState('')
  const drag = useRef<{ id: string; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null)
  const suppress = useRef(false)

  const start = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (locked || e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = { id, x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false }
    setDragging(id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
      d.moved = true
      suppress.current = true
      const ghost = document.querySelector<HTMLElement>('[data-drag-ghost]')
      if (ghost) {
        ghost.style.display = 'flex'
        ghost.style.left = `${e.clientX - d.dx}px`
        ghost.style.top = `${e.clientY - d.dy}px`
      }
      const tray = document.querySelector<SVGElement>('[data-tray]')
      if (tray) {
        const r = tray.getBoundingClientRect()
        const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        tray.setAttribute('data-over', over ? '1' : '0')
        tray.setAttribute('stroke', over ? ACCENT : 'transparent')
      }
    }
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    setDragging('')
    const ghost = document.querySelector<HTMLElement>('[data-drag-ghost]')
    if (ghost) ghost.style.display = 'none'
    const tray = document.querySelector<SVGElement>('[data-tray]')
    tray?.setAttribute('data-over', '0')
    tray?.setAttribute('stroke', 'transparent')
    if (d?.moved && tray) {
      const r = tray.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) setState({ picked: d.id })
      setTimeout(() => { suppress.current = false }, 0)
    }
  }

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={stopArrows}>
      <div className="flex items-center justify-between rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
        <div><p className="text-[12px] font-bold text-ss-slate">{c.time} · your choice</p><p className="text-[15px] font-extrabold text-ss-ink">{c.chosen.name}</p></div>
        <ActivityDrawing kind={c.chosen.id} />
      </div>
      <figure className="m-0 flex flex-col gap-1.5">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${CHOICE_H}`} role="img" aria-label={`Three possible activities. ${chosen ? `${chosen.name} is in the give-up tray.` : 'The give-up tray is empty.'}`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={CHOICE_H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
            <text x={180} y={23} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Your next-best alternative</text>
            {/* An open box, not an abstract answer slot. */}
            <path d="M104 70 83 48h194l-21 22" fill="#E7EDF2" stroke={EDGE} strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M104 70h152l-10 99H114Z" fill="#EDF2F6" stroke={EDGE} strokeWidth={1.5} strokeLinejoin="round" />
            <path d="m104 70-21-22 10 99 21 22m142-99 21-22-10 99-21 22" fill="#E3EAF0" stroke={EDGE} strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M111 77h138" stroke="#FFFFFF" strokeWidth={2} />
            <text data-tray-label x={180} y={199} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={800} fill={SOFT}>Give up tray</text>
            {!chosen && <text x={180} y={121} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={600} fill={SOFT}>one activity here</text>}
            <rect data-tray data-over="0" x={76} y={38} width={208} height={172} rx={12} fill="transparent" stroke="transparent" strokeWidth={3} />
          </svg>
          {chosen && (
            <div className="pointer-events-none absolute left-1/2 top-[23%] flex w-[108px] flex-col items-center" style={{ transform: 'translateX(-50%)' }} aria-hidden="true">
              <ActivityDrawing kind={chosen.id} />
              <span className="whitespace-nowrap text-[12px] font-extrabold text-[#334155]">{chosen.name}</span>
              <span className="whitespace-nowrap text-[12px] font-semibold text-[#64748B]">{chosen.detail}</span>
            </div>
          )}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Tap an activity, or drag it to the tray.</figcaption>
      </figure>
      <div className="flex justify-between gap-1.5" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {c.options.map((a) => picked === a.id
          ? <button key={a.id} type="button" aria-label={`Put ${a.name} back`} disabled={locked} onClick={() => setState({ picked: '' })} className="nodrag flex w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border-2 border-dashed border-ss-line px-1 text-[12px] font-bold text-ss-slate outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:opacity-40">In tray · put back</button>
          : <ChoiceCard key={a.id} activity={a} selected={false} locked={locked} onPick={() => { if (!suppress.current) setState({ picked: a.id }) }} onDragStart={start(a.id)} />)}
      </div>
      {marked !== 'idle' && <Verdict text={marked === 'wrong' ? madeText(config, state) : working(config, state)} />}
      <div data-drag-ghost className="pointer-events-none fixed z-50 hidden w-[108px] flex-col items-center rounded-xl border-2 border-ss-line bg-ss-panel px-1 py-1.5 opacity-90">
        {dragging && <><ActivityDrawing kind={dragging} /><span className="text-[12px] font-extrabold text-ss-ink">{c.options.find((a) => a.id === dragging)?.name}</span><span className="text-[12px] font-semibold text-ss-slate">{c.options.find((a) => a.id === dragging)?.detail}</span></>}
      </div>
    </div>
  )
}

function Worker({ x, y, crop, i }: { x: number; y: number; crop: 'wheat' | 'vegetables'; i: number }) {
  return (
    <g transform={`translate(${x} ${y})`} data-worker={`${crop}-${i}`}>
      <circle cx={0} cy={-13} r={4.5} fill={SKIN} stroke={INK} strokeWidth={0.8} />
      <path d="M-7-14h14M-4-14v-4h8v4" fill={WHEAT} stroke="#8E6B2C" strokeWidth={1} strokeLinejoin="round" />
      <path d="M-5-7q5-3 10 0l2 10H-7Z" fill={SHIRT} stroke={INK} strokeWidth={0.8} />
      <path d="m-6-4-4 7m16-7 4 7M-4 3l-1 8m9-8 1 8" fill="none" stroke={TROUSER} strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

function Crops({ crop }: { crop: 'wheat' | 'vegetables' }) {
  return (
    <g aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 13 + i * 23
        return crop === 'wheat' ? (
          <g key={i} transform={`translate(${x} 0)`} stroke="#9A772C" strokeWidth={1.3} strokeLinecap="round">
            <path d="M0 139v-14m0 9-6-7m6 10 6-7" fill="none" />
            <path d="M0 105c-7 4-5 13 0 15 5-2 7-11 0-15Z" fill={WHEAT} />
          </g>
        ) : (
          <g key={i} transform={`translate(${x} 0)`} fill={LEAF} stroke={GREEN_DARK} strokeWidth={0.8}>
            <ellipse cx={-4} cy={143} rx={4} ry={7} transform="rotate(-35 -4 143)" />
            <ellipse cx={5} cy={143} rx={4} ry={7} transform="rotate(35 5 143)" />
            <ellipse cx={0} cy={140} rx={4} ry={7} />
          </g>
        )
      })}
    </g>
  )
}

const PX = 224
const PY = 36
const PS = 105
const graphPoint = (wheat: number) => ({ x: PX + (outputAt(wheat).wheat / 42) * PS, y: PY + PS - (outputAt(wheat).vegetables / 42) * PS })

function FarmGraph({ wheat }: { wheat: number }) {
  const points = [0, 1, 2, 3, 4, 5, 6].map(graphPoint)
  const path = `M${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L${p.x} ${p.y}`).join(' ')
  const at = graphPoint(wheat)
  return (
    <g fontFamily={FONT}>
      <text x={PX + PS / 2} y={20} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>Production possibilities</text>
      <path d={`M${PX} ${PY}V${PY + PS}H${PX + PS}`} fill="none" stroke={SOFT} strokeWidth={1.2} />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={PAPER} stroke={ACCENT} strokeWidth={1.3} />)}
      <circle data-production-point cx={at.x} cy={at.y} r={5.5} fill={ACCENT_DARK} stroke={PAPER} strokeWidth={2} />
      <text x={PX + PS + 3} y={PY + PS + 15} textAnchor="end" fontSize={12} fontWeight={700} fill={INK}>Wheat</text>
      <text x={PX - 4} y={PY + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={INK}>Veg</text>
      <text x={PX + PS / 2} y={PY + PS + 28} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT}>tonnes</text>
    </g>
  )
}

function PpcView({ config, state, setState, marked, locked, reduced }: Props & { config: Extract<OpportunityConfig, { task: 'ppc' }> }) {
  const wheat = workersOf(state)
  const made = outputAt(wheat)
  const want = outputAt(wheatWorkers(config))
  const left = Array.from({ length: wheat }, (_, i) => i)
  const right = Array.from({ length: 6 - wheat }, (_, i) => i)
  const [transfer, setTransfer] = useState<{ id: number; from: 'wheat' | 'vegetables'; dx: number; dy: number } | null>(null)
  const [crossed, setCrossed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!transfer || reduced) return
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setCrossed(true)))
    return () => cancelAnimationFrame(frame)
  }, [transfer, reduced])
  const moveWorker = (next: number) => {
    if (locked || next === wheat || next < 0 || next > 6) return
    if (timer.current) clearTimeout(timer.current)
    const from = next > wheat ? 'vegetables' : 'wheat'
    const sourceIndex = from === 'vegetables' ? 6 - wheat - 1 : wheat - 1
    const targetIndex = from === 'vegetables' ? wheat : next - 1
    const sx = 27 + (sourceIndex % 3) * 48
    const sy = (from === 'vegetables' ? 193 : 82) + Math.floor(sourceIndex / 3) * 31
    const tx = 27 + (targetIndex % 3) * 48
    const ty = (from === 'vegetables' ? 82 : 193) + Math.floor(targetIndex / 3) * 31
    setTransfer({ id: Date.now(), from, dx: tx - sx, dy: ty - sy })
    setCrossed(false)
    setState({ wheat: next })
    timer.current = setTimeout(() => setTransfer(null), reduced ? 0 : 720)
  }
  const transferStyle = (from: 'wheat' | 'vegetables', dx: number, dy: number) => {
    const sourceIndex = from === 'vegetables' ? 7 - wheat : wheat
    const sx = 27 + (sourceIndex % 3) * 48
    const sy = (from === 'vegetables' ? 193 : 82) + Math.floor(sourceIndex / 3) * 31
    return {
      transform: `translate(${sx + (crossed || reduced ? dx : 0)}px, ${sy + (crossed || reduced ? dy : 0)}px)`,
      transition: reduced ? undefined : 'transform 700ms ease-in-out',
    }
  }
  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={stopArrows}>
      <figure className="m-0 flex flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${PPC_H}`} role="img" aria-label={`Six workers on a farm: ${wheat} growing wheat and ${6 - wheat} growing vegetables. Output is ${made.wheat} tonnes of wheat and ${made.vegetables} tonnes of vegetables. The production point moves as workers transfer.`} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={PPC_H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          {/* A small real farm, two fenced soil beds. */}
          <rect x={14} y={33} width={126} height={111} rx={9} fill="#F1E7CE" stroke={GREEN} strokeWidth={1.2} />
          <path d="M23 119h108M23 130h108" stroke="#DDC79E" strokeWidth={2} strokeLinecap="round" />
          <rect x={14} y={143} width={126} height={111} rx={9} fill="#F3E8D9" stroke={SOIL} strokeWidth={1.2} />
          <path d="M23 235h108M23 246h108" stroke="#DFC5A8" strokeWidth={2} strokeLinecap="round" />
          <Crops crop="wheat" />
          <g transform="translate(0 111)"><Crops crop="vegetables" /></g>
          <text x={77} y={51} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill={GREEN_DARK}>Wheat field</text>
          <text x={77} y={161} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill="#7B5434">Vegetable field</text>
          {left.map((i) => <Worker key={`w${i}`} x={27 + (i % 3) * 48} y={82 + Math.floor(i / 3) * 31} crop="wheat" i={i} />)}
          {right.map((i) => <Worker key={`v${i}`} x={27 + (i % 3) * 48} y={193 + Math.floor(i / 3) * 31} crop="vegetables" i={i} />)}
          {transfer && !reduced && (
            <g data-worker-transfer={transfer.from} style={transferStyle(transfer.from, transfer.dx, transfer.dy)}>
              <circle cx={0} cy={-13} r={4.5} fill={SKIN} stroke={INK} strokeWidth={0.8} />
              <path d="M-7-14h14M-4-14v-4h8v4" fill={WHEAT} stroke="#8E6B2C" strokeWidth={1} />
              <path d="M-5-7q5-3 10 0l2 10H-7Z" fill={SHIRT} stroke={INK} strokeWidth={0.8} />
              <path d="m-6-4-4 7m16-7 4 7M-4 3l-1 8m9-8 1 8" fill="none" stroke={TROUSER} strokeWidth={3} strokeLinecap="round" />
            </g>
          )}
          <path d="M153 92h12m-5-5 5 5-5 5m-12 91h-12m5-5-5 5 5 5" fill="none" stroke={SOFT} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <text x={174} y={121} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Fixed land</text>
          <text x={174} y={139} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>6 workers</text>
          <FarmGraph wheat={wheat} />
          <path d="M155 174h190" stroke={EDGE} strokeWidth={1} />
          <text x={160} y={194} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Order</text>
          <text x={343} y={194} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={800} fill={INK}>{want.wheat} t wheat · {want.vegetables} t veg</text>
          <text x={160} y={219} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Wheat</text>
          <text x={343} y={219} textAnchor="end" fontFamily={FONT} fontSize={15} fontWeight={800} fill={GREEN_DARK} data-wheat-output>{made.wheat} tonnes</text>
          <text x={160} y={246} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Vegetables</text>
          <text x={343} y={246} textAnchor="end" fontFamily={FONT} fontSize={15} fontWeight={800} fill="#7B5434" data-vegetable-output>{made.vegetables} tonnes</text>
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Move one worker: one crop grows, the other shrinks.</figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Workers growing wheat</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Move one worker to vegetables" disabled={locked || wheat <= 0} onClick={() => moveWorker(wheat - 1)} className={STEP}>−</button>
          <span role="spinbutton" tabIndex={locked ? -1 : 0} aria-label="Workers growing wheat" aria-valuenow={wheat} aria-valuemin={0} aria-valuemax={6} aria-valuetext={`${wheat} workers growing wheat, ${6 - wheat} growing vegetables`}
            onKeyDown={(e) => {
              const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
              if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
              e.preventDefault(); e.stopPropagation()
              if (locked) return
              moveWorker(e.key === 'Home' ? 0 : e.key === 'End' ? 6 : Math.max(0, Math.min(6, wheat + by)))
            }}
            className="nodrag min-w-[28px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          >{wheat}</span>
          <button type="button" aria-label="Move one worker to wheat" disabled={locked || wheat >= 6} onClick={() => moveWorker(wheat + 1)} className={STEP}>+</button>
        </span>
      </div>
      <p className="flex items-baseline justify-between border-t border-ss-line pt-1.5"><span className="text-[12px] font-bold text-ss-slate">Workers growing vegetables</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{6 - wheat}</span></p>
      {marked !== 'idle' && <Verdict text={marked === 'wrong' ? madeText(config, state) : working(config, state)} />}
    </div>
  )
}

function Verdict({ text }: { text: string }) {
  return <p className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

export function OpportunityCostView(props: Props) {
  const { config, marked } = props
  const state = marked === 'shown'
    ? config.task === 'choice' ? { picked: choiceOf(config).next } : { wheat: wheatWorkers(config) }
    : props.state
  const next = { ...props, state }
  return config.task === 'choice'
    ? <ChoiceView {...next} config={config} />
    : <PpcView {...next} config={config} />
}
