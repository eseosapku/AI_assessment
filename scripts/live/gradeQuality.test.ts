/**
 * Generate at the grade extremes and read what comes back.
 *
 * `qaSweep` samples the curriculum surface: every curriculum, every question
 * type, one class per curriculum. It answers "does it generate, and is it
 * structurally sound". It cannot answer the question a teacher actually asks,
 * which is whether a Primary 1 paper is a Primary 1 paper.
 *
 * The faults that matter most turned up nowhere near the middle of the range:
 *
 *   - Primary 1 Maths: "What is the total of 3 and 4?" marked A (6), explained
 *     "Option B (7) is correct". The child answers 7 and is marked wrong.
 *   - Primary 1 English: "Which word has the same sound as 'cat'?" over bat,
 *     hat, mat, sat. Four options, four right answers.
 *   - Senior Music: "equivalent to two half notes?" marked "four eighth notes",
 *     which is half the value.
 *
 * None of these are structural. Every one passes an index check, an option
 * count, a duplicate scan. They are only visible by reading -- so this samples
 * the bottom of the range (where the model over-reaches) and the risky
 * subjects (where it invents), saves every paper to disk unabridged, and
 * audits with the content checks that now exist.
 *
 * Makes real paid model calls and needs the dev server running.
 *
 * Run with:
 *   npx vitest run --config vitest.live.config.ts gradeQuality
 *   GQ_COUNT=6 npx vitest run --config vitest.live.config.ts gradeQuality
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { auditPaper, summariseFindings, type AuditFinding } from '@/lib/question-audit'

const BASE = process.env.GQ_BASE || 'http://localhost:3000'
const COUNT = Number(process.env.GQ_COUNT || 6) || 6

interface Case {
  label: string
  subject: string
  topic: string
  className: string
  grade: number
  curriculum: string
  type: string
}

/**
 * Two bands, chosen for where things go wrong rather than for coverage.
 *
 * The bottom of the range is where a model writes at its own reading level
 * instead of the learner's, and where an arithmetic slip goes unnoticed
 * because the numbers look too small to check. The risky subjects are where
 * it invents a text, a recording, or a picture nobody has.
 */
const CASES: Case[] = [
  // Bottom of the range. A six-year-old cannot read past a slip.
  { label: 'P1 Maths', subject: 'Mathematics', topic: 'Adding numbers up to 10', className: 'P1', grade: 1, curriculum: 'rwanda', type: 'mcq' },
  { label: 'P1 English', subject: 'English', topic: 'Letter sounds and simple words', className: 'P1', grade: 1, curriculum: 'rwanda', type: 'mcq' },
  { label: 'P2 Maths', subject: 'Mathematics', topic: 'Subtraction within 20', className: 'P2', grade: 2, curriculum: 'rwanda', type: 'mcq' },
  { label: 'P3 Science', subject: 'Science', topic: 'Plants and their parts', className: 'P3', grade: 3, curriculum: 'rwanda', type: 'mcq' },
  { label: 'P4 English', subject: 'English', topic: 'Reading simple sentences', className: 'P4', grade: 4, curriculum: 'rwanda', type: 'mcq' },

  // The subjects that need something the learner has not been given.
  { label: 'S3 Music', subject: 'Music', topic: 'Note values and rhythm', className: 'S3', grade: 9, curriculum: 'rwanda', type: 'mcq' },
  { label: 'S2 Fine Art', subject: 'Fine Art', topic: 'Elements of art', className: 'S2', grade: 8, curriculum: 'rwanda', type: 'mcq' },
  { label: 'S5 Literature', subject: 'Literature', topic: 'Poetry appreciation', className: 'S5', grade: 11, curriculum: 'rwanda', type: 'mcq' },
  { label: 'S4 Religion', subject: 'Religion', topic: 'Religious values and ethics', className: 'S4', grade: 10, curriculum: 'rwanda', type: 'mcq' },

  // Top of the range, long form, where mark budgets and criteria drift.
  { label: 'S6 Chemistry LF', subject: 'Chemistry', topic: 'Organic reaction mechanisms', className: 'S6', grade: 12, curriculum: 'rwanda', type: 'longform' },
  { label: 'S3 History LF', subject: 'History', topic: 'Colonial rule in Africa', className: 'S3', grade: 9, curriculum: 'rwanda', type: 'longform' },
  { label: 'S3 Maths LF', subject: 'Mathematics', topic: 'Simultaneous equations', className: 'S3', grade: 9, curriculum: 'rwanda', type: 'longform' },
]

let call = 0

describe('the grade extremes and the risky subjects', () => {
  it('generates, audits and saves every paper for reading', async () => {
    const rows: { c: Case; error: string | null; qs: unknown[]; findings: AuditFinding[]; ms: number }[] = []

    for (const c of CASES) {
      const started = Date.now()
      // Same identity rotation as qaSweep, and sound for the same reason: a
      // local dev server, never production. See the note there.
      const res = await fetch(`${BASE}/api/generate-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.9.${call % 256}.${(call * 7) % 256}` },
        body: JSON.stringify({
          subject: c.subject, topics: [c.topic], count: COUNT, questionType: c.type,
          style: 'quiz', className: c.className, grade: c.grade,
          curriculum: c.curriculum, difficultyLevel: 'average',
        }),
      })
      call++
      const json: any = await res.json().catch(() => ({ error: 'unparseable response' }))
      const qs = json?.questions ?? []
      const findings = json?.error ? [] : auditPaper(qs, { expectedCount: COUNT })
      rows.push({ c, error: json?.error ?? null, qs, findings, ms: Date.now() - started })

      const broken = findings.filter((f) => f.severity === 'broken').length
      const poor = findings.filter((f) => f.severity === 'poor').length
      console.log(
        `  ${json?.error ? 'FAIL ' : 'ok   '}${c.label.padEnd(18)}` +
        (json?.error ? String(json.error).slice(0, 44) : `${qs.length}/${COUNT}q  broken ${broken}  poor ${poor}`),
      )
    }

    const summary = summariseFindings(rows.flatMap((r) => r.findings))
    console.log('\n' + '='.repeat(60))
    console.log(`papers   : ${rows.filter((r) => !r.error).length}/${rows.length}`)
    console.log(`broken   : ${summary.broken}`)
    console.log(`poor     : ${summary.poor}`)
    for (const r of summary.byCode) {
      console.log(`  ${r.severity === 'broken' ? 'BROKEN' : 'poor  '} ${String(r.count).padStart(3)}  ${r.code}`)
    }

    // The whole point is that these faults are only visible by reading, so
    // the paper goes to disk in full rather than as a count.
    fs.writeFileSync(
      'qa-grade-quality.json',
      JSON.stringify({ ranAt: new Date().toISOString(), count: COUNT, rows }, null, 1),
      'utf8',
    )
    console.log('\nfull papers: qa-grade-quality.json')

    expect(rows.length).toBe(CASES.length)
  }, 1_800_000)
})
