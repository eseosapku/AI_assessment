/**
 * Check which of its book's chapters each bank figure is about, where "none
 * of them" is an answer.
 *
 * The tagger chose a topic from the book's topics as the database lists them,
 * and had to choose one. The IGCSE Biology book is listed with 11 of its 21
 * chapters, so a synapse, a sperm cell and a table of gametes were filed
 * under "Cells", and a food web under "Characteristics and classification":
 * a Cells quiz showed the synapse. Asked again from the figure's description
 * with "none" allowed, a figure from an unlisted chapter is filed under the
 * chapter it does belong to, which no listed topic will match.
 *
 * Text only -- the description is detailed, and the picture is not needed to
 * place it in a chapter. Only figures filed under one of their book's database
 * topics; the books filed by content (Primary Mathematics 3-5) already are.
 *
 * In:  data/textbook-figure-bank.json + the database's topics per book
 * Out: data/figure-topic-check.json (resumable)
 *      --apply  rewrites the bank's topics from it
 *
 * Run with:  npx jiti scripts/recheck-figure-topics.ts [--books=1,10] [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const ROOT = process.cwd()
const BANK = path.join(ROOT, 'data', 'textbook-figure-bank.json')
const OUT = path.join(ROOT, 'data', 'figure-topic-check.json')
const MODEL = process.env.TAG_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
const BOOKS = arg('books').split(',').filter(Boolean).map(Number)

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function prompt(f: any, topics: string[]): string {
  return [
    `A figure from the textbook "${String(f.textbookName).trim()}", page ${f.page}.`,
    `It is a ${f.noun}. What it shows: ${f.shows}`,
    ...(f.labels?.length ? [`Text printed on it: ${f.labels.slice(0, 30).join(' | ')}`] : []),
    'The book\'s exercise about it:',
    '"""',
    String(f.original ?? '').slice(0, 900),
    '"""',
    '',
    'The book\'s chapters as our database lists them. The list may be INCOMPLETE: some of the book\'s chapters may be missing.',
    ...topics.map((t) => `- ${t}`),
    '',
    'Which listed chapter teaches what this figure is about?',
    'If the chapter that teaches it is not on the list, the answer is "none". Do not pick the nearest listed chapter because it shares',
    'a word or a theme: a synapse belongs to coordination, not "Cells"; a food web to ecology, not "Characteristics and classification";',
    'a table of gametes to inheritance. A figure in a revision or exam-practice section belongs to the chapter its content is taught in.',
    '',
    'Reply with JSON only:',
    '{"topic": "one listed chapter copied exactly, or none", "about": "the chapter that does teach it, 1 to 4 words, e.g. Inheritance"}',
  ].join('\n')
}

/** A chapter name without its number or its unit: "Chapter 5: Calculating angles" is "calculating angles". */
const bare = (t: string) => t.toLowerCase().replace(/^(chapter|unit|topic)?\s*\d+[a-z]?\s*[:.\-–]?\s*/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

function apply(): void {
  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'))
  const check: Record<string, any> = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  // The listed chapters per book, from what the check was asked against.
  const topicsByBook = new Map<number, string[]>()
  for (const f of bank.figures) {
    const c = check[f.id]
    if (!c) continue
    const id = Number(f.textbookIds[0])
    const list = topicsByBook.get(id) ?? []
    for (const t of [c.was, c.inList ? c.topic : null]) if (t && !list.includes(t)) list.push(t)
    topicsByBook.set(id, list)
  }
  let moved = 0, unlisted = 0
  for (const f of bank.figures) {
    const c = check[f.id]
    if (!c?.topic) continue
    let listed = c.topic !== 'none' && c.inList === true
    let next = listed ? c.topic : String(c.about ?? '').trim()
    // "none", and then the listed chapter's own name without its number:
    // "Calculating angles" for "Chapter 5: Calculating angles". Kept as the
    // listed chapter, or a quiz on it stops finding its own figures.
    const same = !listed && (topicsByBook.get(Number(f.textbookIds[0])) ?? []).find((t) => bare(t) === bare(next))
    if (same) { listed = true; next = same }
    if (!next || next === f.topic) continue
    if (listed) moved++; else unlisted++
    f.topic = next
  }
  fs.writeFileSync(BANK, JSON.stringify(bank, null, 1))
  console.log(`applied: ${moved} moved to another listed chapter, ${unlisted} to a chapter the database does not list`)
}

async function main() {
  if (process.argv.includes('--apply')) return apply()
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  const figures: any[] = JSON.parse(fs.readFileSync(BANK, 'utf8')).figures
    .filter((f: any) => !BOOKS.length || f.textbookIds.some((id: number) => BOOKS.includes(id)))
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const topicsFor = new Map<number, string[]>()
  for (const id of new Set(figures.map((f) => Number(f.textbookIds[0])))) {
    const { rows } = await pool.query('SELECT topic FROM topics WHERE textbook_id = $1 ORDER BY topic_id', [id])
    topicsFor.set(id, [...new Set(rows.map((r: any) => String(r.topic).trim()).filter(Boolean))] as string[])
  }
  await pool.end()
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  // Filed under one of its book's database topics: the tagger's forced choice.
  const todo = figures.filter((f) => !done[f.id] && (topicsFor.get(Number(f.textbookIds[0])) ?? []).includes(f.topic))
  console.log(`${todo.length} to check (${Object.keys(done).length} done) with ${MODEL}`)

  let inTok = 0, outTok = 0, n = 0
  const save = () => fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  const queue = [...todo]
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const f = queue.shift()!
      const listed = topicsFor.get(Number(f.textbookIds[0])) ?? []
      const body = {
        anthropic_version: 'bedrock-2023-05-31', max_tokens: 1200, output_config: { effort: 'low' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt(f, listed) }] }],
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
          const out = JSON.parse(new TextDecoder().decode(res.body))
          inTok += out.usage?.input_tokens ?? 0; outTok += out.usage?.output_tokens ?? 0
          const text = String(out.content?.find((c: any) => c.type === 'text')?.text ?? '')
          const got = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
          const topic = String(got.topic ?? '').trim()
          done[f.id] = { was: f.topic, topic, about: String(got.about ?? '').trim(), inList: listed.includes(topic) }
          n++
          if (n % 50 === 0) { save(); console.log(`  ${n}/${todo.length}  tokens in ${inTok} out ${outTok}`) }
          break
        } catch (err: any) {
          if (attempt === 2) console.log(`  FAILED ${f.id}: ${String(err?.message ?? err).slice(0, 140)}`)
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
    }
  }))
  save()
  console.log(`checked ${n}; tokens in ${inTok} out ${outTok}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
