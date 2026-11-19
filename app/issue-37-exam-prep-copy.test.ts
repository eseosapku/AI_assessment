import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('issue-37-exam-prep-copy', () => {
  it('only promises national exams where they are offered', () => {
    const source = readFileSync('app/(studio)/exam-prep/page.tsx', 'utf8')
    expect(source).toContain("user.country === 'NG'")
    expect(source).toContain('Cambridge Checkpoint paper under real exam conditions')
  })
})
