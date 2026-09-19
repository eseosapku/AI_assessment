// lib/gender.test.ts
import { describe, it, expect } from 'vitest'
import { GENDER_OPTIONS, normalizeGender, genderLabel, needsGenderPrompt } from './gender'

describe('the stored value', () => {
  it('keeps the four answers the form offers', () => {
    expect(GENDER_OPTIONS.map((o) => o.value)).toEqual([
      'female', 'male', 'other', 'prefer_not_to_say',
    ])
  })

  it('gives every option a label to show', () => {
    for (const o of GENDER_OPTIONS) expect(o.label.length).toBeGreaterThan(0)
  })

  it('accepts what the form sends', () => {
    for (const o of GENDER_OPTIONS) expect(normalizeGender(o.value)).toBe(o.value)
  })

  it('is forgiving about case and padding, because this arrives over HTTP', () => {
    expect(normalizeGender(' Female ')).toBe('female')
    expect(normalizeGender('MALE')).toBe('male')
  })

  it('refuses anything else rather than storing it', () => {
    // This value reaches a database column and a reporting figure. A typo that
    // is written through becomes a category nobody can query.
    for (const junk of ['', '  ', 'f', 'm', 'yes', 'null', 'undefined', '<script>', 42, null, undefined, {}, []]) {
      expect(normalizeGender(junk as unknown), String(junk)).toBeNull()
    }
  })
})

describe('who still has to be asked', () => {
  it('asks someone who has never answered', () => {
    expect(needsGenderPrompt({ gender: null })).toBe(true)
    expect(needsGenderPrompt({ gender: undefined })).toBe(true)
    expect(needsGenderPrompt({})).toBe(true)
  })

  it('never asks again once someone has answered', () => {
    for (const o of GENDER_OPTIONS) {
      expect(needsGenderPrompt({ gender: o.value }), o.value).toBe(false)
    }
  })

  it('treats "prefer not to say" as an answer, not as silence', () => {
    // The whole reason it is a stored value. If declining read as "no answer
    // yet", the prompt would reappear every session for exactly the people who
    // already said no — which is how a question becomes harassment.
    expect(needsGenderPrompt({ gender: 'prefer_not_to_say' })).toBe(false)
  })

  it('does not ask on the strength of a value it would refuse to store', () => {
    expect(needsGenderPrompt({ gender: 'banana' })).toBe(true)
  })

  it('survives being handed no user at all', () => {
    expect(needsGenderPrompt(null)).toBe(false)
    expect(needsGenderPrompt(undefined)).toBe(false)
  })
})

describe('showing it back', () => {
  it('labels a stored value', () => {
    expect(genderLabel('prefer_not_to_say')).toBe('Prefer not to say')
    expect(genderLabel('female')).toBe('Female')
  })

  it('says nothing for an unanswered or unknown value', () => {
    expect(genderLabel(null)).toBe('')
    expect(genderLabel('banana')).toBe('')
  })
})
