// scripts/figure-library/probe-supply.ts
// Run: npx jiti scripts/figure-library/probe-supply.ts [--limit=200] [--redo]
// Free: Wikimedia's search API. One request at a time, 250 ms apart.
import { openStore } from './store'
import { parseArgs } from './args'
import { sleep } from './claude'
import { countImages, saveSupply, termsToProbe } from './wikimedia'

async function main() {
  const args = parseArgs(process.argv.slice(2), { limit: 'int', redo: 'flag' })
  const db = openStore()
  const all = termsToProbe(db, args.redo === true)
  const todo = args.limit ? all.slice(0, args.limit as number) : all
  console.log(`${todo.length} search terms to count (about ${Math.ceil(todo.length * 0.7 / 60)} minutes)`)
  let done = 0
  const failed: string[] = []
  for (const term of todo) {
    try {
      saveSupply(db, term, await countImages(term))
      done++
    } catch (err) {
      failed.push(`${term}: ${String((err as Error)?.message ?? err).slice(0, 100)}`)
    }
    if ((done + failed.length) % 200 === 0) console.log(`  ${done + failed.length}/${todo.length}`)
    await sleep(250)
  }
  console.log(`counted ${done}; failed ${failed.length}`)
  if (failed.length) { console.log(`failed (rerun to retry):\n  ${failed.slice(0, 30).join('\n  ')}`); process.exitCode = 1 }
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
