// lib/studylab/engines/coordinate-plane/coordinate-plane.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  coordinatePlaneEngine as engine, equationText, gridPointsOn, lineThrough, madeGradient, madeLine, madePick,
  onLine, rat, readRational, triangleOn, GRID, KINDS, LIMIT,
  type CoordinatePlaneConfig, type CoordinatePlaneState, type Point,
} from './config'
import { CoordinatePlaneView, clipToGrid, lineSeg, placeTriangleLabels, overlaps, unbroken, NUMBER_ZONES, AXIS_ZONES, type Placed } from './View'
import { getEngine } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Straight-line graphs, computed exactly: the tutor names a gradient and an
 * intercept, the engine draws the grid, the line and its rise-over-run
 * triangle, and marks what the learner makes or chooses.
 */

/** Every gradient and intercept the tutor may name: whole numbers and halves, -5 to 5. */
const VALUES = Array.from({ length: 4 * LIMIT + 1 }, (_, i) => i / 2 - LIMIT)
const ALL: CoordinatePlaneConfig[] = KINDS.flatMap((kind) => VALUES.flatMap((gradient) => VALUES.map((intercept) => ({ task: { kind, gradient, intercept } }))))
const config = (kind: string, gradient: unknown, intercept: unknown) => engine.parse({ task: { kind, gradient, intercept } })!
const inGrid = (p: unknown) => Array.isArray(p) && p.every((v) => Number.isInteger(v) && Math.abs(v) <= GRID)

describe('a straight line as the engine works it out', () => {
  it('finds the gradient and intercept through two grid points exactly', () => {
    expect(lineThrough([0, 1], [1, 3])).toEqual({ kind: 'sloped', m: rat(2), c: rat(1) })
    expect(lineThrough([-3, -2], [3, 0])).toEqual({ kind: 'sloped', m: rat(1, 3), c: rat(-1) })
    expect(lineThrough([1, 1], [4, -1])).toEqual({ kind: 'sloped', m: rat(-2, 3), c: rat(5, 3) })
    expect(lineThrough([2, -1], [2, 4])).toEqual({ kind: 'vertical', x: 2 })
    expect(lineThrough([2, 2], [2, 2])).toBeNull()
  })

  it('writes y = mx + c as a school does', () => {
    expect(equationText(rat(2), rat(1))).toBe('y = 2x + 1')
    expect(equationText(rat(-1), rat(3))).toBe('y = −x + 3')
    expect(equationText(rat(1, 2), rat(-2))).toBe('y = (1/2)x − 2')
    expect(equationText(rat(-3, 2), rat(1, 2))).toBe('y = −(3/2)x + 1/2')
    expect(equationText(rat(3), rat(0))).toBe('y = 3x')
    expect(equationText(rat(1), rat(0))).toBe('y = x')
    expect(equationText(rat(0), rat(-4))).toBe('y = −4')
    expect(equationText(rat(0), rat(0))).toBe('y = 0')
  })

  it('lists the grid points a line passes through', () => {
    expect(gridPointsOn(2, 1)).toEqual([[-3, -5], [-2, -3], [-1, -1], [0, 1], [1, 3], [2, 5]])
    expect(gridPointsOn(0.5, 1)).toEqual([[-6, -2], [-4, -1], [-2, 0], [0, 1], [2, 2], [4, 3], [6, 4]])
    expect(gridPointsOn(2, 0.5)).toEqual([])
    expect(gridPointsOn(4.5, 4.5)).toEqual([[-1, 0]])
    expect(onLine(-1, 3, [3, 0])).toBe(true)
    expect(onLine(-1, 3, [0, 0])).toBe(false)
  })

  it('reads the gradient a learner types, exactly', () => {
    expect(readRational('2')).toEqual(rat(2))
    expect(readRational(' −3/2 ')).toEqual(rat(-3, 2))
    expect(readRational('0.5')).toEqual(rat(1, 2))
    expect(readRational('4/8')).toEqual(rat(1, 2))
    expect(readRational('-.25')).toEqual(rat(-1, 4))
    expect(readRational('1/0')).toBeNull()
    expect(readRational('two')).toBeNull()
    expect(readRational('')).toBeNull()
    expect(readRational('.')).toBeNull()
  })

  it('draws a line across the whole grid, edge to edge', () => {
    expect(clipToGrid([0, 1], [1, 2])).toEqual([[-3.5, -6], [2.5, 6]])
    expect(clipToGrid([0, 3], [1, 0])).toEqual([[-6, 3], [6, 3]])
    expect(clipToGrid([2, 0], [0, 1])).toEqual([[2, -6], [2, 6]])
  })
})

describe('the coordinate-plane engine', () => {
  it('reads a task however it is reasonably written, and nothing it cannot draw', () => {
    expect(engine.parse({ task: { kind: 'make-line', gradient: 2, intercept: 1 } })).toEqual({ task: { kind: 'make-line', gradient: 2, intercept: 1 } })
    expect(engine.parse({ task: { kind: 'Make line', m: '1/2', c: '-3' } })).toEqual({ task: { kind: 'make-line', gradient: 0.5, intercept: -3 } })
    expect(engine.parse({ task: { kind: 'findIntercept', gradient: '−1', intercept: 3 } })).toEqual({ task: { kind: 'find-intercept', gradient: -1, intercept: 3 } })
    expect(engine.parse({ task: { kind: 'read_gradient', slope: -1.5, yIntercept: 0 } })).toEqual({ task: { kind: 'read-gradient', gradient: -1.5, intercept: 0 } })
    expect(engine.parse({ task: { kind: 'make-line', gradient: '1/3', intercept: 0 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-line', gradient: 5.5, intercept: 0 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-line', gradient: 2, intercept: 6 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-line', gradient: 'steep', intercept: 1 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-line', gradient: 2 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-circle', gradient: 2, intercept: 1 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'make-line', gradient: Infinity, intercept: 1 } })).toBeNull()
    expect(engine.parse(null)).toBeNull()
  })

  it('over every config it can read, starts unsolved and can be solved, or says why not', () => {
    let valid = 0
    for (const c of ALL) {
      const label = JSON.stringify(c.task)
      expect(engine.parse(c), label).toEqual(c)
      const { kind, gradient: m, intercept: b } = c.task
      const faults = engine.faults(c)
      const throughGridPoints = gridPointsOn(m, b).length >= 2
      const honest = kind === 'find-intercept' ? Number.isInteger(b) : throughGridPoints && !(kind === 'read-gradient' && m === 0)
      // A fault exactly when the task cannot be drawn honestly; never a silent one.
      expect(faults.length === 0, label).toBe(honest)
      for (const f of faults) expect(f, label).toMatch(/\w{4,}.*\b(choose|use|needs)\b/i)
      if (!honest) continue
      valid++
      const start = engine.initial(c)
      const solved = engine.solve(c)
      expect(engine.check(c, start).ok, `${label} starts solved`).toBe(false)
      expect(engine.check(c, solved).ok, `${label} cannot be solved`).toBe(true)
      // The solution is one the learner can make on the grid.
      if (kind === 'make-line') {
        expect(inGrid(solved.a) && inGrid(solved.b), label).toBe(true)
        expect(inGrid(start.a) && inGrid(start.b), label).toBe(true)
        // The start gives away neither half of y = mx + c.
        const first = lineThrough(start.a!, start.b!)
        expect(first?.kind === 'sloped' && first.c.n / first.c.d !== b && first.m.n / first.m.d !== m, label).toBe(true)
      }
      if (kind === 'find-intercept') expect(inGrid(solved.pick), label).toBe(true)
      if (kind === 'read-gradient') {
        const tri = triangleOn(m, b)!
        expect(solved.run! % tri.step, label).toBe(0)
        expect(start.run, label).toBe(tri.step)
        expect(tri.from[0] + tri.most, label).toBeLessThanOrEqual(GRID)
      }
    }
    // 3 kinds of 21 x 21 configs: most can be asked.
    expect(ALL).toHaveLength(3 * 21 * 21)
    expect(valid).toBeGreaterThan(600)
  })

  it('marks a made line right exactly when it has the asked gradient and intercept, whichever two grid points make it', () => {
    const grid: Point[] = []
    for (let x = -GRID; x <= GRID; x++) for (let y = -GRID; y <= GRID; y++) grid.push([x, y])
    for (const [m, b] of [[2, 1], [-1, 3], [0.5, -2], [-1.5, 0.5], [0, -4], [5, -5]]) {
      const c = config('make-line', m, b)
      let right = 0
      for (const p of grid) {
        for (const q of grid) {
          const dx = q[0] - p[0]
          // An independent working: the gradient and intercept in floating point.
          const expected = dx !== 0 && Math.abs((q[1] - p[1]) / dx - m) < 1e-9 && Math.abs(p[1] - ((q[1] - p[1]) / dx) * p[0] - b) < 1e-9
          const ok = engine.check(c, { a: p, b: q }).ok
          if (ok !== expected) throw new Error(`y = ${m}x + ${b}: ${JSON.stringify([p, q])} marked ${ok}`)
          if (ok) right++
        }
      }
      const n = gridPointsOn(m, b).length
      expect(right).toBe(n * (n - 1))
    }
  })

  it('marks the intercept only at the crossing, and the gradient however it is written', () => {
    const fi = config('find-intercept', -1, 3)
    expect(engine.check(fi, { pick: [0, 3] }).ok).toBe(true)
    expect(engine.check(fi, { pick: [3, 0] }).ok).toBe(false)
    expect(engine.check(fi, { pick: null }).ok).toBe(false)
    expect(engine.check(fi, { pick: [0, 9] as Point }).ok).toBe(false)
    const rg = config('read-gradient', -1.5, 1)
    for (const typed of ['-3/2', '−1.5', '-6/4', ' -1.50 ']) expect(engine.check(rg, { run: 2, answer: typed }).ok, typed).toBe(true)
    for (const typed of ['3/2', '-2/3', '-1', '', 'minus 1.5']) expect(engine.check(rg, { run: 2, answer: typed }).ok, typed).toBe(false)
  })

  it('says what the learner made when it is wrong, never the line asked for', () => {
    const ml = config('make-line', 2, 1)
    expect(madeLine(ml, [0, -1], [1, 1])).toBe('You made y = 2x − 1: the gradient is right, but it crosses the y-axis somewhere else.')
    expect(madeLine(ml, [0, 1], [1, 4])).toBe('You made y = 3x + 1: it crosses the y-axis in the right place, but it is too steep.')
    expect(madeLine(ml, [0, 1], [2, 3])).toBe('You made y = x + 1: it crosses the y-axis in the right place, but it is not steep enough.')
    expect(madeLine(ml, [0, 1], [1, -1])).toBe('You made y = −2x + 1: it crosses the y-axis in the right place, but it slopes the other way.')
    expect(madeLine(ml, [0, 1], [3, 1])).toBe('You made y = 1: it crosses the y-axis in the right place, but it is flat.')
    expect(madeLine(ml, [2, 1], [2, 5])).toMatch(/^You made x = 2, a vertical line/)
    const fi = config('find-intercept', -1, 3)
    expect(madePick(fi, [3, 0])).toBe('You chose (3, 0), where the line crosses the x-axis.')
    expect(madePick(fi, [1, 2])).toBe('You chose (1, 2): it is on the line, but not on the y-axis.')
    expect(madePick(fi, [0, 2])).toBe('You chose (0, 2): it is on the y-axis, but the line does not pass through it.')
    expect(madePick(fi, [-2, -2])).toBe('You chose (−2, −2): it is not on the line, and not on the y-axis.')
    for (const said of [madePick(fi, [3, 0]), madePick(fi, [1, 2]), madePick(fi, [0, 2])]) expect(said).not.toMatch(/\(0, 3\)|y =/)
    expect(madeGradient('1/2')).toBe('You wrote 1/2: a line with that gradient goes up 1 for every 2 across.')
    expect(madeGradient('-0.4')).toBe('You wrote -0.4: a line with that gradient goes down 2 for every 5 across.')
    expect(madeGradient('0')).toBe('You wrote 0: a line with gradient 0 is flat.')
    expect(madeGradient('steep')).toMatch(/is not a number/)
  })

  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('coordinate-plane')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/SCENE "coordinate-plane"/)
    expect(engine.prompt).toMatch(/"engine":"coordinate-plane"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:coordinate-plane"/)
    for (const kind of KINDS) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    // Every example config in the catalogue is one the engine reads and finds no fault in.
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task": \{[^}]*\} \})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBeGreaterThanOrEqual(2)
    for (const ex of examples) expect(engine.faults(engine.parse(ex)!)).toEqual([])
  })
})

describe('the coordinate-plane scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'coordinate-plane', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  /** The view as drawn, its no-break spaces read as spaces. */
  const raw = (cfg: CoordinatePlaneConfig, state: CoordinatePlaneState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(CoordinatePlaneView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
  const view = (...args: Parameters<typeof raw>) => raw(...args).replace(/ /g, ' ')

  it('never breaks a line inside an equation, a coordinate or the working', () => {
    expect(unbroken('It crosses the y-axis at (0, −2): the line is y = (1/2)x − 2.'))
      .toBe('It crosses the y-axis at (0, −2): the line is y = (1/2)x − 2.')
    expect(unbroken('You made y = 2x − 1: the gradient is right')).toBe('You made y = 2x − 1: the gradient is right')
    expect(unbroken('Gradient = rise ÷ run = 6 ÷ 3 = 2;')).toBe('Gradient = rise ÷ run = 6 ÷ 3 = 2;')
    const fi = config('find-intercept', 0.5, -2)
    expect(raw(fi, { pick: [0, -2] }, 'right')).toContain('y = (1/2)x − 2.')
  })

  it('leaves out an axis number while a point sits on it, and only then', () => {
    const ml = config('make-line', 2, 1)
    const count = (html: string, n: string) => html.split(`>${n}</text>`).length - 1
    // A point at (−1, −5) sits on the y-axis's −5; the x-axis's −5 stays.
    expect(count(view(ml, { a: [-1, -5], b: [2, 1] }, 'idle'), '−5')).toBe(1)
    expect(count(view(ml, { a: [-3, -5], b: [2, 1] }, 'idle'), '−5')).toBe(2)
    // A point at (4, −1) sits on the x-axis's 4.
    expect(count(view(ml, { a: [4, -1], b: [-2, 1] }, 'idle'), '4')).toBe(1)
    expect(count(view(ml, engine.initial(ml), 'idle'), '4')).toBe(2)
  })

  it('draws a grid from −6 to 6, labelled at every whole number', () => {
    const html = card({ task: { kind: 'make-line', gradient: 2, intercept: 1 } }, 'Make the line y = 2x + 1.')
    for (let t = 1; t <= GRID; t++) {
      expect(html).toContain(`>${t}</text>`)
      expect(html).toContain(`>−${t}</text>`)
    }
  })

  /** A rise or run with its number: "rise 2", "run 6", "rise −3", in text or an attribute. */
  const NUMBERED = /\b(rise|run)\b[^<"]{0,3}[−-]?\d/i

  it('make-line: two points the keyboard can move, and before marking only the line, the points and an unnumbered triangle', () => {
    const prompt = 'Make the line y = 2x + 1.'
    const html = card({ task: { kind: 'make-line', gradient: 2, intercept: 1 } }, prompt)
    expect(html.match(/role="slider"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-valuetext="\(−3, −2\)"/)
    expect(html).toContain('>run</text>')
    expect(html).toContain('>rise</text>')
    const shown = html.replace(prompt, '')
    // No equation, no working, no numbered legs -- in the picture, the text or the screen-reader text.
    expect(shown).not.toMatch(/\by = |\bx = |gradient|÷|crosses the y-axis|You made/i)
    expect(shown).not.toMatch(NUMBERED)
  })

  it('make-line: once marked, says what the learner made and numbers the triangle', () => {
    const ml = config('make-line', 2, 1)
    const wrong = view(ml, engine.initial(ml), 'wrong')
    expect(wrong).toContain('You made y = (1/3)x − 1.')
    expect(wrong).toContain('>run 6</text>')
    expect(wrong).toContain('>rise 2</text>')
    expect(wrong).toContain('Gradient = rise ÷ run = 2 ÷ 6 = 1/3; it crosses the y-axis at (0, −1).')
  })

  it('find-intercept: a grid the keyboard can choose on, and no equation or crossing named before marking', () => {
    const prompt = 'Tap the point where this line crosses the y-axis.'
    const html = card({ task: { kind: 'find-intercept', gradient: -1, intercept: 3 } }, prompt)
    expect(html).toMatch(/role="slider"[^>]*aria-valuetext="No point chosen yet"/)
    const shown = html.replace(prompt, '')
    expect(shown).not.toMatch(/y = |\(0, 3\)|−x|gradient|intercept/i)
  })

  it('read-gradient: a triangle the keyboard can stretch, labelled "rise" and "run" with no numbers anywhere until marked', () => {
    const prompt = 'What is the gradient of this line?'
    for (const [m, b] of [[0.5, -2], [2, -3], [-1.5, 1]]) {
      const html = card({ task: { kind: 'read-gradient', gradient: m, intercept: b } }, prompt)
      // Stretchable: a slider whose corner can go further along the line than it starts.
      const slider = /role="slider"[^>]*aria-valuemin="(-?\d+)"[^>]*aria-valuemax="(-?\d+)"[^>]*aria-valuenow="(-?\d+)"[^>]*aria-valuetext="corner at \([^)]*\)"/.exec(html)
      expect(slider, `${m}`).not.toBeNull()
      expect(Number(slider![2]), `${m}`).toBeGreaterThan(Number(slider![3]))
      expect(html).toMatch(/<input[^>]*id="[^"]*-gradient"/)
      expect(html).toContain('>run</text>')
      expect(html).toContain('>rise</text>')
      const shown = html.replace(prompt, '')
      expect(shown, `${m}`).not.toMatch(NUMBERED)
      expect(shown, `${m}`).not.toMatch(/\by = |gradient = |\b2x\b/i)
    }
    // The starting triangle on a gradient-1/2 line, which gave "rise 1, run 2" away, says neither.
    const rg = config('read-gradient', 0.5, -2)
    const start = view(rg, engine.initial(rg), 'idle')
    expect(start).not.toMatch(/rise 1|run 2/)
    // Once marked, the legs are numbered.
    const marked = view(rg, engine.initial(rg), 'wrong')
    expect(marked).toContain('>run 2</text>')
    expect(marked).toContain('>rise 1</text>')
  })

  it('once marked, names the learner’s mistake when wrong and the line when right', () => {
    const fi = config('find-intercept', -1, 3)
    const wrong = view(fi, { pick: [3, 0] }, 'wrong')
    expect(wrong).toContain('You chose (3, 0), where the line crosses the x-axis.')
    expect(wrong).not.toMatch(/y = |\(0, 3\)/)
    expect(view(fi, engine.solve(fi), 'right')).toContain('It crosses the y-axis at (0, 3): the line is y = −x + 3.')

    const ml = config('make-line', 2, 1)
    expect(view(ml, { a: [0, -1], b: [1, 1] }, 'wrong')).toContain('You made y = 2x − 1: the gradient is right')
    expect(view(ml, engine.solve(ml), 'shown')).toContain('y = 2x + 1: gradient 2, crossing the y-axis at (0, 1).')

    const rg = config('read-gradient', 2, -3)
    expect(view(rg, { run: 2, answer: '1/2' }, 'wrong')).toContain('You wrote 1/2: a line with that gradient goes up 1 for every 2 across.')
    expect(view(rg, { run: 2, answer: '2' }, 'right')).toContain('Gradient = rise ÷ run = 4 ÷ 2 = 2. The line is y = 2x − 3.')
  })

  it('locks its controls once solved', () => {
    const ml = config('make-line', 2, 1)
    const html = view(ml, engine.solve(ml), 'right')
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-disabled="true"/)
  })
})

describe('nothing on the grid sits on anything else', () => {
  const card = (cfg: unknown) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt: 'Go.', payload: { engine: 'coordinate-plane', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const onAxisNumbers = (p: Placed) => [...NUMBER_ZONES, ...AXIS_ZONES].some((z) => overlaps(p.box, z))
  const labels = (a: Point, b: Point, shown: boolean) => placeTriangleLabels(a, b, shown, lineSeg(a, [b[0] - a[0], b[1] - a[1]]))!

  it('draws the axis numbers over the line and the triangle, haloed in the panel colour, and under the labels and points', () => {
    for (const kind of KINDS) {
      const html = card({ task: { kind, gradient: 2, intercept: 1 } })
      const line = html.indexOf('data-line')
      const numbers = html.indexOf('data-axis-numbers')
      const control = html.indexOf('role="slider"')
      expect(line, kind).toBeGreaterThan(-1)
      expect(numbers, kind).toBeGreaterThan(line)
      expect(control, kind).toBeGreaterThan(numbers)
      if (kind !== 'find-intercept') {
        expect(html.indexOf('stroke-dasharray'), kind).toBeLessThan(numbers)
        expect(html.indexOf('data-triangle-labels'), kind).toBeGreaterThan(numbers)
      }
      expect(html, kind).toMatch(/data-axis-numbers=""[^>]*stroke="var\(--ss-panel[^"]*"[^>]*paint-order="stroke"/)
    }
  })

  it('keeps the triangle labels off the axis numbers and the axes on the cards the eval caught', () => {
    // The make-line start (run over −2, rise across the x-axis numbers), a short
    // triangle on the y-axis, a falling one across the origin, and read-gradient's start.
    const cases: [Point, Point][] = [[[-3, -2], [3, 0]], [[0, 3], [1, 5]], [[-1, 2], [1, -1]], [[-6, -5], [-4, -4]], [[-1, -5], [0, -3]]]
    for (const [a, b] of cases) {
      for (const shown of [false, true]) {
        const at = labels(a, b, shown)
        expect(onAxisNumbers(at.run), `${JSON.stringify([a, b])} run`).toBe(false)
        expect(onAxisNumbers(at.rise), `${JSON.stringify([a, b])} rise`).toBe(false)
        expect(overlaps(at.run.box, at.rise.box)).toBe(false)
      }
    }
  })

  it('keeps them clear across every triangle two grid points can make, all but a few that sit right on an axis', () => {
    let total = 0
    let clashes = 0
    for (let x1 = -GRID; x1 <= GRID; x1++) for (let y1 = -GRID; y1 <= GRID; y1++) {
      for (let x2 = x1 + 1; x2 <= GRID; x2++) for (let y2 = -GRID; y2 <= GRID; y2++) {
        const at = labels([x1, y1], [x2, y2], true)
        total++
        if (onAxisNumbers(at.run) || onAxisNumbers(at.rise) || overlaps(at.run.box, at.rise.box)) clashes++
      }
    }
    expect(total).toBe(169 * 78)
    expect(clashes / total).toBeLessThan(0.01)
  }, 30_000)
})

describe('the prompt a coordinate-plane card is written with', () => {
  const faults = (kind: string, prompt: string) => {
    const e = getEngine('coordinate-plane')!
    return e.promptFaults!(e.parse({ task: { kind, gradient: -1, intercept: 3 } })!, prompt)
  }
  it('may not give the line it asks the learner to read', () => {
    expect(faults('find-intercept', 'Tap where y = -x + 3 crosses the y-axis.').join(' ')).toMatch(/gives the answer away/)
    expect(faults('read-gradient', 'Find the gradient of y = −x + 3.').join(' ')).toMatch(/gives the answer away/)
    expect(faults('find-intercept', 'It crosses at (0, 3) -- tap it.').join(' ')).toMatch(/gives the answer away/)
  })
  it('names the line to make, and asks the rest plainly', () => {
    expect(faults('make-line', 'Make the line y = -x + 3.')).toEqual([])
    expect(faults('find-intercept', 'Tap the point where this line crosses the y-axis.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('coordinate-plane')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})
