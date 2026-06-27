'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import LandingPage from '@/components/LandingPage'
import { resolvePostAuthPath } from '@/lib/onboarding'

export default function Home() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !user) return
    resolvePostAuthPath(user).then((path) => router.replace(path))
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <main className="studio-surface flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </main>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return (
    <main className="studio-surface flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
    </main>
  )
}
