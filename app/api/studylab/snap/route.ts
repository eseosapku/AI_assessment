import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials, type ImageInput } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseImage(value: unknown): ImageInput | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

const FALLBACK = { title: 'Homework problem', subject: '' }

// POST /api/studylab/snap → read a homework photo and suggest a title + subject
// so the LearnSpace it opens has a sensible name. Best-effort: never blocks the
// snap flow — on any failure it returns a generic title.
export async function POST(request: NextRequest) {
  try {
    if (!hasBedrockCredentials()) {
      return NextResponse.json({ error: BEDROCK_CREDENTIALS_ERROR }, { status: 500 })
    }
    const body = await request.json()
    const userId = String(body?.user_id ?? '').trim()
    if (userId && UUID_RE.test(userId)) {
      const gate = await assertSubscriptionAccess(userId, 'study')
      if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const image = parseImage(body?.image)
    if (!image) return NextResponse.json(FALLBACK)

    const prompt = `You are reading a photo of a student's homework problem. Reply with ONLY a JSON object: {"title": "<a short 3-6 word topic title for this problem>", "subject": "<one or two word subject, e.g. Algebra, Physics, Chemistry; empty string if unsure>"}. Do not solve it. If the photo is unreadable, use {"title": "Homework problem", "subject": ""}.`

    try {
      const raw = await callGemma(prompt, { maxTokens: 200, temperature: 0.2, image, maxCandidates: 2 })
      const parsed = parseJsonRobust(raw)
      const title = String(parsed?.title ?? '').trim().slice(0, 80) || FALLBACK.title
      const subject = String(parsed?.subject ?? '').trim().slice(0, 40)
      return NextResponse.json({ title, subject })
    } catch (err) {
      console.warn('Snap title extraction failed:', (err as Error)?.message ?? err)
      return NextResponse.json(FALLBACK)
    }
  } catch (err) {
    console.error('Snap route error:', err)
    return NextResponse.json(FALLBACK)
  }
}
