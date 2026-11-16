import { describe, it, expect } from 'vitest'
import { keptPictures, artPathFor } from './gap-art'

const topics = [{ id: 'a', topicIds: [1] }, { id: 'b', topicIds: [2] }, { id: 'shared', topicIds: [3, 9] }]

describe('keptPictures', () => {
  it('ships a drawing whose last verdict is keep on its newest version', () => {
    expect(keptPictures(topics, [{ id: 'a', v: 1 }, { id: 'a', v: 2 }], [{ id: 'a', verdict: 'keep', of: 2 }])).toEqual({ '1': 'a.v2' })
  })
  it('leaves out a drawing whose last verdict is redo', () => {
    const v = [{ id: 'a', verdict: 'keep', of: 1 }, { id: 'a', verdict: 'redo', of: 1 }]
    expect(keptPictures(topics, [{ id: 'a', v: 1 }], v)).toEqual({})
  })
  it('leaves out a keep given to an older version', () => {
    expect(keptPictures(topics, [{ id: 'a', v: 1 }, { id: 'a', v: 2 }], [{ id: 'a', verdict: 'keep', of: 1 }])).toEqual({})
  })
  it('leaves out a drawing with no verdict', () => {
    expect(keptPictures(topics, [{ id: 'a', v: 1 }], [])).toEqual({})
  })
  it('maps every topic id of a shared drawing', () => {
    expect(keptPictures(topics, [{ id: 'shared', v: 1 }], [{ id: 'shared', verdict: 'keep', of: 1 }])).toEqual({ '3': 'shared.v1', '9': 'shared.v1' })
  })
})

describe('artPathFor', () => {
  it('gives the path, or null', () => {
    const map = { '3': 'shared.v1' }
    expect(artPathFor(3, map)).toBe('/gap-art/shared.v1.svg')
    expect(artPathFor(4, map)).toBeNull()
  })
})
