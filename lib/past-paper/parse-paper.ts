/**
 * Turn a past paper's text layer into a question tree.
 *
 * The text is kept as printed. A paper with no text layer, or whose question
 * numbers cannot be found, is flagged and left unparsed. Nothing is filled in.
 */

export interface PaperPart {
  label: string | null
  text: string
  marks: number | null
  command_word: string | null
  parts: PaperPart[]
}

export interface ExtractedQuestion {
  number: string
  stem: string
  figure_refs: string[]
  marks: number | null
  command_word: string | null
  parts: PaperPart[]
}

export interface ParsedPaper {
  status: 'extracted' | 'needs_review'
  reasons: string[]
  questions: ExtractedQuestion[]
}

const COMMANDS = [
  'calculate', 'state', 'explain', 'describe', 'define', 'name', 'suggest',
  'determine', 'show', 'find', 'write', 'complete', 'give', 'deduce', 'sketch',
  'draw', 'plot', 'compare', 'identify', 'predict', 'estimate', 'outline',
] as const

const NOT_A_QUESTION = /^(?:hour|hours|minute|minutes|mark|marks|page|pages|blank|printed|turn)$/i
const QUESTION_LINE = /^(\d{1,2})\s+(\S[\s\S]*)$/
const PART_SPLIT = /(?:^|\n)\s*\(((?:[a-h])|(?:i{1,3}|iv|vi{0,3}|ix|x))\)\s+/i
const MARKS = /\[\s*(\d{1,2})\s*\]\s*$/

function commandWord(text: string): string | null {
  const match = text.match(new RegExp(`\\b(${COMMANDS.join('|')})\\b`, 'i'))
  return match ? match[1].toLowerCase() : null
}

function marksOf(text: string): number | null {
  const match = text.trim().match(MARKS)
  return match ? Number(match[1]) : null
}

function stripMark(text: string): string {
  return text.replace(MARKS, '').trim()
}

function isFurniture(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^©/.test(t) || /UCLES|Turn over|Cambridge University Press/i.test(t)) return true
  if (/^\d{1,2}$/.test(t)) return true
  if (/^\d{4}\/\d{2}\//.test(t)) return true
  return false
}

function questionStarts(text: string): { number: number; body: string }[] {
  const lines = text.split(/\n/)
  const starts: { index: number; number: number; rest: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(QUESTION_LINE)
    if (!match) continue
    const number = Number(match[1])
    if (number < 1 || number > 60) continue
    const first = match[2].split(/\s+/)[0] ?? ''
    if (NOT_A_QUESTION.test(first)) continue
    if (/^[A-Za-z]\s*=/.test(match[2])) continue
    starts.push({ index: i, number, rest: match[2] })
  }
  const questions: { number: number; body: string }[] = []
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]
    const until = starts[i + 1]?.index ?? lines.length
    const body = [from.rest, ...lines.slice(from.index + 1, until).filter((line) => !isFurniture(line))].join('\n').trim()
    if (body.length < 8) continue
    questions.push({ number: from.number, body })
  }
  return questions
}

function partsOf(body: string): { stem: string; parts: PaperPart[] } {
  const bits = body.split(PART_SPLIT)
  if (bits.length < 3) {
    return { stem: stripMark(body), parts: [] }
  }
  const stem = stripMark(bits[0] ?? '')
  const parts: PaperPart[] = []
  for (let i = 1; i < bits.length; i += 2) {
    const label = bits[i]
    const text = stripMark(bits[i + 1] ?? '')
    if (!label || !text) continue
    parts.push({
      label,
      text,
      marks: marksOf(bits[i + 1] ?? ''),
      command_word: commandWord(text),
      parts: [],
    })
  }
  return { stem, parts }
}

function sequential(numbers: number[]): boolean {
  if (numbers.length < 2) return false
  let inOrder = 0
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) inOrder += 1
  }
  return inOrder >= Math.ceil((numbers.length - 1) * 0.6)
}

/** Parse one paper's text layer. The raw text is not rewritten. */
export function parsePaperText(text: string, pageCount: number): ParsedPaper {
  const raw = String(text ?? '')
  const usable = raw.replace(/\s+/g, ' ').trim()
  if (usable.length < 80 || (pageCount >= 4 && usable.length / pageCount < 25)) {
    return { status: 'needs_review', reasons: ['no text layer'], questions: [] }
  }

  const found = questionStarts(raw)
  const questions: ExtractedQuestion[] = found.map((item) => {
    const { stem, parts } = partsOf(item.body)
    const ownMarks = marksOf(item.body)
    const partMarks = parts.reduce((sum, part) => sum + (part.marks ?? 0), 0)
    return {
      number: String(item.number),
      stem,
      figure_refs: [],
      marks: parts.length && partMarks > 0 ? partMarks : ownMarks,
      command_word: commandWord(stem || item.body),
      parts,
    }
  })

  if (!sequential(found.map((item) => item.number))) {
    return {
      status: 'needs_review',
      reasons: [questions.length ? 'question numbers are not in order' : 'no question numbers found'],
      questions: [],
    }
  }

  return { status: 'extracted', reasons: [], questions }
}
