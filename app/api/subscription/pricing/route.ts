import { NextRequest, NextResponse } from 'next/server'
import { convertUsdWithMeta } from '@/lib/fx-rates'
import {
  fixedLocalAmount,
  formatSubscriptionPrice,
  getPaymentPlanForCurrency,
  isSupportedCheckoutCurrency,
  usdSubscriptionAmount,
} from '@/lib/subscription-pricing'

export async function GET(request: NextRequest) {
  const currency = String(request.nextUrl.searchParams.get('currency') ?? 'USD').toUpperCase()

  if (!isSupportedCheckoutCurrency(currency)) {
    return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
  }

  const plan = getPaymentPlanForCurrency(currency)
  const amountUsd = usdSubscriptionAmount()
  const fixed = fixedLocalAmount(currency)
  const fx =
    fixed != null
      ? {
          amount: fixed,
          source: 'fixed' as const,
          ratePerUsd: null,
          rateUpdatedAt: null,
        }
      : currency === 'USD'
        ? {
            amount: amountUsd,
            source: 'live' as const,
            ratePerUsd: 1,
            rateUpdatedAt: null,
          }
        : await convertUsdWithMeta(amountUsd, currency)

  return NextResponse.json({
    currency,
    amountUsd,
    amountLocal: fx.amount,
    formatted: formatSubscriptionPrice(currency, amountUsd, fx.amount),
    formattedMonthly: `${formatSubscriptionPrice(currency, amountUsd, fx.amount)} / month`,
    paymentMethods: plan.methods,
    regionLabel: plan.regionLabel,
    rateSource: fx.source,
    ratePerUsd: fx.ratePerUsd,
    rateUpdatedAt: fx.rateUpdatedAt,
  })
}
