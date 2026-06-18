'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Lock, Loader2, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { subscriptionBlockedMessage } from '@/lib/subscription'
import {
  getClientNardoPayLinkCode,
  loadNardoPayWidget,
  nardoPaySubscribePageUrl,
  type NardoPayWidgetSuccess,
} from '@/lib/nardopay-client'

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
  onRefresh,
}: Props) {
  const [widgetReady, setWidgetReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [activating, setActivating] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const linkCode = getClientNardoPayLinkCode()

  useEffect(() => {
    if (!open) return
    setPayError(null)
    loadNardoPayWidget()
      .then(() => setWidgetReady(true))
      .catch(() => setWidgetReady(false))
  }, [open])

  const confirmPayment = useCallback(
    async (data: NardoPayWidgetSuccess) => {
      if (!userId) return false
      try {
        const res = await fetch('/api/subscription/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            source: 'widget',
            transaction_id: data.transaction_id,
            subscription_id: data.subscription_id,
            payer_email: data.payer_email ?? userEmail,
            status: data.status ?? 'completed',
            payment: data,
          }),
        })
        const json = await res.json()
        return Boolean(json?.activated || json?.alreadyActive)
      } catch {
        return false
      }
    },
    [userId, userEmail],
  )

  const pollUntilActive = useCallback(async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const updated = await onRefresh()
      if (updated?.isSubscribed) {
        setActivating(false)
        onClose()
        return true
      }
      if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    setActivating(false)
    setPayError('Payment received — unlocking access, please wait a moment…')
    const updated = await onRefresh()
    if (updated?.isSubscribed) {
      setPayError(null)
      onClose()
      return true
    }
    return false
  }, [onRefresh, onClose])

  const activateAfterPayment = useCallback(
    async (data: NardoPayWidgetSuccess) => {
      setActivating(true)
      setPayError(null)
      await confirmPayment(data)
      await pollUntilActive()
    },
    [confirmPayment, pollUntilActive],
  )

  const openSubscribeCheckout = useCallback(() => {
    const redirectUrl = `${window.location.origin}/subscription/success`
    const url = nardoPaySubscribePageUrl(linkCode, { email: userEmail, redirectUrl })
    window.open(url, '_blank', 'noopener,noreferrer,width=480,height=720')
    setActivating(true)
    setPayError(null)
    void pollUntilActive()
  }, [linkCode, userEmail, pollUntilActive])

  const handleSubscribe = async () => {
    setPayError(null)
    setPaying(true)
    try {
      if (widgetReady && window.NardoPay) {
        window.NardoPay.init({
          linkCode,
          onSuccess: (data) => {
            void activateAfterPayment(data)
          },
          onError: () => {
            setPaying(false)
            openSubscribeCheckout()
          },
        })
        setPaying(false)
        return
      }

      setPaying(false)
      openSubscribeCheckout()
    } catch (err: any) {
      setPaying(false)
      setPayError(err?.message || 'Could not open checkout')
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
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-apple-blue/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-apple-blue" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Subscribe to Study Square</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Powered by NardoPay</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {subscriptionBlockedMessage(reason)}
              </p>

              {!snapshot.isSubscribed && reason === 'assessment' && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                  Free assessments used
                </div>
              )}

              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-apple-blue shrink-0 mt-0.5" />
                  Unlimited AI-generated assessments
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-apple-blue shrink-0 mt-0.5" />
                  StudyLab LearnSpaces &amp; guided study plans
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-apple-blue shrink-0 mt-0.5" />
                  Gap Map → targeted revision sessions
                </li>
              </ul>

              {userEmail && (
                <p className="text-xs text-gray-500">
                  Complete payment in the popup that opens. Use the same email as your account (
                  <strong>{userEmail}</strong>) if asked at checkout.
                </p>
              )}

              <p className="text-xs text-gray-400">
                Checkout opens in a new window. After paying, this page unlocks automatically.
              </p>

              {payError && <p className="text-xs text-red-500">{payError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={paying || activating}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-apple-blue hover:bg-blue-600 disabled:opacity-60 text-white font-semibold text-sm"
              >
                {activating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating access…
                  </>
                ) : paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening checkout…
                  </>
                ) : (
                  <>
                    Subscribe — Study Square
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <p className="px-6 pb-5 text-[11px] text-gray-400 text-center">
              You can still browse the app — generating and study plans unlock after payment.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
