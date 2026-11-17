import { describe, it, expect } from 'vitest'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'

describe('the same activity looks the same on reload', () => {
  const items = ['Egg', 'Larva', 'Pupa', 'Adult', 'Egg case']

  it('is deterministic for a seed and does not mutate the source', () => {
    expect(seededShuffle(items, 7)).toEqual(seededShuffle(items, 7))
    expect(items).toEqual(['Egg', 'Larva', 'Pupa', 'Adult', 'Egg case'])
  })

  it('a different seed can lay the tiles out differently', () => {
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2))
  })

  it('keeps every item, including a one-item list and a zero seed', () => {
    expect(seededShuffle(items, 3).sort()).toEqual([...items].sort())
    expect(seededShuffle(['only'], 1)).toEqual(['only'])
    expect(seededShuffle(items, 0)).toHaveLength(items.length)
  })
})
