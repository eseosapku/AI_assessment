/**
 * Import Cambridge lower-secondary / primary TOC PDFs as syllabus-outline textbooks.
 * Uses table-of-contents extraction (not full book text) for topics and subtopics.
 *
 * Usage:
 *   node scripts/import-cambridge-toc-bundle.js [--dry-run]
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { extractPdfText } = require('./pdf-extract-text')
const { extractOutlineForBook } = require('./topic-extract')

const DRY_RUN = process.argv.includes('--dry-run')

const PDF_ROOT =
  process.env.CAMBRIDGE_TOC_PDF_ROOT ||
  'C:/Users/Stephen/Downloads/textbooks (1)-20260618T180745Z-3-001/textbooks (1)'

/** @type {Array<{ pdf: string; gradeName: string; subject: string; textbookName: string; manualOutline?: { name: string; subtopics?: string[] }[] }>} */
const BUNDLE = [
  {
    pdf: 'grade 8 math.pdf',
    gradeName: 'Grade 8',
    subject: 'Mathematics',
    textbookName: 'Cambridge Lower Secondary Mathematics Stage 8 (syllabus outline)',
  },
  {
    pdf: 'grade 9 math.pdf',
    gradeName: 'Grade 9',
    subject: 'Mathematics',
    textbookName: 'Cambridge Lower Secondary Mathematics Stage 9 (syllabus outline)',
  },
  {
    pdf: 'Grade 9 English.pdf',
    gradeName: 'Grade 9',
    subject: 'English Language',
    textbookName: 'Cambridge Lower Secondary English Stage 9 (syllabus outline)',
  },
  {
    pdf: 'grade 6 Computing.pdf',
    gradeName: 'Grade 6',
    subject: 'Computing',
    textbookName: 'Click Start Computing for Schools 6 (syllabus outline)',
    manualOutline: [
      {
        name: 'Unit 1: Know your computer',
        subtopics: [
          'Early calculating devices',
          "Napier's Bones",
          'Pascaline',
          'Difference Engine',
          'Analytical Engine',
        ],
      },
      {
        name: 'Unit 2: Evolution of computers',
        subtopics: [
          'First generation — vacuum tubes',
          'Second generation — transistors',
          'Third generation — integrated circuits',
          'Fourth generation — microprocessors',
          'Fifth generation — artificial intelligence',
        ],
      },
      {
        name: 'Unit 3: Classification of computers',
        subtopics: [
          'Microcomputers',
          'Desktop, laptop and tablet',
          'Mainframe computers',
          'Minicomputers',
          'Supercomputers',
        ],
      },
      {
        name: 'Unit 4: Functional components of a computer',
        subtopics: [
          'Central Processing Unit (CPU)',
          'Input devices',
          'Output devices',
          'MICR and barcode readers',
        ],
      },
      {
        name: 'Unit 5: Memory and storage',
        subtopics: [
          'Primary memory',
          'RAM and ROM',
          'Secondary storage devices',
          'CD, hard disk and flash drive',
        ],
      },
      {
        name: 'Unit 6: Categorisation of software',
        subtopics: [
          'System software',
          'Application software',
          'Utility software',
          'Compilers and high-level languages',
        ],
      },
      {
        name: 'Unit 7: Booting and operating systems',
        subtopics: [
          'Booting process',
          'Cold boot and warm boot',
          'Functions of an operating system',
          'Process, device, memory and file management',
        ],
      },
      {
        name: 'Unit 8: Operating system interfaces',
        subtopics: [
          'Character user interface (CUI)',
          'Graphical user interface (GUI)',
          'Windows operating systems',
          'Linux components',
          'Safe shut down',
        ],
      },
    ],
  },
]

function readEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
}

async function getNextId(sb, table, col) {
  const { data } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1).maybeSingle()
  const cur = data ? Number(data[col]) : 0
  return Number.isFinite(cur) && cur > 0 ? cur + 1 : 1
}

async function insertTopic(sb, textbookId, name) {
  const { data: dup } = await sb
    .from('topics')
    .select('topic_id')
    .eq('textbook_id', textbookId)
    .eq('topic', name)
    .maybeSingle()
  if (dup?.topic_id) return dup.topic_id

  let payload = { textbook_id: textbookId, topic: name }
  let { data, error } = await sb.from('topics').insert(payload).select('topic_id').single()
  if (error?.code === '23502' && String(error.message).includes('topic_id')) {
    const nextId = await getNextId(sb, 'topics', 'topic_id')
    ;({ data, error } = await sb
      .from('topics')
      .insert({ ...payload, topic_id: nextId })
      .select('topic_id')
      .single())
  }
  if (error) throw new Error(`topic insert: ${error.message}`)
  return data.topic_id
}

async function insertSubtopic(sb, textbookId, topicId, name) {
  const { data: dup } = await sb
    .from('subtopics')
    .select('subtopic_id')
    .eq('textbook_id', textbookId)
    .eq('topic_id', topicId)
    .eq('subtopic', name)
    .maybeSingle()
  if (dup) return

  let payload = { textbook_id: textbookId, topic_id: topicId, subtopic: name }
  let { error } = await sb.from('subtopics').insert(payload)
  if (error?.code === '23502' && String(error.message).includes('subtopic_id')) {
    const nextId = await getNextId(sb, 'subtopics', 'subtopic_id')
    ;({ error } = await sb.from('subtopics').insert({ ...payload, subtopic_id: nextId }))
  }
  if (error && error.code !== '23505') throw new Error(`subtopic insert: ${error.message}`)
}

async function main() {
  const { url, key } = readEnv()
  if (!url || !key) throw new Error('Missing Supabase env vars')
  const sb = createClient(url, key)

  const { data: classes } = await sb.from('classes').select('id,name')
  const classByName = new Map((classes || []).map((c) => [c.name, c.id]))

  for (const entry of BUNDLE) {
    const pdfPath = path.join(PDF_ROOT, entry.pdf)
    if (!fs.existsSync(pdfPath)) {
      console.warn(`SKIP — PDF not found: ${pdfPath}`)
      continue
    }

    const classId = classByName.get(entry.gradeName)
    if (!classId) {
      console.warn(`SKIP — class not found: ${entry.gradeName}`)
      continue
    }

    const { data: existing } = await sb
      .from('textbooks')
      .select('textbook_id')
      .eq('textbook_name', entry.textbookName)
      .eq('curriculum', 1)
      .maybeSingle()

    let outline = entry.manualOutline || []
    let source = entry.manualOutline ? 'manual-from-pdf-sections' : ''

    if (!outline.length) {
      const extracted = await extractOutlineForBook(pdfPath, entry.textbookName)
      outline = extracted.topics || []
      source = extracted.source || 'unknown'
    }

    console.log(`\n${entry.gradeName} — ${entry.subject}`)
    console.log(`  book: ${entry.textbookName}`)
    console.log(`  pdf: ${entry.pdf} | source: ${source} | topics: ${outline.length}`)

    if (!outline.length) {
      console.warn('  No topics extracted — skipping')
      continue
    }

    outline.slice(0, 4).forEach((t) => {
      console.log(`    - ${t.name} (${(t.subtopics || []).length} subtopics)`)
    })
    if (outline.length > 4) console.log(`    ... +${outline.length - 4} more`)

    if (DRY_RUN) continue

    const { text, charCount } = await extractPdfText(pdfPath, 12000)

    let textbookId = existing?.textbook_id
    if (!textbookId) {
      textbookId = await getNextId(sb, 'textbooks', 'textbook_id')
      const { error } = await sb.from('textbooks').insert({
        textbook_id: textbookId,
        textbook_name: entry.textbookName,
        filename: entry.pdf,
        curriculum: 1,
        source_text: text || null,
        source_authority: 'Cambridge (TOC outline)',
        source_char_count: charCount || null,
      })
      if (error) throw error
      console.log(`  created textbook_id ${textbookId}`)
    } else {
      await sb
        .from('textbooks')
        .update({
          filename: entry.pdf,
          source_text: text || null,
          source_char_count: charCount || null,
        })
        .eq('textbook_id', textbookId)
      console.log(`  using existing textbook_id ${textbookId}`)
    }

    const { data: link } = await sb
      .from('class_textbooks')
      .select('*')
      .eq('class_id', classId)
      .eq('textbook_id', textbookId)
      .maybeSingle()
    if (!link) {
      const { error } = await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: textbookId })
      if (error) throw error
      console.log(`  linked → ${entry.gradeName}`)
    }

    const { count: existingTopics } = await sb
      .from('topics')
      .select('*', { count: 'exact', head: true })
      .eq('textbook_id', textbookId)

    if (existingTopics && existingTopics > 0) {
      console.log(`  topics already present (${existingTopics}) — skipping insert`)
      continue
    }

    let topicCount = 0
    let subtopicCount = 0
    for (const topic of outline) {
      const topicName = String(topic.name || '').trim()
      if (!topicName) continue
      const topicId = await insertTopic(sb, textbookId, topicName)
      topicCount++
      for (const sub of topic.subtopics || []) {
        const subName = String(sub || '').trim()
        if (!subName) continue
        await insertSubtopic(sb, textbookId, topicId, subName)
        subtopicCount++
      }
    }
    console.log(`  inserted ${topicCount} topics, ${subtopicCount} subtopics`)
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
