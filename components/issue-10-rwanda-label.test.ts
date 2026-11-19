import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-10-rwanda-label', () => {
  it('uses readable country names in the native signup select', () => {
    const source = readFileSync(join(process.cwd(), 'components/SignupForm.tsx'), 'utf8')
    expect(source).toContain('{c.name}</option>')
    expect(source).not.toContain('{c.flag} {c.name}</option>')
  })
})
