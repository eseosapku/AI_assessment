import type { CountryCode } from './countries'

export type CurriculumSlug =
  | 'rwanda'
  | 'cambridge'
  | 'nigeria'
  | 'waec'
  | 'jamb'

export interface CurriculumMeta {
  numeric: number
  slug: CurriculumSlug
  label: string
  shortLabel: string
  description: string
  badge: string
  authority: string
  countries: CountryCode[] | 'all'
  isExamPrep?: boolean
  schoolFlow?: boolean
}

/** textbooks.curriculum numeric codes */
export const CURRICULUM_REGISTRY: Record<number, CurriculumMeta> = {
  0: {
    numeric: 0,
    slug: 'rwanda',
    label: 'Rwanda National Curriculum (REB)',
    shortLabel: 'REB',
    description: 'Rwanda Education Board competence-based curriculum.',
    badge: 'RW',
    authority: 'Rwanda National Competence-Based Curriculum (REB)',
    countries: ['RW'],
    schoolFlow: true,
  },
  1: {
    numeric: 1,
    slug: 'cambridge',
    label: 'Cambridge International (CAIE)',
    shortLabel: 'Cambridge',
    description: 'Cambridge Assessment International Education.',
    badge: 'CAIE',
    authority: 'Cambridge Assessment International Education (CAIE)',
    countries: 'all',
    schoolFlow: true,
  },
  2: {
    numeric: 2,
    slug: 'nigeria',
    label: 'Nigerian National Curriculum (NERDC)',
    shortLabel: 'NERDC',
    description: 'Federal Ministry of Education / NERDC revised curriculum (2025/26).',
    badge: 'NG',
    authority: 'Nigerian Educational Research and Development Council (NERDC)',
    countries: ['NG'],
    schoolFlow: true,
  },
  3: {
    numeric: 3,
    slug: 'waec',
    label: 'WAEC WASSCE Exam Prep',
    shortLabel: 'WAEC',
    description: 'West African Senior School Certificate Examination preparation.',
    badge: 'WAEC',
    authority: 'West African Examinations Council (WAEC) WASSCE Syllabus',
    countries: ['NG'],
    isExamPrep: true,
    schoolFlow: false,
  },
  4: {
    numeric: 4,
    slug: 'jamb',
    label: 'JAMB UTME Exam Prep',
    shortLabel: 'JAMB',
    description: 'Joint Admissions and Matriculation Board UTME preparation.',
    badge: 'JAMB',
    authority: 'Joint Admissions and Matriculation Board (JAMB) UTME Syllabus (IBASS)',
    countries: ['NG'],
    isExamPrep: true,
    schoolFlow: false,
  },
}

export function getCurriculumMeta(numeric: number): CurriculumMeta | null {
  return CURRICULUM_REGISTRY[numeric] ?? null
}

export function getCurriculumBySlug(slug: string): CurriculumMeta | null {
  return Object.values(CURRICULUM_REGISTRY).find((c) => c.slug === slug) ?? null
}

export function curriculaForCountry(country: CountryCode, opts?: { schoolOnly?: boolean; examPrepOnly?: boolean }) {
  return Object.values(CURRICULUM_REGISTRY).filter((c) => {
    if (opts?.schoolOnly && !c.schoolFlow) return false
    if (opts?.examPrepOnly && !c.isExamPrep) return false
    if (c.countries === 'all') return true
    return c.countries.includes(country)
  })
}

export function authorityForCurriculum(slug: string): string {
  const meta = getCurriculumBySlug(slug)
  if (meta) return meta.authority
  if (slug === 'cambridge') return CURRICULUM_REGISTRY[1].authority
  if (slug === 'nigeria' || slug === 'waec' || slug === 'jamb') {
    return getCurriculumBySlug(slug)?.authority ?? 'Nigerian curriculum'
  }
  return CURRICULUM_REGISTRY[0].authority
}

export function slugFromNumeric(numeric: number | null | undefined): CurriculumSlug {
  if (numeric == null) return 'rwanda'
  return getCurriculumMeta(numeric)?.slug ?? 'rwanda'
}

/** textbooks.curriculum values for WAEC/JAMB — excluded from Learning Gap Map. */
export const EXAM_PREP_CURRICULUM_NUMBERS = [3, 4] as const

export function isExamPrepCurriculumNumeric(numeric: number | null | undefined): boolean {
  const n = Number(numeric)
  return EXAM_PREP_CURRICULUM_NUMBERS.includes(n as 3 | 4)
}

export function isExamPrepCurriculumSlug(slug: string): boolean {
  const s = String(slug ?? '').toLowerCase()
  return s === 'waec' || s === 'jamb'
}

export function curriculumShortLabel(curriculum?: number | null): string {
  const meta = getCurriculumMeta(Number(curriculum))
  if (meta) return meta.shortLabel
  if (curriculum === 1) return 'Cambridge'
  return 'REB'
}

/** Default generation curriculum slug for gap-map quizzes from a school textbook. */
export function slugForTextbookCurriculum(
  numeric: number | null | undefined,
  country: CountryCode = 'RW',
): CurriculumSlug {
  const slug = slugFromNumeric(numeric)
  if (isExamPrepCurriculumSlug(slug)) return country === 'NG' ? 'nigeria' : 'cambridge'
  return slug
}
