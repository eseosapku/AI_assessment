import { describe, it, expect } from 'vitest'
import { getApparatus, apparatusNames } from './index'
import { validateMaterial } from '../validate'
import { tick } from '../interpreter'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { MaterialState } from '../types'

const placed = (placement: Record<string, string>): MaterialState =>
  ({ placement, controls: {}, attempts: 0, rejectedMoves: [], status: 'in_progress' })

describe('the canon', () => {
  it('uses a Map, so a name out of model output cannot reach Object.prototype', () => {
    expect(getApparatus('__proto__')).toBeNull()
    expect(getApparatus('constructor')).toBeNull()
    expect(getApparatus('nope')).toBeNull()
  })

  it('every entry is itself a valid material', () => {
    // The canon is written in the vocabulary, not above it. An entry that
    // could not pass the gate would be a second, privileged mechanism.
    for (const name of apparatusNames()) {
      const a = getApparatus(name)!
      const r = validateMaterial(a.base, a.maxVaryingTraits)
      expect(r.ok, `${name}: ${r.ok === false ? r.reason : ''}`).toBe(true)
    }
  })
})

describe('a sorting frame agrees with the sort pattern it replaces', () => {
  const payload = {
    bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
    items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }, { id: 'koh', label: 'KOH', binId: 'base' }],
  }
  const success = { kind: 'binAssignment' as const, assign: { hcl: 'acid', koh: 'base' } }

  it('calls the same placements solved', () => {
    const spec = getApparatus('sorting-frame')!.legacy!.fromLegacy(payload)!
    const legacy = getPatternModule('sort')!

    const cases: Record<string, string>[] = [
      { hcl: 'acid', koh: 'base' },   // right
      { hcl: 'base', koh: 'acid' },   // swapped
      { hcl: 'acid' },                // half done
      {},                             // untouched
    ]
    for (const placement of cases) {
      const mine = tick(spec, placed(
        Object.fromEntries(Object.entries(placement).map(([p, g]) => [p, `s-${g}`])),
      )).solved
      const theirs = legacy.validate(payload as never, { assign: placement } as never, success).ok
      expect(mine, JSON.stringify(placement)).toBe(theirs)
    }
  })
})
