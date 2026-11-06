import { asksNothing } from '@/lib/question-audit'

/** The form's exam-style choice. Practice stays a single question per screen. */
export function isExamStyle(style: unknown): boolean {
  return /exam style/i.test(String(style ?? ''))
}

export interface ExamPart {
  part: string
  question: string
  marks: number | null
}

export interface SplitStem {
  scenario: string
  parts: ExamPart[]
}

/**
 * A stem that already contains (a) and (b) is one numbered question written
 * as a block. Parts remain separate answer records on one question page.
 */
export function splitExamStem(text: string): SplitStem | null {
  const source = String(text ?? '')
  const matches = [...source.matchAll(/\(([a-h])\)\s+(?=[A-Z])/g)]
  if (matches.length < 2) return null
  const letters = matches.map((match) => match[1].toLowerCase())
  if (letters[0] !== 'a' || letters[1] !== 'b') return null
  const first = matches[0].index ?? 0
  const scenario = source.slice(0, first).trim()
  const parts = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length
    const body = source.slice(start, end).replace(/\s+/g, ' ').trim()
    const printed = body.match(/\[(\d{1,2})\]\s*$/)
    return {
      part: match[1].toLowerCase(),
      question: body.replace(/\s*\[\d{1,2}\]\s*$/, '').trim(),
      marks: printed ? Number(printed[1]) : null,
    }
  })
  if (parts.some((part) => part.question.length < 8)) return null
  return { scenario, parts }
}

type PaperQuestion = {
  question?: string
  scenario?: string
  part?: string
  marks?: number
  [key: string]: unknown
}

/** Turn a crammed stem into separate answer records, retaining its shared setup. */
export function expandExamQuestions<T extends PaperQuestion>(questions: T[]): (T & PaperQuestion)[] {
  const out: (T & PaperQuestion)[] = []
  for (const question of questions) {
    // Models may group parts under one numbered object despite the flat schema.
    // Preserve that valid paper structure rather than silently returning no groups.
    if (Array.isArray(question.parts)) {
      const nested = question.parts.filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
      out.push(...expandExamQuestions(nested.map((part, i) => {
        const { parts: _parts, ...parent } = question
        return { ...parent, ...part, scenario: part.scenario || question.scenario, part: part.part || String.fromCharCode(97 + i) } as T
      })))
      continue
    }
    const split = splitExamStem(String(question.question ?? ''))
    if (!split) {
      if (asksNothing(String(question.question ?? ''))) continue
      const letter = String(question.part || '').match(/^(?:part\s*)?\(?([a-h])\)?[.)]?$/i)?.[1]?.toLowerCase()
      out.push(letter ? { ...question, part: letter } : question)
      continue
    }
    for (const part of split.parts) {
      if (asksNothing(part.question)) continue
      const scenario = [question.scenario, split.scenario].filter(Boolean).join('\n\n')
      out.push({
        ...question,
        question: part.question,
        scenario: scenario || undefined,
        part: part.part,
        marks: part.marks ?? question.marks,
      })
    }
  }
  return out
}

/** One numbered question and the screens that belong to it. Parts stay together. */
export function paperGroups(questions: { id?: unknown; part?: string | null; exam_question_id?: string }[]): { start: number; end: number; number: number }[] {
  const groups: { start: number; end: number; number: number }[] = []
  questions.forEach((question, index) => {
    const part = String(question.part ?? '').trim().toLowerCase()
    const previous = groups[groups.length - 1]
    const previousQuestion = index > 0 ? questions[index - 1] : undefined
    const sameQuestion = question.exam_question_id
      ? question.exam_question_id === previousQuestion?.exam_question_id
      : part && part !== 'a' && !previousQuestion?.exam_question_id
    if (sameQuestion && previous) {
      previous.end = index + 1
      return
    }
    groups.push({ start: index, end: index + 1, number: groups.length + 1 })
  })
  return groups
}

/** Pill label. A part of question 2 is "2b", not a new number that hides the grouping. */
export function navLabels(questions: { id?: unknown; part?: string | null; exam_question_id?: string }[]): string[] {
  const labels: string[] = []
  for (const group of paperGroups(questions)) {
    for (let i = group.start; i < group.end; i++) {
      labels[i] = `${group.number}${String(questions[i].part ?? '').trim().toLowerCase()}`
    }
  }
  return labels
}

/** Count complete numbered questions, never individual answer boxes. */
export function paperProgress(questions: { id?: unknown; part?: string | null; exam_question_id?: string }[], answered: ReadonlySet<number>, visited: ReadonlySet<number>) {
  const groups = paperGroups(questions)
  const complete = new Set<number>()
  const seen = new Set<number>()
  groups.forEach((group, index) => {
    const indices = Array.from({ length: group.end - group.start }, (_, offset) => group.start + offset)
    if (indices.every((i) => answered.has(i))) complete.add(index)
    if (indices.some((i) => visited.has(i) || answered.has(i))) seen.add(index)
  })
  return { groups, answered: complete, visited: seen }
}

/** A fact with no demand. A command later in the sentence still counts. */
export function isBareStatement(text: string): boolean {
  const stem = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!stem) return true
  if (!asksNothing(stem)) return false
  return !/\b(calculate|find|evaluate|determine|show that|explain|state|name|solve|prove|describe)\b/i.test(stem)
}

/** The only JSON shape an exam paper may use. A single question with no part is rejected. */
export function examQuestionSchema(): string {
  return `{
      "id": <number>,
      "type": "longform",
      "part": "a or b or c",
      "scenario": "<the shared setup for this numbered question: the data, the equation, the vectors. Copy this exact text onto every part of the same numbered question.>",
      "question": "<ONLY this part's demand, starting with Calculate, Find, Show, Explain, State or Name>",
      "marks": <2 or 3>,
      "marking_criteria": ["<one point per mark>"],
      "hints": ["<one hint, not the answer>"],
      "model_answer": "<the working and the result>",
      "explanation": "<written to the student>"
    }`
}

const EXAM_PARTS = ['a', 'b', 'c'] as const

/** At most (a), (b) and (c), in that order. A fourth part is dropped. */
export function capExamParts<T extends { part?: string | null; exam_question_id?: string }>(questions: T[]): T[] {
  const groups = paperGroups(questions)
  const out: T[] = []
  for (const group of groups) {
    const slice = questions.slice(group.start, group.end)
    const letters = new Map<string, T>()
    const plain: T[] = []
    for (const question of slice) {
      const letter = String(question.part ?? '').trim().toLowerCase()
      if (!letter) {
        plain.push(question)
        continue
      }
      if (EXAM_PARTS.includes(letter as typeof EXAM_PARTS[number]) && !letters.has(letter)) letters.set(letter, question)
    }
    if (!letters.size) {
      out.push(...plain)
      continue
    }
    for (const letter of EXAM_PARTS) {
      const question = letters.get(letter)
      if (question) out.push(question)
    }
  }
  return out
}

/** Reject incomplete groups after quality filters; a lone (b) must not become a new question. */
export function completeExamQuestions<T extends { part?: string | null; exam_question_id?: string }>(questions: T[]): T[] {
  const capped = capExamParts(questions)
  return paperGroups(capped).flatMap((group) => {
    const parts = capped.slice(group.start, group.end)
    return parts[0]?.part === 'a' && parts[1]?.part === 'b' ? parts : []
  })
}

/** Keep the first N numbered questions, including every part of each. */
export function takeNumberedQuestions<T extends { part?: string | null }>(questions: T[], numbered: number): T[] {
  const groups = paperGroups(questions)
  const keep = groups.slice(0, Math.max(0, numbered))
  if (!keep.length) return []
  return questions.slice(0, keep[keep.length - 1].end)
}

/**
 * The exam generator's whole prompt. It does not include the practice
 * difficulty block, which asks for Propose, Design and Hypothesise.
 */
export function buildExamPrompt(opts: {
  subject: string
  topics: string[]
  numbered: number
  paperStyle?: string
  scope?: string
  figure?: string
  source?: string
  audience?: string
  guidance?: string
}): string {
  return [
    `You write exam papers. Subject: ${opts.subject}.`,
    `Topics: ${opts.topics.filter(Boolean).join('; ') || opts.subject}.`,
    'Stay within the requested topic, including any explicit number range. A topic limited to numbers 1–5 must not require numbers or results above 5. When the focus is currency, explicitly use that currency in the task.',
    opts.paperStyle || '',
    opts.audience || '',
    opts.guidance || '',
    opts.source ? `SHARED SOURCE MATERIAL (also used for practice questions):\n${opts.source}\nUse relevant content from these sources. Supply all data needed on this page; do not refer to an unseen page, passage or figure.` : '',
    opts.scope ? `Stay inside what this stage teaches:\n${opts.scope}` : '',
    opts.figure ? `A diagram is printed with the first part. It shows: ${opts.figure}. That part must say "the diagram" and be answerable from it.` : '',
    'Solve every part yourself before returning it. Use consistent, physically possible data and provide all assumptions needed. For circular motion, check contact/reachability conditions before asking about the top of a circle. If a symbol is intentionally left general, explicitly ask for an answer in terms of that symbol. Each part needs its own correct working and mark scheme.',
    'For reading or literary analysis, print a short original extract in the shared scenario and ask only about that extract. Never ask about an unseen textbook story, poem, chapter, recording or page.',
    examStyleRules(opts.numbered),
    `Write exactly ${opts.numbered} numbered question(s).`,
    'Command words: Calculate, Find, State, Name, Explain, Describe, Show. Do not use Propose, Design, Hypothesise, Synthesise, Formulate, or Assess.',
    `Return JSON only. The questions array MUST contain exactly ${opts.numbered} numbered parent objects. Each parent has its own scenario and a parts array containing (a), (b), optionally (c). Counting part objects is NOT counting numbered questions.`,
    `{"questions":[{"number":1,"scenario":"<shared setup>","parts":[${examQuestionSchema()}, ...]}]}`,
  ].filter(Boolean).join('\n\n')
}

/** Extra prompt for an exam paper. Practice does not get this block. */
export function examStyleRules(numbered: number): string {
  const n = Math.max(1, Math.round(numbered))
  const numberedQuestions = n
  return [
    'EXAM PAPER — this replaces every instruction that asks for a single standalone question or a percentage of multiple choice.',
    `Write ${numberedQuestions} numbered questions. Each numbered question has two or three parts, and no more: (a) and (b), or (a), (b) and (c). Never write a part (d) or anything after (c).`,
    'Return each part as its own object. Every PART object MUST include "part" and "scenario". A part object without "part" is discarded.',
    'Parts of the same numbered question repeat the identical "scenario". "question" is only that part\'s demand.',
    'Different numbered questions MUST have different setups, data and demands. Never reuse one table, numerical example or extract as several numbered questions.',
    'Do not write one long question that contains (a), (b) and (c) in the same string.',
    'Do not return a bare statement such as "Endothermic reactions absorb heat."',
    'A figure may still be used. When a part needs it, say "the diagram" in that part.',
  ].join('\n')
}

export const STATEMENT_RULE = 'Every question must ask the student to do something. A bare statement ("A ray of light travels from air into glass.") is thrown away. End with the demand: a command word or a question mark.'
