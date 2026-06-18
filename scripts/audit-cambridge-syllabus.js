/**
 * Audit Cambridge subjects per class vs expected syllabi.
 * Usage: node scripts/audit-cambridge-syllabus.js
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Expected Cambridge subjects by grade (from lib/cambridge-curriculum.ts + common IGCSE/AS offerings)
const EXPECTED = {
  'Grade 7': ['Mathematics', 'Science', 'English Language'],
  'Grade 8': ['Mathematics', 'Science', 'English Language'],
  'Grade 9': ['Mathematics', 'Science', 'English Language', 'Computer Science'],
  'Grade 10': [
    'Mathematics',
    'Additional Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English Language',
    'English as a Second Language',
    'English First Language',
    'Computer Science',
    'ICT',
    'Economics',
    'Business Studies',
    'Accounting',
    'Geography',
    'History',
    'French',
    'German',
    'Environmental Management',
    'Global Perspectives',
  ],
  'Grade 11': [
    'Mathematics — Pure',
    'Mathematics — Mechanics',
    'Mathematics — Probability & Statistics',
    'Further Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English Language',
    'Computer Science',
    'ICT',
    'Economics',
    'Business Studies',
    'Accounting',
    'Geography',
    'History',
    'French',
    'German',
    'Environmental Management',
    'Global Perspectives',
    'Psychology',
    'Literature',
  ],
  'Grade 12': [
    'Mathematics — Pure',
    'Mathematics — Mechanics',
    'Mathematics — Probability & Statistics',
    'Further Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English Language',
    'Computer Science',
    'ICT',
    'Economics',
    'Business Studies',
    'Accounting',
    'Geography',
    'History',
    'French',
    'German',
    'Environmental Management',
    'Global Perspectives',
    'Psychology',
    'Literature',
  ],
}

function subjectFromTextbookName(textbookName) {
  const n = String(textbookName || '').trim()
  const rules = [
    [/english as a second language|esl/i, 'English as a Second Language'],
    [/english as a first language|first language course/i, 'English First Language'],
    [/english language/i, 'English Language'],
    [/additional mathematics|additional math/i, 'Additional Mathematics'],
    [/further mathematics|further math/i, 'Further Mathematics'],
    [/probability|statistics/i, 'Mathematics — Probability & Statistics'],
    [/pure mathematics/i, 'Mathematics — Pure'],
    [/mechanics/i, 'Mathematics — Mechanics'],
    [/mathematics|maths/i, 'Mathematics'],
    [/computer science/i, 'Computer Science'],
    [/information and communication|(?<![a-z])ict(?![a-z])|it coursebook/i, 'ICT'],
    [/environmental management/i, 'Environmental Management'],
    [/global perspectives/i, 'Global Perspectives'],
    [/business studies|business coursebook/i, 'Business Studies'],
    [/accounting|accounts/i, 'Accounting'],
    [/economics/i, 'Economics'],
    [/chemistry/i, 'Chemistry'],
    [/physics/i, 'Physics'],
    [/biology/i, 'Biology'],
    [/french/i, 'French'],
    [/german/i, 'German'],
    [/geography/i, 'Geography'],
    [/history/i, 'History'],
    [/literature/i, 'Literature'],
    [/psychology/i, 'Psychology'],
    [/science/i, 'Science'],
    [/computing/i, 'Computing'],
  ]
  for (const [re, label] of rules) {
    if (re.test(n)) return label
  }
  return n.slice(0, 40)
}

function normSubject(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hasSubject(present, expected) {
  const e = normSubject(expected)
  return present.some((p) => {
    const n = normSubject(p)
    return n === e || n.includes(e) || e.includes(n)
  })
}

;(async () => {
  const env = fs.readFileSync('.env', 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

  const { data: classes } = await sb.from('classes').select('id,name').order('name')
  const { data: textbooks } = await sb.from('textbooks').select('textbook_id,textbook_name,curriculum')
  const { data: links } = await sb.from('class_textbooks').select('class_id,textbook_id')
  const { data: topics } = await sb.from('topics').select('textbook_id')

  const topicCount = new Map()
  for (const t of topics || []) topicCount.set(t.textbook_id, (topicCount.get(t.textbook_id) || 0) + 1)

  const tbById = new Map((textbooks || []).map((t) => [t.textbook_id, t]))

  const cambridgeGrades = Object.keys(EXPECTED)
  const allCambridge = (textbooks || []).filter((t) => t.curriculum === 1)

  console.log('=== CAMBRIDGE SYLLABUS AUDIT ===\n')

  for (const gradeName of cambridgeGrades) {
    const cls = (classes || []).find((c) => c.name === gradeName)
    if (!cls) {
      console.log(`## ${gradeName} — class not found in DB`)
      continue
    }

    const linked = (links || [])
      .filter((l) => l.class_id === cls.id)
      .map((l) => tbById.get(l.textbook_id))
      .filter((t) => t && t.curriculum === 1)

    const presentSubjects = [...new Set(linked.map((t) => subjectFromTextbookName(t.textbook_name)))]
    const expected = EXPECTED[gradeName] || []
    const missing = expected.filter((e) => !hasSubject(presentSubjects, e))
    const extra = presentSubjects.filter((p) => !expected.some((e) => hasSubject([p], e)))

    console.log(`## ${gradeName} (${linked.length} Cambridge textbooks)`)
    console.log('Present:', presentSubjects.sort().join(', ') || '(none)')
    if (missing.length) console.log('MISSING:', missing.join(', '))
    else console.log('MISSING: (none from expected list)')
    if (extra.length) console.log('Extra (not in expected):', extra.join(', '))

    const noTopics = linked.filter((t) => !(topicCount.get(t.textbook_id) > 0))
    if (noTopics.length) {
      console.log('No topics loaded:')
      noTopics.forEach((t) => console.log(`  - [${t.textbook_id}] ${subjectFromTextbookName(t.textbook_name)}: ${t.textbook_name.slice(0, 60)}`))
    }
    console.log('')
  }

  // Cambridge books in DB but not linked to any class
  const linkedIds = new Set((links || []).map((l) => l.textbook_id))
  const unlinked = allCambridge.filter((t) => !linkedIds.has(t.textbook_id))
  if (unlinked.length) {
    console.log('=== CAMBRIDGE TEXTBOOKS NOT LINKED TO ANY CLASS ===')
    unlinked.forEach((t) => {
      const sub = subjectFromTextbookName(t.textbook_name)
      const tc = topicCount.get(t.textbook_id) || 0
      console.log(`[${t.textbook_id}] ${sub} (${tc} topics) — ${t.textbook_name.slice(0, 70)}`)
    })
    console.log('')
  }

  // Scan local PDFs for coursebooks not in DB
  const SEARCH_ROOTS = [
    'C:/Users/Stephen/Downloads/E-Library-20260617T045624Z-3-002/E-Library',
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
  const dbNames = new Set(allCambridge.map((t) => t.textbook_name.toLowerCase()))
  const localCoursebooks = []
  for (const root of SEARCH_ROOTS) {
    for (const p of walk(root)) {
      const base = path.basename(p, '.pdf')
      if (/coursebook|student book|learners book/i.test(base) && !/workbook|answer|revision|practice book/i.test(base)) {
        if (![...dbNames].some((n) => n.includes(base.toLowerCase().slice(0, 30)) || base.toLowerCase().includes(n.slice(0, 30)))) {
          localCoursebooks.push({ base, sub: subjectFromTextbookName(base), path: p })
        }
      }
    }
  }
  if (localCoursebooks.length) {
    console.log('=== LOCAL COURSEBOOK PDFs POSSIBLY NOT IN DB (sample) ===')
    localCoursebooks.slice(0, 25).forEach((x) => console.log(`  ${x.sub}: ${x.base.slice(0, 65)}`))
    if (localCoursebooks.length > 25) console.log(`  ... +${localCoursebooks.length - 25} more`)
  }
})()
