// lib/studylab/engines/tectonics/tectonics.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  tectonicsEngine as engine, DIRS, ENOUGH, HAZARDS, H, KINDS, LANDFORMS, RUN, SKY_Y, STEPS, W,
  describe as describeScene, done, madeText, outcomeOf, sceneOf, solutions, textWidth, working,
  type Dir, type Kind, type Pt, type Scene, type TectConfig, type TectState,
} from './config'
import { H as VH, TectonicsView, TOP, W as VW } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const TARGETS = [...LANDFORMS, ...HAZARDS]
const ALL: TectConfig[] = KINDS.flatMap((left) => KINDS.flatMap((right) => TARGETS.map((target) => ({ task: (HAZARDS as readonly string[]).includes(target) ? 'hazard' : 'landform', left, right, target }) as TectConfig)))
const VALID = ALL.filter((c) => solutions(c).length > 0)
const nameOf = (c: TectConfig) => JSON.stringify(c)
const TIMES = [0, 0.1, 0.25, 0.5, 0.75, 1]

describe('reading a config', () => {
  it('reads the plain form, and the usual other ways of writing it', () => {
    expect(engine.parse({ task: 'landform', left: 'ocean', right: 'continent', target: 'trench' })).toEqual({ task: 'landform', left: 'ocean', right: 'continent', target: 'trench' })
    expect(engine.parse({ target: 'fold mountains' })).toEqual({ task: 'landform', left: 'continent', right: 'continent', target: 'fold-mountains' })
    expect(engine.parse({ task: 'landform', plates: 'oceanic and continental', target: 'Ocean trench' })).toEqual({ task: 'landform', left: 'ocean', right: 'continent', target: 'trench' })
    expect(engine.parse({ boundary: 'continental-continental', landform: 'rift valley' })).toMatchObject({ left: 'continent', right: 'continent', target: 'rift-valley' })
    expect(engine.parse({ left: 'Oceanic', right: 'Oceanic', target: 'mid-ocean ridge' })).toEqual({ task: 'landform', left: 'ocean', right: 'ocean', target: 'ridge' })
    expect(engine.parse({ target: 'deep earthquakes' })).toMatchObject({ task: 'hazard', target: 'deep-earthquakes' })
    expect(engine.parse({ task: 'hazard', target: 'earthquakes but no volcanoes' })).toMatchObject({ task: 'hazard', target: 'quakes-no-volcanoes' })
    expect(engine.parse({ task: 'hazard', target: 'volcanoes with shallow earthquakes' })).toMatchObject({ target: 'volcanoes-shallow-quakes' })
    expect(engine.parse({ target: 'deep ocean trench' })).toMatchObject({ task: 'landform', target: 'trench' })
    expect(engine.parse({ target: 'volcanic island arc' })).toMatchObject({ target: 'island-arc', left: 'ocean', right: 'ocean' })
    expect(engine.parse({ target: 'volcanic mountains', left: 'continent', right: 'ocean' })).toMatchObject({ target: 'volcanic-mountains', left: 'continent', right: 'ocean' })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 3, 'trench', [], {}, { task: 'landform' }, { target: 5 }]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
  })

  it('reads a target or crust it cannot draw, and faults says what would work', () => {
    const c = engine.parse({ task: 'landform', left: 'ocean', right: 'continent', target: 'fold-mountains' })!
    expect(c).not.toBeNull()
    const f = engine.faults(c)
    expect(f.length).toBe(1)
    expect(f[0]).toContain('left "continent", right "continent"')
    const g = engine.faults(engine.parse({ task: 'landform', target: 'volcano' })!)
    expect(g[0]).toContain('use one of')
    const h = engine.faults(engine.parse({ task: 'landform', left: 'mantle', right: 'ocean', target: 'ridge' })!)
    expect(h[0]).toContain('use "ocean" or "continent"')
    const crossed = engine.faults({ task: 'landform', left: 'ocean', right: 'continent', target: 'deep-earthquakes' })
    expect(crossed[0]).toContain('use one of')
    expect(engine.faults({ task: 'hazard', left: 'continent', right: 'continent', target: 'deep-earthquakes' })[0]).toContain('left "ocean", right "continent"')
  })

  it('refuses nothing that can be drawn and solved, and names a nearby fix for what cannot', () => {
    for (const c of ALL) {
      const f = engine.faults(c)
      if (solutions(c).length > 0) expect(f, nameOf(c)).toEqual([])
      else {
        expect(f.length, nameOf(c)).toBe(1)
        expect(f[0], nameOf(c)).toMatch(/left "\w+", right "\w+"/)
        const [, left, right] = /left "(\w+)", right "(\w+)"/.exec(f[0])!
        const repaired = { ...c, left, right }
        expect(engine.faults(repaired), nameOf(c)).toEqual([])
      }
    }
  })
})

describe('the rules', () => {
  it('has the meetings a school course teaches', () => {
    expect(outcomeOf('ocean', 'continent', 'together')).toMatchObject({ id: 'subduction', volcanoes: true, deep: true })
    expect(outcomeOf('ocean', 'ocean', 'together').landforms).toEqual(['trench', 'island-arc'])
    expect(outcomeOf('continent', 'continent', 'together')).toMatchObject({ id: 'collision', volcanoes: false, deep: false, landforms: ['fold-mountains'] })
    expect(outcomeOf('ocean', 'ocean', 'apart').landforms).toEqual(['ridge'])
    expect(outcomeOf('continent', 'continent', 'apart')).toMatchObject({ id: 'rift', volcanoes: true, deep: false })
    for (const k of KINDS) for (const j of KINDS) expect(outcomeOf(k, j, 'past')).toMatchObject({ id: 'fault', volcanoes: false, deep: false, landforms: [] })
  })

  it('the volcanoes and the deep earthquakes it marks to are the ones it draws', () => {
    for (const l of KINDS) {
      for (const r of KINDS) {
        for (const d of DIRS) {
          const o = outcomeOf(l, r, d)
          const f = sceneOf(l, r, d, 1).facts
          expect(f.cones > 0, `${l} ${r} ${d} cones`).toBe(o.volcanoes && o.id !== 'ridge' ? true : o.id === 'ridge' ? true : false)
          expect(f.foci, `${l} ${r} ${d} foci`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('earthquakes only run deep where the plate sinks', () => {
    const deepest = (s: Scene) => Math.max(...s.foci.map((p) => p.y))
    const sub = sceneOf('ocean', 'continent', 'together', 1)
    for (const [l, r, d] of [['continent', 'continent', 'together'], ['ocean', 'ocean', 'apart'], ['continent', 'continent', 'apart'], ['ocean', 'continent', 'past']] as [Kind, Kind, Dir][]) {
      expect(deepest(sceneOf(l, r, d, 1)), `${l} ${r} ${d}`).toBeLessThan(deepest(sub) - 30)
    }
  })

  it('every valid config starts unsolved and can always be solved', { timeout: 30_000 }, () => {
    expect(VALID.length).toBeGreaterThan(20)
    for (const c of VALID) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.check(c, engine.initial(c)).ok, `${nameOf(c)} initial`).toBe(false)
      const s = engine.solve(c)
      expect(engine.check(c, s).ok, `${nameOf(c)} solve`).toBe(true)
      expect(s.step).toBe(RUN)
      expect(engine.check(c, s).wrongIds).toEqual([])
      const ok = solutions(c)
      for (const dir of DIRS) {
        for (let step = 0; step <= STEPS; step++) {
          const st: TectState = { dir, step }
          expect(done(c, st), `${nameOf(c)} ${dir} ${step}`).toBe(ok.includes(dir) && step >= ENOUGH)
        }
      }
      expect(done(c, { dir: null, step: 3 })).toBe(false)
    }
  })

  it('every landform and hazard can be made with at least one pair of crusts, and the defaults make them', () => {
    for (const target of TARGETS) {
      const c = engine.parse({ target })!
      expect(engine.faults(c), target).toEqual([])
      expect(solutions(c).length, target).toBeGreaterThan(0)
    }
    // Two movements make "earthquakes with no volcano" between continents: either is marked right.
    expect(solutions({ task: 'hazard', left: 'continent', right: 'continent', target: 'quakes-no-volcanoes' })).toEqual(['past', 'together'])
  })

  it('says what was made, in plain words, once marked', () => {
    const c: TectConfig = { task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }
    expect(madeText(c, { dir: 'apart', step: 3 }).lead).toMatch(/pulled the plates apart.*ridge/)
    expect(madeText(c, { dir: 'past', step: 3 }).lead).toMatch(/slid the plates past/)
    expect(madeText(c, { dir: null, step: 0 }).lead).toMatch(/did not move/)
    expect(madeText(c, { dir: 'together', step: 1 }).lead).toMatch(/right movement.*too little time/)
    expect(working(c, { dir: 'together', step: 3 }).lead).toMatch(/^Yes\. You pushed the plates together/)
    expect(madeText(c, { dir: 'apart', step: 3 }).more).toMatch(/trench/i)
  })
})

const pointsOf = (s: Scene): Pt[] => s.polys.flatMap((p) => p.pts)

describe('the drawing', { timeout: 30_000 }, () => {
  it('keeps every shape on or just beyond the plate, and every earthquake dot on it', () => {
    for (const l of KINDS) {
      for (const r of KINDS) {
        for (const d of [null, ...DIRS]) {
          for (const t of TIMES) {
            const s = sceneOf(l, r, d, t)
            const label = `${l} ${r} ${d} ${t}`
            for (const p of pointsOf(s)) {
              expect(p.x, label).toBeGreaterThanOrEqual(-12)
              expect(p.x, label).toBeLessThanOrEqual(W + 12)
              expect(p.y, label).toBeGreaterThanOrEqual(SKY_Y + 6)
              expect(p.y, label).toBeLessThanOrEqual(H + 90)
              expect(Number.isFinite(p.x) && Number.isFinite(p.y), label).toBe(true)
            }
            for (const f of s.foci) {
              expect(f.x, label).toBeGreaterThan(6)
              expect(f.x, label).toBeLessThan(W - 6)
              expect(f.y, label).toBeGreaterThan(60)
              expect(f.y, label).toBeLessThan(H - 6)
            }
            for (let i = 0; i < s.foci.length; i++) for (let j = i + 1; j < s.foci.length; j++) expect(Math.hypot(s.foci[i].x - s.foci[j].x, s.foci[i].y - s.foci[j].y), `${label} dots ${i} ${j}`).toBeGreaterThan(8)
          }
        }
      }
    }
  })

  it('makes a clear change from the smallest move: each step adds to what is drawn', () => {
    for (const [l, r, d] of [['ocean', 'continent', 'together'], ['continent', 'continent', 'together'], ['ocean', 'ocean', 'apart'], ['continent', 'continent', 'apart'], ['ocean', 'ocean', 'past']] as [Kind, Kind, Dir][]) {
      let before = JSON.stringify(sceneOf(l, r, d, 0))
      for (let step = 1; step <= STEPS; step++) {
        const now = JSON.stringify(sceneOf(l, r, d, step / STEPS))
        expect(now, `${l} ${r} ${d} step ${step}`).not.toBe(before)
        before = now
      }
      // And the move itself: before any choice the section is still, and one press changes it.
      expect(JSON.stringify(sceneOf(l, r, null, 0))).not.toBe(JSON.stringify(sceneOf(l, r, d, RUN / STEPS)))
    }
    const rest = sceneOf('ocean', 'continent', null, 0)
    expect(rest.foci).toEqual([])
    expect(rest.arrows).toEqual([])
  })

  it('draws the ocean on the left, or turns the section round when the continent is named first', () => {
    const a = sceneOf('ocean', 'continent', 'together', 0.75)
    const b = sceneOf('continent', 'ocean', 'together', 0.75)
    expect(b.foci).toEqual(a.foci.map((p) => ({ x: Math.round((W - p.x) * 10) / 10, y: p.y })))
    expect(b.tags.find((t) => t.text === 'Sea')!.anchor).toBe('end')
    expect(a.tags.find((t) => t.text === 'Sea')!.anchor).toBe('start')
  })

  it('names only the parts before marking, never the landform', () => {
    for (const l of KINDS) {
      for (const r of KINDS) {
        const names = sceneOf(l, r, 'together', 0.75).tags.map((t) => t.text)
        expect(names.length).toBeLessThanOrEqual(5)
        for (const n of names) expect(['Sea', 'Oceanic crust', 'Continental crust', 'Continent', 'Mantle']).toContain(n)
      }
    }
  })

  it('keeps every label nearer its own part than any other, and nothing touching', () => {
    const box = (t: { x: number; y: number; anchor: string; text: string }) => {
      const w = textWidth(t.text)
      const x1 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2
      return { x1, x2: x1 + w, y1: t.y - 11, y2: t.y + 3 }
    }
    const hit = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.x1 < b.x2 + 3 && b.x1 < a.x2 + 3 && a.y1 < b.y2 + 2 && b.y1 < a.y2 + 2
    for (const l of KINDS) {
      for (const r of KINDS) {
        for (const d of DIRS) {
          for (const t of [0.5, 0.75, 1]) {
            const s = sceneOf(l, r, d, t)
            const all = [...s.tags, ...s.answerTags]
            const label = `${l} ${r} ${d} ${t}`
            for (const g of all) {
              const b = box(g)
              expect(b.x1, `${label} ${g.text}`).toBeGreaterThanOrEqual(2)
              expect(b.x2, `${label} ${g.text}`).toBeLessThanOrEqual(W - 2)
            }
            for (let i = 0; i < all.length; i++) {
              for (let j = i + 1; j < all.length; j++) expect(hit(box(all[i]), box(all[j])), `${label} ${all[i].text} / ${all[j].text}`).toBe(false)
              const own = Math.hypot(all[i].part.x - all[i].x, all[i].part.y - all[i].y)
              if (all[i].leader) {
                // A leader runs from the sky row down to a part that is below the label.
                expect(all[i].part.y, `${label} ${all[i].text}`).toBeGreaterThan(all[i].y + 4)
                continue
              }
              for (let j = 0; j < s.tags.length; j++) {
                if (j === i || all[i] === s.tags[j]) continue
                const centre = (g: typeof all[number]) => ({ x: g.anchor === 'start' ? g.x + textWidth(g.text) / 2 : g.anchor === 'end' ? g.x - textWidth(g.text) / 2 : g.x, y: g.y - 4 })
                const c = centre(all[i])
                expect(Math.hypot(all[i].part.x - c.x, all[i].part.y - c.y), `${label} ${all[i].text} part vs ${s.tags[j].text}`).toBeLessThan(Math.hypot(s.tags[j].part.x - c.x, s.tags[j].part.y - c.y))
              }
              expect(own).toBeLessThan(90)
            }
          }
        }
      }
    }
  })

  it('draws no label over the peaks: the answer names sit in a row above the highest ground', () => {
    for (const l of KINDS) {
      for (const r of KINDS) {
        for (const d of DIRS) {
          const s = sceneOf(l, r, d, 1)
          const highest = Math.min(...pointsOf(s).map((p) => p.y))
          expect(highest, `${l} ${r} ${d}`).toBeGreaterThanOrEqual(SKY_Y + 4)
        }
      }
    }
  })

  it('names in sentence case', () => {
    for (const l of KINDS) for (const r of KINDS) for (const d of DIRS) for (const g of [...sceneOf(l, r, d, 1).tags, ...sceneOf(l, r, d, 1).answerTags]) expect(g.text, g.text).not.toMatch(/\b[A-Z][a-z]+ [A-Z]/)
  })

  it('writes what it shows without naming it', () => {
    for (const l of KINDS) {
      for (const r of KINDS) {
        for (const d of DIRS) {
          const text = describeScene(l, r, d, 3)
          expect(text).not.toMatch(/trench|subduct|fold|rift|ridge|island arc|fault line|collision|converg|diverg|transform|volcano/i)
        }
      }
    }
    expect(describeScene('ocean', 'continent', null, 0)).toContain('Nothing is moving yet')
    expect(describeScene('ocean', 'continent', 'together', 3)).toMatch(/bends down/)
    expect(describeScene('continent', 'continent', 'apart', 3)).toMatch(/dropped/)
  })
})

describe('what the prompt may say', () => {
  const goods = TARGETS.map((t) => engine.parse({ target: t })!)

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"tectonics", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    // The example configs in the entry's config lines too, each with the prompt it says.
    const lines = [...engine.prompt.matchAll(/config: (\{[^}]*\})\s+-- the prompt says "([^"]*)"|or (\{[^}]*\})\s+-- the prompt says "([^"]*)"/g)]
    expect(lines.length).toBe(4)
    for (const m of lines) {
      const c = engine.parse(JSON.parse(m[1] ?? m[3]))!
      expect(engine.faults(c)).toEqual([])
      expect(engine.promptFaults!(c, m[2] ?? m[4])).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['landform', 'hazard']))
  })

  it('has a prompt that passes for every target, which says the gesture', () => {
    for (const c of goods) {
      const ex = engine.promptFaults!(c, 'x')
      const text = /"([^"]*)"\)/.exec(ex.join(' '))![1]
      expect(engine.promptFaults!(c, text), c.target).toEqual([])
      expect(text).toMatch(/Choose how the two plates move, then step the time on/)
    }
  })

  it('refuses a prompt that gives the movement away', () => {
    const c = goods[0]
    for (const bad of [
      'Push the plates together to make a deep ocean trench.', 'Pull the plates apart to form a ridge.', 'Make the plates collide and form a trench.', 'The oceanic plate sinks beneath the continent: make a trench.',
      'Slide the plates past each other until a trench forms.', 'Where plates converge, build a trench.', 'Choose a destructive margin and make a trench.', 'Move the plates towards each other to build a trench.',
      'Make the plates move apart and open a trench.', 'Use subduction to make a trench.',
    ]) expect(engine.promptFaults!(c, bad), bad).not.toEqual([])
  })

  it('refuses a prompt that promises what the card does not show, or does not say what to make', () => {
    const c = goods[0]
    for (const bad of ['Choose how the plates move, then step the time on, to make a trench and see the tsunami.', 'Make a trench and measure the magnitude of the earthquake.', 'Drag the plates to make a deep ocean trench.', 'Find the hot spot on the map and make a trench.', 'Make a trench that destroys the buildings.']) {
      expect(engine.promptFaults!(c, bad), bad).not.toEqual([])
    }
    expect(engine.promptFaults!(c, 'Choose how the plates move, then step the time on.').join(' ')).toMatch(/does not say what to make/)
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "tectonics"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'tectonics')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Plate tectonics', 'Tectonic processes', 'Tectonics and hazards', 'Tectonic plates and their boundaries', 'Plate boundaries', 'Earthquakes and volcanoes', 'Earthquakes', 'Volcanoes', 'Volcanic eruptions', 'Fold mountains and rift valleys',
      'Forms of relief', 'The structure of the Earth', 'Continental drift', 'Sea floor spreading', 'Ocean trenches and island arcs', 'Destructive and constructive plate margins', 'The Great Rift Valley', 'Seismic hazards', 'Subduction zones',
      'Tectonic hazards: causes and effects', 'Convergent and divergent boundaries', 'Earthquake hazards', 'Living with volcanoes',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Plate of food: balanced diet', 'Number plates and registration', 'Petri dish and agar plate technique', 'The metaphase plate in mitosis', 'Growth plates in bones', 'Plate armour in medieval warfare', 'Electroplating', 'Plates and cutlery',
      'Baking soda volcano experiment', 'Building a model volcano', 'Earthquake-proof buildings', 'Earthquake drills and safety', 'A tectonic shift in the market', 'Seismic shifts in politics', 'Fault finding in circuits', 'Fault tolerance in networks',
      'Tsunamis and tidal waves', 'Hotspot volcanoes in Hawaii', 'Hurricanes and tropical storms', 'Flood risk and river management', 'Reading maps and grid references', 'Contour lines and relief maps', 'Rivers and coasts', 'Weather and climate',
      'Mitosis', 'Food webs', 'Photosynthesis', 'Network topologies', 'Wandering albatross', 'Faults and folds in an essay', 'Relief of pain', 'The relief of Mafeking',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('tectonics')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "tectonics"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:tectonics"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const t of TARGETS) expect(engine.prompt).toContain(t)
  })

  it('what the catalogue entry says each target needs is what it marks', () => {
    expect(solutions({ task: 'landform', left: 'ocean', right: 'ocean', target: 'island-arc' })).toEqual(['together'])
    expect(solutions({ task: 'landform', left: 'ocean', right: 'continent', target: 'volcanic-mountains' })).toEqual(['together'])
    expect(solutions({ task: 'landform', left: 'continent', right: 'continent', target: 'rift-valley' })).toEqual(['apart'])
    expect(solutions({ task: 'landform', left: 'ocean', right: 'ocean', target: 'ridge' })).toEqual(['apart'])
    expect(solutions({ task: 'hazard', left: 'ocean', right: 'continent', target: 'deep-earthquakes' })).toEqual(['together'])
    expect(solutions({ task: 'hazard', left: 'continent', right: 'continent', target: 'volcanoes-shallow-quakes' })).toEqual(['apart'])
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'tectonics', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: TectConfig, state: TectState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(TectonicsView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const SECRETS = ['Trench', 'trench', 'Fold mountains', 'Rift valley', 'rift valley', 'Mid-ocean', 'ridge', 'Island arc', 'island arc', 'Fault line', 'Volcanoes', 'subduct', 'collision', 'converg', 'diverg', 'transform', 'Yes', 'You pushed', 'You pulled', 'You slid']

  it('before marking, nothing names the landform, the boundary or whether it is right', () => {
    for (const c of VALID) {
      const prompt = engine.promptFaults!(c, 'x').join(' ').match(/"([^"]*)"\)/)![1]
      for (const st of [engine.initial(c), { dir: 'together', step: 3 } as TectState, { dir: 'apart', step: 4 } as TectState, { dir: 'past', step: 2 } as TectState]) {
        const html = raw(c, st, 'idle')
        const shown = text(html) + ' ' + attrs(html)
        for (const secret of SECRETS) expect(shown, `${secret} in ${nameOf(c)} ${JSON.stringify(st)}`).not.toContain(secret)
      }
      const html = card(c, prompt)
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of SECRETS) expect(shown, `${secret} on the board ${nameOf(c)}`).not.toContain(secret)
    }
  })

  it('names what it draws, on the card, before the learner touches anything', () => {
    const t = text(raw({ task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }, { dir: null, step: 0 }, 'idle'))
    for (const name of ['Sea', 'Oceanic crust', 'Continent', 'Mantle', 'Earthquake', 'Magma', 'Pull apart', 'Slide past', 'Push together', 'Time passed', '0 of 4']) expect(t).toContain(name)
    const cc = text(raw({ task: 'landform', left: 'continent', right: 'continent', target: 'rift-valley' }, { dir: null, step: 0 }, 'idle'))
    expect(cc).toContain('Continental crust')
    expect(cc).not.toContain('Sea')
  })

  it('has real, labelled buttons, with the choice pressed and the time disabled until a movement is chosen', () => {
    const c: TectConfig = { task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }
    const still = raw(c, { dir: null, step: 0 }, 'idle')
    for (const label of ['Pull the plates apart', 'Slide the plates past each other', 'Push the plates together', 'Less time', 'More time']) expect(still).toContain(`aria-label="${label}"`)
    expect((still.match(/<button/g) ?? []).length).toBe(5)
    expect(still).toMatch(/aria-label="Less time"[^>]*disabled=""/)
    const moved = raw(c, { dir: 'together', step: 2 }, 'idle')
    expect(moved).toMatch(/aria-label="Push the plates together" aria-pressed="true"/)
    expect(moved).not.toMatch(/aria-label="More time"[^>]*disabled=""/)
  })

  it('marking names what it made, on the picture and in words', () => {
    const c: TectConfig = { task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }
    const right = text(raw(c, engine.solve(c), 'right'))
    expect(right).toContain('Yes. You pushed the plates together')
    expect(right).toContain('Trench')
    expect(right).toContain('Volcanoes')
    const wrong = text(raw(c, { dir: 'past', step: 3 }, 'wrong'))
    expect(wrong).toContain('You slid the plates past each other')
    expect(wrong).toContain('Fault line')
    expect(wrong).not.toContain('Yes')
    const shown = text(raw(c, { dir: null, step: 0 }, 'shown'))
    expect(shown).toContain('Yes. You pushed the plates together')
    const rest = text(raw(c, { dir: null, step: 0 }, 'wrong'))
    expect(rest).toContain('The plates did not move.')
  })

  it('draws every configuration, reduced or not, without error', () => {
    for (const c of VALID) {
      for (const st of [engine.initial(c), engine.solve(c), { dir: 'apart', step: 4 } as TectState]) {
        expect(() => raw(c, st, 'idle', true), nameOf(c)).not.toThrow()
        expect(() => raw(c, st, 'wrong', false), nameOf(c)).not.toThrow()
      }
    }
  })

  it('under reduced motion shows the still frame for the step, which changes with each move', () => {
    const c: TectConfig = { task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }
    const frames = [1, 2, 3, 4].map((step) => raw(c, { dir: 'together', step }, 'idle', true))
    expect(new Set(frames).size).toBe(4)
    expect(raw(c, { dir: 'apart', step: 3 }, 'idle', true)).not.toBe(raw(c, { dir: 'together', step: 3 }, 'idle', true))
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(VW).toBe(W)
    expect(VH).toBe(H)
    const c: TectConfig = { task: 'landform', left: 'ocean', right: 'continent', target: 'trench' }
    const html = raw(c, engine.initial(c), 'idle')
    expect(html).toContain(`viewBox="0 ${TOP} ${W} ${H - TOP}"`)
    expect(SKY_Y).toBeGreaterThan(TOP + 10)
    // The picture, a key line, two control rows and a result stay under the height a card may take.
    expect(H - TOP).toBeLessThan(240)
  })
})
