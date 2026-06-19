'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Loader2, ShieldCheck, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { subscriptionBlockedMessage } from '@/lib/subscription'
import type { CountryCode } from '@/lib/countries'
import {
  SUBSCRIPTION_USD,
  currencyForCountry,
  getPaymentPlanForCurrency,
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

type PricingQuote = {
  currency: SubscriptionCurrency
  amountUsd: number
  amountLocal: number
  formatted: string
  formattedMonthly: string
  paymentMethods: { id: string; label: string; description: string }[]
  regionLabel: string
  rateSource: 'live' | 'fallback'
  ratePerUsd: number | null
  rateUpdatedAt: string | null
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
  const [pricing, setPricing] = useState<PricingQuote | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [useUsdCheckout, setUseUsdCheckout] = useState(false)

  const localCurrency = useMemo(() => currencyForCountry(userCountry), [userCountry])
  const checkoutCurrency: SubscriptionCurrency = useUsdCheckout ? 'USD' : localCurrency
  const plan = getPaymentPlanForCurrency(checkoutCurrency)

  useEffect(() => {
    if (!open) return
    setUseUsdCheckout(false)
    setError(null)
  }, [open, localCurrency])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPricingLoading(true)
    fetch(`/api/subscription/pricing?currency=${encodeURIComponent(checkoutCurrency)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load pricing')
        return json as PricingQuote
      })
      .then((quote) => {
        if (!cancelled) setPricing(quote)
      })
      .catch(() => {
        if (!cancelled) setPricing(null)
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, checkoutCurrency])

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
        checkoutCurrency,
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

  const displayPrice = pricing?.formatted ?? (checkoutCurrency === 'USD' ? `$${SUBSCRIPTION_USD.toFixed(2)}` : '…')
  const showUsdAlternative = localCurrency !== 'USD'

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
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-[#141416] border border-gray-200/80 dark:border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-5 pr-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">StudySquare</p>
                <h2 className="text-lg font-bold leading-tight">Monthly subscription</h2>
              </div>
              <div className="flex items-end gap-2 min-h-[3rem]">
                {pricingLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-white/70" />
                ) : (
                  <>
                    <span className="text-4xl font-bold tracking-tight">{displayPrice}</span>
                    <span className="text-sm text-white/70 pb-1.5">/ month</span>
                  </>
                )}
              </div>

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

                  <ul className="space-y-2 mb-5">
                    {BENEFITS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mb-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                      Pay with · {plan.regionLabel}
                    </p>
                    <ul className="space-y-2.5">
                      {plan.methods.map((method) => (
                        <li key={method.id} className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10">
                            <CreditCard className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{method.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{method.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {showUsdAlternative && (
                    <button
                      type="button"
                      onClick={() => setUseUsdCheckout((v) => !v)}
                      className="mb-4 w-full text-left text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      {useUsdCheckout
                        ? `← Pay in ${localCurrency} instead`
                        : 'Prefer an international card? Pay in USD'}
                    </button>
                  )}

                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={startPayment}
                    disabled={starting || pricingLoading}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-emerald-900/20"
                  >
                    {starting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    {starting
                      ? 'Opening secure checkout…'
                      : pricingLoading
                        ? 'Loading price…'
                        : `Continue to checkout`}
                  </button>

                  <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    Secure payment via Flutterwave · cancel anytime
                  </p>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Not now
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
