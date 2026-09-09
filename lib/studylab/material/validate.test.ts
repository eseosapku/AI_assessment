import { describe, it, expect } from 'vitest'
import { validateMaterial } from './validate'

const sortSpec = {
  prompt: 'Sort them.',
  pieces: [
    { id: 'hcl', label: 'HCl', traits: { home: 'acid' } },
    { id: 'koh', label: 'KOH', traits: { home: 'base' } },
  ],
  groups: [{ id: 'acid', label: 'Acid', ordered: false }, { id: 'base', label: 'Base', ordered: false }],
  slots: [
    { id: 's-acid', groupId: 'acid', x: 0, y: 0, capacity: 4 },
    { id: 's-base', groupId: 'base', x: 1, y: 0, capacity: 4 },
  ],
  rules: [],
  goal: { kind: 'binAssignment', assign: { hcl: 'acid', koh: 'base' } },
}

describe('validateMaterial', () => {
  it('passes a material that is well formed, isolating, drawable and solvable', () => {
    const r = validateMaterial(sortSpec, 1)
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.spec.pieces).toHaveLength(2)
  })

  it('refuses malformed output first, before the expensive checks', () => {
    const r = validateMaterial({ pieces: 'two' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toMatch(/could not be read/i)
  })

  it('refuses a cyclic rule set', () => {
    const cyclic = { ...sortSpec, rules: [{ op: 'derive', name: 'x', expr: 'x + 1' }] }
    const r = validateMaterial(cyclic, 1)
    expect(r.ok === false && r.reason).toMatch(/cycle/i)
  })

  it('refuses one that varies more than it claims to isolate, naming the traits', () => {
    const twoWay = { ...sortSpec, pieces: [
      { id: 'hcl', label: 'HCl', traits: { home: 'acid', colour: 'red' } },
      { id: 'koh', label: 'KOH', traits: { home: 'base', colour: 'blue' } },
    ] }
    const r = validateMaterial(twoWay, 1)
    expect(r.ok === false && r.reason).toContain('colour')
  })

  it('refuses one that cannot be finished, and says so in those words', () => {
    const stuck = { ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }
    const r = validateMaterial(stuck, 1)
    expect(r.ok === false && r.reason).toMatch(/cannot be completed/i)
  })

  it('gives a reason specific enough for the next attempt to act on', () => {
    // A refusal that only says "invalid" produces the same material again.
    const r = validateMaterial({ ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }, 1)
    expect(r.ok === false && r.reason.length).toBeGreaterThan(30)
  })

  it('refuses a derive name that collides with a board-generated name', () => {
    const colliding = {
      ...sortSpec,
      rules: [{ op: 'derive', name: 'count_acid', expr: '1' }],
    }
    const r = validateMaterial(colliding, 1)
    expect(r.ok === false && r.reason).toContain('count_acid')
  })

  it('refuses an unknown expression identifier and names it', () => {
    const unknownReference = {
      ...sortSpec,
      rules: [{ op: 'derive', name: 'result', expr: 'missing_value + 1' }],
    }
    const r = validateMaterial(unknownReference, 1)
    expect(r.ok === false && r.reason).toContain('missing_value')
  })

  it('allows display ids and evaluator function names in expressions', () => {
    const withDisplayAndFunction = {
      ...sortSpec,
      displays: [{ id: 'meter', kind: 'gauge', min: 0, max: 2 }],
      rules: [
        { op: 'derive', name: 'magnitude', expr: 'abs(count_acid)' },
        { op: 'bind', target: 'meter', expr: 'magnitude' },
        {
          op: 'when',
          predicate: { cmp: '>=', left: 'meter', right: '0' },
          then: [{ set: 'magnitude', expr: 'max(magnitude, 0)' }],
        },
      ],
    }
    const r = validateMaterial(withDisplayAndFunction, 1)
    expect(r.ok).toBe(true)
  })
})
