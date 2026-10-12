// scripts/figure-library/make-terms.ts
// Run: npx jiti scripts/figure-library/make-terms.ts --keys=db:2,db:36 [--dry]
// Haiku makes each topic's Wikimedia search terms from its syllabus points (P1b.2).
import { openStore } from './store'
import { parseArgs } from './args'
import { assertBudget, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender } from './claude'
import { TERMS_JOB, parseTerms, saveTerms, termsPrompt, topicsForTerms } from './terms'

const JOB_CAP_USD = 0.5
const PER_TOPIC_USD = 0.004

async function main() {
  const args = parseArgs(process.argv.slice(2), { keys: 'string', dry: 'flag' })
  if (!args.keys) throw new Error('--keys=db:2,db:36 is needed')
  const db = openStore()
  const items = topicsForTerms(db, String(args.keys).split(',').map((s) => s.trim()).filter(Boolean))
  const estimate = items.length * PER_TOPIC_USD
  console.log(`${items.length} topics, estimate $${estimate.toFixed(3)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: TERMS_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  try {
    for (const t of items) {
      const terms = parseTerms(await askJson({ db, job: TERMS_JOB, jobCapUsd: JOB_CAP_USD, prompt: termsPrompt(t), maxTokens: 800, send, model: HAIKU }))
      saveTerms(db, t.key, HAIKU, terms)
      console.log(`${t.key} ${t.topic}\n  diagrams: ${terms.diagrams.join('; ')}\n  photos: ${terms.photos.join('; ')}`)
    }
  } finally {
    console.log(`${TERMS_JOB} spend $${totalSpend(db, TERMS_JOB).toFixed(3)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
