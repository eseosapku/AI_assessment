import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-32-topic-chip-collision', () => {
  it('reserves the illustration width in assessment headers', () => {
    expect(readFileSync('components/AssessmentCard.tsx', 'utf8')).toContain('max-w-[calc(100%-68px)] truncate')
  })
})
