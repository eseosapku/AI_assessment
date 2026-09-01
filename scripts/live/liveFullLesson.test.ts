/**
 * A whole lesson, start to finish, through the real models.
 *
 * The other live tests exercise one path each. This one plays a lesson the way
 * a learner would: draft, push back on the plan, accept, teach every step to
 * its check, answer each one, steer in the middle, and carry on until the run
 * reports itself done.
 *
 * It asserts as it goes rather than at the end, so a failure names the turn it
 * happened on. Everything it checks is something that has actually reached a
 * learner at some point: repeated cards, narration with no card behind it, a
 * step that never closes, LaTeX in a title, a diagram that will not parse.
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
import {
  emptyRun, proposePlan, acceptPlan, type LessonRun,
} from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import { applyActions } from '@/lib/studylab/actions'
import { sanitiseMermaid } from '@/lib/studylab/mermaid'
import { isValidQuestion } from '@/lib/studylab/quiz'
import type { CanvasState, TutorAction } from '@/lib/studylab/types'

const POLICY = policyFor('scratch')
const TITLE = 'Why ice floats on water'

/** Same-words-different-order comparison, for near-duplicate titles. */
const normalise = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !['with', 'that', 'this', 'from', 'your', 'what', 'does'].includes(w))
    .sort().join(' ')

interface Problem { turn: string; what: string }

describe('a whole lesson, played to the end', () => {
  it('plans, teaches, checks and finishes without breaking anything on the way', async () => {
    const problems: Problem[] = []
    const note = (turn: string, what: string) => problems.push({ turn, what })

    let canvas: CanvasState = { nodes: [], edges: [] }
    const said: string[] = []
    let calls = 0

    // ── 1. the plan, and pushing back on it ────────────────────────────────
    const first = await draftPlan({
      title: TITLE, subject: null, policy: POLICY, userId: null, subtopics: [],
    })
    calls += 1
    console.log('\n═══ PLAN ' + '═'.repeat(62))
    first.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.title}`))
    console.log('  asked:', first.questions)

    expect(first.steps.length).toBeGreaterThanOrEqual(POLICY.planSize.min)
    expect(first.steps.length).toBeLessThanOrEqual(POLICY.planSize.max)
    expect(first.questions.length, 'the plan asked nothing, so there was nothing to negotiate').toBeGreaterThan(0)
    expect(first.programming, 'a physics lesson was classed as programming').toBe(false)
    expect(first.steps.every((s) => s.subtopicId === undefined)).toBe(true)

    const redrafted = await draftPlan({
      title: TITLE, subject: null, policy: POLICY, userId: null, subtopics: [],
      answer: 'Just enough to explain it to a friend. Skip the maths.',
    })
    calls += 1
    console.log('\n═══ REDRAFTED ' + '═'.repeat(57))
    redrafted.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.title}`))
    expect(redrafted.steps.length).toBeGreaterThan(0)
    // A redraft must not ask again — asking twice turns setup into interrogation.
    expect(redrafted.questions, 'the redraft asked more questions').toEqual([])

    const planned = proposePlan(emptyRun(POLICY), redrafted.steps)
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const started = acceptPlan({ ...planned.run, programming: redrafted.programming })
    expect(started.ok).toBe(true)
    if (!started.ok) return

    let run: LessonRun = started.run

    // ── 2. one turn ────────────────────────────────────────────────────────
    const turn = async (
      action: Parameters<typeof applyAction>[0]['action'],
      label: string,
    ) => {
      const before = canvas.nodes.length
      const result = await applyAction({
        run, policy: POLICY, userId: null, action,
        context: { title: TITLE, subject: null, board: boardSummary(canvas) },
      })
      calls += 1

      if (result.refusal) {
        console.log(`  [${label}] REFUSED: ${result.refusal}`)
        return result
      }
      run = result.run

      if (result.actions.length > 0) {
        const applied = applyActions(canvas, result.actions as TutorAction[])
        canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
      }
      const made = canvas.nodes.length - before

      // The failure that started all of this: chat narrates a card, board gains
      // nothing, because the reducer dropped a duplicate.
      if (result.say && made === 0 && !result.ack) {
        note(label, `narrated "${result.say.slice(0, 60)}…" but built nothing`)
      }
      if (result.say) said.push(result.say)
      console.log(`  [${label}] +${made} | ${(result.ack || result.say).slice(0, 78)}`)
      return result
    }

    // ── 3. teach every step to its check, and answer it ────────────────────
    console.log('\n═══ TEACHING ' + '═'.repeat(58))
    const MAX_TURNS_PER_STEP = 6

    for (let stepIndex = 0; stepIndex < run.steps.length; stepIndex += 1) {
      const step = run.steps[run.currentStep]
      if (!step) break
      console.log(`\n─── step ${run.currentStep + 1}: ${step.title}`)

      let turns = 0
      while (!run.openCheck && turns < MAX_TURNS_PER_STEP && run.phase === 'teaching') {
        await turn({ type: 'next_beat' }, `beat ${turns + 1}`)
        turns += 1
      }

      if (!run.openCheck) {
        note(`step ${run.currentStep + 1}`, `never closed after ${turns} turns — the learner cannot finish it`)
        break
      }

      const onStep = canvas.nodes.filter(
        (n) => n.data.step === run.currentStep + 1 && n.data.title,
      ).length
      if (onStep > 6) note(`step ${run.currentStep + 1}`, `${onStep} cards before its check`)

      const wasStep = run.currentStep
      await turn({ type: 'answer_check', passed: true }, 'answer check')
      if (run.currentStep === wasStep && run.phase !== 'done') {
        note(`step ${wasStep + 1}`, 'passing the check did not move the lesson on')
        break
      }
      if (run.phase === 'done') break
    }

    // ── 4. steering, mid-lesson ────────────────────────────────────────────
    console.log('\n═══ STEERING ' + '═'.repeat(58))
    const askResult = await turn(
      { type: 'ask', question: 'Can you give me a real-world example of this?' },
      'ask',
    )
    if (!askResult.refusal) {
      expect(askResult.actions.length, 'a question was answered in chat with no card').toBeGreaterThan(0)
    }

    const paced = await turn({ type: 'set_pace', pace: 'run' }, 'set pace')
    expect(paced.ack, 'changing pace said nothing').toBeTruthy()
    expect(paced.run.pace).toBe('run')

    const backTo = run.steps[0].id
    const jumped = await turn({ type: 'jump', stepId: backTo }, 'jump back to step 1')
    expect(jumped.refusal).toBeUndefined()
    // Going back to a taught step reveals it rather than rebuilding it.
    expect(jumped.actions, 'jumping back rebuilt a step that already had cards').toEqual([])
    expect(jumped.ack).toBeTruthy()

    // ── 5. what ended up on the board ──────────────────────────────────────
    console.log('\n═══ BOARD ' + '═'.repeat(61))
    const cards = canvas.nodes.filter(
      (n) => n.data.title && !['stepGroup', 'quiz', 'checkpointHeader'].includes(n.type),
    )
    cards.forEach((n) => console.log(`  [${n.type}] ${n.data.title}`))

    const titles = cards.map((n) => String(n.data.title))
    const dupes = titles
      .map(normalise)
      .filter((t) => t.split(' ').length >= 2)
      .filter((t, i, a) => a.indexOf(t) !== i)
    if (dupes.length) note('board', `near-duplicate cards: ${dupes.join(' | ')}`)

    const kinds = new Set(cards.map((n) => n.type))
    if (kinds.size < 2) note('board', `every card was a "${[...kinds][0]}" card`)

    const latexTitles = titles.filter((t) => t.includes('$'))
    if (latexTitles.length) note('board', `raw LaTeX in a title: ${latexTitles.join(' | ')}`)

    const codeCards = cards.filter((n) => n.type === 'code' || n.type === 'web')
    if (codeCards.length) note('board', `runnable card in a physics lesson: ${codeCards.map((n) => n.data.title).join(', ')}`)

    const empty = cards.filter(
      (n) => ['concept', 'callout'].includes(n.type) && !(n.data.body ?? '').trim() && !(n.data.items ?? []).length,
    )
    if (empty.length) note('board', `card with a title and no content: ${empty.map((n) => n.data.title).join(', ')}`)

    for (const n of canvas.nodes.filter((x) => x.type === 'mermaid')) {
      const src = sanitiseMermaid(String(n.data.mermaid ?? ''))
      if (!src) note('board', `mermaid card "${n.data.title}" has no diagram in it`)
    }

    for (const n of canvas.nodes.filter((x) => x.type === 'quiz')) {
      const q = n.data.quiz?.question
      if (q && !isValidQuestion(q)) note('board', `unrenderable question on "${n.data.title}"`)
    }

    const openers = said.map((s) => s.split(' ').slice(0, 4).join(' ').toLowerCase())
    const repeatedOpeners = openers.filter((o, i, a) => a.indexOf(o) !== i)
    if (repeatedOpeners.length > 1) note('chat', `repeated openers: ${[...new Set(repeatedOpeners)].join(' | ')}`)

    // ── 6. the verdict ─────────────────────────────────────────────────────
    console.log('\n═══ RESULT ' + '═'.repeat(60))
    console.log(`  steps: ${run.steps.length} | settled: ${run.steps.filter((s) => s.status === 'done' || s.status === 'known').length}`)
    console.log(`  cards: ${cards.length} | checks: ${canvas.nodes.filter((n) => n.type === 'quiz').length}`)
    console.log(`  card types: ${[...kinds].join(', ')}`)
    console.log(`  model calls: ${calls}`)
    console.log(`  phase: ${run.phase}`)
    if (problems.length === 0) console.log('  no problems found')
    else problems.forEach((p) => console.log(`  ✗ [${p.turn}] ${p.what}`))

    // Jumping back is browsing a finished lesson, not reopening it.
    if (run.steps.every((s) => s.status === 'done' || s.status === 'known') && run.phase !== 'done') {
      note('finish', `every step settled but the run still reports "${run.phase}"`)
    }

    expect(cards.length).toBeGreaterThan(3)
    expect(problems).toEqual([])
  }, 900_000)
})
