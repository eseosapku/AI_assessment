'use client'

import CompleteProfileForm from '@/components/CompleteProfileForm'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'

export default function CompleteProfilePage() {
  return (
    <main className="studio-surface relative flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="text-sm font-bold text-brand-slate hover:text-brand-ink">
          ← Home
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <CompleteProfileForm />
      </div>
    </main>
  )
}
