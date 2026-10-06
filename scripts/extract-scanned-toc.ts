/**
 * Read the contents pages of a SCANNED textbook and propose its real topics.
 *
 * Primary Mathematics 3, 4 and 5 came into the database with one topic each
 * ("Introduction", "Number"): their topic extraction read text, and these
 * books are scans with none. A learner choosing them could only pick that
 * one topic. Their contents pages say what the units are; a vision model
 * reads them.
 *
 * Proposes only, into data/scanned-toc-proposals.json. Nothing is written to
 * the database without --apply, and --apply only ADDS topics and subtopics:
 * StudyLab keeps learners' mastery against subtopic ids, so the old rows are
 * left exactly where they are.
 *
 * Run with:  npx jiti scripts/extract-scanned-toc.ts --ids=42,46,47 [--pages=1-12]
 *            npx jiti scripts/extract-scanned-toc.ts --apply
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Pool } from 'pg'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'data', 'scanned-toc-proposals.json')
const MAP = path.join(ROOT, 'data', 'cambridge-textbook-pdf-map.json')
const MODEL = process.env.TOC_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function renderPage(pdf: string, page: number, out: string) {
  const py = `import fitz,sys
d=fitz.open(sys.argv[1]);p=d[int(sys.argv[2])-1]
z=1300/max(p.rect.width,p.rect.height)
p.get_pixmap(matrix=fitz.Matrix(z,z)).save(sys.argv[3])`
  execFileSync('python', ['-c', py, pdf, String(page), out])
}

const PROMPT = [
  'This is a page from the front of a school textbook.',
  'If it is a CONTENTS page (a list of units or chapters with their sections), list them.',
  'Reply with JSON only: {"contents": true or false, "units": [{"title": "unit number and title exactly as printed", "sections": ["each section title exactly as printed"]}]}',
  'Leave out page numbers, introductions, glossaries, indexes and acknowledgements.',
].join('\n')

async function propose() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  const map: { id: number; name: string; pdf: string | null }[] = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const ids = arg('ids').split(',').filter(Boolean).map(Number)
  const [from, to] = (arg('pages') || '1-12').split('-').map(Number)
  const out: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'toc-'))
  for (const id of ids) {
    const book = map.find((m) => m.id === id)
    if (!book?.pdf) { console.log(`${id}: no PDF`); continue }
    const units: { title: string; sections: string[] }[] = []
    for (let p = from; p <= to; p++) {
      const png = path.join(tmp, `${id}-${p}.png`)
      try { renderPage(book.pdf, p, png) } catch { continue }
      const body = {
        anthropic_version: 'bedrock-2023-05-31', max_tokens: 3000, output_config: { effort: 'low' },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(png).toString('base64') } },
          { type: 'text', text: PROMPT },
        ] }],
      }
      try {
        const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
        const text = String(JSON.parse(new TextDecoder().decode(res.body)).content?.find((c: any) => c.type === 'text')?.text ?? '')
        const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
        if (json.contents && Array.isArray(json.units)) {
          for (const u of json.units) if (u?.title) units.push({ title: String(u.title).trim(), sections: (u.sections ?? []).map((s: any) => String(s).trim()).filter(Boolean) })
          console.log(`${id} page ${p}: contents, ${json.units.length} unit(s)`)
        }
      } catch (err: any) {
        console.log(`${id} page ${p} failed: ${String(err?.message ?? err).slice(0, 100)}`)
      } finally { fs.rmSync(png, { force: true }) }
    }
    // A contents list spread over two pages repeats nothing, but one printed
    // twice (a spread scanned as two pages) would; keep the first of each.
    const seen = new Set<string>()
    out[id] = { name: book.name, units: units.filter((u) => !seen.has(u.title.toLowerCase()) && seen.add(u.title.toLowerCase())) }
    console.log(`${id} ${book.name}: ${out[id].units.length} unit(s) proposed`)
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
}

/**
 * --headers: a book with no contents page, read from its page banners.
 *
 * Primary Mathematics 4 and 5 (the older Emma Low editions) have no contents
 * list; each spread carries its section in a banner ("Ordering and rounding",
 * "Addition (1)") and its unit in the footer ("Unit 1A: Core activity 1.1").
 * Reading print off a page is all this asks, so Haiku does it. Consecutive
 * pages of one unit become a topic, its banners the subtopics.
 */
async function proposeFromHeaders() {
  const model = process.env.HEADER_MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  const map: { id: number; name: string; pdf: string | null }[] = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const out: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'hdr-'))
  for (const id of arg('ids').split(',').filter(Boolean).map(Number)) {
    const book = map.find((m) => m.id === id)
    if (!book?.pdf) continue
    const count = Number(execFileSync('python', ['-c', 'import fitz,sys;print(fitz.open(sys.argv[1]).page_count)', book.pdf]).toString())
    const pages: { p: number; unit: string; strand: string; section: string }[] = []
    const queue = Array.from({ length: count }, (_, i) => i + 1)
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const p = queue.shift()!
        const png = path.join(tmp, `${id}-${p}.png`)
        try {
          const py = `import fitz,sys
d=fitz.open(sys.argv[1]);pg=d[int(sys.argv[2])-1]
z=800/max(pg.rect.width,pg.rect.height)
pg.get_pixmap(matrix=fitz.Matrix(z,z)).save(sys.argv[3])`
          execFileSync('python', ['-c', py, String(book.pdf), String(p), png])
          const body = { anthropic_version: 'bedrock-2023-05-31', max_tokens: 200, messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(png).toString('base64') } },
            { type: 'text', text: 'Read this textbook page. Reply with JSON only: {"banner": "the large title in the coloured band at the top, or \\"\\"", "subtitle": "the smaller title under it, or \\"\\"", "footer": "the small text at the very bottom edge, or \\"\\""}' },
          ] }] }
          const res = await client.send(new InvokeModelCommand({ modelId: model, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
          const text = String(JSON.parse(new TextDecoder().decode(res.body)).content?.[0]?.text ?? '')
          const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
          const unit = String(j.footer ?? '').match(/Unit\s+(\d+[A-C]?)/i)?.[1] ?? ''
          const strands = /^(number|geometry|measure|handling data|problem solving)$/i
          const banner = String(j.banner ?? '').trim()
          const section = strands.test(banner) ? String(j.subtitle ?? '').trim() : banner
          pages.push({ p, unit, strand: strands.test(banner) ? banner : '', section })
        } catch { /* a page that will not read is skipped */ } finally { fs.rmSync(png, { force: true }) }
      }
    }))
    pages.sort((a, b) => a.p - b.p)
    out[id] = { name: book.name, pages, units: groupByStrand(pages) }
    console.log(`${id} ${book.name}: ${pages.length} pages read, ${out[id].units.length} unit(s) proposed`)
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
}

/**
 * Units from page banners, split where a strand banner opens one.
 *
 * The footer's unit code is small print and came back wrong too often to
 * build on -- "1B" as "18", "1C" as "10" -- and one misread that jumped ahead
 * dragged every later page into the wrong unit. Each unit OPENS with its
 * strand in the banner ("Number", "Measure", "Handling data", "Geometry"),
 * which is large print, so units are split there and numbered in order:
 * the nine units of a Cambridge Primary year are 1A, 1B, 1C ... 3C.
 */
function groupByStrand(pages: { p: number; strand: string; section: string }[]) {
  const units: { strand: string; sections: string[] }[] = []
  for (const pg of pages) {
    // A banner that is a sentence is part of an exercise, not a section.
    // So is the book's own name on its back cover.
    const section = /\.$|^(here|this|these|look|use|write|cambridge)\b/i.test(pg.section) ? '' : pg.section
    if (pg.strand) units.push({ strand: pg.strand, sections: [] })
    const u = units[units.length - 1]
    if (!u || !section) continue
    if (!u.sections.some((s) => s.toLowerCase() === section.toLowerCase())) u.sections.push(section)
  }
  const kept = units.filter((u) => u.sections.length)
  const codes = kept.length === 9 ? kept.map((_, i) => `${Math.floor(i / 3) + 1}${'ABC'[i % 3]}`) : null
  return kept.map((u, i) => ({
    title: codes ? `Unit ${codes[i]}: ${u.strand}` : `${u.strand} (${i + 1})`,
    sections: u.sections,
  }))
}

/** --regroup: rebuild the units from the page reads already stored. No model calls. */
function regroup() {
  const out = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  for (const [id, v] of Object.entries<any>(out)) {
    if (!Array.isArray(v.pages)) continue
    v.units = groupByStrand(v.pages)
    console.log(`${id}: ${v.units.length} unit(s)`)
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
}

/** Add the proposed topics and subtopics. Never deletes or renames anything. */
async function apply() {
  const proposals = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  for (const [id, p] of Object.entries<any>(proposals)) {
    const { rows: existing } = await pool.query('SELECT topic FROM topics WHERE textbook_id = $1', [Number(id)])
    const have = new Set(existing.map((r: any) => String(r.topic).trim().toLowerCase()))
    let topics = 0, subs = 0
    for (const u of p.units) {
      if (have.has(u.title.toLowerCase())) continue
      // A project is an open investigation, not something to be quizzed on.
      if (/^project\b/i.test(u.title)) continue
      // The id sequences have been out of step with the tables before
      // (repair-textbook-topics.js falls back the same way), so a clash is
      // retried with the next free id rather than failing the book.
      const insert = async (table: string, idCol: string, cols: string[], vals: unknown[]) => {
        try {
          return (await pool.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${idCol}`, vals)).rows[0][idCol]
        } catch {
          const next = Number((await pool.query(`SELECT COALESCE(MAX(${idCol}), 0) + 1 AS n FROM ${table}`)).rows[0].n)
          return (await pool.query(`INSERT INTO ${table} (${idCol}, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING ${idCol}`, [next, ...vals])).rows[0][idCol]
        }
      }
      const topicId = await insert('topics', 'topic_id', ['textbook_id', 'topic'], [Number(id), u.title])
      topics++
      for (const s of u.sections) {
        await insert('subtopics', 'subtopic_id', ['textbook_id', 'topic_id', 'subtopic'], [Number(id), topicId, s])
        subs++
      }
    }
    console.log(`${id} ${p.name}: added ${topics} topic(s), ${subs} subtopic(s)`)
  }
  await pool.end()
}

;(process.argv.includes('--apply') ? apply()
  : process.argv.includes('--regroup') ? Promise.resolve(regroup())
  : process.argv.includes('--headers') ? proposeFromHeaders() : propose()).catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
