/**
 * Does a blueprinted Checkpoint paper actually come back?
 *
 * This is the test for the failure that produced "Failed to generate 15
 * questions. The AI produced 14." The route demands the exact count it was
 * asked for, and the first Checkpoint build sent it the strand names —
 * `Biology, Chemistry, Physics, Earth and Space` — as its entire topic list.
 * Those are four disciplines, not four topics: with no source text and nothing
 * more specific to aim at, the model wrote the same handful of ideas
 * repeatedly, the deduplicator removed the repeats, the paper came up short,
 * and three retries re-sent the identical prompt and produced more of the same.
 *
 * The blueprint names a distinct focus per question, which is both the fix and
 * simply what a paper is. **No mocked test can catch a regression here**: the
 * failure lives entirely in what the model does with the prompt.
 *
 * Makes real paid model calls — a full paper is around thirty questions. Needs
 * the dev server running.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveCheckpointPaper
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { checkpointSubject, stageOf } from '@/lib/cambridge-checkpoint'
import {
  buildPaper, applyBlueprint, paperTopics, paperBrief, awardedTotal, PAPER_MARKS,
} from '@/lib/checkpoint-paper'
import { checkpointReport } from '@/lib/checkpoint-report'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('a blueprinted Lower Secondary Science paper', () => {
  it('comes back whole, at the length its marks imply', async () => {
    const paper = buildPaper(SCIENCE, SCIENCE.components[0], { mode: 'paper', seed: 20260914 })
    const written = paper.slots.filter((s) => s.format === 'written').length
    console.log(
      `\nAsking for ${paper.slots.length} questions (${paper.slots.length - written} MCQ, ` +
      `${written} written) worth ${paper.totalMarks} marks`,
    )

    const res = await fetch('http://localhost:3000/api/generate-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Science',
        topics: paperTopics(paper),
        count: paper.slots.length,
        questionType: 'mixed',
        style: `Cambridge Lower Secondary Checkpoint ${SCIENCE.code}/01 practice`,
        className: `Stage ${stageOf('lower-secondary')}`,
        grade: stageOf('lower-secondary'),
        estimatedTime: paper.minutes,
        curriculum: 'checkpoint',
        difficultyLevel: 'average',
        examPrepContext: [
          `Cambridge Science ${SCIENCE.code}/01, Stage 9. The paper is worth ${paper.totalMarks} marks.`,
          'Below is the paper plan. Write EXACTLY these questions, in this order, one per line of the plan.',
          '',
          'PAPER PLAN:',
          paperBrief(paper),
        ].join('\n'),
      }),
    })
    const json = await res.json()

    // The regression itself: a short paper is a failed request, not a shorter
    // paper. Reporting the route's own message makes the cause readable.
    expect(json?.error ?? null, `route refused the paper: ${json?.error}`).toBeNull()
    const raw = json?.questions ?? []
    console.log(`Route returned ${raw.length} questions`)
    expect(raw.length).toBe(paper.slots.length)

    const questions = applyBlueprint(raw, paper) as any[]
    expect(questions).toHaveLength(paper.slots.length)
    expect(awardedTotal(questions), 'the paper is not worth 50 marks').toBe(PAPER_MARKS)

    // Every question answered correctly must come to full marks, or the
    // scoring does not line up with the paper the learner sat.
    const report = checkpointReport(questions, questions.map(() => true), SCIENCE)
    expect(report.score).toBe(PAPER_MARKS)
    expect(report.outOf).toBe(PAPER_MARKS)

    console.log(`\n${questions.length} questions, ${SCIENCE.code}/01`)
    report.strands.forEach((s) =>
      console.log(
        `  ${s.assessed ? `${String(s.earned)}/${String(s.available)} marks over ${s.questions} q` : 'not assessed'}  ${s.strand}`,
      ),
    )

    // Every strand is commissioned, so every strand must report. A strand
    // reading "not assessed" here means the blueprint did not survive.
    const unassessed = report.strands.filter((s) => !s.assessed).map((s) => s.strand)
    expect(unassessed, `strands missing from a full paper: ${unassessed.join(', ')}`).toEqual([])

    // The written answers are the half that carries the marks.
    const longform = questions.filter((q) => q.type === 'longform')
    console.log(`\nWritten answers: ${longform.length}`)
    longform.slice(0, 3).forEach((q) =>
      console.log(`  [${q.marks}m ${q.strand}] ${String(q.question).slice(0, 110)}`),
    )
    expect(longform.length, 'the paper came back all multiple choice').toBeGreaterThan(0)

    // A stem printing a different number from the one it is worth leaves the
    // learner with two marks and no way to tell which counts.
    for (const q of longform) {
      const printed = String(q.question).match(/\(\s*(\d+)\s*marks?\s*\)/i)
      if (printed) expect(Number(printed[1]), String(q.question).slice(0, 80)).toBe(q.marks)
    }

    questions.filter((q) => q.type !== 'longform').slice(0, 3).forEach((q) =>
      console.log(`  [1m ${q.strand}] ${String(q.question).slice(0, 110)}`),
    )
  }, 600_000)
})
