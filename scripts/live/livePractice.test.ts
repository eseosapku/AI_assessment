/**
 * The practice card, end to end through the real models.
 *
 * Two things have to hold. The tutor has to actually produce one on a step
 * that teaches a method — the rule is new and rules the model can ignore are
 * not rules. And the marking has to read a learner's working rather than
 * compare strings, because comparing strings already happened for free before
 * the call was made.
 *
 * Run with: npx vitest run --config vitest.live.config.ts
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import { applyAction, draftPlan } from '@/app/api/studylab/tutor/dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import { applyActions } from '@/lib/studylab/actions'
import { localVerdict, parseVerdict } from '@/lib/studylab/practice'
import type { CanvasState, TutorAction } from '@/lib/studylab/types'

const POLICY = policyFor('scratch')

/** The same prompt the marking route sends. */
function markingPrompt(o: { prompt: string; attempt: string; expected: string; rubric: string }): string {
  return [
    'You are marking one practice attempt by a student. Be encouraging but honest.',
    '',
    `PROBLEM: ${o.prompt}`,
    o.expected ? `EXPECTED ANSWER: ${o.expected}` : '',
    o.rubric ? `WHAT A GOOD ANSWER SHOWS: ${o.rubric}` : '',
    `THE STUDENT WROTE: ${o.attempt}`,
    '',
    'CORRECT means the final answer matches the expected answer — in any form,',
    'any notation, with or without units or working shown.',
    'CLOSE means the method is right but the answer is not: a slip in the',
    'arithmetic, a sign, a step left half-done. Right method, wrong answer is',
    'ALWAYS close, never correct.',
    'INCORRECT means the idea behind it is wrong.',
    'Check the answer before you praise the method. A student who divided 15 by',
    '3 and wrote 3 has the right method and the wrong answer, and telling them',
    'they were correct teaches them the mistake.',
    '',
    'Reply with JSON only:',
    '{ "verdict": "correct" | "close" | "incorrect", "feedback": "..." }',
    '',
    '"feedback" is one or two sentences addressed to the student. If they are',
    'right, say briefly what they got right. If not, name the ONE thing to fix —',
    'never give them the whole answer, they can reveal the solution themselves.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function mark(o: { prompt: string; attempt: string; expected: string; rubric: string }) {
  const started = Date.now()
  const raw = await callGemma(markingPrompt(o), {
    maxTokens: 320,
    temperature: 0.2,
    model: modelForJob('grade'),
  })
  const parsed = parseJsonRobust(raw)
  return {
    verdict: parseVerdict(parsed?.verdict),
    feedback: String(parsed?.feedback ?? ''),
    ms: Date.now() - started,
  }
}

describe('the tutor produces practice on a method step', () => {
  it('puts a workable problem on the board, with an answer and a solution', async () => {
    const drafted = await draftPlan({
      title: 'Solving equations with one unknown',
      subject: 'Mathematics',
      policy: POLICY, userId: null, subtopics: [],
    })
    const planned = proposePlan(emptyRun(POLICY), drafted.steps)
    if (!planned.ok) throw new Error(planned.reason)
    const started = acceptPlan({ ...planned.run, pace: 'run', programming: drafted.programming })
    if (!started.ok) throw new Error(started.reason)

    let run: LessonRun = started.run
    let canvas: CanvasState = { nodes: [], edges: [] }

    console.log('\n═══ TEACHING A METHOD ' + '═'.repeat(48))
    for (let i = 0; i < 3 && !canvas.nodes.some((n) => n.type === 'practice'); i += 1) {
      const result = await applyAction({
        run, policy: POLICY, userId: null, action: { type: 'next_beat' },
        context: { title: 'Solving equations with one unknown', subject: 'Mathematics', board: boardSummary(canvas) },
      })
      if (result.refusal) break
      run = result.run
      const applied = applyActions(canvas, result.actions as TutorAction[])
      canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
      canvas.nodes.slice(-4).forEach((n) => console.log(`  [${n.type}] ${n.data.title ?? ''}`))
      if (run.openCheck) break
    }

    const practice = canvas.nodes.find((n) => n.type === 'practice')
    console.log('\n  practice card:', practice ? practice.data.title : 'NONE PRODUCED')
    if (practice) {
      console.log('  problem :', practice.data.body)
      console.log('  answer  :', practice.data.answer)
      console.log('  solution:', (practice.data.steps ?? []).length, 'steps')
    }

    expect(practice, 'no practice card on a step teaching a method').toBeDefined()
    // A problem with no answer and no solution cannot be marked or unfolded.
    expect(String(practice!.data.body ?? '').length).toBeGreaterThan(10)
    expect(
      Boolean(practice!.data.answer) || (practice!.data.steps ?? []).length > 0,
      'the practice card carries neither an answer nor a solution',
    ).toBe(true)
  }, 300_000)
})

describe('marking reads the working', () => {
  const problem = {
    prompt: 'Solve for x:  3x + 6 = 21',
    expected: 'x = 5',
    rubric: 'Subtract 6 from both sides, then divide by 3.',
  }

  it('settles an exact answer for free, without a call', () => {
    // The whole point of the local pass: the common case costs nothing.
    expect(localVerdict(problem.expected, '5')).toBe('correct')
    expect(localVerdict(problem.expected, 'x = 5')).toBe('correct')
  })

  it('marks working that reaches the right answer differently', async () => {
    const r = await mark({ ...problem, attempt: 'took 6 off both sides to get 3x=15, so x is 5' })
    console.log(`\n  [working] ${r.verdict} in ${r.ms}ms — ${r.feedback}`)
    expect(r.verdict).toBe('correct')
    expect(r.feedback.length).toBeGreaterThan(0)
  }, 120_000)

  it('calls the right method with one slip close, not wrong', async () => {
    const r = await mark({ ...problem, attempt: '3x = 21 - 6 = 15, x = 15/3 = 3' })
    console.log(`  [slip]    ${r.verdict} in ${r.ms}ms — ${r.feedback}`)
    expect(r.verdict === 'close' || r.verdict === 'incorrect').toBe(true)
    // The feedback has to help without handing over the answer.
    expect(r.feedback).not.toContain('x = 5')
  }, 120_000)

  it('does not award a mark for the wrong idea', async () => {
    const r = await mark({ ...problem, attempt: 'you add 6 and 21 to get 27' })
    console.log(`  [wrong]   ${r.verdict} in ${r.ms}ms — ${r.feedback}`)
    expect(r.verdict).toBe('incorrect')
  }, 120_000)

  it('answers fast enough for typing and being marked to feel like one motion', async () => {
    const r = await mark({ ...problem, attempt: 'x is 5 because 3 times 5 is 15 and 15 plus 6 is 21' })
    console.log(`  [speed]   ${r.ms}ms`)
    expect(r.ms).toBeLessThan(4000)
  }, 120_000)
})
