import { describe, it, expect } from 'vitest'
import { initialAnswer, isAnswered, attemptOf } from '@/lib/studylab/check/answers'
import type { CheckpointQuestion } from '@/lib/studylab/types'

const mcq: CheckpointQuestion = { id: 'q', format: 'mcq', prompt: 'Pick one.', options: ['Supply', 'Demand'], answer: 1 }
const fill: CheckpointQuestion = { id: 'q', format: 'fill', prompt: 'Complete.', text: 'Plants make ___ and ___.', tiles: ['glucose', 'oxygen', 'salt'], answer: ['glucose', 'oxygen'] }
const order: CheckpointQuestion = { id: 'q', format: 'order', prompt: 'Order.', items: ['Egg', 'Larva', 'Adult'] }
const match: CheckpointQuestion = { id: 'q', format: 'match', prompt: 'Match.', pairs: [{ left: 'H', right: 'Hydrogen' }, { left: 'O', right: 'Oxygen' }] }
const tap: CheckpointQuestion = { id: 'q', format: 'tap', prompt: 'Tap.', figure: 'asset:plant-cell', answer: ['nucleus'] }
const code: CheckpointQuestion = { id: 'q', format: 'code', prompt: 'Write it.', starter: 'print(1)', goal: 'prints 1' }

describe('where an answer starts', () => {
  it('restores a saved answer and leaves blanks empty', () => {
    expect(initialAnswer(mcq, 1)).toBe(1)
    expect(initialAnswer(mcq, undefined)).toBeUndefined()
    expect(initialAnswer(fill, undefined)).toEqual(['', ''])
    expect(initialAnswer(fill, ['glucose'])).toEqual(['glucose', ''])
    expect(initialAnswer(order, undefined)).toEqual(['', '', ''])
    expect(initialAnswer(match, undefined)).toEqual(['', ''])
    expect(initialAnswer(tap, ['nucleus', 3 as never])).toEqual(['nucleus'])
    expect(initialAnswer(code, undefined)).toBe('print(1)')
  })
})

describe('blank is not an answer', () => {
  it('needs a choice, every blank, or at least one tap', () => {
    expect(isAnswered(mcq, 0)).toBe(true)
    expect(isAnswered(mcq, undefined)).toBe(false)
    expect(isAnswered(fill, ['glucose', ''])).toBe(false)
    expect(isAnswered(fill, ['glucose', 'oxygen'])).toBe(true)
    expect(isAnswered(order, ['Egg', 'Larva', 'Adult'])).toBe(true)
    expect(isAnswered(match, ['Hydrogen', ''])).toBe(false)
    expect(isAnswered(match, ['Hydrogen', 'Oxygen'])).toBe(true)
    expect(isAnswered(tap, [])).toBe(false)
    expect(isAnswered(tap, ['nucleus'])).toBe(true)
    expect(isAnswered({ id: 'q', format: 'short', prompt: 'Say it.' }, '  ')).toBe(false)
    expect(isAnswered({ id: 'q', format: 'short', prompt: 'Say it.' }, 'osmosis')).toBe(true)
  })

  it('tells the tutor what was tapped by its label', () => {
    expect(attemptOf(mcq, 0)).toContain('Supply')
    expect(attemptOf(tap, ['nucleus'])).toContain('Nucleus')
  })
})
