import { describe, expect, it } from 'vitest'
import { quizBuilderShouldConfirm } from './quiz-builder-close'

describe('closing the quiz builder', () => {
  it('closes an untouched builder without asking', () => {
    expect(quizBuilderShouldConfirm({ step: 1, generating: false, hasEntry: false })).toBe(false)
  })

  it('asks once a step has been filled in or the quiz is generating', () => {
    expect(quizBuilderShouldConfirm({ step: 1, generating: false, hasEntry: true })).toBe(true)
    expect(quizBuilderShouldConfirm({ step: 2, generating: false, hasEntry: false })).toBe(true)
    expect(quizBuilderShouldConfirm({ step: 1, generating: true, hasEntry: false })).toBe(true)
  })
})
