'use client'

import { useAuth } from '@/components/AuthProvider'
import ProgressStudio from '@/components/studio/ProgressStudio'
import Link from 'next/link'

export default function ProgressPage() {
  const { user } = useAuth()
  if (user?.role === 'teacher') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-display text-2xl font-black text-brand-ink">Teacher insights</p>
        <p className="mt-2 text-sm font-semibold text-brand-slate">
          Assignment analytics live on each classroom. Head to your dashboard or manage classes.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-black text-brand-blue underline">
          Back to dashboard
        </Link>
      </div>
    )
  }
  return <ProgressStudio />
}
