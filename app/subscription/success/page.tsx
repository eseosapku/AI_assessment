'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'

function SubscriptionSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const { refresh, snapshot } = useSubscription()
  const [checking, setChecking] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setChecking(true)
      try {
        const transactionId = searchParams.get('transaction_id')
        const payerEmail = searchParams.get('payer_email') || searchParams.get('email')
        const status = searchParams.get('status') || 'completed'

        await fetch('/api/subscription/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            transaction_id: transactionId,
            payer_email: payerEmail,
            status,
          }),
        })
        const updated = await refresh()
        if (!cancelled) setPending(!updated?.isSubscribed)
      } catch {
        if (!cancelled) setPending(true)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, refresh, searchParams])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-apple-gray dark:bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 shadow-xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Thanks for subscribing to Study Square</h1>
        {checking ? (
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Activating your account…
          </p>
        ) : snapshot.isSubscribed ? (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Your subscription is active. You can generate assessments again.
          </p>
        ) : pending ? (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Payment received — activation can take a minute. Tap refresh below, or use &quot;I&apos;ve paid — refresh&quot; on
            the subscribe screen.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => router.push('/')} className="btn-primary w-full">
            Back to dashboard
          </button>
          {!snapshot.isSubscribed && (
            <button
              type="button"
              onClick={() => refresh()}
              className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold"
            >
              Refresh status
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  )
}
