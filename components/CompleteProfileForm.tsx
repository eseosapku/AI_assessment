'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, ChevronDown, GraduationCap, BookOpen, Globe, Building2, School } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { COUNTRY_LIST, COUNTRY_GROUP_LABELS, classOptionsForCountry, countrySignupHint, type CountryCode } from '@/lib/countries'
import { getUniversityCourseNames, getUniversityYearsForCourse, getUniversityYearLabel } from '@/lib/university-curriculum'

const inputBase =
  'w-full pl-11 pr-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] focus:border-[#13a7df] dark:focus:border-[#13a7df] focus:ring-2 focus:ring-[#13a7df]/20 outline-none transition-all text-slate-900 dark:text-white placeholder:text-ss-slate dark:placeholder:text-ss-slate'

export default function CompleteProfileForm() {
  const { user, isLoading: authLoading, completeProfile } = useAuth()
  const router = useRouter()
  const [role, setRole] = useState<'student' | 'teacher'>(user?.role === 'teacher' ? 'teacher' : 'student')
  const [name, setName] = useState(user?.name ?? '')
  const [className, setClassName] = useState(user?.class && user.class !== 'Pending' ? user.class : '')
  const [country, setCountry] = useState<CountryCode>(user?.country ?? 'RW')
  const [educationLevel, setEducationLevel] = useState<'school' | 'university'>(
    user?.educationLevel === 'university' ? 'university' : 'school',
  )
  const [uniCourse, setUniCourse] = useState(user?.universityCourse ?? '')
  const [uniYear, setUniYear] = useState<number | ''>(user?.universityYear ?? '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const classOptions = classOptionsForCountry(country)
  const internationalCountries = COUNTRY_LIST.filter((c) => c.group === 'international')
  const africanCountries = COUNTRY_LIST.filter((c) => c.group === 'africa')
  const isUni = role === 'student' && educationLevel === 'university'
  const uniCourses = getUniversityCourseNames()
  const uniYears = uniCourse ? getUniversityYearsForCourse(uniCourse) : []

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/')
      return
    }
    if (user.profileComplete !== false) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isUni && (!uniCourse || !uniYear)) {
      setError('Select your course and year of study')
      return
    }
    if (role === 'student' && !isUni && !className) {
      setError('Please select a class / grade')
      return
    }
    setIsSubmitting(true)
    try {
      await completeProfile({
        name,
        role,
        country,
        className: role === 'teacher' ? 'Teacher' : isUni ? `${uniCourse} · Year ${uniYear}` : className,
        educationLevel: isUni ? 'university' : 'school',
        universityCourse: isUni ? uniCourse : undefined,
        universityYear: isUni ? Number(uniYear) : undefined,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || !user || user.profileComplete !== false) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Finish your profile
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Signed in as <strong>{user.email}</strong>. Tell us who you are so we can set up your classroom.
      </p>

      <div className="mt-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">I am a</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
              role === 'student'
                ? 'border-[#13a7df] bg-[#13a7df]/10 text-[#0c86ce]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/[0.08]'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Student
          </button>
          <button
            type="button"
            onClick={() => setRole('teacher')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
              role === 'teacher'
                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/[0.08]'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Teacher
          </button>
        </div>
      </div>

      {role === 'student' && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Studying at</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEducationLevel('school')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                educationLevel === 'school'
                  ? 'border-[#13a7df] bg-[#13a7df]/10 text-[#0c86ce]'
                  : 'border-slate-200 text-slate-600 dark:border-white/[0.08]'
              }`}
            >
              <School className="h-4 w-4" /> School
            </button>
            <button
              type="button"
              onClick={() => setEducationLevel('university')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                educationLevel === 'university'
                  ? 'border-[#13a7df] bg-[#13a7df]/10 text-[#0c86ce]'
                  : 'border-slate-200 text-slate-600 dark:border-white/[0.08]'
              }`}
            >
              <Building2 className="h-4 w-4" /> University
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Full name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputBase}
            />
          </div>
        </div>

        {isUni ? (
          <>
            <div>
              <label htmlFor="uniCourse" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Course
              </label>
              <div className="relative">
                <BookOpen className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  id="uniCourse"
                  value={uniCourse}
                  onChange={(e) => {
                    setUniCourse(e.target.value)
                    setUniYear('')
                  }}
                  className={`${inputBase} appearance-none pr-10`}
                >
                  <option value="" disabled>
                    Select your course
                  </option>
                  {uniCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            {uniCourse && (
              <div>
                <label htmlFor="uniYear" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Year of study
                </label>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="uniYear"
                    value={uniYear}
                    onChange={(e) => setUniYear(Number(e.target.value))}
                    className={`${inputBase} appearance-none pr-10`}
                  >
                    <option value="" disabled>
                      Select your year
                    </option>
                    {uniYears.map((y) => (
                      <option key={y} value={y}>
                        {getUniversityYearLabel(uniCourse, y)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <label htmlFor="country" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Country / curriculum region
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                id="country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value as CountryCode)
                  setClassName('')
                }}
                className={`${inputBase} appearance-none pr-10`}
              >
                <optgroup label={COUNTRY_GROUP_LABELS.international}>
                  {internationalCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={COUNTRY_GROUP_LABELS.africa}>
                  {africanCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <p className="mt-2 text-[12px] text-slate-500">{countrySignupHint(country)}</p>
          </div>
        )}

        {role === 'student' && !isUni && (
          <div>
            <label htmlFor="className" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Class / Grade
            </label>
            <div className="relative">
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#13a7df] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white"
              >
                <option value="" disabled>
                  Select your class
                </option>
                {classOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </motion.div>
  )
}
