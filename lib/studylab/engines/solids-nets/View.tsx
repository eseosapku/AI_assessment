'use client'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Cell, Look, SolidsConfig, SolidsState, Square, V3 } from './config'
import {
  areaOf, cardOf, foldGeometry, looseAt, layersOf, madeText, project, sectionCells, solidsNetsEngine, spotsOf, squaresOf, treeOf, working,
} from './config'

type Props = SceneViewProps<SolidsConfig, SolidsState>

// A card net is not a dark subject: a quiet light plate, as measure-shape's and network-sim's are, with real card on it.
// The plate keeps its own colours in both themes. Flat colours only; shading is one flat step per face.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1F2A37'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// Card: cream on the printed side, kraft on the back. One orange sheet for the loose square.
const CARD = '#F4E9CC'
const CARD_BACK = '#E2CC96'
const TAB = '#E8D8A8'
const CARD_EDGE = '#8A7345'
const SHEET = '#F5A55C'
const SHEET_BACK = '#E08A3C'
const SHEET_EDGE = '#A55A1A'
const ACCENT = '#D9822B'
// Prism: a block of blue acrylic, with the cross-section on its front.
const FRONT = '#9CC4E8'
const TOP = '#CFE3F5'
const SIDE = '#7FA9D2'
const BLOCK_EDGE = '#3F6E9E'

export const W = 360
export const H = 240
const f1 = (n: number) => n.toFixed(1)

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${ch((n >> 16) & 255)} ${ch((n >> 8) & 255)} ${ch(n & 255)})`
}

const LIGHT: V3 = (() => {
  const v: V3 = [-0.4, -0.5, 0.8]
  const m = Math.hypot(...v)
  return [v[0] / m, v[1] / m, v[2] / m]
})()

/** The picture's quiet frame, drawn under everything. */
const Plate = () => <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />

// ---------------------------------------------------------------------------
// fold

type Poly = { pts: { x: number; y: number }[]; depth: number; fill: string; tab: boolean; cell: number; edges: boolean[]; flip: boolean; matrix: string | null; n: number; loose: boolean }

function FoldView({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<SolidsConfig, { task: 'fold' }> }) {
  const [deg, setDeg] = useState(0)
  const degRef = useRef(0)
  degRef.current = deg
  const finished = marked !== 'idle'
  const now = marked === 'shown' ? solidsNetsEngine.solve(config) : state
  const at = looseAt(config, now)
  const card = cardOf(config)
  const spots = useMemo(() => spotsOf(card), [card])

  // The loose square eases to where it is stuck, while the card is flat.
  const [pos, setPos] = useState<Cell>(at)
  const posRef = useRef<Cell>(at)
  posRef.current = pos
  useEffect(() => {
    if (reduced || degRef.current > 0 || marked !== 'idle') {
      setPos(at)
      return
    }
    const a = posRef.current
    const b = at
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 380)
      const e = 1 - (1 - k) ** 3
      setPos([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e])
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new place for the square starts a move
  }, [at[0], at[1]])

  // Once marked, the card folds itself up so the learner sees what they made; trying again lays it flat.
  useEffect(() => {
    if (marked === 'idle') {
      setDeg(0)
      return
    }
    if (reduced) {
      setDeg(90)
      return
    }
    const from = degRef.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900)
      setDeg(Math.round(from + (90 - from) * (1 - (1 - k) ** 2)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [marked, reduced])

  const drawAt: Cell = deg > 0 || marked !== 'idle' ? at : pos
  const squares: Square[] = useMemo(() => {
    const sq = squaresOf(config, { at })
    return sq.map((s) => (s.loose ? { ...s, r: drawAt[0], c: drawAt[1] } : s))
  }, [config, at, drawAt[0], drawAt[1]]) // eslint-disable-line react-hooks/exhaustive-deps -- drawAt is two numbers

  // The grid the card and every place for the loose square sit on: fixed, so nothing shifts when the square moves.
  const grid = useMemo(() => {
    const all: Cell[] = [...card.base, ...spots, card.start]
    const rs = all.map((c) => c[0])
    const cs = all.map((c) => c[1])
    const minR = Math.min(...rs)
    const maxR = Math.max(...rs)
    const minC = Math.min(...cs)
    const maxC = Math.max(...cs)
    const s0 = Math.min(46, (W - 28) / (maxC - minC + 1), (H - 34) / (maxR - minR + 1))
    return { minR, minC, cols: maxC - minC + 1, rows: maxR - minR + 1, s0, midX: (minC + maxC + 1) / 2, midY: (minR + maxR + 1) / 2 }
  }, [card, spots])

  const tree = useMemo(() => treeOf(squares), [squares])
  const t = deg / 90
  const root = squares[tree.root]
  const look: Look = {
    yaw: 0.62 * t,
    pitch: 0.92 * t,
    scale: grid.s0 * (1 + 1.2 * t),
    cx: W / 2,
    cy: H / 2 + 4 * t,
    target: [grid.midX + (root.c + 0.5 - grid.midX) * t, grid.midY + (root.r + 0.5 - grid.midY) * t, 0.5 * t],
  }

  const polys = useMemo<Poly[]>(() => {
    const geo = foldGeometry(squares, deg)
    const toViewer: V3 = [Math.sin(look.yaw) * Math.sin(look.pitch), Math.cos(look.yaw) * Math.sin(look.pitch), Math.cos(look.pitch)]
    const out: Poly[] = []
    const make = (cs: V3[], cell: number, tab: boolean): Poly => {
      const pr = cs.map((p) => project(p, look))
      const e1: V3 = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], cs[1][2] - cs[0][2]]
      const e3: V3 = [cs[3][0] - cs[0][0], cs[3][1] - cs[0][1], cs[3][2] - cs[0][2]]
      const nn: V3 = [e1[1] * e3[2] - e1[2] * e3[1], e1[2] * e3[0] - e1[0] * e3[2], e1[0] * e3[1] - e1[1] * e3[0]]
      const m = Math.hypot(...nn) || 1
      const n: V3 = [nn[0] / m, nn[1] / m, nn[2] / m]
      const face = n[0] * toViewer[0] + n[1] * toViewer[1] + n[2] * toViewer[2]
      const lit = 0.8 + 0.2 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])
      const s = squares[cell]
      const base = tab ? TAB : s.loose ? (face >= 0 ? SHEET : SHEET_BACK) : face >= 0 ? CARD : CARD_BACK
      // A glue tab folds to the inside, so it sorts behind the squares it sits against.
      const depth = pr.reduce((a, p) => a + p.depth, 0) / pr.length - (tab ? 0.3 : 0)
      let matrix: string | null = null
      const flip = false
      if (!tab) {
        // The number stays upright on the square, so a 6 is never read as a 9; it hides when the square is edge-on.
        const area = Math.abs((pr[1].x - pr[0].x) * (pr[3].y - pr[0].y) - (pr[1].y - pr[0].y) * (pr[3].x - pr[0].x)) / (look.scale * look.scale)
        if (area > 0.3) matrix = `translate(${f1((pr[0].x + pr[2].x) / 2)} ${f1((pr[0].y + pr[2].y) / 2)})`
      }
      return { pts: pr, depth, fill: shade(base, lit), tab, cell, edges: [], flip, matrix, n: s.n, loose: s.loose }
    }
    geo.corners.forEach((cs, i) => {
      const p = make(cs, i, false)
      // An edge is a fold where this square and its neighbour are hinged; the rest are cut edges.
      p.edges = [[-1, 0], [0, 1], [1, 0], [0, -1]].map(([dr, dc]) => {
        const j = squares.findIndex((o) => o.r === squares[i].r + dr && o.c === squares[i].c + dc)
        return j >= 0 && (tree.parent[i] === j || tree.parent[j] === i)
      })
      out.push(p)
    })
    geo.tabs.forEach((tb) => out.push(make(tb.poly, tb.cell, true)))
    return out.sort((a, b) => a.depth - b.depth)
  }, [squares, deg, look.yaw, look.pitch, look.scale, look.cx, look.cy, look.target[0], look.target[1], look.target[2], tree]) // eslint-disable-line react-hooks/exhaustive-deps -- look is rebuilt every render from these

  const showSpots = deg === 0 && !finished && !locked
  const place = (c: Cell) => ({ x: W / 2 + grid.s0 * (c[1] + 0.5 - grid.midX), y: H / 2 + grid.s0 * (c[0] + 0.5 - grid.midY) })
  const ordered = useMemo(() => spots.filter((s) => !(s[0] === at[0] && s[1] === at[1])).sort((a, b) => a[1] - b[1] || a[0] - b[0]), [spots, at])

  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const caption = finished ? '' : deg === 0 ? 'Dashed = fold. Dotted = a place for the orange square.' : 'Slide back to flat to move the orange square.'

  const onKey = (e: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.stopPropagation()
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.sn-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`} role="img" className="block h-auto w-full select-none"
            aria-label={`A card net of six numbered squares, with the sixth, orange, one loose. The card is bent ${deg} degrees.`}
          >
            <Plate />
            {showSpots && ordered.map((s) => {
              const p = place(s)
              const h = grid.s0 / 2 - 2
              return (
                <g key={`${s[0]},${s[1]}`} data-spot={`${s[0]},${s[1]}`} aria-hidden="true">
                  <rect x={f1(p.x - h)} y={f1(p.y - h)} width={f1(2 * h)} height={f1(2 * h)} rx={5} fill="none" stroke={ACCENT} strokeWidth={1.8} strokeDasharray="4 4" />
                  <path d={`M ${f1(p.x - 4)} ${f1(p.y)} H ${f1(p.x + 4)} M ${f1(p.x)} ${f1(p.y - 4)} V ${f1(p.y + 4)}`} stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
                </g>
              )
            })}
            {polys.map((p, k) => {
              const pts = p.pts.map((q) => `${f1(q.x)},${f1(q.y)}`).join(' ')
              const edge = p.loose ? SHEET_EDGE : CARD_EDGE
              return (
                <g key={k} data-poly={p.tab ? 'tab' : `square-${p.n}`}>
                  <polygon points={pts} fill={p.fill} stroke={p.tab ? CARD_EDGE : 'none'} strokeWidth={1} strokeLinejoin="round" />
                  {!p.tab && p.edges.map((fold, i) => {
                    const a = p.pts[i]
                    const b = p.pts[(i + 1) % 4]
                    return <line key={i} x1={f1(a.x)} y1={f1(a.y)} x2={f1(b.x)} y2={f1(b.y)} stroke={edge} strokeWidth={fold ? 1.2 : 1.6} strokeLinecap="round" strokeDasharray={fold ? '3 3' : undefined} />
                  })}
                  {!p.tab && p.matrix && (
                    <text transform={p.matrix} x={0} y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK}>{p.n}</text>
                  )}
                </g>
              )
            })}
          </svg>
          {showSpots && ordered.map((s) => {
            const p = place(s)
            return (
              <button
                key={`${s[0]},${s[1]}`} type="button"
                aria-label={`Stick the orange square down in row ${s[0] - grid.minR + 1}, column ${s[1] - grid.minC + 1}`}
                onClick={() => setState({ at: [s[0], s[1]] })}
                className="nodrag absolute touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: `${((grid.s0 - 2) / W) * 100}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
              />
            )
          })}
        </div>
        {caption && <figcaption className="text-center text-[12px] font-bold text-ss-slate" aria-hidden="true">{caption}</figcaption>}
      </figure>

      <div className="flex items-center gap-2">
        <label htmlFor="sn-fold" className="text-[12px] font-bold text-ss-slate">Fold</label>
        <input
          id="sn-fold" type="range" min={0} max={90} step={1} value={deg} aria-valuetext={`${deg} degrees`}
          className="nodrag h-7 min-w-0 flex-1 touch-pan-y accent-[color:var(--subject)]"
          onChange={(e) => setDeg(Number(e.target.value))} onKeyDown={onKey}
        />
        <span className="w-10 text-right text-[15px] font-extrabold tabular-nums text-ss-ink">{deg}°</span>
      </div>

      <p className="sn-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between dotted squares. Enter sticks the orange square there.</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// extrude

/** Layers drawn as unit cubes in a cabinet view: depth runs up and to the right, at half scale. */
const DEPTH_X = 0.43
const DEPTH_Y = -0.3

function ExtrudeView({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<SolidsConfig, { task: 'extrude' }> }) {
  const now = marked === 'shown' ? solidsNetsEngine.solve(config) : state
  const len = layersOf(config, now)
  const cells = sectionCells(config)
  const rows = Math.max(...cells.map((c) => c[0])) + 1
  const cols = Math.max(...cells.map((c) => c[1])) + 1
  const cs = Math.min(34, 112 / Math.max(rows, cols))
  const maxLen = 10
  // The block is placed for its longest length, so it grows in place instead of drifting.
  const totalW = cols * cs + maxLen * cs * DEPTH_X
  const totalH = rows * cs + maxLen * cs * -DEPTH_Y
  const x0 = (W - totalW) / 2
  const y0 = (H - 22 - totalH) / 2 + maxLen * cs * -DEPTH_Y
  const dx = cs * DEPTH_X
  const dy = cs * DEPTH_Y
  const has = (r: number, c: number) => cells.some((q) => q[0] === r && q[1] === c)
  const px = (c: number, k: number) => x0 + c * cs + k * dx
  const py = (r: number, k: number) => y0 + r * cs + k * dy
  const finished = marked === 'right' || marked === 'shown'
  const unit = config.unit

  const slabs: ReactNode[] = []
  for (let k = len - 1; k >= 0; k--) {
    for (const [r, c] of cells) {
      if (!has(r - 1, c)) {
        slabs.push(<polygon key={`t${k}-${r}-${c}`} points={`${f1(px(c, k))},${f1(py(r, k))} ${f1(px(c + 1, k))},${f1(py(r, k))} ${f1(px(c + 1, k + 1))},${f1(py(r, k + 1))} ${f1(px(c, k + 1))},${f1(py(r, k + 1))}`} fill={TOP} stroke={BLOCK_EDGE} strokeWidth={0.9} strokeLinejoin="round" />)
      }
      if (!has(r, c + 1)) {
        slabs.push(<polygon key={`s${k}-${r}-${c}`} points={`${f1(px(c + 1, k))},${f1(py(r, k))} ${f1(px(c + 1, k + 1))},${f1(py(r, k + 1))} ${f1(px(c + 1, k + 1))},${f1(py(r + 1, k + 1))} ${f1(px(c + 1, k))},${f1(py(r + 1, k))}`} fill={SIDE} stroke={BLOCK_EDGE} strokeWidth={0.9} strokeLinejoin="round" />)
      }
    }
  }
  // The label sits on the bottom-most, left-most square.
  const mark = cells.reduce((a, q) => (q[0] > a[0] || (q[0] === a[0] && q[1] < a[1]) ? q : a), cells[0])

  const set = (n: number) => !locked && setState({ len: Math.max(1, Math.min(maxLen, n)) })
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    set(e.key === 'Home' ? 1 : e.key === 'End' ? maxLen : len + by)
  }
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  void reduced
  void areaOf

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.sn-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`} role="img" className="block h-auto w-full select-none"
          aria-label={`A prism of blue blocks, pulled out from a flat shape of ${cells.length} unit squares into ${len} ${len === 1 ? 'layer' : 'layers'}, each layer ${unit === 'cm' ? '1 centimetre' : unit === 'mm' ? '1 millimetre' : '1 metre'} thick.`}
        >
          <Plate />
          {slabs}
          {/* The cross-section, on the front of the nearest layer. */}
          {cells.map(([r, c]) => <rect key={`f${r}-${c}`} x={f1(px(c, 0))} y={f1(py(r, 0))} width={f1(cs)} height={f1(cs)} fill={FRONT} stroke={BLOCK_EDGE} strokeWidth={1.2} strokeLinejoin="round" />)}
          <g data-label="unit" fontFamily={FONT} aria-hidden="true">
            <path d={`M ${f1(px(mark[1], 0))} ${f1(py(mark[0] + 1, 0) + 6)} v 4 H ${f1(px(mark[1] + 1, 0))} v -4`} fill="none" stroke={SOFT} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
            <text x={f1(px(mark[1], 0) + cs / 2)} y={f1(py(mark[0] + 1, 0) + 24)} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">1 {unit}</text>
          </g>
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate" aria-hidden="true">Each layer is one square thick.</figcaption>
      </figure>

      <div className="flex items-center justify-between gap-1.5">
        <span id="sn-len" className="text-[12px] font-bold text-ss-slate">Length</span>
        <span className="flex items-center gap-1">
          <button type="button" tabIndex={-1} aria-label="Take away a layer" className={button} disabled={locked || len <= 1} onClick={() => set(len - 1)}>−</button>
          <span
            role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby="sn-len" aria-valuenow={len} aria-valuemin={1} aria-valuemax={maxLen} aria-valuetext={`${len} ${unit}`}
            aria-disabled={locked || undefined} onKeyDown={onKey}
            className="nodrag min-w-[56px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          >{len} {unit}</span>
          <button type="button" tabIndex={-1} aria-label="Add a layer" className={button} disabled={locked || len >= maxLen} onClick={() => set(len + 1)}>+</button>
        </span>
      </div>

      <p className="sn-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys add or take away a layer.</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}

export function SolidsNetsView(props: Props) {
  const { config } = props
  return config.task === 'fold' ? <FoldView {...props} config={config} /> : <ExtrudeView {...props} config={config} />
}
