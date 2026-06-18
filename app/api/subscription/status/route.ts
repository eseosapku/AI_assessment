import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionSnapshot } from '@/lib/subscription-server'

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  const snapshot = await getSubscriptionSnapshot(userId)
  if (!snapshot) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ data: snapshot })
}
