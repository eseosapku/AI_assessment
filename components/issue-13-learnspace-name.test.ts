import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-13-learnspace-name', () => {
  it('uses LearnSpace in the public lesson section and CTA', () => {
    const source = readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')
    expect(source).toContain("LearnSpace isn&apos;t a chatbot")
    expect(source).toContain('Try LearnSpace free')
    expect(source).not.toContain('Try StudyLab free')
  })
})
