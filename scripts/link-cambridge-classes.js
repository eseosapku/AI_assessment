/**
 * Link unlinked Cambridge textbooks to classes by inferring grade from title.
 * Usage: node scripts/link-cambridge-classes.js [--dry-run]
 */
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')

function inferGrades(name) {
  const n = String(name || '').toLowerCase()
  const grades = new Set()

  // AS/A Level → 11 & 12
  if (/as and a level|as & a level|as _ a level|as\/a level|a level|alevel/i.test(n)) {
    grades.add('Grade 11')
    grades.add('Grade 12')
    return [...grades]
  }

  // IGCSE / O Level → 10
  if (/igcse|o level/i.test(n)) {
    grades.add('Grade 10')
    return [...grades]
  }

  // Lower Secondary
  if (/lower secondary|complete english for cambridge lower/i.test(n)) {
    for (const g of [7, 8, 9]) {
      if (new RegExp(`\\b${g}\\b|book ${g}|stage ${g}`, 'i').test(n)) grades.add(`Grade ${g}`)
    }
    if (grades.size) return [...grades]
  }

  // Cambridge Primary / Oxford English Primary
  if (/cambridge primary|oxford english for cambridge primary/i.test(n)) {
    const stage = n.match(/stage\s*(\d+)/i)?.[1]
    const book = n.match(/(?:book|learners? book|student book|learner.?s book)\s*(\d+)/i)?.[1]
    const num = Number(stage || book)
    if (num >= 1 && num <= 6) {
      grades.add(num === 1 ? 'Grade1' : `Grade ${num}`)
      return [...grades]
    }
  }

  // Bare stage/book numbers in Cambridge titles
  const stage = n.match(/stage\s*(\d+)/i)?.[1]
  if (stage) {
    const num = Number(stage)
    if (num >= 1 && num <= 6) grades.add(num === 1 ? 'Grade1' : `Grade ${num}`)
    else if (num >= 7 && num <= 9) grades.add(`Grade ${num}`)
    if (grades.size) return [...grades]
  }

  return []
}

async function main() {
  const env = fs.readFileSync('.env', 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

  const { data: textbooks } = await sb.from('textbooks').select('textbook_id,textbook_name,curriculum')
  const { data: classes } = await sb.from('classes').select('id,name')
  const { data: links } = await sb.from('class_textbooks').select('class_id,textbook_id')

  const classByName = new Map((classes || []).map((c) => [c.name, c.id]))
  const linkSet = new Set((links || []).map((l) => `${l.class_id}:${l.textbook_id}`))
  const linkedIds = new Set((links || []).map((l) => l.textbook_id))

  const cambridge = (textbooks || []).filter((t) => Number(t.curriculum) === 1)
  const unlinked = cambridge.filter((t) => !linkedIds.has(t.textbook_id))

  console.log(`Found ${unlinked.length} unlinked Cambridge textbook(s)\n`)

  let added = 0
  for (const tb of unlinked) {
    const gradeNames = inferGrades(tb.textbook_name)
    if (!gradeNames.length) {
      console.log(`SKIP [${tb.textbook_id}] — cannot infer grade: ${tb.textbook_name.slice(0, 70)}`)
      continue
    }

    for (const gradeName of gradeNames) {
      const classId = classByName.get(gradeName)
      if (!classId) {
        console.log(`WARN no class "${gradeName}" for [${tb.textbook_id}]`)
        continue
      }
      const key = `${classId}:${tb.textbook_id}`
      if (linkSet.has(key)) continue

      console.log(`${DRY_RUN ? '[DRY] ' : ''}LINK [${tb.textbook_id}] → ${gradeName}: ${tb.textbook_name.slice(0, 65)}`)
      if (!DRY_RUN) {
        const { error } = await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: tb.textbook_id })
        if (error) {
          console.error('  failed:', error.message)
          continue
        }
        linkSet.add(key)
        linkedIds.add(tb.textbook_id)
      }
      added++
    }
  }

  console.log(`\nDone. ${added} link(s) ${DRY_RUN ? 'would be ' : ''}created.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
