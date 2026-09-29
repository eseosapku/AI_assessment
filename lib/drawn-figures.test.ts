// lib/drawn-figures.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { drawnFigureForFocus, drawnFigureCount, resetDrawnFigures, useDrawnFiguresFile } from './drawn-figures'

// A fixture file of its own. This used to overwrite data/drawn-figures.json
// and restore it afterwards, which let parallel tests read the fixture as the
// library, and would have replaced the approved library outright had a run
// died between the write and the restore.
function withLibrary(rows: unknown[], run: () => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawn-figures-'))
  const file = path.join(dir, 'drawn-figures.json')
  fs.writeFileSync(file, JSON.stringify(rows), 'utf8')
  useDrawnFiguresFile(file)
  try {
    run()
  } finally {
    useDrawnFiguresFile()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const fig = (over: Record<string, unknown> = {}) => ({
  id: 'x', subject: 'Mathematics', strand: 'Number', focus: 'place value and rounding',
  stage: 'Lower Secondary Stage 9', kind: 'numberline',
  description: 'A number line from 0 to 100.', labels: ['A'], svg: '<svg></svg>', ...over,
})

afterEach(() => resetDrawnFigures())

describe('the approved figure library', () => {
  it('is empty and harmless before anything is approved', () => {
    withLibrary([], () => {
      expect(drawnFigureCount()).toBe(0)
      expect(drawnFigureForFocus('place value and rounding')).toBeNull()
    })
  })

  it('finds a figure by focus, whatever the casing', () => {
    withLibrary([fig()], () => {
      expect(drawnFigureForFocus('Place Value And Rounding')?.kind).toBe('numberline')
      expect(drawnFigureForFocus('  place value and rounding  ')?.kind).toBe('numberline')
      expect(drawnFigureForFocus('something else')).toBeNull()
    })
  })

  it('varies which one it returns, so two papers differ', () => {
    withLibrary([fig({ id: 'a' }), fig({ id: 'b' }), fig({ id: 'c' })], () => {
      const picked = new Set([0, 1, 2].map((seed) => drawnFigureForFocus('place value and rounding', { seed })?.id))
      expect(picked.size).toBe(3)
    })
  })

  it('prefers the right stage but never empties the pool for it', () => {
    withLibrary([
      fig({ id: 'p', stage: 'Primary Stage 6' }),
      fig({ id: 'l', stage: 'Lower Secondary Stage 9' }),
    ], () => {
      expect(drawnFigureForFocus('place value and rounding', { stage: 6 })?.id).toBe('p')
      expect(drawnFigureForFocus('place value and rounding', { stage: 9 })?.id).toBe('l')
    })
    // Only Primary held: a Stage 9 paper still gets it rather than nothing.
    withLibrary([fig({ id: 'p', stage: 'Primary Stage 6' })], () => {
      expect(drawnFigureForFocus('place value and rounding', { stage: 9 })?.id).toBe('p')
    })
  })

  it('ignores a row with no drawing', () => {
    withLibrary([fig({ id: 'ok' }), fig({ id: 'bad', svg: '' }), { focus: 'x' }], () => {
      expect(drawnFigureCount()).toBe(1)
    })
  })
})
