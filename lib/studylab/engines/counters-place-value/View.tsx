'use client'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Blocks, CountersConfig, CountersState, Move, Place } from './config'
import {
  apply, blocksText, building, partsReady, placesOf, placeWord, readState, saidWhenRight, saidWhenWrong,
  startOf, valueOf,
} from './config'

// The blocks' own colours, one per kind, the same in both themes: each fill is
// over 3:1 against the mat in light (#F3F7F9) and dark (#22262B), so a block
// reads by its colour and its shape alike. The lines inside show its tens.
const INK: Record<Place, { fill: string; edge: string }> = {
  0: { fill: '#C2571A', edge: '#7A3608' },
  1: { fill: '#2C74C4', edge: '#123F73' },
  2: { fill: '#2A8F4F', edge: '#145230' },
}
const LINES = 'rgba(255,255,255,0.55)'
const SLOT = 'var(--ss-slate, #636D76)'

// Base-ten blocks drawn to one scale: a cube is U across, a rod ten cubes
// long, a flat ten rods wide.
const U = 7
const CUBE_STEP = 9.5
const ROD_STEP = 10
const ROD_H = 10 * U
const FLAT = 10 * U
const FAN_X = 4
const FAN_Y = 8
const PAD = 8
const FRAME_W = 4 * CUBE_STEP + U
const FRAME_H = CUBE_STEP + U
const FRAME_GAP = 8
const FRAME_ROW_GAP = 8
const GROUP_W = 9 * ROD_STEP + U
const GROUP_GAP = 6
const ROW_GAP = 10

/** The columns' widths in the mat's units: the tens get the room, as they hold the most. */
const WIDTHS: Record<number, number[]> = { 3: [112, 136, 112], 2: [212, 148] }
const HEADS = ['Hundreds', 'Tens', 'Ones'] as const

type Spot = { x: number; y: number }
/** The blocks just made or added, ringed so the learner sees where they came from. */
type Fresh = { where: 'mat' | number; place: Place; count: number }

/** How a column of ones (in ten-frames) or tens (in groups of ten rods) is laid out at a width. */
function groups(place: 1 | 2, width: number) {
  const ones = place === 2
  const w = ones ? FRAME_W : GROUP_W
  const gap = ones ? FRAME_GAP : GROUP_GAP
  return {
    ones, w, gap,
    // Two groups of ten side by side where the column has room, else one; the next row opens below.
    perRow: width >= 2 * w + gap + 8 ? 2 : 1,
    h: ones ? FRAME_H : ROD_H,
    rowGap: ones ? FRAME_ROW_GAP : ROW_GAP,
    // How wide a group holding n is: a ten-frame is always whole; rods take the room they need.
    extent: (n: number) => (n <= 0 ? 0 : ones ? FRAME_W : (Math.min(n, 10) - 1) * ROD_STEP + U),
  }
}

/**
 * Where each block of a column sits: ones in ten-frames, tens in groups of ten, hundreds in a fanned pile.
 * The first row is centred on what is in it; a second group of ten opens beside the first, and a third
 * (up to 29, three rows of ten) below it.
 */
export function spots(place: Place, count: number, width: number): Spot[] {
  if (place === 0) {
    const left = (width - (FLAT + 8 * FAN_X)) / 2
    return Array.from({ length: count }, (_, i) => ({ x: left + i * FAN_X, y: PAD + i * FAN_Y }))
  }
  const g = groups(place, width)
  const first = Math.min(count, 10 * g.perRow)
  const used = first > 10 ? g.w + g.gap + g.extent(first - 10) : g.extent(first)
  const left = (width - used) / 2
  return Array.from({ length: count }, (_, i) => {
    const group = Math.floor(i / 10)
    const k = i % 10
    const x = left + (group % g.perRow) * (g.w + g.gap) + (g.ones ? (k % 5) * CUBE_STEP : k * ROD_STEP)
    const y = PAD + Math.floor(group / g.perRow) * (g.h + g.rowGap) + (g.ones ? Math.floor(k / 5) * CUBE_STEP : 0)
    return { x, y }
  })
}

/** How tall a column's blocks stand. */
export function pileHeight(place: Place, count: number, width: number): number {
  if (place === 0) return 2 * PAD + FLAT + Math.max(0, count - 1) * FAN_Y
  const g = groups(place, width)
  const rows = Math.ceil(Math.max(1, Math.ceil(count / 10)) / g.perRow)
  return 2 * PAD + rows * g.h + (rows - 1) * g.rowGap
}

function Ring({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x - 2.5} y={y - 2.5} width={w + 5} height={h + 5} rx={3} fill="none" stroke="var(--subject)" strokeWidth={2} />
}

function Block({ place, at, fresh }: { place: Place; at: Spot; fresh: boolean }) {
  const { fill, edge } = INK[place]
  const { x, y } = at
  if (place === 2) {
    return (
      <g>
        <rect x={x} y={y} width={U} height={U} rx={1.3} fill={fill} stroke={edge} strokeWidth={0.8} />
        {fresh && <Ring x={x} y={y} w={U} h={U} />}
      </g>
    )
  }
  if (place === 1) {
    const cuts = Array.from({ length: 9 }, (_, k) => `M ${x} ${y + (k + 1) * U} h ${U}`).join(' ')
    return (
      <g>
        <rect x={x} y={y} width={U} height={ROD_H} rx={1.3} fill={fill} stroke={edge} strokeWidth={0.8} />
        <path d={cuts} stroke={LINES} strokeWidth={0.8} />
        {fresh && <Ring x={x} y={y} w={U} h={ROD_H} />}
      </g>
    )
  }
  const grid = Array.from({ length: 9 }, (_, k) => `M ${x + (k + 1) * U} ${y} v ${FLAT} M ${x} ${y + (k + 1) * U} h ${FLAT}`).join(' ')
  return (
    <g>
      <rect x={x} y={y} width={FLAT} height={FLAT} rx={1.5} fill={fill} stroke={edge} strokeWidth={1} />
      <path d={grid} stroke={LINES} strokeWidth={0.7} />
      {fresh && <Ring x={x} y={y} w={FLAT} h={FLAT} />}
    </g>
  )
}

/** One column's blocks; the ones sit in ten-frames, so a full ten shows. */
function Pile({ place, count, width, freshCount }: { place: Place; count: number; width: number; freshCount: number }) {
  const at = spots(place, count, width)
  const slots = place === 2 ? spots(2, Math.max(10, Math.ceil(count / 10) * 10), width) : []
  return (
    <>
      {slots.map((s, i) => (
        <rect key={`slot${i}`} x={s.x} y={s.y} width={U} height={U} rx={1.3} fill="none" stroke={SLOT} strokeOpacity={0.45} strokeWidth={0.8} />
      ))}
      {at.map((s, i) => <Block key={i} place={place} at={s} fresh={i >= count - freshCount} />)}
    </>
  )
}

/** A big take-away and add button pair for one column, also worked by the arrow keys. */
function PlusMinus({ place, minus, plus, can, act, locked }: {
  place: Place; minus: [Move, string]; plus: [Move, string]; can: (m: Move) => boolean; act: (m: Move) => void; locked: boolean
}) {
  const onKey = (e: KeyboardEvent) => {
    const which = ({ ArrowUp: plus, ArrowRight: plus, '+': plus, '=': plus, ArrowDown: minus, ArrowLeft: minus, '-': minus } as Record<string, [Move, string]>)[e.key]
    if (!which) return
    // The board moves a selected card with the arrows; here they add and take away.
    e.preventDefault()
    e.stopPropagation()
    act(which[0])
  }
  const button = 'nodrag flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full border-2 border-ss-line bg-ss-panel text-[24px] font-extrabold leading-none text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[color:var(--subject)] aria-disabled:opacity-40 disabled:opacity-40'
  return (
    <div className="flex gap-2 pb-1.5 pt-1" data-place={place}>
      {[minus, plus].map(([move, label], i) => (
        <button
          key={i} type="button" className={button} aria-label={label} disabled={locked}
          aria-disabled={!can(move) || undefined} onClick={() => act(move)} onKeyDown={onKey}
        >
          {i === 0 ? '−' : '+'}
        </button>
      ))}
    </div>
  )
}

/** The place-value mat: each column's name and count, its buttons, and its blocks. */
function Mat({ places, blocks, label, height, controls, fresh }: {
  places: Place[]; blocks: Blocks; label: string; height: number; controls?: (p: Place) => ReactNode; fresh: Fresh | null
}) {
  const widths = WIDTHS[places.length]
  return (
    <div role="group" aria-label={label} className="w-full overflow-hidden rounded-2xl border-2 border-ss-line bg-ss-chip">
      <div className="grid" style={{ gridTemplateColumns: widths.map((w) => `${w}fr`).join(' ') }}>
        {places.map((p, i) => (
          <div key={p} className={`flex min-w-0 flex-col items-center ${i > 0 ? 'border-l-2 border-ss-line' : ''}`}>
            <span className="pt-1.5 text-[12px] font-bold leading-4 text-ss-slate" aria-hidden="true">{HEADS[p]}</span>
            <span className="text-[24px] font-extrabold leading-[28px] tabular-nums text-ss-ink" aria-hidden="true" data-count={p}>{blocks[p]}</span>
            {controls?.(p)}
            <svg viewBox={`0 0 ${widths[i]} ${height}`} className="block w-full" aria-hidden="true">
              <Pile place={p} count={blocks[p]} width={widths[i]} freshCount={fresh?.place === p ? fresh.count : 0} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The exchanges, as buttons that say what they swap: "10 ones → 1 ten". */
function Swaps({ places, can, act, locked }: { places: Place[]; can: (m: Move) => boolean; act: (m: Move) => void; locked: boolean }) {
  const swaps: { move: Move; text: string }[] = [
    ...(places.includes(0) ? [
      { move: { kind: 'break', place: 0 } as Move, text: '1 hundred → 10 tens' },
      { move: { kind: 'bundle', place: 1 } as Move, text: '10 tens → 1 hundred' },
    ] : []),
    { move: { kind: 'break', place: 1 }, text: '1 ten → 10 ones' },
    { move: { kind: 'bundle', place: 2 }, text: '10 ones → 1 ten' },
  ]
  return (
    <div className={`grid w-full gap-1.5 ${swaps.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
      {swaps.map(({ move, text }) => (
        <button
          key={text} type="button" disabled={locked} aria-disabled={!can(move) || undefined} onClick={() => act(move)}
          aria-label={`Swap ${text.replace('→', 'for')}`}
          className="nodrag min-h-[44px] rounded-xl border-2 border-ss-line bg-ss-panel px-1.5 py-1 text-[12px] font-bold leading-tight text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[color:var(--subject)] aria-disabled:opacity-40 disabled:opacity-40"
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** A small block, for the taken-away tally. */
function Mini({ place }: { place: Place }) {
  const { fill, edge } = INK[place]
  const size = place === 0 ? [14, 14] : place === 1 ? [4, 16] : [7, 7]
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <rect x={(16 - size[0]) / 2} y={(16 - size[1]) / 2} width={size[0]} height={size[1]} rx={1} fill={fill} stroke={edge} strokeWidth={0.8} />
    </svg>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden="true">
      <path d="M 4 10.5 L 8.5 15 L 16 5.5" fill="none" stroke="var(--ss-good, #047857)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const VERBS: Record<Move['kind'], string> = {
  add: 'Added', remove: 'Took away', take: 'Took away', return: 'Put back', join: '', bundle: 'Swapped', break: 'Swapped',
}

/**
 * Base-ten blocks on a place-value mat. make and exchange: one mat, its
 * numeral live. add and subtract: the numbers are built first, then put
 * together (or taken from), and the mat shows only its blocks and counts --
 * never their total -- until it is marked.
 */
export function CountersPlaceValueView({ config, state, setState, marked, locked }: SceneViewProps<CountersConfig, CountersState>) {
  const s = readState(config, state)
  const task = config.task
  const places = placesOf(config)
  const widths = WIDTHS[places.length]
  const [status, setStatus] = useState('')
  const [echo, setEcho] = useState('')
  const [fresh, setFresh] = useState<Fresh | null>(null)
  const named = marked === 'right' || marked === 'shown'
  // The numeral the blocks make. exchange shows it throughout: it never changes, which is the point. make
  // shows it only once marked, so the learner reads the blocks rather than pressing + until it matches.
  const numeral = task.kind === 'exchange' || (task.kind === 'make' && marked !== 'idle')

  const can = (move: Move) => !locked && !('refused' in apply(config, s, move))
  const act = (move: Move) => {
    if (locked) return
    const r = apply(config, s, move)
    if ('refused' in r) {
      setStatus(r.refused)
      return
    }
    const next = readState(config, r.next)
    const row = 'row' in move && building(config, s) ? move.row ?? 0 : 'mat'
    setStatus('')
    setFresh(
      move.kind === 'add' ? { where: row, place: move.place, count: 1 }
        : move.kind === 'return' ? { where: 'mat', place: move.place, count: 1 }
        : move.kind === 'bundle' ? { where: 'mat', place: (move.place - 1) as Place, count: 1 }
        : move.kind === 'break' ? { where: 'mat', place: (move.place + 1) as Place, count: 10 }
        : null,
    )
    const shown = row === 'mat' ? next.mat : next.parts![row]
    const what = move.kind === 'join' ? (task.kind === 'add' ? 'Put together.' : 'Now take away.')
      : move.kind === 'bundle' ? `${VERBS.bundle} 10 ${placeWord(move.place, 2)} for 1 ${placeWord((move.place - 1) as Place, 1)}.`
      : move.kind === 'break' ? `${VERBS.break} 1 ${placeWord(move.place, 1)} for 10 ${placeWord((move.place + 1) as Place, 2)}.`
      : `${VERBS[move.kind]} 1 ${placeWord(move.place, 1)}.`
    // The counts only, never the number they make -- except exchange, whose number is given and never changes.
    setEcho(`${what} ${blocksText(shown)}.${task.kind === 'exchange' ? ` Your number is ${valueOf(next.mat)}.` : ''}`)
    setState(next)
  }
  const reset = () => {
    setStatus('')
    setFresh(null)
    setEcho('Back to the start.')
    setState(startOf(config))
  }

  /**
   * A mat grows with its blocks (up to three rows of ten), never reserving room it does not use. Every
   * control sits above the blocks -- the swaps over the mat, + and - in each column's head -- so a growing
   * column never moves a button from under a finger.
   */
  const grown = (b: Blocks) => Math.max(pileHeight(1, 1, widths[places.indexOf(1)]), ...places.map((p, i) => pileHeight(p, b[p], widths[i])))
  const freshAt = (where: Fresh['where']) => (fresh?.where === where ? fresh : null)

  const plusMinus = (minus: (p: Place) => [Move, string], plus: (p: Place) => [Move, string]) =>
    (p: Place) => <PlusMinus place={p} minus={minus(p)} plus={plus(p)} can={can} act={act} locked={locked} />

  let body: ReactNode
  if (task.kind === 'make' || task.kind === 'exchange') {
    body = (
      <>
        <Swaps places={places} can={can} act={act} locked={locked} />
        <Mat
          places={places} blocks={s.mat} height={grown(s.mat)} fresh={freshAt('mat')}
          label={`The mat: ${blocksText(s.mat)}`}
          controls={task.kind === 'make' ? plusMinus(
            (p) => [{ kind: 'remove', place: p }, `Take away 1 ${placeWord(p, 1)}`],
            (p) => [{ kind: 'add', place: p }, `Add 1 ${placeWord(p, 1)}`],
          ) : undefined}
        />
        {numeral && (
          <div className="flex flex-col items-center">
            <span className="text-[12px] font-bold text-ss-slate">Your number</span>
            <span className="min-w-[96px] rounded-xl border-2 border-ss-line bg-ss-panel px-4 text-center text-[34px] font-extrabold leading-[46px] tabular-nums text-ss-ink" data-numeral>
              {valueOf(s.mat)}
            </span>
          </div>
        )}
      </>
    )
  } else if (building(config, s)) {
    const [a, b] = task.numbers
    const rows = task.kind === 'add' ? [a, b] : [a]
    const ready = partsReady(config, s)
    body = (
      <>
        {rows.map((n, row) => {
          const part = s.parts![row]
          const made = valueOf(part) === n
          return (
            <div key={row} className="flex w-full flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[22px] font-extrabold leading-none tabular-nums text-ss-ink">{row === 1 ? `+ ${n}` : n}</span>
                {made && <><Tick /><span className="sr-only">Made.</span></>}
              </div>
              <Mat
                places={places} blocks={part} height={grown(part)} fresh={freshAt(row)}
                label={`${row === 0 ? 'First' : 'Second'} number, ${n}: you have ${blocksText(part)}`}
                controls={plusMinus(
                  (p) => [{ kind: 'remove', place: p, row }, `Take away 1 ${placeWord(p, 1)} from ${n}`],
                  (p) => [{ kind: 'add', place: p, row }, `Add 1 ${placeWord(p, 1)} to ${n}`],
                )}
              />
            </div>
          )
        })}
        <button
          type="button" disabled={locked} aria-disabled={!ready || undefined} onClick={() => act({ kind: 'join' })}
          className="nodrag min-h-[48px] rounded-full border-2 border-[color:var(--subject)] bg-ss-panel px-6 text-[15px] font-extrabold text-ss-ink touch-manipulation focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] aria-disabled:opacity-50"
        >
          {task.kind === 'add' ? 'Put together' : `Take away ${b}`}
        </button>
      </>
    )
  } else {
    const [a, b] = task.numbers
    const taken = s.taken ?? [0, 0, 0]
    body = (
      <>
        <p className="text-[22px] font-extrabold leading-none tabular-nums text-ss-ink">{task.kind === 'add' ? `${a} + ${b}` : `${a} − ${b}`}</p>
        <Swaps places={places} can={can} act={act} locked={locked} />
        <Mat
          places={places} blocks={s.mat} height={grown(s.mat)} fresh={freshAt('mat')}
          label={`The mat: ${blocksText(s.mat)}${task.kind === 'subtract' ? ' left' : ''}`}
          controls={task.kind === 'subtract' ? plusMinus(
            (p) => [{ kind: 'take', place: p }, `Take away 1 ${placeWord(p, 1)}`],
            (p) => [{ kind: 'return', place: p }, `Put back 1 ${placeWord(p, 1)}`],
          ) : undefined}
        />
        {task.kind === 'subtract' && (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 border-dashed border-ss-line px-3 py-1.5" aria-label={`Taken away: ${valueOf(taken)}, ${blocksText(taken)}`} role="group">
            <span className="text-[12px] font-bold text-ss-slate" aria-hidden="true">Taken away</span>
            <span className="text-[20px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{valueOf(taken)}</span>
            <span className="ml-auto flex items-center gap-3" aria-hidden="true">
              {places.map((p) => (
                <span key={p} className="flex items-center gap-1 text-[13px] font-bold tabular-nums text-ss-slate"><Mini place={p} />{taken[p]}</span>
              ))}
            </span>
          </div>
        )}
      </>
    )
  }

  const right = named ? saidWhenRight(config, s) : null
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2">
      {body}
      <p className="sr-only" aria-live="polite">{echo}</p>
      {!locked && <p aria-live="polite" className="min-h-[18px] text-center text-[13px] font-semibold leading-snug text-ss-slate">{status}</p>}
      {right && (
        <div className="flex flex-col items-center gap-0.5 text-center" aria-live="polite">
          {(task.kind === 'add' || task.kind === 'subtract') && <p className="text-[24px] font-extrabold tabular-nums text-ss-ink">{right.head}</p>}
          <p className="text-[15px] font-bold leading-snug text-ss-ink">{right.detail}</p>
        </div>
      )}
      {marked === 'wrong' && (
        <ul className="flex flex-col gap-0.5 text-center text-[14px] font-bold leading-snug text-ss-ink" aria-live="polite">
          {saidWhenWrong(config, s).map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      {!locked && (
        <button type="button" onClick={reset} className="nodrag min-h-[44px] rounded-full border border-ss-line bg-ss-chip px-4 text-[13px] font-bold text-ss-slate touch-manipulation focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[color:var(--subject)]">
          Start again
        </button>
      )}
    </div>
  )
}
