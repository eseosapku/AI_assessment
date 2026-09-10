import { describe, it, expect } from 'vitest'
import { createInitialMaterialState } from './initialState'
import type { MaterialSpec } from './types'

const spec = {
  prompt: 'p',
  pieces: [{ id: 'a', label: 'A', traits: { n: 1 } }],
  groups: [{ id: 'g', label: 'G', ordered: false }],
  slots: [{ id: 's-g', groupId: 'g', x: 0, y: 0, capacity: 1 }],
  controls: [{ id: 'drops', label: 'Drops', min: 2, max: 10, step: 1 }],
  rules: [],
  goal: { kind: 'exactSet' as const, itemIds: ['a'] },
} as MaterialSpec

describe('createInitialMaterialState', () => {
  it('starts with nothing placed and controls at their minimum', () => {
    const s = createInitialMaterialState(spec)
    expect(s.placement).toEqual({})
    expect(s.controls).toEqual({ drops: 2 })
    expect(s.attempts).toBe(0)
    expect(s.rejectedMoves).toEqual([])
    expect(s.status).toBe('untouched')
  })

  it('omits controls when the spec has none', () => {
    const bare = { ...spec, controls: undefined }
    expect(createInitialMaterialState(bare as MaterialSpec).controls).toEqual({})
  })
})
