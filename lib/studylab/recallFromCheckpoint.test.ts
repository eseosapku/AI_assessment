import { describe, it, expect } from 'vitest'
import { buildCheckpointRecallCards, recallNotice } from '@/lib/studylab/recallFromCheckpoint'
import type { QuizCell } from '@/lib/studylab/types'

function cell(state: QuizCell['state'], question: QuizCell['question']): QuizCell {
  return { checkpointId: 'cp', gate: 'hard', question, state }
}

describe('buildCheckpointRecallCards', () => {
  it('only turns INCORRECT questions into recall cards', () => {
    const cells: QuizCell[] = [
      cell('correct', { id: 'q1', format: 'mcq', prompt: 'right one', options: ['a', 'b'], answer: 0 }),
      cell('incorrect', { id: 'q2', format: 'mcq', prompt: 'missed one', options: ['a', 'b'], answer: 1, explain: 'because b' }),
    ]
    const cards = buildCheckpointRecallCards(cells)
    expect(cards).toHaveLength(1)
    expect(cards[0].front).toBe('missed one')
    expect(cards[0].back).toBe('b\n\nbecause b')
  })

  it('handles short/code/match backs', () => {
    const cells: QuizCell[] = [
      cell('incorrect', { id: 's', format: 'short', prompt: 'define X', rubric: 'X is ...' }),
      cell('incorrect', { id: 'c', format: 'code', prompt: 'write Y', goal: 'returns Y' }),
      cell('incorrect', { id: 'm', format: 'match', prompt: 'match', pairs: [{ left: 'L', right: 'R' }] }),
    ]
    const cards = buildCheckpointRecallCards(cells)
    expect(cards.map((c) => c.back)).toEqual(['X is ...', 'returns Y', 'L → R'])
  })
})

describe('telling the student about Recall', () => {
  it('says how many questions went, and why', () => {
    expect(recallNotice(1)).toMatch(/^The question you missed is saved to Recall/)
    expect(recallNotice(3)).toMatch(/^The 3 questions you missed are saved to Recall/)
  })
  it('says nothing when nothing was saved', () => {
    expect(recallNotice(0)).toBe('')
  })
})
