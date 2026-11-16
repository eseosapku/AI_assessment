import { describe, it, expect } from 'vitest'
import { autoGroupStep } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const board: CanvasState = {
  nodes: [
    { id: 'a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', title: 'A', step: 1 } },
    { id: 'b', type: 'concept', position: { x: 400, y: 0 }, data: { kind: 'concept', title: 'B', step: 1 } },
  ],
  edges: [],
}

describe('autoGroupStep', () => {
  it('names the folded station after its step', () => {
    const grouped = autoGroupStep(board, 1, 'Reactions and activation energy')
    const station = grouped.nodes.find((n) => n.type === 'stepGroup')
    expect(station?.data.label).toBe('Reactions and activation energy')
  })

  it('falls back to the step number without a title', () => {
    const station = autoGroupStep(board, 1).nodes.find((n) => n.type === 'stepGroup')
    expect(station?.data.label).toBe('Step 1')
    const blank = autoGroupStep(board, 1, '  ').nodes.find((n) => n.type === 'stepGroup')
    expect(blank?.data.label).toBe('Step 1')
  })
})
