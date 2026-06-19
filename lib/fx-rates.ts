/** USD conversion for subscription pricing (server + shared fallbacks). */

export type FxRateSource = 'live' | 'fallback'

export type FxConversion = {
  amount: number
  source: FxRateSource
  ratePerUsd: number | null
  rateUpdatedAt: string | null
}

const FX_FALLBACK_PER_USD: Record<string, number> = {
  NGN: 1360,
  UGX: 3630,
  RWF: 1468,
  KES: 129,
  GHS: 11,
}

const ZERO_DECIMAL = new Set(['UGX', 'RWF'])

const quoteCache = new Map<string, { quote: FxConversion; at: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

export function roundForCurrency(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100) / 100
}

type ErApiResponse = {
  result?: string
  base_code?: string
  rates?: Record<string, number>
  time_last_update_utc?: string
}

async function fetchLiveRatePerUsd(currency: string): Promise<{ rate: number; updatedAt: string | null } | null> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null

  const data = (await res.json()) as ErApiResponse
  if (data.result !== 'success' || !data.rates) return null

  const rate = data.rates[currency]
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null

  return { rate, updatedAt: data.time_last_update_utc ?? null }
}

function fallbackConversion(amountUsd: number, currency: string): FxConversion {
  const rate = FX_FALLBACK_PER_USD[currency] ?? 1
  return {
    amount: roundForCurrency(amountUsd * rate, currency),
    source: 'fallback',
    ratePerUsd: rate,
    rateUpdatedAt: null,
  }
}

export async function convertUsdWithMeta(amountUsd: number, toCurrency: string): Promise<FxConversion> {
  const currency = (toCurrency || 'USD').toUpperCase()
  if (currency === 'USD') {
    return {
      amount: amountUsd,
      source: 'live',
      ratePerUsd: 1,
      rateUpdatedAt: null,
    }
  }

  const cached = quoteCache.get(currency)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const { ratePerUsd, rateUpdatedAt, source } = cached.quote
    const rate = ratePerUsd ?? FX_FALLBACK_PER_USD[currency] ?? 1
    return {
      amount: roundForCurrency(amountUsd * rate, currency),
      source,
      ratePerUsd: ratePerUsd,
      rateUpdatedAt,
    }
  }

  try {
    const live = await fetchLiveRatePerUsd(currency)
    if (!live) throw new Error('live rate unavailable')

    const quote: FxConversion = {
      amount: roundForCurrency(amountUsd * live.rate, currency),
      source: 'live',
      ratePerUsd: live.rate,
      rateUpdatedAt: live.updatedAt,
    }
    quoteCache.set(currency, { quote, at: Date.now() })
    return quote
  } catch {
    const quote = fallbackConversion(amountUsd, currency)
    quoteCache.set(currency, { quote, at: Date.now() })
    return quote
  }
}

/** Convenience wrapper used by Flutterwave checkout. */
export async function convertUsd(amountUsd: number, toCurrency: string): Promise<number> {
  const { amount } = await convertUsdWithMeta(amountUsd, toCurrency)
  return amount
}
