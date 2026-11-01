import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  magnetismEngine as engine, ARROW_GAP, ARRANGEMENTS, BOUNDS, DEFAULT_COMPASSES, DIAL, GAP, HALF, HALF_SINGLE, INSET, KEY_TURNS, MAX_COMPASSES,
  MIN_COMPASSES, MOTIONS, NEEDLE, NEEDLE_STEPS, POLE_COMPASSES, SITE_COUNT, SNAP, SPEEDS, THICK, TOLERANCE, VIEW,
  angleApart, angleFromDelta, angleOf, bodiesOf, chargesOf, clearance, compassSaid, compassVerdict, countOf, endsOf, fieldAt, fieldLines,
  hasNeutralPoint, hashOf, inductionSaid, inductionVerdict, insideBody, isReference, leftEndOf, magnitude, movementText, outcomeOf,
  pointingWords, poleSaid, poleVerdict, readAngles, readEnds, referenceSide, siteSet, sitesOf, toPx, turnedTo,
  type Arrangement, type CompassTask, type InductionTask, type MagnetismConfig, type Pole, type PoleTask, type Way,
} from './config'
import { MagnetismView, PANEL, SIZE, badgeOf, markerOf, stepChoice, stepsOf } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Magnets and fields, three ways: the learner turns plotting compasses to show the field, names the poles of magnets
 * from their field lines, and predicts what a meter needle does when a magnet moves in a coil. The tutor names an
 * arrangement or a movement; the engine owns every position, angle and verdict.
 */

const compass = (arrangement: string, extra: Record<string, unknown> = {}) => ({ task: { kind: 'compass', arrangement, ...extra } })
const pole = (arrangement: string, extra: Record<string, unknown> = {}) => ({ task: { kind: 'pole', arrangement, ...extra } })
const induction = (p: string, motion: string, speed?: string) => ({ task: { kind: 'induction', pole: p, motion, ...(speed ? { speed } : {}) } })
const read = (raw: unknown): MagnetismConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`did not parse: ${JSON.stringify(raw)}`)
  return c
}
const compassOf = (c: MagnetismConfig) => c.task as CompassTask
const poleOf = (c: MagnetismConfig) => c.task as PoleTask
const inductionOf = (c: MagnetismConfig) => c.task as InductionTask

const POLES: Pole[] = ['N', 'S']
const ARROW_ROOM = 0.15

/** What a person or a screen reader is given: visible text, and the labels read aloud. */
function said(html: string): { texts: string; aloud: string } {
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | ')
  const aloud = [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | ')
  return { texts, aloud }
}

describe('reading what the tutor writes', () => {
  it('reads the documented configs as they are', () => {
    for (const raw of [compass('single', { count: 3 }), pole('repel'), induction('S', 'out', 'faster'), induction('N', 'still')]) {
      const c = read(raw)
      expect(c.task).toMatchObject({ ...raw.task })
    }
    expect(engine.parse(compass('attract'))).toEqual({ task: { kind: 'compass', arrangement: 'attract' } })
    expect(engine.parse(pole('single', { leftEnd: 'N' }))).toEqual({ task: { kind: 'pole', arrangement: 'single', leftEnd: 'N' } })
  })

  it('reads a kind, an arrangement, a pole, a movement and a speed however they are reasonably written', () => {
    expect(read({ task: { kind: 'Plotting compass', arrangement: 'One bar magnet' } }).task).toEqual({ kind: 'compass', arrangement: 'single' })
    expect(read({ task: { kind: 'plotting-compasses', arrangement: 'Two magnets attract', count: '4 compasses' } }).task).toEqual({ kind: 'compass', arrangement: 'attract', count: 4 })
    expect(read({ task: { kind: 'name_the_poles', arrangement: 'unlike poles facing' } }).task).toEqual({ kind: 'pole', arrangement: 'attract' })
    expect(read({ task: { kind: 'Pole', arrangement: 'Like poles', left_end: 'south' } }).task).toEqual({ kind: 'pole', arrangement: 'repel', leftEnd: 'S' })
    expect(read({ task: { kind: 'pole', arrangement: 'Repelling' } }).task).toEqual({ kind: 'pole', arrangement: 'repel' })
    expect(read({ task: { kind: 'compass' } }).task).toEqual({ kind: 'compass', arrangement: 'single' })
    expect(read({ task: { kind: 'electromagnetic induction', pole: 'North pole', motion: 'pulled out', speed: 'more slowly' } }).task)
      .toEqual({ kind: 'induction', pole: 'N', motion: 'out', speed: 'slower' })
    expect(read({ task: { kind: 'predict', pole: 's', movement: 'Pushed in', speed: 'Faster' } }).task).toEqual({ kind: 'induction', pole: 'S', motion: 'in', speed: 'faster' })
    expect(read({ task: { kind: 'induction', pole: 'S', motion: 'Held still', speed: 'faster' } }).task).toEqual({ kind: 'induction', pole: 'S', motion: 'still' })
    // A magnet held still has no leading pole to name.
    expect(read({ task: { kind: 'induction', motion: 'still' } }).task).toEqual({ kind: 'induction', pole: 'N', motion: 'still' })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 'compass', 7, {}, { task: null }, { task: 'compass' }, { task: {} }, { task: { kind: 'dance' } }, { task: { kind: 5 } }, { task: { kind: 'electromagnet' } }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('reads what it cannot draw, so that faults can say why in words that can be acted on', () => {
    for (const [raw, why] of [
      [compass('triple'), /"triple" is not an arrangement the card can draw: use "single", "attract" or "repel"/],
      [pole('two'), /"two" is not an arrangement/],
      [compass('single', { count: 'three' }), /"three" is not a number of compasses: use 2 to 4/],
      [compass('single', { leftEnd: 'E' }), /"E" is not a pole for the far left end: use "N" or "S"/],
      [induction('N', 'sideways'), /"sideways" is not a movement the card can draw: use "in", "out" or "still"/],
      [induction('E', 'in', 'faster'), /"E" is not a pole: use "N" or "S"/],
      [induction('N', 'in', 'warp'), /"warp" is not a speed the card can draw: use "same", "faster" or "slower"/],
      [{ task: { kind: 'induction', pole: 'N' } }, /The movement is missing/],
      [{ task: { kind: 'induction', motion: 'in' } }, /The pole is missing/],
    ] as [unknown, RegExp][]) {
      const c = read(raw)
      const f = engine.faults(c)
      expect(f.length, JSON.stringify(raw)).toBeGreaterThan(0)
      expect(f.join(' '), JSON.stringify(raw)).toMatch(why)
      for (const line of f) expect(line, line).toMatch(/\b(use|Use|say|Change|Name)\b/)
    }
  })

  it('refuses a number of compasses the card cannot hold, and the case that is the reference itself', () => {
    expect(engine.faults(read(compass('single', { count: 1 })))[0]).toMatch(/^1 compasses is not a number the card can hold: use 2 to 4 \(e\.g\. 3\)/)
    expect(engine.faults(read(compass('single', { count: 9 }))).length).toBe(1)
    expect(engine.faults(read(compass('single', { count: 2.5 }))).length).toBe(1)
    for (const n of [2, 3, 4]) expect(engine.faults(read(compass('repel', { count: n })))).toEqual([])
    for (const raw of [induction('N', 'in'), induction('N', 'in', 'same'), induction('north', 'pushed in', 'steady')]) {
      expect(engine.faults(read(raw))[0], JSON.stringify(raw)).toMatch(/is the reference case the card shows first, so there is nothing to predict\. Change the pole/)
    }
    expect(engine.faults(read(induction('N', 'in', 'faster')))).toEqual([])
    expect(engine.faults(read(induction('S', 'in')))).toEqual([])
    expect(engine.faults(read(induction('N', 'out')))).toEqual([])
    expect(engine.faults(read(induction('N', 'still')))).toEqual([])
  })
})

describe('the field of a bar magnet, as the two-pole model gives it', () => {
  const at = (arr: Arrangement, left: Pole, x: number, y: number) => fieldAt(chargesOf(arr, left), x, y)

  it('puts a north and a south pole on each magnet, a little inside its ends, and unlike or like poles where the arrangement says', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        const cs = chargesOf(arr, left)
        const bodies = bodiesOf(arr)
        expect(cs).toHaveLength(bodies.length * 2)
        bodies.forEach((b, i) => {
          expect(cs[2 * i].x).toBeCloseTo(b.x0 + INSET, 9)
          expect(cs[2 * i + 1].x).toBeCloseTo(b.x1 - INSET, 9)
          // One north and one south to a magnet.
          expect(cs[2 * i].q * cs[2 * i + 1].q).toBe(-1)
        })
        expect(cs[0].q).toBe(left === 'N' ? 1 : -1)
        // The two facing ends.
        if (arr === 'attract') expect(cs[1].q * cs[2].q, `${arr} ${left}`).toBe(-1)
        if (arr === 'repel') expect(cs[1].q * cs[2].q, `${arr} ${left}`).toBe(1)
        // Reversing which pole is at the left reverses every pole, and so the field everywhere.
        const flipped = chargesOf(arr, left === 'N' ? 'S' : 'N')
        for (let i = 0; i < cs.length; i++) expect(flipped[i].q).toBe(-cs[i].q)
      }
    }
    expect(HALF_SINGLE).toBeGreaterThan(HALF)
    expect(bodiesOf('attract')[1].x0 - bodiesOf('attract')[0].x1).toBeCloseTo(2 * GAP, 9)
  })

  it('points away from a north pole and towards a south pole, and from north to south above a magnet', () => {
    // N at the right: on the axis beyond the north end the field runs on away from it; beyond the south end it runs in towards it, so the same way.
    const n = chargesOf('single', 'S').find((c) => c.q === 1)!
    expect(n.x).toBeGreaterThan(0)
    expect(angleOf(at('single', 'S', n.x + 1, 0))).toBe(0)
    expect(angleOf(at('single', 'S', -n.x - 1, 0))).toBe(0)
    // Above or below the middle the field points from the north end to the south end: left, here.
    expect(angleOf(at('single', 'S', 0, 1.2))).toBeCloseTo(180, 6)
    expect(angleOf(at('single', 'S', 0, -1.2))).toBeCloseTo(180, 6)
    // And the other way round with the poles swapped.
    expect(angleOf(at('single', 'N', 0, 1.2))).toBeCloseTo(0, 6)
    // Close to a pole the field points straight away from a north pole and straight in to a south pole.
    const s = chargesOf('single', 'S').find((c) => c.q === -1)!
    expect(angleApart(angleOf(at('single', 'S', n.x + 0.05, 0.3)), angleOf({ x: 0.05, y: 0.3 }))).toBeLessThan(8)
    expect(angleApart(angleOf(at('single', 'S', s.x - 0.05, 0.3)), angleOf({ x: 0.05, y: -0.3 }))).toBeLessThan(8)
  })

  it('agrees, far from the magnet, with the textbook field of a point dipole', () => {
    // B = (3 (m . r) r / r^2 - m) / r^3, with m the sum of each pole's strength times its place.
    for (const arr of ['single'] as const) {
      const cs = chargesOf(arr, 'N')
      const m = { x: cs.reduce((a, c) => a + c.q * c.x, 0), y: 0 }
      for (const [x, y] of [[60, 0], [0, 60], [42, 42], [-50, 20], [30, -55]]) {
        const r2 = x * x + y * y
        const r = Math.sqrt(r2)
        const dot = m.x * x
        const dipole = { x: (3 * dot * x) / r2 - m.x, y: (3 * dot * y) / r2 - m.y }
        const want = { x: dipole.x / (r2 * r), y: dipole.y / (r2 * r) }
        const got = at(arr, 'N', x, y)
        expect(magnitude(got) / magnitude(want), `${x},${y}`).toBeGreaterThan(0.98)
        expect(magnitude(got) / magnitude(want), `${x},${y}`).toBeLessThan(1.02)
        expect(angleApart(angleOf(got), angleOf(want)), `${x},${y}`).toBeLessThan(1)
      }
    }
  })

  it('has the field exactly zero midway between two like poles, and nowhere else in that arrangement, and none on the axis between unlike poles', () => {
    expect(magnitude(at('repel', 'N', 0, 0))).toBeLessThan(1e-12)
    expect(magnitude(at('repel', 'S', 0, 0))).toBeLessThan(1e-12)
    expect(magnitude(at('repel', 'N', 0.25, 0))).toBeGreaterThan(0.4)
    expect(magnitude(at('repel', 'N', 0, 0.25))).toBeGreaterThan(0.4)
    expect(magnitude(at('attract', 'N', 0, 0))).toBeGreaterThan(3)
    expect(hasNeutralPoint('repel')).toBe(true)
    // Only the one between like poles is marked and named.
    expect(hasNeutralPoint('attract')).toBe(false)
    expect(hasNeutralPoint('single')).toBe(false)
    // Every interior low point of the field's strength on the picture, off the magnets: one midway between two like poles; none for a
    // single magnet; and, for two unlike poles facing, the pair off the axis, above and below the middle (real, and left unmarked).
    const step = 0.05
    for (const arr of ARRANGEMENTS) {
      const cs = chargesOf(arr, 'N')
      const nx = Math.round((2 * BOUNDS.x) / step)
      const ny = Math.round((2 * BOUNDS.y) / step)
      const grid: number[][] = []
      for (let j = 0; j <= ny; j++) {
        const row: number[] = []
        for (let i = 0; i <= nx; i++) {
          const x = -BOUNDS.x + i * step
          const y = -BOUNDS.y + j * step
          row.push(insideBody(arr, x, y) ? Infinity : magnitude(fieldAt(cs, x, y)))
        }
        grid.push(row)
      }
      const lows: [number, number][] = []
      for (let j = 1; j < ny; j++) {
        for (let i = 1; i < nx; i++) {
          const v = grid[j][i]
          if (!Number.isFinite(v)) continue
          let low = true
          for (let dj = -1; dj <= 1 && low; dj++) for (let di = -1; di <= 1; di++) if ((dj || di) && grid[j + dj][i + di] < v) { low = false; break }
          if (low) lows.push([-BOUNDS.x + i * step, -BOUNDS.y + j * step])
        }
      }
      if (arr === 'repel') {
        expect(lows, arr).toHaveLength(1)
        expect(Math.hypot(lows[0][0], lows[0][1])).toBeLessThan(2 * step)
      } else if (arr === 'attract') {
        expect(lows, arr).toHaveLength(2)
        for (const [x, y] of lows) {
          expect(Math.abs(x)).toBeLessThan(2 * step)
          expect(Math.abs(y)).toBeGreaterThan(2)
          expect(Math.abs(y)).toBeLessThan(2.3)
        }
      } else {
        expect(lows, arr).toEqual([])
      }
    }
  })

  it('does not depend on how the angle is measured: an angle is degrees anticlockwise from the right', () => {
    expect(angleOf({ x: 1, y: 0 })).toBe(0)
    expect(angleOf({ x: 0, y: 1 })).toBe(90)
    expect(angleOf({ x: -1, y: 0 })).toBe(180)
    expect(angleOf({ x: 0, y: -1 })).toBe(270)
    expect(angleApart(350, 10)).toBe(20)
    expect(angleApart(0, 180)).toBe(180)
    expect(angleApart(90, 90)).toBe(0)
    expect(angleApart(-30, 330)).toBe(0)
  })
})

describe('the field lines of every arrangement', () => {
  const sets = ARRANGEMENTS.flatMap((arr) => POLES.map((left) => ({ arr, left, lines: fieldLines(arr, left), cs: chargesOf(arr, left) })))

  it('stay on the picture and off the magnets, and run the way the field points at every step', () => {
    for (const { arr, left, lines, cs } of sets) {
      expect(lines.length, `${arr} ${left}`).toBeGreaterThanOrEqual(arr === 'single' ? 18 : 28)
      for (const run of lines) {
        for (const p of run.pts) {
          if (insideBody(arr, p.x, p.y) || Math.abs(p.x) > BOUNDS.x || Math.abs(p.y) > BOUNDS.y) throw new Error(`${arr} ${left}: point ${p.x},${p.y} is off`)
        }
        for (let i = 1; i < run.pts.length; i += 3) {
          const a = run.pts[i - 1]
          const b = run.pts[i]
          const f = fieldAt(cs, (a.x + b.x) / 2, (a.y + b.y) / 2)
          if ((b.x - a.x) * f.x + (b.y - a.y) * f.y <= 0) throw new Error(`${arr} ${left}: a line runs against the field at ${a.x},${a.y}`)
        }
      }
    }
  })

  it('never cross each other, and run from the north poles in towards the south poles', () => {
    const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
      const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
    }
    for (const { arr, left, lines } of sets) {
      const segs = lines.map((run) => run.pts.filter((_, i) => i % 3 === 0 || i === run.pts.length - 1))
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          // Cheap box test first: most pairs are far apart.
          const bi = [Math.min(...segs[i].map((p) => p.x)), Math.max(...segs[i].map((p) => p.x)), Math.min(...segs[i].map((p) => p.y)), Math.max(...segs[i].map((p) => p.y))]
          const bj = [Math.min(...segs[j].map((p) => p.x)), Math.max(...segs[j].map((p) => p.x)), Math.min(...segs[j].map((p) => p.y)), Math.max(...segs[j].map((p) => p.y))]
          if (bi[1] < bj[0] || bj[1] < bi[0] || bi[3] < bj[2] || bj[3] < bi[2]) continue
          for (let a = 1; a < segs[i].length; a++) {
            for (let b = 1; b < segs[j].length; b++) {
              if (cross(segs[i][a - 1], segs[i][a], segs[j][b - 1], segs[j][b])) throw new Error(`${arr} ${left}: lines ${i} and ${j} cross`)
            }
          }
        }
      }
    }
  })

  it('start at a north pole or come in from beyond the picture, and end at a south pole or leave it', () => {
    for (const { arr, left, lines, cs } of sets) {
      let fromNorth = 0
      let intoSouth = 0
      for (const run of lines) {
        const first = run.pts[0]
        const last = run.pts[run.pts.length - 1]
        const nearest = (p: { x: number; y: number }) => cs.reduce((a, c) => (Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(p.x - a.x, p.y - a.y) ? c : a))
        const out = (p: { x: number; y: number }) => Math.abs(p.x) > BOUNDS.x - 0.2 || Math.abs(p.y) > BOUNDS.y - 0.2
        if (out(first)) expect(nearest(last).q, `${arr} ${left}: a line from beyond the picture ends at a north pole`).toBe(-1)
        else {
          expect(nearest(first).q, `${arr} ${left}`).toBe(1)
          fromNorth++
        }
        if (!out(last)) intoSouth++
      }
      expect(fromNorth, `${arr} ${left}`).toBeGreaterThan(cs.filter((c) => c.q === 1).length * 4)
      expect(intoSouth, `${arr} ${left}`).toBeGreaterThan(0)
    }
  })

  it('carry an arrow each, in sight, on the line, apart from one another and from the magnets', () => {
    for (const { arr, left, lines, cs } of sets) {
      lines.forEach((run, i) => {
        const a = run.arrow
        if (clearance(arr, a.x, a.y) < ARROW_ROOM - 1e-9 || Math.abs(a.x) > BOUNDS.x - 0.1 || Math.abs(a.y) > BOUNDS.y - 0.1) throw new Error(`${arr} ${left}: arrow ${i} at ${a.x},${a.y}`)
        const near = Math.min(...run.pts.map((p) => Math.hypot(p.x - a.x, p.y - a.y)))
        expect(near, `${arr} ${left} arrow ${i}`).toBeLessThan(1e-9)
        // It points the way the field points there.
        expect(angleApart(a.angle, angleOf(fieldAt(cs, a.x, a.y))), `${arr} ${left} arrow ${i}`).toBeLessThan(12)
        for (let j = i + 1; j < lines.length; j++) {
          const o = lines[j].arrow
          if (Math.hypot(a.x - o.x, a.y - o.y) < ARROW_GAP - 1e-9) throw new Error(`${arr} ${left}: arrows ${i} and ${j} touch`)
        }
      })
    }
  })

  it('leave no line along the axis between two like poles, where it would have to pass the neutral point', () => {
    for (const left of POLES) {
      for (const run of fieldLines('repel', left)) {
        const ys = run.pts.map((p) => Math.abs(p.y))
        // A line that crosses the middle line x = 0 does so away from the axis.
        for (let i = 1; i < run.pts.length; i++) {
          if (run.pts[i - 1].x * run.pts[i].x < 0) expect(Math.abs(run.pts[i].y)).toBeGreaterThan(0.2)
        }
        expect(Math.max(...ys)).toBeGreaterThan(0)
      }
    }
  })
})

describe('where the compasses stand', () => {
  const lefts: Pole[] = ['N', 'S']

  it('puts each one clear of the magnets, in a field strong enough to read, whose direction is steady across the needle, and inside the picture', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of lefts) {
        const cs = chargesOf(arr, left)
        for (const s of siteSet(arr, left, 0, SITE_COUNT, 'x')) {
          const label = `${arr} ${left} (${s.x}, ${s.y})`
          expect(clearance(arr, s.x, s.y), label).toBeGreaterThanOrEqual(DIAL + 0.15 - 1e-9)
          const b = fieldAt(cs, s.x, s.y)
          expect(magnitude(b), label).toBeGreaterThanOrEqual(0.2)
          for (let k = 0; k < 16; k++) {
            const t = (k * Math.PI) / 8
            const near = fieldAt(cs, s.x + (NEEDLE * 2 / 3) * Math.cos(t), s.y + (NEEDLE * 2 / 3) * Math.sin(t))
            expect(angleApart(angleOf(b), angleOf(near)), label).toBeLessThan(20)
          }
          // Dial and its number badge inside the plate, with room.
          const px = toPx(s.x, s.y)
          expect(px.x - SIZE.dial, label).toBeGreaterThan(6)
          expect(px.x + SIZE.dial, label).toBeLessThan(VIEW.w - 6)
          expect(px.y - SIZE.dial - 20, label).toBeGreaterThan(2)
          expect(px.y + SIZE.dial, label).toBeLessThan(VIEW.h - 6)
        }
      }
    }
    expect(SIZE.l).toBe(NEEDLE * VIEW.scale)
    expect(SIZE.dial).toBe(DIAL * VIEW.scale)
  })

  it('deals any run of the list so that the compasses are far apart and point different ways', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of lefts) {
        for (let from = 0; from < SITE_COUNT; from++) {
          const four = siteSet(arr, left, from, MAX_COMPASSES, 'x')
          for (let i = 0; i < four.length; i++) {
            for (let j = i + 1; j < four.length; j++) {
              // Hit areas (24 px round each) never overlap, and a number is nearer its own dial than another's.
              expect(Math.hypot(four[i].x - four[j].x, four[i].y - four[j].y) * VIEW.scale, `${arr} ${from}`).toBeGreaterThanOrEqual(2 * SIZE.hit + 8)
            }
          }
          // Of any three, two point at least 60 degrees apart: not all one answer.
          for (let k = 0; k + 3 <= four.length; k++) {
            const three = four.slice(k, k + 3)
            const spread = Math.max(...three.flatMap((a) => three.map((b) => angleApart(a.truth, b.truth))))
            expect(spread, `${arr} ${left} from ${from}`).toBeGreaterThanOrEqual(60)
          }
        }
      }
    }
  })

  it('draws the dials clear of the magnets and of each other, each number nearer its own dial, and inside the picture', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of lefts) {
        for (let from = 0; from < SITE_COUNT; from++) {
          const four = siteSet(arr, left, from, MAX_COMPASSES, 'x')
          for (const s of four) {
            const b = badgeOf(s)
            expect(b.x - b.r, `${arr} ${from}`).toBeGreaterThanOrEqual(1)
            expect(b.x + b.r, `${arr} ${from}`).toBeLessThanOrEqual(VIEW.w - 1)
            expect(b.y - b.r, `${arr} ${from}`).toBeGreaterThanOrEqual(1)
            const own = toPx(s.x, s.y)
            const ownGap = Math.hypot(b.x - own.x, b.y - own.y)
            // It touches no dial, not even its own, and is nearest its own.
            expect(ownGap, `${arr} ${from}`).toBeGreaterThan(SIZE.dial + b.r)
            for (const o of four) {
              if (o === s) continue
              const c = toPx(o.x, o.y)
              expect(Math.hypot(b.x - c.x, b.y - c.y), `${arr} ${from}: number ${s.id + 1} nearer compass ${o.id + 1}`).toBeGreaterThan(ownGap + 4)
              expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeGreaterThan(SIZE.dial + b.r)
              const ob = badgeOf(o)
              expect(Math.hypot(b.x - ob.x, b.y - ob.y)).toBeGreaterThan(2 * b.r + 2)
            }
            // A magnet's edge is not under it either: a badge sits in clear plate.
            expect(clearance(arr, (b.x - VIEW.w / 2) / VIEW.scale, (VIEW.h / 2 - b.y) / VIEW.scale) * VIEW.scale, `${arr} ${from}: number ${s.id + 1} on a magnet`).toBeGreaterThan(b.r)
          }
        }
      }
    }
  })

  it('deals a card its own run, the same each time, and different cards different runs', () => {
    const a = sitesOf(compassOf(read(compass('single'))))
    expect(sitesOf(compassOf(read(compass('single'))))).toEqual(a)
    expect(a).toHaveLength(DEFAULT_COMPASSES)
    const runs = new Set<string>()
    for (const arr of ARRANGEMENTS) for (const left of [undefined, 'N', 'S']) for (const count of [2, 3, 4]) {
      const s = sitesOf(compassOf(read(compass(arr, { count, ...(left ? { leftEnd: left } : {}) }))))
      expect(s).toHaveLength(count)
      runs.add(s.map((x) => `${x.x},${x.y}`).join(' '))
    }
    expect(runs.size).toBeGreaterThan(12)
    expect(sitesOf(poleOf(read(pole('repel'))))).toHaveLength(POLE_COMPASSES)
    expect(countOf(compassOf(read(compass('single', { count: 40 }))))).toBe(MAX_COMPASSES)
    expect(countOf(compassOf(read(compass('single', { count: 0 }))))).toBe(MIN_COMPASSES)
  })

  it('chooses which pole is at the left from the card unless the tutor says, and a card always gets the same', () => {
    expect(leftEndOf(poleOf(read(pole('single', { leftEnd: 'N' }))))).toBe('N')
    expect(leftEndOf(poleOf(read(pole('single', { leftEnd: 'S' }))))).toBe('S')
    const seen = new Set<string>()
    for (const arr of ARRANGEMENTS) {
      for (const k of ['compass', 'pole']) {
        const t = read({ task: { kind: k, arrangement: arr } }).task as CompassTask
        expect(leftEndOf(t)).toBe(leftEndOf(t))
        seen.add(leftEndOf(t))
      }
    }
    // Neither pole is always the left one.
    expect(seen.size).toBe(2)
    expect(hashOf('a')).toBe(hashOf('a'))
    expect(hashOf('a')).not.toBe(hashOf('b'))
  })
})

describe('words for where a needle points', () => {
  it('says a direction as it is seen', () => {
    expect(pointingWords(0)).toBe('right')
    expect(pointingWords(45)).toBe('up and to the right')
    expect(pointingWords(90)).toBe('up')
    expect(pointingWords(180)).toBe('left')
    expect(pointingWords(270)).toBe('down')
    expect(pointingWords(315)).toBe('down and to the right')
    expect(pointingWords(15)).toBe('right, turned 15 degrees anticlockwise from there')
    expect(pointingWords(345)).toBe('right, turned 15 degrees clockwise from there')
    expect(pointingWords(165)).toBe('left, turned 15 degrees clockwise from there')
    expect(pointingWords(-90)).toBe('down')
  })
})

describe('turning a needle', () => {
  it('turns by the arrows the way a dial reads, a step at a time, and the page keys three steps', () => {
    expect(KEY_TURNS.ArrowRight).toBe(-SNAP)
    expect(KEY_TURNS.ArrowUp).toBe(-SNAP)
    expect(KEY_TURNS.ArrowLeft).toBe(SNAP)
    expect(KEY_TURNS.ArrowDown).toBe(SNAP)
    expect(KEY_TURNS.PageUp).toBe(-3 * SNAP)
    expect(KEY_TURNS.PageDown).toBe(3 * SNAP)
    expect(Object.keys(KEY_TURNS).every((k) => /^(Arrow|Page)/.test(k))).toBe(true)
    expect(turnedTo([0, 90], 1, 90 + KEY_TURNS.ArrowLeft)).toEqual([0, 105])
    expect(turnedTo([0, 90], 0, 0 + KEY_TURNS.ArrowRight)).toEqual([345, 90])
    expect(turnedTo([345, 90], 0, 345 + KEY_TURNS.ArrowLeft)).toEqual([0, 90])
    expect(turnedTo([0, 90], 0, 0 + KEY_TURNS.PageDown)).toEqual([45, 90])
  })

  it('snaps to 15 degrees, wraps round, and says nothing changed when it did not', () => {
    expect(turnedTo([0], 0, 7)).toBeNull()
    expect(turnedTo([0], 0, 8)).toEqual([15])
    expect(turnedTo([0], 0, -8)).toEqual([345])
    expect(turnedTo([0], 0, 370)).toEqual([15])
    expect(turnedTo([0], 0, 360)).toBeNull()
    expect(turnedTo([0, 0], 2, 90)).toBeNull()
    expect(turnedTo([0, 0], -1, 90)).toBeNull()
    const before = [10 * SNAP]
    turnedTo(before, 0, 0)
    expect(before).toEqual([150])
  })

  it('reads a pointer as the needle’s angle, up the screen being up, and ignores one on the pivot', () => {
    expect(angleFromDelta(10, 0)).toBe(0)
    expect(angleFromDelta(0, 10)).toBe(90)
    expect(angleFromDelta(-10, 0)).toBe(180)
    expect(angleFromDelta(0, -10)).toBe(270)
    expect(angleFromDelta(10, 10)).toBe(45)
    expect(angleFromDelta(20, 5)).toBe(15)
    expect(angleFromDelta(2, 2)).toBeNull()
    expect(angleFromDelta(0, 0)).toBeNull()
    expect(angleFromDelta(-10, -1)).toBe(180)
  })

  it('steps through choices with the arrows, from nothing to the first or the last, wrapping', () => {
    const ids = ['a', 'b', 'c']
    expect(stepChoice(ids, '', 1)).toBe('a')
    expect(stepChoice(ids, '', -1)).toBe('c')
    expect(stepChoice(ids, 'a', 1)).toBe('b')
    expect(stepChoice(ids, 'c', 1)).toBe('a')
    expect(stepChoice(ids, 'a', -1)).toBe('c')
    expect(stepChoice(ids, 'b', -1)).toBe('a')
  })
})

// ---------------------------------------------------------------------------

/** Every config the tutor can write, with the fields the engine owns left to it, and with them chosen too. */
function everyConfig(): { raw: unknown; label: string }[] {
  const out: { raw: unknown; label: string }[] = []
  for (const arr of ARRANGEMENTS) {
    for (const left of [undefined, 'N', 'S']) {
      const extra = left ? { leftEnd: left } : {}
      for (const count of [undefined, 2, 3, 4]) out.push({ raw: compass(arr, { ...extra, ...(count ? { count } : {}) }), label: `compass ${arr} ${left} ${count}` })
      out.push({ raw: pole(arr, extra), label: `pole ${arr} ${left}` })
    }
  }
  for (const p of POLES) {
    for (const motion of ['in', 'out']) {
      for (const speed of [undefined, 'same', 'faster', 'slower']) out.push({ raw: induction(p, motion, speed), label: `induction ${p} ${motion} ${speed}` })
    }
    out.push({ raw: induction(p, 'still'), label: `induction ${p} still` })
  }
  return out
}

describe('every config the tutor can write', { timeout: 30_000 }, () => {
  const all = everyConfig()

  it('starts unsolved, can always be solved, and fails for any one thing wrong', () => {
    let valid = 0
    let refused = 0
    for (const { raw, label } of all) {
      const c = read(raw)
      const faults = engine.faults(c)
      if (c.task.kind === 'induction' && isReference(c.task)) {
        refused++
        expect(faults, label).toHaveLength(1)
        continue
      }
      expect(faults, label).toEqual([])
      valid++
      // Starts unsolved, and solves.
      expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
      const solved = engine.solve(c)
      expect(engine.check(c, solved).ok, `${label} cannot be solved`).toBe(true)
      // The state survives being saved and read back.
      expect(engine.check(c, JSON.parse(JSON.stringify(solved))).ok, label).toBe(true)
      expect(engine.check(c, JSON.parse(JSON.stringify(engine.initial(c)))).ok, label).toBe(false)
      if (c.task.kind === 'compass') {
        const sites = sitesOf(c.task)
        const sol = solved as { angles: number[] }
        expect(sol.angles).toHaveLength(sites.length)
        for (let i = 0; i < sites.length; i++) {
          // Turned the wrong way round, or across the field, or just out of tolerance, one needle is enough to fail.
          for (const off of [180, 90, 270, TOLERANCE + SNAP, -(TOLERANCE + SNAP)]) {
            const bad = sol.angles.slice()
            bad[i] = (bad[i] + off + 360) % 360
            const verdict = engine.check(c, { angles: bad })
            expect(verdict.ok, `${label} needle ${i + 1} ${off}`).toBe(false)
            expect(verdict.wrongIds, label).toEqual([String(i)])
          }
          // Within the tolerance of the field is right.
          for (const off of [-TOLERANCE, -SNAP, SNAP, TOLERANCE]) {
            const near = sol.angles.slice()
            near[i] = (near[i] + off + 360) % 360
            expect(engine.check(c, { angles: near }).ok, `${label} needle ${i + 1} ${off}`).toBe(true)
          }
          // Each needle starts well away from the field.
          expect(angleApart((engine.initial(c) as { angles: number[] }).angles[i], sites[i].truth), `${label} needle ${i + 1}`).toBeGreaterThanOrEqual(90)
        }
      }
      if (c.task.kind === 'pole') {
        const sol = (solved as { ends: string[] }).ends
        expect(sol).toEqual(endsOf(c.task).map((e) => e.sign))
        // Each magnet has one of each; every other naming fails.
        expect(sol.filter((x) => x === 'N')).toHaveLength(sol.length / 2)
        for (let mask = 0; mask < 1 << sol.length; mask++) {
          const named = sol.map((s, i) => (mask & (1 << i) ? (s === 'N' ? 'S' : 'N') : s))
          expect(engine.check(c, { ends: named }).ok, `${label} ${named}`).toBe(mask === 0)
        }
        expect(engine.check(c, { ends: sol.map((_, i) => (i === 0 ? '' : sol[i])) }).ok).toBe(false)
      }
      if (c.task.kind === 'induction') {
        const want = outcomeOf(c.task)
        let right = 0
        for (const way of ['', 'left', 'none', 'right']) {
          for (const size of ['', 'less', 'same', 'further']) {
            const ok = engine.check(c, { way, size }).ok
            if (ok) right++
            const expected = way === want.way && (want.size === null || size === want.size)
            expect(ok, `${label} ${way}/${size}`).toBe(expected)
          }
        }
        // One way and one size are right; for a magnet held still, any size goes with "stays at zero".
        expect(right).toBe(want.size === null ? 4 : 1)
      }
    }
    // 3 arrangements x 3 left ends x (3 compass counts + 1 default + 1 pole) = 45; 2 poles x 2 movements x 4 speeds + 2 still = 18 (2 refused).
    expect(valid + refused).toBe(all.length)
    expect(valid).toBe(45 + 16)
    expect(refused).toBe(2)
  })

  it('is deal-proof: every pole at the left, every start of the list and every count solves and starts unsolved', () => {
    let dealt = 0
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        const cs = chargesOf(arr, left)
        for (let from = 0; from < SITE_COUNT; from++) {
          for (let count = MIN_COMPASSES; count <= MAX_COMPASSES; count++) {
            for (const seed of ['a', 'b', 'compass:single:3:', 'pole:repel::N']) {
              const sites = siteSet(arr, left, from, count, seed)
              dealt++
              expect(sites).toHaveLength(count)
              for (const s of sites) {
                // The truth is the field's direction, to the nearest step.
                expect(angleApart(s.truth, angleOf(fieldAt(cs, s.x, s.y))), `${arr} ${left} ${from}`).toBeLessThanOrEqual(SNAP / 2 + 1e-9)
                expect(s.truth % SNAP).toBe(0)
                expect(s.start % SNAP).toBe(0)
                expect(angleApart(s.start, s.truth)).toBeGreaterThanOrEqual(90)
              }
            }
          }
        }
      }
    }
    expect(dealt).toBe(3 * 2 * 8 * 3 * 4)
  })

  it('refuses nothing it can draw, apart from the reference case', () => {
    for (const { raw, label } of all) {
      const c = read(raw)
      expect(c, label).not.toBeNull()
      const f = engine.faults(c)
      if (!(c.task.kind === 'induction' && isReference(c.task))) expect(f, label).toEqual([])
    }
  })
})

describe('marking a compass card', () => {
  const c = read(compass('repel', { count: 3, leftEnd: 'N' }))
  const task = compassOf(c)
  const sites = sitesOf(task)

  it('marks every needle against the field, within 30 degrees, wherever it is turned', () => {
    expect(TOLERANCE).toBe(30)
    expect(compassVerdict(task, engine.solve(c))).toEqual({ ok: true, wrong: [] })
    expect(compassVerdict(task, engine.initial(c)).wrong).toEqual(sites.map((s) => s.id))
    const half = { angles: sites.map((s, i) => (i === 0 ? s.truth : (s.truth + 180) % 360)) }
    expect(compassVerdict(task, half)).toEqual({ ok: false, wrong: [1, 2] })
  })

  it('reads a state it cannot use as the start, a needle at a time', () => {
    for (const bad of [null, undefined, 'junk', 7, {}, { angles: 'x' }, { angles: [] }, { angles: [null, 'a', {}] }]) {
      expect(readAngles(task, bad as never), JSON.stringify(bad)).toEqual(sites.map((s) => s.start))
    }
    expect(readAngles(task, { angles: [sites[0].truth, 'x'] })).toEqual([sites[0].truth, sites[1].start, sites[2].start])
    expect(readAngles(task, { angles: [7, 8, 361] })).toEqual([0, 15, 0])
    expect(readAngles(task, { angles: [NaN, Infinity] }).slice(0, 2)).toEqual([sites[0].start, sites[1].start])
    expect(engine.check(c, null as never).ok).toBe(false)
  })

  it('says a wrong needle back with where it was turned and where the field points, never before marking', () => {
    const s0 = sites[0]
    const wrong = { angles: [(s0.truth + 180) % 360, sites[1].truth, sites[2].truth] }
    const lines = compassSaid(task, wrong, 'wrong')
    expect(lines[0]).toBe(`Compass 1: you turned it to point ${pointingWords((s0.truth + 180) % 360)}. The field there points ${pointingWords(s0.truth)}. That is the wrong way round.`)
    expect(lines.join(' ')).not.toMatch(/Compass 2|Compass 3/)
    expect(lines.join(' ')).toMatch(/field lines run from north to south/)
    expect(lines.join(' ')).toMatch(/neutral point/)
    const across = compassSaid(task, { angles: [(s0.truth + 90) % 360, sites[1].truth, sites[2].truth] }, 'wrong')[0]
    expect(across).toMatch(/That needle lies across the field, not along it\.$/)
    const near = compassSaid(task, { angles: [(s0.truth + 45) % 360, sites[1].truth, sites[2].truth] }, 'wrong')[0]
    expect(near).toMatch(/That is not quite along the field\.$/)
  })

  it('says the rule and the neutral point once right, and the neutral point only where there is one', () => {
    const right = compassSaid(task, engine.solve(c), 'right')
    expect(right[0]).toBe('Every needle lies along the field, with its red end pointing the way the field points.')
    expect(right.join(' ')).toMatch(/away from a north pole and towards a south pole/)
    expect(right.join(' ')).toMatch(/neutral point, midway between the two magnets, where their fields cancel and the field is zero/)
    expect(compassSaid(compassOf(read(compass('single'))), engine.solve(read(compass('single'))), 'right').join(' ')).not.toMatch(/neutral/)
    expect(compassSaid(compassOf(read(compass('attract'))), engine.solve(read(compass('attract'))), 'shown').join(' ')).not.toMatch(/neutral/)
  })
})

describe('marking a pole card', () => {
  const c = read(pole('attract', { leftEnd: 'S' }))
  const task = poleOf(c)
  const ends = endsOf(task)

  it('names the ends A to D from the left, with the signs the arrangement gives them', () => {
    expect(ends.map((e) => e.letter)).toEqual(['A', 'B', 'C', 'D'])
    expect(ends.map((e) => e.sign)).toEqual(['S', 'N', 'S', 'N'])
    expect(ends.map((e) => e.magnet)).toEqual([0, 0, 1, 1])
    expect(endsOf(poleOf(read(pole('single', { leftEnd: 'N' })))).map((e) => e.sign)).toEqual(['N', 'S'])
    expect(endsOf(poleOf(read(pole('repel', { leftEnd: 'N' })))).map((e) => e.sign)).toEqual(['N', 'S', 'S', 'N'])
    expect(endsOf(poleOf(read(pole('repel', { leftEnd: 'S' })))).map((e) => e.sign)).toEqual(['S', 'N', 'N', 'S'])
  })

  it('reads a state it cannot use as nothing named', () => {
    for (const bad of [null, undefined, 'junk', {}, { ends: 'x' }, { ends: [1, 2, 3, 4] }, { ends: ['n', 'north', 'E', null] }]) {
      expect(readEnds(task, bad as never), JSON.stringify(bad)).toEqual(['', '', '', ''])
    }
    expect(readEnds(task, { ends: ['N', 'S', 'x'] })).toEqual(['N', 'S', '', ''])
    expect(poleVerdict(task, { ends: ['S', 'N', 'S', 'N'] })).toEqual({ ok: true, wrong: [], unnamed: [] })
    expect(poleVerdict(task, { ends: ['S', 'S', '', 'N'] })).toEqual({ ok: false, wrong: [1], unnamed: [2] })
  })

  it('says a wrong naming back by what the lines do at that end, and asks for every end first', () => {
    expect(poleSaid(task, { ends: ['N', 'N', 'S', 'N'] }, 'wrong')[0]).toBe('You named end A a north pole, but the lines run into it, so it is a south pole.')
    expect(poleSaid(task, { ends: ['S', 'S', 'S', 'N'] }, 'wrong')[0]).toBe('You named end B a south pole, but the lines run out of it, so it is a north pole.')
    expect(poleSaid(task, { ends: ['N', 'S', 'N', 'S'] }, 'wrong').filter((l) => l.startsWith('You named'))).toHaveLength(4)
    expect(poleSaid(task, { ends: ['S', 'N', '', ''] }, 'wrong')).toEqual(['Name every end first: end C or end D are still unnamed.'])
    expect(poleSaid(task, { ends: ['S', 'N', 'S', ''] }, 'wrong')).toEqual(['Name every end first: end D is still unnamed.'])
  })

  it('gives the poles and what the two facing ends are, once marked, for each arrangement', () => {
    const right = poleSaid(task, engine.solve(c), 'right')
    expect(right[0]).toBe('End A is a south pole, end B is a north pole, end C is a south pole and end D is a north pole.')
    expect(right.join(' ')).toMatch(/Field lines run out of a north pole and into a south pole\./)
    expect(right.join(' ')).toMatch(/facing ends are unlike poles, one north and one south, so the magnets attract/)
    const repel = poleSaid(poleOf(read(pole('repel'))), engine.solve(read(pole('repel'))), 'right').join(' ')
    expect(repel).toMatch(/facing ends are like poles, both north or both south, so the magnets repel: their field lines bend away from each other\. The × marks the neutral point/)
    const one = poleSaid(poleOf(read(pole('single'))), engine.solve(read(pole('single'))), 'right')
    expect(one[0]).toMatch(/^End A is a (north|south) pole and end B is a (north|south) pole\.$/)
    expect(one.join(' ')).not.toMatch(/facing|neutral/)
  })
})

describe('electromagnetic induction, predicted', () => {
  const sideOf = (c: MagnetismConfig): Way => outcomeOf(inductionOf(c)).way
  const flip = (w: Way): Way => (w === 'left' ? 'right' : w === 'right' ? 'left' : 'none')

  it('reverses the swing for the other pole, and for the other movement, and not for both; faster swings further, slower less far', () => {
    let seen = 0
    for (const speed of [undefined, 'same', 'faster', 'slower']) {
      const refTask = read(induction('N', 'in', speed))
      // Every card carries its own reference: its side is the side the reference case swings to, which the table below is measured from.
      for (const [p, motion, flips] of [['N', 'in', 0], ['S', 'in', 1], ['N', 'out', 1], ['S', 'out', 2]] as const) {
        const c = read(induction(p, motion, speed))
        const want = outcomeOf(inductionOf(c))
        const ref = referenceSide(inductionOf(c))
        expect(want.way, `${p} ${motion} ${speed}`).toBe(flips % 2 === 0 ? ref : flip(ref))
        expect(want.size).toBe(speed === 'faster' ? 'further' : speed === 'slower' ? 'less' : 'same')
        seen++
      }
      expect(outcomeOf(inductionOf(refTask)).way).toBe(referenceSide(inductionOf(refTask)))
    }
    expect(seen).toBe(16)
  })

  it('swings each way, depending on the card, for the same movement: the reference side is the meter’s wiring and is not always the same', () => {
    const sides = new Set<string>()
    for (const p of POLES) for (const motion of ['in', 'out']) for (const speed of ['same', 'faster', 'slower']) sides.add(referenceSide(inductionOf(read(induction(p, motion, speed)))))
    expect(sides.size).toBe(2)
  })

  it('swings not at all for a magnet held still, whichever pole and whatever speed', () => {
    for (const p of POLES) {
      const c = read(induction(p, 'still'))
      expect(outcomeOf(inductionOf(c))).toEqual({ way: 'none', size: null })
      expect(sideOf(c)).toBe('none')
    }
    expect(outcomeOf(inductionOf(read({ task: { kind: 'induction', pole: 'S', motion: 'still', speed: 'faster' } })))).toEqual({ way: 'none', size: null })
  })

  it('marks the way and the size, and a still magnet by the way alone', () => {
    const c = read(induction('S', 'out', 'faster'))
    const want = outcomeOf(inductionOf(c))
    expect(want.size).toBe('further')
    expect(inductionVerdict(inductionOf(c), { way: want.way, size: 'further' })).toEqual({ ok: true, wayOk: true, sizeOk: true })
    expect(inductionVerdict(inductionOf(c), { way: want.way, size: 'same' })).toEqual({ ok: false, wayOk: true, sizeOk: false })
    expect(inductionVerdict(inductionOf(c), { way: flip(want.way), size: 'further' })).toEqual({ ok: false, wayOk: false, sizeOk: true })
    expect(inductionVerdict(inductionOf(c), { way: want.way })).toMatchObject({ ok: false })
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { way: 5, size: [] } as never).ok).toBe(false)
    const still = read(induction('N', 'still'))
    expect(engine.check(still, { way: 'none', size: '' }).ok).toBe(true)
    expect(engine.check(still, { way: 'none', size: 'further' }).ok).toBe(true)
    expect(engine.check(still, { way: 'left', size: 'same' }).ok).toBe(false)
  })

  it('draws the needle further for further, the same for the same and nearer for less, and none at zero', () => {
    expect(NEEDLE_STEPS.less).toBeLessThan(NEEDLE_STEPS.same)
    expect(NEEDLE_STEPS.same).toBeLessThan(NEEDLE_STEPS.further)
    expect(stepsOf('right', 'further')).toBe(NEEDLE_STEPS.further)
    expect(stepsOf('left', 'less')).toBe(-NEEDLE_STEPS.less)
    expect(stepsOf('left', 'same')).toBe(-NEEDLE_STEPS.same)
    expect(stepsOf('right', '')).toBe(NEEDLE_STEPS.same)
    expect(stepsOf('none', 'further')).toBe(0)
    expect(stepsOf('', 'same')).toBeNull()
  })

  it('says the case in words against the reference, and the reasons only once marked', () => {
    expect(movementText(inductionOf(read(induction('S', 'out', 'faster'))))).toBe('The magnet has its south pole pointing into the coil, and is pulled out faster than in the reference.')
    expect(movementText(inductionOf(read(induction('N', 'in', 'slower'))))).toBe('The magnet has its north pole pointing into the coil, and is pushed in more slowly than in the reference.')
    expect(movementText(inductionOf(read(induction('S', 'in'))))).toBe('The magnet has its south pole pointing into the coil, and is pushed in at the same speed as in the reference.')
    expect(movementText(inductionOf(read(induction('S', 'still'))))).toBe('The magnet is held still inside the coil.')
  })

  it('gives, once marked, the side and size and the reason for each thing that differs from the reference', () => {
    const lines = (p: string, m: string, s: string | undefined, state: unknown, marked: 'right' | 'wrong') => {
      const c = read(induction(p, m, s))
      return { c, text: inductionSaid(inductionOf(c), state, marked) }
    }
    const a = lines('S', 'in', 'faster', null, 'right')
    expect(a.text[0]).toBe(`The needle swings ${outcomeOf(inductionOf(a.c)).way}, further than in the reference.`)
    expect(a.text[1]).toBe('The pole is reversed, which reverses the e.m.f., so the needle swings the opposite way to the reference.')
    expect(a.text[2]).toMatch(/A faster movement changes the field through the coil faster, which induces a larger e\.m\.f\., so the needle swings further\./)
    expect(lines('N', 'out', 'slower', null, 'right').text[1]).toMatch(/^Pulling the magnet out reverses the change in the magnetic field through the coil/)
    expect(lines('N', 'out', 'slower', null, 'right').text[2]).toMatch(/smaller e\.m\.f\., so the needle swings less far/)
    expect(lines('S', 'out', undefined, null, 'right').text[1]).toMatch(/^The pole is reversed and so is the movement\. Each reversal turns the e\.m\.f\. round, so the two cancel/)
    expect(lines('S', 'out', undefined, null, 'right').text[2]).toBe('The speed is the same, so the e.m.f. is the same size and the needle swings the same distance.')
    expect(lines('N', 'still', undefined, null, 'right').text).toEqual([
      'The needle stays at zero.',
      'The magnet is not moving, so the magnetic field through the coil is not changing. No e.m.f. is induced, there is no current, and the needle does not move.',
    ])
    // A reference-matched pole and movement says the side by name.
    const same = lines('N', 'in', 'faster', null, 'right')
    expect(same.text[1]).toBe(`The pole and the movement are as in the reference, so the needle swings the same way: ${referenceSide(inductionOf(same.c))}.`)
  })

  it('says a wrong prediction back as what was said, then the answer; and asks for what is missing', () => {
    const c = read(induction('S', 'out', 'faster'))
    const t = inductionOf(c)
    const want = outcomeOf(t)
    const other = flip(want.way)
    expect(inductionSaid(t, { way: other, size: 'same' }, 'wrong')[0]).toBe(`You said the needle swings ${other}, the same distance as the reference.`)
    expect(inductionSaid(t, { way: other, size: 'same' }, 'wrong')[1]).toBe(`The needle swings ${want.way}, further than in the reference.`)
    expect(inductionSaid(t, { way: 'none', size: '' }, 'wrong')[0]).toBe('You said the needle stays at zero.')
    expect(inductionSaid(t, { way: other, size: '' }, 'wrong')[0]).toBe(`You said the needle swings ${other}.`)
    expect(inductionSaid(t, { way: want.way, size: 'less' }, 'wrong')[0]).toBe(`You said the needle swings ${want.way}, less far than the reference.`)
    expect(inductionSaid(t, { way: want.way, size: '' }, 'wrong')).toEqual(['That is the right way. Now say how far the needle swings compared with the reference, then check.'])
    expect(inductionSaid(t, {}, 'wrong')).toEqual(['Say which way the needle swings, then check.'])
    expect(inductionSaid(read(induction('N', 'still')).task as InductionTask, { way: 'right', size: 'same' }, 'wrong')[0]).toBe('You said the needle swings right, the same distance as the reference.')
  })

  it('never names an answer in a line for a different case', () => {
    for (const { raw, label } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'induction' || isReference(c.task)) continue
      const text = inductionSaid(c.task, engine.solve(c), 'right').join(' ')
      const want = outcomeOf(c.task)
      if (want.way === 'none') expect(text, label).not.toMatch(/swings (left|right)/)
      else expect(text, label).toMatch(new RegExp(`swings ${want.way}`))
    }
  })
})

describe('the prompt a magnetism card is written with', () => {
  const faults = (c: MagnetismConfig, prompt: string) => getEngine('magnetism')!.promptFaults!(c, prompt)
  const C = read(compass('single'))
  const C2 = read(compass('attract'))
  const P = read(pole('single'))
  const P2 = read(pole('repel'))
  const I = read(induction('S', 'out', 'faster'))
  const IS = read(induction('N', 'still'))

  it('may not give the rule for the direction of the field, on a compass card or a pole card', () => {
    for (const p of [
      'Field lines go from north to south. Turn each compass to match.',
      'Remember the field points away from the north pole. Turn each compass.',
      'Turn each needle so its red end points towards the south pole.',
      'Outside a magnet the lines leave the north pole and enter the south pole. Name the poles.',
      'The field runs N to S outside a magnet.',
    ]) {
      expect(faults(C, p).join(' '), p).toMatch(/gives the rule for the field's direction/)
      expect(faults(P, p).join(' '), p).toMatch(/gives the rule for the field's direction/)
    }
  })

  it('may not say which way a needle points, or where a pole is, or whether two magnets attract or repel (pole)', () => {
    expect(faults(C, 'Turn compass 1 so it points to the right.').join(' ')).toMatch(/says which way a needle points/)
    expect(faults(C, 'Make the needle point up.').join(' ')).toMatch(/says which way a needle points/)
    expect(faults(P, 'End A is the north pole. Name the other end.').join(' ')).toMatch(/says where a pole is/)
    expect(faults(P, 'The south pole is on the left. Name the poles.').join(' ')).toMatch(/says where a pole is/)
    expect(faults(P2, 'These two magnets repel. Name the poles of each.').join(' ')).toMatch(/says how the two magnets act \("repel"\)/)
    expect(faults(P2, 'The magnets attract each other: name every pole.').join(' ')).toMatch(/says how the two magnets act/)
    // The same words are no answer on a compass card, where the poles are labelled, or for one magnet.
    expect(faults(C2, 'Two magnets attract each other. Turn each compass to show the field.')).toEqual([])
    expect(faults(P, 'A bar magnet attracts iron. Name its poles.')).toEqual([])
  })

  it('may name the question, the magnets and what to do', () => {
    for (const [c, p] of [
      [C, 'Turn each compass so the red end of its needle shows the way the magnetic field points at that spot.'],
      [C, 'Plot the magnetic field of this bar magnet: turn each plotting compass to show the direction of the field.'],
      [C2, 'Two bar magnets are placed end to end. Turn each compass to show the field direction at its point.'],
      [P, 'Field lines are drawn round this bar magnet. Name each end a north pole or a south pole.'],
      [P2, 'The field lines of these two magnets are drawn. Name the pole at each end.'],
    ] as [MagnetismConfig, string][]) expect(faults(c, p), p).toEqual([])
  })

  it('may not say which side the needle swings to, whether it is bigger or smaller, whether it moves, or whether it reverses', () => {
    for (const [p, re] of [
      ['The needle swings to the left when the magnet is pulled out.', /names a side the needle swings/],
      ['Predict what happens: the deflection is to the right.', /names a side/],
      ['The swing is bigger because the magnet moves faster.', /says how big the swing is/],
      ['The meter reading is smaller this time.', /says how big the swing is/],
      ['The needle will not move.', /says whether the needle moves/],
      ['The meter shows no deflection.', /says whether the needle moves/],
      ['The needle stays at zero.', /says whether the needle moves/],
      ['Reversing the pole reverses the deflection.', /says the swing reverses or not/],
      ['The needle swings the opposite way to the reference.', /says the swing reverses or not/],
    ] as [string, RegExp][]) expect(faults(I, p).join(' '), p).toMatch(re)
  })

  it('may name the case, the options and the question', () => {
    for (const [c, p] of [
      [I, 'Predict what the meter needle does in the second case. Which way does it swing, and how far compared with the reference?'],
      [I, 'The south pole is pulled out faster. Does the needle swing left or right, and is the swing bigger or smaller?'],
      [I, 'Look at the reference first. In the new case, what does the needle do?'],
      [IS, 'The magnet is held still in the coil. What does the meter show?'],
      [I, 'The magnet is pulled out more slowly than before. Which way does the needle swing now?'],
    ] as [MagnetismConfig, string][]) expect(faults(c, p), p).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('magnetism')!
    // Each example's prompt, then its config by matching braces.
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = e.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < e.prompt.length; end++) {
        if (e.prompt[end] === '{') depth++
        if (e.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(e.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(new Set(found.map((f) => f.config.task.kind))).toEqual(new Set(['compass', 'pole', 'induction']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
      expect(validateSpec({ pattern: 'scene', prompt: ex.prompt, payload: { engine: 'magnetism', config: ex.config }, success: { kind: 'scene' } }), ex.prompt).toBe(true)
    }
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, with every option and a full example per task kind in orbit’s format', () => {
    expect(getEngine('magnetism')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/^SCENE "magnetism"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"magnetism"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:magnetism"/)
    expect(engine.prompt).toMatch(/"isolates":"position"/)
    for (const kind of ['compass', 'pole', 'induction']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const a of ARRANGEMENTS) expect(engine.prompt).toContain(a)
    for (const m of MOTIONS) expect(engine.prompt).toContain(m)
    for (const s of SPEEDS) expect(engine.prompt).toContain(s)
    expect(engine.prompt).toContain('leftEnd')
  })

  it('says plainly what each card shows and what it keeps until it is marked', () => {
    expect(engine.prompt).toMatch(/field lines are drawn only once the card is marked/)
    expect(engine.prompt).toMatch(/magnets' poles are NOT named/)
    expect(engine.prompt).toMatch(/held back until marked/)
    expect(engine.prompt).toMatch(/A REFERENCE case is shown first/)
    expect(engine.prompt).toMatch(/are given once marked/)
    expect(engine.prompt).toMatch(/IS the reference and is refused/)
    expect(engine.prompt).toMatch(/Not for: sorting magnetic and non-magnetic/)
  })

  it('is an activity whose intent is position', () => {
    const spec = { pattern: 'scene', prompt: 'Predict it.', payload: { engine: 'magnetism', config: induction('S', 'out', 'faster') }, success: { kind: 'scene' } }
    expect(validateSpec(spec)).toBe(true)
    expect(dimensionsOf(spec as never)).toEqual(['position'])
    expect(validateSpec({ ...spec, payload: { engine: 'magnetism', config: { task: { kind: 'induction' } } } })).toBe(true)
    expect(validateSpec({ ...spec, payload: { engine: 'magnetism', config: { task: { kind: 'wave' } } } })).toBe(false)
  })

  it('is offered to the stations it is for, and not to those that merely share a word', () => {
    for (const station of [
      'Magnetic fields', 'Magnetic field lines around a bar magnet', 'Plotting a magnetic field with a compass', 'Electromagnetic induction',
      'Induced e.m.f. in a coil', 'The magnetic field of a bar magnet', 'Using a plotting compass',
    ]) expect(sceneCatalogue(station), station).toContain('SCENE "magnetism"')
    // scenesFor tells a station the scene is made for it: every word of a phrase.
    for (const station of ['Magnetic fields', 'Magnetic fields and field lines', 'Electromagnetic induction', 'Induced emf', 'Plotting compasses'])
      expect(scenesFor(station).map((x) => x.id), station).toContain('magnetism')
    for (const station of ['Magnetic materials', 'Magnetic and non-magnetic materials', 'Uses of magnets', 'Electric fields', 'Gravitational fields', 'Field work', 'Fields of study', 'Electric current', 'The electromagnetic spectrum', 'Line graphs', 'Compass directions and bearings of a ship', 'Proof by induction'])
      expect(scenesFor(station).map((x) => x.id), station).not.toContain('magnetism')
    // The loose catalogue is by any word, so the bare words that other stations use stay out of covers.
    for (const bare of ['magnets', 'magnet', 'magnetic', 'current', 'field', 'fields', 'lines', 'compass', 'electromagnetic', 'poles', 'plotting']) expect(engine.covers).not.toContain(bare)
    // "The electromagnetic spectrum" is listed it by "electromagnetic": a few tokens, where bare "induction" told "Proof by induction" the scene was made for it.
    for (const station of ['Electric current and charge', 'Equivalent fractions', 'Reading a graph', 'Line graphs', 'Sorting materials by what a magnet picks up'])
      expect(sceneCatalogue(station), station).not.toContain('SCENE "magnetism"')
    expect(engine.covers).toEqual(['magnetic fields', 'plotting compass', 'electromagnetic induction', 'induced emf'])
  })

  it('is refused by the meaning gates for a config it cannot teach, and for a prompt that gives the answer', () => {
    const action = (config: unknown, prompt = 'Turn each compass to show the field.') =>
      ({ type: 'createActivity', id: 'm1', spec: { pattern: 'scene', prompt, payload: { engine: 'magnetism', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(compass('single')))).toEqual([])
    expect(meaningFaults(action(induction('N', 'in'), 'Predict the needle.')).join(' ')).toMatch(/reference case/)
    expect(meaningFaults(action(compass('triple'))).join(' ')).toMatch(/not an arrangement/)
    expect(meaningFaults(action(compass('single'), 'Field lines go from north to south: turn each compass.')).join(' ')).toMatch(/rule for the field's direction/)
    expect(meaningFaults(action(induction('S', 'out', 'faster'), 'The needle swings to the left.')).join(' ')).toMatch(/names a side/)
  })
})

// ---------------------------------------------------------------------------

describe('the magnetism scene on the board', { timeout: 60_000 }, () => {
  const spec = (config: unknown, prompt: string) => ({ pattern: 'scene', prompt, payload: { engine: 'magnetism', config }, success: { kind: 'scene' } })
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec: spec(config, prompt) } } as never)))
  const view = (config: unknown, state: unknown, marked: SceneMarked, reduced = false) => {
    const c = read(config)
    return renderToStaticMarkup(createElement(MagnetismView, { config: c, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
  }
  const idle = (config: unknown) => view(config, engine.initial(read(config)), 'idle')
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

  it('compass: draws the magnets labelled, a numbered compass at each point as a slider on the keys, and no field line yet', () => {
    for (const arr of ARRANGEMENTS) {
      for (const n of [2, 3, 4]) {
        const config = compass(arr, { count: n })
        const html = card(config, 'Turn each compass to show the field.')
        expect(count(html, /role="slider"/g), `${arr} ${n}`).toBe(n)
        expect(count(html, /role="slider"[^>]*tabindex="0"|tabindex="0"[^>]*role="slider"/gi), `${arr} ${n}`).toBe(n)
        for (let i = 1; i <= n; i++) expect(html).toContain(`aria-label="Compass ${i}. Turn it, or use the arrow keys"`)
        expect(html).toMatch(/aria-valuemin="0"/)
        expect(html).toMatch(/aria-valuemax="345"/)
        expect(html).toMatch(/aria-valuetext="Pointing [^"]+"/)
        // The magnets are labelled; the field lines (their colour) are not drawn.
        expect(count(html, />N</g)).toBe(arr === 'single' ? 1 : 2)
        expect(count(html, />S</g)).toBe(arr === 'single' ? 1 : 2)
        expect(html).not.toContain('#3B5B7A')
        expect(html).not.toContain('Every needle lies')
        expect(html).toContain('with a plotting compass at each numbered point')
        expect(html).toContain('touch-none')
        expect(html).toContain('nodrag')
      }
    }
  })

  it('compass: names no answer before marking, even to a screen reader', () => {
    for (const { raw, label } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'compass') continue
      const html = idle(raw)
      const { texts, aloud } = said(html)
      expect(`${texts} ${aloud}`, label).not.toMatch(/wrong way round|lies along|neutral point|green|field there points|Every needle|field is zero|You turned/)
      expect(html, label).not.toContain('#3B5B7A')
      // Each needle's start is described as it is, and is never the way the field points there.
      sitesOf(c.task).forEach((s, i) => {
        const m = new RegExp(`aria-label="Compass ${i + 1}\.[^"]*"[^>]*aria-valuetext="([^"]*)"`).exec(html)
        expect(m, `${label} compass ${i + 1}`).not.toBeNull()
        expect(m![1], `${label} compass ${i + 1}`).toBe(`Pointing ${pointingWords(s.start)}`)
        expect(m![1], `${label} compass ${i + 1}`).not.toBe(`Pointing ${pointingWords(s.truth)}`)
      })
    }
  })

  it('compass: the needles move with the state, and the field, the true needles and the neutral point show once marked', () => {
    const config = compass('repel', { count: 3, leftEnd: 'N' })
    const c = read(config)
    const away = view(config, engine.initial(c), 'idle')
    const there = view(config, engine.solve(c), 'idle')
    expect(away).not.toBe(there)
    for (const s of sitesOf(compassOf(c))) expect(there).toContain(`aria-valuetext="Pointing ${pointingWords(s.truth)}"`)
    // Marked wrong: the lines, the neutral point, a dashed red dial and a green true needle for each wrong one, the words.
    const bad = view(config, engine.initial(c), 'wrong')
    expect(bad).toContain('#3B5B7A')
    expect(count(bad, /stroke-dasharray="4 3"/g)).toBe(3)
    expect(bad).toContain('You turned it to point'.replace('You', 'you'))
    expect(bad).toContain('× marks the neutral point')
    expect(bad).toContain('A green arrowhead and dashed needle show the way the field points.')
    expect(bad).toMatch(/Compass 1: you turned it to point/)
    // Solved: green rings, no ghosts, the sliders put away.
    const right = view(config, engine.solve(c), 'right')
    expect(right).toContain('Every needle lies along the field')
    expect(right).not.toContain('A green arrowhead')
    expect(right).not.toMatch(/tabindex="0"/)
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).not.toContain('Drag a needle round')
  })

  it('compass: a single magnet and two attracting magnets have no neutral point', () => {
    for (const arr of ['single', 'attract']) {
      const html = view(compass(arr), engine.solve(read(compass(arr))), 'right')
      expect(html).not.toMatch(/neutral/)
    }
    expect(view(compass('repel'), engine.solve(read(compass('repel'))), 'right')).toMatch(/neutral point/)
  })

  it('pole: draws the field lines with arrows and the compasses, with the poles not named, and a pair of choices for each end', () => {
    for (const arr of ARRANGEMENTS) {
      const config = pole(arr)
      const c = read(config)
      const html = card(config, 'Name the poles.')
      const ends = endsOf(poleOf(c))
      expect(html).toContain('#3B5B7A')
      expect(count(html, /role="radiogroup"/g)).toBe(ends.length)
      expect(count(html, /role="radio"/g)).toBe(2 * ends.length)
      expect(count(html, /aria-checked="true"/g)).toBe(0)
      for (const e of ends) expect(html).toContain(`>End ${e.letter}<`)
      expect(count(html, /North pole/g)).toBe(ends.length)
      expect(count(html, /South pole/g)).toBe(ends.length)
      // The magnets are plain: no N or S on them.
      expect(count(html, />N</g) + count(html, />S</g)).toBe(0)
      // One stop on Tab for each group.
      expect(count(html, /role="radio"[^>]*tabindex="0"|tabindex="0"[^>]*role="radio"/g)).toBe(ends.length)
      expect(count(html, /viewBox="0 0 360 240"/g)).toBe(1)
      expect(html).toContain('touch-manipulation')
      expect(html).not.toMatch(/role="slider"/)
    }
  })

  it('pole: says nothing of which end is which before marking: the only north and south in the card are the choices', () => {
    for (const { raw, label } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'pole') continue
      const html = idle(raw)
      const ends = endsOf(c.task).length
      const { texts, aloud } = said(html)
      expect(count(`${texts} ${aloud}`, /north|south/gi), label).toBe(2 * ends)
      expect(`${texts} ${aloud}`, label).not.toMatch(/attract|repel|unlike|like poles|neutral|You named|is a (north|south)|so it is a/i)
      // The tab order and the labels run A, B, ... from the left: they say nothing about the poles.
      expect(count(html, /aria-checked="true"/g)).toBe(0)
      expect(html).not.toMatch(/#C81E1E"[^>]*\/>\s*<text[^>]*>N</)
    }
  })

  it('pole: the magnet takes the colour of what is named, and the truth once marked', () => {
    const config = pole('attract', { leftEnd: 'N' })
    const c = read(config)
    const named = view(config, { ends: ['N', '', 'S', ''] }, 'idle')
    expect(count(named, />N</g)).toBe(1)
    expect(count(named, />S</g)).toBe(1)
    expect(count(named, /aria-checked="true"/g)).toBe(2)
    const wrong = view(config, { ends: ['S', 'S', 'N', 'S'] }, 'wrong')
    // Marked, the picture shows what the ends are, and the choices stay as the learner left them.
    expect(count(wrong, />N</g)).toBe(2)
    expect(count(wrong, />S</g)).toBe(2)
    expect(count(wrong, /aria-checked="true"/g)).toBe(4)
    expect(wrong).toContain('You named end A a south pole, but the lines run out of it, so it is a north pole.')
    expect(wrong).toContain('stroke="#B0303C"')
    const right = view(config, engine.solve(c), 'right')
    expect(right).toContain('End A is a north pole, end B is a south pole, end C is a north pole and end D is a south pole.')
    expect(right).toMatch(/aria-disabled="true"/)
    // Which pole is at the left is the tutor's call.
    expect(idle(pole('single', { leftEnd: 'N' }))).not.toBe(idle(pole('single', { leftEnd: 'S' })))
  })

  it('pole: the radio group has one stop on Tab whichever is picked, and the arrows are the scene’s', () => {
    const config = pole('single')
    const none = view(config, { ends: ['', ''] }, 'idle')
    expect(count(none, /role="radio"[^>]*tabindex="0"|tabindex="0"[^>]*role="radio"/g)).toBe(2)
    const picked = view(config, { ends: ['S', ''] }, 'idle')
    const stops = [...picked.matchAll(/<button[^>]*>/g)].map((m) => m[0]).filter((t) => /tabindex="0"/.test(t))
    expect(stops).toHaveLength(2)
    expect(stops.filter((t) => /aria-checked="true"/.test(t))).toHaveLength(1)
  })

  it('pole: every end’s letter is under the end it names, apart from every dial and from the others, inside the picture', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        for (let from = 0; from < SITE_COUNT; from++) {
          const task: PoleTask = { kind: 'pole', arrangement: arr, leftEnd: left }
          const ends = endsOf(task)
          const cs = chargesOf(arr, left)
          const marks = ends.map((e) => ({ e, m: markerOf(e) }))
          const sites = siteSet(arr, left, from, POLE_COMPASSES, 'x')
          for (const { e, m } of marks) {
            expect(m.x - m.r).toBeGreaterThanOrEqual(1)
            expect(m.x + m.r).toBeLessThanOrEqual(VIEW.w - 1)
            expect(m.y + m.r).toBeLessThanOrEqual(VIEW.h - 1)
            // Under its own end, and just clear of the magnet.
            expect(Math.abs(m.x - toPx(cs[e.id].x, 0).x), `${arr} end ${e.letter}`).toBeLessThan(1e-9)
            expect(m.y - m.r).toBeGreaterThan(toPx(0, -THICK).y)
            for (const o of marks) if (o.e !== e) expect(Math.hypot(m.x - o.m.x, m.y - o.m.y)).toBeGreaterThan(m.r + o.m.r + 4)
            for (const s of sites) {
              const c = toPx(s.x, s.y)
              if (Math.hypot(m.x - c.x, m.y - c.y) <= m.r + SIZE.dial + 3) throw new Error(`${arr} ${left} from ${from}: end ${e.letter} runs into a compass`)
            }
          }
          // The compasses on a pole card stand clear of the magnets too.
          for (const s of sites) expect(clearance(arr, s.x, s.y)).toBeGreaterThanOrEqual(DIAL + 0.15 - 1e-9)
        }
      }
    }
  })

  it('induction: draws the reference and the case, with the reference’s needle deflected and the case’s at zero, and no answer yet', () => {
    const config = induction('S', 'out', 'faster')
    const c = read(config)
    const html = card(config, 'Predict the needle.')
    const ref = referenceSide(inductionOf(c))
    expect(count(html, /viewBox="0 0 360 150"/g)).toBe(2)
    expect(html).toContain('The reference case')
    expect(html).toContain('The case to predict')
    expect(html).toContain('The magnet has its north pole pointing into the coil, and is pushed in at a steady speed. The needle swings to the ' + ref + '.')
    expect(html).toContain('The magnet has its south pole pointing into the coil, and is pulled out faster than in the reference.')
    expect(html).toContain('The small triangle on the meter marks how far the needle swung in the reference.')
    expect(count(html, /role="radiogroup"/g)).toBe(2)
    expect(count(html, /role="radio"/g)).toBe(6)
    expect(count(html, /aria-checked="true"/g)).toBe(0)
    for (const label of ['Left', 'Stays at zero', 'Right', 'Less far', 'Same distance', 'Further']) expect(html).toContain(`>${label}<`)
    expect(html).toContain('pulled out, faster')
    expect(html).toContain('pushed in<')
    // The case's own meter is at zero until the learner chooses: its needle line is vertical.
    const second = html.slice(html.lastIndexOf('The case to predict'))
    const { texts, aloud } = said(second)
    expect(`${texts} ${aloud}`).not.toMatch(/swings (to the )?(left|right)|Each reversal|e\.m\.f|induced|stays at zero\.|opposite way|further than in the reference|larger/)
    expect(aloud).toContain('The needle of the centre-zero meter is at zero.')
  })

  it('induction: the needle in the case moves with what the learner picks, further for further, and the choices are marked', () => {
    const config = induction('S', 'out', 'faster')
    const base = view(config, { way: '', size: '' }, 'idle')
    const left = view(config, { way: 'left', size: 'same' }, 'idle')
    const right = view(config, { way: 'right', size: 'same' }, 'idle')
    const far = view(config, { way: 'right', size: 'further' }, 'idle')
    expect(new Set([base, left, right, far]).size).toBe(4)
    expect(count(left, /aria-checked="true"/g)).toBe(2)
    expect(left).toContain('deflected to the left, as far as the reference')
    expect(far).toContain('deflected to the right, further than the reference')
    // Choosing "stays at zero" puts the size question away: nothing to compare.
    const none = view(config, { way: 'none', size: '' }, 'idle')
    expect(none).toContain('(none needed)')
    expect(count(none, /role="radio"[^>]*tabindex="-1"/g) + count(none, /tabindex="-1"[^>]*role="radio"/g)).toBeGreaterThanOrEqual(3)
    expect(none).toContain('needle of the centre-zero meter is at zero')
  })

  it('induction: once marked, says what it did and why, draws the true needle and the learner’s dashed, and puts the choices away once right', () => {
    const config = induction('S', 'out', 'faster')
    const c = read(config)
    const want = outcomeOf(inductionOf(c))
    const other = want.way === 'left' ? 'right' : 'left'
    const wrong = view(config, { way: other, size: 'same' }, 'wrong')
    expect(wrong).toContain(`You said the needle swings ${other}, the same distance as the reference.`)
    expect(wrong).toContain(`The needle swings ${want.way}, further than in the reference.`)
    expect(wrong).toContain('stroke-dasharray="4 3"')
    const right = view(config, engine.solve(c), 'right')
    expect(right).toContain(`The needle swings ${want.way}, further than in the reference.`)
    expect(right).not.toContain('stroke-dasharray="4 3"')
    expect(right).toMatch(/aria-disabled="true"/)
    expect(count(right, /aria-checked="true"/g)).toBe(2)
    const still = view(induction('N', 'still'), engine.solve(read(induction('N', 'still'))), 'right')
    expect(still).toContain('The needle stays at zero.')
    expect(still).toContain('held still')
    expect(still).toContain('The magnet is held still inside the coil.')
  })

  it('induction: every case draws the arrow for its movement, longer for faster, and none for a magnet held still', () => {
    const arrows = (html: string) => count(html.slice(html.lastIndexOf('The case to predict')), /<line x1="[\d.]+" y1="40" x2="[\d.]+" y2="40"/g)
    const length = (html: string) => {
      const m = /<line x1="([\d.]+)" y1="40" x2="([\d.]+)" y2="40"/.exec(html.slice(html.lastIndexOf('The case to predict')))!
      return Math.abs(Number(m[2]) - Number(m[1]))
    }
    expect(arrows(idle(induction('S', 'in', 'same')))).toBe(1)
    expect(arrows(idle(induction('N', 'still')))).toBe(0)
    expect(length(idle(induction('S', 'in', 'faster')))).toBeGreaterThan(length(idle(induction('S', 'in', 'same'))))
    expect(length(idle(induction('S', 'in', 'same')))).toBeGreaterThan(length(idle(induction('S', 'in', 'slower'))))
    expect(length(idle(induction('S', 'out', 'faster')))).toBeGreaterThan(length(idle(induction('S', 'out', 'slower'))))
    // The picture fits the panel for every case.
    for (const { raw } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'induction' || isReference(c.task)) continue
      const html = idle(raw)
      for (const m of html.matchAll(/<line x1="([\d.]+)" y1="40" x2="([\d.]+)" y2="40"/g)) {
        for (const v of [Number(m[1]), Number(m[2])]) {
          expect(v).toBeGreaterThan(4)
          expect(v).toBeLessThan(180)
        }
      }
    }
  })

  it('still draws a state it cannot read, as the start, and a config it cannot show without a crash', () => {
    for (const raw of [compass('single'), pole('repel'), induction('S', 'in', 'faster')]) {
      for (const bad of [null, undefined, 'junk', 7, { angles: 'x', ends: 5, way: 3, size: {} }, { angles: [999, -1, 'a'], ends: ['x'] }]) {
        expect(() => view(raw, bad, 'idle'), `${JSON.stringify(raw)} ${JSON.stringify(bad)}`).not.toThrow()
        expect(() => view(raw, bad, 'wrong'), `${JSON.stringify(raw)} ${JSON.stringify(bad)}`).not.toThrow()
      }
    }
    expect(() => view(compass('triple'), {}, 'idle')).not.toThrow()
    expect(() => view({ task: { kind: 'induction' } }, {}, 'idle')).not.toThrow()
  })

  it('has no text smaller than 12 px and no text split mid-word', () => {
    for (const raw of [compass('single'), compass('repel', { count: 4 }), pole('attract'), induction('S', 'out', 'faster'), induction('N', 'still')]) {
      for (const marked of ['idle', 'wrong', 'right'] as SceneMarked[]) {
        const c = read(raw)
        const html = view(raw, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
        for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/break-all|break-words|capitalize/)
      }
    }
  })

  it('moves nothing under reduced motion because nothing moves by itself', () => {
    for (const raw of [compass('single'), pole('repel'), induction('S', 'in', 'faster')]) {
      const html = view(raw, engine.initial(read(raw)), 'idle', true)
      expect(html).not.toMatch(/animate|transition|keyframes/)
    }
  })

  it('draws the induction panel’s parts inside it, the meter’s needle on its dial and the triangle outside the scale', () => {
    // The panel is 360 by 150: the coil, the magnet in or out of it, the wires, and the meter, all inside.
    expect(PANEL).toEqual({ w: 360, h: 150 })
    for (const { raw } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'induction' || isReference(c.task)) continue
      const html = idle(raw)
      for (const m of html.matchAll(/\s(?:x1|x2|cx|x)="(-?[\d.]+)"/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0)
        expect(Number(m[1])).toBeLessThanOrEqual(PANEL.w)
      }
    }
  })
})
