'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Dir, Exact, Pt, TfConfig, TfState, Turn } from './config'
import { imageOf, kRange, lineText, madeText, num, pointText, readState, safeScenario, scaleText, turnText, working } from './config'

type Props = SceneViewProps<TfConfig, TfState>

// A quiet light plate in both themes, like measure-shape's and waves': the picture keeps its own colours. Flat colours only.
// Written as literals: config.ts imports this file, so none of its constants exist yet when this one loads.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const PAPER = '#FFFFFF'
const GRID_LINE = '#E2E8F0'
const AXIS = '#64748B'
const INK = '#334155'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const SHAPE_FILL = '#CBD5E1'
const SHAPE_EDGE = '#475569'
const IMAGE_FILL = '#F2B36B'
const IMAGE_EDGE = '#B45309'
const TARGET_FILL = '#DCEBF7'
const TARGET = '#2F7FB8'
const HANDLE = '#0F766E'
const GUIDE = '#94A3B8'

// The grid: 12 across and 10 up, 24 px to a unit, the origin in the middle.
export const W = 340
export const H = 278
export const ML = 30
export const MT = 16
export const U = 24
export const X_MIN = -6
export const X_MAX = 6
export const Y_MIN = -5
export const Y_MAX = 5

const sx = (x: number) => ML + (x - X_MIN) * U
const sy = (y: number) => MT + (Y_MAX - y) * U
const f1 = (n: number) => n.toFixed(1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const pointsOf = (pts: Pt[]) => pts.map(([x, y]) => `${f1(sx(x))},${f1(sy(y))}`).join(' ')
const flat = (e: Exact): Pt => [e.x / e.d, e.y / e.d]

/** Where the mirror line meets the grid's edges. */
export function lineEnds(dir: Dir, k: number): [Pt, Pt] {
  if (dir === 'v') return [[k, Y_MIN], [k, Y_MAX]]
  if (dir === 'h') return [[X_MIN, k], [X_MAX, k]]
  if (dir === 'up') {
    const a = Math.max(X_MIN, Y_MIN - k)
    const b = Math.min(X_MAX, Y_MAX - k)
    return [[a, a + k], [b, b + k]]
  }
  const a = Math.max(X_MIN, k - Y_MAX)
  const b = Math.min(X_MAX, k - Y_MIN)
  return [[a, k - a], [b, k - b]]
}

/** The image while a turn or a scale is still settling: the same maths with a number in between. */
function imageNow(task: TfConfig['task'], shape: Pt[], s: TfState, turn: number, scale: number): Pt[] {
  if (task === 'rotate') {
    const t = (turn * Math.PI) / 180
    const c = Math.cos(t)
    const n = Math.sin(t)
    return shape.map(([x, y]): Pt => [s.cx + (x - s.cx) * c + (y - s.cy) * n, s.cy - (x - s.cx) * n + (y - s.cy) * c])
  }
  if (task === 'enlarge') return shape.map(([x, y]): Pt => [s.cx + (x - s.cx) * scale, s.cy + (y - s.cy) * scale])
  return imageOf(task, shape, s).map(flat)
}

/** A number that eases to its target over about half a second; still, it just is the target. */
function useEased(target: number, reduced: boolean): number {
  const [v, setV] = useState(target)
  const at = useRef(target)
  useEffect(() => {
    if (reduced) {
      at.current = target
      setV(target)
      return
    }
    const from = at.current
    if (from === target) return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 520)
      at.current = from + (target - from) * (1 - Math.pow(1 - k, 3))
      setV(at.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return reduced ? target : v
}

// ---------------------------------------------------------------------------
// Parts of the drawing.

function Grid() {
  const xs = Array.from({ length: X_MAX - X_MIN + 1 }, (_, i) => X_MIN + i)
  const ys = Array.from({ length: Y_MAX - Y_MIN + 1 }, (_, i) => Y_MIN + i)
  return (
    <g fontFamily={FONT} fontSize={12} fontWeight={600} fill={SOFT} aria-hidden="true">
      <rect x={sx(X_MIN)} y={sy(Y_MAX)} width={(X_MAX - X_MIN) * U} height={(Y_MAX - Y_MIN) * U} fill={PAPER} />
      {xs.map((x) => <line key={`x${x}`} x1={sx(x)} x2={sx(x)} y1={sy(Y_MAX)} y2={sy(Y_MIN)} stroke={x === 0 ? AXIS : GRID_LINE} strokeWidth={x === 0 ? 1.6 : 1} />)}
      {ys.map((y) => <line key={`y${y}`} x1={sx(X_MIN)} x2={sx(X_MAX)} y1={sy(y)} y2={sy(y)} stroke={y === 0 ? AXIS : GRID_LINE} strokeWidth={y === 0 ? 1.6 : 1} />)}
      <rect x={sx(X_MIN)} y={sy(Y_MAX)} width={(X_MAX - X_MIN) * U} height={(Y_MAX - Y_MIN) * U} fill="none" stroke={PLATE_EDGE} strokeWidth={1.2} />
      {xs.map((x) => <text key={`tx${x}`} x={sx(x)} y={sy(Y_MIN) + 15} textAnchor="middle">{num(x)}</text>)}
      {ys.map((y) => <text key={`ty${y}`} x={sx(X_MIN) - 5} y={sy(y) + 4} textAnchor="end">{num(y)}</text>)}
      <text x={sx(X_MAX) + 9} y={sy(0) + 4} textAnchor="middle" fontStyle="italic">x</text>
      <text x={sx(0)} y={MT - 5} textAnchor="middle" fontStyle="italic">y</text>
    </g>
  )
}

function Poly({ pts, fill, edge, opacity = 1, dash, dots }: { pts: Pt[]; fill: string; edge: string; opacity?: number; dash?: string; dots?: boolean }) {
  return (
    <g>
      <polygon points={pointsOf(pts)} fill={fill} fillOpacity={opacity} stroke={edge} strokeWidth={2.2} strokeLinejoin="round" strokeDasharray={dash} />
      {dots && pts.map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(y)} r={2.8} fill={edge} />)}
    </g>
  )
}

/** The thin lines that make the idea plain while the image moves. */
function Guides({ config, s, shape, image, turn }: { config: TfConfig; s: TfState; shape: Pt[]; image: Pt[]; turn: number }) {
  const line = { stroke: GUIDE, strokeWidth: 1.3, strokeDasharray: '4 3', fill: 'none' }
  const apart = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.02
  if (config.task === 'reflect' || config.task === 'translate') {
    return <g>{shape.map((p, i) => apart(p, image[i]) && <line key={i} x1={sx(p[0])} y1={sy(p[1])} x2={sx(image[i][0])} y2={sy(image[i][1])} {...line} />)}</g>
  }
  const c: Pt = [s.cx, s.cy]
  if (config.task === 'enlarge') {
    return (
      <g>
        {shape.map((p, i) => {
          if (!apart(p, c) || !apart(p, image[i])) return null
          // The ray runs over every point on it: the centre, the point and its image.
          const dx = p[0] - c[0]
          const dy = p[1] - c[1]
          const along = [c, p, image[i]].map((q) => ((q[0] - c[0]) * dx + (q[1] - c[1]) * dy) / (dx * dx + dy * dy))
          const lo = Math.min(...along)
          const hi = Math.max(...along)
          return <line key={i} x1={sx(c[0] + dx * lo)} y1={sy(c[1] + dy * lo)} x2={sx(c[0] + dx * hi)} y2={sy(c[1] + dy * hi)} {...line} />
        })}
      </g>
    )
  }
  // A turn: the spoke to one corner, where it was and where it is, and the arc between.
  const at = shape.findIndex((p) => apart(p, c))
  if (at < 0 || Math.abs(turn) < 1) return null
  const p = shape[at]
  const q = image[at]
  const r = Math.hypot(p[0] - c[0], p[1] - c[1]) * U
  return (
    <g>
      <line x1={sx(c[0])} y1={sy(c[1])} x2={sx(p[0])} y2={sy(p[1])} {...line} />
      <line x1={sx(c[0])} y1={sy(c[1])} x2={sx(q[0])} y2={sy(q[1])} {...line} />
      <path d={`M${f1(sx(p[0]))} ${f1(sy(p[1]))}A${f1(r)} ${f1(r)} 0 ${Math.abs(turn) > 180 ? 1 : 0} ${turn > 0 ? 1 : 0} ${f1(sx(q[0]))} ${f1(sy(q[1]))}`} {...line} />
    </g>
  )
}

/** A handle on the thing that defines the transformation: a ring with a dot, big enough for a finger. */
function Pin({ at, label, onDown }: { at: Pt; label: string; onDown?: (e: PointerEvent) => void }) {
  return (
    <g data-pin={label} transform={`translate(${f1(sx(at[0]))} ${f1(sy(at[1]))})`} style={{ touchAction: 'none', cursor: onDown ? 'grab' : 'default' }} onPointerDown={onDown}>
      <circle r={17} fill="transparent" />
      <circle r={9} fill={PAPER} stroke={HANDLE} strokeWidth={2.2} />
      <circle r={3.3} fill={HANDLE} />
    </g>
  )
}

function Mirror({ s, onDown, movable }: { s: TfState; onDown: (e: PointerEvent) => void; movable: boolean }) {
  const [a, b] = lineEnds(s.dir, s.k)
  const ax = sx(a[0])
  const ay = sy(a[1])
  const bx = sx(b[0])
  const by = sy(b[1])
  const long = Math.hypot(bx - ax, by - ay) || 1
  const ux = (bx - ax) / long
  const uy = (by - ay) / long
  // Grips pulled in from the edges, so they do not sit on the axis numbers.
  const grips: [number, number][] = [[ax + ux * 14, ay + uy * 14], [bx - ux * 14, by - uy * 14]]
  const normal = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + 90
  return (
    <g data-mirror={lineText(s.dir, s.k)}>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={HANDLE} strokeWidth={2.6} strokeLinecap="round" />
      {movable && <line x1={ax} y1={ay} x2={bx} y2={by} stroke="transparent" strokeWidth={26} style={{ touchAction: 'none', cursor: 'grab' }} onPointerDown={onDown} />}
      {grips.map(([x, y], i) => (
        <g key={i} transform={`translate(${f1(x)} ${f1(y)})`} style={{ touchAction: 'none', cursor: movable ? 'grab' : 'default' }} onPointerDown={movable ? onDown : undefined}>
          <circle r={11} fill="transparent" />
          <circle r={9} fill={PAPER} stroke={HANDLE} strokeWidth={2} />
          <g transform={`rotate(${f1(normal)})`} fill="none" stroke={HANDLE} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M-4.6 0H4.6M-4.6 0l2.4-2.4M-4.6 0l2.4 2.4M4.6 0l-2.4-2.4M4.6 0l-2.4 2.4" />
          </g>
        </g>
      ))}
    </g>
  )
}

function Arrow({ from, to }: { from: Pt; to: Pt }) {
  const ax = sx(from[0])
  const ay = sy(from[1])
  const bx = sx(to[0])
  const by = sy(to[1])
  const long = Math.hypot(bx - ax, by - ay)
  if (long < 1) return null
  const ux = (bx - ax) / long
  const uy = (by - ay) / long
  // The shaft stops short of the head's handle, so the arrow reads as an arrow under the ring.
  return (
    <g stroke={HANDLE} strokeWidth={2.6} strokeLinecap="round" fill={HANDLE}>
      <circle cx={ax} cy={ay} r={3.4} stroke="none" />
      <line x1={ax} y1={ay} x2={bx - ux * 2} y2={by - uy * 2} />
      {long > 26 && <path d={`M${f1(bx - ux * 12 - uy * 6)} ${f1(by - uy * 12 + ux * 6)}L${f1(bx - ux * 6)} ${f1(by - uy * 6)}L${f1(bx - ux * 12 + uy * 6)} ${f1(by - uy * 12 - ux * 6)}`} fill="none" />}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Controls, copied from atom's stepper row: a small bold label, then the quiet buttons around the value.

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const SEG = 'nodrag flex h-7 min-w-[34px] shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function StepRow(p: { name: string; value: string; wide?: boolean; less: string; more: string; onLess(): void; onMore(): void; noLess: boolean; noMore: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{p.name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={p.less} disabled={p.noLess} onClick={p.onLess} className={STEP}>{'−'}</button>
        <span className={`${p.wide ? 'min-w-[88px]' : 'min-w-[40px]'} text-center text-[15px] font-extrabold tabular-nums text-ss-ink`} data-value={p.name}>{p.value}</span>
        <button type="button" aria-label={p.more} disabled={p.noMore} onClick={p.onMore} className={STEP}>+</button>
      </span>
    </div>
  )
}

function Mini(p: { axis: string; value: string; less: string; more: string; onLess(): void; onMore(): void; noLess: boolean; noMore: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[12px] font-bold italic text-ss-slate" aria-hidden="true">{p.axis}</span>
      <button type="button" aria-label={p.less} disabled={p.noLess} onClick={p.onLess} className={STEP}>{'−'}</button>
      <span className="min-w-[24px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-value={`Centre ${p.axis}`}>{p.value}</span>
      <button type="button" aria-label={p.more} disabled={p.noMore} onClick={p.onMore} className={STEP}>+</button>
    </span>
  )
}

function Choice({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5" role="group" aria-label={name}>
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">{children}</span>
    </div>
  )
}

function Pick({ on, label, disabled, onPick, children }: { on: boolean; label: string; disabled: boolean; onPick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} disabled={disabled} onClick={onPick} className={`${SEG} ${on ? 'border-[color:var(--subject)] bg-ss-chip' : 'border-ss-line bg-ss-panel'}`}>
      {children}
    </button>
  )
}

/** A mirror line's slope as a small picture: the four lines the learner may use. */
function LineIcon({ dir }: { dir: Dir }) {
  const d = dir === 'v' ? 'M8 1.5V14.5' : dir === 'h' ? 'M1.5 8H14.5' : dir === 'up' ? 'M2.5 13.5L13.5 2.5' : 'M2.5 2.5L13.5 13.5'
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d={d} stroke={HANDLE} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </svg>
  )
}

const DIRS: Dir[] = ['v', 'h', 'up', 'down']
const DIR_NAME: Record<Dir, string> = { v: 'A vertical mirror line', h: 'A horizontal mirror line', up: 'A mirror line rising to the right', down: 'A mirror line falling to the right' }
const SCALE_LIST = [-2, -1, 0.5, 1, 2, 3]
const TURN_LIST: { turn: Turn; label: string; aria: string }[] = [
  { turn: -90, label: '↺ 90°', aria: 'Turn a quarter anticlockwise' },
  { turn: 180, label: '180°', aria: 'Turn a half turn' },
  { turn: 90, label: '↻ 90°', aria: 'Turn a quarter clockwise' },
]

const CAPTION: Record<TfConfig['task'], string> = {
  reflect: 'Each point and its image are equally far from the line.',
  rotate: 'The image swings round the pin.',
  enlarge: 'Each image point sits on a ray from the pin.',
  translate: 'Every point moves along the same arrow.',
}

function Key({ shape, name, children }: { shape: ReactNode; name: string; children?: never }) {
  void children
  return <span className="flex items-center gap-1 whitespace-nowrap">{shape}{name}</span>
}
const Swatch = ({ fill, edge, dash }: { fill: string; edge: string; dash?: string }) => (
  <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0" aria-hidden="true">
    <rect x={1} y={1} width={14} height={10} rx={2} fill={fill} stroke={edge} strokeWidth={1.6} strokeDasharray={dash} />
  </svg>
)

function describe(config: TfConfig, s: TfState): string {
  const grid = 'A grid from −6 to 6 across and −5 to 5 up shows a grey shape, a dashed blue target shape, and an orange image of the grey shape.'
  switch (config.task) {
    case 'reflect': return `${grid} The image is the shape reflected in the mirror line ${lineText(s.dir, s.k)}.`
    case 'rotate': return `${grid} The image is the shape turned about the pin at ${pointText(s.cx, s.cy)}: ${turnText(s.turn)}.`
    case 'enlarge': return `${grid} The image is the shape enlarged from the pin at ${pointText(s.cx, s.cy)} with scale factor ${scaleText(s.scale)}.`
    default: return `${grid} The image is the shape moved by the vector ${pointText(s.vx, s.vy)}.`
  }
}

export function TransformationsView({ config, state, setState, marked, reduced, locked }: Props) {
  const sc = safeScenario(config)
  const done = marked === 'right' || marked === 'shown'
  const s = readState(marked === 'shown' ? sc.answer : state)
  const frozen = locked || done
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ what: 'line' | 'pin' | 'head' | 'body'; grab?: Pt } | null>(null)
  const latest = useRef(s)
  latest.current = s
  const turn = useEased(s.turn, reduced)
  const scale = useEased(s.scale, reduced)
  const image = imageNow(config.task, sc.shape, s, turn, scale)
  const task = config.task
  const set = (next: Partial<TfState>) => { if (!frozen) setState({ ...latest.current, ...next }) }

  const gridAt = (e: PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return [((e.clientX - r.left) * (W / r.width) - ML) / U + X_MIN, Y_MAX - ((e.clientY - r.top) * (H / r.height) - MT) / U]
  }
  const start = (what: 'line' | 'pin' | 'head' | 'body') => (e: PointerEvent) => {
    if (frozen || !svgRef.current) return
    e.preventDefault()
    svgRef.current.setPointerCapture(e.pointerId)
    drag.current = { what, grab: what === 'body' ? ((g) => [g[0] - (sc.shape[0][0] + latest.current.vx), g[1] - (sc.shape[0][1] + latest.current.vy)] as Pt)(gridAt(e)) : undefined }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d || frozen || !svgRef.current) return
    const [gx, gy] = gridAt(e)
    const cur = latest.current
    if (d.what === 'line') {
      const raw = cur.dir === 'v' ? gx : cur.dir === 'h' ? gy : cur.dir === 'up' ? gy - gx : gy + gx
      const [lo, hi] = kRange(cur.dir)
      set({ k: clamp(Math.round(raw), lo, hi) })
    } else if (d.what === 'pin') {
      set({ cx: clamp(Math.round(gx), X_MIN, X_MAX), cy: clamp(Math.round(gy), Y_MIN, Y_MAX) })
    } else {
      const off = d.grab ?? [0, 0]
      set({ vx: clamp(Math.round(gx - off[0] - sc.shape[0][0]), -12, 12), vy: clamp(Math.round(gy - off[1] - sc.shape[0][1]), -10, 10) })
    }
  }
  const stop = () => { drag.current = null }
  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const said = marked === 'right' || marked === 'shown' ? working(config, s) : marked === 'wrong' ? madeText(config, s) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const [lo, hi] = kRange(s.dir)
  const at = SCALE_LIST.indexOf(s.scale)
  const centre = (
    <div className="flex items-center justify-between gap-1.5" role="group" aria-label="Centre">
      <span className="text-[12px] font-bold text-ss-slate">Centre</span>
      <span className="flex items-center gap-2">
        <Mini
          axis="x" value={num(s.cx)} less="Move the centre left" more="Move the centre right"
          onLess={() => set({ cx: s.cx - 1 })} onMore={() => set({ cx: s.cx + 1 })} noLess={frozen || s.cx <= X_MIN} noMore={frozen || s.cx >= X_MAX}
        />
        <Mini
          axis="y" value={num(s.cy)} less="Move the centre down" more="Move the centre up"
          onLess={() => set({ cy: s.cy - 1 })} onMore={() => set({ cy: s.cy + 1 })} noLess={frozen || s.cy <= Y_MIN} noMore={frozen || s.cy >= Y_MAX}
        />
      </span>
    </div>
  )

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg
          ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, s)} className="block h-auto w-full select-none" style={{ touchAction: 'none' }}
          onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
        >
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <Grid />
          <clipPath id="tf-grid-clip"><rect x={sx(X_MIN)} y={sy(Y_MAX)} width={(X_MAX - X_MIN) * U} height={(Y_MAX - Y_MIN) * U} /></clipPath>
          <g clipPath="url(#tf-grid-clip)">
          <Guides config={config} s={s} shape={sc.shape} image={image} turn={task === 'rotate' ? turn : 0} />
          <g data-target={sc.target.map((p) => p.join(',')).join(' ')}><Poly pts={sc.target} fill={TARGET_FILL} edge={TARGET} dash="6 4" /></g>
          <g data-shape="1"><Poly pts={sc.shape} fill={SHAPE_FILL} edge={SHAPE_EDGE} dots /></g>
          <g
            data-image={image.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')}
            style={task === 'translate' && !frozen ? { touchAction: 'none', cursor: 'grab' } : undefined} onPointerDown={task === 'translate' ? start('body') : undefined}
          >
            <Poly pts={image} fill={IMAGE_FILL} edge={IMAGE_EDGE} opacity={0.88} dots />
          </g>
          <polygon points={pointsOf(sc.target)} fill="none" stroke={TARGET} strokeWidth={2.2} strokeLinejoin="round" strokeDasharray="6 4" />
          </g>
          {task === 'reflect' && <Mirror s={s} movable={!frozen} onDown={start('line')} />}
          {task === 'translate' && (
            <>
              <Arrow from={sc.shape[0]} to={image[0]} />
              <Pin at={image[0]} label="head" onDown={frozen ? undefined : start('head')} />
            </>
          )}
          {(task === 'rotate' || task === 'enlarge') && <Pin at={[s.cx, s.cy]} label="centre" onDown={frozen ? undefined : start('pin')} />}
        </svg>
        <figcaption className="flex flex-col items-center gap-0.5 text-center text-[12px] font-bold text-ss-slate">
          <span>{CAPTION[task]}</span>
          <span className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 font-semibold" aria-hidden="true">
            <Key shape={<Swatch fill={SHAPE_FILL} edge={SHAPE_EDGE} />} name="Shape" />
            <Key shape={<Swatch fill={IMAGE_FILL} edge={IMAGE_EDGE} />} name="Your image" />
            <Key shape={<Swatch fill={TARGET_FILL} edge={TARGET} dash="3 2" />} name="Target" />
            <Key
              shape={task === 'reflect' ? <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0"><path d="M1 6H15" stroke={HANDLE} strokeWidth={2.6} strokeLinecap="round" /></svg>
                : <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0"><circle cx={8} cy={6} r={4.6} fill={PAPER} stroke={HANDLE} strokeWidth={1.8} /><circle cx={8} cy={6} r={1.6} fill={HANDLE} /></svg>}
              name={task === 'reflect' ? 'Mirror line' : task === 'translate' ? 'Arrow head' : 'Centre'}
            />
          </span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {task === 'reflect' && (
          <>
            <Choice name="Mirror line">
              {DIRS.map((d) => (
                <Pick key={d} on={s.dir === d} label={DIR_NAME[d]} disabled={frozen} onPick={() => { const [a, b] = kRange(d); set({ dir: d, k: clamp(s.k, a, b) }) }}><LineIcon dir={d} /></Pick>
              ))}
            </Choice>
            <StepRow
              name="Line" wide value={lineText(s.dir, s.k)} less={`Slide the mirror line ${s.dir === 'v' ? 'left' : 'down'}`} more={`Slide the mirror line ${s.dir === 'v' ? 'right' : 'up'}`}
              onLess={() => set({ k: s.k - 1 })} onMore={() => set({ k: s.k + 1 })} noLess={frozen || s.k <= lo} noMore={frozen || s.k >= hi}
            />
          </>
        )}
        {task === 'rotate' && (
          <>
            <Choice name="Turn">
              {TURN_LIST.map((t) => <Pick key={t.turn} on={s.turn === t.turn} label={t.aria} disabled={frozen} onPick={() => set({ turn: t.turn })}>{t.label}</Pick>)}
            </Choice>
            {centre}
          </>
        )}
        {task === 'enlarge' && (
          <>
            {centre}
            <StepRow
              name="Scale factor" value={`×${scaleText(s.scale)}`} less="Smaller scale factor" more="Larger scale factor"
              onLess={() => set({ scale: SCALE_LIST[Math.max(0, at - 1)] })} onMore={() => set({ scale: SCALE_LIST[Math.min(SCALE_LIST.length - 1, at + 1)] })} noLess={frozen || at <= 0} noMore={frozen || at >= SCALE_LIST.length - 1}
            />
          </>
        )}
        {task === 'translate' && (
          <>
            <StepRow
              name="Across" value={s.vx > 0 ? `+${s.vx}` : num(s.vx)} less="Move the shape left" more="Move the shape right"
              onLess={() => set({ vx: s.vx - 1 })} onMore={() => set({ vx: s.vx + 1 })} noLess={frozen || s.vx <= -12} noMore={frozen || s.vx >= 12}
            />
            <StepRow
              name="Up" value={s.vy > 0 ? `+${s.vy}` : num(s.vy)} less="Move the shape down" more="Move the shape up"
              onLess={() => set({ vy: s.vy - 1 })} onMore={() => set({ vy: s.vy + 1 })} noLess={frozen || s.vy <= -10} noMore={frozen || s.vy >= 10}
            />
          </>
        )}
      </div>

      <span className="sr-only" aria-live="polite">{describe(config, s)}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
