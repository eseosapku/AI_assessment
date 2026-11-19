import { describe, expect, it } from 'vitest'
import { alignReviewExplanation } from './review-explanation'

describe('issue-29-answer-explanation', () => {
  it('states the same answer that the review marks as correct', () => {
    const repaired = alignReviewExplanation({
      question: 'Which is not an elementary row operation?',
      options: ['Row scaling', 'Row multiplication', 'Row swapping', 'Row addition'],
      correct_answer: 1,
      explanation: 'Row scaling by a non-zero number is a valid operation.',
    })
    expect(repaired.explanation).toMatch(/^Row multiplication is the correct answer\./)
  })
})
