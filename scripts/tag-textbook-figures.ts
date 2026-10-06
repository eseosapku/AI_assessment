/**
 * Judge each textbook figure the book asks a question about: is it up to the
 * standard of the past-paper figures, what does it show, and which of the
 * book's own topics is it about.
 *
 * In:  data/textbook-question-figures.raw.json  (digital books: build_textbook_question_figures.py)
 *      data/textbook-scan-figures.raw.json      (scanned books: locate-scanned-figures.ts)
 * Out: data/textbook-figure-bank.tags.json      (resumable; only untagged ids cost)
 *
 * The standard is the one the user picked out from the Checkpoint papers:
 * purpose-drawn figures a question can be answered from -- a labelled diagram,
 * apparatus, a chart, a graph, a table -- not illustration. A textbook is full
 * of illustration that an exercise happens to mention ("Plan an experiment to
 * test this hypothesis" under a photo of a boy playing the trombone), and the
 * exercise mentioning it does not make it a figure a question can be asked
 * about.
 *
 * Run with:  npx jiti scripts/tag-textbook-figures.ts [--limit=N] [--only=34,35]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { loadRawTextbookFigures, type RawTextbookFigure } from './textbook-figure-raw'

const ROOT = process.cwd()
const OUT = process.env.TAG_OUT || path.join(ROOT, 'data', 'textbook-figure-bank.tags.json')
const MODEL = process.env.TAG_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
const LIMIT = Number(arg('limit')) || Infinity
const ONLY = arg('only').split(',').filter(Boolean).map(Number)
const IDS = new Set(arg('ids').split(',').filter(Boolean))

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function prompt(f: RawTextbookFigure, topics: string[]): string {
  // A Rwanda library image comes with the text of its page, not with an
  // exercise known to ask about it (scripts/rwanda-figure-raw.ts).
  const pageText = f.id.startsWith('rw')
  return [
    pageText
      ? `This figure is from the textbook "${f.textbookName}" (page ${f.page}).`
      : `This figure is from the textbook "${f.textbookName}" (page ${f.page}). An exercise in the book asks about it.`,
    'A question will be written about it by a writer who CANNOT see it and relies entirely on what you say it shows.',
    '',
    ...(f.labels.length ? [`Text printed on or beside the figure: ${f.labels.slice(0, 30).join(' | ')}`, ''] : []),
    pageText ? 'The text printed on the same page (it may or may not include an activity or exercise about this figure):' : 'The book\'s exercise:',
    '"""',
    f.question.slice(0, 1400),
    '"""',
    '',
    'The book\'s topics (choose one):',
    ...topics.map((t) => `- ${t}`),
    '',
    'Reply with JSON only:',
    '{',
    '  "standard": true or false,',
    '  "reason": "why not, when standard is false",',
    '  "noun": "what a question calls it: diagram, drawing, graph, bar chart, pie chart, table, chart, map, number line, grid, flowchart, photograph",',
    '  "shows": "what is drawn, in one to three plain sentences: every labelled part and every printed value, exactly. Nothing that is not visible.",',
    '  "labels": ["every word or number printed on the figure, in reading order"],',
    '  "topic": "one topic from the list, copied exactly",',
    pageText
      ? '  "original": "the lines of the page text that ask about THIS figure, copied exactly, at most 700 characters -- or an empty string if none do"'
      : '  "original": "the lines of the exercise that ask about THIS figure, copied exactly, at most 700 characters"',
    '}',
    '',
    'standard is TRUE only for a figure a test question could be asked about and answered from, as in an exam paper:',
    'a labelled diagram, a drawing of apparatus, an organism, an object or a shape, a chart, a graph, a table, a map, a number line,',
    'a flowchart or program code -- or a clear photograph whose subject the question is plainly about.',
    '',
    'standard is FALSE when any of these is true:',
    '- it is illustration: a scene, people or children talking or working, a cartoon character, a decorative or stock photo',
    pageText
      ? '- no test question could be answered from it: people, a scene or an object with nothing a learner could be asked about'
      : '- the exercise does not really need it (it asks the learner to plan, research, discuss, draw their own, or go outside)',
    '- the crop is cut off, so part of the figure or its labels is missing, or it holds two unrelated figures',
    '- the crop contains a sentence of the exercise (a question, an instruction) rather than only labels and a title',
    '- it is blurry, too small to read, or carries a watermark',
    '- the answer to the exercise is printed on it',
  ].join('\n')
}

async function main() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000, query_timeout: 60_000, keepAlive: true,
  })
  const raw = loadRawTextbookFigures().filter((f) => (!ONLY.length || ONLY.includes(f.textbookId)) && (!IDS.size || IDS.has(f.id)))
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const topicsFor = new Map<number, string[]>()
  for (const id of new Set(raw.map((f) => f.textbookId))) {
    const { rows } = await pool.query('SELECT topic FROM topics WHERE textbook_id = $1 ORDER BY topic_id', [id])
    topicsFor.set(id, rows.map((r: any) => String(r.topic).trim()).filter(Boolean))
  }
  await pool.end()
  const todo = raw.filter((f) => !done[f.id] && fs.existsSync(path.join(ROOT, 'public', f.localPath))).slice(0, LIMIT)
  console.log(`${todo.length} to judge (${Object.keys(done).length} done) with ${MODEL}`)

  let inTok = 0, outTok = 0, n = 0
  const save = () => fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  const queue = [...todo]
  await Promise.all(Array.from({ length: Number(arg('parallel')) || 6 }, async () => {
    while (queue.length) {
      const f = queue.shift()!
      const data = fs.readFileSync(path.join(ROOT, 'public', f.localPath)).toString('base64')
      const body = {
        anthropic_version: 'bedrock-2023-05-31', max_tokens: 2000,
        // Sonnet thinks at length by default; Haiku refuses the parameter.
        ...(/sonnet|opus/.test(MODEL) ? { output_config: { effort: 'low' } } : {}),
        messages: [{ role: 'user', content: [
          // The Rwanda library's images are JPEG.
          { type: 'image', source: { type: 'base64', media_type: /\.png$/i.test(f.localPath) ? 'image/png' : 'image/jpeg', data } },
          { type: 'text', text: prompt(f, topicsFor.get(f.textbookId) ?? []) },
        ] }],
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
          const out = JSON.parse(new TextDecoder().decode(res.body))
          inTok += out.usage?.input_tokens ?? 0; outTok += out.usage?.output_tokens ?? 0
          const text = String(out.content?.find((c: any) => c.type === 'text')?.text ?? '')
          done[f.id] = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
          n++
          if (n % 25 === 0) { save(); console.log(`  ${n}/${todo.length}  tokens in ${inTok} out ${outTok}`) }
          break
        } catch (err: any) {
          if (attempt === 2) console.log(`  FAILED ${f.id}: ${String(err?.message ?? err).slice(0, 140)}`)
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
    }
  }))
  save()
  console.log(`judged ${n}; tokens in ${inTok} out ${outTok}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
