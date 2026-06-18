/**
 * Agentic sync: pull real WAEC past questions from open GitHub datasets
 * and optional Aloc API (set ALOC_ACCESS_TOKEN in .env for JAMB + more subjects).
 *
 * Usage:
 *   node scripts/sync-exam-question-banks.js
 *   node scripts/sync-exam-question-banks.js --dry-run
 *   node scripts/sync-exam-question-banks.js --aloc-only
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const ALOC_ONLY = process.argv.includes('--aloc-only')
const MAX_SOURCE_CHARS = 80000

const WAEC_GITHUB = [
  { file: 'agric.csv', subject: 'Agricultural Science', url: 'https://raw.githubusercontent.com/Victor-Akinode/chatgpt-new/main/data/waec_data/agric.csv' },
  { file: 'civic-edu.csv', subject: 'Civic Education', url: 'https://raw.githubusercontent.com/Victor-Akinode/chatgpt-new/main/data/waec_data/civic-edu.csv' },
  { file: 'commerce.csv', subject: 'Commerce', url: 'https://raw.githubusercontent.com/Victor-Akinode/chatgpt-new/main/data/waec_data/commerce.csv' },
  { file: 'geo.csv', subject: 'Geography', url: 'https://raw.githubusercontent.com/Victor-Akinode/chatgpt-new/main/data/waec_data/geo.csv' },
  { file: 'govt.csv', subject: 'Government', url: 'https://raw.githubusercontent.com/Victor-Akinode/chatgpt-new/main/data/waec_data/govt.csv' },
]

const ALOC_SUBJECTS = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  mathematics: 'Mathematics',
  english: 'Use of English',
  government: 'Government',
  economics: 'Economics',
  geography: 'Geography',
  commerce: 'Commerce',
  accounting: 'Financial Accounting',
  crk: 'Christian Religious Studies',
  englishlit: 'Literature in English',
}

const ALOC_YEARS = [2015, 2016, 2017, 2018, 2019, 2020]

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    alocToken: get('ALOC_ACCESS_TOKEN'),
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const parts = []
    let cur = ''
    let inQ = false
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue }
      cur += ch
    }
    parts.push(cur)
    const row = {}
    headers.forEach((h, idx) => { row[h] = (parts[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

function formatQuestion(row, idx) {
  const q = row.question || row.Question || ''
  const a = row.A || row.option_a || ''
  const b = row.B || row.option_b || ''
  const c = row.C || row.option_c || ''
  const d = row.D || row.option_d || ''
  const ans = row.answer || row.Answer || row.correct_answer || ''
  const ctx = row.context ? `Context: ${row.context}\n` : ''
  return `${ctx}Q${row.question_no || idx + 1}: ${q}\nA) ${a}\nB) ${b}\nC) ${c}\nD) ${d}\nAnswer: ${ans}`
}

function formatAlocQuestion(q) {
  const opts = q.option || q.options || {}
  const a = opts.a || opts.A || q.a || ''
  const b = opts.b || opts.B || q.b || ''
  const c = opts.c || opts.C || q.c || ''
  const d = opts.d || opts.D || q.d || ''
  const ans = q.answer || q.correct_answer || ''
  const text = q.question || q.question_text || ''
  return `Q: ${text}\nA) ${a}\nB) ${b}\nC) ${c}\nD) ${d}\nAnswer: ${ans}${q.solution ? `\nSolution: ${q.solution}` : ''}`
}

const CACHE_DIR = path.join(__dirname, '..', 'data', 'exam-sources', 'cache')
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json')
const CACHE_ID_BASE = 900000

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { version: 1, papers: [] }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    return { version: 1, papers: Array.isArray(raw?.papers) ? raw.papers : [] }
  } catch {
    return { version: 1, papers: [] }
  }
}

function upsertLocalCache({ exam, subject, year, diet, sourceText, authority, sourceUrl }) {
  const bookName = `${exam.toUpperCase()} ${year} — ${subject} (${diet})`
  const key = `${exam}-${year}-${subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${diet}`
  const manifest = readManifest()
  const existing = manifest.papers.find((p) => p.key === key)
  const paper = {
    key,
    id: existing?.id ?? CACHE_ID_BASE + manifest.papers.length + 1,
    exam,
    year,
    subject,
    diet,
    name: bookName,
    sourceText: sourceText.slice(0, MAX_SOURCE_CHARS),
    charCount: sourceText.length,
    authority,
    sourceUrl: sourceUrl || null,
  }
  if (existing) {
    const idx = manifest.papers.findIndex((p) => p.key === key)
    manifest.papers[idx] = paper
  } else {
    manifest.papers.push(paper)
  }
  if (!DRY_RUN) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
  }
  return paper
}

let dbHasSourceColumns = null

async function probeDbSchema(sb) {
  if (dbHasSourceColumns !== null) return dbHasSourceColumns
  const { error } = await sb.from('textbooks').select('source_text,exam_year').limit(1)
  dbHasSourceColumns = !error
  return dbHasSourceColumns
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function upsertExamBank(sb, { exam, subject, year, diet, sourceText, authority, sourceUrl }) {
  const curriculum = exam === 'waec' ? 3 : 4
  const bookName = `${exam.toUpperCase()} ${year} — ${subject} (${diet})`
  const charCount = sourceText.length

  if (DRY_RUN) {
    console.log(`  [DRY] ${bookName} (${charCount} chars)`)
    return
  }

  const cached = upsertLocalCache({ exam, subject, year, diet, sourceText, authority, sourceUrl })
  const hasDbCols = await probeDbSchema(sb)
  if (!hasDbCols) {
    console.log(`  CACHE: ${bookName} (id ${cached.id})`)
    return
  }

  const { data: existing } = await sb
    .from('textbooks')
    .select('textbook_id')
    .eq('textbook_name', bookName)
    .eq('curriculum', curriculum)
    .maybeSingle()

  let textbookId = existing?.textbook_id
  const payload = {
    textbook_name: bookName,
    filename: `${exam}-${year}-${subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
    curriculum,
    source_text: sourceText.slice(0, MAX_SOURCE_CHARS),
    source_authority: authority,
    source_url: sourceUrl || null,
    exam_year: year,
    exam_subject: subject,
    exam_diet: diet,
    source_char_count: charCount,
  }

  if (textbookId) {
    const { error } = await sb.from('textbooks').update(payload).eq('textbook_id', textbookId)
    if (error) throw error
  } else {
    textbookId = await getNextId(sb, 'textbooks', 'textbook_id')
    const { error } = await sb.from('textbooks').insert({ textbook_id: textbookId, ...payload })
    if (error) throw error
  }

  const topicName = `${year} ${diet} question bank`
  const { data: topic } = await sb.from('topics').select('topic_id').eq('textbook_id', textbookId).eq('topic', topicName).maybeSingle()
  if (!topic) {
    const { error: tErr } = await sb.from('topics').insert({ textbook_id: textbookId, topic: topicName })
    if (tErr?.code === '23502') {
      const next = await getNextId(sb, 'topics', 'topic_id')
      await sb.from('topics').insert({ topic_id: next, textbook_id: textbookId, topic: topicName })
    } else if (tErr) throw tErr
  }
  console.log(`  OK: ${bookName} (db ${textbookId}, cache ${cached.id})`)
}

async function syncWaecGithub(sb) {
  console.log('\n=== WAEC from GitHub (Victor-Akinode/chatgpt-new) ===')
  let total = 0
  for (const src of WAEC_GITHUB) {
    const res = await fetch(src.url)
    if (!res.ok) { console.log(`  SKIP ${src.file}: HTTP ${res.status}`); continue }
    const text = await res.text()
    const rows = parseCsv(text)
    const byYear = new Map()
    for (const row of rows) {
      const year = Number(row.year)
      if (!Number.isFinite(year) || year < 2000) continue
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push(row)
    }
    for (const [year, yearRows] of byYear) {
      const sourceText = yearRows.map((r, i) => formatQuestion(r, i)).join('\n\n')
      await upsertExamBank(sb, {
        exam: 'waec',
        subject: src.subject,
        year,
        diet: 'may-june',
        sourceText,
        authority: 'WAEC WASSCE (GitHub open dataset)',
        sourceUrl: src.url,
      })
      total++
    }
    console.log(`  ${src.subject}: ${byYear.size} year(s), ${rows.length} questions`)
  }
  return total
}

async function fetchAlocBatch(token, subject, type, year, retries = 3) {
  const url = `https://questions.aloc.com.ng/api/v2/m?subject=${subject}&type=${type}&year=${year}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          AccessToken: token,
        },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return []
      const data = body.data || body.questions || (Array.isArray(body) ? body : [])
      return Array.isArray(data) ? data : []
    } catch (err) {
      if (attempt === retries) throw err
      console.log(`  RETRY ${subject} ${type} ${year} (${attempt}/${retries})`)
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  return []
}

async function syncAloc(sb, token) {
  console.log('\n=== JAMB/WAEC from Aloc API ===')
  let total = 0
  for (const [slug, label] of Object.entries(ALOC_SUBJECTS)) {
    for (const year of ALOC_YEARS) {
      for (const type of ['utme', 'wassce']) {
        const questions = await fetchAlocBatch(token, slug, type, year)
        if (!questions.length) continue
        const exam = type === 'utme' ? 'jamb' : 'waec'
        const diet = type === 'utme' ? 'utme' : 'may-june'
        const subject = exam === 'jamb' && slug === 'english' ? 'Use of English' : label
        const sourceText = questions.map(formatAlocQuestion).join('\n\n')
        await upsertExamBank(sb, {
          exam,
          subject,
          year,
          diet,
          sourceText,
          authority: exam === 'jamb' ? 'JAMB UTME (Aloc API)' : 'WAEC WASSCE (Aloc API)',
          sourceUrl: 'https://questions.aloc.com.ng',
        })
        total++
        console.log(`  ${exam.toUpperCase()} ${subject} ${year}: ${questions.length} questions`)
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  }
  return total
}

async function main() {
  const { url, key, alocToken } = readEnv()
  const sb = createClient(url, key)
  let count = 0

  if (!ALOC_ONLY) {
    count += await syncWaecGithub(sb)
  }

  if (alocToken) {
    count += await syncAloc(sb, alocToken)
  } else {
    console.log('\n[Aloc] Skipped — add ALOC_ACCESS_TOKEN to .env for JAMB + science subjects.')
    console.log('  Free signup: https://questions.aloc.com.ng (dashboard → Access Token)')
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}: ${count} exam bank(s) processed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
