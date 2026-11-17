import { describe, it, expect } from 'vitest'
import { withoutVerdict, whyForChoice } from '@/lib/studylab/whyLine'

describe('explanations after a miss', () => {
  it('strips an opening verdict so a wrong answer is not told it was right', () => {
    expect(withoutVerdict('Correct — the atria contract first.')).toBe('The atria contract first.')
    expect(withoutVerdict("That's right: osmosis needs a membrane.")).toBe('Osmosis needs a membrane.')
    expect(withoutVerdict('Well done! The gradient is steepest here.')).toBe('The gradient is steepest here.')
  })

  it('leaves a line that does not open with a verdict', () => {
    expect(withoutVerdict('The nucleus controls the cell.')).toBe('The nucleus controls the cell.')
  })

  it('puts the chosen option first, then the general explanation', () => {
    const q = {
      answer: 1,
      explain: 'Correct — demand slopes down.',
      optionFeedback: ['That is the supply curve.', 'Demand slopes down.'],
    }
    expect(whyForChoice(q, 0)).toBe('That is the supply curve. Demand slopes down.')
    expect(whyForChoice(q, 1)).toBe('Demand slopes down.')
  })

  it('uses the right option when the question has no explanation of its own', () => {
    expect(whyForChoice({ answer: 0, optionFeedback: ['Correct — it is the nucleus.'] }, 2)).toBe('It is the nucleus.')
  })
})
