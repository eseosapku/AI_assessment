'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, User, ChevronDown, ArrowRight, GraduationCap, BookOpen, Globe } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { COUNTRY_LIST, COUNTRY_GROUP_LABELS, classOptionsForCountry, countrySignupHint, type CountryCode } from '@/lib/countries'

const inputBase =
  'w-full pl-11 pr-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] focus:border-[#13a7df] dark:focus:border-[#13a7df] focus:ring-2 focus:ring-[#13a7df]/20 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-600'

const Field = ({ id, label, icon: Icon, children }: { id: string; label: string; icon: any; children: React.ReactNode }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {children}
    </div>
  </div>
)

export default function SignupForm() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [className, setClassName] = useState('')
  const [country, setCountry] = useState<CountryCode>('RW')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signup } = useAuth()
  const classOptions = classOptionsForCountry(country)
  const internationalCountries = COUNTRY_LIST.filter((c) => c.group === 'international')
  const africanCountries = COUNTRY_LIST.filter((c) => c.group === 'africa')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() && !studentId.trim()) {
      setError('Provide an email or student ID.')
      return
    }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (role === 'student' && !className) { setError('Please select a class / grade'); return }
    setIsLoading(true)
    try {
      await signup(
        name,
        email.trim() ? email.trim() : null,
        studentId.trim() ? studentId.trim() : null,
        password,
        role === 'student' ? className : 'Teacher',
        role,
        country
      )
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm"
    >
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Start your AI-powered learning journey — free.
      </p>

      {/* Role toggle */}
      <div className="mt-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">I am a</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${role === 'student'
              ? 'border-[#13a7df] bg-[#13a7df]/10 text-[#0c86ce] dark:text-cyan-300'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:text-gray-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.03]'
              }`}
          >
            <GraduationCap className="h-4 w-4 flex-shrink-0" />
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole('teacher')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${role === 'teacher'
              ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:text-gray-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.03]'
              }`}
          >
            <BookOpen className="h-4 w-4 flex-shrink-0" />
            Teacher
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field id="name" label="Full name" icon={User}>
          <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Alex Johnson" required className={inputBase} />
        </Field>

        <Field id="email" label="Email (optional)" icon={Mail}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputBase}
          />
        </Field>

        <Field id="studentId" label="Student ID (optional)" icon={GraduationCap}>
          <input
            id="studentId"
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="e.g. STD-2024-0001"
            className={inputBase}
          />
        </Field>

        <p className="text-[11px] text-slate-400">
          Provide an email or student ID. Students without email can use their school ID.
        </p>

        <Field id="country" label="Country / curriculum region" icon={Globe}>
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
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </optgroup>
            <optgroup label={COUNTRY_GROUP_LABELS.africa}>
              {africanCountries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </Field>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 -mt-2">
          {countrySignupHint(country)}
        </p>

        {/* Class select — students only */}
        {role === 'student' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label htmlFor="className" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
              Class / Grade
            </label>
            <div className="relative">
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                id="className"
                value={className}
                onChange={e => setClassName(e.target.value)}
                required={role === 'student'}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-[#13a7df] focus:ring-2 focus:ring-[#13a7df]/20 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white dark:focus:border-[#13a7df]"
              >
                <option value="" disabled>Select your class</option>
                {classOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {country === 'RW' && (
                  <>
                    <option value="College Freshman">College Freshman</option>
                    <option value="College Sophomore">College Sophomore</option>
                    <option value="College Junior">College Junior</option>
                    <option value="College Senior">College Senior</option>
                  </>
                )}
              </select>
            </div>
          </motion.div>
        )}

        <Field id="password" label="Password" icon={Lock}>
          <input id="password" type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required
            className={`${inputBase} pr-11`} />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-gray-300">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        <Field id="confirmPassword" label="Confirm password" icon={Lock}>
          <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required
            className={`${inputBase} pr-11`} />
          <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-gray-300">
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-60 ${role === 'teacher'
            ? 'bg-violet-600 shadow-violet-500/20 hover:bg-violet-700'
            : 'bg-gradient-to-r from-[#19b5e8] to-[#0c86ce] shadow-cyan-500/20 hover:shadow-cyan-500/35'
            }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Creating account…
            </span>
          ) : (
            <>Create {role === 'teacher' ? 'Teacher' : 'Student'} Account <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-[#0c86ce] hover:underline dark:text-[#37b6f0]">Sign in</Link>
      </p>
    </motion.div>
  )
}
