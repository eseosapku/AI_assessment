import { describe, expect, it } from 'vitest'
import { showHomeTour } from './product-tour'

describe('issue-34-reports-progress-link', () => {
  it('does not place the dashboard tour overlay over Reports navigation', () => {
    expect(showHomeTour('/reports')).toBe(false)
    expect(showHomeTour('/progress')).toBe(false)
    expect(showHomeTour('/dashboard')).toBe(true)
  })
})
