/**
 * End-to-end rehearsal of a scratch lesson against the live models.
 *
 * Not part of the suite — run explicitly. It makes real paid calls, because the
 * bugs it is looking for (repeated cards, narration with nothing behind it,
 * card types that do not fit the subject) only exist in what the model actually
 * returns. Every one of them passed the mocked tests.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { applyAction, draftPlan } from '@/app/api/studylab/tutor/dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import type { CanvasState } from '@/lib/studylab/types'
import { applyActions } from '@/lib/studylab/actions'

const SCRATCH = policyFor('scratch')
const TITLE = 'How Tarantino writes dialogue'

/** Cards on the board, as titles, for the duplication check. */
const titles = (c: CanvasState) =>
  c.nodes.filter((n) => n.data.title).map((n) => String(n.data.title))

/** Crude near-duplicate check: same significant words, any order. */
function normalise(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['with', 'that', 'this', 'from', 'your'].includes(w))
    .sort()
    .join(' ')
}

describe('a whole scratch lesson, live', () => {
  it('plans, teaches and checks without repeating itself', async () => {
    // ── 1. the plan, and the questions that come with it ──────────────────
    const drafted = await draftPlan({
      title: TITLE, subject: null, policy: SCRATCH, userId: null, subtopics: [],
    })
    console.log('\n─── PLAN ' + '─'.repeat(60))
    drafted.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} — ${s.goal}`))
    console.log('  QUESTIONS ASKED:', drafted.questions)

    expect(drafted.steps.length).toBeGreaterThanOrEqual(SCRATCH.planSize.min)
    expect(drafted.steps.length).toBeLessThanOrEqual(SCRATCH.planSize.max)
    // A scratch lesson has no curriculum to attribute to, so no step may claim one.
    expect(drafted.steps.every((s) => s.subtopicId === undefined)).toBe(true)
    // The setup exchange is the whole point of planning first.
    expect(drafted.questions.length).toBeGreaterThan(0)

    console.log('  programming lesson?', drafted.programming)
    expect(drafted.programming).toBe(false)

    const planned = proposePlan(emptyRun(SCRATCH), drafted.steps)
    expect(planned.ok).toBe(true)
    if (!planned.ok) return

    // ── 2. teach it, carrying the board each turn ─────────────────────────
    let run: LessonRun = { ...planned.run, programming: drafted.programming }
    let canvas: CanvasState = { nodes: [], edges: [] }
    const said: string[] = []
    let turnsThatBuiltNothing = 0

    const turn = async (action: Parameters<typeof applyAction>[0]['action']) => {
      const result = await applyAction({
        run, policy: SCRATCH, userId: null, action,
        context: { title: TITLE, subject: null, board: boardSummary(canvas) },
      })
      run = result.run
      if (result.refusal) {
        console.log('  REFUSED:', result.refusal)
        return result
      }
      const before = canvas.nodes.length
      if (result.actions.length > 0) {
        const applied = applyActions(canvas, result.actions as never)
        canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
      }
      const made = canvas.nodes.length - before
      if (result.say) said.push(result.say)
      // The exact failure on screen: chat narrates a card, board gains nothing.
      if (result.say && made === 0 && !result.ack) turnsThatBuiltNothing += 1
      console.log(`  [${action.type}] +${made} card(s) | say: ${result.say.slice(0, 90)}`)
      return result
    }

    await turn({ type: 'accept_plan', pace: 'step' })
    for (let i = 0; i < 5; i += 1) await turn({ type: 'next_beat' })

    console.log('\n─── BOARD ' + '─'.repeat(59))
    canvas.nodes.forEach((n) => console.log(`  [${n.type}] ${n.data.title ?? '(untitled)'}`))

    // ── 3. the assertions the screenshots would have failed ───────────────
    const built = titles(canvas)
    expect(built.length).toBeGreaterThan(0)

    const normalised = built.map(normalise)
    const duplicates = normalised.filter((t, i) => normalised.indexOf(t) !== i)
    console.log('\n  near-duplicate titles:', duplicates)
    expect(duplicates).toEqual([])

    console.log('  turns that narrated a card but built none:', turnsThatBuiltNothing)
    expect(turnsThatBuiltNothing).toBe(0)

    // Repeated chat lines are the same failure heard rather than seen.
    const saidNorm = said.map(normalise)
    expect(saidNorm.filter((t, i) => saidNorm.indexOf(t) !== i)).toEqual([])

    // A screenwriting lesson has no business emitting runnable code cards.
    const codeCards = canvas.nodes.filter((n) => n.type === 'code' || n.type === 'web')
    console.log('  code/web cards in a writing lesson:', codeCards.map((n) => n.data.title))
    expect(codeCards).toEqual([])

    // Six concept cards in a row is not duplication, but it is monotony — and
    // it is what "a whole lot of the same thing" describes.
    const kinds = canvas.nodes.filter((n) => n.data.title).map((n) => n.type)
    console.log('  card types used:', kinds.join(', '))
    expect(new Set(kinds).size).toBeGreaterThan(1)

    // A step the tutor never closes is a lesson that cannot be finished.
    const checked = canvas.nodes.some((n) => n.type === 'quiz' || n.type === 'checkpointHeader')
    console.log('  reached a checkpoint:', checked)
    expect(checked).toBe(true)

    // Openers must not all be the same sentence with a noun swapped.
    const firstFive = said.map((t) => t.split(' ').slice(0, 4).join(' ').toLowerCase())
    console.log('  say openers:', firstFive)
    expect(new Set(firstFive).size).toBeGreaterThan(said.length / 2)

    // Every card must carry real content, not just a title.
    const empty = canvas.nodes.filter(
      (n) =>
        ['concept', 'callout'].includes(n.type) &&
        !(n.data.body ?? '').trim() &&
        !(n.data.items ?? []).length,
    )
    expect(empty.map((n) => n.data.title)).toEqual([])
  }, 300_000)
})
