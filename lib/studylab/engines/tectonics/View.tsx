'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { Arrow, Dir, Kind, Mark, Mat, Poly, Seg, Tag, TectConfig, TectState } from './config'
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

/** The sign for a plate moving towards you (a dot) or away from you (a cross), as in any textbook section. */
function Sign({ m }: { m: Mark }) {
  return (
    <g transform={`translate(${m.x} ${m.y})`} data-sign={m.kind}>
      <circle r={9} fill={PLATE} stroke={FAULT} strokeWidth={1.8} />
      {m.kind === 'out' ? <circle r={2.8} fill={FAULT} /> : <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke={FAULT} strokeWidth={2} strokeLinecap="round" />}
    </g>
  )
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
            {sc.polys.map((p, i) => <PolyShape key={i} poly={p} />)}
            {sc.segs.map((s, i) => <SegLine key={i} seg={s} />)}
            {sc.arrows.map((a, i) => <ArrowMark key={i} a={a} />)}
            {sc.marks.map((m, i) => <Sign key={i} m={m} />)}
            {sc.foci.map((p, i) => <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={3.8} fill={FOCUS} stroke="#FFFFFF" strokeWidth={1.3} data-focus="1" />)}
            <Names tags={sc.tags} answer={false} />
            {showNames && <Names tags={sc.answerTags} answer />}
          </g>
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Key colour={FOCUS} ring>Earthquake</Key>
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
          <span className="text-[12px] font-bold text-ss-slate">Time passed</span>
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
