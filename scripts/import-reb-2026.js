/**
 * Import the REB 2026 library into the textbooks table.
 *
 * The books came from elearning.reb.rw/local/reblibrary, which is readable
 * without a login. Everything there was uploaded between May and August 2026,
 * so these are the current editions.
 *
 * What it skips, and why:
 *   - Nursery (N1-N3). The platform assesses P1 upwards; a nursery picture
 *     book has nothing an exam question can be asked about.
 *   - Language books (Kinyarwanda, French, English, Literature). The image
 *     extractor already skips these subjects for having no exam-figure value,
 *     so a row for one would only ever sit unused.
 *
 * A book already in the table is REPOINTED at its 2026 file rather than
 * duplicated -- two rows for "Biology S3 SB" would let the generator cite
 * whichever it happened to pick.
 *
 * Usage:
 *   node scripts/import-reb-2026.js --dry-run
 *   node scripts/import-reb-2026.js
 */
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const DRY = process.argv.includes('--dry-run')
const DIR = (process.argv.find((a) => a.startsWith('--dir=')) || '').split('=')[1]
  || 'C:/Users/Stephen/Downloads/reb-2026-library'
const REB = 0
const LANGUAGE = /kinyarwanda|french|english|literature|ikinyarwanda|umuco|indimi/i

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const norm = (s) => String(s || '').toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]+/g, ' ').trim()

function candidates() {
  const manifestPath = path.join(DIR, '_manifest.json')
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : []
  const byLocal = new Map(manifest.map((m) => [m.local, m]))
  return fs.readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((file) => {
      const cls = file.split('__')[0]
      const title = file.replace(/^[A-Za-z0-9]+__\d+__/, '').replace(/\.pdf$/i, '').replace(/_/g, ' ').trim()
      return { file, cls, title, url: byLocal.get(file)?.file_url ?? null }
    })
    .filter((c) => !/^N\d/.test(c.cls) && !LANGUAGE.test(c.title))
}

;(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const existing = await pool.query('SELECT textbook_id, textbook_name FROM textbooks WHERE curriculum = $1', [REB])
  const byName = new Map(existing.rows.map((r) => [norm(r.textbook_name), r.textbook_id]))

  const rows = candidates()
  let updated = 0
  let inserted = 0
  for (const c of rows) {
    const hit = byName.get(norm(c.title))
    if (hit) {
      if (!DRY) {
        await pool.query(
          'UPDATE textbooks SET filename = $1, source_url = $2, source_authority = $3 WHERE textbook_id = $4',
          [c.file, c.url, 'REB e-learning library (2026)', hit],
        )
      }
      updated++
      console.log(`  refresh #${hit}  ${c.title}`)
    } else {
      if (!DRY) {
        await pool.query(
          `INSERT INTO textbooks (textbook_name, filename, curriculum, source_url, source_authority)
           VALUES ($1, $2, $3, $4, $5)`,
          [c.title, c.file, REB, c.url, 'REB e-learning library (2026)'],
        )
      }
      inserted++
      console.log(`  add          ${c.cls.padEnd(4)} ${c.title}`)
    }
  }
  console.log(`\n${DRY ? 'WOULD ' : ''}refresh ${updated}, ${DRY ? 'would ' : ''}add ${inserted}, from ${rows.length} eligible files`)
  await pool.end()
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
