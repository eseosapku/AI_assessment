'use client'
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { TimeConfig, TimeState } from './config'
import { currentOf, digital, durationText, madeText, readMinutes, timeWords, wall, working } from './config'

type Props = SceneViewProps<TimeConfig, TimeState>

// A paper-faced teaching clock on a pale plate in both themes, like measure-shape's instruments.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const CASE = '#526477'
const CASE_DARK = '#314255'
const FACE = '#FFFDF7'
const INK = '#16202A'
const SOFT = '#475569'
const HAIR = '#B8C4CF'
const HOUR = '#24364B'
const MINUTE = '#2F6F9F'
const MINUTE_DARK = '#17486C'
const GRIP = '#D77A2B'
const GRIP_DARK = '#84420E'
const PALE_BLUE = '#DCEBF4'

export const W = 360
export const H = 292
export const CX = 180
export const CY = 137
export const RIM = 119
export const FACE_R = 108
export const MINUTE_R = 86
export const HOUR_R = 57

export type ClockPoint = { x: number; y: number }
export function pointAt(minutes: number, radius: number, hour = false): ClockPoint {
  const turns = hour ? minutes / 720 : minutes / 60
  const a = turns * Math.PI * 2
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) }
}
export function minuteFromPoint(x: number, y: number): number {
  const degrees = (Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI
  return ((Math.round(degrees / 6) % 60) + 60) % 60
}
export const hourAngle = (minutes: number) => wall(minutes) / 2
export const minuteAngle = (minutes: number) => (wall(minutes) % 60) * 6

const fmt = (n: number) => n.toFixed(2)
const ease = (reduced: boolean): CSSProperties | undefined => reduced ? undefined : { transition: 'transform 450ms ease-out, stroke-dashoffset 450ms ease-out' }

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function HourTicks() {
  return (
    <g aria-hidden="true">
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        const a = pointAt(i, FACE_R - 2)
        const b = pointAt(i, FACE_R - (major ? 10 : 6))
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? INK : SOFT} strokeWidth={major ? 2 : 1.05} strokeLinecap="round" />
      })}
    </g>
  )
}

function FaceNumbers() {
  return (
    <g aria-hidden="true" fill={INK} fontFamily="system-ui, sans-serif" fontSize={16} fontWeight={750} textAnchor="middle">
      {Array.from({ length: 12 }, (_, k) => {
        const n = k + 1
        const p = pointAt(n * 5, 72)
        return <text key={n} x={p.x} y={p.y + 5.5} data-hour-number={n}>{n}</text>
      })}
    </g>
  )
}



function ClockFace({ config, state, reduced, live, focused, move }: {
  config: TimeConfig; state: TimeState; reduced: boolean; live: boolean; focused: boolean
  move(delta: number, backward: boolean): void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const current = currentOf(config, state)
  const minute = wall(current) % 60
  // Accumulated turns prevent a 359-to-0 minute step from animating backwards around the dial.
  // In an interval task the state counts minutes passed since the start, so the hands begin at the start time.
  const turned = (config.task === 'elapsed' ? config.start : 0) + readMinutes(state, 0)
  const handTurn = turned * 6
  const hourTurn = turned / 2
  const grip = pointAt(minute, MINUTE_R)
  const interval = config.task === 'elapsed'
  const initialMinute = interval ? wall(config.start) % 60 : null
  const passed = interval ? readMinutes(state, 0) : 0
  const arcLength = Math.PI * 2 * 99
  const progress = interval ? Math.min(1, passed / 60) : 0
  const turnText = `${digital(current, config.task === 'set' ? config.format : '24')}, ${timeWords(current)}`
  const description = `A teaching clock with a short hour hand and a long minute hand. It shows ${turnText}. ${interval ? `${durationText(passed)} has passed.` : ''}`

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className={`block h-auto w-full select-none ${live ? 'touch-none' : ''}`}
      role="group"
      aria-label={description}
      data-clock-face="1"
      data-minute={minute}
      data-hour-angle={fmt(hourTurn)}
    >
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {/* A real shallow-rimmed classroom clock: case, inner lip and warm paper face, all flat colours. */}
      <circle cx={CX} cy={CY + 3} r={RIM} fill={CASE_DARK} />
      <circle cx={CX} cy={CY} r={RIM} fill={CASE} />
      <circle cx={CX} cy={CY} r={FACE_R + 2} fill={CASE_DARK} />
      <circle cx={CX} cy={CY} r={FACE_R} fill={FACE} />
      <circle cx={CX} cy={CY} r={102} fill="none" stroke={HAIR} strokeWidth={0.8} />
      {interval && initialMinute !== null && (
        <g aria-hidden="true">
          <circle
            cx={CX} cy={CY} r={99} fill="none" stroke={PALE_BLUE} strokeWidth={5}
            strokeDasharray={`${fmt(progress * arcLength)} ${fmt(arcLength)}`}
            transform={`rotate(${initialMinute * 6} ${CX} ${CY})`}
            style={ease(reduced)}
          />
          <circle cx={pointAt(initialMinute, 99).x} cy={pointAt(initialMinute, 99).y} r={4} fill={CASE} stroke={FACE} strokeWidth={1.5} />
        </g>
      )}
      <HourTicks />
      <FaceNumbers />
      {/* The hour hand is short and weighty; it is driven, never separately draggable. */}
      <g transform={`rotate(${hourTurn} ${CX} ${CY})`} style={ease(reduced)} aria-hidden="true">
        <path d={`M ${CX - 5.5} ${CY + 13} L ${CX - 4.5} ${CY - 40} L ${CX} ${CY - HOUR_R} L ${CX + 4.5} ${CY - 40} L ${CX + 5.5} ${CY + 13} Z`} fill={HOUR} stroke={FACE} strokeWidth={1} strokeLinejoin="round" />
      </g>
      {/* The long hand has a narrow tail and a broad, easy-to-see blue pointer. */}
      <g transform={`rotate(${handTurn} ${CX} ${CY})`} style={ease(reduced)} aria-hidden="true">
        <path d={`M ${CX - 2.5} ${CY + 19} L ${CX - 3.2} ${CY - 63} L ${CX} ${CY - MINUTE_R + 5} L ${CX + 3.2} ${CY - 63} L ${CX + 2.5} ${CY + 19} Z`} fill={MINUTE} stroke={MINUTE_DARK} strokeWidth={1} strokeLinejoin="round" />
        <line x1={CX} y1={CY + 9} x2={CX} y2={CY - 72} stroke="#A9CDE2" strokeWidth={1.2} strokeLinecap="round" />
      </g>
      <circle cx={CX} cy={CY} r={7} fill={HOUR} stroke={FACE} strokeWidth={2} aria-hidden="true" />
      <circle cx={CX} cy={CY} r={2.3} fill={FACE} aria-hidden="true" />
      {live && (
        <g
          role="slider"
          tabIndex={0}
          data-handle="minute"
          aria-label="Minute hand. Drag the orange grip, or use arrow keys"
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={minute}
          aria-valuetext={turnText}
          className="cursor-grab outline-none focus-visible:outline-none active:cursor-grabbing"
          onPointerDown={(e: PointerEvent<SVGGElement>) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            dragging.current = true
          }}
          onPointerMove={(e: PointerEvent<SVGGElement>) => {
            if (!dragging.current || !svg.current) return
            const box = svg.current.getBoundingClientRect()
            const x = ((e.clientX - box.left) / box.width) * W
            const y = ((e.clientY - box.top) / box.height) * H
            const minuteAtPointer = minuteFromPoint(x, y)
            const oldMinute = wall(current) % 60
            const delta = ((minuteAtPointer - oldMinute + 30 + 60) % 60) - 30
            move(delta, delta < 0)
          }}
          onPointerUp={(e: PointerEvent<SVGGElement>) => {
            dragging.current = false
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onPointerCancel={() => { dragging.current = false }}
        >
          <circle cx={grip.x} cy={grip.y} r={27} fill="transparent" />
          {focused && <circle cx={grip.x} cy={grip.y} r={15} fill="none" stroke="var(--subject)" strokeWidth={3} />}
          <circle cx={grip.x} cy={grip.y} r={10.5} fill={GRIP} stroke={FACE} strokeWidth={2.2} />
          <path d={`M ${grip.x - 4} ${grip.y - 3} L ${grip.x} ${grip.y - 7} L ${grip.x + 4} ${grip.y - 3} M ${grip.x - 4} ${grip.y + 3} L ${grip.x} ${grip.y + 7} L ${grip.x + 4} ${grip.y + 3}`} fill="none" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  )
}

function Readout({ config, state }: { config: TimeConfig; state: TimeState }) {
  const current = currentOf(config, state)
  const format = config.task === 'set' ? config.format : '24'
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-t border-ss-line pt-2">
      <span className="text-[12px] font-bold text-ss-slate">{config.task === 'set' ? `Clock shows (${format}-hour)` : 'Clock shows'}</span>
      <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-ss-ink" data-readout="time">{digital(current, format)}</span>
      {config.task === 'elapsed' && (
        <>
          <span className="text-[12px] font-bold text-ss-slate">Time passed</span>
          <span className="flex items-baseline justify-end gap-2">
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-readout="elapsed-hours">{Math.floor(readMinutes(state, 0) / 60)}h</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-readout="elapsed-minutes">{readMinutes(state, 0) % 60}m</span>
          </span>
        </>
      )}
    </div>
  )
}

export function TellingTimeView({ config, state, setState, marked, reduced, locked }: Props) {
  const [focused, setFocused] = useState(false)
  const live = !locked && marked !== 'right' && marked !== 'shown'
  const shownState = marked === 'shown'
    ? { minutes: config.task === 'set' ? config.target : ((config.end - config.start) % 1440 + 1440) % 1440 }
    : state
  const safeState = { minutes: readMinutes(shownState, 0) }
  const commit = (minutes: number) => {
    if (!live) return
    const bound = config.task === 'set' ? 1439 : 360
    const next = Math.max(config.task === 'set' ? -60 : 0, Math.min(bound, Math.round(minutes)))
    setState({ minutes: next })
  }
  const step = (by: number) => {
    const now = readMinutes(safeState, 0)
    if (config.task === 'set') {
      const next = now + by
      commit(next < 0 ? 1439 : next > 1439 ? 0 : next)
    } else commit(now + by)
  }
  const goal = config.task === 'set'
    ? <>Set <span className="tabular-nums">{digital(config.target, config.format)}</span></>
    : <>From <span className="tabular-nums">{digital(config.start, '24')}</span> to <span className="tabular-nums">{digital(config.end, '24')}</span></>
  const said = marked === 'wrong' ? madeText(config, safeState) : working(config)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5">
      <p className="text-center text-[15px] font-extrabold leading-snug text-ss-ink">{goal}</p>
      <figure className="m-0 flex w-full flex-col gap-1">
        <div
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (!(e.target as Element).closest('[data-handle="minute"]')) return
            const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 15, PageDown: -15 } as Record<string, number>)[e.key]
            if (by === undefined) return
            e.preventDefault()
            e.stopPropagation()
            step(by)
          }}
          onFocus={(e) => { if ((e.target as Element).closest('[data-handle="minute"]')) setFocused(true) }}
          onBlur={() => setFocused(false)}
        >
          <ClockFace config={config} state={safeState} reduced={reduced} live={live} focused={focused} move={(delta, backward) => {
            const base = readMinutes(safeState, 0)
            if (config.task === 'set') {
              const next = base + delta
              commit(next < 0 ? next + 1440 : next > 1439 ? next - 1440 : next)
            } else if (!backward || delta === 0) commit(base + Math.max(0, delta))
          }} />
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          <span className="font-bold text-ss-ink">short hour hand</span>
          <span> · </span>
          <span className="font-bold text-ss-ink">long minute hand</span>
          <span> · </span>
          <span className="font-bold text-ss-ink">orange grip</span>
        </figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Minute hand</span>
        <span className="flex items-center gap-1.5">
          <button type="button" aria-label="Move minute hand back one minute" disabled={!live || (config.task === 'elapsed' && readMinutes(safeState, 0) <= 0)} onClick={() => step(-1)} className={STEP}>−</button>
          <span className="min-w-[48px] text-center text-[12px] font-semibold text-ss-slate">1 minute</span>
          <button type="button" aria-label="Move minute hand forward one minute" disabled={!live || (config.task === 'elapsed' && readMinutes(safeState, 0) >= 360)} onClick={() => step(1)} className={STEP}>+</button>
        </span>
      </div>
      <Readout config={config} state={safeState} />
      <p className="hidden text-[12px] font-semibold text-ss-slate [.nodrag:has([data-handle=minute]:focus-visible)_&]:block">Arrow keys move one minute. Page Up or Down moves 15 minutes.</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>
        </div>
      )}
    </div>
  )
}
