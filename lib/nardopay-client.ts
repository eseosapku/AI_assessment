/** Client-safe NardoPay constants (no secrets). */

export const NARDOPAY_WIDGET_SCRIPT = 'https://nardopay.com/nardopay-widget.js'

export const NARDOPAY_DEFAULT_LINK_CODE = 'ca4ccd44ca22c6e0'

export function getClientNardoPayLinkCode(): string {
  return (process.env.NEXT_PUBLIC_NARDOPAY_LINK_CODE || NARDOPAY_DEFAULT_LINK_CODE).trim()
}

/** Subscription checkout URL (API-created links use /subscribe/, not /pay/). */
export function nardoPaySubscribePageUrl(
  linkCode?: string,
  opts?: { email?: string | null; userId?: string | null; redirectUrl?: string | null },
): string {
  const configured = String(process.env.NEXT_PUBLIC_NARDOPAY_SUBSCRIBE_URL ?? '').trim()
  const code = (linkCode || getClientNardoPayLinkCode()).trim()
  const url = configured
    ? new URL(configured)
    : new URL(`https://nardopay.com/subscribe/${encodeURIComponent(code)}`)
  if (opts?.email) url.searchParams.set('email', opts.email.trim().toLowerCase())
  if (opts?.userId) {
    url.searchParams.set('metadata', JSON.stringify({ user_id: opts.userId }))
    url.searchParams.set('label', `user:${opts.userId}`)
  }
  if (opts?.redirectUrl) url.searchParams.set('redirect_url', opts.redirectUrl)
  return url.toString()
}

export type NardoPayWidgetSuccess = {
  transaction_id?: string
  subscription_id?: string
  status?: string
  payer_email?: string
  payer_name?: string
  amount?: number
  currency?: string
}

export type NardoPayWidget = {
  init: (options: {
    linkCode: string
    container?: string
    onSuccess?: (data: NardoPayWidgetSuccess) => void
    onError?: (error: unknown) => void
  }) => void
}

declare global {
  interface Window {
    NardoPay?: NardoPayWidget
  }
}

let widgetLoadPromise: Promise<void> | null = null

export function loadNardoPayWidget(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.NardoPay) return Promise.resolve()
  if (widgetLoadPromise) return widgetLoadPromise

  widgetLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${NARDOPAY_WIDGET_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('NardoPay widget failed to load')))
      if (window.NardoPay) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = NARDOPAY_WIDGET_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('NardoPay widget failed to load'))
    document.head.appendChild(script)
  })

  return widgetLoadPromise
}
