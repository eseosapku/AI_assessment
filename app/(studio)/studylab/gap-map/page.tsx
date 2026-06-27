'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const GapMap = dynamic(() => import('@/components/studylab/GapMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-ss-accent" />
    </div>
  ),
})

export default function GapMapStudioPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <GapMap
      embedded
      userId={user.id}
      userClass={user.class ?? null}
      userCountry={user.country ?? 'RW'}
    />
  )
}
