/**
 * The lesson paths that are not "a scratch lesson, taught one beat at a time".
 *
 * Run pace, testing out of a step, and a programming lesson each go through
 * different code and a different model, and each was only ever exercised by a
 * mock returning exactly what the code hoped for.
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
import { isValidQuestion } from '@/lib/studylab/quiz'
import type { CanvasState } from '@/lib/studylab/types'

const SCRATCH = policyFor('scratch')

async function start(title: string, pace: 'step' | 'run') {
  const drafted = await draftPlan({
    title, subject: null, policy: SCRATCH, userId: null, subtopics: [],
  })
  const planned = proposePlan(emptyRun(SCRATCH), drafted.steps)
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan({ ...planned.run, pace, programming: drafted.programming })
  if (!started.ok) throw new Error(started.reason)
  return { run: started.run, drafted }
}

describe('run pace', () => {
  it('builds a whole step in one turn and ends it with a check', async () => {
    const { run } = await start('Solving quadratic equations', 'run')

    const result = await applyAction({
      run, policy: SCRATCH, userId: null, action: { type: 'next_beat' },
      context: { title: 'Solving quadratic equations', board: boardSummary({ nodes: [] }) },
    })
    expect(result.refusal).toBeUndefined()

    const { nodes } = applyActions({ nodes: [], edges: [] }, result.actions as never)
    const cards = nodes.filter((n) => n.data.title)
    console.log('\n─── RUN PACE, ONE TURN ' + '─'.repeat(45))
    nodes.forEach((n) => console.log(`  [${n.type}] ${n.data.title ?? '(untitled)'}`))

    // "Whole step at once" has to mean more than one card, or it is
    // indistinguishable from the setting beside it.
    expect(cards.length).toBeGreaterThanOrEqual(2)
    // And it has to stop somewhere the learner can act.
    expect(nodes.some((n) => n.type === 'quiz' || n.type === 'checkpointHeader')).toBe(true)
    // A run that opens a check must record it, or nothing can ever answer it.
    expect(result.run.openCheck).toBeDefined()
  }, 300_000)
})

describe('testing out of a step', () => {
  it('produces questions the canvas can actually render', async () => {
    const { run } = await start('The water cycle', 'step')
    // A step that is not the one being taught: test-out is for skipping ahead.
    const target = run.steps[1]
    expect(target).toBeDefined()

    const result = await applyAction({
      run, policy: SCRATCH, userId: null,
      action: { type: 'test_out', stepId: target.id, checkpointId: 'cp-testout-1' },
      context: { title: 'The water cycle' },
    })

    console.log('\n─── TEST OUT: ' + target.title + ' ' + '─'.repeat(30))
    if (result.refusal) console.log('  REFUSED:', result.refusal)
    expect(result.refusal).toBeUndefined()

    const checkpoint = result.actions[0] as { questions: unknown[] }
    checkpoint.questions.forEach((q) =>
      console.log('  ' + JSON.stringify(q).slice(0, 150)),
    )

    // The failure this guards: questions that parse, validate as junk, and
    // leave an open check nothing can ever resolve.
    expect(checkpoint.questions.length).toBeGreaterThan(0)
    expect(checkpoint.questions.every(isValidQuestion)).toBe(true)
    expect(result.run.openCheck?.stepId).toBe(target.id)
  }, 300_000)
})

describe('a programming lesson', () => {
  it('is recognised as one, and keeps its runnable cards', async () => {
    const { run, drafted } = await start('Python for loops', 'run')
    console.log('\n─── PROGRAMMING LESSON ' + '─'.repeat(45))
    console.log('  programming?', drafted.programming)
    // The flag gates the code and web cards; getting it wrong here would strip
    // the runnable cards out of the one kind of lesson that needs them.
    expect(drafted.programming).toBe(true)

    const result = await applyAction({
      run, policy: SCRATCH, userId: null, action: { type: 'next_beat' },
      context: { title: 'Python for loops', board: boardSummary({ nodes: [] }) },
    })
    const { nodes } = applyActions({ nodes: [], edges: [] } as CanvasState, result.actions as never)
    nodes.forEach((n) => console.log(`  [${n.type}] ${n.data.title ?? '(untitled)'}`))
    expect(nodes.length).toBeGreaterThan(0)
  }, 300_000)
})
