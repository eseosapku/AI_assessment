import { describe, expect, it } from 'vitest'
import { hasWrittenResponse, honestWrittenFeedback } from './result-review'

describe('issue-28-written-answer-response', () => {
  it('treats even a one-character submission as an attempted answer', () => {
    expect(hasWrittenResponse('n')).toBe(true)
    expect(honestWrittenFeedback('n', 'The student did not provide a response.')).toContain('submitted answer')
  })
})
