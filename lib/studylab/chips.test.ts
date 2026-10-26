// lib/studylab/chips.test.ts
import { describe, it, expect } from 'vitest'
import { chipAction, COMPREHENSION_CHIPS } from './chips'

describe('chipAction', () => {
  it('moves on when it made sense', () => {
    expect(chipAction(COMPREHENSION_CHIPS[0])).toBe('advance')
  })
  it('asks what is unclear when it did not, before explaining again', () => {
    expect(chipAction(COMPREHENSION_CHIPS[1])).toBe('diagnose')
  })
  it('reads the two however they arrive', () => {
    expect(chipAction('  makes sense ')).toBe('advance')
    expect(chipAction('NOT REALLY')).toBe('diagnose')
  })
  it('asks anything else as a question -- a diagnosis chip names the point to explain', () => {
    expect(chipAction('The tiles')).toBe('ask')
    expect(chipAction('How they make 7x')).toBe('ask')
    expect(chipAction('Makes sense, but why?')).toBe('ask')
  })
})
