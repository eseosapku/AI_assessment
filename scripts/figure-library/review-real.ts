// scripts/figure-library/review-real.ts
// Run: npx jiti scripts/figure-library/review-real.ts --writer=haiku|sonnet --ids=<file> [--dry] [--workers=4]
//      npx jiti scripts/figure-library/review-real.ts --compare
// The blind review of one writer's questions on the comparison images (spec 5.5): Sonnet
// answers without the keys, code compares. --compare applies the rule: Haiku is accepted if
// its clean rate is at least 90% of Sonnet's.
import fs from 'node:fs'
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { HAIKU, SONNET, askJson, bedrockSender, runPool } from './claude'
import { REVIEW_SIZE, REVIEW_USD_PER_ITEM, cleanRate, itemsToReview, notedPasses, parseVerdict, previewImage, reviewPrompt, saveVerdict } from './review'

const MODELS = { haiku: HAIKU, sonnet: SONNET } as const
const JOB_CAP_USD = 2
const MAX_UNUSABLE = 10

function compare(db: ReturnType<typeof openStore>): void {
  const h = cleanRate(db, 'p1b-blind-haiku')
  const s = cleanRate(db, 'p1b-blind-sonnet')
  const pct = (r: number) => `${(100 * r).toFixed(1)}%`
  console.log(`Haiku:  ${h.clean}/${h.questions} questions clean on ${h.figures} images (${pct(h.rate)})`)
  console.log(`Sonnet: ${s.clean}/${s.questions} questions clean on ${s.figures} images (${pct(s.rate)})`)
  if (!h.questions || !s.questions) return void console.log('Not decided: review both writers first.')
  const ok = h.rate >= 0.9 * s.rate
  console.log(`Haiku is ${pct(s.rate ? h.rate / s.rate : 1)} of Sonnet's clean rate: ${ok ? 'ACCEPTED (at least 90%)' : 'NOT ACCEPTED (under 90%)'}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { writer: 'string', ids: 'string', dry: 'flag', workers: 'int', compare: 'flag' })
  const db = openStore()
  if (args.compare) {
    compare(db)
    db.close()
    return
  }
  const tag = String(args.writer ?? '')
  if (tag !== 'haiku' && tag !== 'sonnet') throw new Error('--writer must be haiku or sonnet')
  if (!args.ids) throw new Error('--ids=<file> is needed: the comparison images')
  const job = `p1b-blind-${tag}`
  const ids = fs.readFileSync(String(args.ids), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const lib = libraryDir()
  const items = itemsToReview(db, { job, size: REVIEW_SIZE, figureIds: ids, writer: MODELS[tag] })
  const estimate = items.length * REVIEW_USD_PER_ITEM
  console.log(`${items.length} images of ${tag} questions to review, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  const unusable: string[] = []
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no image file`)
        return
      }
      try {
        const raw = await askJson({ db, job, jobCapUsd: JOB_CAP_USD, prompt: reviewPrompt(item), images: [image], maxTokens: 2500, send, model: SONNET })
        saveVerdict(db, { job, model: SONNET, figureId: item.figureId, verdict: parseVerdict(raw, item), mark: false })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} reviews failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      done++
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    const c = cleanRate(db, job)
    console.log(`${job}: ${c.clean}/${c.questions} questions clean on ${c.figures} images`)
    const noted = notedPasses(db, job)
    if (noted.length) console.log(`${noted.length} passes carry a reviewer's concern:\n  ${noted.map((n) => `${n.figureId}: ${n.notes}`).join('\n  ')}`)
    if (unusable.length) console.log(`${unusable.length} not reviewed (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`Reviewed ${done} this run. ${job} spend $${totalSpend(db, job).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
