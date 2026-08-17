'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
          <h1 className="mt-2 text-[30px] font-extrabold tracking-tight">WAEC &amp; JAMB prep</h1>
          <p className="mt-2 text-sm font-semibold text-white/85">Past-paper style practice for Nigerian exams {COUNTRIES.NG.flag}</p>
        </div>
      </section>
      <ExamPrepForm />
    </div>
  )
}
