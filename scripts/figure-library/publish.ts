/**
 * Publish the figure library to the app's Postgres (spec 2026-10-16 3.2).
 *
 *   JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/figure-library/publish.ts
 *       dry run (the default): counts and an estimated size; writes nothing
 *   ... --apply --yes-production
 *       applies migrations/add-figure-library.sql (additive), then inserts in batches; safe to re-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { MIGRATION_FILE, stagingBatches, writeBatch } from '../../lib/figure-library/publish'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  try { process.loadEnvFile(path.join(process.cwd(), '.env')) } catch { /* settings from the environment */ }
  const file = path.join(process.env.FIGURE_LIBRARY_DIR || 'C:/Users/Stephen/figure-library', 'figures.db')
  const totals = { figures: 0, topics: 0, questions: 0, bytes: 0 }
  const add = (b: { figures: unknown[]; topics: unknown[]; questions: unknown[] }) => {
    totals.figures += b.figures.length; totals.topics += b.topics.length; totals.questions += b.questions.length
    totals.bytes += JSON.stringify(b).length
  }
  if (!apply) {
    for (const b of stagingBatches(file)) add(b)
    console.log(`Dry run: ${totals.figures} figures, ${totals.topics} topic links, ${totals.questions} questions, about ${(totals.bytes / 1e6).toFixed(0)} MB of row data (plus indexes). Nothing written.`)
    return
  }
  if (!args.includes('--yes-production')) throw new Error('--apply also needs --yes-production')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const host = new URL(url).hostname
  console.log(`Writing to ${host.includes('rds.amazonaws.com') ? 'AWS RDS' : host.includes('supabase') ? 'Supabase' : 'another Postgres host'}`)
  const client = new Client({ connectionString: url, ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(fs.readFileSync(MIGRATION_FILE, 'utf8'))
    let n = 0
    for (const b of stagingBatches(file)) {
      await writeBatch(client, b)
      add(b)
      if (++n % 10 === 0) console.log(`  ${totals.figures} figures written`)
    }
    const { rows } = await client.query(`SELECT (SELECT count(*) FROM figure_library) AS figures,
      (SELECT count(*) FROM figure_library_topics) AS topics, (SELECT count(*) FROM figure_library_questions) AS questions`)
    console.log(`Published. In the database now: ${rows[0].figures} figures, ${rows[0].topics} topic links, ${rows[0].questions} questions.`)
  } finally {
    await client.end()
  }
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
