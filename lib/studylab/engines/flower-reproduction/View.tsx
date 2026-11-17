'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { FlowerConfig, FlowerState, PartName, Pt } from './config'
import { flowerOf, land, madeSentence, reached, stigmaGrains } from './config'

// The flower's own drawing on a pale plate, like a diagram in a book. UI around it uses the design tokens.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GREEN = '#7FAE4E'
const GREEN_EDGE = '#3F6B2A'
const POLLEN = '#F6D44A'
const POLLEN_EDGE = '#A87A0A'
const ANTHER = '#D49A1A'
const ANTHER_EDGE = '#7A4F08'
const OVULE = '#F4E7BE'
const OVULE_EDGE = '#9A7B2C'
const SEED = '#8A5A2B'
const SEED_EDGE = '#4E2F12'
const TUBE = '#D9822B'
const HANDLE = '#1D4ED8'
const PETALS = {
  buttercup: { front: '#F7CD2B', back: '#FADF73', edge: '#B8890A', vein: '#DDAE15' },
  poppy: { front: '#E5473B', back: '#EE7F73', edge: '#9B2119', vein: '#C23227' },
  geranium: { front: '#DE6FA4', back: '#EBA0C6', edge: '#9C3A6E', vein: '#C4568A' },
} as const

export const W = 360
export const H = 300
/** The view's own copies of the config's limits: the two files import each other, so nothing is read from it at load. */
const OVARY_TOP = 182
const STYLE_X = 180
const STIGMA_Y = 82

type Zone = { part: PartName; c: Pt; r: number; perch: Pt }
export const ZONES: Zone[] = [
  { part: 'anther', c: { x: 132, y: 106 }, r: 24, perch: { x: 132, y: 80 } },
  { part: 'anther', c: { x: 228, y: 106 }, r: 24, perch: { x: 228, y: 80 } },
  { part: 'stigma', c: { x: 180, y: 82 }, r: 26, perch: { x: 180, y: 54 } },
  { part: 'style', c: { x: 180, y: 140 }, r: 16, perch: { x: 204, y: 140 } },
  { part: 'ovary', c: { x: 180, y: 218 }, r: 36, perch: { x: 224, y: 204 } },
  { part: 'petal', c: { x: 76, y: 170 }, r: 42, perch: { x: 76, y: 160 } },
  { part: 'petal', c: { x: 284, y: 170 }, r: 42, perch: { x: 284, y: 160 } },
  { part: 'filament', c: { x: 124, y: 168 }, r: 14, perch: { x: 110, y: 176 } },
  { part: 'filament', c: { x: 236, y: 168 }, r: 14, perch: { x: 250, y: 176 } },
  { part: 'sepal', c: { x: 124, y: 270 }, r: 16, perch: { x: 112, y: 262 } },
  { part: 'sepal', c: { x: 236, y: 270 }, r: 16, perch: { x: 248, y: 262 } },
]
export const BEE_START: Pt = { x: 56, y: 40 }

/** The zone a point is in, if any: the one it is most inside. */
export function zoneAt(p: Pt): Zone | null {
  let best: Zone | null = null
  let bestScore = 1
  for (const z of ZONES) {
    const score = Math.hypot(p.x - z.c.x, p.y - z.c.y) / z.r
    if (score < bestScore) { best = z; bestScore = score }
  }
  return best
}

/** Where the ovules sit in the ovary, for each count. Each is 20 across, with room round it. */
export const OVULE_R = 10
export const OVULE_LAYOUT: Record<number, Pt[]> = {
  2: [{ x: 166, y: 212 }, { x: 194, y: 230 }],
  3: [{ x: 165, y: 206 }, { x: 195, y: 206 }, { x: 180, y: 232 }],
  4: [{ x: 165, y: 204 }, { x: 195, y: 204 }, { x: 165, y: 232 }, { x: 195, y: 232 }],
  5: [{ x: 163, y: 202 }, { x: 197, y: 202 }, { x: 180, y: 218 }, { x: 163, y: 237 }, { x: 197, y: 237 }],
}
export const ovulesAt = (n: number): Pt[] => OVULE_LAYOUT[Math.max(2, Math.min(5, Math.round(n) || 4))]
/** Where the pollen grains sit on the stigma. */
export const GRAIN_LAYOUT: Record<number, Pt[]> = {
  1: [{ x: 180, y: 76 }],
  2: [{ x: 168, y: 76 }, { x: 192, y: 76 }],
  3: [{ x: 160, y: 77 }, { x: 180, y: 73 }, { x: 200, y: 77 }],
}
export const grainsAt = (n: number): Pt[] => GRAIN_LAYOUT[Math.max(1, Math.min(3, Math.round(n) || 2))]
const GRAIN_R = 6.5
const SNAP = 26

const lineX = (i: number, n: number) => STYLE_X + (i - (n - 1) / 2) * 2.8
/** A tube's tip for a pointer at p: down the style first, then free inside the ovary. */
export function tipFor(i: number, n: number, p: Pt): Pt {
  const g = grainsAt(n)[i]
  const x = lineX(i, n)
  if (p.y < OVARY_TOP) return { x, y: Math.max(g.y + 4, p.y) }
  return { x: Math.max(152, Math.min(208, p.x)), y: Math.min(246, p.y) }
}
/** The tube from its grain to its tip, as the points it passes. */
export function tubePoints(i: number, n: number, tip: Pt): Pt[] {
  const g = grainsAt(n)[i]
  const x = lineX(i, n)
  const pts: Pt[] = [{ x: g.x, y: g.y + 2 }, { x, y: g.y + 12 }]
  if (tip.y > g.y + 12) pts.push({ x, y: Math.min(tip.y, OVARY_TOP) })
  if (tip.y > OVARY_TOP) pts.push(tip)
  return pts
}
/** The point on an ovule's rim that a tube enters by, from above. */
const micropyle = (o: Pt): Pt => ({ x: o.x, y: o.y - OVULE_R + 1 })
export function endPoints(i: number, n: number, o: Pt): Pt[] {
  const g = grainsAt(n)[i]
  const x = lineX(i, n)
  const m = micropyle(o)
  return [{ x: g.x, y: g.y + 2 }, { x, y: g.y + 12 }, { x, y: OVARY_TOP }, m]
}

const polyLength = (pts: Pt[]) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.y - pts[k].y), 0)
function along(pts: Pt[], f: number): Pt {
  let left = polyLength(pts) * f
  for (let k = 1; k < pts.length; k++) {
    const seg = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y)
    if (left <= seg || k === pts.length - 1) {
      const t = seg ? Math.min(1, left / seg) : 1
      return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t }
    }
    left -= seg
  }
  return pts[pts.length - 1]
}
const asPath = (pts: Pt[]) => pts.map((p, k) => `${k ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')

/** The male nucleus going down a finished tube, once, at walking pace. */
function Nucleus({ pts, reduced }: { pts: Pt[]; reduced: boolean }) {
  const [f, setF] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const v = Math.min(1, (now - t0) / 1300)
      setF(v)
      if (v < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])
  if (f >= 1) return null
  const p = along(pts, f)
  return <circle cx={p.x} cy={p.y} r={3.4} fill="#5B2C83" stroke="#FFFFFF" strokeWidth={1} pointerEvents="none" />
}

function Label({ x, y, text, anchor = 'start' }: { x: number; y: number; text: string; anchor?: 'start' | 'end' | 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={12.5} fontWeight={700} fill={INK} stroke="#FFFFFF" strokeWidth={3.4} paintOrder="stroke" strokeLinejoin="round" pointerEvents="none">{text}</text>
  )
}

function Bee({ at, loaded, lifted, focusable }: { at: Pt; loaded: boolean; lifted: boolean; focusable: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      <circle r={24} fill="#FFFFFF" fillOpacity={0.55} stroke={focusable ? HANDLE : EDGE} strokeWidth={1.5} strokeDasharray="4 4" />
      <ellipse cx={-3} cy={lifted ? -13 : -12} rx={9} ry={6} fill="#EAF2FB" stroke={SOFT} strokeWidth={1} transform="rotate(-18 -3 -12)" />
      <ellipse cx={5} cy={-12} rx={8} ry={5.5} fill="#EAF2FB" stroke={SOFT} strokeWidth={1} transform="rotate(14 5 -12)" />
      <ellipse rx={14} ry={9} fill="#F2B705" stroke={INK} strokeWidth={1.4} />
      <path d="M -3 -8.6 V 8.6 M 4 -8.4 V 8.4" stroke={INK} strokeWidth={3.4} />
      <circle cx={15} cy={-1} r={5.2} fill={INK} />
      <circle cx={16.5} cy={-2.4} r={1.2} fill="#FFFFFF" />
      <path d="M -14 0 L -19 1.5 L -14 3 Z" fill={INK} />
      <path d="M -6 8 L -8 13 M 2 8.5 L 2 13.5 M 9 7.5 L 11 12.5" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
      {loaded && [-7, 1, 9].map((x, k) => <circle key={k} cx={x} cy={14.5 + (k === 1 ? 1 : 0)} r={3.4} fill={POLLEN} stroke={POLLEN_EDGE} strokeWidth={1} />)}
    </g>
  )
}

function Grain({ at, r = GRAIN_R }: { at: Pt; r?: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={at.x} cy={at.y} r={r} fill={POLLEN} stroke={POLLEN_EDGE} strokeWidth={1.1} />
      <circle cx={at.x - r * 0.3} cy={at.y - r * 0.25} r={r * 0.18} fill={POLLEN_EDGE} />
      <circle cx={at.x + r * 0.35} cy={at.y + r * 0.1} r={r * 0.18} fill={POLLEN_EDGE} />
      <circle cx={at.x - r * 0.05} cy={at.y + r * 0.4} r={r * 0.18} fill={POLLEN_EDGE} />
    </g>
  )
}

/** The flower, cut in half: everything but the bee and the tubes. */
function Flower({ flower, seeds, fruit, ovules, fertilised, showAnthers, labels, stigmaGrainsOn, grainCount, grainsOnTop }: {
  flower: keyof typeof PETALS
  seeds: boolean
  fruit: boolean
  ovules: number
  fertilised: boolean[]
  showAnthers: boolean
  labels: 'pollinate' | 'fertilise'
  stigmaGrainsOn: number
  grainCount: number
  grainsOnTop: boolean
}) {
  const c = PETALS[flower]
  const mirror = (d: string) => d
  void mirror
  const lp = 'M 158 258 C 112 262 50 232 40 152 C 36 106 62 84 80 92 C 100 106 126 172 160 238 Z'
  const rp = 'M 202 258 C 248 262 310 232 320 152 C 324 106 298 84 280 92 C 260 106 234 172 200 238 Z'
  const o = ovulesAt(ovules)
  const swell = fruit ? 1.12 : 1
  return (
    <g>
      <path d="M 128 244 C 104 190 118 116 180 106 C 242 116 256 190 232 244 Z" fill={c.back} stroke={c.edge} strokeWidth={1.4} />
      <path d={lp} fill={c.front} stroke={c.edge} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={rp} fill={c.front} stroke={c.edge} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M 150 240 C 100 200 70 160 60 112 M 146 244 C 90 220 52 190 46 150 M 210 240 C 260 200 290 160 300 112 M 214 244 C 270 220 308 190 314 150" fill="none" stroke={c.vein} strokeWidth={1.1} strokeLinecap="round" />
      {/* stamens: filament and anther, one each side */}
      {[0, 1].map((s) => {
        const sx = (x: number) => (s ? W - x : x)
        return (
          <g key={s}>
            <path d={`M ${sx(158)} 256 C ${sx(118)} 240 ${sx(120)} 190 ${sx(131)} 122`} fill="none" stroke="#8DB35C" strokeWidth={3.6} strokeLinecap="round" />
            <g transform={`rotate(${s ? 5 : -5} ${sx(132)} 106)`}>
              <rect x={sx(132) - 9} y={91} width={18} height={30} rx={9} fill={ANTHER} stroke={ANTHER_EDGE} strokeWidth={1.4} />
              <path d={`M ${sx(132)} 94 V 118`} stroke={ANTHER_EDGE} strokeWidth={1.1} />
              {showAnthers && [[-5, 90], [0, 87.5], [5, 90], [-2.5, 93.5]].map(([dx, y], k) => <circle key={k} cx={sx(132) + dx} cy={y} r={2.2} fill={POLLEN} stroke={POLLEN_EDGE} strokeWidth={0.7} />)}
            </g>
          </g>
        )
      })}
      {/* stem, sepals and receptacle */}
      <rect x={174} y={262} width={12} height={40} fill="#6FA044" stroke={GREEN_EDGE} strokeWidth={1.3} />
      <path d="M 152 260 C 128 262 110 278 104 294 C 126 294 146 282 164 268 Z" fill="#5F9440" stroke={GREEN_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M 208 260 C 232 262 250 278 256 294 C 234 294 214 282 196 268 Z" fill="#5F9440" stroke={GREEN_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
      <ellipse cx={180} cy={256} rx={32} ry={9} fill="#7FAE4E" stroke={GREEN_EDGE} strokeWidth={1.4} />
      {/* the carpel */}
      <g transform={fruit ? `translate(180 252) scale(${swell}) translate(-180 -252)` : undefined}>
        <path d="M 146 184 C 138 202 138 238 150 254 L 210 254 C 222 238 222 202 214 184 Z" fill={fruit ? '#E6A04A' : '#BFDC8E'} stroke={fruit ? '#8A4F12' : GREEN_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <path d="M 176 90 L 176 186 M 184 90 L 184 186" stroke={GREEN_EDGE} strokeWidth={1.2} fill="none" />
      <path d="M 176 90 H 184 V 186 H 176 Z" fill="#D7EBA9" fillOpacity={0.9} />
      <path d="M 176 90 V 186 M 184 90 V 186" stroke={GREEN_EDGE} strokeWidth={1.2} />
      <path d="M 159 84 C 159 72 201 72 201 84 C 201 94 159 94 159 84 Z" fill="#EDB3D0" stroke="#A8467C" strokeWidth={1.5} />
      {[166, 173, 180, 187, 194].map((x, k) => <circle key={k} cx={x} cy={76 + (k % 2 ? 0.5 : -0.5)} r={3.4} fill="#F3C9DE" stroke="#A8467C" strokeWidth={1} />)}
      <path d="M 166 83 Q 180 88 194 83" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeOpacity={0.85} />
      {/* ovules */}
      {o.map((p, i) => {
        const done = fertilised[i]
        const seed = seeds && done
        const lost = seeds && !done
        const r = seed ? OVULE_R + 1.5 : lost ? OVULE_R - 3 : OVULE_R
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={r} fill={seed ? SEED : lost ? '#D8D2C0' : OVULE} stroke={seed ? SEED_EDGE : lost ? '#8B8672' : OVULE_EDGE} strokeWidth={1.4} />
            {!seed && !lost && <circle cx={p.x} cy={p.y + 1} r={3.6} fill={done ? '#5B2C83' : '#FFFFFF'} stroke={done ? '#FFFFFF' : '#B48A9A'} strokeWidth={1.1} />}
            {seed && <path d={`M ${p.x - 3} ${p.y - 1} Q ${p.x} ${p.y - 5} ${p.x + 3} ${p.y - 1}`} stroke="#D9B27A" strokeWidth={1.4} fill="none" strokeLinecap="round" />}
          </g>
        )
      })}
      {/* pollen on the stigma */}
      {labels === 'pollinate' && stigmaGrainsOn > 0 && [[168, 79], [180, 75], [192, 79]].map(([x, y], k) => <Grain key={k} at={{ x, y }} r={4.2} />)}
      {labels === 'fertilise' && grainsOnTop && grainsAt(grainCount).map((g, i) => <Grain key={i} at={g} />)}
    </g>
  )
}

type Drag = { kind: 'bee'; pt: Pt } | { kind: 'tube'; i: number; pt: Pt }

export function FlowerReproductionView({ config, state, setState, marked, reduced, locked }: SceneViewProps<FlowerConfig, FlowerState>) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const done = marked !== 'idle'
  const frozen = locked || marked === 'right' || marked === 'shown'
  const flower = flowerOf(config)
  const toSvg = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }
  }
  const clamp = (p: Pt): Pt => ({ x: Math.max(14, Math.min(W - 14, p.x)), y: Math.max(14, Math.min(H - 14, p.y)) })

  const pollinate = config.task === 'pollinate'
  const grainsN = config.task === 'fertilise' ? Math.max(1, Math.min(3, config.grains)) : 2
  const ovulesN = config.task === 'fertilise' ? Math.max(2, Math.min(5, config.ovules)) : 4
  const to = config.task === 'fertilise' ? reached({ ...config, grains: grainsN, ovules: ovulesN }, state) : []
  const tips = Array.isArray(state?.tips) ? state.tips : []

  // ---- the bee
  const beeHome = state?.bee ?? BEE_START
  const beeAt = drag?.kind === 'bee' ? drag.pt : beeHome
  const beeDown = (e: PointerEvent) => {
    if (frozen || e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ kind: 'bee', pt: clamp(toSvg(e)) })
  }
  const beeLand = (p: Pt) => {
    const z = zoneAt(p)
    setState(z ? land(state, z.part, z.perch) : { ...state, on: null, bee: p })
  }
  const beeKey = (e: KeyboardEvent) => {
    if (frozen) return
    const step = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, -14], ArrowDown: [0, 14] }[e.key as 'ArrowLeft']
    if (step) {
      e.preventDefault(); e.stopPropagation()
      setState({ ...state, on: null, bee: clamp({ x: beeHome.x + step[0], y: beeHome.y + step[1] }) })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopPropagation()
      beeLand(beeHome)
    }
  }

  // ---- the tubes
  const tubeDown = (i: number) => (e: PointerEvent) => {
    if (frozen || e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const t = [...to]
    t[i] = null
    // Picking a tube out of an ovule takes it back to wherever the pointer is.
    const p = clamp(toSvg(e))
    setDrag({ kind: 'tube', i, pt: p })
    if (to[i] !== null) setState({ ...state, to: t })
  }
  const settle = (i: number, p: Pt) => {
    const tip = tipFor(i, grainsN, p)
    const free = ovulesAt(ovulesN).map((o, k) => ({ o, k })).filter(({ k }) => !to.some((v, j) => v === k && j !== i))
    const hit = free.map((f) => ({ ...f, d: Math.hypot(f.o.x - p.x, f.o.y - p.y) })).sort((a, b) => a.d - b.d)[0]
    const nextTo = [...to]
    const nextTips = [...tips]
    while (nextTips.length < grainsN) nextTips.push(null)
    if (hit && hit.d <= SNAP && tip.y > OVARY_TOP) {
      nextTo[i] = hit.k
      nextTips[i] = null
    } else {
      nextTo[i] = null
      nextTips[i] = tip.y > grainsAt(grainsN)[i].y + 14 ? tip : null
    }
    setState({ ...state, to: nextTo, tips: nextTips })
  }
  const tubeKey = (i: number) => (e: KeyboardEvent) => {
    if (frozen) return
    const free = ovulesAt(ovulesN).map((_, k) => k).filter((k) => !to.some((v, j) => v === k && j !== i))
    const cur = to[i]
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault(); e.stopPropagation()
    const at = cur === null ? -1 : free.indexOf(cur)
    const k = free[(at + dir + free.length) % free.length]
    const nextTo = [...to]
    nextTo[i] = k
    const nextTips = [...tips]
    nextTips[i] = null
    setState({ ...state, to: nextTo, tips: nextTips })
  }

  const move = (e: PointerEvent) => {
    if (!drag) return
    setDrag({ ...drag, pt: clamp(toSvg(e)) } as Drag)
  }
  const up = (e: PointerEvent) => {
    if (!drag) return
    const p = clamp(toSvg(e))
    setDrag(null)
    if (drag.kind === 'bee') beeLand(p)
    else settle(drag.i, p)
  }
  const reset = () => {
    if (frozen) return
    setState(pollinate ? {} : { tips: Array.from({ length: grainsN }, () => null), to: Array.from({ length: grainsN }, () => null) })
  }

  // ---- what the card says
  const grains = stigmaGrains(state)
  const loaded = !!state?.loaded
  const inOvules = to.filter((o) => o !== null).length
  const fertilisedFlags = Array.from({ length: ovulesN }, (_, k) => to.includes(k))
  const seeds = !pollinate && marked === 'right'
  const grainCount = grainsN

  const caption = pollinate
    ? loaded ? 'The bee has yellow pollen on it.' : 'A flower cut in half. A bee is hovering beside it.'
    : inOvules > 0 ? 'The pollen grain stays where it is. Its tube grows, and a nucleus travels down it to the ovule.' : 'A flower cut in half, with pollen grains sitting on top.'
  const seen = pollinate
    ? `A flower cut in half with parts labelled petal, sepal, filament, anther, stigma, style, ovary and ovule. A bee is ${state?.on ? `on the ${state.on}` : 'hovering'}, ${loaded ? 'carrying yellow pollen' : 'carrying no pollen'}. ${grains > 0 ? `${grains} pollen grains are stuck on the flower.` : 'No pollen has been left on the flower.'}`
    : `A flower cut in half with ${grainsN} pollen grains on the top and ${ovulesN} small round ovules in the ovary. ${inOvules} of the pollen tubes have reached an ovule.`

  const tubesToDraw = !pollinate
    ? Array.from({ length: grainsN }, (_, i) => {
        const o = to[i]
        if (o !== null) return { i, pts: endPoints(i, grainsN, ovulesAt(ovulesN)[o]), landed: true, tip: null as Pt | null, key: o }
        const dragging = drag?.kind === 'tube' && drag.i === i
        const tip = dragging ? tipFor(i, grainsN, drag.pt) : tips[i] ?? null
        return { i, pts: tip ? tubePoints(i, grainsN, tip) : [], landed: false, tip, key: -1 }
      })
    : []

  return (
    <div className="nodrag flex flex-col gap-2.5">
      <figure className="flex flex-col gap-1.5">
        <svg
          ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label={seen}
          onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
        >
          <rect width={W} height={H} rx={14} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          <Flower
            flower={flower} seeds={seeds} fruit={seeds} ovules={ovulesN} fertilised={fertilisedFlags} showAnthers={pollinate}
            labels={pollinate ? 'pollinate' : 'fertilise'} stigmaGrainsOn={grains} grainCount={grainCount} grainsOnTop={!pollinate}
          />
          {/* the labels, each on the thing it names */}
          {pollinate ? (
            <g>
              <Label x={20} y={188} text="petal" />
              <Label x={113} y={118} text="anther" anchor="end" />
              <Label x={254} y={186} text="filament" />
              <path d="M 258 59 L 193 79" stroke={SOFT} strokeWidth={1} pointerEvents="none" />
              <Label x={262} y={62} text="stigma" />
              <Label x={168} y={142} text="style" anchor="end" />
              <Label x={136} y={246} text="ovary" anchor="end" />
              <Label x={226} y={250} text="ovule" />
              <Label x={92} y={288} text="sepal" anchor="end" />
            </g>
          ) : (
            <g>
              <Label x={20} y={188} text="petal" />
              <Label x={224} y={70} text="pollen grain" />
              <path d="M 108 69 L 167 81" stroke={SOFT} strokeWidth={1} pointerEvents="none" />
              <Label x={104} y={72} text="stigma" anchor="end" />
              <path d="M 222 66 L 196 78" stroke={SOFT} strokeWidth={1} pointerEvents="none" />
              <Label x={168} y={142} text="style" anchor="end" />
              <Label x={136} y={246} text={seeds ? 'fruit' : 'ovary'} anchor="end" />
              <Label x={268} y={236} text={seeds ? 'seed' : 'ovule'} />
            </g>
          )}
          {/* ovule leader */}
          {pollinate && <path d="M 224 246 L 205 234" stroke={SOFT} strokeWidth={1} pointerEvents="none" />}
          {!pollinate && <path d="M 266 232 L 226 226" stroke={SOFT} strokeWidth={1} pointerEvents="none" />}

          {!pollinate && tubesToDraw.map((t) => (
            <g key={t.i}>
              {t.pts.length > 1 && <path d={asPath(t.pts)} fill="none" stroke={TUBE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
              {t.landed && <Nucleus key={`${t.i}-${t.key}`} pts={t.pts} reduced={reduced} />}
              {!t.landed && !frozen && (
                <g
                  className="cursor-grab touch-none outline-none focus-visible:[outline:2px_solid_#1D4ED8]" tabIndex={0} role="button"
                  aria-label={`Pollen tube ${t.i + 1}. Drag its tip down into the flower, or press an arrow key to send it to an ovule.`}
                  onPointerDown={tubeDown(t.i)} onKeyDown={tubeKey(t.i)}
                >
                  <circle cx={(t.tip ?? grainsAt(grainsN)[t.i]).x} cy={(t.tip ?? { x: 0, y: grainsAt(grainsN)[t.i].y + 12 }).y + (t.tip ? 0 : 0)} r={14} fill="transparent" />
                  <circle cx={(t.tip ?? grainsAt(grainsN)[t.i]).x} cy={(t.tip ?? { x: 0, y: grainsAt(grainsN)[t.i].y + 12 }).y} r={6.5} fill="#FFFFFF" stroke={HANDLE} strokeWidth={2} />
                  <path
                    d={`M ${(t.tip ?? grainsAt(grainsN)[t.i]).x - 3} ${(t.tip ?? { x: 0, y: grainsAt(grainsN)[t.i].y + 12 }).y - 1.5} l 3 3.4 l 3 -3.4`}
                    fill="none" stroke={HANDLE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                  />
                </g>
              )}
              {t.landed && !frozen && (
                <g
                  className="cursor-grab touch-none outline-none focus-visible:[outline:2px_solid_#1D4ED8]" tabIndex={0} role="button" aria-label={`Pollen tube ${t.i + 1}, in an ovule. Drag it out to move it, or press an arrow key to choose another ovule.`}
                  onPointerDown={tubeDown(t.i)} onKeyDown={tubeKey(t.i)}
                >
                  <circle cx={t.pts[t.pts.length - 1].x} cy={t.pts[t.pts.length - 1].y} r={11} fill="transparent" />
                </g>
              )}
            </g>
          ))}

          {pollinate && (
            <g
              className={frozen ? "" : "cursor-grab touch-none outline-none focus-visible:[outline:2px_solid_#1D4ED8]"} tabIndex={frozen ? -1 : 0} role="button"
              aria-label={`Bee, ${loaded ? 'carrying pollen' : 'no pollen'}${state?.on ? `, on the ${state.on}` : ''}. Drag it, or use the arrow keys to move it and Enter to land.`}
              onPointerDown={beeDown} onKeyDown={beeKey}
            >
              <circle cx={beeAt.x} cy={beeAt.y} r={26} fill="transparent" />
              <Bee at={beeAt} loaded={loaded} lifted={!!drag} focusable={!frozen} />
            </g>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate" aria-live="polite">{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {pollinate ? (
          <>
            <Row label="Pollen on the bee" value={loaded ? 'Yes' : 'None'} />
            <Row label="Grains left on the flower" value={String(grains)} />
          </>
        ) : (
          <Row label="Tubes in ovules" value={String(inOvules)} />
        )}
        <div className="flex justify-end">
          <button
            type="button" onClick={reset} disabled={frozen} aria-label={pollinate ? 'Start again with the bee back at its start' : 'Start again with the tubes back at their grains'}
            className="nodrag h-7 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >Start again</button>
        </div>
      </div>

      <div aria-live="polite">
        {done && (
          <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
            <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{madeSentence(config, state)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
    </div>
  )
}
