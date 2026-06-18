/**
 * Backfill topics/subtopics for textbooks that have none.
 * Re-runs PDF extraction; falls back to known-syllabi.json for image-only PDFs.
 *
 * Usage:
 *   node scripts/backfill-textbook-topics.js [--id=208] [--dry-run]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_ID = (process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1]

const SEARCH_ROOTS = [
  'C:/Users/Stephen/Downloads/E-Library-20260617T045624Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/E-Library-20260617T044711Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/Cambridge/Cambridge',
]

const { norm, extractOutlineForBook } = require('./topic-extract')

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(p)
  }
  return out
}

function findPdf(filename, textbookName) {
  const targets = new Set([norm(filename), norm(textbookName)].filter(Boolean))
  const pdfs = []
  for (const root of SEARCH_ROOTS) pdfs.push(...walk(root))
  for (const p of pdfs) {
    if (targets.has(norm(path.basename(p)))) return p
  }
  const nameTokens = norm(textbookName).split(' ').filter((w) => w.length > 4)
  for (const p of pdfs) {
    const bn = norm(path.basename(p))
    if (nameTokens.length >= 3 && nameTokens.every((t) => bn.includes(t))) return p
  }
  return null
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function insertTopic(sb, textbookId, name) {
  let payload = { textbook_id: textbookId, topic: name }
  let { data, error } = await sb.from('topics').insert(payload).select('topic_id').single()
  if (error?.code === '23502' && String(error.message).includes('topic_id')) {
    const nextId = await getNextId(sb, 'topics', 'topic_id')
    ;({ data, error } = await sb.from('topics').insert({ ...payload, topic_id: nextId }).select('topic_id').single())
  }
  if (error) throw new Error(error.message)
  return data.topic_id
}

async function insertSubtopic(sb, textbookId, topicId, name) {
  let payload = { textbook_id: textbookId, topic_id: topicId, subtopic: name }
  let { error } = await sb.from('subtopics').insert(payload)
  if (error?.code === '23502' && String(error.message).includes('subtopic_id')) {
    const nextId = await getNextId(sb, 'subtopics', 'subtopic_id')
    ;({ error } = await sb.from('subtopics').insert({ ...payload, subtopic_id: nextId }))
  }
  if (error) throw new Error(error.message)
}

async function main() {
  const env = fs.readFileSync('.env', 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

  let q = sb.from('textbooks').select('textbook_id,textbook_name,filename,curriculum').order('textbook_id')
  if (ONLY_ID) q = q.eq('textbook_id', Number(ONLY_ID))
  const { data: textbooks } = await q

  const { data: topics } = await sb.from('topics').select('textbook_id')
  const counts = new Map()
  for (const t of topics || []) counts.set(t.textbook_id, (counts.get(t.textbook_id) || 0) + 1)

  const needs = (textbooks || []).filter((tb) => !counts.get(tb.textbook_id))
  console.log(`Backfilling ${needs.length} textbook(s) with no topics${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tb of needs) {
    const key = norm(tb.textbook_name)
    let outline = []
    let source = ''

    const pdf = findPdf(tb.filename, tb.textbook_name)
    if (pdf) {
      try {
        const result = await extractOutlineForBook(pdf, tb.textbook_name)
        outline = result.topics
        source = result.source
      } catch (e) {
        source = `pdf-error: ${e.message}`
      }
    } else if (key) {
      const result = await extractOutlineForBook(null, tb.textbook_name)
      outline = result.topics
      source = result.source
    }

    console.log(`\n[${tb.textbook_id}] ${tb.textbook_name}`)
    console.log(`  pdf: ${pdf || 'not found'} | source: ${source || 'none'} | topics: ${outline.length}`)
    if (!outline.length) continue

    if (DRY_RUN) {
      outline.slice(0, 5).forEach((t) => console.log('   -', t.name, `(${t.subtopics?.length || 0} subs)`))
      continue
    }

    for (const topic of outline) {
      const topicId = await insertTopic(sb, tb.textbook_id, topic.name)
      for (const sub of topic.subtopics || []) {
        await insertSubtopic(sb, tb.textbook_id, topicId, sub)
      }
    }
    console.log('  ✓ inserted')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
