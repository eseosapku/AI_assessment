'use client'

import { useState } from 'react'
import { Lock, Loader2, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { subscriptionBlockedMessage } from '@/lib/subscription'
import { CURRENCY_OPTIONS, initiateMonthlySubscription } from '@/lib/flutterwave-client'

type Props = {
  open: boolean
  reason: 'assessment' | 'study'
  snapshot: SubscriptionSnapshot
  userId: string | null
  userEmail: string | null
  onClose: () => void
  onRefresh: () => Promise<SubscriptionSnapshot | null>
}

export default function SubscribeModal({
  open,
  reason,
  snapshot,
  userId,
  userEmail,
  onClose,
}: Props) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultCurrency = process.env.NEXT_PUBLIC_SUBSCRIPTION_CURRENCY ?? 'RWF'
  const defaultAmount = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_AMOUNT ?? 500)
  const priceLabel =
    defaultCurrency === 'USD'
      ? `$${defaultAmount}/month`
      : `${defaultAmount.toLocaleString()} ${defaultCurrency}/month`

  const [currency, setCurrency] = useState(defaultCurrency)

  const startPayment = async () => {
    if (!userId) {
      setError('Please log in to subscribe.')
      return
    }
    setStarting(true)
    setError(null)
    try {
      const amount = currency === defaultCurrency ? defaultAmount : undefined
      const { checkoutUrl, paymentReference } = await initiateMonthlySubscription(userId, userEmail, currency, amount)
      try {
        sessionStorage.setItem('flw_pending_user_id', userId)
        sessionStorage.setItem('flw_pending_tx_ref', paymentReference)
      } catch {
        // ignore storage errors
      }
      window.location.href = checkoutUrl
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start payment')
      setStarting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161617] border border-gray-200/80 dark:border-white/10 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Unlock StudySquare</h2>
                  <p className="text-xs text-gray-500">{priceLabel} · Flutterwave</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {snapshot.isSubscribed ? (
              <div className="text-center py-4">
                <p className="text-emerald-600 font-semibold mb-4">
                  Subscribed{snapshot.expiresAt ? ` until ${snapshot.expiresAt.slice(0, 10)}` : ''}
                </p>
                <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold">
                  Continue
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                  {subscriptionBlockedMessage(reason)}
                </p>

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Payment method</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setCurrency(opt.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        currency === opt.code
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
                          : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                <button
                  type="button"
                  onClick={startPayment}
                  disabled={starting}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Subscribe — {priceLabel}
                </button>
                <button type="button" onClick={onClose} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700">
                  Maybe later
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
