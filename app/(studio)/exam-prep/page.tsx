'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Target } from 'lucide-react'
import ExamPrepForm from '@/components/ExamPrepForm'
import { useAuth } from '@/components/AuthProvider'
import { COUNTRIES } from '@/lib/countries'

export default function ExamPrepPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) router.push('/')
    if (!isLoading && user && user.country !== 'NG') router.push('/dashboard')
  }, [user, isLoading, router])

  if (isLoading || !user || user.country !== 'NG') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <header className="mb-8">
        <Link
          href="/practice"
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-brand-slate hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Practice
        </Link>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-brand-blue" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue">Practice</p>
        </div>
        <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.04em] text-brand-ink">
          WAEC & JAMB prep
        </h1>
        <p className="mt-2 text-sm font-semibold text-brand-slate">
          Past-paper style practice for Nigerian exams {COUNTRIES.NG.flag}
        </p>
      </header>
      <ExamPrepForm />
    </div>
  )
}
