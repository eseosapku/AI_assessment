import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-11-tablet-header', () => {
  it('uses compact navigation spacing at the 768px breakpoint', () => {
    const source = readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')
    expect(source).toContain('gap-4 md:flex lg:gap-8')
  })
})
