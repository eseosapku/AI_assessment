'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, User, ChevronDown, ArrowRight } from 'lucide-react'
import { useAuth } from './AuthProvider'

const inputBase = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600'

export default function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [className, setClassName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!className) { setError('Please select a class / grade'); return }
    setIsLoading(true)
    try {
      await signup(name, email, password, className)
    } catch {
      setError('Failed to create account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const Field = ({ id, label, icon: Icon, children }: { id: string; label: string; icon: any; children: React.ReactNode }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        {children}
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm"
    >
      {/* Brand */}
      <div className="flex justify-center mb-8">
        <Image src="/logo.png" alt="Brain Ink" width={180} height={102} className="h-14 w-auto object-contain" priority />
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl p-7 shadow-xl shadow-black/5 dark:shadow-black/30">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Create your account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start your AI-powered learning journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field id="name" label="Full name" icon={User}>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Alex Johnson" required className={inputBase} />
          </Field>

          <Field id="email" label="Email address" icon={Mail}>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required className={inputBase} />
          </Field>

          {/* Class select */}
          <div>
            <label htmlFor="className" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Class / Grade
            </label>
            <div className="relative">
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                id="className"
                value={className}
                onChange={e => setClassName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none text-gray-900 dark:text-white"
              >
                <option value="" disabled>Select your class</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
                <option value="College Freshman">College Freshman</option>
                <option value="College Sophomore">College Sophomore</option>
                <option value="College Junior">College Junior</option>
                <option value="College Senior">College Senior</option>
              </select>
            </div>
          </div>

          <Field id="password" label="Password" icon={Lock}>
            <input id="password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required
              className={`${inputBase} pr-10`} />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </Field>

          <Field id="confirmPassword" label="Confirm password" icon={Lock}>
            <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required
              className={`${inputBase} pr-10`} />
            <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </Field>

          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors mt-1 shadow-sm shadow-blue-900/20"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Creating account…
              </span>
            ) : (
              <>Create Account <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Sign in</Link>
      </p>
    </motion.div>
  )
}
