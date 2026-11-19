import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-21-studylab-demo', () => {
  it('routes the retired demo URL to StudyLab instead of requesting lesson id "demo"', () => {
    const page = readFileSync(join(process.cwd(), 'app/studylab/demo/page.tsx'), 'utf8')

    expect(page).toContain("redirect('/studylab')")
  })
})
