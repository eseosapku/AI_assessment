/**
 * Builds lib/studylab/practice-cards.json: for each (subject family, topic name) pair, the first scene
 * example a small model says fits that topic. Read-only on the curriculum tables.
 * jiti cannot load the .tsx engines, so run it from a temporary vitest file that calls main().
 * Or: JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/build-practice-cards.ts
 * Verdicts are appended to .superpowers/practice-cards/judged.jsonl, so a restart skips what is done.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { scenesFor } from '@/lib/studylab/engines'
import { examplesOf } from '@/lib/studylab/engines/examples'
import { cleanChapterName } from '@/lib/studylab/rack'
import { familyFor } from '@/lib/studylab/subjectFamily'

const ROOT = 'C:/Users/Stephen/AI_assessment'
const req = createRequire(`${ROOT}/package.json`)
const { Client } = req('pg')
const { BedrockRuntimeClient, ConverseCommand } = req('@aws-sdk/client-bedrock-runtime')

const MODEL = 'global.moonshotai.kimi-k3'
const IN_PER_M = 1.5 // flex tier
const OUT_PER_M = 7.5
const CAP_USD = 10
const CONCURRENCY = 12
const DIR = path.join(ROOT, '.superpowers/practice-cards')
const LOG = path.join(DIR, 'judged.jsonl')
const OUT = path.join(ROOT, 'lib/studylab/practice-cards.json')

const env: Record<string, string> = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(DATABASE_URL|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_REGION)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const bedrock = new BedrockRuntimeClient({
  region: 'us-west-2',
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  maxAttempts: 8,
  requestHandler: { requestTimeout: 300000 },
})

const SYSTEM = `You check whether a practice exercise belongs to a school topic. Be strict: a wrong exercise is far worse than none.
Answer "yes" only if a student studying exactly this topic, in this subject, would be practising this topic by doing this exercise.
Answer "no" if the exercise is only loosely related, belongs to another subject, is about a different idea from the same scene, or covers a wider or narrower idea than the topic names.
In a language subject (family "words"), a chapter named after a theme such as "Weather" or "Life long ago" is practising reading, writing or grammar, not the theme's content, so a science, history or geography exercise is a no. Only an exercise in the language skill itself fits.
Reply with one word: yes or no.`

export const stats = { get spent() { return spent }, get calls() { return calls } }
let spent = 0
let calls = 0
export async function judge(family: string, name: string, engine: string, prompt: string): Promise<boolean> {
  const text = `Subject family: ${family}\nTopic: ${name}\nScene id: ${engine}\nExercise: ${prompt}\n\nWould a student studying exactly this topic be practising this topic by doing this exercise? Answer yes or no.`
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await bedrock.send(new ConverseCommand({
        modelId: MODEL, serviceTier: { type: 'flex' }, system: [{ text: SYSTEM }],
        messages: [{ role: 'user', content: [{ text }] }],
        inferenceConfig: { maxTokens: 1500 },
        additionalModelRequestFields: { reasoning: { effort: 'low' } },
      }))
      calls++
      spent += ((r.usage?.inputTokens ?? 0) * IN_PER_M + (r.usage?.outputTokens ?? 0) * OUT_PER_M) / 1e6
      const answer = (r.output?.message?.content ?? []).map((c: any) => c.text ?? '').join(' ').toLowerCase()
      const last = [...answer.matchAll(/\b(yes|no)\b/g)].pop()
      if (!last) throw new Error(`no yes/no in answer: ${answer.slice(0, 80)}`)
      return last[1] === 'yes'
    } catch (e: any) {
      if (attempt < 14 && /throttl|too many|timeout|ECONNRESET|ServiceUnavailable/i.test(`${e?.name} ${e?.message}`)) {
        await new Promise((res) => setTimeout(res, Math.min(60000, 1000 * 2 ** attempt)))
        continue
      }
      throw e
    }
  }
}

export async function main() {
  fs.mkdirSync(DIR, { recursive: true })
  const db = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query('SET default_transaction_read_only = on')
  const chapters = await db.query(`SELECT t.textbook_name AS book, p.topic AS name FROM topics p JOIN textbooks t ON t.textbook_id = p.textbook_id WHERE t.curriculum NOT IN (3,4)`)
  const sections = await db.query(`SELECT t.textbook_name AS book, s.subtopic AS name FROM subtopics s JOIN textbooks t ON t.textbook_id = s.textbook_id WHERE t.curriculum NOT IN (3,4)`)
  await db.end()

  const pairs = new Map<string, { family: string; name: string }>()
  for (const r of [...chapters.rows, ...sections.rows]) {
    if (!r.name) continue
    const family = familyFor(r.book).name
    const name = String(r.name).toLowerCase().trim()
    pairs.set(`${family}:${name}`, { family, name })
  }
  console.log('unique pairs', pairs.size)

  const done = new Map<string, boolean>()
  if (fs.existsSync(LOG)) for (const l of fs.readFileSync(LOG, 'utf8').split('\n')) if (l) { const v = JSON.parse(l); done.set(`${v.key}|${v.engine}|${v.index}`, v.fit) }

  const accepted: Record<string, [string, number]> = {}
  const queue = [...pairs.entries()]
  let stopped = false
  async function work() {
    while (queue.length && !stopped) {
      const [key, { family, name }] = queue.shift()!
      search: for (const engine of scenesFor(name)) {
        const examples = examplesOf(engine)
        for (let i = 0; i < examples.length; i++) {
          const id = `${key}|${engine.id}|${i}`
          let fit = done.get(id)
          if (fit === undefined) {
            if (spent > CAP_USD) { stopped = true; return }
            fit = await judge(family, name, engine.id, examples[i].prompt)
            fs.appendFileSync(LOG, JSON.stringify({ key, engine: engine.id, index: i, fit, prompt: examples[i].prompt }) + '\n')
          }
          if (fit) { accepted[key] = [engine.id, i]; break search }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, work))
  console.log(stopped ? 'STOPPED: spend cap' : 'finished', { calls, spent: spent.toFixed(3) })
  if (stopped) throw new Error('spend cap reached')
  // The rack shows chapter names without "Chapter 9:" and hands those to the picker, so list that spelling too.
  for (const [key, hit] of Object.entries({ ...accepted })) {
    const at = key.indexOf(':')
    const bare = `${key.slice(0, at)}:${cleanChapterName(key.slice(at + 1)).toLowerCase()}`
    if (!(bare in accepted)) accepted[bare] = hit
  }
  const sorted = Object.fromEntries(Object.entries(accepted).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n')
  console.log('accepted', Object.keys(sorted).length, 'of', pairs.size)
}
if (process.argv[1]?.endsWith('build-practice-cards.ts')) main().catch((e) => { console.error(e); process.exit(1) })
