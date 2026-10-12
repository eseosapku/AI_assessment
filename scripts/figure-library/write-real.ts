// scripts/figure-library/write-real.ts
// Run: npx jiti scripts/figure-library/write-real.ts [--writer=haiku|sonnet] [--ids=<file>] [--limit=N] [--dry] [--workers=4]
// Writes questions for screened real images, then checks them in a separate strict call by the
// same model (spec 5.3 steps 5 and 6). Resumable: an image is written once per writer.
import fs from 'node:fs'
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { HAIKU, SONNET, askJson, bedrockSender, runPool } from './claude'
import { previewImage } from './review'
import { checkPrompt, parseChecked, parseWritten, saveWritten, toWrite, writePrompt } from './write'

const MODELS = { haiku: HAIKU, sonnet: SONNET } as const
const CAPS = { haiku: 6, sonnet: 3 } as const
/** A 1,200 px image (about 1,500 tokens) twice, two prompts, and the questions and verdicts back. */
const PER_ITEM = { haiku: 0.012, sonnet: 0.03 } as const
const MAX_UNUSABLE = 10

async function main() {
  const args = parseArgs(process.argv.slice(2), { writer: 'string', ids: 'string', limit: 'int', dry: 'flag', workers: 'int' })
  const tag = String(args.writer ?? 'haiku')
  if (tag !== 'haiku' && tag !== 'sonnet') throw new Error('--writer must be haiku or sonnet')
  const model = MODELS[tag]
  const job = `p1b-write-${tag}`
  const cap = CAPS[tag]
  const ids = args.ids ? fs.readFileSync(String(args.ids), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : undefined
  const db = openStore()
  const lib = libraryDir()
  const items = toWrite(db, { writer: model, figureIds: ids, limit: args.limit as number | undefined })
  const estimate = items.length * PER_ITEM[tag]
  console.log(`${items.length} images to write for (${tag}), estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job, estimateUsd: estimate, jobCapUsd: cap })
  const send = bedrockSender()
  const unusable: string[] = []
  let written = 0
  let kept = 0
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, { preview: item.image })
      if (!image) {
        unusable.push(`${item.figureId}: no image file`)
        return
      }
      try {
        const { questions, refused } = parseWritten(
          await askJson({ db, job, jobCapUsd: cap, prompt: writePrompt(item), images: [image], maxTokens: 2000, send, model }), item.figureId)
        const checks = questions.length
          ? parseChecked(await askJson({ db, job, jobCapUsd: cap, prompt: checkPrompt(item, questions), images: [image], maxTokens: 1000, send, model }), questions.length)
          : []
        written += questions.length
        kept += saveWritten(db, { figureId: item.figureId, writer: model, band: item.band, questions, checks, refused })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} images failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 20 === 0) console.log(`  ${done}/${items.length} written, $${totalSpend(db, job).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    console.log(`Wrote for ${done} images: ${written} questions, ${kept} kept by the check.`)
    if (unusable.length) console.log(`${unusable.length} not written (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`${job} spend $${totalSpend(db, job).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
