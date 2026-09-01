// lib/studylab/practice.test.ts
import { describe, it, expect } from 'vitest'
import { normaliseAnswer, localVerdict, isAttemptable, parseVerdict } from './practice'

describe('normaliseAnswer', () => {
  it('strips the LaTeX the tutor writes and the learner does not', () => {
    expect(normaliseAnswer('$x = 3.5$')).toBe('3.5')
    expect(normaliseAnswer('3.5')).toBe('3.5')
  })

  it('ignores case, spacing and trailing punctuation', () => {
    expect(normaliseAnswer('  The Sun.  ')).toBe('the sun')
    expect(normaliseAnswer('the   sun')).toBe('the sun')
  })

  it('drops a leading "x =" however it is spaced', () => {
    expect(normaliseAnswer('y=12')).toBe('12')
    expect(normaliseAnswer('x  =  12')).toBe('12')
  })
})

describe('localVerdict', () => {
  it('awards the mark when the answer is written the same way', () => {
    expect(localVerdict('3.5', '3.5')).toBe('correct')
    expect(localVerdict('The Sun', 'the sun.')).toBe('correct')
  })

  it('awards it through the notation the two sides happen to use', () => {
    expect(localVerdict('$x = 12$', '12')).toBe('correct')
    expect(localVerdict('12', 'x = 12')).toBe('correct')
  })

  it('reads a fraction as the number it is', () => {
    expect(localVerdict('0.5', '1/2')).toBe('correct')
    expect(localVerdict('3/4', '0.75')).toBe('correct')
  })

  it('never returns "wrong" — only "correct" or "ask the model"', () => {
    // Being told you are wrong when you are right is far worse for a learner
    // than a tenth of a second and a hundredth of a penny.
    const results = [
      localVerdict('3.5', '7'),
      localVerdict('The Sun', 'the moon'),
      localVerdict('x^2 + 6x + 9', '(x+3)^2'),
      localVerdict('12', 'I think it is about twelve'),
    ]
    expect(results.every((r) => r === 'unknown')).toBe(true)
  })

  it('escalates working that surrounds a right number, rather than guessing', () => {
    // "I got 12 by substituting" is probably right, but only the model can say.
    expect(localVerdict('12', 'I substituted and got 12')).toBe('unknown')
  })

  it('escalates when either side is empty', () => {
    expect(localVerdict('', '3')).toBe('unknown')
    expect(localVerdict('3', '')).toBe('unknown')
  })

  it('does not treat a divide by zero as a number', () => {
    expect(localVerdict('1/0', '0')).toBe('unknown')
  })

  it('is not fooled by a number that differs only beyond float precision', () => {
    expect(localVerdict('0.1', '0.1000000000001')).toBe('correct')
    expect(localVerdict('0.1', '0.2')).toBe('unknown')
  })
})

describe('isAttemptable', () => {
  it('refuses to spend a call on nothing', () => {
    expect(isAttemptable('   ')).toBe(false)
    expect(isAttemptable('')).toBe(false)
    expect(isAttemptable('12')).toBe(true)
  })
})

describe('parseVerdict', () => {
  it('takes the two good verdicts at face value', () => {
    expect(parseVerdict('correct')).toBe('correct')
    expect(parseVerdict('close')).toBe('close')
  })

  it('treats anything it does not recognise as not yet right', () => {
    // Erring towards "incorrect" keeps the worked solution available rather
    // than closing the problem on a reply nobody could read.
    expect(parseVerdict('CORRECT!')).toBe('incorrect')
    expect(parseVerdict(null)).toBe('incorrect')
    expect(parseVerdict(undefined)).toBe('incorrect')
  })
})
