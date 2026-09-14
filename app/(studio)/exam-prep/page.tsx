'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ExamPrepForm from '@/components/ExamPrepForm'
import { useAuth } from '@/components/AuthProvider'

export default function ExamPrepPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Signed in is the only requirement. Exam prep used to bounce anyone outside
  // Nigeria to the dashboard, because the only exams here were WAEC and JAMB.
  // Cambridge Checkpoint is sat in every country, so the page is everyone's —
  // the exam picker filters the national exams to whoever sits them instead.
  useEffect(() => {
    if (!isLoading && !user) router.push('/')
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/practice" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-ss-slate hover:text-ss-ink">
        <ArrowLeft className="h-4 w-4" /> Practice
      </Link>
      <section className="relative mb-8 overflow-hidden rounded-[24px] px-9 py-8 text-white" style={{ background: 'linear-gradient(115deg,#C77B16,#F0A93E 60%,#FFC777)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/exam.png" alt="" aria-hidden className="pointer-events-none absolute right-3 top-1/2 hidden h-[112%] -translate-y-1/2 object-contain opacity-95 sm:block" />
        <div className="relative">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/85">Practice</p>
          {/* Named for what the page now is. Exam prep is no longer Nigeria's
              alone — Cambridge Checkpoint is sat everywhere, and the national
              exams inside are filtered to the countries that sit them. */}
          <h1 className="mt-2 text-[30px] font-extrabold tracking-tight">Exam prep</h1>
          <p className="mt-2 text-sm font-semibold text-white/85">
            Sit a real paper under real conditions — Cambridge Checkpoint, and your national exams.
          </p>
        </div>
      </section>
      <ExamPrepForm />
    </div>
  )
}
