import { describe, it, expect } from 'vitest'
import { createFreeformBlock, aiCardIds } from '@/lib/studylab/freeform'
import type { StudyNode } from '@/lib/studylab/types'

describe('createFreeformBlock', () => {
  it('creates a sticky with freeform source and a color', () => {
    const n = createFreeformBlock('sticky', { x: 10, y: 20 })
    expect(n.source).toBe('freeform')
    expect(n.type).toBe('sticky')
    expect(n.position).toEqual({ x: 10, y: 20 })
    expect(n.data.source).toBe('freeform')
    expect(n.data.color).toBe('yellow')
  })

  it('creates a scratchpad seeded for python code', () => {
    const n = createFreeformBlock('scratchpad', { x: 0, y: 0 })
    expect(n.type).toBe('scratchpad')
    expect(n.data.language).toBe('python')
    expect(n.data.code).toBe('')
  })

  it('creates a flashcard with empty faces', () => {
    const n = createFreeformBlock('flashcard', { x: 0, y: 0 })
    expect(n.data.card).toEqual({ front: '', back: '' })
  })

  it('gives every block a unique id', () => {
    const a = createFreeformBlock('note', { x: 0, y: 0 })
    const b = createFreeformBlock('note', { x: 0, y: 0 })
    expect(a.id).not.toBe(b.id)
  })

  it('rejects non-freeform types', () => {
    expect(() => createFreeformBlock('concept', { x: 0, y: 0 })).toThrow()
  })
})

describe('aiCardIds', () => {
  it('excludes stepGroup and freeform nodes', () => {
    const nodes: StudyNode[] = [
      { id: 'a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept' } },
      { id: 'g', type: 'stepGroup', position: { x: 0, y: 0 }, data: { kind: 'stepGroup' } },
      { id: 's', type: 'sticky' as any, position: { x: 0, y: 0 }, data: { kind: 'concept' }, source: 'freeform' },
    ]
    expect(aiCardIds(nodes)).toEqual(['a'])
  })
})
