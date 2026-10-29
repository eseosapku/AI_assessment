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

const snap = JSON.parse(fs.readFileSync(new URL('../curriculum/snapshot.json', import.meta.url), 'utf8'))
const queries = {
  textbooks: 'SELECT COUNT(*)::int AS n FROM textbooks',
  topics: 'SELECT COUNT(*)::int AS n FROM topics',
  subtopics: 'SELECT COUNT(*)::int AS n FROM subtopics',
  class_textbooks: 'SELECT COUNT(*)::int AS n FROM class_textbooks',
  cambridge: 'SELECT COUNT(*)::int AS n FROM textbooks WHERE curriculum = 1',
  columns: `SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name IN ('textbooks','topics','subtopics','class_textbooks')
             ORDER BY table_name, ordinal_position`,
}

try {
  const out = {}
  for (const [name, sql] of Object.entries(queries)) {
    if (name === 'columns') continue
    out[name] = (await pool.query(sql)).rows[0].n
  }
  const columns = (await pool.query(queries.columns)).rows
  const byTable = {}
  for (const row of columns) {
    byTable[row.table_name] = byTable[row.table_name] ?? []
    byTable[row.table_name].push(row.column_name)
  }
  console.log(JSON.stringify({
    live: out,
    snapshot: {
      textbooks: snap.textbooks.length,
      topics: snap.topics.length,
      subtopics: snap.subtopics.length,
      cambridge: snap.textbooks.filter((book) => book.curriculum === 1).length,
    },
    columns: byTable,
  }, null, 2))
} finally {
  await pool.end()
}
