// lib/studylab/engines/thermal-transfer/thermal-transfer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  thermalTransferEngine as engine, BARE, BEAD_AT, CONDUCTIVITY, DIFFUSIVITY, FOIL_RAYS, LID_TOP, LOSS, MATERIALS, MINUTES_MAX, MINUTES_MIN, PARTS, ROD_CM, ROOM, START, TARGETS, WOOL_MAX,
  bestWrapping, clock, correctOrder, orderOf, raceEnd, startOrder, dropSeconds, erfc, fewestParts, goodPrompt, heatFraction, holds, lossOf, madeText, partsUsed, tempAt, working, wrappingOf, wrappings,
  type BeadsConfig, type ThermalConfig, type ThermalState, type WrapConfig, type Wrapping,
} from './config'
import {
  AT, BASE, BEADS_LABELS, CX, FOIL_W, GLASS_W, H, HALF, LAYER, LID_Y, PX, RIM, RODS, THERMO, W, WOOLS, WOOL_TOP, WRAP_H, WRAP_LABELS, X0, ThermalTransferView, rowsOf,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const subsets = <T,>(items: readonly T[], sizes: number[]): T[][] => {
  const out: T[][] = []
  for (let bits = 1; bits < 1 << items.length; bits++) {
    const s = items.filter((_, i) => bits & (1 << i))
    if (sizes.includes(s.length)) out.push(s)
  }
  return out
}
const beadsCfg = (rods: string[]): BeadsConfig => ({ task: 'beads', rods })
const ALL_RODS = subsets(MATERIALS, [2, 3]).map((r) => beadsCfg([...r]))
const VALID_BEADS = ALL_RODS.filter((c) => engine.faults(c).length === 0)

const PART_SETS = subsets(PARTS, [1, 2, 3])
const wrapCfg = (drink: 'hot' | 'cold', minutes: number, target: number, parts: string[]): WrapConfig => ({ task: 'wrap', drink, minutes, target, parts })
const ALL_WRAPS: WrapConfig[] = []
for (const drink of ['hot', 'cold'] as const) {
  for (let target = TARGETS[drink].min; target <= TARGETS[drink].max; target++) {
    for (let minutes = MINUTES_MIN; minutes <= MINUTES_MAX; minutes++) for (const parts of PART_SETS) ALL_WRAPS.push(wrapCfg(drink, minutes, target, [...parts]))
  }
}
const VALID_WRAPS = ALL_WRAPS.filter((c) => engine.faults(c).length === 0)
const ALL: ThermalConfig[] = [...VALID_BEADS, ...VALID_WRAPS]

/** An independent test of "holds", from the temperature itself. */
const holdsByTemperature = (c: WrapConfig, w: Wrapping) => {
  const T = Number(tempAt(c, w, c.minutes).toFixed(1))
  return c.drink === 'hot' ? T >= c.target : T <= c.target
}

const CATALOGUE_EXAMPLES: [ThermalConfig, string][] = [
  [beadsCfg(['brass', 'copper', 'iron']), 'Heat the rods and watch the balls drop, then put the metals in order, best conductor first.'],
  [beadsCfg(['copper', 'iron']), goodPrompt(beadsCfg(['copper', 'iron']))],
  [wrapCfg('hot', 30, 50, ['wool', 'lid', 'foil']), 'Add wool, a lid or foil to the cup. Keep the water above 50 °C for 30 minutes, with as few parts as you can.'],
  [wrapCfg('cold', 30, 10, ['wool', 'lid', 'foil']), 'Add wool, a lid or foil to the cup. Keep the drink below 10 °C for 30 minutes, with as few parts as you can.'],
  [wrapCfg('hot', 20, 45, ['wool']), goodPrompt(wrapCfg('hot', 20, 45, ['wool']))],
]

describe('the rods, from first principles', () => {
  it('the diffusivities put the metals in the order Ingen-Housz found: copper quickest, iron slowest here', () => {
    expect(DIFFUSIVITY.copper).toBeGreaterThan(DIFFUSIVITY.aluminium)
    expect(DIFFUSIVITY.aluminium).toBeGreaterThan(DIFFUSIVITY.brass)
    expect(DIFFUSIVITY.brass).toBeGreaterThan(DIFFUSIVITY.iron)
    expect(dropSeconds(8, 'copper')).toBeLessThan(dropSeconds(8, 'iron'))
  })

  it('a bead melts at t = x squared over K a: twice as far takes four times as long', () => {
    for (const m of MATERIALS) expect(dropSeconds(10, m) / dropSeconds(5, m)).toBeCloseTo(4, 9)
    expect(dropSeconds(5, 'copper') * DIFFUSIVITY.copper).toBeCloseTo(dropSeconds(5, 'iron') * DIFFUSIVITY.iron, 9)
  })

  it('the clock and the colours agree: the wax melts exactly when the rod has reached half the bath excess', () => {
    for (const m of MATERIALS) {
      for (const x of [1, 4, 9, 14]) expect(heatFraction(x, m, dropSeconds(x, m))).toBeCloseTo(0.5, 3)
    }
    expect(heatFraction(5, 'iron', 0)).toBe(0)
    expect(heatFraction(5, 'iron', 1e12)).toBeCloseTo(1, 4)
    expect(erfc(0)).toBeCloseTo(1, 6)
    expect(erfc(0.4769)).toBeCloseTo(0.5, 3)
  })

  it('heat reaches a point sooner in a better conductor, and later farther out', () => {
    expect(heatFraction(6, 'copper', 120)).toBeGreaterThan(heatFraction(6, 'iron', 120))
    expect(heatFraction(3, 'iron', 120)).toBeGreaterThan(heatFraction(9, 'iron', 120))
  })

  it('the race order is the conductivity order: the balls drop in the order the marking asks for, and far enough apart to see', () => {
    for (const c of VALID_BEADS) {
      const byRace = [...c.rods].sort((a, b) => dropSeconds(BEAD_AT, a) - dropSeconds(BEAD_AT, b))
      expect(byRace, c.rods.join()).toEqual(correctOrder(c.rods))
      const times = byRace.map((r) => dropSeconds(BEAD_AT, r))
      for (let i = 0; i + 1 < times.length; i++) expect(times[i + 1] / times[i]).toBeGreaterThan(1.4)
    }
    expect(CONDUCTIVITY.copper).toBeGreaterThan(CONDUCTIVITY.aluminium)
    expect(CONDUCTIVITY.aluminium).toBeGreaterThan(CONDUCTIVITY.brass)
    expect(CONDUCTIVITY.brass).toBeGreaterThan(CONDUCTIVITY.iron)
  })

  it('the race runs until the slowest ball has dropped, and the clock reads m:ss', () => {
    expect(raceEnd(['iron', 'copper'])).toBeCloseTo(dropSeconds(BEAD_AT, 'iron') * 1.06, 9)
    expect(raceEnd(['copper', 'brass'])).toBeLessThan(raceEnd(['copper', 'iron']))
    expect(clock(0)).toBe('0:00')
    expect(clock(95)).toBe('1:35')
  })
})

describe('the cup, from first principles', () => {
  it('the three ways out add: a bare cup halves the gap in about a quarter of an hour', () => {
    const bare = lossOf(BARE)
    expect(bare.all).toBe(LOSS.wall + LOSS.top + LOSS.rays)
    const half = (Math.log(2) * 10000) / bare.all
    expect(half).toBeGreaterThan(12)
    expect(half).toBeLessThan(20)
    const c = wrapCfg('hot', 30, 50, ['wool', 'lid', 'foil'])
    expect(tempAt(c, BARE, half) - ROOM).toBeCloseTo((START.hot - ROOM) / 2, 6)
  })

  it('wool makes the wall resist in series, the lid and the foil cut their own way only', () => {
    expect(lossOf({ wool: 1, lid: false, foil: false }).wall).toBe(LOSS.wall / 3)
    expect(lossOf({ wool: 3, lid: false, foil: false }).wall).toBe(LOSS.wall / 7)
    expect(lossOf({ wool: 3, lid: false, foil: false }).top).toBe(LOSS.top)
    expect(lossOf({ wool: 0, lid: true, foil: false }).top).toBe(LID_TOP)
    expect(lossOf({ wool: 0, lid: true, foil: false }).wall).toBe(LOSS.wall)
    expect(lossOf({ wool: 0, lid: false, foil: true }).rays).toBe(FOIL_RAYS)
    expect(lossOf({ wool: 0, lid: false, foil: true }).top).toBe(LOSS.top)
  })

  it('every part loses less heat, so every part helps a hot cup and a cold cup alike', () => {
    for (const drink of ['hot', 'cold'] as const) {
      const c = wrapCfg(drink, 30, drink === 'hot' ? 50 : 10, [...PARTS])
      const bare = tempAt(c, BARE, 30)
      for (const w of [{ wool: 1, lid: false, foil: false }, { wool: 0, lid: true, foil: false }, { wool: 0, lid: false, foil: true }]) {
        const t = tempAt(c, w, 30)
        // Hotter than bare for a hot cup, colder than bare for a cold one: the same wrapping, the other way.
        if (drink === 'hot') expect(t).toBeGreaterThan(bare)
        else expect(t).toBeLessThan(bare)
      }
    }
  })

  it('the cold cup warms toward the room and never past it; the hot one cools toward it and never below', () => {
    const hot = wrapCfg('hot', 60, 50, [...PARTS])
    const cold = wrapCfg('cold', 60, 10, [...PARTS])
    for (const m of [0, 10, 30, 60, 600]) {
      expect(tempAt(hot, BARE, m)).toBeGreaterThan(ROOM)
      expect(tempAt(cold, BARE, m)).toBeLessThan(ROOM)
    }
    expect(tempAt(hot, BARE, 0)).toBe(START.hot)
    expect(tempAt(cold, BARE, 0)).toBe(START.cold)
  })

  it('the catalogue’s cups need what the entry says: wool and a lid hot; wool, a lid and foil cold', () => {
    const hot = wrapCfg('hot', 30, 50, [...PARTS])
    const cold = wrapCfg('cold', 30, 10, [...PARTS])
    expect(fewestParts(hot)).toBe(2)
    expect(bestWrapping(hot)).toEqual({ wool: 1, lid: true, foil: false })
    expect(fewestParts(cold)).toBe(3)
    expect(bestWrapping(cold)).toEqual({ wool: 1, lid: true, foil: true })
  })
})

describe('every configuration', { timeout: 60_000 }, () => {
  it('there are configurations enough to mean something', () => {
    expect(VALID_BEADS.length).toBe(7)
    expect(VALID_WRAPS.length).toBeGreaterThan(4000)
  })

  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(JSON.parse(JSON.stringify(c))), JSON.stringify(c)).toEqual(c)
      expect(engine.faults(c), JSON.stringify(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${JSON.stringify(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${JSON.stringify(c)}`).toBe(true)
    }
  })

  it('beads: marks exactly the one order, over every order the learner can make', () => {
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])))
    for (const c of VALID_BEADS) {
      const all = perms(c.rods)
      let right = 0
      for (const order of all) {
        const ok = engine.check(c, { order }).ok
        if (ok) right++
        expect(ok, `${c.rods} ${order}`).toBe(order.join() === [...c.rods].sort((a, b) => DIFFUSIVITY[b as keyof typeof DIFFUSIVITY] - DIFFUSIVITY[a as keyof typeof DIFFUSIVITY]).join())
      }
      expect(right).toBe(1)
    }
  })

  it('beads: the stand starts in a fixed order that is never the answer, for any rods', () => {
    for (const c of VALID_BEADS) {
      expect(startOrder(c.rods)).not.toEqual(correctOrder(c.rods))
      expect([...startOrder(c.rods)].sort()).toEqual([...c.rods].sort())
      expect(engine.initial(c)).toEqual({ order: startOrder(c.rods) })
    }
  })


  it('wrap: the fewest parts, and what holds, match an independent count by temperature', () => {
    for (const c of VALID_WRAPS) {
      const all = wrappings(c)
      const holding = all.filter((w) => holdsByTemperature(c, w))
      for (const w of all) {
        expect(holds(c, w), `${JSON.stringify(c)} ${JSON.stringify(w)}`).toBe(holdsByTemperature(c, w))
      }
      const least = Math.min(...holding.map(partsUsed))
      expect(fewestParts(c)).toBe(least)
      expect(least).toBeGreaterThan(0)
      for (const w of all) {
        const state: ThermalState = { wool: w.wool, lid: w.lid, foil: w.foil }
        expect(engine.check(c, state).ok, `${JSON.stringify(c)} ${JSON.stringify(w)}`).toBe(holdsByTemperature(c, w) && partsUsed(w) === least)
      }
    }
  })

  it('wrap: a cup that holds with more parts than it needs is wrong, and says so', () => {
    const c = wrapCfg('hot', 30, 50, [...PARTS])
    const more: ThermalState = { wool: 3, lid: true, foil: true }
    expect(engine.check(c, more).ok).toBe(false)
    expect(madeText(c, more)).toContain('fewer would do')
    expect(madeText(c, { wool: 0, lid: false, foil: false })).toMatch(/below the target/)
    expect(madeText(wrapCfg('cold', 30, 10, [...PARTS]), { wool: 1, lid: false, foil: false })).toMatch(/above the target/)
  })

  it('wrap: a part the card does not offer cannot be used, whatever the state says', () => {
    const c = wrapCfg('hot', 30, 50, ['wool'])
    expect(wrappingOf(c, { wool: 2, lid: true, foil: true })).toEqual({ wool: 2, lid: false, foil: false })
    expect(wrappingOf(c, { wool: 99, lid: true })).toEqual({ wool: WOOL_MAX, lid: false, foil: false })
    expect(wrappingOf(c, { wool: -4 })).toEqual(BARE)
    expect(wrappingOf(c, {})).toEqual(BARE)
    expect(wrappingOf(c, undefined as never)).toEqual(BARE)
    const b = beadsCfg(['brass', 'copper', 'iron'])
    // An old saved card (the ball sliders), a half-made order and a muddle all read as the start.
    for (const bad of [{ beads: { copper: 4, iron: 9 } }, { order: ['copper'] }, { order: ['copper', 'copper', 'iron'] }, { order: ['copper', 'iron', 'wood'] }, { order: 'copper' }, {}, undefined]) {
      expect(orderOf(b, bad as never), JSON.stringify(bad)).toEqual(startOrder(b.rods))
    }
    expect(orderOf(b, { order: ['iron', 'copper', 'brass'] })).toEqual(['iron', 'copper', 'brass'])
  })

  it('says something true when marked, and what was made when wrong, without a verdict on the way', () => {
    for (const c of VALID_BEADS) {
      const said = working(c, engine.solve(c))
      expect(said).toMatch(/^Yes\. Best conductor first: /)
      expect(said).toContain('metal rail feels colder than wood')
      const wrong = madeText(c, engine.initial(c))
      expect(wrong).toMatch(/does not match the order the balls drop in/)
    }
    for (const c of [wrapCfg('hot', 30, 50, [...PARTS]), wrapCfg('cold', 30, 10, [...PARTS]), wrapCfg('hot', 20, 45, ['wool'])]) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes. ')).toBe(true)
      if (c.drink === 'cold') expect(said).toContain('does not keep the cold in')
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'rods', rods: 'Copper, Aluminum and iron' })).toEqual(beadsCfg(['aluminium', 'copper', 'iron']))
    expect(engine.parse({ task: 'wax beads', rods: ['Iron', 'copper'] })).toEqual(beadsCfg(['copper', 'iron']))
    expect(engine.parse({ rods: ['iron', 'brass'] })).toEqual(beadsCfg(['brass', 'iron']))
    expect(engine.parse({ task: 'conduction' })).toEqual(beadsCfg(['brass', 'copper', 'iron']))
    expect(engine.parse({ task: 'insulation', drink: 'iced water', target: '10 °C', minutes: '30 minutes', parts: 'wool, lid and foil' })).toEqual(wrapCfg('cold', 30, 10, ['wool', 'lid', 'foil']))
    expect(engine.parse({ task: 'wrap' })).toEqual(wrapCfg('hot', 30, 50, ['wool', 'lid', 'foil']))
    expect(engine.parse({ task: 'wrap', drink: 'cold' })).toEqual(wrapCfg('cold', 30, 10, ['wool', 'lid', 'foil']))
    expect(engine.parse({ drink: 'tea', parts: ['Shiny foil', 'the lid'] })).toEqual(wrapCfg('hot', 30, 50, ['lid', 'foil']))
    expect(engine.parse({ task: 'cup', hold: '45 degrees', time: 20 })).toEqual(wrapCfg('hot', 20, 45, ['wool', 'lid', 'foil']))
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 'beads', 3, [], {}, { task: 'sorting' }, { task: 7 }, { task: 'beads', rods: 5 }, { task: 'beads', rods: [1, 2] }, { task: 'wrap', drink: 4 }, { task: 'wrap', minutes: 'soon' }, { task: 'wrap', target: {} }, { task: 'wrap', parts: 7 }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const cases: [unknown, RegExp][] = [
      [{ task: 'beads', rods: ['copper', 'wood'] }, /no "wood" rod[^.]*use aluminium, brass, copper, iron/],
      [{ task: 'beads', rods: ['copper'] }, /1 rods is not what the card shows/],
      [{ task: 'beads', rods: ['aluminium', 'brass', 'copper', 'iron'] }, /4 rods is not what the card shows/],
      [{ task: 'beads', rods: ['iron', 'iron'] }, /same metal/],
      [{ task: 'beads', rods: ['copper', 'aluminium'] }, /pass heat along so alike/],
      [{ task: 'wrap', drink: 'soup' }, /no "soup" drink[^.]*hot or cold/],
      [{ task: 'wrap', parts: ['bubble'] }, /no "bubble" part[^.]*wool, lid or foil/],
      [{ task: 'wrap', parts: [] }, /No parts are offered/],
      [{ task: 'wrap', minutes: 5 }, /5 minutes is outside[^.]*10 to 60/],
      [{ task: 'wrap', minutes: 600 }, /600 minutes is outside/],
      [{ task: 'wrap', minutes: 12.5 }, /12\.5 minutes is outside/],
      [{ task: 'wrap', target: 90 }, /target of 90 °C is outside[^.]*30 to 75/],
      [{ task: 'wrap', drink: 'cold', target: 25 }, /target of 25 °C is outside[^.]*6 to 15/],
      [{ task: 'wrap', target: 40.5 }, /whole degrees/],
      [{ task: 'wrap', target: 31, minutes: 10 }, /bare cup already holds above 31 °C/],
      [{ task: 'wrap', drink: 'cold', target: 15, minutes: 10 }, /bare cup already holds below 15 °C/],
      [{ task: 'wrap', target: 75, minutes: 60 }, /Even with every part offered[^.]*cannot hold 75 °C/],
      [{ task: 'wrap', drink: 'cold', target: 6, minutes: 60 }, /Even with every part offered/],
    ]
    for (const [raw, message] of cases) {
      const config = engine.parse(raw)
      expect(config, JSON.stringify(raw)).not.toBeNull()
      const faults = engine.faults(config!)
      expect(faults.join(' '), JSON.stringify(raw)).toMatch(message)
    }
  })

  it('the example a refusal gives is itself a card that works', () => {
    const take = (text: string) => {
      const t = text.match(/e\.g\. target (\d+)(?:, minutes (\d+))?/)
      return t ? { target: Number(t[1]), minutes: t[2] ? Number(t[2]) : undefined } : null
    }
    let seen = 0
    for (const c of ALL_WRAPS.filter((x) => x.parts.length === 3).filter((_, i) => i % 7 === 0)) {
      const faults = engine.faults(c)
      if (!faults.length) continue
      const ex = take(faults[0])
      if (!ex) continue
      seen++
      const fixed = { ...c, target: ex.target, minutes: ex.minutes ?? c.minutes }
      expect(engine.faults(fixed), `${JSON.stringify(c)} -> ${faults[0]}`).toEqual([])
    }
    expect(seen).toBeGreaterThan(50)
  })

  it('refuses nothing a syllabus needs: a spread of ordinary cups and rods is all fine', () => {
    for (const raw of [
      { task: 'wrap', drink: 'hot', minutes: 20, target: 46 }, { task: 'wrap', drink: 'hot', minutes: 30, target: 50 }, { task: 'wrap', drink: 'hot', minutes: 45, target: 45 },
      { task: 'wrap', drink: 'hot', minutes: 60, target: 40 }, { task: 'wrap', drink: 'cold', minutes: 30, target: 10 }, { task: 'wrap', drink: 'cold', minutes: 45, target: 12 },
      { task: 'wrap', drink: 'cold', minutes: 20, target: 8 }, { task: 'wrap', drink: 'hot', minutes: 30, target: 55, parts: ['wool', 'lid'] }, { task: 'wrap', drink: 'hot', minutes: 20, target: 46, parts: ['wool'] },
      { task: 'beads', rods: ['copper', 'iron'] }, { task: 'beads', rods: ['brass', 'copper', 'iron'] }, { task: 'beads', rods: ['aluminium', 'iron'] }, { task: 'beads' },
    ]) {
      const c = engine.parse(raw)
      expect(c, JSON.stringify(raw)).not.toBeNull()
      expect(engine.faults(c!), JSON.stringify(raw)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const bc = beadsCfg(['brass', 'copper', 'iron'])
  const hot = wrapCfg('hot', 30, 50, [...PARTS])
  const cold = wrapCfg('cold', 30, 10, [...PARTS])

  it('asking for the outcome is fine', () => {
    for (const [c, p] of CATALOGUE_EXAMPLES) expect(engine.promptFaults!(c, p), p).toEqual([])
    expect(engine.promptFaults!(bc, 'Heat the rods, then order the metals from best conductor to worst.')).toEqual([])
    expect(engine.promptFaults!(hot, 'Dress the cup so the water stays above 50 °C for 30 minutes.')).toEqual([])
  })

  it('which metal is best, or why, is not', () => {
    for (const p of [
      'Heat the rods: copper is the best conductor, so put it first.',
      'Iron is the worst conductor. Heat the rods and put the metals in order.',
      'Heat the rods; the fastest ball is the best conductor, so order the metals by free electrons.',
      'Heat the rods and put the metals in order of conductivity.',
    ]) {
      expect(engine.promptFaults!(bc, p).join(' '), p).toContain('gives the answer away')
    }
  })

  it('how many layers, which part works, or how heat moves is not', () => {
    for (const p of [
      'Use two layers of wool. Keep the water above 50 °C for 30 minutes.',
      'Add a lid, because the lid stops the heat escaping. Keep the water above 50 °C for 30 minutes.',
      'Wool traps air. Keep the water above 50 °C for 30 minutes.',
      'Wrap the cup to keep the heat in, above 50 °C for 30 minutes.',
      'Stop conduction and convection so the water stays above 50 °C for 30 minutes.',
      'Foil reflects radiation: keep the water above 50 °C for 30 minutes.',
      'Insulation keeps the cold out. Keep the drink below 10 °C for 30 minutes.',
    ]) {
      expect(engine.promptFaults!(p.includes('drink') ? cold : hot, p).join(' '), p).toContain('gives the answer away')
    }
  })

  it('what the card does not show is refused too', () => {
    expect(engine.promptFaults!(hot, 'Pour the tea into a vacuum flask and keep it above 50 °C for 30 minutes.').join(' ')).toContain('does not show')
    expect(engine.promptFaults!(cold, 'Put ice cubes in the drink and keep it below 10 °C for 30 minutes.').join(' ')).toContain('does not show')
    expect(engine.promptFaults!(bc, 'Heat the rods with a Bunsen flame, then put the metals in order.').join(' ')).toContain('does not show')
    expect(engine.promptFaults!(bc, 'Slide the balls along the rods, then put the metals in order.').join(' ')).toContain('does not show')
  })

  it('a number that is not the card’s own is refused', () => {
    expect(engine.promptFaults!(hot, 'Keep the water above 60 °C for 30 minutes.').join(' ')).toContain('card\'s target is 50')
    expect(engine.promptFaults!(hot, 'Keep the water above 50 °C for 20 minutes.').join(' ')).toContain('card runs 30')
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of [bc, beadsCfg(['copper', 'iron']), hot, cold, wrapCfg('hot', 20, 45, ['wool']), wrapCfg('cold', 45, 12, ['lid', 'foil']), wrapCfg('hot', 60, 40, ['foil'])]) {
      const p = goodPrompt(c)
      expect(engine.promptFaults!(c, p), p).toEqual([])
    }
    // Every valid cup has a passing prompt that names its own numbers and only the parts it offers.
    for (const c of VALID_WRAPS.filter((_, i) => i % 97 === 0)) {
      const p = goodPrompt(c)
      expect(engine.promptFaults!(c, p), p).toEqual([])
      expect(p).toContain(`${c.target} °C`)
      expect(p).toContain(`${c.minutes} minutes`)
      if (!c.parts.includes('lid')) expect(p).not.toContain('lid')
      if (!c.parts.includes('foil')) expect(p).not.toContain('foil')
      if (!c.parts.includes('wool')) expect(p).not.toContain('wool')
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"thermal-transfer", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(f[1]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['beads', 'wrap']))
    expect(found.map((f) => JSON.parse(f[2]).drink).filter(Boolean).sort()).toEqual(['cold', 'hot'])
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "thermal-transfer"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'thermal-transfer')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Heat Transfer and Quantity of heat', 'Heat and Temperature', 'Thermal energy transfers', 'Heat transfer', 'Conduction, convection and radiation', 'Thermal insulation', 'Keeping it Hot (or Cold): The Science of Insulation',
      'Conduction in metals', 'How heat travels', 'The vacuum flask', 'Thermal conductors and insulators', 'Heat loss from a house', 'Rate of cooling', 'Reducing heat loss', 'Conduction and convection', 'Chapter 11: Thermal physics',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Nuclear radiation', 'Radioactive decay', 'Ionising radiation and its dangers', 'Background radiation', 'The electromagnetic spectrum', 'Electrical conduction in metals', 'Electrical conductors and insulators', 'Conduction of nerve impulses',
      'Convection currents in the mantle', 'Plate tectonics', 'Convectional rainfall', 'Insulating electrical cables', 'Sound insulation', 'Insulin and diabetes', 'Solar radiation and the seasons', 'The greenhouse effect', 'Global warming',
      'Latent heat', 'Specific heat capacity', 'Heat exchangers', 'Body temperature regulation', 'Thermoregulation in mammals', 'Adaptive radiation', 'Convex lenses', 'Conductors and semiconductors', 'Enthalpy changes', 'Gas laws',
      'Changes of state', 'Heating and cooling curves', 'Kinetic energy', 'Food webs', 'Sonnets and rhyme schemes', 'Wave speed', 'Static electricity', 'Heatwaves and drought', 'Wiring a plug', 'Calorimetry',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('thermal-transfer')).toBe(engine)
    expect(engine.prompt).toContain('"task":"beads"')
    expect(engine.prompt).toContain('"task":"wrap"')
    expect(engine.isolates).toBe('magnitude')
    expect([...engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)].every((m) => m[1] === engine.isolates)).toBe(true)
  })

  it('the numbers in its catalogue entry are the numbers it marks to', () => {
    expect(engine.prompt).toContain(`hot 30 to 75 °C (default 50), cold 6 to 15 °C (default 10)`)
    expect(TARGETS.hot).toEqual({ min: 30, max: 75 })
    expect(TARGETS.cold).toEqual({ min: 6, max: 15 })
    expect(engine.prompt).toContain(`minutes: ${MINUTES_MIN} to ${MINUTES_MAX}`)
    expect(engine.prompt).toContain(`hot" (${START.hot} °C start) or "cold" (${START.cold} °C start); the room is ${ROOM} °C`)
    expect(engine.prompt).toContain(`layers of wool (0 to ${WOOL_MAX})`)
  })
})

describe('the scene on the board', { timeout: 60_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'thermal-transfer', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: ThermalConfig, state: ThermalState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(ThermalTransferView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says whether it is right, the fewest, or the why', () => {
    for (const [cfg, prompt] of CATALOGUE_EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, JSON.stringify(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'fewer', 'does not match', 'free electrons', 'metal rail', 'conductivity', 'does not keep', 'does not make', 'below the target', 'above the target', 'left the', 'held,', 'redundan', 'is also why', 'as few', 'Insulation does']) {
        expect(shown, `${secret} in ${JSON.stringify(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('the rods stand in the learner’s order, and nothing printed gives the right one', () => {
    const c = beadsCfg(['brass', 'copper', 'iron'])
    const order = (s: ThermalState, marked: 'idle' | 'shown' = 'idle') => [...raw(c, s, marked, true).matchAll(/data-rod="(\w+)"/g)].map((m) => m[1])
    expect(order(engine.initial(c))).toEqual(startOrder(c.rods))
    expect(order({ order: ['iron', 'copper', 'brass'] })).toEqual(['iron', 'copper', 'brass'])
    expect(order(engine.initial(c), 'shown')).toEqual(correctOrder(c.rods))
    const idle = text(raw(c, engine.initial(c), 'idle', true)) + attrs(raw(c, engine.initial(c), 'idle', true))
    expect(idle).not.toMatch(/\b(?:400|237|W\/m|conductivity|free electrons)\b/)
  })

  it('names what it draws, on the card, before marking', () => {
    const wrap = text(raw(wrapCfg('hot', 30, 50, [...PARTS]), { wool: 1, lid: false, foil: false }, 'idle'))
    for (const word of ['conduction', 'convection', 'radiation', 'water', 'target', 'Wool layers', 'Lid', 'Shiny foil', 'Bare cup', 'heat leaving the water']) expect(wrap).toContain(word)
    expect(text(raw(wrapCfg('cold', 30, 10, [...PARTS]), engine.initial(wrapCfg('cold', 30, 10, [...PARTS])), 'idle'))).toContain('heat entering the drink')
    const beads = text(raw(beadsCfg(['copper', 'iron']), engine.initial(beadsCfg(['copper', 'iron'])), 'idle'))
    for (const word of ['boiling water', 'copper', 'iron', 'Heat the rods', 'Elapsed', 'Order, best conductor first', 'Redder means hotter']) expect(beads).toContain(word)
  })

  it('marking says what was found, and what was made when wrong', () => {
    const c = beadsCfg(['copper', 'iron'])
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('Yes. Best conductor first: ')
    expect(text(raw(c, engine.initial(c), 'wrong'))).toContain('does not match the order the balls drop in')
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('free electrons')
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('metal rail feels colder than wood')
    const w = wrapCfg('hot', 30, 50, [...PARTS])
    expect(text(raw(w, engine.solve(w), 'right'))).toContain('Yes. 1 layer of wool and a lid left the water at')
    expect(text(raw(w, { wool: 3, lid: true, foil: true }, 'wrong'))).toContain('fewer would do')
    expect(text(raw(w, engine.initial(w), 'wrong'))).toContain('below the target')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c = beadsCfg(['brass', 'copper', 'iron'])
    const html = raw(c, { order: ['iron', 'brass', 'copper'] }, 'shown', true)
    expect([...html.matchAll(/data-rod="(\w+)"/g)].map((m) => m[1])).toEqual(correctOrder(c.rods))
    const w = wrapCfg('hot', 30, 50, [...PARTS])
    expect(text(raw(w, engine.initial(w), 'shown', true))).toContain('Yes. 1 layer of wool and a lid')
  })

  it('every control is a real control with its own label, and none works once solved', () => {
    const w = wrapCfg('hot', 30, 50, [...PARTS])
    const open = raw(w, engine.initial(w), 'idle')
    expect(open).toMatch(/role="spinbutton"[^>]*aria-valuemax="3"/)
    for (const label of ['Add a layer of wool', 'Take away a layer of wool', 'Lid: off', 'Shiny foil: off']) expect(open).toContain(`aria-label="${label}"`)
    expect(open).toMatch(/aria-pressed="false"/)
    const done = raw(w, engine.solve(w), 'right')
    expect(done).toMatch(/aria-label="Lid: on"[^>]*disabled|disabled=""[^>]*aria-label="Lid: on"/)
    expect(done).toContain('aria-disabled="true"')
    const b = beadsCfg(['copper', 'iron'])
    const rods = raw(b, engine.initial(b), 'idle')
    expect(rods).toContain('aria-label="Heat the rods"')
    expect(rods).toContain('aria-label="iron, place 1: pick it up"')
    expect(rods).not.toContain('role="slider"')
    expect(rods).not.toContain('type="range"')
    expect(raw(b, engine.solve(b), 'right')).toMatch(/disabled=""[^>]*>|aria-pressed="false"[^>]*disabled/)
    // A part the card does not offer has no control.
    const only = raw(wrapCfg('hot', 30, 50, ['wool']), { wool: 0 }, 'idle')
    expect(only).not.toContain('Lid')
    expect(only).not.toContain('Shiny foil')
  })

  it('keyboard help is for keyboard users', () => {
    for (const c of [wrapCfg('hot', 30, 50, [...PARTS])]) {
      const html = raw(c, engine.initial(c), 'idle')
      expect(html).toMatch(/\[&amp;:has\(:focus-visible\)_\.tt-kbd\]:block/)
      expect(html).toMatch(/class="tt-kbd hidden/)
    }
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    const b = beadsCfg(['brass', 'copper', 'iron'])
    const start = raw(b, engine.initial(b), 'idle', true)
    // One swap moves two rods to each other's place.
    expect(raw(b, { order: ['brass', 'iron', 'copper'] }, 'idle', true)).not.toBe(start)
    expect(raw(b, { order: ['copper', 'brass', 'iron'] }, 'idle', true)).not.toBe(start)
    expect(start).not.toMatch(/animate|transition:|requestAnimationFrame/)
    const w = wrapCfg('hot', 30, 50, [...PARTS])
    const bare = raw(w, engine.initial(w), 'idle', true)
    for (const move of [{ wool: 1 }, { wool: 3 }, { lid: true }, { foil: true }]) expect(raw(w, { ...engine.initial(w), ...move }, 'idle', true), JSON.stringify(move)).not.toBe(bare)
    expect(bare).not.toMatch(/animate|transition:/)
    // The frame at rest is the end of the experiment, where the cups have parted.
    expect(bare).toContain(`data-water="${tempAt(w, BARE, w.minutes).toFixed(1)}"`)
  })

  it('a one-step move changes the arrows too: more wool means a thinner conduction arrow', () => {
    const w = wrapCfg('hot', 30, 50, [...PARTS])
    const widths = (s: ThermalState) => [...raw(w, s, 'idle', true).matchAll(/<g data-arrows="1">[\s\S]*?<path d="[^"]*" fill="none" stroke="#E0702A" stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]))
    const a = widths({ wool: 0 })[0]
    const b = widths({ wool: 1 })[0]
    const c = widths({ wool: 3 })[0]
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('tells a screen reader what the apparatus does, never whether it is right', () => {
    const b = beadsCfg(['copper', 'iron'])
    const html = raw(b, engine.initial(b), 'idle', true)
    const spoken = attrs(html) + ' ' + text(html)
    expect(spoken).toMatch(/2 metal rods, iron, copper from the top, are clamped in a stand with their ends in a bath of boiling water/)
    expect(spoken).not.toMatch(/\b(?:correct|right|wrong)\b/)
    const w = wrapCfg('cold', 30, 10, [...PARTS])
    const cup = raw(w, engine.initial(w), 'idle', true)
    expect(attrs(cup) + text(cup)).toMatch(/beaker of cold water in section[^.]*no wool, no lid and no foil/)
    expect(attrs(cup) + text(cup)).not.toMatch(/\b(?:correct|wrong)\b/)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of CATALOGUE_EXAMPLES.map((e) => e[0])) {
      for (const marked of ['idle', 'right', 'wrong'] as const) {
        const html = raw(c, engine.initial(c), marked)
        for (const m of html.matchAll(/font-size="([\d.]+)"/g)) expect(Number(m[1]), `${m[0]} in ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(12)
        for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/gradient|box-shadow|drop-shadow|filter=|blur|shadow-/)
      }
    }
  })

  it('a card that is refused still reads, and a part the state names but the card lacks does nothing', () => {
    expect(() => raw({ task: 'beads', rods: ['wood', 'glass'] }, { beads: {} }, 'idle')).not.toThrow()
    expect(() => raw({ task: 'wrap', drink: 'soup', minutes: 999, target: 3, parts: ['bubble'] }, {}, 'wrong')).not.toThrow()
    expect(() => raw(beadsCfg(['copper', 'iron']), undefined as never, 'idle')).not.toThrow()
    expect(() => raw(wrapCfg('hot', 30, 50, [...PARTS]), undefined as never, 'idle')).not.toThrow()
  })
})

describe('a still frame is a frame a learner sees', { timeout: 60_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  // The widest a 13 px bold word could be, so a box here is bigger than the word.
  const labelBox = (text: string, p: { x: number; y: number; anchor: string }): Box => {
    const wide = text.length * 7.4
    const left = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - wide : p.x - wide / 2
    return { left, right: left + wide, top: p.y - 12, bottom: p.y + 4 }
  }

  it('the view’s literals agree with the config', () => {
    expect(RODS).toBe(ROD_CM)
    expect(AT).toBe(BEAD_AT)
    expect(WOOLS).toBe(WOOL_MAX)
    expect(X0 + RODS * PX).toBeLessThan(W)
  })

  it('wrap: no name touches the cup, its wool, foil, lid or the thermometer, in any dress', () => {
    const names: [string, { x: number; y: number; anchor: string }][] = [['conduction', WRAP_LABELS.conduction], ['convection', WRAP_LABELS.convection], ['radiation', WRAP_LABELS.radiation]]
    const inner = HALF + GLASS_W
    for (let wool = 0; wool <= WOOLS; wool++) {
      for (const lid of [false, true]) {
        for (const foil of [false, true]) {
          const out = inner + wool * LAYER + (foil ? FOIL_W : 0)
          const solids: Box[] = [
            { left: CX - out, right: CX + out, top: WOOL_TOP, bottom: BASE },
            { left: CX - inner, right: CX + inner, top: RIM, bottom: BASE },
            { left: THERMO.x, right: THERMO.x + THERMO.w, top: THERMO.y, bottom: THERMO.y + THERMO.h },
          ]
          if (lid) solids.push({ left: CX - inner - 5, right: CX + inner + 5, top: LID_Y - 6, bottom: LID_Y + 8 })
          for (const [t, p] of names) {
            for (const s of solids) expect(hits(labelBox(t, p), s), `${t} on ${JSON.stringify({ wool, lid, foil })}`).toBe(false)
            expect(labelBox(t, p).left).toBeGreaterThanOrEqual(2)
            expect(labelBox(t, p).right).toBeLessThanOrEqual(W - 2)
          }
        }
      }
    }
    // Neither do the names touch each other.
    for (const [a, p] of names) for (const [b, q] of names) if (a !== b) expect(hits(labelBox(a, p), labelBox(b, q))).toBe(false)
  })

  it('wrap: every name sits nearer its own arrow than another’s', () => {
    // The arrows, as the view draws them: conduction at the left, convection above, radiation at the right.
    const arrows: Record<string, { x: number; y: number }> = { conduction: { x: 50, y: 144 }, convection: { x: CX, y: 70 }, radiation: { x: 200, y: 142 } }
    const names: [string, { x: number; y: number; anchor: string }][] = [['conduction', WRAP_LABELS.conduction], ['convection', WRAP_LABELS.convection], ['radiation', WRAP_LABELS.radiation]]
    for (const [t, p] of names) {
      const b = labelBox(t, p)
      const c = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
      const d = (a: { x: number; y: number }) => Math.hypot(a.x - c.x, a.y - c.y)
      for (const other of Object.keys(arrows)) if (other !== t) expect(d(arrows[t]), `${t} vs ${other}`).toBeLessThan(d(arrows[other]))
    }
  })

  it('wrap: the thermometer holds its own scale and target, whatever the target, and fits the plate', () => {
    for (const target of [TARGETS.hot.min, 50, TARGETS.hot.max, TARGETS.cold.min, TARGETS.cold.max]) {
      const html = renderToStaticMarkup(createElement(ThermalTransferView, { config: wrapCfg(target > 20 ? 'hot' : 'cold', 30, target, [...PARTS]), state: {}, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      const line = html.match(new RegExp(`data-target="${target}"><line x1="([\\d.]+)" x2="([\\d.]+)"`))
      expect(line, `${target}`).not.toBeNull()
      expect(Number(line![2]) + 40).toBeLessThanOrEqual(THERMO.x + THERMO.w)
    }
    expect(THERMO.x + THERMO.w).toBeLessThanOrEqual(W - 4)
    expect(WRAP_LABELS.water.x).toBeGreaterThan(THERMO.x)
  })

  it('beads: nothing falls off the plate, and every ball and name has its own room', () => {
    for (const n of [2, 3]) {
      const rows = rowsOf(n)
      expect(rows).toHaveLength(n)
      for (let i = 0; i < n; i++) {
        // A rod, its hanging ball, and the tray under it all lie on the plate.
        expect(rows[i] - 14).toBeGreaterThan(0)
        expect(rows[i] + 31.5).toBeLessThan(205)
        if (i) expect(rows[i] - rows[i - 1]).toBeGreaterThanOrEqual(50)
        // The name sits above the rod, clear of the bath and the tank wall.
        const name = labelBox('aluminium', { x: X0 + 6, y: rows[i] - 10, anchor: 'start' })
        expect(name.bottom).toBeLessThan(rows[i] - 4.5)
        expect(name.left).toBeGreaterThan(75)
        if (i) expect(name.top).toBeGreaterThan(rows[i - 1] + 31.5)
      }
    }
    const bath = labelBox('boiling water', { ...BEADS_LABELS.bath, anchor: 'start' })
    expect(bath.bottom).toBeLessThan(22)
    expect(bath.right).toBeLessThan(W)
    expect(H).toBeGreaterThan(200)
    expect(WRAP_H).toBeGreaterThan(BASE + 8)
  })

  it('the tallest the card gets is held down: a marked card still fits the board', () => {
    // The two longest things said when marked; at 12 px on a 380 px card, 60 characters make a line.
    const long = [
      working(wrapCfg('cold', 30, 10, [...PARTS]), engine.solve(wrapCfg('cold', 30, 10, [...PARTS]))),
      working(beadsCfg(['brass', 'copper', 'iron']), engine.solve(beadsCfg(['brass', 'copper', 'iron']))),
    ]
    for (const said of long) expect(said.length).toBeLessThan(420)
  })
})
