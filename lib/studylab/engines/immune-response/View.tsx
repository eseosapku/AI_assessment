'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Antigen, Bacterium, ImmuneConfig, ImmuneState } from './config'
import { bacteriaFor, immuneResponseEngine, madeText, taggedOf, working } from './config'

type Props = SceneViewProps<ImmuneConfig, ImmuneState>
type Point = { x: number; y: number }

// A quiet light plate, with the cells drawn as cells rather than icons. The plate keeps its colours in both themes.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const VESSEL = '#EAF4F6'
const VESSEL_EDGE = '#A9C7CE'
const CELL = '#D5A4B9'
const CELL_EDGE = '#805268'
const CYTO = '#F0CCD7'
const BACT = '#E4A14D'
const BACT_EDGE = '#89551D'
const BACT_HI = '#F4C77E'
const GOLD = '#E9B949'
const GOLD_EDGE = '#755316'
const BLUE = '#397FAF'
const BLUE_EDGE = '#174F76'
const PURPLE = '#8B77A8'
const PURPLE_EDGE = '#514368'
const VAC = '#F7E8EF'
// The plate's geometry is repeated literally here, not read at module load from config (they import each other).
export const VACUA = [{ x: 307, y: 185, r: 10.5 }, { x: 315, y: 226, r: 10.5 }]
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 310
export const REST = { x: 105, y: 225 }
const TARGET_DISTANCE = 38
const ENGULF_AT = 900
const EASE = 'transform 650ms cubic-bezier(.2,.7,.2,1), opacity 500ms ease'

function Label({ x, y, children, anchor = 'middle', color = SOFT }: { x: number; y: number; children: string; anchor?: 'middle' | 'start' | 'end'; color?: string }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize={12} fontWeight={700} fill={color} stroke={PLATE} strokeWidth={2.5} paintOrder="stroke" strokeLinejoin="round">{children}</text>
}

/** The antigen as it actually appears on the bacterium and as the matching hollow in the antibody. */
function Shape({ kind, size, fill = GOLD, stroke = GOLD_EDGE, hollow = false }: { kind: Antigen; size: number; fill?: string; stroke?: string; hollow?: boolean }) {
  const sw = 1.8
  if (kind === 'triangle') {
    const d = `M 0 ${-size} L ${size * 0.88} ${size * 0.62} L ${-size * 0.88} ${size * 0.62} Z`
    return <path d={d} fill={hollow ? PLATE : fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
  }
  if (kind === 'square') return <rect x={-size * 0.8} y={-size * 0.8} width={size * 1.6} height={size * 1.6} rx={1.5} fill={hollow ? PLATE : fill} stroke={stroke} strokeWidth={sw} />
  return <circle r={size * 0.84} fill={hollow ? PLATE : fill} stroke={stroke} strokeWidth={sw} />
}

function BacteriumBody({ b, attached }: { b: Bacterium; attached: boolean }) {
  return (
    <g data-bacterium={b.id}>
      {/* Fine pili, kept away from the antigen on top. */}
      <g stroke={BACT_EDGE} strokeWidth={1.7} strokeLinecap="round">
        <path d="M -39 -8 l -7 -4 M -42 3 l -8 1 M -35 14 l -6 6 M 39 -8 l 7 -4 M 42 3 l 8 1 M 35 14 l 6 6" />
        <path d="M -24 -17 l -3 -5 M 23 -17 l 3 -5 M -20 19 l -1 5 M 20 19 l 1 5" />
      </g>
      <rect x={-42} y={-19} width={84} height={38} rx={19} fill={BACT} stroke={BACT_EDGE} strokeWidth={2.2} />
      <path d="M -31 -11 C -13 -18 17 -18 32 -9" fill="none" stroke={BACT_HI} strokeWidth={4} strokeLinecap="round" />
      <g fill="none" stroke={BACT_EDGE} strokeWidth={1.3} opacity={0.75}>
        <path d="M -23 2 C -16 -9 -5 -7 -1 1 S 13 10 22 0" />
        <path d="M -17 10 C -8 3 3 4 10 10" />
      </g>
      {/* One prominent surface antigen, and its short stalk. */}
      <line x1={0} y1={-18} x2={0} y2={-28} stroke={GOLD_EDGE} strokeWidth={2.2} />
      <g transform="translate(0 -31)"><Shape kind={b.antigen} size={7.2} /></g>
      {attached && <path d="M -29 23 Q 0 31 29 23" fill="none" stroke={BLUE} strokeWidth={3} strokeLinecap="round" />}
    </g>
  )
}

/** A real Y silhouette: the two arms and their cut-out binding sites face upward; the stem is the handle. */
function Antibody({ at, antigen, dragging, ghost = false }: { at: Point; antigen: Antigen; dragging: boolean; ghost?: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} data-antibody={ghost ? 'binding' : 'handle'} opacity={ghost ? 1 : dragging ? 0.82 : 1}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 0 30 L 0 6 M 0 6 L -18 -16 M 0 6 L 18 -16" stroke={BLUE_EDGE} strokeWidth={12} />
        <path d="M 0 30 L 0 6 M 0 6 L -18 -16 M 0 6 L 18 -16" stroke={BLUE} strokeWidth={8} />
      </g>
      {/* The shape cut into each binding tip, drawn beside the antigen it accepts. */}
      <g transform="translate(-20 -22)"><Shape kind={antigen} size={7.5} fill={BLUE} stroke={BLUE_EDGE} hollow /></g>
      <g transform="translate(20 -22)"><Shape kind={antigen} size={7.5} fill={BLUE} stroke={BLUE_EDGE} hollow /></g>
      {!ghost && (
        <g transform="translate(0 20)" aria-hidden="true">
          <circle r={11} fill={PLATE} stroke={BLUE_EDGE} strokeWidth={2} />
          <path d="M -5 -2 h 10 M -5 2 h 10" stroke={BLUE_EDGE} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

/** A phagocyte with an irregular cell membrane, lobed nucleus and a newly formed vacuole when full. */
function Phagocyte({ full }: { full: number }) {
  const open = full > 0
  return (
    <g transform="translate(284 211)" data-phagocyte="" style={{ transition: 'transform 650ms ease' }}>
      <path
        d={open
          ? 'M -39 -10 C -48 -26 -30 -44 -13 -39 C 0 -51 23 -43 27 -29 C 45 -27 50 -7 38 5 C 44 25 23 42 6 36 C -11 47 -34 34 -33 18 C -49 12 -50 1 -39 -10 Z'
          : 'M -39 -10 C -45 -29 -26 -43 -10 -38 C 5 -48 27 -39 29 -25 C 46 -20 47 0 36 10 C 37 30 14 42 -2 34 C -20 43 -40 28 -34 12 C -48 6 -49 -1 -39 -10 Z'}
        fill={CELL} stroke={CELL_EDGE} strokeWidth={2.4}
      />
      <path d="M -29 -17 C -21 -31 -5 -34 8 -28" fill="none" stroke={CYTO} strokeWidth={6} strokeLinecap="round" />
      <path d="M -16 -3 C -22 -16 -5 -21 1 -12 C 12 -20 22 -7 14 2 C 19 14 1 19 -4 10 C -16 17 -24 5 -16 -3 Z" fill={PURPLE} stroke={PURPLE_EDGE} strokeWidth={1.8} />
      {open && VACUA.slice(0, full).map((v) => <circle key={v.x} cx={v.x - 284} cy={v.y - 211} r={v.r} fill={VAC} stroke={CELL_EDGE} strokeWidth={1.2} />)}
      <circle cx={-23} cy={15} r={3} fill={CYTO} stroke={CELL_EDGE} strokeWidth={1} />
    </g>
  )
}

function Lymphocyte() {
  return (
    <g transform="translate(45 221)">
      <circle r={27} fill={CYTO} stroke={CELL_EDGE} strokeWidth={2.2} />
      <circle cx={-2} cy={-1} r={19} fill={PURPLE} stroke={PURPLE_EDGE} strokeWidth={1.8} />
      <path d="M -12 -11 C -4 -16 8 -13 12 -6" fill="none" stroke="#B7A7CD" strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

function antigenName(a: Antigen) { return a === 'circle' ? 'round' : a }

function describe(config: ImmuneConfig, tagged: string[], engulfed: string[]): string {
  const shapes = bacteriaFor(config).map((b) => `${antigenName(b.antigen)} antigen`).join(', ')
  return `Three bacteria with ${shapes}. A lymphocyte, one draggable Y-shaped antibody, and a phagocyte. ${tagged.length ? `${tagged.length} ${tagged.length === 1 ? 'bacterium is' : 'bacteria are'} tagged. ` : ''}${engulfed.length ? `${engulfed.length} ${engulfed.length === 1 ? 'bacterium is' : 'bacteria are'} inside the phagocyte.` : ''}`
}

export function ImmuneResponseView({ config, state, setState, marked, reduced, locked }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const now = marked === 'shown' || marked === 'right' ? immuneResponseEngine.solve(config) : state
  const tagged = taggedOf(config, now)
  const [engulfed, setEngulfed] = useState<string[]>(reduced ? tagged : [])
  const [drag, setDrag] = useState<Point | null>(null)
  const [wrong, setWrong] = useState<{ id: string; at: number } | null>(null)
  const [focus, setFocus] = useState(false)
  const [chosen, setChosen] = useState(0)
  const [said, setSaid] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const latest = useRef({ config, tagged, reduced, locked })
  latest.current = { config, tagged, reduced, locked }
  const bacteria = bacteriaFor(config)
  const antigen = (['triangle', 'square', 'circle'] as const).includes(config.antigen as Antigen) ? config.antigen as Antigen : 'triangle'
  // Every remaining bacterium can be tried: testing a mismatch is the specificity experiment.
  const active = bacteria.filter((b) => !tagged.includes(b.id))
  const finished = marked === 'right' || marked === 'shown'
  const shownEngulfed = finished ? tagged : engulfed
  const live = !locked && !finished && active.length > 0

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  useEffect(() => {
    setEngulfed(reduced ? tagged : [])
    setDrag(null)
    setWrong(null)
    timers.current.forEach(clearTimeout)
    timers.current = []
    // Reduced motion and a newly marked answer both go straight to their meaningful end frame.
  }, [config.task, config.antigen, reduced, finished])
  useEffect(() => {
    if (reduced || finished) setEngulfed(tagged)
  }, [reduced, finished, tagged.join(',')])

  const settle = (b: Bacterium, fit: boolean) => {
    const l = latest.current
    if (!fit) {
      setWrong({ id: b.id, at: Date.now() })
      setSaid(`The antibody did not attach to the ${antigenName(b.antigen)} antigen.`)
      const t = setTimeout(() => setWrong(null), 700)
      timers.current.push(t)
      return
    }
    setState({ tagged: [...new Set([...l.tagged, b.id])] })
    setSaid(`The antibody attached to the ${antigenName(b.antigen)} antigen. The phagocyte is taking in the tagged bacterium.`)
    if (l.reduced) setEngulfed((old) => [...new Set([...old, b.id])])
    else {
      const t = setTimeout(() => setEngulfed((old) => [...new Set([...old, b.id])]), ENGULF_AT)
      timers.current.push(t)
    }
  }

  const nearest = (p: Point) => active.slice().sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0]
  const pointAt = (e: PointerEvent) => {
    const el = svg.current
    if (!el) return REST
    const box = el.getBoundingClientRect()
    return { x: ((e.clientX - box.left) / box.width) * W, y: ((e.clientY - box.top) / box.height) * H }
  }
  const drop = (p: Point) => {
    const b = nearest(p)
    setDrag(null)
    if (b && Math.hypot(p.x - b.x, p.y - b.y) <= TARGET_DISTANCE) settle(b, b.antigen === antigen)
    else setSaid('The antibody returned to the lymphocyte.')
  }

  const keyboardDrop = (index: number) => {
    if (!live) return
    const b = active[index % active.length]
    if (b) settle(b, b.antigen === antigen)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      e.stopPropagation()
      const by = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
      const next = (chosen + by + active.length) % active.length
      setChosen(next)
      setSaid(`Bacterium with a ${antigenName(active[next].antigen)} antigen. Enter releases the antibody towards it.`)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      keyboardDrop(chosen)
    }
  }

  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (!live) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag(pointAt(e))
  }

  const attachedAt = (b: Bacterium): Point => ({ x: b.x, y: b.y - 11 })
  const verdict = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const antibodyPoint = drag ?? REST
  const near = drag ? nearest(drag) : null
  const nearEnough = near && Math.hypot(drag!.x - near.x, drag!.y - near.y) <= TARGET_DISTANCE

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg
          ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, tagged, shownEngulfed)}
          className={`block h-auto w-full select-none ${live ? 'touch-none' : ''}`}
        >
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {/* A shallow vessel: a continuous wall and fluid, not a second boxed panel. */}
          <path d="M 16 24 V 119 Q 16 140 37 140 H 323 Q 344 140 344 119 V 24" fill={VESSEL} stroke={VESSEL_EDGE} strokeWidth={2} strokeLinecap="round" />
          <path d="M 16 24 H 10 M 344 24 H 350" stroke={VESSEL_EDGE} strokeWidth={2.4} strokeLinecap="round" />
          <Label x={180} y={18}>fluid around the cells</Label>

          {bacteria.filter((b) => !shownEngulfed.includes(b.id)).map((b) => {
            const waiting = tagged.includes(b.id)
            const travelling = waiting && !reduced
            return (
              <g key={b.id}>
                <g style={{
                  transform: travelling ? `translate(${VACUA[0].x - b.x}px, ${VACUA[0].y - b.y}px) scale(.18)` : 'translate(0 0) scale(1)',
                  transformOrigin: `${b.x}px ${b.y}px`, transition: reduced ? undefined : EASE,
                }}>
                  <g transform={`translate(${b.x} ${b.y})`}>
                    <g style={{ transition: reduced ? undefined : 'transform 350ms ease', transform: !reduced && wrong?.id === b.id ? 'translateX(5px)' : undefined }}>
                      <BacteriumBody b={b} attached={waiting} />
                    </g>
                  </g>
                  {!travelling && <Label x={b.x} y={117} color={GOLD_EDGE}>{`${antigenName(b.antigen)} antigen`}</Label>}
                </g>
              </g>
            )
          })}
          <Label x={180} y={134}>bacteria</Label>

          {/* Cell labels are directly beneath their own cell. */}
          <Lymphocyte />
          <Label x={45} y={261} color={PURPLE_EDGE}>lymphocyte</Label>
          <Phagocyte full={shownEngulfed.length} />
          <Label x={284} y={261} color={CELL_EDGE}>phagocyte</Label>

          {/* Engulfed bacteria remain visible in a vacuole: an event, not a tick. */}
          {shownEngulfed.map((id, i) => {
            const b = bacteria.find((x) => x.id === id)!
            return (
              <g key={id} transform={`translate(${VACUA[i].x} ${VACUA[i].y}) scale(.18)`} data-engulfed={id}>
                <BacteriumBody b={b} attached />
                <Antibody at={{ x: 0, y: -11 }} antigen={antigen} dragging={false} ghost />
              </g>
            )
          })}

          {/* Bound antibodies travel with their bacteria; only one free antibody is ever offered. */}
          {tagged.filter((id) => !shownEngulfed.includes(id)).map((id) => {
            const b = bacteria.find((x) => x.id === id)!
            const at = reduced ? attachedAt(b) : { x: VACUA[0].x, y: VACUA[0].y - 11 * 0.18 }
            return <g key={id} style={{ transform: `translate(${at.x - b.x}px, ${at.y - (b.y - 2)}px) scale(${reduced ? 1 : 0.18})`, transformOrigin: `${b.x}px ${b.y - 11}px`, transition: reduced ? undefined : EASE }}><Antibody at={attachedAt(b)} antigen={antigen} dragging={false} ghost /></g>
          })}
          {live && (
            <>
              {nearEnough && drag && <circle cx={near.x} cy={near.y} r={47} fill="none" stroke={BLUE} strokeWidth={2} strokeDasharray="4 5" />}
              <g
                role="slider" tabIndex={0} aria-label="Y-shaped antibody. Drag it onto a bacterium, or use left and right arrows then Enter"
                aria-valuemin={0} aria-valuemax={Math.max(0, active.length - 1)} aria-valuenow={Math.min(chosen, Math.max(0, active.length - 1))}
                aria-valuetext={`Antibody near the ${antigenName(active[Math.min(chosen, active.length - 1)]?.antigen ?? antigen)} antigen`}
                onKeyDown={onKey} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                onPointerDown={onPointerDown}
                onPointerMove={(e) => { if (drag) setDrag(pointAt(e)) }}
                onPointerUp={(e) => { if (drag) drop(pointAt(e)) }}
                onPointerCancel={() => setDrag(null)}
                className={`outline-none focus-visible:outline-none ${live ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <g style={{ transition: drag || reduced ? undefined : EASE }}>
                  <Antibody at={antibodyPoint} antigen={antigen} dragging={!!drag} />
                </g>
                {focus && <circle cx={antibodyPoint.x} cy={antibodyPoint.y + 4} r={39} fill="none" stroke="var(--subject)" strokeWidth={2.5} />}
              </g>
            </>
          )}
          {live && <Label x={105} y={284} color={BLUE_EDGE}>antibody</Label>}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Only a complementary antigen holds the antibody.
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Tagged bacteria</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-tagged={tagged.length}>{tagged.length}</span>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
