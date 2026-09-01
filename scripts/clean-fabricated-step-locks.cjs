/**
 * Strips fabricated subtopic attributions from stored lesson runs.
 *
 * The plan job used to accept any `subtopicId` the model returned. With no
 * curriculum catalogue to attribute to — which is every scratch lesson — it
 * numbered the steps 1, 2, 3, and those collided with real subtopic ids from
 * unrelated subjects. Learners were shown "you scored 29% on this" against a
 * step it had nothing to do with.
 *
 * A step keeps its subtopicId only if that subtopic genuinely belongs to the
 * lesson's own topic. Everything else loses the id and the lock it produced.
 */
const fs = require('fs')
const { Client } = require('pg')

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const APPLY = process.argv.includes('--apply')

;(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const { rows } = await c.query(
    `SELECT id, title, topic_id, lesson_run FROM learnspaces WHERE lesson_run IS NOT NULL`,
  )

  let touched = 0
  for (const row of rows) {
    const run = row.lesson_run
    if (!run || !Array.isArray(run.steps)) continue

    // Which subtopics could legitimately have been offered for this lesson.
    let allowed = new Set()
    if (row.topic_id) {
      const r = await c.query('SELECT subtopic_id FROM subtopics WHERE topic_id = $1', [row.topic_id])
      allowed = new Set(r.rows.map((x) => Number(x.subtopic_id)))
    }

    let changed = false
    const steps = run.steps.map((s) => {
      if (s.subtopicId === undefined && !s.lockedBy) return s
      if (s.subtopicId !== undefined && allowed.has(Number(s.subtopicId))) return s
      changed = true
      const { subtopicId, lockedBy, ...rest } = s
      return rest
    })

    if (!changed) continue
    touched += 1
    const bogus = run.steps.filter((s, i) => steps[i] !== s).map((s) => `${s.title} (id ${s.subtopicId}${s.lockedBy ? `, showed ${s.lockedBy.accuracy}%` : ''})`)
    console.log(`${APPLY ? 'FIXED' : 'would fix'}: ${row.title}`)
    for (const b of bogus) console.log(`    - ${b}`)

    if (APPLY) {
      await c.query('UPDATE learnspaces SET lesson_run = $1::jsonb WHERE id = $2', [
        JSON.stringify({ ...run, steps }),
        row.id,
      ])
    }
  }

  console.log(`\n${touched} lesson(s) ${APPLY ? 'cleaned' : 'affected'} of ${rows.length} with a run.`)
  if (!APPLY) console.log('Dry run — pass --apply to write.')
  await c.end()
})()
