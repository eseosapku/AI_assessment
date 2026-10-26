'use client'
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { RotateCcw, Undo2, X } from 'lucide-react'
import type { SceneViewProps } from '../types'
import type { BodyFlowConfig, BodyFlowState, SystemId } from './config'
import { OXYGEN, SYSTEMS, describeRoute, describeWrong, markTaps, nameOf, stretch, tapsOf } from './config'

// The scene draws on its own paper in both themes, like a textbook figure, so
// its colours are its own. Blood is red where oxygenated, blue where not.
const PAPER = '#FBFAF6'
const PAPER_EDGE = '#E2DDD2'
const INK = '#1B2430'
const RED = '#C2382C'
const RED_T = '#F4D0CA'
const BLUE = '#2D5FA8'
const BLUE_T = '#CDDCF2'
/** A tapped part's glow; its numbered badge carries the meaning. */
const LIT = '#E8A200'
const BAD = '#B0303C'

type Pt = [number, number]
/** One shape of a part, as an SVG path. */
export interface Prim { d: string; fill?: string; stroke?: string; sw?: number; round?: boolean; opacity?: number }
export interface PartArt {
  draw: Prim[]
  /** Paths stroked wide and unseen, so a thin part is easy to tap. */
  reach?: string[]
  label: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; lines: string[]; pill?: boolean }
  /** Where its step number sits. */
  badge: Pt
  /** The way the blood, air or food runs through it, entry to exit, for a part on the route. */
  flow?: Pt[]
}
export interface Diagram {
  w: number
  h: number
  /** Paint order, back to front. */
  order: string[]
  parts: Record<string, PartArt>
  /** Context drawn behind the parts, never tapped. */
  backdrop?: Prim[]
  gradients?: { id: string; from: Pt; to: Pt; stops: [number, string][] }[]
  /** What the picture shows, in words that give no order. */
  aria: string
}

// --- Path helpers --------------------------------------------------------------
const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
const circle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
const poly = (pts: Pt[]) => `M ${pts.map((p) => p.join(' ')).join(' L ')}`
/** A tube: a dark edge with a lighter bore. */
const tube = (d: string, w: number, bore: string, edge: string): Prim[] => [
  { d, stroke: edge, sw: w + 3, round: true },
  { d, stroke: bore, sw: w, round: true },
]
/** A cluster of alveoli round a point. */
const grapes = (cx: number, cy: number): string =>
  [[0, 0], [-7, -5], [7, -5], [-7, 6], [7, 6], [0, 10], [0, -10]].map(([dx, dy]) => circle(cx + dx, cy + dy, 5.5)).join(' ')

// --- Circulation: the heart's four chambers, lungs above, body below ------------
// Viewer's left is the heart's right side, as textbooks draw it.
const VESSEL = 12
const circulation: Diagram = {
  w: 340,
  h: 424,
  aria: "A diagram of the heart's four chambers, with the lungs above, the body below and blood vessels joining them. Red marks oxygenated blood, blue deoxygenated blood.",
  gradients: [
    { id: 'lungsFill', from: [120, 0], to: [220, 0], stops: [[0, BLUE_T], [1, RED_T]] },
    { id: 'lungsEdge', from: [120, 0], to: [220, 0], stops: [[0, BLUE], [1, RED]] },
    { id: 'bodyFill', from: [80, 0], to: [260, 0], stops: [[0, BLUE_T], [1, RED_T]] },
    { id: 'bodyEdge', from: [80, 0], to: [260, 0], stops: [[0, BLUE], [1, RED]] },
  ],
  order: ['lungs', 'body', 'vena-cava', 'pulmonary-artery', 'pulmonary-vein', 'aorta', 'right-atrium', 'left-atrium', 'right-ventricle', 'left-ventricle'],
  parts: {
    'lungs': {
      draw: [
        { d: rect(86, 14, 168, 58, 20), fill: 'url(#$lungsFill)', stroke: 'url(#$lungsEdge)', sw: 3 },
        { d: 'M 104 28 C 120 20, 136 36, 152 28 S 184 20, 200 28 S 228 36, 238 28', stroke: 'url(#$lungsEdge)', sw: 1.5, opacity: 0.7 },
        { d: 'M 104 60 C 120 52, 136 68, 152 60 S 184 52, 200 60 S 228 68, 238 60', stroke: 'url(#$lungsEdge)', sw: 1.5, opacity: 0.7 },
      ],
      label: { x: 192, y: 48, anchor: 'middle', lines: ['lungs'], pill: true },
      badge: [86, 30],
      flow: [[160, 66], [160, 30], [222, 30], [222, 66]],
    },
    'body': {
      draw: [
        { d: rect(30, 356, 280, 58, 20), fill: 'url(#$bodyFill)', stroke: 'url(#$bodyEdge)', sw: 3 },
        { d: 'M 56 372 C 80 364, 104 380, 128 372 S 176 364, 200 372 S 248 380, 284 372', stroke: 'url(#$bodyEdge)', sw: 1.5, opacity: 0.7 },
      ],
      label: { x: 170, y: 389, anchor: 'middle', lines: ['body'], pill: true },
      badge: [310, 398],
      flow: [[300, 362], [300, 402], [40, 402], [40, 362]],
    },
    'vena-cava': {
      draw: [{ d: 'M 40 362 V 196 H 92', stroke: BLUE, sw: VESSEL }],
      reach: ['M 40 362 V 196 H 92'],
      label: { x: 50, y: 338, anchor: 'start', lines: ['vena cava'] },
      badge: [40, 262],
      flow: [[40, 362], [40, 196], [88, 196]],
    },
    'pulmonary-artery': {
      draw: [{ d: 'M 160 216 V 66', stroke: BLUE, sw: VESSEL }],
      reach: ['M 160 216 V 66'],
      label: { x: 148, y: 104, anchor: 'end', lines: ['pulmonary', 'artery'] },
      badge: [160, 136],
      flow: [[160, 212], [160, 66]],
    },
    'pulmonary-vein': {
      draw: [{ d: 'M 222 66 V 154', stroke: RED, sw: VESSEL }],
      reach: ['M 222 66 V 154'],
      label: { x: 234, y: 104, anchor: 'start', lines: ['pulmonary', 'vein'] },
      badge: [222, 132],
      flow: [[222, 66], [222, 150]],
    },
    'aorta': {
      draw: [{ d: 'M 248 232 H 300 V 362', stroke: RED, sw: VESSEL }],
      reach: ['M 248 232 H 300 V 362'],
      label: { x: 290, y: 338, anchor: 'end', lines: ['aorta'] },
      badge: [276, 232],
      flow: [[252, 232], [300, 232], [300, 362]],
    },
    'right-atrium': {
      draw: [{ d: rect(88, 150, 60, 56, 16), fill: BLUE_T, stroke: BLUE, sw: 3 }],
      label: { x: 118, y: 175, anchor: 'middle', lines: ['right', 'atrium'] },
      badge: [88, 150],
      flow: [[88, 196], [110, 196], [112, 212]],
    },
    'left-atrium': {
      draw: [{ d: rect(192, 150, 60, 56, 16), fill: RED_T, stroke: RED, sw: 3 }],
      label: { x: 222, y: 175, anchor: 'middle', lines: ['left', 'atrium'] },
      badge: [252, 150],
      flow: [[222, 150], [222, 180], [214, 212]],
    },
    'right-ventricle': {
      // A thinner wall than the left's: it pumps only to the lungs.
      draw: [{ d: 'M 88 228 Q 88 212 104 212 H 166 V 304 Q 166 312 156 310 L 112 300 Q 88 294 88 272 Z', fill: BLUE_T, stroke: BLUE, sw: 3 }],
      label: { x: 127, y: 252, anchor: 'middle', lines: ['right', 'ventricle'] },
      badge: [88, 300],
      flow: [[112, 212], [104, 280], [146, 292], [160, 268], [160, 212]],
    },
    'left-ventricle': {
      // The thickest wall: it pumps blood all round the body.
      draw: [{ d: 'M 252 228 Q 252 212 236 212 H 174 V 304 Q 174 312 184 310 L 228 300 Q 252 294 252 272 Z', fill: RED_T, stroke: RED, sw: 7 }],
      label: { x: 213, y: 252, anchor: 'middle', lines: ['left', 'ventricle'] },
      badge: [252, 300],
      flow: [[214, 212], [208, 262], [236, 254], [252, 232]],
    },
  },
}

// --- Breathing: the airway, beside the oesophagus, above the diaphragm ----------
const AIR = '#D7E6EF'
const AIR_EDGE = '#3F6A86'
const FOOD_TUBE = '#EBCBA9'
const FOOD_EDGE = '#8A5A35'
const ALV = '#F4BDB3'
const ALV_EDGE = '#A2483F'
const TRACHEA = 'M 170 54 V 166'
const BRONCHI = 'M 170 164 L 116 210 M 170 164 L 226 210'
const BRONCHIOLES = 'M 116 210 L 86 246 L 68 270 M 86 246 L 96 276 M 116 210 L 124 256 L 112 284 M 124 256 L 140 280 M 226 210 L 256 244 L 276 268 M 256 244 L 250 276 M 226 210 L 230 256 L 220 284 M 230 256 L 246 296'
const ALVEOLI = [grapes(64, 280), grapes(98, 288), grapes(108, 296), grapes(146, 290), grapes(282, 278), grapes(250, 288), grapes(216, 296), grapes(250, 308)]
const breathing: Diagram = {
  w: 340,
  h: 404,
  aria: 'A diagram of the airway from the nose and mouth down into the lungs, beside the oesophagus and above the diaphragm.',
  backdrop: [
    // The lungs, for where things are; the parts inside are what is tapped.
    { d: 'M 150 150 C 150 126, 124 118, 96 132 C 56 152, 34 220, 30 300 C 28 324, 46 332, 70 326 L 150 312 Z', fill: '#FBE7E3', stroke: '#E2B8B0', sw: 1.5 },
    { d: 'M 214 150 C 214 126, 240 118, 268 132 C 304 152, 312 220, 314 300 C 316 324, 298 332, 274 326 L 200 314 L 200 160 Z', fill: '#FBE7E3', stroke: '#E2B8B0', sw: 1.5 },
  ],
  order: ['oesophagus', 'diaphragm', 'nose-mouth', 'trachea', 'bronchus', 'bronchiole', 'alveolus'],
  parts: {
    'nose-mouth': {
      draw: [{ d: rect(100, 12, 140, 42, 18), fill: '#F6E3D6', stroke: FOOD_EDGE, sw: 2.5 }],
      label: { x: 170, y: 38, anchor: 'middle', lines: ['nose and mouth'] },
      badge: [78, 33],
      flow: [[170, 26], [170, 54]],
    },
    'trachea': {
      draw: [
        ...tube(TRACHEA, 22, AIR, AIR_EDGE),
        // Rings of cartilage hold it open.
        { d: Array.from({ length: 9 }, (_, i) => `M 161 ${66 + i * 11} H 179`).join(' '), stroke: '#FFFFFF', sw: 3, round: true },
      ],
      label: { x: 152, y: 110, anchor: 'end', lines: ['trachea'] },
      badge: [170, 146],
      flow: [[170, 54], [170, 166]],
    },
    'oesophagus': {
      draw: tube('M 206 54 V 392', 13, FOOD_TUBE, FOOD_EDGE),
      reach: ['M 206 54 V 392'],
      label: { x: 220, y: 92, anchor: 'start', lines: ['oesophagus'] },
      badge: [206, 120],
    },
    'bronchus': {
      draw: tube(BRONCHI, 14, AIR, AIR_EDGE),
      reach: [BRONCHI],
      label: { x: 108, y: 180, anchor: 'end', lines: ['bronchus'] },
      badge: [143, 187],
      flow: [[170, 166], [116, 210]],
    },
    'bronchiole': {
      draw: tube(BRONCHIOLES, 6, AIR, AIR_EDGE),
      reach: [BRONCHIOLES],
      label: { x: 330, y: 222, anchor: 'end', lines: ['bronchiole'] },
      badge: [96, 228],
      flow: [[116, 210], [86, 246], [68, 270]],
    },
    'alveolus': {
      draw: [{ d: ALVEOLI.join(' '), fill: ALV, stroke: ALV_EDGE, sw: 1.5 }],
      label: { x: 30, y: 328, anchor: 'start', lines: ['alveolus'] },
      badge: [42, 296],
      flow: [[68, 270], [64, 280]],
    },
    'diaphragm': {
      draw: [{ d: 'M 20 364 Q 170 286 320 364', stroke: '#B4533F', sw: 8, round: true }],
      reach: ['M 20 364 Q 170 286 320 364'],
      label: { x: 150, y: 358, anchor: 'middle', lines: ['diaphragm'] },
      badge: [276, 345],
    },
  },
}

// --- Digestion: the gut from mouth to anus, the organs beside it ----------------
const GUT = '#F2C3A8'
const GUT_EDGE = '#9A4E35'
const COLON = '#E2BD8C'
const COLON_EDGE = '#7A552A'
const SMALL = 'M 182 206 Q 168 214 170 234 V 284 H 236 Q 248 284 248 296 Q 248 308 236 308 H 124 Q 112 308 112 320 Q 112 332 124 332 H 236 Q 248 332 248 344 Q 248 356 236 356 H 124 Q 112 356 112 368 Q 112 380 102 380'
const LARGE = 'M 92 404 V 276 Q 92 264 104 264 H 258 Q 270 264 270 276 V 382 Q 270 408 236 410 H 180'
const digestion: Diagram = {
  w: 340,
  h: 466,
  aria: 'A diagram of the gut from the mouth to the anus, with the liver, gall bladder and pancreas beside it.',
  order: ['liver', 'gall-bladder', 'pancreas', 'mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine', 'rectum', 'anus'],
  parts: {
    'mouth': {
      draw: [{ d: rect(120, 10, 100, 36, 16), fill: '#F6E3D6', stroke: GUT_EDGE, sw: 2.5 }],
      label: { x: 170, y: 33, anchor: 'middle', lines: ['mouth'] },
      badge: [104, 28],
      flow: [[170, 22], [170, 46]],
    },
    'oesophagus': {
      draw: tube('M 170 46 V 110 Q 170 126 188 134', 12, GUT, GUT_EDGE),
      reach: ['M 170 46 V 110 Q 170 126 188 134'],
      label: { x: 158, y: 80, anchor: 'end', lines: ['oesophagus'] },
      badge: [170, 92],
      flow: [[170, 46], [170, 112], [188, 134]],
    },
    'stomach': {
      draw: [{
        d: 'M 184 128 C 208 100, 268 104, 282 146 C 294 186, 262 222, 222 222 C 204 222, 192 214, 184 208 L 178 200 C 196 200, 214 192, 218 174 C 222 154, 206 142, 186 142 Z',
        fill: '#F5CDBF', stroke: GUT_EDGE, sw: 2.5,
      }],
      label: { x: 252, y: 170, anchor: 'middle', lines: ['stomach'] },
      badge: [282, 120],
      flow: [[188, 134], [236, 132], [262, 172], [226, 208], [182, 206]],
    },
    'small-intestine': {
      draw: tube(SMALL, 10, GUT, GUT_EDGE),
      reach: [SMALL],
      label: { x: 180, y: 325, anchor: 'middle', lines: ['small intestine'], pill: true },
      badge: [256, 320],
      flow: [[182, 206], [170, 234], [170, 284], [236, 284], [248, 296], [236, 308], [124, 308], [112, 320], [124, 332], [236, 332], [248, 344], [236, 356], [124, 356], [112, 368], [102, 380]],
    },
    'large-intestine': {
      draw: tube(LARGE, 18, COLON, COLON_EDGE),
      reach: [LARGE],
      label: { x: 80, y: 312, anchor: 'end', lines: ['large', 'intestine'] },
      badge: [92, 352],
      flow: [[102, 380], [92, 380], [92, 276], [104, 264], [258, 264], [270, 276], [270, 382], [258, 404], [236, 410], [180, 410]],
    },
    'rectum': {
      draw: tube('M 180 410 V 436', 18, '#D9AE7C', COLON_EDGE),
      reach: ['M 180 410 V 436'],
      label: { x: 198, y: 430, anchor: 'start', lines: ['rectum'] },
      badge: [158, 422],
      flow: [[180, 410], [180, 436]],
    },
    'anus': {
      draw: [{ d: rect(168, 438, 24, 10, 5), fill: COLON_EDGE, stroke: COLON_EDGE, sw: 1 }],
      reach: ['M 180 438 V 450'],
      label: { x: 198, y: 454, anchor: 'start', lines: ['anus'] },
      badge: [158, 446],
      flow: [[180, 436], [180, 448]],
    },
    'liver': {
      draw: [{ d: 'M 30 124 Q 30 102 56 100 L 146 104 Q 162 106 156 122 L 138 158 Q 130 172 112 170 L 50 164 Q 30 160 30 142 Z', fill: '#D9A497', stroke: '#7E3A2E', sw: 2.5 }],
      label: { x: 88, y: 140, anchor: 'middle', lines: ['liver'] },
      badge: [30, 104],
    },
    'gall-bladder': {
      draw: [{ d: 'M 134 168 Q 150 168 150 184 Q 150 198 140 198 Q 128 198 128 182 Q 128 170 134 168 Z', fill: '#C9DB9B', stroke: '#566F22', sw: 2 }],
      label: { x: 120, y: 196, anchor: 'end', lines: ['gall bladder'] },
      badge: [160, 178],
    },
    'pancreas': {
      draw: [{ d: 'M 196 232 Q 238 224 286 234 Q 296 240 286 248 Q 238 254 200 248 Q 186 240 196 232 Z', fill: '#F1DC9E', stroke: '#8C6E17', sw: 2 }],
      label: { x: 240, y: 245, anchor: 'middle', lines: ['pancreas'] },
      badge: [302, 228],
    },
  },
}

export const DIAGRAMS: Record<SystemId, Diagram> = { circulation, breathing, digestion }

// --- The route, drawn once it is marked -----------------------------------------
const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + len(pts[i], p), 0)

/** A polyline cut at a fraction of its length: the part before and the part after. */
export function cut(pts: Pt[], f: number): [Pt[], Pt[]] {
  const total = lengthOf(pts)
  let at = total * f
  for (let i = 1; i < pts.length; i++) {
    const l = len(pts[i - 1], pts[i])
    if (at <= l) {
      const t = l === 0 ? 0 : at / l
      const m: Pt = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
      return [[...pts.slice(0, i), m], [m, ...pts.slice(i)]]
    }
    at -= l
  }
  return [pts, [pts[pts.length - 1]]]
}

/** Each part's piece of the route: from the start's middle, through every part, to the end's middle. */
export function routePieces(config: BodyFlowConfig): { id: string; pts: Pt[]; half?: 'out' | 'in' }[] {
  const { system, from, to } = config.task
  const parts = stretch(system, from, to) ?? []
  const r = SYSTEMS[system].route
  const back = !SYSTEMS[system].loop && r.indexOf(from) > r.indexOf(to)
  return parts.map((id, k) => {
    const flow = DIAGRAMS[system].parts[id]?.flow ?? []
    const pts = back ? [...flow].reverse() : flow
    if (k === 0) return { id, pts: cut(pts, 0.5)[1], half: 'out' as const }
    if (k === parts.length - 1) return { id, pts: cut(pts, 0.5)[0], half: 'in' as const }
    return { id, pts }
  })
}

/** The colour of what flows through a piece, as runs of [length, colour]. */
function tint(system: SystemId, piece: { id: string; pts: Pt[]; half?: 'out' | 'in' }): [number, string][] {
  const l = lengthOf(piece.pts)
  if (system === 'breathing') return [[l, '#FFFFFF']]
  if (system === 'digestion') return [[l, '#8A5A2B']]
  const o = OXYGEN[piece.id]
  if (o === 'oxygenated') return [[l, RED]]
  if (o === 'deoxygenated') return [[l, BLUE]]
  // A bed: the lungs turn blood red, the body turns it blue, halfway through.
  const [first, second] = piece.id === 'lungs' ? [BLUE, RED] : [RED, BLUE]
  if (piece.half === 'out') return [[l, second]]
  if (piece.half === 'in') return [[l, first]]
  return [[l / 2, first], [l / 2, second]]
}

function Route({ config, reduced }: { config: BodyFlowConfig; reduced: boolean }) {
  const { system } = config.task
  const pieces = routePieces(config)
  const pts = pieces.reduce<Pt[]>((all, p) => [...all, ...(all.length ? p.pts.slice(1) : p.pts)], [])
  const d = poly(pts)
  const total = lengthOf(pts)
  const dur = Math.max(4, total / 90)
  const dots = Math.max(3, Math.min(9, Math.round(total / 70)))
  // Where along the path the colour changes, as fractions of its length.
  const runs = pieces.flatMap((p) => tint(system, p)).reduce<[number, string][]>((out, [l, c]) => {
    const last = out[out.length - 1]
    if (last && last[1] === c) last[0] += l
    else out.push([l, c])
    return out
  }, [])
  const starts = runs.map((_, i) => runs.slice(0, i).reduce((s, [l]) => s + l, 0) / (total || 1))
  const arrows = pieces
    .filter((p) => lengthOf(p.pts) >= 14)
    .map((p) => {
      // Halfway along the piece, pointing the way it flows there.
      const [before, after] = cut(p.pts, 0.5)
      const m = before[before.length - 1]
      const prev = before[before.length - 2] ?? m
      const next = after[1] ?? m
      const dir = len(prev, m) > 0.5 ? [m[0] - prev[0], m[1] - prev[1]] : [next[0] - m[0], next[1] - m[1]]
      return { id: p.id, at: m, deg: (Math.atan2(dir[1], dir[0]) * 180) / Math.PI }
    })
  const dotFill = system === 'breathing' ? '#FFFFFF' : system === 'digestion' ? '#8A5A2B' : runs[0]?.[1] ?? RED
  return (
    <g data-route="" pointerEvents="none">
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.92} />
      <path d={d} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {arrows.map((a) => (
        <path key={a.id} d="M 7 0 L -5 -6 L -5 6 Z" fill={INK} stroke="#FFFFFF" strokeWidth={1.5} strokeLinejoin="round" transform={`translate(${a.at[0]} ${a.at[1]}) rotate(${a.deg})`} />
      ))}
      {!reduced &&
        Array.from({ length: dots }, (_, k) => {
          const begin = `${(-(k * dur) / dots).toFixed(2)}s`
          return (
            <circle key={k} r={4.5} fill={dotFill} stroke={system === 'breathing' ? INK : '#FFFFFF'} strokeWidth={1.5}>
              <animateMotion dur={`${dur.toFixed(2)}s`} begin={begin} repeatCount="indefinite" path={d} />
              {runs.length > 1 && (
                <animate attributeName="fill" dur={`${dur.toFixed(2)}s`} begin={begin} repeatCount="indefinite" calcMode="discrete"
                  values={runs.map(([, c]) => c).join(';')} keyTimes={starts.map((s) => s.toFixed(4)).join(';')} />
              )}
            </circle>
          )
        })}
    </g>
  )
}

// --- The view -------------------------------------------------------------------
const CHAR = 7.4 // about how wide a 13px bold letter is
function labelBox(l: PartArt['label']) {
  const w = Math.max(...l.lines.map((s) => s.length)) * CHAR + 12
  const h = l.lines.length * 15 + 8
  const x = l.anchor === 'start' ? l.x - 6 : l.anchor === 'end' ? l.x - w + 6 : l.x - w / 2
  return { x, y: l.y - 15, w, h: Math.max(h, 24) }
}

/** A part's glow, drawn behind it: only its rim shows. */
function Halo({ art, colour, extra }: { art: PartArt; colour: string; extra: number }) {
  return (
    <>
      {art.draw.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={colour} strokeWidth={(p.sw ?? 0) + extra} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </>
  )
}

export function BodyFlowView({ config, state, setState, marked, reduced, locked }: SceneViewProps<BodyFlowConfig, BodyFlowState>) {
  const { system, from, to } = config.task
  const sys = SYSTEMS[system]
  const art = DIAGRAMS[system]
  const taps = tapsOf(state)
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [focus, setFocus] = useState<string | null>(null)
  const buttons = useRef(new Map<string, SVGGElement>())
  // Tab order is by name, never the route's, so the keyboard does not read out the answer.
  const order = useMemo(() => Object.keys(sys.parts).sort((a, b) => nameOf(system, a).localeCompare(nameOf(system, b))), [sys, system])
  const marks = marked === 'wrong' ? markTaps(config, taps) : null
  const showRoute = marked === 'right' || marked === 'shown'
  const what = sys.carries
  const ref = (s: string) => s.replace('$', prefix)

  const tap = (id: string) => {
    if (locked) return
    const at = taps.indexOf(id)
    setState({ taps: at >= 0 ? taps.slice(0, at) : [...taps, id] })
  }
  const undo = () => {
    if (!locked && taps.length) setState({ taps: taps.slice(0, -1) })
  }
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      tap(id)
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      e.stopPropagation()
      undo()
      return
    }
    const i = order.indexOf(id)
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    const next = step ? order[(i + step + order.length) % order.length] : e.key === 'Home' ? order[0] : e.key === 'End' ? order[order.length - 1] : null
    if (!next) return
    // The board moves a selected card with the arrows; here they move between parts.
    e.preventDefault()
    e.stopPropagation()
    buttons.current.get(next)?.focus()
  }

  const stepOf = (id: string) => taps.indexOf(id)
  const names = taps.map((t) => nameOf(system, t))
  const message = marked === 'wrong' ? describeWrong(config, taps) : showRoute ? describeRoute(config) : null
  const live = message ?? (taps.length ? `Your route from the ${nameOf(system, from)}: ${names.join(', ')}.` : '')
  const until = from === to ? `until it is back in the ${nameOf(system, to)}` : `until it reaches the ${nameOf(system, to)}`

  return (
    <div className="nodrag nokey flex flex-col gap-2.5">
      <p className="text-[12px] font-semibold leading-snug text-ss-slate">
        Tap each part the {what} passes through, in order, {until}. Tap a part again to take it back.
      </p>
      <svg viewBox={`0 0 ${art.w} ${art.h}`} className="mx-auto block h-auto w-full max-w-[360px] select-none" role="group" aria-label={art.aria}>
        <defs>
          {art.gradients?.map((g) => (
            <linearGradient key={g.id} id={`${prefix}${g.id}`} gradientUnits="userSpaceOnUse" x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]}>
              {g.stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
            </linearGradient>
          ))}
        </defs>
        <rect x={1} y={1} width={art.w - 2} height={art.h - 2} rx={16} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.5} />
        <g aria-hidden="true">
          {art.backdrop?.map((p, i) => <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} pointerEvents="none" />)}
          {/* Tapped parts glow; the focused one gets an ink rim. */}
          {!showRoute && art.order.filter((id) => stepOf(id) >= 0).map((id) => <Halo key={`lit-${id}`} art={art.parts[id]} colour={LIT} extra={10} />)}
          {focus && art.parts[focus] && <Halo art={art.parts[focus]} colour={INK} extra={6} />}
          {/* Wide, unseen strokes under thin parts, so they are easy to tap. */}
          {art.order.map((id) =>
            art.parts[id].reach?.map((d, i) => (
              <path key={`${id}-reach-${i}`} d={d} fill="none" stroke="transparent" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke"
                className={locked ? undefined : 'cursor-pointer'} onClick={() => tap(id)} />
            )),
          )}
          {art.order.map((id) => (
            <g key={id} data-part={id} onClick={() => tap(id)} className={locked ? undefined : 'cursor-pointer'}>
              {art.parts[id].draw.map((p, i) => (
                <path key={i} d={p.d} fill={p.fill ? ref(p.fill) : 'none'} stroke={p.stroke ? ref(p.stroke) : undefined} strokeWidth={p.sw}
                  strokeLinecap={p.round ? 'round' : 'butt'} strokeLinejoin="round" opacity={p.opacity} />
              ))}
            </g>
          ))}
          {showRoute && <Route config={config} reduced={reduced} />}
        </g>
        {/* The parts as buttons, by name. */}
        <g>
          {order.map((id) => {
            const l = art.parts[id].label
            const box = labelBox(l)
            const n = stepOf(id)
            const wrong = marks && n >= 0 && !marks[n]
            const said = `${nameOf(system, id)}${id === from ? `, where the ${what} starts` : ''}${n >= 0 ? `, step ${n + 1} of your route` : ''}${wrong ? ', marked wrong' : ''}`
            return (
              <g
                key={id}
                ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }}
                role="button"
                tabIndex={locked ? -1 : 0}
                aria-label={said}
                aria-disabled={locked || undefined}
                data-label={id}
                onClick={() => tap(id)}
                onKeyDown={onKey(id)}
                onFocus={() => setFocus(id)}
                onBlur={() => setFocus((f) => (f === id ? null : f))}
                className={`outline-none ${locked ? '' : 'cursor-pointer'}`}
              >
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={7} fill={l.pill ? '#FFFFFF' : 'transparent'} opacity={l.pill ? 0.94 : undefined} />
                {focus === id && <rect x={box.x - 2} y={box.y - 2} width={box.w + 4} height={box.h + 4} rx={9} fill="none" stroke={INK} strokeWidth={2.5} />}
                <text x={l.x} y={l.y} textAnchor={l.anchor ?? 'middle'} fontSize={13} fontWeight={700} fill={INK} stroke={l.pill ? 'none' : PAPER} strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
                  {l.lines.map((line, i) => <tspan key={i} x={l.x} dy={i === 0 ? 0 : 15}>{line}</tspan>)}
                </text>
              </g>
            )
          })}
        </g>
        {/* Step numbers, the start, and what was marked wrong. */}
        <g aria-hidden="true" pointerEvents="none">
          {order.map((id) => {
            const [x, y] = art.parts[id].badge
            const n = stepOf(id)
            const wrong = marks && n >= 0 && !marks[n]
            const startTag = id === from
            const tagY = n >= 0 ? (y < 60 ? y + 24 : y - 24) : y
            return (
              <g key={id}>
                {startTag && (
                  <g transform={`translate(${x} ${tagY})`}>
                    <rect x={-22} y={-10} width={44} height={20} rx={10} fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
                    <text y={4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>start</text>
                  </g>
                )}
                {n >= 0 && (
                  <g transform={`translate(${x} ${y})`}>
                    <circle r={10.5} fill={wrong ? BAD : INK} stroke="#FFFFFF" strokeWidth={2} />
                    {wrong ? (
                      <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
                    ) : (
                      <text y={4.3} textAnchor="middle" fontSize={12} fontWeight={800} fill="#FFFFFF">{n + 1}</text>
                    )}
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {system === 'circulation' && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ss-slate">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: RED }} />oxygenated blood</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: BLUE }} />deoxygenated blood</span>
        </div>
      )}

      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Your route">
        <li className="rounded-full border border-dashed border-ss-line bg-ss-chip px-2.5 py-1 text-[12px] font-bold text-ss-ink">
          start: {nameOf(system, from)}
        </li>
        {taps.map((t, i) => {
          const wrong = marks && !marks[i]
          return (
            <li key={`${t}-${i}`} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-bold ${wrong ? 'border-[color:var(--ss-bad)] text-[color:var(--ss-bad)]' : 'border-ss-line bg-ss-panel text-ss-ink'}`}>
              {wrong ? <><X className="h-3 w-3" strokeWidth={3} aria-hidden="true" /><span className="sr-only">marked wrong: </span></> : <span className="tabular-nums">{i + 1}</span>}
              {nameOf(system, t)}
            </li>
          )
        })}
      </ol>

      {!locked && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={undo} disabled={!taps.length}
            className="nodrag flex items-center gap-1.5 rounded-full border border-ss-line bg-ss-panel px-3 py-1.5 text-[12px] font-bold text-ss-ink transition-colors hover:bg-ss-chip disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
          </button>
          <button type="button" onClick={() => taps.length && setState({ taps: [] })} disabled={!taps.length}
            className="nodrag flex items-center gap-1.5 rounded-full border border-ss-line bg-ss-panel px-3 py-1.5 text-[12px] font-bold text-ss-ink transition-colors hover:bg-ss-chip disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Start again
          </button>
        </div>
      )}

      {message && <p className="text-[13px] font-bold leading-snug text-ss-ink">{message}</p>}
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  )
}
