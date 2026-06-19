'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { verifyPayment } from '@/lib/flutterwave-client'
import { useSubscription } from '@/components/SubscriptionProvider'

export default function SubscriptionSuccessPage() {
  const { user } = useAuth()
  const { refresh } = useSubscription()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Confirming your payment…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const txRef =
      params.get('tx_ref') ??
      params.get('reference') ??
      (typeof window !== 'undefined' ? sessionStorage.getItem('flw_pending_tx_ref') : null)
    const transactionId = params.get('transaction_id')
    const flwStatus = params.get('status')
    const storedUserId =
      typeof window !== 'undefined' ? sessionStorage.getItem('flw_pending_user_id') : null
    const userId = user?.id ?? storedUserId

    if (!userId) {
      setStatus('error')
      setMessage('Please log in, then open this page again from your payment email or try Subscribe once more.')
      return
    }

    if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') {
      setStatus('error')
      setMessage('Payment was not completed. You can try again from the dashboard.')
      return
    }

    if (!txRef && !transactionId) {
      setStatus('error')
      setMessage('Missing payment reference. If you paid, wait a minute and refresh — webhook confirmation may still be pending.')
      return
    }

    ;(async () => {
      try {
        await verifyPayment(userId, txRef ?? '', transactionId ?? undefined)
        await refresh()
        try {
          sessionStorage.removeItem('flw_pending_user_id')
          sessionStorage.removeItem('flw_pending_tx_ref')
        } catch {
          // ignore
        }
        setStatus('success')
        setMessage('Your subscription is active. You can generate assessments again.')
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : 'Activation failed'
        await refresh()
        setStatus('error')
        setMessage(
          errMsg.includes('DATABASE_URL') || errMsg.includes('migration')
            ? `${errMsg} Ensure DATABASE_URL is set and run migrations/full-platform-schema.sql on RDS.`
            : `Payment received but activation failed: ${errMsg}. Try refreshing in a minute or contact support with reference ${txRef ?? transactionId}.`,
        )
      }
    })()
  }, [user?.id, refresh])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] dark:bg-[#0C0C0E] px-5">
      <div className="max-w-md w-full rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161617] p-8 text-center shadow-lg">
        {status === 'loading' && <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />}
        {status === 'success' && <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />}
        {status === 'error' && <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-4" />}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {status === 'loading' ? 'Processing payment' : status === 'success' ? 'Subscription active' : 'Payment status'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <Link href="/" className="inline-flex px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
