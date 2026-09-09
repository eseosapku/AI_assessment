// lib/studylab/material/fit.test.ts
import { describe, it, expect } from 'vitest'
import { MATERIAL_BOX, fitsInBox } from './fit'
import type { MaterialSpec } from './types'

const withGroups = (groups: number, slotsPerGroup: number) => {
  const g = Array.from({ length: groups }, (_, i) => ({ id: `g${i}`, label: `G${i}`, ordered: false }))
  const slots = g.flatMap((grp, gi) =>
    Array.from({ length: slotsPerGroup }, (_, si) => ({ id: `s${gi}-${si}`, groupId: grp.id, x: si, y: 0, capacity: 1 })))
  return { prompt: 'p', pieces: [], groups: g, slots, rules: [],
           goal: { kind: 'exactSet' as const, itemIds: [] } } as MaterialSpec
}

describe('MATERIAL_BOX', () => {
  it('states the drawn box once, for everyone who needs it', () => {
    // The Phase 1 fault this exists to prevent: a cap enforced by a validator
    // and never mentioned to the model, so good material was refused as
    // "malformed" with no reason anyone could act on.
    expect(MATERIAL_BOX.widthPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.heightPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.maxSlotsPerRow).toBeGreaterThan(0)
    expect(MATERIAL_BOX.maxRows).toBeGreaterThan(0)
  })
})

describe('fitsInBox', () => {
  it('passes a scene the box can draw', () => {
    expect(fitsInBox(withGroups(2, 2))).toEqual({ ok: true })
  })

  it('refuses more groups than fit side by side, and says how many fit', () => {
    const r = fitsInBox(withGroups(MATERIAL_BOX.maxGroupsPerRow + 1, 1))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain(String(MATERIAL_BOX.maxGroupsPerRow))
  })

  it('refuses a group with more slots than its zone can hold', () => {
    const tooMany = MATERIAL_BOX.maxSlotsPerRow * MATERIAL_BOX.maxRows + 1
    const r = fitsInBox(withGroups(1, tooMany))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('slots')
  })

  it('names the offending group so the tutor can shrink that one', () => {
    const spec = withGroups(2, 1)
    // Derived from the exported cap, not hardcoded — a fixture that stops
    // exceeding the cap the moment the cap's own derivation changes would
    // silently stop testing anything.
    const overflow = MATERIAL_BOX.maxSlotsPerRow * MATERIAL_BOX.maxRows + 1
    spec.slots.push(...Array.from({ length: overflow }, (_, i) => ({ id: `x${i}`, groupId: 'g1', x: i, y: 0, capacity: 1 })))
    const r = fitsInBox(spec)
    expect(r.ok === false && r.reason).toContain('g1')
  })

  it('refuses several groups that each pass their own cap but overflow the box together', () => {
    // The per-group cap (maxSlotsPerRow * maxRows) assumes a group has the
    // WHOLE box to itself — that is true of no group once a second one
    // exists. Fill every group slot this box allows side by side with just
    // enough slots each to individually clear that per-group cap, and the
    // sum still asks for more room than the box's total area could ever
    // hold. Derived from the exported caps, not hardcoded, for the same
    // reason as the fixture above.
    const groups = MATERIAL_BOX.maxGroupsPerRow
    const perGroup = Math.ceil(MATERIAL_BOX.maxTotalSlots / groups) + 1
    const r = fitsInBox(withGroups(groups, perGroup))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain(String(MATERIAL_BOX.maxTotalSlots))
  })
})
