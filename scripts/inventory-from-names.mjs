import fs from 'node:fs'

const raw = fs.readFileSync(new URL('../reports/inventory-files.tsv', import.meta.url), 'utf8')
const lines = raw.split(/\r?\n/).filter(Boolean)

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t')
  return line.split('`t')
}

const rows = []
for (const line of lines) {
  const parts = splitLine(line)
  if (parts.length < 3) continue
  const size = Number(parts[0])
  const attr = Number(parts[1])
  const rel = parts.slice(2).join(parts.includes('\t') ? '\t' : '`t')
  const segs = rel.split(/\\|\//)
  rows.push({ size, attr, rel, segs, name: segs.at(-1) ?? '' })
}

const csvEscape = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const header = [
  'system', 'level', 'subject', 'year_group', 'source_type', 'paper_code',
  'session', 'year', 'language', 'page_count', 'has_text_layer', 'sha256',
  'bytes', 'attributes', 'path',
]

function classify(row) {
  const [systemFolder, levelFolder, subjectFolder] = row.segs
  const system = /^cambridge$/i.test(systemFolder) ? 'cambridge'
    : /^reb$/i.test(systemFolder) ? 'reb'
    : ''
  const name = row.name
  const code = (name.match(/^(\d{4})/) ?? [])[1] ?? ''
  const sessionCode = (name.match(/_([smw])(\d{2})_/i) ?? [])
  const yearInName = (name.match(/(?:^|_)(20\d{2})(?:_|\.)/) ?? [])[1]
    ?? (sessionCode[2] ? String(2000 + Number(sessionCode[2])) : '')
  const session = sessionCode[1]
    ? { s: 'may-june', m: 'feb-march', w: 'oct-nov' }[sessionCode[1].toLowerCase()] ?? sessionCode[1]
    : ''
  let source = 'unknown'
  if (/_qp_/i.test(name) || /\bqp\b/i.test(name) || /question paper/i.test(row.rel)) source = 'past_paper'
  else if (/_ms_/i.test(name) || /mark scheme|marking scheme/i.test(name)) source = 'mark_scheme'
  else if (/_in_/i.test(name) || /insert/i.test(name)) source = 'insert'
  else if (/textbook|student book|\bSB\b|coursebook|workbook/i.test(row.rel)) source = 'textbook'
  else if (/\.pdf$/i.test(name) && system === 'reb') source = 'past_paper'
  const language = /kinyarwanda/i.test(row.rel) ? 'kinyarwanda'
    : /french|francais|français/i.test(row.rel) ? 'french'
    : /english/i.test(row.rel) ? 'english'
    : ''
  return {
    system, level: levelFolder ?? '', subject: subjectFolder ?? '',
    year_group: '', source_type: source, paper_code: code, session, year: yearInName,
    language, page_count: '', has_text_layer: '', sha256: '',
    bytes: row.size, attributes: row.attr, path: row.rel,
  }
}

const classified = rows.map(classify)
const csv = [header.join(','), ...classified.map((r) => header.map((h) => csvEscape(r[h])).join(','))].join('\n')
fs.writeFileSync(new URL('../reports/inventory.csv', import.meta.url), csv)

const count = (fn) => classified.filter(fn).length
const levels = new Map()
for (const r of classified) {
  const key = `${r.system || '(no system)'}\t${r.level || '(no level)'}`
  levels.set(key, (levels.get(key) ?? 0) + 1)
}
const subjects = new Map()
for (const r of classified) {
  const key = `${r.system}\t${r.level}\t${r.subject || '(no subject)'}\t${r.source_type}`
  subjects.set(key, (subjects.get(key) ?? 0) + 1)
}

const expectedCambridge = [
  'Primary Checkpoint', 'Lower Secondary Checkpoint', 'O Level', 'IGCSE', 'AS Level', 'A Level',
]
const observedLevels = [...levels.keys()]

const papers = classified.filter((r) => r.source_type === 'past_paper')
const schemes = new Set(classified.filter((r) => r.source_type === 'mark_scheme').map((r) => r.path.replace(/_ms_/i, '_qp_').replace(/mark scheme/i, 'qp')))
const papersWithoutScheme = papers.filter((r) => {
  const twin = r.path.replace(/_qp_/i, '_ms_')
  return !classified.some((o) => o.source_type === 'mark_scheme' && o.path.replace(/\\/g, '/').toLowerCase() === twin.replace(/\\/g, '/').toLowerCase())
})

const issues = []
issues.push('# Inventory issues')
issues.push('')
issues.push('Built from file names and sizes only. No file was opened, so `page_count`, `has_text_layer`, and `sha256` are blank. A hash or a text-layer check would download every online-only file.')
issues.push('')
issues.push(`Files listed: ${classified.length}.`)
issues.push(`Attribute value was unreadable as a placeholder flag in the listing (the separator was not a tab). Placeholder detection is not claimed.`)
issues.push('')
issues.push('## Levels observed')
issues.push('')
issues.push('| system | level folder | files |')
issues.push('| --- | --- | ---: |')
for (const [key, n] of [...levels.entries()].sort()) {
  const [system, level] = key.split('\t')
  issues.push(`| ${system} | ${level} | ${n} |`)
}
issues.push('')
issues.push('## Cambridge levels named in the brief')
issues.push('')
issues.push('These names are not folder names. The folders actually present are listed above. A zero here means that exact label is not a folder, not that the papers are absent.')
issues.push('')
for (const name of expectedCambridge) {
  const hit = observedLevels.some((k) => k.toLowerCase().includes(name.toLowerCase()))
  issues.push(`- ${name}: ${hit ? 'folder name matches' : 'no folder with this exact name'}`)
}
issues.push('')
issues.push('## Source types from the filename')
issues.push('')
for (const kind of ['past_paper', 'mark_scheme', 'insert', 'textbook', 'unknown']) {
  issues.push(`- ${kind}: ${count((r) => r.source_type === kind)}`)
}
issues.push('')
issues.push(`Question-paper filenames with no mark-scheme filename beside them: ${papersWithoutScheme.length}.`)
issues.push('')
issues.push('## Files outside Cambridge and REB')
issues.push('')
const outsiders = classified.filter((r) => !r.system)
issues.push(outsiders.length ? outsiders.slice(0, 30).map((r) => `- ${r.path}`).join('\n') : 'None.')
issues.push('')
issues.push('## Language from the path')
issues.push('')
issues.push(`- kinyarwanda in the path: ${count((r) => r.language === 'kinyarwanda')}`)
issues.push(`- french in the path: ${count((r) => r.language === 'french')}`)
issues.push(`- english in the path: ${count((r) => r.language === 'english')}`)
issues.push(`- not stated in the path: ${count((r) => !r.language)}`)
issues.push('')
issues.push('## Subject and source, top folders')
issues.push('')
issues.push('| system | level | subject folder | source | files |')
issues.push('| --- | --- | --- | --- | ---: |')
for (const [key, n] of [...subjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  const [system, level, subject, source] = key.split('\t')
  issues.push(`| ${system} | ${level} | ${subject} | ${source} | ${n} |`)
}

fs.writeFileSync(new URL('../reports/inventory_issues.md', import.meta.url), issues.join('\n'))
console.log(JSON.stringify({
  files: classified.length,
  levels: Object.fromEntries(levels),
  past_paper: count((r) => r.source_type === 'past_paper'),
  mark_scheme: count((r) => r.source_type === 'mark_scheme'),
  textbook: count((r) => r.source_type === 'textbook'),
  unknown: count((r) => r.source_type === 'unknown'),
  papers_without_scheme: papersWithoutScheme.length,
  outsiders: outsiders.length,
}, null, 2))
