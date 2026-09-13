/**
 * Does a generated Checkpoint component actually spread across strands?
 *
 * Checkpoint reports at strand level, so the breakdown is the product. A paper
 * where every question lands in Biology produces a report that says nothing —
 * and that failure is invisible to every mocked test, because the mocks supply
 * the spread themselves.
 *
 * Makes real paid model calls. Needs the dev server running.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveCheckpointStrands
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { checkpointSubject, stageOf } from '@/lib/cambridge-checkpoint'
import { tagQuestionsWithStrands } from '@/lib/checkpoint-strands'
import { checkpointReport } from '@/lib/checkpoint-report'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('a generated Lower Secondary Science component', () => {
  it('spreads across strands instead of dwelling on one', async () => {
    const strands = [...SCIENCE.strands, SCIENCE.crossCuttingStrand].filter(Boolean) as string[]

    const res = await fetch('http://localhost:3000/api/generate-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Science',
        topics: strands,
        count: 10,
        questionType: 'mcq',
        style: `Cambridge Lower Secondary Checkpoint ${SCIENCE.code}/01 practice`,
        className: `Stage ${stageOf('lower-secondary')}`,
        grade: stageOf('lower-secondary'),
        difficultyLevel: 'average',
      }),
    })
    const json = await res.json()
    const questions = json?.questions ?? []
    expect(questions.length, `no questions came back: ${json?.error ?? 'unknown'}`).toBeGreaterThan(0)

    tagQuestionsWithStrands(questions, SCIENCE)
    const report = checkpointReport(questions, questions.map(() => true), SCIENCE)

    console.log(`\n${questions.length} questions, ${SCIENCE.code}/01`)
    report.strands.forEach((s) =>
      console.log(`  ${s.assessed ? `${String(s.total).padStart(2)} q` : 'not assessed'}  ${s.strand}`),
    )
    const matched = questions.filter((q: { strand_matched?: boolean }) => q.strand_matched).length
    console.log(`  matched to a strand: ${matched}/${questions.length}`)
    questions.slice(0, 4).forEach((q: { strand?: string; question?: string }) =>
      console.log(`    [${q.strand}] ${String(q.question).slice(0, 90)}`),
    )

    // The fault this exists to catch: the whole paper landing in one strand,
    // which makes the breakdown that IS the product say nothing.
    const assessed = report.strands.filter((s) => s.assessed)
    expect(assessed.length, 'the whole paper landed in one strand').toBeGreaterThan(1)

    // And a paper where almost nothing matched would report nearly every
    // strand "not assessed" — a failure of the tagger that reads as a finding
    // about the paper.
    expect(matched, 'too few questions matched any strand').toBeGreaterThan(questions.length / 3)
  }, 300_000)
})
