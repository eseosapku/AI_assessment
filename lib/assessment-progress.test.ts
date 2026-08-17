import { describe, it, expect } from 'vitest'
import {
  questionState,
  skippedQuestions,
  unansweredQuestions,
  unansweredSummary,
  answeredCount,
  type ProgressInput,
} from './assessment-progress'

const input = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  total: 5,
  current: 0,
  answered: new Set<number>(),
  visited: new Set<number>(),
  ...over,
})

describe('questionState', () => {
  it('marks an answered question answered, even if it is the current one', () => {
    const i = input({ current: 2, answered: new Set([2]) })
    expect(questionState(2, i)).toBe('answered')
  })

  it('marks the current question current', () => {
    expect(questionState(1, input({ current: 1 }))).toBe('current')
  })

  it('separates seen-and-blank from not-yet-reached', () => {
    // The whole point: a question you walked past is a problem, one you have
    // not reached is not, and colouring them the same helps nobody.
    const i = input({ current: 3, visited: new Set([0, 1, 2, 3]) })
    expect(questionState(1, i)).toBe('skipped')
    expect(questionState(4, i)).toBe('unseen')
  })

  it('handles missing sets without throwing', () => {
    const i = { total: 3, current: 0 } as unknown as ProgressInput
    expect(questionState(1, i)).toBe('unseen')
  })
})

describe('skippedQuestions', () => {
  it('lists only questions seen and left blank, one-based', () => {
    const i = input({ total: 5, current: 4, visited: new Set([0, 1, 2, 3, 4]), answered: new Set([0, 2]) })
    expect(skippedQuestions(i)).toEqual([2, 4])
  })

  it('never lists the question being worked on', () => {
    const i = input({ total: 3, current: 1, visited: new Set([0, 1]) })
    expect(skippedQuestions(i)).toEqual([1])
  })

  it('is empty on a fresh attempt', () => {
    expect(skippedQuestions(input())).toEqual([])
  })
})

describe('unansweredQuestions', () => {
  it('lists every blank at submit time, reached or not', () => {
    const i = input({ total: 4, answered: new Set([1]) })
    expect(unansweredQuestions(i)).toEqual([1, 3, 4])
  })

  it('is empty on a complete paper', () => {
    expect(unansweredQuestions(input({ total: 3, answered: new Set([0, 1, 2]) }))).toEqual([])
  })

  it('handles a malformed total', () => {
    expect(unansweredQuestions(input({ total: 0 }))).toEqual([])
    expect(unansweredQuestions(input({ total: NaN as never }))).toEqual([])
  })
})

describe('unansweredSummary', () => {
  it('names a single blank', () => {
    expect(unansweredSummary([7])).toBe('Question 7 is still blank.')
  })

  it('names them rather than only counting', () => {
    expect(unansweredSummary([2, 5])).toBe('2 questions are still blank: 2, 5.')
  })

  it('truncates a long list instead of dumping it', () => {
    const many = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(unansweredSummary(many)).toBe(
      '10 questions are still blank: 1, 2, 3, 4, 5, 6, 7, 8 and 2 more.',
    )
  })

  it('says nothing when nothing is blank', () => {
    expect(unansweredSummary([])).toBe('')
  })
})

describe('answeredCount', () => {
  it('counts answers, not visits', () => {
    // Progress should reflect work done, not pages turned.
    const i = input({ total: 5, visited: new Set([0, 1, 2, 3, 4]), answered: new Set([0, 3]) })
    expect(answeredCount(i)).toBe(2)
  })
})
