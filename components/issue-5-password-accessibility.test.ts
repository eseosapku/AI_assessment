import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-5-password-accessibility', () => {
  it.each(['LoginForm.tsx', 'SignupForm.tsx'])('%s names password reveal controls and gives them a 44px target', (file) => {
    const source = readFileSync(join(process.cwd(), 'components', file), 'utf8')
    expect(source).toContain("'Show password'")
    expect(source).toContain('h-11 w-11')
  })
})
