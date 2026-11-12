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
import { useDialogBehavior } from '@/components/ui/Modal'

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
  rateSource: 'live' | 'fallback' | 'fixed'
  ratePerUsd: number | null
  rateUpdatedAt: string | null
}

type AppliedReferral = {
  code: string
  discountPercentage: number
  originalFormatted: string
  formatted: string
}

const BENEFITS = [
  'Unlimited AI-generated assessments',
  'Exam prep with past-paper style questions',
  'LearnSpace guided lessons',
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
  const { ref, dialogProps } = useDialogBehavior({ open, onClose, labelledBy: 'subscribe-modal-title' })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<PricingQuote | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [useUsdCheckout, setUseUsdCheckout] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [appliedReferral, setAppliedReferral] = useState<AppliedReferral | null>(null)
  const [applyingReferral, setApplyingReferral] = useState(false)

  const localCurrency = useMemo(() => currencyForCountry(userCountry), [userCountry])
  const checkoutCurrency: SubscriptionCurrency = useUsdCheckout ? 'USD' : localCurrency
  const plan = getPaymentPlanForCurrency(checkoutCurrency)
  const showRwandaMomoOtpNote = checkoutCurrency === 'RWF' && !useUsdCheckout

  useEffect(() => {
    if (!open) return
    setUseUsdCheckout(false)
    setError(null)
    setReferralCode('')
    setAppliedReferral(null)
  }, [open, localCurrency])

  useEffect(() => {
    setAppliedReferral(null)
  }, [checkoutCurrency])

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
    if (referralCode.trim() && !appliedReferral) {
      setError('Apply the referral code before continuing to checkout.')
      return
    }
    setStarting(true)
    setError(null)
    try {
      const { checkoutUrl, paymentReference } = await initiateMonthlySubscription(
        userId,
        userEmail,
        checkoutCurrency,
        appliedReferral?.code,
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

  const applyReferral = async () => {
    if (!userId) {
      setError('Please log in to apply a referral code.')
      return
    }
    if (!referralCode.trim()) {
      setError('Enter a referral code first.')
      return
    }
    setApplyingReferral(true)
    setError(null)
    try {
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code: referralCode, currency: checkoutCurrency }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Could not apply referral code.')
      setReferralCode(String(body.code))
      setAppliedReferral(body as AppliedReferral)
    } catch (e) {
      setAppliedReferral(null)
      setError(e instanceof Error ? e.message : 'Could not apply referral code.')
    } finally {
      setApplyingReferral(false)
    }
  }

  const displayPrice = appliedReferral?.formatted ?? pricing?.formatted ?? (checkoutCurrency === 'USD' ? `$${SUBSCRIPTION_USD.toFixed(2)}` : '…')
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
            className="w-full max-w-md overflow-hidden rounded-3xl border border-[#0E8FD1]/20 bg-white shadow-2xl shadow-[#0E8FD1]/10 dark:bg-[#141416] dark:border-[#0E8FD1]/30"
            onClick={(e) => e.stopPropagation()}
            ref={ref}
            {...dialogProps}
          >
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-[#0C2A40] via-[#0C74B4] to-[#2ACBF2] text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-5 pr-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9BE3FB]">Subscribe to StudySquare</p>
                <h2 id="subscribe-modal-title" className="text-lg font-bold leading-tight">Monthly subscription</h2>
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
              {appliedReferral && (
                <p className="mt-1 text-sm text-white/75">
                  <span className="line-through">{appliedReferral.originalFormatted}</span>
                  <span className="ml-2 font-semibold">{appliedReferral.discountPercentage}% referral discount</span>
                </p>
              )}

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
                    className="w-full py-3 rounded-xl bg-ss-accent hover:brightness-95 text-white font-semibold transition-all"
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
                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-ss-accent dark:text-[#7FD8F5]" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mb-5 rounded-2xl border border-ss-line bg-ss-chip p-4">
                    <label htmlFor="subscription-referral-code" className="text-xs font-semibold uppercase tracking-wide text-ss-slate">
                      Referral code
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="subscription-referral-code"
                        value={referralCode}
                        onChange={(event) => {
                          setReferralCode(event.target.value.toUpperCase())
                          setAppliedReferral(null)
                          setError(null)
                        }}
                        placeholder="Enter referral code"
                        autoComplete="off"
                        className="min-w-0 flex-1 rounded-xl border border-ss-line bg-ss-panel px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ss-ink outline-none focus:border-ss-accent"
                      />
                      <button
                        type="button"
                        onClick={applyReferral}
                        disabled={applyingReferral || !referralCode.trim()}
                        className="rounded-xl bg-[#0C74B4] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {applyingReferral ? 'Applying…' : appliedReferral ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                    {appliedReferral && (
                      <p className="mt-2 text-xs font-semibold text-[color:var(--ss-good)]">
                        {appliedReferral.code} applied — you pay {appliedReferral.formatted}.
                      </p>
                    )}
                  </div>

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

                  {showRwandaMomoOtpNote && (
                    <p className="mb-5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                      Paying with Mobile Money? During checkout, your one-time password (OTP) will be sent to the{' '}
                      <strong>WhatsApp or email</strong> linked to the phone number you enter — not by SMS.
                    </p>
                  )}

                  {showUsdAlternative && (
                    <button
                      type="button"
                      onClick={() => setUseUsdCheckout((v) => !v)}
                      className="mb-4 w-full text-left text-xs text-gray-500 transition-colors hover:text-ss-accent dark:text-gray-400 dark:hover:text-[#7FD8F5]"
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
                    className="w-full py-3.5 rounded-xl bg-ss-accent hover:brightness-95 text-white disabled:opacity-60 font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-[#0E8FD1]/25"
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
