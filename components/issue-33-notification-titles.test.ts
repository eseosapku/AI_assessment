import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-33-notification-titles', () => {
  it('allows readable two-line notification titles', () => {
    const source = readFileSync('components/studio/NotificationBell.tsx', 'utf8')
    expect(source).toContain('line-clamp-2 text-[13px]')
    expect(source).not.toContain('block truncate text-[13px]')
  })
})
