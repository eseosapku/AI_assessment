'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import ReportCardGenerator from '@/components/ReportCardGenerator'

export default function ReportCardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="studio-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-ss-accent" />
          <p className="font-medium text-ss-slate">Loading your report card…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen">
      <ReportCardGenerator />
    </main>
  )
}
