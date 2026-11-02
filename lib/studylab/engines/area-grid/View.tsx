'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { AreaGridConfig, AreaGridState, CellId } from './config'
import { areaGridEngine, expandWorking, halvesText, madeExpand, madeSquare, rat, ratText, squareWorking } from './config'

type Props = SceneViewProps<AreaGridConfig, AreaGridState>

// The scene's own inks. Fills are solid and flat; each outline is over 3:1 on
// the panel in both themes, and text inside a fill uses the page ink.
const PALETTE =
  '[--ag-sq:#DCE8FF] [--ag-sqb:#1D4ED8] [--ag-st:#FFE3CC] [--ag-stb:#C2410C] [--ag-un:#D3F0DA] [--ag-unb:#15803D] ' +
  'dark:[--ag-sq:#1E3A8A] dark:[--ag-sqb:#93C5FD] dark:[--ag-st:#7C2D12] dark:[--ag-stb:#FDBA74] dark:[--ag-un:#14532D] dark:[--ag-unb:#86EFAC]'
const SQ = 'var(--ag-sq, #DCE8FF)'
const SQB = 'var(--ag-sqb, #1D4ED8)'
const ST = 'var(--ag-st, #FFE3CC)'
const STB = 'var(--ag-stb, #C2410C)'
const UN = 'var(--ag-un, #D3F0DA)'
const UNB = 'var(--ag-unb, #15803D)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

/** Keeps a line of working whole when the text wraps. */
export function unbroken(text: string): string {
  return text.replace(/\([^()]*\)²?/g, (m) => m.replace(/ /g, ' ')).replace(/ ([+−=]) /g, ' $1 ')
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{unbroken(text)}</p>
}

// ---------------------------------------------------------------------------
// expand: four regions, each with its own area to write.

/** The size of one unit of p or q, in px. */
export const unitFor = (p: number, q: number) => Math.min(36, Math.floor(200 / Math.max(p, q)))
export const X_PX = 100

function Expand({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<AreaGridConfig, { task: 'expand' }> }) {
  const { p, q } = config
  const id = useId()
  const u = unitFor(p, q)
  const cells = { tl: '', tr: '', bl: '', br: '', ...state?.cells }
  const total = state?.total ?? ''
  const full = CELLS_LIST.every((c) => cells[c].trim() !== '')
  const wrong = marked === 'wrong' ? new Set(checkIds(config, state)) : new Set<string>()
  const named = marked === 'right' || marked === 'shown'

  const set = (c: CellId, v: string) => { if (!locked) setState({ ...state, cells: { ...cells, [c]: v.slice(0, 7) }, total }) }
  const dims: Record<CellId, string> = {
    tl: 'x wide and x tall', tr: `${p} wide and x tall`, bl: `x wide and ${q} tall`, br: `${p} wide and ${q} tall`,
  }
  const fill: Record<CellId, [string, string]> = { tl: [SQ, SQB], tr: [ST, STB], bl: [ST, STB], br: [UN, UNB] }
  const cell = (c: CellId, col: number, row: number) => {
    const bad = wrong.has(c)
    return (
      <label
        key={c}
        className="flex items-center justify-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--subject)]"
        style={{ gridColumn: col, gridRow: row, background: cells[c].trim() ? fill[c][0] : 'transparent', transition: reduced ? undefined : 'background-color 160ms ease-out', border: `${bad ? 4 : 2}px solid ${bad ? 'var(--ss-bad, #B91C1C)' : named ? 'var(--ss-good, #15803D)' : fill[c][1]}` }}
      >
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="?"
          aria-label={`Area of the ${CELL_NAMES_LIST[c]} region, ${dims[c]}`}
          aria-invalid={bad || undefined}
          value={cells[c]}
          disabled={locked}
          onChange={(e) => set(c, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="nodrag h-full w-full min-w-0 bg-transparent p-0 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none placeholder:text-ss-slate"
        />
      </label>
    )
  }
  const label = (text: string, col: number, row: number) => (
    <span key={`${col}-${row}`} style={{ gridColumn: col, gridRow: row }} className="flex items-center justify-center text-[14px] font-extrabold text-ss-ink">{text}</span>
  )

  return (
    <>
      <div
        role="group"
        aria-label={`A rectangle with sides x plus ${p} across and x plus ${q} down, cut into four regions`}
        className="grid"
        style={{ gridTemplateColumns: `28px ${X_PX}px ${p * u}px`, gridTemplateRows: `24px ${X_PX}px ${q * u}px` }}
      >
        {label('x', 2, 1)}{label(`${p}`, 3, 1)}{label('x', 1, 2)}{label(`${q}`, 1, 3)}
        {cell('tl', 2, 2)}{cell('tr', 3, 2)}{cell('bl', 2, 3)}{cell('br', 3, 3)}
      </div>
      {full && (
        <div className="flex items-center justify-center gap-2">
          <label htmlFor={`${id}-total`} className="text-[13px] font-bold text-ss-slate">Whole area</label>
          <input
            id={`${id}-total`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={total}
            disabled={locked}
            aria-invalid={wrong.has('total') || undefined}
            onChange={(e) => setState({ ...state, cells, total: e.target.value.slice(0, 24) })}
            onKeyDown={(e) => e.stopPropagation()}
            className="nodrag w-44 rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-center text-[16px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)]"
          />
        </div>
      )}
      <Verdict marked={marked} text={named ? `${expandWorking(p, q)}.` : madeExpand(config, { ...state, cells })} />
    </>
  )
}

// Names and the check live in config.ts; these small mirrors keep this file's
// module-level code free of config imports (config imports this file).
const CELLS_LIST: CellId[] = ['tl', 'tr', 'bl', 'br']
const CELL_NAMES_LIST: Record<CellId, string> = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' }

function checkIds(config: AreaGridConfig, state: AreaGridState): string[] {
  return areaGridEngine.check(config, state).wrongIds
}

// ---------------------------------------------------------------------------
// complete-square: cut the strip, turn one piece round, and see the gap.

const S = 130
const ML = 44
const MT = 30
const STEP_MAX = 132

export const unitForB = (b: number) => Math.min(20, STEP_MAX / b)

function CompleteSquare({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<AreaGridConfig, { task: 'complete-square' }> }) {
  const { b, c } = config
  const id = useId()
  const u = unitForB(b)
  const cut = Number.isInteger(state?.cut) ? Math.max(1, Math.min(2 * b - 1, state.cut as number)) : 1
  const moved = !!state?.moved
  const corner = state?.corner ?? ''
  const a = cut / 2
  const w = b - a
  const named = marked === 'right' || marked === 'shown'
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<null | { kind: 'cut' } | { kind: 'piece'; x: number; y: number; dx: number; dy: number }>(null)

  const W = ML + S + b * u + 30
  const H = MT + S + (b - 0.5) * u + 14
  const xCut = ML + S + a * u

  const toLocal = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const k = W / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }
  }
  const setCut = (h: number) => {
    const next = Math.max(1, Math.min(2 * b - 1, h))
    if (!locked && next !== cut) setState({ ...state, cut: next, moved, corner })
  }
  const setMoved = (m: boolean) => { if (!locked && m !== moved) setState({ ...state, cut, moved: m, corner }) }

  const onCutKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    e.stopPropagation()
    setCut(cut + d)
  }
  const onPieceKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setMoved(!moved) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setMoved(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setMoved(false) }
  }

  const pieceB = moved
    ? { x: ML, y: MT + S, w: S, h: w * u }
    : { x: xCut, y: MT, w: w * u, h: S }
  const dx = drag?.kind === 'piece' && !reduced ? drag.dx : 0
  const dy = drag?.kind === 'piece' && !reduced ? drag.dy : 0

  const text = (t: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'middle', size = 13) => (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={800} fill={INK} {...HALO} aria-hidden="true">{t}</text>
  )

  return (
    <>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
        role="group"
        aria-label={`A square labelled x squared with a strip ${b} wide beside it, cut into two pieces ${halvesText(cut)} and ${halvesText(2 * b - cut)} wide`}
        onPointerMove={(e) => {
          if (!drag) return
          const p = toLocal(e)
          if (drag.kind === 'cut') setCut(Math.round(((p.x - (ML + S)) / u) * 2))
          else setDrag({ ...drag, dx: p.x - drag.x, dy: p.y - drag.y })
        }}
        onPointerUp={(e) => {
          if (drag?.kind === 'piece') {
            const p = toLocal(e)
            const far = Math.hypot(p.x - drag.x, p.y - drag.y) > 8
            setMoved(far ? p.y > MT + S : !moved)
          }
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {/* the square and the piece that stays */}
        <rect x={ML} y={MT} width={S} height={S} fill={SQ} stroke={SQB} strokeWidth={2} />
        <rect x={ML + S} y={MT} width={a * u} height={S} fill={ST} stroke={STB} strokeWidth={2} />
        {/* the gap, once the piece is round the bottom */}
        {moved && (
          <rect
            x={ML + S} y={MT + S} width={a * u} height={w * u}
            fill={named ? UN : 'none'} stroke={named ? UNB : INK} strokeWidth={2} strokeDasharray={named ? undefined : '5 4'}
          />
        )}
        {/* the outer piece: draggable, and a button for the keyboard */}
        <g
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-pressed={moved}
          aria-label={`The outer piece, ${halvesText(2 * b - cut)} wide. Press Enter to turn it round under the square, or back`}
          aria-disabled={locked || undefined}
          onKeyDown={onPieceKey}
          onPointerDown={(e) => {
            if (locked) return
            e.currentTarget.setPointerCapture?.(e.pointerId)
            const p = toLocal(e)
            setDrag({ kind: 'piece', x: p.x, y: p.y, dx: 0, dy: 0 })
          }}
          className={`outline-none [&:focus-visible>rect:last-child]:stroke-[color:var(--subject)] [&:focus-visible>rect:last-child]:stroke-[4] ${locked ? '' : 'cursor-grab'}`}
          transform={`translate(${dx} ${dy})`}
        >
          <rect x={pieceB.x} y={pieceB.y} width={pieceB.w} height={pieceB.h} fill={ST} stroke={STB} strokeWidth={2} />
          {!moved && !locked && (
            <g transform={`translate(${pieceB.x + pieceB.w / 2} ${pieceB.y + pieceB.h - 16})`} aria-hidden="true">
              <circle r={9} fill={PANEL} stroke={INK} strokeWidth={2.5} />
              <path d="M 3.5 -3.5 L -3 3 M -3 -1.5 L -3 3 L 1.5 3" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          <rect x={pieceB.x - 3} y={pieceB.y - 3} width={pieceB.w + 6} height={pieceB.h + 6} fill="transparent" stroke="none" strokeWidth={2} />
        </g>
        {/* the cut: a line on the strip with a handle */}
        {text('x²', ML + S / 2, MT + S / 2 + 6, 'middle', 20)}
        {text('x', ML - 6, MT + S / 2 + 5, 'end')}
        {named ? (
          <>
            <rect x={ML} y={MT} width={S + a * u} height={S + w * u} fill="none" stroke={INK} strokeWidth={2.5} pointerEvents="none" />
            {text(`x + ${ratText(rat(b, 2))}`, ML + (S + a * u) / 2, MT - 9)}
            {text(ratText(rat(b, 2)), ML - 6, MT + S + (w * u) / 2 + 5, 'end')}
            {text(ratText(rat(b * b, 4)), ML + S + (a * u) / 2, MT + S + (w * u) / 2 + 5, 'middle')}
          </>
        ) : moved ? (
          <>
            {text(halvesText(cut), ML + S + (a * u) / 2, MT - 9)}
            {text(halvesText(2 * b - cut), ML - 6, MT + S + (w * u) / 2 + 5, 'end')}
          </>
        ) : (
          text(`${halvesText(cut)} + ${halvesText(2 * b - cut)}`, ML + S + (b * u) / 2, MT - 9)
        )}
        {!named && (
          <g
            role="slider"
            tabIndex={locked ? -1 : 0}
            aria-label="The cut across the strip. Move it with the arrow keys"
            aria-valuemin={0.5}
            aria-valuemax={b - 0.5}
            aria-valuenow={a}
            aria-valuetext={`pieces ${halvesText(cut)} and ${halvesText(2 * b - cut)} wide`}
            aria-disabled={locked || undefined}
            onKeyDown={onCutKey}
            onPointerDown={(e) => {
              if (locked) return
              e.currentTarget.setPointerCapture?.(e.pointerId)
              setDrag({ kind: 'cut' })
            }}
            className={`outline-none [&:focus-visible>circle:nth-child(2)]:stroke-[color:var(--subject)] [&:focus-visible>circle:nth-child(2)]:stroke-[4] ${locked ? '' : 'cursor-ew-resize'}`}
            transform={`translate(${xCut} ${MT + S / 2})`}
          >
            <circle r={22} fill="transparent" />
            <circle r={9} fill={PANEL} stroke={INK} strokeWidth={2.5} />
            <path d="M -3 -3 L -5.5 0 L -3 3 M 3 -3 L 5.5 0 L 3 3" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {!named && <line x1={xCut} y1={MT} x2={xCut} y2={MT + S / 2 - 10} stroke={INK} strokeWidth={2} pointerEvents="none" />}
        {!named && <line x1={xCut} y1={MT + S / 2 + 10} x2={xCut} y2={MT + S} stroke={INK} strokeWidth={2} pointerEvents="none" />}
      </svg>
      {moved && !named && (
        <div className="flex items-center justify-center gap-2">
          <label htmlFor={`${id}-gap`} className="text-[13px] font-bold text-ss-slate">Area of the dashed gap</label>
          <input
            id={`${id}-gap`}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={corner}
            disabled={locked}
            onChange={(e) => setState({ ...state, cut, moved, corner: e.target.value.slice(0, 10) })}
            onKeyDown={(e) => e.stopPropagation()}
            className="nodrag w-24 rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-center text-[16px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)]"
          />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {moved ? `The outer piece is under the square. The gap in the corner is ${halvesText(cut)} wide and ${halvesText(2 * b - cut)} tall.` : `The strip is cut into ${halvesText(cut)} and ${halvesText(2 * b - cut)}.`}
      </p>
      <Verdict marked={marked} text={named ? `${squareWorking(b, c)}. The gap is ${ratText(rat(b, 2))} by ${ratText(rat(b, 2))}.` : madeSquare(config, state)} />
    </>
  )
}

/**
 * An algebra product as an area: four regions to write the area of (expand),
 * or a strip to cut and turn round to see what completes a square.
 */
export function AreaGridView(props: Props) {
  const { config } = props
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {config.task === 'expand' ? <Expand {...props} config={config} /> : <CompleteSquare {...props} config={config} />}
    </div>
  )
}
