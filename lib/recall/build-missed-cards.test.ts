import { describe, it, expect } from 'vitest'
import { buildMissedRecallCards } from './build-missed-cards'

const question = (extra: Record<string, unknown> = {}) =>
  ({ type: 'mcq', question: 'What is the dark dot?', options: ['Nucleus', 'Vacuole'], correct_answer: 0, explanation: 'It holds DNA.', ...extra })

describe('recall cards from missed questions', () => {
  it('keeps the figure of a missed question', () => {
    const [card] = buildMissedRecallCards([question({ image_url: '/fig.png' })], { 0: 1 }, 'Biology')
    expect(card).toMatchObject({ front: 'What is the dark dot?', back: 'Nucleus\n\nIt holds DNA.', front_image_url: '/fig.png' })
  })

  it("carries a real image's credit with it, as its licence requires wherever it is shown", () => {
    const credit = 'Onion cells by A, CC BY 4.0, via Wikimedia Commons'
    const [card] = buildMissedRecallCards([question({ image_url: '/fig.webp', image_credit: credit })], { 0: 1 }, 'Biology')
    expect(card.front_image_url).toBe('/fig.webp')
    expect(card.front).toBe(`What is the dark dot?\n\nImage: ${credit}`)
  })

  it('treats a blank as a miss, even when the key is option A', () => {
    const [blankA] = buildMissedRecallCards([question()], { 0: null }, 'Biology')
    const [blankB] = buildMissedRecallCards([question({ correct_answer: 1 })], { 0: null }, 'Biology')
    expect(blankA.back).toContain('Nucleus')
    expect(blankB.back).toContain('Vacuole')
    expect(buildMissedRecallCards([question()], { 0: '' }, 'Biology')).toHaveLength(1)
  })

  it('leaves out a credit with no image', () => {
    const [card] = buildMissedRecallCards([question({ image_credit: 'x' })], { 0: 1 }, 'Biology')
    expect(card.front).toBe('What is the dark dot?')
  })
})
