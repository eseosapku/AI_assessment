'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import SettingsForm from '@/components/SettingsForm'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/components/AuthProvider'
import { Wordmark } from '@/components/Brand'

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const isTeacher = user?.role === 'teacher'

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [isLoading, user, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
      </div>
    )
  }

  if (isTeacher) {
    return (
      <main className="studio-surface min-h-screen">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/dashboard" className="studio-focus rounded-full">
              <Wordmark />
            </Link>
            <ThemeToggle />
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-blue">Settings</p>
            <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.04em]">Profile & security</h1>
          </motion.div>
          <div className="mt-10">
            <SettingsForm />
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-ss-accent">Settings</p>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-tight text-ss-ink">Profile &amp; security</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-ss-slate">
          Update your profile and password. Your student ID stays your primary identifier.
        </p>
      </div>
      <SettingsForm />
    </div>
  )
}
