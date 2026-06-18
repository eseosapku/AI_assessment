/**
 * Import WAEC/JAMB past-paper PDFs from data/exam-sources/ into Supabase.
 * curriculum: 3 = WAEC, 4 = JAMB
 *
 * Usage: node scripts/import-exam-papers.js [--dry-run] [--exam=waec|jamb]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { extractPdfText } = require('./pdf-extract-text')

const DRY_RUN = process.argv.includes('--dry-run')
const EXAM_FILTER = (process.argv.find((a) => a.startsWith('--exam=')) || '').split('=')[1]?.toLowerCase()

const ROOT = path.join(__dirname, '..', 'data', 'exam-sources')
const MAX_STORE_CHARS = 80000

function readEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
}

function walkPdfs(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walkPdfs(p, out)
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(p)
  }
  return out
}

function parsePaperPath(filePath, exam) {
  const rel = path.relative(path.join(ROOT, exam), filePath).replace(/\\/g, '/')
  const parts = rel.split('/')
  if (parts.length < 2) return null
  const subject = parts.slice(0, -1).join(' / ').replace(/-/g, ' ')
  const base = path.basename(filePath, '.pdf')
  const m = base.match(/^(\d{4})-(.+)$/i)
  if (!m) return null
  return {
    subject: subject.replace(/\s+/g, ' ').trim(),
    year: parseInt(m[1], 10),
    diet: m[2].toLowerCase().replace(/\s+/g, '-'),
    filename: path.basename(filePath),
  }
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function main() {
  const { url, key } = readEnv()
  const sb = createClient(url, key)
  const exams = EXAM_FILTER ? [EXAM_FILTER] : ['waec', 'jamb']
  const curriculumMap = { waec: 3, jamb: 4 }
  let imported = 0
  let skipped = 0

  for (const exam of exams) {
    const examDir = path.join(ROOT, exam)
    const pdfs = walkPdfs(examDir)
    console.log(`\n[${exam.toUpperCase()}] Found ${pdfs.length} PDF(s) in ${examDir}`)

    for (const pdfPath of pdfs) {
      const meta = parsePaperPath(pdfPath, exam)
      if (!meta) {
        console.log(`  SKIP (bad path/name): ${pdfPath}`)
        skipped++
        continue
      }

      const bookName = `${exam.toUpperCase()} ${meta.year} — ${meta.subject} (${meta.diet})`
      const { data: existing } = await sb
        .from('textbooks')
        .select('textbook_id, source_char_count')
        .eq('textbook_name', bookName)
        .eq('curriculum', curriculumMap[exam])
        .maybeSingle()

      if (existing?.source_char_count) {
        console.log(`  EXISTS: ${bookName}`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would import: ${bookName}`)
        continue
      }

      const { text, pageCount, charCount } = await extractPdfText(pdfPath, MAX_STORE_CHARS)
      if (!text || text.length < 200) {
        console.log(`  SKIP (no text): ${bookName}`)
        skipped++
        continue
      }

      let textbookId = existing?.textbook_id
      if (!textbookId) {
        textbookId = await getNextId(sb, 'textbooks', 'textbook_id')
        const { error } = await sb.from('textbooks').insert({
          textbook_id: textbookId,
          textbook_name: bookName,
          filename: meta.filename,
          curriculum: curriculumMap[exam],
          source_text: text,
          source_authority: exam === 'waec' ? 'WAEC WASSCE' : 'JAMB UTME',
          exam_year: meta.year,
          exam_subject: meta.subject,
          exam_diet: meta.diet,
          source_char_count: charCount,
        })
        if (error) throw error
      } else {
        const { error } = await sb.from('textbooks').update({
          source_text: text,
          source_char_count: charCount,
          exam_year: meta.year,
          exam_subject: meta.subject,
          exam_diet: meta.diet,
        }).eq('textbook_id', textbookId)
        if (error) throw error
      }

      // Topics = syllabus sections from static syllabi (one topic row for the paper itself)
      const topicName = `${meta.year} ${meta.diet.replace(/-/g, ' ')} paper`
      const { data: existingTopic } = await sb.from('topics').select('topic_id').eq('textbook_id', textbookId).eq('topic', topicName).maybeSingle()
      if (!existingTopic) {
        const { error: tErr } = await sb.from('topics').insert({ textbook_id: textbookId, topic: topicName })
        if (tErr?.code !== '23505') {
          if (tErr?.code === '23502') {
            const next = await getNextId(sb, 'topics', 'topic_id')
            await sb.from('topics').insert({ topic_id: next, textbook_id: textbookId, topic: topicName })
          } else if (tErr) throw tErr
        }
      }

      console.log(`  OK: ${bookName} (${charCount} chars, ${pageCount ?? '?'} pages)`)
      imported++
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}: imported ${imported}, skipped ${skipped}`)
  if (imported === 0 && !DRY_RUN) {
    console.log('\nNo PDFs found. Add files under data/exam-sources/waec/ or jamb/ — see docs/NIGERIA-SOURCE-DOWNLOAD-GUIDE.md')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
