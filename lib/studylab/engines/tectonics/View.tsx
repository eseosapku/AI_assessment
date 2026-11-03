'use client'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { Arrow, Building, Dir, Inset, Kind, Mat, Poly, Scene, Seg, Tag, TectConfig, TectState } from './config'
import { RUN, STEPS, describe, madeText, sceneOf, tectonicsEngine, working } from './config'

type Props = SceneViewProps<TectConfig, TectState>

// A section of the Earth is not a dark subject: a quiet plate with real rock on it, as measure-shape's and network-sim's are.
// The plate keeps its own colours in both themes. Flat fills only, no gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const ROCK: Record<Mat, string> = {
  sea: '#C3DAEC',
  mantle: '#E2A45F',
  lith: '#B39370',
  basalt: '#48596B',
  basalt2: '#5E7288',
  strataA: '#DCCBA9',
  strataB: '#C9AE88',
  strataC: '#B6957A',
  granite: '#9D9188',
  magma: '#DC4528',
  cone: '#6E5446',
}
const MAGMA = '#DC4528'
const FOCUS = '#C2261B'
const FAULT = '#2A3441'

export const W = 360
export const H = 240
/** The picture is cropped from the top: the sky above the highest peak is not drawn. */
export const TOP = 14

const f1 = (n: number) => n.toFixed(1)
const pointsOf = (pts: { x: number; y: number }[]) => pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')

/** The time that has passed, eased towards where it should be: it restarts from nothing when the movement changes. */
function useEased(target: number, key: string, reduced: boolean): number {
  const [st, setSt] = useState({ key, v: target })
  const cur = useRef(target)
  useEffect(() => {
    if (reduced) {
      cur.current = target
      setSt({ key, v: target })
      return
    }
    if (st.key !== key) cur.current = 0
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      const d = target - cur.current
      if (Math.abs(d) < 0.002) {
        cur.current = target
        setSt({ key, v: target })
        return
      }
      const step = Math.sign(d) * Math.max(Math.abs(d) * dt * 4, 0.22 * dt)
      cur.current = Math.abs(step) >= Math.abs(d) ? target : cur.current + step
      setSt({ key, v: cur.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- st.key is read once per change of target or key
  }, [target, key, reduced])
  return reduced ? target : st.key === key ? st.v : 0
}

function PolyShape({ poly }: { poly: Poly }) {
  return <polygon points={pointsOf(poly.pts)} fill={ROCK[poly.m]} stroke={ROCK[poly.m]} strokeWidth={0.6} strokeLinejoin="round" />
}

function SegLine({ seg }: { seg: Seg }) {
  if (seg.w <= 0.2) return null
  const colour = seg.kind === 'conduit' ? MAGMA : FAULT
  return <polyline points={pointsOf(seg.pts)} fill="none" stroke={colour} strokeWidth={seg.w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={seg.kind === 'fault' && seg.pts[0].x !== seg.pts[1].x ? '5 3' : undefined} />
}

/** A plate's arrow: a short shaft with a head, dark enough to read on tan rock. */
function ArrowMark({ a }: { a: Arrow }) {
  const x1 = a.x - a.dx * 16
  const x2 = a.x + a.dx * 16
  return (
    <g stroke={FAULT} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" data-arrow={a.dx}>
      <line x1={x1} y1={a.y} x2={x2} y2={a.y} />
      <path d={`M ${x2 - a.dx * 7} ${a.y - 6} L ${x2} ${a.y} L ${x2 - a.dx * 7} ${a.y + 6}`} />
    </g>
  )
}

/** The rock itself: it does not change while an earthquake runs, so it is drawn once. */
const Rock = memo(function Rock({ polys, segs }: { polys: Poly[]; segs: Seg[] }) {
  return (
    <g>
      {polys.map((p, i) => <PolyShape key={i} poly={p} />)}
      {segs.map((g, i) => <SegLine key={i} seg={g} />)}
    </g>
  )
})

const ease = (v: number) => v * v * (3 - 2 * v)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** A house or a tree on the ground, which rocks or topples when the shaking reaches it. */
function Thing({ b, i, tilt }: { b: Building; i: number; tilt: number }) {
  const side = i % 2 === 0 ? 1 : -1
  return (
    <g transform={`translate(${f1(b.x)} ${f1(b.y)}) rotate(${f1(tilt * side)})`} data-thing={b.kind}>
      {b.kind === 'house' ? (
        <>
          <rect x={-7} y={-10} width={14} height={11} fill="#EADCC3" stroke="#6E5446" strokeWidth={1.2} />
          <path d="M -9 -10 L 0 -18 L 9 -10 Z" fill="#B5533C" stroke="#6E5446" strokeWidth={1.2} strokeLinejoin="round" />
          <rect x={-2} y={-6} width={4} height={7} fill="#6E5446" />
        </>
      ) : (
        <>
          <rect x={-1.5} y={-8} width={3} height={9} fill="#6E5446" />
          <circle cy={-13} r={7} fill="#5E8A4E" stroke="#3F6334" strokeWidth={1.2} />
        </>
      )}
    </g>
  )
}

/** The earthquake, from the first catch of the rock to the last ring: q runs from 0 to 1. A deep one rings wide and soft, a shallow one tight and hard. */
function QuakeLayer({ sc, q }: { sc: Scene; q: number }) {
  const f = sc.focus
  if (!f) return null
  const deep = sc.deep
  const R = deep ? 150 : 85
  const jolt = clamp01((q - 0.25) / 0.2)
  const slipD = q < 0.25 ? 0 : 7 * ease(clamp01((q - 0.25) / 0.15))
  const nx = -sc.slip.y
  const ny = sc.slip.x
  const streak = (side: 1 | -1) => {
    const ox = nx * 3 * side + sc.slip.x * slipD * side
    const oy = ny * 3 * side + sc.slip.y * slipD * side
    return <line key={side} x1={f1(f.x + ox - sc.slip.x * 9)} y1={f1(f.y + oy - sc.slip.y * 9)} x2={f1(f.x + ox + sc.slip.x * 9)} y2={f1(f.y + oy + sc.slip.y * 9)} stroke="#FFF1B8" strokeWidth={2.4} strokeLinecap="round" />
  }
  return (
    <g data-quake={q.toFixed(2)} aria-hidden="true">
      {[0, 1, 2].map((i) => {
        const p = clamp01((q - 0.25 - i * 0.1) / 0.6)
        if (p <= 0 || p >= 1) return null
        return (
          <g key={i} fill="none" opacity={(1 - p) * 0.95}>
            <circle cx={f.x} cy={f.y} r={R * p} stroke="#FFFFFF" strokeWidth={deep ? 3 : 4.5} />
            <circle cx={f.x} cy={f.y} r={R * p} stroke={FOCUS} strokeWidth={deep ? 1.4 : 2.2} />
          </g>
        )
      })}
      {q > 0 && q < 0.25 && <circle cx={f.x} cy={f.y} r={5 + 3 * Math.sin(q * 90)} fill="none" stroke={FOCUS} strokeWidth={1.6} strokeDasharray="2 2" />}
      {q > 0 && q < 0.7 && (
        <>
          {streak(1)}
          {streak(-1)}
        </>
      )}
      {q >= 0.25 && q < 0.45 && <circle cx={f.x} cy={f.y} r={4 + 10 * (1 - jolt)} fill="#FFE08A" opacity={0.9 * (1 - jolt)} />}
      <circle cx={f.x} cy={f.y} r={5.4} fill={FOCUS} stroke="#FFFFFF" strokeWidth={1.6} />
      {q >= 0.25 && <circle cx={f.x} cy={f.y} r={9} fill="none" stroke={FOCUS} strokeWidth={1.4} />}
    </g>
  )
}

/** Lava and ash leaving each vent. */
function Eruption({ vents, q }: { vents: { x: number; y: number }[]; q: number }) {
  const e = clamp01((q - 0.1) / 0.85)
  if (e <= 0 || e >= 1) return null
  const fade = e > 0.7 ? 1 - (e - 0.7) / 0.3 : 1
  return (
    <g aria-hidden="true" opacity={fade} data-eruption="1">
      {vents.map((v, vi) => (
        <g key={vi}>
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={f1(v.x + (k - 1) * 3 + Math.sin(e * 6 + k + vi) * 2)} cy={f1(v.y - 12 - e * (18 + k * 9))} r={4 + e * 5 + k * 1.5} fill="#8E9299" opacity={0.75 - k * 0.12} />
          ))}
          {[-1.6, -0.8, 0, 0.8, 1.6].map((k, j) => {
            const s = e * 1.4
            return <circle key={j} cx={f1(v.x + k * 12 * s)} cy={f1(v.y - (34 * s - 30 * s * s) - 2)} r={2.6} fill={MAGMA} stroke="#FFD08A" strokeWidth={0.8} />
          })}
        </g>
      ))}
    </g>
  )
}

/** From above: two plates sliding past each other, and a road that breaks across the boundary. */
function InsetView({ inset }: { inset: Inset }) {
  const b = inset.box
  return (
    <g aria-hidden="true" data-inset="1">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {inset.plates.map((p, i) => <polygon key={i} points={pointsOf(p.pts)} fill={ROCK[p.m]} />)}
      {inset.road.map((r, i) => (
        <g key={i} fill="none">
          <polyline points={pointsOf(r)} stroke="#4B5563" strokeWidth={8} />
          <polyline points={pointsOf(r)} stroke="#F3F4F6" strokeWidth={1.4} strokeDasharray="5 4" />
        </g>
      ))}
      <polyline points={pointsOf(inset.fault)} fill="none" stroke={FAULT} strokeWidth={1.8} strokeDasharray="4 3" />
      {inset.arrows.map((a, i) => {
        const dy = a.y2 > a.y1 ? 1 : -1
        return (
          <g key={i} stroke={FAULT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <line x1={a.x} y1={a.y1} x2={a.x} y2={a.y2} />
            <path d={`M ${a.x - 5} ${a.y2 - dy * 6} L ${a.x} ${a.y2} L ${a.x + 5} ${a.y2 - dy * 6}`} />
          </g>
        )
      })}
    </g>
  )
}

/** One run of the earthquake and the eruption once the plates have moved: about two and a half seconds. */
function useQuake(runKey: string, ready: boolean, active: boolean, reduced: boolean, replay: number): number {
  const [q, setQ] = useState(reduced ? 0.75 : 0)
  const last = useRef('')
  useEffect(() => {
    if (!reduced) setQ(0)
  }, [runKey, replay, reduced])
  useEffect(() => {
    if (reduced) {
      setQ(active ? 0.75 : 0)
      return
    }
    if (!active || !ready) return
    const id = `${runKey}|${replay}`
    if (last.current === id) return
    last.current = id
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / 2500)
      setQ(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    setQ(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [runKey, ready, active, reduced, replay])
  return q
}

function Names({ tags, answer }: { tags: Tag[]; answer: boolean }) {
  return (
    <g fontFamily={FONT} aria-hidden="true">
      {tags.map((t) => (
        <g key={t.text}>
          {t.leader && <line x1={t.x} y1={t.y + 4} x2={t.part.x} y2={t.part.y - 2} stroke={SOFT} strokeWidth={1} strokeDasharray="2 2" />}
          <text
            x={f1(t.x)} y={f1(t.y)} textAnchor={t.anchor} fontSize={12} fontWeight={700} fill={INK}
            stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-tag={answer ? 'answer' : 'part'}
          >{t.text}</text>
        </g>
      ))}
    </g>
  )
}

const Icon = ({ dir }: { dir: Dir }) => (
  <svg viewBox="0 0 26 12" className="h-3 w-[26px] shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {dir === 'apart' && <path d="M 11 6 H 2 M 5 3 L 2 6 L 5 9 M 15 6 H 24 M 21 3 L 24 6 L 21 9" />}
    {dir === 'together' && <path d="M 2 6 H 11 M 8 3 L 11 6 L 8 9 M 24 6 H 15 M 18 3 L 15 6 L 18 9" />}
    {dir === 'past' && <path d="M 9 10 V 2 M 6 5 L 9 2 L 12 5 M 17 2 V 10 M 14 7 L 17 10 L 20 7" />}
  </svg>
)

const NAMES: Record<Dir, { label: string; aria: string }> = {
  apart: { label: 'Pull apart', aria: 'Pull the plates apart' },
  past: { label: 'Slide past', aria: 'Slide the plates past each other' },
  together: { label: 'Push together', aria: 'Push the plates together' },
}

const Key = ({ colour, children, ring }: { colour: string; children: string; ring?: boolean }) => (
  <span className="flex items-center gap-1 whitespace-nowrap">
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      {ring ? <circle cx={6} cy={6} r={4.4} fill={colour} stroke="#FFFFFF" strokeWidth={1.2} /> : <rect x={1} y={2} width={10} height={8} rx={2} fill={colour} />}
    </svg>
    {children}
  </span>
)

export function TectonicsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? tectonicsEngine.solve(config) : state
  const left = config.left as Kind
  const right = config.right as Kind
  const t = useEased(now.step / STEPS, String(now.dir), reduced)
  const sc = useMemo(() => sceneOf(left, right, now.dir, t), [left, right, now.dir, t])
  const [replay, setReplay] = useState(0)
  const settled = Math.abs(t - now.step / STEPS) < 0.01
  const active = sc.focus !== null || sc.vents.length > 0
  const q = useQuake(`${now.dir}-${now.step}`, settled, active, reduced, replay)
  // The shaking reaches the surface later from deeper down, and weaker.
  const onset = 0.25 + (0.5 * Math.max(0, (sc.focus?.y ?? 100) - 92)) / (sc.deep ? 150 : 85)
  const env = q <= 0 || reduced ? 0 : clamp01((q - onset) / 0.08) * (1 - clamp01((q - onset) / 0.5))
  const amp = sc.deep ? 1.4 : 3.2
  const shx = amp * env * Math.sin(q * 160)
  const shy = amp * 0.6 * env * Math.cos(q * 190)
  // A shallow quake topples some houses and trees and rocks the rest; a deep one only rocks them.
  const tiltOf = (i: number) => {
    const p = ease(clamp01((q - onset) / 0.3))
    if (sc.deep) return 5 * env * Math.sin(q * 120 + i)
    const target = i % 3 === 0 ? 78 : i % 3 === 1 ? 0 : 60
    return target * p + (i % 3 === 1 ? 7 * env * Math.sin(q * 140 + i) : 0)
  }
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const showNames = marked !== 'idle'

  const move = (d: Dir) => {
    if (frozen || now.dir === d) return
    setState({ dir: d, step: RUN })
  }
  const bump = (by: number) => {
    if (frozen || now.dir === null) return
    const step = Math.max(0, Math.min(STEPS, now.step + by))
    if (step !== now.step) setState({ dir: now.dir, step })
  }

  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : null
  const btn = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]'

  return (
    <div
      className="nodrag flex w-full max-w-[380px] flex-col gap-2"
      onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}
    >
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 ${TOP} ${W} ${H - TOP}`} role="img" aria-label={describe(left, right, now.dir, now.step)} className="block h-auto w-full select-none">
          <defs>
            <clipPath id="tect-clip"><rect x={1.5} y={TOP + 1.5} width={W - 3} height={H - TOP - 3} rx={15} /></clipPath>
          </defs>
          <rect x={0.75} y={TOP + 0.75} width={W - 1.5} height={H - TOP - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <g clipPath="url(#tect-clip)">
            <g transform={`translate(${f1(shx)} ${f1(shy)})`}>
              <Rock polys={sc.polys} segs={sc.segs} />
              {q > 0 && sc.segs.filter((g) => g.kind === 'conduit' && g.w > 0.5).map((g, i) => (
                <polyline key={i} points={pointsOf(g.pts)} fill="none" stroke="#FFD39A" strokeWidth={Math.max(1, g.w * 0.45)} strokeLinecap="round" strokeDasharray="2 7" strokeDashoffset={reduced ? 0 : f1(-q * 90)} />
              ))}
              {sc.arrows.map((a, i) => <ArrowMark key={i} a={a} />)}
              {sc.foci.map((p, i) => <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={3.8} fill={FOCUS} stroke="#FFFFFF" strokeWidth={1.3} data-focus="1" />)}
              {sc.buildings.map((b, i) => <Thing key={i} b={b} i={i} tilt={tiltOf(i)} />)}
              <QuakeLayer sc={sc} q={q} />
              <Eruption vents={sc.vents} q={q} />
            </g>
            {sc.inset && <InsetView inset={sc.inset} />}
            <Names tags={sc.tags} answer={false} />
            {showNames && <Names tags={sc.answerTags} answer />}
          </g>
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Key colour={FOCUS} ring>Earthquake focus</Key>
          <Key colour={MAGMA}>Magma</Key>
          <span className="whitespace-nowrap">A plate is crust on a slab of stiff mantle</span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label="How the plates move" className="grid grid-cols-3 gap-1.5">
          {(['apart', 'past', 'together'] as Dir[]).map((d) => {
            const on = now.dir === d
            return (
              <button
                key={d} type="button" aria-label={NAMES[d].aria} aria-pressed={on} disabled={frozen && !on} onClick={() => move(d)} data-dir={d}
                className={`nodrag flex h-9 min-w-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-1 text-[12px] font-bold touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default motion-reduce:transition-none ${on ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]'}`}
              >
                <Icon dir={d} />
                {NAMES[d].label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Time passed</span>
            <button
              type="button" aria-label="Replay the earthquake" disabled={!active} onClick={() => setReplay((n) => n + 1)}
              className="nodrag h-7 select-none whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold text-ss-slate touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] motion-reduce:transition-none"
            >Replay</button>
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Less time" className={btn} disabled={frozen || now.dir === null || now.step <= 0} onClick={() => bump(-1)}>−</button>
            <span className="min-w-[56px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-step={now.step}>{now.step} of {STEPS}</span>
            <button type="button" aria-label="More time" className={btn} disabled={frozen || now.dir === null || now.step >= STEPS} onClick={() => bump(1)}>+</button>
          </span>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{now.dir === null ? 'The plates are still.' : `Time passed ${now.step} of ${STEPS}.`}</span>
      {said && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said.lead}</p>
          {said.more && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{said.more}</p>}
        </div>
      )}
    </div>
  )
}
