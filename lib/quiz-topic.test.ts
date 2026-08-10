import { describe, it, expect } from 'vitest'
import {
  normalizeTopic,
  isUsableTopic,
  normalizeNotes,
  isUsableNotes,
  sanitizeScope,
  buildTopicsPayload,
  buildScopePrompt,
  TOPIC_MAX_LENGTH,
  MAX_FOCUS_AREAS,
  FOCUS_AREA_MAX_LENGTH,
  NOTES_MIN_LENGTH,
} from './quiz-topic'

describe('normalizeTopic', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeTopic('  the   french\n revolution ')).toBe('the french revolution')
  })

  it('clips to the maximum length', () => {
    expect(normalizeTopic('a'.repeat(500))).toHaveLength(TOPIC_MAX_LENGTH)
  })

  it('survives non-string input rather than throwing', () => {
    expect(normalizeTopic(null)).toBe('')
    expect(normalizeTopic(undefined)).toBe('')
    expect(normalizeTopic(42)).toBe('42')
    expect(normalizeTopic({})).toBe('[object Object]')
  })
})

describe('isUsableTopic', () => {
  it('accepts ordinary topics', () => {
    expect(isUsableTopic('photosynthesis')).toBe(true)
    expect(isUsableTopic('WW2')).toBe(true)
  })

  it('accepts non-Latin scripts', () => {
    // \p{L} rather than [a-z]: a Kinyarwanda, Arabic or Chinese topic is valid.
    expect(isUsableTopic('光合作用')).toBe(true)
  })

  it('rejects empty, too-short and letterless input', () => {
    expect(isUsableTopic('')).toBe(false)
    expect(isUsableTopic('   ')).toBe(false)
    expect(isUsableTopic('a')).toBe(false)
    expect(isUsableTopic('...')).toBe(false)
    expect(isUsableTopic('123')).toBe(false)
  })
})

describe('notes', () => {
  it('requires enough substance to write questions from', () => {
    expect(isUsableNotes('too short')).toBe(false)
    expect(isUsableNotes('x'.repeat(NOTES_MIN_LENGTH))).toBe(true)
  })

  it('clips very long pastes', () => {
    expect(normalizeNotes('x'.repeat(50000)).length).toBeLessThanOrEqual(20000)
  })
})

describe('sanitizeScope', () => {
  const wellFormed = {
    subject: 'History',
    topic: 'The French Revolution',
    focusAreas: ['Causes', 'The Estates-General', 'The Terror'],
    teachable: true,
  }

  it('passes a well-formed response through', () => {
    const s = sanitizeScope(wellFormed, 'french revolution')
    expect(s.subject).toBe('History')
    expect(s.topic).toBe('The French Revolution')
    expect(s.focusAreas).toEqual(['Causes', 'The Estates-General', 'The Terror'])
    expect(s.teachable).toBe(true)
  })

  it('backfills the topic from the fallback when the model omits it', () => {
    const s = sanitizeScope({ focusAreas: [] }, 'french revolution')
    expect(s.topic).toBe('french revolution')
    expect(s.subject).toBe('General knowledge')
  })

  it('degrades to an empty focus list rather than throwing on garbage', () => {
    // A scope with no focus areas is still a working (broader) quiz.
    for (const bad of [null, undefined, 'a string', 42, [], { focusAreas: 'nope' }]) {
      const s = sanitizeScope(bad, 'algebra')
      expect(s.focusAreas).toEqual([])
      expect(s.topic).toBe('algebra')
    }
  })

  it('drops list markers the model leaves inside the strings', () => {
    const s = sanitizeScope({ focusAreas: ['1. Causes', '- The Terror', '• Legacy'] }, 'x')
    expect(s.focusAreas).toEqual(['Causes', 'The Terror', 'Legacy'])
  })

  it('dedupes case-insensitively and drops unusable entries', () => {
    const s = sanitizeScope({ focusAreas: ['Causes', 'causes', '', '   ', '...', 7, null] }, 'x')
    expect(s.focusAreas).toEqual(['Causes'])
  })

  it('caps the number and length of focus areas', () => {
    const s = sanitizeScope(
      { focusAreas: Array.from({ length: 30 }, (_, i) => `Area number ${i}`) },
      'x',
    )
    expect(s.focusAreas).toHaveLength(MAX_FOCUS_AREAS)

    const long = sanitizeScope({ focusAreas: ['b'.repeat(300)] }, 'x')
    expect(long.focusAreas[0]).toHaveLength(FOCUS_AREA_MAX_LENGTH)
  })

  it('treats a missing teachable flag as teachable', () => {
    // Absence of an answer is not a rejection.
    expect(sanitizeScope({}, 'x').teachable).toBe(true)
    expect(sanitizeScope({ teachable: false }, 'x').teachable).toBe(false)
    expect(sanitizeScope({ teachable: 'no' }, 'x').teachable).toBe(true)
  })

  it('ignores prototype-polluting keys in the model response', () => {
    const hostile = JSON.parse('{"__proto__":{"topic":"pwned"},"focusAreas":[]}')
    const s = sanitizeScope(hostile, 'safe')
    expect(s.topic).toBe('safe')
    expect(({} as Record<string, unknown>).topic).toBeUndefined()
  })
})

describe('buildTopicsPayload', () => {
  const scope = sanitizeScope(
    { subject: 'Biology', topic: 'Photosynthesis', focusAreas: ['Light reactions', 'Calvin cycle'] },
    'photosynthesis',
  )

  it('uses the selected focus areas', () => {
    expect(buildTopicsPayload(scope, ['Light reactions'])).toEqual(['Light reactions'])
  })

  it('falls back to the topic so the payload is never empty', () => {
    // The generator 400s on a request with no topics at all.
    expect(buildTopicsPayload(scope, [])).toEqual(['Photosynthesis'])
  })

  it('drops blank selections before deciding it is empty', () => {
    expect(buildTopicsPayload(scope, ['', '   '])).toEqual(['Photosynthesis'])
  })

  it('caps the payload', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Area ${i}`)
    expect(buildTopicsPayload(scope, many)).toHaveLength(MAX_FOCUS_AREAS)
  })
})

describe('buildScopePrompt', () => {
  it('embeds the topic and asks for bare JSON', () => {
    const p = buildScopePrompt('the french revolution')
    expect(p).toContain('the french revolution')
    expect(p).toContain('ONLY a JSON object')
    expect(p).toContain('focusAreas')
  })
})
