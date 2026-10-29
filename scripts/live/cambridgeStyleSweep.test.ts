/**
 * Twenty real quizzes through the route that now adds the Cambridge paper style.
 *
 * Local dev server only. No user_id, so nobody's allowance is spent. The rows
 * this inserts are deleted at the end, and only when user_id is null.
 *
 *   npx vitest run --config vitest.live.config.ts cambridgeStyleSweep
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { Pool } from 'pg'
import { auditPaper, type AuditFinding } from '@/lib/question-audit'
import { loadCambridgeStyle } from '@/lib/past-paper/cambridge-style'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const COUNT = 5

interface Job {
  label: string
  body: Record<string, unknown>
  expectStyle: boolean
}

interface Result {
  label: string
  expectStyle: boolean
  error: string | null
  count: number
  figures: number
  assessmentId: string | null
  broken: AuditFinding[]
  copied: string | null
  ms: number
}

function copiedExemplar(questions: { question?: string }[], bookTitle: string): string | null {
  const style = loadCambridgeStyle(bookTitle, 1)
  const exemplars = (style?.sources ?? (style ? [style] : []))
    .flatMap((item) => item.exemplars.map((exemplar) => exemplar.text.replace(/\s+/g, ' ').trim()))
    .filter((text) => text.length >= 40)
  for (const question of questions) {
    const stem = String(question.question ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    for (const exemplar of exemplars) {
      const slice = exemplar.slice(0, 80).toLowerCase()
      if (slice.length >= 40 && stem.includes(slice)) return slice
    }
  }
  return null
}

async function generate(body: Record<string, unknown>, n: number) {
  const started = Date.now()
  const res = await fetch(`${BASE}/api/generate-assessment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.9.${Math.floor(n / 256) % 256}.${n % 256}`,
    },
    body: JSON.stringify(body),
  })
  const json: any = await res.json().catch(() => ({ error: 'unparseable response' }))
  return { json, ms: Date.now() - started, ok: res.ok }
}

async function poolMap<T, R>(items: T[], width: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      out[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, () => worker()))
  return out
}

describe('Cambridge paper style on real quizzes', () => {
  it('generates twenty quizzes, including a PDF figure, without breaking other curricula', async () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    })
    const { rows } = await pool.query(
      `SELECT textbook_id, textbook_name, curriculum FROM textbooks WHERE curriculum IN (0, 1)`,
    )
    const jobs: Job[] = []
    const used = new Set<number>()
    function take(test: (name: string, curriculum: number) => boolean, label: string) {
      const row = rows.find((item) => !used.has(item.textbook_id) && test(String(item.textbook_name), Number(item.curriculum)))
      if (!row) return
      used.add(row.textbook_id)
      const style = Number(row.curriculum) === 1 ? loadCambridgeStyle(String(row.textbook_name), 1) : null
      jobs.push({
        label: `${label}: ${String(row.textbook_name).slice(0, 64)}`,
        expectStyle: Boolean(style),
        body: {
          subject: String(row.textbook_name).slice(0, 80),
          topics: [],
          textbook_id: row.textbook_id,
          count: COUNT,
          questionType: 'mcq',
          style: 'quiz',
          className: Number(row.curriculum) === 1 ? 'Year 10' : 'S4',
          grade: Number(row.curriculum) === 1 ? 10 : 10,
          curriculum: Number(row.curriculum) === 1 ? 'cambridge' : 'rwanda',
          difficultyLevel: 'average',
        },
      })
    }

    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /physics/i.test(name), 'igcse physics')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /chemistry/i.test(name), 'igcse chemistry')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /biology/i.test(name), 'igcse biology')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /math/i.test(name), 'igcse maths')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /econom/i.test(name), 'igcse economics')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /computer science/i.test(name), 'igcse computer science')
    take((name, curriculum) => curriculum === 1 && /igcse/i.test(name) && /geography/i.test(name), 'igcse geography')
    take((name, curriculum) => curriculum === 1 && /primary/i.test(name) && /math/i.test(name), 'primary maths')
    take((name, curriculum) => curriculum === 1 && /primary/i.test(name) && /science/i.test(name), 'primary science')
    take((name, curriculum) => curriculum === 1 && /primary/i.test(name) && /english/i.test(name), 'primary english')
    const asAndA = (name: string) => /as\s+(?:&\s+|and\s+)?a\s+level/i.test(name.replace(/[-_]+/g, ' '))
    take((name, curriculum) => curriculum === 1 && asAndA(name) && /biology/i.test(name), 'as biology')
    take((name, curriculum) => curriculum === 1 && asAndA(name) && /chemistry/i.test(name), 'as chemistry')
    take((name, curriculum) => curriculum === 1 && asAndA(name) && /physics/i.test(name), 'as physics')
    take((name, curriculum) => curriculum === 1 && asAndA(name) && /math/i.test(name), 'as maths')
    take((name, curriculum) => curriculum === 1 && asAndA(name) && /econom/i.test(name), 'as economics')
    take((name, curriculum) => curriculum === 1 && /\bict\b/i.test(name), 'ict computer science')
    take((name, curriculum) => curriculum === 1 && /lower secondary/i.test(name) && /science/i.test(name), 'lower secondary science')
    take((name, curriculum) => curriculum === 1 && /english/i.test(name) && asAndA(name), 'as english')
    take((name, curriculum) => curriculum === 0 && /biology/i.test(name), 'rwanda biology')

    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGNgYGD4z8DAwMDAAAQAAH0AAf8n0wAAAABJRU5ErkJggg=='
    jobs.push({
      label: 'pdf figure',
      expectStyle: false,
      body: {
        subject: 'Physics',
        topics: ['series circuits'],
        count: COUNT,
        questionType: 'mcq',
        style: 'quiz',
        className: 'S4',
        grade: 10,
        curriculum: 'rwanda',
        difficultyLevel: 'average',
        sourceKind: 'pdf',
        sourceName: 'Series circuits',
        sourceText: 'A series circuit has a 6 V battery and two lamps. The current is 0.4 A. Use the diagram of the series circuit.',
        sourceFigures: [{
          id: 'pdf-1',
          page: 1,
          caption: 'series circuit with a 6 V battery and two lamps',
          dataUrl: png,
          width: 120,
          height: 80,
        }],
      },
    })

    expect(jobs.length).toBe(20)

    const topicRows = await pool.query(
      `SELECT textbook_id, topic FROM topics WHERE textbook_id = ANY($1::int[]) AND topic IS NOT NULL`,
      [jobs.map((job) => job.body.textbook_id).filter((id) => Number.isFinite(id as number))],
    )
    const topicsByBook = new Map<number, string[]>()
    for (const row of topicRows.rows) {
      const list = topicsByBook.get(row.textbook_id) ?? []
      if (list.length < 2) list.push(String(row.topic))
      topicsByBook.set(row.textbook_id, list)
    }
    for (const job of jobs) {
      const id = Number(job.body.textbook_id)
      if (Number.isFinite(id)) job.body.topics = topicsByBook.get(id) ?? ['Review']
    }

    const results = await poolMap(jobs, 5, async (job, index): Promise<Result> => {
      const { json, ms, ok } = await generate(job.body, index + 1)
      const questions = Array.isArray(json?.questions) ? json.questions : []
      const findings = ok ? auditPaper(questions) : []
      const bookTitle = String(job.body.subject ?? '')
      const result: Result = {
        label: job.label,
        expectStyle: job.expectStyle,
        error: ok ? null : String(json?.error ?? 'request failed'),
        count: questions.length,
        figures: questions.filter((question: { image_url?: string }) => question.image_url).length,
        assessmentId: json?.assessment_id ? String(json.assessment_id) : null,
        broken: findings.filter((finding) => finding.severity === 'broken'),
        copied: ok ? copiedExemplar(questions, bookTitle) : null,
        ms,
      }
      const mark = result.error || result.broken.length || result.copied ? 'FAIL' : 'ok  '
      console.log(`${mark} ${result.label}  ${result.count}q ${result.figures}fig ${result.ms}ms ${result.error ?? result.broken[0]?.code ?? ''}`)
      return result
    })

    const ids = results.map((result) => result.assessmentId).filter((id): id is string => Boolean(id))
    if (ids.length) {
      await pool.query(
        `DELETE FROM assessments WHERE id = ANY($1::uuid[]) AND user_id IS NULL`,
        [ids],
      )
      const left = await pool.query(
        `SELECT COUNT(*)::int AS n FROM assessments WHERE id = ANY($1::uuid[])`,
        [ids],
      )
      expect(left.rows[0].n).toBe(0)
    }
    await pool.end()

    fs.writeFileSync(
      'reports/cambridge-style-sweep.json',
      JSON.stringify(results.map((result) => ({
        ...result,
        broken: result.broken.map((finding) => ({ code: finding.code, detail: finding.detail })),
      })), null, 2),
    )

    const failed = results.filter((result) => result.error || result.count === 0 || result.broken.length || result.copied)
    expect(failed.map((result) => `${result.label}: ${result.error ?? result.copied ?? result.broken.map((finding) => finding.code).join(', ')}`)).toEqual([])
  }, 900_000)
})
