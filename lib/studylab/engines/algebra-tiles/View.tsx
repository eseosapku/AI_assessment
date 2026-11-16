'use client'
import { useId, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { AlgebraTilesConfig, AlgebraTilesState, Move, Pan, Tile } from './config'
import { equationText, moveText, panWords, progress, replay, rightText, undoMove, withMove } from './config'

// The scene's own inks, each over 4.5:1 on the panel in both themes. Shape says
// x or unit (a long bar, a small square); solid or hollow-with-a-minus says
// positive or negative, so colour is never the only cue.
const PALETTE = '[--at-x:#1D4ED8] [--at-one:#B45309] [--at-neg:#B91C1C] dark:[--at-x:#60A5FA] dark:[--at-one:#FBBF24] dark:[--at-neg:#F87171]'
const X_INK = 'var(--at-x, #1D4ED8)'
const ONE_INK = 'var(--at-one, #B45309)'
const NEG_INK = 'var(--at-neg, #B91C1C)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #636D76)'
const CHIP = 'var(--ss-chip, #F3F7F9)'
const MINUS = '−'

// The balance, in its own units. These mirror config.ts's limits (ten x tiles
// and thirty unit tiles a pan, at most four rows of ten once positive and
// negative rows are kept apart): config.ts imports this file, so a
// module-level read of its exports here would run before it has loaded.
const W = 360
const H = 162
const MOST_X = 10
const MOST_UNITS = 30
// A full pan (ten x tiles, or ten unit tiles a row) is 154 wide, leaving the
// "=" between the pans clear of both.
const PITCH = 15
const TILE = 13
const X_TALL = 36
const ROW = 10
const SIGN_GAP = 6
const FLOOR = 110
const PANS = { left: { x0: 4, x1: 176 }, right: { x0: 184, x1: 356 } } as const
const SHARE_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10]

type Placed = { tile: Tile; x: number; y: number; key: string }

/**
 * Where each tile sits on a pan: the x tiles in a row on top (positive, then
 * negative), the unit tiles below in rows of ten, positive rows over negative
 * ones so a zero pair lines up in a column. The block is centred on the pan and
 * rests on it.
 */
export function layoutPan(pan: Pan, cx: number): Placed[] {
  // A config faults() refuses is never served; if one were, it is drawn no larger than a pan holds.
  const whole = (v: number) => Math.max(0, Math.floor(v))
  const px = Math.min(whole(pan['x']), MOST_X)
  const pu = Math.min(whole(pan['1']), MOST_UNITS)
  const p: Pan = { 'x': px, '-x': Math.min(whole(pan['-x']), MOST_X - px), '1': pu, '-1': Math.min(whole(pan['-1']), MOST_UNITS - pu) }
  const rowWidth = (n: number) => (n > 0 ? n * PITCH - (PITCH - TILE) : 0)
  const xWidth = rowWidth(p['x'] + p['-x']) + (p['x'] > 0 && p['-x'] > 0 ? SIGN_GAP : 0)
  const unitRows: Tile[][] = []
  for (const t of ['1', '-1'] as const) {
    for (let left = p[t]; left > 0; left -= ROW) unitRows.push(Array.from({ length: Math.min(ROW, left) }, () => t))
  }
  const block = Math.max(xWidth, ...unitRows.map((r) => rowWidth(r.length)))
  const x0 = cx - block / 2
  const hasX = p['x'] + p['-x'] > 0
  const height = (hasX ? X_TALL : 0) + (hasX && unitRows.length ? 4 : 0) + unitRows.length * PITCH - (unitRows.length ? PITCH - TILE : 0)
  let y = FLOOR - height
  const out: Placed[] = []
  if (hasX) {
    let x = x0
    for (const t of ['x', '-x'] as const) {
      if (t === '-x' && p['x'] > 0 && p['-x'] > 0) x += SIGN_GAP
      for (let i = 0; i < p[t]; i++, x += PITCH) out.push({ tile: t, x, y, key: `${t}${i}` })
    }
    y += X_TALL + (unitRows.length ? 4 : 0)
  }
  const seen = { '1': 0, '-1': 0 }
  for (const row of unitRows) {
    row.forEach((t, i) => {
      out.push({ tile: t, x: x0 + i * PITCH, y, key: `${t}${seen[t as '1' | '-1']++}` })
    })
    y += PITCH
  }
  return out
}

function TileShape({ tile, x, y }: { tile: Tile; x: number; y: number }) {
  const tall = tile === 'x' || tile === '-x' ? X_TALL : TILE
  if (tile === 'x' || tile === '1') return <rect x={x} y={y} width={TILE} height={tall} rx={2} fill={tile === 'x' ? X_INK : ONE_INK} />
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={TILE - 2} height={tall - 2} rx={2} fill={PANEL} stroke={NEG_INK} strokeWidth={2} />
      <line x1={x + 3.5} y1={y + tall / 2} x2={x + TILE - 3.5} y2={y + tall / 2} stroke={NEG_INK} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  )
}

/** A tile as a small icon for the buttons, so they double as the key to the drawing. */
function TileIcon({ tile }: { tile: Tile }) {
  const isX = tile === 'x' || tile === '-x'
  const w = isX ? 8 : 12
  const h = isX ? 18 : 12
  const neg = tile === '-x' || tile === '-1'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      {neg ? (
        <>
          <rect x={1} y={1} width={w - 2} height={h - 2} rx={1.5} fill={PANEL} stroke={NEG_INK} strokeWidth={1.75} />
          <line x1={2.5} y1={h / 2} x2={w - 2.5} y2={h / 2} stroke={NEG_INK} strokeWidth={1.75} strokeLinecap="round" />
        </>
      ) : (
        <rect width={w} height={h} rx={1.5} fill={tile === 'x' ? X_INK : ONE_INK} />
      )}
    </svg>
  )
}

const SHOWN: Record<Tile, string> = { 'x': 'x', '-x': `${MINUS}x`, '1': '1', '-1': `${MINUS}1` }
const SPOKEN: Record<Tile, string> = { 'x': 'an x tile', '-x': `a ${MINUS}x tile`, '1': 'a unit tile', '-1': `a ${MINUS}1 tile` }
const BUTTON = 'nodrag inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-ss-line bg-ss-panel px-2.5 py-1 text-[13px] font-bold text-ss-ink'

/**
 * An equation balance of algebra tiles: the two pans, level, the equation
 * beneath them, the moves the learner may make (each to both pans), and the
 * working so far, an equation for every move.
 */
export function AlgebraTilesView({ config, state, setState, marked, locked }: SceneViewProps<AlgebraTilesConfig, AlgebraTilesState>) {
  const id = useId()
  const [said, setSaid] = useState<{ text: string; refused: boolean }>({ text: '', refused: false })
  const [groups, setGroups] = useState(2)
  const r = replay(config, state)
  const { left, right } = r.pans
  const now = equationText(r.pans)
  const done = marked === 'right' || marked === 'shown'

  const make = (move: Move) => {
    if (locked) return
    const next = withMove(config, state, move)
    if (!next.ok) return setSaid({ text: next.refused, refused: true })
    setSaid({ text: `${moveText(move)}: now ${equationText(next.pans)}.`, refused: false })
    setState(next.state)
  }
  const undo = () => {
    if (locked) return
    if (!r.steps.length) return setSaid({ text: 'Nothing to undo yet.', refused: false })
    const back = undoMove(state)
    setSaid({ text: `Undone: now ${equationText(replay(config, back).pans)}.`, refused: false })
    setState(back)
  }
  const restart = () => {
    if (locked) return
    setSaid({ text: `Back to the start: ${equationText(r.start)}.`, refused: false })
    setState({ moves: [] })
  }
  // The board moves a selected card with the arrows; inside the scene (the
  // groups list) they belong to the scene.
  const keepArrows = (e: KeyboardEvent) => {
    if (e.key.startsWith('Arrow')) e.stopPropagation()
  }

  const tileRow = (op: 'take' | 'add') => (
    <div role="group" aria-label={op === 'take' ? 'Take away from both sides' : 'Add to both sides'} className="flex items-center gap-1.5">
      <span className="w-[92px] shrink-0 text-[12px] font-bold leading-tight text-ss-slate">{op === 'take' ? 'Take from both sides' : 'Add to both sides'}</span>
      {(['x', '1', '-x', '-1'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => make({ op, tile: t, n: 1 })}
          aria-label={`${op === 'take' ? 'Take' : 'Add'} ${SPOKEN[t]} ${op === 'take' ? 'from' : 'to'} both sides`}
          className={`${BUTTON} w-[58px]`}
        >
          <TileIcon tile={t} />
          <span className="tabular-nums">{SHOWN[t]}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col items-center gap-2 ${PALETTE}`} onKeyDown={keepArrows}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[360px] select-none"
        role="img"
        aria-label={`A level balance. Left pan: ${panWords(left)}. Right pan: ${panWords(right)}.`}
      >
        <rect width={W} height={H} rx={14} fill={CHIP} />
        {(['left', 'right'] as const).map((side) => {
          const { x0, x1 } = PANS[side]
          const cx = (x0 + x1) / 2
          return (
            <g key={side}>
              {layoutPan(r.pans[side], cx).map((t) => <TileShape key={t.key} tile={t.tile} x={t.x} y={t.y} />)}
              {/* The pan: a shallow tray on a post. */}
              <path d={`M ${x0 + 2} ${FLOOR + 3} L ${x0 + 10} ${FLOOR + 11} H ${x1 - 10} L ${x1 - 2} ${FLOOR + 3}`} fill="none" stroke={SLATE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              <line x1={cx} y1={FLOOR + 11} x2={cx} y2={FLOOR + 18} stroke={SLATE} strokeWidth={2.5} />
            </g>
          )
        })}
        {/* The beam, level, on its pivot: the two sides are equal. */}
        <rect x={12} y={FLOOR + 18} width={W - 24} height={6} rx={3} fill={SLATE} />
        <path d={`M ${W / 2} ${FLOOR + 22} L ${W / 2 - 15} ${H - 4} H ${W / 2 + 15} Z`} fill={SLATE} />
        <text x={W / 2} y={74} textAnchor="middle" fontSize={24} fontWeight={800} fill={INK}>=</text>
      </svg>

      <p className="min-h-[30px] text-center text-[20px] font-extrabold tabular-nums leading-tight text-ss-ink">{now}</p>

      {marked !== 'idle' && (
        <p aria-live="polite" className="max-w-[360px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">
          {done ? rightText(config) : progress(config, state)}
        </p>
      )}

      {!locked && (
        <div className="flex w-full flex-col gap-1.5">
          {tileRow('take')}
          {tileRow('add')}
          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor={`${id}-groups`} className="text-[12px] font-bold text-ss-slate">Share into</label>
            <select
              id={`${id}-groups`}
              value={groups}
              onChange={(e) => setGroups(Number(e.target.value))}
              onKeyDown={keepArrows}
              className="nodrag min-h-[32px] rounded-lg border-[1.5px] border-ss-line bg-ss-panel px-1.5 text-[13px] font-bold tabular-nums text-ss-ink"
            >
              {SHARE_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-[12px] font-bold text-ss-slate">equal groups</span>
            <button
              type="button"
              onClick={() => make({ op: 'share', n: groups })}
              aria-label={`Share each side into ${groups} equal groups and keep one`}
              className={BUTTON}
            >
              Share, keep one
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => make({ op: 'zero' })} className={BUTTON}>Remove zero pairs</button>
            <button type="button" onClick={undo} className={`${BUTTON} text-ss-slate`}>Undo</button>
            <button type="button" onClick={restart} className={`${BUTTON} text-ss-slate`}>Start again</button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className={`min-h-[18px] text-[12px] leading-snug ${said.refused ? 'font-bold text-ss-ink' : 'font-semibold text-ss-slate'}`}
          >
            {said.text}
          </p>
        </div>
      )}

      <div className="w-full">
        <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ss-slate">Your working</p>
        <ol aria-label="Your working" className="flex flex-col gap-0.5">
          <li className="flex items-baseline justify-between gap-3 rounded-md bg-ss-chip px-2 py-1 text-[12px]">
            <span className="font-semibold text-ss-slate">Start</span>
            <span className="text-[13px] font-bold tabular-nums text-ss-ink">{equationText(r.start)}</span>
          </li>
          {r.steps.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-[12px]">
              <span className="font-semibold text-ss-slate">{moveText(s.move)}</span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-ss-ink">{equationText(s.pans)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
