#!/usr/bin/env node
/**
 * Content coverage report.
 *
 * The gap map, the study loop and subtopic selection in the wizard are all
 * capped by how deeply the curriculum is broken down, and none of them can be
 * improved in code past that ceiling. Measured on 2026-08-18: 1,578 of 3,663
 * topics — 43% — had no subtopics at all, and the average textbook carried six
 * topics against a real syllabus of fifteen to forty.
 *
 * Nobody was looking at those numbers, so they were nobody's job. This makes
 * them a number you can run, watch move, and set a target against.
 *
 *   npm run report:coverage             full report
 *   npm run report:coverage -- --worst  only the books that need work
 *
 * Read-only. It writes nothing and changes nothing.
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

/** Below this a textbook cannot support meaningful topic selection. */
const THIN_TOPIC_COUNT = 5
/** A real syllabus is rarely shorter than this. */
const HEALTHY_TOPIC_COUNT = 15

function readEnv(key) {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return process.env[key]
  const env = fs.readFileSync(envPath, 'utf8')
  return (env.match(new RegExp('^' + key + '=(.*)$', 'm')) || [])[1]?.trim() || process.env[key]
}

function bar(pct, width = 24) {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width)
  return '█'.repeat(filled) + '·'.repeat(width - filled)
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

async function main() {
  const worstOnly = process.argv.includes('--worst')
  const connectionString = readEnv('DATABASE_URL')
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env or the environment.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

  try {
    const totals = (
      await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM textbooks)                                  AS textbooks,
          (SELECT COUNT(*)::int FROM topics)                                     AS topics,
          (SELECT COUNT(*)::int FROM subtopics)                                  AS subtopics,
          (SELECT COUNT(*)::int FROM topics t
             WHERE NOT EXISTS (SELECT 1 FROM subtopics s WHERE s.topic_id = t.topic_id))
                                                                                 AS topics_without_subtopics,
          (SELECT COUNT(*)::int FROM textbooks tb
             WHERE NOT EXISTS (SELECT 1 FROM topics t WHERE t.textbook_id = tb.textbook_id))
                                                                                 AS textbooks_without_topics
      `)
    ).rows[0]

    const books = (
      await pool.query(`
        SELECT tb.textbook_id AS id, tb.textbook_name AS name, tb.curriculum,
               COUNT(DISTINCT t.topic_id)::int    AS topics,
               COUNT(DISTINCT s.subtopic_id)::int AS subtopics
          FROM textbooks tb
          LEFT JOIN topics t    ON t.textbook_id = tb.textbook_id
          LEFT JOIN subtopics s ON s.topic_id = t.topic_id
         GROUP BY tb.textbook_id, tb.textbook_name, tb.curriculum
         ORDER BY topics ASC, subtopics ASC
      `)
    ).rows

    const CURRICULA = {
      0: 'Rwanda / REB',
      1: 'Cambridge',
      2: 'Nigeria / NERDC',
      3: 'WAEC',
      4: 'JAMB',
    }

    // WAEC and JAMB books are individual past papers. One paper is one unit,
    // so "1 topic, 0 subtopics" is the correct shape for them, not a gap —
    // judging them against a syllabus flags 167 healthy books and buries the
    // corpus that genuinely needs work.
    const EXAM_PREP = new Set([3, 4])
    const isSyllabus = (b) => !EXAM_PREP.has(Number(b.curriculum))

    console.log('\n  CONTENT COVERAGE')
    console.log('  ' + '─'.repeat(64))
    console.log(`  textbooks                    ${String(totals.textbooks).padStart(6)}`)
    console.log(`  topics                       ${String(totals.topics).padStart(6)}`)
    console.log(`  subtopics                    ${String(totals.subtopics).padStart(6)}`)
    console.log()

    const withSubs = totals.topics - totals.topics_without_subtopics
    const subPct = pct(withSubs, totals.topics)
    console.log(`  topics broken into subtopics ${String(withSubs).padStart(6)}  ${bar(subPct)} ${subPct}%`)
    console.log(
      `  topics with none             ${String(totals.topics_without_subtopics).padStart(6)}` +
        `  ← the gap map cannot go below topic level for these`,
    )
    console.log(`  textbooks with no topics     ${String(totals.textbooks_without_topics).padStart(6)}  ← unusable in the wizard`)
    console.log()

    // Per curriculum, because the corpora were built at different times and
    // an average across all of them hides which one needs the work.
    console.log('  BY CURRICULUM')
    console.log('  ' + '─'.repeat(64))
    const byCurriculum = new Map()
    for (const b of books) {
      const key = CURRICULA[b.curriculum] ?? `Unknown (${b.curriculum})`
      const e = byCurriculum.get(key) ?? { books: 0, topics: 0, subtopics: 0, thin: 0 }
      e.books++
      e.topics += b.topics
      e.subtopics += b.subtopics
      if (isSyllabus(b) && b.topics < THIN_TOPIC_COUNT) e.thin++
      byCurriculum.set(key, e)
    }
    console.log('  curriculum          books  topics  subtopics  avg topics  thin')
    for (const [name, e] of [...byCurriculum.entries()].sort((a, b) => b[1].books - a[1].books)) {
      const avg = e.books > 0 ? (e.topics / e.books).toFixed(1) : '0.0'
      console.log(
        `  ${name.padEnd(18)} ${String(e.books).padStart(5)}  ${String(e.topics).padStart(6)}  ` +
          `${String(e.subtopics).padStart(9)}  ${avg.padStart(10)}  ${String(e.thin).padStart(4)}`,
      )
    }
    console.log(`\n  "thin" = fewer than ${THIN_TOPIC_COUNT} topics; a real syllabus is usually ${HEALTHY_TOPIC_COUNT}+.`)
    console.log('  WAEC and JAMB are past papers — one paper is one unit, so they are not judged on this.')

    const needsWork = books.filter((b) => isSyllabus(b) && (b.topics < THIN_TOPIC_COUNT || b.subtopics === 0))
    console.log()
    console.log('  NEEDS WORK')
    console.log('  ' + '─'.repeat(64))
    const syllabusBooks = books.filter(isSyllabus).length
    console.log(`  ${needsWork.length} of ${syllabusBooks} syllabus textbooks are thin on topics or have no subtopics.`)
    if (needsWork.length > 0) {
      console.log()
      const show = worstOnly ? needsWork : needsWork.slice(0, 20)
      for (const b of show) {
        const flag = b.topics === 0 ? 'no topics ' : b.subtopics === 0 ? 'no subtops' : 'thin      '
        console.log(`  [${flag}] ${String(b.topics).padStart(3)}t ${String(b.subtopics).padStart(4)}s  ${String(b.name).slice(0, 44)}`)
      }
      if (!worstOnly && needsWork.length > show.length) {
        console.log(`  … and ${needsWork.length - show.length} more. Run with --worst to list them all.`)
      }
    }
    console.log()
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Coverage report failed:', err.message)
  process.exit(1)
})
