/**
 * Redraw the approved figure library from the specs that made it.
 *
 * The SVG is baked into `data/drawn-figures.json` at promotion time, so a fix
 * to the drawing code does nothing for figures already approved. The table
 * overflow was fixed and every table in the library still overlapped,
 * because every one of them had been drawn by the old code.
 *
 * The specs are still in data/figure-drafts/index.json, so the pictures can
 * simply be drawn again. Approvals are not touched -- only the rendering.
 *
 *   npx vitest run --config vitest.live.config.ts redrawLibrary
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseFigureSpec, declaredLabels, describeFigure } from '@/lib/figure-spec'
import { drawFigure } from '@/lib/figure-draw'

const ROOT = process.cwd()
const DRAFTS = path.join(ROOT, 'data/figure-drafts/index.json')
const LIBRARY = path.join(ROOT, 'data/drawn-figures.json')

describe('redraw the approved figures', () => {
  it('re-renders every one from its spec', () => {
    const drafts = JSON.parse(fs.readFileSync(DRAFTS, 'utf8')) as any[]
    const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8')) as any[]
    const specById = new Map(drafts.map((d) => [d.id, d.spec]))

    let redrawn = 0
    let changed = 0
    let lost = 0

    for (const fig of library) {
      const spec = parseFigureSpec(specById.get(fig.id))
      if (!spec) { lost++; continue }
      const svg = drawFigure(spec)
      if (!svg) { lost++; continue }
      redrawn++
      if (svg !== fig.svg) changed++
      fig.svg = svg
      // The description and labels come from the spec too, so a change in
      // how a figure is described reaches the approved set as well.
      fig.description = describeFigure(spec)
      fig.labels = declaredLabels(spec)
    }

    fs.writeFileSync(LIBRARY, JSON.stringify(library), 'utf8')
    const msg = `redrawn ${redrawn}, changed ${changed}, no longer drawable ${lost}, total ${library.length}`
    fs.writeFileSync(path.join(ROOT, 'data/audit/redraw.txt'), msg, 'utf8')
    expect(redrawn).toBeGreaterThan(0)
  }, 300000)
})
