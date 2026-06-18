'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
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
    const txRef = params.get('tx_ref') ?? params.get('reference')
    const flwStatus = params.get('status')

    if (!user?.id) {
      setStatus('error')
      setMessage('Please log in to activate your subscription.')
      return
    }

    if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') {
      setStatus('error')
      setMessage('Payment was not completed. You can try again from the dashboard.')
      return
    }

    if (!txRef) {
      setStatus('error')
      setMessage('Missing payment reference. If you paid, your subscription should activate shortly via webhook.')
      return
    }

    ;(async () => {
      try {
        await verifyPayment(user.id, txRef)
        await refresh()
        setStatus('success')
        setMessage('Your subscription is active. You can generate assessments again.')
      } catch {
        await refresh()
        setStatus('success')
        setMessage('Payment received. If features are still locked, wait a minute and refresh — webhook confirmation may be pending.')
      }
    })()
  }, [user?.id, refresh])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] dark:bg-[#0C0C0E] px-5">
      <div className="max-w-md w-full rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161617] p-8 text-center shadow-lg">
        {status === 'loading' && <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />}
        {status === 'success' && <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />}
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
