import { describe, expect, it } from 'vitest'
import { groupQuestionsByFigure, type QuestionWithFigureGroup } from './assessment-figure-groups'

interface TestQ extends QuestionWithFigureGroup {
  id: number
  question: string
}

function q(id: number, image_url?: string): TestQ {
  return { id, question: `Q${id}`, image_url }
}

describe('groupQuestionsByFigure', () => {
  it('leaves an all-image-less list untouched', () => {
    const input = [q(1), q(2), q(3)]
    const out = groupQuestionsByFigure(input)
    expect(out.map((x) => x.id)).toEqual([1, 2, 3])
    expect(out.every((x) => !x.figureGroup)).toBe(true)
  })

  it('leaves single-use figures unaffected (no group metadata, no reordering)', () => {
    const input = [q(1, 'a.jpg'), q(2, 'b.jpg'), q(3), q(4, 'c.jpg')]
    const out = groupQuestionsByFigure(input)
    expect(out.map((x) => x.id)).toEqual([1, 2, 3, 4])
    expect(out.every((x) => !x.figureGroup)).toBe(true)
  })

  it('makes scattered duplicates contiguous, preserving relative order within the group', () => {
    // Q2, Q7, Q14 share fig "x" — scattered far apart in the input.
    const input = [
      q(1),
      q(2, 'x.jpg'),
      q(3),
      q(4),
      q(5),
      q(6),
      q(7, 'x.jpg'),
      q(8),
      q(9),
      q(10),
      q(11),
      q(12),
      q(13),
      q(14, 'x.jpg'),
    ]
    const out = groupQuestionsByFigure(input)
    const ids = out.map((x) => x.id)

    // The three x.jpg questions (2, 7, 14) must be contiguous, in original order.
    const xIdx = ids
      .map((id, i) => ({ id, i }))
      .filter(({ id }) => [2, 7, 14].includes(id))
      .map(({ i }) => i)
    expect(xIdx).toEqual([xIdx[0], xIdx[0] + 1, xIdx[0] + 2])
    expect(ids.slice(xIdx[0], xIdx[0] + 3)).toEqual([2, 7, 14])
  })

  it('annotates every member of a contiguous group with matching figureGroup metadata', () => {
    const input = [q(1), q(2, 'x.jpg'), q(3), q(4, 'x.jpg'), q(5)]
    const out = groupQuestionsByFigure(input)
    const group = out.filter((x) => x.image_url === 'x.jpg')
    expect(group).toHaveLength(2)
    for (const g of group) {
      expect(g.figureGroup).toEqual({ key: 'x.jpg', startIndex: 1, endIndex: 2, size: 2 })
    }
    // Non-grouped questions carry no figureGroup.
    expect(out.find((x) => x.id === 1)?.figureGroup).toBeUndefined()
    expect(out.find((x) => x.id === 5)?.figureGroup).toBeUndefined()
  })

  it('startIndex/endIndex reflect positions in the OUTPUT order, not the input order', () => {
    const input = [q(1, 'x.jpg'), q(2), q(3), q(4, 'x.jpg')]
    const out = groupQuestionsByFigure(input)
    const ids = out.map((x) => x.id)
    // 1 and 4 pull together at the front (both keyed by x.jpg's first index 0);
    // 2 and 3 follow, keyed by their own original indices.
    expect(ids).toEqual([1, 4, 2, 3])
    expect(out[0].figureGroup).toEqual({ key: 'x.jpg', startIndex: 0, endIndex: 1, size: 2 })
    expect(out[1].figureGroup).toEqual({ key: 'x.jpg', startIndex: 0, endIndex: 1, size: 2 })
  })

  it('handles multiple distinct groups independently', () => {
    const input = [q(1, 'a'), q(2, 'b'), q(3), q(4, 'a'), q(5, 'b'), q(6)]
    const out = groupQuestionsByFigure(input)
    const ids = out.map((x) => x.id)

    const aIdx = ids.map((id, i) => ({ id, i })).filter(({ id }) => id === 1 || id === 4).map(({ i }) => i)
    const bIdx = ids.map((id, i) => ({ id, i })).filter(({ id }) => id === 2 || id === 5).map(({ i }) => i)
    expect(aIdx[1] - aIdx[0]).toBe(1)
    expect(bIdx[1] - bIdx[0]).toBe(1)
    expect(out.find((x) => x.id === 1)?.figureGroup?.key).toBe('a')
    expect(out.find((x) => x.id === 2)?.figureGroup?.key).toBe('b')
  })

  it('is deterministic — same input always produces the same output', () => {
    const input = [q(1, 'x'), q(2), q(3, 'y'), q(4, 'x'), q(5, 'y'), q(6)]
    const out1 = groupQuestionsByFigure(input).map((x) => x.id)
    const out2 = groupQuestionsByFigure(input).map((x) => x.id)
    const out3 = groupQuestionsByFigure(input).map((x) => x.id)
    expect(out1).toEqual(out2)
    expect(out2).toEqual(out3)
  })

  it('does not mutate the input array or its question objects', () => {
    const input = [q(1, 'x'), q(2), q(3, 'x')]
    const snapshot = JSON.parse(JSON.stringify(input))
    groupQuestionsByFigure(input)
    expect(input).toEqual(snapshot)
  })

  it('strips any pre-existing figureGroup before recomputing (idempotent on already-grouped input)', () => {
    const input = [q(1, 'x'), q(3, 'x'), q(2)]
    const first = groupQuestionsByFigure(input)
    const second = groupQuestionsByFigure(first)
    expect(second.map((x) => x.id)).toEqual(first.map((x) => x.id))
    expect(second.every((x, i) => JSON.stringify(x.figureGroup) === JSON.stringify(first[i].figureGroup))).toBe(true)
  })

  it('treats empty-string image_url the same as no image_url', () => {
    const input = [q(1, ''), q(2, ''), q(3, 'x')]
    const out = groupQuestionsByFigure(input)
    expect(out.map((x) => x.id)).toEqual([1, 2, 3])
    expect(out.every((x) => !x.figureGroup)).toBe(true)
  })

  it('handles an empty question list', () => {
    expect(groupQuestionsByFigure([])).toEqual([])
  })

  it('a question id/position stays consistent after reordering (id can be renumbered by caller from output order)', () => {
    const input = [q(1), q(2, 'x'), q(3), q(4, 'x')]
    const out = groupQuestionsByFigure(input)
    // Simulate the caller's renumber-by-position step.
    out.forEach((question, i) => {
      ;(question as TestQ).id = i + 1
    })
    // The group members (originally id 2 and 4) are now adjacent with fresh ids,
    // and figureGroup indices still point at their own positions.
    const groupMembers = out.filter((x) => x.image_url === 'x')
    expect(groupMembers.map((x) => (x as TestQ).id)).toEqual([
      (out[groupMembers[0].figureGroup!.startIndex] as TestQ).id,
      (out[groupMembers[0].figureGroup!.endIndex] as TestQ).id,
    ])
  })
})
