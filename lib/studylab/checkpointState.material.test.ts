// lib/studylab/checkpointState.material.test.ts
import { describe, it, expect } from 'vitest'
import { summarizeCheckpoints } from './checkpointState'
import type { StudyNode } from './types'
import type { MaterialSpec } from './material/types'

const sortSpec = (checkpointId?: string): MaterialSpec => ({
  prompt: 'Sort them.',
  pieces: [{ id: 'hcl', label: 'HCl', traits: { home: 'acid' } }],
  groups: [{ id: 'acid', label: 'Acid', ordered: false }],
  slots: [{ id: 's-acid', groupId: 'acid', x: 0, y: 0, capacity: 4 }],
  rules: [],
  goal: { kind: 'binAssignment', assign: { hcl: 'acid' } },
  satisfiesCheckpoint: checkpointId,
})

const materialNode = (id: string, checkpointId: string, solved: boolean): StudyNode => ({
  id,
  type: 'material',
  position: { x: 0, y: 0 },
  data: {
    kind: 'material',
    materialSpec: sortSpec(checkpointId),
    materialState: {
      placement: {},
      controls: {},
      attempts: 1,
      rejectedMoves: [],
      status: solved ? 'solved' : 'in_progress',
    },
  },
})

describe('summarizeCheckpoints with material nodes', () => {
  it('marks a checkpoint done when its material is solved', () => {
    const out = summarizeCheckpoints([materialNode('m1', 'cp1', true)])
    const cp = out.find((c) => c.id === 'cp1')
    expect(cp).toBeDefined()
    expect(cp!.done).toBe(true)
    expect(cp!.total).toBe(1)
    expect(cp!.correct).toBe(1)
  })

  it('leaves a checkpoint not done while its material is unsolved', () => {
    const out = summarizeCheckpoints([materialNode('m1', 'cp1', false)])
    const cp = out.find((c) => c.id === 'cp1')
    expect(cp!.done).toBe(false)
    expect(cp!.correct).toBe(0)
  })

  it('ignores material nodes with no checkpoint binding', () => {
    const node = materialNode('m1', '', true)
    delete node.data.materialSpec!.satisfiesCheckpoint
    expect(summarizeCheckpoints([node])).toEqual([])
  })
})
