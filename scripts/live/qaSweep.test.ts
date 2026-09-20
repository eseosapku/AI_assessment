/**
 * Generate across the whole curriculum surface and audit what comes back.
 *
 * The platform has 654 textbooks, 3,663 topics and 12,276 subtopics across
 * five curricula, plus Checkpoint. Generating every subtopic in every question
 * type is about 61,000 model calls — days of wall time and a serious bill — so
 * this samples: every curriculum, every question type, spread across different
 * textbooks so one book's quirks cannot stand in for a whole curriculum.
 *
 * It changes nothing. Every paper is read by `lib/question-audit.ts` and the
 * findings counted by code, so the report says WHICH fault appears WHERE
 * rather than leaving someone to read a thousand questions.
 *
 * Two numbers matter:
 *   broken — cannot be answered or cannot be marked. Launch blockers.
 *   poor   — works, but a teacher would wince. Polish.
 *
 * Makes real paid model calls and needs the dev server running.
 *
 * Run with:
 *   npx vitest run --config vitest.live.config.ts qaSweep
 *   QA_PER=6 QA_TYPES=mcq,longform npx vitest run --config vitest.live.config.ts qaSweep
 *   QA_ONLY=checkpoint npx vitest run --config vitest.live.config.ts qaSweep
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { Pool } from 'pg'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { auditPaper, summariseFindings, type AuditFinding } from '@/lib/question-audit'
import { applyBlueprint } from '@/lib/checkpoint-paper'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const PER = Number(process.env.QA_PER || 2) || 2
const COUNT = Number(process.env.QA_COUNT || 8) || 8
const TYPES = String(process.env.QA_TYPES || 'mcq,longform,interactive').split(',').map((s) => s.trim()).filter(Boolean)
const ONLY = String(process.env.QA_ONLY || '')

// Each curriculum names its classes its own way, and sending another's is
// how the whole NERDC set came back 500: "S3" is Rwandan, and the Nigerian
// level lookup went undefined. The route no longer falls over on it, but a
// sweep that sends the wrong class is testing the fallback rather than the
// curriculum.
const CURRICULA = [
  { id: 0, slug: 'rwanda', label: 'REB Rwanda', className: 'S3', grade: 9 },
  { id: 1, slug: 'cambridge', label: 'Cambridge', className: 'Year 10', grade: 10 },
  { id: 2, slug: 'nigeria', label: 'NERDC Nigeria', className: 'JSS3', grade: 9 },
  { id: 3, slug: 'waec', label: 'WAEC', className: 'SS3 WASSCE', grade: 12 },
  { id: 4, slug: 'jamb', label: 'JAMB', className: 'UTME Candidate', grade: 12 },
]

interface Row {
  area: string
  label: string
  error: string | null
  ms: number
  count: number
  expected: number
  figures: number
  findings: AuditFinding[]
}

let sweepCall = 0

async function generate(body: Record<string, unknown>) {
  const started = Date.now()
  // The route allows 30 generations an hour per identity, which is a cost
  // ceiling on a real account and exactly right. A sweep asks for a hundred,
  // so it identifies each call separately -- otherwise 89 of 98 papers come
  // back "You have made a lot of requests" and the report measures the rate
  // limiter rather than the questions.
  //
  // Sound only because this runs against a local dev server for QA. Never
  // point it at production.
  //
  // Done with a header, NOT a synthetic user_id. Two earlier attempts show
  // why that matters: a readable id like "qa-sweep-1" fails every generation
  // on a Postgres uuid cast, and a well-formed random uuid is an unknown user
  // who has "used their free assessments". Both look exactly like generation
  // bugs in the report. identify() falls back to x-forwarded-for when there
  // is no user_id, which is the honest way to say "a different caller".
  const res = await fetch(`${BASE}/api/generate-assessment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(sweepCall / 256) % 256}.${sweepCall % 256}`,
    },
    body: JSON.stringify(body),
  })
  sweepCall++
  const json: any = await res.json().catch(() => ({ error: 'unparseable response' }))
  return { json, ms: Date.now() - started }
}

function line(r: Row) {
  const f = r.findings.length
    ? ` | broken ${r.findings.filter((x) => x.severity === 'broken').length} poor ${r.findings.filter((x) => x.severity === 'poor').length}`
    : r.error ? '' : ' | clean'
  const tail = r.error ? r.error.slice(0, 46) : `${r.count}/${r.expected}q ${r.figures}fig ${r.ms}ms${f}`
  console.log(`  ${r.error ? 'FAIL ' : 'ok   '}${r.label.slice(0, 50).padEnd(52)}${tail}`)
}

describe('the whole curriculum surface', () => {
  it('generates and audits a sample of every curriculum and question type', async () => {
    const results: Row[] = []

    if (ONLY !== 'checkpoint') {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
      for (const c of CURRICULA) {
        // Deliberately weighted toward the subjects that break differently.
        //
        // Literature leans on a text the learner has not been given, Art and
        // Music on something to look at or hear. Sampling at random would
        // mostly return Biology and Maths and report a health the risky
        // subjects do not share.
        const RISKY = "(literature|art|music|drama|poet|religio|history|civic|french|kiswahili|kinyarwanda|english)"
        const { rows: risky } = await pool.query(
          `SELECT DISTINCT ON (t.textbook_id) t.topic, b.textbook_name
             FROM topics t JOIN textbooks b ON b.textbook_id = t.textbook_id
            WHERE b.curriculum = $1 AND t.topic IS NOT NULL AND length(t.topic) > 3
              AND b.textbook_name ~* $3
            ORDER BY t.textbook_id, random() LIMIT $2`,
          [c.id, Math.ceil(PER / 2), RISKY],
        )
        const { rows: rest } = await pool.query(
          `SELECT DISTINCT ON (t.textbook_id) t.topic, b.textbook_name
             FROM topics t JOIN textbooks b ON b.textbook_id = t.textbook_id
            WHERE b.curriculum = $1 AND t.topic IS NOT NULL AND length(t.topic) > 3
              AND b.textbook_name !~* $3
            ORDER BY t.textbook_id, random() LIMIT $2`,
          [c.id, PER, RISKY],
        )
        const picked = [...risky, ...rest].slice(0, PER)
        console.log(`\n${c.label} — ${picked.length} topic(s) x ${TYPES.length} type(s)`)
        for (const t of picked) {
          for (const type of TYPES) {
            const { json, ms } = await generate({
              subject: String(t.textbook_name || 'Science').split(/[_\-\s]/)[0],
              topics: [t.topic], count: COUNT, questionType: type,
              style: 'quiz', className: c.className, grade: c.grade,
              curriculum: c.slug, difficultyLevel: 'average',
            })
            const row: Row = {
              area: c.label,
              label: `${type}: ${String(t.textbook_name).slice(0, 18)} / ${t.topic}`,
              error: json?.error ?? null, ms,
              count: json?.questions?.length ?? 0, expected: COUNT,
              figures: (json?.questions ?? []).filter((q: any) => q.image_url).length,
              findings: json?.error ? [] : auditPaper(json.questions, { expectedCount: COUNT }),
            }
            results.push(row); line(row)
          }
        }
      }
      await pool.end()
    }

    console.log('\nCheckpoint — every buildable component')
    for (const [programme, subject] of [
      ['lower-secondary', 'Science'], ['lower-secondary', 'Mathematics'],
      ['primary', 'Science'], ['primary', 'Mathematics'],
    ] as const) {
      for (const component of ['01', '02']) {
        const lay = await fetch(`${BASE}/api/checkpoint-paper`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programme, subject, component, mode: 'paper' }),
        })
        const lj: any = await lay.json()
        if (!lay.ok || !lj?.paper) {
          const row: Row = { area: 'Checkpoint', label: `${subject} ${programme}/${component}`, error: lj?.error ?? 'layout failed', ms: 0, count: 0, expected: 0, figures: 0, findings: [] }
          results.push(row); line(row); continue
        }
        const p = lj.paper
        const { json, ms } = await generate({
          subject, topics: lj.topics, count: p.slots.length, questionType: 'mixed',
          style: `Cambridge Checkpoint ${p.code}/${component} practice`,
          className: `Stage ${programme === 'primary' ? 6 : 9}`,
          grade: programme === 'primary' ? 6 : 9,
          curriculum: 'checkpoint', difficultyLevel: 'average',
          customTime: p.minutes, examPrepContext: lj.examPrepContext,
          shortCount: lj.shortCount, paperSlots: lj.paperSlots,
        })
        // Audit what the LEARNER sees, not what the route returned.
        //
        // The form runs applyBlueprint before storing the paper: it fixes the
        // marks, drops a key the model put on an extended answer, and settles
        // the type. Auditing the raw response reported 85 keys on extended
        // questions that no learner would ever have met -- a fault in the
        // harness, not the product.
        const shown = json?.error ? [] : applyBlueprint(json.questions, p)
        const row: Row = {
          area: 'Checkpoint', label: `${p.code}/${component} ${subject} ${programme}`,
          error: json?.error ?? null, ms,
          count: shown.length, expected: p.slots.length,
          figures: shown.filter((q: any) => q.image_url).length,
          findings: json?.error ? [] : auditPaper(shown, { expectedCount: p.slots.length }),
        }
        results.push(row); line(row)
      }
    }

    const failed = results.filter((r) => r.error)
    const summary = summariseFindings(results.flatMap((r) => r.findings))

    console.log('\n' + '='.repeat(66))
    console.log(`papers generated : ${results.length - failed.length}/${results.length}`)
    console.log(`failed outright  : ${failed.length}`)
    console.log(`broken findings  : ${summary.broken}`)
    console.log(`polish findings  : ${summary.poor}`)
    if (summary.byCode.length) {
      console.log('\nby fault, worst first:')
      for (const r of summary.byCode) {
        console.log(`  ${r.severity === 'broken' ? 'BROKEN' : 'poor  '} ${String(r.count).padStart(4)}  ${r.code}`)
      }
    }
    if (failed.length) {
      console.log('\npapers that would not generate:')
      for (const f of failed.slice(0, 25)) console.log(`  ${f.area} — ${f.label}: ${f.error}`)
    }

    fs.writeFileSync('qa-sweep-report.json', JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 1), 'utf8')
    console.log('\nfull detail: qa-sweep-report.json')

    // The sweep reports; it does not pass or fail on quality. Its job is to
    // show what is there, and a red test would only hide the numbers.
    expect(results.length).toBeGreaterThan(0)
  }, 3_600_000)
})
