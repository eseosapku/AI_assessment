/**
 * Seed Nigerian NERDC classes, textbooks (curriculum=2), topics and subtopics.
 * Usage: node scripts/seed-nigeria-curriculum.js [--dry-run]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']

function loadCurriculum() {
  const jsonPath = path.join(__dirname, 'nigeria-curriculum-data.json')
  if (!fs.existsSync(jsonPath)) {
    execFileSync('npx', ['tsx', path.join(__dirname, 'export-nigeria-curriculum.mjs')], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
}

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function main() {
  const curriculum = loadCurriculum()
  const { url, key } = readEnv()
  const sb = createClient(url, key)

  let classesCreated = 0
  let booksCreated = 0
  let topicsCreated = 0

  for (const level of LEVELS) {
    const info = curriculum[level]
    if (!info) continue

    let classId
    const { data: existingClass } = await sb.from('classes').select('id').eq('name', level).eq('country', 'NG').maybeSingle()
    if (existingClass) {
      classId = existingClass.id
      console.log(`Class exists: ${level}`)
    } else if (DRY_RUN) {
      console.log(`[DRY] Would create class ${level}`)
    } else {
      const { data: created, error } = await sb.from('classes').insert({ name: level, country: 'NG' }).select('id').single()
      if (error) throw error
      classId = created.id
      classesCreated++
      console.log(`Created class ${level} (${classId})`)
    }

    for (const subject of info.subjects) {
      const bookName = `NERDC ${info.label} — ${subject.name}`
      const { data: existingBook } = await sb
        .from('textbooks')
        .select('textbook_id')
        .eq('textbook_name', bookName)
        .eq('curriculum', 2)
        .maybeSingle()

      let textbookId = existingBook?.textbook_id

      if (textbookId) {
        if (classId && !DRY_RUN) {
          const { data: link } = await sb.from('class_textbooks').select('*').eq('class_id', classId).eq('textbook_id', textbookId).maybeSingle()
          if (!link) await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: textbookId })
        }
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Book: ${bookName} (${subject.topics.length} topics)`)
        continue
      }

      textbookId = await getNextId(sb, 'textbooks', 'textbook_id')
      const { error: bookErr } = await sb.from('textbooks').insert({
        textbook_id: textbookId,
        textbook_name: bookName,
        filename: `nerdc-${level}-${subject.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
        curriculum: 2,
      })
      if (bookErr) throw bookErr
      booksCreated++

      for (const topicName of subject.topics) {
        const payload = { textbook_id: textbookId, topic: topicName }
        let { error: tErr } = await sb.from('topics').insert(payload)
        if (tErr?.code === '23502') {
          const next = await getNextId(sb, 'topics', 'topic_id')
          ;({ error: tErr } = await sb.from('topics').insert({ ...payload, topic_id: next }))
        }
        if (tErr) throw tErr
        topicsCreated++
      }
      console.log(`  Book ${textbookId}: ${subject.name} (${subject.topics.length} topics)`)

      if (classId) {
        await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: textbookId })
      }
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}: classes +${classesCreated}, books +${booksCreated}, topics +${topicsCreated}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
