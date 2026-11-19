import { describe, expect, it } from 'vitest'

import { landingAuthModeFromSearch } from './landing-navigation'

describe('issue-12-login-opens-form', () => {
  it('recognises the login request used by the /login redirect', () => {
    expect(landingAuthModeFromSearch('?auth=login')).toBe('login')
    expect(landingAuthModeFromSearch('?auth=signup')).toBe('signup')
    expect(landingAuthModeFromSearch('?auth=other')).toBeNull()
  })
})
