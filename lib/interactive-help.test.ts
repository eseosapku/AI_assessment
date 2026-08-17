import { describe, it, expect } from 'vitest'
import { helpFor, isFirstEncounter } from './interactive-help'

const KINDS = ['match', 'order', 'categorize', 'fill_blank', 'true_false', 'multi_select', 'odd_one_out']

describe('helpFor', () => {
  it('covers every interactive question type the player can render', () => {
    // A type with no help is one a student meets with no instructions at all,
    // which is the bug this exists to fix.
    for (const kind of KINDS) {
      const help = helpFor(kind)
      expect(help, `${kind} has no help`).not.toBeNull()
      expect(help!.hint.length).toBeGreaterThan(10)
      expect(help!.steps.length).toBeGreaterThanOrEqual(3)
      expect(help!.title.length).toBeGreaterThan(0)
    }
  })

  it('names the first physical action in the hint, not the concept', () => {
    // "Tap a term…" beats "This question tests matching".
    expect(helpFor('match')!.hint.toLowerCase()).toContain('tap')
    expect(helpFor('categorize')!.hint.toLowerCase()).toContain('tap')
    expect(helpFor('order')!.hint.toLowerCase()).toMatch(/arrow|up and down/)
  })

  it('warns that multi-select takes more than one answer', () => {
    // The single most common misunderstanding of that type.
    expect(helpFor('multi_select')!.hint.toLowerCase()).toMatch(/more than one|all that apply/)
  })

  it('returns null for an unknown kind', () => {
    expect(helpFor('nonsense')).toBeNull()
    expect(helpFor('')).toBeNull()
    expect(helpFor(null)).toBeNull()
  })

  it('does not resolve prototype keys as help', () => {
    // `kind` comes from model-authored question data.
    expect(helpFor('constructor')).toBeNull()
    expect(helpFor('__proto__')).toBeNull()
    expect(helpFor('toString')).toBeNull()
  })
})

describe('isFirstEncounter', () => {
  it('is true the first time and false once seen', () => {
    expect(isFirstEncounter('match', [])).toBe(true)
    expect(isFirstEncounter('match', ['match'])).toBe(false)
  })

  it('tracks each type separately', () => {
    expect(isFirstEncounter('order', ['match'])).toBe(true)
  })

  it('is false for a kind with no help to show', () => {
    expect(isFirstEncounter('nonsense', [])).toBe(false)
  })
})
