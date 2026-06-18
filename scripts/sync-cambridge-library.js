/**
 * Sync Cambridge coursebooks from local folders into Supabase.
 * Skips files already in DB (by normalized filename). Extracts syllabus via extract_book_outline.py.
 *
 * Usage: node scripts/sync-cambridge-library.js [--dry-run]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { extractOutlineForBook } = require('./topic-extract')

const DRY_RUN = process.argv.includes('--dry-run')
const FOLDERS = [
  'C:/Users/Stephen/Downloads/E-Library-20260617T045624Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/Cambridge/Cambridge',
]

const CLASS_BY_LEVEL = {
  igcse: ['Grade 10'],
  alevel: ['Grade 11', 'Grade 12'],
}

const known = JSON.parse(fs.readFileSync(path.join(__dirname, 'known-syllabi.json'), 'utf8'))

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function knownOutlineFor(title) {
  return known[normKey(title)]?.topics || []
}

const SKIP_RE =
  /\b(answer|answers|workbook|work book|revision guide|study and revision|practice book|worked solution|solution manual|teacher guide|grammar workbook|skills practice)\b/i
const KEEP_RE = /\b(coursebook|student book|learner'?s book|learners book|textbook|e-book|e book|accounts\.pdf)\b/i
  /\b(answer|answers|workbook|work book|revision guide|study and revision|practice book|worked solution|solution manual|teacher guide|grammar workbook|skills practice)\b/i
const KEEP_RE = /\b(coursebook|student book|learner'?s book|learners book|textbook|e-book|e book|accounts\.pdf)\b/i

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(p)
  }
  return out
}

function inferLevel(filePath) {
  const p = filePath.replace(/\\/g, '/').toLowerCase()
  if (p.includes('/as and a level/') || p.includes('/a level/')) return 'alevel'
  if (p.includes('/igcse/')) return 'igcse'
  return null
}

function shouldImport(filePath) {
  const base = path.basename(filePath)
  if (/coursebook answers|chapter_\d+_asal|sb answers|textbook answers|answers chapter/i.test(base)) return false
  if (SKIP_RE.test(base) && !KEEP_RE.test(base)) return false
  if (/^coursebook_answers_/i.test(base)) return false
  if (/^chapter_\d+_asal_/i.test(base)) return false
  if (/^Chapter \d+ SB Answers/i.test(base)) return false
  return inferLevel(filePath) !== null
}

const STOP = new Set([
  'cambridge', 'international', 'level', 'coursebook', 'edition', 'digital', 'access',
  'press', 'university', 'years', 'with', 'second', 'third', 'fourth', 'fifth', 'student',
  'book', 'learners', 'learner', 'core', 'extended', 'igcse', 'and', 'the', 'for',
])

function coreTokens(s) {
  return norm(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
}

function subjectKey(title, level) {
  const tokens = coreTokens(title)
  const lower = title.toLowerCase()
  const subjects = [
    'physics', 'chemistry', 'biology', 'mathematics', 'math', 'maths', 'accounting',
    'economics', 'business', 'english', 'history', 'geography', 'computer', 'computing',
    'science', 'psychology', 'ict', 'french', 'german', 'environmental',
  ]
  let hit = subjects.find((s) => tokens.some((t) => t.includes(s) || s.includes(t)))
  if (hit === 'math' || hit === 'maths') hit = 'mathematics'
  if (hit === 'mathematics') {
    const field = /pure mathematics|pure math/.test(lower)
      ? 'pure'
      : /probability|statistics/.test(lower)
        ? 'statistics'
        : /mechanics/.test(lower)
          ? 'mechanics'
          : /further mathematics|further math/.test(lower)
            ? 'further'
            : 'general'
    return `${level}:mathematics:${field}`
  }
  return `${level}:${hit || tokens.slice(0, 2).join('-') || norm(title).slice(0, 40)}`
}

function inferLevelFromMeta(tb) {
  const text = `${tb.textbook_name} ${tb.filename || ''}`.toLowerCase()
  if (/igcse|o level/.test(text)) return 'igcse'
  if (/as and a level|as & a level|a level|alevel/.test(text)) return 'alevel'
  return null
}

function findDuplicate(title, level, textbooks) {
  const key = subjectKey(title, level)
  const incomingCoursebook = /coursebook|student book|learners book|learner'?s book|textbook/i.test(title)

  for (const tb of textbooks) {
    if (Number(tb.curriculum) !== 1) continue
    const tbLevel = inferLevelFromMeta(tb)
    if (tbLevel !== level) continue
    if (subjectKey(tb.textbook_name, tbLevel) !== key) continue

    const existingCoursebook = /coursebook|student book|learners book|learner'?s book|textbook/i.test(tb.textbook_name)
    if (incomingCoursebook && existingCoursebook) return tb
    if (norm(title) === norm(tb.textbook_name) || norm(title) === norm(tb.filename || '')) return tb
  }
  return null
}

function displayName(filePath) {
  return path.basename(filePath, '.pdf').replace(/\s+/g, ' ').trim().slice(0, 240)
}

function isPreferredCoursebook(base) {
  if (/coursebook|student book|learner'?s book|learners book|textbook|e-book|e book/i.test(base)) return true
  if (/^accounting\.pdf$/i.test(base)) return true
  if (/igcse accounts/i.test(base)) return true
  if (/in context/i.test(base)) return true
  if (/complete english language/i.test(base)) return true
  if (/environmental management/i.test(base)) return true
  if (/additional mathematics/i.test(base)) return true
  if (/information and communication technology/i.test(base)) return true
  return false
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
  if (error) throw new Error(`topic insert: ${error.message}`)
  return data.topic_id
}

async function insertSubtopic(sb, textbookId, topicId, name) {
  let payload = { textbook_id: textbookId, topic_id: topicId, subtopic: name }
  let { error } = await sb.from('subtopics').insert(payload)
  if (error?.code === '23502' && String(error.message).includes('subtopic_id')) {
    const nextId = await getNextId(sb, 'subtopics', 'subtopic_id')
    ;({ error } = await sb.from('subtopics').insert({ ...payload, subtopic_id: nextId }))
  }
  if (error) throw new Error(`subtopic insert: ${error.message}`)
}

async function main() {
  const env = fs.readFileSync('.env', 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

  const { data: textbooks } = await sb.from('textbooks').select('textbook_id,textbook_name,filename,curriculum')
  const { data: classes } = await sb.from('classes').select('id,name')
  const classByName = new Map((classes || []).map((c) => [c.name, c.id]))
  const { data: links } = await sb.from('class_textbooks').select('class_id,textbook_id')

  const fileNormSet = new Set(
    (textbooks || []).flatMap((t) => [norm(t.filename), norm(t.textbook_name)]).filter(Boolean)
  )

  const pdfs = []
  for (const root of FOLDERS) pdfs.push(...walk(root))
  const candidates = pdfs.filter(shouldImport)

  let added = 0
  let skipped = 0
  let linked = 0

  for (const pdfPath of candidates) {
    const base = path.basename(pdfPath)
    if (!isPreferredCoursebook(base)) {
      skipped++
      continue
    }

    const nn = norm(base)
    if (fileNormSet.has(nn)) {
      skipped++
      continue
    }

    const title = displayName(pdfPath)
    const level = inferLevel(pdfPath)
    const dup = findDuplicate(title, level, textbooks || [])
    if (dup) {
      console.log('SKIP duplicate subject →', dup.textbook_id, dup.textbook_name)
      skipped++
      continue
    }
    let outline = []
    try {
      const result = await extractOutlineForBook(pdfPath, title)
      outline = result.topics
      if (result.source) console.log(`  source: ${result.source}`)
    } catch (e) {
      console.warn('TOC extract failed:', base, e.message)
    }
    if (outline.length === 0) {
      outline = knownOutlineFor(title)
      if (outline.length > 0) console.log('  using known syllabus fallback')
    }

    console.log(`\n${DRY_RUN ? '[DRY] ' : ''}ADD: [${level}] ${title}`)
    console.log(`  file: ${base}`)
    console.log(`  topics extracted: ${outline.length}`)

    if (DRY_RUN) {
      outline.slice(0, 5).forEach((t) => console.log('   -', t.name, t.subtopics?.length ? `(${t.subtopics.length} subs)` : ''))
      added++
      continue
    }

    const nextTextbookId = await getNextId(sb, 'textbooks', 'textbook_id')
    const { data: created, error: createErr } = await sb
      .from('textbooks')
      .insert({ textbook_id: nextTextbookId, textbook_name: title, filename: base, curriculum: 1 })
      .select('textbook_id')
      .single()
    if (createErr) {
      console.error('  insert failed:', createErr.message)
      continue
    }

    const textbookId = created.textbook_id
    fileNormSet.add(nn)
    textbooks.push({ textbook_id: textbookId, textbook_name: title, filename: base, curriculum: 1 })

    for (const topic of outline) {
      const topicId = await insertTopic(sb, textbookId, topic.name)
      for (const sub of topic.subtopics || []) {
        await insertSubtopic(sb, textbookId, topicId, sub)
      }
    }

    for (const className of CLASS_BY_LEVEL[level] || []) {
      const classId = classByName.get(className)
      if (!classId) continue
      const exists = (links || []).some((l) => l.class_id === classId && l.textbook_id === textbookId)
      if (!exists) {
        await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: textbookId })
        links.push({ class_id: classId, textbook_id: textbookId })
        linked++
      }
    }

    added++
  }

  console.log(`\nDone. Added ${added}, skipped ${skipped}, class links ${linked}${DRY_RUN ? ' (dry run)' : ''}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
