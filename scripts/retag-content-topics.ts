/**
 * Give real topics to the figures of books whose database topics never came out.
 *
 * Primary Mathematics 3 has one topic, "Introduction", and 4 and 5 one each,
 * "Number": their topic extraction failed on the scans. The judge had to file
 * every figure under that one name, so the bank could not tell a clock from a
 * place value chart. Here each such figure is filed again, by what it shows
 * and the exercise about it, under a standard topic for its subject.
 *
 * Text only (no image), Haiku: the description and the exercise are already
 * written, and choosing from a list is all that is left. Writes
 * `content_topic` into data/textbook-figure-bank.tags.json; the merge uses it.
 *
 * Run with:  npx jiti scripts/retag-content-topics.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { loadRawTextbookFigures } from './textbook-figure-raw'

const ROOT = process.cwd()
const TAGS = path.join(ROOT, 'data', 'textbook-figure-bank.tags.json')
const MODEL = process.env.RETAG_MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const TOPICS: Record<string, string[]> = {
  mathematics: [
    'Place value and rounding', 'Addition and subtraction', 'Multiplication and division', 'Fractions',
    'Decimals and percentages', 'Money', 'Time', 'Length, mass and capacity', '2D shapes', '3D shapes',
    'Angles', 'Position and movement', 'Symmetry and reflection', 'Statistics and data', 'Probability',
    'Patterns and sequences', 'Area and perimeter',
  ],
}

async function main() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  const tags = JSON.parse(fs.readFileSync(TAGS, 'utf8'))
  const raw = loadRawTextbookFigures()
  // A book is a catch-all when all of its standard figures share one topic.
  const byBook = new Map<number, any[]>()
  for (const f of raw) if (tags[f.id]?.standard) byBook.set(f.textbookId, [...(byBook.get(f.textbookId) ?? []), f])
  const todo: { f: any; list: string[] }[] = []
  for (const [, figs] of byBook) {
    const topics = new Set(figs.map((f) => tags[f.id].topic))
    if (figs.length < 30 || topics.size > 1) continue
    if (!/math/i.test(figs[0].textbookName)) continue
    for (const f of figs) if (!tags[f.id].content_topic) todo.push({ f, list: TOPICS.mathematics })
  }
  console.log(`${todo.length} figures to file by content with ${MODEL}`)
  let n = 0
  const queue = [...todo]
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const { f, list } = queue.shift()!
      const t = tags[f.id]
      const prompt = [
        'A figure from a primary school mathematics textbook.',
        `What it shows: ${t.shows}`,
        `The exercise about it: ${String(t.original).slice(0, 500)}`,
        '',
        'Which ONE of these topics is it about? Reply with the topic exactly as written, nothing else.',
        ...list.map((x) => `- ${x}`),
      ].join('\n')
      try {
        const res = await client.send(new InvokeModelCommand({
          modelId: MODEL, contentType: 'application/json', accept: 'application/json',
          body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 20, messages: [{ role: 'user', content: prompt }] }),
        }))
        const text = String(JSON.parse(new TextDecoder().decode(res.body)).content?.[0]?.text ?? '').trim().replace(/^-\s*/, '')
        const hit = list.find((x) => x.toLowerCase() === text.toLowerCase())
        if (hit) { t.content_topic = hit; n++ }
      } catch (err: any) {
        console.log(`  FAILED ${f.id}: ${String(err?.message ?? err).slice(0, 100)}`)
      }
    }
  }))
  fs.writeFileSync(TAGS, JSON.stringify(tags, null, 1))
  const count: Record<string, number> = {}
  for (const { f } of todo) { const c = tags[f.id].content_topic ?? '(none)'; count[c] = (count[c] ?? 0) + 1 }
  console.log(`filed ${n}`, count)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
