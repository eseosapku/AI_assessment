import fs from 'node:fs'

const lines = fs.readFileSync(new URL('../reports/inventory-files.tsv', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)

function splitLine(line) {
  return line.includes('\t') ? line.split('\t') : line.split('`t')
}

const files = lines.map((line) => {
  const parts = splitLine(line)
  const rel = parts.slice(2).join('\\')
  const segs = rel.split('\\')
  return { bytes: Number(parts[0]), attr: Number(parts[1]), rel, segs, name: segs.at(-1) ?? '' }
})

const sessionName = { s: 'may-june', m: 'feb-march', w: 'oct-nov' }

function cambridgeCode(name) {
  const m = name.match(/^(\d{4})_([smw])(\d{2})_(qp|ms|in|er|gt|sf|ci|sp)_(\d{1,2})/i)
  if (!m) return null
  return {
    paper_code: m[1],
    session: sessionName[m[2].toLowerCase()] ?? m[2],
    year: String(2000 + Number(m[3])),
    kind: m[4].toLowerCase(),
    paper: m[5],
  }
}

function sourceType(name, rel) {
  const code = cambridgeCode(name)
  if (code?.kind === 'qp') return 'past_paper'
  if (code?.kind === 'ms') return 'mark_scheme'
  if (code) return 'other'
  if (/question[-_ ]paper/i.test(name)) return 'past_paper'
  if (/mark[-_ ]scheme|marking[-_ ]scheme/i.test(name)) return 'mark_scheme'
  if (/textbook|student book|coursebook|workbook/i.test(rel)) return 'textbook'
  if (rel.startsWith('REB\\') && /\.pdf$/i.test(name)) return 'past_paper'
  return 'unknown'
}

function languageOf(name) {
  if (/ikinyarwanda/i.test(name)) return 'kinyarwanda'
  if (/fran[cç]ais|french/i.test(name)) return 'french'
  if (/english/i.test(name)) return 'english'
  return ''
}

function subjectOf(file, system) {
  if (system === 'reb') {
    const m = file.name.match(/^\d{4}_(.+?)(?:_I{1,3}|_Primary|_OL|_AL|\.pdf)/i)
    return (m?.[1] ?? '').replaceAll('_', ' ').trim()
  }
  return file.segs[2] ?? ''
}

const rows = files.map((file) => {
  const systemFolder = file.segs[0] ?? ''
  const system = /^cambridge$/i.test(systemFolder) ? 'cambridge' : /^reb$/i.test(systemFolder) ? 'reb' : ''
  const code = cambridgeCode(file.name)
  const yearFromName = (file.name.match(/(20\d{2})/) ?? [])[1] ?? code?.year ?? ''
  return {
    system,
    level: system === 'cambridge' ? (file.segs[1] ?? '') : '',
    subject: subjectOf(file, system),
    year_group: system === 'reb' ? (file.segs[1] ?? '') : '',
    source_type: sourceType(file.name, file.rel),
    paper_code: code?.paper_code ?? '',
    session: code?.session ?? '',
    year: yearFromName,
    language: languageOf(file.name),
    page_count: '',
    has_text_layer: '',
    sha256: '',
    bytes: file.bytes,
    path: file.rel,
    kind: code?.kind ?? '',
    paper: code?.paper ?? '',
  }
})

const csvEscape = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const header = [
  'system', 'level', 'subject', 'year_group', 'source_type', 'paper_code',
  'session', 'year', 'language', 'page_count', 'has_text_layer', 'sha256', 'bytes', 'path',
]
fs.writeFileSync(
  new URL('../reports/inventory.csv', import.meta.url),
  [header.join(','), ...rows.map((r) => header.map((h) => csvEscape(r[h])).join(','))].join('\n'),
)

const schemes = new Set(
  rows.filter((r) => r.kind === 'ms').map((r) => `${r.paper_code}|${r.session}|${r.year}|${r.paper}`),
)
const qp = rows.filter((r) => r.kind === 'qp')
const qpMissing = qp.filter((r) => !schemes.has(`${r.paper_code}|${r.session}|${r.year}|${r.paper}`))

function tally(pick) {
  const m = new Map()
  for (const r of rows) {
    const k = pick(r)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

const byLevel = tally((r) => `${r.system || '(none)'} | ${r.level || '(no level folder)'} | ${r.year_group || '(no year folder)'}`)
const bySubject = tally((r) => `${r.system} | ${r.level || r.year_group} | ${r.subject || '(no subject)'} | ${r.source_type}`)
const byType = tally((r) => r.source_type)
const byLang = tally((r) => r.language || '(not in the filename)')

const linesOut = []
const say = (s = '') => linesOut.push(s)
say('# Inventory issues')
say()
say('Classified from folder names and filenames. No PDF was hashed or parsed.')
say()
say('A read of `Cambridge/Igcse/Math/Math paper 2 and 4/0444_s21_qp_21.pdf` returned ENOENT even though the file is in the listing. That is an online-only placeholder. `page_count`, `has_text_layer`, and `sha256` are blank for every file. Make `G:\\My Drive\\pastPapers` available offline before any text-layer or OCR count. A scan now would either fail or download the whole set.')
say()
say(`Files: ${rows.length}.`)
say()
say('## Levels and year groups on the drive')
say()
say('| system | level folder | year-group folder | files |')
say('| --- | --- | --- | ---: |')
for (const [k, n] of byLevel) {
  const [system, level, year] = k.split(' | ')
  say(`| ${system} | ${level} | ${year} | ${n} |`)
}
say()
say('Cambridge folders found: `Igcse`, `Olevel`, `As and Alevel`, `primary_checkpoints`.')
say()
say('Names from the brief that are not their own folder:')
say()
say('- Cambridge Lower Secondary Checkpoint: 0 files')
say('- Cambridge International AS Level, separate from A Level: 0 files. AS and A Level share `As and Alevel` (1,112 files) and cannot be split from the path.')
say('- Cambridge International A Level (A2), separate from AS: 0 files')
say()
say('REB folders are year groups, not a separate qualification level: `P6` (69), `S3` (126), `S6` (104). No other REB year folder is present.')
say()
say('No file is named as a textbook, student book, coursebook, or workbook. Every year group that is not P6, S3, or S6 has no past paper in this drive, and this drive also has no textbook to stand in for it. Those year groups are absent here, not covered by a weaker source.')
say()
say('## Source type from the filename')
say()
for (const [k, n] of byType) say(`- ${k}: ${n}`)
say()
say(`Cambridge question papers with a paper code and no matching mark-scheme filename: ${qpMissing.length} of ${qp.length}.`)
say(`Mark-scheme filenames: ${rows.filter((r) => r.kind === 'ms').length}.`)
say()
say('REB filenames do not use a mark-scheme marker, so none of the 299 REB papers is paired with a scheme by name.')
say()
if (rows.some((r) => r.source_type === 'other')) {
  say('`other` is an insert, examiner report, grade threshold, or another Cambridge companion file. It is not a question paper and not a textbook.')
}
say()
say('## Language in the filename')
say()
for (const [k, n] of byLang) say(`- ${k}: ${n}`)
say()
say('Cambridge codes do not name a language. Those rows are left blank rather than labelled English.')
say()
say('## Subject folders')
say()
say('| system | level or year | subject | source | files |')
say('| --- | --- | --- | --- | ---: |')
for (const [k, n] of bySubject) {
  const [system, where, subject, source] = k.split(' | ')
  say(`| ${system} | ${where} | ${subject} | ${source} | ${n} |`)
}
say()
say('## Not classified as a paper or a mark scheme')
say()
for (const r of rows.filter((r) => r.source_type === 'unknown')) say(`- ${r.path}`)

fs.writeFileSync(new URL('../reports/inventory_issues.md', import.meta.url), linesOut.join('\n'))
console.log(JSON.stringify({
  files: rows.length,
  types: Object.fromEntries(byType),
  qp: qp.length,
  qp_without_ms: qpMissing.length,
  reb: rows.filter((r) => r.system === 'reb').length,
  kinyarwanda: rows.filter((r) => r.language === 'kinyarwanda').length,
}, null, 2))
