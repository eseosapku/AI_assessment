// scripts/figure-library/figureKinds.test.ts
import { describe, it, expect } from 'vitest'
import { FIGURE_KINDS, KIND_BY_ID } from './figureKinds'

describe('the closed list of figure kinds', () => {
  it('has unique, well-formed ids', () => {
    const ids = FIGURE_KINDS.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(\.[a-z-]+)?$/)
  })
  it('has both drawn and real kinds, and enough of each to give variety', () => {
    expect(FIGURE_KINDS.filter((k) => k.drawn).length).toBeGreaterThanOrEqual(30)
    expect(FIGURE_KINDS.filter((k) => !k.drawn).length).toBeGreaterThanOrEqual(8)
  })
  it('looks kinds up by id', () => {
    expect(KIND_BY_ID.get('physics.circuit')?.drawn).toBe(true)
    expect(KIND_BY_ID.get('photo.micrograph')?.drawn).toBe(false)
  })
})
