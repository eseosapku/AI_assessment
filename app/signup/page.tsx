'use client'

import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import SignupForm from '@/components/SignupForm'
import { AuthStoryPanel } from '@/components/AuthStoryPanel'

export default function SignupPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthStoryPanel
        title="Start studying smarter today."
        marker="smarter"
        body="Your first assessments are free — quizzes, interactive sets, and instant AI feedback for students and teachers."
      />

      <section className="studio-surface relative flex flex-col">
        <div className="relative flex items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="text-sm font-bold text-brand-slate transition-colors hover:text-brand-ink"
          >
            ← Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-2 sm:px-10">
          <SignupForm />
        </div>
      </section>
    </main>
  )
}
