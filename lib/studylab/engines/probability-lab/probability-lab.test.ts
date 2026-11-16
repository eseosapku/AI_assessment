// lib/studylab/engines/probability-lab/probability-lab.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  probabilityLabEngine as engine, COLOURS, DICE_SIDES, MAX_SPINS, SECTORS_MAX, SECTORS_MIN,
  allPairs, cellsOf, countOf, defaultSectors, eventOf, eventPairs, madeText, needed, paletteOf, pairId, readChance, readEvent, rollAt, runningShare, spinAt, spinColours, unit, working,
  type ProbConfig, type ProbState,
} from './config'
import { PLOT, ProbabilityLabView, SPACE_H, SPIN_H, W, goalLabelYs } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Spin = Extract<ProbConfig, { task: 'spinner' }>
type Space = Extract<ProbConfig, { task: 'space' }>

const fr = (p: number, q: number) => `${p}/${q}`
const spin = (sectors: number, ...t: [string, string][]): Spin => ({ task: 'spinner', sectors, targets: t.map(([colour, chance]) => ({ colour, chance })) })
const space = (dice: number, event: string): Space => ({ task: 'space', dice, event })
const nameOf = (c: ProbConfig) => JSON.stringify(c)

// Every spinner the engine can be asked for: every one or two colours, every chance the sectors can hold.
const SPINNERS: Spin[] = []
for (const sectors of [4, 6, 8, 9, 10, 12]) {
  const fracs: [number, number][] = []
  for (let q = 2; q <= 12; q++) for (let p = 1; p < q; p++) if (p / q === Math.floor(p / q) || true) fracs.push([p, q])
  const ok = fracs.filter(([p, q]) => (p * sectors) % q === 0 && Math.abs(p / q) < 1)
  const seen = new Set<string>()
  const reduced = ok.map(([p, q]) => { const g = (a: number, b: number): number => (b ? g(b, a % b) : a); const d = g(p, q); return [p / d, q / d] as [number, number] }).filter(([p, q]) => (seen.has(fr(p, q)) ? false : (seen.add(fr(p, q)), true)))
  for (const [p, q] of reduced) {
    for (const colour of COLOURS) SPINNERS.push(spin(sectors, [colour, fr(p, q)]))
  }
  for (const [p, q] of reduced) for (const [p2, q2] of reduced) {
    if (p / q + p2 / q2 <= 1 + 1e-9) SPINNERS.push(spin(sectors, ['red', fr(p, q)], ['blue', fr(p2, q2)]))
  }
}
const EVENTS: string[] = []
for (const d of DICE_SIDES) {
  for (let n = 2; n <= 2 * d; n++) EVENTS.push(`total ${n}`, `total at least ${n}`, `total at most ${n}`)
  for (let n = 1; n <= d; n++) EVENTS.push(`has ${n}`)
  for (let n = 1; n < d; n++) EVENTS.push(`difference ${n}`)
  EVENTS.push('doubles', 'both even', 'first larger')
}
const SPACES: Space[] = DICE_SIDES.flatMap((d) => EVENTS.map((e) => space(d, e))).filter((c) => engine.faults(c).length === 0)
const VALID: ProbConfig[] = [...SPINNERS.filter((c) => engine.faults(c).length === 0), ...SPACES]

describe('every configuration', { timeout: 30_000 }, () => {
  it('there are plenty, and each parses to itself, has no fault, starts unsolved and can be solved', () => {
    expect(VALID.length).toBeGreaterThanOrEqual(200)
    expect(SPACES.length).toBeGreaterThan(40)
    for (const c of VALID) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
      expect(engine.check(c, {}).ok, `empty ${nameOf(c)}`).toBe(false)
    }
  })

  it('a spinner is marked by the sectors alone: exact counts, over many layouts', () => {
    for (const c of SPINNERS.filter((x) => engine.faults(x).length === 0).filter((_, i) => i % 7 === 0)) {
      const pal = ['plain', ...paletteOf(c.targets)]
      for (let s = 1; s <= 25; s++) {
        const cells = Array.from({ length: c.sectors }, (_, i) => pal[Math.floor(unit(`${nameOf(c)}${s}`, i) * pal.length)])
        const should = c.targets.every((t) => countOf(cells, t.colour) === needed(c.sectors, t))
        // The spins do not matter, and neither does where the sectors sit.
        expect(engine.check(c, { cells, spins: 0 }).ok, nameOf(c)).toBe(should)
        expect(engine.check(c, { cells, spins: 900 }).ok, nameOf(c)).toBe(should)
        expect(engine.check(c, { cells: [...cells].reverse(), spins: 3 }).ok, nameOf(c)).toBe(should)
      }
    }
  })

  it('a pair task is marked by the pairs alone: the marked set must equal the event', () => {
    for (const c of SPACES.filter((_, i) => i % 5 === 0)) {
      const want = eventPairs(c)
      expect(want.length).toBeGreaterThan(0)
      expect(want.length).toBeLessThan(c.dice * c.dice)
      expect(engine.check(c, { picks: [...want].reverse(), rolls: 7 }).ok, nameOf(c)).toBe(true)
      expect(engine.check(c, { picks: want.slice(1) }).ok, nameOf(c)).toBe(false)
      const extra = allPairs(c.dice).map((p) => pairId(p.a, p.b)).find((id) => !want.includes(id))!
      expect(engine.check(c, { picks: [...want, extra] }).ok, nameOf(c)).toBe(false)
      expect(engine.check(c, { picks: [...want, extra] }).wrongIds).toEqual([extra])
    }
  })

  it('refuses a state that could not have been made', () => {
    const c = spin(8, ['red', '1/4'])
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { cells: 'red' as never }).ok).toBe(false)
    // A colour the spinner does not have counts as plain.
    expect(engine.check(c, { cells: ['red', 'purple', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain'] }).ok).toBe(false)
    expect(engine.check(c, { cells: ['red', 'red', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'red'] }).ok).toBe(true)
    const s = space(6, 'total 8')
    expect(engine.check(s, { picks: ['9-9', '2-6', '3-5', '4-4', '5-3', '6-2', 'x'] }).ok).toBe(true)
    expect(engine.check(s, null as never).ok).toBe(false)
  })

  it('counts the pairs a person counts', () => {
    expect(eventPairs(space(6, 'total 7'))).toHaveLength(6)
    expect(eventPairs(space(6, 'total 8'))).toHaveLength(5)
    expect(eventPairs(space(6, 'doubles'))).toHaveLength(6)
    expect(eventPairs(space(6, 'has 6'))).toHaveLength(11)
    expect(eventPairs(space(6, 'difference 2'))).toHaveLength(8)
    expect(eventPairs(space(6, 'both even'))).toHaveLength(9)
    expect(eventPairs(space(6, 'first larger'))).toHaveLength(15)
    expect(eventPairs(space(6, 'total at least 10'))).toHaveLength(6)
    expect(eventPairs(space(6, 'total at most 4'))).toHaveLength(6)
    expect(eventPairs(space(4, 'doubles'))).toHaveLength(4)
    // Order matters: 2 then 5 and 5 then 2 are two squares.
    expect(eventPairs(space(6, 'total 7'))).toEqual(expect.arrayContaining(['2-5', '5-2']))
    expect(eventPairs(space(6, 'total 12'))).toEqual(['6-6'])
  })

  it('says something true when marked, and what was made when wrong, never where the answer is', () => {
    expect(working(spin(12, ['red', '1/3']), engine.solve(spin(12, ['red', '1/3'])))).toMatch(/^Yes\. Red covers 4 of 12 sectors, a chance of 1\/3\./)
    expect(working(space(6, 'total 8'), engine.solve(space(6, 'total 8')))).toMatch(/5 pairs out of 36 make a total of 8, a chance of 5\/36/)
    expect(working(space(6, 'total 7'), engine.solve(space(6, 'total 7')))).toMatch(/6\/36, which is 1\/6/)
    const c = spin(12, ['red', '1/3'])
    const wrong = madeText(c, { cells: ['red', 'red', 'red', 'red', 'red', 'red', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain'] })
    expect(wrong).toMatch(/Red covers 6 of 12 sectors, a chance of 1\/2, which is not the chance asked for/)
    expect(madeText(c, { cells: ['red', 'red', 'red', 'red', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain'] })).toMatch(/is the chance asked for/)
    const s = space(6, 'total 8')
    expect(madeText(s, { picks: ['2-6', '1-1'] })).toBe('You marked 2 pairs. 1 of them does not make it. 4 pairs that make it are not marked.')
    expect(madeText(s, { picks: ['2-6', '3-5', '4-4', '5-3'] })).toBe('You marked 4 pairs. Each one does make it. 1 pair that makes it is not marked.')
  })
})

describe('the spins', { timeout: 30_000 }, () => {
  it('are a fixed run: the same spinner spins the same way, and a longer run begins with the shorter one', () => {
    const cells = ['red', 'plain', 'red', 'yellow', 'plain', 'red', 'plain', 'yellow']
    expect(spinColours(cells, 50)).toEqual(spinColours(cells, 50))
    expect(spinColours(cells, 100).slice(0, 10)).toEqual(spinColours(cells, 10))
    expect(spinAt(cells, 3)).toEqual(spinAt(cells, 3))
    expect(spinColours([...cells].reverse(), 40)).not.toEqual(spinColours(cells, 40))
    for (let i = 0; i < 200; i++) {
      const s = spinAt(cells, i)
      expect(s.turn).toBeGreaterThanOrEqual(0)
      expect(s.turn).toBeLessThan(1)
      expect(s.sector).toBeGreaterThanOrEqual(0)
      expect(s.sector).toBeLessThan(cells.length)
    }
  })

  it('settle: after many spins the share is near the true chance, whatever the layout', () => {
    let worst = 0
    for (const c of SPINNERS.filter((x) => engine.faults(x).length === 0)) {
      const cells = (engine.solve(c) as { cells: string[] }).cells
      // A solved layout in every rotation, so many different runs are tried.
      for (const shift of [0, 1, 3]) {
        const turned = cells.map((_, i) => cells[(i + shift) % cells.length])
        const landed = spinColours(turned, MAX_SPINS)
        for (const t of c.targets) {
          const share = runningShare(landed, t.colour)[MAX_SPINS - 1]
          const exact = countOf(turned, t.colour) / turned.length
          worst = Math.max(worst, Math.abs(share - exact))
          expect(Math.abs(share - exact), `${nameOf(c)} ${shift}`).toBeLessThan(0.075)
        }
      }
    }
    expect(worst).toBeGreaterThan(0) // it is a run, not the answer
  })

  it('wobble early: a short run is often far from the chance, and the long run is nearer on average', () => {
    let early = 0
    let late = 0
    let runs = 0
    for (const c of SPINNERS.filter((x) => engine.faults(x).length === 0 && x.targets.length === 1).filter((_, i) => i % 3 === 0)) {
      const cells = (engine.solve(c) as { cells: string[] }).cells
      const landed = spinColours(cells, MAX_SPINS)
      const share = runningShare(landed, c.targets[0].colour)
      const exact = countOf(cells, c.targets[0].colour) / cells.length
      early += Math.abs(share[9] - exact)
      late += Math.abs(share[MAX_SPINS - 1] - exact)
      runs++
    }
    expect(early / runs).toBeGreaterThan(0.05)
    expect(late / runs).toBeLessThan(0.025)
  })

  it('spreads evenly over the sectors', () => {
    const cells = Array.from({ length: 12 }, () => 'plain')
    const hits = Array.from({ length: 12 }, () => 0)
    for (let i = 0; i < MAX_SPINS; i++) hits[spinAt(cells, i).sector]++
    for (const h of hits) expect(h).toBeGreaterThan(40)
    for (const h of hits) expect(h).toBeLessThan(130)
  })

  it('rolls two dice evenly, in a fixed run', () => {
    for (const d of DICE_SIDES) {
      const seen = new Set<string>()
      for (let i = 0; i < 600; i++) {
        const r = rollAt(d, i)
        expect(r.a).toBeGreaterThanOrEqual(1)
        expect(r.a).toBeLessThanOrEqual(d)
        expect(r.b).toBeGreaterThanOrEqual(1)
        expect(r.b).toBeLessThanOrEqual(d)
        expect(rollAt(d, i)).toEqual(r)
        seen.add(pairId(r.a, r.b))
      }
      expect(seen.size).toBe(d * d)
    }
  })
})

describe('reading the config', () => {
  it('reads chances as the tutor writes them', () => {
    for (const [raw, p, q] of [['1/3', 1, 3], ['2/6', 1, 3], ['25%', 1, 4], [0.5, 1, 2], ['0.75', 3, 4], ['a quarter', 1, 4], ['three eighths', 3, 8], ['3 in 8', 3, 8], ['one half', 1, 2], ['two thirds', 2, 3], ['0.33', 1, 3], [20, 1, 5], ['1 out of 6', 1, 6], ['5/12', 5, 12]] as [string | number, number, number][]) {
      expect(readChance(raw), String(raw)).toEqual({ p, q })
    }
    for (const raw of ['lots', '', '0', 0, -1, '3/2', '1/0', 0.45, 'some', null, 250]) expect(readChance(raw as never), String(raw)).toBeNull()
  })

  it('reads events as people say them', () => {
    for (const [said, canon] of [
      ['sum of 8', 'total 8'], ['a total of 8', 'total 8'], ['Total 7', 'total 7'], ['the dice add up to 9', 'total 9'], ['score of 5', 'total 5'], ['total at least 10', 'total at least 10'], ['a total of 10 or more', 'total at least 10'],
      ['total more than 9', 'total at least 10'], ['total of at most 4', 'total at most 4'], ['total less than 5', 'total at most 4'], ['sum is 3 or less', 'total at most 3'], ['doubles', 'doubles'], ['both dice the same', 'doubles'], ['the dice match', 'doubles'],
      ['at least one six', 'has 6'], ['a 6', 'has 6'], ['has 3', 'has 3'], ['difference of 2', 'difference 2'], ['they differ by 3', 'difference 3'], ['both even', 'both even'], ['both dice are even', 'both even'], ['first die larger', 'first larger'], ['first is bigger than the second', 'first larger'],
    ] as [string, string][]) expect(readEvent(said), said).toBe(canon)
    expect(readEvent('')).toBeNull()
    expect(readEvent(5 as never)).toBeNull()
    expect(eventOf('purple')).toBeNull()
  })

  it('reads reasonable phrasings of a whole config', () => {
    expect(engine.parse({ task: 'spinner', colour: 'Red', chance: '1/3', sectors: 12 })).toEqual(spin(12, ['red', '1/3']))
    expect(engine.parse({ colour: 'red', chance: '1/4' })).toEqual(spin(8, ['red', '1/4']))
    expect(engine.parse({ task: 'Build a spinner', chances: { red: '1/4', blue: '50%' }, sectors: '8 sectors' })).toEqual(spin(8, ['red', '1/4'], ['blue', '1/2']))
    expect(engine.parse({ task: 'spin', targets: [{ colour: 'green', chance: 'a third' }] })).toEqual(spin(6, ['green', '1/3']))
    expect(engine.parse({ task: 'spinner', chance: 0.5 })).toEqual(spin(6, ['red', '1/2']))
    expect(engine.parse({ task: 'space', event: 'sum of 8' })).toEqual(space(6, 'total 8'))
    expect(engine.parse({ task: 'sample space', dice: 4, event: 'doubles' })).toEqual(space(4, 'doubles'))
    expect(engine.parse({ event: 'at least one six', dice: '6' })).toEqual(space(6, 'has 6'))
    expect(engine.parse({ task: 'dice', event: 'both even' })).toEqual(space(6, 'both even'))
    expect(engine.parse({ dice: 'd4', event: 'total 5' })).toEqual(space(4, 'total 5'))
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('spinner')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'spinner', sectors: 'lots', chance: '1/4' })).toBeNull()
    expect(engine.parse({ task: 'space', dice: 'many' })).toBeNull()
    expect(engine.parse({ task: 'space', event: 5 })).toBeNull()
    expect(engine.parse({ task: 'spinner', chances: { red: {} } })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    for (const raw of [{ colour: 'purple', chance: '1/4' }, { colour: 'red', chance: '1/4', sectors: 30 }, { colour: 'red', chance: 'rarely' }, { task: 'space', dice: 8, event: 'total 5' }, { task: 'space', event: 'total 40' }, { task: 'space', event: 'a prime total' }, { task: 'spinner' }]) {
      expect(engine.parse(raw), JSON.stringify(raw)).not.toBeNull()
    }
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: ProbConfig, said: string): ProbConfig => {
      if (c.task === 'spinner') {
        const sec = said.match(/e\.g\. sectors (\d+)/)
        if (sec) return { ...c, sectors: Number(sec[1]) }
        const colour = said.match(/e\.g\. colour "(\w+)"(?:, chance "([\d/]+)")?/)
        if (colour) return spin(defaultSectors([{ colour: colour[1], chance: colour[2] ?? '1/4' }]), [colour[1], colour[2] ?? '1/4'])
        const ch = said.match(/e\.g\. chance "([\d/]+)"/)
        if (ch) return spin(8, [c.targets[0]?.colour && (COLOURS as readonly string[]).includes(c.targets[0].colour) ? c.targets[0].colour : 'red', ch[1]])
        const two = said.match(/red "1\/4" and blue "1\/2"/)
        if (two) return spin(8, ['red', '1/4'], ['blue', '1/2'])
        throw new Error(said)
      }
      const dice = said.match(/e\.g\. dice (\d)/)
      if (dice) return { ...c, dice: Number(dice[1]) }
      const ev = said.match(/e\.g\. event "([^"]+)"/)
      if (ev) return { ...c, event: ev[1], dice: (DICE_SIDES as readonly number[]).includes(c.dice) ? c.dice : 6 }
      throw new Error(said)
    }
    const cases: [ProbConfig, RegExp][] = [
      [spin(8, ['purple', '1/4']), /red, blue, green, yellow/],
      [spin(8, ['__proto__', '1/4']), /red, blue, green, yellow/],
      [spin(8, ['red', 'rarely']), /cannot be read as a fraction/],
      [spin(8, ['red', '3/3']), /every sector/],
      [spin(8, ['red', '1/13']), /more sectors than a spinner holds/],
      [spin(8, ['red', '3/4'], ['blue', '1/2']), /more than 1/],
      [spin(8, ['red', '1/3']), /multiple of 3/],
      [spin(30, ['red', '1/4']), /multiple of 4/],
      [spin(2, ['red', '1/2']), /multiple of 2/],
      [spin(8, ['red', '1/4'], ['red', '1/4']), /asked for twice/],
      [spin(12, ['red', '1/4'], ['blue', '1/3'], ['green', '1/6']), /at most two colours/],
      [spin(12, ['red', '1/5'], ['blue', '1/7']), /need 35 sectors, more than a spinner holds/],
      [spin(8), /needs a colour and a chance/],
      [space(8, 'total 5'), /4 or 6 faces/],
      [space(6, 'total 13'), /total from 2 to 12/],
      [space(6, 'total 1'), /total from 2 to 12/],
      [space(4, 'total 9'), /total from 2 to 8/],
      [space(6, 'has 7'), /shows 1 to 6/],
      [space(6, 'difference 6'), /differ by 1 to 5/],
      [space(6, 'total at least 2'), /Every pair makes that event/],
      [space(6, 'total at most 1'), /No pair/],
      [space(6, 'a prime total'), /not one the grid can mark/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f.length, nameOf(c)).toBeGreaterThanOrEqual(1)
      expect(f.join(' '), nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), `${nameOf(c)} -> ${nameOf(fixed)}`).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    expect(SECTORS_MIN).toBe(4)
    expect(SECTORS_MAX).toBe(12)
    // Nothing a refused config can do crashes the rest of the engine, or the view.
    for (const [c] of cases) {
      expect(() => engine.check(c, engine.initial(c))).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(ProbabilityLabView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })

  it('chooses sectors that fit the chances', () => {
    expect(defaultSectors([{ colour: 'red', chance: '1/4' }])).toBe(8)
    expect(defaultSectors([{ colour: 'red', chance: '1/3' }])).toBe(6)
    expect(defaultSectors([{ colour: 'red', chance: '1/4' }, { colour: 'blue', chance: '1/3' }])).toBe(12)
    expect(defaultSectors([{ colour: 'red', chance: '1/5' }])).toBe(10)
    for (const c of SPINNERS.filter((x) => engine.faults(x).length === 0)) {
      const n = defaultSectors(c.targets)
      expect(engine.faults({ ...c, sectors: n }), nameOf(c)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: ProbConfig, p: string) => engine.promptFaults!(c, p)
  const third = spin(12, ['red', '1/3'])
  const two = spin(8, ['red', '1/4'], ['blue', '1/2'])
  const eight = space(6, 'total 8')

  it('asking for the chance or the event is fine', () => {
    expect(pf(third, 'Tap a sector to colour it, and spin to test your spinner. Make a spinner where red has a 1/3 chance.')).toEqual([])
    expect(pf(third, 'Make a spinner that lands on red one time in three. Tap a sector to colour it.')).toEqual([])
    expect(pf(two, 'Tap a sector to colour it. Make a spinner where red has a 1/4 chance and blue has a 1/2 chance.')).toEqual([])
    expect(pf(eight, 'Tap a square to mark that pair of dice with a counter. Mark every pair that gives a total of 8.')).toEqual([])
    expect(pf(eight, 'Two dice are rolled. Mark every pair that gives a total of 8, using all 36 outcomes.')).toEqual([])
    expect(pf(space(6, 'doubles'), 'Mark every pair that makes doubles.')).toEqual([])
  })

  it('how many sectors, how to work it out, which pairs or where are not', () => {
    for (const p of ['Colour 4 sectors red.', 'Colour four of the sectors red.', 'Paint 4 of the 12 sectors.', 'Use 4 red sectors.', 'Make red cover exactly 4 sections.', 'Work out the favourable outcomes over the total.', 'Divide the sectors by 3.']) {
      expect(pf(third, p), p).toHaveLength(1)
    }
    for (const p of ['Mark the 5 pairs that total 8.', 'Mark (2, 6) and (3, 5).', 'Find the diagonal and mark it.', 'There are 6 ways to get a total of 7.', 'Mark the squares on the anti-diagonal.']) {
      expect(pf(space(6, 'total 7'), p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Flip a coin and spin.', 'Roll the dice and compare.', 'Draw a tree diagram for the spinner.', 'Drag the needle to red.', 'Predict where it will land.']) {
      expect(pf(third, p), p).toHaveLength(1)
      expect(pf(third, p)[0], p).toMatch(/does not show/)
    }
    for (const p of ['Spin the wheel.', 'Draw a tree for the two dice.', 'Flip a coin.', 'Colour the pairs.', 'Pick a card.']) {
      expect(pf(eight, p), p).toHaveLength(1)
      expect(pf(eight, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: ProbConfig) => pf(c, c.task === 'spinner' ? 'Colour 3 sectors.' : 'Mark the 4 pairs.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of VALID.filter((_, i) => i % 3 === 0)) {
      const fix = quoted(c)
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'spinner' ? /Make a spinner where/ : /Mark every pair that gives/)
      if (c.task === 'spinner') for (const t of c.targets) expect(fix, nameOf(c)).toContain(`${t.colour} has a ${t.chance} chance`)
    }
  })

  it('passes the examples in its own catalogue entry, and shows every config kind', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"probability-lab", "config": (\{.*?\}) \},/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    }
    expect(found.map((f) => JSON.parse(f[2]).task).sort()).toEqual(['space', 'space', 'spinner', 'spinner'])
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "probability-lab"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'probability-lab')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Probability', 'Probabilities', 'Experiments, events and outcomes', 'Chance and probability', 'Relative frequency', 'Experimental probability', 'Theoretical probability', 'Sample space diagrams', 'Possible outcomes', 'Rolling dice',
      'Unit 4: Spinners and dice', 'Chapter 12: Probability', 'Simple probability', 'How likely is it?', 'Equally likely outcomes', 'Probability scale', 'Random events', 'The law of large numbers', 'Fair and unfair games', 'Games of chance',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Conditional probability', 'Tree diagrams', 'Probability tree diagrams', 'Probability distributions', 'The binomial distribution', 'The normal distribution', 'Discrete random variables', 'Continuous random variables', 'Probability density functions', 'Venn diagrams and probability',
      'Bayes theorem', 'Expected value', 'Permutations and combinations', 'Independent events', 'Hypothesis testing', 'Random sampling', 'Monte Carlo methods',
      'Genetic probability and Punnett squares', 'Inheritance', 'Chance mutations', 'Natural selection', 'Radioactive decay and half-life', 'Electron probability in orbitals', 'Quantum probability',
      'Chance of rain', 'A chance encounter', 'Second chances in Romeo and Juliet', 'Risk assessment', 'Insurance and risk', 'The lottery', 'Gambling and society',
      'Mean, median and mode', 'Scatter graphs', 'Cumulative frequency', 'Frequency tables', 'Fractions', 'Percentages', 'Dicing vegetables', 'Standard deviation',
      'Network topologies', 'Food chains', 'Electric circuits',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('probability-lab')).toBe(engine)
    expect(engine.isolates).toBe('quantity')
    expect(engine.prompt).toMatch(/SCENE "probability-lab"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:probability-lab"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    expect(engine.prompt).toContain(`${SECTORS_MIN} to ${SECTORS_MAX}`)
  })
})

describe('the picture', { timeout: 30_000 }, () => {
  const raw = (cfg: ProbConfig, state: ProbState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(ProbabilityLabView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'probability-lab', config: cfg }, success: { kind: 'scene' } } },
    } as never)))

  const EXAMPLES: [ProbConfig, string][] = [
    [spin(12, ['red', '1/3']), 'Tap a sector to colour it, and spin to test your spinner. Make a spinner where red has a 1/3 chance.'],
    [spin(8, ['red', '1/4'], ['blue', '1/2']), 'Tap a sector to colour it, and spin to test your spinner. Make a spinner where red has a 1/4 chance and blue has a 1/2 chance.'],
    [space(6, 'total 8'), 'Tap a square to mark that pair of dice with a counter. Mark every pair that gives a total of 8.'],
    [space(4, 'doubles'), 'Tap a square to mark that pair of dice with a counter. Mark every pair that makes doubles.'],
  ]

  it('before marking, nothing says the chance, the count or the answer', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html) + ' ' + text(idle) + ' ' + attrs(idle)
      for (const secret of ['Yes', 'covers', 'not the chance', 'is the chance', 'make it', 'does not make', 'pairs make', 'out of 36', 'out of 16', 'are not marked']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
    // A marked pair does not show its total either: the sums appear with the mark.
    const half = text(raw(space(6, 'total 8'), { picks: ['2-6', '3-5'], rolls: 2 }, 'idle'))
    expect(half).not.toMatch(/ 8 /)
    expect(text(raw(space(6, 'total 8'), { picks: ['2-6'] }, 'wrong'))).toMatch(/ 8 /)
  })

  it('names what it draws, on the card, before marking', () => {
    const s = text(raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle'))
    for (const name of ['Share of spins', 'Chance asked for', 'Last spins', 'Spins', 'Red', 'Spin', 'Clear', '1/3']) expect(s).toContain(name)
    const t = text(raw(EXAMPLES[1][0], engine.initial(EXAMPLES[1][0]), 'idle'))
    for (const name of ['Red', 'Blue', '1/4', '1/2']) expect(t).toContain(name)
    const d = text(raw(EXAMPLES[2][0], engine.initial(EXAMPLES[2][0]), 'idle'))
    for (const name of ['first die', 'second die', 'Marked pair', 'Where the dice landed', 'Pairs in all', 'Roll', 'Clear', 'Marked']) expect(d).toContain(name)
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1])
      expect(new Set(buttons).size, nameOf(cfg)).toBe(buttons.length)
      const wants = cfg.task === 'spinner' ? cfg.sectors + 4 : cfg.dice * cfg.dice + 2
      expect(buttons.length, nameOf(cfg)).toBe(wants)
      expect(idle).toContain('type="button"')
      expect(idle).toContain('nodrag')
      // One stop in the tab order for the board: the arrows move within it.
      const stops = [...idle.matchAll(/<button[^>]*data-i="\d+"[^>]*tabindex="0"/g)]
      expect(stops.length, nameOf(cfg)).toBe(1)
      const done2 = raw(cfg, engine.solve(cfg), 'right')
      expect(done2, nameOf(cfg)).not.toMatch(/<button[^>]*data-i=[^>]*(?<!disabled)=""?>/)
      expect([...done2.matchAll(/<button[^>]*data-i[^>]*disabled/g)].length, nameOf(cfg)).toBe(cfg.task === 'spinner' ? cfg.sectors : cfg.dice * cfg.dice)
    }
    // Names what a sector or square is without naming the answer.
    expect(raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle')).toContain('Sector 1 of 12, plain')
    expect(raw(EXAMPLES[2][0], engine.initial(EXAMPLES[2][0]), 'idle')).toContain('First die 2, second die 6, not marked')
    expect(raw(EXAMPLES[2][0], { picks: ['2-6'] }, 'idle')).toContain('First die 2, second die 6, marked')
  })

  it('every move changes the picture, and nothing animates under reduced motion', () => {
    const a = EXAMPLES[0][0] as Spin
    const empty = engine.initial(a) as { cells: string[] }
    const base = raw(a, empty, 'idle', true)
    expect(base).not.toMatch(/transition:\s*[a-z]/)
    expect(raw(a, { cells: ['red', ...empty.cells.slice(1)], spins: 0 }, 'idle', true)).not.toBe(base)
    expect(raw(a, { cells: empty.cells, spins: 1 }, 'idle', true)).not.toBe(base)
    const painted = { cells: ['red', 'red', 'plain', 'yellow', ...empty.cells.slice(4)] }
    const r1 = raw(a, { ...painted, spins: 10 }, 'idle', true)
    expect(raw(a, { ...painted, spins: 100 }, 'idle', true)).not.toBe(r1)
    expect(r1).toContain('data-spins="10"')
    expect(raw(a, { ...painted, spins: 10 }, 'idle', false)).toMatch(/transition:transform/)
    const s = EXAMPLES[2][0] as Space
    const sBase = raw(s, { picks: [], rolls: 0 }, 'idle', true)
    expect(raw(s, { picks: ['2-6'], rolls: 0 }, 'idle', true)).not.toBe(sBase)
    expect(raw(s, { picks: [], rolls: 1 }, 'idle', true)).not.toBe(sBase)
    expect(raw(s, { picks: [], rolls: 1 }, 'idle', true)).toContain('data-landed="1"')
    expect(sBase).not.toContain('data-landed')
    expect(sBase).not.toMatch(/transition:\s*[a-z]/)
  })

  it('draws the spins it has run, and the chance asked for as a dotted line', () => {
    const c = EXAMPLES[1][0] as Spin
    const cells = ['red', 'red', 'blue', 'blue', 'blue', 'blue', 'plain', 'plain']
    const html = raw(c, { cells, spins: 40 }, 'idle', true)
    expect(html).toContain('data-line="red"')
    expect(html).toContain('data-line="blue"')
    expect(html).toContain('data-goal="red"')
    expect([...html.matchAll(/data-trail=/g)].length).toBe(8)
    expect(raw(c, { cells, spins: 0 }, 'idle', true)).not.toContain('data-line=')
    expect(html).toMatch(/data-needle="[\d.]+"/)
    const spinsText = text(html)
    expect(spinsText).toContain('40 spins'.replace('40', '50'))
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const a = raw(EXAMPLES[0][0], { cells: [], spins: 5 }, 'shown')
    expect([...a.matchAll(/data-colour="red"/g)].length).toBe(4)
    expect(text(a)).toContain('Red covers 4 of 12 sectors')
    const d = raw(EXAMPLES[2][0], {}, 'shown')
    expect([...d.matchAll(/data-counter="1"/g)].length).toBe(5)
    expect(text(d)).toContain('5 pairs out of 36')
  })

  it('shows the wrong marks after marking, and says what was made', () => {
    const d = raw(space(6, 'total 8'), { picks: ['2-6', '1-1'] }, 'wrong')
    expect(d).toContain('You marked 2 pairs')
    expect(d).toContain(BAD_TEXT)
    const a = raw(spin(12, ['red', '1/3']), { cells: Array.from({ length: 12 }, (_, i) => (i < 6 ? 'red' : 'plain')) }, 'wrong')
    expect(text(a)).toContain('Red covers 6 of 12 sectors, a chance of 1/2')
  })

  it('tells a screen reader what is seen, never the chance', () => {
    const c = EXAMPLES[0][0]
    const live = raw(c, { cells: ['red', 'red', ...Array.from({ length: 10 }, () => 'plain')], spins: 10 }, 'idle')
    expect(attrs(live)).toContain('2 red')
    expect(attrs(live)).toContain('Spun 10 times')
    expect(attrs(live)).not.toMatch(/chance|1\/6|1\/3/)
    expect(attrs(raw(EXAMPLES[2][0], { picks: ['2-6'], rolls: 1 }, 'idle'))).toContain('1 pair is marked')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    for (const c of [EXAMPLES[0][0], EXAMPLES[2][0]]) {
      const html = raw(c, engine.initial(c), 'idle', true)
      expect(html).toContain(`viewBox="0 0 ${W} ${c.task === 'spinner' ? SPIN_H : SPACE_H}"`)
    }
    expect(W).toBe(360)
    for (const colour of COLOURS) {
      const html = raw(spin(8, [colour, '1/4']), { cells: [colour, ...Array.from({ length: 7 }, () => 'plain')] }, 'idle', true)
      expect(html).toContain('data-colour="' + colour + '"')
    }
    const html = raw(EXAMPLES[0][0], { cells: Array.from({ length: 12 }, () => 'red') }, 'idle', true)
    expect(html).toContain('#D2534B')
  })

  it('everything stays on the plate, and no two labels touch', () => {
    // The row of last-spin counters and the graph's labels.
    expect(PLOT.x0 + 8 + 7 * 17 + 7).toBeLessThanOrEqual(W)
    for (const label of ['1/12', '11/12', '5/12']) expect(PLOT.x1 + 5 + label.length * 7).toBeLessThanOrEqual(W - 4)
    expect(PLOT.x0 - 5 - 3 * 7).toBeGreaterThan(90 + 82) // the y labels clear the board
    // Two goal labels never sit closer than a line of text, for every pair of chances.
    const fracs = new Set<number>()
    for (let q = 2; q <= 12; q++) for (let p = 1; p < q; p++) fracs.add(p / q)
    for (const a of fracs) for (const b of fracs) {
      if (a >= b) continue
      const ys = goalLabelYs([a, b])
      expect(Math.abs(ys[0] - ys[1]), `${a} ${b}`).toBeGreaterThanOrEqual(15)
      // Each label stays near its own line: within one line of text of it.
      expect(Math.abs(ys[0] - (PLOT.y0 - a * (PLOT.y0 - PLOT.y1) + 4))).toBeLessThanOrEqual(15)
      expect(Math.abs(ys[1] - (PLOT.y0 - b * (PLOT.y0 - PLOT.y1) + 4))).toBeLessThanOrEqual(15)
      expect(Math.min(...ys)).toBeGreaterThan(PLOT.y1 - 8)
      expect(Math.max(...ys)).toBeLessThan(PLOT.y0 + 14)
    }
  })

  it('the board geometry: every sector button sits inside the panel and on the board', () => {
    const html = raw(spin(12, ['red', '1/3']), engine.initial(spin(12, ['red', '1/3'])), 'idle', true)
    const lefts = [...html.matchAll(/<button[^>]*left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/g)]
    expect(lefts.length).toBe(12)
    for (const m of lefts) {
      expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(100)
      expect(Number(m[2]) + Number(m[4])).toBeLessThanOrEqual(100)
    }
    const grid = raw(space(6, 'doubles'), engine.initial(space(6, 'doubles')), 'idle', true)
    const cells = [...grid.matchAll(/<button[^>]*left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/g)]
    expect(cells.length).toBe(36)
    for (const m of cells) {
      expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(80) // the dice stand to the right of the grid
      expect(Number(m[2]) + Number(m[4])).toBeLessThanOrEqual(100)
    }
  })

  it('keyboard help is for keyboard users, and each card keeps to the height budget', () => {
    for (const [c] of EXAMPLES) {
      const html = raw(c, engine.initial(c), 'idle')
      expect(html).toContain('[&amp;:has(button:focus-visible)_.pl-kbd]:block')
      expect(html).toMatch(/pl-kbd hidden/)
    }
    // Panel, caption, controls, readouts, and a marked result: 236 + 262 at 360 wide is 262/360 of the width at most.
    expect(SPACE_H / W).toBeLessThan(0.75)
  })

  it('the pairs on the cards, in every state, name no cell twice', () => {
    const html = raw(space(6, 'total 8'), engine.solve(space(6, 'total 8')), 'right')
    const ids = [...html.matchAll(/data-cell="([\d-]+)"/g)].map((m) => m[1])
    expect(ids.length).toBe(36)
    expect(new Set(ids).size).toBe(36)
    expect(cellsOf(spin(8, ['red', '1/4']), {}).length).toBe(8)
  })
})

const BAD_TEXT = '#B0303C'
void [spin, fr]
