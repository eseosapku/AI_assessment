// lib/figure-draw.test.ts
import { describe, it, expect } from 'vitest'
import { parseFigureSpec, declaredLabels, describeFigure } from './figure-spec'
import { drawFigure } from './figure-draw'

const draw = (raw: unknown) => drawFigure(parseFigureSpec(raw))

describe('reading a spec the model wrote', () => {
  it('accepts the five kinds it can draw', () => {
    expect(parseFigureSpec({ kind: 'polygon', sides: 4, edges: ['18 cm', '20 cm', '30 cm', '16 cm'] })).toBeTruthy()
    expect(parseFigureSpec({ kind: 'spinners', count: 2, sides: 7 })).toBeTruthy()
    expect(parseFigureSpec({ kind: 'graph', x: { label: 'mass (g)', min: 0, max: 50, step: 10 }, y: { label: 'diameter (cm)', min: 0, max: 8, step: 2 }, points: [[5, 1], [25, 3]] })).toBeTruthy()
    expect(parseFigureSpec({ kind: 'barchart', y: { label: 'number of learners', min: 0, max: 20, step: 5 }, bars: [{ label: 'walk', value: 12 }, { label: 'bus', value: 7 }] })).toBeTruthy()
    expect(parseFigureSpec({ kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: 3, label: 'A' }] })).toBeTruthy()
  })

  it('refuses a spec it would have to guess at', () => {
    // A wrong picture is worse than none: the question is written against it
    // either way, so a half-understood spec falls back to the library.
    expect(parseFigureSpec(null)).toBeNull()
    expect(parseFigureSpec({ kind: 'circuit' })).toBeNull()
    expect(parseFigureSpec({ kind: 'polygon', sides: 7, edges: [] })).toBeNull()
    // edges must match the sides, or the labels land on the wrong lines
    expect(parseFigureSpec({ kind: 'polygon', sides: 4, edges: ['5 cm'] })).toBeNull()
    expect(parseFigureSpec({ kind: 'spinners', count: 2, sides: 40 })).toBeNull()
  })

  it('refuses a point that is off its own axes', () => {
    // Plotted outside the frame it cannot be read off the graph, and the
    // question asking for it has no answer.
    expect(parseFigureSpec({
      kind: 'graph', x: { label: 'x', min: 0, max: 10, step: 2 }, y: { label: 'y', min: 0, max: 10, step: 2 },
      points: [[5, 5], [50, 5]],
    })).toBeNull()
  })

  it('refuses a grid nobody could read', () => {
    expect(parseFigureSpec({
      kind: 'graph', x: { label: 'x', min: 0, max: 1000, step: 1 }, y: { label: 'y', min: 0, max: 10, step: 2 },
      points: [[1, 1], [2, 2]],
    })).toBeNull()
  })
})

describe('what the question may name', () => {
  it('lists exactly what the figure carries', () => {
    const poly = parseFigureSpec({ kind: 'polygon', sides: 4, edges: ['18 cm', '', '30 cm', '16 cm'] })!
    expect(declaredLabels(poly)).toEqual(['18 cm', '30 cm', '16 cm'])

    const spin = parseFigureSpec({ kind: 'spinners', count: 2, sides: 4 })!
    expect(declaredLabels(spin)).toContain('the grey spinner')
    expect(declaredLabels(spin)).toContain('4')
    expect(declaredLabels(spin)).not.toContain('5')
  })

  it('describes the figure for the prompt', () => {
    const spin = parseFigureSpec({ kind: 'spinners', count: 2, sides: 7 })!
    expect(describeFigure(spin)).toMatch(/two fair 7-sided spinners/i)
  })
})

describe('the drawing itself', () => {
  it('draws every kind as self-contained SVG', () => {
    for (const raw of [
      { kind: 'polygon', sides: 4, edges: ['18 cm', '20 cm', '30 cm', '16 cm'], rightAngle: 'bottom-left' },
      { kind: 'spinners', count: 2, sides: 7 },
      { kind: 'graph', x: { label: 'mass (g)', min: 0, max: 50, step: 10 }, y: { label: 'diameter (cm)', min: 0, max: 8, step: 2 }, points: [[5, 1], [25, 3], [45, 4]] },
      { kind: 'barchart', y: { label: 'learners', min: 0, max: 20, step: 5 }, bars: [{ label: 'walk', value: 12 }, { label: 'bus', value: 7 }], xLabel: 'how they travel' },
      { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: 3, label: 'A' }, { at: 7, label: 'B' }] },
    ]) {
      const svg = draw(raw)
      expect(svg, String((raw as { kind: string }).kind)).toBeTruthy()
      expect(svg!.startsWith('<svg')).toBe(true)
      expect(svg!.endsWith('</svg>')).toBe(true)
      // Nothing to fetch and nothing to inherit: it has to render in the
      // runner, the results page and a recall card alike. The xmlns is the one
      // http: string allowed — it is the SVG namespace, not a request.
      expect(svg).not.toMatch(/class=|<link|<style|src=|xlink:href/)
      expect(svg!.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//)
    }
  })

  it('draws the numbers it was given, and no others', () => {
    const svg = draw({ kind: 'spinners', count: 1, sides: 5 })!
    for (const k of ['1', '2', '3', '4', '5']) expect(svg).toContain(`>${k}<`)
    expect(svg).not.toContain('>6<')
  })

  it('escapes label text rather than letting it into the markup', () => {
    const svg = draw({ kind: 'polygon', sides: 3, edges: ['<script>x</script>', 'b', 'c'] })!
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('returns null rather than throwing on anything it cannot draw', () => {
    expect(drawFigure(null)).toBeNull()
    expect(drawFigure(undefined)).toBeNull()
    expect(() => drawFigure({ kind: 'nope' } as never)).not.toThrow()
  })

  it('is deterministic', () => {
    const raw = { kind: 'graph', x: { label: 'x', min: 0, max: 10, step: 5 }, y: { label: 'y', min: 0, max: 10, step: 5 }, points: [[2, 3], [8, 9]] }
    expect(draw(raw)).toBe(draw(raw))
  })
})

describe('several figures as the options', () => {
  const four = {
    kind: 'choice',
    options: [
      { angles: [24, 76, 80] },
      { angles: [56, 34, 90] },
      { angles: [24, 66, 90] },
      { angles: [36, 64, 80] },
    ],
  }

  it('draws one triangle per option, lettered', () => {
    // "Tick to show the triangle where a² + b² = c²" — the options ARE the
    // figures, so there was nothing to put in an options array and nothing in
    // the library to find.
    const svg = draw(four)!
    expect(svg).toBeTruthy()
    for (const letter of ['A', 'B', 'C', 'D']) expect(svg).toContain(`>${letter}<`)
    expect(svg).not.toContain('>E<')
  })

  it('lets the question name the letters and nothing else', () => {
    expect(declaredLabels(parseFigureSpec(four)!)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('draws the angles it was given', () => {
    const svg = draw(four)!
    expect(svg).toContain('24°')
    expect(svg).toContain('90°')
  })

  it('refuses a triangle whose angles do not make one', () => {
    // A learner asked which triangle has a right angle must be able to see
    // which one does, so the angles have to be real.
    expect(parseFigureSpec({ kind: 'choice', options: [{ angles: [90, 90, 90] }, { angles: [60, 60, 60] }] }))
      .toBeNull()
  })

  it('refuses too few or too many options', () => {
    expect(parseFigureSpec({ kind: 'choice', options: [{ angles: [60, 60, 60] }] })).toBeNull()
    expect(parseFigureSpec({ kind: 'choice', options: Array(5).fill({ angles: [60, 60, 60] }) })).toBeNull()
  })
})
