import { NextRequest, NextResponse } from 'next/server'
import { buildPersonaFromGapTree } from '@/lib/studylab/persona'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Lightweight persona snapshot for the StudyLab hub — derived from gap-map data. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = String(searchParams.get('user_id') ?? '').trim()

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const gapRes = await fetch(`${origin}/api/studylab/gap-map?user_id=${encodeURIComponent(userId)}`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    })
    const gapJson = await gapRes.json()
    if (!gapRes.ok) {
      return NextResponse.json({ error: gapJson.error || 'Failed to build persona' }, { status: gapRes.status })
    }

    const persona = buildPersonaFromGapTree(gapJson.data ?? { textbooks: [], summary: {} })
    return NextResponse.json({ data: persona, warning: gapJson.warning ?? null })
  } catch (err) {
    console.error('Persona error:', err)
    return NextResponse.json({ error: 'Failed to load learning persona' }, { status: 500 })
  }
}
