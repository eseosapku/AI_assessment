import { describe, expect, it } from 'vitest'
import { hasAnyStoredResponse, mcqResponse } from './result-review'
import { delexicaliseExplanation } from './answer-position'

describe('issue-30-blank-paper-review', () => {
  it('distinguishes blank answers and removes option-letter prose', () => {
    expect(mcqResponse('')).toBeNull()
    expect(hasAnyStoredResponse({ mcq: {}, longform: {} })).toBe(false)
    expect(delexicaliseExplanation({ options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], correct_answer: 0, explanation: 'Option C is incorrect.' }).explanation).toBe('Nitrogen is incorrect.')
  })
})
