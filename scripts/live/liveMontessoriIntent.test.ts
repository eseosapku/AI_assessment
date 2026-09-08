/**
 * Does the tutor actually reason about the material, or does it still reach
 * for a sorting frame?
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveMontessoriIntent
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { applyAction } from '@/app/api/studylab/tutor/dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import type { CanvasState } from '@/lib/studylab/types'
import { applyActions } from '@/lib/studylab/actions'

const POLICY = policyFor('scratch')

/**
 * Teach the first step of a one-step lesson on `topic`, in montessori mode,
 * and hand back what the turn produced.
 *
 * Drives the real dispatcher exactly as `liveLesson.test.ts` does, rather than
 * calling the model directly — the filtering and refusing under test only
 * happen on this path.
 */
async function runMontessoriTurn(topic: string) {
  const planned = proposePlan(emptyRun(POLICY), [
    { id: 's1', title: topic, goal: topic, status: 'pending', cardIds: [] },
  ])
  if (!planned.ok) throw new Error(`could not plan ${topic}: ${planned.reason}`)

  // proposePlan alone leaves phase 'planning', where next_beat is refused
  // before it ever reaches the model. acceptPlan is the pure state
  // transition that moves the plan into 'teaching' — no I/O, no cost — so
  // the one paid call below is next_beat itself, same as a real lesson.
  const accepted = acceptPlan(planned.run)
  if (!accepted.ok) throw new Error(`could not accept plan ${topic}: ${accepted.reason}`)

  let canvas: CanvasState = { nodes: [], edges: [] }
  const result = await applyAction({
    run: { ...accepted.run, mode: 'montessori' } as LessonRun,
    policy: POLICY,
    userId: null,
    action: { type: 'next_beat' },
    context: { title: topic, subject: null, board: boardSummary(canvas) },
  })
  if (result.actions.length > 0) {
    const applied = applyActions(canvas, result.actions as never)
    canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
  }
  return { result, canvas }
}

/** Topics chosen so that a sorting frame is the WRONG answer for most of them. */
const TOPICS = [
  'The order of events in mitosis',
  'Why a balanced equation must have equal atoms on both sides',
  'Naming the parts of a flower',
  'How interest rate changes feed through to inflation',
  'Telling igneous from sedimentary rock',
]

describe('a Montessori turn on five different topics', () => {
  it('states an intent that survives the check, and varies the apparatus', async () => {
    const chosen: string[] = []

    for (const topic of TOPICS) {
      const { result, canvas } = await runMontessoriTurn(topic)

      console.log(`\n  ${topic}`)
      console.log(`    [debug] dispatch refusal: ${result.refusal ?? '(none)'}`)
      console.log(`    [debug] say: ${(result.say ?? '(empty)').slice(0, 200)}`)
      console.log(`    [debug] actions: ${JSON.stringify(result.actions).slice(0, 2000)}`)
      ;(result.materialRefusals ?? []).forEach((r) => console.log(`    REFUSED: ${r}`))
      for (const intent of result.intents ?? []) {
        chosen.push(intent.apparatus)
        console.log(`    -> ${intent.apparatus} isolating ${intent.isolates}`)
        console.log(`       ${intent.why}`)
      }

      // A turn where everything was refused teaches nothing, which is worse
      // than the sorting frame it replaced.
      //
      // expect.soft, not expect: a topic that fails here must not stop the
      // other four from being tried. The five calls are what this run costs
      // real money for, and losing the rest to one early failure would throw
      // away evidence the next phase is decided on.
      const materials = canvas.nodes.filter((n) => n.type === 'activity')
      expect.soft(materials.length, `${topic}: no material survived the turn`).toBeGreaterThan(0)
      expect.soft(result.intents?.length ?? 0, `${topic}: no intent stated`).toBeGreaterThan(0)
    }

    // The fault this phase exists to fix: one apparatus for every topic.
    const distinct = new Set(chosen)
    console.log(`\napparatus used: ${[...distinct].join(', ')}`)
    expect(distinct.size, 'the tutor reached for the same apparatus every time').toBeGreaterThan(2)
  }, 300_000)
})
