'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from './AuthProvider'

const inputClass =
  'w-full rounded-xl border-2 border-black/[0.06] bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#0E8FD1] focus:ring-2 focus:ring-[#0E8FD1]/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500'

export default function LoginForm({
  embedded = false,
  onSwitchToSignup,
}: {
  embedded?: boolean
  onSwitchToSignup?: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(identifier, password)
    } catch {
      setError('Invalid email, student ID, or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={embedded ? 'w-full' : 'w-full max-w-sm'}
    >
      {!embedded && (
        <>
          <h1 className="font-display text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Sign in to continue your learning journey.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit} className={embedded ? 'mt-2 space-y-4' : 'mt-8 space-y-4'}>
        <div>
          <label
            htmlFor="identifier"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400"
          >
            Email or Student ID
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or STD-2024-0001"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400"
            >
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-[#0c86ce] hover:underline dark:text-[#37b6f0]">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Signing in…
            </span>
          ) : (
            <>
              Sign In <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        No account?{' '}
        {onSwitchToSignup ? (
          <button type="button" onClick={onSwitchToSignup} className="font-black text-[#0c86ce] dark:text-[#37b6f0] hover:underline">
            Sign up free
          </button>
        ) : (
          <Link href="/signup" className="font-black text-[#0c86ce] dark:text-[#37b6f0] hover:underline">
            Sign up free
          </Link>
        )}
      </p>
    </motion.div>
  )
}
