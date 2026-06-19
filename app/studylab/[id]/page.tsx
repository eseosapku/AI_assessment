'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import Workspace from '@/components/studylab/Workspace'

export default function LearnSpacePage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  if (isLoading || !user || !id) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-apple-gray dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
      </div>
    )
  }

  return <Workspace id={id} />
}
