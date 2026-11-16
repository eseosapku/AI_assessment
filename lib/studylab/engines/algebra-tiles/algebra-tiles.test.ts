import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  algebraTilesEngine as engine, applyMove, equationText, exprText, foundValue, moveText, netOf, panOf, panText, panWords,
  progress, readExpr, replay, rightText, solution, solveMoves, startPans, undoMove, withMove, xTiles, unitTiles,
  MAX_UNITS, MAX_X, PAN_UNITS, PAN_X, TILES,
  type AlgebraTilesConfig, type AlgebraTilesState, type Move, type Pans, type Tile,
} from './config'
import { AlgebraTilesView, layoutPan } from './View'
import { getEngine } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Linear equations on a balance of algebra tiles: the tutor names the
 * equation, the learner makes only legal moves (each to both pans), and the
 * engine marks x alone with unit tiles opposite.
 */

const cfg = (left: [number, number], right: [number, number]): AlgebraTilesConfig =>
  ({ task: { kind: 'solve', left: { x: left[0], units: left[1] }, right: { x: right[0], units: right[1] } } })
/** 3x + 2 = x + 8: x = 3. */
const MAIN = cfg([3, 2], [1, 8])
/** 5x + 2 = 3x + 10: x = 4, a digit that appears nowhere in the equation. */
const FOUR = cfg([5, 2], [3, 10])
const moves = (...m: Move[]): AlgebraTilesState => ({ moves: m })
const take = (tile: Tile, n = 1): Move => ({ op: 'take', tile, n })
const add = (tile: Tile, n = 1): Move => ({ op: 'add', tile, n })
const valueAt = (p: Pans, x: number) => {
  const l = netOf(p.left)
  const r = netOf(p.right)
  return [l.x * x + l.units, r.x * x + r.units]
}

/** Every config the tutor can name: x from -5 to 5 and units from -10 to 10 on each side. */
function* everyConfig(): Generator<AlgebraTilesConfig> {
  for (let a = -MAX_X; a <= MAX_X; a++) {
    for (let b = -MAX_UNITS; b <= MAX_UNITS; b++) {
      for (let c = -MAX_X; c <= MAX_X; c++) {
        for (let d = -MAX_UNITS; d <= MAX_UNITS; d++) yield cfg([a, b], [c, d])
      }
    }
  }
}

describe('the tiles as the engine works them out', () => {
  it('writes each pan tile for tile, as a school writes it', () => {
    expect(exprText({ x: 3, units: 2 })).toBe('3x + 2')
    expect(exprText({ x: 1, units: -4 })).toBe('x − 4')
    expect(exprText({ x: -1, units: 0 })).toBe('−x')
    expect(exprText({ x: -2, units: 7 })).toBe('−2x + 7')
    expect(exprText({ x: 0, units: -5 })).toBe('−5')
    expect(exprText({ x: 0, units: 0 })).toBe('0')
    expect(panText({ 'x': 2, '-x': 1, '1': 3, '-1': 3 })).toBe('2x − x + 3 − 3')
    expect(equationText(startPans(MAIN))).toBe('3x + 2 = x + 8')
  })

  it('says what is on a pan without saying what x is', () => {
    expect(panWords(panOf({ x: 3, units: 2 }))).toBe('3 x tiles and 2 unit tiles')
    expect(panWords({ 'x': 1, '-x': 0, '1': 0, '-1': 1 })).toBe('1 x tile and 1 −1 tile')
    expect(panWords(panOf({ x: 0, units: 0 }))).toBe('empty')
  })

  it('solves exactly, and finds no whole-number x where there is none', () => {
    expect(solution(MAIN)).toBe(3)
    expect(solution(FOUR)).toBe(4)
    expect(solution(cfg([2, -3], [-3, 7]))).toBe(2)
    expect(solution(cfg([1, 8], [3, 2]))).toBe(3)
    expect(solution(cfg([1, 7], [0, 2]))).toBe(-5)
    expect(solution(cfg([3, 1], [1, 6]))).toBeNull()
    expect(solution(cfg([2, 1], [2, 5]))).toBeNull()
  })

  it('reads a side however it is reasonably written', () => {
    expect(readExpr('3x + 2')).toEqual({ x: 3, units: 2 })
    expect(readExpr('x − 4')).toEqual({ x: 1, units: -4 })
    expect(readExpr('-x')).toEqual({ x: -1, units: 0 })
    expect(readExpr('7 - 2x')).toEqual({ x: -2, units: 7 })
    expect(readExpr('3x + 2 + x')).toEqual({ x: 4, units: 2 })
    for (const bad of ['', '3y', '2(x + 1)', 'x^2', '1/2x', '3 +', 'x x']) expect(readExpr(bad), bad).toBeNull()
  })
})

describe('the moves, each to both pans', () => {
  const start = startPans(MAIN)

  it('takes a tile from both pans, or refuses when one pan has none', () => {
    const r = applyMove(start, take('x'))
    expect(r.ok && equationText(r.pans)).toBe('2x + 2 = 8')
    const after = applyMove((r as { pans: Pans }).pans, take('x'))
    expect(after).toEqual({ ok: false, refused: 'The right pan has no x tile to take away, and whatever you take from one side you must take from the other.' })
    expect(applyMove(start, take('-1'))).toEqual({ ok: false, refused: 'Neither pan has a −1 tile to take away.' })
  })

  it('adds a tile to both pans, until a pan is full', () => {
    const r = applyMove(start, add('-1', 2))
    expect(r.ok && equationText(r.pans)).toBe('3x + 2 − 2 = x + 8 − 2')
    expect(applyMove(start, add('1', PAN_UNITS - 8 + 1))).toEqual({ ok: false, refused: 'The right pan has no room for more unit tiles: take tiles away or remove zero pairs first.' })
    expect(applyMove(start, add('-x', PAN_X - 2))).toMatchObject({ ok: false, refused: expect.stringMatching(/^The left pan has no room for more x tiles/) })
  })

  it('removes zero pairs on each pan, and says what one is when there are none', () => {
    const paired: Pans = { left: { 'x': 2, '-x': 1, '1': 3, '-1': 1 }, right: { 'x': 0, '-x': 0, '1': 5, '-1': 2 } }
    const r = applyMove(paired, { op: 'zero' })
    expect(r.ok && equationText(r.pans)).toBe('x + 2 = 3')
    expect(applyMove(start, { op: 'zero' })).toMatchObject({ ok: false, refused: expect.stringMatching(/^There are no zero pairs to remove: a zero pair is a 1 tile with a −1 tile/) })
  })

  it('shares both pans into equal groups only when every kind of tile shares out', () => {
    const two: Pans = { left: { 'x': 2, '-x': 0, '1': 0, '-1': 0 }, right: { 'x': 0, '-x': 0, '1': 6, '-1': 0 } }
    const r = applyMove(two, { op: 'share', n: 2 })
    expect(r.ok && equationText(r.pans)).toBe('x = 3')
    expect(applyMove(two, { op: 'share', n: 3 })).toEqual({ ok: false, refused: 'The left pan\'s 2 x tiles cannot be shared into 3 equal groups.' })
    const paired: Pans = { left: { 'x': 2, '-x': 0, '1': 1, '-1': 1 }, right: { 'x': 0, '-x': 0, '1': 6, '-1': 0 } }
    expect(applyMove(paired, { op: 'share', n: 2 })).toEqual({ ok: false, refused: 'The left pan\'s 1 unit tile cannot be shared into 2 equal groups. Remove the zero pairs first.' })
    expect(applyMove(two, { op: 'share', n: 1 }).ok).toBe(false)
  })

  it('joins a repeated tap into one step, and undoes a tile at a time', () => {
    const one = withMove(MAIN, { moves: [] }, take('1'))
    expect(one.ok).toBe(true)
    const two = withMove(MAIN, (one as { state: AlgebraTilesState }).state, take('1'))
    expect(two.ok && two.state).toEqual({ moves: [take('1', 2)] })
    expect(two.ok && equationText(two.pans)).toBe('3x = x + 6')
    expect(moveText(take('1', 2))).toBe('Take 2 from both sides')
    expect(undoMove({ moves: [take('1', 2)] })).toEqual({ moves: [take('1')] })
    expect(undoMove({ moves: [take('1')] })).toEqual({ moves: [] })
    expect(undoMove({ moves: [] })).toEqual({ moves: [] })
    expect(withMove(MAIN, { moves: [] }, take('-x'))).toMatchObject({ ok: false })
  })

  it('says each move as a step of working', () => {
    expect(moveText(take('x'))).toBe('Take x from both sides')
    expect(moveText(add('-x', 2))).toBe('Add −2x to both sides')
    expect(moveText(add('-1', 3))).toBe('Add −3 to both sides')
    expect(moveText({ op: 'zero' })).toBe('Remove the zero pairs')
    expect(moveText({ op: 'share', n: 2 })).toBe('Share each side into 2 equal groups and keep one')
  })

  it('works out the pans from the moves, and stops at a move that cannot be made', () => {
    expect(equationText(replay(MAIN, moves(take('x'), take('1', 2))).pans)).toBe('2x = 6')
    const forged = replay(MAIN, moves(take('1', 9)))
    expect(forged.refused).toBe('Neither pan has 9 unit tiles to take away.')
    expect(replay(MAIN, { moves: [{ op: 'jump' }] }).refused).toBe('The working could not be read.')
    expect(replay(MAIN, {}).refused).toBeNull()
  })
})

describe('the algebra-tiles engine reads what the tutor writes', () => {
  it('reads an equation however it is reasonably written, and nothing it cannot draw', () => {
    const want = { task: { kind: 'solve', left: { x: 3, units: 2 }, right: { x: 1, units: 8 } } }
    expect(engine.parse(want)).toEqual(want)
    expect(engine.parse({ task: { kind: 'Solve equation', left: '3x + 2', right: 'x + 8' } })).toEqual(want)
    expect(engine.parse({ task: { equation: '3x + 2 = x + 8' } })).toEqual(want)
    expect(engine.parse({ task: { kind: 'solve_for_x', lhs: { coefficient: '3', constant: 2 }, rhs: { x: 1, units: '8' } } })).toEqual(want)
    expect(engine.parse({ task: { kind: 'solve', left: { x: 2 }, right: 6 } })).toEqual({ task: { kind: 'solve', left: { x: 2, units: 0 }, right: { x: 0, units: 6 } } })
    expect(engine.parse({ task: { kind: 'solve', left: { x: -2, units: '−3' }, right: '7 − 3x' } })).toEqual({ task: { kind: 'solve', left: { x: -2, units: -3 }, right: { x: -3, units: 7 } } })
  })

  it('reads the ordinary equations writers ask for, units up to 20', () => {
    expect(engine.parse({ task: { equation: '2x + 3 = 11' } })).toEqual({ task: { kind: 'solve', left: { x: 2, units: 3 }, right: { x: 0, units: 11 } } })
    expect(engine.faults(engine.parse({ task: { equation: '2x + 3 = 11' } })!)).toEqual([])
    // Twenty a side, and units thirty apart: the most the working can hold.
    expect(engine.faults(cfg([4, -20], [2, 10]))).toEqual([])
    expect(engine.faults(cfg([5, 20], [0, -5]))).toEqual([])
    expect(engine.faults(cfg([3, -20], [-1, 20]))[0]).toMatch(/comes to 4x = 40 before x is found: 40 unit tiles is more than a pan holds \(30\)/)
  })

  it('reads numbers the tiles cannot show, so that faults can say why, and returns null only for what it cannot read', () => {
    expect(engine.parse({ task: { kind: 'solve', left: { x: 2, units: 3 }, right: { x: 0, units: 25 } } })).toEqual(cfg([2, 3], [0, 25]))
    expect(engine.parse({ task: { equation: '6x + 2 = x + 12' } })).toEqual(cfg([6, 2], [1, 12]))
    expect(engine.parse({ task: { left: { x: '1.5', units: 2 }, right: '0.5x + 3' } })).toEqual(cfg([1.5, 2], [0.5, 3]))
    for (const bad of [
      { task: { kind: 'solve', left: { x: 'three', units: 2 }, right: { x: 1, units: 8 } } },
      { task: { kind: 'solve', left: { x: Infinity, units: 2 }, right: { x: 1, units: 8 } } },
      { task: { kind: 'solve', left: { x: 3, units: 2 } } },
      { task: { kind: 'solve', left: {}, right: { x: 1, units: 8 } } },
      { task: { kind: 'expand', left: { x: 3, units: 2 }, right: { x: 1, units: 8 } } },
      { task: { kind: 'check', left: { x: 3, units: 2 }, right: { x: 1, units: 8 } } },
      { task: { equation: '3x + 2 = x + 8 = 9' } },
      { task: { equation: 'x^2 = 4' } },
      { task: { kind: 'solve', left: 'x/2', right: '4' } },
      { task: 'solve 3x + 2 = x + 8' },
      null,
    ]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
  })

  it('says why, in words a writer can act on, when x cancels, is a fraction, is 0 or is already found', () => {
    expect(engine.faults(cfg([2, 3], [2, 5]))[0]).toMatch(/^In 2x \+ 3 = 2x \+ 5 x cancels out: both sides have 2x, so taking them away leaves two sides that can never balance\. Give the two sides different numbers of x, e\.g\. /)
    expect(engine.faults(cfg([0, 3], [0, 3]))[0]).toMatch(/has no x in it.*Put x tiles on at least one side/)
    expect(engine.faults(cfg([3, 1], [1, 6]))).toEqual(['3x + 1 = x + 6 comes to 2x = 5, so x would be 5/2, and tiles cannot be cut into parts. Choose numbers that make x a whole number, e.g. 3x + 1 = x + 7.'])
    expect(engine.faults(cfg([3, 2], [1, 2]))[0]).toMatch(/gives x = 0, which leaves one pan empty.*Choose numbers that make x a whole number other than 0, e\.g\. 3x \+ 2 = x \+ 4/)
    expect(engine.faults(cfg([1, 0], [0, 5]))).toEqual(['x = 5 is already solved: x is alone on one side, so there is nothing to do. Put more on the x side, e.g. x + 2 = 7.'])
    expect(engine.faults(cfg([0, -4], [1, 0]))).toEqual(['−4 = x is already solved: x is alone on one side, so there is nothing to do. Put more on the x side, e.g. −2 = x + 2.'])
    expect(engine.faults(MAIN)).toEqual([])
  })

  it('says when a number is more than the tiles can show, and what to write instead', () => {
    expect(engine.faults(cfg([2, 3], [0, 25]))).toEqual(['25 unit tiles is more than a pan holds (20): use smaller numbers, e.g. 2x + 3 = 19.'])
    expect(engine.faults(cfg([2, -21], [0, 3]))).toEqual(['21 unit tiles is more than a pan holds (20): use smaller numbers, e.g. 2x − 20 = 4.'])
    expect(engine.faults(cfg([6, 2], [1, 12]))).toEqual(['6 x tiles is more than a pan starts with (5): use smaller numbers, e.g. 5x + 2 = 12.'])
    // x cancels and the units match once brought into range: both must change.
    expect(engine.faults(cfg([-7, -25], [-7, -25]))[0]).toMatch(/^25 unit tiles is more than a pan holds \(20\): use smaller numbers, e\.g\. −5x − 20 = −4x − 19\.$/)
    expect(engine.faults(cfg([1.5, 2], [0.5, 3]))).toEqual(['The left side\'s 1.5 x tiles is not a whole number, and tiles come whole: use whole numbers, e.g. 2x + 2 = x + 3.'])
  })

  it('says when the working would need more unit tiles than a pan holds', () => {
    // 2x − 18 = 20 comes to 2x = 38: thirty-eight unit tiles on one pan before x can be shared out.
    expect(engine.faults(cfg([2, -18], [0, 20]))).toEqual(['2x − 18 = 20 comes to 2x = 38 before x is found: 38 unit tiles is more than a pan holds (30). Use smaller numbers, e.g. 2x − 18 = 12.'])
    expect(engine.faults(cfg([0, 20], [3, -16]))[0]).toMatch(/^20 = 3x − 16 comes to 3x = 36 before x is found/)
    // Thirty fits: 2x + 20 = −10 is worked in two lots of ten (−1) tiles.
    expect(engine.faults(cfg([2, 20], [0, -10]))).toEqual([])
    expect(solveMoves(cfg([2, 20], [0, -10])).map(moveText)).toEqual([
      'Add −10 to both sides', 'Remove the zero pairs', 'Add −10 to both sides', 'Remove the zero pairs', 'Share each side into 2 equal groups and keep one',
    ])
  })

  it('suggests only equations it would accept', () => {
    for (const c of [cfg([2, 3], [0, 25]), cfg([2, -21], [0, 3]), cfg([6, 2], [1, 12]), cfg([1.5, 2], [0.5, 3]), cfg([2, -18], [0, 20]), cfg([3, 1], [1, 6]), cfg([2, 3], [2, 5]), cfg([9, 40], [-9, -40])]) {
      const said = engine.faults(c)[0]
      const eg = /e\.g\. (.+)\.$/.exec(said)?.[1]
      expect(eg, said).toBeTruthy()
      const back = engine.parse({ task: { equation: eg } })!
      expect(engine.faults(back), eg).toEqual([])
    }
  })
})

// 203,401 configs, each faulted or solved and replayed: room for a loaded full-suite run.
describe('every config the tutor can write', { timeout: 60_000 }, () => {
  it('starts unsolved and can be solved by legal moves, within the pans, or is refused with a reason', () => {
    let valid = 0
    let total = 0
    for (const c of everyConfig()) {
      total++
      // Plain checks, not expect(), in the loop: two hundred thousand deep-equals would be most of the run.
      const back = engine.parse(c)
      const { left: L, right: R } = c.task
      const label = `${L.x}x + ${L.units} = ${R.x}x + ${R.units}`
      if (!back || back.task.left.x !== L.x || back.task.left.units !== L.units || back.task.right.x !== R.x || back.task.right.units !== R.units) throw new Error(`${label} does not parse back`)
      const x = solution(c)
      const faults = engine.faults(c)
      // Honest: x a whole number other than 0, not already found, and working that fits the pans.
      const honest = x !== null && x !== 0 && foundValue(startPans(c)) === null && Math.abs(c.task.right.units - c.task.left.units) <= PAN_UNITS
      if (faults.length === 0 !== honest) throw new Error(`${label}: faults ${JSON.stringify(faults)}`)
      for (const f of faults) if (!/\b(Choose|Give|Put|Use)\b/i.test(f)) throw new Error(`${label}: a fault with nothing to do: ${f}`)
      if (!honest) continue
      valid++
      if (engine.check(c, engine.initial(c)).ok) throw new Error(`${label} starts solved`)
      const solved = engine.solve(c)
      if (!engine.check(c, solved).ok) throw new Error(`${label} cannot be solved`)
      // Every step of the engine's solution is a legal move that fits the pans and keeps x the same.
      const r = replay(c, solved)
      if (r.refused || r.steps.length !== solved.moves.length) throw new Error(`${label}: ${r.refused}`)
      for (const s of r.steps) {
        for (const p of [s.pans.left, s.pans.right]) {
          if (xTiles(p) > PAN_X || unitTiles(p) > PAN_UNITS || TILES.some((t) => p[t] < 0)) throw new Error(`${label}: ${equationText(s.pans)} overflows`)
        }
        const [l, rr] = valueAt(s.pans, x!)
        if (l !== rr) throw new Error(`${label}: ${equationText(s.pans)} is not true at x = ${x}`)
      }
      if (foundValue(r.pans) !== x) throw new Error(`${label}: ends at ${equationText(r.pans)}`)
    }
    expect(total).toBe(41 * 41 * 11 * 11)
    // About one in three: the rest have no whole-number x, or x = 0, or need more than thirty tiles on a pan.
    expect(valid).toBe(65_652)
  })

  it('refuses every number out of range, saying which, with an equation it would accept instead', () => {
    let out = 0
    for (let a = -7; a <= 7; a++) {
      for (let c = -7; c <= 7; c++) {
        for (const b of [-25, -21, -20, -3, 0, 3, 20, 21, 25]) {
          for (const d of [-25, -21, -20, -3, 0, 3, 20, 21, 25]) {
            const conf = cfg([a, b], [c, d])
            if ([a, c].every((v) => Math.abs(v) <= MAX_X) && [b, d].every((v) => Math.abs(v) <= MAX_UNITS)) continue
            out++
            const said = engine.faults(conf)
            if (said.length !== 1 || !/^\d+ (unit|x) tiles is more than a pan (holds|starts with) \(\d+\): use smaller numbers, e\.g\. /.test(said[0])) throw new Error(`${equationText(startPans(conf))}: ${said}`)
            const eg = /e\.g\. (.+)\.$/.exec(said[0])![1]
            if (engine.faults(engine.parse({ task: { equation: eg } })!).length) throw new Error(`${said[0]}: the suggestion is refused`)
          }
        }
      }
    }
    expect(out).toBeGreaterThan(10_000)
  })

  it('no legal move ever changes x: random play from 300 equations', () => {
    // mulberry32: a seeded generator, so a failure can be replayed.
    let seed = 7
    const rand = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
    const honest = [...everyConfig()].filter((c) => engine.faults(c).length === 0)
    let made = 0
    let refused = 0
    for (let k = 0; k < 300; k++) {
      const c = honest[rand(honest.length)]
      const x = solution(c)!
      let state: AlgebraTilesState = { moves: [] }
      for (let step = 0; step < 30; step++) {
        const pick = rand(4)
        const move: Move = pick === 0 ? { op: 'zero' } : pick === 1 ? { op: 'share', n: 2 + rand(4) } : { op: rand(2) ? 'add' : 'take', tile: TILES[rand(4)], n: 1 }
        const next = withMove(c, state, move)
        if (!next.ok) {
          refused++
          expect(next.refused.length).toBeGreaterThan(10)
          continue
        }
        made++
        state = next.state
        const [l, r] = valueAt(next.pans, x)
        if (l !== r) throw new Error(`${equationText(startPans(c))}: ${moveText(move)} made ${equationText(next.pans)}`)
        for (const p of [next.pans.left, next.pans.right]) expect(xTiles(p) <= PAN_X && unitTiles(p) <= PAN_UNITS).toBe(true)
        // Marked right exactly when x stands alone with its value opposite.
        expect(engine.check(c, state).ok).toBe(foundValue(next.pans) === x)
      }
    }
    expect(made).toBeGreaterThan(1000)
    expect(refused).toBeGreaterThan(100)
  })
})

describe('marking the learner’s working', () => {
  it('is right only with one x tile alone and unit tiles of one sign opposite, on either side', () => {
    expect(engine.check(MAIN, moves(take('x'), take('1', 2), { op: 'share', n: 2 })).ok).toBe(true)
    // x + 8 = 3x + 2, solved to 3 = x.
    const flipped = cfg([1, 8], [3, 2])
    expect(engine.check(flipped, moves(take('x'), take('1', 2), { op: 'share', n: 2 })).ok).toBe(true)
    expect(engine.check(MAIN, moves(take('x'), take('1', 2))).ok).toBe(false)
    // x + 1 − 1 = 4 + ...: a zero pair left is not yet x alone.
    expect(engine.check(cfg([1, 2], [0, 5]), moves(add('-1', 2))).ok).toBe(false)
    expect(engine.check(cfg([1, 2], [0, 5]), moves(add('-1', 2), { op: 'zero' })).ok).toBe(true)
    // A forged working is never right.
    expect(engine.check(MAIN, { moves: [take('x'), take('1', 2), { op: 'share', n: 2 }, { op: 'zero' }] }).ok).toBe(false)
    expect(engine.check(MAIN, { moves: 'solved' } as never).ok).toBe(false)
  })

  it('says what the learner has and what is left, never what x is', () => {
    expect(progress(MAIN, moves())).toBe('You have 3x + 2 = x + 8: there are x tiles on both sides.')
    expect(progress(MAIN, moves(take('x')))).toBe('You have 2x + 2 = 8: there are still unit tiles beside the x tiles.')
    expect(progress(MAIN, moves(take('x'), take('1', 2)))).toBe('You have 2x = 6: one more step.')
    expect(progress(MAIN, moves(take('x'), add('-1', 2)))).toBe('You have 2x + 2 − 2 = 8 − 2: there are zero pairs still to remove.')
    expect(progress(cfg([1, 2], [2, -2]), moves(take('x')))).toBe('You have 2 = x − 2: there are still unit tiles beside the x tiles.')
    // −x = 4 (x = −4) and −2x = 6 (x = −3).
    expect(progress(cfg([-1, 0], [0, 4]), moves())).toBe('You have −x = 4: the x tile is negative, so this tells you −x, not x.')
    expect(progress(cfg([-2, 1], [0, 7]), moves(take('1')))).toBe('You have −2x = 6: the x tiles are negative.')
    for (const c of [MAIN, FOUR]) {
      const x = solution(c)!
      for (const st of [moves(), moves(take('x'))]) expect(progress(c, st)).not.toMatch(new RegExp(`x = ${x}\\b`))
    }
  })

  it('once right, puts x back into the first equation so both sides are seen to agree', () => {
    expect(rightText(MAIN)).toBe('x = 3. Put it back in: the left side is 3 × 3 + 2 = 11, and the right side is 3 + 8 = 11.')
    expect(rightText(cfg([2, -3], [-3, 7]))).toBe('x = 2. Put it back in: the left side is 2 × 2 − 3 = 1, and the right side is −3 × 2 + 7 = 1.')
    expect(rightText(cfg([1, 7], [0, 2]))).toBe('x = −5. Put it back in: the left side is (−5) + 7 = 2, and the right side is 2.')
    expect(rightText(cfg([-1, 8], [1, 2]))).toBe('x = 3. Put it back in: the left side is −3 + 8 = 5, and the right side is 3 + 2 = 5.')
  })

  it('solves the way a learner would: x off one side, units off the other, then share', () => {
    expect(solveMoves(MAIN).map(moveText)).toEqual(['Take x from both sides', 'Take 2 from both sides', 'Share each side into 2 equal groups and keep one'])
    expect(solveMoves(cfg([2, -3], [-3, 7])).map(moveText)).toEqual([
      'Add 3x to both sides', 'Remove the zero pairs', 'Add 3 to both sides', 'Remove the zero pairs', 'Share each side into 5 equal groups and keep one',
    ])
  })
})

describe('the drawing', () => {
  it('lays every tile on its pan, clear of the "=" between the pans and of each other', () => {
    // The left pan is centred at 90, the "=" at 180 (about 14 wide), the right pan at 270.
    // Up to thirty unit tiles a pan: four rows at most once positive and negative rows are kept apart.
    for (const p of [panOf({ x: 5, units: 20 }), { 'x': 5, '-x': 5, '1': 20, '-1': 10 }, { 'x': 0, '-x': 0, '1': 1, '-1': 29 }, { 'x': 10, '-x': 0, '1': 11, '-1': 19 }, { 'x': 3, '-x': 7, '1': 21, '-1': 9 }]) {
      const placed = layoutPan(p, 90)
      expect(placed).toHaveLength(TILES.reduce((s, t) => s + p[t], 0))
      for (const t of placed) {
        expect(t.x).toBeGreaterThanOrEqual(6)
        expect(t.x + 13).toBeLessThanOrEqual(170)
        expect(t.y).toBeGreaterThanOrEqual(8)
        expect(t.y + (t.tile === 'x' || t.tile === '-x' ? 36 : 13)).toBeLessThanOrEqual(110)
      }
      const boxes = placed.map((t) => ({ ...t, h: t.tile === 'x' || t.tile === '-x' ? 36 : 13 }))
      for (const a of boxes) for (const b of boxes) {
        if (a === b) continue
        const apart = a.x + 13 <= b.x || b.x + 13 <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
        if (!apart) throw new Error(`${JSON.stringify(p)}: ${a.key} overlaps ${b.key}`)
      }
    }
  })

  it('draws a pan no fuller than it holds, whatever it is given', () => {
    expect(layoutPan({ 'x': 1e9, '-x': 4, '1': 1e9, '-1': 7 }, 90)).toHaveLength(10 + 30)
    expect(layoutPan({ 'x': 1.5, '-x': -2, '1': 2.5, '-1': 0 }, 90)).toHaveLength(1 + 2)
  })
})

describe('the algebra-tiles scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'algebra-tiles', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: AlgebraTilesConfig, state: AlgebraTilesState, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(AlgebraTilesView, { config: c, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))

  it('is a valid activity, drawn as a level balance with the equation beneath and every move a button', () => {
    expect(validateSpec({ pattern: 'scene', prompt: 'Solve it.', payload: { engine: 'algebra-tiles', config: FOUR }, success: { kind: 'scene' } })).toBe(true)
    const html = card(FOUR, 'Solve 5x + 2 = 3x + 10 on the balance.')
    expect(html).toContain('role="img"')
    expect(html).toContain('A level balance. Left pan: 5 x tiles and 2 unit tiles. Right pan: 3 x tiles and 10 unit tiles.')
    expect(html).toContain('5x + 2 = 3x + 10')
    for (const t of ['an x tile', 'a unit tile', 'a −x tile', 'a −1 tile']) {
      expect(html).toContain(`aria-label="Take ${t} from both sides"`)
      expect(html).toContain(`aria-label="Add ${t} to both sides"`)
    }
    expect(html).toMatch(/<select[^>]*id="[^"]*-groups"/)
    expect(html).toContain('Remove zero pairs')
    expect(html).toContain('Your working')
  })

  it('shows no value of x before it is marked, even to a screen reader', () => {
    const prompt = 'Solve 5x + 2 = 3x + 10 on the balance.'
    const shown = card(FOUR, prompt).replace(prompt, '')
    expect(shown).not.toMatch(/x\s*=\s*4\b|=\s*x\b|\b4\s*=\s*x|x is 4|four/i)
    expect(shown).not.toMatch(/Put it back in|You have/)
    // Midway too: the working shows the learner's own equations, never the value they are heading for.
    const midway = view(FOUR, moves(take('x', 3), take('1', 2)), 'idle')
    expect(midway).toContain('2x = 8')
    expect(midway).not.toMatch(/x = 4|Put it back in/)
  })

  it('writes the equation after every move', () => {
    const html = view(MAIN, moves(take('x'), take('1', 2)), 'idle')
    expect(html).toContain('Take x from both sides')
    expect(html).toContain('2x + 2 = 8')
    expect(html).toContain('Take 2 from both sides')
    expect(html).toContain('2x = 6')
  })

  it('once marked, says what the learner has when wrong and puts x back in when right', () => {
    const wrong = view(MAIN, moves(take('x'), take('1', 2)), 'wrong')
    expect(wrong).toContain('You have 2x = 6: one more step.')
    expect(wrong).not.toMatch(/x = 3/)
    const right = view(MAIN, engine.solve(MAIN), 'right')
    expect(right).toContain('x = 3. Put it back in: the left side is 3 × 3 + 2 = 11, and the right side is 3 + 8 = 11.')
    expect(view(MAIN, engine.solve(MAIN), 'shown')).toContain('x = 3. Put it back in')
  })

  it('takes the controls away once solved, and keeps the working', () => {
    const html = view(MAIN, engine.solve(MAIN), 'right')
    expect(html).not.toContain('Remove zero pairs')
    expect(html).not.toMatch(/<button/)
    expect(html).toContain('Share each side into 2 equal groups and keep one')
  })

  it('is refused by the meaning gates when its equation has no whole-number x', () => {
    const action = (config: unknown, prompt = 'Solve the equation on the balance.') =>
      ({ type: 'createActivity', id: 'm1', spec: { pattern: 'scene', prompt, payload: { engine: 'algebra-tiles', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(cfg([3, 1], [1, 6]))).join(' ')).toMatch(/x would be 5\/2/)
    expect(meaningFaults(action(MAIN, 'Solve 3x + 2 = x + 8. (x = 3)')).join(' ')).toMatch(/gives the answer away/)
    expect(meaningFaults(action(MAIN, 'Solve 3x + 2 = x + 8 on the balance.'))).toEqual([])
  })
})

describe('the prompt an algebra-tiles card is written with', () => {
  const faults = (c: AlgebraTilesConfig, prompt: string) => getEngine('algebra-tiles')!.promptFaults!(c, prompt)

  it('may not say what x is', () => {
    for (const p of [
      'Solve 3x + 2 = x + 8 to show x = 3.',
      'Solve 3x + 2 = x + 8 (x=3).',
      'Show that x is 3 in 3x + 2 = x + 8.',
      'Solve 3x + 2 = x + 8: x equals three.',
      'Solve 3x + 2 = x + 8. The answer is 3.',
      'Solve 3x + 2 = x + 8; the solution: +3',
      'X = 3. Now solve 3x + 2 = x + 8.',
    ]) expect(faults(MAIN, p).join(' '), p).toMatch(/^the prompt gives the answer away: it says what x is .*Solve 3x \+ 2 = x \+ 8 on the balance/)
    const minus = cfg([1, 7], [0, 2])
    expect(faults(minus, 'Solve x + 7 = 2, and find x = −5.').length).toBe(1)
    expect(faults(minus, 'Solve x + 7 = 2: x is minus five.').length).toBe(1)
  })

  it('writes the equation, however it is set out, without being read as an answer', () => {
    for (const [c, p] of [
      [MAIN, 'Solve 3x + 2 = x + 8 on the balance.'],
      [MAIN, 'Find x: 3x + 2 = x + 8.'],
      [cfg([1, 2], [2, -1]), 'Solve x + 2 = 2x - 1.'],
      // 6 + x = 3 + 2x has x = 3, and "x = 3" sits inside it.
      [cfg([1, 6], [2, 3]), 'Solve 6 + x = 3 + 2x.'],
      [cfg([1, 0], [2, -3]), 'Solve x = 2x − 3.'],
      [cfg([2, 0], [1, 3]), 'Solve 2x = x + 3.'],
      [cfg([1, 7], [0, 2]), 'Solve x + 7 = 2. Is x positive or negative?'],
      [MAIN, 'What is x? Solve 3x + 2 = x + 8 and keep the pans level.'],
    ] as [AlgebraTilesConfig, string][]) expect(faults(c, p), p).toEqual([])
    // A different value is not this equation's answer, so not a give-away.
    expect(faults(MAIN, 'Solve 3x + 2 = x + 8. Is x = 4?')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('algebra-tiles')!
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
    expect(found.length).toBeGreaterThanOrEqual(2)
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
    }
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and an example in orbit’s format', () => {
    expect(getEngine('algebra-tiles')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/^SCENE "algebra-tiles"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"algebra-tiles"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:algebra-tiles"/)
    expect(engine.prompt).toMatch(/"isolates":"structure"/)
    expect(engine.prompt).toMatch(/"kind":"solve"/)
  })
})
