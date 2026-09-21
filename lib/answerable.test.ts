// lib/answerable.test.ts
import { describe, it, expect } from 'vitest'
import { unanswerableReason, dropUnanswerable } from './answerable'

const short = (question: string) => ({
  type: 'longform', marks: 1, question,
  short_answer: { accepted: ['artery'] },
})

describe('what a learner cannot answer', () => {
  it('catches a scenario that asks nothing', () => {
    // Shipped, twice, in one Science paper.
    expect(unanswerableReason({
      type: 'longform', marks: 1,
      question: 'During a school field trip, students observed that the temperature of a lake was 15°C. They noticed that the air above the lake was warmer than the air above a nearby field.',
    })).toMatch(/asks nothing/)
  })

  it('catches two demands in a one-word box', () => {
    // Shipped: one mark, one input, two answers wanted.
    expect(unanswerableReason(short(
      'Write down the type of blood vessel that carries blood from the heart to the rest of the body. Write down the name of the blood cell that carries oxygen in the blood.',
    ))).toMatch(/two things/)
  })

  it('catches the explain-style second demand too', () => {
    expect(unanswerableReason(short(
      'State the medium where the speed of sound is highest. Explain why this is the case.',
    ))).toMatch(/two things/)
  })

  it('leaves a single clean demand alone', () => {
    expect(unanswerableReason(short('Write down the name of the blood cell that carries oxygen.'))).toBeNull()
    expect(unanswerableReason(short('A student runs for 5 minutes. State the effect on their heart rate.'))).toBeNull()
  })

  it('leaves questions answered by selecting alone', () => {
    // A tick list has no command word and is not meant to.
    expect(unanswerableReason({ type: 'interactive', correct_indices: [0, 1], question: 'Earthquakes and volcanoes.' })).toBeNull()
    expect(unanswerableReason({ type: 'mcq', options: ['a', 'b', 'c', 'd'], question: 'The capital of France.' })).toBeNull()
  })

  it('leaves a real multi-mark written answer alone', () => {
    expect(unanswerableReason({
      type: 'longform', marks: 3,
      question: 'State the medium. Explain why, in terms of particle spacing.',
      marking_criteria: ['a', 'b', 'c'],
    })).toBeNull()
  })
})

describe('dropping them', () => {
  it('removes only the unanswerable and says why', () => {
    const { kept, dropped } = dropUnanswerable([
      short('Name the gas produced.'),
      { type: 'longform', marks: 1, question: 'A train travels 150 km in 3 hours.' },
      short('Write down the vessel. Write down the cell.'),
    ])
    expect(kept).toHaveLength(1)
    expect(dropped).toHaveLength(2)
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, 'x', 42, [null]]) {
      expect(() => dropUnanswerable(junk as never)).not.toThrow()
    }
  })
})
