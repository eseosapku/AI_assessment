import fs from 'node:fs'
import path from 'node:path'
import pdfParse from 'pdf-parse'
import { parsePaperText } from '../lib/past-paper/parse-paper.ts'

const root = 'C:\\Users\\hp\\Desktop\\pastPapers'
const outDir = path.join(process.cwd(), 'data', 'past-paper-corpus')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'papers.jsonl')
const stream = fs.createWriteStream(outFile, { flags: 'w' })

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === 'igcse') continue
      walk(full, acc)
    } else if (entry.name.toLowerCase().endsWith('.pdf')) acc.push(full)
  }
  return acc
}

const files = walk(root)
const counts = { files: files.length, extracted: 0, needs_review: 0, unreadable: 0, questions: 0, scans: 0 }
const reasons = new Map()
let done = 0

for (const file of files) {
  const rel = path.relative(root, file)
  let record
  try {
    const data = await pdfParse(fs.readFileSync(file))
    const parsed = parsePaperText(data.text, data.numpages)
    record = {
      path: rel,
      page_count: data.numpages,
      text_chars: data.text.length,
      status: parsed.status,
      reasons: parsed.reasons,
      questions: parsed.questions,
      raw_text: parsed.status === 'needs_review' ? data.text : undefined,
    }
    counts[parsed.status] += 1
    counts.questions += parsed.questions.length
    if (parsed.reasons.includes('no text layer')) counts.scans += 1
    for (const reason of parsed.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  } catch (error) {
    counts.unreadable += 1
    counts.needs_review += 1
    record = {
      path: rel,
      status: 'needs_review',
      reasons: ['unreadable'],
      questions: [],
      error: error instanceof Error ? error.message : 'unreadable',
    }
    reasons.set('unreadable', (reasons.get('unreadable') ?? 0) + 1)
  }
  stream.write(JSON.stringify(record) + '\n')
  done += 1
  if (done % 100 === 0) console.log(`extracted ${done} of ${files.length}`)
}

stream.end()
const summary = { ...counts, reasons: Object.fromEntries(reasons), igcse: 'skipped' }
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
