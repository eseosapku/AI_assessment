'use client'

import { Suspense, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { nardoPaySubscribePageUrl } from '@/lib/nardopay-client'

function CheckoutFrame() {
  const params = useParams()
  const searchParams = useSearchParams()
  const linkCode = String(params?.linkCode ?? '').trim()

  const src = useMemo(() => {
    if (!linkCode) return ''
    return nardoPaySubscribePageUrl(linkCode, {
      email: searchParams.get('email') || undefined,
      redirectUrl: searchParams.get('redirect_url') || undefined,
    })
  }, [linkCode, searchParams])

  if (!src) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-sm">
        Invalid payment link.
      </div>
    )
  }

  return (
    <iframe
      title="Complete payment"
      src={src}
      className="fixed inset-0 w-full h-full border-0 bg-white"
      allow="payment"
    />
  )
}

/** NardoPay widget opens /pay/{linkCode} on the merchant origin. */
export default function NardoPayCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white text-sm">
          Loading checkout…
        </div>
      }
    >
      <CheckoutFrame />
    </Suspense>
  )
}
