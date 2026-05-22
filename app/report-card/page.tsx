'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ReportCardGenerator from '@/components/ReportCardGenerator'
import { useAppRouter } from '@/components/AppPathProvider'

export default function ReportCardPage() {
  const { user, isLoading } = useAuth()
  const router = useAppRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading Brain Ink...</p>
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
