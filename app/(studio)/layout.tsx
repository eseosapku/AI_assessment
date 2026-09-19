'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import ProductShell from '@/components/studio/ProductShell'
import { useAuth } from '@/components/AuthProvider'
import { completeOnboarding } from '@/lib/onboarding'
import GenderPrompt from '@/components/GenderPrompt'

// Pages teachers should never land on. The classroom DETAIL (/classrooms/<id>)
// is shared (teachers manage, students view), so only the list is student-only.
const STUDENT_ONLY_PREFIX = ['/practice', '/progress', '/recall']
const STUDENT_ONLY_EXACT = ['/classrooms']

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.profileComplete === false) {
      router.replace('/complete-profile')
      return
    }
    const blockedForTeacher =
      STUDENT_ONLY_EXACT.includes(pathname) ||
      STUDENT_ONLY_PREFIX.some(p => pathname === p || pathname.startsWith(`${p}/`))
    if (user.role === 'teacher' && blockedForTeacher) {
      router.replace('/dashboard')
    }
    if (user.role !== 'teacher' && pathname !== '/welcome') {
      void completeOnboarding(user.id)
    }
  }, [isLoading, user, router, pathname])

  if (isLoading) {
    return (
      <main className="studio-surface flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </main>
    )
  }

  if (!user) return null

  if (user.role === 'teacher') {
    return <><GenderPrompt />{children}</>
  }

  return (
    <>
      <GenderPrompt />
      <ProductShell>{children}</ProductShell>
    </>
  )
}
