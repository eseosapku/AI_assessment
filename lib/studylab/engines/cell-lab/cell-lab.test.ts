// lib/studylab/engines/cell-lab/cell-lab.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  cellLabEngine as engine, DOTS_PER_PART, LEFT_MAX, RIGHT_MAX, RIGHT_MIN, SIDE_MAX, SIDE_MIN, TIMES_MAX, TIMES_MIN, WATER,
  crossing, goodLefts, madeMembrane, madeSlice, membraneWorking, netOf, rat, ratText, sliceWorking, startLeft,
  type CellLabConfig, type CellLabState,
} from './config'
import {
  BOX_L, BOX_R, DOT_R, MAX_DOTS, E, GAP, LABELS, LANE_X0, LANE_X1, MIN_GAP, PARTS, CellLabView, laneDots, levels, piecesOf, stillDots, tileX, TILE,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
type Membrane = Extract<CellLabConfig, { right: number }>
const NETS = ['left', 'right', 'none'] as const
const MEMBRANE: Membrane[] = (['diffusion', 'osmosis'] as const).flatMap((task) =>
  range(RIGHT_MIN, RIGHT_MAX).flatMap((right) => NETS.map((net) => ({ task, right, net }))))
const SLICE: CellLabConfig[] = range(SIDE_MIN, SIDE_MAX).flatMap((side) => range(TIMES_MIN, TIMES_MAX).map((times) => ({ task: 'surface-area' as const, side, times })))
const ALL: CellLabConfig[] = [...MEMBRANE, ...SLICE]

describe('the rules, from first principles', () => {
  it('diffusion: the net goes from the side with more solute to the side with less', () => {
    expect(netOf('diffusion', 7, 3)).toBe('right')
    expect(netOf('diffusion', 2, 6)).toBe('left')
    expect(netOf('diffusion', 4, 4)).toBe('none')
    expect(crossing('diffusion', 7, 3)).toEqual({ toRight: 7, toLeft: 3 })
  })

  it('osmosis: the net of water goes toward the side with more solute, the opposite of the solute rule', () => {
    expect(netOf('osmosis', 2, 6)).toBe('right')
    expect(netOf('osmosis', 8, 3)).toBe('left')
    expect(netOf('osmosis', 5, 5)).toBe('none')
    expect(crossing('osmosis', 2, 6)).toEqual({ toRight: WATER - 2, toLeft: WATER - 6 })
  })

  it('movement carries on at balance: both ways are busy, and equal', () => {
    for (const task of ['diffusion', 'osmosis'] as const) {
      for (const v of range(RIGHT_MIN, RIGHT_MAX)) {
        const c = crossing(task, v, v)
        expect(c.toRight, `${task} ${v}`).toBe(c.toLeft)
        expect(c.toRight, `${task} ${v}`).toBeGreaterThan(0)
      }
    }
  })

  it('surface area to volume, exactly: cutting an edge into n multiplies the ratio by n', () => {
    expect(ratText(rat(6, 6))).toBe('1')
    expect(ratText(rat(18, 6))).toBe('3')
    expect(ratText(rat(18, 5))).toBe('3.6')
    for (const side of range(SIDE_MIN, SIDE_MAX)) for (const n of range(1, TIMES_MAX)) {
      // n^3 cubes of edge side/n: total surface = n^3 * 6 (side/n)^2 = 6 side^2 n, volume side^3.
      const total = (n ** 3) * 6 * (side / n) ** 2
      expect(total).toBeCloseTo(6 * side * side * n, 9)
      expect((total / side ** 3) / (6 / side)).toBeCloseTo(n, 9)
    }
  })

  it('writes the working once marked', () => {
    expect(sliceWorking(6, 3)).toBe(
      'A 6 cm cube has 216 cm² of surface for 216 cm³: 1 : 1. Cut into 27 cubes of 2 cm, the volume is still 216 cm³ but the surface is 648 cm²: 3 : 1, 3 times as much surface for the volume.')
    expect(sliceWorking(5, 2)).toContain('cubes of 2.5 cm')
    expect(sliceWorking(5, 2)).toContain('1.2 : 1')
    expect(sliceWorking(5, 2)).toContain('2.4 : 1')
    expect(membraneWorking({ task: 'osmosis', right: 6, net: 'right' }, 2)).toBe(
      'Water crossed both ways: 10 parts to the right for 6 to the left. The net 4 went to the right, toward the right side, which has more solute and so less water.')
    expect(membraneWorking({ task: 'diffusion', right: 4, net: 'right' }, 7)).toContain('from the left, with more solute, to the right, with less')
    expect(membraneWorking({ task: 'osmosis', right: 6, net: 'none' }, 6)).toContain('never stopped')
  })

  it('says what the learner made when wrong, never what to change', () => {
    const c: Membrane = { task: 'osmosis', right: 6, net: 'right' }
    expect(madeMembrane(c, 8)).toBe('You set the left to 8 parts of solute against 6 on the right: more water crossed to the left than came back.')
    expect(madeMembrane({ task: 'diffusion', right: 4, net: 'none' }, 4)).toContain('no net movement')
    expect(madeSlice({ task: 'surface-area', side: 6, times: 3 }, 2)).toBe('You cut it into 8 cubes, 2 along each edge: 2 times the whole block\'s surface for its volume.')
    expect(madeSlice({ task: 'surface-area', side: 6, times: 3 }, 1)).toMatch(/not cut/)
  })
})

describe('the cell-lab engine', () => {
  it('reads a config however it is reasonably written, and nothing unreadable', () => {
    expect(engine.parse({ task: 'diffusion', right: 4, net: 'right' })).toEqual({ task: 'diffusion', right: 4, net: 'right' })
    expect(engine.parse({ task: 'Osmosis', right: '6', net: 'to the left' })).toEqual({ task: 'osmosis', right: 6, net: 'left' })
    expect(engine.parse({ task: 'osmosis', right: 'concentrated', net: 'none' })).toEqual({ task: 'osmosis', right: 8, net: 'none' })
    expect(engine.parse({ task: 'diffusion', right: 5, direction: 'no net movement' })).toEqual({ task: 'diffusion', right: 5, net: 'none' })
    expect(engine.parse({ task: { kind: 'diffusion', right: 3, net: 'left to right' } })).toEqual({ task: 'diffusion', right: 3, net: 'right' })
    expect(engine.parse({ task: 'surface area to volume', side: 4, times: 2 })).toEqual({ task: 'surface-area', side: 4, times: 2 })
    expect(engine.parse({ task: 'surface-area', times: '3' })).toEqual({ task: 'surface-area', side: 6, times: 3 })
    // Out of range still reads: faults() explains.
    expect(engine.parse({ task: 'osmosis', right: 12, net: 'right' })).toEqual({ task: 'osmosis', right: 12, net: 'right' })
    expect(engine.parse({ task: 'surface-area', side: 6, times: 9 })).toEqual({ task: 'surface-area', side: 6, times: 9 })
    expect(engine.parse({ task: 'active-transport', right: 4, net: 'right' })).toBeNull()
    expect(engine.parse({ task: 'osmosis', net: 'right' })).toBeNull()
    expect(engine.parse({ task: 'osmosis', right: 4 })).toBeNull()
    expect(engine.parse({ task: 'osmosis', right: 'lots', net: 'right' })).toBeNull()
    expect(engine.parse(null)).toBeNull()
  })

  it('refuses what the picture cannot honestly show, with a nearby example that works', () => {
    const f = (raw: unknown) => engine.faults(engine.parse(raw)!)
    expect(f({ task: 'osmosis', right: 12, net: 'right' })[0]).toMatch(/1 to 9.*e\.g\. right 9/)
    expect(f({ task: 'diffusion', right: 0, net: 'right' })[0]).toMatch(/e\.g\. right 1/)
    expect(f({ task: 'diffusion', right: 4.5, net: 'right' })[0]).toMatch(/whole number/)
    expect(f({ task: 'surface-area', times: 9 })[0]).toMatch(/more than the block can be cut.*times 4/)
    expect(f({ task: 'surface-area', times: 1 })[0]).toMatch(/nothing to find.*times 3/)
    expect(f({ task: 'surface-area', side: 40, times: 3 })[0]).toMatch(/2 to 12.*side 6/)
    expect(f({ task: 'surface-area', times: 2.5 })[0]).toMatch(/whole number/)
    expect(f({ task: 'diffusion', right: 4, net: 'right' })).toEqual([])
    expect(f({ task: 'surface-area', times: 3 })).toEqual([])
  })

  it('over every valid config, starts unsolved, can be solved, and every setting is marked by the rule', { timeout: 30_000 }, () => {
    expect(ALL.length).toBe(2 * 9 * 3 + 11 * 3)
    for (const c of ALL) {
      const label = JSON.stringify(c)
      expect(engine.parse(c), label).toEqual(c)
      expect(engine.faults(c), label).toEqual([])
      const start = engine.initial(c)
      const solved = engine.solve(c)
      expect(engine.check(c, start).ok, `${label} starts solved`).toBe(false)
      expect(engine.check(c, solved).ok, `${label} cannot be solved`).toBe(true)
      if (c.task === 'surface-area') {
        for (const pieces of range(1, TIMES_MAX)) expect(engine.check(c, { pieces }).ok, `${label} ${pieces}`).toBe(pieces >= c.times)
      } else {
        // Every setting of the handle, against the rule written out by hand.
        for (const left of range(0, LEFT_MAX)) {
          const want: 'left' | 'right' | 'none' =
            c.task === 'diffusion' ? (left > c.right ? 'right' : left < c.right ? 'left' : 'none') : (left < c.right ? 'right' : left > c.right ? 'left' : 'none')
          expect(engine.check(c, { left }).ok, `${label} left ${left}`).toBe(want === c.net)
        }
        expect(goodLefts(c).length, label).toBeGreaterThan(0)
        // The start is a plain, in-range setting.
        expect(start.left).toBeGreaterThanOrEqual(0)
        expect(start.left).toBeLessThanOrEqual(LEFT_MAX)
        expect(startLeft(c.right, c.net)).toBe(start.left)
        // A net of none is balance in both, and it is the same setting.
        if (c.net === 'none') expect(solved.left).toBe(c.right)
      }
    }
  })

  it('refuses a handle outside its range', () => {
    const c: Membrane = { task: 'diffusion', right: 4, net: 'right' }
    expect(engine.check(c, { left: 11 }).ok).toBe(false)
    expect(engine.check(c, { left: -1 }).ok).toBe(false)
    expect(engine.check(c, { left: 6.5 }).ok).toBe(false)
    expect(engine.check(c, {}).ok).toBe(false)
  })

  it('is registered, with every example in its catalogue entry readable and fault-free', () => {
    expect(getEngine('cell-lab')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "cell-lab"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:cell-lab"/)
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task":[^}]*\})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBe(3)
    for (const ex of examples) {
      expect(engine.parse(ex), JSON.stringify(ex)).not.toBeNull()
      expect(engine.faults(engine.parse(ex)!)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (cfg: CellLabConfig, prompt: string) => engine.promptFaults!(cfg, prompt)
  const dif: CellLabConfig = { task: 'diffusion', right: 4, net: 'right' }
  const osm: CellLabConfig = { task: 'osmosis', right: 6, net: 'none' }
  const sa: CellLabConfig = { task: 'surface-area', side: 6, times: 3 }

  it('diffusion and osmosis: the outcome asked is fine, how the sides compare is not', () => {
    expect(pf(dif, 'Set up the left chamber so that, overall, solute particles move from the left chamber to the right chamber.')).toEqual([])
    expect(pf(osm, 'The membrane lets only water through. Set up the left chamber so that no water moves across overall.')).toEqual([])
    expect(pf(dif, 'Make the left chamber more concentrated than the right.')).toHaveLength(1)
    expect(pf(dif, 'Solute moves from high to low concentration. Set up the left so solute moves right.')).toHaveLength(1)
    expect(pf(osm, 'Make the two sides the same concentration.')).toHaveLength(1)
    expect(pf(osm, 'Set the left so the system is at equilibrium.')).toHaveLength(1)
    expect(pf(osm, 'Water moves to the more concentrated side. Show no net movement.')).toHaveLength(1)
    expect(pf(osm, 'Find the left setting with the same water potential as the right.')).toHaveLength(1)
    // The fix named fits the task: it asks for water in osmosis and for solute in diffusion.
    expect(pf(osm, 'Make them equal.' + ' dilute')[0]).toContain('water moves from the left chamber')
    expect(pf(dif, 'The left is more dilute.')[0]).toContain('solute particles moves from the left chamber')
  })

  it('surface-area: the question is fine; the count, the cuts and the rule are not', () => {
    expect(pf(sa, 'Cut the block into equal cubes so that each has at least 3 times the block\'s surface area for its volume.')).toEqual([])
    expect(pf(sa, 'Cut the block until each cube has 3 times the surface for its volume.')).toEqual([])
    expect(pf(sa, 'Cut the block into 27 cubes.')).toHaveLength(1)
    expect(pf(sa, 'Cut it into 3 pieces along each edge.')).toHaveLength(1)
    expect(pf(sa, 'Make 2 cuts across each edge, so each cube has 3 times the surface.')).toHaveLength(1)
    expect(pf(sa, 'Cut into 3 along each edge.')).toHaveLength(1)
    expect(pf(sa, 'The ratio is 6n over the side. Find 3 times.')).toHaveLength(1)
    expect(pf(sa, 'The smaller the cube, the larger its surface for its volume. Cut it so it has 3 times.')).toHaveLength(1)
    expect(pf({ task: 'surface-area', side: 6, times: 2 }, 'Cut the block so that each cube has 2 times the surface area for its volume. The block is 6 cm.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"cell-lab", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const m of found) expect(engine.promptFaults!(engine.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of ['Osmosis', 'Diffusion and osmosis', 'Diffusion across a membrane', 'Diffusion in cells', 'Surface area to volume ratio', 'Why cells are small: surface area to volume',
      'The cell membrane and transport', 'Turgid and flaccid cells', 'Plasmolysis in plant cells', 'Passive transport', 'The concentration gradient', 'Diffusion of gases']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "cell-lab"')
    }
    for (const s of ['Osmosis', 'Diffusion and osmosis', 'Surface area to volume ratio', 'Cell membranes']) {
      expect(scenesFor(s).some((e) => e.id === 'cell-lab'), s).toBe(true)
    }
  })

  it('is not offered for unrelated topics, including the cells and diffusions of other subjects', () => {
    for (const s of [
      'Electrochemical cells', 'Fuel cells and batteries', 'Life in a prison cell', 'Business cell structure',
      'Surface area of a cuboid', 'Surface area of a sphere', 'Volume of a cylinder', 'Area of a rectangle', 'Concentration of solutions', 'Titration calculations',
      'Cell phones and signals', 'Spreadsheet cells', 'Membrane keyboards', 'The structure of a leaf', 'Photosynthesis',
    ]) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "cell-lab"')
      expect(scenesFor(s).some((e) => e.id === 'cell-lab'), s).toBe(false)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('has room for every dot the handle can ask for', () => {
    expect(MAX_DOTS).toBe(LEFT_MAX * DOTS_PER_PART)
    expect(RIGHT_MAX * DOTS_PER_PART).toBeLessThanOrEqual(MAX_DOTS)
  })

  it('seeded dots are the same every time, inside their box, and never touching', () => {
    const a = stillDots(11, 30, BOX_L)
    expect(stillDots(11, 30, BOX_L)).toEqual(a)
    expect(stillDots(11, 12, BOX_L)).toEqual(a.slice(0, 12))
    for (const [seed, box] of [[11, BOX_L], [23, BOX_R]] as const) {
      const dots = stillDots(seed, 30, box)
      for (const d of dots) {
        expect(d.x - DOT_R).toBeGreaterThanOrEqual(box.x0 - DOT_R)
        expect(d.x).toBeLessThanOrEqual(box.x1)
        expect(d.y).toBeGreaterThanOrEqual(box.y0)
        expect(d.y).toBeLessThanOrEqual(box.y1)
      }
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        expect(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y), `${seed}: ${i},${j}`).toBeGreaterThanOrEqual(MIN_GAP)
      }
    }
  })

  it('the water is always above the dots and the streams always run in water, whatever the handle says', () => {
    for (const task of ['diffusion', 'osmosis'] as const) for (const left of range(0, LEFT_MAX)) for (const right of range(RIGHT_MIN, RIGHT_MAX)) {
      const lv = levels(task, left, right)
      expect(lv.l, `${task} ${left} ${right}`).toBeLessThan(BOX_L.y0 - DOT_R - 2)
      expect(lv.r).toBeLessThan(BOX_L.y0 - DOT_R - 2)
      // Water level rises on the side the net of water goes to.
      if (task === 'osmosis' && netOf(task, left, right) === 'right') expect(lv.r).toBeLessThan(lv.l)
      if (task === 'osmosis' && netOf(task, left, right) === 'left') expect(lv.l).toBeLessThan(lv.r)
      if (task === 'osmosis' && netOf(task, left, right) === 'none') expect(lv.l).toBe(lv.r)
    }
    for (const t of [0, 400, 1234, 5000]) for (const n of range(0, WATER)) {
      for (const d of [...laneDots(n, true, t), ...laneDots(n, false, t)]) {
        expect(d.x).toBeGreaterThanOrEqual(LANE_X0)
        expect(d.x).toBeLessThanOrEqual(LANE_X1)
        expect(d.y).toBeGreaterThan(levels('osmosis', 0, 9).l)
      }
    }
  })

  it('streams never touch each other, in the still frame or in motion', () => {
    for (const t of [0, 300, 900, 1700]) for (const n of [WATER, 9, 5]) for (const m of [WATER, 7, 1]) {
      const all = [...laneDots(n, true, t), ...laneDots(m, false, t)]
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y), `t${t} ${n},${m}`).toBeGreaterThanOrEqual(2 * DOT_R + 1)
      }
    }
  })

  it('every label sits nearer its own part than any other', () => {
    for (const l of LABELS) {
      const own = Math.hypot(l.x - PARTS[l.part].x, l.y - PARTS[l.part].y)
      for (const [name, p] of Object.entries(PARTS)) {
        if (name === l.part) continue
        expect(Math.abs(l.x - PARTS[l.part].x), `${l.text} vs ${name}`).toBeLessThan(Math.abs(l.x - p.x) + (own === 0 ? 1 : 0))
      }
    }
  })

  it('the cut cube stays inside its picture and its pieces stay apart', () => {
    for (const n of range(1, TIMES_MAX)) {
      const ps = piecesOf(n)
      expect(ps).toHaveLength(n ** 3)
      const edge = ps[0].e
      expect(n * edge + (n - 1) * GAP).toBeCloseTo(E, 9)
      expect(edge).toBeGreaterThanOrEqual(10)
      for (const p of ps) for (const v of p.at) expect(v + edge).toBeLessThanOrEqual(E + 1e-9)
    }
    // The skin bar, at its longest, fits the card.
    expect(tileX(6 * TIMES_MAX - 1) + TILE).toBeLessThanOrEqual(340)
  })
})

describe('the cell-lab scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'cell-lab', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: CellLabConfig, state: CellLabState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(CellLabView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('diffusion and osmosis: before marking there is a handle, three labels and no answer', () => {
    for (const [cfg, prompt] of [
      [{ task: 'diffusion', right: 4, net: 'right' }, 'Set up the left chamber so that, overall, solute particles move from the left chamber to the right chamber.'],
      [{ task: 'osmosis', right: 6, net: 'none' }, 'The membrane lets only water through. Set up the left chamber so that no water moves across overall.'],
    ] as const) {
      const html = card(cfg, prompt)
      expect(html).toContain('role="slider"')
      expect(html).toContain('touch-none')
      expect(html).toContain('<canvas')
      const shown = text(html.replace(prompt, ''))
      for (const secret of ['net', 'crossed both ways', 'You set', 'never stopped', 'more solute', 'less water', 'higher in', 'diffus', 'concentrat', 'toward']) {
        expect(shown, secret).not.toContain(secret)
      }
      // Few short labels, each on the thing it names.
      expect(html.match(/<text /g)?.length).toBe(4)
      expect(shown).toContain('left')
      expect(shown).toContain('right')
    }
    expect(text(card({ task: 'osmosis', right: 6, net: 'right' }, 'x'))).toContain('only water passes')
    expect(text(card({ task: 'diffusion', right: 6, net: 'right' }, 'x'))).toContain('solute passes')
  })

  it('diffusion and osmosis: the screen-reader text describes what is seen without saying whether it is right', () => {
    const c: CellLabConfig = { task: 'osmosis', right: 6, net: 'right' }
    const idle = raw(c, engine.initial(c), 'idle')
    expect(idle).toContain('The left holds 6 parts of solute out of 10 and the right 6')
    expect(idle).toContain('The water stands level in both.')
    expect(idle).toContain('aria-valuenow="6"')
    // Moving the handle changes the picture's description.
    expect(raw(c, { left: 1 }, 'idle')).toContain('The water stands higher in the right.')
    expect(raw(c, { left: 9 }, 'idle')).toContain('The water stands higher in the left.')
    for (const word of ['correct', 'wrong', 'right answer', 'net movement']) expect(idle).not.toContain(word)
  })

  it('diffusion and osmosis: marking says the two ways, and what the learner made', () => {
    const c: Membrane = { task: 'osmosis', right: 6, net: 'right' }
    const wrong = text(raw(c, { left: 8 }, 'wrong'))
    expect(wrong).toContain('You set the left to 8 parts of solute against 6 on the right: more water crossed to the left than came back.')
    expect(wrong).not.toContain('Water crossed both ways')
    const right = text(raw(c, engine.solve(c), 'right'))
    expect(right).toContain('Water crossed both ways: 12 parts to the right for 6 to the left.')
    expect(right).toContain('The net 6 went to the right')
  })

  it('surface-area: before marking, a cube, two bars and a handle, with no ratio and no working', () => {
    const prompt = 'Cut the block into equal cubes so that each has at least 3 times the block\'s surface area for its volume.'
    const html = card({ task: 'surface-area', side: 6, times: 3 }, prompt)
    expect(html).toContain('role="slider"')
    expect(html).toContain('touch-none')
    const shown = text(html.replace(prompt, ''))
    for (const secret of ['216', '648', 'cm', ' : 1', 'times as much', 'You cut', 'ratio', '6n']) expect(shown, secret).not.toContain(secret)
    expect(shown).toContain('1 cube')
    expect(shown).toContain('skin')
    expect(shown).toContain('inside')
    // Few labels: the count, skin and inside.
    expect(html.match(/<text /g)?.length).toBe(3)
  })

  it('surface-area: cutting changes the picture, and marking says the working', () => {
    const c: Extract<CellLabConfig, { task: 'surface-area' }> = { task: 'surface-area', side: 6, times: 3 }
    const one = raw(c, { pieces: 1 }, 'idle')
    const two = raw(c, { pieces: 2 }, 'idle')
    expect(two).not.toBe(one)
    expect(one.match(/<polygon/g)).toHaveLength(3)
    expect(two.match(/<polygon/g)).toHaveLength(8 * 3)
    expect(two.match(/<rect x="[\d.]+" y="232"/g)).toHaveLength(12)
    expect(one.match(/<rect x="[\d.]+" y="232"/g)).toHaveLength(6)
    expect(text(two)).toContain('8 cubes')
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('Cut into 27 cubes of 2 cm')
    expect(text(raw(c, { pieces: 2 }, 'wrong'))).toContain('You cut it into 8 cubes, 2 along each edge')
  })

  it('reduced motion is honoured: no transitions and no animated position in either view', () => {
    for (const cfg of [{ task: 'osmosis', right: 6, net: 'none' }, { task: 'surface-area', side: 6, times: 3 }] as CellLabConfig[]) {
      const html = renderToStaticMarkup(createElement(CellLabView, { config: cfg, state: engine.initial(cfg), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      expect(html).not.toMatch(/transition|animation/i)
    }
  })
})
