import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-9-homepage-blanks', () => {
  it('uses rendered blanks instead of the placeholder screenshot', () => {
    const source = readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')
    expect(source).not.toContain('/hero/q-fillgaps.png')
    expect(source).toContain('Fill in the gaps')
    expect(source).toContain('border-b-2')
  })
})
