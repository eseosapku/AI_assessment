/**
 * A lesson where the learner gets things wrong.
 *
 * The other live runs answer every check correctly, which is the happy path and
 * not the one that broke. This one fails a check on purpose and keeps going,
 * because that is the transcript that produced fifteen cards on one idea with
 * no way out.
 *
 * A humanities topic on purpose too: no numbers to hide behind, and the kind of
 * material where the tutor is most tempted to keep restating itself.
 *
 * Run with: npx vitest run --config vitest.live.config.ts
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { applyAction, draftPlan } from '@/app/api/studylab/tutor/dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import { applyActions } from '@/lib/studylab/actions'
import type { CanvasState, TutorAction } from '@/lib/studylab/types'

const POLICY = policyFor('scratch')
const TITLE = 'How to write a female character with real interiority'

describe('a lesson where checks get failed', () => {
  it('re-teaches, asks again, and still reaches the end', async () => {
    const problems: string[] = []

    const drafted = await draftPlan({
      title: TITLE, subject: null, policy: POLICY, userId: null, subtopics: [],
    })
    const planned = proposePlan(emptyRun(POLICY), drafted.steps)
    if (!planned.ok) throw new Error(planned.reason)
    const begun = acceptPlan({ ...planned.run, pace: 'step', programming: drafted.programming })
    if (!begun.ok) throw new Error(begun.reason)

    let run: LessonRun = begun.run
    let canvas: CanvasState = { nodes: [], edges: [] }

    console.log('\n═══ PLAN ' + '═'.repeat(62))
    run.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.title}`))

    const turn = async (action: Parameters<typeof applyAction>[0]['action'], label: string) => {
      const before = canvas.nodes.length
      const result = await applyAction({
        run, policy: POLICY, userId: null, action,
        context: { title: TITLE, subject: null, board: boardSummary(canvas) },
      })
      if (result.refusal) {
        console.log(`  [${label}] REFUSED: ${result.refusal}`)
        return result
      }
      run = result.run
      if (result.actions.length > 0) {
        const applied = applyActions(canvas, result.actions as TutorAction[])
        canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
      }
      console.log(`  [${label}] +${canvas.nodes.length - before} | ${(result.ack || result.say).slice(0, 70)}`)
      return result
    }

    // ── fail the first check, then behave normally ────────────────────────
    console.log('\n═══ FAILING THE FIRST CHECK ' + '═'.repeat(43))
    let failedOnce = false
    const HARD_CAP = 30
    let turns = 0
    let dead = 0

    while (run.phase === 'teaching' && turns < HARD_CAP) {
      turns += 1

      if (run.openCheck) {
        const stepNo = run.currentStep + 1
        if (!failedOnce) {
          failedOnce = true
          const failedId = run.openCheck.checkpointId
          await turn({ type: 'answer_check', passed: false, missed: ['the main idea'] }, `FAIL step ${stepNo}`)
          // The failed check must be cleared. A new one opening on the same
          // turn is the retry arriving, which is the point — so compare ids
          // rather than merely asking whether a check is open.
          if (run.openCheck?.checkpointId === failedId) {
            problems.push('the failed check stayed open, so nothing can be re-taught')
          }
          if (run.steps[stepNo - 1].status === 'done') {
            problems.push('a failed check marked the step done anyway')
          }
        } else {
          await turn({ type: 'answer_check', passed: true }, `pass step ${stepNo}`)
        }
        continue
      }

      const before = run.currentStep
      const cardsBefore = canvas.nodes.length
      await turn({ type: 'next_beat' }, `beat s${run.currentStep + 1}`)

      // The failure case: teaching that never stops and never re-checks.
      const onStep = canvas.nodes.filter(
        (n) => n.data.step === run.currentStep + 1 && n.data.title,
      ).length
      if (onStep > 8 && !run.openCheck) {
        problems.push(`step ${run.currentStep + 1} reached ${onStep} cards with no check in sight`)
        break
      }
      if (canvas.nodes.length === cardsBefore && run.currentStep === before) {
        // A dead turn now comes back as a refusal and the learner presses
        // again, so one is a retry rather than a stall. Several in a row is
        // the lesson failing to move.
        dead += 1
        if (dead >= 3) {
          problems.push(`${dead} turns in a row produced nothing — the lesson is stuck`)
          break
        }
      } else {
        dead = 0
      }
    }

    console.log('\n═══ BOARD ' + '═'.repeat(61))
    const cards = canvas.nodes.filter(
      (n) => n.data.title && !['stepGroup', 'quiz', 'checkpointHeader', 'stepRegion'].includes(n.type),
    )
    cards.forEach((n) => console.log(`  s${n.data.step} [${n.type}] ${n.data.title}`))

    const perStep = new Map<number, number>()
    for (const n of cards) perStep.set(Number(n.data.step), (perStep.get(Number(n.data.step)) ?? 0) + 1)
    const bloated = [...perStep.entries()].filter(([, n]) => n > 8)
    if (bloated.length) problems.push(`steps carrying too many cards: ${bloated.map(([s, n]) => `${s}=${n}`).join(', ')}`)

    const checks = canvas.nodes.filter((n) => n.type === 'checkpointHeader').length
    const failedStep = 1
    const checksOnFailed = canvas.nodes.filter(
      (n) => n.type === 'checkpointHeader' && Number(n.data.step) === failedStep,
    ).length
    if (checksOnFailed < 2) {
      problems.push(`the failed step got ${checksOnFailed} check(s) — a retry never arrived`)
    }

    console.log('\n═══ RESULT ' + '═'.repeat(60))
    console.log(`  turns: ${turns} (cap ${HARD_CAP}) | phase: ${run.phase}`)
    console.log(`  steps settled: ${run.steps.filter((s) => s.status === 'done' || s.status === 'known').length}/${run.steps.length}`)
    console.log(`  cards: ${cards.length} | checks: ${checks} | on the failed step: ${checksOnFailed}`)
    console.log(`  cards per step: ${[...perStep.entries()].map(([s, n]) => `${s}=${n}`).join(' ')}`)
    if (problems.length === 0) console.log('  no problems found')
    else problems.forEach((p) => console.log(`  ✗ ${p}`))

    expect(turns, 'the lesson never terminated').toBeLessThan(HARD_CAP)
    expect(run.phase, 'the lesson did not finish').toBe('done')
    expect(problems).toEqual([])
  }, 900_000)
})
