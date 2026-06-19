'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { subscriptionBlockedMessage } from '@/lib/subscription'
import type { CountryCode } from '@/lib/countries'
import {
  CURRENCY_OPTIONS,
  SUBSCRIPTION_USD,
  currencyForCountry,
  subscriptionPriceLine,
  type SubscriptionCurrency,
} from '@/lib/subscription-pricing'
import { initiateMonthlySubscription } from '@/lib/flutterwave-client'

type Props = {
  open: boolean
  reason: 'assessment' | 'study'
  snapshot: SubscriptionSnapshot
  userId: string | null
  userEmail: string | null
  userCountry?: CountryCode | null
  onClose: () => void
  onRefresh: () => Promise<SubscriptionSnapshot | null>
}

const BENEFITS = [
  'Unlimited AI-generated assessments',
  'Exam prep with past-paper style questions',
  'StudyLab guided learning spaces',
  'Detailed feedback and progress tracking',
]

export default function SubscribeModal({
  open,
  reason,
  snapshot,
  userId,
  userEmail,
  userCountry,
  onClose,
}: Props) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestedCurrency = useMemo(() => currencyForCountry(userCountry), [userCountry])
  const [currency, setCurrency] = useState<SubscriptionCurrency>(suggestedCurrency)

  useEffect(() => {
    if (open) setCurrency(suggestedCurrency)
  }, [open, suggestedCurrency])

  const priceLine = subscriptionPriceLine(currency)

  const startPayment = async () => {
    if (!userId) {
      setError('Please log in to subscribe.')
      return
    }
    setStarting(true)
    setError(null)
    try {
      const { checkoutUrl, paymentReference } = await initiateMonthlySubscription(
        userId,
        userEmail,
        currency,
      )
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-[#141416] border border-gray-200/80 dark:border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/80">StudySquare Pro</p>
                  <h2 className="text-xl font-bold leading-tight">Unlock full access</h2>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">${SUBSCRIPTION_USD}</span>
                <span className="text-sm text-white/85 pb-1.5">/ month</span>
              </div>
              <p className="mt-1 text-sm text-white/80">
                {currency === 'USD' ? 'Billed in US dollars' : `Pay in ${currency} — ${priceLine}`}
              </p>
            </div>

            <div className="px-6 py-5">
              {snapshot.isSubscribed ? (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-4">
                    <Check className="w-4 h-4" />
                    Active subscription
                  </div>
                  {snapshot.expiresAt && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Renews / expires {snapshot.expiresAt.slice(0, 10)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    {subscriptionBlockedMessage(reason)}
                  </p>

                  <ul className="space-y-2.5 mb-5">
                    {BENEFITS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                          <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mb-4">
                    <label
                      htmlFor="subscription-currency"
                      className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2"
                    >
                      Payment currency
                    </label>
                    <select
                      id="subscription-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as SubscriptionCurrency)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1c] px-3 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    >
                      {CURRENCY_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label} — {opt.hint}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={startPayment}
                    disabled={starting}
                    className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-60 font-semibold flex items-center justify-center gap-2 transition-opacity"
                  >
                    {starting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {starting ? 'Redirecting to checkout…' : `Subscribe — ${priceLine}`}
                  </button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Secure checkout powered by Flutterwave
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Maybe later
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
