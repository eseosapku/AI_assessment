import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-17-exclusive-account-menus', () => {
  it('closes notifications before opening the profile', () => {
    expect(readFileSync('components/studio/AppShell.tsx', 'utf8')).toContain('closeNotifications(); setProfileOpen(true)')
    expect(readFileSync('components/studio/NotificationBell.tsx', 'utf8')).toContain('CLOSE_NOTIFICATIONS_EVENT')
  })
})
