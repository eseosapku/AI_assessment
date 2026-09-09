// lib/studylab/material/solvable.test.ts
import { describe, it, expect } from 'vitest'
import { isSolvable, MAX_STATES } from './solvable'
import type { MaterialSpec } from './types'

const sortInto = (bins: string[], items: { id: string; bin: string }[]): MaterialSpec => ({
  prompt: 'Sort them.',
  pieces: items.map((i) => ({ id: i.id, label: i.id, traits: { home: i.bin } })),
  groups: bins.map((b) => ({ id: b, label: b, ordered: false })),
  slots: bins.map((b) => ({ id: `s-${b}`, groupId: b, x: 0, y: 0, capacity: 4 })),
  rules: [],
  goal: { kind: 'binAssignment', assign: Object.fromEntries(items.map((i) => [i.id, i.bin])) },
})

describe('isSolvable', () => {
  it('finds the sequence that completes an ordinary material', () => {
    const r = isSolvable(sortInto(['acid', 'base'], [{ id: 'hcl', bin: 'acid' }, { id: 'koh', bin: 'base' }]))
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.moves).toBe(2)
  })

  it('refuses a material whose goal names a group that does not exist', () => {
    // The compose fault, in the new vocabulary: a goal nothing can satisfy.
    const impossible = sortInto(['acid'], [{ id: 'hcl', bin: 'acid' }])
    impossible.goal = { kind: 'binAssignment', assign: { hcl: 'nowhere' } }
    expect(isSolvable(impossible)).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('refuses a material whose allow rules forbid the only winning move', () => {
    const blocked = sortInto(['acid', 'base'], [{ id: 'hcl', bin: 'acid' }])
    blocked.rules = [{ op: 'allow', selector: { trait: 'home', equals: 'base' }, groupId: 'acid' }]
    expect(isSolvable(blocked)).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('gives up on a material too large to hold, rather than hanging', () => {
    // A material with an astronomical state space is a bad material anyway —
    // the child cannot hold it. The cap does pedagogical work, not just
    // computational.
    const huge = sortInto(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, bin: 'a' })),
    )
    expect(isSolvable(huge)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('states the cap as a number others can read', () => {
    expect(MAX_STATES).toBe(50_000)
  })

  it('finishes an ordinary material quickly', () => {
    const started = Date.now()
    isSolvable(sortInto(['a', 'b', 'c'], Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, bin: 'a' }))))
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
