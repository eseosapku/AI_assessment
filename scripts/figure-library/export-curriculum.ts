// scripts/figure-library/export-curriculum.ts
// Run: npx jiti scripts/figure-library/export-curriculum.ts
// Reads production with SELECT only, and writes the staging store.
import { Pool } from 'pg'
import { openStore } from './store'
import { loadEnv } from './claude'
import { curriculumRows } from './curriculum'
import { WAEC_SUBJECTS, JAMB_UTME_SUBJECTS } from '../../lib/nigeria-exam-syllabi'
import { CHECKPOINT_SUBJECTS } from '../../lib/cambridge-checkpoint'

async function main() {
  const env = loadEnv()
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const books = (await pool.query('SELECT textbook_id, textbook_name, curriculum FROM textbooks WHERE curriculum IN (0, 1, 2)')).rows
  const topics = (await pool.query(
    'SELECT topic_id, textbook_id, topic FROM topics WHERE textbook_id IN (SELECT textbook_id FROM textbooks WHERE curriculum IN (0, 1, 2))',
  )).rows
  const subtopics = (await pool.query(
    'SELECT subtopic_id, topic_id, subtopic FROM subtopics WHERE topic_id IN (SELECT topic_id FROM topics WHERE textbook_id IN (SELECT textbook_id FROM textbooks WHERE curriculum IN (0, 1, 2)))',
  )).rows
  await pool.end()

  const rows = curriculumRows({ books, topics, subtopics, waec: WAEC_SUBJECTS, jamb: JAMB_UTME_SUBJECTS, checkpoint: CHECKPOINT_SUBJECTS })
  const db = openStore()
  const upTopic = db.prepare(`INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET source = excluded.source, textbook_id = excluded.textbook_id, book = excluded.book,
      subject = excluded.subject, band = excluded.band, name = excluded.name`)
  const upSub = db.prepare(`INSERT INTO subtopics (key, topic_key, name) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET topic_key = excluded.topic_key, name = excluded.name`)
  db.exec('BEGIN')
  for (const t of rows.topics) upTopic.run(t.key, t.source, t.textbookId, t.book, t.subject, t.band, t.name)
  for (const s of rows.subtopics) upSub.run(s.key, s.topicKey, s.name)
  db.exec('COMMIT')

  const bySource = new Map<string, number>()
  for (const t of rows.topics) bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1)
  console.log(`staged ${rows.topics.length} topics and ${rows.subtopics.length} subtopics`)
  for (const [source, n] of bySource) console.log(`  ${source}: ${n}`)
  console.log(`subjects: ${new Set(rows.topics.map((t) => t.subject)).size}`)
  if (rows.uncertain.length) console.log(`level assumed upper secondary for ${rows.uncertain.length} books:\n  ${rows.uncertain.join('\n  ')}`)
  if (rows.unmapped.length) {
    console.log(`NO SUBJECT for ${rows.unmapped.length} names; add rules to subjects.ts (with a test) and rerun:\n  ${rows.unmapped.join('\n  ')}`)
    process.exitCode = 1
  }
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
