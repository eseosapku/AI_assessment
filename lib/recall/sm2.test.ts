import { describe, expect, it } from 'vitest'
import { initialCardState, scheduleReview } from './sm2'

describe('scheduling a review from a database row', () => {
  it('keeps a numeric ease factor when the column came back as text', () => {
    const next = scheduleReview(
      { ease_factor: '2.50' as unknown as number, interval_days: 6, repetitions: 2, due_at: '2026-01-10T00:00:00.000Z' },
      3,
      new Date('2026-01-10T00:00:00Z'),
    )
    expect(next.ease_factor).toBe(2.5)
    expect(Number.isNaN(next.ease_factor)).toBe(false)
  })

  it('pushes an easy card further out than the same card rated again', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const once = scheduleReview(initialCardState(now), 4, now)
    const twice = scheduleReview(once, 4, now)
    expect(twice.interval_days).toBeGreaterThan(6)
  })

  it('does not give Almost, Got it and Too easy the same next day', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    const base = { ease_factor: 2.22, interval_days: 6, repetitions: 2, due_at: now.toISOString() }
    const days = [2, 3, 4].map((rating) => scheduleReview(base, rating as 2 | 3 | 4, now).interval_days)
    expect(new Set(days).size).toBe(3)
  })

  it('does not wear a remembered card down to the floor', () => {
    let state = initialCardState(new Date('2026-01-01T00:00:00Z'))
    for (let i = 0; i < 10; i++) state = scheduleReview(state, 3, new Date('2026-01-01T00:00:00Z'))
    expect(state.ease_factor).toBeGreaterThan(1.3)
  })
})
