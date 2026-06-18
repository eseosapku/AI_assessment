/**
 * Link any textbook (any curriculum) not assigned to a class, using title heuristics.
 * Usage: node scripts/link-unlinked-textbooks.js [--dry-run]
 */
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')

function inferGrades(name, curriculum) {
  const n = String(name || '').toLowerCase()
  const grades = new Set()
  const isCambridge = Number(curriculum) === 1

  if (isCambridge) {
    if (/as and a level|as & a level|as _ a level|a level|alevel/i.test(n)) {
      return ['Grade 11', 'Grade 12']
    }
    if (/igcse|o level/i.test(n)) return ['Grade 10']
    if (/lower secondary|complete english for cambridge lower/i.test(n)) {
      for (const g of [7, 8, 9]) {
        if (new RegExp(`\\b${g}\\b|book ${g}`, 'i').test(n)) grades.add(`Grade ${g}`)
      }
      if (grades.size) return [...grades]
    }
    if (/cambridge primary|oxford english for cambridge primary/i.test(n)) {
      const num = Number(n.match(/stage\s*(\d+)|(?:book|learners? book|student book)\s*(\d+)/i)?.[1] || n.match(/stage\s*(\d+)|(?:book|learners? book|student book)\s*(\d+)/i)?.[2])
      if (num >= 1 && num <= 6) return [num === 1 ? 'Grade1' : `Grade ${num}`]
    }
  }

  // Rwanda naming: P1–P6 primary, S1–S6 senior
  const p = n.match(/\bp\s*(\d+)\b|p(\d+)\s/)
  if (p) {
    const num = Number(p[1] || p[2])
    if (num >= 1 && num <= 6) return [num === 1 ? 'Grade1' : `Grade ${num}`]
  }
  const s = n.match(/\bs\s*(\d+)\b|s\.?\s*(\d+)\b|senior\s*(one|two|three|four|five|six)|\bs([1-6])\b/i)
  if (s) {
    const word = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
    let num = Number(s[1] || s[2] || s[4])
    if (!num && s[3]) num = word[s[3].toLowerCase()] || 0
    if (num >= 1 && num <= 6) return [`Grade ${num + 6}`] // S1=7 ... S6=12
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

  const unlinked = (textbooks || []).filter((t) => !linkedIds.has(t.textbook_id))
  console.log(`Found ${unlinked.length} unlinked textbook(s) (all curricula)\n`)

  let added = 0
  for (const tb of unlinked) {
    if (/teacher guide|tg\b|workbook|revision guide|answer/i.test(tb.textbook_name)) {
      console.log(`SKIP [${tb.textbook_id}] teacher/workbook: ${tb.textbook_name.slice(0, 60)}`)
      continue
    }
    const gradeNames = inferGrades(tb.textbook_name, tb.curriculum)
    if (!gradeNames.length) {
      console.log(`SKIP [${tb.textbook_id}] no grade match: ${tb.textbook_name.slice(0, 60)}`)
      continue
    }
    for (const gradeName of gradeNames) {
      const classId = classByName.get(gradeName)
      if (!classId) continue
      const key = `${classId}:${tb.textbook_id}`
      if (linkSet.has(key)) continue
      console.log(`${DRY_RUN ? '[DRY] ' : ''}LINK [${tb.textbook_id}] c=${tb.curriculum} → ${gradeName}: ${tb.textbook_name.slice(0, 55)}`)
      if (!DRY_RUN) {
        const { error } = await sb.from('class_textbooks').insert({ class_id: classId, textbook_id: tb.textbook_id })
        if (error) { console.error(' ', error.message); continue }
        linkSet.add(key)
      }
      added++
    }
  }
  console.log(`\nDone. ${added} link(s) ${DRY_RUN ? 'would be ' : ''}created.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
