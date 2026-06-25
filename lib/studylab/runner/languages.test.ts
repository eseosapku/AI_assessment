import { describe, it, expect } from 'vitest'
import { normalizeLanguage, isRunnable } from '@/lib/studylab/runner/languages'

describe('normalizeLanguage', () => {
  it('maps web aliases', () => {
    expect(normalizeLanguage('html')).toBe('web')
    expect(normalizeLanguage('css')).toBe('web')
    expect(normalizeLanguage('web')).toBe('web')
  })
  it('maps javascript aliases (incl. ts)', () => {
    expect(normalizeLanguage('js')).toBe('javascript')
    expect(normalizeLanguage('javascript')).toBe('javascript')
    expect(normalizeLanguage('ts')).toBe('javascript')
    expect(normalizeLanguage('typescript')).toBe('javascript')
  })
  it('maps python aliases', () => {
    expect(normalizeLanguage('py')).toBe('python')
    expect(normalizeLanguage('python')).toBe('python')
  })
  it('is case- and whitespace-insensitive', () => {
    expect(normalizeLanguage('  Python ')).toBe('python')
  })
  it('returns null for unknown or missing', () => {
    expect(normalizeLanguage('rust')).toBeNull()
    expect(normalizeLanguage(undefined)).toBeNull()
    expect(normalizeLanguage('')).toBeNull()
  })
  it('isRunnable reflects normalizeLanguage', () => {
    expect(isRunnable('python')).toBe(true)
    expect(isRunnable('rust')).toBe(false)
    expect(isRunnable(undefined)).toBe(false)
  })
})
