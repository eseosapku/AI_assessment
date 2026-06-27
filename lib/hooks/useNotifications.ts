'use client'

import { useEffect, useMemo, useState } from 'react'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'
import { buildNotifications, getReadIds, markRead, NOTIF_EVENT, type AppNotification } from '@/lib/studio/notifications'

type NotifUser = {
  id: string
  name: string
  email: string | null
  role: 'student' | 'teacher'
  country?: string
} | null

export function useNotifications(user: NotifUser) {
  const { recentAssessments, classrooms } = useStudentDashboard(user)
  const items: AppNotification[] = useMemo(
    () => buildNotifications({ recentAssessments, classrooms }),
    [recentAssessments, classrooms],
  )

  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const sync = () => setReadIds(getReadIds(user?.id))
    sync()
    window.addEventListener(NOTIF_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(NOTIF_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])

  const unreadCount = useMemo(() => items.filter((i) => !readIds.has(i.id)).length, [items, readIds])

  return {
    items,
    readIds,
    unreadCount,
    markOne: (id: string) => user?.id && markRead(user.id, [id]),
    markAllRead: () => user?.id && markRead(user.id, items.map((i) => i.id)),
  }
}
