import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-25-dashboard-text-layout', () => {
  it('does not truncate subject names and separates the next-step label', () => {
    expect(readFileSync('components/studio/ui/ProgressRow.tsx', 'utf8')).toContain('break-words')
    expect(readFileSync('components/studio/NextStepCard.tsx', 'utf8')).toContain("Do this next <span aria-hidden")
  })
})
