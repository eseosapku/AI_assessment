import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-2-exam-prep-anchor', () => {
  it('links Exam prep to its own section', () => {
    const source = readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')
    expect(source).toContain("['Exam prep', '#exam-prep']")
    expect(source).toContain('id="exam-prep"')
  })
})
