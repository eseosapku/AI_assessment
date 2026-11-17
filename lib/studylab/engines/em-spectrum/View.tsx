'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { EmConfig, EmState, Region } from './config'
import { frequencyOf, madeAt, regionAt, targetRegion } from './config'

type Props = SceneViewProps<EmConfig, EmState>

// A light laboratory instrument in both themes, like measure-shape: its own quiet plate keeps every material readable.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#26384A'
const SOFT = '#52657A'
const SCREEN = '#EEF3F7'
const CASE = '#64748B'
const DARK = '#263442'
const METAL = '#D7E0E8'
const BLUE = '#347FA9'
const BLUE_DARK = '#205E80'
const PAPER = '#FFFDF7'
const GREEN = '#6E9E83'
const WARM = '#D98245'
const BONE = '#FFF4D8'
const VIOLET = '#7762A8'

export const W = 360
export const H = 352
export const TRACK_X0 = 50
export const TRACK_X1 = 310
export const TRACK_Y = 290
export const STOP_GAP = (TRACK_X1 - TRACK_X0) / 6
/** One entire stop either side is the visible target: there is no hidden pixel tolerance. */
export const TUNER_TOLERANCE = 0
export const tunerX = (at: number) => TRACK_X0 + at * STOP_GAP
const waveCycles = [2.2, 3.1, 4, 5.1, 6.3, 7.6, 9.2]
const ease = (reduced: boolean) => reduced ? undefined : { transition: 'transform 360ms ease-out, opacity 360ms ease-out, fill 360ms ease-out, stroke 360ms ease-out' }

function wavelengthText(region: Region): string {
  if (region.id === 'radio') return '100 m'
  if (region.id === 'microwave') return '0.12 m'
  if (region.id === 'infrared') return '940 nm'
  if (region.id === 'visible') return '500 nm'
  if (region.id === 'ultraviolet') return '365 nm'
  if (region.id === 'xray') return '0.1 nm'
  return '1 pm'
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'
function frequencyText(region: Region): string {
  const f = frequencyOf(region)
  if (f >= 1e14) {
    const exponent = Math.floor(Math.log10(f))
    const mantissa = f / 10 ** exponent
    return `${mantissa.toFixed(mantissa >= 9.95 ? 1 : 2).replace(/0$/, '')} × 10${[...String(exponent)].map((d) => SUPERSCRIPT[Number(d)]).join('')} Hz`
  }
  if (f >= 1e12) return `${f / 1e12} THz`
  if (f >= 1e9) return `${Math.round((f / 1e9) * 100) / 100} GHz`
  return `${f / 1e6} MHz`
}

export function wavePath(at: number, phase = 0.7): string {
  const cycles = waveCycles[at]
  const parts: string[] = []
  for (let k = 0; k <= 150; k++) {
    const x = 52 + (256 * k) / 150
    const y = 65 - 17 * Math.sin((k / 150) * cycles * Math.PI * 2 + phase)
    parts.push(`${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return parts.join(' ')
}

/** The bracket really joins two neighbouring crests; its label is offset when short waves crowd it. */
export function waveBracket(at: number): { x: number; gap: number; labelX: number } {
  const phase = 0.7
  const first = Math.ceil(phase / (Math.PI * 2))
  const cycles = waveCycles[at]
  const x = 52 + 256 * (first - phase / (Math.PI * 2)) / cycles
  const gap = 256 / cycles
  const start = x > 273 ? x - 2 * gap : x
  const centre = start + gap / 2
  const labelX = gap < 42 ? Math.max(118, Math.min(286, centre + 55)) : centre
  return { x: start, gap, labelX }
}

function WaveMonitor({ at, reduced }: { at: number; reduced: boolean }) {
  const path = wavePath(at)
  const bracket = waveBracket(at)
  return (
    <g aria-hidden="true">
      <rect x={24} y={20} width={312} height={102} rx={12} fill={SCREEN} stroke={EDGE} strokeWidth={1.2} />
      <path d="M52 65H308" stroke={HAIR} strokeWidth={1.2} />
      <path d={path} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={reduced ? undefined : { transition: 'd 500ms ease-out' }} />
      <path d={`M${bracket.x} 48V82M${bracket.x + bracket.gap} 48V82`} stroke={BLUE_DARK} strokeWidth={1.1} strokeDasharray="2 3" />
      <path d={`M${bracket.x} 55V75M${bracket.x} 65H${bracket.x + bracket.gap}M${bracket.x + bracket.gap} 55V75`} fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
      <text x={bracket.labelX} y={43} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>one wavelength</text>
      <text x={36} y={106} fontSize={12} fontWeight={700} fill={SOFT}>vacuum</text>
      {!reduced && <circle r={3.5} fill={BLUE_DARK}><animateMotion dur="2.8s" repeatCount="indefinite" path="M52 65H308" /></circle>}
      <path d="M307 61L313 65L307 69" fill="none" stroke={SOFT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function Tuner({ at, setAt, locked, reduced }: { at: number; setAt(n: number): void; locked: boolean; reduced: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const fromPointer = (e: { clientX: number }) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    const x = ((e.clientX - box.left) / box.width) * W
    setAt(Math.max(0, Math.min(6, Math.round((x - TRACK_X0) / STOP_GAP))))
  }
  const down = (e: PointerEvent<HTMLDivElement | SVGSVGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    fromPointer(e)
  }
  const move = (e: PointerEvent<HTMLDivElement | SVGSVGElement>) => { if (dragging.current) fromPointer(e) }
  const up = () => { dragging.current = false }
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? at - 1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? 6 : null
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    if (!locked) setAt(Math.max(0, Math.min(6, next)))
  }
  return (
    <div ref={track} className="relative mt-[-35px] h-[87px] w-full touch-none select-none">
      <svg viewBox="0 250 360 102" className="absolute inset-0 block h-full w-full" aria-hidden="true"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <rect x={28} y={261} width={304} height={58} rx={29} fill="transparent" className={locked ? '' : 'cursor-pointer'} />
      <text x={31} y={277} fontSize={12} fontWeight={700} fill={SOFT}>long waves</text>
      <text x={329} y={277} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>short waves</text>
      <line x1={TRACK_X0} x2={TRACK_X1} y1={TRACK_Y} y2={TRACK_Y} stroke={EDGE} strokeWidth={7} strokeLinecap="round" />
      <line x1={TRACK_X0} x2={TRACK_X1} y1={TRACK_Y} y2={TRACK_Y} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      {Array.from({ length: 7 }, (_, i) => <circle key={i} cx={tunerX(i)} cy={TRACK_Y} r={2.7} fill={CASE} />)}
      </svg>
      <div
        ref={knob} role="slider" tabIndex={locked ? -1 : 0} aria-label="Spectrum tuner" aria-valuemin={1} aria-valuemax={7} aria-valuenow={at + 1}
        aria-valuetext={`Setting ${at + 1} of 7`} aria-disabled={locked || undefined} onKeyDown={keys} data-tuner="1"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="nodrag absolute top-[31px] h-11 w-11 -translate-x-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        style={{ left: `${(tunerX(at) / W) * 100}%`, cursor: locked ? 'default' : 'grab', transition: reduced ? undefined : 'left 300ms ease' }}
      >
        <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1F6397] bg-white" />
        <svg viewBox="-16 -16 32 32" className="absolute inset-0 m-auto h-8 w-8" aria-hidden="true"><path d="M-5 -5V5M0 -5V5M5 -5V5" stroke={CASE} strokeWidth={1.5} strokeLinecap="round" /></svg>
      </div>
      <span className="absolute bottom-0 left-0 w-full text-center text-[12px] font-bold text-ss-slate">spectrum tuner</span>
    </div>
  )
}

function Radio({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(130 172)">
    <rect x={-47} y={-24} width={94} height={58} rx={7} fill={CASE} stroke={DARK} strokeWidth={1.5} />
    <path d="M-30 -25L20 -49" stroke={DARK} strokeWidth={2} strokeLinecap="round" /><circle cx={20} cy={-49} r={2.5} fill={DARK} />
    <circle cx={-19} cy={4} r={20} fill={DARK} /><circle cx={-19} cy={4} r={14} fill="none" stroke={METAL} strokeWidth={1.4} /><circle cx={-19} cy={4} r={7} fill="none" stroke={METAL} strokeWidth={1.2} />
    <rect x={9} y={-13} width={27} height={14} rx={2} fill={on ? '#D6EEF2' : DARK} stroke={DARK} strokeWidth={1} />
    <path d="M13 -4L17 -9L21 -7L25 -12L31 -6" fill="none" stroke={on ? BLUE_DARK : CASE} strokeWidth={1.4} />
    <circle cx={16} cy={15} r={5} fill={METAL} stroke={DARK} strokeWidth={1} /><circle cx={30} cy={15} r={5} fill={METAL} stroke={DARK} strokeWidth={1} />
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>radio receiver</text>
    {on && <g fill="none" stroke={BLUE_DARK} strokeWidth={2} strokeLinecap="round" style={ease(reduced)}><path d="M55 -12Q66 1 55 14" /><path d="M61 -19Q78 1 61 21" /></g>}
  </g>
}

function Oven({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 168)">
    <rect x={-66} y={-36} width={132} height={72} rx={7} fill={METAL} stroke={DARK} strokeWidth={1.5} />
    <rect x={-57} y={-27} width={84} height={53} rx={4} fill={DARK} />
    <rect x={-51} y={-21} width={72} height={41} rx={2} fill={on ? '#F5E4C9' : '#536171'} style={ease(reduced)} />
    <ellipse cx={-15} cy={12} rx={25} ry={5} fill="#E8EDF1" stroke={CASE} strokeWidth={1} />
    <path d="M-33 5Q-15 -9 3 5V11H-33Z" fill={on ? '#D99B62' : '#9CA8B4'} style={ease(reduced)} />
    <rect x={34} y={-27} width={23} height={13} rx={2} fill={DARK} /><circle cx={45} cy={1} r={7} fill={CASE} stroke={DARK} strokeWidth={1} /><circle cx={45} cy={19} r={4} fill={CASE} />
    {on && <g fill="none" stroke={WARM} strokeWidth={1.7} strokeLinecap="round" style={ease(reduced)}><path d="M-30 -3Q-35 -10 -30 -16" /><path d="M-15 -5Q-20 -12 -15 -19" /><path d="M0 -3Q-5 -10 0 -16" /></g>}
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>microwave oven</text>
  </g>
}

function Television({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 168)">
    <rect x={-63} y={-40} width={110} height={66} rx={5} fill={DARK} />
    <rect x={-57} y={-34} width={98} height={52} rx={2} fill={on ? '#BFDDE5' : '#4B5967'} style={ease(reduced)} />
    {on && <g style={ease(reduced)}><path d="M-55 16L-35 -8L-20 2L-3 -22L18 16Z" fill="#8AA89A" /><circle cx={20} cy={-19} r={8} fill="#F2D28B" /><path d="M-55 16H40V18H-55Z" fill="#6F887C" /></g>}
    <path d="M-20 26V33M-39 34H-2" stroke={DARK} strokeWidth={4} strokeLinecap="round" />
    <g transform="translate(61 8) rotate(-12)"><rect x={-8} y={-25} width={16} height={47} rx={5} fill={CASE} stroke={DARK} strokeWidth={1.2} /><circle cy={-17} r={2.5} fill={DARK} /><circle cy={-7} r={2} fill={METAL} /><circle cy={1} r={2} fill={METAL} /><path d="M-4 11H4" stroke={METAL} strokeWidth={2} /></g>
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>television and remote</text>
  </g>
}

function Camera({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 169)">
    <path d="M-38 -25L-29 -37H1L10 -25" fill={CASE} stroke={DARK} strokeWidth={1.5} />
    <rect x={-56} y={-26} width={112} height={66} rx={8} fill={CASE} stroke={DARK} strokeWidth={1.5} />
    <rect x={-46} y={-17} width={42} height={33} rx={3} fill={on ? '#C7E0E5' : DARK} style={ease(reduced)} />
    {on && <g style={ease(reduced)}><path d="M-44 14L-34 1L-25 8L-13 -8L-6 14Z" fill={GREEN} /><circle cx={-15} cy={-9} r={5} fill="#E8C985" /></g>}
    <circle cx={24} cy={6} r={25} fill={DARK} /><circle cx={24} cy={6} r={18} fill="#8395A5" stroke={METAL} strokeWidth={2} /><circle cx={24} cy={6} r={10} fill="#324B5E" /><circle cx={19} cy={1} r={3} fill="#A9C5D2" />
    <rect x={30} y={-21} width={16} height={5} rx={2} fill={METAL} /><circle cx={-43} cy={28} r={3} fill={METAL} />
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>camera</text>
  </g>
}

function Banknote({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 170)">
    <path d="M-62 31H63L55 40H-55Z" fill={CASE} />
    <rect x={-67} y={-31} width={134} height={62} rx={5} fill="#DCE5D6" stroke="#6F8774" strokeWidth={1.4} />
    <rect x={-60} y={-24} width={120} height={48} rx={3} fill="none" stroke="#8EA28E" strokeWidth={1} />
    <ellipse cx={-22} cy={0} rx={18} ry={22} fill="#C0D0BD" /><circle cx={-22} cy={-5} r={7} fill="#91A891" /><path d="M-35 17Q-33 4 -22 4Q-11 4 -9 17" fill="#91A891" />
    <path d="M8 -15H48M8 -8H42M8 13H48M8 19H37" stroke="#8EA28E" strokeWidth={2} strokeLinecap="round" />
    <g style={ease(reduced)} opacity={on ? 1 : 0.12}><circle cx={28} cy={2} r={10} fill="none" stroke={VIOLET} strokeWidth={2.5} /><path d="M28 -5L31 0L36 2L31 5L28 10L25 5L20 2L25 0Z" fill={VIOLET} /></g>
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>banknote checker</text>
  </g>
}

function Xray({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 166)">
    <rect x={-47} y={-44} width={94} height={84} rx={6} fill={DARK} stroke={CASE} strokeWidth={2} />
    <rect x={-40} y={-37} width={80} height={70} rx={2} fill={on ? '#315266' : '#526171'} style={ease(reduced)} />
    <g fill="none" stroke={on ? BONE : '#71808D'} strokeWidth={6} strokeLinecap="round" style={ease(reduced)}>
      <path d="M-16 -28L-9 23M16 -28L9 23" /><path d="M-16 -27Q-31 -20 -29 -5M-14 -15Q-27 -8 -23 5M16 -27Q31 -20 29 -5M14 -15Q27 -8 23 5" strokeWidth={3.5} />
      <path d="M-18 -28Q0 -36 18 -28M-9 23Q0 29 9 23" strokeWidth={4} />
    </g>
    <path d="M-12 40V43M12 40V43M-28 44H28" stroke={DARK} strokeWidth={3} strokeLinecap="round" />
    <text x={0} y={57} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>X-ray screen</text>
  </g>
}

function Steriliser({ on, reduced }: { on: boolean; reduced: boolean }) {
  return <g transform="translate(180 167)">
    <path d="M-55 -38H55L62 36H-62Z" fill={PAPER} stroke={CASE} strokeWidth={1.5} />
    <path d="M-52 -30H52M-54 -24H54" stroke={EDGE} strokeWidth={2} />
    <g fill="none" stroke={DARK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-15 21L17 -14M-15 -14L17 21" /><rect x={-26} y={-19} width={15} height={11} rx={2} transform="rotate(-35 -18 -14)" /><rect x={10} y={10} width={15} height={11} rx={2} transform="rotate(-35 17 15)" />
      <path d="M-18 15L-24 21M-21 11L-29 14M18 -15L24 -21M21 -11L29 -14" />
    </g>
    <circle cx={36} cy={23} r={9} fill={on ? GREEN : '#E5E9E3'} stroke={on ? '#476F56' : CASE} strokeWidth={1.4} style={ease(reduced)} />
    <path d="M32 23L35 26L41 19" fill="none" stroke={on ? '#FFFFFF' : '#AAB4B8'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    <text x={0} y={49} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>sterilisation pouch</text>
  </g>
}

function Receiver({ region, reduced, on }: { region: Region; reduced: boolean; on: boolean }) {
  if (region.id === 'radio') return <Radio on={on} reduced={reduced} />
  if (region.id === 'microwave') return <Oven on={on} reduced={reduced} />
  if (region.id === 'infrared') return <Television on={on} reduced={reduced} />
  if (region.id === 'visible') return <Camera on={on} reduced={reduced} />
  if (region.id === 'ultraviolet') return <Banknote on={on} reduced={reduced} />
  if (region.id === 'xray') return <Xray on={on} reduced={reduced} />
  return <Steriliser on={on} reduced={reduced} />
}

/** In a use task the same appliance stays on the bench; only its response changes. */
function useSignal(target: Region): string {
  return `No response from the ${target.receiver.toLowerCase()}`
}

function ResultNote({ text }: { text: string }) {
  return <p className="rounded-lg border border-ss-line bg-ss-panel px-2 py-1 text-center text-[12px] font-bold text-ss-slate">{text}</p>
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export function EmSpectrumView({ config, state, setState, marked, reduced, locked }: Props) {
  const rawAt = madeAt(state)
  const [preview, setPreview] = useState<number | null>(null)
  const at = rawAt >= 0 ? rawAt : 0
  const region = regionAt(at)
  const target = targetRegion(config)
  const good = marked === 'right' || marked === 'shown'
  const named = marked !== 'idle'
  const current = config.task === 'use' || marked === 'shown' ? target : region
  const goal = config.task === 'region' ? `Find ${target.name}` : target.goal[0].toUpperCase() + target.goal.slice(1)
  const eventOn = config.task === 'region' || region.id === target.id
  const setAt = (next: number) => {
    if (locked) return
    const n = Math.max(0, Math.min(6, Math.round(next)))
    setState({ at: n })
    setPreview(n)
  }
  useEffect(() => {
    if (preview === null || reduced) return
    const timer = setTimeout(() => setPreview(null), 500)
    return () => clearTimeout(timer)
  }, [preview, at, reduced])
  const shownAt = preview !== null && !reduced ? preview : at
  const result = good
    ? `Yes — ${target.name}.`
    : marked === 'wrong'
      ? `You tuned to ${region.name}.`
      : ''
  const explained = marked === 'wrong' ? region : target
  const explain = named
    ? `c = fλ = 3.0 × 10⁸ m/s. Also: ${explained.otherUses}. Hazard: ${explained.hazard}.`
    : ''
  const longExplanation = explain.length > 100
  const describe = `A wave crosses a vacuum monitor above a ${target.receiver.toLowerCase()}. The tuner is at setting ${at + 1} of 7, with wavelength ${wavelengthText(region)}, frequency ${frequencyText(region)}, and vacuum speed 3.0 times 10 to the 8 metres per second.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5 [&:has([role=slider]:focus-visible)_.em-kbd]:block">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[12px] font-bold text-ss-slate">Your goal</span>
        <span className="text-right text-[13px] font-extrabold leading-snug text-ss-ink">{goal}</span>
      </div>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} 244`} role="img" aria-label={describe} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={242.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
            <WaveMonitor at={shownAt} reduced={reduced} />
            <Receiver region={current} reduced={reduced} on={marked === 'shown' || eventOn} />
          </svg>
          <Tuner at={at} setAt={setAt} locked={locked} reduced={reduced} />
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Slide the tuner: watch the wave and receiver change.</figcaption>
      </figure>

      <div className="grid grid-cols-2 gap-x-5 gap-y-1 border-t border-ss-line pt-1.5" data-readouts="1">
        <span className="text-[12px] font-bold text-ss-slate">Tune the spectrum</span>
        <span className="flex items-center justify-end gap-1">
          <button type="button" aria-label="Tune towards longer waves" disabled={locked || at <= 0} onClick={() => setAt(at - 1)} className={STEP}>−</button>
          <span className="min-w-[38px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{at + 1} / 7</span>
          <button type="button" aria-label="Tune towards shorter waves" disabled={locked || at >= 6} onClick={() => setAt(at + 1)} className={STEP}>+</button>
        </span>
        <p className="flex items-baseline justify-between gap-1"><span className="text-[12px] font-bold text-ss-slate">Wavelength</span><span className="whitespace-nowrap text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{wavelengthText(region)}</span></p>
        <p className="flex items-baseline justify-between gap-1"><span className="text-[12px] font-bold text-ss-slate">Frequency</span><span className="whitespace-nowrap text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{frequencyText(region)}</span></p>
      </div>
      {!named && <ResultNote text={`Speed in vacuum: 3.0 × 10⁸ m/s — unchanged`} />}
      {config.task === 'use' && !named && <ResultNote text={eventOn ? target.event : useSignal(target)} />}
      <p className="em-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys tune one stop. Home and End go to the ends.</p>
      <span className="sr-only" aria-live="polite">{`Setting ${at + 1} of 7. Wavelength ${wavelengthText(region)}; frequency ${frequencyText(region)}. ${config.task === 'use' ? region.event : ''}`}</span>
      {named && (
        <div className={`rounded-xl border-2 border-ss-line bg-ss-panel px-3 ${longExplanation ? 'py-1' : 'py-2'}`} aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{result}</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{explain}</p>
        </div>
      )}
    </div>
  )
}

