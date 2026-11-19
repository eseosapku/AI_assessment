import { describe, expect, it, vi } from 'vitest'

import { landingSectionIdFromHash, scrollToLandingHash } from './landing-navigation'

describe('issue-4-fresh-hash-scroll', () => {
  it.each(['#features', '#how', '#pricing', '#studylab'])('restores %s after hydration', (hash) => {
    const scrollIntoView = vi.fn()
    const getElementById = vi.fn(() => ({ scrollIntoView }))

    expect(scrollToLandingHash(hash, { getElementById } as unknown as Pick<Document, 'getElementById'>)).toBe(true)
    expect(getElementById).toHaveBeenCalledWith(landingSectionIdFromHash(hash))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('ignores unknown hashes', () => {
    expect(landingSectionIdFromHash('#not-a-section')).toBeNull()
  })
})
