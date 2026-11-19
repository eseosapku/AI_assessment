import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-6-celebration-asset', () => {
  it('references a celebration asset that exists', () => {
    expect(existsSync(join(process.cwd(), 'public/art/celebration.svg'))).toBe(true)
    expect(readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')).toContain('/art/celebration.svg')
  })
})
