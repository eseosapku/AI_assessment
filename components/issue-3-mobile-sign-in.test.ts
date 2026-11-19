import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-3-mobile-sign-in', () => {
  it('keeps sign-in visible in both the mobile header and signup dialog header', () => {
    const landing = readFileSync(join(process.cwd(), 'components/LandingPage.tsx'), 'utf8')
    const modal = readFileSync(join(process.cwd(), 'components/AuthModal.tsx'), 'utf8')

    expect(landing).toContain('data-testid="mobile-sign-in"')
    expect(landing).not.toMatch(/data-testid="mobile-sign-in"[^>]*className="[^"]*hidden/)
    expect(modal).toContain('data-testid="signup-modal-sign-in"')
  })
})
