'use client'

import { useAuth } from '@/components/AuthProvider'
import Dashboard from '@/components/Dashboard'
import LandingPage from '@/components/LandingPage'

export default function Home() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#13a7df] mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading StudySquare…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return (
    <main className="min-h-screen">
      <Dashboard />
    </main>
  )
}
