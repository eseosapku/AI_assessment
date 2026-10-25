import { describe, it, expect } from 'vitest'
import { familyFor, subjectStyle, SUBJECT_FAMILIES } from './subjectFamily'

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('subject families', () => {
  it.each([
    ['Mathematics', 'number'], ['Further Mathematics', 'number'], ['Statistics', 'number'],
    ['Physics', 'matter'], ['Chemistry', 'matter'],
    ['Biology', 'life'], ['Integrated Science', 'life'], ['Primary Science', 'life'],
    ['Geography', 'world'], ['Environmental Management', 'world'],
    ['Computer Science', 'code'], ['ICT', 'code'], ['Computing', 'code'],
    ['Economics', 'data'], ['Business Studies', 'data'], ['Accounting', 'data'],
    ['English Language', 'words'], ['Kinyarwanda', 'words'], ['French', 'words'],
    ['History', 'time'], ['Social Studies', 'time'], ['Civics', 'time'],
    ['Art and Design', 'craft'],
  ])('reads %s as the %s family', (subject, family) => {
    expect(familyFor(subject).name).toBe(family)
  })

  it('falls back to craft when there is no subject', () => {
    expect(familyFor(null).name).toBe('craft')
    expect(familyFor('').name).toBe('craft')
    expect(familyFor(undefined).name).toBe('craft')
  })

  it('keeps every accent readable on its own panel, in light and dark', () => {
    for (const f of SUBJECT_FAMILIES) {
      expect(contrastRatio(f.light.accent, '#FFFFFF'), `${f.name} light`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(f.dark.accent, '#161B21'), `${f.name} dark`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(f.light.ink, '#FFFFFF'), `${f.name} light ink`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(f.dark.ink, '#161B21'), `${f.name} dark ink`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('hands the lesson root its custom properties for both themes', () => {
    const style = subjectStyle('Physics') as Record<string, string>
    const matter = familyFor('Physics')
    expect(style['--subject']).toBe(matter.light.accent)
    expect(style['--subject-soft']).toBe(matter.light.soft)
    expect(style['--subject-ink']).toBe(matter.light.ink)
    expect(style['--subject-dark']).toBe(matter.dark.accent)
    expect(style['--subject-soft-dark']).toBe(matter.dark.soft)
    expect(style['--subject-ink-dark']).toBe(matter.dark.ink)
  })
})
