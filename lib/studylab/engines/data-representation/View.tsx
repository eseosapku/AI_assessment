'use client'
import { useRef, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { DataConfig, DataState } from './config'
import {
  aliasOf, charOf, colourCount, dataRepresentationEngine, dotTime, groupsOf, hexOf, lit, madeText, noteAt, pattern, placeValue, rangeOf, rebuiltAt, sizeOf, storedOf, switchCount, valueOf, working,
} from './config'

type Props = SceneViewProps<DataConfig, DataState>

// A bank of switches, a picture and a wave are not a dark subject: a quiet plate, as network-sim's and measure-shape's are,
// with real parts on it. The plate keeps its own colours in both themes, so each part keeps its contrast against it.
// No gradients or shadows. View.tsx reads no constant from config.ts at load time (they import each other), so the
// sizes below are literals, and the test holds them to the config.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const ACCENT = '#2563EB'
const FONT = 'system-ui, sans-serif'
// A DIP switch: a dark block, a black slot and a white slider.
const BODY = '#334155'
const SLOT = '#0B1220'
const SLIDER = '#F1F5F9'
const SLIDER_EDGE = '#94A3B8'
const HALO = '#CBD5E1'
const HOLLOW = '#94A3B8'

export const W = 360
export const PIC_W = 22
export const PIC_H = 12
export const CELL = 7
const f1 = (n: number) => n.toFixed(1)
const group = (n: number) => n.toLocaleString('en-US')

// ---------------------------------------------------------------------------
// Controls

/** The stepper row of atom's: a 12 px label, then a 28 px button, the value, and the other button. */
function Stepper({ label, noun, value, min, max, locked, onSet }: { label: string; noun: string; value: number; min: number; max: number; locked: boolean; onSet(v: number): void }) {
  const set = (v: number) => onSet(Math.max(min, Math.min(max, v)))
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they step the value.
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    set(e.key === 'Home' ? min : e.key === 'End' ? max : value + by)
  }
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  const id = `dr-${noun}`
  return (
    <div className="flex items-center justify-between gap-1.5 [&:has(:focus-visible)_.dr-kbd]:inline">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={`Take away a ${noun}`} className={button} disabled={locked || value <= min} onClick={() => set(value - 1)}>−</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
          aria-valuetext={`${value} ${noun}${value === 1 ? '' : 's'}`} aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[36px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{value}</span>
        <button type="button" tabIndex={-1} aria-label={`Add a ${noun}`} className={button} disabled={locked || value >= max} onClick={() => set(value + 1)}>+</button>
      </span>
    </div>
  )
}

function Readout({ label, children, note }: { label: string; children: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">{label}</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{children}</span>
      </p>
      {note && <p className="text-right text-[12px] font-semibold tabular-nums text-ss-slate">{note}</p>}
    </div>
  )
}

function Said({ marked, config, state }: { marked: Props['marked']; config: DataConfig; state: DataState }) {
  if (marked === 'idle') return null
  const said = marked === 'right' || marked === 'shown' ? working(config, state) : madeText(config, state)
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

function Swatch({ kind }: { kind: 'note' | 'dot' | 'rebuilt' | 'used' | 'spare' }) {
  return (
    <svg viewBox="0 0 18 10" className="h-2.5 w-[18px] shrink-0" aria-hidden="true">
      {kind === 'note' && <line x1={1} x2={17} y1={5} y2={5} stroke={HALO} strokeWidth={6} strokeLinecap="round" />}
      {kind === 'rebuilt' && <line x1={1} x2={17} y1={5} y2={5} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />}
      {kind === 'dot' && <circle cx={9} cy={5} r={3.6} fill={INK} stroke="#F8FAFC" strokeWidth={1.4} />}
      {kind === 'used' && <rect x={3} y={0.75} width={12} height={8.5} rx={1.5} fill="#C2456B" />}
      {kind === 'spare' && <rect x={3} y={0.75} width={12} height={8.5} rx={1.5} fill="#FFFFFF" stroke={HOLLOW} strokeWidth={1.4} />}
    </svg>
  )
}
const Named = ({ kind, children }: { kind: Parameters<typeof Swatch>[0]['kind']; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

// ---------------------------------------------------------------------------
// The switch bank

/** Where each switch stands on the plate: blocks of up to four, counted from the right. */
function bankOf(n: number) {
  const pitch = n === 4 ? 52 : 36
  const groups = groupsOf(n)
  const widths = groups.map((g) => g * pitch + 16)
  const total = widths.reduce((a, b) => a + b, 0) + 16 * (groups.length - 1)
  let x = (W - total) / 2
  let index = 0
  const blocks = groups.map((g, b) => {
    const at = x
    x += widths[b] + 16
    const first = index
    index += g
    return { x: at, w: widths[b], g, first }
  })
  const switches = blocks.flatMap((bl) => Array.from({ length: bl.g }, (_, j) => ({ i: bl.first + j, cx: bl.x + 8 + pitch * (j + 0.5) })))
  return { pitch, blocks, switches }
}

function SwitchBank({ config, v, setV, locked, reduced, marked }: { config: DataConfig; v: number; setV(v: number): void; locked: boolean; reduced: boolean; marked: Props['marked'] }) {
  const n = switchCount(config)
  const bank = bankOf(n)
  const p = pattern(v, n)
  const hex = config.task === 'bits' && config.form === 'hex'
  const H = hex ? 196 : 146
  const rows = useRef<(HTMLButtonElement | null)[]>([])
  const flip = (i: number) => {
    if (locked) return
    setV(v ^ (1 << (n - 1 - i)))
  }
  const onKey = (i: number) => (e: KeyboardEvent) => {
    const to = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key === 'ArrowUp' || e.key === 'ArrowDown' ? i : null
    if (to === null) return
    // The board moves a selected card with the arrows; here they move along the bank, and up or down set a switch.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'ArrowUp' && p[i] === '0') flip(i)
    else if (e.key === 'ArrowDown' && p[i] === '1') flip(i)
    else rows.current[Math.max(0, Math.min(n - 1, to))]?.focus()
  }
  const ease = reduced ? undefined : { transition: 'transform 220ms ease, fill 220ms ease' }
  const finished = marked === 'right' || marked === 'shown'
  const desc = `A bank of ${n} switches worth ${bank.switches.map((s) => placeValue(n, s.i)).join(', ')}. Switches up: ${lit(v, n).join(', ') || 'none'}.`
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc} className="block h-auto w-full select-none">
        <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
        {bank.blocks.map((bl) => <rect key={bl.x} x={f1(bl.x)} y={36} width={bl.w} height={78} rx={8} fill={BODY} />)}
        {bank.switches.map(({ i, cx }) => {
          const on = p[i] === '1'
          return (
            <g key={i} data-switch={placeValue(n, i)} data-on={on ? '1' : '0'}>
              <rect x={f1(cx - 10)} y={44} width={20} height={62} rx={4} style={{ fill: on ? ACCENT : SLOT, ...ease }} />
              <g style={{ transform: `translateY(${on ? 2 : 32}px)`, ...ease }}>
                <rect x={f1(cx - 9)} y={44} width={18} height={28} rx={3} fill={SLIDER} stroke={SLIDER_EDGE} strokeWidth={1} />
                <path d={`M ${f1(cx - 5)} 55 H ${f1(cx + 5)} M ${f1(cx - 5)} 59 H ${f1(cx + 5)} M ${f1(cx - 5)} 63 H ${f1(cx + 5)}`} stroke={SLIDER_EDGE} strokeWidth={1.2} strokeLinecap="round" />
              </g>
              <text x={f1(cx)} y={26} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={700} fill={on ? ACCENT : SOFT} className="tabular-nums">{placeValue(n, i)}</text>
              <text x={f1(cx)} y={136} textAnchor="middle" fontFamily={FONT} fontSize={15} fontWeight={800} fill={on ? INK : SOFT} className="tabular-nums">{p[i]}</text>
            </g>
          )
        })}
        {hex && bank.blocks.map((bl) => {
          const digit = hexOf(parseInt(p.slice(bl.first, bl.first + bl.g), 2))
          return (
            <g key={bl.x} data-hex={digit}>
              <path d={`M ${f1(bl.x + 10)} 146 V 152 H ${f1(bl.x + bl.w - 10)} V 146`} fill="none" stroke={HOLLOW} strokeWidth={1.5} strokeLinejoin="round" />
              <rect x={f1(bl.x + bl.w / 2 - 22)} y={156} width={44} height={32} rx={8} fill="#FFFFFF" stroke={PLATE_EDGE} strokeWidth={1.5} />
              <text x={f1(bl.x + bl.w / 2)} y={180} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={800} fill={INK}>{digit}</text>
            </g>
          )
        })}
      </svg>
      {!finished && bank.switches.map(({ i, cx }) => (
        <button
          key={i} type="button" role="switch" aria-checked={p[i] === '1'} aria-label={`Switch worth ${placeValue(n, i)}`} disabled={locked}
          ref={(el) => { rows.current[i] = el }} onClick={() => flip(i)} onKeyDown={onKey(i)}
          className="nodrag absolute touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          style={{ left: `${(cx / W) * 100}%`, top: `${(75 / H) * 100}%`, width: `${(bank.pitch / W) * 100}%`, height: `${(96 / H) * 100}%`, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: locked ? 'default' : 'pointer' }}
        />
      ))}
    </div>
  )
}

function BitsReadout({ config, v }: { config: Extract<DataConfig, { task: 'bits' }>; v: number }) {
  const n = switchCount(config)
  const parts = lit(v, n)
  const sum = parts.length ? parts.join(' + ') : 'No switch is up'
  if (config.form === 'hex') {
    const p = pattern(v, n)
    const digits = groupsOf(n).map((g, b, all) => hexOf(parseInt(p.slice(all.slice(0, b).reduce((a, c) => a + c, 0), all.slice(0, b + 1).reduce((a, c) => a + c, 0)), 2))).join('')
    return <Readout label="Hex" note={`${v} in decimal`}>{digits}</Readout>
  }
  if (config.form === 'letter') {
    const ch = charOf(v)
    return (
      <div className="flex flex-col gap-1.5">
        <Readout label="Code" note={sum}>{v}</Readout>
        <p className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Character</span>
          <span data-char={ch ?? ''} className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[20px] font-extrabold text-ss-ink">{ch ?? '–'}</span>
        </p>
      </div>
    )
  }
  return <Readout label="Total" note={sum}>{v}</Readout>
}

// ---------------------------------------------------------------------------
// The picture

function Picture({ x, y, codes, palette, reduced }: { x: number; y: number; codes: number[]; palette: string[]; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'fill 400ms ease' }
  return (
    <g transform={`translate(${x} ${y})`} shapeRendering="crispEdges">
      {codes.map((c, k) => <rect key={k} x={(k % PIC_W) * CELL} y={Math.floor(k / PIC_W) * CELL} width={CELL + 0.4} height={CELL + 0.4} style={{ fill: palette[c], ...ease }} />)}
    </g>
  )
}

function DepthDrawing({ colours, bits, reduced }: { colours: number; bits: number; reduced: boolean }) {
  const original = storedOf(colours, 6)
  const stored = storedOf(colours, bits)
  // The original is the picture as it is, one palette entry to a colour, so it never changes with the depth.
  const slots = 2 ** bits
  const slotW = (PIC_W * CELL) / slots
  const left = 14
  const right = 192
  return (
    <svg viewBox={`0 0 ${W} 176`} role="img" aria-label={`A small picture of a sunset over hills, twice: the original, and the picture as stored with ${bits} ${bits === 1 ? 'bit' : 'bits'} per pixel, which has ${slots} codes in its palette and ${colourCount(colours, bits)} colours showing.`} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W - 1.5} height={174.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <g fontFamily={FONT} fontSize={13} fontWeight={700} fill={SOFT} aria-hidden="true">
        <text x={left} y={26}>Original</text>
        <text x={right} y={26}>Stored</text>
        <text x={right} y={162}>Palette</text>
      </g>
      <g data-picture="original"><Picture x={left} y={36} codes={original.codes} palette={original.palette} reduced={reduced} /></g>
      <rect x={left - 0.75} y={35.25} width={PIC_W * CELL + 1.5} height={PIC_H * CELL + 1.5} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
      <path d="M 173 72 L 180 78 L 173 84" fill="none" stroke={SOFT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <g data-picture="stored"><Picture x={right} y={36} codes={stored.codes} palette={stored.palette} reduced={reduced} /></g>
      <rect x={right - 0.75} y={35.25} width={PIC_W * CELL + 1.5} height={PIC_H * CELL + 1.5} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
      <g data-palette={slots}>
        {stored.used.map((used, j) => (
          <rect
            key={j} x={f1(right + j * slotW + 0.5)} y={128} width={f1(Math.max(1, slotW - 1))} height={20} rx={slots <= 16 ? 2 : 0.5}
            data-slot={used ? 'used' : 'spare'} style={{ fill: used ? stored.palette[j] : '#FFFFFF', stroke: used ? 'none' : HOLLOW, strokeWidth: 1, ...(reduced ? undefined : { transition: 'fill 400ms ease' }) }}
          />
        ))}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// The wave

const X0 = 18
const X1 = 342
const CY = 95
const AMP = 62
const xOf = (t: number) => X0 + (X1 - X0) * t
const yOf = (v: number) => CY - AMP * v
const trace = (fn: (t: number) => number) => {
  let d = ''
  for (let i = 0; i <= 240; i++) d += `${i === 0 ? 'M' : 'L'} ${f1(xOf(i / 240))} ${f1(yOf(fn(i / 240)))} `
  return d
}

function WaveDrawing({ cycles, samples }: { cycles: number; samples: number }) {
  const alias = aliasOf(cycles, samples)
  return (
    <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={`A wave in a box, measured at ${samples} points, with a second wave rebuilt from only those points. The rebuilt wave has ${Math.abs(alias)} ${Math.abs(alias) === 1 ? 'cycle' : 'cycles'}.`} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W - 1.5} height={188.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <line x1={X0} x2={X1} y1={CY} y2={CY} stroke={PLATE_EDGE} strokeWidth={1.5} strokeDasharray="3 5" />
      <path d={trace((t) => noteAt(cycles, t))} data-wave="note" fill="none" stroke={HALO} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={trace((t) => rebuiltAt(cycles, samples, t))} data-wave="rebuilt" fill="none" stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: samples }, (_, k) => {
        const t = dotTime(k, samples)
        return (
          <g key={k} data-dot={k}>
            <line x1={f1(xOf(t))} x2={f1(xOf(t))} y1={CY} y2={f1(yOf(noteAt(cycles, t)))} stroke={INK} strokeWidth={1.3} />
            <circle cx={f1(xOf(t))} cy={f1(yOf(noteAt(cycles, t)))} r={3.8} fill={INK} />
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------

export function DataRepresentationView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? dataRepresentationEngine.solve(config) : state
  const v = valueOf(config, now)
  const [lo, hi] = rangeOf(config)
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const setV = (next: number) => { if (!frozen) setState({ v: Math.max(lo, Math.min(hi, next)) }) }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.dr-kbd]:block">
      {config.task === 'bits' && (
        <>
          <figure className="m-0 flex w-full flex-col gap-1.5">
            <SwitchBank config={config} v={v} setV={setV} locked={frozen} reduced={reduced} marked={marked} />
            <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
              {config.form === 'hex' ? 'Up is 1. Each block of four switches makes one hex digit.' : config.form === 'letter' ? 'Up is 1. Seven switches make a code, and each code is a character.' : 'Up is 1. Each switch is worth double the one on its right.'}
            </figcaption>
          </figure>
          <BitsReadout config={config} v={v} />
          <p className="dr-kbd hidden text-[12px] font-semibold text-ss-slate">Left and right move between switches. Up and down set one. Space flips it.</p>
          <span className="sr-only" aria-live="polite">{`Switches up: ${lit(v, switchCount(config)).join(', ') || 'none'}.`}</span>
        </>
      )}
      {config.task === 'depth' && (
        <>
          <figure className="m-0 flex w-full flex-col gap-1.5">
            <DepthDrawing colours={config.colours} bits={v} reduced={reduced} />
            <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
              <Named kind="used">Colour in use</Named>
              <Named kind="spare">Spare code</Named>
            </figcaption>
          </figure>
          <div className="flex flex-col gap-1.5">
            <Stepper label="Bits per pixel" noun="bit" value={v} min={lo} max={hi} locked={frozen} onSet={setV} />
            <div className="border-t border-ss-line pt-1.5">
              <Readout label="File size" note={`${PIC_W * PIC_H} pixels × ${v} ${v === 1 ? 'bit' : 'bits'}`}>{`${group(sizeOf(v))} bits`}</Readout>
            </div>
          </div>
          <p className="dr-kbd hidden text-[12px] font-semibold text-ss-slate">Up and down change the bits per pixel.</p>
          <span className="sr-only" aria-live="polite">{`${v} ${v === 1 ? 'bit' : 'bits'} per pixel: ${2 ** v} codes, and ${colourCount(config.colours, v)} colours in the stored picture.`}</span>
        </>
      )}
      {config.task === 'sample' && (
        <>
          <figure className="m-0 flex w-full flex-col gap-1.5">
            <WaveDrawing cycles={config.cycles} samples={v} />
            <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
              <Named kind="note">Real note</Named>
              <Named kind="dot">Sample</Named>
              <Named kind="rebuilt">Rebuilt from the samples</Named>
            </figcaption>
          </figure>
          <Stepper label="Samples" noun="sample" value={v} min={lo} max={hi} locked={frozen} onSet={setV} />
          <p className="dr-kbd hidden text-[12px] font-semibold text-ss-slate">Up and down change the number of samples.</p>
          <span className="sr-only" aria-live="polite">{`${v} samples. The rebuilt wave has ${Math.abs(aliasOf(config.cycles, v))} cycles.`}</span>
        </>
      )}
      <Said marked={marked} config={config} state={now} />
    </div>
  )
}
