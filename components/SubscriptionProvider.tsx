'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import SubscribeModal from '@/components/SubscribeModal'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { buildSubscriptionSnapshot } from '@/lib/subscription'

type PaywallReason = 'assessment' | 'study' | null

type SubscriptionContextValue = {
  snapshot: SubscriptionSnapshot
  loading: boolean
  refresh: () => Promise<SubscriptionSnapshot | null>
  openPaywall: (reason?: 'assessment' | 'study') => void
  closePaywall: () => void
  canGenerateAssessment: boolean
  canStartStudyPlan: boolean
  handlePaymentRequired: (reason: 'assessment' | 'study') => void
}

const defaultSnapshot = buildSubscriptionSnapshot(null)

const SubscriptionContext = createContext<SubscriptionContextValue>({
  snapshot: defaultSnapshot,
  loading: false,
  refresh: async () => null,
  openPaywall: () => {},
  closePaywall: () => {},
  canGenerateAssessment: true,
  canStartStudyPlan: true,
  handlePaymentRequired: () => {},
})

export function useSubscription() {
  return useContext(SubscriptionContext)
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(defaultSnapshot)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalReason, setModalReason] = useState<PaywallReason>(null)

  const refresh = useCallback(async (): Promise<SubscriptionSnapshot | null> => {
    if (!user?.id) {
      setSnapshot(defaultSnapshot)
      return null
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/subscription/status?user_id=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      if (res.ok && json?.data) {
        setSnapshot(json.data)
        return json.data as SubscriptionSnapshot
      }
      const fallback = buildSubscriptionSnapshot({ id: user.id, role: user.role })
      setSnapshot(fallback)
      return fallback
    } catch {
      const fallback = buildSubscriptionSnapshot({ id: user.id, role: user.role })
      setSnapshot(fallback)
      return fallback
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openPaywall = useCallback((reason: 'assessment' | 'study' = 'assessment') => {
    setModalReason(reason)
    setModalOpen(true)
  }, [])

  const closePaywall = useCallback(() => {
    setModalOpen(false)
    setModalReason(null)
  }, [])

  const handlePaymentRequired = useCallback(
    (reason: 'assessment' | 'study') => {
      openPaywall(reason)
    },
    [openPaywall],
  )

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      refresh,
      openPaywall,
      closePaywall,
      canGenerateAssessment: snapshot.canGenerateAssessment,
      canStartStudyPlan: snapshot.canStartStudyPlan,
      handlePaymentRequired,
    }),
    [snapshot, loading, refresh, openPaywall, closePaywall, handlePaymentRequired],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <SubscribeModal
        open={modalOpen}
        reason={modalReason ?? 'assessment'}
        snapshot={snapshot}
        userId={user?.id ?? null}
        userEmail={user?.email ?? null}
        userCountry={user?.country ?? null}
        onClose={closePaywall}
        onRefresh={refresh}
      />
    </SubscriptionContext.Provider>
  )
}
