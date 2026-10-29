import fs from 'node:fs'
import path from 'node:path'
import pdfParse from 'pdf-parse'
import { levelFromPaperPath } from '../lib/past-paper/book-level.ts'
import { parsePaperText } from '../lib/past-paper/parse-paper.ts'
import { buildStyleTemplate } from '../lib/past-paper/style-template.ts'

const groups = new Map()
const rl = fs.readFileSync(new URL('../data/past-paper-corpus/papers.jsonl', import.meta.url), 'utf8').split(/\n/)
for (const line of rl) {
  if (!line) continue
  const paper = JSON.parse(line)
  const where = levelFromPaperPath(paper.path)
  let subject = where.subject
  if (!subject && where.system === 'reb') {
    const file = String(paper.path).split(/\\|\//).pop() ?? ''
    const match = file.match(/^\d{4}_([A-Za-z]+)/)
    subject = match?.[1] ?? ''
  }
  if (!where.system || !where.level || !subject) continue
  const key = `${where.system}/${where.level}/${subject.toLowerCase()}`
  const list = groups.get(key) ?? []
  for (const question of paper.questions ?? []) {
    list.push({
      stem: String(question.stem ?? ''),
      marks: question.marks ?? null,
      command_word: question.command_word ?? null,
      parts: (question.parts ?? []).map((part) => ({
        text: String(part.text ?? ''),
        marks: part.marks ?? null,
        command_word: part.command_word ?? null,
      })),
    })
  }
  groups.set(key, list)
}

const outRoot = path.join(process.cwd(), 'systems')
const written = []
for (const [key, questions] of groups) {
  const [system, level, subject] = key.split('/')
  const template = buildStyleTemplate(system, level, subject, questions)
  const dir = path.join(outRoot, system, 'style', level)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${subject}.json`)
  fs.writeFileSync(file, JSON.stringify(template, null, 2))
  written.push(template)
}

function closest(subject, level) {
  const want = subject.toLowerCase()
  return written.find((template) => template.level === level && template.subject.toLowerCase() === want)
    ?? written.find((template) => template.level === level && template.subject.toLowerCase().startsWith(want.slice(0, 4)))
}

const igcseRoot = 'C:\\Users\\hp\\Desktop\\pastPapers\\Cambridge\\Igcse'
const igcseQuestions = new Map()
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.toLowerCase().endsWith('.pdf')) {
      const rel = path.relative(igcseRoot, full)
      const subject = rel.split(path.sep)[0] ?? 'unknown'
      const promise = pdfParse(fs.readFileSync(full)).catch(() => null)
      igcseQuestions.set(full, { subject, promise })
    }
  }
}
walk(igcseRoot)
let igcseFiles = 0
const bySubject = new Map()
for (const [, item] of igcseQuestions) {
  const data = await item.promise
  if (!data) continue
  igcseFiles += 1
  const parsed = parsePaperText(data.text, data.numpages)
  const list = bySubject.get(item.subject.toLowerCase()) ?? []
  for (const question of parsed.questions) {
    list.push({ stem: question.stem, marks: question.marks, command_word: question.command_word, parts: question.parts })
  }
  bySubject.set(item.subject.toLowerCase(), list)
}

const igcseSubjects = new Set([...bySubject.keys()])
if (fs.existsSync(igcseRoot)) {
  for (const name of fs.readdirSync(igcseRoot)) {
    if (fs.statSync(path.join(igcseRoot, name)).isDirectory()) igcseSubjects.add(name.toLowerCase())
  }
}
for (const subject of igcseSubjects) {
  const questions = bySubject.get(subject) ?? []
  const base = closest(subject, 'o_level')
  const above = closest(subject, 'as_and_a_level')
  const below = closest(subject, 'primary_checkpoint')
  const observed = buildStyleTemplate('cambridge', 'igcse', subject, questions)
  const template = base
    ? { ...base, level: 'igcse', subject, question_count: questions.length, thin: true, derived: true }
    : { ...observed, derived: true }
  template.provenance = {
    based_on: [base && `cambridge/o_level/${base.subject}`, above && `cambridge/as_and_a_level/${above.subject}`, below && `cambridge/primary_checkpoint/${below.subject}`].filter(Boolean),
    validation_files: igcseFiles,
    validation_note: `${igcseFiles} of the on-disk IGCSE files parsed to text. ${questions.length} questions came out. The rest are not readable PDFs (the file starts with null bytes, not %PDF). Observed calculate count ${observed.command_words.calculate ?? 0}; O Level base calculate count ${base?.command_words.calculate ?? 0}. Rebuild with scripts/build-style-templates.mjs when real IGCSE papers replace these files.`,
  }
  template.exemplars = observed.exemplars.length ? observed.exemplars : template.exemplars
  const dir = path.join(outRoot, 'cambridge', 'style', 'igcse')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${subject}.json`), JSON.stringify(template, null, 2))
  written.push(template)
}

const thin = written.filter((template) => template.thin && !template.derived)
console.log(JSON.stringify({
  cells: written.length,
  questions: written.reduce((sum, template) => sum + (template.derived ? 0 : template.question_count), 0),
  thin: thin.length,
  igcse_files: igcseFiles,
  igcse_subjects: [...bySubject.keys()],
}, null, 2))
