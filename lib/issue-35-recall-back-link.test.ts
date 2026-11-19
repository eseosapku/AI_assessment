import { describe, expect, it } from 'vitest'
import { showHomeTour } from './product-tour'

describe('issue-35-recall-back-link', () => {
  it('does not cover the Recall review back link with the home tour', () => {
    expect(showHomeTour('/recall/review')).toBe(false)
  })
})
