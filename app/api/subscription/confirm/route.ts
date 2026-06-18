import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription, getSubscriptionSnapshot, fetchSubscriptionUser } from '@/lib/subscription-server'
import { isNardoPayCheckoutSuccess, type NardoPayCheckoutSuccess } from '@/lib/nardopay'

/**
 * Called after NardoPay checkout (widget onSuccess or /subscription/success redirect).
 * Dashboard-created links have no webhook UI — widget completion is the primary path.
 * API-created links also receive server webhooks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.user_id ?? '').trim()
    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const snapshot = await getSubscriptionSnapshot(userId)
    if (snapshot?.isSubscribed) {
      return NextResponse.json({ data: snapshot, alreadyActive: true })
    }

    const payment = body.payment as NardoPayCheckoutSuccess | undefined
    const transactionId = String(body.transaction_id ?? payment?.transaction_id ?? '').trim() || null
    const payerEmail = String(body.payer_email ?? payment?.payer_email ?? '').trim().toLowerCase() || null
    const status = String(body.status ?? payment?.status ?? '').trim() || null
    const source = String(body.source ?? '').trim()

    const checkoutData: NardoPayCheckoutSuccess = {
      transaction_id: transactionId ?? undefined,
      subscription_id: String(body.subscription_id ?? payment?.subscription_id ?? '').trim() || undefined,
      status: status ?? undefined,
      payer_email: payerEmail ?? undefined,
    }

    const paid = isNardoPayCheckoutSuccess(checkoutData)

    // Widget: user paid inside StudySquare while logged in (works with dashboard links).
    if (source === 'widget' && paid) {
      const result = await activateSubscription({
        userId,
        email: payerEmail,
        ref: transactionId ?? checkoutData.subscription_id ?? 'widget-success',
      })
      if (result.ok) {
        const updated = await getSubscriptionSnapshot(userId)
        return NextResponse.json({ data: updated, activated: true, source: 'widget' })
      }
    }

    // Landed on /subscription/success after NardoPay checkout (logged-in user).
    if (source === 'redirect' && paid) {
      const result = await activateSubscription({
        userId,
        email: payerEmail,
        ref: transactionId ?? checkoutData.subscription_id ?? 'redirect-success',
      })
      if (result.ok) {
        const updated = await getSubscriptionSnapshot(userId)
        return NextResponse.json({ data: updated, activated: true, source: 'redirect' })
      }
    }

    // Email match when payer email is present on the receipt.
    if (paid && payerEmail) {
      const user = await fetchSubscriptionUser(userId)
      const accountEmail = String(user?.email ?? '').trim().toLowerCase()
      if (accountEmail && accountEmail === payerEmail) {
        const result = await activateSubscription({
          userId,
          email: payerEmail,
          ref: transactionId ?? checkoutData.subscription_id ?? 'client-confirm',
        })
        if (result.ok) {
          const updated = await getSubscriptionSnapshot(userId)
          return NextResponse.json({ data: updated, activated: true, source: 'email_match' })
        }
      }
    }

    const manualToken = process.env.SUBSCRIPTION_MANUAL_ACTIVATE_TOKEN
    const provided = String(body.activate_token ?? '')
    if (manualToken && provided === manualToken) {
      const result = await activateSubscription({ userId, ref: 'manual-activate' })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      const updated = await getSubscriptionSnapshot(userId)
      return NextResponse.json({ data: updated, activated: true })
    }

    return NextResponse.json({
      data: snapshot,
      pending: true,
      message:
        'Payment not confirmed yet. Finish checkout, return to Study Square, then tap Refresh status — or contact support with your payment receipt.',
    })
  } catch (err) {
    console.error('Subscription confirm error:', err)
    return NextResponse.json({ error: 'Failed to confirm subscription' }, { status: 500 })
  }
}
