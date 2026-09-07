/**
 * The book cross-reference pass, replayed over the real site.
 *
 * A student reported *"Using the Python Shell window shown on page 255,
 * describe how a simple 'Hello World!' program is executed"* — a question about
 * a page they have no way to see. Unit tests can only prove the rule works on
 * the stems I thought of; this proves it against every stem the site has
 * actually served, which is the only place the false positives live.
 *
 * Read-only: it reads `assessments`, `results` and `assignments` and writes
 * nothing. Needs DATABASE_URL, no model calls, no cost.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveBookReferences
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { Client } from 'pg'
import { repairBookReferences, bookReference } from '@/lib/book-reference'
import { danglingReference } from '@/lib/dangling-reference'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

interface Stem {
  question: string
  image_url?: string
  diagram_svg?: string
}

/** Every object with a `question` string, wherever it sits in the JSON. */
function collectStems(value: unknown, out: Stem[]): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((v) => collectStems(v, out))
    return
  }
  const o = value as Record<string, unknown>
  if (typeof o.question === 'string') out.push(o as unknown as Stem)
  Object.values(o).forEach((v) => collectStems(v, out))
}

/**
 * Read once and shared. Three full scans of a jsonb column take over a minute
 * each, and both tests want the same 56,000 rows.
 *
 * Each caller gets its own copies, because the repair rewrites in place and
 * the second test's whole point is to see the questions as they were served.
 */
let cached: Promise<Stem[]> | null = null
const siteStems = async () => (await (cached ??= readEveryStem())).map((q) => ({ ...q }))

async function readEveryStem(): Promise<Stem[]> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const out: Stem[] = []
  try {
    for (const table of ['assessments', 'results', 'assignments']) {
      const { rows } = await client.query(
        `SELECT questions_data AS d FROM "${table}" WHERE questions_data IS NOT NULL`,
      )
      for (const row of rows) collectStems(row.d, out)
    }
  } finally {
    await client.end()
  }
  return out
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('every question the site has served', () => {
  it('repairs or drops all of them, and nothing survives still pointing at a page', async () => {
    const all = await siteStems()
    const offenders = all.filter((q) => bookReference(q.question))
    const before = offenders.map((q) => q.question)

    console.log(`\n${all.length} stems on the site — ${offenders.length} point into the book\n`)

    repairBookReferences(offenders)

    let repaired = 0
    let dropped = 0
    offenders.forEach((q, i) => {
      if (danglingReference(q)) {
        dropped++
        console.log(`DROP  ${oneLine(before[i]).slice(0, 150)}`)
      } else {
        repaired++
        console.log(`FIX   ${oneLine(before[i]).slice(0, 130)}`)
        console.log(`  ->  ${oneLine(q.question).slice(0, 130)}`)
      }
    })
    console.log(`\nrepaired ${repaired}, dropped ${dropped}\n`)

    // Every one is either rewritten or removed. None ships as it was.
    offenders.forEach((q, i) => {
      const survived = danglingReference(q) === null && q.question === before[i]
      expect(survived, `unchanged and still shipping: ${before[i]}`).toBe(false)
    })
    expect(repaired + dropped).toBe(offenders.length)
  }, 300_000)

  it('touches none of the questions that were already fine', async () => {
    // The real risk of a rule like this is not the ones it misses, it is the
    // good questions it rewrites. 11,000 live stems is the only sample large
    // enough to show that.
    const all = await siteStems()
    const clean = all.filter((q) => !bookReference(q.question))
    const before = clean.map((q) => q.question)

    repairBookReferences(clean)

    const changed = clean
      .map((q, i) => ({ was: before[i], now: q.question }))
      .filter((pair) => pair.was !== pair.now)
    changed.slice(0, 20).forEach((pair) => console.log(`  was: ${pair.was}\n  now: ${pair.now}`))
    console.log(`\n${clean.length} clean stems — ${changed.length} rewritten by mistake`)
    expect(changed).toHaveLength(0)

    const rejected = clean.filter((q) => danglingReference(q) === 'source')
    rejected.slice(0, 20).forEach((q) => console.log(`  false drop: ${oneLine(q.question).slice(0, 160)}`))
    expect(rejected).toHaveLength(0)
  }, 300_000)
})
