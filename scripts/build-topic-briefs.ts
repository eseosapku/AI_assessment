/**
 * A short brief per textbook chapter: what it teaches at this stage, and what
 * learners at this stage have not met yet.
 *
 * A quiz prompt was given the chapter's name and an age band and nothing
 * else -- none of the Cambridge Primary, Lower Secondary or IGCSE books has
 * stored text -- so the writer filled "Stage 3 Measurement, area and
 * perimeter" from its general idea of area: the area of a triangle and of a
 * circle, at age eight, where the book counts squares. Written once per
 * chapter by Sonnet from the chapter's sections, the book's own exercises for
 * it, and the Cambridge framework for the stage.
 *
 * In:  the database's topics and sections; data/textbook-figure-bank.json (exercises)
 * Out: data/topic-briefs.json (resumable)
 *
 * Run with:  npx jiti scripts/build-topic-briefs.ts [--books=42,46] [--limit=N]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { stageOfBook } from '../lib/textbook-figure-bank'
import { briefKey } from '../lib/topic-briefs'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'data', 'topic-briefs.json')
const MODEL = process.env.BRIEF_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
const BOOKS = arg('books').split(',').filter(Boolean).map(Number)
const LIMIT = Number(arg('limit')) || Infinity

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

/** The books a level slip matters in: Primary, Lower Secondary and IGCSE Mathematics, Science and Computing. */
const IN_SCOPE = /(primary|lower secondary|igcse).*(math|science|comput|biolog|chemist|physic|ict|information and communic)|(math|science|comput|biolog|chemist|physic).*(primary|lower secondary|igcse)/i
const OUT_OF_SCOPE = /english|french|german|history|geograph|business|econom|account|a level|as level/i

function levelOf(name: string): { label: string; stage: number | null } {
  const stage = stageOfBook(name)
  if (/igcse/i.test(name)) return { label: 'Cambridge IGCSE (ages 14-16)', stage: 10 }
  if (/lower secondary/i.test(name)) return { label: `Cambridge Lower Secondary, Stage ${stage} (age ${Number(stage) + 5})`, stage }
  return { label: `Cambridge Primary, Stage ${stage} (age ${Number(stage) + 5})`, stage }
}

const subjectOf = (name: string) => /math/i.test(name) ? 'Mathematics' : /comput|ict|information and communic/i.test(name) ? 'Computing'
  : /biolog/i.test(name) ? 'Biology' : /chemist/i.test(name) ? 'Chemistry' : /physic/i.test(name) ? 'Physics' : 'Science'

function prompt(o: { book: string; level: string; subject: string; topic: string; sections: string[]; exercises: string[] }): string {
  return [
    `A question writer will set a short quiz for ${o.level} ${o.subject} learners on one chapter of their Cambridge textbook.`,
    `Book: ${o.book.trim()}`,
    `Chapter: ${o.topic}`,
    ...(o.sections.length ? [`Its sections: ${o.sections.join('; ')}`] : []),
    ...(o.exercises.length ? ['', 'Exercises from this chapter of the book, to show the level:', ...o.exercises.map((e) => `- ${e}`)] : []),
    '',
    `Using the Cambridge curriculum framework for ${o.subject} at this stage, and the book, write the writer a brief.`,
    'The writer\'s usual mistake is content from a LATER stage: area formulae and circles at Primary Stage 3, angles in degrees before they are taught,',
    'probability as a number at Primary, ATP and ribosomes at Lower Secondary, A Level ideas at IGCSE. Name the specific traps for THIS chapter at THIS stage.',
    '',
    'Reply with JSON only:',
    '{',
    '  "teaches": "what this chapter teaches at this stage, concretely: the skills, number ranges, methods and words the learners know. At most 60 words.",',
    '  "not_yet": "what these learners have NOT been taught yet that a writer might wrongly ask on this chapter. Specific items, at most 40 words.",',
    '  "example": "one quiz question on this chapter at exactly the right level, with its answer"',
    '}',
  ].join('\n')
}

async function main() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  // Timeouts and keep-alive: a query on a connection the network had quietly
  // dropped waited for over half an hour.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000, query_timeout: 120_000, keepAlive: true,
  })
  // Small queries, one book at a time, each retried: over a poor connection
  // one large result stalled past any timeout.
  const ask = async (sql: string, values: unknown[] = []): Promise<any[]> => {
    for (let attempt = 0; ; attempt++) {
      try { return (await pool.query(sql, values)).rows } catch (err) {
        if (attempt >= 3) throw err
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
  }
  const books = await ask('SELECT textbook_id, textbook_name FROM textbooks WHERE curriculum = 1')
  const wanted = books.filter((b: any) => IN_SCOPE.test(b.textbook_name) && !OUT_OF_SCOPE.test(b.textbook_name))
    .filter((b: any) => !BOOKS.length || BOOKS.includes(Number(b.textbook_id)))
  const nameOf = new Map(wanted.map((b: any) => [Number(b.textbook_id), String(b.textbook_name)]))
  const topics: any[] = []
  const sectionsOf = new Map<number, string[]>()
  for (const id of nameOf.keys()) {
    topics.push(...await ask('SELECT textbook_id, topic_id, topic FROM topics WHERE textbook_id = $1 ORDER BY topic_id', [id]))
    for (const s of await ask('SELECT topic_id, subtopic FROM subtopics WHERE textbook_id = $1 ORDER BY subtopic_id', [id])) {
      sectionsOf.set(Number(s.topic_id), [...(sectionsOf.get(Number(s.topic_id)) ?? []), String(s.subtopic)])
    }
  }
  await pool.end()
  console.log(`${nameOf.size} book(s), ${topics.length} chapter(s)`)
  const rows = topics.map((t: any) => ({ ...t, textbook_name: nameOf.get(Number(t.textbook_id)), sections: sectionsOf.get(Number(t.topic_id)) ?? [] }))
  const figures: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-figure-bank.json'), 'utf8')).figures
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const todo = rows
    .filter((r: any) => !BOOKS.length || BOOKS.includes(Number(r.textbook_id)))
    .filter((r: any) => !/^(introduction|glossary|glossary and index|index|contents)$/i.test(String(r.topic).trim()))
    .filter((r: any) => !done[briefKey(r.textbook_id, r.topic)])
    .slice(0, LIMIT)
  console.log(`${todo.length} chapter(s) to brief (${Object.keys(done).length} done) with ${MODEL}`)

  let inTok = 0, outTok = 0, n = 0
  const save = () => fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  const queue = [...todo]
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const r: any = queue.shift()!
      const { label, stage } = levelOf(r.textbook_name)
      const exercises = figures
        .filter((f) => f.textbookIds.includes(Number(r.textbook_id)) && f.topic === r.topic && f.original)
        .slice(0, 4)
        .map((f) => String(f.original).replace(/\s+/g, ' ').slice(0, 300))
      const body = {
        anthropic_version: 'bedrock-2023-05-31', max_tokens: 2000, output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt({
          book: r.textbook_name, level: label, subject: subjectOf(r.textbook_name), topic: r.topic,
          sections: (r.sections ?? []).map(String).slice(0, 20), exercises,
        }) }] }],
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
          const out = JSON.parse(new TextDecoder().decode(res.body))
          inTok += out.usage?.input_tokens ?? 0; outTok += out.usage?.output_tokens ?? 0
          const text = String(out.content?.find((c: any) => c.type === 'text')?.text ?? '')
          const got = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
          if (!String(got.teaches ?? '').trim()) throw new Error('empty brief')
          done[briefKey(r.textbook_id, r.topic)] = {
            book: String(r.textbook_name).trim(), topic: r.topic, level: label, stage,
            teaches: String(got.teaches).trim(), notYet: String(got.not_yet ?? '').trim(), example: String(got.example ?? '').trim(),
          }
          n++
          if (n % 25 === 0) { save(); console.log(`  ${n}/${todo.length}  tokens in ${inTok} out ${outTok}`) }
          break
        } catch (err: any) {
          if (attempt === 2) console.log(`  FAILED ${r.textbook_id} ${r.topic}: ${String(err?.message ?? err).slice(0, 140)}`)
          await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
        }
      }
    }
  }))
  save()
  console.log(`briefed ${n}; tokens in ${inTok} out ${outTok}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
