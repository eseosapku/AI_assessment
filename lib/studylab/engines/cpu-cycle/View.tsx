'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CpuConfig, CpuState, Machine, PartId, TokenKind, Transfer } from './config'
import { contentText, cpuCycleEngine, expectedPart, frameAt, instructionText, madeText, PART_NAMES, working } from './config'

type Props = SceneViewProps<CpuConfig, CpuState>

// A light hardware plate in both themes: real material colours, hairline tracks, no gradients or glows.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#243447'
const SOFT = '#526173'
const PCB = '#DCE7DF'
const PCB_EDGE = '#71877B'
const TRACK = '#A9BDB1'
const CHIP = '#354352'
const CHIP_EDGE = '#17232F'
const CHIP_TOP = '#465565'
const PIN = '#A9B4BF'
const RAM = '#F4F7F8'
const BLUE = '#2879B9'
const BLUE_PALE = '#DCECF8'
const OCHRE = '#A96616'
const OCHRE_PALE = '#F7E8CB'
const VIOLET = '#76558F'
const VIOLET_PALE = '#EEE6F3'
const WHITE = '#FFFFFF'
const GOLD = '#C79538'

const W = 360
const H = 306
const RAM_X = [48, 111, 174, 237, 300]
const RAM_Y = 58
// The CPU in three columns under the RAM stick; every part's full name sits under it.
const SLOT: Record<Exclude<PartId, 'RAM'>, { x: number; y: number }> = {
  PC: { x: 70, y: 125 }, MAR: { x: 180, y: 125 }, MDR: { x: 290, y: 125 },
  CIR: { x: 70, y: 196 }, CU: { x: 180, y: 196 }, ALU: { x: 290, y: 196 },
  ACC: { x: 290, y: 268 },
}
const NAME_LINES: Record<Exclude<PartId, 'RAM'>, string[]> = {
  PC: ['program counter'], MAR: ['memory address', 'register'], MDR: ['memory data', 'register'],
  CIR: ['current instruction', 'register'], ACC: ['accumulator'], CU: ['control unit'], ALU: ['arithmetic logic unit'],
}

function valueOf(m: Machine, part: PartId): string {
  if (part === 'PC') return String(m.pc)
  if (part === 'MAR') return m.mar === null ? '—' : String(m.mar)
  if (part === 'MDR') return m.mdr === null ? '—' : String(m.mdr)
  if (part === 'CIR') return m.cir === null ? '—' : instructionText(m.cir)
  if (part === 'ACC') return String(m.acc)
  return ''
}

function tokenValue(config: CpuConfig, m: Machine, t: Transfer): string {
  if (t.token === 'control') return Math.floor((m.ram[m.pc] ?? 0) / 100) === 3 && t.phase === 'Execute' ? 'WRITE' : 'READ'
  if (t.from === 'PC') return String(m.pc)
  if (t.from === 'MAR') return String(m.mar)
  if (t.from === 'CU' && t.to === 'MAR') return String((m.ram[m.pc] ?? 0) % 100)
  if (t.from === 'RAM') return m.mar === null ? '' : t.token === 'instruction' ? String(m.ram[m.mar] ?? 0) : contentText(config, m.mar, m.ram[m.mar] ?? 0)
  if (t.from === 'MDR') return m.mdr === null ? '' : String(m.mdr)
  if (t.from === 'CIR') return m.cir === null ? '' : instructionText(m.cir)
  if (t.from === 'ACC') return String(m.acc)
  if (t.from === 'ALU') return String(m.acc + (m.mdr ?? 0))
  return ''
}

/** Each transfer travels along the real bus or link between the two parts. */
function transferPath(t: Transfer): string {
  const key = `${t.from}>${t.to}`
  const paths: Record<string, string> = {
    'PC>MAR': 'M 70 125 L 180 125',
    'MAR>RAM': 'M 180 125 L 160 104 L 160 86 L 111 64',
    'CU>RAM': 'M 180 196 L 125 196 L 125 86 L 48 64',
    'RAM>MDR': 'M 111 64 L 300 86 L 300 104 L 290 125',
    'MDR>CIR': 'M 290 125 C 240 162, 120 162, 70 196',
    'CIR>CU': 'M 70 196 L 180 196',
    'CU>MAR': 'M 180 196 L 180 125',
    'MDR>ALU': 'M 290 125 L 290 196',
    'ALU>ACC': 'M 290 196 L 290 268',
    'ACC>MDR': 'M 290 268 C 342 236, 342 158, 290 125',
  }
  if (paths[key]) return paths[key]
  const at = (p: PartId) => (p === 'RAM' ? { x: RAM_X[1], y: RAM_Y } : SLOT[p])
  return `M ${at(t.from).x} ${at(t.from).y} L ${at(t.to).x} ${at(t.to).y}`
}

function colour(kind: TokenKind) {
  return kind === 'address' ? { ink: OCHRE, pale: OCHRE_PALE } : kind === 'control' ? { ink: VIOLET, pale: VIOLET_PALE } : { ink: BLUE, pale: BLUE_PALE }
}

function SignalToken({ config, machine, transfer, reduced }: { config: CpuConfig; machine: Machine; transfer: Transfer; reduced: boolean }) {
  const c = colour(transfer.token)
  const path = transferPath(transfer)
  const text = tokenValue(config, machine, transfer)
  const wide = Math.max(32, text.length * 7 + 14)
  return (
    // Taps pass through the token, and it fades once it lands so the value it carried shows in the part.
    <g data-token={transfer.token} aria-hidden="true" pointerEvents="none">
      <rect x={-wide / 2} y={-10} width={wide} height={20} rx={6} fill={c.pale} stroke={c.ink} strokeWidth={1.5} />
      <text y={4} textAnchor="middle" fontSize={12} fontWeight={800} fill={c.ink}>{text}</text>
      <animateMotion dur={reduced ? '0ms' : '850ms'} path={path} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0 0.2 1" />
      <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.75;1" dur={reduced ? '1ms' : '1300ms'} fill="freeze" />
    </g>
  )
}

function MemoryCell({ config, machine, address, disabled, onPress }: {
  config: CpuConfig; machine: Machine; address: number; disabled: boolean; onPress(): void
}) {
  const x = RAM_X[address]
  const code = machine.ram[address] ?? 0
  const current = machine.mar === address
  return (
    <g transform={`translate(${x} ${RAM_Y})`}>
      <rect x={-27} y={-19} width={54} height={38} rx={5} fill={current ? BLUE_PALE : RAM} stroke={current ? BLUE : '#A8B5BF'} strokeWidth={current ? 2 : 1.2} />
      <text x={-20} y={-5} fontSize={12} fontWeight={800} fill={SOFT}>{address}</text>
      <line x1={-20} y1={0} x2={20} y2={0} stroke={EDGE} />
      <text x={0} y={13} textAnchor="middle" fontSize={12} fontWeight={800} fill={code === 0 ? SOFT : INK}>{contentText(config, address, code)}</text>
      <foreignObject x={-29} y={-22} width={58} height={44}>
        <button type="button" data-part="RAM" data-address={address} aria-label={`Send from RAM address ${address}, holding ${contentText(config, address, code)}`} disabled={disabled} onClick={onPress}
          className="nodrag h-11 w-[58px] cursor-pointer touch-manipulation rounded-md border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default" />
      </foreignObject>
    </g>
  )
}

function Names({ id, top }: { id: Exclude<PartId, 'RAM'>; top: number }) {
  return <>{NAME_LINES[id].map((line, i) => <text key={i} x={0} y={top + i * 14} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{line}</text>)}</>
}

function Register({ id, value, disabled, onPress }: { id: 'PC' | 'MAR' | 'MDR' | 'CIR' | 'ACC'; value: string; disabled: boolean; onPress(): void }) {
  const p = SLOT[id]
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      {[-30, 0, 30].map((dx) => <g key={dx} stroke={PIN} strokeWidth={3}><line x1={dx} x2={dx} y1={-19} y2={-15} /><line x1={dx} x2={dx} y1={15} y2={19} /></g>)}
      <rect x={-52} y={-15} width={104} height={30} rx={6} fill={CHIP} stroke={CHIP_EDGE} strokeWidth={1.5} />
      <path d="M -46 -15 H 46 Q 52 -15 52 -9 V -8 H -52 V -9 Q -52 -15 -46 -15" fill={CHIP_TOP} />
      <text x={-45} y={5} fontSize={12} fontWeight={800} fill="#D9E3EB">{id}</text>
      <rect x={-14} y={-10} width={61} height={20} rx={3} fill={WHITE} stroke="#AAB6C1" />
      <text x={16.5} y={5} textAnchor="middle" fontSize={13} fontWeight={800} fill={value === '—' ? SOFT : INK}>{value}</text>
      <Names id={id} top={33} />
      <foreignObject x={-54} y={-17} width={108} height={34}>
        <button type="button" data-part={id} aria-label={`Send from ${PART_NAMES[id]}, holding ${value}`} disabled={disabled} onClick={onPress}
          className="nodrag h-[34px] w-[108px] cursor-pointer touch-manipulation rounded-md border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default" />
      </foreignObject>
    </g>
  )
}

function Unit({ id, disabled, onPress }: { id: 'CU' | 'ALU'; disabled: boolean; onPress(): void }) {
  const p = SLOT[id]
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <rect x={-52} y={-18} width={104} height={36} rx={7} fill={id === 'CU' ? VIOLET_PALE : '#E4E9ED'} stroke={id === 'CU' ? VIOLET : SOFT} strokeWidth={1.5} />
      <text x={0} y={5} textAnchor="middle" fontSize={14} fontWeight={900} fill={id === 'CU' ? VIOLET : INK}>{id}</text>
      <Names id={id} top={33} />
      <foreignObject x={-54} y={-20} width={108} height={40}>
        <button type="button" data-part={id} aria-label={`Send from ${PART_NAMES[id]}`} disabled={disabled} onClick={onPress}
          className="nodrag h-[40px] w-[108px] cursor-pointer touch-manipulation rounded-md border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default" />
      </foreignObject>
    </g>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

export function CpuCycleView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? cpuCycleEngine.solve(config) : state
  const current = frameAt(config, now)
  const m = current.frame.machine
  const t = current.frame.transfer
  const tokenMachine = current.frame.before ?? m
  const previous = useRef<CpuState>(now)
  const [wrong, setWrong] = useState<PartId | null>(null)
  const liveId = useId()
  const taps = Array.isArray(now.taps) ? now.taps : []
  const disabled = locked || marked === 'right' || marked === 'shown' || current.frame.halted

  useEffect(() => {
    if (previous.current !== now) setWrong(null)
    previous.current = now
  }, [now])

  const press = (part: PartId) => {
    if (disabled) return
    if (part !== expectedPart(config, now)) { setWrong(part); return }
    setWrong(null)
    setState({ taps: [...taps, part] })
  }
  const undo = () => { if (!disabled && taps.length) setState({ taps: taps.slice(0, -1) }) }
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
  const text = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const stage = wrong ? `${PART_NAMES[wrong]} did not send; nothing moved. Try another part.` : current.frame.stage
  const phase = current.frame.phase

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={liveId} className="block h-auto w-full select-none">
          <title id={liveId}>{`A processor and shared RAM. ${phase}. ${stage}`}</title>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          {/* RAM as a real five-cell memory stick. Program cells and data cells share it. */}
          <rect x={13} y={26} width={334} height={64} rx={10} fill={PCB} stroke={PCB_EDGE} strokeWidth={1.5} />
          <text x={180} y={18} textAnchor="middle" fontSize={13} fontWeight={900} fill={INK}>RAM: instructions and data together</text>
          {RAM_X.map((_, a) => <MemoryCell key={a} config={config} machine={m} address={a} disabled={disabled} onPress={() => press('RAM')} />)}
          {/* The three buses drop from RAM into the CPU, each named beside it. */}
          <path d="M 125 90 V 196 H 128" fill="none" stroke={VIOLET} strokeWidth={2.5} />
          <path d="M 160 90 V 106" fill="none" stroke={OCHRE} strokeWidth={3} />
          <path d="M 300 90 V 106" fill="none" stroke={BLUE} strokeWidth={3} />
          <text x={119} y={104} textAnchor="end" fontSize={12} fontWeight={700} fill={VIOLET}>control bus</text>
          <text x={166} y={104} fontSize={12} fontWeight={700} fill={OCHRE}>address bus</text>
          <text x={294} y={104} textAnchor="end" fontSize={12} fontWeight={700} fill={BLUE}>data bus</text>
          <text x={180} y={276} textAnchor="middle" fontSize={13} fontWeight={900} fill={SOFT}>CPU</text>
          <Unit id="CU" disabled={disabled} onPress={() => press('CU')} />
          <Unit id="ALU" disabled={disabled} onPress={() => press('ALU')} />
          {(['PC', 'MAR', 'MDR', 'CIR', 'ACC'] as const).map((id) => (
            <Register key={id} id={id} value={valueOf(m, id)} disabled={disabled} onPress={() => press(id)} />
          ))}
          {t && <SignalToken key={`${current.accepted}-${t.from}-${t.to}`} config={config} machine={tokenMachine} transfer={t} reduced={reduced} />}
          <rect x={18} y={256} width={104} height={24} rx={7} fill={WHITE} stroke={EDGE} />
          <text x={70} y={272} textAnchor="middle" fontSize={12} fontWeight={800} fill={phase === 'Decode' ? VIOLET : phase === 'Execute' ? OCHRE : BLUE}>{phase === 'Ready' ? 'Ready to fetch' : current.frame.halted ? 'Stopped' : phase}</text>
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">You are the control unit: choose what sends next.</figcaption>
      </figure>

      <div className="rounded-xl border border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
        <p className="text-[12px] font-bold leading-snug text-ss-slate"><span className="block text-ss-ink">{current.frame.halted ? 'Program complete' : 'Latest transfer'}</span>{stage}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Tap a register, unit or RAM cell.</span>
        <button type="button" aria-label="Undo the last transfer" disabled={disabled || taps.length === 0} onClick={undo}
          className="nodrag h-7 shrink-0 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
      </div>
      <span className="sr-only" aria-live="polite">{wrong ? `${PART_NAMES[wrong]} did not send. Nothing moved.` : ''}</span>
      <Verdict marked={marked} text={text} />
    </div>
  )
}
