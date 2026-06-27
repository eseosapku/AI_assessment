'use client'

import { useAuth } from '@/components/AuthProvider'
import StudioHome from '@/components/studio/StudioHome'
import TeacherDashboard from '@/components/TeacherDashboard'

export default function DashboardPage() {
  const { user } = useAuth()
  if (user?.role === 'teacher') return <TeacherDashboard />
  return <StudioHome />
}
