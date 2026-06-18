/**
 * Import NERDC textbook PDFs from data/nerdc-textbooks/ into Supabase (curriculum=2).
 * Extracts TOC/topics via topic-extract pipeline (same as Cambridge).
 *
 * Usage: node scripts/import-nerdc-textbooks.js [--dry-run] [--level=P4]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { extractPdfText } = require('./pdf-extract-text')
const { extractOutlineForBook } = require('./topic-extract')

const DRY_RUN = process.argv.includes('--dry-run')
const LEVEL_FILTER = (process.argv.find((a) => a.startsWith('--level=')) || '').split('=')[1]

const ROOT = path.join(__dirname, '..', 'data', 'nerdc-textbooks')
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']

function readEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
}

function subjectFromFilename(name) {
  return path.basename(name, '.pdf').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function main() {
  const { url, key } = readEnv()
  const sb = createClient(url, key)
  let imported = 0

  const levels = LEVEL_FILTER ? [LEVEL_FILTER] : LEVELS
  for (const level of levels) {
    const levelDir = path.join(ROOT, level)
    if (!fs.existsSync(levelDir)) continue

    const { data: cls } = await sb.from('classes').select('id').eq('name', level).eq('country', 'NG').maybeSingle()
    let classId = cls?.id

    for (const file of fs.readdirSync(levelDir).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
      const pdfPath = path.join(levelDir, file)
      const subject = subjectFromFilename(file)
      const bookName = `NERDC ${level} — ${subject} (textbook)`
      const filename = file

      const { data: existing } = await sb
        .from('textbooks')
        .select('textbook_id')
        .eq('textbook_name', bookName)
        .eq('curriculum', 2)
        .maybeSingle()

      if (existing && !DRY_RUN) {
        const { data: topics } = await sb.from('topics').select('topic_id').eq('textbook_id', existing.textbook_id).limit(1)
        if (topics?.length) {
          console.log(`EXISTS: ${bookName}`)
          continue
        }
      }

      if (DRY_RUN) {
        console.log(`[DRY] Would import: ${bookName}`)
        continue
      }

      const { text, charCount } = await extractPdfText(pdfPath, 80000)
      let outline = []
      try {
        outline = await extractOutlineForBook(pdfPath, bookName)
      } catch (e) {
        console.warn(`  TOC extract failed for ${bookName}: ${e.message}`)
      }

      let textbookId = existing?.textbook_id
      if (!textbookId) {
        textbookId = await getNextId(sb, 'textbooks', 'textbook_id')
        const { error } = await sb.from('textbooks').insert({
          textbook_id: textbookId,
          textbook_name: bookName,
          filename,
          curriculum: 2,
          source_text: text || null,
          source_authority: 'NERDC',
          source_char_count: charCount || null,
        })
        if (error) throw error
      } else {
        await sb.from('textbooks').update({
          source_text: text || null,
          source_char_count: charCount || null,
          filename,
        }).eq('textbook_id', textbookId)
      }

      if (outline.length > 0) {
        for (const t of outline) {
          const topicName = typeof t === 'string' ? t : t.name
          if (!topicName) continue
          const { data: dup } = await sb.from('topics').select('topic_id').eq('textbook_id', textbookId).eq('topic', topicName).maybeSingle()
          if (!dup) {
            const { error: tErr } = await sb.from('topics').insert({ textbook_id: textbookId, topic: topicName })
            if (tErr && tErr.code !== '23505') {
              if (tErr.code === '23502') {
                const next = await getNextId(sb, 'topics', 'topic_id')
                await sb.from('topics').insert({ topic_id: next, textbook_id: textbookId, topic: topicName })
              } else throw tErr
            }
          }
        }
      }

      if (!classId) {
        const { data: created } = await sb.from('classes').insert({ name: level, country: 'NG' }).select('id').single()
        classId = created?.id
      }
      if (classId) {
        const { data: link } = await sb.from('class_textbooks').select('*').eq('class_id', classId).eq('textbook_id', textbookId).maybeSingle()
        if (!link) await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: textbookId })
      }

      console.log(`OK: ${bookName} (${outline.length} topics, ${charCount ?? 0} chars)`)
      imported++
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}: imported ${imported}`)
  if (imported === 0 && !DRY_RUN) {
    console.log('No PDFs in data/nerdc-textbooks/. See docs/NIGERIA-SOURCE-DOWNLOAD-GUIDE.md')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
