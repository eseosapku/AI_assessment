// lib/studylab/engines/moments-machines/moments-machines.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  momentsMachinesEngine as engine, GEAR_TEETH, HALF_MARKS, HANDLE_TEETH, IDLER_TEETH, LEVER_MARKS, MAX_DISCS, MAX_ROPE, MAX_STRANDS,
  canPull, discUnit, fixedPivot, freeMarks, gearTarget, goodPrompt, leverBest, leverHolds, madeText, markOfLoad, netMoment, pullNeeded, pushNeeded, readAt, readDiscs, readPulled, solutions, strandsNeeded, tiltOf, turnsText, working,
  type BalanceConfig, type GearsConfig, type LeverConfig, type MachineConfig, type MachineState, type PulleyConfig,
} from './config'
import {
  BAL_H, BY, CX, DISC_H, FLOOR, GEAR_H, GEAR_Y, GRIP, LEV_FLOOR, LEV_H, MARK, MomentsMachinesView, PLANK_HALF, PUL_FLOOR, PUL_H, PX_PER_M, SPACE, STRING, TOP_Y, W,
  barPose, fulcrumX, gearAngles, gearPath, hubY, moduleOf, pulleyLayout, pushLabel, ropePath, stackHeight, stackLabels, trainOf,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const nameOf = (c: unknown) => JSON.stringify(c)
const range = (a: number, b: number, by = 1) => Array.from({ length: Math.floor((b - a) / by) + 1 }, (_, k) => a + k * by)
const valid = (c: MachineConfig) => engine.faults(c).length === 0
const FORCES = range(1, 12)
const CMS = range(10, 50, 10)

const WEIGHTS: BalanceConfig[] = FORCES.flatMap((force) => CMS.flatMap((at) => FORCES.map((weight) => ({ task: 'balance' as const, move: 'weight' as const, loads: [{ force, at, side: 'left' as const }], weight, unit: 'cm' as const })))).filter(valid)
const DISCS: BalanceConfig[] = FORCES.flatMap((force) => CMS.flatMap((at) => CMS.map((hang) => ({ task: 'balance' as const, move: 'discs' as const, loads: [{ force, at, side: 'right' as const }], at: hang, unit: 'cm' as const })))).filter(valid)
const BOTH: BalanceConfig[] = FORCES.flatMap((force) => CMS.map((at) => ({ task: 'balance' as const, move: 'both' as const, loads: [{ force, at, side: 'left' as const }], unit: 'cm' as const }))).filter(valid)
const PIVOTS: BalanceConfig[] = FORCES.flatMap((a) => FORCES.map((b) => ({ task: 'balance' as const, move: 'pivot' as const, loads: [{ force: a, at: 0 }, { force: b, at: 100 }], unit: 'cm' as const }))).filter(valid)
const OFF_CENTRE: BalanceConfig[] = FORCES.flatMap((force) => FORCES.map((weight) => ({ task: 'balance' as const, move: 'weight' as const, pivot: 30, beam: 2, loads: [{ force, at: 10 }], weight, unit: 'cm' as const }))).filter(valid)
const SCALED: BalanceConfig[] = [10, 100].flatMap((n) => FORCES.flatMap((force) => range(1, 5).map((at) => ({ task: 'balance' as const, move: 'both' as const, loads: [{ force: force * n, at, side: 'left' as const }], unit: 'm' as const })))).filter(valid)
const TWO_LOADS: BalanceConfig[] = FORCES.flatMap((a) => FORCES.flatMap((b) => [{ a: 10, b: 20 }, { a: 20, b: 40 }, { a: 30, b: 50 }].map(({ a: x, b: y }) => ({ task: 'balance' as const, move: 'both' as const, loads: [{ force: a, at: x, side: 'left' as const }, { force: b, at: y, side: 'left' as const }], unit: 'cm' as const })))).filter(valid)
const LEVERS: LeverConfig[] = range(100, 1200, 100).flatMap((load) => [50, 100, 150, 200, 300, 400, 600].map((push) => ({ task: 'lever' as const, load, push }))).filter(valid)
const PULLEYS: PulleyConfig[] = range(100, 1200, 100).flatMap((load) => [50, 100, 150, 200, 300, 400, 600].flatMap((pull) => [1, 2, 3].map((height) => ({ task: 'pulley' as const, load, pull, height })))).filter(valid)
const GEARS: GearsConfig[] = HANDLE_TEETH.flatMap((teeth) => GEAR_TEETH.flatMap((out) => (['same', 'opposite', 'any'] as const).map((direction) => ({ task: 'gears' as const, teeth, turns: teeth / out, direction })))).filter(valid)
const ALL: MachineConfig[] = [...WEIGHTS, ...DISCS, ...BOTH, ...PIVOTS, ...OFF_CENTRE, ...SCALED, ...TWO_LOADS, ...LEVERS, ...PULLEYS, ...GEARS]

const EXAMPLES: MachineConfig[] = [
  { task: 'balance', move: 'weight', loads: [{ force: 6, at: 20, side: 'left' }], weight: 3, unit: 'cm' },
  { task: 'balance', move: 'discs', loads: [{ force: 60, at: 40, side: 'right' }], at: 30, unit: 'cm' },
  { task: 'balance', move: 'both', loads: [{ force: 6, at: 20, side: 'left' }, { force: 2, at: 40, side: 'left' }], unit: 'cm' },
  { task: 'balance', move: 'pivot', loads: [{ force: 1, at: 0 }, { force: 4, at: 100 }], unit: 'cm' },
  { task: 'balance', move: 'pivot', beam: 2, loads: [{ force: 2, at: 0 }, { force: 4, at: 100 }], unit: 'cm' },
  { task: 'lever', load: 600, push: 150 },
  { task: 'pulley', load: 600, pull: 200, height: 2 },
  { task: 'gears', teeth: 24, turns: 3, direction: 'same' },
  { task: 'gears', teeth: 24, turns: 0.5, direction: 'opposite' },
]

/** Every state the learner can reach on a config, for the exhaustive checks. */
function everyState(c: MachineConfig): MachineState[] {
  switch (c.task) {
    case 'balance': {
      const marks = freeMarks(c)
      if (c.move === 'pivot' || c.move === 'weight') return marks.map((at) => ({ at, discs: 1 }))
      return marks.flatMap((at) => range(1, MAX_DISCS).map((discs) => ({ at, discs })))
    }
    case 'lever':
      return range(1, LEVER_MARKS - 1).map((at) => ({ at }))
    case 'pulley':
      return range(1, MAX_STRANDS).flatMap((strands) => range(0, canPull(c, strands) ? strands * c.height : 0).map((pulled) => ({ strands, pulled })))
    case 'gears':
      return GEAR_TEETH.flatMap((teeth) => [false, true].map((idler) => ({ teeth, idler })))
  }
}

describe('the rules, from first principles', () => {
  it('a rule is level only when the turning effects on each side are equal, worked out afresh in newtons and centimetres', () => {
    const c = EXAMPLES[0] as BalanceConfig
    for (const at of freeMarks(c)) {
      const anti = 6 * 20
      const clock = 3 * Math.abs(at) * 10
      expect(engine.check(c, { at }).ok, `${at}`).toBe(anti === clock)
    }
    expect(solutions(c)).toEqual([{ at: 4, discs: 3 }])
    expect(engine.check(c, { at: 4 }).ok).toBe(true)
    expect(engine.check(c, { at: 2 }).ok).toBe(false)
  })

  it('reads the textbook problems right', () => {
    // A lighter weight further out: the classic conflict item.
    expect(solutions({ task: 'balance', move: 'weight', loads: [{ force: 500, at: 2, side: 'left' }], weight: 250, unit: 'm' })).toEqual([{ at: 4, discs: 5 }])
    // Moments add: 6 x 2 + 2 x 4 = 20, so 4 N at 5 is the lightest, and 5 N at 4 also balances.
    const two = EXAMPLES[2] as BalanceConfig
    expect(solutions(two)[0]).toEqual({ at: 5, discs: 4 })
    expect(engine.check(two, { at: 4, discs: 5 }).ok).toBe(false)
    expect(netMoment(two, { at: 4, discs: 5 })).toBe(0)
    expect(engine.check(two, { at: 5, discs: 4 }).ok).toBe(true)
    // The balance point sits nearer the heavier load: 1 N and 4 N on a 100 cm rule balance at 80 cm.
    expect(solutions(EXAMPLES[3] as BalanceConfig)[0].at).toBe(3)
    // The rule's own weight counts, at its middle: 2 x 50 + ... balance at 60 cm with 2 N, 4 N and a 2 N rule.
    const beam = EXAMPLES[4] as BalanceConfig
    expect((2 * 0 + 2 * 50 + 4 * 100) / (2 + 2 + 4)).toBe(62.5)
    expect(engine.faults(beam)).toHaveLength(1)
    const beamOk: BalanceConfig = { task: 'balance', move: 'pivot', beam: 2, loads: [{ force: 2, at: 0 }, { force: 6, at: 100 }], unit: 'cm' }
    expect(solutions(beamOk)[0].at).toBe(2) // (0 + 100 + 600) / 10 = 70 cm
    expect(engine.faults(beamOk)).toEqual([])
    // A uniform beam on an off-centre pivot: the beam's weight turns it too.
    const off: BalanceConfig = { task: 'balance', move: 'weight', pivot: 30, beam: 2, loads: [{ force: 4, at: 10 }], weight: 4, unit: 'cm' }
    expect(markOfLoad(off, off.loads[0])).toBe(-4)
    expect(fixedPivot(off)).toBe(-2)
    // 4 N x 20 cm anticlockwise against 2 N x 20 cm clockwise from the rule, leaving 40 N cm for 4 N: 10 cm to the right.
    expect(solutions(off)[0].at).toBe(-1)
    expect(working(off, { at: -1 })).toContain('own weight')
    expect(working(off, { at: -1 })).not.toContain('further')
    // Nothing hangs on the arrow for the rule's own weight.
    expect(freeMarks(off)).not.toContain(0)
    expect(engine.faults({ ...off, weight: 2 })[0]).toMatch(/e\.g\. weight 1/)
    expect(engine.faults({ task: 'balance', move: 'pivot', beam: 2, loads: [{ force: 2, at: 50 }, { force: 6, at: 100 }], unit: 'cm' })[0]).toMatch(/own weight/)
    // And a lighter weight is only said to be further out when it is.
    expect(working(EXAMPLES[1], { at: -3, discs: 8 })).not.toContain('lighter')
  })

  it('a rock lifts by the lever rule, and the answer is the fulcrum furthest from the rock that still lifts it', () => {
    const c: LeverConfig = { task: 'lever', load: 600, push: 150 }
    for (let p = 1; p <= 9; p++) expect(leverHolds(c, p), `${p}`).toBe(600 * p <= 150 * (10 - p))
    expect(leverBest(c)).toBe(2)
    expect(pushNeeded(c, 2)).toBe(150)
    expect(engine.check(c, { at: 2 }).ok).toBe(true)
    expect(engine.check(c, { at: 1 }).ok).toBe(false) // lifts, but not as high
    expect(engine.check(c, { at: 3 }).ok).toBe(false) // does not lift
    // A push with some to spare: 200 N lifts 600 N with the fulcrum at 20 cm (needs 150 N), not at 30 cm (needs 257 N).
    expect(leverBest({ task: 'lever', load: 600, push: 200 })).toBe(2)
    // A load lighter than the push: a distance multiplier.
    expect(leverBest({ task: 'lever', load: 100, push: 300 })).toBe(7)
  })

  it('a block and tackle shares the load among its strands, and rope pulled is strands x lift', () => {
    const c: PulleyConfig = { task: 'pulley', load: 600, pull: 200, height: 2 }
    expect(strandsNeeded(c)).toBe(3)
    expect(strandsNeeded({ ...c, pull: 250 })).toBe(3) // 2 strands would still ask for 300 N
    expect(strandsNeeded({ ...c, pull: 300 })).toBe(2)
    expect(strandsNeeded({ ...c, pull: 600 })).toBe(1)
    expect(pullNeeded(c, 4)).toBe(150)
    expect(engine.check(c, { strands: 3, pulled: 6 }).ok).toBe(true)
    expect(engine.check(c, { strands: 3, pulled: 5 }).ok).toBe(false)
    expect(engine.check(c, { strands: 4, pulled: 8 }).ok).toBe(false)
    // Too few strands: the rope does not move, whatever the state claims.
    expect(readPulled(c, { strands: 2, pulled: 4 })).toBe(0)
    expect(engine.check(c, { strands: 2, pulled: 4 }).ok).toBe(false)
    // It stops at the shelf.
    expect(readPulled(c, { strands: 3, pulled: 50 })).toBe(6)
  })

  it('gears: the teeth set the turns, and every meshing reverses', () => {
    const c: GearsConfig = { task: 'gears', teeth: 24, turns: 3, direction: 'same' }
    expect(gearTarget(c)).toBe(8)
    expect(engine.check(c, { teeth: 8, idler: true }).ok).toBe(true)
    expect(engine.check(c, { teeth: 8, idler: false }).ok).toBe(false)
    expect(engine.check({ ...c, direction: 'opposite' }, { teeth: 8, idler: false }).ok).toBe(true)
    expect(engine.check({ ...c, direction: 'any' }, { teeth: 8, idler: true }).ok).toBe(true)
    expect(engine.check({ ...c, direction: 'any' }, { teeth: 8, idler: false }).ok).toBe(true)
    expect(engine.check(c, { teeth: 12, idler: true }).ok).toBe(false)
    expect(gearTarget({ ...c, turns: 0.5 })).toBe(48)
    expect(gearTarget({ ...c, turns: 1 / 3 })).toBeNull() // 72 teeth is not drawn
    expect(gearTarget({ ...c, teeth: 16, turns: 1 / 3 })).toBe(48)
  })

  it('says turns in words a learner reads', () => {
    expect(turnsText(1)).toBe('once')
    expect(turnsText(2)).toBe('twice')
    expect(turnsText(3)).toBe('3 times')
    expect(turnsText(0.5)).toBe('half a turn')
    expect(turnsText(1.5)).toBe('1.5 times')
    expect(turnsText(24 / 36)).toBe('2/3 of a turn')
  })
})

describe('every configuration', { timeout: 60_000 }, () => {
  it('there are plenty of them, of every kind', () => {
    for (const list of [WEIGHTS, DISCS, BOTH, PIVOTS, OFF_CENTRE, SCALED, TWO_LOADS, LEVERS, PULLEYS, GEARS]) expect(list.length).toBeGreaterThan(8)
    expect(ALL.length).toBeGreaterThanOrEqual(200)
  })

  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('marks exactly by the rule, over every state the learner can reach', () => {
    for (const c of ALL) {
      let right = 0
      for (const s of everyState(c)) {
        const ok = engine.check(c, s).ok
        if (ok) right++
        if (c.task === 'balance') {
          const step = c.unit === 'm' ? 1 : 10
          const p = c.move === 'pivot' ? readAt(c, s) : fixedPivot(c)
          const parts = c.loads.map((l) => [l.force, markOfLoad(c, l)])
          if (c.beam) parts.push([c.beam, 0])
          if (c.move !== 'pivot') parts.push([readDiscs(c, s) * discUnit(c), readAt(c, s)])
          const sum = parts.reduce((n, [f, x]) => n + f * (x - p) * step, 0)
          if (c.move === 'both') expect(ok, `${nameOf(c)} ${nameOf(s)}`).toBe(sum === 0 && readDiscs(c, s) === Math.min(...solutions(c).map((x) => x.discs)))
          else expect(ok, `${nameOf(c)} ${nameOf(s)}`).toBe(sum === 0)
        } else if (c.task === 'lever') {
          const best = Math.max(...range(1, 9).filter((p) => c.load * p <= c.push * (10 - p)))
          expect(ok, `${nameOf(c)} ${nameOf(s)}`).toBe(s.at === best)
        } else if (c.task === 'pulley') {
          const n = Math.ceil(c.load / c.pull)
          expect(ok, `${nameOf(c)} ${nameOf(s)}`).toBe(s.strands === n && s.pulled === n * c.height)
        } else {
          const turnsRight = c.teeth === c.turns * s.teeth! || Math.abs(c.teeth / s.teeth! - c.turns) < 1e-9
          const way = c.direction === 'any' || (s.idler ? 'same' : 'opposite') === c.direction
          expect(ok, `${nameOf(c)} ${nameOf(s)}`).toBe(turnsRight && way)
        }
      }
      expect(right, nameOf(c)).toBeGreaterThan(0)
    }
  })

  it('the balance answer can be reached one step at a time, from the start', () => {
    for (const c of [...WEIGHTS, ...BOTH, ...PIVOTS]) {
      const goal = engine.solve(c) as { at: number }
      expect(freeMarks(c as BalanceConfig), nameOf(c)).toContain(goal.at)
    }
  })

  it('refuses a state that could not have been made', () => {
    for (const c of EXAMPLES) {
      for (const bad of [null, {}, { at: 99 }, { at: 'x' }, { discs: -1 }, { strands: 40 }, { pulled: -3 }, { teeth: 7 }] as never[]) {
        // Anything unreadable falls back to the start, which is never solved. The answer's own fields are checked above.
        expect(engine.check(c, bad).ok, `${nameOf(c)} ${nameOf(bad)}`).toBe(false)
      }
    }
  })

  it('says something true when marked, and says what was made when wrong', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('Yes.'), nameOf(c)).toBe(false)
    }
    const w = EXAMPLES[0] as BalanceConfig
    expect(working(w, { at: 4 })).toContain('6 N × 20 cm = 120 N cm')
    expect(working(w, { at: 4 })).toContain('3 N × 40 cm = 120 N cm')
    expect(working(w, { at: 4 })).toContain('A lighter weight')
    expect(madeText(w, { at: 2 })).toBe('The rule tips left: 120 N cm anticlockwise against 60 N cm clockwise.')
    expect(madeText(w, { at: 5 })).toBe('The rule tips right: 120 N cm anticlockwise against 150 N cm clockwise.')
    const two = EXAMPLES[2] as BalanceConfig
    expect(working(two, { at: 5, discs: 4 })).toContain('6 N × 20 cm + 2 N × 40 cm = 200 N cm')
    expect(madeText(two, { at: 4, discs: 5 })).toBe('The rule sits level with 5 discs, but fewer discs can do it.')
    expect(working(EXAMPLES[3], { at: 3 })).toContain('centre of gravity')
    expect(working(EXAMPLES[3], { at: 3 })).toContain('holds up all 5 N')
    const lever = EXAMPLES[5]
    expect(working(lever, { at: 2 })).toContain('600 N × 20 cm = 150 N × 80 cm')
    expect(working(lever, { at: 2 })).toContain('4 times as far')
    expect(madeText(lever, { at: 1 })).toContain('could go higher')
    expect(madeText(lever, { at: 5 })).toContain('has not moved')
    const pulley = EXAMPLES[6]
    expect(working(pulley, { strands: 3, pulled: 6 })).toContain('3 strands share the 600 N, so you pull 200 N')
    expect(working(pulley, { strands: 3, pulled: 6 })).toContain('6 m of rope')
    expect(madeText(pulley, { strands: 1, pulled: 0 })).toContain('has not moved')
    expect(madeText(pulley, { strands: 3, pulled: 4 })).toContain('not reached the shelf')
    expect(madeText(pulley, { strands: 4, pulled: 8 })).toContain('fewer strands would do')
    expect(working({ task: 'pulley', load: 200, pull: 200, height: 1 }, { strands: 1, pulled: 1 })).toContain('changes the direction')
    const gears = EXAMPLES[7]
    expect(working(gears, { teeth: 8, idler: true })).toContain('turns 3 times')
    expect(working(gears, { teeth: 8, idler: true })).toContain('same way')
    expect(working(gears, { teeth: 8, idler: true })).toContain('idler changes the direction')
    expect(madeText(gears, { teeth: 24, idler: false })).toContain('turns once')
    expect(madeText(gears, { teeth: 24, idler: false })).toContain('opposite way')
  })

  it('a wrong card never names where the answer is', () => {
    for (const c of EXAMPLES) {
      for (const s of everyState(c)) {
        if (engine.check(c, s).ok) continue
        const said = madeText(c, s)
        const ask = c.task === 'lever' ? /nearer the rock|closer|towards the rock/ : c.task === 'pulley' ? /\badd\b|\bmore strands\b/i : c.task === 'gears' ? /\bidler\b|\bteeth\b/ : /further out|closer|move it/i
        expect(said, `${nameOf(c)} ${nameOf(s)}`).not.toMatch(ask)
      }
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'Moments', move: 'slide', load: { force: '6 N', distance: '20 cm' }, weight: '3 N' }))
      .toEqual({ task: 'balance', move: 'weight', loads: [{ force: 6, at: 20, side: 'left' }], weight: 3, unit: 'cm' })
    expect(engine.parse({ task: 'principle of moments', left: { force: 500, at: '2 m' }, weight: 250 }))
      .toEqual({ task: 'balance', move: 'weight', loads: [{ force: 500, at: 2, side: 'left' }], weight: 250, unit: 'm' })
    expect(engine.parse({ left: { force: 6, at: 0.2 }, unit: 'm', weight: 3 })).not.toBeNull()
    expect(engine.parse({ task: 'balance', right: { force: 2, at: '0.4 m' }, at: '20 cm' }))
      .toEqual({ task: 'balance', move: 'discs', loads: [{ force: 2, at: 40, side: 'right' }], at: 20, unit: 'cm' })
    expect(engine.parse({ task: 'centre of gravity', left: 1, right: 4 }))
      .toEqual({ task: 'balance', move: 'pivot', loads: [{ force: 1, at: 0 }, { force: 4, at: 100 }], unit: 'cm' })
    expect(engine.parse({ task: 'balance', move: 'Move the pivot', loads: [{ force: 2, at: 0 }, { force: 6, at: 100 }], beamWeight: 2 }))
      .toEqual({ task: 'balance', move: 'pivot', loads: [{ force: 2, at: 0 }, { force: 6, at: 100 }], beam: 2, unit: 'cm' })
    expect(engine.parse({ task: 'balance', loads: [{ force: '2 kg', at: 20 }], move: 'both' }))
      .toEqual({ task: 'balance', move: 'both', loads: [{ force: 20, at: 20, side: 'left' }], unit: 'cm' })
    expect(engine.parse({ task: { kind: 'balance', move: 'discs', loads: [{ force: 6, at: 20 }], at: 40 } })).not.toBeNull()
    // Naming only the idea still gives a good first card.
    for (const task of ['moments', 'lever', 'pulleys', 'gears', 'centre of gravity']) {
      const c = engine.parse({ task })!
      expect(c, task).not.toBeNull()
      expect(engine.faults(c), task).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, task).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, task).toBe(true)
    }
    expect(engine.parse({ task: 'crowbar', rock: '800 N', effort: '200 N' })).toEqual({ task: 'lever', load: 800, push: 200 })
    expect(engine.parse({ push: 150, load: 600 })).toEqual({ task: 'lever', load: 600, push: 150 })
    expect(engine.parse({ task: 'Block and tackle', crate: 900, pull: 300, lift: 1 })).toEqual({ task: 'pulley', load: 900, pull: 300, height: 1 })
    expect(engine.parse({ strands: 2, load: 400, pull: 200 })).toEqual({ task: 'pulley', load: 400, pull: 200, height: 2 })
    expect(engine.parse({ task: 'gear ratio', driver: 24, ratio: '3:1', way: 'Same way' })).toEqual({ task: 'gears', teeth: 24, turns: 3, direction: 'same' })
    expect(engine.parse({ task: 'gears', teeth: 24, turns: '1/2', direction: 'Reversed' })).toEqual({ task: 'gears', teeth: 24, turns: 0.5, direction: 'opposite' })
    expect(engine.parse({ task: 'gears', teeth: 16, turns: 'a third' })).toEqual({ task: 'gears', teeth: 16, turns: 1 / 3, direction: 'any' })
    expect(engine.parse({ turns: 'twice' })).toEqual({ task: 'gears', teeth: 24, turns: 2, direction: 'any' })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const raw of [null, 'lever', 5, {}, { task: 'dance' }, { task: '__proto__' }, { task: 'balance', move: 'dance' }, { task: 'balance', loads: [{ force: 'heavy' }] }, { task: 'lever', load: 'huge' }, { task: 'gears', direction: 'sideways' }, { task: 'gears', turns: 'lots' }]) {
      expect(engine.parse(raw), nameOf(raw)).toBeNull()
    }
    // Out of range still parses: faults says what would work.
    for (const raw of [{ task: 'balance', loads: [{ force: 6, at: 25 }], move: 'both' }, { task: 'balance', loads: [{ force: 6.5, at: 20 }], move: 'both' }, { task: 'lever', load: 5000, push: 10 }, { task: 'pulley', load: 5000, pull: 10 }, { task: 'gears', teeth: 30, turns: 5 }]) {
      const c = engine.parse(raw)
      expect(c, nameOf(raw)).not.toBeNull()
      expect(engine.faults(c!).length, nameOf(raw)).toBeGreaterThan(0)
    }
  })

  it('refuses only what cannot be drawn, naming a nearby example that works', () => {
    const cases: [MachineConfig, RegExp, (c: never) => MachineConfig][] = [
      [{ task: 'balance', move: 'weight', loads: [{ force: 6, at: 20, side: 'left' }], weight: 5, unit: 'cm' }, /e\.g\. weight 4/, (c: BalanceConfig) => ({ ...c, weight: 4 })],
      [{ task: 'balance', move: 'weight', loads: [{ force: 6, at: 20, side: 'left' }], unit: 'cm' }, /e\.g\. weight 3/, (c: BalanceConfig) => ({ ...c, weight: 3 })],
      [{ task: 'balance', move: 'weight', loads: [{ force: 6, at: 25, side: 'left' }], weight: 3, unit: 'cm' }, /e\.g\. at 30/, (c: BalanceConfig) => ({ ...c, loads: [{ ...c.loads[0], at: 30 }], weight: 6 })],
      [{ task: 'balance', move: 'weight', loads: [{ force: 6, at: 80, side: 'left' }], weight: 3, unit: 'cm' }, /up to 50 cm/, (c: BalanceConfig) => ({ ...c, loads: [{ ...c.loads[0], at: 20 }] })],
      [{ task: 'balance', move: 'discs', loads: [{ force: 7, at: 30, side: 'left' }], at: 40, unit: 'cm' }, /e\.g\. at 30/, (c: BalanceConfig) => ({ ...c, at: 30 })],
      [{ task: 'balance', move: 'discs', loads: [{ force: 6, at: 20, side: 'left' }], unit: 'cm' }, /e\.g\. at 30/, (c: BalanceConfig) => ({ ...c, at: 30 })],
      [{ task: 'balance', move: 'pivot', loads: [{ force: 2, at: 0 }, { force: 6, at: 100 }], unit: 'cm' }, /e\.g\. force 8/, (c: BalanceConfig) => ({ ...c, loads: [c.loads[0], { ...c.loads[1], force: 8 }] })],
      [{ task: 'balance', move: 'pivot', loads: [{ force: 3, at: 0 }, { force: 3, at: 100 }], unit: 'cm' }, /already balance/, (c: BalanceConfig) => ({ ...c, loads: [{ force: 1, at: 0 }, { force: 4, at: 100 }] })],
      [{ task: 'lever', load: 5000, push: 100 }, /e\.g\. push 1250/, (c: LeverConfig) => ({ ...c, push: 1250 })],
      [{ task: 'lever', load: 10, push: 100 }, /e\.g\. push 3/, (c: LeverConfig) => ({ ...c, push: 3 })],
      [{ task: 'pulley', load: 5000, pull: 100, height: 2 }, /e\.g\. pull 1250/, (c: PulleyConfig) => ({ ...c, pull: 1250 })],
      [{ task: 'pulley', load: 600, pull: 200, height: 9 }, /e\.g\. height 3/, (c: PulleyConfig) => ({ ...c, height: 3 })],
      [{ task: 'pulley', load: 600, pull: 100, height: 3 }, /e\.g\. height 2/, (c: PulleyConfig) => ({ ...c, height: 2 })],
      [{ task: 'gears', teeth: 30, turns: 2, direction: 'any' }, /e\.g\. teeth 32/, (c: GearsConfig) => ({ ...c, teeth: 32 })],
      [{ task: 'gears', teeth: 24, turns: 5, direction: 'any' }, /e\.g\. turns 3/, (c: GearsConfig) => ({ ...c, turns: 3 })],
      [{ task: 'gears', teeth: 24, turns: -1, direction: 'any' }, /e\.g\. turns 2/, (c: GearsConfig) => ({ ...c, turns: 2 })],
    ]
    for (const [c, says, fix] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fix(c as never)
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      // Nothing a refused config can do crashes the rest of the engine.
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => renderToStaticMarkup(createElement(MomentsMachinesView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: MachineConfig, p: string) => engine.promptFaults!(c, p)
  const [w, discs, both, pivot, , lever, pulley, gears] = EXAMPLES

  it('asking for the outcome is fine, naming the given forces and the words of the idea included', () => {
    for (const c of ALL) expect(pf(c, goodPrompt(c)), nameOf(c)).toEqual([])
    expect(pf(w, 'A 6 N load hangs 20 cm from the pivot. Drag the 3 N brass stack until the clockwise and anticlockwise moments balance.')).toEqual([])
    expect(pf(both, 'Balance the rule using the fewest discs you can.')).toEqual([])
    expect(pf(pivot, 'Drag the stand to find the centre of gravity of the loaded rule.')).toEqual([])
    expect(pf(lever, 'Slide the fulcrum until the rock lifts as high as your 150 N push can manage.')).toEqual([])
    expect(pf(pulley, 'Raise the 600 N crate with at most 200 N of pull, and as little rope as you can.')).toEqual([])
    expect(pf(gears, 'Make the output turn 3 times per turn of the handle, the same way. Drag the handle round to test it.')).toEqual([])
  })

  it('how much, where or what will happen is not', () => {
    for (const p of ['Hang it 40 cm from the pivot.', 'Move it to mark 40.', 'Push it further out.', 'It has to go twice as far.', 'Both moments are 120 N cm.', 'It needs 120 N cm.']) expect(pf(w, p), p).toHaveLength(1)
    for (const p of ['Add 80 N of discs.', 'It takes eight discs.']) expect(pf(discs, p), p).toHaveLength(1)
    for (const p of ['Use 4 discs.', 'Use four discs.', 'The lightest is 4 N.', 'Hang them 50 cm out.']) expect(pf(both, p), p).toHaveLength(1)
    for (const p of ['The stand goes at 80 cm.', 'Move it nearer the heavier load.', 'Move it towards the heavier side.']) expect(pf(pivot, p), p).toHaveLength(1)
    for (const p of ['Put the fulcrum 20 cm from the rock.', 'Move it closer to the rock.', 'Move the fulcrum towards the rock.', 'Keep the long arm on your side.']) expect(pf(lever, p), p).toHaveLength(1)
    for (const p of ['Use 3 strands.', 'Use three pulleys.', 'You will pull 6 m of rope.', 'Count the strands holding it.', 'The strands share the load.', 'Add more strands.']) expect(pf(pulley, p), p).toHaveLength(1)
    for (const p of ['Use an 8 tooth gear.', 'Fit 8 teeth on the output.', 'Add an idler.', 'You need an odd number of gears.', 'Use a smaller gear.', 'Give it fewer teeth.']) expect(pf(gears, p), p).toHaveLength(1)
  })

  it('what the card does not show is refused too', () => {
    for (const [c, p] of [
      [w, 'Tie the rope to the pulley.'], [w, 'Push at an angle.'], [w, 'Ignore friction at the pivot.'], [discs, 'Drag the stack along the rule.'], [pivot, 'Add discs to the left.'],
      [lever, 'Use the gears to lift it.'], [lever, 'Name the class: is it a first-class lever?'], [lever, 'What about a wheelbarrow?'],
      [pulley, 'Drag the rope down.'], [pulley, 'Work out its efficiency.'], [gears, 'Thread the belt round the pulley.'], [gears, 'Build a compound train.'], [gears, 'Drag the gears apart.'],
    ] as [MachineConfig, string][]) {
      expect(pf(c, p), p).toHaveLength(1)
      expect(pf(c, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const fix = pf(c, 'Move it further out, and count the strands, and add an idler, and move it closer to the rock.')[0].match(/\("([^"]+)"\)/)![1]
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'gears' ? /handle/ : c.task === 'pulley' ? /crate/ : c.task === 'lever' ? /fulcrum/ : /rule/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"moments-machines", "config": (\{.*\}) \},\s*"success"/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(f[1]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['balance', 'lever', 'pulley', 'gears']))
    // And the configs listed before them.
    const listed = [...engine.prompt.matchAll(/(?:config:|or) (\{ "task".*?\})\s+-- the prompt says "([^"]+)"/g)]
    expect(listed.length).toBe(5)
    for (const f of listed) {
      const c = engine.parse(JSON.parse(f[1]))!
      expect(engine.faults(c), f[1]).toEqual([])
      expect(engine.promptFaults!(c, f[2]), f[2]).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "moments-machines"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'moments-machines')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Turning effects', 'Chapter 4: Turning effects of forces', 'Chapter 4: Forces – vectors and moments', 'Unit 3: Moments and Equilibrium of Bodies', 'Centre of gravity', 'Simple machines (I)', 'Simple Machines', 'Simple machines',
      'Equilibrium of a rigid body', 'Forces and machines', 'Moments', 'Chapter 5: Moments', 'The principle of moments', 'Moments and levers', 'Levers', 'Levers and pulleys', 'How levers work', 'The turning effect of a force', 'Moment of a force',
      'Pulleys', 'Pulley systems', 'Block and tackle', 'Gears', 'Gears and gear ratios', 'Gear trains', 'Mechanical advantage and velocity ratio', 'Force multipliers', 'Pivots and fulcrums', 'Taking moments about a point', 'Torque', 'Centre of mass of a loaded beam', 'See-saws and balance',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      // A moment in time.
      'Key moments in the civil rights movement', 'Defining moments of the Cold War', 'Moments in history', 'Moments of truth in the novel', 'A moment of silence', 'Moments in time', 'Memorable moments in the play', 'Pivotal moments in the story', 'Just a moment', 'The moment of decision',
      // Moment as something else.
      'Moment of inertia', 'Moments of inertia of a rigid body', 'Dipole moments of molecules', 'Magnetic moment of the electron', 'Bending moments in beams', 'Moment generating functions', 'Method of moments', 'Moments of a distribution', 'Second moment of area', 'Moment magnitude scale',
      // The stems `covers` would catch.
      'Momentum and collisions', 'Conservation of momentum', 'Financial leverage', 'Leverage ratios', 'Pulled muscles', 'Gearing ratio in business',
      // Pivot, lever, gear elsewhere.
      'Pivot tables in Excel', 'Creating pivot charts', 'Pivot joints in the neck', 'Centre pivot irrigation', 'The pivot foot in basketball', 'Gaussian elimination: the pivot element', 'Policy levers in macroeconomics', 'The levers of power', 'Lever arch files', 'Fishing gear and methods', 'Fishing gears', 'Landing gear', 'Protective gear',
      // Machines and centres that are not these.
      'Machine learning', 'Washing machines', 'Turing machines', 'Virtual machines', 'Farm mechanization', 'Sewing machines', 'Simple machines: inclined planes', 'Simple harmonic motion', 'Simple interest', 'Simple sentences', 'Economic centre of gravity', 'Centre of enlargement', 'Centre of a circle', 'Gravitational fields',
      // Neighbours.
      'Forces', 'Turning points of a graph', 'Turning points in history', 'Rigid transformations', 'Static electricity', 'Statistics', 'Joints and movement', 'Skeletons, Muscles and Movement', 'Torque on a coil in a magnetic field', 'Angular acceleration and torque', 'Rotational dynamics', 'Sonnets and rhyme schemes',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('no near-miss phrase shrinks to a single word that would rule out the real topics', () => {
    const words = (t: string) => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'what', 'when', 'why', 'how', 'into', 'from', 'that', 'this', 'about', 'always'].includes(w))
    for (const p of engine.notFor!) expect(words(p).length, p).toBeGreaterThanOrEqual(2)
    for (const p of engine.phrases!) expect(words(p).join(' '), p).not.toBe('moment')
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('moments-machines')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "moments-machines"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:moments-machines"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
  })

  it('the numbers in its catalogue entry are the ones it uses', () => {
    expect(engine.prompt).toContain('up to 12 discs')
    expect(engine.prompt).toContain('up to 12 m')
    expect(MAX_DISCS).toBe(12)
    expect(MAX_ROPE).toBe(12)
    expect(engine.prompt).toContain('from 1 to 6')
    expect(MAX_STRANDS).toBe(6)
    expect(engine.prompt).toContain('8 to 48 teeth in fours')
    expect(GEAR_TEETH[0]).toBe(8)
    expect(GEAR_TEETH[GEAR_TEETH.length - 1]).toBe(48)
    expect(engine.prompt).toContain('16 to 48 in fours')
    expect(HANDLE_TEETH[0]).toBe(16)
    expect(solutions({ task: 'balance', move: 'weight', loads: [{ force: 6, at: 20, side: 'left' }], weight: 3, unit: 'cm' })).toHaveLength(1)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 60_000 }, () => {
  const textWide = (t: string) => t.length * 7 + 2

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(HALF_MARKS).toBe(5)
    expect(MAX_DISCS).toBe(12)
    expect(IDLER_TEETH).toBe(trainOf(24, 24, true)[1].teeth)
    expect(W).toBe(360)
    expect(LEVER_MARKS).toBe(10)
    const html = renderToStaticMarkup(createElement(MomentsMachinesView, { config: EXAMPLES[7], state: { teeth: 48, idler: false }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain('data-teeth="48"')
    expect(html).toContain('disabled=""') // the top of its own list of teeth, the same list as config's
    expect(moduleOf(24)).toBeGreaterThan(0)
  })

  it('every stack on every card hangs clear of the floor, and inside the plate, however the rule leans', () => {
    const list = [...WEIGHTS, ...DISCS, ...BOTH, ...PIVOTS, ...OFF_CENTRE, ...SCALED, ...TWO_LOADS]
    for (const c of list) {
      for (const s of everyState(c)) {
        const tilt = tiltOf(c, s)
        const p = c.move === 'pivot' ? readAt(c, s) : fixedPivot(c)
        const px = CX + p * MARK
        const unit = discUnit(c)
        const stacks = [
          ...c.loads.map((l) => ({ x: markOfLoad(c, l), discs: l.force / unit, text: `${l.force} N` })),
          ...(c.move === 'pivot' ? [] : [{ x: readAt(c, s), discs: readDiscs(c, s), text: `${readDiscs(c, s) * unit} N` }]),
        ].sort((a, b) => a.x - b.x)
        const ys = stackLabels(stacks)
        const sin = Math.sin((tilt * Math.PI) / 180)
        const cos = Math.cos((tilt * Math.PI) / 180)
        stacks.forEach((st, i) => {
          const dx = CX + st.x * MARK - px
          const peg = { x: px + dx * cos, y: BY + dx * sin }
          expect(peg.y + ys[i] + 4, `label ${nameOf(c)} ${nameOf(s)}`).toBeLessThanOrEqual(FLOOR)
          expect(peg.x - 14, `left ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
          expect(peg.x + 14, `right ${nameOf(c)}`).toBeLessThanOrEqual(W)
          expect(st.discs, nameOf(c)).toBeLessThanOrEqual(MAX_DISCS)
          expect(STRING + stackHeight(st.discs) + BY + dx * sin).toBeLessThanOrEqual(FLOOR)
          // No two labels touch.
          stacks.forEach((o, j) => {
            if (j <= i) return
            const hit = Math.abs(o.x - st.x) * MARK < (textWide(o.text) + textWide(st.text)) / 2 && Math.abs(ys[i] - ys[j]) < 13
            expect(hit, `${st.text} / ${o.text} ${nameOf(c)} ${nameOf(s)}`).toBe(false)
          })
        })
        // Both ends of the rule stay on the plate.
        const longArm = Math.max(CX + PLANK_HALF - px, px - (CX - PLANK_HALF))
        expect(BY - longArm * Math.abs(sin) - 11, `top ${nameOf(c)} ${nameOf(s)}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('stacks on neighbouring marks do not touch, or the arrow for the rule’s own weight', () => {
    expect(28).toBeLessThan(MARK)
    expect(MARK - 14).toBeGreaterThan(textWide('20 N') / 2)
    expect(DISC_H * MAX_DISCS).toBeLessThan(FLOOR - BY - STRING)
    expect(BAL_H).toBeGreaterThan(FLOOR)
  })

  it('one smallest move makes a change the eye catches: the rule leans differently at each mark', () => {
    const c = EXAMPLES[0] as BalanceConfig
    const tilts = freeMarks(c).map((at) => tiltOf(c, { at }))
    tilts.forEach((t, i) => { if (i) expect(Math.abs(t - tilts[i - 1]), `${i}`).toBeGreaterThanOrEqual(1.4) })
    expect(new Set(tilts.map(Math.sign))).toEqual(new Set([-1, 0, 1]))
    // The smallest imbalance is still plainly not level: at least 3 degrees, 8 px at the end of the rule.
    for (const b of [...WEIGHTS, ...BOTH, ...PIVOTS]) {
      for (const s of everyState(b)) {
        const t = tiltOf(b, s)
        if (netMoment(b, s) !== 0) expect(Math.abs(t), nameOf(b)).toBeGreaterThanOrEqual(3)
        else expect(t).toBe(0)
      }
    }
    // The lever: every step of the fulcrum swings the bar.
    const l = EXAMPLES[5] as LeverConfig
    const angles = range(1, 9).map((p) => barPose(p, leverHolds(l, p)).angle)
    angles.forEach((a, i) => { if (i) expect(Math.abs(a - angles[i - 1]), `${i}`).toBeGreaterThanOrEqual(0.25) })
    expect(Math.abs(barPose(3, false).angle - barPose(4, false).angle)).toBeGreaterThanOrEqual(1.5)
    // The pulley: every strand redraws a wheel, and pulling a metre lifts the crate by at least 5 px.
    expect(PX_PER_M / MAX_STRANDS).toBeGreaterThanOrEqual(5)
  })

  it('the drawing is honest: the hand travels further than the rock by the ratio of the arms', () => {
    for (const p of range(1, 8)) {
      const b = barPose(p, true)
      const hand = b.end.y - b.restEnd.y
      expect(hand / b.rise, `${p}`).toBeCloseTo(b.far / b.near, 5)
      expect(b.far / b.near, `${p}`).toBeCloseTo((LEVER_MARKS - p) / p, 5)
    }
  })

  it('the lever stays on its plate in every pose, and the fulcrum clears the rock', () => {
    for (const c of LEVERS) {
      for (const p of range(1, 9)) {
        const lifted = leverHolds(c, p)
        const b = barPose(p, lifted)
        expect(b.end.x + 6, `${p}`).toBeLessThanOrEqual(W)
        expect(b.end.y, `${p}`).toBeGreaterThanOrEqual(6)
        expect(b.end.y + 6, `${p}`).toBeLessThanOrEqual(LEV_FLOOR)
        expect(LEV_FLOOR - 78 - b.rise, `rock top ${p}`).toBeGreaterThanOrEqual(2)
        expect(fulcrumX(p) - 16, `${p}`).toBeGreaterThanOrEqual(76)
        const arrow = Math.min(W - 16, b.end.x + 14)
        expect(arrow + 6, `${p}`).toBeLessThanOrEqual(W)
        const label = pushLabel(b, lifted, arrow)
        expect(label.y - 12, `${p}`).toBeGreaterThanOrEqual(0)
        expect(label.x, `${p}`).toBeLessThanOrEqual(W - 2)
        expect(label.x - textWide('your push'), `${p}`).toBeGreaterThanOrEqual(0)
      }
    }
    expect(LEV_H).toBeGreaterThan(LEV_FLOOR + 28)
  })

  it('the block and tackle is a real one: strands hold the load, with the wheels the rope needs', () => {
    for (const n of range(1, MAX_STRANDS)) {
      const { lines, top, bottom, fromTop } = pulleyLayout(n)
      expect(lines, `${n}`).toHaveLength(n + 1)
      expect(top, `${n}`).toHaveLength(Math.ceil(n / 2))
      expect(bottom, `${n}`).toHaveLength(Math.floor(n / 2))
      // Tied to the beam when even, to the moving block when odd.
      expect(fromTop, `${n}`).toBe(n % 2 === 0)
      // Each wheel sits between two neighbouring lines, and none of the runs share a place.
      for (const x of [...top, ...bottom]) expect(lines.some((l, i) => i < n && Math.abs(l + SPACE / 2 - x) < 1e-9), `${n} ${x}`).toBe(true)
      expect(new Set([...top, ...bottom]).size).toBe(n)
      // The holding strands are centred over the crate.
      const middle = (lines[0] + lines[n - 1]) / 2
      expect(middle, `${n}`).toBe(128)
      // A rope path that starts on a line, goes round each wheel in turn, and ends at the hand.
      const d = ropePath(n, 0)
      expect(d.match(/ A /g)?.length, `${n}`).toBe(n)
      expect(d, `${n}`).toContain(`L ${GRIP.x} ${GRIP.y}`)
      expect(d.startsWith(`M ${lines[0]} `), `${n}`).toBe(true)
    }
  })

  it('the moving block never reaches the fixed one, and the crate and the rope stay on the plate', () => {
    for (const h of [1, 2, 3]) {
      const top = hubY(h * PX_PER_M)
      expect(top - TOP_Y, `${h}`).toBeGreaterThanOrEqual(SPACE + 6)
    }
    expect(PUL_FLOOR - 50 - 3 * PX_PER_M).toBeGreaterThanOrEqual(TOP_Y + SPACE)
    // The coil, at its tallest, stays under the handle.
    expect(PUL_FLOOR - 3 - (MAX_ROPE - 1) * 4.5 - 12).toBeGreaterThan(GRIP.y + 6)
    expect(GRIP.x + 20).toBeLessThanOrEqual(W)
    expect(PUL_H).toBeGreaterThan(PUL_FLOOR + 24)
  })

  it('every gear train fits the plate, with pitch circles touching', () => {
    for (const c of GEARS) {
      const m = moduleOf(c.teeth)
      for (const out of GEAR_TEETH) for (const idler of [false, true]) {
        const train = trainOf(c.teeth, out, idler)
        train.forEach((g, i) => {
          const reach = g.r + 0.9 * m
          expect(g.x - reach, `${g.key} ${c.teeth} ${out}`).toBeGreaterThanOrEqual(4)
          expect(g.x + reach, `${g.key} ${c.teeth} ${out}`).toBeLessThanOrEqual(W - 4)
          expect(GEAR_Y - reach - 12, `${g.key} ${c.teeth} ${out}`).toBeGreaterThanOrEqual(0)
          expect(GEAR_Y + reach, `${g.key} ${c.teeth} ${out}`).toBeLessThanOrEqual(GEAR_H - 22)
          if (i) expect(g.x - train[i - 1].x, `${c.teeth} ${out}`).toBeCloseTo(g.r + train[i - 1].r, 6)
        })
      }
    }
  })

  it('every tooth stays in its gap, at every angle, and the speeds and directions are right', () => {
    for (const handle of HANDLE_TEETH) for (const out of GEAR_TEETH) for (const idler of [false, true]) {
      const train = trainOf(handle, out, idler)
      for (const deg of [0, 11, 37, 90, 133.3, 360, 725.5, -48]) {
        const a = gearAngles(train, deg)
        for (let i = 1; i < train.length; i++) {
          const pitchA = 360 / train[i - 1].teeth
          const pitchB = 360 / train[i].teeth
          const toothA = ((a[i - 1] / pitchA) % 1 + 1) % 1
          const toothB = (((a[i] - 180) / pitchB) % 1 + 1) % 1
          // Opposite phases: where one has a tooth at the contact point, the other has a gap.
          expect(((toothA + toothB) % 1 + 1) % 1, `${handle} ${out} ${idler} ${deg}`).toBeCloseTo(0.5, 6)
        }
      }
      const at0 = gearAngles(train, 0)
      const at1 = gearAngles(train, 360)
      const outTurn = (at1[at1.length - 1] - at0[at0.length - 1]) / 360
      expect(outTurn, `${handle} ${out} ${idler}`).toBeCloseTo((idler ? 1 : -1) * (handle / out), 6)
      expect(train.length).toBe(idler ? 3 : 2)
    }
    for (const t of GEAR_TEETH) expect(gearPath(t, 3).match(/ A /g)?.length).toBe(t)
  })
})

describe('the scene on the board', { timeout: 60_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'moments-machines', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: MachineConfig, state: MachineState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(MomentsMachinesView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says the answer, the rule or a sum', () => {
    for (const c of EXAMPLES.filter((x) => engine.faults(x).length === 0)) {
      const prompt = goodPrompt(c)
      const html = card(c, prompt)
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'N cm', 'N m ', 'Anticlockwise', 'clockwise:', 'lightest', 'lighter', 'further', 'trades', 'share', 'same work', 'force to spare', 'centre of gravity', 'fewer', 'higher', 'allows']) {
        expect(shown, `${secret} in ${nameOf(c)}`).not.toContain(secret)
      }
    }
  })

  it('holds back each card’s own answer before marking', () => {
    const l = text(raw(EXAMPLES[5], engine.initial(EXAMPLES[5]), 'idle')) + attrs(raw(EXAMPLES[5], engine.initial(EXAMPLES[5]), 'idle'))
    expect(l).not.toContain('20 cm')
    expect(l).not.toContain('20 centimetres')
    const p = raw(EXAMPLES[6], engine.initial(EXAMPLES[6]), 'idle')
    expect(text(p)).not.toContain('6 m')
    expect(attrs(p)).not.toContain('3 strands')
    const g = raw(EXAMPLES[7], engine.initial(EXAMPLES[7]), 'idle')
    expect(text(g)).not.toContain('8 teeth')
    expect(attrs(g)).not.toContain('8 teeth')
    // The meter draws a bar, never a number.
    expect(text(raw(EXAMPLES[6], { strands: 3, pulled: 0 }, 'idle'))).not.toMatch(/\b200 N\b.*\b200 N\b/)
    expect(text(raw(EXAMPLES[5], { at: 3 }, 'idle'))).not.toContain('257')
  })

  it('names what it draws, on the card, before marking', () => {
    const w = text(raw(EXAMPLES[0], engine.initial(EXAMPLES[0]), 'idle'))
    for (const n of ['pivot', '6 N', '3 N', 'Marks are cm from the pivot', 'Each disc is 1 N', 'Brass stack from the pivot']) expect(w).toContain(n)
    const pv = text(raw(EXAMPLES[3], engine.initial(EXAMPLES[3]), 'idle'))
    for (const n of ['pivot', '1 N', '4 N', 'Marks are cm along the rule', 'Stand on the rule']) expect(pv).toContain(n)
    const beam = text(raw({ task: 'balance', move: 'pivot', beam: 2, loads: [{ force: 2, at: 0 }, { force: 6, at: 100 }], unit: 'cm' }, { at: 0 }, 'idle'))
    for (const n of ['2 N', 'own weight']) expect(beam).toContain(n)
    const l = text(raw(EXAMPLES[5], engine.initial(EXAMPLES[5]), 'idle'))
    for (const n of ['600 N', 'your push', 'fulcrum', 'Push needed', 'your push 150 N', 'Fulcrum from the rock']) expect(l).toContain(n)
    const p = text(raw(EXAMPLES[6], engine.initial(EXAMPLES[6]), 'idle'))
    for (const n of ['600 N', 'shelf 2 m up', 'your pull', 'rope pulled', 'Pull needed', 'your pull 200 N', 'Strands holding the crate', 'Rope pulled']) expect(p).toContain(n)
    const g = text(raw(EXAMPLES[7], { teeth: 24, idler: true }, 'idle'))
    for (const n of ['handle gear, 24 teeth', 'output gear, 24 teeth', 'idler', 'Red marks', 'Output gear', 'Idler gear', 'Handle turns', 'Output turns', 'Turn once']) expect(g).toContain(n)
  })

  it('draws a disc for each newton it can, and the unit when a disc is more', () => {
    const c = EXAMPLES[0]
    expect([...raw(c, { at: 2 }, 'idle').matchAll(/data-disc="iron"/g)].length).toBe(6)
    expect([...raw(c, { at: 2 }, 'idle').matchAll(/data-disc="brass"/g)].length).toBe(3)
    const big: BalanceConfig = { task: 'balance', move: 'weight', loads: [{ force: 600, at: 2, side: 'left' }], weight: 300, unit: 'm' }
    expect([...raw(big, { at: 2 }, 'idle').matchAll(/data-disc="iron"/g)].length).toBe(6)
    expect(text(raw(big, { at: 2 }, 'idle'))).toContain('Each disc is 100 N')
  })

  it('the rock, the crate and the machines change with the state', () => {
    const l = EXAMPLES[5]
    expect(raw(l, { at: 3 }, 'idle')).toContain('data-rise="0"')
    expect(raw(l, { at: 2 }, 'idle')).not.toContain('data-rise="0"')
    expect(raw(l, { at: 2 }, 'idle')).toContain('data-ghost')
    expect(raw(l, { at: 3 }, 'idle')).not.toContain('data-ghost')
    expect(text(raw(l, { at: 3 }, 'idle'))).toContain('rests on the rock')
    const p = EXAMPLES[6]
    expect([...raw(p, { strands: 4, pulled: 0 }, 'idle').matchAll(/data-wheel/g)].length).toBe(4)
    expect([...raw(p, { strands: 4, pulled: 0 }, 'idle').matchAll(/data-strand=/g)].length).toBe(4)
    expect(raw(p, { strands: 4, pulled: 8 }, 'idle')).toContain('data-coil="8"')
    expect(text(raw(p, { strands: 1, pulled: 0 }, 'idle'))).toContain('will not move')
    expect(raw(p, { strands: 1, pulled: 0 }, 'idle')).toMatch(/aria-label="Pull a metre of rope"[^>]*disabled|disabled[^>]*aria-label="Pull a metre of rope"/)
    expect(raw(p, { strands: 3, pulled: 3 }, 'idle')).not.toMatch(/disabled=""[^>]*aria-label="Pull a metre of rope"|aria-label="Pull a metre of rope"[^>]*disabled=""/)
    const g = EXAMPLES[7]
    expect(raw(g, { teeth: 12, idler: false }, 'idle')).toContain('data-sense="anticlockwise" data-sense-of="output"')
    expect(raw(g, { teeth: 12, idler: true }, 'idle')).toContain('data-sense="clockwise" data-sense-of="output"')
    expect(raw(g, { teeth: 12, idler: true }, 'idle')).toContain('data-sense="anticlockwise" data-sense-of="idler"')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c = EXAMPLES[0]
    expect(raw(c, engine.initial(c), 'shown')).toContain('data-tilt="0"')
    expect(text(raw(c, engine.initial(c), 'shown'))).toContain('120 N cm')
    expect(raw(EXAMPLES[6], { strands: 1, pulled: 0 }, 'shown')).toContain('data-coil="6"')
    expect(raw(EXAMPLES[7], engine.initial(EXAMPLES[7]), 'shown')).toContain('data-teeth="8"')
  })

  it('every control is a real button or a slider with its own label, and locks when solved', () => {
    for (const c of EXAMPLES.filter((x) => engine.faults(x).length === 0)) {
      const idle = raw(c, engine.initial(c), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      expect(buttons.length, nameOf(c)).toBeGreaterThan(0)
      expect(buttons.length, nameOf(c)).toBeLessThanOrEqual(4)
      expect(new Set(buttons.map((m) => m[1])).size, nameOf(c)).toBe(buttons.length)
      for (const m of buttons) {
        expect(m[0], m[1]).toContain('type="button"')
        expect(m[0], m[1]).toContain('nodrag')
      }
      expect(idle, nameOf(c)).toContain('nodrag')
      const right = raw(c, engine.solve(c), 'right')
      const enabled = [...right.matchAll(/<button[^>]*>/g)].filter((m) => !/disabled=""/.test(m[0]))
      // Solved, it locks: only the gears' turn button is left, which changes nothing that was marked.
      expect(enabled.length, nameOf(c)).toBe(c.task === 'gears' ? 1 : 0)
      expect(right, nameOf(c)).not.toMatch(c.task === 'gears' ? /$^/ : /role="slider"/)
    }
    expect(raw(EXAMPLES[0], { at: 2 }, 'idle')).toMatch(/role="slider"[^>]*aria-label="Slide the brass stack along the rule"/)
    expect(raw(EXAMPLES[3], { at: 0 }, 'idle')).toMatch(/role="slider"[^>]*aria-label="Slide the stand along the bench"/)
    expect(raw(EXAMPLES[5], { at: 8 }, 'idle')).toMatch(/role="slider"[^>]*aria-label="Slide the fulcrum along the ground"/)
    expect(raw(EXAMPLES[7], { teeth: 24 }, 'idle')).toMatch(/role="slider"[^>]*aria-label="Turn the handle"/)
    for (const c of [EXAMPLES[0], EXAMPLES[3], EXAMPLES[5], EXAMPLES[7]]) expect(raw(c, engine.initial(c), 'idle')).toContain('touch-none')
  })

  it('keyboard help is for keyboard users', () => {
    for (const c of [EXAMPLES[0], EXAMPLES[3], EXAMPLES[5], EXAMPLES[7]]) {
      const html = raw(c, engine.initial(c), 'idle')
      expect(html, nameOf(c)).toContain('mm-kbd hidden')
      expect(html, nameOf(c)).toContain('_.mm-kbd]:block')
    }
  })

  it('the counts of turns start from nothing, and belong to the card rather than the answer', () => {
    const g = raw(EXAMPLES[7], { teeth: 8, idler: true }, 'idle')
    expect(g).toContain('data-handle-turns="true">0<')
    expect(g).toContain('data-output-turns="true">0<')
    expect(g).toContain('Turn once')
  })

  it('moves only the stack, for a card that only changes its discs', () => {
    const html = raw(EXAMPLES[1], engine.initial(EXAMPLES[1]), 'idle')
    expect(html).not.toContain('role="slider"')
    expect(html).toContain('Add a disc to the brass stack')
    expect(html).not.toContain('Move the brass stack')
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    for (const c of EXAMPLES.filter((x) => engine.faults(x).length === 0)) {
      const first = raw(c, engine.initial(c), 'idle', true)
      expect(first, nameOf(c)).not.toMatch(/transition:\s*[a-z]/)
      const seen = new Set<string>()
      for (const s of everyState(c).slice(0, 40)) seen.add(raw(c, s, 'idle', true))
      expect(seen.size, nameOf(c)).toBe(Math.min(40, everyState(c).length))
    }
    // A change eases when motion is allowed.
    expect(raw(EXAMPLES[0], { at: 2 }, 'idle', false)).toMatch(/transition:transform 900ms/)
    expect(raw(EXAMPLES[5], { at: 2 }, 'idle', false)).toMatch(/transition:transform 900ms/)
    expect(raw(EXAMPLES[6], { strands: 3, pulled: 3 }, 'idle', false)).toMatch(/transition:transform 600ms/)
  })

  it('tells a screen reader what it sees, never the answer', () => {
    const w = raw(EXAMPLES[0], { at: 2 }, 'idle')
    expect(text(w)).toContain('The rule tips left.')
    expect(text(raw(EXAMPLES[0], { at: 5 }, 'idle'))).toContain('The rule tips right.')
    expect(text(raw(EXAMPLES[0], { at: 4 }, 'idle'))).toContain('The rule sits level.')
    expect(attrs(w)).toContain('6 newtons')
    expect(text(raw(EXAMPLES[5], { at: 8 }, 'idle'))).toContain('The rock stays on the ground.')
    expect(text(raw(EXAMPLES[5], { at: 2 }, 'idle'))).toContain('The rock has lifted off the ground.')
    expect(text(raw(EXAMPLES[6], { strands: 1, pulled: 0 }, 'idle'))).toContain('It will not move')
    expect(text(raw(EXAMPLES[7], { teeth: 12, idler: true }, 'idle'))).toContain('the same way as the handle')
    expect(text(raw(EXAMPLES[7], { teeth: 12, idler: false }, 'idle'))).toContain('the opposite way to the handle')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of EXAMPLES.filter((x) => engine.faults(x).length === 0)) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
