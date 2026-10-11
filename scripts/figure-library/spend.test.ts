// scripts/figure-library/spend.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { openStore } from './store'
import { BudgetExceeded, assertBudget, capUsd, checkBudget, costUsd, recordSpend, totalSpend } from './spend'

const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
afterEach(() => { delete process.env.FIGURE_LIBRARY_CAP_USD })

describe('what a model call costs', () => {
  it('prices Haiku on its EU profile', () => {
    expect(costUsd(HAIKU, 1_000_000, 100_000)).toBeCloseTo(1.65, 6)
  })
  it('refuses to guess the price of a model it has no price for', () => {
    expect(() => costUsd('some-new-model', 1, 1)).toThrow(/No price/)
  })
})

describe('the $600 cap', () => {
  it('can be lowered by the environment but never raised', () => {
    expect(capUsd()).toBe(600)
    process.env.FIGURE_LIBRARY_CAP_USD = '100'
    expect(capUsd()).toBe(100)
    process.env.FIGURE_LIBRARY_CAP_USD = '900'
    expect(capUsd()).toBe(600)
  })

  it('refuses a job whose estimate would pass the library cap or its own', () => {
    const db = openStore(':memory:')
    recordSpend(db, { job: 'earlier', model: HAIKU, inputTokens: 1_000_000, outputTokens: 0 }) // $1.10
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 1, jobCapUsd: 34, cap: 2 })).toThrow(BudgetExceeded)
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 35, jobCapUsd: 34, cap: 600 })).toThrow(BudgetExceeded)
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 10, jobCapUsd: 34, cap: 600 })).not.toThrow()
  })

  it('stops a job the moment it has crossed its cap', () => {
    const db = openStore(':memory:')
    recordSpend(db, { job: 'p0-map', model: HAIKU, inputTokens: 0, outputTokens: 1_000_000 }) // $5.50
    expect(totalSpend(db, 'p0-map')).toBeCloseTo(5.5, 6)
    expect(() => checkBudget(db, { job: 'p0-map', jobCapUsd: 5 })).toThrow(BudgetExceeded)
    expect(() => checkBudget(db, { job: 'p0-map', jobCapUsd: 6 })).not.toThrow()
  })
})
