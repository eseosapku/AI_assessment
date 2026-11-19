import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildNotifications } from './studio/notifications'

describe('issue-16-first-practice-notification', () => {
  it('does not call an experienced learner a first-time learner', () => {
    const items = buildNotifications({ recentAssessments: [{ id: '1', subject: 'Biology', date: new Date().toISOString(), grade: 'A', score: 90 }] })
    expect(items.some((item) => item.title === 'Start your first practice')).toBe(false)
    expect(readFileSync('lib/hooks/useNotifications.ts', 'utf8')).toContain('loading ? []')
  })
})
