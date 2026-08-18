'use client'

import { useCallback, useEffect, useState } from 'react'
type DashboardUser = {
  id: string
  name: string
  email: string | null
  role: 'student' | 'teacher'
  country?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PausedAssessmentState = {
  assessment: {
    subject: string
    topics: string[]
    questions: { id?: number }[]
    estimated_time: number
  }
  currentQuestion: number
  timeRemaining: number
  pausedAt: string
}

export const PAUSED_ASSESSMENT_KEY = 'pausedAssessmentState'

function isUuid(value: string | null | undefined) {
  return UUID_RE.test(String(value ?? ''))
}

export function useStudentDashboard(user: DashboardUser | null) {
  const [recentAssessments, setRecentAssessments] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, avgScore: 0 })
  const [subjectAverages, setSubjectAverages] = useState<{ subject: string; avg: number; count: number; sources?: string[] }[]>([])
  const [dailyUsed, setDailyUsed] = useState(0)
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pausedAssessment, setPausedAssessment] = useState<PausedAssessmentState | null>(null)

  const refreshClassrooms = useCallback(async () => {
    if (!user?.id && !user?.email) return
    try {
      const params = new URLSearchParams()
      if (isUuid(user?.id)) params.set('student_id', user?.id ?? '')
      if (user?.email) params.set('student_email', user.email)
      const res = await fetch(`/api/classrooms?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classrooms')
      setClassrooms(json.data ?? [])
    } catch {
      setClassrooms([])
    }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user?.id || !isUuid(user.id)) {
      setRecentAssessments([])
      setStats({ total: 0, avgScore: 0 })
      setSubjectAverages([])
      setDailyUsed(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/student?user_id=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      if (res.ok) {
        setRecentAssessments(json.data?.recentAssessments ?? [])
        setStats(json.data?.stats ?? { total: 0, avgScore: 0 })
        setSubjectAverages(json.data?.subjectAverages ?? [])
        setDailyUsed(json.data?.dailyUsed ?? 0)
      }
    } finally {
      setLoading(false)
    }
    await refreshClassrooms()
  }, [user, refreshClassrooms])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const loadPaused = () => {
      try {
        const raw = localStorage.getItem(PAUSED_ASSESSMENT_KEY)
        if (!raw) {
          setPausedAssessment(null)
          return
        }
        const parsed = JSON.parse(raw) as PausedAssessmentState
        if (!parsed?.assessment?.subject) {
          setPausedAssessment(null)
          return
        }
        setPausedAssessment(parsed)
      } catch {
        setPausedAssessment(null)
      }
    }
    loadPaused()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PAUSED_ASSESSMENT_KEY) loadPaused()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const discardPaused = () => {
    localStorage.removeItem(PAUSED_ASSESSMENT_KEY)
    setPausedAssessment(null)
  }

  return {
    recentAssessments,
    stats,
    subjectAverages,
    dailyUsed,
    classrooms,
    loading,
    pausedAssessment,
    refresh,
    discardPaused,
  }
}
