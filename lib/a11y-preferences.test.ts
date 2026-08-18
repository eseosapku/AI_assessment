import { describe, it, expect } from 'vitest'
import {
  normalizePreferences,
  preferenceAttributes,
  applyPreferences,
  DEFAULT_PREFERENCES,
} from './a11y-preferences'

describe('normalizePreferences', () => {
  it('defaults everything off', () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES)
  })

  it('only accepts a literal true, so a truthy string cannot switch things on', () => {
    expect(normalizePreferences({ highContrast: 'yes', largeText: 1 })).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({ highContrast: true }).highContrast).toBe(true)
  })

  it('survives corrupt storage', () => {
    for (const bad of ['string', 42, [], undefined]) {
      expect(normalizePreferences(bad)).toEqual(DEFAULT_PREFERENCES)
    }
  })

  it('ignores prototype-polluting keys', () => {
    const hostile = JSON.parse('{"__proto__":{"highContrast":true}}')
    expect(normalizePreferences(hostile).highContrast).toBe(false)
    expect(({} as Record<string, unknown>).highContrast).toBeUndefined()
  })
})

describe('preferenceAttributes', () => {
  it('emits nothing when everything is default', () => {
    // An attribute-free root means the stylesheet's normal path, not an
    // "off" variant that has to be maintained separately.
    const attrs = preferenceAttributes(DEFAULT_PREFERENCES)
    expect(Object.values(attrs).every((v) => v === null)).toBe(true)
  })

  it('names each preference distinctly', () => {
    const attrs = preferenceAttributes({ highContrast: true, largeText: true, reducedMotion: true })
    expect(attrs['data-a11y-contrast']).toBe('high')
    expect(attrs['data-a11y-text']).toBe('large')
    expect(attrs['data-a11y-motion']).toBe('reduced')
  })
})

describe('applyPreferences', () => {
  it('sets and then clears attributes as preferences change', () => {
    const attrs: Record<string, string> = {}
    const root = {
      setAttribute(k: string, v: string) { attrs[k] = v },
      removeAttribute(k: string) { delete attrs[k] },
    } as unknown as HTMLElement

    applyPreferences({ highContrast: true, largeText: false, reducedMotion: true }, root)
    expect(attrs).toEqual({
      'data-a11y-contrast': 'high',
      'data-a11y-motion': 'reduced',
    })

    // Turning a preference off must remove the attribute, not set it to "false".
    applyPreferences(DEFAULT_PREFERENCES, root)
    expect(attrs).toEqual({})
  })
})
