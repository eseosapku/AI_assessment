// app/api/studylab/tutor/dispatch.buildMaterial.test.ts
import { describe, it, expect } from 'vitest'
import { refuseUnjustifiedMaterials } from './dispatch'
import { getApparatus } from '@/lib/studylab/material/canon'

const intent = {
  goal: 'Tell metals from non-metals by their properties.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

const spec = getApparatus('sorting-frame')!.base

describe('refuseUnjustifiedMaterials', () => {
  it('lets a justified material through', () => {
    const { kept, refused } = refuseUnjustifiedMaterials([
      { type: 'build_material', id: 'm1', intent, spec },
    ])
    expect(kept).toHaveLength(1)
    expect(refused).toEqual([])
  })

  it('refuses a material with no intent at all', () => {
    const { kept, refused } = refuseUnjustifiedMaterials([{ type: 'build_material', id: 'm1', spec }])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/intent/i)
  })

  it('refuses an unknown apparatus', () => {
    const { kept, refused } = refuseUnjustifiedMaterials([
      { type: 'build_material', id: 'm1', intent: { ...intent, apparatus: 'mystery-box' }, spec },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/unknown apparatus|Unknown apparatus/i)
    expect(refused[0]).toContain('mystery-box')
  })

  it('refuses isolates that do not match the apparatus', () => {
    const { kept, refused } = refuseUnjustifiedMaterials([
      { type: 'build_material', id: 'm1', intent: { ...intent, isolates: 'quantity' }, spec },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('quantity')
    expect(refused[0]).toContain('sorting-frame')
  })

  it('refuses a structurally invalid spec before it reaches the intent check', () => {
    const { kept, refused } = refuseUnjustifiedMaterials([
      { type: 'build_material', id: 'm1', intent, spec: { prompt: 'x' } },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/spec|valid|read/i)
  })

  it('leaves every other action untouched', () => {
    const others = [{ type: 'createCard', card: 'concept', id: 'c1' }, { type: 'connect', source: 'a', target: 'b' }]
    expect(refuseUnjustifiedMaterials(others).kept).toEqual(others)
  })

  it('strips the intent before the action reaches the board', () => {
    const { kept } = refuseUnjustifiedMaterials([{ type: 'build_material', id: 'm1', intent, spec }])
    expect(kept[0]).not.toHaveProperty('intent')
  })

  it('refuses a spec that fails validateMaterial isolation', () => {
    // Two varying traits with maxVaryingTraits 1 on sorting-frame.
    const hostile = {
      ...spec,
      pieces: [
        { id: 'a', label: 'A', traits: { metal: 1, hot: 1 } },
        { id: 'b', label: 'B', traits: { metal: 0, hot: 0 } },
      ],
    }
    const { kept, refused } = refuseUnjustifiedMaterials([
      { type: 'build_material', id: 'm1', intent, spec: hostile },
    ])
    expect(kept).toEqual([])
    expect(refused[0]?.length).toBeGreaterThan(0)
  })

  it('accepts balance-beam with isolates structure (equation-style)', () => {
    const balance = getApparatus('balance-beam')!.base
    const { kept, refused } = refuseUnjustifiedMaterials([
      {
        type: 'build_material',
        id: 'm1',
        intent: {
          goal: 'Balance atom counts on both sides of an equation.',
          isolates: 'structure',
          apparatus: 'balance-beam',
          why: 'The work is arranging parts so both sides match.',
        },
        spec: balance,
      },
    ])
    expect(refused).toEqual([])
    expect(kept).toHaveLength(1)
  })
})
