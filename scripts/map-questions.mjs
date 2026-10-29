import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { levelFromPaperPath } from '../lib/past-paper/book-level.ts'

const SONNET = 'eu.anthropic.claude-sonnet-5-5'
const PRICE = { input: 2.2, output: 11 }

function loadEnv() {
  const env = {}
  for (const name of ['.env', '.env.local']) {
    const file = path.join(process.cwd(), name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...process.env }
}

function costUsd(inputTokens, outputTokens) {
  return (inputTokens * PRICE.input + outputTokens * PRICE.output) / 1_000_000
}

const CAP = 95
const WORKERS = 12
const root = new URL('../data/past-paper-corpus/', import.meta.url)
const mapFile = new URL('../data/past-paper-corpus/mappings.jsonl', import.meta.url)
const papers = new URL('../data/past-paper-corpus/papers.jsonl', import.meta.url)

const levelMap = JSON.parse(fs.readFileSync(new URL('book_level_map.json', root), 'utf8'))
const enrichment = JSON.parse(fs.readFileSync(new URL('subtopic_enrichment.json', root), 'utf8'))
const snapshot = JSON.parse(fs.readFileSync(new URL('../curriculum/snapshot.json', import.meta.url), 'utf8'))
const levelByBook = new Map(levelMap.map((item) => [item.textbook_id, item]))
const books = new Map(snapshot.textbooks.map((b) => [b.textbook_id, b]))
const topics = new Map(snapshot.topics.map((t) => [t.topic_id, t]))
const subs = new Map(snapshot.subtopics.map((s) => [s.subtopic_id, s]))
const enrich = new Map(enrichment.map((e) => [e.subtopic_id, e]))

function normSubject(value) {
  const t = String(value ?? '').toLowerCase()
  if (/math/.test(t)) return 'mathematics'
  if (/physic/.test(t)) return 'physics'
  if (/chem/.test(t)) return 'chemistry'
  if (/bio/.test(t)) return 'biology'
  if (/econ/.test(t)) return 'economics'
  if (/comp|ict/.test(t)) return 'computing'
  if (/geo/.test(t)) return 'geography'
  if (/hist/.test(t)) return 'history'
  if (/english|literature/.test(t)) return 'english'
  return t.replace(/[^a-z]+/g, ' ').trim().split(' ')[0] ?? ''
}

function levelsMatch(paperLevel, bookLevel) {
  if (!paperLevel || !bookLevel) return false
  if (paperLevel === bookLevel) return true
  if (paperLevel === 'as_and_a_level') return bookLevel === 'as_level' || bookLevel === 'a_level' || bookLevel === 'as_and_a_level'
  return false
}

const STOP = new Set('which only correct following statement question answer using from with that this have been were their about when what where into also than then each both such more most some other between because would could should these those there here they them your graph diagram figure shown shows show part marks mark cells cell'.split(' '))
const words = (value) => String(value ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word))
const catalog = []
const index = new Map()
function addToken(token, id, weight) {
  const list = index.get(token)
  if (list) list.push([id, weight])
  else index.set(token, [[id, weight]])
}
for (const row of enrichment) {
  if (!row.mappable) continue
  const sub = subs.get(row.subtopic_id)
  const topic = topics.get(sub?.topic_id)
  const book = books.get(sub?.textbook_id ?? topic?.textbook_id)
  const level = levelByBook.get(book?.textbook_id)
  if (!book || !level || !sub) continue
  const item = {
    id: row.subtopic_id,
    topic_id: topic?.topic_id ?? null,
    textbook_id: book.textbook_id,
    system: level.system,
    subject: normSubject(book.textbook_name),
    label: `${topic?.topic ?? ''} — ${sub.subtopic}`,
  }
  catalog.push(item)
  for (const token of new Set(words(sub.subtopic))) addToken(token, catalog.length - 1, 3)
  for (const token of new Set(words(topic?.topic))) addToken(token, catalog.length - 1, 1)
}

function candidates(system, subject, text) {
  const want = normSubject(subject)
  const scores = new Map()
  for (const token of new Set(words(text))) {
    for (const [at, weight] of index.get(token) ?? []) {
      const item = catalog[at]
      if (item.system !== system) continue
      if (want && item.subject !== want) continue
      scores.set(at, (scores.get(at) ?? 0) + weight)
    }
  }
  return [...scores.entries()]
    .map(([at, score]) => ({ item: catalog[at], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

const done = new Set()
let spent = 0
if (fs.existsSync(mapFile)) {
  for (const line of fs.readFileSync(mapFile, 'utf8').split(/\n/).filter(Boolean)) {
    const row = JSON.parse(line)
    done.add(`${row.path}|${row.index}`)
    spent += Number(row.usd) || 0
  }
}
const out = fs.createWriteStream(mapFile, { flags: 'a' })
const env = loadEnv()
const client = new BedrockRuntimeClient({
  region: env.AWS_REGION || 'eu-west-1',
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
})

async function judge(text, options) {
  const prompt = `Choose the single best subtopic for this exam question from ONLY the list.
If none genuinely fit, answer id null. Do not invent a subtopic.
Reply as JSON: {"id": <number or null>, "confidence": "high"|"medium"|"low", "reason": "<one sentence>"}

Question:
${text.slice(0, 1200)}

Subtopics:
${options.map((item) => `${item.id}: ${item.label}`).join('\n')}`
  const res = await client.send(new InvokeModelCommand({
    modelId: SONNET,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 180,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    }),
  }))
  const body = JSON.parse(new TextDecoder().decode(res.body))
  const blocks = Array.isArray(body?.content) ? body.content : []
  const replyText = blocks.map((part) => part.text || part.thinking || '').join('\n')
  const usd = costUsd(Number(body?.usage?.input_tokens ?? 0), Number(body?.usage?.output_tokens ?? 0))
  const match = replyText.match(/\{[\s\S]*\}/)
  let parsed = { id: null, confidence: 'low', reason: replyText ? `no json: ${replyText.slice(0, 120)}` : 'empty reply' }
  if (match) {
    try { parsed = JSON.parse(match[0]) } catch { parsed = { id: null, confidence: 'low', reason: `bad json: ${match[0].slice(0, 120)}` } }
  }
  return { parsed, usd }
}

const jobs = []
const rl = readline.createInterface({ input: fs.createReadStream(papers), crlfDelay: Infinity })
for await (const line of rl) {
  if (!line) continue
  const paper = JSON.parse(line)
  const where = levelFromPaperPath(paper.path)
  paper.questions?.forEach((question, index) => {
    jobs.push({ paper, question, index, where })
  })
}

let cursor = 0
let mapped = 0
let unassigned = 0
async function worker() {
  for (;;) {
    if (spent >= CAP) return
    const job = jobs[cursor++]
    if (!job) return
    const key = `${job.paper.path}|${job.index}`
    if (done.has(key)) continue
    const text = `${job.question.stem ?? ''}\n${(job.question.parts ?? []).map((p) => p.text).join('\n')}`
    const ranked = candidates(job.where.system, job.where.subject, text)
    const options = ranked.map((row) => row.item)
    const clear = ranked.length > 0 && ranked[0].score >= 3 && ranked[0].score >= (ranked[1]?.score ?? 0) + 2
    let row
    if (!options.length || (spent >= CAP && !clear)) {
      row = { path: job.paper.path, index: job.index, number: job.question.number, system: job.where.system, level: job.where.level, subject: job.where.subject, subtopic_id: null, topic_id: null, textbook_id: null, confidence: 'none', reason: options.length ? 'spend cap' : 'no correlating subtopic', status: 'unassigned', usd: 0 }
      unassigned += 1
    } else if (clear) {
      const best = ranked[0].item
      row = { path: job.paper.path, index: job.index, number: job.question.number, system: job.where.system, level: job.where.level, subject: job.where.subject, subtopic_id: best.id, topic_id: best.topic_id, textbook_id: best.textbook_id, confidence: 'high', reason: 'subtopic words match the question', status: 'assigned', usd: 0 }
      mapped += 1
    } else {
      try {
        const { parsed, usd } = await judge(text, options)
        spent += usd
        const allowed = new Set(options.map((item) => item.id))
        const id = allowed.has(Number(parsed.id)) ? Number(parsed.id) : null
        const confidence = parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low' ? parsed.confidence : 'low'
        const status = id && confidence !== 'low' ? 'assigned' : 'unassigned'
        if (status === 'assigned') mapped += 1
        else unassigned += 1
        const chosen = options.find((item) => item.id === id)
        row = { path: job.paper.path, index: job.index, number: job.question.number, system: job.where.system, level: job.where.level, subject: job.where.subject, subtopic_id: status === 'assigned' ? id : null, topic_id: status === 'assigned' ? chosen?.topic_id ?? null : null, textbook_id: status === 'assigned' ? chosen?.textbook_id ?? null : null, confidence, reason: String(parsed.reason ?? '').slice(0, 300), status, usd }
      } catch (error) {
        row = { path: job.paper.path, index: job.index, number: job.question.number, system: job.where.system, level: job.where.level, subject: job.where.subject, subtopic_id: null, confidence: 'none', reason: error instanceof Error ? error.message.slice(0, 200) : 'call failed', status: 'unassigned', usd: 0 }
        unassigned += 1
      }
    }
    out.write(JSON.stringify(row) + '\n')
    if ((mapped + unassigned) % 100 === 0) console.log(`mapped ${mapped} unassigned ${unassigned} spent $${spent.toFixed(2)}`)
  }
}

const sampleOnly = process.argv.includes('--sample')
if (sampleOnly) {
  const want = ['biology', 'physics', 'mathematics']
  const picked = []
  for (const job of jobs) {
    const subject = normSubject(job.where.subject)
    if (!want.includes(subject) || picked.some((item) => item.subject === subject)) continue
    const text = `${job.question.stem ?? ''}`
    if (text.length < 40) continue
    picked.push({ subject, text, where: job.where, path: job.paper.path })
    if (picked.length === 3) break
  }
  for (const item of picked) {
    const ranked = candidates(item.where.system, item.subject, item.text)
    console.log('\nSUBJECT', item.subject, item.path)
    console.log(item.text.replace(/\s+/g, ' ').slice(0, 180))
    if (!ranked.length) console.log('NO CANDIDATES')
    for (const row of ranked) console.log(row.score, row.item.subject, row.item.label)
    const live = process.argv.includes('--live')
    if (live && ranked.length) {
      const { parsed, usd } = await judge(item.text, ranked.map((row) => row.item))
      console.log('MODEL', JSON.stringify(parsed), 'usd', usd.toFixed(4))
    }
  }
  process.exit(0)
}

console.log(`questions ${jobs.length} already ${done.size} spent $${spent.toFixed(2)} cap $${CAP}`)
await Promise.all(Array.from({ length: WORKERS }, () => worker()))
out.end()
console.log(JSON.stringify({ mapped, unassigned, spent: Number(spent.toFixed(2)), cap: CAP }))
