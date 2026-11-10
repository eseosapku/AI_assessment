import fs from 'node:fs'
import path from 'node:path'
import pdfParse from 'pdf-parse'
import { asksNothing } from '../lib/question-audit.ts'
import { parsePaperText } from '../lib/past-paper/parse-paper.ts'
import { buildStyleTemplate } from '../lib/past-paper/style-template.ts'

const root = 'C:\\Users\\hp\\Desktop\\pastPapers\\Cambridge\\igcse.2'
const outDir = path.join(process.cwd(), 'data', 'past-paper-corpus')
fs.mkdirSync(outDir, { recursive: true })

const SUBJECTS = {
  biology: 'biology',
  chemistry: 'chemistry',
  computer_science: 'computer_science',
  economics: 'economics',
  english: 'english',
  geography: 'geography',
  history: 'history',
  math: 'math',
  mathematics: 'math',
  physics: 'physics',
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.name.toLowerCase().endsWith('.pdf')) acc.push(full)
  }
  return acc
}

function subjectOf(file) {
  const rel = path.relative(root, file)
  const parts = rel.split(path.sep)
  const raw = (parts[0].toLowerCase() === 'past_papers' ? parts[1] : parts[0] ?? '').toLowerCase()
  return SUBJECTS[raw] ?? ''
}

/** pdf-parse prints an answer line as "1 ........", which the shared parser reads as a new question. */
function hideAnswerLines(text) {
  return text.split(/\n/).filter((line) => !/^\s*\d{1,2}\s*\.{4,}/.test(line)).join('\n')
}

const files = walk(root).filter((file) => /qp/i.test(path.basename(file)))
const bySubject = new Map()
const counts = { files: files.length, extracted: 0, needs_review: 0, unreadable: 0, questions: 0 }
const fromJsonl = process.argv.includes('--from-jsonl')

if (fromJsonl) {
  const saved = fs.readFileSync(path.join(outDir, 'igcse-papers.jsonl'), 'utf8').split(/\n/)
  counts.files = saved.filter(Boolean).length
  for (const line of saved) {
    if (!line) continue
    const record = JSON.parse(line)
    if (record.status !== 'extracted') {
      counts.needs_review += 1
      continue
    }
    counts.extracted += 1
    counts.questions += (record.questions ?? []).length
    if (!record.subject) continue
    const list = bySubject.get(record.subject) ?? []
    for (const question of record.questions ?? []) {
      list.push({
        stem: question.stem,
        marks: question.marks,
        command_word: question.command_word,
        parts: question.parts,
      })
    }
    bySubject.set(record.subject, list)
  }
} else {
const out = fs.createWriteStream(path.join(outDir, 'igcse-papers.jsonl'), { flags: 'w' })

for (const file of files) {
  const rel = path.relative(root, file)
  const subject = subjectOf(file)
  let record
  try {
    const buf = fs.readFileSync(file)
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('not a pdf')
    const data = await pdfParse(buf)
    const parsed = parsePaperText(hideAnswerLines(data.text), data.numpages)
    record = {
      path: rel,
      level: 'igcse',
      subject,
      page_count: data.numpages,
      text_chars: data.text.length,
      status: parsed.status,
      reasons: parsed.reasons,
      questions: parsed.questions,
    }
    counts[parsed.status] += 1
    counts.questions += parsed.questions.length
    if (parsed.status === 'extracted' && subject) {
      const list = bySubject.get(subject) ?? []
      for (const question of parsed.questions) {
        list.push({
          stem: question.stem,
          marks: question.marks,
          command_word: question.command_word,
          parts: question.parts,
        })
      }
      bySubject.set(subject, list)
    }
  } catch (error) {
    counts.unreadable += 1
    record = {
      path: rel,
      level: 'igcse',
      subject,
      status: 'needs_review',
      reasons: [error instanceof Error ? error.message : 'unreadable'],
      questions: [],
    }
  }
  out.write(JSON.stringify(record) + '\n')
}
out.end()
}

function cleanStem(text) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[.\u2026]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The shared paper parser is deliberately permissive. In some MCQ and table
 * layouts it also sees an answer row (for example "pancreas" or "A 12") as a
 * numbered question. Those rows are useful evidence while reviewing a PDF,
 * but they must not influence the style statistics sent to the generator.
 */
function styleQuestion(question) {
  const parts = Array.isArray(question.parts) ? question.parts : []
  let stem = cleanStem(question.stem)
  if (!stem && parts.length) {
    stem = cleanStem(parts.map((part) => part?.text).filter(Boolean).slice(0, 3).join(' '))
  }
  const words = stem.split(/\s+/).filter(Boolean)
  const letters = (stem.match(/[A-Za-z]/g) ?? []).length
  const hasDemand = Boolean(question.command_word) || stem.includes('?') || parts.length > 0 || words.length >= 8
  if (words.length < 4 || letters / Math.max(1, stem.length) < 0.45 || !hasDemand || asksNothing(stem)) return null
  return { ...question, stem, parts }
}

function promptExemplar(text) {
  const cleaned = cleanStem(text)
  const letters = (cleaned.match(/[A-Za-z]/g) ?? []).length
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length < 8 || words.length > 60) return ''
  if (!cleaned || letters / cleaned.length < 0.62) return ''
  if (/^\s*(draw|sketch|plot)\b/i.test(cleaned)) return ''
  // A style example is copied into a text-only prompt. Even a well-parsed
  // question is unusable there when its answer depends on an omitted visual.
  if (/\b(?:fig(?:ure)?\.?\s*\d*|diagram|map|graph|grid|insert)\b/i.test(cleaned)) return ''
  if (/\bstudy (?:all the )?sources?\b|\buse the sources\b|\bdetails of the sources?\b/i.test(cleaned)) return ''
  if (/['’]\s*\./.test(cleaned) || /\bxy\b/i.test(cleaned) || /\[\d+\]/.test(cleaned)) return ''
  if (/[#"]|:[a-z]{2,}|work out \+|\bx x\b|\bxy\d/i.test(cleaned)) return ''
  if (/\b(using the key|flowchart|trace table|draw a line|particles in a container|correct results|processes x, y and z|sex chromosomes of a woman)\b/i.test(cleaned)) return ''
  if (/which person\s*$/i.test(cleaned) || /alisha is correct/i.test(cleaned)) return ''
  if (asksNothing(cleaned)) return ''
  return cleaned.slice(0, 420)
}

function readableExemplars(questions) {
  const picked = []
  const seen = new Set()
  const ranked = [...questions].sort((a, b) => Number(Boolean(b.command_word)) - Number(Boolean(a.command_word)))
  for (const question of ranked) {
    if (/^(draw|sketch|plot)$/i.test(String(question.command_word ?? ''))) continue
    const text = promptExemplar(question.stem)
    if (!text) continue
    const key = text.slice(0, 80).toLowerCase()
    if (seen.has(key)) continue
    if (picked.some((item) => item.command_word && item.command_word === question.command_word)) continue
    seen.add(key)
    picked.push({ marks: question.marks ?? null, command_word: question.command_word ?? null, text })
    if (picked.length >= 6) break
  }
  return picked
}

const styleDir = path.join(process.cwd(), 'systems', 'cambridge', 'style', 'igcse')
fs.mkdirSync(styleDir, { recursive: true })
const written = []
for (const [subject, questions] of bySubject) {
  const usableQuestions = questions.map(styleQuestion).filter(Boolean)
  // A small real set is still more faithful than silently borrowing another
  // subject or level. StyleTemplate marks sets below 50 as thin.
  if (usableQuestions.length < 10) continue
  const template = buildStyleTemplate('cambridge', 'igcse', subject, usableQuestions)
  const readable = readableExemplars(usableQuestions)
  template.exemplars = readable
  template.provenance = {
    based_on: ['cambridge/igcse/' + subject],
    validation_files: files.filter((file) => subjectOf(file) === subject).length,
    validation_note: `Taken from the IGCSE question papers in Cambridge/igcse.2. ${usableQuestions.length} usable questions retained from ${questions.length} parser records.`,
  }
  fs.writeFileSync(path.join(styleDir, `${subject}.json`), JSON.stringify(template, null, 2))
  written.push({ subject, questions: usableQuestions.length, parser_records: questions.length, exemplars: template.exemplars.length, commands: Object.keys(template.command_words).length })
}

const summary = { ...counts, subjects: written }
fs.writeFileSync(path.join(outDir, 'igcse-summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
