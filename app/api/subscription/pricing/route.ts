import { NextRequest, NextResponse } from 'next/server'
import { convertUsdWithMeta } from '@/lib/fx-rates'
import {
  SUBSCRIPTION_USD,
  formatSubscriptionPrice,
  getPaymentPlanForCurrency,
  isSupportedCheckoutCurrency,
} from '@/lib/subscription-pricing'

export async function GET(request: NextRequest) {
  const currency = String(request.nextUrl.searchParams.get('currency') ?? 'USD').toUpperCase()

  if (!isSupportedCheckoutCurrency(currency)) {
    return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
  }

  const plan = getPaymentPlanForCurrency(currency)
  const fx =
    currency === 'USD'
      ? {
          amount: SUBSCRIPTION_USD,
          source: 'live' as const,
          ratePerUsd: 1,
          rateUpdatedAt: null,
        }
      : await convertUsdWithMeta(SUBSCRIPTION_USD, currency)

  return NextResponse.json({
    currency,
    amountUsd: SUBSCRIPTION_USD,
    amountLocal: fx.amount,
    formatted: formatSubscriptionPrice(currency, SUBSCRIPTION_USD, fx.amount),
    formattedMonthly: `${formatSubscriptionPrice(currency, SUBSCRIPTION_USD, fx.amount)} / month`,
    paymentMethods: plan.methods,
    regionLabel: plan.regionLabel,
    rateSource: fx.source,
    ratePerUsd: fx.ratePerUsd,
    rateUpdatedAt: fx.rateUpdatedAt,
  })
}
