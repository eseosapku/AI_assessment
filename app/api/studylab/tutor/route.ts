import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonbParam } from '@/lib/pg-json'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { runFromLegacy } from '@/lib/studylab/lessonRunMigrate'
import { proposePlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { keepMeasuredSteps } from '@/lib/studylab/stepLocks'
import { applyAction, draftPlan } from './dispatch'
import { checkRateLimit, identify } from '@/lib/rate-limit'

// The system prompt lives in `./system-prompt`: a route module may export
// only its handlers, and `next build` failed the type check while it was
// declared here.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const learnspaceId = String(body?.learnspaceId ?? '').trim()
    const action = body?.action
    if (!learnspaceId || !action?.type) {
      return NextResponse.json({ error: 'A learnspace and an action are required' }, { status: 400 })
    }

    const { rows } = await db.query('SELECT * FROM learnspaces WHERE id = $1 LIMIT 1', [learnspaceId])
    const space = rows[0]
    if (!space) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const userId = space.user_id ? String(space.user_id) : null

    // Ceiling on a paid call. Subscription gating decides whether someone may
    // do this at all; nothing decided how often, so one loop could run up an
    // unbounded bill.
    const limit = checkRateLimit('studylab-tutor', identify(userId, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'You have made a lot of requests. Please wait a little and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'study')
      if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const policy = policyFor(space.origin)
    let run: LessonRun =
      space.lesson_run ??
      runFromLegacy(
        { plan: space.canvas_state?.plan ?? null, currentStep: space.current_step, status: space.status },
        policy,
      )
    // The space owns its mode, not the request. Reading it off the row rather
    // than the body means a lesson cannot be switched mid-way by anything a
    // client sends, and a run stored before this column existed reads as the
    // classic tutor it was taught by. `run.mode` is a mirror of this for the
    // teaching prompt's convenience, refreshed every turn.
    const mode: 'classic' | 'montessori' = space.mode === 'montessori' ? 'montessori' : 'classic'
    run = { ...run, mode }

    const requestId = randomUUID()

    // Drafting is the one action that produces its steps before the
    // transition, since a transition has to stay pure.
    if (action.type === 'draft_plan') {
      // A plan already proposed is not re-drafted. Two mounts of the same
      // lesson — a second tab, a reload during the first draft, a double
      // effect — both auto-draft, and the second overwrote the first: the
      // learner read plan A in the chat, pressed "Looks good, start", and the
      // lesson ran plan B, which was still sitting in the sidebar next to it.
      //
      // A re-draft is only ever legitimate when the learner asked for one, and
      // that request always carries their answer.
      const redraft = typeof action.answer === 'string' && action.answer.trim().length > 0
      if (!redraft && run.phase === 'planning' && run.steps.length > 0) {
        return NextResponse.json({
          run,
          say: '',
          actions: [],
          suggestions: [],
          plan: planCardFor(run, policy, []),
        })
      }

      const subtopics = await loadSubtopics(space)
      // The gap this lesson was opened for, by name. Only a gap lesson has one.
      const target = Number(space.subtopic_id)
      const mustCover =
        policy.gaps === 'lock' && Number.isInteger(target)
          ? (subtopics.find((s) => s.id === target)?.name ?? null)
          : null
      const { steps, questions, programming } = await draftPlan({
        title: String(space.title ?? ''),
        subject: space.subject ? String(space.subject) : null,
        policy, userId, subtopics, requestId, mustCover,
        answer: typeof action.answer === 'string' ? action.answer : undefined,
      })
      if (steps.length === 0) {
        // Same principle as applyAction's failed-parse path: a broken draft
        // must not touch state, or a retry silently wipes whatever plan and
        // step progress the learner already had (including a legacy lesson
        // runFromLegacy just migrated).
        return NextResponse.json({
          run,
          say: 'I could not draft that outline — try again.',
          actions: [],
          suggestions: [],
          refusal: 'Could not draft a plan.',
        })
      }
      // A gap lesson may be reshaped, but not away from the gap. Asked to skip
      // the introductory material, the model returned a plan with no step for
      // the subtopic the learner had been measured at 29% on — and the lesson
      // would have run under a title about that gap while covering everything
      // except it.
      const kept = policy.gaps === 'lock' ? keepMeasuredSteps(run.steps, steps) : steps
      const planned = proposePlan(run, kept)
      // Decided once, here, and carried for the rest of the lesson: every
      // teaching turn checks it before allowing a card that runs code.
      const next = planned.ok ? { ...planned.run, programming } : run
      await saveRun(learnspaceId, next)

      // The plan goes to the chat, not just the sidebar. A plan the learner
      // cannot see themselves being asked about is an announcement, and an
      // announcement in a side panel is one nobody reads.
      return NextResponse.json({
        run: next,
        say: '',
        actions: [],
        suggestions: [],
        plan: planCardFor(next, policy, questions),
      })
    }

    // The board travels with the action. The client's canvas is authoritative
    // here — `space.canvas_state` is a debounced autosave and can be a beat
    // behind, which is exactly the window a duplicate card gets created in.
    const result = await applyAction({
      run, policy, userId, action, requestId,
      context: {
        title: space.title,
        subject: space.subject,
        board: body?.board ?? null,
        // A homework sheet's shared data — the table, the diagram in words.
        // Read from the saved board rather than the request, because it is the
        // one thing the client cannot be allowed to vary: it came off the photo
        // once and the photo is never looked at again.
        given: Array.isArray(space.canvas_state?.homework?.given)
          ? space.canvas_state.homework.given
          : [],
      },
    })
    if (!result.refusal) await saveRun(learnspaceId, result.run)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Tutor dispatch failed:', error)
    return NextResponse.json({ error: 'Tutor request failed' }, { status: 500 })
  }
}

/** The plan as the chat card renders it. Shared so a re-read matches the draft. */
function planCardFor(run: LessonRun, policy: ReturnType<typeof policyFor>, questions: string[]) {
  return {
    steps: run.steps.map((step) => ({
      id: step.id,
      title: step.title,
      goal: step.goal,
      measured: step.lockedBy?.accuracy ?? null,
      locked: Boolean(step.lockedBy) && policy.gaps === 'lock',
    })),
    questions,
  }
}

/** Persists just the run. Last write wins, matching how canvas_state behaves. */
async function saveRun(learnspaceId: string, run: LessonRun): Promise<void> {
  await db.query('UPDATE learnspaces SET lesson_run = $1::jsonb, updated_at = NOW() WHERE id = $2', [
    jsonbParam(run),
    learnspaceId,
  ])
}

/** The subtopics a step can be attributed to. Empty for a scratch lesson. */
async function loadSubtopics(space: Record<string, unknown>): Promise<{ id: number; name: string }[]> {
  const topicId = Number(space.topic_id)
  if (!Number.isInteger(topicId) || topicId <= 0) return []
  const { rows } = await db.query(
    'SELECT subtopic_id, subtopic FROM subtopics WHERE topic_id = $1 ORDER BY subtopic',
    [topicId],
  )
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.subtopic_id),
    name: String(r.subtopic),
  }))
}
