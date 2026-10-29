import fs from 'node:fs'
import pg from 'pg'

const env = {}
for (const line of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
})

const report = JSON.parse(fs.readFileSync(new URL('../reports/cambridge-style-sweep.json', import.meta.url), 'utf8'))
const ids = report.map((row) => row.assessmentId).filter(Boolean)
const left = await pool.query('SELECT id FROM assessments WHERE id = ANY($1::uuid[])', [ids])
console.log('sweep rows still in assessments:', left.rows.length)

const book = (await pool.query(
  `SELECT textbook_id, textbook_name FROM textbooks WHERE textbook_name ILIKE '%Oxford English for Cambridge Primary Student Book 2%' LIMIT 1`,
)).rows[0]
const topics = (await pool.query(
  `SELECT topic FROM topics WHERE textbook_id = $1 AND topic IS NOT NULL ORDER BY topic_id LIMIT 2`,
  [book.textbook_id],
)).rows.map((row) => row.topic)

const started = Date.now()
const res = await fetch('http://localhost:3000/api/generate-assessment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.8.0.2' },
  body: JSON.stringify({
    subject: book.textbook_name,
    topics,
    textbook_id: book.textbook_id,
    count: 5,
    questionType: 'mcq',
    style: 'quiz',
    className: 'Year 4',
    grade: 4,
    curriculum: 'cambridge',
    difficultyLevel: 'average',
  }),
})
const json = await res.json()
console.log(JSON.stringify({
  status: res.status,
  ms: Date.now() - started,
  questions: json.questions?.length ?? 0,
  error: json.error ?? null,
  assessmentId: json.assessment_id ?? null,
}))
if (json.assessment_id) {
  await pool.query('DELETE FROM assessments WHERE id = $1::uuid AND user_id IS NULL', [json.assessment_id])
  const still = await pool.query('SELECT id FROM assessments WHERE id = $1::uuid', [json.assessment_id])
  console.log('retry row removed:', still.rows.length === 0)
}
await pool.end()
