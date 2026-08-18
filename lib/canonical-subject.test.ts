import { describe, it, expect } from 'vitest'
import { canonicalSubject, groupBySubject } from './canonical-subject'

/** Every input here is a real value from the live database. */
describe('canonicalSubject', () => {
  it('merges the level and edition variants of one subject', () => {
    for (const v of ['Biology S5 SB  ', 'Biology S6 Student Book ', 'Biology S4  SB', 'Biology']) {
      expect(canonicalSubject(v), v).toBe('Biology')
    }
    for (const v of ['S1 Physics SB', 'Physics Learners book S2', 'S6 Physics  SB ']) {
      expect(canonicalSubject(v), v).toBe('Physics')
    }
    for (const v of ['Entrepreneurship S4_SB', 'Entrepreneurship S5_SB', 'S3 Entrepreneurship SB']) {
      expect(canonicalSubject(v), v).toBe('Entrepreneurship')
    }
  })

  it('strips the publisher prefix that kept chemistry split in two', () => {
    // "GENERAL EDU-Chemistry-S3-SB" grouped separately from "Chemistry S6 SB",
    // so one subject appeared twice with different averages.
    expect(canonicalSubject('GENERAL EDU-Chemistry-S3-SB')).toBe('Chemistry')
    expect(canonicalSubject('GENERAL EDU-Chemistry-S2-SB (1)')).toBe('Chemistry')
    expect(canonicalSubject('Chemistry S6 SB')).toBe('Chemistry')
  })

  it('strips pupil-book markers, not just student-book ones', () => {
    expect(canonicalSubject('P1 Mathematics PB ,')).toBe('Mathematics')
    expect(canonicalSubject('P3 Mathematics PB')).toBe('Mathematics')
    expect(canonicalSubject('Mathematics-S1-SB')).toBe('Mathematics')
  })

  it('expands national codes into something a student reads as a subject', () => {
    expect(canonicalSubject('P4-SET-PB')).toBe('Science and Elementary Technology')
    expect(canonicalSubject('P1-SST-PB')).toBe('Social Studies')
    expect(canonicalSubject('AGRIC S2 SB')).toBe('Agriculture')
  })

  it('keeps capitalisation that is deliberate', () => {
    expect(canonicalSubject('ICT S5 Adapted SB')).toBe('ICT')
    expect(canonicalSubject('MicroPython with BBC micro:bit')).toBe('MicroPython with BBC micro:bit')
  })

  it('refuses to guess, returning something cleaned but unmerged', () => {
    // Merging two subjects wrongly corrupts progress invisibly, which is far
    // worse than leaving two entries that should have been one.
    expect(canonicalSubject('Branis_Sumba_RUZIVO_Abstract')).toBe('Branis Sumba RUZIVO Abstract')
    expect(canonicalSubject('How Vaccines Work')).toBe('How Vaccines Work')
  })

  it('never returns an empty name', () => {
    expect(canonicalSubject('')).toBe('Untitled')
    expect(canonicalSubject(null)).toBe('Untitled')
    expect(canonicalSubject('   ')).toBe('Untitled')
    // Nothing but markers still has to render as something.
    expect(canonicalSubject('S4 SB').length).toBeGreaterThan(0)
  })

  it('does not merge two genuinely different subjects', () => {
    expect(canonicalSubject('Biology S4 SB')).not.toBe(canonicalSubject('Chemistry S4 SB'))
    expect(canonicalSubject('English S6 SB')).not.toBe(canonicalSubject('Kinyarwanda S6 SB'))
  })
})

describe('groupBySubject', () => {
  it('groups the variants and remembers which raw values fed each group', () => {
    // The raw list is what anything writing back has to use — the display
    // name is not an identifier.
    const rows = [
      { subject: 'Biology S4  SB', score: 40 },
      { subject: 'Biology S5 SB  ', score: 60 },
      { subject: 'Chemistry S6 SB', score: 80 },
    ]
    const grouped = groupBySubject(rows, (r) => r.subject)
    expect([...grouped.keys()].sort()).toEqual(['Biology', 'Chemistry'])
    expect(grouped.get('Biology')!.rows).toHaveLength(2)
    expect(grouped.get('Biology')!.rawSubjects).toEqual(['Biology S4  SB', 'Biology S5 SB  '])
  })

  it('does not list the same raw value twice', () => {
    const rows = [{ s: 'Biology' }, { s: 'Biology' }]
    expect(groupBySubject(rows, (r) => r.s).get('Biology')!.rawSubjects).toEqual(['Biology'])
  })

  it('skips rows with no subject rather than inventing a group', () => {
    const grouped = groupBySubject([{ s: '' }, { s: null }], (r) => r.s)
    expect(grouped.size).toBe(0)
  })
})
