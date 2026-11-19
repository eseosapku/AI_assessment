import { describe, expect, it } from 'vitest'
import { quizDisplayTitle } from './quiz-display-title'

describe('issue-14-readable-quiz-titles', () => {
  it('turns textbook filenames into learner-facing quiz names', () => {
    expect(quizDisplayTitle('Cambridge-IGCSE-Biology-MARRY-JONES-4th-Ed')).toBe('Cambridge IGCSE Biology quiz')
    expect(quizDisplayTitle('Cambridge International AS _ A Level Economics Fourth edition Coursebook')).toBe('Cambridge AS & A Level Economics quiz')
  })
})
