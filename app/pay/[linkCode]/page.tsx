'use client'

import { useParams } from 'next/navigation'

/** NardoPay widget opens /pay/{linkCode} on the merchant origin — embed checkout here. */
export default function NardoPayCheckoutPage() {
  const params = useParams()
  const linkCode = String(params?.linkCode ?? '').trim()
  const src = linkCode ? `https://nardopay.com/pay/${encodeURIComponent(linkCode)}` : ''

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
