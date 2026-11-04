/**
 * Give existing mastery rows their latest-attempt scores.
 *
 * The Gap Map judges a section on its latest attempt (last_accuracy) and
 * remembers its lowest (lowest_accuracy), so a closed gap can show gold.
 * Rows saved before those columns existed have them NULL. This replays each
 * student's saved results, oldest first, through the same rule save-result
 * uses (lib/studylab/mastery-latest.ts), and fills the columns.
 *
 * Needs migrations/add-mastery-latest.sql to have been run first.
 *
 * RUN THIS ONLY AFTER THE NEW CODE IS LIVE. The old save-result code writes
 * `accuracy` and not `last_accuracy`. If a student retakes a quiz between the
 * backfill and the release, their row keeps the backfilled score instead of the
 * retake, and no re-run can repair it, because the row is no longer NULL. See
 * the Release Checklist in docs/superpowers/plans/2026-11-04-gap-map-tile-rack.md.
 *
 * Read-only unless --apply --yes-production. It only touches rows where
 * last_accuracy IS NULL, so a re-run cannot overwrite newer attempts, and it
 * never changes attempts, correct or accuracy. Rows with no replayable history
 * stay NULL; readLatest then gives them their average. Exam-prep books
 * (curricula 3 and 4) are left out, as the map leaves them out. --log=<file>
 * records the old values of every row it changes. Output is totals only.
 *
 *   JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/backfill-mastery-latest.ts                                   # measure
 *   JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/backfill-mastery-latest.ts --apply --yes-production --log=latest-log.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { replayResults } from '../lib/studylab/mastery-replay'
import { bandFor, type LatestColumns } from '../lib/studylab/mastery-latest'
import { isExamPrepCurriculumNumeric } from '../lib/curriculum-registry'

const ROOT = process.cwd()
const APPLY = process.argv.includes('--apply')
const YES = process.argv.includes('--yes-production')
const LOG = (process.argv.find((a) => a.startsWith('--log=')) ?? '').slice('--log='.length)

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  if (APPLY && !YES) throw new Error('--apply needs --yes-production: this writes to the live database')
  if (APPLY && !LOG) throw new Error('--apply needs --log=<file> so the changes can be undone')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000, query_timeout: 120000 })

  const books = (await pool.query('SELECT textbook_id, curriculum FROM textbooks')).rows
  const examPrep = new Set(books.filter((b: any) => isExamPrepCurriculumNumeric(Number(b.curriculum))).map((b: any) => Number(b.textbook_id)))

  // Rows still waiting for their latest scores.
  const waiting = (await pool.query(
    `SELECT user_id::text AS user_id, textbook_id, topic_id, subtopic_id, attempts, accuracy
       FROM topic_mastery WHERE last_accuracy IS NULL`)).rows
    .filter((r: any) => !examPrep.has(Number(r.textbook_id)))

  const results = (await pool.query(
    `SELECT r.user_id::text AS user_id, a.textbook_id, r.answers, r.longform_grades,
            COALESCE(r.questions_data, a.questions_data) AS questions_data
       FROM results r JOIN assessments a ON a.id = r.assessment_id
      WHERE r.user_id IS NOT NULL AND a.textbook_id IS NOT NULL
      ORDER BY r.created_at ASC`)).rows
    .filter((r: any) => !examPrep.has(Number(r.textbook_id)))

  const groups = new Map<string, any[]>()
  for (const r of results) {
    const k = `${r.user_id}|${r.textbook_id}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const replayed = new Map<string, Map<string, LatestColumns>>()
  for (const [k, rs] of groups) replayed.set(k, replayResults(rs))

  type Change = { user_id: string; textbook_id: number; topic_id: number; subtopic_id: number; old_accuracy: unknown; cols: LatestColumns }
  const changes: Change[] = []
  let onAverage = 0
  let gold = 0
  for (const w of waiting) {
    const cols = replayed.get(`${w.user_id}|${w.textbook_id}`)?.get(`${w.topic_id}:${w.subtopic_id}`)
    if (!cols) { onAverage++; continue }
    changes.push({ user_id: w.user_id, textbook_id: Number(w.textbook_id), topic_id: Number(w.topic_id), subtopic_id: Number(w.subtopic_id), old_accuracy: w.accuracy, cols })
    if (bandFor(cols.last_accuracy, cols.lowest_accuracy) === 'gold') gold++
  }

  console.log(`results read: ${results.length}`)
  console.log(`rows waiting for latest scores: ${waiting.length}`)
  console.log(`rows that would change: ${changes.length} | rows left on the average: ${onAverage} | would show gold: ${gold}`)
  if (!APPLY) { await pool.end(); console.log('Read-only. Run with --apply --yes-production --log=<file> to write.'); return }

  const log: unknown[] = []
  for (const c of changes) {
    const res = await pool.query(
      `UPDATE topic_mastery
          SET last_accuracy = $5, lowest_accuracy = $6, pending_correct = $7, pending_total = $8
        WHERE user_id = $1 AND textbook_id = $2 AND topic_id = $3 AND subtopic_id = $4 AND last_accuracy IS NULL`,
      [c.user_id, c.textbook_id, c.topic_id, c.subtopic_id, c.cols.last_accuracy, c.cols.lowest_accuracy, c.cols.pending_correct, c.cols.pending_total])
    if (res.rowCount) log.push({ ...c, old: { last_accuracy: null, lowest_accuracy: null, pending_correct: 0, pending_total: 0 } })
  }
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1))
  await pool.end()
  console.log(`written: ${log.length} rows. Undo log: ${LOG}`)
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1) })
