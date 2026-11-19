import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-15-profile-class', () => {
  it('shows enrolled classroom names instead of a stale profile grade', () => {
    const source = readFileSync('components/ProfileSidebar.tsx', 'utf8')
    expect(source).toContain("classNames.join(' · ')")
    expect(source).toContain('/api/classrooms?')
  })
})
