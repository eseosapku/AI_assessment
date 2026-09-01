'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { apiUrl } from '@/lib/api-url'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to send verification code')
      }

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    const resetHref = `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass dark:glass-dark rounded-apple p-8 sm:p-10">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Check your email</h1>
            <p className="text-sm text-apple-dark-gray">
              If an account exists for <strong>{email}</strong>, we sent a 6-digit code from
              braininkedu@gmail.com. It expires in 15 minutes.
            </p>
          </div>

          <Link href={resetHref} className="block w-full btn-primary text-center mb-4">
            Enter verification code
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-apple-blue hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="glass dark:glass-dark rounded-apple p-8 sm:p-10">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-gradient-to-br from-apple-blue to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Mail className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Forgot password?</h1>
          <p className="text-sm text-apple-dark-gray">
            Enter your email and we&apos;ll send you a 6-digit verification code
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-apple-dark-gray" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
                autoComplete="email"
                className="w-full pl-12 pr-4 py-3 rounded-apple bg-apple-gray dark:bg-gray-800 border-2 border-transparent focus:border-apple-blue outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-apple bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            >
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send verification code'}
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-apple-blue hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
