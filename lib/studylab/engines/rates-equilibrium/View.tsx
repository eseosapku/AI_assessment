'use client'
import { Fragment, useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { RatesEquilibriumConfig, RatesEquilibriumState, ShiftTask, SpeedTask, Term, EqReaction, Cell } from './config'
import {
  CELL_R, COUNTS, EQ_REACTIONS, RATE_REACTIONS, SHIFT_RANGE, SPECIES, STOPS,
  addedAt, amountsAt, conditionLabel, equilibriumConstant, explainShift, explainSpeed, levelsAt, needed, posRange,
  shiftMade, simTemp, solidLayout, speedMade, startPos, temperatureAt, termIndex, volumeAt,
} from './config'

// ---------------------------------------------------------------------------
// The chamber's own palette: it reads the same in light and dark themes.
// ---------------------------------------------------------------------------
const NAVY = '#14213A'
const SPARK = '#FFE27A'
const KIND = ['#5AA9F0', '#F29B4B'] as const
const SOLID = '#DDE3EA'
const SOLID_INSIDE = '#7E8A9A'
const LID = '#6B7785'
/** A thin edge on a key swatch, so a pale one still shows on a white card. */
const OUTLINE = '#6B7785'

// ---------------------------------------------------------------------------
// A seeded random stream, so a still frame is the same every time.
// ---------------------------------------------------------------------------
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

// ---------------------------------------------------------------------------
// Task 1's chamber: particles collide; the hard enough ones react.
// ---------------------------------------------------------------------------

/** Pixels per step along each axis at the start temperature, one standard deviation. */
const SIG0 = 1.1
/** Steps per frame: a few small ones, so a fast particle never skips over another. */
const SUBSTEPS = 3
/** The chance each frame that a particle takes a fresh speed from the temperature. */
const THERMO = 0.03

/** The same size as config's FIELD (a test holds them equal); literal here because config and this file import each other. */
export const BOX = { w: 360, h: 200, r: 6, inset: 2 } as const

export interface Mover { x: number; y: number; vx: number; vy: number; kind: 0 | 1 }
export interface Spark { x: number; y: number; age: number }
export interface RateParams { pair: boolean; n: number; tau: number; eps: number; area: number }

export class RatesSim {
  movers: Mover[] = []
  cells: Cell[] = []
  sparks: Spark[] = []
  /** The last few reactions, kept for a still frame. */
  recent: Spark[] = []
  successes = 0
  collisions = 0
  /** Hears the energy of every collision that could react, for the tests. */
  probe?: (energy: number) => void
  private rand: () => number
  private exposed: Cell[] = []

  constructor(public p: RateParams, seed: number) {
    this.rand = rng(seed)
    this.cells = p.pair ? [] : solidLayout(p.area)
    this.exposed = this.cells.filter((c) => c.exposed)
    this.fill()
  }

  private gauss(): number {
    return Math.sqrt(-2 * Math.log(1 - this.rand())) * Math.cos(2 * Math.PI * this.rand())
  }

  private spawn(kind: 0 | 1): Mover {
    const sd = SIG0 * Math.sqrt(this.p.tau)
    const r = BOX.r + BOX.inset
    let x = 0
    let y = 0
    for (let tries = 0; tries < 40; tries++) {
      x = r + this.rand() * (BOX.w - 2 * r)
      y = r + this.rand() * (BOX.h - 2 * r)
      const clear =
        this.movers.every((m) => Math.hypot(m.x - x, m.y - y) > 2 * BOX.r + 1) &&
        this.cells.every((c) => Math.hypot(c.x - x, c.y - y) > BOX.r + CELL_R + 1)
      if (clear) break
    }
    return { x, y, vx: this.gauss() * sd, vy: this.gauss() * sd, kind }
  }

  private fill() {
    const per = this.p.n
    const kinds: (0 | 1)[] = this.p.pair ? [0, 1] : [0]
    for (const k of kinds) for (let i = 0; i < per; i++) this.movers.push(this.spawn(k))
  }

  setParams(next: RateParams) {
    const prev = this.p
    if (next.tau !== prev.tau) {
      const k = Math.sqrt(next.tau / prev.tau)
      for (const m of this.movers) { m.vx *= k; m.vy *= k }
    }
    this.p = next
    if (next.area !== prev.area || next.pair !== prev.pair) {
      this.cells = next.pair ? [] : solidLayout(next.area)
      this.exposed = this.cells.filter((c) => c.exposed)
      // Anything the new cells land on is moved clear.
      for (const m of this.movers) {
        if (this.cells.some((c) => Math.hypot(c.x - m.x, c.y - m.y) < BOX.r + CELL_R)) Object.assign(m, this.spawn(m.kind))
      }
    }
    const kinds: (0 | 1)[] = next.pair ? [0, 1] : [0]
    for (const k of kinds) {
      const have = this.movers.filter((m) => m.kind === k)
      for (let i = have.length; i < next.n; i++) this.movers.push(this.spawn(k))
      for (let i = have.length; i > next.n; i--) this.movers.splice(this.movers.indexOf(have[i - 1]), 1)
    }
  }

  private react(x: number, y: number) {
    this.successes++
    this.sparks.push({ x, y, age: 0 })
    this.recent = [...this.recent, { x, y, age: 0 }].slice(-3)
  }

  /** One frame. */
  step() {
    const { r, w, h, inset } = BOX
    const lo = r + inset
    const norm = SIG0 * SIG0
    // The solution (or the rest of the gas) keeps the particles at the temperature: now and then one forgets
    // its speed and takes a fresh one. Without it the hard-hitting particles, used up by reacting, would cool the box.
    const sd = SIG0 * Math.sqrt(this.p.tau)
    for (const m of this.movers) {
      if (this.rand() < THERMO) { m.vx = this.gauss() * sd; m.vy = this.gauss() * sd }
    }
    for (let sub = 0; sub < SUBSTEPS; sub++) {
      for (const m of this.movers) {
        m.x += m.vx
        m.y += m.vy
        if (m.x < lo) { m.x = lo; m.vx = Math.abs(m.vx) }
        if (m.x > w - lo) { m.x = w - lo; m.vx = -Math.abs(m.vx) }
        if (m.y < lo) { m.y = lo; m.vy = Math.abs(m.vy) }
        if (m.y > h - lo) { m.y = h - lo; m.vy = -Math.abs(m.vy) }
      }
      // A mover meets a solid that cannot move: the energy of the hit is the energy along the line between them.
      for (const m of this.movers) {
        for (const c of this.exposed) {
          const dx = m.x - c.x
          const dy = m.y - c.y
          const d = Math.hypot(dx, dy)
          if (d >= r + CELL_R) continue
          const nx = dx / (d || 0.01)
          const ny = dy / (d || 0.01)
          const vn = m.vx * nx + m.vy * ny
          m.x = c.x + nx * (r + CELL_R + 0.01)
          m.y = c.y + ny * (r + CELL_R + 0.01)
          if (vn >= 0) continue
          this.collisions++
          this.probe?.((0.5 * vn * vn) / norm)
          if ((0.5 * vn * vn) / norm >= this.p.eps) {
            this.react(c.x + nx * CELL_R, c.y + ny * CELL_R)
            Object.assign(m, this.spawn(m.kind))
          } else {
            m.vx -= 2 * vn * nx
            m.vy -= 2 * vn * ny
          }
        }
      }
      // Two movers meet: equal masses swap their velocity along the line between them.
      const ms = this.movers
      for (let i = 0; i < ms.length; i++) {
        for (let j = i + 1; j < ms.length; j++) {
          const a = ms[i]
          const b = ms[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          if (Math.abs(dx) > 2 * r || Math.abs(dy) > 2 * r) continue
          const d = Math.hypot(dx, dy)
          if (d >= 2 * r) continue
          const nx = dx / (d || 0.01)
          const ny = dy / (d || 0.01)
          const push = (2 * r - d) / 2 + 0.01
          a.x -= nx * push; a.y -= ny * push
          b.x += nx * push; b.y += ny * push
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (vn >= 0) continue
          if (this.p.pair && a.kind !== b.kind) {
            this.collisions++
            this.probe?.((0.25 * vn * vn) / norm)
            if ((0.25 * vn * vn) / norm >= this.p.eps) {
              this.react((a.x + b.x) / 2, (a.y + b.y) / 2)
              Object.assign(a, this.spawn(a.kind))
              Object.assign(b, this.spawn(b.kind))
              continue
            }
          }
          a.vx += vn * nx; a.vy += vn * ny
          b.vx -= vn * nx; b.vy -= vn * ny
        }
      }
    }
    // Anything a push moved is brought back inside the box.
    for (const m of this.movers) {
      m.x = Math.min(w - lo, Math.max(lo, m.x))
      m.y = Math.min(h - lo, Math.max(lo, m.y))
    }
    for (const s of this.sparks) s.age++
    this.sparks = this.sparks.filter((s) => s.age < 16)
  }
}

export function rateParams(t: SpeedTask, pos: number): RateParams {
  const r = RATE_REACTIONS[t.reaction]
  const lv = levelsAt(t, pos)
  // A solid is hit by fewer movers than they hit each other, so it gets a few more of them to be seen reacting.
  return { pair: !r.solid, n: Math.round(COUNTS[lv.conc] * (r.solid ? 1.5 : 1)), tau: simTemp(r, lv.temp), eps: needed(lv.cat), area: lv.area }
}

/** The chamber after it has run a while, for a still frame and the tests. */
export function stillRates(t: SpeedTask, pos: number, frames = 240): RatesSim {
  const sim = new RatesSim(rateParams(t, pos), seedOf(`${t.reaction}|${t.condition}|${pos}`))
  for (let i = 0; i < frames; i++) sim.step()
  return sim
}

function drawRates(ctx: CanvasRenderingContext2D, sim: RatesSim, still: boolean) {
  ctx.clearRect(0, 0, BOX.w, BOX.h)
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, BOX.w, BOX.h)
  for (const c of sim.cells) {
    ctx.fillStyle = c.exposed ? SOLID : SOLID_INSIDE
    ctx.fillRect(c.x - CELL_R + 0.5, c.y - CELL_R + 0.5, CELL_R * 2 - 1, CELL_R * 2 - 1)
  }
  for (const m of sim.movers) {
    // A tail as long as the particle is fast: the picture of "how hard".
    ctx.strokeStyle = KIND[m.kind]
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(m.x, m.y)
    ctx.lineTo(m.x - m.vx * 3.5, m.y - m.vy * 3.5)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = KIND[m.kind]
    ctx.strokeStyle = NAVY
    ctx.lineWidth = 1
    if (m.kind === 0) {
      ctx.beginPath(); ctx.arc(m.x, m.y, BOX.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    } else {
      ctx.fillRect(m.x - BOX.r, m.y - BOX.r, BOX.r * 2, BOX.r * 2)
    }
  }
  // The collisions that were hard enough: a spark, then a ring.
  const sparks = still ? sim.recent : sim.sparks
  for (const s of sparks) {
    const k = still ? 0.35 : s.age / 16
    ctx.strokeStyle = SPARK
    ctx.globalAlpha = 1 - k * 0.85
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(s.x, s.y, 6 + k * 14, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = SPARK
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.5 * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }
}

// ---------------------------------------------------------------------------
// Task 2's chamber: a balance with both directions running.
// ---------------------------------------------------------------------------

export const SHIFT_BOX = { w: 360, canvasH: 240, baseH: 100 } as const
/** Reactions per second, each way, once the balance has settled. */
const EVENTS = 2.4
const DT = 1 / 30

export interface Part { x: number; y: number; vx: number; vy: number; term: number }
export interface Ring { x: number; y: number; age: number; term: number; dir: 1 | -1 }

export const radiusOf = (atoms: number) => 2.5 * Math.sqrt(atoms) + 1.6

export interface ShiftParams { V: number; speed: number; kf: number; kr: number }

export class ShiftSim {
  parts: Part[] = []
  rings: Ring[] = []
  /** The last reaction each way, kept for a still frame. */
  recent: Ring[] = []
  forward = 0
  reverse = 0
  private rand: () => number
  private params: ShiftParams = { V: 1, speed: 1, kf: 0, kr: 0 }
  private applied = 0

  constructor(public r: EqReaction, seed: number) {
    this.rand = rng(seed)
    // Spread along the box in a shuffled order, so no kind starts in a heap.
    const order: number[] = []
    r.terms.forEach((_, i) => { for (let k = 0; k < r.base[i]; k++) order.push(i) })
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    order.forEach((term, k) => this.parts.push(this.make(term, ((k + this.rand()) / order.length) * SHIFT_BOX.w, this.rand() * SHIFT_BOX.baseH)))
    for (let i = 0; i < 10; i++) this.separate()
    this.params = shiftParams(r, null, 0)
  }

  get height(): number { return SHIFT_BOX.baseH * this.params.V }

  private gauss(): number {
    return Math.sqrt(-2 * Math.log(1 - this.rand())) * Math.cos(2 * Math.PI * this.rand())
  }

  private radius(term: number) { return radiusOf(SPECIES[this.r.terms[term].id].atoms) }

  private make(term: number, x: number, y: number): Part {
    const sd = 1.5 * this.params.speed
    return { x, y, vx: this.gauss() * sd, vy: this.gauss() * sd, term }
  }

  counts(): number[] { return this.r.terms.map((_, i) => this.parts.filter((p) => p.term === i).length) }

  /** Set the conditions: the lid, the heat, the speed of each direction. */
  setConditions(params: ShiftParams) {
    const k = params.speed / this.params.speed
    if (k !== 1) for (const p of this.parts) { p.vx *= k; p.vy *= k }
    this.params = params
    this.keepInside()
  }

  /** Pump some of a substance in, or take some out, so that `total` is what has been added. */
  setAdded(term: number, total: number) {
    const want = Math.round(total)
    let diff = want - this.applied
    while (diff > 0) {
      this.parts.push(this.make(term, this.rand() * SHIFT_BOX.w, this.rand() * this.height))
      this.applied++; diff--
    }
    while (diff < 0) {
      const mine = this.parts.filter((p) => p.term === term)
      if (mine.length <= 1) break
      this.parts.splice(this.parts.indexOf(mine[Math.floor(this.rand() * mine.length)]), 1)
      this.applied--; diff++
    }
    this.keepInside()
    this.separate()
  }

  private keepInside() {
    const h = this.height
    for (const p of this.parts) {
      const r = this.radius(p.term)
      p.x = Math.min(SHIFT_BOX.w - r, Math.max(r, p.x))
      p.y = Math.min(h - r, Math.max(r, p.y))
    }
  }

  private separate() {
    const ps = this.parts
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]
        const b = ps[j]
        const need = this.radius(a.term) + this.radius(b.term)
        const dx = b.x - a.x
        const dy = b.y - a.y
        if (Math.abs(dx) > need || Math.abs(dy) > need) continue
        const d = Math.hypot(dx, dy)
        if (d >= need) continue
        const nx = dx / (d || 0.01)
        const ny = dy / (d || 0.01)
        const push = (need - d) / 2 + 0.01
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
      }
    }
    this.keepInside()
  }

  /** How often a direction goes: by mass action, on the amounts in the chamber. */
  private propensity(dir: 1 | -1): number {
    const n = this.counts()
    const k = dir === 1 ? this.params.kf : this.params.kr
    const V = this.params.V
    let a = k * V
    for (let i = 0; i < this.r.terms.length; i++) {
      const nu = this.r.terms[i].nu
      if (nu * dir >= 0) continue
      const need = Math.abs(nu)
      if (n[i] < need) return 0
      a *= Math.pow(n[i] / V, need)
    }
    return a
  }

  private fire(dir: 1 | -1) {
    const terms = this.r.terms
    const eaten = terms.map((t, i) => ({ t, i })).filter((x) => x.t.nu * dir < 0)
    const made = terms.map((t, i) => ({ t, i })).filter((x) => x.t.nu * dir > 0)
    const pool = this.parts.filter((p) => eaten.some((e) => e.i === p.term))
    const anchor = pool[Math.floor(this.rand() * pool.length)]
    const taken: Part[] = []
    for (const e of eaten) {
      const mine = this.parts
        .filter((p) => p.term === e.i && !taken.includes(p))
        .sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))
      taken.push(...mine.slice(0, Math.abs(e.t.nu)))
    }
    const cx = taken.reduce((s, p) => s + p.x, 0) / taken.length
    const cy = taken.reduce((s, p) => s + p.y, 0) / taken.length
    this.parts = this.parts.filter((p) => !taken.includes(p))
    const out: number[] = []
    for (const m of made) for (let k = 0; k < Math.abs(m.t.nu); k++) out.push(m.i)
    const a0 = this.rand() * Math.PI * 2
    out.forEach((term, k) => {
      const spread = out.length > 1 ? 9 : 0
      const ang = a0 + (k * Math.PI * 2) / out.length
      this.parts.push(this.make(term, cx + Math.cos(ang) * spread, cy + Math.sin(ang) * spread))
    })
    const ring: Ring = { x: cx, y: cy, age: 0, term: made[0].i, dir }
    this.rings.push(ring)
    this.recent = [...this.recent.filter((g) => g.dir !== dir).slice(-2), ring]
    if (dir === 1) this.forward++
    else this.reverse++
    this.separate()
  }

  /** One frame. */
  step() {
    let left = DT
    for (let guard = 0; guard < 40; guard++) {
      const pf = this.propensity(1)
      const pr = this.propensity(-1)
      const total = pf + pr
      if (total <= 0) break
      const wait = -Math.log(1 - this.rand()) / total
      if (wait > left) break
      left -= wait
      this.fire(this.rand() * total < pf ? 1 : -1)
    }
    const h = this.height
    for (const p of this.parts) {
      const r = this.radius(p.term)
      p.x += p.vx
      p.y += p.vy
      if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx) }
      if (p.x > SHIFT_BOX.w - r) { p.x = SHIFT_BOX.w - r; p.vx = -Math.abs(p.vx) }
      if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) }
      if (p.y > h - r) { p.y = h - r; p.vy = -Math.abs(p.vy) }
    }
    for (let k = 0; k < 4; k++) this.separate()
    for (const g of this.rings) g.age++
    this.rings = this.rings.filter((g) => g.age < 20)
  }
}

/** The lid, the heat and the pace of each direction for a lever position. */
export function shiftParams(r: EqReaction, t: ShiftTask | null, pos: number): ShiftParams {
  const lever = t?.lever
  const V = lever === 'pressure' ? volumeAt(pos) : 1
  const T = lever === 'temperature' ? temperatureAt(r, pos) : r.T0
  const speed = Math.sqrt(T / r.T0)
  // The balance the rules give: kf and kr are set so both directions go EVENTS times a second there.
  const n = t ? amountsAt(t, pos) : r.base
  let flow = V
  r.terms.forEach((x, i) => { if (x.nu < 0) flow *= Math.pow(n[i] / V, -x.nu) })
  const kf = EVENTS / Math.max(1e-9, flow)
  return { V, speed, kf, kr: kf / equilibriumConstant(r, T) }
}

/** The chamber after the lever is set and it has had time to settle, for a still frame and the tests. */
export function stillShift(t: ShiftTask, pos: number, frames = 360): ShiftSim {
  const r = EQ_REACTIONS[t.reaction]
  const sim = new ShiftSim(r, seedOf(`${t.reaction}|${t.lever}|${t.species}|${pos}`))
  applyShift(sim, t, pos)
  for (let i = 0; i < frames; i++) sim.step()
  return sim
}

export function applyShift(sim: ShiftSim, t: ShiftTask, pos: number) {
  sim.setConditions(shiftParams(sim.r, t, pos))
  if (t.lever === 'concentration' && t.adjust) sim.setAdded(termIndex(sim.r, t.adjust), addedAt(sim.r, t.adjust, pos))
}

function path(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, r: number) {
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2)
  else if (shape === 'square') ctx.rect(x - r, y - r, r * 2, r * 2)
  else if (shape === 'triangle') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.85); ctx.lineTo(x - r * 1.1, y + r * 0.85); ctx.closePath() }
  else { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath() }
}

function drawShift(ctx: CanvasRenderingContext2D, sim: ShiftSim, still: boolean, canvasH: number, lid: boolean) {
  const W = SHIFT_BOX.w
  const C = canvasH
  const h = sim.height
  const top = C - h
  ctx.clearRect(0, 0, W, C)
  ctx.fillStyle = NAVY
  ctx.fillRect(0, top, W, h)
  if (lid) {
    // The lid, its rod and its handle.
    ctx.fillStyle = LID
    ctx.fillRect(0, top - 6, W, 6)
    ctx.fillRect(W / 2 - 2, 8, 4, Math.max(0, top - 14))
    ctx.fillRect(W / 2 - 16, 2, 32, 6)
  }
  ctx.translate(0, top)
  for (const p of sim.parts) {
    const sp = SPECIES[sim.r.terms[p.term].id]
    ctx.strokeStyle = sp.color
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5); ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = sp.color
    ctx.strokeStyle = NAVY
    ctx.lineWidth = 1
    path(ctx, sp.shape, p.x, p.y, radiusOf(sp.atoms))
    ctx.fill(); ctx.stroke()
  }
  // Each reaction draws a ring in the colour of what it made: a solid ring forward, a dashed one back.
  for (const g of still ? sim.recent : sim.rings) {
    const k = still ? 0.3 : g.age / 20
    ctx.strokeStyle = SPECIES[sim.r.terms[g.term].id].color
    ctx.globalAlpha = 1 - k * 0.85
    ctx.lineWidth = 2.5
    ctx.setLineDash(g.dir === 1 ? [] : [4, 3])
    ctx.beginPath(); ctx.arc(g.x, g.y, 8 + k * 9, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
  ctx.translate(0, -top)
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** A canvas that runs `tick` about thirty times a second, or draws one frame under reduced motion. */
function useChamber(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  w: number, h: number, reduced: boolean,
  make: () => { step(): void; draw(ctx: CanvasRenderingContext2D, still: boolean): void; still(): void },
  deps: unknown[],
) {
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const scale = window.devicePixelRatio || 1
    el.width = w * scale
    el.height = h * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const chamber = make()
    if (reduced) {
      chamber.still()
      chamber.draw(ctx, true)
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 33) return
      last = t
      chamber.step()
      chamber.draw(ctx, false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps])
}

function Swatch({ shape, color, size = 14 }: { shape: string; color: string; size?: number }) {
  const c = size / 2
  const r = size * 0.38
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      {shape === 'circle' && <circle cx={c} cy={c} r={r} fill={color} stroke={OUTLINE} strokeWidth={1} />}
      {shape === 'square' && <rect x={c - r} y={c - r} width={r * 2} height={r * 2} fill={color} stroke={OUTLINE} strokeWidth={1} />}
      {shape === 'triangle' && <polygon points={`${c},${c - r * 1.15} ${c + r * 1.1},${c + r * 0.85} ${c - r * 1.1},${c + r * 0.85}`} fill={color} stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />}
      {shape === 'diamond' && <polygon points={`${c},${c - r * 1.2} ${c + r * 1.2},${c} ${c},${c + r * 1.2} ${c - r * 1.2},${c}`} fill={color} stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />}
    </svg>
  )
}

/** "N2O4" with its digits lowered. */
function Formula({ text }: { text: string }) {
  return <>{text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : <Fragment key={i}>{part}</Fragment>))}</>
}

const stop = (e: KeyboardEvent) => e.stopPropagation()

function Dial({ id, label, readout, left, right, value, min, max, locked, onChange, valueText }: {
  id: string; label: string; readout?: string; left: string; right: string; value: number; min: number; max: number
  locked: boolean; onChange(v: number): void; valueText: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-bold text-ss-slate">{label}</label>
        {readout && <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{readout}</span>}
      </div>
      <input
        id={id} type="range" min={min} max={max} step={1} value={value} disabled={locked}
        className="nodrag w-full accent-[color:var(--subject)]"
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={stop}
      />
      <div className="flex justify-between text-[12px] font-bold text-ss-slate"><span>{left}</span><span>{right}</span></div>
    </div>
  )
}

/**
 * How hard collisions are, and how hard a hit must be. The curve is the share of collisions at each energy,
 * exp(-E/kT): hotter, it stays high further along. The part beyond the dashed line is the part that reacts.
 */
export function EnergyRuler({ tau, eps }: { tau: number; eps: number }) {
  const x0 = 10
  const x1 = 350
  const base = 66
  const top = 6
  const EMAX = 6
  const sx = (e: number) => x0 + ((x1 - x0) * e) / EMAX
  const sy = (e: number) => base - (base - top) * Math.exp(-e / tau)
  const pts = (from: number) => Array.from({ length: 49 }, (_, i) => from + ((EMAX - from) * i) / 48).map((e) => `${sx(e).toFixed(1)},${sy(e).toFixed(1)}`)
  const line = pts(0).join(' ')
  const tail = `${sx(eps).toFixed(1)},${base} ${pts(eps).join(' ')} ${sx(EMAX).toFixed(1)},${base}`
  return (
    <svg viewBox="0 0 360 90" role="img" aria-label="How hard collisions are, and how hard a hit must be to react" className="block h-auto w-full">
      <polygon points={tail} style={{ fill: 'var(--ss-accent)' }} />
      <polyline points={line} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: 'var(--ss-slate)' }} />
      <line x1={x0} y1={base} x2={x1} y2={base} strokeWidth={1.5} style={{ stroke: 'var(--ss-slate)' }} />
      <line x1={sx(eps)} y1={top - 4} x2={sx(eps)} y2={base} strokeWidth={2} strokeDasharray="4 3" style={{ stroke: 'var(--ss-ink)' }} />
      <text x={sx(eps) - 5} y={top + 8} textAnchor="end" fontSize={12} fontWeight={700} style={{ fill: 'var(--ss-ink)' }}>needed</text>
      <text x={x1} y={84} textAnchor="end" fontSize={12} fontWeight={700} style={{ fill: 'var(--ss-slate)' }}>energy of a collision</text>
    </svg>
  )
}

function Result({ marked, children }: { marked: string; children: React.ReactNode }) {
  if (marked === 'idle') return null
  return <p className="text-[13px] font-bold leading-snug text-ss-ink" aria-live="polite">{children}</p>
}

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function SpeedScene({ task, pos, set, marked, reduced, locked }: {
  task: SpeedTask; pos: number; set(p: number): void; marked: string; reduced: boolean; locked: boolean
}) {
  const r = RATE_REACTIONS[task.reaction]
  const lv = levelsAt(task, pos)
  const params = useMemo(() => rateParams(task, pos), [task, pos])
  const live = useRef(params)
  live.current = params
  const canvas = useRef<HTMLCanvasElement>(null)
  const sim = useRef<RatesSim | null>(null)
  const seed = seedOf(`${task.reaction}|${task.condition}`)

  useChamber(canvas, BOX.w, BOX.h, reduced, () => {
    if (!sim.current || reduced) sim.current = new RatesSim(live.current, seed)
    return {
      step: () => { const s = sim.current!; if (s.p !== live.current) s.setParams(live.current); s.step() },
      draw: (ctx, still) => drawRates(ctx, sim.current!, still),
      still: () => { sim.current = stillRates(task, pos) },
    }
  }, [reduced, task.reaction, task.condition, reduced ? pos : 0])

  // Under normal motion the running chamber follows the dial without restarting.
  useEffect(() => { if (!reduced && sim.current && sim.current.p !== params) sim.current.setParams(params) }, [params, reduced])

  const made = speedMade(task, pos)
  const [, hi] = posRange(task)
  const tempShown = `${r.temps[lv.temp]} °C`
  const movers = r.movers
  const cond = task.condition
  return (
    <div className="nodrag flex flex-col gap-2">
      <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl">
        <canvas
          ref={canvas} role="img" className="block h-auto w-full" style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}
          aria-label={`Particles moving about in a box${r.solid ? `, with ${r.solid} on the floor` : ''}. Collisions that are hard enough flash, and the particles in them react.`}
        />
      </div>
      <div className="mx-auto flex w-full max-w-[400px] flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold text-ss-ink">
        {movers.map((m, i) => (
          <span key={m} className="inline-flex items-center gap-1.5"><Swatch shape={i === 0 ? 'circle' : 'square'} color={KIND[i]} />{m}</span>
        ))}
        {r.solid && <span className="inline-flex items-center gap-1.5"><Swatch shape="square" color={SOLID} />{r.solid}</span>}
      </div>
      <div className="mx-auto w-full max-w-[400px]"><EnergyRuler tau={params.tau} eps={params.eps} /></div>
      <div className="mx-auto w-full max-w-[400px]">
        {cond === 'catalyst' ? (
          <button
            type="button" role="switch" aria-checked={pos === 1} disabled={locked}
            onClick={() => set(pos === 1 ? 0 : 1)} onKeyDown={stop}
            className="nodrag flex w-full items-center justify-between rounded-xl border-2 border-ss-line px-3 py-2 text-left text-[15px] font-extrabold text-ss-ink"
          >
            <span>Catalyst: {r.catalyst}</span>
            <span aria-hidden className="relative h-6 w-11 rounded-full" style={{ backgroundColor: pos === 1 ? 'var(--ss-accent)' : 'var(--ss-slate)' }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white" style={{ left: pos === 1 ? 22 : 2 }} />
            </span>
          </button>
        ) : (
          <Dial
            id={`dial-${task.reaction}-${cond}`}
            label={conditionLabel(r, cond)}
            readout={cond === 'temperature' ? tempShown : undefined}
            left={cond === 'temperature' ? 'Cooler' : cond === 'concentration' ? (r.phase === 'gas' ? 'Low' : 'Dilute') : 'Lump'}
            right={cond === 'temperature' ? 'Hotter' : cond === 'concentration' ? (r.phase === 'gas' ? 'High' : 'Concentrated') : 'Powder'}
            value={pos} min={0} max={hi} locked={locked} onChange={set}
            valueText={cond === 'temperature' ? tempShown : `setting ${pos + 1} of ${STOPS[cond]}`}
          />
        )}
      </div>
      <Result marked={marked}>
        {marked === 'right'
          ? `${upper(made)}. ${explainSpeed(task, pos)}`
          : `You made the reaction ${made}${made === task.goal ? ', but not by enough to be sure: take the dial further' : ''}. ${explainSpeed(task, pos)}`}
      </Result>
    </div>
  )
}

function ShiftScene({ task, pos, set, marked, reduced, locked }: {
  task: ShiftTask; pos: number; set(p: number): void; marked: string; reduced: boolean; locked: boolean
}) {
  const r = EQ_REACTIONS[task.reaction]
  const canvas = useRef<HTMLCanvasElement>(null)
  const sim = useRef<ShiftSim | null>(null)
  const live = useRef({ task, pos })
  live.current = { task, pos }
  const applied = useRef<string>('')

  const lid = task.lever === 'pressure'
  const canvasH = lid ? SHIFT_BOX.canvasH : SHIFT_BOX.baseH
  useChamber(canvas, SHIFT_BOX.w, canvasH, reduced, () => {
    if (!sim.current || reduced) {
      sim.current = new ShiftSim(r, seedOf(`${task.reaction}|${task.lever}|${task.species}`))
      applied.current = ''
    }
    return {
      step: () => {
        const s = sim.current!
        const key = `${live.current.pos}`
        if (applied.current !== key) { applyShift(s, live.current.task, live.current.pos); applied.current = key }
        s.step()
      },
      draw: (ctx, still) => drawShift(ctx, sim.current!, still, canvasH, lid),
      still: () => { sim.current = stillShift(task, pos) },
    }
  }, [reduced, task.reaction, task.lever, task.species, task.adjust, reduced ? pos : 0])

  const lever = task.lever
  const adjustName = task.adjust ? SPECIES[task.adjust].name : ''
  const T = Math.round(temperatureAt(r, pos) - 273.15)
  const made = shiftMade(task, pos)
  const reactants = r.terms.filter((t) => t.nu < 0)
  const products = r.terms.filter((t) => t.nu > 0)
  const chip = (t: Term) => {
    const sp = SPECIES[t.id]
    return (
      <span key={t.id} className="inline-flex items-center gap-1.5" aria-label={`${Math.abs(t.nu) > 1 ? `${Math.abs(t.nu)} ` : ''}${sp.name}`}>
        {Math.abs(t.nu) > 1 && <span className="text-[15px] font-extrabold text-ss-ink">{Math.abs(t.nu)}</span>}
        <Swatch shape={sp.shape} color={sp.color} size={18} />
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-extrabold text-ss-ink"><Formula text={sp.formula} /></span>
          <span className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{sp.name}</span>
        </span>
      </span>
    )
  }
  const join = (ts: Term[]) => ts.flatMap((t, i) => (i === 0 ? [chip(t)] : [<span key={`p${t.id}`} className="text-[15px] font-extrabold text-ss-slate">+</span>, chip(t)]))
  return (
    <div className="nodrag flex flex-col gap-2">
      <div className="mx-auto flex w-full max-w-[400px] flex-wrap items-center justify-center gap-x-2 gap-y-1" role="img" aria-label={`${reactants.map((t) => SPECIES[t.id].name).join(' and ')} and ${products.map((t) => SPECIES[t.id].name).join(' and ')} change into each other, both ways`}>
        {join(reactants)}
        <span className="text-[18px] font-extrabold text-ss-ink" aria-hidden>⇌</span>
        {join(products)}
      </div>
      <div className="mx-auto w-full max-w-[400px]">
        <canvas
          ref={canvas} role="img" className="block h-auto w-full" style={{ aspectRatio: `${SHIFT_BOX.w} / ${canvasH}` }}
          aria-label="Particles moving about in a box under a lid. All the time some change into the other kind and some change back."
        />
      </div>
      <div className="mx-auto w-full max-w-[400px]">
        <Dial
          id={`dial-${task.reaction}-${lever}`}
          label={lever === 'concentration' ? `Amount of ${adjustName}` : lever === 'pressure' ? 'Pressure' : 'Temperature'}
          readout={lever === 'temperature' ? `${T} °C` : undefined}
          left={lever === 'temperature' ? 'Cooler' : lever === 'pressure' ? 'Lower' : 'Take out'}
          right={lever === 'temperature' ? 'Hotter' : lever === 'pressure' ? 'Higher' : 'Add'}
          value={pos} min={-SHIFT_RANGE} max={SHIFT_RANGE} locked={locked} onChange={set}
          valueText={lever === 'temperature' ? `${T} degrees C` : `position ${pos + SHIFT_RANGE + 1} of ${2 * SHIFT_RANGE + 1}`}
        />
      </div>
      <Result marked={marked}>
        {marked === 'right'
          ? `${upper(made)} ${SPECIES[task.species].name} settled. ${explainShift(task, pos)}`
          : `You made ${made} ${SPECIES[task.species].name} settle${made === (task.amount) ? ', but not by enough to be sure: take the lever further' : ''}. ${explainShift(task, pos)}`}
      </Result>
    </div>
  )
}

export function RatesEquilibriumView({ config, state, setState, marked, reduced, locked }: SceneViewProps<RatesEquilibriumConfig, RatesEquilibriumState>) {
  const t = config.task
  const [lo, hi] = posRange(t)
  const start = t.kind === 'speed' ? startPos(t) : 0
  const raw = typeof state?.pos === 'number' && Number.isFinite(state.pos) ? Math.round(state.pos) : start
  const pos = Math.max(lo, Math.min(hi, raw))
  const set = (p: number) => { if (!locked) setState({ pos: p }) }
  return t.kind === 'speed'
    ? <SpeedScene task={t} pos={pos} set={set} marked={marked} reduced={reduced} locked={locked} />
    : <ShiftScene task={t} pos={pos} set={set} marked={marked} reduced={reduced} locked={locked} />
}
