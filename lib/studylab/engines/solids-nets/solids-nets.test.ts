// lib/studylab/engines/solids-nets/solids-nets.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  solidsNetsEngine as engine, CARDS, LAYERS_MAX, LAYERS_MIN, NET_NAMES, SECTIONS, SIDE_MAX, SIDE_MIN, UNITS,
  areaOf, cardOf, faceUnder, foldGeometry, foldReport, geometricGroups, layersFor, layersOf, looseAt, madeText, project, sectionCells, spotsOf, squaresOf, tabsOf, treeOf, working,
  type Cell, type SolidsConfig, type SolidsState, type Square,
} from './config'
import { H, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Fold = Extract<SolidsConfig, { task: 'fold' }>
type Extrude = Extract<SolidsConfig, { task: 'extrude' }>

const FOLDS: Fold[] = NET_NAMES.map((net) => ({ task: 'fold', solid: 'cube', net }))
const rects = (): Extrude[] => {
  const out: Extrude[] = []
  for (let w = SIDE_MIN; w <= SIDE_MAX; w++) for (let h = SIDE_MIN; h <= SIDE_MAX; h++) for (const unit of UNITS) {
    for (let k = LAYERS_MIN; k <= LAYERS_MAX; k++) out.push({ task: 'extrude', section: 'rectangle', volume: w * h * k, unit, width: w, height: h })
  }
  return out
}
const shapes = (): Extrude[] => {
  const out: Extrude[] = []
  for (const section of SECTIONS.filter((s) => s !== 'rectangle')) for (const unit of UNITS) {
    const a = areaOf({ task: 'extrude', section, volume: 0, unit, width: 3, height: 2 })
    for (let k = LAYERS_MIN; k <= LAYERS_MAX; k++) out.push({ task: 'extrude', section, volume: a * k, unit, width: 3, height: 2 })
  }
  return out
}
const EXTRUDES = [...rects(), ...shapes()]
const ALL: SolidsConfig[] = [...FOLDS, ...EXTRUDES]

const sq = (cells: Cell[]): Square[] => cells.map(([r, c], i) => ({ r, c, n: i + 1, loose: i === cells.length - 1 }))
const asSquares = (config: Fold, at: Cell) => squaresOf(config, { at })
const key = (c: Cell) => `${c[0]},${c[1]}`

// Every free hexomino, by growing from one square and keeping one form of each.
function hexominoes(): Cell[][] {
  const norm = (cells: Cell[]) => {
    const forms: string[] = []
    let cur = cells
    for (let f = 0; f < 2; f++) {
      for (let r = 0; r < 4; r++) {
        cur = cur.map(([a, b]) => [b, -a] as Cell)
        const minA = Math.min(...cur.map((x) => x[0]))
        const minB = Math.min(...cur.map((x) => x[1]))
        forms.push(cur.map(([a, b]) => `${a - minA},${b - minB}`).sort().join(';'))
      }
      cur = cur.map(([a, b]) => [a, -b] as Cell)
    }
    return forms.sort()[0]
  }
  let level = new Map<string, Cell[]>([[norm([[0, 0]]), [[0, 0]]]])
  for (let n = 1; n < 6; n++) {
    const next = new Map<string, Cell[]>()
    for (const cells of level.values()) {
      for (const [r, c] of cells) for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const p: Cell = [r + dr, c + dc]
        if (cells.some((q) => q[0] === p[0] && q[1] === p[1])) continue
        const grown = [...cells, p]
        const k = norm(grown)
        if (!next.has(k)) next.set(k, grown)
      }
    }
    level = next
  }
  return [...level.values()]
}

describe('the cube and its nets, from first principles', () => {
  it('finds 35 free hexominoes, of which exactly 11 fold into a cube (the classic count)', () => {
    const all = hexominoes()
    expect(all).toHaveLength(35)
    expect(all.filter((cells) => foldReport(sq(cells)).ok)).toHaveLength(11)
  })

  it('a row of six and a block of four with two beside it do not fold; a cross does', () => {
    expect(foldReport(sq([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]])).ok).toBe(false)
    expect(foldReport(sq([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]])).ok).toBe(false)
    expect(foldReport(sq([[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]])).ok).toBe(true)
  })

  it('a net that works has opposite squares two apart in a row, and none next to each other', () => {
    const r = foldReport(sq([[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]]))
    expect(r.opposite).toHaveLength(3)
    // Squares 2 and 4 are two apart in the row, so they are opposite; 2 and 3 touch, so they are not.
    expect(r.opposite.some((p) => p.join() === '2,4')).toBe(true)
    expect(r.opposite.some((p) => p.join() === '2,3')).toBe(false)
  })

  it('the hinge-by-hinge folding in space agrees with the die rule for every hexomino and every root', () => {
    for (const cells of hexominoes()) {
      const s = sq(cells)
      expect(geometricGroups(s), JSON.stringify(cells)).toEqual(foldReport(s).stacked)
      // A closed cube has eight corners, each shared by three squares; an open one has fewer faces.
      const corners = new Set(foldGeometry(s, 90).corners.flat().map((p) => p.map((x) => Math.round(x * 1000) / 1000).join(',')))
      if (foldReport(s).ok) expect(corners.size).toBe(8)
    }
  })

  it('is flat at 0 degrees, and every point is exactly on the table', () => {
    for (const config of FOLDS) {
      const g = foldGeometry(squaresOf(config, {}), 0)
      for (const cs of g.corners) for (const p of cs) expect(p[2]).toBeCloseTo(0, 9)
      for (const t of g.tabs) for (const p of t.poly) expect(p[2]).toBeCloseTo(0, 9)
    }
  })

  it('keeps every square rigid while it folds: sides stay one unit', () => {
    for (const config of FOLDS) {
      for (const deg of [0, 20, 45, 70, 90]) {
        for (const at of spotsOf(cardOf(config))) {
          const g = foldGeometry(asSquares(config, at), deg)
          for (const cs of g.corners) {
            for (let i = 0; i < 4; i++) {
              const a = cs[i]
              const b = cs[(i + 1) % 4]
              expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeCloseTo(1, 6)
            }
          }
        }
      }
    }
  })

  it('every card starts with a loose square that fails, and at least one place that works', () => {
    for (const config of FOLDS) {
      const card = cardOf(config)
      const ok = spotsOf(card).filter((s) => foldReport(asSquares(config, s)).ok)
      expect(foldReport(asSquares(config, card.start)).ok, config.net).toBe(false)
      expect(spotsOf(card).some((s) => key(s) === key(card.start)), config.net).toBe(true)
      expect(ok.length, config.net).toBeGreaterThanOrEqual(1)
      // Not nearly every place works: it has to be thought about.
      expect(ok.length, config.net).toBeLessThan(spotsOf(card).length / 2 + 1)
    }
  })

  it('the five fixed squares are always one piece, and the four families are the real cube-net families', () => {
    for (const net of NET_NAMES) {
      const base = CARDS[net].base
      expect(base).toHaveLength(5)
      const seen = new Set([key(base[0])])
      const open = [base[0]]
      while (open.length) {
        const [r, c] = open.pop()!
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const p: Cell = [r + dr, c + dc]
          if (base.some((b) => key(b) === key(p)) && !seen.has(key(p))) {
            seen.add(key(p))
            open.push(p)
          }
        }
      }
      expect(seen.size, net).toBe(5)
    }
  })

  it('face numbers: the fixed squares are 1 to 5 and the loose one is 6', () => {
    const s = squaresOf(FOLDS[0], {})
    expect(s.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(s.filter((x) => x.loose)).toHaveLength(1)
  })

  it('reads a place that is not a real spot as the start', () => {
    const config = FOLDS[0]
    expect(looseAt(config, { at: [9, 9] })).toEqual(cardOf(config).start)
    expect(looseAt(config, { at: [1, 1] })).toEqual(cardOf(config).start)
    expect(looseAt(config, {} as SolidsState)).toEqual(cardOf(config).start)
  })

  it('draws glue tabs only on open edges', () => {
    for (const config of FOLDS) {
      const s = squaresOf(config, {})
      for (const t of tabsOf(s)) {
        const mid = [(t.a[0] + t.b[0]) / 2 + t.out[0] * 0.5, (t.a[1] + t.b[1]) / 2 + t.out[1] * 0.5]
        expect(s.some((o) => o.c + 0.5 === mid[0] && o.r + 0.5 === mid[1]), 'a tab sits on a joined edge').toBe(false)
      }
    }
  })

  it('the tree reaches every square of a connected card', () => {
    for (const config of FOLDS) for (const at of spotsOf(cardOf(config))) {
      const s = asSquares(config, at)
      expect(treeOf(s).order).toHaveLength(6)
    }
  })

  it('faceUnder gives six different faces exactly when the net works', () => {
    for (const config of FOLDS) for (const at of spotsOf(cardOf(config))) {
      const s = asSquares(config, at)
      expect(new Set(faceUnder(s)).size === 6).toBe(foldReport(s).ok)
    }
  })

  it('projects a point at the target onto the centre of the picture', () => {
    const p = project([2, 3, 0.5], { yaw: 0.6, pitch: 0.9, scale: 40, cx: 180, cy: 120, target: [2, 3, 0.5] })
    expect(p.x).toBeCloseTo(180)
    expect(p.y).toBeCloseTo(120)
  })
})

describe('the prism, from first principles', () => {
  it('counts the squares of each shape', () => {
    const a = (section: string, w = 3, h = 2) => areaOf({ task: 'extrude', section, volume: 0, unit: 'cm', width: w, height: h })
    expect(a('L')).toBe(5)
    expect(a('T')).toBe(5)
    expect(a('U')).toBe(7)
    expect(a('steps')).toBe(6)
    expect(a('plus')).toBe(5)
    expect(a('rectangle', 3, 2)).toBe(6)
    expect(a('rectangle', 4, 4)).toBe(16)
  })

  it('the squares of every shape are distinct and edge-connected', () => {
    for (const section of SECTIONS) {
      const cells = sectionCells({ task: 'extrude', section, volume: 0, unit: 'cm', width: 3, height: 2 })
      expect(new Set(cells.map(key)).size).toBe(cells.length)
      const seen = new Set([key(cells[0])])
      const open = [cells[0]]
      while (open.length) {
        const [r, c] = open.pop()!
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const p: Cell = [r + dr, c + dc]
          if (cells.some((q) => key(q) === key(p)) && !seen.has(key(p))) {
            seen.add(key(p))
            open.push(p)
          }
        }
      }
      expect(seen.size, section).toBe(cells.length)
    }
  })

  it('volume is the area times the layers', () => {
    const c: Extrude = { task: 'extrude', section: 'L', volume: 30, unit: 'cm', width: 3, height: 2 }
    expect(layersFor(c)).toBe(6)
    expect(engine.check(c, { len: 6 }).ok).toBe(true)
    expect(engine.check(c, { len: 5 }).ok).toBe(false)
    expect(engine.check(c, { len: 7 }).ok).toBe(false)
    expect(layersOf(c, { len: 99 })).toBe(LAYERS_MAX)
    expect(layersOf(c, { len: -3 })).toBe(1)
    expect(layersOf(c, {} as SolidsState)).toBe(1)
  })

  it('says what a wrong stack holds, only after it is marked', () => {
    const c: Extrude = { task: 'extrude', section: 'L', volume: 30, unit: 'cm', width: 3, height: 2 }
    expect(madeText(c, { len: 4 })).toMatch(/4 layers of 5 cubes hold 5 × 4 = 20 cm³\. That is less/)
    expect(madeText(c, { len: 8 })).toMatch(/40 cm³\. That is more/)
    expect(working(c, { len: 6 })).toMatch(/5 × 6 = 30 cm³/)
  })

  it('names the squares that stack when a net fails, and the open faces', () => {
    const config = FOLDS[0]
    const text = madeText(config, { at: cardOf(config).start })
    expect(text).toMatch(/Squares \d and \d land on the same face, so one face of the cube is left open\./)
    expect(madeText(config, { at: [2, 1] })).toBe('')
    expect(working(config, { at: [2, 1] })).toMatch(/^Yes\. It folds into a closed cube/)
  })
})

describe('every configuration the tutor can write', { timeout: 30_000 }, () => {
  it('parses back to itself, has no faults, starts unsolved, and its solution passes', () => {
    expect(ALL.length).toBeGreaterThan(400)
    for (const config of ALL) {
      expect(engine.faults(config), JSON.stringify(config)).toEqual([])
      expect(engine.check(config, engine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(engine.check(config, engine.solve(config)).ok, JSON.stringify(config)).toBe(true)
    }
  })

  it('draws every card without a crash, and nothing shown before marking names the answer', () => {
    for (const config of ALL.filter((_, i) => i % 7 === 0)) {
      const html = card(config, 'Prompt.')
      expect(html, JSON.stringify(config)).not.toMatch(/left open|same face|Yes\.|closed cube|× \d|cm³|layers? of|folds into/)
    }
  })

  it('can marked wrong and right for the same card, and text appears only then', () => {
    for (const config of FOLDS) {
      const wrong = engine.initial(config)
      expect(engine.check(config, wrong).ok).toBe(false)
      expect(madeText(config, wrong).length).toBeGreaterThan(10)
      expect(working(config, engine.solve(config))).toMatch(/^Yes\./)
    }
  })
})

describe('reading the tutor’s config', () => {
  it('reads broad phrasings', () => {
    expect(engine.parse({ task: 'fold' })).toEqual({ task: 'fold', solid: 'cube', net: 'cross' })
    expect(engine.parse({ task: 'nets', net: 'Staircase' })).toMatchObject({ task: 'fold', net: 'stairs' })
    expect(engine.parse({ task: 'fold', net: 'two rows' })).toMatchObject({ net: 'two rows' })
    expect(engine.parse({ task: 'fold', net: 'T-shape net' })).toMatchObject({ net: 'cross' })
    expect(engine.parse({ net: 'row' })).toMatchObject({ task: 'fold', net: 'row' })
    expect(engine.parse({ task: 'extrude', section: 'L-shaped prism', volume: '30 cm3' })).toMatchObject({ task: 'extrude', section: 'L', volume: 30, unit: 'cm' })
    expect(engine.parse({ task: 'volume', section: 'u-shape', volume: 42, unit: 'cm³' })).toMatchObject({ section: 'U', unit: 'cm' })
    expect(engine.parse({ volume: 24 })).toMatchObject({ task: 'extrude', section: 'rectangle', volume: 24, width: 3, height: 2 })
    expect(engine.parse({ task: 'prism', section: 'cuboid', width: 2, height: 2, volume: '16 mm³' })).toMatchObject({ section: 'rectangle', width: 2, height: 2, unit: 'mm' })
    expect(engine.parse({ task: { kind: 'fold', net: 'cross' } })).toMatchObject({ task: 'fold', net: 'cross' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('fold')).toBeNull()
    expect(engine.parse({ task: 'juggle' })).toBeNull()
    expect(engine.parse({ task: 'fold', net: 4 })).toBeNull()
    expect(engine.parse({ task: 'extrude', section: 7 })).toBeNull()
  })

  it('refuses narrowly, with a nearby example that works', () => {
    const e = (raw: unknown) => engine.faults(engine.parse(raw)!)
    expect(e({ task: 'fold', net: 'spiral' })[0]).toMatch(/no "spiral" card.*"cross".*net "cross"/)
    expect(e({ task: 'fold', solid: 'pyramid' })[0]).toMatch(/Only the cube.*pyramid/)
    expect(e({ task: 'extrude', section: 'hexagon', volume: 30 })[0]).toMatch(/no "hexagon" cross-section.*section "L"/)
    expect(e({ task: 'extrude', section: 'L', volume: 31 })[0]).toMatch(/does not fill whole layers.*volume 30 or 35/)
    expect(e({ task: 'extrude', section: 'L', volume: 5 })[0]).toMatch(/outside 2 to 10.*volume 20/)
    expect(e({ task: 'extrude', section: 'L', volume: 55 })[0]).toMatch(/11 layers/)
    expect(e({ task: 'extrude', section: 'L' })[0]).toMatch(/No volume.*volume 20/)
    expect(e({ task: 'extrude', section: 'rectangle', width: 7, volume: 12 })[0]).toMatch(/width 7.*use e\.g\. width 3/)
    expect(e({ task: 'extrude', section: 'L', volume: 20, unit: 'furlongs' })[0]).toMatch(/cm, mm or m/)
    // And each suggested example really works.
    for (const raw of [{ task: 'extrude', section: 'L', volume: 30 }, { task: 'extrude', section: 'L', volume: 35 }, { task: 'extrude', section: 'L', volume: 20 }]) expect(e(raw)).toEqual([])
  })
})

describe('the prompt, held to what the card shows', () => {
  const fold: Fold = { task: 'fold', solid: 'cube', net: 'cross' }
  const ext: Extrude = { task: 'extrude', section: 'L', volume: 30, unit: 'cm', width: 3, height: 2 }
  const bad = (c: SolidsConfig, p: string) => engine.promptFaults!(c, p)

  it('lets the gesture and the aim through', () => {
    expect(bad(fold, 'Move the orange square so the net folds into a cube. Tap a dotted outline to stick the square there, then pull the Fold slider to bend the card up and test it.')).toEqual([])
    expect(bad(fold, 'Fix this net so it folds into a cube. Tap a dotted square to place the orange one, and use the Fold slider to try it.')).toEqual([])
    expect(bad(ext, 'Add layers until the prism holds 30 cubic centimetres. Tap + to add a layer and − to take one away.')).toEqual([])
    expect(bad(ext, 'Tap + to build the prism until it has a volume of 30 cm³.')).toEqual([])
  })

  it('refuses a fold prompt that says where, which square, or what goes wrong', () => {
    for (const p of [
      'Move the orange square below the row so the net folds. Tap a dotted square.',
      'Move square 6 to the other end of the net. Tap a dotted square.',
      'The net has two squares overlapping. Tap a dotted square to fix it and fold it.',
      'Tap a dotted square so that no face is left open when you fold it.',
      'Drag the orange square somewhere else and fold the net.',
      'Move the orange square and work out the volume of the cube.',
      'Fold the net.',
    ]) expect(bad(fold, p), p).not.toEqual([])
  })

  it('refuses an extrude prompt that gives the layers, the method, or the wrong volume', () => {
    for (const p of [
      'Tap + until the prism has 6 layers, and it holds 30 cubic centimetres.',
      'Add layers to reach 30 cm³. Multiply the area of the cross-section by the length.',
      'Add layers until the prism holds 30 cubic centimetres, which is 5 times the length.',
      'Tap + to make a prism of 40 cm³.',
      'Tap + until the prism is long enough.',
      'Fold the net and add layers until the prism holds 30 cubic centimetres. Tap +.',
      'Add layers until it holds 30 cubic centimetres, and find the surface area.',
    ]) expect(bad(ext, p), p).not.toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('solids-nets')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)",\s*"payload": \{ "engine":"solids-nets", "config": (\{[^}]*\}) \}/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
    // The config lines quote the prompts too.
    const quoted = [...e.prompt.matchAll(/the prompt says "([^"]+)"/g)]
    expect(quoted.length).toBe(2)
    for (const m of quoted) expect([engine.promptFaults!(FOLDS[0], m[1]), engine.promptFaults!(ext, m[1])].some((r) => r.length === 0)).toBe(true)
  })
})

describe('being offered to the right stations', () => {
  const offered = (station: string) => scenesFor(station).some((e) => e.id === 'solids-nets') || sceneCatalogue(station).includes('SCENE "solids-nets"')
  it('is offered where the topic is the cube’s net or a prism’s volume', () => {
    for (const s of ['Nets of 3D shapes', 'Cube nets and folding', 'Faces, edges and vertices', 'Volume of prisms', 'Volume of a cuboid', 'Polyhedra and their nets', 'Cuboids', 'Surface area of prisms', 'Solid shapes and their nets']) expect(offered(s), s).toBe(true)
  })
  it('is not offered to net force, net profit, chemistry’s solids, optics’ prisms, cell volume or gases', () => {
    for (const s of ['Net force and acceleration', 'Net profit and gross profit', 'States of matter: solids, liquids and gases', 'Solids and their structures', 'Glass prisms and dispersion of light', 'Surface area to volume ratio in cells', 'Volume of gases', 'Molar volume', 'Fishing nets and the food web', 'Volume of a cylinder', 'Neural networks', 'Net present value', 'Measuring volume with a measuring cylinder', 'Solids in solution', 'Mass, volume and density']) expect(offered(s), s).toBe(false)
  })
})

function card(config: SolidsConfig, prompt: string, marked: 'idle' | 'right' | 'wrong' = 'idle') {
  void marked
  return renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'solids-nets', config }, success: { kind: 'scene' } } },
  } as never)))
}

describe('the view', () => {
  it('draws the fold card with its slider and a button for every place the square could go', () => {
    const config = FOLDS[0]
    const html = card(config, 'Prompt.')
    expect(html).toMatch(/type="range"[^>]*min="0"[^>]*max="90"/)
    const buttons = [...html.matchAll(/aria-label="Stick the orange square down in row \d+, column \d+"/g)]
    // Every place but the one the square is already on.
    expect(buttons).toHaveLength(spotsOf(cardOf(config)).length - 1)
    for (const b of buttons) expect(b[0]).not.toMatch(/correct|right|wrong|works/i)
  })

  it('draws the extrude card with a spinbutton for the length and no volume in it', () => {
    const config = EXTRUDES.find((c) => c.section === 'U')!
    const html = card(config, 'Prompt.')
    expect(html).toMatch(/role="spinbutton"[^>]*aria-valuenow="1"/)
    expect(html).toMatch(/aria-label="Add a layer"/)
    const seen = html.replace(/<(?:path|polygon|rect|text)[^>]*>/g, ' ').replace(/\sd="[^"]*"/g, ' ')
    expect(seen).not.toMatch(new RegExp(`\b${config.volume}\b`))
    expect(html).toContain('1 cm')
  })

  it('keeps its picture inside the frame and under the height limit', () => {
    expect(W).toBe(360)
    expect(H).toBe(240)
  })

  it('has no config constant read at the top of the view (the two files import each other)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    const src = fs.readFileSync(new URL('./View.tsx', import.meta.url), 'utf8')
    const top = src.split('\n').filter((l) => /^const |^export const /.test(l)).join('\n')
    for (const name of ['CARDS', 'NET_NAMES', 'SECTIONS', 'UNITS', 'LAYERS_MAX', 'LAYERS_MIN', 'SIDE_MAX', 'SIDE_MIN']) expect(top, name).not.toContain(name)
    // The literal it uses for the longest prism agrees with the config.
    expect(src).toMatch(/const maxLen = 10/)
    expect(LAYERS_MAX).toBe(10)
  })

  it('is registered for the tutor, with its two tasks in its catalogue entry', () => {
    expect(getEngine('solids-nets')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/SCENE "solids-nets"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:solids-nets"/)
    expect(engine.prompt.match(/"isolates":"structure"/g)).toHaveLength(2)
    expect(engine.prompt).toContain('"task":"fold"')
    expect(engine.prompt).toContain('"task":"extrude"')
  })
})
