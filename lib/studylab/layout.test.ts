import { describe, it, expect } from 'vitest'
import { layoutGraph } from '@/lib/studylab/layout'
import type { StudyNode, StudyEdge } from '@/lib/studylab/types'

function node(id: string, type = 'concept', extra: Partial<StudyNode> = {}): StudyNode {
  return { id, type: type as StudyNode['type'], position: { x: 0, y: 0 }, data: { kind: 'concept' }, ...extra }
}

describe('layoutGraph', () => {
  it('places children below their parent, siblings on the same rank', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges: StudyEdge[] = [
      { id: 'e-a-b', source: 'a', target: 'b' },
      { id: 'e-a-c', source: 'a', target: 'c' },
    ]
    const pos = layoutGraph(nodes, edges)
    expect(pos.a.y).toBeLessThan(pos.b.y)
    expect(pos.a.y).toBeLessThan(pos.c.y)
    expect(pos.b.y).toBe(pos.c.y)
    expect(pos.b.x).not.toBe(pos.c.x)
  })

  it('excludes freeform and hidden nodes', () => {
    const nodes = [
      node('a'),
      { ...node('s', 'sticky'), source: 'freeform' as const },
      { ...node('h'), hidden: true },
    ]
    const pos = layoutGraph(nodes, [])
    expect(pos.a).toBeDefined()
    expect(pos.s).toBeUndefined()
    expect(pos.h).toBeUndefined()
  })

  it('ignores user-drawn edges (u- prefix)', () => {
    const nodes = [node('a'), node('b')]
    const pos = layoutGraph(nodes, [{ id: 'u-a-b', source: 'a', target: 'b' }])
    expect(pos.a).toBeDefined()
    expect(pos.b).toBeDefined()
  })
})
