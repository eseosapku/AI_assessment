import type { CountryCode } from '@/lib/countries'

/** Base subscription price — server charges this in USD or converts at checkout. */
export const SUBSCRIPTION_USD = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_AMOUNT_USD ?? 5)

/** Fixed local price for Rwanda (RWF) — not tied to USD conversion. */
export const SUBSCRIPTION_RWF = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_AMOUNT_RWF ?? 1500)

export function rwfSubscriptionAmount(): number {
  return Number(
    process.env.FLW_SUBSCRIPTION_AMOUNT_RWF ??
      process.env.NEXT_PUBLIC_SUBSCRIPTION_AMOUNT_RWF ??
      1500,
  )
}

export type SubscriptionCurrency = 'USD' | 'NGN' | 'UGX' | 'KES' | 'RWF' | 'GHS'

export type PaymentMethod = {
  id: string
  label: string
  description: string
}

export type PaymentPlan = {
  currency: SubscriptionCurrency
  regionLabel: string
  methods: PaymentMethod[]
}

const PAYMENT_PLANS: Record<SubscriptionCurrency, PaymentPlan> = {
  USD: {
    currency: 'USD',
    regionLabel: 'International',
    methods: [{ id: 'card', label: 'Debit or credit card', description: 'Visa, Mastercard, and more' }],
  },
  NGN: {
    currency: 'NGN',
    regionLabel: 'Nigeria',
    methods: [
      { id: 'card', label: 'Debit or credit card', description: 'Visa, Mastercard, Verve' },
      { id: 'bank', label: 'Bank transfer', description: 'Pay directly from your bank' },
      { id: 'ussd', label: 'USSD', description: 'Dial your bank code on your phone' },
      { id: 'account', label: 'Bank account', description: 'Pay from a linked Nigerian bank account' },
      { id: 'nqr', label: 'NQR', description: 'Scan to pay with Nigerian QR' },
    ],
  },
  RWF: {
    currency: 'RWF',
    regionLabel: 'Rwanda',
    methods: [
      { id: 'card', label: 'Debit or credit card', description: 'Local or international Visa, Mastercard' },
      { id: 'momo', label: 'MTN / Airtel Mobile Money', description: 'OTP sent to WhatsApp or email on your number during checkout' },
    ],
  },
  UGX: {
    currency: 'UGX',
    regionLabel: 'Uganda',
    methods: [
      { id: 'card', label: 'Debit or credit card', description: 'Visa, Mastercard, and more' },
      { id: 'momo', label: 'Mobile Money', description: 'MTN or Airtel MoMo' },
    ],
  },
  KES: {
    currency: 'KES',
    regionLabel: 'Kenya',
    methods: [
      { id: 'card', label: 'Debit or credit card', description: 'Visa, Mastercard, and more' },
      { id: 'mpesa', label: 'M-Pesa', description: 'Pay with your M-Pesa wallet' },
    ],
  },
  GHS: {
    currency: 'GHS',
    regionLabel: 'Ghana',
    methods: [
      { id: 'card', label: 'Debit or credit card', description: 'Visa, Mastercard, and more' },
      { id: 'momo', label: 'Mobile Money', description: 'Pay with your mobile wallet' },
    ],
  },
}

const SUPPORTED = new Set<string>(Object.keys(PAYMENT_PLANS))

export function isSupportedCheckoutCurrency(value: string): value is SubscriptionCurrency {
  return SUPPORTED.has(value.toUpperCase())
}

export function getPaymentPlanForCurrency(currency: string): PaymentPlan {
  const code = currency.toUpperCase() as SubscriptionCurrency
  return PAYMENT_PLANS[code] ?? PAYMENT_PLANS.USD
}

export function currencyForCountry(country: CountryCode | null | undefined): SubscriptionCurrency {
  const code = String(country ?? '').toUpperCase()
  if (code === 'NG') return 'NGN'
  if (code === 'RW') return 'RWF'
  if (code === 'KE') return 'KES'
  if (code === 'UG') return 'UGX'
  if (code === 'GH') return 'GHS'
  return 'USD'
}

/** Country/currency pairs with a fixed local monthly price (not FX-converted). */
export function fixedLocalAmount(currency: SubscriptionCurrency): number | null {
  if (currency === 'RWF') return rwfSubscriptionAmount()
  return null
}

export function formatSubscriptionPrice(
  currency: string,
  usd = SUBSCRIPTION_USD,
  amountLocal?: number,
): string {
  const code = currency.toUpperCase()
  const amount = amountLocal ?? (code === 'USD' ? usd : usd * 1300)
  if (code === 'USD') return `$${amount.toFixed(2)}`
  if (code === 'NGN') return `₦${Math.round(amount).toLocaleString()}`
  if (code === 'RWF') return `FRw ${Math.round(amount).toLocaleString()}`
  return `${Math.round(amount).toLocaleString()} ${code}`
}

export function subscriptionPriceLine(
  currency: string,
  usd = SUBSCRIPTION_USD,
  amountLocal?: number,
): string {
  const local = formatSubscriptionPrice(currency, usd, amountLocal)
  return `${local} / month`
}
