import { describe, it, expect } from 'vitest'
import {
  REPORT_REASONS,
  isValidReason,
  normalizeDetail,
  validateReport,
  questionSnapshot,
  DETAIL_MAX_LENGTH,
} from './question-report'

describe('REPORT_REASONS', () => {
  it('covers the faults this product actually produces', () => {
    // Each of these was a real defect found in a generated paper.
    const ids = REPORT_REASONS.map((r) => r.id)
    expect(ids).toContain('wrong_answer')
    expect(ids).toContain('irrelevant_image')
    expect(ids).toContain('duplicate')
    expect(ids).toContain('grading')
  })

  it('leads with the complaint that most damages trust', () => {
    expect(REPORT_REASONS[0].id).toBe('wrong_answer')
  })

  it('is written in the student\'s words, not ours', () => {
    for (const r of REPORT_REASONS) {
      expect(r.label.length).toBeGreaterThan(8)
      expect(r.label).not.toMatch(/invalid|malformed|error/i)
    }
  })
})

describe('isValidReason', () => {
  it('accepts known reasons and rejects anything else', () => {
    expect(isValidReason('wrong_answer')).toBe(true)
    expect(isValidReason('nonsense')).toBe(false)
    expect(isValidReason('')).toBe(false)
    expect(isValidReason(null)).toBe(false)
    expect(isValidReason(42)).toBe(false)
  })

  it('does not accept prototype keys', () => {
    expect(isValidReason('constructor')).toBe(false)
    expect(isValidReason('__proto__')).toBe(false)
  })
})

describe('normalizeDetail', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeDetail('  too   many\n spaces ')).toBe('too many spaces')
  })

  it('caps the length', () => {
    expect(normalizeDetail('x'.repeat(5000))).toHaveLength(DETAIL_MAX_LENGTH)
  })

  it('survives non-string input', () => {
    expect(normalizeDetail(null)).toBe('')
    expect(normalizeDetail(undefined)).toBe('')
  })
})

describe('validateReport', () => {
  it('accepts a well-formed report', () => {
    expect(validateReport({ reason: 'wrong_answer', questionIndex: 0 }).ok).toBe(true)
  })

  it('requires a reason', () => {
    expect(validateReport({ questionIndex: 0 }).ok).toBe(false)
    expect(validateReport({ reason: 'made_up', questionIndex: 0 }).ok).toBe(false)
  })

  it('requires a resolvable question', () => {
    expect(validateReport({ reason: 'confusing', questionIndex: -1 }).ok).toBe(false)
    expect(validateReport({ reason: 'confusing', questionIndex: 'x' }).ok).toBe(false)
    expect(validateReport({ reason: 'confusing' }).ok).toBe(false)
  })

  it('demands detail only for "something else"', () => {
    // Every other reason describes itself; making a student justify a clear
    // complaint is friction for no gain.
    expect(validateReport({ reason: 'other', questionIndex: 1 }).ok).toBe(false)
    expect(validateReport({ reason: 'other', questionIndex: 1, detail: 'The units are wrong' }).ok).toBe(true)
    expect(validateReport({ reason: 'duplicate', questionIndex: 1 }).ok).toBe(true)
  })

  it('returns a message a student can act on', () => {
    const v = validateReport({ questionIndex: 0 })
    expect(v.error).toBeTruthy()
    expect(v.error).not.toMatch(/undefined|null|invalid input/i)
  })
})

describe('questionSnapshot', () => {
  it('keeps what a reviewer reads and drops the rest', () => {
    const snap = questionSnapshot({
      question: 'Which shape?',
      options: ['A', 'B'],
      correct_answer: 0,
      explanation: 'Because.',
      image_url: '/x.png',
      passage: 'a very long passage that would bloat every row',
      figureGroup: { startIndex: 0, endIndex: 2 },
    })
    expect(snap).toMatchObject({ question: 'Which shape?', correct_answer: 0, image_url: '/x.png' })
    expect(snap).not.toHaveProperty('passage')
    expect(snap).not.toHaveProperty('figureGroup')
  })

  it('returns null for nothing usable', () => {
    expect(questionSnapshot(null)).toBeNull()
    expect(questionSnapshot('string')).toBeNull()
    expect(questionSnapshot({})).toBeNull()
  })
})
