// lib/studylab/engines/energy-track/energy-track.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  energyTrackEngine as engine, FLAG, FLOOR, MASS, RELEASE_MAX, ROUGH_FIXED, ROUGH_SET, WALL, advance, endX, heightAt, lossAt, madeText, reach, startX, stores, working,
  type EnergyTrackConfig, type EnergyTrackState,
} from './config'
import { BAR_UNIT, BAR_X, BASE, EnergyTrackView, H, UX, UY, W, X0, ballAt, labelsFor, px, py, totalLine, type Label, type Pt } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const BALLS = ['light', 'heavy'] as const
const RELEASES: EnergyTrackConfig[] = BALLS.flatMap((ball) => range(FLAG.lo, FLAG.hi).flatMap((flag) =>
  range(ROUGH_FIXED.lo, ROUGH_FIXED.hi).map((rough) => ({ task: 'release', flag, rough, ball }) as EnergyTrackConfig)))
const ROUGHS: EnergyTrackConfig[] = BALLS.flatMap((ball) => range(FLAG.lo, FLAG.hi).flatMap((flag) =>
  range(1, ROUGH_SET.hi).filter((d) => flag + d <= RELEASE_MAX).map((d) => ({ task: 'rough', release: flag + d, flag, ball }) as EnergyTrackConfig)))
const ALL = [...RELEASES, ...ROUGHS]
const nameOf = (c: unknown) => JSON.stringify(c)

describe('the physics, from first principles', () => {
  it('height, motion and heat always add up to what the ball started with', () => {
    for (const release of range(1, RELEASE_MAX)) for (const rough of range(0, 4)) for (const mass of [1, 1.5]) {
      const stop = endX(release, rough)
      for (let x = startX(release); x <= stop + 1e-9; x += 0.25) {
        const s = stores(release, rough, mass, x)
        expect(s.height + s.motion + s.heat, `${release} ${rough} ${x}`).toBeCloseTo(release * mass, 9)
        expect(s.motion).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('a smooth floor gives back all the height; a rough floor takes exactly its marks, and the ball stops with no motion', () => {
    for (const release of range(1, RELEASE_MAX)) {
      expect(reach(release, 0)).toBe(release)
      expect(stores(release, 0, 1, endX(release, 0)).motion).toBeCloseTo(0, 9)
      for (const rough of range(1, 4)) {
        const stop = endX(release, rough)
        const s = stores(release, rough, 1, stop)
        expect(s.motion, `${release} ${rough}`).toBeCloseTo(0, 9)
        expect(heightAt(stop)).toBeCloseTo(reach(release, rough), 9)
        if (release > rough) expect(s.heat).toBeCloseTo(rough, 9)
        else expect(s.heat).toBeCloseTo(release, 9) // it all went to heat, and none was destroyed
      }
    }
  })

  it('the height reached does not depend on the ball mass (the mass cancels)', () => {
    for (const release of range(1, RELEASE_MAX)) for (const rough of range(0, 4)) {
      const a = stores(release, rough, MASS.light, endX(release, rough))
      const b = stores(release, rough, MASS.heavy, endX(release, rough))
      expect(b.height / MASS.heavy).toBeCloseTo(a.height / MASS.light, 9)
      expect(b.height).toBeGreaterThanOrEqual(a.height)
    }
  })

  it('the motion store is biggest at the bottom of the hill and is all the energy on a smooth floor', () => {
    for (const release of range(1, RELEASE_MAX)) {
      const s = stores(release, 0, 1, WALL + FLOOR / 2)
      expect(s.motion).toBeCloseTo(release, 9)
      expect(s.height).toBe(0)
    }
  })

  it('friction takes the same energy however the ball arrives: loss grows evenly across the floor only', () => {
    expect(lossAt(0, 3)).toBe(0)
    expect(lossAt(WALL, 3)).toBe(0)
    expect(lossAt(WALL + FLOOR / 2, 3)).toBeCloseTo(1.5, 9)
    expect(lossAt(WALL + FLOOR, 3)).toBe(3)
    expect(lossAt(WALL + FLOOR + 5, 3)).toBe(3)
  })

  it('the run always ends, at a walking pace, and never past the turning point', () => {
    for (const release of range(1, RELEASE_MAX)) for (const rough of range(0, 4)) {
      let x = startX(release)
      let t = 0
      const stop = endX(release, rough)
      while (x < stop && t < 30) { x = advance(release, rough, x, 1 / 60); t += 1 / 60 }
      expect(x, `${release} ${rough}`).toBe(stop)
      expect(t, `${release} ${rough}`).toBeGreaterThan(1)
      expect(t, `${release} ${rough}`).toBeLessThan(12)
    }
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(ALL.length).toBeGreaterThan(50)
  })

  it('the first run misses by more than a whole mark', () => {
    for (const c of ALL) {
      const s = engine.initial(c)
      const up = c.task === 'release' ? reach(s.release!, c.rough) : reach(c.release, s.rough!)
      expect(Math.abs(up - c.flag), nameOf(c)).toBeGreaterThanOrEqual(1)
    }
  })

  it('can be solved by taps from the start, one mark at a time', () => {
    for (const c of ALL) {
      const key = c.task === 'release' ? 'release' : 'rough'
      const [lo, hi] = c.task === 'release' ? [1, 9] : [ROUGH_SET.lo, ROUGH_SET.hi]
      const start = engine.initial(c)[key]!
      const stops = range(lo, hi).filter((v) => engine.check(c, { [key]: v }).ok)
      expect(stops.length, nameOf(c)).toBe(1)
      expect(Math.abs(stops[0] - start)).toBeGreaterThan(0)
    }
  })

  it('refuses a state outside what can be set', () => {
    const c: EnergyTrackConfig = { task: 'release', flag: 4, rough: 2, ball: 'light' }
    expect(engine.check(c, { release: 6.5 }).ok).toBe(false)
    expect(engine.check(c, { release: 99 }).ok).toBe(false)
    expect(engine.check(c, {}).ok).toBe(false)
  })

  it('says something true when marked, and what was made when wrong', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'release' ? c.rough > 0 : c.release > c.flag) expect(said).toMatch(/heat/)
      if (c.ball === 'heavy') expect(said).toMatch(/same mark/)
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(wrong).toMatch(/started \d marks? up/)
    }
    expect(madeText({ task: 'release', flag: 4, rough: 3, ball: 'light' }, { release: 2 })).toMatch(/stopped on the floor/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'friction', release: '7 marks', flag: 4 })).toEqual({ task: 'rough', release: 7, flag: 4, ball: 'light' })
    expect(engine.parse({ task: 'Release height', flag: 5, friction: 'smooth' })).toEqual({ task: 'release', flag: 5, rough: 0, ball: 'light' })
    expect(engine.parse({ task: { kind: 'conservation of energy', target: 3, rough: 2, ball: 'heavy' } })).toEqual({ task: 'release', flag: 3, rough: 2, ball: 'heavy' })
    expect(engine.parse({ task: 'kinetic energy' })).toEqual({ task: 'release', flag: 4, rough: 0, ball: 'light' })
    expect(engine.parse({ task: 'rough' })).toEqual({ task: 'rough', release: 7, flag: 5, ball: 'light' })
  })

  it('fills in what the tutor left out, with something that works', () => {
    for (const raw of [{ task: 'release' }, { task: 'rough' }, { task: 'rough', release: 9 }, { task: 'rough', release: 3 }, { task: 'rough', release: 2 }]) {
      const c = engine.parse(raw)!
      expect(c, nameOf(raw)).not.toBeNull()
      if ((raw as { release?: number }).release === undefined || (raw as { release?: number }).release! >= 7) expect(engine.faults(c), nameOf(raw)).toEqual([])
    }
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('release')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'loop' })).toBeNull()
    expect(engine.parse({ task: 'release', flag: 'a lot' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'release', flag: 12 })).not.toBeNull() // too high: faults says what works
    expect(engine.parse({ task: 'rough', release: 12, flag: 4 })).not.toBeNull()
  })

  const fixOf = (said: string): Record<string, number> => Object.fromEntries([...said.matchAll(/e\.g\. ((?:\w+ \d+(?:, )?)+)/g)].flatMap((m) =>
    [...m[1].matchAll(/(\w+) (\d+)/g)].map((p) => [p[1], Number(p[2])])))

  it('refuses what cannot be drawn, naming the limit and a nearby example that works', () => {
    const cases: [EnergyTrackConfig, RegExp][] = [
      [{ task: 'release', flag: 8, rough: 1, ball: 'light' }, /from 2 to 6/],
      [{ task: 'release', flag: 1, rough: 0, ball: 'light' }, /from 2 to 6/],
      [{ task: 'release', flag: 4, rough: 5, ball: 'light' }, /0 \(smooth\) to 3/],
      [{ task: 'release', flag: 4.5, rough: 1, ball: 'light' }, /whole number/],
      [{ task: 'rough', release: 12, flag: 4, ball: 'light' }, /at most 9/],
      [{ task: 'rough', release: 4, flag: 4, ball: 'light' }, /never reach/],
      [{ task: 'rough', release: 9, flag: 2, ball: 'light' }, /roughest/],
      [{ task: 'rough', release: 7, flag: 9, ball: 'light' }, /from 2 to 6/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fix = fixOf(f[0])
      const fixed = { ...c, ...fix } as EnergyTrackConfig
      expect(engine.faults(fixed), `${nameOf(fixed)} from ${f[0]}`).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: EnergyTrackConfig, p: string) => engine.promptFaults!(c, p)
  const release: EnergyTrackConfig = { task: 'release', flag: 4, rough: 2, ball: 'light' }
  const rough: EnergyTrackConfig = { task: 'rough', release: 7, flag: 4, ball: 'heavy' }

  it('asking for the outcome is fine', () => {
    expect(pf(release, 'Press the + and − buttons to raise or lower the ball until it just reaches the flag.')).toEqual([])
    expect(pf(rough, 'Press the + and − buttons to change the floor until the ball just reaches the flag.')).toEqual([])
    expect(pf(release, 'Get the ball to just reach the flag.')).toEqual([])
  })

  it('a number, the rule or the way to move is not', () => {
    for (const p of ['Release the ball 6 marks up.', 'Make the ball start higher than the flag.', 'The floor takes energy as heat: reach the flag.', 'Energy is conserved, so reach the flag.',
      'The ball loses some energy to friction.', 'Potential energy becomes kinetic energy: reach the flag.', 'Convert it so the ball reaches the flag.']) {
      expect(pf(release, p), p).toHaveLength(1)
    }
    for (const p of ['Make the floor rougher until the ball reaches the flag.', 'Smoothen the floor.', 'Set friction to 2 marks.', 'The heavy ball needs a smoother floor.']) {
      expect(pf(rough, p), p).toHaveLength(1)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: EnergyTrackConfig) => pf(c, 'Reach it at 3 marks.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) expect(pf(c, quoted(c)), nameOf(c)).toEqual([])
    expect(quoted(release)).toMatch(/ball/)
    expect(quoted(rough)).toMatch(/floor/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"energy-track", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task)).size).toBe(2)
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "energy-track"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'energy-track')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Work, energy and power', 'Energy stores and transfers', 'Kinetic energy', 'Gravitational potential energy', 'Conservation of energy', 'Energy transfers and conservation',
      'Work, Power and Energy', 'Mechanical energy', 'Energy changes in a roller coaster: potential and kinetic', 'Energy transformations', 'Work and energy',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words', () => {
    for (const st of [
      'Energy transfer in food chains', 'Energy flow in ecosystems', 'Energy stores in the body', 'Bond energies', 'Energy changes in reactions', 'Reaction profiles and activation energy',
      'Renewable energy sources', 'Energy bills and the cost of electricity', 'Energy management', 'Electrical energy and power', 'Kinetic theory of gases', 'Kinetic model of matter',
      'Wildlife conservation', 'Conservation of mass', 'Conservation of momentum', 'Elastic potential energy and springs', 'Electric potential energy', 'Potential difference', 'Potential customers',
      'Thermal energy transfer by conduction', 'Heat transfer', 'Energy levels in atoms', 'Nuclear energy', 'Energy in food', 'Respiration and energy release in cells', 'Energy efficiency of appliances',
      'Rates of reaction and kinetics', 'Photosynthesis and energy', 'Energy resources', 'Tracks and field events', 'Food stores', 'Track and trace', 'Stores and shops',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('energy-track')).toBe(engine)
    expect(engine.isolates).toBe('quantity')
    expect(engine.prompt).toMatch(/SCENE "energy-track"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:energy-track"/)
    expect(engine.prompt).toContain(`${FLAG.lo} to ${FLAG.hi}`)
    expect(engine.prompt).toContain(`0 (smooth) to ${ROUGH_FIXED.hi}`)
    expect(engine.prompt).toContain(`up to ${RELEASE_MAX}`)
  })
})

describe('a still frame is a frame a learner sees', () => {
  const box = (l: Label) => {
    const wide = l.text.length * 7.8
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - wide : l.x - wide / 2
    return { left, right: left + wide, top: l.y - 12, bottom: l.y + 3 }
  }
  type Box = ReturnType<typeof box>
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const frames = (c: EnergyTrackConfig) => [engine.initial(c), engine.solve(c)]

  it('agrees with what the view writes out as literals', () => {
    expect(UX).toBe(8)
    expect(WALL * UX + FLOOR * UX + WALL * UX + X0).toBeLessThan(220) // the whole track clears the bars
    expect(X0 + 25 * UX).toBe(px(WALL + FLOOR + WALL))
    expect(UY).toBe(15)
    expect(BAR_UNIT).toBe(UY)
    expect(py(0)).toBe(BASE)
    expect(WALL).toBe(9)
    expect(FLOOR).toBe(7)
  })

  it('nothing is named off the stage and no name touches another, at the start or when solved', () => {
    for (const c of ALL) for (const s of frames(c)) for (const withBall of [true, false]) {
      const labels = [...labelsFor(c, s, withBall), totalLine(c, s).label]
      const boxes = labels.map(box)
      boxes.forEach((a, i) => {
        expect(a.left, `${labels[i].text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(a.right, `${labels[i].text} ${nameOf(c)}`).toBeLessThanOrEqual(W)
        expect(a.top, `${labels[i].text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(a.bottom, `${labels[i].text} ${nameOf(c)}`).toBeLessThanOrEqual(H)
        boxes.forEach((b, j) => { if (j > i) expect(hits(a, b), `${labels[i].text} / ${labels[j].text} ${nameOf(c)} ${nameOf(s)}`).toBe(false) })
      })
    }
  })

  it('every name sits nearer its own part than any other part', () => {
    for (const c of ALL) for (const s of frames(c)) {
      const labels = [...labelsFor(c, s, true), totalLine(c, s).label]
      for (const l of labels) {
        const b = box(l)
        const here = { x: (b.left + b.right) / 2, y: l.y - 5 }
        for (const other of labels) {
          if (other === l) continue
          expect(dist(here, l.part), `${l.text} is nearer ${other.text}'s part in ${nameOf(c)} ${nameOf(s)}`).toBeLessThan(dist(here, other.part))
        }
      }
    }
  })

  it('the ball is named above the ball, clear of it', () => {
    for (const c of ALL) for (const s of frames(c)) {
      const release = s.release ?? (c.task === 'rough' ? c.release : 0)
      const ball = ballAt(c, startX(release))
      const l = labelsFor(c, s, true)[0]
      expect(l.text).toMatch(/ball/)
      expect(box(l).bottom, `ball name over ball ${nameOf(c)}`).toBeLessThanOrEqual(ball.y)
    }
  })

  it('the bars, their total line and the ball stay on the stage', () => {
    for (const c of ALL) for (const release of range(1, RELEASE_MAX)) {
      const mass = MASS[c.ball]
      expect(BASE - release * mass * BAR_UNIT - 18, nameOf(c)).toBeGreaterThanOrEqual(0)
      expect(BAR_X[2] + 12).toBeLessThanOrEqual(W)
      for (const x of [startX(release), WALL + 3, endX(release, 0)]) {
        const b = ballAt(c, x)
        const r = c.ball === 'heavy' ? 12 : 8
        expect(b.x - r).toBeGreaterThanOrEqual(0)
        expect(b.x + r).toBeLessThan(222)
        expect(b.y - r).toBeGreaterThanOrEqual(0)
        expect(b.y + r).toBeLessThanOrEqual(BASE + 0.001)
      }
    }
  })

  it('one smallest move changes the drawing by plenty', () => {
    const c: EnergyTrackConfig = { task: 'release', flag: 4, rough: 2, ball: 'light' }
    const a = ballAt(c, endX(5, 2))
    const b = ballAt(c, endX(6, 2))
    expect(dist(a, b)).toBeGreaterThan(14)
    expect(py(reach(6, 2)) - py(reach(5, 2))).toBe(-UY)
    expect(totalLine(c, { release: 5 }).y - totalLine(c, { release: 6 }).y).toBeGreaterThanOrEqual(15)
  })
})

describe('the energy-track scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'energy-track', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: EnergyTrackConfig, state: EnergyTrackState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(EnergyTrackView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [EnergyTrackConfig, string][] = [
    [{ task: 'release', flag: 4, rough: 2, ball: 'light' }, 'Press the + and − buttons to raise or lower the ball until it just reaches the flag.'],
    [{ task: 'rough', release: 7, flag: 4, ball: 'heavy' }, 'Press the + and − buttons to change the floor until the ball just reaches the flag.'],
  ]

  it('before marking, nothing says the answer, the rule or a mark count', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['marks', 'Yes', 'conserv', 'lost', 'friction', 'spread out', 'always add up', 'cancels', 'started']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
      expect(shown.replace(/&#x27;/g, "'")).not.toMatch(/\d/)
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const t = text(raw({ task: 'release', flag: 4, rough: 2, ball: 'light' }, { release: 6 }, 'idle'))
    for (const name of ['ball', 'flag', 'floor', 'height', 'motion', 'heat', 'total']) expect(t).toContain(name)
    expect(text(raw({ task: 'rough', release: 7, flag: 4, ball: 'heavy' }, { rough: 1 }, 'idle'))).toContain('heavy ball')
  })

  it('marking says where the energy went, or what the learner made', () => {
    expect(text(raw({ task: 'release', flag: 4, rough: 2, ball: 'light' }, { release: 6 }, 'right'))).toMatch(/turned 2 marks of its height energy into heat, which is not lost/)
    expect(text(raw({ task: 'release', flag: 4, rough: 0, ball: 'light' }, { release: 4 }, 'right'))).toMatch(/no energy was lost/)
    expect(text(raw({ task: 'release', flag: 4, rough: 2, ball: 'light' }, { release: 9 }, 'wrong'))).toContain('started 9 marks up, the floor took 2 marks as heat, and it climbed 7 marks. The flag is 4 marks up.')
    expect(text(raw({ task: 'rough', release: 7, flag: 4, ball: 'heavy' }, { rough: 3 }, 'right'))).toMatch(/heavy ball has more energy in every store/)
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const shown = raw({ task: 'release', flag: 4, rough: 2, ball: 'light' }, { release: 9 }, 'shown', true)
    expect(shown).toContain('fill="#5FD38D"')
    expect(text(shown)).toMatch(/climbed only 4 marks/)
  })

  it('has two real buttons with names, reachable by keys, that lock when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      expect((idle.match(/<button/g) ?? []).length, nameOf(cfg)).toBe(2)
      expect(idle).toMatch(/aria-label="(?:Lower the ball|Make the floor smoother)"/)
      expect(idle).toMatch(/aria-label="(?:Raise the ball|Make the floor rougher)"/)
      expect(idle).toContain('nodrag')
      expect(raw(cfg, engine.solve(cfg), 'right').match(/disabled=""/g)?.length, nameOf(cfg)).toBe(2)
    }
  })

  it('the still frame changes with every move, with nothing moving by itself under reduced motion', () => {
    const c: EnergyTrackConfig = { task: 'release', flag: 4, rough: 2, ball: 'light' }
    expect(raw(c, { release: 6 }, 'idle', true)).not.toBe(raw(c, { release: 7 }, 'idle', true))
    const r: EnergyTrackConfig = { task: 'rough', release: 7, flag: 4, ball: 'light' }
    expect(raw(r, { rough: 1 }, 'idle', true)).not.toBe(raw(r, { rough: 2 }, 'idle', true))
    expect(raw(c, { release: 6 }, 'idle', true)).not.toMatch(/transition|animate/)
    // the ball appears twice under reduced motion: where it starts and a dashed ghost where it turns
    expect(raw(c, { release: 6 }, 'idle', true)).toContain('stroke-dasharray="4 4"')
  })

  it('the flag fills in when the ball reaches it, and not before', () => {
    const c: EnergyTrackConfig = { task: 'release', flag: 4, rough: 2, ball: 'light' }
    const fill = (s: EnergyTrackState) => /<path d="M 1 -30 L 21 -23 L 1 -16 Z" fill="([^"]+)"/.exec(raw(c, s, 'idle', true))![1]
    expect(fill({ release: 6 })).toBe('#5FD38D')
    expect(fill({ release: 7 })).toBe('#0F1722')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
