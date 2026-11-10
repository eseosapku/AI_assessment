import fs from 'node:fs'
import path from 'node:path'
import { asksNothing } from '@/lib/question-audit'
import { levelFromBook } from './book-level'
import type { StyleTemplate } from './style-template'

/**
 * Real papers on disk: O Level, AS/A Level, Primary Checkpoint, and IGCSE.
 * An IGCSE book uses the IGCSE papers when that subject has them.
 * Physics has none in the IGCSE set, so that book still uses the O Level and AS/A Level papers.
 */

const LEVEL_DIR: Record<string, string> = {
  o_level: 'o_level',
  as_level: 'as_and_a_level',
  a_level: 'as_and_a_level',
  as_and_a_level: 'as_and_a_level',
  primary_checkpoint: 'primary_checkpoint',
}

const FILE_NAMES: Record<string, string[]> = {
  mathematics: ['math', 'mathematics'],
  physics: ['physics'],
  chemistry: ['chemistry'],
  biology: ['biology'],
  economics: ['economics', 'econ'],
  computing: ['computerscience', 'compscience', 'computer_science'],
  geography: ['geography'],
  history: ['history'],
  english: ['english'],
  science: ['science'],
}

function subjectKey(title: string): string {
  const t = title.toLowerCase()
  if (/\bmath/.test(t)) return 'mathematics'
  if (/\bphysics\b/.test(t)) return 'physics'
  if (/\bchemistry\b/.test(t)) return 'chemistry'
  if (/\bbiology\b/.test(t)) return 'biology'
  if (/\beconom/.test(t)) return 'economics'
  if (/\bcomputers?\b|\bcomputing\b|\bict\b|information and communication technology/.test(t)) return 'computing'
  if (/\bgeography\b/.test(t)) return 'geography'
  if (/\bhistory\b/.test(t)) return 'history'
  if (/\benglish\b|\bliterature\b/.test(t)) return 'english'
  if (/\bscience\b/.test(t)) return 'science'
  return ''
}

function readTemplate(file: string, allowIgcse = false): StyleTemplate | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as StyleTemplate
    if (parsed.derived || parsed.question_count < 1) return null
    if (parsed.level === 'igcse' && !allowIgcse) return null
    return parsed
  } catch {
    return null
  }
}

function loadReal(root: string, levelDir: string, subject: string, allowIgcse = false): StyleTemplate | null {
  const dir = path.join(root, 'systems', 'cambridge', 'style', levelDir)
  if (!fs.existsSync(dir)) return null
  for (const name of FILE_NAMES[subject] ?? []) {
    const template = readTemplate(path.join(dir, `${name}.json`), allowIgcse)
    if (template) return template
  }
  return null
}

/** IGCSE from the real O Level papers, plus AS/A Level where that subject has them. */
function deriveIgcse(root: string, subject: string): StyleTemplate | null {
  const sources = [
    loadReal(root, 'o_level', subject),
    loadReal(root, 'as_and_a_level', subject),
  ].filter((item): item is StyleTemplate => item != null)
  if (!sources.length) return null
  const primary = sources[0]
  return {
    ...primary,
    level: 'igcse',
    derived: true,
    thin: false,
    question_count: sources.reduce((sum, item) => sum + item.question_count, 0),
    provenance: {
      based_on: sources.map((item) => `cambridge/${item.level}/${item.subject}`),
      validation_files: 0,
      validation_note: 'No IGCSE papers for this subject. The style is the real O Level and AS/A Level papers, as before.',
    },
    sources,
  }
}

/** Real past-paper style for this Cambridge book. IGCSE uses its own papers when they parsed. */
export function loadCambridgeStyle(bookTitle: string, curriculum: number, root = process.cwd()): StyleTemplate | null {
  if (curriculum !== 1) return null
  const parsed = levelFromBook(bookTitle, 1)
  const subject = subjectKey(bookTitle)
  if (!subject) return null
  if (parsed.level === 'igcse') return loadReal(root, 'igcse', subject, true) ?? deriveIgcse(root, subject)
  const dirName = LEVEL_DIR[parsed.level]
  if (!dirName) return null
  return loadReal(root, dirName, subject)
}

function cleanExample(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function usableExample(text: string, template: StyleTemplate): boolean {
  const cleaned = cleanExample(text)
  const letters = (cleaned.match(/[A-Za-z]/g) ?? []).length
  if (letters / cleaned.length < 0.55) return false
  if (/^\s*(draw|sketch|plot)\b/i.test(cleaned)) return false
  if (/\b(?:fig(?:ure)?\.?\s*\d*|diagram|map|graph|grid|insert)\b/i.test(cleaned)) return false
  // The extracted IGCSE English questions refer to a separate reading or
  // listening text. That text is not part of the style template, so showing
  // those stems as standalone examples teaches the generator to omit data.
  if (template.level === 'igcse' && /english/.test(template.subject)) return false
  const words = cleaned.split(' ').length
  if (words < 8 || words > 80) return false
  return !asksNothing(cleaned)
}

const LEVEL_LABEL: Record<string, string> = {
  o_level: 'O Level',
  as_and_a_level: 'AS and A Level',
  primary_checkpoint: 'Primary Checkpoint',
  igcse: 'IGCSE',
}

function styleSection(template: StyleTemplate, heading: string, exampleLimit: number): string {
  const commands = Object.entries(template.command_words)
    .filter(([word]) => !/^(draw|sketch|plot)$/.test(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => `${word} (${count})`)
    .join(', ')
  const examples = template.exemplars
    .filter((item) => usableExample(item.text, template))
    .slice(0, exampleLimit)
    .map((item) => ({ ...item, text: cleanExample(item.text).slice(0, 420) }))
  return [
    heading,
    `Command words, most used first: ${commands || 'none counted'}.`,
    `Marks: median ${template.marks.median ?? 'unknown'}, range ${template.marks.min ?? '?' }–${template.marks.max ?? '?'}.`,
    `Questions: ${template.parts.single} single-part, ${template.parts.multi} multi-part. Typical stem length ${template.stem_words.median ?? '?'} words.`,
    examples.length ? `Examples:\n${examples.map((item, i) => `${i + 1}. (${item.marks ?? '?'} marks) ${item.text}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

/** Prompt block. The examples are real papers. The model is told not to copy them. */
export function cambridgeStylePrompt(template: StyleTemplate): string {
  if (template.level === 'igcse' && template.sources?.length) {
    const names = template.sources.map((item) => LEVEL_LABEL[item.level] ?? item.level)
    const demand = template.sources.some((item) => item.level === 'o_level') && template.sources.some((item) => item.level === 'as_and_a_level')
      ? 'Keep the demand at IGCSE, with the O Level mark weight.'
      : 'Keep the demand at IGCSE.'
    return [
      `CAMBRIDGE IGCSE ${template.subject}. Write an IGCSE question on the subtopic.`,
      `No IGCSE papers for this subject. This wording is taken from the real ${names.join(' and ')} papers in the same subject.`,
      ...template.sources.map((item) => styleSection(
        item,
        `From ${LEVEL_LABEL[item.level] ?? item.level} ${item.subject}, ${item.question_count} real past-paper questions.`,
        3,
      )),
      `${demand} Do not copy an example.`,
      'Do not ask the student to draw, label a diagram, or carry out an experiment.',
    ].join('\n')
  }
  return [
    styleSection(
      template,
      `CAMBRIDGE ${LEVEL_LABEL[template.level] ?? template.level} ${template.subject} — wording measured from ${template.question_count} real past-paper questions.`,
      6,
    ),
    'Do not copy an example. Write a new question on the subtopic, in this shape.',
    'Do not ask the student to draw, label a diagram, or carry out an experiment.',
    /english/.test(template.subject)
      ? 'Print any sentence the question needs. Do not ask about a story, poem, or recording that is not written out in the question.'
      : '',
    /history/.test(template.subject)
      ? 'Do not ask about a source, cartoon, or photograph that is not written out in the question.'
      : '',
  ].filter(Boolean).join('\n')
}
