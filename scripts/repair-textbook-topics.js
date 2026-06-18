/**
 * Re-extract and replace poorly named / gappy Cambridge textbook topics.
 *
 * Usage:
 *   node scripts/repair-textbook-topics.js [--id=208] [--dry-run] [--all-cambridge] [--all] [--min-topics=10]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { norm, needsComprehensiveFix, topicQuality, extractOutlineForBook, isCoursebookName } = require('./topic-extract')

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_ID = (process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1]
const ALL_CAMBRIDGE = process.argv.includes('--all-cambridge')
const ALL_TEXTBOOKS = process.argv.includes('--all')
const MIN_TOPICS = Number((process.argv.find((a) => a.startsWith('--min-topics=')) || '').split('=')[1] || 0)

const SEARCH_ROOTS = [
  'C:/Users/Stephen/Downloads/E-Library-20260617T045624Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/E-Library-20260617T044711Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/Cambridge/Cambridge',
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(p)
  }
  return out
}

function scorePdfText(pdfPath) {
  try {
    const py = process.platform === 'win32' ? 'python' : 'python3'
    const { execFileSync } = require('child_process')
    const raw = execFileSync(py, [path.join(__dirname, 'extract_book_outline.py'), pdfPath], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    })
    const parsed = JSON.parse(raw)
    const q = topicQuality(parsed.topics || [])
    return (parsed.text_chars || 0) + q.score * 5000 + (parsed.topics?.length || 0) * 200
  } catch {
    return -1
  }
}

function normalizeVisionTopics(topics) {
  return topics.filter((t) => {
    const name = String(t.name || '').trim()
    if (!name || isBareTopicName(name)) return false
    // Keep "Unit 3: Writing" but drop "Unit 1 Reading: Identifying..."
    if (/^(Unit|Chapter)\s+\d+\s+[A-Za-z]/i.test(name) && !/^(Unit|Chapter)\s+\d+\s*:/i.test(name)) {
      return false
    }
    if (/market failure|economic environment|kinematics/i.test(name)) return false
    return true
  })
}

function subjectHint(textbookName) {
  const n = norm(textbookName)
  if (/^it for cambridge|as and a level it|level it coursebook|it coursebook|information and communication technology|\bict\b/.test(n)) return 'it'
  if (/\bit\b/.test(n) && /coursebook|a level/.test(n) && !/business|computing|computer science/.test(n)) return 'it'
  if (/business/.test(n)) return 'business'
  if (/economics/.test(n)) return 'economics'
  if (/computing/.test(n)) return 'computing'
  if (/computer science/.test(n)) return 'cs'
  if (/accounting|accounts/.test(n)) return 'accounting'
  if (/pure mathematics|pure math/.test(n)) return 'math-pure'
  if (/probability|statistics/.test(n)) return 'math-stats'
  if (/mechanics/.test(n)) return 'math-mechanics'
  if (/mathematics|maths/.test(n)) return 'math'
  return null
}

function pdfMatchesSubject(pdfPath, hint) {
  if (!hint) return true
  const bn = norm(path.basename(pdfPath))
  if (hint === 'math-pure') return /pure mathematics|pure math/.test(bn) && !/statistics|probability|mechanics/.test(bn)
  if (hint === 'math-stats') return /probability|statistics/.test(bn) && !/pure mathematics|pure math/.test(bn)
  if (hint === 'math-mechanics') return /mechanics/.test(bn)
  if (hint === 'math') return /mathematics|maths|math/.test(bn)
  if (hint === 'it') {
    return (/\bit\b|information technology/.test(bn) || /level it coursebook/.test(bn)) && !/business/.test(bn)
  }
  if (hint === 'business') return /business/.test(bn) && !/\bit\b/.test(bn)
  if (hint === 'economics') return /economics/.test(bn)
  if (hint === 'computing') return /computing/.test(bn) && !/computer science/.test(bn)
  if (hint === 'cs') return /computer science/.test(bn)
  if (hint === 'accounting') return /accounting|accounts/.test(bn)
  return true
}

function findPdf(filename, textbookName) {
  const hint = subjectHint(textbookName)
  const targets = new Set([norm(filename), norm(textbookName)].filter(Boolean))
  const pdfs = []
  for (const root of SEARCH_ROOTS) pdfs.push(...walk(root))
  const matches = new Set()
  for (const p of pdfs) {
    if (!pdfMatchesSubject(p, hint)) continue
    if (targets.has(norm(path.basename(p)))) matches.add(p)
  }
  const nameTokens = norm(textbookName).split(' ').filter((w) => w.length > 4)
  for (const p of pdfs) {
    if (!pdfMatchesSubject(p, hint)) continue
    const bn = norm(path.basename(p))
    if (nameTokens.length >= 3 && nameTokens.every((t) => bn.includes(t))) matches.add(p)
  }
  if (norm(textbookName) === 'accounting' || norm(filename) === 'accounting') {
    const igcse = pdfs.find((p) => /igcse accounts/i.test(norm(path.basename(p))))
    if (igcse) return igcse
  }
  if (/^accounting$/i.test(norm(textbookName)) || norm(filename) === 'accounting') {
    for (const p of pdfs) {
      if (/igcse accounts/i.test(norm(path.basename(p)))) matches.add(p)
    }
  }
  const tn = norm(textbookName)
  if (/graham brown|david watson|information and communication|ict coursebook/i.test(tn)) {
    for (const p of pdfs) {
      const bn = norm(path.basename(p))
      if (/graham|brown|watson/.test(bn) && /ict|information|communication/.test(bn)) matches.add(p)
    }
  }
  const arr = [...matches]
  if (!arr.length) return null
  if (arr.length === 1) return arr[0]
  return arr.sort((a, b) => scorePdfText(b) - scorePdfText(a))[0]
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

async function deleteTopicsForBook(sb, textbookId) {
  await sb.from('subtopics').delete().eq('textbook_id', textbookId)
  await sb.from('topics').delete().eq('textbook_id', textbookId)
}

async function main() {
  const env = fs.readFileSync('.env', 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

  let q = sb.from('textbooks').select('textbook_id,textbook_name,filename,curriculum').order('textbook_id')
  if (ONLY_ID) q = q.eq('textbook_id', Number(ONLY_ID))
  else if (ALL_CAMBRIDGE) q = q.eq('curriculum', 1)
  const { data: textbooks } = await q

  const targets = []
  for (const tb of textbooks || []) {
    if (ONLY_ID && tb.textbook_id !== Number(ONLY_ID)) continue
    const { data: rows } = await sb.from('topics').select('topic').eq('textbook_id', tb.textbook_id)
    const existing = (rows || []).map((r) => ({ name: r.topic }))
    const thin = MIN_TOPICS > 0 && existing.length < MIN_TOPICS && isCoursebookName(tb.textbook_name)
    const shouldFix =
      ONLY_ID ||
      needsComprehensiveFix(existing, tb.textbook_name) ||
      (ALL_CAMBRIDGE && needsComprehensiveFix(existing, tb.textbook_name)) ||
      (ALL_TEXTBOOKS && needsComprehensiveFix(existing, tb.textbook_name)) ||
      thin
    if (!shouldFix) continue
    targets.push({ tb, existing })
  }

  console.log(`Repairing ${targets.length} textbook(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const { tb, existing } of targets) {
    const oldQ = topicQuality(existing)
    const pdf = findPdf(tb.filename, tb.textbook_name)

    const { topics: outline, source } = await extractOutlineForBook(pdf, tb.textbook_name, {
      preferVision: oldQ.bare > 0 || oldQ.gaps || existing.length <= 1 || existing.length < 10,
    })
    const newQ = topicQuality(outline)

    console.log(`\n[${tb.textbook_id}] ${tb.textbook_name}`)
    console.log(`  pdf: ${pdf || 'not found'}`)
    console.log(`  old: ${existing.length} topics${oldQ.bare ? ` (${oldQ.bare} bare)` : ''}${oldQ.gaps ? ' gaps' : ''}`)
    console.log(`  new: ${outline.length} topics via ${source} (quality ${(newQ.score * 100).toFixed(0)}%)`)

    if (!outline.length) {
      console.log('  ✗ no replacement outline — keeping existing')
      continue
    }
    if (existing.length > 0 && newQ.score < oldQ.score && newQ.score < 0.5 && outline.length < existing.length) {
      console.log('  ✗ new outline worse — keeping existing')
      continue
    }
    if (outline.length < existing.length && source === 'pdf-text' && existing.length >= 6 && outline.length <= 4) {
      console.log('  ✗ fewer topics from weak extraction — keeping existing')
      continue
    }
    if (existing.length > 0 && /enterprise|business structure/i.test(outline.map((t) => t.name).join(' ')) && /\bit\b|ict/i.test(tb.textbook_name)) {
      console.log('  ✗ wrong subject outline (business on IT book) — keeping existing')
      continue
    }
    if (/enterprise|business structure/i.test(outline.map((t) => t.name).join(' ')) && subjectHint(tb.textbook_name) === 'it') {
      console.log('  ✗ wrong subject outline (business on IT book) — skipping')
      continue
    }

    outline.slice(0, 6).forEach((t) => console.log(`   → ${t.name}`))
    if (outline.length > 6) console.log(`   … +${outline.length - 6} more`)

    if (DRY_RUN) continue

    await deleteTopicsForBook(sb, tb.textbook_id)
    for (const topic of outline) {
      const topicId = await insertTopic(sb, tb.textbook_id, topic.name)
      for (const sub of topic.subtopics || []) {
        await insertSubtopic(sb, tb.textbook_id, topicId, sub)
      }
    }
    console.log('  ✓ replaced')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
