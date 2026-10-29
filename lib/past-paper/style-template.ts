/**
 * A style template is counted from the questions themselves.
 * Nothing here is filled in from what an exam board is generally like.
 */

export interface StyleQuestion {
  stem: string
  marks: number | null
  command_word: string | null
  parts: { text: string; marks: number | null; command_word: string | null }[]
}

export interface StyleTemplate {
  system: string
  level: string
  subject: string
  question_count: number
  thin: boolean
  derived: boolean
  provenance?: { based_on: string[]; validation_files: number; validation_note: string }
  command_words: Record<string, number>
  marks: { count: number; min: number | null; max: number | null; median: number | null }
  marks_per_command: Record<string, { count: number; median: number | null }>
  parts: { single: number; multi: number; median_parts: number | null }
  stem_words: { median: number | null; p25: number | null; p75: number | null }
  context: { named: number; abstract: number }
  units_rate: number
  figure_rate: number
  openings: { phrase: string; count: number }[]
  closings: { phrase: string; count: number }[]
  exemplars: { marks: number | null; command_word: string | null; text: string }[]
  /** Real papers this template was taken from, when the book level has none of its own. */
  sources?: StyleTemplate[]
}

const NAMED = /\b(?:in|at|near|from)\s+[A-Z][a-z]+|\b(?:Rwanda|Kigali|Mia|Hassan|farmer|village)\b/
const UNITS = /\b(?:kg|g|cm|mm|km|m\/s|N|J|W|mol|kPa|°C|cm3|m2)\b/i
const FIGURE = /\b(?:fig\.?|figure|graph|diagram|chart)\b/i

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[at]
}

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function topPhrases(phrases: string[], n: number): { phrase: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const phrase of phrases) {
    if (!phrase) continue
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([phrase, count]) => ({ phrase, count }))
}

function exemplars(questions: StyleQuestion[]): StyleTemplate['exemplars'] {
  const usable = questions.filter((q) => wordsOf(q.stem).length >= 8 && wordsOf(q.stem).length <= 80)
  const byMarks = new Map<string, StyleQuestion>()
  for (const question of usable) {
    const key = String(question.marks ?? 'none')
    if (!byMarks.has(key)) byMarks.set(key, question)
  }
  return [...byMarks.values()].slice(0, 8).map((question) => ({
    marks: question.marks,
    command_word: question.command_word,
    text: question.stem.trim(),
  }))
}

export function buildStyleTemplate(
  system: string,
  level: string,
  subject: string,
  questions: StyleQuestion[],
): StyleTemplate {
  const commandWords: Record<string, number> = {}
  const marks: number[] = []
  const marksByCommand = new Map<string, number[]>()
  const partCounts: number[] = []
  const stemWords: number[] = []
  const openings: string[] = []
  const closings: string[] = []
  let single = 0
  let multi = 0
  let named = 0
  let units = 0
  let figures = 0

  for (const question of questions) {
    const command = question.command_word
    if (command) commandWords[command] = (commandWords[command] ?? 0) + 1
    if (question.marks != null) {
      marks.push(question.marks)
      if (command) {
        const list = marksByCommand.get(command) ?? []
        list.push(question.marks)
        marksByCommand.set(command, list)
      }
    }
    const n = question.parts.length
    partCounts.push(n)
    if (n > 0) multi += 1
    else single += 1
    const stem = question.stem || ''
    const tokens = wordsOf(stem)
    stemWords.push(tokens.length)
    openings.push(tokens.slice(0, 3).join(' ').toLowerCase())
    closings.push(tokens.slice(-4).join(' ').toLowerCase())
    if (NAMED.test(stem)) named += 1
    if (UNITS.test(stem)) units += 1
    if (FIGURE.test(stem)) figures += 1
  }

  const marksPerCommand: StyleTemplate['marks_per_command'] = {}
  for (const [command, values] of marksByCommand) {
    marksPerCommand[command] = { count: values.length, median: median(values) }
  }

  return {
    system,
    level,
    subject,
    question_count: questions.length,
    thin: questions.length < 50,
    derived: false,
    command_words: commandWords,
    marks: { count: marks.length, min: marks.length ? Math.min(...marks) : null, max: marks.length ? Math.max(...marks) : null, median: median(marks) },
    marks_per_command: marksPerCommand,
    parts: { single, multi, median_parts: median(partCounts) },
    stem_words: { median: median(stemWords), p25: percentile(stemWords, 25), p75: percentile(stemWords, 75) },
    context: { named, abstract: questions.length - named },
    units_rate: questions.length ? units / questions.length : 0,
    figure_rate: questions.length ? figures / questions.length : 0,
    openings: topPhrases(openings, 8),
    closings: topPhrases(closings, 8),
    exemplars: exemplars(questions),
  }
}
