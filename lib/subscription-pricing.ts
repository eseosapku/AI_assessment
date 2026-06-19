import type { CountryCode } from '@/lib/countries'

/** Base subscription price — server charges this in USD or converts at checkout. */
export const SUBSCRIPTION_USD = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_AMOUNT_USD ?? 5)

export const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD', hint: 'International card' },
  { code: 'NGN', label: 'NGN', hint: 'Card, bank, USSD' },
  { code: 'UGX', label: 'UGX', hint: 'MTN / Airtel MoMo' },
  { code: 'KES', label: 'KES', hint: 'M-Pesa' },
  { code: 'RWF', label: 'RWF', hint: 'MTN MoMo' },
  { code: 'GHS', label: 'GHS', hint: 'Mobile money' },
] as const

export type SubscriptionCurrency = (typeof CURRENCY_OPTIONS)[number]['code']

/** Display-only rates when live FX is unavailable (matches server fallbacks). */
const USD_TO_CURRENCY: Record<string, number> = {
  USD: 1,
  NGN: 1500,
  UGX: 3800,
  RWF: 1300,
  KES: 130,
  GHS: 60,
}

export function currencyForCountry(country: CountryCode | null | undefined): SubscriptionCurrency {
  if (country === 'NG') return 'NGN'
  if (country === 'RW') return 'RWF'
  return 'USD'
}

export function approximateLocalAmount(currency: string, usd = SUBSCRIPTION_USD): number {
  const code = currency.toUpperCase()
  const rate = USD_TO_CURRENCY[code] ?? 1
  const raw = code === 'USD' ? usd : usd * rate
  if (code === 'UGX' || code === 'RWF') return Math.round(raw)
  return Math.round(raw * 100) / 100
}

export function formatSubscriptionPrice(currency: string, usd = SUBSCRIPTION_USD): string {
  const code = currency.toUpperCase()
  const amount = approximateLocalAmount(code, usd)
  if (code === 'USD') return `$${amount.toFixed(2)}`
  if (code === 'NGN') return `₦${amount.toLocaleString()}`
  return `${amount.toLocaleString()} ${code}`
}

export function subscriptionPriceLine(currency: string, usd = SUBSCRIPTION_USD): string {
  const local = formatSubscriptionPrice(currency, usd)
  if (currency.toUpperCase() === 'USD') return `${local} / month`
  return `${local} / month (≈ $${usd.toFixed(2)} USD)`
}
