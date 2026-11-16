import type { CSSProperties } from 'react'

/**
 * Which colour family a lesson belongs to.
 *
 * Every lesson's root sets `--subject`, `--subject-soft` and `--subject-ink`
 * from its family, and the things that mark progress in that lesson -- ticks,
 * path tiles, the focus glow, the primary button -- take that colour. The
 * chrome stays on the neutral `ss-*` tokens, so a maths lesson and a history
 * lesson feel related rather than like two different products.
 *
 * Colour is never the only carrier of meaning: right and wrong always come
 * with an icon and words, so a learner who cannot tell gold from green loses
 * nothing.
 */
export type FamilyName =
  | 'number' | 'matter' | 'life' | 'world' | 'code' | 'data' | 'words' | 'time' | 'craft'

interface Swatch {
  /** Marks and fills. At least 3:1 on its panel (WCAG 1.4.11). */
  accent: string
  /** Tinted backgrounds. Decorative, never text. */
  soft: string
  /** Text in the family colour. At least 4.5:1 on its panel (WCAG 1.4.3). */
  ink: string
}

export interface SubjectFamily {
  name: FamilyName
  label: string
  light: Swatch
  dark: Swatch
}

export const SUBJECT_FAMILIES: readonly SubjectFamily[] = [
  { name: 'number', label: 'Number', light: { accent: '#2563EB', soft: '#E8F0FE', ink: '#1E40AF' }, dark: { accent: '#60A5FA', soft: '#1E2A44', ink: '#BFDBFE' } },
  { name: 'matter', label: 'Matter', light: { accent: '#9A6412', soft: '#FDF3DC', ink: '#7A4E0A' }, dark: { accent: '#F6C35B', soft: '#3A2E14', ink: '#FDE7B0' } },
  { name: 'life', label: 'Life', light: { accent: '#0C7A6C', soft: '#E1F5F1', ink: '#0B5F55' }, dark: { accent: '#3FD1B8', soft: '#123A34', ink: '#B5F0E5' } },
  { name: 'world', label: 'World', light: { accent: '#2F855A', soft: '#E6F4EA', ink: '#1F5C3D' }, dark: { accent: '#68D391', soft: '#163423', ink: '#C6F6D5' } },
  { name: 'code', label: 'Code', light: { accent: '#7C3AED', soft: '#F1EAFE', ink: '#5B21B6' }, dark: { accent: '#B794F4', soft: '#2B1F45', ink: '#E9D8FD' } },
  { name: 'data', label: 'Data', light: { accent: '#C05621', soft: '#FDEDE2', ink: '#8A3A12' }, dark: { accent: '#F6AD55', soft: '#3B2614', ink: '#FEEBC8' } },
  { name: 'words', label: 'Words', light: { accent: '#C2185B', soft: '#FDE8EC', ink: '#880E4F' }, dark: { accent: '#F48FB1', soft: '#3D1A2A', ink: '#FBD5E5' } },
  { name: 'time', label: 'Time', light: { accent: '#4C51BF', soft: '#EBECFB', ink: '#363A8F' }, dark: { accent: '#A3BFFA', soft: '#22264A', ink: '#DCE4FD' } },
  { name: 'craft', label: 'Craft', light: { accent: '#4A5568', soft: '#EDF0F4', ink: '#2D3748' }, dark: { accent: '#A0AEC0', soft: '#252B35', ink: '#E2E8F0' } },
]

const BY_NAME = new Map(SUBJECT_FAMILIES.map((f) => [f.name, f]))

/**
 * Most specific first. "Computer Science" has to be read as code before the
 * generic "science" claims it for life, "Environmental Management" as world
 * before anything else, and "Physical Education" must not become physics --
 * hence the word boundaries.
 */
const RULES: readonly [RegExp, FamilyName][] = [
  [/\b(computer|computing|ict|programming|coding|information technology|digital)\b/, 'code'],
  [/\b(environmental|geography|geographical)\b/, 'world'],
  [/\b(social studies|history|civics|citizenship|government|politic\w*)\b/, 'time'],
  [/\b(econom\w*|business|accounting|commerce|entrepreneurship|data|finance)\b/, 'data'],
  [/\b(math\w*|statistics|algebra|geometry|calculus|arithmetic|numeracy)\b/, 'number'],
  [/\b(physics|chemistry|chemical)\b/, 'matter'],
  [/\b(biology|science|sciences|agriculture|health)\b/, 'life'],
  [/\b(english|french|german|spanish|portuguese|arabic|chinese|mandarin|latin|hindi|italian|japanese|luganda|kinyarwanda|swahili|kiswahili|literature|language|languages|reading|writing|grammar)\b/, 'words'],
]

export function familyFor(subjectOrTitle: string | null | undefined): SubjectFamily {
  const text = (subjectOrTitle ?? '').toLowerCase().replace(/_/g, ' ')
  for (const [pattern, name] of RULES) {
    if (pattern.test(text)) return BY_NAME.get(name)!
  }
  return BY_NAME.get('craft')!
}

/**
 * The custom properties for a lesson root. Light values go on the plain names;
 * `.dark .ss-lesson` in globals.css swaps them for the `-dark` ones.
 */
export function subjectStyle(subjectOrTitle: string | null | undefined): CSSProperties {
  const f = familyFor(subjectOrTitle)
  return {
    '--subject': f.light.accent,
    '--subject-soft': f.light.soft,
    '--subject-ink': f.light.ink,
    '--subject-dark': f.dark.accent,
    '--subject-soft-dark': f.dark.soft,
    '--subject-ink-dark': f.dark.ink,
  } as CSSProperties
}
