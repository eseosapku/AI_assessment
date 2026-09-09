// lib/studylab/material/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseMaterialSpec } from './parse'

const MINIMAL = {
  prompt: 'Balance both sides.',
  pieces: [{ id: 'p1', label: 'H2', traits: { h: 2, o: 0 } }],
  groups: [{ id: 'g1', label: 'Left pan', ordered: false }],
  slots: [{ id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 1 }],
  rules: [{ op: 'derive', name: 'leftH', expr: 'sum_h_g1' }],
  goal: { kind: 'exactSet', itemIds: ['p1'] },
}

describe('parseMaterialSpec', () => {
  it('reads a well-formed spec', () => {
    const spec = parseMaterialSpec(MINIMAL)
    expect(spec?.pieces[0].traits.h).toBe(2)
    expect(spec?.rules[0].op).toBe('derive')
  })

  it('refuses a slot pointing at a group that does not exist', () => {
    // The exact fault compose shipped: an id naming nothing, so the material
    // renders but can never be worked, and nothing says why.
    expect(parseMaterialSpec({ ...MINIMAL, slots: [{ id: 's1', groupId: 'nope', x: 0, y: 0, capacity: 1 }] })).toBeNull()
  })

  it('refuses duplicate ids anywhere', () => {
    expect(parseMaterialSpec({ ...MINIMAL, pieces: [MINIMAL.pieces[0], MINIMAL.pieces[0]] })).toBeNull()
  })

  it('refuses a rule op outside the four', () => {
    expect(parseMaterialSpec({ ...MINIMAL, rules: [{ op: 'exec', name: 'x', expr: '1' }] })).toBeNull()
  })

  it('refuses art that is a URL rather than a catalogue name', () => {
    // An unvalidated src is a broken-image, tracking-pixel and SSRF risk at once.
    const withUrl = { ...MINIMAL, pieces: [{ ...MINIMAL.pieces[0], art: 'https://example.com/x.png' }] }
    expect(parseMaterialSpec(withUrl)).toBeNull()
  })

  it('refuses a spec with no goal', () => {
    const { goal, ...noGoal } = MINIMAL
    expect(parseMaterialSpec(noGoal)).toBeNull()
  })

  it('never throws on whatever the model sent', () => {
    expect(parseMaterialSpec(null)).toBeNull()
    expect(parseMaterialSpec('a material')).toBeNull()
    expect(parseMaterialSpec({ pieces: 'three' })).toBeNull()
    expect(parseMaterialSpec({ ...MINIMAL, pieces: [null, 3] })).toBeNull()
  })

  it('caps a material nobody could hold in their head', () => {
    const many = { ...MINIMAL, pieces: Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, label: `${i}`, traits: {} })) }
    expect(parseMaterialSpec(many)).toBeNull()
  })
})
