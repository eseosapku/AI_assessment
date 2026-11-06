import { describe, expect, it } from 'vitest'
import { longformContext } from './longform-context'

describe('marking an exam part with shared context', () => {
  it('supplies the setup and figure the student used to answer the part', () => {
    const context = longformContext({ scenario: 'A car travels 120 km in 2 hours.', image_alt: 'A distance-time graph.' })
    expect(context).toContain('120 km in 2 hours')
    expect(context).toContain('distance-time graph')
  })
  it('adds no invented context to a standalone practice answer', () => {
    expect(longformContext({})).toBe('')
  })
})
