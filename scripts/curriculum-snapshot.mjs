import fs from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      let value = line.slice(i + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      return [line.slice(0, i).trim(), value]
    }),
)

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  max: 2,
})

const textbooks = await pool.query(`
  SELECT tb.textbook_id, tb.textbook_name, tb.curriculum,
         coalesce(json_agg(json_build_object('id', c.id, 'name', c.name, 'country', c.country)
           ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]') AS classes
  FROM textbooks tb
  LEFT JOIN class_textbooks ct ON ct.textbook_id = tb.textbook_id
  LEFT JOIN classes c ON c.id = ct.class_id
  GROUP BY tb.textbook_id, tb.textbook_name, tb.curriculum
  ORDER BY tb.curriculum, tb.textbook_id
`)

const topics = await pool.query(`
  SELECT topic_id, textbook_id, topic FROM topics ORDER BY textbook_id, topic_id
`)

const subtopics = await pool.query(`
  SELECT subtopic_id, textbook_id, topic_id, subtopic
  FROM subtopics
  ORDER BY textbook_id, topic_id, subtopic_id
`)

const snapshot = {
  generated_at: new Date().toISOString(),
  source: 'postgres public.textbooks, topics, subtopics, classes, class_textbooks',
  description_column: null,
  textbooks: textbooks.rows,
  topics: topics.rows,
  subtopics: subtopics.rows,
}

fs.mkdirSync(new URL('../curriculum', import.meta.url), { recursive: true })
const out = new URL('../curriculum/snapshot.json', import.meta.url)
fs.writeFileSync(out, JSON.stringify(snapshot))
console.log(`wrote ${subtopics.rowCount} subtopics, ${topics.rowCount} topics, ${textbooks.rowCount} textbooks`)
await pool.end()
