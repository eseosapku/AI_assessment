'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { AreaGridConfig, AreaGridState, CellId } from './config'
import { areaGridEngine, expandWorking, halvesText, madeExpand, madeSquare, rat, ratText, squareWorking } from './config'

type Props = SceneViewProps<AreaGridConfig, AreaGridState>

// The scene's own drawing sits on a pale plate in both themes, like a diagram in a book: card pieces laid on a mat.
// Every edge is over 3:1 on the plate. Text on the plate is fixed ink; the controls around it use the tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1E293B'
const SOFT = '#475569'
const DIM = '#64748B'
const SQ = '#9EBFEA'
const SQB = '#3A6AAE'
const SQ_PALE = '#EDF3FB'
const ST = '#F3BF84'
const STB = '#B4662A'
const ST_PALE = '#FBF1E4'
const UN = '#9FD4AE'
const UNB = '#3F8A55'
const UN_PALE = '#EDF6EF'
const GOOD = '#2F8A4F'
const BAD = '#B91C1C'
const SHADOW = 'rgba(15,23,42,0.13)'
const BEVEL = 'rgba(255,255,255,0.62)'

/** Keeps a line of working whole when the text wraps. */
export function unbroken(text: string): string {
  return text.replace(/\([^()]*\)²?/g, (m) => m.replace(/ /g, ' ')).replace(/ ([+−=]) /g, ' $1 ')
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{unbroken(text)}</p>
}

const FIELD = 'nodrag w-40 rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)] disabled:opacity-100'

/** A labelled answer row, aligned like the other scenes' control rows. */
function Row({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[360px] items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-bold text-ss-slate">{label}</label>
      {children}
    </div>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return <figcaption className="text-center text-[12px] font-bold text-ss-slate">{children}</figcaption>
}

// A textbook dimension line: a thin rule with a short stop at each end and its label beside it.
function HDim({ w, label }: { w: number; label: string }) {
  return (
    <svg width={w} height={22} viewBox={`0 0 ${w} 22`} aria-hidden="true" className="block">
      <path d={`M1.5 11V19M${w - 1.5} 11V19M1.5 15H${w - 1.5}`} fill="none" stroke={DIM} strokeWidth={1.3} strokeLinecap="round" />
      <text x={w / 2} y={9} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{label}</text>
    </svg>
  )
}
function VDim({ h, label }: { h: number; label: string }) {
  return (
    <svg width={26} height={h} viewBox={`0 0 26 ${h}`} aria-hidden="true" className="block">
      <path d={`M16 1.5H24M16 ${h - 1.5}H24M20 1.5V${h - 1.5}`} fill="none" stroke={DIM} strokeWidth={1.3} strokeLinecap="round" />
      <text x={12} y={h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{label}</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// expand: four tiles laid on a mat, each with its own area to write.

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
  // [filled colour, edge, empty (pale) colour]
  const look: Record<CellId, [string, string, string]> = { tl: [SQ, SQB, SQ_PALE], tr: [ST, STB, ST_PALE], bl: [ST, STB, ST_PALE], br: [UN, UNB, UN_PALE] }
  const cell = (c: CellId, col: number, row: number) => {
    const bad = wrong.has(c)
    const filled = cells[c].trim() !== ''
    const edge = bad ? BAD : named ? GOOD : look[c][1]
    return (
      <label
        key={c}
        data-filled={filled ? 'yes' : 'no'}
        className="flex items-center justify-center rounded-[5px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--subject)]"
        style={{
          gridColumn: col,
          gridRow: row,
          background: filled ? look[c][0] : look[c][2],
          transition: reduced ? undefined : 'background-color 160ms ease-out',
          border: `1.5px solid ${edge}`,
          boxShadow: `inset 0 0 0 2px ${BEVEL}, 1px 2px 0 ${SHADOW}${bad ? `, 0 0 0 2px ${BAD}` : ''}`,
        }}
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
          className="nodrag h-[26px] w-[calc(100%-8px)] min-w-0 max-w-[60px] rounded-md p-0 text-center text-[14px] font-extrabold tabular-nums outline-none placeholder:font-bold"
          style={{
            color: INK,
            background: filled ? 'transparent' : '#FFFFFF',
            border: `1px solid ${filled ? 'transparent' : PLATE_EDGE}`,
          }}
        />
      </label>
    )
  }
  const gridW = 26 + 3 + X_PX + 3 + p * u
  const gridH = 22 + 3 + X_PX + 3 + q * u

  return (
    <>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <div className="flex justify-center rounded-2xl border-[1.5px] px-2 py-2" style={{ background: PLATE, borderColor: PLATE_EDGE }}>
          <div
            role="group"
            aria-label={`A rectangle with sides x plus ${p} across and x plus ${q} down, cut into four regions`}
            className="grid"
            style={{ gridTemplateColumns: `26px ${X_PX}px ${p * u}px`, gridTemplateRows: `22px ${X_PX}px ${q * u}px`, gap: 3, width: gridW, height: gridH }}
          >
            <div style={{ gridColumn: 2, gridRow: 1 }}><HDim w={X_PX} label="x" /></div>
            <div style={{ gridColumn: 3, gridRow: 1 }}><HDim w={p * u} label={`${p}`} /></div>
            <div style={{ gridColumn: 1, gridRow: 2 }}><VDim h={X_PX} label="x" /></div>
            <div style={{ gridColumn: 1, gridRow: 3 }}><VDim h={q * u} label={`${q}`} /></div>
            {cell('tl', 2, 2)}{cell('tr', 3, 2)}{cell('bl', 2, 3)}{cell('br', 3, 3)}
          </div>
        </div>
        <Caption>Fill in each tile, then write the whole expression.</Caption>
      </figure>
      {full && (
        <Row htmlFor={`${id}-total`} label="Whole area">
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
            className={FIELD}
          />
        </Row>
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
const MT = 32
const STEP_MAX = 132
const PANEL_W = 330

export const unitForB = (b: number) => Math.min(20, STEP_MAX / b)

/** Unit lines across a strip piece, measured from the side next to the square, so it reads as squared card. */
function unitLines(n: number, u: number, at: (d: number) => string): string {
  let d = ''
  for (let k = 1; k * u < n * u - 1; k++) d += at(k * u)
  return d
}

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
  const VW = Math.max(W, PANEL_W)
  const OX = (VW - W) / 2
  const H = MT + S + (b - 0.5) * u + 16
  const xCut = ML + S + a * u

  const toLocal = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const k = VW / r.width
    return { x: (e.clientX - r.left) * k - OX, y: (e.clientY - r.top) * k }
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
  const lifted = drag?.kind === 'piece' && !reduced

  const text = (t: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'middle', size = 12, weight = 700) => (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={INK} aria-hidden="true">{t}</text>
  )
  // A dimension line along the top or down the left, with its label in the clear beside it.
  const hdim = (x1: number, x2: number, label: string) => (
    <g aria-hidden="true">
      <path d={`M${x1 + 1.5} ${MT - 14}V${MT - 6}M${x2 - 1.5} ${MT - 14}V${MT - 6}M${x1 + 1.5} ${MT - 10}H${x2 - 1.5}`} fill="none" stroke={DIM} strokeWidth={1.3} strokeLinecap="round" />
      {text(label, (x1 + x2) / 2, MT - 18)}
    </g>
  )
  const vdim = (y1: number, y2: number, label: string) => (
    <g aria-hidden="true">
      <path d={`M${ML - 14} ${y1 + 1.5}H${ML - 6}M${ML - 14} ${y2 - 1.5}H${ML - 6}M${ML - 10} ${y1 + 1.5}V${y2 - 1.5}`} fill="none" stroke={DIM} strokeWidth={1.3} strokeLinecap="round" />
      {text(label, ML - 19, (y1 + y2) / 2 + 4, 'end')}
    </g>
  )
  const edgeOf = (col: string) => (named ? GOOD : col)
  // A card piece: shadow, flat colour, a lit inner edge and its edge line.
  const card = (x: number, y: number, rw: number, rh: number, fill: string, edge: string, lift = false) => (
    <>
      <rect x={x + (lift ? 3 : 1.5)} y={y + (lift ? 5 : 2.5)} width={rw} height={rh} rx={3} fill={SHADOW} />
      <rect x={x} y={y} width={rw} height={rh} rx={3} fill={fill} stroke={edge} strokeWidth={1.6} />
      <rect x={x + 2.5} y={y + 2.5} width={Math.max(0, rw - 5)} height={Math.max(0, rh - 5)} rx={1.5} fill="none" stroke={BEVEL} strokeWidth={1.4} />
    </>
  )

  return (
    <>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <div className="flex justify-center rounded-2xl border-[1.5px] px-1 py-2" style={{ background: PLATE, borderColor: PLATE_EDGE }}>
          <svg
            ref={svg}
            viewBox={`0 0 ${VW} ${H}`}
            width={VW}
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
            <g transform={`translate(${OX} 0)`}>
              {/* the square and the piece that stays */}
              {card(ML, MT, S, S, SQ, edgeOf(SQB))}
              {card(ML + S, MT, a * u, S, ST, edgeOf(STB))}
              <path d={unitLines(a, u, (d) => `M${ML + S + d} ${MT + 4}V${MT + S - 4}`)} stroke={edgeOf(STB)} strokeOpacity={0.28} strokeWidth={1} fill="none" pointerEvents="none" />
              {/* the gap, once the piece is round the bottom */}
              {moved && (
                <rect
                  x={ML + S} y={MT + S} width={a * u} height={w * u} rx={2}
                  fill={named ? UN : 'none'} stroke={named ? GOOD : SOFT} strokeWidth={1.6} strokeDasharray={named ? undefined : '5 4'}
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
                className={`outline-none [&:focus-visible>rect:last-child]:stroke-[color:var(--subject)] [&:focus-visible>rect:last-child]:stroke-[4] ${locked ? '' : lifted ? 'cursor-grabbing' : 'cursor-grab'}`}
                transform={`translate(${dx} ${dy})`}
              >
                {card(pieceB.x, pieceB.y, pieceB.w, pieceB.h, ST, edgeOf(STB), lifted)}
                <path
                  d={moved
                    ? unitLines(w, u, (d) => `M${pieceB.x + 4} ${pieceB.y + d}H${pieceB.x + pieceB.w - 4}`)
                    : unitLines(w, u, (d) => `M${pieceB.x + d} ${pieceB.y + 4}V${pieceB.y + pieceB.h - 4}`)}
                  stroke={edgeOf(STB)} strokeOpacity={0.28} strokeWidth={1} fill="none" pointerEvents="none"
                />
                {!moved && !locked && (
                  <g transform={`translate(${pieceB.x + pieceB.w / 2} ${pieceB.y + pieceB.h - 18})`} aria-hidden="true">
                    <rect x={-11} y={-7} width={22} height={14} rx={7} fill="#FFFFFF" stroke={SOFT} strokeWidth={1.3} />
                    <path d="M-5 0H5M-5 -2.6H5M-5 2.6H5" stroke={SOFT} strokeWidth={1.1} strokeLinecap="round" />
                  </g>
                )}
                <rect x={pieceB.x - 3} y={pieceB.y - 3} width={pieceB.w + 6} height={pieceB.h + 6} fill="transparent" stroke="none" strokeWidth={2} />
              </g>
              {/* what is printed on the square, and the sides marked like a textbook figure */}
              {text('x²', ML + S / 2, MT + S / 2 + 7, 'middle', 22, 800)}
              {named ? (
                <>
                  <rect x={ML} y={MT} width={S + a * u} height={S + w * u} rx={3} fill="none" stroke={INK} strokeWidth={2} pointerEvents="none" />
                  {hdim(ML, ML + S + a * u, `x + ${ratText(rat(b, 2))}`)}
                  {vdim(MT, MT + S, 'x')}
                  {vdim(MT + S, MT + S + w * u, ratText(rat(b, 2)))}
                  {text(ratText(rat(b * b, 4)), ML + S + (a * u) / 2, MT + S + (w * u) / 2 + 4, 'middle', 12, 800)}
                </>
              ) : moved ? (
                <>
                  {hdim(ML, ML + S, 'x')}
                  {hdim(ML + S, ML + S + a * u, halvesText(cut))}
                  {vdim(MT, MT + S, 'x')}
                  {vdim(MT + S, MT + S + w * u, halvesText(2 * b - cut))}
                </>
              ) : (
                <>
                  {hdim(ML, ML + S, 'x')}
                  {hdim(ML + S, ML + S + b * u, cut === 1 ? `${b}` : `${halvesText(cut)} + ${halvesText(2 * b - cut)}`)}
                  {vdim(MT, MT + S, 'x')}
                </>
              )}
              {/* the cut: a dashed line down the strip with a grip on it */}
              {!named && <line x1={xCut} y1={MT - 2} x2={xCut} y2={MT + S + 2} stroke={INK} strokeWidth={1.6} strokeDasharray="4 3" strokeLinecap="round" pointerEvents="none" />}
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
                  className={`outline-none [&:focus-visible>rect:last-child]:stroke-[color:var(--subject)] [&:focus-visible>rect:last-child]:stroke-[3] ${locked ? '' : 'cursor-ew-resize'}`}
                  transform={`translate(${xCut} ${MT + S / 2})`}
                >
                  <circle r={22} fill="transparent" />
                  <rect x={-8} y={-14} width={16} height={28} rx={6} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
                  <path d="M-3 -6V6M0 -6V6M3 -6V6" stroke={SOFT} strokeWidth={1.1} strokeLinecap="round" />
                  <rect x={-10} y={-16} width={20} height={32} rx={8} fill="none" stroke="none" strokeWidth={2} />
                </g>
              )}
            </g>
          </svg>
        </div>
        <Caption>{moved ? 'The outer piece now sits under the square.' : 'Drag the cut along the strip, then turn the outer piece under the square.'}</Caption>
      </figure>
      {moved && !named && (
        <Row htmlFor={`${id}-gap`} label="Area of the dashed gap">
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
            className={FIELD}
          />
        </Row>
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
    <div className="nodrag flex flex-col items-center gap-2">
      {config.task === 'expand' ? <Expand {...props} config={config} /> : <CompleteSquare {...props} config={config} />}
    </div>
  )
}
