import { describe, it, expect } from 'vitest'
import { pickPracticeCard } from './practice-card'

describe('pickPracticeCard', () => {
  it('finds the brackets card', () => expect(pickPracticeCard(['Expanding brackets'])?.engineId).toBe('area-grid'))
  it('finds it through another section', () => expect(pickPracticeCard(['Factorising', 'Expanding brackets', 'Algebra'])?.engineId).toBe('area-grid'))
  it('finds nothing rather than a guess', () => expect(pickPracticeCard(['Quadratic equations', 'Algebra'])).toBeNull())
  it('never gives chemistry to algebra', () => expect(pickPracticeCard(['Equations'])?.engineId).not.toBe('equation-balancer'))
  it('finds nothing for no match', () => expect(pickPracticeCard(['Kingdom of Buganda'])).toBeNull())
  it('wants the example to fit', () => {
    const card = pickPracticeCard(['Plant nutrition'])
    expect(card === null || /plant|nutrition/i.test(card.example.prompt)).toBe(true)
  })
  it('shares a word by its first five letters', () => {
    const card = pickPracticeCard(['Expanding brackets'])
    expect(card?.example.prompt).toMatch(/expand/i)
  })
})
