// app/api/studylab/[id]/stations/[step]/author/route.ts
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { checkRateLimit, identify } from '@/lib/rate-limit'
import type { LessonRun, LessonStep } from '@/lib/studylab/lessonRun'
import {
  ERROR_MARK, PASSES, authorState, claimPass, failPass, finishPass, nextPass, redoPass, stationVersion,
  type AuthorState, type Pass,
} from '@/lib/studylab/stationJobs'
import { runPass } from '@/app/api/studylab/stations/passes'

/**
 * Writes one station ahead of the learner, one pass a request: the browser
 * asks again until the station is ready, or has failed and will run live.
 * Each pass is short enough to finish well inside Amplify's 30 s.
 */

/** What one pass may take before it is abandoned and counted as a failure. */
const PASS_DEADLINE_MS = 20_000

type Params = { params: Promise<{ id: string; step: string }> }

interface Station {
  spaceId: string
  userId: string
  title: string
  subject: string | null
  run: LessonRun
  step: LessonStep
  position: number
  version: string
}

/**
 * The lesson's owner, and a station this route writes for. Anything else is an
 * answer to send back instead.
 */
async function loadStation(spaceId: string, stepId: string, caller: string): Promise<Station | NextResponse> {
  const { rows } = await db.query('SELECT id, user_id, title, subject, lesson_run FROM learnspaces WHERE id = $1 LIMIT 1', [spaceId])
  const space = rows[0]
  if (!space || !caller || String(space.user_id ?? '') !== caller) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }
  const run = space.lesson_run as LessonRun | null
  const position = run?.steps?.findIndex((s) => s.id === stepId) ?? -1
  if (!run || position < 0) return NextResponse.json({ error: 'Step not found' }, { status: 404 })
  const step = run.steps[position]
  // A homework step is worked from the learner's own attempt, and a lesson from
  // before stations has no stages to write. A plan still on the table takes
  // stations when it is accepted, so its first step is written now.
  if ((run.recipe !== 'station' && run.phase !== 'planning') || step.homework) {
    return NextResponse.json({ error: 'This step is taught live' }, { status: 409 })
  }
  const title = String(space.title ?? '')
  const subject = space.subject ? String(space.subject) : null
  return {
    spaceId, userId: String(space.user_id), title, subject, run, step, position,
    version: stationVersion({ title: step.title, goal: step.goal, position, subject: subject ?? undefined }),
  }
}

/** Where the station stands, without what was written: the answers stay on the server. */
function standing(state: Pick<AuthorState, 'status' | 'done' | 'retries'>) {
  return { status: state.status, done: state.done, next: state.status === 'authoring' || state.status === 'none' ? nextPass(state.done) : null, retries: state.retries }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id, step: stepId } = await params
    const body = await request.json().catch(() => ({}))
    const station = await loadStation(String(id), String(stepId), String(body?.userId ?? '').trim())
    if (station instanceof NextResponse) return station

    const limit = checkRateLimit('studylab-author', identify(station.userId, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'You have made a lot of requests. Please wait a little and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }
    const gate = await assertSubscriptionAccess(station.userId, 'study')
    if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })

    const { spaceId, version } = station
    const state = await authorState(spaceId, stepId, version)
    if (state.status === 'ready' || state.status === 'failed') return NextResponse.json(standing(state))
    const pass = nextPass(state.done)
    if (!pass) return NextResponse.json(standing(state))

    const jobId = await claimPass(spaceId, stepId, version, pass)
    // Another tab or request holds this pass: no second model call.
    if (!jobId) return NextResponse.json({ ...standing(state), status: 'authoring' }, { status: 202 })

    let result
    try {
      result = await runPass(
        pass,
        {
          title: station.title, subject: station.subject, step: station.step, stepNo: station.position + 1,
          plan: station.run.steps, version, partial: state.partial, fix: state.lastFailure?.[pass],
        },
        { signal: AbortSignal.timeout(PASS_DEADLINE_MS), usage: { requestId: randomUUID(), userId: station.userId } },
      )
    } catch (err) {
      const e = err as { name?: string; message?: string }
      await failPass(jobId, `${ERROR_MARK}${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`)
      return NextResponse.json(standing({ ...state, status: 'authoring' }))
    }

    if (result.ok) {
      await finishPass(jobId, result.bundle ? { bundle: result.bundle } : { partial: result.partial ?? {} })
      const done = [...state.done, pass]
      return NextResponse.json(standing({ ...state, done, status: pass === 'verify' ? 'ready' : 'authoring' }))
    }

    await failPass(jobId, result.reason)
    let done = state.done
    if (result.redo) {
      // The part the verifier faulted is written again, and so is everything
      // written on top of it: a name cut quotes the explore it follows.
      const again = PASSES.slice(PASSES.indexOf(result.redo), PASSES.indexOf('verify')) as Pass[]
      for (const p of again) await redoPass(spaceId, stepId, version, p, result.reason)
      done = done.filter((p) => !again.includes(p))
    }
    return NextResponse.json(standing({ ...state, done, status: 'authoring' }))
  } catch (err) {
    console.error('[studylab/author] failed', err)
    return NextResponse.json({ error: 'Could not prepare this step' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id, step: stepId } = await params
    const caller = new URL(request.url).searchParams.get('userId')?.trim() ?? ''
    const station = await loadStation(String(id), String(stepId), caller)
    if (station instanceof NextResponse) return station
    return NextResponse.json(standing(await authorState(station.spaceId, stepId, station.version)))
  } catch (err) {
    console.error('[studylab/author] state failed', err)
    return NextResponse.json({ error: 'Could not read this step' }, { status: 500 })
  }
}
