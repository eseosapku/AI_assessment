'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const GapMap = dynamic(() => import('@/components/studylab/GapMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-apple-gray dark:bg-[#0a0a0a]">
      <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
    </div>
  ),
})

export default function GapMapPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-apple-gray dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
      </div>
    )
  }

  return <GapMap userId={user.id} userClass={user.class ?? null} userCountry={user.country ?? 'RW'} />
}
