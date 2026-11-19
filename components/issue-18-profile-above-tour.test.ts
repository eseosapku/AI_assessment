import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-18-profile-above-tour', () => {
  it('keeps the profile close button above the tour overlay', () => {
    const source = readFileSync('components/ProfileSidebar.tsx', 'utf8')
    expect(source).toContain('z-[90]')
    expect(source).toContain('z-[89]')
  })
})
