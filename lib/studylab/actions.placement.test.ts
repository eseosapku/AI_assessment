import { describe, it, expect } from 'vitest'
import { autoPosition } from '@/lib/studylab/actions'
import type { StudyNode } from '@/lib/studylab/types'

function card(id: string, x: number, y: number, step: number): StudyNode {
  return { id, type: 'concept', position: { x, y }, data: { kind: 'concept', step } }
}

describe('autoPosition', () => {
  it('places the first card at slot 0 of the step band', () => {
    expect(autoPosition([], 1)).toEqual({ x: 0, y: 460 })
  })

  it('places the second card in the next column, not on top of the first', () => {
    const nodes = [card('a', 0, 460, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 356, y: 460 })
  })

  it('wraps to the next row after three columns', () => {
    const nodes = [card('a', 0, 460, 1), card('b', 356, 460, 1), card('c', 712, 460, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 0, y: 740 })
  })

  it('skips a slot occupied by an off-grid (dragged) card', () => {
    // A card dragged to overlap slot 0 must not get a new card stacked on it.
    const nodes = [card('a', 10, 465, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 356, y: 460 })
  })

  it('ignores stepGroup and hidden nodes when checking occupancy', () => {
    const group: StudyNode = { id: 'g', type: 'stepGroup', position: { x: 0, y: 460 }, data: { kind: 'stepGroup' } }
    const hidden: StudyNode = { ...card('h', 0, 460, 1), hidden: true }
    expect(autoPosition([group, hidden], 1)).toEqual({ x: 0, y: 460 })
  })
})

describe('autoPosition block-size awareness', () => {
  it('uses the real size of existing nodes when testing overlap', () => {
    // A 480-wide frame at slot 0 should push a new card past column 1 too,
    // because the frame overlaps both slot 0 (x=0) and slot 1 (x=356).
    const frame: StudyNode = { id: 'f', type: 'frame' as any, position: { x: 0, y: 460 }, data: { kind: 'concept', step: 1 } }
    const pos = autoPosition([frame], 1, 'concept')
    expect(pos.x).toBe(712) // column 2, since the 480px frame overlaps columns 0 and 1
    expect(pos.y).toBe(460)
  })

  it('still places a lone concept card at slot 0', () => {
    expect(autoPosition([], 1, 'concept')).toEqual({ x: 0, y: 460 })
  })

  it('defaults type to concept when omitted (back-compat)', () => {
    expect(autoPosition([], 2)).toEqual({ x: 0, y: 920 })
  })
})
