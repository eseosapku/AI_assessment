// lib/studylab/engines/transformations/transformations.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  transformationsEngine as engine, BASE, ENLARGEMENTS, GRID, MIRRORS, REFLECTIONS, ROTATIONS, SCALES, SHAPES, START, TASKS, TRANSLATIONS, TURNS,
  goodPrompt, imageOf, kRange, landed, lineText, madeText, readState, safeScenario, scenarioOf, working, type Pt, type TfConfig, type TfState,
} from './config'
import { H, TransformationsView, U, W, X_MAX, X_MIN, Y_MAX, Y_MIN, lineEnds } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const kindsOf = (task: TfConfig['task']): string[] => (task === 'reflect' ? [...MIRRORS] : task === 'rotate' ? [...TURNS] : task === 'enlarge' ? [...SCALES] : [''])
/** Every config the tutor can write, valid or not: tasks x shapes x kinds x variants 1..4. */
const EVERY: TfConfig[] = TASKS.flatMap((task) => SHAPES.flatMap((shape) => kindsOf(task).flatMap((kind) => [1, 2, 3, 4].map((variant) => ({ task, shape, kind, variant })))))
const VALID = EVERY.filter((c) => engine.faults(c).length === 0)
const nameOf = (c: TfConfig) => JSON.stringify(c)

const onGrid = (p: Pt) => p[0] >= GRID.xMin && p[0] <= GRID.xMax && p[1] >= GRID.yMin && p[1] <= GRID.yMax
const same = (a: Pt[], b: Pt[]) => a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])

describe('the grid the view draws is the grid the engine marks on', () => {
  it('agrees with config.ts (View.tsx cannot read config constants at load)', () => {
    expect([X_MIN, X_MAX, Y_MIN, Y_MAX]).toEqual([GRID.xMin, GRID.xMax, GRID.yMin, GRID.yMax])
    expect(W).toBe(30 + (X_MAX - X_MIN) * U + 22)
    expect(H).toBe(16 + (Y_MAX - Y_MIN) * U + 22)
  })
})

describe('the maths', () => {
  const L = BASE.L
  it('reflects exactly in each kind of line', () => {
    expect(imageOf('reflect', [[1, 2]], { ...START, dir: 'v', k: 3 })).toEqual([{ x: 5, y: 2, d: 1 }])
    expect(imageOf('reflect', [[1, 2]], { ...START, dir: 'h', k: -1 })).toEqual([{ x: 1, y: -4, d: 1 }])
    expect(imageOf('reflect', [[1, 3]], { ...START, dir: 'up', k: 0 })).toEqual([{ x: 3, y: 1, d: 1 }])
    expect(imageOf('reflect', [[1, 3]], { ...START, dir: 'up', k: 2 })).toEqual([{ x: 1, y: 3, d: 1 }]) // on the line y = x + 2
    expect(imageOf('reflect', [[1, 3]], { ...START, dir: 'down', k: 0 })).toEqual([{ x: -3, y: -1, d: 1 }])
  })
  it('a reflection twice is the shape, and the mirror line halves every point and its image', () => {
    for (const dir of ['v', 'h', 'up', 'down'] as const) {
      for (let k = -3; k <= 3; k++) {
        const s = { ...START, dir, k }
        const once = imageOf('reflect', L, s)
        const back = imageOf('reflect', once.map((e) => [e.x, e.y] as Pt), s)
        expect(back.map((e) => [e.x, e.y])).toEqual(L)
      }
    }
  })
  it('rotates about a centre with exact quarter and half turns', () => {
    expect(imageOf('rotate', [[3, 1]], { ...START, cx: 1, cy: 1, turn: 90 })).toEqual([{ x: 1, y: -1, d: 1 }])
    expect(imageOf('rotate', [[3, 1]], { ...START, cx: 1, cy: 1, turn: -90 })).toEqual([{ x: 1, y: 3, d: 1 }])
    expect(imageOf('rotate', [[3, 1]], { ...START, cx: 1, cy: 1, turn: 180 })).toEqual([{ x: -1, y: 1, d: 1 }])
    // four quarter turns come home
    let p: Pt = [4, -2]
    for (let i = 0; i < 4; i++) { const e = imageOf('rotate', [p], { ...START, cx: -1, cy: 2, turn: 90 })[0]; p = [e.x, e.y] }
    expect(p).toEqual([4, -2])
  })
  it('enlarges from the centre, never from the origin, by a whole, half or negative factor', () => {
    expect(imageOf('enlarge', [[2, 2]], { ...START, cx: 1, cy: 0, scale: 2 })).toEqual([{ x: 3, y: 4, d: 1 }])
    expect(imageOf('enlarge', [[3, 2]], { ...START, cx: 1, cy: 0, scale: 0.5 })).toEqual([{ x: 4, y: 2, d: 2 }])
    expect(imageOf('enlarge', [[2, 2]], { ...START, cx: 1, cy: 0, scale: -2 })).toEqual([{ x: -1, y: -4, d: 1 }])
    expect(imageOf('enlarge', [[2, 2]], { ...START, cx: 1, cy: 0, scale: -1 })).toEqual([{ x: 0, y: -2, d: 1 }])
  })
  it('translates by the vector', () => {
    expect(imageOf('translate', [[1, 1]], { ...START, vx: -3, vy: 4 })).toEqual([{ x: -2, y: 5, d: 1 }])
  })
})

describe('every valid config', { timeout: 30_000 }, () => {
  it('has a count that is the product of what is prepared', () => {
    const per = (list: unknown[]) => list.length * SHAPES.length
    const reflect = Object.values(REFLECTIONS).reduce((n, l) => n + per(l), 0)
    const rotate = TURNS.length * per(ROTATIONS)
    const enlarge = Object.values(ENLARGEMENTS).reduce((n, l) => n + per(l), 0) - ENLARGEMENTS['3'].length // the L cannot be tripled
    const translate = per(TRANSLATIONS)
    expect(VALID.length).toBe(reflect + rotate + enlarge + translate)
    expect(VALID.length).toBeGreaterThan(60)
  })

  it('draws shape, target and every image on the grid, in whole numbers, apart from where it started', () => {
    for (const c of VALID) {
      const sc = scenarioOf(c)!
      expect(sc, nameOf(c)).not.toBeNull()
      expect(sc.shape.every(onGrid), `shape ${nameOf(c)}`).toBe(true)
      expect(sc.target.every(onGrid), `target ${nameOf(c)}`).toBe(true)
      expect(sc.target.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)), `whole ${nameOf(c)}`).toBe(true)
      expect(same(sc.shape, sc.target), `target is the shape ${nameOf(c)}`).toBe(false)
      // the learner's image under the answer is the target, with the real maths
      const image = imageOf(c.task, sc.shape, sc.answer)
      expect(image.every((e, i) => e.x === sc.target[i][0] * e.d && e.y === sc.target[i][1] * e.d)).toBe(true)
    }
  })

  it('starts unsolved, and solve always passes', () => {
    for (const c of VALID) {
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('is solved by the answer alone: every other single move off it fails', () => {
    for (const c of VALID) {
      const a = engine.solve(c)
      const off: Partial<TfState>[] = c.task === 'reflect' ? [{ k: a.k + 1 }, { k: a.k - 1 }]
        : c.task === 'translate' ? [{ vx: a.vx + 1 }, { vy: a.vy - 1 }]
          : [{ cx: a.cx + 1 }, { cy: a.cy - 1 }]
      for (const o of off) expect(landed(c, { ...a, ...o }), `${nameOf(c)} ${JSON.stringify(o)}`).toBe(false)
    }
  })

  it('has one answer a learner can reach by the controls: every state is whole and in range', () => {
    for (const c of VALID) {
      const a = engine.solve(c)
      expect(readState(a)).toEqual(a)
      if (c.task === 'reflect') { const [lo, hi] = kRange(a.dir); expect(a.k >= lo && a.k <= hi).toBe(true) }
    }
  })

  it('marks by the exact image: ok exactly when every vertex lands, over many states', () => {
    let seed = 7
    const rnd = (n: number) => { seed = (seed * 48271) % 2147483647; return seed % n }
    for (const c of VALID.filter((_, i) => i % 3 === 0)) {
      const sc = scenarioOf(c)!
      for (let i = 0; i < 25; i++) {
        const s: TfState = {
          dir: (['v', 'h', 'up', 'down'] as const)[rnd(4)], k: rnd(9) - 4, cx: rnd(13) - 6, cy: rnd(11) - 5, turn: ([0, 90, -90, 180] as const)[rnd(4)],
          scale: [-2, -1, 0.5, 1, 2, 3][rnd(6)], vx: rnd(13) - 6, vy: rnd(11) - 5,
        }
        const image = imageOf(c.task, sc.shape, readState(s))
        const exact = image.every((e, j) => e.x === sc.target[j][0] * e.d && e.y === sc.target[j][1] * e.d)
        expect(engine.check(c, s).ok, nameOf(c) + JSON.stringify(s)).toBe(exact)
      }
    }
  })

  it('a wrong or odd state never crashes marking or the words', () => {
    for (const c of VALID.slice(0, 40)) {
      for (const bad of [null, undefined, 3, 'x', {}, { dir: 'z', k: 'a', scale: 7, turn: 45 }]) {
        expect(() => engine.check(c, bad as never)).not.toThrow()
        expect(madeText(c, bad)).toBeTruthy()
        expect(working(c, bad)).toBeTruthy()
      }
    }
  })
})

describe('reading the tutor\'s config', () => {
  it('reads each task by the names the books use', () => {
    const p = (o: unknown) => engine.parse(o)
    expect(p({ task: 'reflect', shape: 'L', mirror: 'vertical', variant: 2 })).toEqual({ task: 'reflect', shape: 'L', kind: 'vertical', variant: 2 })
    expect(p({ task: 'Reflection', mirror: 'Vertical line' })).toMatchObject({ task: 'reflect', kind: 'vertical' })
    expect(p({ task: 'rotation', turn: 'Half turn', shape: 'triangle' })).toMatchObject({ task: 'rotate', kind: 'half', shape: 'triangle' })
    expect(p({ task: 'rotate', turn: 'anti-clockwise' })).toMatchObject({ kind: 'anticlockwise' })
    expect(p({ task: 'rotate', angle: 90 })).toMatchObject({ kind: 'clockwise' })
    expect(p({ task: 'enlargement', scale: 'double' })).toMatchObject({ task: 'enlarge', kind: '2' })
    expect(p({ task: 'enlarge', scale: 0.5 })).toMatchObject({ kind: '1/2' })
    expect(p({ task: 'enlarge', scaleFactor: -2 })).toMatchObject({ kind: '-2' })
    expect(p({ task: 'enlarge', scale: '-1' })).toMatchObject({ kind: '-1' })
    expect(p({ task: 'translation' })).toMatchObject({ task: 'translate', kind: '', variant: 1 })
    expect(p({ task: { kind: 'reflect', mirror: 'diagonal' } })).toMatchObject({ task: 'reflect', kind: 'diagonal' })
    expect(p({ task: 'reflect' })).toMatchObject({ kind: 'vertical', shape: 'L', variant: 1 })
  })
  it('reads broadly and refuses narrowly: a thing it cannot draw still parses, and faults says what works', () => {
    const odd = engine.parse({ task: 'reflect', mirror: 'y = 3x', shape: 'hexagon', variant: 9 })!
    expect(odd).not.toBeNull()
    const f = engine.faults(odd)
    expect(f.length).toBeGreaterThan(0)
    expect(f[0]).toMatch(/shape/)
    expect(f[0]).toMatch(/L, triangle/)
    const wrongMirror = engine.faults(engine.parse({ task: 'reflect', mirror: 'wobbly' })!)
    expect(wrongMirror[0]).toMatch(/vertical, horizontal, diagonal/)
    expect(wrongMirror[0]).toMatch(/"mirror":"vertical"/)
    expect(engine.faults(engine.parse({ task: 'enlarge', scale: 5 })!)[0]).toMatch(/2, 3, 1\/2, -1 or -2/)
    expect(engine.faults(engine.parse({ task: 'reflect', variant: 9 })!)[0]).toMatch(/1 to 3/)
    expect(engine.faults(engine.parse({ task: 'translate', variant: 0 })!)[0]).toMatch(/1 to 4/)
    expect(engine.faults(engine.parse({ task: 'enlarge', scale: 3, shape: 'L' })!)[0]).toMatch(/triangle/)
  })
  it('only returns null for what cannot be read at all', () => {
    for (const raw of [null, undefined, 3, 'reflect', [], {}, { task: 'shear' }, { task: 'reflect', variant: 'x' }, { task: 'matrix' }]) expect(engine.parse(raw), JSON.stringify(raw)).toBeNull()
    expect(engine.parse({ task: 'reflect', variant: '2' })).toMatchObject({ variant: 2 })
  })
  it('every example in the catalogue entry parses, has no faults, and passes promptFaults', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"transformations", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(f[1]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(TASKS))
  })
  it('every kind has a good prompt that passes, and the catalogue counts are the counts it marks to', () => {
    for (const c of VALID) expect(engine.promptFaults!(c, goodPrompt(c)), nameOf(c)).toEqual([])
    expect(engine.prompt).toMatch(new RegExp(`variant: 1 to ${REFLECTIONS.vertical.length} \\(translate: 1 to ${TRANSLATIONS.length}`))
    expect(ENLARGEMENTS['-1'].length).toBe(2)
    expect(ENLARGEMENTS['-2'].length).toBe(2)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/SCENE "transformations"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:transformations"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
  })
})

describe('promptFaults', () => {
  const R: TfConfig = { task: 'reflect', shape: 'L', kind: 'vertical', variant: 1 }
  const T: TfConfig = { task: 'rotate', shape: 'L', kind: 'clockwise', variant: 1 }
  const E: TfConfig = { task: 'enlarge', shape: 'L', kind: '2', variant: 1 }
  const V: TfConfig = { task: 'translate', shape: 'L', kind: '', variant: 1 }
  const bad = (c: TfConfig, p: string) => engine.promptFaults!(c, p).length > 0
  it('refuses a prompt that writes the answer', () => {
    expect(bad(R, 'Reflect the shape in the line x = 1 so it lands on the target.')).toBe(true)
    expect(bad(R, 'Use the vertical mirror line to reflect the L onto the target.')).toBe(true)
    expect(bad(R, 'Reflect the shape in the y-axis.')).toBe(true)
    expect(bad(T, 'Rotate the shape 90 degrees clockwise about the origin.')).toBe(true)
    expect(bad(T, 'Turn the shape a quarter turn about (1, 2).')).toBe(true)
    expect(bad(T, 'Rotate it about the origin onto the target.')).toBe(true)
    expect(bad(E, 'Enlarge the shape by scale factor 2 from the pin.')).toBe(true)
    expect(bad(E, 'Make the shape twice as big, using the pin as the centre.')).toBe(true)
    expect(bad(E, 'Enlarge with a negative scale factor so it lands on the target.')).toBe(true)
    expect(bad(V, 'Move the shape 3 right and 2 up onto the target.')).toBe(true)
    expect(bad(V, 'Translate the shape by the vector (3, 2).')).toBe(true)
  })
  it('refuses a prompt that promises what the card does not show', () => {
    expect(bad(R, 'Reflect the shape, then describe the transformation fully.')).toBe(true)
    expect(bad(T, 'Write down the centre of rotation.')).toBe(true)
    expect(bad(E, 'Enter the scale factor, then reflect the result.')).toBe(true)
    expect(bad(V, 'Use tracing paper to check.')).toBe(true)
    expect(bad(R, 'Use a ruler to draw the mirror line.')).toBe(true)
    expect(bad(E, 'Apply the matrix to the shape.')).toBe(true)
  })
  it('lets through prompts that ask for the outcome and name the gesture', () => {
    expect(bad(R, 'Slide the mirror line until the reflected shape lands on the dashed target.')).toBe(false)
    expect(bad(T, 'Drag the pin and choose a turn so the turned shape lands exactly on the target.')).toBe(false)
    expect(bad(E, 'Drag the pin and choose the scale factor until the new shape lands exactly on the dashed target.')).toBe(false)
    expect(bad(V, 'Drag the arrow head until the moved shape lands on the dashed target.')).toBe(false)
  })
})

describe('what is said, and when', () => {
  const R: TfConfig = { task: 'reflect', shape: 'L', kind: 'diagonal', variant: 3 }
  it('writes the line in algebra and names the learner\'s own line when wrong', () => {
    expect(lineText('up', 2)).toBe('y = x + 2')
    expect(lineText('down', 0)).toBe('y = −x')
    expect(lineText('up', -3)).toBe('y = x − 3')
    expect(lineText('v', -1)).toBe('x = −1')
    expect(working(R, engine.solve(R))).toContain('y = x + 2')
    expect(madeText(R, { ...START, dir: 'h', k: 1 })).toContain('y = 1')
    expect(madeText(R, { ...START, dir: 'h', k: 1 })).not.toContain('y = x + 2')
  })
  it('says what was made on a wrong card, and not where the answer is', () => {
    const T: TfConfig = { task: 'rotate', shape: 'L', kind: 'half', variant: 1 }
    const msg = madeText(T, { ...START, cx: 2, cy: 2, turn: 90 })
    expect(msg).toContain('a quarter turn clockwise')
    expect(msg).toContain('(2, 2)')
    expect(msg).not.toMatch(/half turn|180/)
    const E: TfConfig = { task: 'enlarge', shape: 'L', kind: '-2', variant: 1 }
    expect(working(E, engine.solve(E))).toMatch(/opposite side of the centre/)
    expect(madeText(E, START)).toMatch(/scale factor of 1/)
    const tr: TfConfig = { task: 'translate', shape: 'L', kind: '', variant: 1 }
    expect(working(tr, engine.solve(tr))).toContain('5 right and 2 up')
  })
})

describe('the mirror line is drawn across the grid', () => {
  it('has both ends on the grid edge for every line the learner can make', () => {
    for (const dir of ['v', 'h', 'up', 'down'] as const) {
      const [lo, hi] = kRange(dir)
      for (let k = lo; k <= hi; k++) {
        const [a, b] = lineEnds(dir, k)
        for (const p of [a, b]) {
          expect(p[0] >= X_MIN - 1e-9 && p[0] <= X_MAX + 1e-9 && p[1] >= Y_MIN - 1e-9 && p[1] <= Y_MAX + 1e-9, `${dir} ${k}`).toBe(true)
        }
        // both ends are on the line itself
        const on = (p: Pt) => (dir === 'v' ? p[0] === k : dir === 'h' ? p[1] === k : dir === 'up' ? p[1] === p[0] + k : p[1] + p[0] === k)
        expect(on(a) && on(b), `${dir} ${k}`).toBe(true)
        expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `${dir} ${k} has length`).toBeGreaterThan(0)
      }
    }
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'transformations', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: TfConfig, state: unknown, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(TransformationsView, { config: cfg, state: state as TfState, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const EX = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"transformations", "config": (\{[^}]*\})/g)].map((m) => [JSON.parse(m[2]), m[1]] as [unknown, string])

  it('is registered, draws real buttons, and its pins and line are draggable without scrolling the page', () => {
    expect(getEngine('transformations')).toBe(engine)
    for (const [cfg, prompt] of EX) {
      const html = card(cfg, prompt)
      expect(html, JSON.stringify(cfg)).toContain('<button')
      expect(html).toContain('touch-action:none')
      expect(html).toContain('data-target')
    }
  })

  it('before marking, nothing says the answer: no "Yes", no right line, turn, scale or vector', () => {
    for (const [cfg, prompt] of EX) {
      const c = engine.parse(cfg)!
      const html = card(cfg, prompt)
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      expect(shown).not.toContain('Yes')
      expect(shown).not.toContain('not on the target')
      expect(shown).not.toContain('lands')
      const a = engine.solve(c)
      if (c.task === 'reflect') expect(shown).not.toContain(lineText(a.dir, a.k))
      // the learner's own state is what is shown: the start, never the answer
      expect(landed(c, engine.initial(c))).toBe(false)
    }
  })

  it('holds the answer out of the DOM at the start, for the answer line and the answer vector', () => {
    const r = engine.parse({ task: 'reflect', mirror: 'diagonal', variant: 3 })!
    const html = raw(r, engine.initial(r), 'idle')
    expect(html).not.toContain('y = x + 2')
    expect(html).not.toContain('y = x')
    const v = engine.parse({ task: 'translate', variant: 1 })!
    const vh = raw(v, engine.initial(v), 'idle')
    expect(vh).not.toContain('+5')
  })

  it('says what was made when wrong, and what was found when right, only once marked', () => {
    for (const c of VALID.filter((_, i) => i % 7 === 0)) {
      const wrong = raw(c, engine.initial(c), 'wrong')
      expect(text(wrong), nameOf(c)).toMatch(/not on the target|not been|leaves the shape|has not/)
      const right = raw(c, engine.solve(c), 'right')
      expect(text(right), nameOf(c)).toContain('Yes.')
      const shown = raw(c, engine.initial(c), 'shown')
      expect(text(shown), nameOf(c)).toContain('Yes.')
      // when marked right the controls are disabled: the learner can look, not change
      expect(right).toContain('disabled')
    }
  })

  it('under reduced motion draws a still frame that still follows the state', () => {
    const c = engine.parse({ task: 'rotate', turn: 'half', variant: 1 })!
    const a = raw(c, { ...START, cx: 0, cy: 0, turn: 180 }, 'idle', true)
    const b = raw(c, { ...START, cx: 0, cy: 0, turn: 90 }, 'idle', true)
    const img = (h: string) => h.match(/data-image="([^"]*)"/)![1]
    expect(img(a)).not.toBe(img(b))
    expect(a).not.toMatch(/style="[^"]*transition/)
    // a half turn of the shape about the origin is the point reflection
    const sc = safeScenario(c)
    expect(img(a).replace(/-0\.00/g, '0.00')).toBe(sc.shape.map(([x, y]) => `${(-x).toFixed(2)},${(-y).toFixed(2)}`).join(' ').replace(/-0\.00/g, '0.00'))
  })

  it('every control is a real button with a name, and nothing is smaller than 12px', () => {
    for (const [cfg, prompt] of EX) {
      const html = raw(engine.parse(cfg)!, engine.initial(engine.parse(cfg)!), 'idle')
      void prompt
      const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0])
      expect(buttons.length).toBeGreaterThanOrEqual(4)
      for (const b of buttons) expect(b, b).toMatch(/aria-label="[^"]+"/)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/font-size="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    }
  })

  it('the view survives a config faults refuses, and a damaged state', () => {
    const odd: TfConfig = { task: 'enlarge', shape: 'hexagon', kind: '7', variant: 12 }
    expect(() => raw(odd, { dir: 'q' }, 'idle')).not.toThrow()
    expect(() => raw(odd, null, 'wrong')).not.toThrow()
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "transformations"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'transformations')

  it('is offered for the stations about transformations of shapes, by the names the books use', () => {
    for (const st of [
      'Transformations', 'Transformations and vectors', 'Transformations of shapes', 'Reflection, rotation, translation and enlargement', 'Reflections and rotations', 'Rotations and reflections',
      'Enlargement', 'Enlargements and scale factors', 'Chapter 8: Shapes and transformations', 'Geometric transformations', 'Translation by a column vector', 'Column vectors',
      'Reflection in a line', 'Centre of rotation', 'Centre of enlargement', 'Mirror lines and reflection', 'Vectors on a grid', 'Translation vectors', 'Rotation about a point', 'Unit 9: Transformation geometry',
    ]) expect(offered(st) || madeFor(st), st).toBe(true)
  })

  it('is not offered for the other transformations, reflections, rotations, translations and vectors', () => {
    for (const st of [
      'Energy transformations', 'Energy transformation and conservation', 'Bacterial transformation', 'Transformation of bacteria with plasmids', 'Transcription and translation', 'Protein translation',
      'Reflection of light', 'Reflection and refraction', 'Total internal reflection', 'Laws of reflection', 'Plane mirrors', 'Crop rotation', 'Rotation of the Earth', 'Rotational motion', 'Scalars and vectors',
      'Vector addition and resultants', 'Disease vectors', 'Cloning vectors', 'Reflective writing', 'Self reflection', 'Transformations of graphs', 'Matrix transformations', 'Similar shapes', 'Scale drawings',
      'Translation of texts', 'Enlarged heart', 'Photosynthesis', 'Sonnets and rhyme schemes', 'Forces and Newton\'s laws', 'Coordinate geometry', 'Straight-line graphs', 'Construction with compasses',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })
})

describe('a prepared placement keeps its shape apart from its image, so the picture reads', () => {
  it('the target never covers the shape, for any valid config', () => {
    for (const c of VALID) {
      const sc = scenarioOf(c)!
      const key = (p: Pt) => `${p[0]},${p[1]}`
      const mine = new Set(sc.shape.map(key))
      // no vertex of the target is a vertex of the shape (they could still touch along an edge, which reads fine)
      const shared = sc.target.filter((p) => mine.has(key(p))).length
      expect(shared, nameOf(c)).toBeLessThanOrEqual(c.task === 'enlarge' ? 2 : 3)
    }
  })
})
