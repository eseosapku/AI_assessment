// lib/off-topic-arithmetic.test.ts
import { describe, it, expect } from 'vitest'
import { isLikelyOffTopicMathQuestion, allowsArithmeticForSelection } from './off-topic-arithmetic'

const english = (question: string) => isLikelyOffTopicMathQuestion({ question }, 'English', ['writing a story'])

describe('a sum on a paper that is not about sums', () => {
  it('still catches the word problem it was written for', () => {
    expect(english('Tom has 12 apples and gives 5 away. How many are left?')).toBe(true)
    expect(english('What is 12 + 7?')).toBe(true)
  })

  // Deleted a live English paper's 25-mark composition, whose only digit was
  // the length of the essay.
  it('never deletes a composition', () => {
    expect(english('Write an article for your school magazine explaining the difference between a fact and an opinion. Write about 400 words.')).toBe(false)
    expect(english('Your school is holding a competition. Write a story about the day everything changed. Aim for 300-400 words.')).toBe(false)
  })

  it('does not read a word limit as a quantity', () => {
    expect(english('In no more than 20 words, explain the difference between the two characters.')).toBe(false)
  })

  it('leaves a subject that calls for arithmetic alone', () => {
    expect(allowsArithmeticForSelection('Mathematics', [])).toBe(true)
    expect(isLikelyOffTopicMathQuestion({ question: 'What is 12 + 7?' }, 'Mathematics', [])).toBe(false)
  })
})
