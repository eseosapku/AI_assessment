import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-22-practice-mobile-fold', () => {
  it('uses compact cards before the mobile breakpoint', () => {
    const source = readFileSync('components/studio/PracticeHub.tsx', 'utf8')
    expect(source).toContain('h-20 overflow-hidden sm:h-28')
    expect(source).toContain('p-4 sm:p-5')
  })
})
