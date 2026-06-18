'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Target } from 'lucide-react'
import Link from 'next/link'
import ExamPrepForm from '@/components/ExamPrepForm'
import { useAuth } from '@/components/AuthProvider'
import { COUNTRIES } from '@/lib/countries'

export default function ExamPrepPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
    if (!isLoading && user && user.country !== 'NG') router.push('/')
  }, [user, isLoading, router])

  if (isLoading || !user || user.country !== 'NG') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] dark:bg-[#0C0C0E]">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E]">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur border-b border-gray-200/60 dark:border-white/5">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            <h1 className="font-bold text-gray-900 dark:text-white">Exam Prep</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              {COUNTRIES.NG.flag} Nigeria
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">WAEC &amp; JAMB</p>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">Dedicated exam practice</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl">
            Separate from school assessments. Questions follow official WASSCE and JAMB UTME syllabuses,
            with optional practice from synced past-question banks by year and subject.
          </p>
        </motion.div>
        <ExamPrepForm />
      </main>
    </div>
  )
}
