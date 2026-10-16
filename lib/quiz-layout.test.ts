import { describe, expect, it } from 'vitest'
import { hasSideContent, quizUsesWideLayout } from './quiz-layout'

describe('the quiz layout is chosen once for the whole quiz', () => {
  // The page used to switch from a narrow column to a wide two-column grid on every
  // question with a figure, so the Next button jumped sideways and up and down
  // between an image question and a text one.
  it('counts a figure, an inline diagram or a reading passage as side content', () => {
    expect(hasSideContent({ image_url: '/textbook-images/a.png' })).toBe(true)
    expect(hasSideContent({ diagram_svg: '<svg/>' })).toBe(true)
    expect(hasSideContent({ passage: 'Read the text.' })).toBe(true)
    expect(hasSideContent({ passage: '   ' })).toBe(false)
    expect(hasSideContent({ question: 'What is 2 + 2?' })).toBe(false)
  })

  it('is wide for every question when any question has side content, narrow otherwise', () => {
    expect(quizUsesWideLayout([{ question: 'a' }, { image_url: '/x.png' }, { question: 'b' }])).toBe(true)
    expect(quizUsesWideLayout([{ question: 'a' }, { question: 'b' }])).toBe(false)
    expect(quizUsesWideLayout([])).toBe(false)
  })
})
