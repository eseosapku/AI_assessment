// lib/studylab/engines/map-reader/map-reader.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  mapReaderEngine as engine, COLS, DIRS, GOALS, HILLS, HMAX, LEVELS, PLACES, PLACE_IDS, ROWS, STEP,
  contourPoint, degreesOf, goodDirs, gradOfDir, heightAt, placeAt, refOf, steepestOf,
  type MapReaderConfig, type MapReaderState,
} from './config'
import { MapReaderView, CELL, GX, GY, GW, GH, cellCentre } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const GRID: MapReaderConfig[] = PLACE_IDS.flatMap((place) => (['place', 'square'] as const).map((ask) => ({ task: 'grid' as const, place, ask })))
const CROSS: MapReaderConfig[] = HILLS.flatMap((hill) => GOALS.map((goal) => ({ task: 'cross-section' as const, hill, goal })))
const ALL = [...GRID, ...CROSS]

describe('the rules, from first principles', () => {
  it('a grid reference is the line on the left, then the line along the bottom', () => {
    expect(refOf(0, 0)).toBe('2060')
    expect(refOf(2, 3)).toBe('2263')
    expect(refOf(5, 5)).toBe('2565')
  })

  it('no two places share a square, and all are on the map', () => {
    const seen = new Set<string>()
    for (const id of PLACE_IDS) {
      const { col, row } = PLACES[id]
      expect(col).toBeGreaterThanOrEqual(0); expect(col).toBeLessThan(COLS)
      expect(row).toBeGreaterThanOrEqual(0); expect(row).toBeLessThan(ROWS)
      expect(seen.has(`${col},${row}`)).toBe(false)
      seen.add(`${col},${row}`)
      expect(placeAt(col, row)).toBe(id)
    }
  })

  it('the hill is a real hill: its contours are nested and its height matches its contour', () => {
    for (const hill of HILLS) {
      expect(heightAt(hill, 0, 0)).toBeCloseTo(HMAX, 6)
      for (const l of LEVELS) for (let t = 0; t < 360; t += 20) {
        const p = contourPoint(hill, l, t)
        expect(heightAt(hill, p.dx, p.dy), `${hill} ${l} ${t}`).toBeCloseTo(l, 6)
      }
      // Higher contours lie inside lower ones.
      for (let t = 0; t < 360; t += 30) {
        const r = LEVELS.map((l) => Math.hypot(contourPoint(hill, l, t).dx, contourPoint(hill, l, t).dy))
        for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThan(r[i - 1])
      }
    }
  })

  it('steep ground is where the contours are closest: the steep side of a lopsided hill is the steep line', () => {
    expect(gradOfDir('steep-west', 0)).toBeGreaterThan(gradOfDir('steep-west', 3))
    expect(gradOfDir('steep-north', 3)).toBeGreaterThan(gradOfDir('steep-north', 0))
    expect(goodDirs('steep-west', 'steepest')).toEqual([0])
    expect(goodDirs('steep-west', 'gentlest')).toEqual([3])
    expect(goodDirs('ridge-ew', 'steepest')).toEqual([3])
    expect(goodDirs('ridge-ew', 'gentlest')).toEqual([0])
    expect(goodDirs('ridge-ns', 'steepest')).toEqual([0])
    expect(steepestOf('steep-west', 0).end).toBe('A')
    expect(steepestOf('steep-east', 0).end).toBe('B')
    expect(degreesOf(steepestOf('steep-west', 0).grad)).toBeGreaterThan(degreesOf(steepestOf('steep-west', 90).grad))
  })

  it('the smallest turn shows: neighbouring steps differ by degrees you can see', () => {
    for (const hill of HILLS) {
      const g = Array.from({ length: DIRS }, (_, d) => degreesOf(gradOfDir(hill, d)))
      expect(Math.max(...g) - Math.min(...g), hill).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('parse', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'grid', place: 'The Church' })).toEqual({ task: 'grid', place: 'church', ask: 'place' })
    expect(engine.parse({ task: 'grid reference', place: 'mill', ask: 'square' })).toEqual({ task: 'grid', place: 'mill', ask: 'square' })
    expect(engine.parse({ task: 'cross-section', hill: 'steep west', goal: 'steep' })).toEqual({ task: 'cross-section', hill: 'steep-west', goal: 'steepest' })
    expect(engine.parse({ task: 'contours', hill: 'west', goal: 'gentle' })).toEqual({ task: 'cross-section', hill: 'steep-west', goal: 'gentlest' })
    expect(engine.parse({ task: 'cross section', hill: 'ridge', goal: 'gentlest' })).toMatchObject({ hill: 'ridge-ew' })
  })

  it('refuses only what cannot be read, and faults say how to fix the rest', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'poetry' })).toBeNull()
    expect(engine.parse({ task: 'grid' })).toBeNull()
    expect(engine.parse({ task: 'cross-section', hill: 'steep-west' })).toBeNull()
    const f = engine.faults(engine.parse({ task: 'grid', place: 'castle' })!)
    expect(f[0]).toContain('church')
    const g = engine.faults(engine.parse({ task: 'cross-section', hill: 'volcano', goal: 'steepest' })!)
    expect(g[0]).toContain('steep-west')
  })
})

describe('every valid config is solvable and starts unsolved', { timeout: 30_000 }, () => {
  it('enumerates all of them', () => {
    expect(ALL.length).toBe(PLACE_IDS.length * 2 + HILLS.length * 2)
    for (const c of ALL) {
      expect(engine.parse(c), JSON.stringify(c)).toEqual(c)
      expect(engine.faults(c), JSON.stringify(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${JSON.stringify(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${JSON.stringify(c)}`).toBe(true)
    }
  })

  it('rejects states out of range', () => {
    const g: MapReaderConfig = { task: 'grid', place: 'church', ask: 'place' }
    expect(engine.check(g, { col: 1, row: 4 }).ok).toBe(true)
    expect(engine.check(g, { col: 1, row: 5 }).ok).toBe(false)
    expect(engine.check(g, { col: -1, row: 4 }).ok).toBe(false)
    expect(engine.check(g, { col: 1.5, row: 4 }).ok).toBe(false)
    expect(engine.check(g, {}).ok).toBe(false)
    const c: MapReaderConfig = { task: 'cross-section', hill: 'steep-west', goal: 'steepest' }
    expect(engine.check(c, { dir: 6 }).ok).toBe(false)
    expect(engine.check(c, { dir: 0 }).ok).toBe(true)
  })

  it('is registered with a full catalogue entry whose examples read cleanly', () => {
    expect(getEngine('map-reader')?.id).toBe(engine.id)
    expect(engine.prompt).toMatch(/SCENE "map-reader"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:map-reader"/)
    const examples = [...new Set([...engine.prompt.matchAll(/(\{ "task":"[a-z-]+", "(?:place|hill)"[^}]*\})/g)].map((m) => m[1]))].map((x) => JSON.parse(x))
    expect(examples.length).toBe(4)
    for (const ex of examples) {
      expect(engine.parse(ex), JSON.stringify(ex)).not.toBeNull()
      expect(engine.faults(engine.parse(ex)!)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (cfg: MapReaderConfig, prompt: string) => engine.promptFaults!(cfg, prompt)
  const church: MapReaderConfig = { task: 'grid', place: 'church', ask: 'place' }
  const mill: MapReaderConfig = { task: 'grid', place: 'mill', ask: 'square' }
  const west: MapReaderConfig = { task: 'cross-section', hill: 'steep-west', goal: 'steepest' }

  it('grid: the place is fine, the reference is not', () => {
    expect(pf(church, 'Put the cursor on the church.')).toEqual([])
    expect(pf(church, 'Put the cursor on square 2164.')).toHaveLength(1)
    expect(pf(church, 'Find the church. It is up from line 64.')).toHaveLength(1)
    expect(pf(mill, 'Move the cursor onto the grid square shown at the top of the card.')).toEqual([])
    expect(pf(mill, 'Find the mill on the map.')).toHaveLength(1)
  })

  it('cross-section: the outcome is fine, a side or the spacing rule is not', () => {
    expect(pf(west, 'Turn the line so that the ground along it is as steep as it can be somewhere.')).toEqual([])
    expect(pf(west, 'Turn the line to cross the west side of the hill.')).toHaveLength(1)
    expect(pf(west, 'Steep slopes have contours close together. Turn the line so it is steep.')).toHaveLength(1)
    expect(pf(west, 'Turn the line so the contours are squeezed together under it.')).toHaveLength(1)
    expect(pf({ task: 'cross-section', hill: 'ridge-ew', goal: 'gentlest' }, 'Turn the line so that the ground along it is as gentle as it can be everywhere.')).toEqual([])
    expect(pf({ task: 'cross-section', hill: 'ridge-ew', goal: 'gentlest' }, 'Pick the north-south line.')[0]).toContain('gentle')
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"map-reader", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const m of found) expect(engine.promptFaults!(engine.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of ['Elements of a map', 'Map skills', 'Grid references', 'Four figure grid references', 'Reading maps', 'Contour lines and relief',
      'Contours', 'Topographic maps', 'Using an Ordnance Survey map', 'Cartography', 'Map reading skills']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "map-reader"')
      expect(scenesFor(s).some((e) => e.id === 'map-reader'), s).toBe(true)
    }
  })

  it('is not offered for unrelated topics that share a word', () => {
    for (const s of ['Hash maps and dictionaries', 'Concept maps', 'Heart of the matter', 'Scale of a model', 'Scale factors and enlargement', 'Grid computing',
      'Spreadsheet grids', 'Cross section of a stem', 'The power grid', 'National grid and electricity', 'Mind maps for revision', 'Photosynthesis', 'Contour drawing']) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "map-reader"')
      expect(scenesFor(s).some((e) => e.id === 'map-reader'), s).toBe(false)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('every place sits wholly inside its own square, its label too', () => {
    for (const id of PLACE_IDS) {
      const { col, row } = PLACES[id]
      const c = cellCentre(col, row)
      const x0 = GX + col * CELL
      expect(c.x - 10).toBeGreaterThanOrEqual(x0)
      expect(c.x + 10).toBeLessThanOrEqual(x0 + CELL)
      // A 12 px bold label is about 7 px a letter.
      expect(id.length * 6.6).toBeLessThanOrEqual(CELL - 4)
      const y0 = GY + (ROWS - 1 - row) * CELL
      expect(c.y - 14).toBeGreaterThanOrEqual(y0)
      expect(c.y + 19 + 3).toBeLessThanOrEqual(y0 + CELL)
    }
    expect(GX + COLS * CELL).toBeLessThanOrEqual(GW)
    expect(GY + ROWS * CELL + 30).toBeLessThanOrEqual(GH)
  })

  it('the contours stay at least 5 px apart on the steepest side and inside the map', () => {
    for (const hill of HILLS) for (let t = 0; t < 360; t += 15) {
      const r = LEVELS.map((l) => Math.hypot(contourPoint(hill, l, t).dx, contourPoint(hill, l, t).dy))
      expect(r[0], hill).toBeLessThan(140)
      for (let i = 1; i < r.length; i++) expect(r[i - 1] - r[i], `${hill} ${t}`).toBeGreaterThanOrEqual(5)
    }
  })

  it('turning the line one step changes the ground a lot', () => {
    // A step moves the lopsided profile by at least 6 m somewhere along it.
    for (const hill of HILLS.filter((h) => h.startsWith('steep') || h.startsWith('ridge'))) {
      let most = 0
      for (let d = 0; d < DIRS; d++) {
        const a = Array.from({ length: 71 }, (_, i) => heightAt(hill, (-140 + i * 4) * Math.cos((d * STEP * Math.PI) / 180), (-140 + i * 4) * Math.sin((d * STEP * Math.PI) / 180)))
        const b = Array.from({ length: 71 }, (_, i) => heightAt(hill, (-140 + i * 4) * Math.cos((((d + 1) % DIRS) * STEP * Math.PI) / 180), (-140 + i * 4) * Math.sin((((d + 1) % DIRS) * STEP * Math.PI) / 180)))
        most = Math.max(most, ...a.map((v, i) => Math.abs(v - b[i])))
      }
      expect(most, hill).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('the map-reader scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'map-reader', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: MapReaderConfig, state: MapReaderState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(MapReaderView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('grid: before marking the places and lines are shown, the answer is not', () => {
    const html = card({ task: 'grid', place: 'church', ask: 'place' }, 'Put the cursor on the church.')
    const shown = text(html.replace('Put the cursor on the church.', ''))
    expect(html).toContain('touch-none')
    expect(html).toContain('role="application"')
    for (const secret of ['2164', '2164', 'That is the', 'You put', 'open ground', 'Square 21']) expect(shown, secret).not.toContain(secret)
    expect(shown).toContain('Church')
    expect(shown).toContain('along')
    expect(html.match(/<text /g)!.length).toBeLessThanOrEqual(32)
    // Eight place labels, and no reference built.
    for (const id of PLACE_IDS) expect(shown.toLowerCase()).toContain(id)
  })

  it('grid, ask square: the reference to find is printed; the place is not named by it', () => {
    const html = card({ task: 'grid', place: 'mill', ask: 'square' }, 'Move the cursor onto the grid square shown at the top of the card.')
    expect(text(html)).toContain('Find square')
    expect(html).toContain('aria-label="Find square 2262"')
  })

  it('grid: marking says the reference and what the learner made', () => {
    const g: MapReaderConfig = { task: 'grid', place: 'church', ask: 'place' }
    expect(text(raw(g, { col: 1, row: 4 }, 'right'))).toContain('Square 2164: along 21, then up 64. That is the church.')
    const wrong = text(raw(g, { col: 2, row: 2 }, 'wrong'))
    expect(wrong).toContain('You put the cursor on square 2262')
    expect(wrong).toContain('mill')
    expect(wrong).toContain('church is in square 2164')
  })

  it('cross-section: before marking there is a handle, a profile and no answer', () => {
    const html = card({ task: 'cross-section', hill: 'steep-west', goal: 'steepest' }, 'Turn the line so that the ground along it is as steep as it can be somewhere.')
    const shown = text(html.replace('Turn the line so that the ground along it is as steep as it can be somewhere.', ''))
    expect(html).toContain('role="slider"')
    expect(html).toContain('touch-none')
    expect(shown).toContain('Ground along your line')
    expect(shown).toContain('60')
    for (const secret of ['degrees', 'You made', 'closest together', 'furthest apart', 'steepest part', 'west side']) expect(shown, secret).not.toContain(secret)
    // The slider's spoken value gives the line's ends, never the answer.
    expect(html).not.toContain('steep-west')
    expect(html.match(/<text /g)!.length).toBeLessThanOrEqual(14)
  })

  it('cross-section: marking says the slope and what the learner made', () => {
    const c: MapReaderConfig = { task: 'cross-section', hill: 'steep-west', goal: 'steepest' }
    expect(text(raw(c, { dir: 0 }, 'right'))).toMatch(/steepest part of your line is about \d+ degrees, on the west side/)
    expect(text(raw(c, { dir: 3 }, 'wrong'))).toContain('You made a line whose steepest part is only about')
  })
})

describe("the view's literals", () => {
  it('agree with the config they cannot read while loading', async () => {
    const { COLS, ROWS, HMAX, RADIUS } = await import('./config')
    const { CELL, GRID_H, GRID_W, MCX, PROF_SCALE, PROF_X0 } = await import('./View')
    expect(GRID_W).toBe(COLS * CELL)
    expect(GRID_H).toBe(ROWS * CELL)
    expect(PROF_SCALE).toBe(100 / HMAX)
    expect(PROF_X0).toBe(MCX - RADIUS)
  })
})
