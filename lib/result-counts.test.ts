import { describe, it, expect } from 'vitest'
import { wasAutoSubmitted, wasUnanswered, countsTowardMastery, exclusionReason } from './result-counts'

describe('wasAutoSubmitted', () => {
  it('spots a proctor-ended paper', () => {
    expect(wasAutoSubmitted({ submission_reason: 'violation' })).toBe(true)
    expect(wasAutoSubmitted({ submission_reason: 'VIOLATION' })).toBe(true)
  })

  it('leaves a normal submission alone', () => {
    expect(wasAutoSubmitted({ submission_reason: 'manual' })).toBe(false)
    // Older rows predate the column.
    expect(wasAutoSubmitted({})).toBe(false)
  })
})

describe('wasUnanswered', () => {
  it('recognises every empty shape the column holds', () => {
    expect(wasUnanswered({ answers: null })).toBe(true)
    expect(wasUnanswered({})).toBe(true)
    expect(wasUnanswered({ answers: {} })).toBe(true)
    expect(wasUnanswered({ answers: [] })).toBe(true)
    expect(wasUnanswered({ answers: '{}' })).toBe(true)
    expect(wasUnanswered({ answers: 'null' })).toBe(true)
  })

  it('treats a single answer as answered', () => {
    expect(wasUnanswered({ answers: { 0: 2 } })).toBe(false)
    expect(wasUnanswered({ answers: [1] })).toBe(false)
  })
})

describe('countsTowardMastery', () => {
  it('counts an ordinary attempt, however badly it went', () => {
    // A genuine 0% earned by answering is real evidence and must still count.
    expect(countsTowardMastery({ submission_reason: 'manual', answers: { 0: 1 }, percentage: 0 })).toBe(true)
  })

  it('excludes a paper the proctor ended', () => {
    expect(countsTowardMastery({ submission_reason: 'violation', answers: { 0: 1 }, percentage: 20 })).toBe(false)
  })

  it('excludes a walk-away with nothing answered', () => {
    expect(countsTowardMastery({ submission_reason: 'manual', answers: {}, percentage: 0 })).toBe(false)
  })
})

describe('exclusionReason', () => {
  it('says why, in words a student can act on', () => {
    expect(exclusionReason({ submission_reason: 'violation' })).toMatch(/Ended early/)
    expect(exclusionReason({ answers: {} })).toMatch(/No answers/)
  })

  it('says nothing when the attempt counts', () => {
    expect(exclusionReason({ submission_reason: 'manual', answers: { 0: 1 } })).toBeNull()
  })
})
