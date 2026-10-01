/**
 * Subject-aware Interactive Study generation.
 * Picks interaction kinds that fit each discipline (science processes, grammar matching, etc.).
 */

import { classifySubjectDomain, type SubjectDomain } from '@/lib/subject-assessment-plan'
import type { InteractiveKind, InteractiveQuestion } from '@/types/interactive'

export interface InteractiveKindProfile {
  kinds: InteractiveKind[]
  guidance: string
}

const DOMAIN_PROFILES: Record<SubjectDomain, InteractiveKindProfile> = {
  science: {
    kinds: ['match', 'order', 'categorize', 'fill_blank', 'true_false', 'multi_select', 'odd_one_out'],
    guidance: `SCIENCE INTERACTIVE RULES:
- Use "match" for term ↔ definition (e.g. organelle ↔ function, element ↔ symbol).
- Use "order" for process steps (photosynthesis, digestion, experimental method).
- Use "categorize" to sort into groups (vertebrate/invertebrate, acid/base/salt, renewable/non-renewable).
- Use "fill_blank" for equations, formulas, or labelled processes using {{0}} placeholders.
- Use "true_false" for factual statements students verify (4–6 statements).
- Use "multi_select" for "select ALL that apply" (e.g. which are greenhouse gases?).
- Use "odd_one_out" when one item clearly doesn't belong in a set of four.
- Keep items factual and syllabus-accurate. No fictional scenarios.`,
  },
  math: {
    kinds: ['fill_blank', 'order', 'match', 'true_false', 'odd_one_out'],
    guidance: `MATH INTERACTIVE RULES:
- Prefer "fill_blank" for completing expressions, formulas, or number sentences with {{0}} placeholders.
- Use "order" for solution steps in the correct sequence.
- Use "match" for expression ↔ simplified form, shape ↔ property, or unit ↔ conversion.
- Numbers and symbols must be mathematically correct.`,
  },
  technology: {
    kinds: ['match', 'order', 'categorize', 'fill_blank', 'true_false', 'multi_select'],
    guidance: `ICT / TECHNOLOGY INTERACTIVE RULES:
- "match" for hardware/software terms, protocol ↔ purpose, input/output devices.
- "order" for algorithm steps, boot sequence, or troubleshooting flow.
- "categorize" for input vs output, RAM vs storage, threat types.
- "fill_blank" for completing commands, acronyms, or short technical definitions.`,
  },
  language: {
    kinds: ['match', 'fill_blank', 'categorize', 'true_false', 'odd_one_out'],
    guidance: `LANGUAGE INTERACTIVE RULES:
- "match" for word ↔ meaning, figure of speech ↔ example, tense ↔ example sentence.
- "fill_blank" for cloze passages with grammar or vocabulary gaps.
- "categorize" for parts of speech, formal/informal register, active/passive.
- Use clear, age-appropriate vocabulary.`,
  },
  history: {
    kinds: ['order', 'match', 'categorize', 'true_false', 'odd_one_out'],
    guidance: `HISTORY INTERACTIVE RULES:
- "order" for chronological events or cause-effect chains.
- "match" for event ↔ date, person ↔ role, treaty ↔ outcome.
- "categorize" for economic/social/political factors, primary vs secondary sources.
- Use real historical facts only — no invented events.`,
  },
  business: {
    kinds: ['match', 'categorize', 'order', 'true_false', 'multi_select', 'fill_blank'],
    guidance: `BUSINESS / ENTREPRENEURSHIP INTERACTIVE RULES:
- "match" for term ↔ definition (asset ↔ meaning, cost type ↔ example, document ↔ purpose).
- "categorize" for fixed vs variable cost, asset vs liability, internal vs external finance.
- "order" for the steps of starting a venture, an accounting cycle, or a sales process.
- "true_false" for statements about a short business scenario the student has just read.
- "multi_select" for "which of these are sources of short-term finance?".
- Ground every item in a realistic small-business situation rather than an abstract definition.`,
  },
  arts: {
    kinds: ['match', 'categorize', 'order', 'odd_one_out', 'true_false'],
    guidance: `ART / MUSIC INTERACTIVE RULES:
- "match" for term ↔ meaning (medium ↔ description, note value ↔ duration, instrument ↔ family).
- "categorize" for warm/cool colours, instrument families, art movements, major/minor.
- "order" for a process (stages of a print, a scale, the steps of a technique).
- "odd_one_out" for the item outside a movement, family or key.
- Name real works, artists and instruments; do not invent them.`,
  },
  religious: {
    kinds: ['match', 'fill_blank', 'categorize'],
    guidance: `RELIGIOUS STUDIES INTERACTIVE RULES:
- "match" for teaching ↔ source, festival ↔ religion, prophet ↔ message.
- "fill_blank" for key terms from scripture or doctrine (respectful, accurate).
- "categorize" for pillars, sacraments, ethical categories.`,
  },
  humanities: {
    kinds: ['match', 'categorize', 'fill_blank', 'true_false', 'multi_select', 'odd_one_out'],
    guidance: `HUMANITIES (Geography, Economics, Business) INTERACTIVE RULES:
- "match" for term ↔ definition, landform ↔ process, economic term ↔ example.
- "categorize" for economic sectors, climate types, trade blocs, account types.
- "fill_blank" for completing definitions or data-response sentences.`,
  },
  default: {
    kinds: ['match', 'fill_blank', 'order'],
    guidance: `INTERACTIVE STUDY RULES:
- Choose the kind that best tests the topic (matching, sequencing, sorting, or gap-fill).
- All answers must be objectively gradable — no opinion-based interactions.`,
  },
}

export function interactiveProfileForSubject(subject: string): InteractiveKindProfile {
  return DOMAIN_PROFILES[classifySubjectDomain(subject)]
}

export function buildInteractiveSchemaBlock(kinds: InteractiveKind[]): string {
  const schemas: string[] = []

  if (kinds.includes('match')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "match",
      "question": "<instruction, e.g. Match each term to its correct definition>",
      "left_items": ["<term 1>", "<term 2>", "<term 3>", "<term 4>"],
      "right_items": ["<definition A>", "<definition B>", "<definition C>", "<definition D>"],
      "correct_pairs": [[0,2],[1,0],[2,3],[3,1]],
      "marks": 4,
      "explanation": "<why these pairings are correct>"
    }`)
  }
  if (kinds.includes('order')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "order",
      "question": "<instruction, e.g. Put these stages in the correct order>",
      "items": ["<step A>", "<step B>", "<step C>", "<step D>"],
      "correct_order": [2,0,1,3],
      "marks": 4,
      "explanation": "<why this sequence is correct>"
    }`)
  }
  if (kinds.includes('categorize')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "categorize",
      "question": "<instruction, e.g. Sort each item into the correct category>",
      "categories": ["<Category 1>", "<Category 2>"],
      "items": ["<item 1>", "<item 2>", "<item 3>", "<item 4>", "<item 5>", "<item 6>"],
      "correct_category": [0,1,0,1,0,1],
      "marks": 6,
      "explanation": "<brief explanation>"
    }`)
  }
  if (kinds.includes('fill_blank')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "fill_blank",
      "question": "<instruction, e.g. Complete the sentence using the word bank>",
      "template": "Photosynthesis occurs in the {{0}} and produces {{1}}.",
      "blanks": [{"id":"0","correct":"chloroplast"},{"id":"1","correct":"glucose"}],
      "word_bank": ["chloroplast","glucose","mitochondria","oxygen","nucleus"],
      "marks": 2,
      "explanation": "<why these words are correct>"
    }`)
  }
  if (kinds.includes('true_false')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "true_false",
      "question": "<instruction, e.g. Mark each statement True or False>",
      "statements": ["<statement 1>", "<statement 2>", "<statement 3>", "<statement 4>"],
      "correct_answers": [true, false, true, false],
      "marks": 4,
      "explanation": "<why each answer is correct>"
    }`)
  }
  if (kinds.includes('multi_select')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "multi_select",
      "question": "<instruction, e.g. Select ALL that apply>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>", "<option E>"],
      "correct_indices": [0, 2, 4],
      "marks": 5,
      "explanation": "<why these options are correct>"
    }`)
  }
  if (kinds.includes('odd_one_out')) {
    schemas.push(`{
      "id": <number>,
      "type": "interactive",
      "kind": "odd_one_out",
      "question": "<instruction, e.g. Tap the item that does NOT belong>",
      "items": ["<item A>", "<item B>", "<item C>", "<item D>"],
      "correct_index": 2,
      "marks": 1,
      "explanation": "<why this item is the odd one out>"
    }`)
  }

  return schemas.join(',\n')
}

export function buildInteractiveGenerationRules(subject: string, topics: string[]): string {
  const profile = interactiveProfileForSubject(subject)
  const topicLine = topics.length ? topics.slice(0, 5).join(', ') : subject
  return `${profile.guidance}

TOPIC FOCUS: ${topicLine}
- Generate a VARIETY of interaction kinds across the set — do not use only one kind.
- Allowed kinds for this subject: ${profile.kinds.join(', ')}.
- Each question must be fully self-contained (no passages, no diagrams required).
- "marks" must equal the number of gradable items (pairs, steps, items, or blanks).
- For "match": left_items and right_items must be same length (3–5 pairs). correct_pairs uses 0-based indices; right_items should be shuffled so indices don't align by position.
- For "order": 4–6 items; correct_order is a permutation of indices 0..n-1.
- For "categorize": 2–3 categories; 4–8 items; balanced distribution.
- For "fill_blank": 2–4 blanks; word_bank must include all correct answers plus 2–4 plausible distractors.
- For "true_false": 4–6 short factual statements; correct_answers is boolean array same length.
- For "multi_select": 4–6 options; 2–4 correct_indices (0-based); include plausible distractors.
- For "odd_one_out": exactly 4 items; one clearly does not belong; correct_index is 0-based.`
}

/** Normalize and validate AI output into a workable interactive question. */
export function normalizeInteractiveQuestion(raw: any): InteractiveQuestion | null {
  const kind = String(raw?.kind || '').toLowerCase() as InteractiveKind
  const base = {
    id: Number(raw?.id) || 0,
    type: 'interactive' as const,
    question: String(raw?.question || '').trim(),
    explanation: String(raw?.explanation || '').trim() || 'Review the correct answer above.',
    marks: Math.max(1, Number(raw?.marks) || 1),
    image_url: raw?.image_url ? String(raw.image_url) : undefined,
    diagram_svg: raw?.diagram_svg ? String(raw.diagram_svg) : undefined,
  }

  if (!base.question) return null

  if (kind === 'match') {
    const left = (Array.isArray(raw.left_items) ? raw.left_items : []).map(String).filter(Boolean)
    const right = (Array.isArray(raw.right_items) ? raw.right_items : []).map(String).filter(Boolean)
    if (left.length < 3 || right.length < 3 || left.length !== right.length) return null

    let pairs: [number, number][] = []
    if (Array.isArray(raw.correct_pairs)) {
      pairs = raw.correct_pairs
        .map((p: any) => [Number(p?.[0]), Number(p?.[1])] as [number, number])
        .filter(([l, r]: [number, number]) => Number.isFinite(l) && Number.isFinite(r) && l >= 0 && r >= 0 && l < left.length && r < right.length)
    }
    if (pairs.length !== left.length) return null
    const leftUsed = new Set(pairs.map((p) => p[0]))
    const rightUsed = new Set(pairs.map((p) => p[1]))
    if (leftUsed.size !== left.length || rightUsed.size !== right.length) return null
    for (let i = 0; i < left.length; i++) {
      if (!leftUsed.has(i)) return null
    }

    return { ...base, kind: 'match', left_items: left, right_items: right, correct_pairs: pairs, marks: left.length }
  }

  if (kind === 'order') {
    const items = (Array.isArray(raw.items) ? raw.items : []).map(String).filter(Boolean)
    if (items.length < 3) return null
    let order = (Array.isArray(raw.correct_order) ? raw.correct_order : []).map(Number)
    const valid =
      order.length === items.length &&
      new Set(order).size === items.length &&
      order.every((i: number) => i >= 0 && i < items.length)
    if (!valid) return null
    return { ...base, kind: 'order', items, correct_order: order, marks: items.length }
  }

  if (kind === 'categorize') {
    const categories = (Array.isArray(raw.categories) ? raw.categories : []).map(String).filter(Boolean)
    const items = (Array.isArray(raw.items) ? raw.items : []).map(String).filter(Boolean)
    if (categories.length < 2 || items.length < 4) return null
    // Each row's answer may be the column's NAME, which is what the exam
    // prompt now asks for. Asked for 0-based numbers, the model wrote them as
    // if 1 meant "yes, it is X", and a disease table filed Streptococcus and
    // TB under "Does not cause disease" against its own explanation. A name
    // cannot be read backwards. Numbers are still taken.
    const columnOf = (c: unknown): number => {
      if (typeof c === 'number') return Number.isInteger(c) ? c : NaN
      const name = String(c ?? '').trim().toLowerCase()
      if (/^\d+$/.test(name)) return Number(name)
      return categories.findIndex((cat: string) => cat.trim().toLowerCase() === name)
    }
    const correct = (Array.isArray(raw.correct_category) ? raw.correct_category : []).map(columnOf)
    // `Number.isInteger` as well as the range: a name that matched nothing
    // used to become NaN, which passes both comparisons below.
    if (correct.length !== items.length || correct.some((c: number) => !Number.isInteger(c) || c < 0 || c >= categories.length)) {
      return null
    }
    return { ...base, kind: 'categorize', categories, items, correct_category: correct, marks: items.length }
  }

  if (kind === 'fill_blank') {
    const template = String(raw?.template || raw?.question || '').trim()
    const blanks = (Array.isArray(raw.blanks) ? raw.blanks : [])
      .map((b: any, i: number) => ({
        id: String(b?.id ?? i),
        correct: String(b?.correct ?? '').trim(),
      }))
      .filter((b: { id: string; correct: string }) => b.correct)
    const bank = (Array.isArray(raw.word_bank) ? raw.word_bank : []).map(String).filter(Boolean)
    if (blanks.length < 2 || !template.includes('{{')) return null
    for (const b of blanks) {
      if (!bank.some((w: string) => w.toLowerCase() === b.correct.toLowerCase())) bank.push(b.correct)
    }
    return { ...base, kind: 'fill_blank', template, blanks, word_bank: bank, marks: blanks.length }
  }

  if (kind === 'true_false') {
    const statements = (Array.isArray(raw.statements) ? raw.statements : []).map(String).filter(Boolean)
    let answers = (Array.isArray(raw.correct_answers) ? raw.correct_answers : []).map((v: unknown) => Boolean(v))
    if (statements.length < 3) return null
    if (answers.length !== statements.length) return null
    return { ...base, kind: 'true_false', statements, correct_answers: answers, marks: statements.length }
  }

  if (kind === 'multi_select') {
    const options = (Array.isArray(raw.options) ? raw.options : []).map(String).filter(Boolean)
    let indices = (Array.isArray(raw.correct_indices) ? raw.correct_indices : []).map(Number)
      .filter((i: number) => i >= 0 && i < options.length)
    if (options.length < 4 || indices.length < 2) return null
    indices = [...new Set(indices)]
    return { ...base, kind: 'multi_select', options, correct_indices: indices, marks: options.length }
  }

  if (kind === 'odd_one_out') {
    const items = (Array.isArray(raw.items) ? raw.items : []).map(String).filter(Boolean)
    if (items.length < 4) return null
    let idx = Number(raw.correct_index)
    if (!Number.isFinite(idx) || idx < 0 || idx >= items.length) return null
    return { ...base, kind: 'odd_one_out', items, correct_index: idx, marks: 1 }
  }

  return null
}

export function isInteractiveQuestion(q: any): q is InteractiveQuestion {
  return String(q?.type || '').toLowerCase() === 'interactive' && normalizeInteractiveQuestion(q) !== null
}

export function countSplit(
  total: number,
  mode: 'interactive' | 'study_mixed',
): { interactive: number; mcq: number } {
  if (mode === 'interactive') return { interactive: total, mcq: 0 }
  const interactive = Math.ceil(total * 0.5)
  return { interactive, mcq: total - interactive }
}
