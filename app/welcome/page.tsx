'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import WelcomeFlow from '@/components/studio/WelcomeFlow'
import { useAuth } from '@/components/AuthProvider'
import { fetchOnboardingStatus } from '@/lib/onboarding'

export default function WelcomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role === 'teacher') {
      router.replace('/dashboard')
      return
    }
    fetchOnboardingStatus(user.id).then(done => {
      if (done) router.replace('/dashboard')
    })
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-ss-canvas">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
      </main>
    )
  }

  return <WelcomeFlow />
}
