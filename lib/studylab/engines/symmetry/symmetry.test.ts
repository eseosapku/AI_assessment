// lib/studylab/engines/symmetry/symmetry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  symmetryEngine as engine, FACTS, SHAPES, TASKS, PLATE_W, PLATE_H, CX, CY, DOT_HIT, FOLD_MARGIN, TAB_OUT, TURN_ROOM,
  areaOf, centroidOf, cornersOf, done, drawnLines, fitAngles, flapAt, foldLayout, foldLines, foldParts, goodPrompt, isSymmetryLine, landmarksOf, lineId,
  madeMarks, madeText, orderOf, reflect, sameCorners, sameSide, stepOf, symmetryLines, turn, turnLayout, working,
  type Pt, type ShapeName, type SymConfig, type SymState,
} from './config'
import { H, HIT, LINE_PAST, SymmetryView, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const ALL: SymConfig[] = TASKS.flatMap((task) => SHAPES.map((shape) => ({ task, shape })))
const nameOf = (c: SymConfig) => JSON.stringify(c)
const fold = (shape: ShapeName): SymConfig => ({ task: 'fold', shape })
const spin = (shape: ShapeName): SymConfig => ({ task: 'turn', shape })
const raw = (cfg: SymConfig, state: SymState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
  renderToStaticMarkup(createElement(SymmetryView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')
const inside = (poly: Pt[], p: Pt, slack = 1e-6) => {
  // Convex and clockwise on the screen: inside is to the right of every edge.
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length]
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -slack * Math.hypot(b.x - a.x, b.y - a.y)
  })
}

describe('the shapes, from first principles', () => {
  it('has the textbook number of lines and order, found by folding and turning', () => {
    for (const s of SHAPES) {
      expect(symmetryLines(s).length, s).toBe(FACTS[s].lines)
      expect(orderOf(s), s).toBe(FACTS[s].order)
    }
  })

  it('a rectangle folds middle to middle, never corner to corner; a rhombus the other way round; a parallelogram not at all', () => {
    expect(symmetryLines('rectangle').every((id) => /^m\d-m\d$/.test(id))).toBe(true)
    expect(isSymmetryLine('rectangle', 'c1-c3')).toBe(false)
    expect(isSymmetryLine('rectangle', 'c2-c4')).toBe(false)
    expect(symmetryLines('rhombus').sort()).toEqual(['c1-c3', 'c2-c4'])
    expect(symmetryLines('parallelogram')).toEqual([])
    expect(symmetryLines('square').sort()).toEqual(['c1-c3', 'c2-c4', 'm1-m3', 'm2-m4'])
    expect(symmetryLines('isosceles triangle')).toEqual(['c1-m2'])
    expect(symmetryLines('kite')).toEqual(['c1-c3'])
    expect(symmetryLines('isosceles trapezium')).toEqual(['m1-m3'])
    // A regular polygon with an odd number of sides: every line from a corner to the middle of the opposite side.
    expect(symmetryLines('regular pentagon').every((id) => /^(?:c\d-m\d|m\d-c\d)$/.test(id))).toBe(true)
    expect(symmetryLines('regular hexagon').filter((id) => /^c\d-c\d$/.test(id))).toHaveLength(3)
  })

  it('every line of symmetry passes through the centre, and every fit is a turn about the centre', () => {
    for (const s of SHAPES) {
      const corners = cornersOf(s)
      const c = centroidOf(corners)
      const marks = landmarksOf(corners)
      for (const id of symmetryLines(s)) {
        const [a, b] = id.split('-').map((x) => marks.find((m) => m.id === x)!.at)
        const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
        expect(Math.abs(cross), `${s} ${id}`).toBeLessThan(1e-9)
      }
      // The tracing fits at exactly the angles the card marks to, and at no other step.
      for (let deg = 0; deg < 360; deg += stepOf(s)) {
        const fits = sameCorners(corners.map((p) => turn(p, c, deg)), corners)
        expect(fits, `${s} at ${deg}`).toBe(fitAngles(s).includes(deg))
      }
    }
  })

  it('the corners run clockwise from the top, and a dot pair on one side is not a fold', () => {
    for (const s of SHAPES) {
      const corners = cornersOf(s)
      expect(areaOf(corners), s).toBeGreaterThan(0)
      expect(corners.every((p) => p.y >= corners[0].y - 1e-9), s).toBe(true)
    }
    expect(sameSide('c1', 'c2', 4)).toBe(true)
    expect(sameSide('c1', 'm4', 4)).toBe(true)
    expect(sameSide('c1', 'm1', 4)).toBe(true)
    expect(sameSide('c1', 'c3', 4)).toBe(false)
    expect(sameSide('m1', 'm2', 4)).toBe(false)
    expect(lineId('m3', 'c1')).toBe('c1-m3')
    expect(foldLines('square')).toHaveLength(8 * 7 / 2 - 8 - 4)
  })

  it('a fold folds the smaller part, and lands it where reflecting puts it', () => {
    const lay = foldLayout('rectangle')
    const at = (id: string) => lay.marks.find((m) => m.id === id)!.at
    const parts = foldParts(lay.corners, at('c1'), at('m2'))
    expect(Math.abs(areaOf(parts.flap))).toBeLessThan(Math.abs(areaOf(parts.stay)))
    expect(flapAt(parts, 0)).toEqual(parts.flap)
    flapAt(parts, 1).forEach((p, i) => {
      const r = reflect(parts.flap[i], at('c1'), at('m2'))
      expect(Math.hypot(p.x - r.x, p.y - r.y)).toBeLessThan(1e-9)
    })
    // Halfway, it is edge on: every point is on the fold.
    for (const p of flapAt(parts, 0.5)) {
      const a = at('c1')
      const b = at('m2')
      expect(Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))).toBeLessThan(1e-6)
    }
  })

  it('the drawing answers: a line of symmetry lays the flap exactly on the rest, any other line leaves card sticking out', () => {
    for (const s of SHAPES) {
      const lay = foldLayout(s)
      const at = (id: string) => lay.marks.find((m) => m.id === id)!.at
      for (const id of foldLines(s)) {
        const [a, b] = id.split('-')
        const parts = foldParts(lay.corners, at(a), at(b))
        const landed = flapAt(parts, 1)
        const fits = sameCorners(landed.filter((p, i, all) => all.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6) === i), parts.stay.filter((p, i, all) => all.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6) === i))
        expect(fits, `${s} ${id}`).toBe(isSymmetryLine(s, id))
        if (!fits) {
          // Something sticks out past the edge, or something is left showing, by more than a hair: the eye sees it.
          const out = landed.some((p) => !inside(lay.corners, p, 0.02)) || Math.abs(Math.abs(areaOf(landed)) - Math.abs(areaOf(parts.stay))) > 40
          const peek = parts.stay.some((p) => !inside(landed.length >= 3 && areaOf(landed) < 0 ? landed : [...landed].reverse(), p, 0.02))
          expect(out || peek, `${s} ${id}`).toBe(true)
        }
      }
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
    expect(ALL).toHaveLength(30)
  })

  it('marks a fold exactly by the rule: all the lines of symmetry, and nothing else', () => {
    for (const s of SHAPES) {
      const c = fold(s)
      const want = symmetryLines(s)
      for (const id of foldLines(s)) {
        // One line alone is right only for a shape with exactly that one line.
        expect(engine.check(c, { lines: [id] }).ok, `${s} ${id}`).toBe(want.length === 1 && want[0] === id)
        if (!want.includes(id) && want.length) expect(engine.check(c, { lines: [...want, id] }).ok, `${s} + ${id}`).toBe(false)
      }
      if (want.length) {
        for (const id of want) expect(engine.check(c, { lines: want.filter((x) => x !== id) }).ok, `${s} - ${id}`).toBe(false)
        expect(engine.check(c, { lines: want, none: true }).ok, s).toBe(false)
        expect(engine.check(c, { lines: [], none: true }).ok, s).toBe(false)
        expect(engine.check(c, { lines: [...want].reverse().map((id) => id.split('-').reverse().join('-')) }).ok, `${s} in any order`).toBe(true)
      } else {
        expect(engine.check(c, { lines: [], none: true }).ok, s).toBe(true)
        expect(engine.check(c, { lines: [], none: false }).ok, s).toBe(false)
      }
    }
  })

  it('marks a turn exactly by the rule: a mark at every fit, the start counted once', () => {
    for (const s of SHAPES) {
      const c = spin(s)
      const want = fitAngles(s)
      const step = stepOf(s)
      // Every subset of the fits: only the whole set passes.
      for (let bits = 0; bits < 1 << want.length; bits++) {
        const marks = want.filter((_, i) => bits & (1 << i))
        expect(engine.check(c, { marks }).ok, `${s} ${marks}`).toBe(marks.length === want.length)
      }
      for (let deg = 0; deg < 360; deg += step) if (!want.includes(deg)) expect(engine.check(c, { marks: [...want, deg] }).ok, `${s} + ${deg}`).toBe(false)
      // The end of the full turn is the start: a mark at 360 is the mark at 0.
      expect(engine.check(c, { marks: [...want.filter((d) => d !== 0), 360] }).ok, s).toBe(true)
      expect(madeMarks(c, { marks: [0, 360, 0] })).toEqual([0])
    }
    expect(fitAngles('kite')).toEqual([0])
    expect(fitAngles('regular pentagon')).toEqual([0, 72, 144, 216, 288])
    expect(stepOf('regular pentagon')).toBe(18)
    expect(stepOf('regular octagon')).toBe(15)
  })

  it('refuses a state that could not have been made', () => {
    const c = fold('rectangle')
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { lines: 'm1-m3' as never }).ok).toBe(false)
    expect(drawnLines(c, { lines: ['c1-c2', 'nonsense', 'm3-m1', 'm1-m3', 7 as never] })).toEqual(['m1-m3'])
    const t = spin('regular pentagon')
    expect(madeMarks(t, { marks: [0, 15, 72.4, Number.NaN, '72' as never, -72] })).toEqual([0, 288])
    expect(engine.check({ task: 'fold', shape: 'heart' }, { lines: [] }).ok).toBe(false)
  })

  it('says something true when marked', () => {
    for (const c of ALL) {
      const said = working(c)
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'fold') {
        const n = FACTS[c.shape as ShapeName].lines
        expect(said, nameOf(c)).toContain(n === 0 ? 'no lines of symmetry' : `${n} line`)
      } else {
        expect(said, nameOf(c)).toContain(`order ${FACTS[c.shape as ShapeName].order}`)
      }
    }
    expect(working(fold('rectangle'))).toMatch(/diagonals are not lines of symmetry/)
    expect(working(spin('kite'))).toMatch(/never 0/)
    expect(working(spin('parallelogram'))).toMatch(/no lines of symmetry/)
  })

  it('says what was made when wrong, without saying where the answer is', () => {
    expect(madeText(fold('rectangle'), {})).toMatch(/Nothing is drawn yet/)
    expect(madeText(fold('rectangle'), { lines: ['c1-c3'] })).toMatch(/You drew 1 line, but folding along it leaves part of the card sticking out/)
    expect(madeText(fold('rectangle'), { lines: ['m1-m3'] })).toMatch(/folds the rectangle exactly onto itself. It has more lines/)
    expect(madeText(fold('rectangle'), { lines: [], none: true })).toMatch(/You said a rectangle has no lines/)
    expect(madeText(fold('parallelogram'), { lines: ['c1-c3', 'm1-m3'] })).toMatch(/at least one of them/)
    expect(madeText(spin('square'), {})).toMatch(/No marks yet/)
    expect(madeText(spin('square'), { marks: [90, 180, 270] })).toMatch(/back where it started/)
    expect(madeText(spin('square'), { marks: [0, 180] })).toMatch(/fits in more places/)
    expect(madeText(spin('square'), { marks: [0, 45] })).toMatch(/does not fit the square/)
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(said, nameOf(c)).not.toMatch(/diagonal|corner to corner|middle to middle|order \d|twice/)
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'fold', shape: 'Rectangle' })).toEqual({ task: 'fold', shape: 'rectangle' })
    expect(engine.parse({ task: 'Lines of symmetry', shape: 'an oblong' })).toEqual({ task: 'fold', shape: 'rectangle' })
    expect(engine.parse({ task: 'rotational symmetry', shape: 'parallelograms' })).toEqual({ task: 'turn', shape: 'parallelogram' })
    expect(engine.parse({ task: 'order of rotational symmetry', polygon: 'Regular Hexagon' })).toEqual({ task: 'turn', shape: 'regular hexagon' })
    expect(engine.parse({ task: 'turn', shape: 'hexagon' })).toEqual({ task: 'turn', shape: 'regular hexagon' })
    expect(engine.parse({ shape: 'diamond' })).toEqual({ task: 'fold', shape: 'rhombus' })
    expect(engine.parse({ task: 'line-symmetry', shape: 'right-angled triangle' })).toEqual({ task: 'fold', shape: 'right-angled triangle' })
    expect(engine.parse({ task: 'reflective symmetry', shape: 'isosceles trapezoid' })).toEqual({ task: 'fold', shape: 'isosceles trapezium' })
    expect(engine.parse({ task: { kind: 'rotation', shape: 'equilateral' } })).toEqual({ task: 'turn', shape: 'equilateral triangle' })
    expect(engine.parse({ task: 'fold' })).toEqual({ task: 'fold', shape: 'rectangle' })
    expect(engine.parse({ task: 'turn' })).toEqual({ task: 'turn', shape: 'parallelogram' })
    expect(engine.parse({ task: 'fold', shape: 'right isosceles triangle' })).toEqual({ task: 'fold', shape: 'right-angled isosceles triangle' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('rectangle')).toBeNull()
    expect(engine.parse({ task: 'dance', shape: 'square' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 3, shape: 'square' })).toBeNull()
    expect(engine.parse({ task: 'fold', shape: 4 })).toBeNull()
    expect(engine.parse({ task: 'fold', shape: '  ' })).toBeNull()
    // Unknown shapes still parse: faults says what would work.
    expect(engine.parse({ task: 'fold', shape: 'heart' })).toEqual({ task: 'fold', shape: 'heart' })
    expect(engine.parse({ task: 'turn', shape: 'circle' })).toEqual({ task: 'turn', shape: 'circle' })
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const cases: [SymConfig, RegExp][] = [
      [{ task: 'fold', shape: 'heart' }, /no "heart" drawn here/],
      [{ task: 'fold', shape: '__proto__' }, /no "__proto__" drawn here/],
      [{ task: 'fold', shape: 'circle' }, /curved edges/],
      [{ task: 'turn', shape: 'oval' }, /curved edges/],
      [{ task: 'fold', shape: 'triangle' }, /0, 1 or 3 lines/],
      [{ task: 'turn', shape: 'quadrilateral' }, /could be many shapes/],
      [{ task: 'fold', shape: 'regular decagon' }, /pentagon, hexagon and octagon/],
      [{ task: 'turn', shape: 'letter s' }, /no "letter s" drawn here/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fix = f[0].match(/e\.g\. shape "([^"]+)"/)
      expect(fix, f[0]).not.toBeNull()
      const fixed = { ...c, shape: fix![1] }
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      // Nothing a refused config can do crashes the rest of the engine.
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => raw(c, engine.initial(c), 'idle', true)).not.toThrow()
      expect(() => raw(c, engine.initial(c), 'wrong', true)).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: SymConfig, p: string) => engine.promptFaults!(c, p)

  it('asking for the outcome is fine', () => {
    for (const c of ALL) expect(pf(c, goodPrompt(c)), nameOf(c)).toEqual([])
    expect(pf(fold('rectangle'), 'Fold the rectangle along a line between two dots. Is it symmetrical? Draw every line of symmetry you find.')).toEqual([])
    expect(pf(spin('kite'), 'Turn the tracing paper all the way round and mark under the red dot whenever it fits.')).toEqual([])
  })

  it('how many, where, or the rule is not', () => {
    for (const p of ['A rectangle has 2 lines of symmetry.', 'Find the two lines.', 'Fold it along its diagonals.', 'Fold it corner to corner.', 'Find the vertical line of symmetry.', 'It has no lines of symmetry.', 'Fold it in half.', 'Regular polygons have as many lines as sides.']) {
      expect(pf(fold('rectangle'), p), p).toHaveLength(1)
    }
    for (const p of ['It fits twice.', 'Its order is 2.', 'It has rotational symmetry of order two.', 'It fits after a half turn.', 'Turn it 180 degrees.', 'Do not count the start twice.', 'It fits 4 times in a full turn.']) {
      expect(pf(spin('parallelogram'), p), p).toHaveLength(1)
    }
  })

  it('what the card does not do is refused too', () => {
    for (const p of ['Use a mirror to find the lines.', 'Complete the pattern on the squared paper grid.', 'Find the planes of symmetry of the cuboid.', 'Which letters are symmetrical?', 'Turn the tracing paper and count the fits.']) {
      expect(pf(fold('rectangle'), p).join(' '), p).toMatch(/does not do/)
    }
    expect(pf(spin('kite'), 'Fold the kite along a line.').join(' ')).toMatch(/does not do/)
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'It has 2 lines of symmetry and order 2. Use a mirror.')
      expect(said, nameOf(c)).toHaveLength(2)
      for (const s of said) {
        const fix = s.match(/\("([^"]+)"\)/)![1]
        expect(pf(c, fix), nameOf(c)).toEqual([])
        expect(fix).toMatch(c.task === 'fold' ? /Tap two dots/ : /Turn the tracing paper/)
      }
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"symmetry", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, f[2]).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, f[2]).toBe(true)
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['fold', 'turn']))
    // The short examples above the full ones say the same.
    for (const m of engine.prompt.matchAll(/config: (\{[^}]*\})\s+-- the prompt says "([^"]+)"/g)) {
      expect(engine.promptFaults!(engine.parse(JSON.parse(m[1]))!, m[2]), m[2]).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "symmetry"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'symmetry')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Symmetry', 'Line symmetry', 'Lines of symmetry in 2D shapes', 'Reflective symmetry', 'Rotational symmetry', 'Order of rotational symmetry',
      'Symmetry of polygons', 'Unit 7: Symmetry and shapes', 'Symmetric shapes', 'Line and rotational symmetry', 'Chapter 12: Symmetry', 'Is it symmetrical?', 'Symmetries of regular polygons',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for its neighbours', () => {
    for (const st of [
      'Bilateral and radial symmetry in animals', 'Radial symmetry in cnidarians', 'Symmetric and asymmetric encryption', 'Symmetrical and skewed distributions', 'Quadratic graphs: roots and axis of symmetry',
      'Symmetry properties of circles', 'Shapes of molecules and polarity', 'Symmetry in art and design: formal balance', 'Even and odd functions and their symmetry',
      'Reflections, rotations and translations', 'Transformations on a grid', 'Number lines', 'Properties of quadrilaterals', 'Circle theorems', 'Rotation of the Earth', 'Mirror images and plane mirrors',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('symmetry')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/SCENE "symmetry"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:symmetry"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const s of SHAPES) expect(engine.prompt).toContain(s)
    expect(engine.prompt).toContain(`steps of ${stepOf('square')} degrees (${stepOf('regular pentagon')} for the pentagon)`)
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(W).toBe(PLATE_W)
    expect(H).toBe(PLATE_H)
    expect(HIT).toBe(DOT_HIT)
    const html = raw(spin('kite'), {}, 'idle', true)
    expect(html).toContain(`viewBox="0 0 ${PLATE_W} ${PLATE_H}"`)
    expect(html).toContain(`M ${CX + TURN_ROOM + 2} ${CY} l 9 -5.5`)
    const lay = turnLayout('kite')
    expect(html).toContain(`width="${(TAB_OUT + 7).toFixed(1)}"`)
    expect(html).toContain(`r="${(lay.disc + TAB_OUT).toFixed(1)}"`)
  })

  it('every fold lands on the plate: the shape, every flap and every drawn line', () => {
    for (const s of SHAPES) {
      const lay = foldLayout(s)
      const at = (id: string) => lay.marks.find((m) => m.id === id)!.at
      const ok = (p: Pt, what: string) => {
        expect(p.x, what).toBeGreaterThanOrEqual(FOLD_MARGIN.x - 1e-6)
        expect(p.x, what).toBeLessThanOrEqual(PLATE_W - FOLD_MARGIN.x + 1e-6)
        expect(p.y, what).toBeGreaterThanOrEqual(FOLD_MARGIN.y - 1e-6)
        expect(p.y, what).toBeLessThanOrEqual(PLATE_H - FOLD_MARGIN.y + 1e-6)
      }
      lay.corners.forEach((p, i) => ok(p, `${s} corner ${i}`))
      for (const id of foldLines(s)) {
        const [a, b] = id.split('-')
        for (const t of [0.25, 0.5, 0.75, 1]) flapAt(foldParts(lay.corners, at(a), at(b)), t).forEach((p) => ok(p, `${s} ${id} at ${t}`))
      }
      for (const id of symmetryLines(s)) {
        const [a, b] = id.split('-').map(at)
        const d = Math.hypot(b.x - a.x, b.y - a.y)
        for (const [p, k] of [[a, -1], [b, 1]] as [Pt, number][]) {
          const end = { x: p.x + (k * (b.x - a.x) * LINE_PAST) / d, y: p.y + (k * (b.y - a.y) * LINE_PAST) / d }
          expect(end.x, `${s} ${id}`).toBeGreaterThan(2)
          expect(end.x, `${s} ${id}`).toBeLessThan(PLATE_W - 2)
          expect(end.y, `${s} ${id}`).toBeGreaterThan(2)
          expect(end.y, `${s} ${id}`).toBeLessThan(PLATE_H - 2)
        }
      }
    }
  })

  it('every dot has room for a finger: no two buttons overlap, and all sit on the plate', () => {
    for (const s of SHAPES) {
      const lay = foldLayout(s)
      lay.marks.forEach((m, i) => {
        expect(m.at.x - DOT_HIT / 2, s).toBeGreaterThanOrEqual(0)
        expect(m.at.x + DOT_HIT / 2, s).toBeLessThanOrEqual(PLATE_W)
        expect(m.at.y - DOT_HIT / 2, s).toBeGreaterThanOrEqual(0)
        expect(m.at.y + DOT_HIT / 2, s).toBeLessThanOrEqual(PLATE_H)
        lay.marks.forEach((o, j) => { if (j > i) expect(Math.hypot(m.at.x - o.at.x, m.at.y - o.at.y), `${s} ${m.id} ${o.id}`).toBeGreaterThanOrEqual(DOT_HIT) })
      })
      // A shape big enough to see: never a thumbnail.
      const xs = lay.corners.map((p) => p.x)
      const ys = lay.corners.map((p) => p.y)
      expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), s).toBeGreaterThan(150)
    }
  })

  it('the tracing paper and its tab turn clear of the plate edge and of the labels, at every angle', () => {
    const labels = [
      { left: 14, right: 14 + 'tracing paper'.length * 7, top: 20 - 12, bottom: 20 + 3 },
      { left: CX + TURN_ROOM + 1, right: CX + TURN_ROOM + 1 + 'start'.length * 7, top: CY - 13 - 12, bottom: CY - 13 + 3 },
    ]
    for (const s of SHAPES) {
      const lay = turnLayout(s)
      const reach = lay.disc + TAB_OUT
      expect(reach, s).toBeLessThanOrEqual(TURN_ROOM + 1e-9)
      expect(CY - reach, s).toBeGreaterThan(0)
      expect(CY + reach, s).toBeLessThan(PLATE_H)
      // The tab's corners sweep a circle a little past `reach`.
      const corner = Math.hypot(reach, 12)
      for (const b of labels) {
        const nearest = { x: Math.max(b.left, Math.min(CX, b.right)), y: Math.max(b.top, Math.min(CY, b.bottom)) }
        expect(Math.hypot(nearest.x - CX, nearest.y - CY), `${s} label`).toBeGreaterThan(corner)
      }
      // Every corner sits inside the tracing paper, and the shape is big enough to see.
      for (const p of lay.corners) expect(Math.hypot(p.x - CX, p.y - CY), s).toBeLessThanOrEqual(lay.disc - 9)
      expect(lay.disc, s).toBeGreaterThan(75)
    }
    // Labels on the plate are 12 px or more, and none sits on the start arrow.
    expect(labels[1].bottom).toBeLessThan(CY - 5.5)
  })

  it('every mark lands on a corner when the tracing fits, so the marks show the corners', () => {
    for (const s of SHAPES) {
      const lay = turnLayout(s)
      const dot = lay.corners[lay.dot]
      for (const deg of fitAngles(s)) {
        const p = turn(dot, lay.pin, deg)
        expect(lay.corners.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6), `${s} ${deg}`).toBe(true)
      }
      // Marks at different fits never sit on each other.
      const at = fitAngles(s).map((d) => turn(dot, lay.pin, d))
      at.forEach((p, i) => at.forEach((q, j) => { if (j > i) expect(Math.hypot(p.x - q.x, p.y - q.y), s).toBeGreaterThan(22) }))
    }
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'symmetry', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says the answer, the rule or a count of it', () => {
    for (const c of ALL) {
      const prompt = goodPrompt(c)
      const html = card(c, prompt)
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'order', 'twice', 'diagonal', 'corner to corner', 'middle to middle', 'more lines', 'sticks out', 'covers the rest', 'regular polygon', 'not fit', 'never 0']) {
        expect(shown, `${secret} in ${nameOf(c)}`).not.toContain(secret)
      }
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const f = text(raw(fold('rectangle'), {}, 'idle'))
    for (const name of ['Rectangle cut from card', 'Tap two dots', 'Lines of symmetry drawn', 'It has none']) expect(f).toContain(name)
    const t = text(raw(spin('kite'), {}, 'idle'))
    for (const name of ['Kite under tracing paper', 'red dot', 'tracing paper', 'start', 'Turned', 'Marks made', 'Mark under the red dot']) expect(t).toContain(name)
  })

  it('every dot is a real button with its own label, in order round the shape, and none once solved', () => {
    for (const s of SHAPES) {
      const c = fold(s)
      const html = raw(c, {}, 'idle')
      const buttons = [...html.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*data-dot="(\w+)"/g)]
      expect(buttons.length, s).toBe(foldLayout(s).marks.length)
      expect(new Set(buttons.map((m) => m[1])).size, s).toBe(buttons.length)
      expect(buttons.map((m) => m[2]), s).toEqual(foldLayout(s).marks.map((m) => m.id))
      for (const m of buttons) expect(m[0], m[1]).toContain('type="button"')
      expect(raw(c, engine.solve(c), 'right'), s).not.toContain('data-dot=')
    }
    expect(raw(fold('square'), {}, 'idle')).toContain('aria-label="Start a fold at corner 1"')
    expect(raw(fold('square'), {}, 'idle')).toContain('aria-label="Start a fold at the middle of side 2"')
  })

  it('draws the learner’s lines and marks, and the answer when shown', () => {
    const lines = (html: string) => [...html.matchAll(/data-pencil="1"/g)].length
    expect(lines(raw(fold('square'), {}, 'idle'))).toBe(0)
    expect(lines(raw(fold('square'), { lines: ['c1-c3', 'm1-m3'] }, 'idle'))).toBe(2)
    expect(lines(raw(fold('square'), {}, 'shown'))).toBe(4)
    expect(text(raw(fold('square'), {}, 'shown'))).toContain('4 lines of symmetry')
    const rings = (html: string) => [...html.matchAll(/data-mark="\d+"/g)].length
    expect(rings(raw(spin('regular hexagon'), { marks: [0, 60] }, 'idle'))).toBe(2)
    expect(rings(raw(spin('regular hexagon'), {}, 'shown'))).toBe(6)
    expect(raw(spin('regular hexagon'), { marks: [0, 60] }, 'idle')).toContain('data-marks="2"')
    expect(raw(fold('square'), { lines: ['c1-c3', 'm1-m3'] }, 'idle')).toContain('data-lines="2"')
  })

  it('a still frame changes with every move, and nothing animates under reduced motion', () => {
    const c = fold('rectangle')
    const first = raw(c, {}, 'idle', true)
    for (const id of foldLines('rectangle')) expect(raw(c, { lines: [id] }, 'idle', true), id).not.toBe(first)
    expect(raw(c, { none: true }, 'idle', true)).not.toBe(first)
    expect(raw(c, { none: true }, 'idle', true)).toContain('aria-pressed="true"')
    const t = spin('regular pentagon')
    const still = raw(t, {}, 'idle', true)
    expect(still).not.toMatch(/transition:\s*transform/)
    for (const d of [0, 18, 72]) expect(raw(t, { marks: [d] }, 'idle', true)).not.toBe(still)
    // With motion allowed, the tracing eases round.
    expect(raw(t, {}, 'idle', false)).toMatch(/transition:transform 600ms/)
  })

  it('marking gives the count and the why, and what was made when wrong', () => {
    expect(text(raw(fold('rectangle'), engine.solve(fold('rectangle')), 'right'))).toContain('A rectangle has 2 lines of symmetry')
    expect(text(raw(fold('rectangle'), { lines: ['c1-c3'] }, 'wrong'))).toContain('sticking out')
    expect(text(raw(spin('parallelogram'), engine.solve(spin('parallelogram')), 'right'))).toContain('order 2')
    expect(text(raw(spin('parallelogram'), { marks: [180] }, 'wrong'))).toContain('back where it started')
    // Marked, the controls are gone.
    expect(raw(spin('parallelogram'), engine.solve(spin('parallelogram')), 'right')).not.toContain('data-act="mark"')
  })

  it('tells a screen reader what is on the card, never how many it has', () => {
    const f = attrs(raw(fold('rectangle'), {}, 'idle'))
    expect(f).toContain('rectangle cut from orange card')
    expect(f).not.toMatch(/\b2 lines|diagonal/)
    const t = attrs(raw(spin('square'), { marks: [0] }, 'idle'))
    expect(t).toContain('Turned 0 degrees')
    expect(t).toContain('1 mark made')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of ALL) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
