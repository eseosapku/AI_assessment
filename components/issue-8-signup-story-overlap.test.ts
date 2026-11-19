import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-8-signup-story-overlap', () => {
  it('hides the decorative classroom card at the audited 1440px width', () => {
    const source = readFileSync(join(process.cwd(), 'components/AuthStoryPanel.tsx'), 'utf8')
    expect(source).toMatch(/Classroom ready[\s\S]*?<\/StudioCard>/)
    expect(source).toContain('hidden w-72')
    expect(source).toContain('2xl:block')
  })
})
