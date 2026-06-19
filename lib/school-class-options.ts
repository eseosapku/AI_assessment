import { getCurriculumBySlug } from '@/lib/curriculum-registry'

export type SchoolClassRow = {
  id: number
  name: string
  curricula: number[]
}

export type SchoolClassOption = SchoolClassRow & {
  grade: number | null
  label: string
}

/** Canonical Cambridge grades — global, not tied to any country. Names match DB class rows. */
export const CAMBRIDGE_GRADE_NAMES = [
  'Grade1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const

const CAMBRIDGE_STAGE_LABELS: Record<number, string> = {
  1: 'Primary Stage 1',
  2: 'Primary Stage 2',
  3: 'Primary Stage 3',
  4: 'Primary Stage 4',
  5: 'Primary Stage 5',
  6: 'Primary Stage 6',
  7: 'Lower Secondary Year 7',
  8: 'Lower Secondary Year 8',
  9: 'Lower Secondary Year 9',
  10: 'IGCSE Year 10',
  11: 'IGCSE Year 11',
  12: 'AS Level Year 12',
}

export function deriveGradeFromClassName(className: string): number | null {
  const name = String(className ?? '').trim()
  if (!name) return null

  const gradeMatch = name.match(/\bgrade\s*(\d{1,2})\b/i) || name.match(/^grade(\d{1,2})$/i)
  if (gradeMatch) {
    const n = Number(gradeMatch[1])
    return Number.isFinite(n) ? n : null
  }

  const nigeria = name.match(/^(P|JSS|SS)(\d)$/i)
  if (nigeria) {
    const level = nigeria[1].toUpperCase()
    const num = Number(nigeria[2])
    if (level === 'P') return num
    if (level === 'JSS') return num + 6
    if (level === 'SS') return num + 9
  }

  const anyNum = name.match(/\b(\d{1,2})\b/)
  if (anyNum) {
    const n = Number(anyNum[1])
    return Number.isFinite(n) ? n : null
  }

  return null
}

export function formatClassLabel(
  className: string,
  grade: number | null,
  curriculumSlug: string,
): string {
  if (curriculumSlug === 'cambridge' && grade !== null) {
    const stage = CAMBRIDGE_STAGE_LABELS[grade]
    const display = className === 'Grade1' ? 'Grade 1' : className
    return stage ? `${display} — ${stage}` : display
  }

  if (curriculumSlug === 'nigeria') {
    const m = className.match(/^(P\d|JSS\d|SS\d)$/i)
    if (m) {
      if (className.startsWith('P')) return `Primary ${className.slice(1)}`
      if (className.startsWith('JSS')) return `Junior Secondary ${className.slice(3)}`
      if (className.startsWith('SS')) return `Senior Secondary ${className.slice(2)}`
    }
    return className
  }

  if (curriculumSlug !== 'rwanda' || grade === null) return className
  if (grade >= 1 && grade <= 6) return `Primary ${grade}`
  if (grade >= 7 && grade <= 12) return `Senior ${grade - 6}`
  return className
}

export function buildCambridgeClassOptions(): SchoolClassOption[] {
  return CAMBRIDGE_GRADE_NAMES.map((name, index) => {
    const grade = deriveGradeFromClassName(name)
    return {
      id: -(index + 1),
      name,
      curricula: [1],
      grade,
      label: formatClassLabel(name, grade, 'cambridge'),
    }
  })
}

export function buildClassOptionsForCurriculum(
  curriculumSlug: string,
  countryClasses: SchoolClassRow[],
): SchoolClassOption[] {
  if (curriculumSlug === 'cambridge') {
    return buildCambridgeClassOptions()
  }

  const numeric = getCurriculumBySlug(curriculumSlug)?.numeric
  const eligible = numeric == null
    ? countryClasses
    : countryClasses.filter(
        (cls) => cls.curricula.length === 0 || cls.curricula.includes(numeric),
      )

  return eligible
    .map((cls) => {
      const grade = deriveGradeFromClassName(cls.name)
      return {
        ...cls,
        grade,
        label: formatClassLabel(cls.name, grade, curriculumSlug),
      }
    })
    .sort((a, b) => {
      const aGrade = a.grade ?? Number.POSITIVE_INFINITY
      const bGrade = b.grade ?? Number.POSITIVE_INFINITY
      if (aGrade !== bGrade) return aGrade - bGrade
      return a.label.localeCompare(b.label)
    })
}
