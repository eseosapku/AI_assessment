/**
 * Is the focus a figure was filed under really what it is about?
 *
 * The tagger must pick a focus from the syllabus list, and when the paper
 * examined something the list has no entry for it picks the nearest one: a
 * cat's renal system, from a question about kidneys and the bladder, was filed
 * under "the human digestive system". The writer is then told the topic is
 * digestion and handed a picture of kidneys -- and wrote "Explain how organ C
 * aids in digestion", keyed as the pancreas, for an organ that is a kidney.
 *
 * A text-only second opinion on each filing, cheap enough to run on the whole
 * bank. Writes `fit` ("yes" | "no") into the tags file; the merge refuses "no".
 *
 * Run with:  npx jiti scripts/check-figure-focus-fit.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const ROOT = process.cwd()
const TAGS = path.join(ROOT, 'data', 'checkpoint-figure-bank.tags.json')
const RAW = path.join(ROOT, 'data', 'checkpoint-figure-bank.raw.json')
const MODEL = process.env.FIT_MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

async function main() {
  const env = { ...loadEnv(), ...process.env } as Record<string, string>
  const client = new BedrockRuntimeClient({
    region: env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
  const tags = JSON.parse(fs.readFileSync(TAGS, 'utf8'))
  const raw = new Map<string, any>(JSON.parse(fs.readFileSync(RAW, 'utf8')).figures.map((f: any) => [f.id, f]))
  const todo = Object.entries(tags).filter(([id, t]: [string, any]) =>
    t?.usable && !t.fit && /^(0893|0097|0862)$/.test(String(raw.get(id)?.code)))
  console.log(`${todo.length} filings to check with ${MODEL}`)

  let n = 0
  const queue = [...todo]
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const [id, t] = queue.shift() as [string, any]
      const prompt = [
        'A figure from a school science or mathematics exam has been filed under a syllabus topic.',
        `Topic it was filed under: "${t.focus}"`,
        `What the figure shows: ${t.shows}`,
        `The exam question that used it: ${String(t.original).slice(0, 600)}`,
        '',
        'Would a teacher agree this figure is about that topic, so a question on that topic could be asked using it?',
        'Answer "no" only when the figure is plainly about something else (for example, kidneys filed under digestion).',
        'Reply with one word: yes or no.',
      ].join('\n')
      try {
        const res = await client.send(new InvokeModelCommand({
          modelId: MODEL, contentType: 'application/json', accept: 'application/json',
          body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 5, messages: [{ role: 'user', content: prompt }] }),
        }))
        const text = String(JSON.parse(new TextDecoder().decode(res.body)).content?.[0]?.text ?? '').trim().toLowerCase()
        t.fit = text.startsWith('no') ? 'no' : 'yes'
        n++
      } catch (err: any) {
        console.log(`  FAILED ${id}: ${String(err?.message ?? err).slice(0, 120)}`)
      }
    }
  }))
  fs.writeFileSync(TAGS, JSON.stringify(tags, null, 1))
  const no = Object.values(tags).filter((t: any) => t?.fit === 'no') as any[]
  console.log(`checked ${n}; ${no.length} filed under a topic they are not about:`)
  for (const t of no) console.log(`  [${t.focus}] ${String(t.shows).slice(0, 90)}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
