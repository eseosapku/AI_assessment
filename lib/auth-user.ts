import { normalizeCountry, type CountryCode } from '@/lib/countries'
import { normalizeGender, type Gender } from '@/lib/gender'

export function defaultSubjectsFor(country: CountryCode, role: string): string[] {
  if (role === 'teacher') return []
  if (country === 'NG') {
    return ['English Studies', 'Mathematics', 'Basic Science', 'Social Studies', 'Digital Technologies']
  }
  if (country === 'RW') {
    return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
  }
  return ['Mathematics', 'English', 'Biology', 'Chemistry', 'Physics']
}

/** Shared client-facing user shape returned by auth API routes. */
export type AuthUser = {
  id: string
  name: string
  email: string | null
  studentId: string | null
  class: string
  subjects: string[]
  role: 'student' | 'teacher'
  country: CountryCode
  educationLevel?: 'school' | 'university'
  universityCourse?: string | null
  universityYear?: number | null
  avatarUrl?: string | null
  /** null means never asked -- that is what triggers the one-time prompt. */
  gender: Gender | null
  profileComplete: boolean
  authProvider?: string
}

export function mapAuthUser(row: Record<string, unknown>): AuthUser {
  const role = (row.role as string) === 'teacher' ? 'teacher' : 'student'
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: row.email == null ? null : String(row.email),
    studentId: row.student_id == null ? null : String(row.student_id),
    class: String(row.class ?? ''),
    subjects: Array.isArray(row.subjects) ? (row.subjects as string[]) : [],
    role,
    country: normalizeCountry(row.country),
    educationLevel: row.education_level === 'university' ? 'university' : 'school',
    universityCourse: (row.university_course as string | null | undefined) ?? null,
    universityYear: (row.university_year as number | null | undefined) ?? null,
    avatarUrl: (row.avatar_url as string | null | undefined) ?? null,
    // Missing column (pre-migration) reads as null, i.e. not asked yet.
    gender: normalizeGender(row.gender),
    // Missing column (pre-migration) ⇒ treat as complete so existing users keep working.
    profileComplete: row.profile_complete !== false && row.profile_complete !== 'f',
    authProvider: row.auth_provider == null ? undefined : String(row.auth_provider),
  }
}
