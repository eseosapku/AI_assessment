import { describe, it, expect } from 'vitest'
import { subjectLabel, subjectLabelText } from './subject-label'

describe('subjectLabel', () => {
  it('strips the ingest noise from real stored values', () => {
    // Every one of these is in the live database.
    expect(subjectLabel('Advanced Mathematics S6 SB (1)')).toEqual({ name: 'Advanced Mathematics', level: 'S6' })
    expect(subjectLabel('Biology S4  SB')).toEqual({ name: 'Biology', level: 'S4' })
    expect(subjectLabel('Biology S6 Student Book ')).toEqual({ name: 'Biology', level: 'S6' })
    expect(subjectLabel('ICT S5 Adapted SB')).toEqual({ name: 'ICT', level: 'S5' })
    expect(subjectLabel('Mathematics-S1-SB')).toEqual({ name: 'Mathematics-', level: 'S1' })
  })

  it('turns filename separators into spaces', () => {
    // Case is left alone here: the string is mixed, and the only safe
    // title-casing rule is "the whole thing is shouting". That rule is what
    // keeps ICT and MicroPython intact.
    expect(subjectLabel('Branis_Sumba_RUZIVO_Abstract').name).toBe('Branis Sumba RUZIVO Abstract')
  })

  it('keeps the level rather than discarding it', () => {
    // A student taking Biology at two levels needs to tell them apart.
    expect(subjectLabel('Physics Learners book S2').level).toBe('S2')
    expect(subjectLabel('AGRIC S2 SB').level).toBe('S2')
  })

  it('leaves a clean subject untouched', () => {
    expect(subjectLabel('Biology')).toEqual({ name: 'Biology', level: undefined })
    expect(subjectLabel('English Language')).toEqual({ name: 'English Language', level: undefined })
  })

  it('does not lowercase names that are capitalised on purpose', () => {
    // ICT and MicroPython are written that way; only long shouting is fixed.
    expect(subjectLabel('ICT').name).toBe('ICT')
    expect(subjectLabel('MicroPython with BBC micro:bit').name).toBe('MicroPython with BBC micro:bit')
    expect(subjectLabel('AGRICULTURE').name).toBe('Agriculture')
  })

  it('never returns an empty label', () => {
    expect(subjectLabel('').name).toBe('Untitled')
    expect(subjectLabel(null).name).toBe('Untitled')
    expect(subjectLabel('   ').name).toBe('Untitled')
    // Nothing but noise still has to render as something.
    expect(subjectLabel('SB (1)').name.length).toBeGreaterThan(0)
  })

  it('collapses the double spaces the data is full of', () => {
    expect(subjectLabel('Biology   S2    SB').name).toBe('Biology')
  })
})

describe('subjectLabelText', () => {
  it('adds the level when there is room', () => {
    expect(subjectLabelText('Biology S4 SB')).toBe('Biology · S4')
  })

  it('drops the level rather than overflowing a narrow row', () => {
    // Truncation is what made the dashboard look broken; better to show a
    // complete name than a clipped one with a level on the end.
    expect(subjectLabelText('Advanced Mathematics S6 SB', 20)).toBe('Advanced Mathematics')
  })

  it('returns the name alone when no level was found', () => {
    expect(subjectLabelText('Biology')).toBe('Biology')
  })
})
