// scripts/figure-library/map-topics.ts
// Run: npx jiti scripts/figure-library/map-topics.ts [--limit=20] [--subject=geography] [--redo]
//      [--keys=<file of topic keys, one a line>] [--recheck]  (recheck: remap those keys, showing the kinds they had)
import fs from 'node:fs'
import { openStore, readJson } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender, runPool } from './claude'
import { displayName } from './curriculum'
import { loadConcepts } from './concepts'
import { FIGURE_KINDS } from './figureKinds'
import { MAX_SUBTOPICS, conceptsForBand, estimateMapUsd, parseTopicMap, saveTopicMap, topicPrompt, topicsToMap, type TopicMap } from './topicMap'

const JOB = 'p0-map'
// Lowered from the plan's $34 by the $2 given to p0-concepts, so P0's ceiling is unchanged.
const JOB_CAP_USD = 32
const RETRY_NOTE = '\nYour last reply used ids that are not in the lists, or none at all. Use only ids from the CONCEPTS and FIGURE KINDS lists above.'

async function main() {
  const args = parseArgs(process.argv.slice(2), { limit: 'int', subject: 'string', redo: 'flag', keys: 'string', recheck: 'flag' })
  const keys = args.keys ? fs.readFileSync(args.keys as string, 'utf8').split(/\r?\n/).map((k) => k.trim()).filter(Boolean) : undefined
  const recheck = args.recheck === true
  if (recheck && !keys) throw new Error('--recheck needs --keys=<file>: the topics to remap')
  const db = openStore()
  const kindsBefore = db.prepare('SELECT kinds FROM topic_map WHERE topic_key = ?')
  const conceptsBySubject = loadConcepts(db)
  const validKinds = new Set(FIGURE_KINDS.map((k) => k.id))
  const todo = topicsToMap(db, { limit: args.limit as number | undefined, subject: args.subject as string | undefined, redo: args.redo === true || recheck, keys })
  const subsOf = db.prepare('SELECT key, name FROM subtopics WHERE topic_key = ? ORDER BY key')
  const failures: string[] = []
  const truncated: string[] = []
  // Every prompt is built first, so the estimate is priced from what will actually be sent.
  const prepared = todo.flatMap((t) => {
    const concepts = conceptsForBand(conceptsBySubject.get(t.subject) ?? [], t.band)
    if (!concepts.length) { failures.push(`${t.key} (${t.subject}): no concepts; run build-concepts first`); return [] }
    const subs = subsOf.all(t.key) as { key: string; name: string }[]
    if (subs.length > MAX_SUBTOPICS) truncated.push(`${t.key} (${subs.length} subtopics)`)
    const count = Math.min(subs.length, MAX_SUBTOPICS)
    const prompt = topicPrompt({ subject: t.subject, band: t.band, book: t.book, name: displayName(t.name), subtopics: subs.map((s) => displayName(s.name)) }, concepts, FIGURE_KINDS,
      recheck ? readJson<string[]>((kindsBefore.get(t.key) as { kinds?: string } | undefined)?.kinds, []) : undefined)
    return [{ t, concepts, subs, count, prompt }]
  })
  const estimate = prepared.reduce((sum, p) => sum + estimateMapUsd(p.prompt.length, p.count), 0)
  console.log(`${prepared.length} topics to map, estimate $${estimate.toFixed(2)}`)
  assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })

  const send = bedrockSender()
  let done = 0
  try {
    await runPool(prepared, 6, async ({ t, concepts, subs, count, prompt }) => {
      const valid = { concepts: new Set(concepts.map((c) => c.id)), kinds: validKinds }
      let map: TopicMap | null = null
      try {
        for (let attempt = 0; attempt < 2 && !map; attempt++) {
          const raw = await askJson({ db, job: JOB, jobCapUsd: JOB_CAP_USD, prompt: attempt ? prompt + RETRY_NOTE : prompt, maxTokens: 2500, send })
          map = parseTopicMap(raw, t.subject, valid, count)
        }
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        failures.push(`${t.key}: ${String((err as Error)?.message ?? err).slice(0, 120)}`)
        return
      }
      if (!map) { failures.push(`${t.key}: no valid concept or kind after a retry`); return }
      saveTopicMap(db, t.key, subs.slice(0, count).map((s) => s.key), map, HAIKU)
      if (++done % 100 === 0) console.log(`  ${done}/${prepared.length}, spend $${totalSpend(db, JOB).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(`STOPPED BY BUDGET: ${err.message}`)
    process.exitCode = 2
  }
  console.log(`mapped ${done}; failed ${failures.length}; subtopics cut at ${MAX_SUBTOPICS} on ${truncated.length} topics`)
  if (failures.length) console.log(`failed (rerun to retry):\n  ${failures.slice(0, 50).join('\n  ')}`)
  if (truncated.length) console.log(`cut:\n  ${truncated.join('\n  ')}`)
  console.log(`${JOB} spend $${totalSpend(db, JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
