import { describe, it, expect } from 'vitest'
import { layoutGraph } from '@/lib/studylab/layout'
import type { StudyNode, StudyEdge } from '@/lib/studylab/types'

function node(id: string, type = 'concept', extra: Partial<StudyNode> = {}): StudyNode {
  return { id, type: type as StudyNode['type'], position: { x: 0, y: 0 }, data: { kind: 'concept' }, ...extra }
}

describe('layoutGraph', () => {
  it('places children to the right of their parent, siblings on the same rank (LR)', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges: StudyEdge[] = [
      { id: 'e-a-b', source: 'a', target: 'b' },
      { id: 'e-a-c', source: 'a', target: 'c' },
    ]
    const pos = layoutGraph(nodes, edges)
    expect(pos.a.x).toBeLessThan(pos.b.x)
    expect(pos.a.x).toBeLessThan(pos.c.x)
    expect(pos.b.x).toBe(pos.c.x)
    expect(pos.b.y).not.toBe(pos.c.y)
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

/**
 * The board has to read in the order the lesson is taught.
 *
 * Dagre ranks by edge depth. A card opening step four with no link back to step
 * three landed in column one beside step one, and the step areas drawn over the
 * cards nested inside one another instead of sitting side by side.
 */
describe('layoutGraph bands the board by step', () => {
  const stepNode = (id: string, step: number) =>
    node(id, 'concept', { data: { kind: 'concept', step } } as Partial<StudyNode>)

  it('puts every card of a later step to the right of every card of an earlier one', () => {
    const nodes = [stepNode('a1', 1), stepNode('a2', 1), stepNode('b1', 2), stepNode('b2', 2)]
    const pos = layoutGraph(nodes, [{ id: 'e', source: 'a1', target: 'a2' }])
    const w = 300
    const step1Right = Math.max(pos.a1.x, pos.a2.x) + w
    const step2Left = Math.min(pos.b1.x, pos.b2.x)
    expect(step2Left).toBeGreaterThan(step1Right)
  })

  it('does not let a link back to an earlier step drag a card out of its own band', () => {
    // The exact shape that broke: step 4 hangs off a step 1 card.
    const nodes = [stepNode('one', 1), stepNode('four', 4)]
    const pos = layoutGraph(nodes, [{ id: 'e', source: 'one', target: 'four' }])
    expect(pos.four.x).toBeGreaterThan(pos.one.x + 300)
  })

  it('still arranges the cards within one step by their links', () => {
    const nodes = [stepNode('p', 1), stepNode('c1', 1), stepNode('c2', 1)]
    const pos = layoutGraph(nodes, [
      { id: 'e1', source: 'p', target: 'c1' },
      { id: 'e2', source: 'p', target: 'c2' },
    ])
    expect(pos.p.x).toBeLessThan(pos.c1.x)
    expect(pos.c1.x).toBe(pos.c2.x)
    expect(pos.c1.y).not.toBe(pos.c2.y)
  })

  it('top-aligns the bands so the steps read across, not down', () => {
    const nodes = [stepNode('a', 1), stepNode('b', 2), stepNode('c', 3)]
    const pos = layoutGraph(nodes, [])
    expect(pos.a.y).toBe(pos.b.y)
    expect(pos.b.y).toBe(pos.c.y)
  })
})
