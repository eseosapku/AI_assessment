import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-23-mobile-nav-labels', () => {
  it('gives every mobile destination its own bounded grid cell', () => {
    const source = readFileSync('components/studio/SideNav.tsx', 'utf8')
    expect(source).toContain('grid grid-cols-6')
    expect(source).toContain('w-full truncate text-center')
  })
})
