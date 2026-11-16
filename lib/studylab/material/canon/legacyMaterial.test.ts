// lib/studylab/material/canon/legacyMaterial.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getApparatus } from '.'
import { legacyMaterial } from './legacyMaterial'

// Converting a sort runs the solver (validateMaterial -> isSolvable), and the
// activity card did it on every render: in the owner's Sonder lesson the board
// froze for 1.1 s when station 2's sort was drawn, and again on every redraw.
const payload = () => ({
  bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
  items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }, { id: 'koh', label: 'KOH', binId: 'base' }],
})
const success = () => ({ kind: 'binAssignment' as const, assign: { hcl: 'acid', koh: 'base' } })

describe('legacyMaterial', () => {
  it('gives what the apparatus converts', () => {
    expect(legacyMaterial('sorting-frame', payload(), success())).toEqual(getApparatus('sorting-frame')!.legacy!.fromLegacy(payload(), success()))
  })
  it('converts the same activity once, however often it is drawn', () => {
    const spy = vi.spyOn(getApparatus('ordering-track')!.legacy!, 'fromLegacy')
    const p = { items: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }], order: ['a', 'b'] }
    const first = legacyMaterial('ordering-track', p, undefined)
    const again = legacyMaterial('ordering-track', JSON.parse(JSON.stringify(p)), undefined)
    expect(again).toBe(first)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('keeps different activities apart', () => {
    const other = { ...payload(), items: [{ id: 'hcl', label: 'HCl', binId: 'base' }, { id: 'koh', label: 'KOH', binId: 'base' }] }
    expect(legacyMaterial('sorting-frame', other, success())).not.toBe(legacyMaterial('sorting-frame', payload(), success()))
  })
  it('has nothing for an apparatus that is not there', () => expect(legacyMaterial('no-such-thing', payload(), success())).toBeNull())
})
