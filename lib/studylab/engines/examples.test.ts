import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import './index'
import { engines } from './registry'
import { examplesOf } from './examples'

describe('the examples a page of every scene can draw', () => {
  it('reads at least one working example from every registered scene', () => {
    const rows = engines().map((e) => [e.id, examplesOf(e).length] as const)
    if (process.env.SCENE_EXAMPLE_REPORT) writeFileSync(process.env.SCENE_EXAMPLE_REPORT, rows.map(([id, n]) => `${id} ${n}`).join('\n'))
    expect(rows.filter(([, n]) => n === 0).map(([id]) => id)).toEqual([])
  })

  it('returns only what the engine accepts, with a prompt to show', () => {
    for (const e of engines()) {
      for (const ex of examplesOf(e)) {
        expect(ex.prompt.length, e.id).toBeGreaterThan(0)
        const parsed = e.parse(ex.config)
        expect(parsed, e.id).not.toBeNull()
        expect(e.faults(parsed!), e.id).toEqual([])
      }
    }
  })
})
