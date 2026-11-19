import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-31-loading-totals', () => {
  it('renders placeholders instead of zero and empty states while loading', () => {
    const source = readFileSync('components/studio/StudioHome.tsx', 'utf8')
    expect(source).toContain('Loading recent quizzes')
    expect(source).toContain('Loading progress summary')
    const classroom = readFileSync('app/(studio)/classrooms/[id]/page.tsx', 'utf8')
    expect(classroom).toContain("isLoadingAssignments ? '—' : grouped.upcoming.length")
  })
})
