import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelCommandOutput } from '@aws-sdk/client-bedrock-runtime'
import { withUsageTracking } from '@/lib/ai-usage-recorder'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { jsonrepair } from 'jsonrepair'
import { db } from '@/lib/db'
import { isMissingColumn } from '@/lib/pg-errors'
import { intArrayParam, jsonbParam } from '@/lib/pg-json'
import { BEDROCK_CREDENTIALS_ERROR, getBedrockCredentials, getBedrockRegion } from '@/lib/aws-config'
import { authorityForCurriculum, isExamPrepCurriculumNumeric } from '@/lib/curriculum-registry'
import { normalizeCountry } from '@/lib/countries'
import { getNigeriaCurriculumContext, type NigeriaLevel } from '@/lib/nigeria-curriculum'
import { examPrepContext } from '@/lib/nigeria-exam-syllabi'
import { getCachedExamPaperById, isCachePaperId } from '@/lib/exam-source-cache'
import { attachSourceImages, examFromCurriculum } from '@/lib/exam-source-images'
import { groupQuestionsByFigure } from '@/lib/assessment-figure-groups'
import { cleanQuestionPaper } from '@/lib/assessment-quality'
import { judgeImageQuestion } from '@/lib/image-question-quality'
import { buildSource } from '@/lib/question-source'
import { buildCommandWordBlock } from '@/lib/command-words'
import { buildSubjectGenreBlock } from '@/lib/subject-genres'
import type { CurriculumSlug } from '@/lib/curriculum-registry'
import { repairPaper, stripImageKeysFromPaper } from '@/lib/inline-options'
import { dropDanglingReferences, danglingReference } from '@/lib/dangling-reference'
import { subjectGuidance } from '@/lib/subject-guidance'
import { dropUnmarkable } from '@/lib/unmarkable'
import { dropUnanswerable } from '@/lib/answerable'
import { tidyPaper } from '@/lib/paper-tidy'
import { figureAllowedOnPaper, isExamFigure } from '@/lib/figure-provenance'
import { buildFigureSpecPrompt, drawFromReply, questionNamesUndrawn, questionLeaksInstructions, worthDrawing, nounForKind, type DrawnFigure } from '@/lib/figure-request'
import { drawnFigureForFocus, drawnFigureCount } from '@/lib/drawn-figures'
import { questionInventsItsOwnText, namesAbsentFromPassage, passageBorrowsAKnownWork } from '@/lib/passage-question-match'
import { figureNoun } from '@/lib/figure-noun'
import { figureMismatchReasons } from '@/lib/figure-question-match'
import { figuresForFoci } from '@/lib/checkpoint-figures'
import { buildExamPaperPrompt, examCommandsFor, type ExamPartSpec } from '@/lib/exam-paper-prompt'
import { repairBookReferences } from '@/lib/book-reference'
import { tagTokens } from '@/lib/tag-tokens'
import {
  attachImagesFromCatalog,
  buildVisualCatalogPromptBlock,
  buildVisualFigureCatalog,
  buildVisualFigureCatalogForTopics,
  maxQuestionsWithImages,
  type VisualFigureCatalogEntry,
} from '@/lib/textbook-vision-images'
import { isSchoolCurriculum, textbookHasImages } from '@/lib/textbook-source-images'
import { getUniversityCurriculumContext } from '@/lib/university-curriculum'
import {
  excerptFromTextbookSource,
} from '@/lib/language-assessment-plan'
import {
  assessSubjectPassagePlan,
  buildSubjectPassagePrompt,
  buildSubjectSourceQuestionPrompt,
  buildSubjectTopicAlignmentRules,
  classifySubjectDomain,
  isMisalignedQuestion,
  passageHintForSubject,
  type SubjectDomain,
} from '@/lib/subject-assessment-plan'
import {
  assertSubscriptionAccess,
  incrementFreeAssessmentUsage,
  subscriptionPaywallBody,
} from '@/lib/subscription-server'
import {
  buildInteractiveGenerationRules,
  buildInteractiveSchemaBlock,
  countSplit,
  interactiveProfileForSubject,
  normalizeInteractiveQuestion,
} from '@/lib/interactive-assessment-plan'
import type { AssessmentQuestionType } from '@/types/interactive'
import { checkRateLimit, identify } from '@/lib/rate-limit'
import { attachLongformHints } from '@/lib/longform-hints'

// Heavy AI route: needs the Node runtime (AWS SDK + pg) and the full function
// budget. Bedrock call budgets above are tuned to return within this window.
export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_DIAGRAMS = 6
const MAX_SOURCE_CHARS = 12000
const MAX_EXAM_SOURCE_CHARS = 32000

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids = value.map((v) => Number(v)).filter((v) => Number.isFinite(v))
  return Array.from(new Set(ids))
}

// ── Per-question subtopic tagging ─────────────────────────────────────────────
// Map each generated question to the subtopic it best fits, so the StudyLab
// Learning Gap Map can record real per-subtopic mastery (and cascade up into
// topic/subject mastery). Done locally — NO extra AI call, so no extra credits.

interface TaggableSubtopic { id: number; name: string; topic_id: number | null; tokens: Set<string> }

// Assign each question a subtopic_id + topic_id from the candidate list. Uses
// keyword overlap with the subtopic name; falls back to round-robin so coverage
// is always distributed rather than dumped onto one subtopic.
function tagQuestionsWithSubtopics(
  questions: any[],
  subtopics: Array<{ id: number; name: string; topic_id: number | null }>
): number[] {
  if (!Array.isArray(questions) || questions.length === 0 || subtopics.length === 0) return []
  const candidates: TaggableSubtopic[] = subtopics.map((s) => ({ ...s, tokens: new Set(tagTokens(s.name)) }))
  const used = new Set<number>()
  let rr = 0
  for (const q of questions) {
    const qText = `${q?.question ?? ''} ${(Array.isArray(q?.options) ? q.options.join(' ') : '')} ${q?.explanation ?? ''}`
    const qTokens = new Set(tagTokens(qText))
    let best: TaggableSubtopic | null = null
    let bestScore = 0
    for (const c of candidates) {
      let score = 0
      for (const tok of c.tokens) if (qTokens.has(tok)) score += 1
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    // A keyword hit is a finding. So is a single candidate — if the student
    // asked for exactly one subtopic, every question is from it and saying so
    // is not a guess. Round-robin across several is neither.
    const matched = (bestScore > 0 && best) || candidates.length === 1
    const chosen = bestScore > 0 && best ? best : candidates[rr++ % candidates.length]
    q.subtopic_id = chosen.id
    q.topic_id = chosen.topic_id ?? null
    // Round-robin is a fair way to spread untagged questions across areas for
    // scoring, but it is an assignment, not a finding. Only a real match may
    // be shown to the student as where the question came from.
    q.topic_label_matched = matched
    // Readable counterpart to subtopic_id. The review page groups a finished
    // attempt into named weak areas, and it only has questions_data to work
    // from — an id alone would force a lookup the results page cannot do.
    q.topic_label = chosen.name
    used.add(chosen.id)
  }
  return [...used]
}

/**
 * Label each question with the topic it came from, by name only.
 *
 * The fallback for quizzes with no curriculum rows behind them — a
 * self-directed "quiz me on anything", or any request that arrived as bare
 * topic strings. Without this those attempts reach the review page with no
 * areas at all, and the student is offered a score with nothing to act on.
 */
function tagQuestionsWithTopicLabels(questions: any[], topics: string[]): void {
  const names = topics.map((t) => String(t ?? '').trim()).filter(Boolean)
  if (!Array.isArray(questions) || questions.length === 0 || names.length === 0) return

  const candidates = names.map((name) => ({ name, tokens: new Set(tagTokens(name)) }))
  let rr = 0
  for (const q of questions) {
    if (!q || typeof q !== 'object' || q.topic_label) continue
    const qTokens = new Set(
      tagTokens(`${q?.question ?? ''} ${Array.isArray(q?.options) ? q.options.join(' ') : ''} ${q?.explanation ?? ''}`),
    )
    let best: { name: string; tokens: Set<string> } | null = null
    let bestScore = 0
    for (const c of candidates) {
      let score = 0
      for (const tok of c.tokens) if (qTokens.has(tok)) score += 1
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    // Round-robin when nothing overlaps, so coverage stays spread across the
    // requested topics rather than collapsing onto whichever matched first.
    q.topic_label = bestScore > 0 && best ? best.name : candidates[rr++ % candidates.length].name
    // Citable only when it was found, or when there was only ever one topic
    // to find. See the note in tagQuestionsWithSubtopics.
    q.topic_label_matched = (bestScore > 0 && best) || candidates.length === 1
  }
}

// Detect model refusals before attempting JSON parse
const REFUSAL_PREFIXES = ["i can't", "i cannot", "i'm sorry", "i am sorry", "as an ai", "i'm not able", "i am not able", "sorry, i"]
function isRefusal(text: string): boolean {
  const lower = text.trimStart().toLowerCase()
  return REFUSAL_PREFIXES.some(p => lower.startsWith(p))
}

// Robust JSON parser: try native → jsonrepair → aggressive \u fix → throw
function parseJsonRobust(text: string): any {
  // Strip markdown fences
  let t = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  // Extract first {...} block if there's leading noise
  if (!t.startsWith('{')) { const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0] }

  // 1. Try native parse first (fastest path)
  try { return JSON.parse(t) } catch { /* fall through */ }

  // 2. jsonrepair — handles unescaped quotes, bad escapes, trailing commas, etc.
  try { return JSON.parse(jsonrepair(t)) } catch { /* fall through */ }

  // 3. Fix invalid \uXXXX sequences (e.g. LaTeX \underline, \upsilon produce \u + non-hex
  //    which breaks both JSON.parse and sometimes jsonrepair) then retry jsonrepair.
  try {
    const reFixed = t.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    return JSON.parse(jsonrepair(reFixed))
  } catch { /* fall through */ }

  throw new SyntaxError(`Could not repair JSON. Preview: ${t.slice(0, 120)}`)
}

function normalizeSourceText(value: unknown, maxChars = MAX_SOURCE_CHARS): { text: string; truncated: boolean } {
  const raw = typeof value === 'string' ? value : ''
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { text: '', truncated: false }
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false }
  return { text: cleaned.slice(0, maxChars), truncated: true }
}

function fixLatexInRawJson(raw: string): string {
  // Strategy: parse character-by-character inside JSON string values only,
  // replacing any backslash that doesn't form a valid JSON escape sequence.
  // Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
  const VALID_AFTER_SLASH = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])
  let out = ''
  let inString = false
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      i++
    } else {
      if (ch === '\\') {
        const next = raw[i + 1]
        if (next === undefined) { out += '\\\\'; i++; continue }
        if (next === 'u') {
          // \uXXXX unicode escape — only valid if followed by exactly 4 hex digits.
          // LaTeX commands like \underline, \upsilon, \underbrace start with \u but
          // are NOT valid JSON unicode escapes. Keep \uXXXX as-is; double others.
          const hex = raw.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += ch + next + hex; i += 6
          } else {
            out += '\\\\' + next; i += 2
          }
        } else if (VALID_AFTER_SLASH.has(next)) {
          // Valid escape — keep as-is
          out += ch + next
          i += 2
        } else {
          // Bad escape — double the backslash to make it literal
          out += '\\\\' + next
          i += 2
        }
      } else if (ch === '"') {
        inString = false
        out += ch
        i++
      } else if (ch === '\n' || ch === '\r') {
        // Unescaped newline inside a JSON string — replace with \n
        out += '\\n'
        i++
      } else {
        out += ch
        i++
      }
    }
  }
  return out
}


// ── Grade-level passage specification ────────────────────────────────────────
function gradePassageSpec(grade: number | string | undefined) {
  const g = Number(grade) || 99
  if (g <= 2) return {
    wordTarget: '80–120 words',
    style: 'a very short, simple story or description for young children aged 6–8. Topics: animals, school, family, weather, toys. Short sentences of 5–8 words.',
    vocab: 'ONLY use words a 6–7 year old knows. No words over 2 syllables unless very common (e.g. "happy", "animal"). No metaphors or complex language.',
    minWords: 40,
    maxTokens: 400,
  }
  if (g <= 4) return {
    wordTarget: '150–250 words',
    style: 'a simple passage for 8–10 year olds. Clear, engaging writing. Topics: nature, animals, short adventures, simple history.',
    vocab: 'Simple vocabulary for ages 8–10. Short to medium sentences. No complex literary language.',
    minWords: 70,
    maxTokens: 700,
  }
  if (g <= 6) return {
    wordTarget: '250–350 words',
    style: 'a passage for 10–12 year olds. Some descriptive language allowed. Topics: history, nature, adventure, simplified social issues.',
    vocab: 'Accessible vocabulary for ages 10–12. Medium-length sentences. Some descriptive language is appropriate.',
    minWords: 100,
    maxTokens: 900,
  }
  return {
    wordTarget: '450–650 words',
    style: 'a high-quality literary or non-fiction extract matching CAIE/Cambridge unseen comprehension standards. Prioritise public-domain authors (Dickens, Achebe, Austen, Orwell, etc.) or original literary-quality prose.',
    vocab: 'Rich vocabulary, figurative language, complex sentence structures.',
    minWords: 120,
    maxTokens: 1400,
  }
}

const PASSAGE_PROMPT = (question: string, subject: string, hint: string, grade?: number | string) => {
  const spec = gradePassageSpec(grade)
  const gradeLabel = grade ? `Grade ${grade}` : 'secondary school'
  return `You are creating a reading extract for a ${subject} exam paper for ${gradeLabel} students.

QUESTION THE STUDENT WILL ANSWER: "${question}"
WHAT THE PASSAGE SHOULD BE: ${hint}

Write a reading extract. Requirements:
- EXACTLY ${spec.wordTarget} — do not write more or less
- Style: ${spec.style}
- Vocabulary: ${spec.vocab}
- Natural paragraph breaks (blank line between paragraphs)
- The student MUST be able to answer the question from this text
- ORIGINAL. Invent the people, places and events. Do NOT use characters,
  settings or plots from published books, films or games — no Bilbo, no
  Gandalf, no Hogwarts, no Narnia — and do not reproduce or adapt any existing
  text. An exam board cannot print someone else's story, and neither can this.

Return your response in this EXACT format (no extra text, no markdown):
PASSAGE:
[full passage text here]

SOURCE:
Original passage written for ${gradeLabel} students`
}

function parsePassageResponse(raw: string, minWords = 120): { text: string; source: string } | null {
  const passageMatch = raw.match(/PASSAGE:\s*([\s\S]*?)(?=\nSOURCE:|$)/i)
  const sourceMatch = raw.match(/SOURCE:\s*([\s\S]*?)$/i)
  const text = passageMatch?.[1]?.trim() ?? ''
  const source = sourceMatch?.[1]?.trim() ?? 'Original passage'
  if (text.split(/\s+/).filter(Boolean).length < minWords) return null
  return { text, source }
}

// ── Passage generation via Bedrock ───────────────────────────────────────────
async function generatePassageWithBedrock(
  question: string,
  subject: string,
  hint: string,
  callFn: (prompt: string, maxTokens: number) => Promise<string>,
  grade?: number | string,
  opts?: { topics?: string[]; domain?: SubjectDomain },
): Promise<{ text: string; source: string } | null> {
  try {
    const spec = gradePassageSpec(grade)
    const domain = opts?.domain ?? classifySubjectDomain(subject)
    const subjectPrompt = buildSubjectPassagePrompt({
      domain,
      topics: opts?.topics ?? [],
      hint,
      grade,
    })
    const prompt = subjectPrompt ?? PASSAGE_PROMPT(question, subject, hint, grade)
    const raw = await callFn(prompt, spec.maxTokens)
    return parsePassageResponse(raw, spec.minWords)
  } catch (err) {
    console.error('Bedrock passage generation failed:', err)
    return null
  }
}

// Passage behaviour for language subjects is topic-aware — see lib/language-assessment-plan.ts

// ── Shared-passage hint — describes an anchor passage for a group of questions ─
function sharedPassageHint(groupIdx: number, grade?: number | string): string {
  const g = Number(grade) || 99

  if (g <= 2) {
    const styles = [
      'A very short, simple story about a child and their pet or animal friend — told in short sentences, with everyday words only',
      'A short, simple story about going to school or playing with friends — easy vocabulary, 5–8 word sentences',
      'A brief, simple story about the weather, seasons, or nature — words a 6–7 year old would know',
    ]
    return styles[groupIdx % styles.length]
  }
  if (g <= 4) {
    const styles = [
      'A short adventure story about children exploring nature — clear sentences, simple vocabulary for 8–10 year olds',
      'A simple informational passage about animals or the natural world — accessible language for ages 8–10',
      'A short story about friendship, family, or school life — straightforward vocabulary, short paragraphs',
    ]
    return styles[groupIdx % styles.length]
  }
  if (g <= 6) {
    const styles = [
      'A short passage about a historical event or famous person written for 10–12 year olds — clear, engaging, some descriptive language',
      'A story about a young person facing a challenge or adventure — accessible vocabulary, medium-length sentences, suitable for Grade 5–6',
      'A nature or science passage about an interesting topic (e.g. rainforests, space, wildlife) — informative, clear language for ages 10–12',
    ]
    return styles[groupIdx % styles.length]
  }

  // Secondary / default
  const styles = [
    'A literary fiction extract — opening chapter of a 19th or 20th century novel (Dickens, Hardy, Achebe, Austen or similar), rich in descriptive language, atmosphere and character voice',
    'A non-fiction or argumentative extract — speech, essay or journalistic article (Churchill, Orwell, Mandela, MLK or similar), persuasive in tone with strong rhetorical devices',
    'A literary extract from modern or post-colonial fiction (Achebe, Adichie, Marquez, Morrison or similar) exploring identity, place or conflict through vivid imagery',
    'A nature or travel writing extract, lyrical and descriptive, by a writer such as Gerald Durrell, Annie Dillard or Bruce Chatwin — rich in sensory detail and figurative language',
  ]
  return styles[groupIdx % styles.length]
}

// ── Generate all passages using the shared-passage strategy for large sets ────
// For ≤10 questions: one passage per question.
// For >10 questions: group into anchor passages (1 per 10 Qs).
async function generateAllPassages(
  questions: any[],
  subject: string,
  callFn: (prompt: string, maxTokens: number) => Promise<string>,
  grade?: number | string
): Promise<void> {
  const needsWork = questions.filter(q => !q.passage)
  if (needsWork.length === 0) {
    questions.forEach(q => { delete q.needs_passage; delete q.passage_hint })
    return
  }

  const g = Number(grade) || 99
  const useShared = needsWork.length > 10
  const QS_PER_PASSAGE = 10

  if (useShared) {
    const numPassages = Math.ceil(needsWork.length / QS_PER_PASSAGE)
    const anchorResults = await Promise.all(
      Array.from({ length: numPassages }, (_, gi) => {
        const hint = sharedPassageHint(gi, grade)
        const pivotQ = needsWork[gi * QS_PER_PASSAGE]?.question ?? ''
        const fullHint = `${hint}. The passage must support questions on: ${pivotQ.slice(0, 100)}`
        return generatePassageWithBedrock(pivotQ, subject, fullHint, callFn, grade).catch(() => null)
      })
    )
    needsWork.forEach((q, i) => {
      const anchor = anchorResults[Math.floor(i / QS_PER_PASSAGE)]
      if (anchor) { q.passage = anchor.text; q.passage_source = anchor.source }
      delete q.needs_passage; delete q.passage_hint
    })
  } else {
    const defaultHint = g <= 2
      ? `A very short, simple story using easy words for young children (Grade ${grade})`
      : g <= 4
        ? `A short, clear passage suitable for Grade ${grade} students (ages ${7 + g}–${8 + g})`
        : g <= 6
          ? `An engaging passage suitable for Grade ${grade} students (ages ${9 + g}–${10 + g})`
          : `A rich literary or non-fiction extract directly relevant to: "${(questions[0]?.question ?? '').slice(0, 80)}"`

    const jobs = needsWork.map(q => {
      if (!q.passage_hint) q.passage_hint = defaultHint
      return q
    })
    await Promise.all(
      jobs.map(q =>
        generatePassageWithBedrock(q.question, subject, q.passage_hint, callFn, grade)
          .then((result: { text: string; source: string } | null) => { if (result) { q.passage = result.text; q.passage_source = result.source } })
          .catch(() => null)
      )
    )
    jobs.forEach(q => { delete q.needs_passage; delete q.passage_hint })
  }

  questions.forEach(q => { delete q.needs_passage; delete q.passage_hint })
}

// ── After passages are generated, fix longform questions so they match the actual passage ─
// Problem: questions and model_answers are written BEFORE the passage exists, so they
// can hallucinate features (dialogue, "two characters", specific quotes) that aren't in the passage.
// This step rewrites each longform question's model_answer and marking_criteria using the
// actual passage text, and adjusts the question if it asks about a missing feature.
async function fixupPassageQuestions(
  questions: any[],
  callFn: (prompt: string, maxTokens: number) => Promise<string>
): Promise<void> {
  const toFix = questions.filter((q: any) => q.type === 'longform' && q.passage)
  if (toFix.length === 0) return

  // Group by shared passage so questions sharing a passage are fixed in one API call
  const groups = new Map<string, any[]>()
  for (const q of toFix) {
    const key = (q.passage as string || '').slice(0, 80)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(q)
  }

  await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      const passage = group[0].passage as string
      const qList = group.map((q: any, i: number) =>
        `Q${i}: [${q.marks} marks] ${q.question}`
      ).join('\n')

      const prompt = `You are an exam question editor. The reading passage below was created AFTER the questions, so some questions may reference features that do NOT exist in this passage (e.g. "dialogue" when there is no speech, "two characters" when only one is developed, "symbols" that are not present).

Your job: fix EACH question so it is genuinely answerable from THIS specific passage.

READING PASSAGE:
"""
${passage}
"""

QUESTIONS TO FIX:
${qList}

For EACH question:
1. REWRITE the question if it asks about a feature missing from the passage. Preserve the cognitive skill level (analysis, inference, evaluation) but change the specific focus to match what IS actually in the passage. Suitable focuses include: descriptive language, imagery, characterisation, setting, mood/atmosphere, theme, author\'s purpose, word choice, sentence structure.
2. Write model_answer (80–120 words, a full P.E.E. paragraph). Use ONLY quotations that exist VERBATIM in the passage above — copy exact words from the passage. Never invent or alter quotes.
3. Write marking_criteria (one achievable point per mark) that a student can genuinely meet using only the passage above.

Return ONLY valid JSON — no other text:
{
  "fixups": [
    { "idx": 0, "question": "...", "model_answer": "...", "marking_criteria": ["point 1", "point 2"] },
    { "idx": 1, "question": "...", "model_answer": "...", "marking_criteria": ["point 1", "point 2"] }
  ]
}`

      try {
        const raw = await callFn(prompt, 4800)
        const parsed = parseJsonRobust(fixLatexInRawJson(raw))
        const fixups: any[] = parsed?.fixups ?? []
        fixups.forEach((fix: any) => {
          const q = group[typeof fix.idx === 'number' ? fix.idx : 0]
          if (!q) return
          if (fix.question) q.question = fix.question
          if (fix.model_answer) q.model_answer = fix.model_answer
          if (Array.isArray(fix.marking_criteria) && fix.marking_criteria.length > 0) {
            q.marking_criteria = fix.marking_criteria
          }
        })
      } catch (err) {
        console.error('Passage question fixup failed:', err)
        // Non-fatal — original question/model_answer remain
      }
    })
  )
}

// Bloom's Taxonomy levels: Remember(1) → Understand(2) → Apply(3) → Analyse(4) → Evaluate(5) → Create(6)
const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  beginner: `DIFFICULTY — Beginner (D-level · Bloom's Level 1–2: Remember & Understand):
- Every question must target REMEMBER or UNDERSTAND only.
- Question verbs: define, list, name, identify, recall, state, recognise, describe, explain, summarise, classify.
- Use simple, unambiguous language. Single-concept focus per question.
- No multi-step reasoning, no application to new contexts, no analysis.`,

  average: `DIFFICULTY — Average (C-level · Bloom's Level 2–3: Understand & Apply):
- Questions should target UNDERSTAND and APPLY.
- Question verbs: explain, classify, compare, interpret, solve, demonstrate, calculate, use, show, predict.
- Include straightforward worked examples or standard formula application.
- Avoid pure recall (no "define X" or "state Y") but also avoid complex analysis.`,

  intermediate: `DIFFICULTY — Intermediate (B-level · Bloom's Level 3–4: Apply & Analyse):
- Questions must target APPLY and ANALYSE.
- Question verbs: calculate, solve, differentiate, examine, break down, compare, contrast, organise, investigate, infer.
- Include multi-step problems, scenario-based questions, and questions requiring students to connect concepts.
- No simple recall or definition questions.`,

  advanced: `DIFFICULTY — Advanced (A-level · Bloom's Level 5–6: Evaluate & Create):
- STRICT RULE: NO remember or recall questions whatsoever. Do not ask students to define, list, name, or state facts.
- Every question must target EVALUATE or CREATE exclusively.
- Question verbs: justify, critique, defend, assess, judge, design, construct, formulate, propose, synthesise, hypothesise.
- Questions should require extended reasoning, critical judgement, or the construction of original solutions/arguments.
- Expect precise, nuanced, multi-layered responses with no single correct answer pathway.`,
}

function allowsArithmeticForSelection(subject: string, topics: string[]): boolean {
  const subjectText = (subject || '').toLowerCase()
  const topicText = (topics || []).join(' ').toLowerCase()
  const subjectAllows = /\b(math|mathematics|statistics|physics|chemistry|science|economics|accounting)\b/.test(subjectText)
  const topicAllows = /\b(number|addition|subtraction|multiplication|division|fraction|decimal|percent|percentage|ratio|proportion|equation|algebra|geometry|measure|measurement|length|area|perimeter|volume|angle|graph|chart|data|statistics|probability|time|speed|distance|temperature|money|currency|budget|discount|interest|velocity|acceleration|deceleration|motion|kinematic|displacement|force|momentum|energy|gravity)\b/.test(topicText)
  return subjectAllows || topicAllows
}

function buildTopicAlignmentBlock(params: {
  topics: string[]
  grade?: number | string
  subject?: string
}): string {
  const topicText = (params.topics || []).join(' ').toLowerCase()
  const g = Number(params.grade)
  const rules: string[] = []

  rules.push('Every question must directly target the selected topic names. Do not include unrelated skills or generic arithmetic unless the topic explicitly requires it.')
  if (params.topics.length > 1) {
    rules.push('Cover all selected topics; include at least one question per topic.')
  }

  if (!allowsArithmeticForSelection(String(params.subject || ''), params.topics || [])) {
    rules.push('Do NOT include arithmetic calculation or math word problems. Numbers may appear only as facts (dates, counts, labels) when required by the topic.')
  }

  const isStatistics = /statistic|data|graph|chart|pictograph|table|frequency|tally/.test(topicText)
  if (isStatistics) {
    if (Number.isFinite(g) && g <= 3) {
      rules.push('Statistics (primary): use small data lists or tallies in text and ask most, least, or compare counts. No diagrams or plotting.')
    } else if (Number.isFinite(g) && g <= 6) {
      rules.push('Statistics (upper primary): use small data lists or tables and ask mean, median, mode, or range. No diagrams or plotting.')
    } else {
      rules.push('Statistics (secondary): use data tables or lists to compute or interpret mean, median, mode, range, and variation. Avoid generic arithmetic that is not data-driven.')
    }
  }

  const isProbability = /probab|chance|likelihood/.test(topicText)
  if (isProbability) {
    if (Number.isFinite(g) && g <= 3) {
      rules.push('Probability (primary): use simple language like likely, unlikely, or certain with tiny sample spaces.')
    } else {
      rules.push('Probability: use explicit sample spaces or outcomes and ask for numeric probabilities. No diagrams or drawing.')
    }
  }

  const isGeometry = /geometry|shape|angle|triangle|polygon|circle|area|perimeter|volume/.test(topicText)
  if (isGeometry) {
    rules.push('Geometry and shape: provide all needed measurements in text. Do not require diagrams, drawing, or measurement tools.')
  }

  const isAlgebra = /algebra|equation|expression|inequal|function|linear|quadratic/.test(topicText)
  if (isAlgebra) {
    rules.push('Algebra: focus on symbolic manipulation or solving appropriate to the grade. Avoid word problems that reduce to unrelated arithmetic.')
  }

  const isFractions = /fraction|decimal|percent|ratio|proportion/.test(topicText)
  if (isFractions) {
    rules.push('Number and ratio topics: use correct topic language (fraction, decimal, percent, ratio) in every question.')
  }

  rules.push(...buildSubjectTopicAlignmentRules(String(params.subject || ''), params.topics))

  return `**TOPIC ALIGNMENT (STRICT):**\n- ${rules.join('\n- ')}`
}

// ── Build the main question-generation prompt (Groq — ONE call only) ──────────
function buildPrompt(opts: {
  subject: string
  topics: string[]
  count: number
  startId?: number
  style: string
  curriculumName: string
  curriculumBlock: string
  questionType: AssessmentQuestionType
  hasDiagramSupport: boolean
  difficultyLevel?: string
  grade?: number | string
  sourceText?: string
  sourceName?: string
  visualCatalog?: VisualFigureCatalogEntry[]
  maxImageQuestions?: number
  requirePassagesAll?: boolean
  /**
   * How readily this paper should reach for a figure.
   *
   * 'default' keeps most questions text-only, which is right for a revision
   * quiz. 'exam-paper' is for a mock of a paper that really is full of
   * diagrams, tables and graphs — a Checkpoint component — where the sparse
   * default was the main thing holding the figure count down.
   */
  figureAppetite?: 'default' | 'exam-paper'
  /**
   * Which half of an exam paper this batch is for.
   *
   * Asking one request to decide per question which items are one-mark short
   * answers does not work: measured, the model returns only 2s and 3s and
   * emits `short_answer: {}` without ever filling it. A condition the model
   * can silently skip is not a contract. Each batch now asks for ONE kind.
   */
  paperPass?: 'short' | 'extended'
  /**
   * The exact parts this batch must return, when a batch IS one numbered
   * question. Spelling them out per call is what finally made the model
   * honour per-question marks: asked to apply "one mark means a short answer"
   * across thirty-four questions it returned only 2s and 3s, but handed a list
   * of two or three items with their marks named it complies.
   */
  questionParts?: { part: string | null; marks: number; format: 'short' | 'select' | 'tick' | 'table' | 'written' | 'justify' | 'composition' }[]
  /**
   * The ONE figure this question is built around, chosen server-side.
   *
   * Asking the model to copy an image_key out of a catalogue does not work:
   * it writes "the diagram shows..." and then omits or invents the key, the
   * figure never attaches, and dropDanglingReferences deletes the question for
   * referring to something absent. Three and four questions per paper were
   * going that way. Handing one figure to the batch removes the model from
   * the identifier business entirely.
   */
  assignedFigure?: { description: string; category: string }
}): { prompt: string; estimatedTime: number } {
  const {
    subject, topics, count, startId = 1, style, curriculumName, curriculumBlock, questionType,
    hasDiagramSupport, difficultyLevel, grade, sourceText, sourceName, visualCatalog, maxImageQuestions,
    requirePassagesAll = false, figureAppetite = 'default', paperPass, questionParts, assignedFigure,
  } = opts

  const subjectDomain = classifySubjectDomain(subject)

  // Which kinds of question this request ACTUALLY asks for.
  //
  // Every rule below used to be sent whatever was asked for: a long-form-only
  // request carried 4,239 characters of MCQ answer-integrity rules, and an
  // MCQ-only request carried the long-form model-answer and hint rules. The
  // rules are right; sending them for a question type that is not being
  // generated is what made the prompt 17,000 characters. Measured on the
  // Checkpoint path, that size is what breaks generation.
  const wantsMcq = questionType === 'mcq' || questionType === 'mixed' || questionType === 'study_mixed'
  const wantsLongform = questionType === 'longform' || questionType === 'mixed'

  // What this subject is actually assessed with. Placed in the requirements
  // block below rather than in the curriculum context at the top: the context
  // sits far from anything governing output, and the numbered rules that
  // follow it won the argument every time — six of six maths explanations came
  // back with "the other options do not satisfy the equation".
  const genreBlock = buildSubjectGenreBlock(subjectDomain)
  const subjectNeedsPassage = !sourceText && requirePassagesAll

  // Rules for the subjects that fail in ways the general list cannot reach:
  // Music has nothing to play, Art nothing to look at, Literature no novel in
  // front of the learner, and an early phonics question needs exactly one
  // option to rhyme. Empty for every other subject, so the prompt does not
  // grow where it was already working.
  const subjectRules = subjectGuidance({
    subject,
    grade: typeof grade === 'number' ? grade : Number(grade) || undefined,
    hasPassage: subjectNeedsPassage,
  })

  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : questionType === 'study_mixed' ? countSplit(count, 'study_mixed').mcq : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const interactiveCount = questionType === 'interactive' ? count : questionType === 'study_mixed' ? countSplit(count, 'study_mixed').interactive : 0
  const mcqTime = subjectNeedsPassage ? 4 : 2
  const lfTime = subjectNeedsPassage ? 12 : 8
  const interactiveTime = 4
  const estimatedTime = mcqCount * mcqTime + lfCount * lfTime + interactiveCount * interactiveTime

  const hasVisionFigures = Boolean(visualCatalog?.length)
  const imageQuestionCap = maxImageQuestions ?? maxQuestionsWithImages(count)

  const diagramNote = hasVisionFigures
    ? `FIGURES: Aim for around ${imageQuestionCap} question(s) in this batch using a textbook figure — that is a target, not a ceiling. Set "image_key" to one of the keys listed below, and prefer variety across the available figures. Leave image_key empty only when no figure genuinely fits.`
    : hasDiagramSupport
      ? `DIAGRAMS: When a visual is essential, set "needs_diagram": true. Real past-paper figures are attached automatically from our image library — do NOT describe images for generation. Use for up to ${MAX_DIAGRAMS} questions.`
      : ''

  const imageKeyField = hasVisionFigures ? `,
      "image_key": ""` : ''

  const diagramFields = hasDiagramSupport && !hasVisionFigures ? `,
      "needs_diagram": false,
      "diagram_hint": ""` : ''

  // IMPORTANT: we only ask for a short passage_hint here — the full passage is generated
  // separately by Gemini, not by this Groq call. This keeps the Groq output small.
  const passageNote = subjectNeedsPassage
    ? `PASSAGES: Every question MUST have a reading passage. Add needs_passage and passage_hint fields. Passage style must match ${subject} — not generic unrelated fiction.`
    : subjectDomain === 'language'
      ? `PASSAGES: Do NOT add needs_passage or passage_hint unless the topic is comprehension/literary analysis. Skill topics (${topics.slice(0, 3).join(', ') || 'selected topics'}) use standalone questions with short inline examples only.`
      : ['science', 'math', 'technology'].includes(subjectDomain)
        ? `PASSAGES: Do NOT add passages. ${subject} questions must be fully self-contained with all data in the question text.`
        : `PASSAGES: Do NOT add needs_passage unless the question genuinely requires a source extract. Default to direct syllabus questions about ${topics.slice(0, 3).join(', ') || subject}.`

  // Keep model_answer SHORT here — it only needs to outline the key points (full model answers are heavy on tokens)
  const mcqSchema = `{
      "id": <number>,
      "type": "mcq",
      "question": "<question directly about the passage or topic>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_answer": <0-3>,
      "explanation": "<clear explanation of the correct answer>"${diagramFields}${imageKeyField}${subjectNeedsPassage ? `,
      "needs_passage": true,
      "passage_hint": "<30-40 word description of the passage>"` : ''}
    }`

  const lfSchema = `{
      "id": <number>,
      "type": "longform",
      "question": "<analytical question requiring extended writing>",
      "marks": <integer 4-8>,
      "marking_criteria": [
        "<criterion 1 — one mark point per entry>",
        "<criterion 2>",
        "..."
      ],
      "hints": [
        "<exactly ONE comprehensive hint for the whole question — how to structure the answer from THIS question's demands. Never one line per criterion. Never the mark, key fact, quote, or model answer>"
      ],
      "model_answer": "<concise 80-120 word outline of a top answer using P.E.E structure>",
      "explanation": "<why the answer is right, written TO the student>"${imageKeyField}${subjectNeedsPassage ? `,
      "needs_passage": true,
      "passage_hint": "<30-40 word description — different author/genre from other questions>"` : ''}
    }`

  const gradeNum = Number(opts.grade) || 99
  const allowArithmetic = allowsArithmeticForSelection(subject, topics)
  const isPrimaryLow = gradeNum >= 1 && gradeNum <= 2
  const lfMarksRange = isPrimaryLow ? '2-3' : '2-8'
  // An exam paper's written answers are short: measured across the real
  // Checkpoint papers, nothing above 4 marks and most at 2. The 2-8 default
  // is a WASSCE theory range and produces essays where the paper wants a
  // sentence.
  const lfMarksForPaper = figureAppetite === 'exam-paper' ? '1-3' : lfMarksRange
  const lfQuestionDesc = isPrimaryLow
    ? (allowArithmetic
      ? '<simple, one-step word problem aligned to the selected topic. Include "Show your working.">'
      : '<simple, one-step question aligned to the selected topic. Do NOT ask for calculations or "Show your working.">')
    : '<question requiring an extended written answer>'
  // A one-mark answer carries the key it is marked against. Without this in
  // the SCHEMA the model never emits one, whatever the instructions say --
  // the schema is the contract, and a field absent from it does not exist.
  // Required on a short pass, absent on an extended one. Never optional:
  // offered as optional it came back as `short_answer: {}` on every question.
  const wantsKeys = paperPass === 'short' || (questionParts?.some((p) => p.format === 'short') ?? false)
  const shortAnswerField = wantsKeys
    ? `
      "short_answer": { "accepted": ["<the answer, plus every other form a marker would accept>"], "numeric": <true only for a number>, "unit": "<only when the answer has a unit, else omit>" },`
    : ''
  const lfSchemaNoPassage = `{
      "id": <number>,
      "type": "longform",
      "question": "${lfQuestionDesc}",
      "marks": <${paperPass === 'short' ? 'always exactly 1' : `integer ${lfMarksForPaper}`}>,${shortAnswerField}
      "marking_criteria": ["<criterion 1>", "<criterion 2>", "..."],
      "hints": ["<exactly ONE comprehensive hint for the whole question — structure guidance from this question, never the answer>"],
      "model_answer": "<80-120 word outline of a strong answer>",
      "explanation": "<why a strong answer earns the marks, written TO the student>"
    }`

  const activeLfSchema = subjectNeedsPassage ? lfSchema : lfSchemaNoPassage

  let questionsBlock = ''
  let questionInstruction = ''

  const lfInstructionMarks = isPrimaryLow ? '2–3 marks each' : '4–8 marks each'
  const interactiveProfile = interactiveProfileForSubject(subject)
  const interactiveSchema = buildInteractiveSchemaBlock(interactiveProfile.kinds)
  const interactiveRules = buildInteractiveGenerationRules(subject, topics)

  if (questionType === 'mcq') {
    questionInstruction = `Generate exactly ${count} multiple-choice questions.${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres.` : ''}`
    questionsBlock = `    ${mcqSchema}`
  } else if (questionType === 'longform') {
    questionInstruction = `Generate exactly ${count} long-form questions (${lfInstructionMarks}, one criterion per mark).${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres across the set.` : ''}`
    questionsBlock = `    ${activeLfSchema}`
  } else if (questionType === 'interactive') {
    questionInstruction = `Generate exactly ${count} INTERACTIVE STUDY questions (type "interactive"). Use a mix of kinds — do NOT generate MCQ or long-form.`
    questionsBlock = `    ${interactiveSchema}`
  } else if (questionType === 'study_mixed') {
    questionInstruction = `Generate exactly ${count} questions: ${mcqCount} MCQ (type "mcq") and ${interactiveCount} interactive (type "interactive") in a logical mixed order. Do NOT generate long-form questions.`
    questionsBlock = `    ${mcqSchema},
    ${interactiveSchema}`
  } else if (figureAppetite === 'exam-paper') {
    // An exam paper is written answers end to end. Counted across the real
    // Checkpoint papers, the A/B/C/D that appear are labels on diagrams --
    // "name the root cell labelled A" -- and not answer options, so asking
    // for 60% multiple choice produced a quiz wearing a syllabus code.
    questionInstruction = questionParts && questionParts.length > 0
      ? [
          `This is ONE numbered exam question with ${questionParts.length} part${questionParts.length === 1 ? '' : 's'}.`,
          questionParts.length > 1
            ? 'Write ONE short scenario sentence — a situation, a measurement, something a named student did — and BEGIN EVERY part with that same sentence, so each part can be read on its own. Under 20 words.'
            : 'Ask it directly; it has no scenario and no parts.',
          // Whether a figure may be mentioned depends entirely on whether one
          // is on offer. Said flatly, "there is no figure" stopped the phantom
          // diagrams and then went on to forbid the real ones too, and a paper
          // came back with a catalogue of figures available and none used.
          assignedFigure
            ? `THIS QUESTION HAS A ${figureNoun(assignedFigure.category, assignedFigure.description).toUpperCase()} printed beside it, which the learner can see. For your information only, it shows: ${assignedFigure.description}
- Refer to it as "the ${figureNoun(assignedFigure.category, assignedFigure.description)}" and ask a question ABOUT it.
- Do NOT restate what it shows. "The diagram shows a circuit with a battery and two lamps. Name the component..." tells the learner what they are looking at and wastes the figure. Write "Look at the diagram. Name the component labelled A." instead.
- Do NOT write an image_key. It is already attached.`
            : 'The scenario must NEVER mention a diagram, picture, graph or table. There is no figure: a question about something the learner cannot see is unanswerable and gets deleted. Describe the situation in words instead, in a sentence you write yourself about the topic and subject of THIS question. Do not reuse a situation from anywhere else in this paper.',
          `EVERY question must ASK something. A sentence that only sets a scene -- "A train travels 150 km in 3 hours." -- is not a question: the learner gets an answer box, a mark allocation and nothing to answer. Scenario first, then the demand.
Return exactly ${questionParts.length} questions, in this order, all type "longform". The "marks" value of each is FIXED below — copy it exactly, do not choose your own:`,
          ...questionParts.map((p, i) => {
            const label = p.part ? `(${p.part})` : `${i + 1}.`
            return p.format === 'short'
              ? `${label} "marks": 1 exactly. A SHORT ANSWER — the answer is one word, a short phrase or a number. MUST carry "short_answer" with every acceptable form. No marking_criteria, no model_answer. Open with "Write down", "State", "Name" or "Give". ASK ONE THING — never add "and explain", "and describe" or "give a reason": the answer box takes one word. Under 15 words after the scenario.`
              : `${label} "marks": ${p.marks} exactly. Answered in a sentence or two, with marking_criteria holding exactly ${p.marks} criteria. NO short_answer. Open with "Explain", "Describe" or "Suggest".`
          }),
          'The parts must ask DIFFERENT things about the scenario. Two parts that could take the same answer are one question, not two.',
        ].join(' ')
      : paperPass === 'short'
      ? [
          `Generate exactly ${count} questions, ALL type "longform" and ALL worth exactly 1 mark.`,
          'Every one is a SHORT ANSWER: the answer is a single word, a short phrase, a name or a number — never a sentence.',
          'Open with "Write down", "State", "Name", "Give" or "Complete the sentence". NEVER "Explain", "Describe", "Discuss" or "Compare" — those need a sentence and this is not that question.',
          'Keep the question itself under 15 words. Real exam papers ask "Name the gas produced when magnesium reacts with acid." — one demand, nothing else bolted on.',
          '"short_answer".accepted MUST list the answer and every other form a marker would accept. A question without it cannot be marked.',
          'No marking_criteria, no model_answer, no hints.',
        ].join(' ')
      : [
          `Generate exactly ${count} questions, ALL type "longform", each worth 2 or 3 marks.`,
          'Each is answered in a sentence or two and carries marking_criteria with one criterion per mark.',
          'ONE demand per question. "Compare X. Explain Y." is two questions — ask only the first.',
          'Keep the question under 25 words.',
          'No short_answer on these: they are read and marked, not matched.',
        ].join(' ')
    questionsBlock = `    ${activeLfSchema}`
  } else {
    questionInstruction = `Generate exactly ${count} questions: ${mcqCount} MCQ (type "mcq") and ${lfCount} long-form (type "longform") in a logical mixed order.${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres.` : ''}`
    questionsBlock = `    ${mcqSchema},
    ${activeLfSchema}`
  }

  const difficultyInstruction = difficultyLevel ? (DIFFICULTY_INSTRUCTIONS[difficultyLevel] ?? '') : ''
  const topicAlignment = buildTopicAlignmentBlock({ topics, grade: opts.grade, subject })

  const sourceBlock = sourceText
    ? `SOURCE MATERIAL (${sourceName || 'Uploaded PDF'}):
<<<
${sourceText}
>>>

SOURCE RULES:
- Use ONLY the source material.
- Do NOT add facts that are not present in the source.
- If a selected topic is not covered in the source, skip it.
- If a quote is needed, copy exact words from the source text.
- THE STUDENT CANNOT SEE THIS SOURCE. They answer on a screen that shows your question and nothing else — no book, no page numbers, no chapter headings.
  • NEVER write "page 255", "on page 23", "Figure 28.3", "Table 4.1", "in Unit 9", "see Chapter 7", "of the textbook", or any other pointer into the source.
  • If a question needs a value, a table row, a definition or a described picture from the source, WRITE THAT CONTENT INTO THE QUESTION ITSELF.
  • Never ask about the book's own apparatus — its revision exercises, its summary boxes, its chapter titles. Ask about the subject.`
    : ''

  const g = gradeNum
  let gradeAgeNote = ''
  if (g >= 1 && g <= 2) {
    const numberRule = allowArithmetic
      ? '- NUMBERS: Use numbers 1–20 for addition/subtraction. No multiplication, fractions, or decimals unless explicitly in the topic.'
      : '- NUMBERS: Avoid arithmetic calculations. Use numbers only as labels or simple facts when required by the topic.'
    const longformRule = allowArithmetic
      ? '- LONG-FORM QUESTIONS: For Grade 1–2, long-form questions must be simple word problems ONLY. MAXIMUM 3 marks per long-form question. Do NOT ask children to design games, invent methods, write stories, propose ideas, or do any creative or abstract task. No Bloom\'s levels above "Apply". No "Design", "Propose", "Create", "Suggest", "Explain why", or "Compare" prompts.'
      : '- LONG-FORM QUESTIONS: For Grade 1–2, long-form questions must be short, direct responses aligned to the topic. Do NOT ask for calculations or "Show your working." MAXIMUM 3 marks per long-form question. No abstract or creative prompts.'
    gradeAgeNote = `**GRADE CONTEXT — Grade ${opts.grade} (Ages ${5 + g}–${6 + g}):**
- VOCABULARY: Use ONLY words a ${5 + g}–${6 + g} year old knows. Maximum 2 syllables per word. Avoid academic vocabulary.
- SENTENCE LENGTH: Maximum 8 words per sentence in question text. Keep it short and direct.
${numberRule}
- QUESTION STYLE: Simple, direct questions. No complex sentence structures.
- Do NOT include secondary-school content of any kind.
- MCQ ANSWER UNIQUENESS: For any question about "which group can be divided by N" or "which numbers are multiples of N", you MUST verify that ALL three wrong options each contain at least one number that is NOT divisible/a multiple of N. Do NOT put two or more all-valid groups as options.
- DIVISION QUESTIONS: For division, ONLY ask direct computation questions with single-number options. Do NOT ask "which group shows the correct way to divide X by Y" — this format is ambiguous and must not be used in Grade 1–2.
${longformRule}`
  } else if (g >= 3 && g <= 4) {
    gradeAgeNote = `**GRADE CONTEXT — Grade ${opts.grade} (Ages ${5 + g}–${6 + g}):**
- VOCABULARY: Simple, everyday words suitable for ${5 + g}–${6 + g} year olds. Avoid academic or complex vocabulary. No word should need to be looked up by a typical child this age.
- SENTENCE LENGTH: Keep question sentences under 15 words. Clear, direct phrasing.
- NUMBERS: Use numbers appropriate for Grade ${opts.grade} (basic operations, numbers to 1000, simple fractions if in topic).
- QUESTION STYLE: Clear, concrete questions. Avoid abstract reasoning or overly academic phrasing.
- Do NOT include secondary-school content.`
  } else if (g >= 5 && g <= 6) {
    gradeAgeNote = `**GRADE CONTEXT — Grade ${opts.grade} (Ages ${5 + g}–${6 + g}):**
- VOCABULARY: Accessible vocabulary for ${5 + g}–${6 + g} year olds. Some subject-specific terms are acceptable if they are part of the curriculum topic. Avoid unnecessarily complex or abstract language.
- SENTENCE LENGTH: Medium-length sentences are fine, but keep questions clear and unambiguous.
- NUMBERS: Use numbers and operations appropriate for Grade ${opts.grade} curriculum.
- QUESTION STYLE: Clear questions appropriate for upper primary. Some inference or reasoning is fine, but no university-level analysis.
- Do NOT include secondary-school level content beyond what is in the Grade ${opts.grade} curriculum.`
  } else if (g >= 7) {
    gradeAgeNote = `**GRADE CONTEXT — Grade ${opts.grade}:**
- Use secondary-level depth and terminology appropriate to this grade.
- Avoid primary-style counting or one-step arithmetic questions unless the topic explicitly requires them.
- Prefer multi-step reasoning and topic-specific vocabulary when appropriate.`
  }

  const sessionSeed = Math.floor(Math.random() * 1000000)
  const visualBlock = hasVisionFigures && visualCatalog
    ? buildVisualCatalogPromptBlock(visualCatalog, imageQuestionCap)
    : ''

  const uiConstraints = hasVisionFigures
    ? `**UI CONSTRAINTS (TEXTBOOK FIGURES — VISION-DESCRIBED):**
- Only use image_key values from the AVAILABLE TEXTBOOK FIGURES list.
- Questions with image_key must be answerable from that figure's description alone.
- Do NOT invent diagrams or refer to figures not in the list.
- ${figureAppetite === 'exam-paper'
      ? `USE THE FIGURES. A real exam paper is full of diagrams, tables and graphs, and this one should be too: give a figure to EVERY question whose topic suits one, up to the ${imageQuestionCap} available. Leave image_key empty only where no figure in the list fits the question.
- Each figure belongs to ONE question. Never give the same image_key to two questions, and never write a second question about a figure you have already used — write about the topic you were asked for instead.
- The question must be answerable FROM the figure you attach. A figure the question does not use is worse than no figure: a learner shown a nitrogen cycle and asked about reaction rates has two questions on the page and an answer to neither. If nothing in the list is about your topic, leave image_key empty and write the question in words.`
      : 'Most questions should be text-only (empty image_key).'}
- The figure appears beside the question with no caption and no page number. Refer to it as "the diagram" or "the table shown" — NEVER as "Figure 28.3" or "the diagram on page 286".`
    : hasDiagramSupport
    ? `**UI CONSTRAINTS (EXAM PREP WITH PAST-PAPER SOURCE):**
- Adapt questions from the past-paper reference. MCQ and theory may include diagrams when the source material requires them.
- For diagram-dependent questions, set "needs_diagram": true and a detailed "diagram_hint".
- ROMAN-NUMERAL LISTS: If options refer to (i), (ii), (iii), (iv) or I, II, III, IV, the question text MUST include the full numbered list defining each item (e.g. "I. Reflection\\nII. Dispersion…" or inline "I. Reproducibility II. Sensibility III. … IV. …") BEFORE the options array. Never leave orphan (i)/(ii) or I/II references.
- Do NOT ask students to draw, sketch, or plot unless it is standard WASSCE theory style (describe in words if no diagram).
- Never ask students to measure something on-screen or to use a ruler/protractor.
- The student never sees the paper you adapted from. NEVER carry over its numbering — no "page 4", no "Figure 2(a)", no "in Section B". Restate whatever the question needs.`
    : `**UI CONSTRAINTS (NON-NEGOTIABLE):**
- All questions must be answerable from text alone. If a shape/object is needed, describe it fully in words with quantities.
- Do NOT write any question that depends on a picture/diagram/graph/figure being shown.
- Do NOT reference colors/shading/parts of "this shape" or "this picture".
- NEVER use prompts like "imagine", "as shown above/below", "see the diagram", "look at the picture", or "look at this".
- NEVER cite a page, figure number, chapter or unit ("on page 12", "Figure 3.1", "in Unit 9"). The student has no book in front of them.
- Do NOT ask students to draw, sketch, or plot.
- Never ask students to measure something on-screen or to use a ruler/protractor.`

  const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create a ${style} assessment. [Session: ${sessionSeed}]

${curriculumBlock}
${sourceBlock ? `\n${sourceBlock}\n` : ''}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Total Questions:** ${count}
**Style:** ${style}
${gradeAgeNote ? `\n${gradeAgeNote}\n` : ''}
${difficultyInstruction ? `**${difficultyInstruction}**` : ''}

**Task:** ${questionInstruction}

${topicAlignment}

${visualBlock}

${uiConstraints}

${genreBlock ? `${genreBlock}
` : ''}${subjectRules}
**Requirements:**
0. The subject-specific design rules above override the generic guidance in this list wherever they are more specific. In particular they govern how distractors are built and what an explanation must contain.
1. All questions strictly based on the ${curriculumName} syllabus topics listed above.
2. ${difficultyInstruction || 'Vary difficulty: recall, application, analysis.'}
3. LaTeX math MUST be wrapped in dollar signs: $...$ for inline (e.g. $\\\\frac{1}{x}$, $\\\\sqrt{2}$, $x^2 + y^2$) and $$...$$ for display. This applies in ALL fields including explanations and model_answer. Never write bare LaTeX outside of dollar signs.
${wantsMcq ? `4. MCQ "explanation" field: 100-150 words, addressed TO the student and never to a marker. Cover: (a) why the correct answer is right, with the specific reasoning, evidence or working, (b) why each wrong option is wrong and what misconception leads to it. Open with the reasoning itself — NOT with "This question tests...". Name the answer by its VALUE, never by its letter ("7 is correct because 3 + 4 = 7", never "Option B is correct"): the options get reordered before the student sees them, so a letter written here becomes wrong. Do NOT just restate the question. Write in full sentences.` : ''}
${wantsLongform ? `5. Longform "explanation" field: 40-60 words, addressed TO the student. Describe what a strong answer must include and why those points earn the marks. Do NOT open by naming the skill being assessed — "This question tests inference skills" is written for a marker and tells the student nothing. Longform "model_answer" field: MINIMUM 80 words, MAXIMUM 120 words. Write a full P.E.E. paragraph — Point, Evidence (quote or example), Explanation of effect — that a student could use as a model answer. Do NOT use bullet points.
5b. Longform "hints": exactly ONE string in the array. Write a single comprehensive hint for the whole question: how to structure the answer based on THIS question's wording (both demands if multi-part). Do NOT write one hint per criterion. Do NOT paste or lightly rephrase the question three times. MUST NOT include the key fact, quote, formula, or any sentence from model_answer.` : ''}
6. Question "id" fields: number from ${startId} to ${startId + count - 1}.
${questionType !== 'longform' || hasDiagramSupport ? `7. ${diagramNote || 'N/A'}` : ''}
8. ${passageNote}
${questionType === 'interactive' || questionType === 'study_mixed' ? `\n**INTERACTIVE STUDY (type "interactive"):**\n${interactiveRules}\n- Interactive "explanation" field: 40-80 words explaining the correct answers.\n- Do NOT add passages to interactive questions.\n` : ''}
${wantsMcq ? `**MCQ ANSWER INTEGRITY — NON-NEGOTIABLE:**
- Every MCQ must have EXACTLY ONE correct answer among the four options.
- The "correct_answer" field is a 0-based index (0=first option, 1=second, 2=third, 3=fourth). It MUST point to the option that is the ONLY correct answer.
- BEFORE writing each MCQ, mentally verify: "Is options[correct_answer] the one and only correct answer?" If not, rewrite.
- NEVER write a question where two or more options could both be correct. For number-bond style questions, include exactly ONE correct bond and make the other three incorrect.
- NEVER write a question where none of the options is correct.
- NEVER generate the same question text twice. Every question in the assessment must test a DIFFERENT concept, fact, or calculation. Vary the numbers, operations, and contexts. Use fresh numbers and scenarios every time.
- Do NOT generate more than ONE ordering/sorting question per assessment. Use other question types for variety.
- Do NOT generate more than ONE number-bond question per assessment. These are repetitive — one is enough.
- Do NOT generate more than TWO basic comparison questions. Vary the question types.
- SKILL VARIETY: Across the full set of ${count} questions, use at least 5 different subskills drawn from the selected topics. Do NOT include subskills outside the topic list. Do NOT repeat the same subskill more than twice in a row.
- For ordering/sorting questions (e.g. "correct order from smallest to largest"): ALL four options must be COMPLETE sequences of every number from the question. The correct sorted sequence MUST be one of the four options. NEVER use a bare number as an option for an ordering question.
- SINGLE CORRECT ANSWER RULE — NON-NEGOTIABLE: Every MCQ must have EXACTLY ONE correct option and THREE definitively wrong options. This applies to ALL question types without exception:
  • Times table / multiples: if asking "which is NOT in the 10 times table?", only ONE option must NOT be a multiple of 10 — the other three MUST all be multiples of 10. NEVER put four multiples of 10 as options for a "not in times table" question.
  • Even/odd questions: only one option should have the opposite parity.
  • Prime/composite: only one option should match or not match the property.
  • Any "which does NOT belong?" or "which IS X?" question: verify each option against the property before writing — three must clearly match the property, one must clearly not (or vice versa).
- CRITICAL: The "question" field must contain ONLY the question text itself. Do NOT include the answer choices "(A) ..., (B) ..., (C) ..., (D) ..." inside the question field. The options go in the "options" array only.
- For sequence/order questions (e.g. "what comes after X"): make the question unambiguous and ensure the answer IS in the options.
- The explanation MUST describe the same answer as correct_answer. They must ALWAYS agree.
- SHARED-PROPERTY TRAP: before writing a "which shape/number/thing has X?" question, check X against EVERY option. If two options both genuinely have X (e.g. "which shape has four right angles?" — a square AND a rectangle do), the question is broken. Either narrow the property until exactly one option qualifies, or change the distractors. NEVER rescue it in the explanation by adding a condition the question never stated.
- EXPLANATION VOICE: write the explanation TO the student, explaining why the right answer is right and why each distractor is wrong. NEVER open by describing what the question tests or assesses — phrases like "This question tests the student's understanding of..." are written for a marker, not a learner, and tell the student nothing.
- NO REPEATED QUESTIONS: every question must ask something genuinely different. Two questions that expect the same answer and differ only in wording (e.g. "which shape has one curved side?" and "which shape has a curved edge?") count as one question and waste the paper. Re-read your set before returning it.
- BANNED QUESTION FORMAT — "which GROUP of numbers can be divided by N / is divisible by N / are multiples of N": This format ALWAYS produces multiple correct answers. You MUST NEVER use it. Instead, ask about a SINGLE number with options where only ONE matches the property.
` : ''}

**CRITICAL: Return ONLY valid JSON. No markdown. No extra text.**

Schema:
{
  "assessment_id": "auto",
  "estimated_time": ${estimatedTime},
  "questions": [
${questionsBlock}
  ]
}

Generate all ${count} questions now. You MUST produce EXACTLY ${count} questions — do not stop early. Number them ${startId} to ${startId + count - 1}.`

  return { prompt, estimatedTime }
}

// ── Passage-first question generation prompt ──────────────────────────────────
// Used when a passage has already been generated. Questions are written ABOUT
// this specific passage, so they can never reference features that don't exist.
function buildPassageBasedPrompt(opts: {
  passage: string
  passageSource: string
  subject: string
  topics: string[]
  count: number
  startId: number
  style: string
  curriculumName: string
  curriculumBlock: string
  questionType: AssessmentQuestionType
  difficultyLevel?: string
  grade?: number | string
}): string {
  const { passage, subject, topics, count, startId, style, curriculumName, curriculumBlock, questionType, difficultyLevel, grade } = opts
  const topicAlignment = buildSubjectTopicAlignmentRules(subject, topics)
  const difficultyInstruction = difficultyLevel ? (DIFFICULTY_INSTRUCTIONS[difficultyLevel] ?? '') : ''

  const isPrimaryGrade = grade && Number(grade) >= 1 && Number(grade) <= 6
  const gradeNote = isPrimaryGrade
    ? `Grade ${grade} students (ages ${5 + Number(grade)}–${6 + Number(grade)}). Use simple, age-appropriate vocabulary.`
    : grade ? `Grade ${grade}` : 'secondary level'

  const mcqSchema = `{ "id": <number>, "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correct_answer": <0-3>, "explanation": "100-150 words explaining why the correct answer is right and why each wrong option is wrong" }`
  const lfSchema = `{ "id": <number>, "type": "longform", "question": "...", "marks": <4-8>, "marking_criteria": ["one point per mark — each must be achievable from this passage"], "hints": ["one comprehensive hint for the whole question — how to structure the answer, never the quote or the mark"], "model_answer": "80-120 words — full P.E.E. paragraph using ACTUAL verbatim quotes from the passage", "explanation": "40-60 words, written TO the student: what a strong answer must include and why those points earn the marks" }`

  const schemaBlock = questionType === 'mcq' ? mcqSchema : questionType === 'longform' ? lfSchema : `${mcqSchema},\n${lfSchema}`
  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const taskLine = questionType === 'mcq'
    ? `Generate exactly ${count} MCQ questions about the passage.`
    : questionType === 'longform'
      ? `Generate exactly ${count} long-form questions about the passage.`
      : `Generate exactly ${count} questions: ${mcqCount} MCQ (type "mcq") and ${lfCount} long-form (type "longform").`

  return `You are an expert exam writer for the ${curriculumName}. Generate questions for a ${style} ${subject} assessment for ${gradeNote}.

${curriculumBlock}

**Curriculum topics:** ${topics.join(', ') || subject}
${topicAlignment.length ? `**Topic rules:**\n- ${topicAlignment.join('\n- ')}` : ''}

━━━ READING PASSAGE ━━━
${passage}
━━━ END OF PASSAGE ━━━

TASK: ${taskLine} Every question MUST be directly and specifically about the passage above.

UI CONSTRAINTS:
- All questions must be answerable from text alone. Do not refer to any missing diagrams, pictures, or figures.
- Do NOT reference any missing diagrams/pictures/figures/graphs.
- Never say "imagine", "as shown", "see the diagram", or "look at the picture".
- Do NOT ask students to draw, sketch, or plot.
- Never ask the student to measure an on-screen line or shape.

━━━ NON-NEGOTIABLE RULES ━━━
1. ONLY ask about features that ACTUALLY EXIST in the passage:
   • No "analyse the dialogue" if there is no speech
   • No "compare two characters" if only one character is developed
   • No "identify symbols/metaphors" unless they are clearly present
   • No "discuss the theme of X" unless X is evidenced in the passage
2. model_answer: use ONLY quotes copied verbatim from the passage. Never invent or paraphrase quotes as if they were quotations.
3. marking_criteria: every point must be achievable by a student who reads only this passage.
3b. hints: exactly one comprehensive hint for the whole question. Guide structure from the question's demands without quoting the passage or restating the criterion.
4. Vary the question skills across the set:
   • Retrieval (find specific stated information)
   • Inference (what is implied / reading between the lines)
   • Language analysis (comment on a specific word, phrase, or sentence)
   • Character / narrator perspective
   • Theme or message (with evidence from the passage)
   • Author's purpose or structure
5. Questions must be specific — not "How does the writer use language?" but "How does the phrase '...' in paragraph 2 create a sense of urgency?"
${difficultyInstruction ? `6. ${difficultyInstruction}` : ''}

Return ONLY valid JSON:
{ "questions": [ ${schemaBlock} ] }

Generate all ${count} questions now. IDs: ${startId} to ${startId + count - 1}.`
}

// ── Strip embedded "(A)/(B)/(C)/(D)" options from question text ──────────────
// The AI sometimes puts "... (A) X, (B) Y, (C) Z, (D) W" directly in the
// question field. This breaks deduplication, rendering, and the bond fixer.
function cleanQuestionTexts(questions: any[]): void {
  for (const q of questions) {
    if (!q.question) continue
    // Remove everything from "(A)" onwards if it looks like appended MCQ options
    q.question = q.question.replace(/\s*[\(\[]\s*[Aa]\s*[\)\]]\s*[\s\S]*$/, '').trim()
    // Replace $?$ (LaTeX-wrapped placeholder) with plain ?
    q.question = q.question.replace(/\$\?\$/g, '?')
  }
}

function normalizeQuestionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// ── UI constraints: filter out questions that require visuals ───────────────
// The UI does not provide diagrams and drawing prompts are disallowed.
// Therefore: remove any question that depends on an external picture/diagram.
function isScienceSubject(subject: string): boolean {
  return /\b(physics|chemistry|biology|science|mathematics|math|computing|computer science|ict)\b/i.test(subject || '')
}

function optionsReferenceRomanNumerals(q: any): boolean {
  const opts = Array.isArray(q?.options) ? q.options.join(' ') : ''
  if (!opts) return false
  if (/\(\s*(?:i{1,3}|iv|v|vi{0,3}|ix|x)\s*\)/i.test(opts)) return true
  if (/\b(?:I{1,3}|IV|V|VI{0,3}|IX|X)\s*,\s*(?:I{1,3}|IV)/.test(opts)) return true
  if (/\b(?:I{1,3}|IV)\s+and\s+(?:I{1,3}|IV)\b/i.test(opts) && /\bonly\b/i.test(opts)) return true
  return false
}

function countRomanDefinitions(question: string): number {
  const paren = question.match(/\(\s*(?:i{1,3}|iv|v|vi{0,3}|ix|x)\s*\)\s+\S+/gi) ?? []
  const lowerDot = question.match(/(?:^|\s)(?:i{1,3}|iv)\.\s+\S+/gi) ?? []
  const upperDot = question.match(/(?:^|\s)(?:I{1,3}|IV|V|VI{0,3}|IX|X)\.\s+\S+/gi) ?? []
  return paren.length + lowerDot.length + upperDot.length
}

function questionDefinesRomanNumerals(question: string): boolean {
  return countRomanDefinitions(question) >= 2
}

function hasOrphanRomanNumeralRefs(q: any): boolean {
  if (!optionsReferenceRomanNumerals(q)) return false
  return !questionDefinesRomanNumerals(String(q?.question ?? ''))
}

function isUnanswerableWithoutVisual(q: any, subject = '', allowDiagrams = false): boolean {
  const question = String(q?.question ?? '').trim()
  if (!question) return true

  // A question with a figure ALREADY ATTACHED is answerable by definition.
  //
  // This check exists to catch a stem promising a picture that does not
  // exist. Once image_url is set the picture does exist, and deleting the
  // question for saying "look at the diagram" throws away exactly the
  // illustrated questions the paper wanted — sixteen of thirty-four in one
  // run, every one of them a question that had its diagram.
  if (typeof q?.image_url === 'string' && q.image_url.trim()) return false

  if (allowDiagrams && q?.needs_diagram === true) return false

  const lower = question.toLowerCase()

  const science = isScienceSubject(subject)
  if (science && /\b(circuit|resistor|force diagram|free-body)\b/i.test(question) && !/\b(imagine|as shown|see the|look at the|this diagram|this figure)\b/i.test(lower)) {
    return false
  }

  if (q?.needs_diagram === true) return !allowDiagrams

  if (hasOrphanRomanNumeralRefs(q)) return true

  // Disallow any draw/plot or imagine prompts entirely.
  if (/\b(draw|sketch|plot|imagine)\b/.test(lower)) {
    return true
  }

  // References to missing figures/diagrams.
  //
  // The verb list matters as much as the noun list. "Using the diagram,
  // compare the current in two different parts of the circuit" shipped with
  // no diagram at all, because every phrasing here was "shown", "see", "look
  // at" or "in the" -- and "using", "from", "according to" and "based on" are
  // how a real paper points at a figure just as often.
  const VISUAL_NOUN = 'diagram|picture|figure|graph|image|photo|illustration|map|chart|table|circuit|apparatus'
  if (new RegExp(
    `\\b(?:as\\s+shown|shown\\s+(?:above|below|here)` +
    `|(?:see|look\\s+at|in|on|from|using|use|read(?:ing)?\\s+off|according\\s+to|based\\s+on)` +
    `\\s+(?:the|this|these|your)\\s+(?:${VISUAL_NOUN})` +
    `|on\\s+the\\s+graph)\\b`, 'i').test(question)) {
    return true
  }

  // Phrases that imply a missing visual even without explicit nouns.
  if (/\b(look\s+at\s+this|look\s+at\s+the|see\s+this|see\s+the)\b/.test(lower)) {
    return true
  }

  // Shape/color prompts that rely on an unseen diagram.
  const hasColor = /\b(shaded|shade|colored|colour|coloured|blue|green|red|yellow|orange|purple|pink|black|white|grey|gray|highlighted|filled)\b/.test(lower)
  const hasShape = /\b(shape|circle|triangle|rectangle|square|polygon)\b/.test(lower)
  const hasPartition = /\b(divided\s+into|split\s+into|partitioned|equal\s+parts)\b/.test(lower)
  if (hasColor && hasShape && !hasPartition) {
    return true
  }
  if (/\bwhich\s+shape\s+(?:shows|has|is)\b/.test(lower) && /\b(half|quarter|third|shaded|shade|colored|colour|coloured)\b/.test(lower)) {
    return true
  }
  if (/\b(this|these)\s+(?:shape|circle|triangle|rectangle|square|polygon)\b/.test(lower) && /\b(part|fraction|shaded|shade|colored|colour|coloured|blue|green|red|yellow)\b/.test(lower)) {
    return true
  }

  // Measuring an on-screen object without an actual provided diagram.
  if (/\b(measure|measurement|length|how\s+long)\b/.test(lower) && /\b(this|the)\s+(line|angle)\b/.test(lower)) {
    return true
  }
  if (/\b(line|angle)\s+(above|below|here)\b/.test(lower) && /\b(measure|measurement|length|how\s+long)\b/.test(lower)) {
    return true
  }

  // Physical-tool requirements (not workable reliably on-screen).
  if (/\b(use|using)\s+(a\s+)?(ruler|protractor)\b/.test(lower)) {
    return true
  }

  return false
}

function isLikelyOffTopicMathQuestion(q: any, subject: string, topics: string[]): boolean {
  // Only skip filtering when the selected subject/topics explicitly allow calculations.
  // The AI prompt already forbids arithmetic on other subjects; this is a narrow backup
  // for obvious primary-style word problems — not cross-subject keyword matching.
  if (allowsArithmeticForSelection(subject, topics)) return false
  const question = String(q?.question ?? '').toLowerCase()
  if (!question) return true

  const hasDigits = /\d/.test(question)
  // Detect arithmetic expressions (e.g., "12 + 7", "9/3"), not unit notation like m/s.
  const hasArithmeticExpression = /\d\s*[+\-*=/]\s*\d/.test(question)
  const arithmeticWords = /\b(add|added|sum|total|altogether|in\s+all|difference|subtract|minus|plus|left|remain|remaining|increase|decrease|multiply|product|times|divide|quotient|share)\b/.test(question)
  const storyPattern = /\bhas\s+\d+.*\b(give|gives|gave|get|gets|got|buy|buys|bought|take|takes|took|lose|loses|lost|more|less)\b.*\bhow\s+many\b/.test(question)
  const howManyTotal = /\bhow\s+many\b/.test(question) && /\b(total|altogether|left|remain|remaining|now|in\s+all|sum)\b/.test(question)

  return (hasDigits && hasArithmeticExpression) || (hasDigits && (arithmeticWords || storyPattern || howManyTotal))
}


// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Ceiling on a paid call. Subscription gating decides whether someone may
    // do this at all; nothing decided how often, so one loop could run up an
    // unbounded bill.
    const limit = checkRateLimit('generate-assessment', identify(body?.user_id, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'You have made a lot of requests. Please wait a little and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }
    const {
      subject,
      topics,
      count,
      style,
      className,
      grade,
      curriculum,
      user_id,
      sourceText: rawSourceText,
      sourceName,
      questionType: requestedQuestionType = 'mcq',
      difficultyLevel,
      aiModel = 'amazon.nova-lite-v1:0',
      customTime,
      textbook_id,
      topic_ids,
      subtopic_ids,
      subtopic_id,
      examPrepContext: rawExamPrepContext,
    } = body

    const questionType: AssessmentQuestionType =
      requestedQuestionType === 'mcq' ||
      requestedQuestionType === 'longform' ||
      requestedQuestionType === 'mixed' ||
      requestedQuestionType === 'interactive' ||
      requestedQuestionType === 'study_mixed'
        ? requestedQuestionType
        : 'mcq'

    const userId = String(user_id ?? '').trim()

    // One id for the whole generation, so every model attempt this request
    // makes — including the fallbacks — groups into a single billable unit in
    // the usage ledger.
    const usageRequestId = randomUUID()
    const usageUserId = userId || null

    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'assessment')
      if (!gate.allowed) {
        return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
      }
    }

    const AWS_REGION = getBedrockRegion()
    const credentials = getBedrockCredentials()
    if (!credentials) {
      return NextResponse.json(
        { error: BEDROCK_CREDENTIALS_ERROR },
        { status: 500 }
      )
    }
    const { accessKeyId, secretAccessKey } = credentials

    const textbookId = Number(textbook_id)
    const topicIds = normalizeIds(topic_ids)
    const subtopicId = Number(subtopic_id)
    const subtopicIds = normalizeIds(subtopic_ids)
    if (subtopicIds.length === 0 && Number.isFinite(subtopicId)) {
      subtopicIds.push(subtopicId)
    }

    const requestedSubject = String(subject ?? '').trim()
    const requestedTopics = Array.isArray(topics) ? topics.map((t: any) => String(t).trim()).filter(Boolean) : []
    const hasSomeTopics = requestedTopics.length > 0 || topicIds.length > 0 || subtopicIds.length > 0

    // ── Textbook lookup (incl. imported past-paper / NERDC source text) ─────
    let textbookName = ''
    let textbookSourceText = ''
    let textbookExamYear: number | null = null
    let textbookExamSubject = ''
    let textbookExam: 'waec' | 'jamb' | null = null
    let textbookCurriculum: number | null = null

    if (Number.isFinite(textbookId)) {
      if (isCachePaperId(textbookId)) {
        const cached = getCachedExamPaperById(textbookId)
        if (cached) {
          textbookName = cached.name
          textbookSourceText = cached.sourceText
          textbookExamYear = cached.year
          textbookExamSubject = cached.subject
          textbookExam = cached.exam
        }
      } else {
        const textbookResult = await db.query(
          `SELECT textbook_id, textbook_name, source_text, exam_year, exam_subject, source_authority, filename, curriculum
           FROM textbooks WHERE textbook_id = $1 LIMIT 1`,
          [textbookId]
        )
        const data = textbookResult.rows[0]

        if (data?.textbook_name) textbookName = String(data.textbook_name)
        if (data?.source_text) textbookSourceText = String(data.source_text)
        if (data && Number.isFinite(data.exam_year)) textbookExamYear = Number(data.exam_year)
        if (data?.exam_subject) textbookExamSubject = String(data.exam_subject)
        if (data) {
          textbookExam = examFromCurriculum(Number(data.curriculum))
          if (Number.isFinite(data.curriculum)) textbookCurriculum = Number(data.curriculum)
        }
        if (data && userId && isExamPrepCurriculumNumeric(data.curriculum)) {
          const profileResult = await db.query('SELECT country FROM users WHERE id = $1 LIMIT 1', [userId])
          const profile = profileResult.rows[0]
          if (normalizeCountry(profile?.country) !== 'NG') {
            return NextResponse.json({ error: 'Exam prep is only available for Nigeria accounts.' }, { status: 403 })
          }
        }
      }
    }

    const curriculumSlugEarly = String(curriculum ?? 'rwanda').toLowerCase()
    const isExamPrepCurriculum = curriculumSlugEarly === 'waec' || curriculumSlugEarly === 'jamb'
    if (!textbookExam && isExamPrepCurriculum) {
      textbookExam = curriculumSlugEarly as 'waec' | 'jamb'
    }
    if (!textbookExamSubject && requestedSubject) {
      textbookExamSubject = requestedSubject
    }
    if (isExamPrepCurriculum && userId) {
      const profileResult = await db.query('SELECT country FROM users WHERE id = $1 LIMIT 1', [userId])
      const profile = profileResult.rows[0]
      if (normalizeCountry(profile?.country) !== 'NG') {
        return NextResponse.json({ error: 'Exam prep is only available for Nigeria accounts.' }, { status: 403 })
      }
    }
    const sourceCharLimit = (isExamPrepCurriculum || curriculumSlugEarly === 'nigeria') && textbookSourceText
      ? MAX_EXAM_SOURCE_CHARS
      : MAX_SOURCE_CHARS
    const effectiveRawSource = rawSourceText || textbookSourceText || ''
    const normalizedSource = normalizeSourceText(effectiveRawSource, sourceCharLimit)
    const sourceText = normalizedSource.text
    const sourceLabel = String(sourceName ?? '').trim() || (textbookName && textbookSourceText ? textbookName : '')
    const hasSourceText = Boolean(sourceText)

    if ((!requestedSubject && !Number.isFinite(textbookId) && !hasSourceText) || (!hasSomeTopics && !hasSourceText) || !count) {
      return NextResponse.json({ error: 'Subject, topics, and count are required' }, { status: 400 })
    }

    // ── DB-driven selection: textbook → topics → optional subtopic ───────────
    let dbTopicNames: string[] = []
    const topicNameById = new Map<number, string>()
    const resolvedSubtopics: Array<{ id: number; name: string; topic_id: number | null }> = []

    if (topicIds.length > 0) {
      try {
        let sql = 'SELECT topic_id, topic, textbook_id FROM topics WHERE topic_id = ANY($1::int[])'
        const values: unknown[] = [topicIds]
        if (Number.isFinite(textbookId)) {
          sql += ' AND textbook_id = $2'
          values.push(textbookId)
        }
        sql += ' ORDER BY topic'
        const topicsResult = await db.query(sql, values)
        const rows = topicsResult.rows ?? []
        for (const r of rows) {
          if (Number.isFinite(r.topic_id) && r.topic) topicNameById.set(Number(r.topic_id), String(r.topic))
        }
        dbTopicNames = topicIds.map((id) => topicNameById.get(id)).filter(Boolean) as string[]
      } catch (error) {
        console.error('Topics lookup error:', error)
      }
    }

    if (subtopicIds.length > 0) {
      try {
        let sql = 'SELECT subtopic_id, subtopic, topic_id, textbook_id FROM subtopics WHERE subtopic_id = ANY($1::int[])'
        const values: unknown[] = [subtopicIds]
        if (Number.isFinite(textbookId)) {
          sql += ' AND textbook_id = $2'
          values.push(textbookId)
        }
        sql += ' ORDER BY subtopic'
        const subtopicsResult = await db.query(sql, values)
        const rows = subtopicsResult.rows ?? []
        for (const row of rows) {
          if (!Number.isFinite(row?.subtopic_id) || !row?.subtopic) continue
          resolvedSubtopics.push({
            id: Number(row.subtopic_id),
            name: String(row.subtopic),
            topic_id: Number.isFinite(row.topic_id) ? Number(row.topic_id) : null,
          })
        }
      } catch (error) {
        console.error('Subtopic lookup error:', error)
      }
    }

    if (topicIds.length > 0 && dbTopicNames.length === 0 && !hasSourceText) {
      return NextResponse.json(
        { error: 'Selected topics were not found for this textbook. Try re-selecting topics or use manual topic entry.' },
        { status: 400 }
      )
    }

    const fallbackSubject = sourceLabel ? sourceLabel.replace(/\.[^/.]+$/, '') : 'PDF material'
    const promptSubject = textbookName || requestedSubject || fallbackSubject
    const baseTopicNames = dbTopicNames.length > 0
      ? dbTopicNames
      : (requestedTopics.length > 0 ? requestedTopics : (hasSourceText ? [fallbackSubject] : []))

    // If subtopics are specified, constrain the prompt to them.
    let promptTopics = baseTopicNames
    if (resolvedSubtopics.length > 0) {
      const ordered = subtopicIds
        .map((id) => resolvedSubtopics.find(s => s.id === id))
        .filter(Boolean) as Array<{ id: number; name: string; topic_id: number | null }>
      promptTopics = ordered.map((st) => {
        const parent = (st.topic_id !== null ? topicNameById.get(st.topic_id) : null) ||
          (baseTopicNames.length === 1 ? baseTopicNames[0] : null)
        return parent ? `${parent} — ${st.name}` : st.name
      })
    }

    const displayTopics = promptTopics

    const curriculumBlockLines: string[] = []
    const audience = className || (grade ? `Grade ${grade}` : '')
    if (audience) curriculumBlockLines.push(`**Target Audience:** ${audience}`)
    if (textbookName) curriculumBlockLines.push(`**Textbook:** ${textbookName}`)
    if (sourceLabel) curriculumBlockLines.push(`**Source Material:** ${sourceLabel}`)
    if (baseTopicNames.length > 0) curriculumBlockLines.push(`**Selected Topics:** ${baseTopicNames.join(', ')}`)
    if (textbookSourceText && textbookExamYear) {
      curriculumBlockLines.push(`**Past Paper Reference:** ${textbookName} (${textbookExamYear})`)
    }
    if (resolvedSubtopics.length > 0) {
      const names = resolvedSubtopics.map(s => `"${s.name}"`).join(', ')
      curriculumBlockLines.push(`**Scope Rule:** Focus ONLY on these subtopics: ${names}. Do NOT include questions outside these subtopics.`)
    }
    const curriculumBlock = curriculumBlockLines.join('\n')

    const curriculumSlug = String(curriculum ?? 'rwanda').toLowerCase()
    const isUniversity = curriculumSlug === 'university'
    const curriculumName = isUniversity ? 'University Curriculum (Pilot)' : authorityForCurriculum(curriculumSlug)
    // University years (1-6) must NOT be interpreted as primary-school grades by
    // the difficulty/vocabulary logic — clamp to a high grade for prompt tuning.
    const gradeForPrompt = isUniversity ? 13 : grade
    let enrichedCurriculumBlock = curriculumBlock

    if (isUniversity) {
      enrichedCurriculumBlock = getUniversityCurriculumContext(promptSubject, Number(grade) || 1, promptTopics)
    } else if (curriculumSlug === 'nigeria' && className) {
      enrichedCurriculumBlock = `${getNigeriaCurriculumContext(className as NigeriaLevel, promptSubject, promptTopics)}\n${curriculumBlock}`
    } else if (curriculumSlug === 'waec' || curriculumSlug === 'jamb') {
      const extra = String(rawExamPrepContext ?? '').trim()
      enrichedCurriculumBlock = extra || `${examPrepContext(curriculumSlug, promptSubject, promptTopics)}\n${curriculumBlock}`
    }

    // The board's own command vocabulary. Until now the curriculum picked a
    // textbook and a style string; the words a question is phrased with are
    // taught to students as exam technique, and a question that says "explain"
    // where the board would say "state" trains the wrong habit.
    {
      const commandBlock = buildCommandWordBlock(curriculumSlug as CurriculumSlug, questionType)
      if (commandBlock) enrichedCurriculumBlock = `${enrichedCurriculumBlock}

${commandBlock}`
    }

    const isCambridge = curriculumSlug === 'cambridge'
    // Cambridge Checkpoint practice. Its papers want figures the way the real
    // ones do, which is a different appetite from a revision quiz.
    const isCheckpoint = curriculumSlug === 'checkpoint'
    const isExamPrepMode = curriculumSlug === 'waec' || curriculumSlug === 'jamb'
    const hasTextbookImageLibrary = Number.isFinite(textbookId) && isSchoolCurriculum(textbookCurriculum) && textbookHasImages(textbookId)

    // A self-directed quiz: a typed topic with no curriculum rows behind it, so
    // there is no textbook whose figures we could scope to. Derived rather than
    // taken from the request body so a client cannot opt into the wider,
    // looser figure search for a quiz that does have a textbook. Quizzes built
    // from pasted text are excluded: their figures should come from the text
    // the student supplied, not from an unrelated book.
    const isCustomTopicQuiz =
      !Number.isFinite(textbookId) &&
      topicIds.length === 0 &&
      subtopicIds.length === 0 &&
      !hasSourceText &&
      requestedTopics.length > 0

    const imageTopicFilter = [
      ...promptTopics,
      ...dbTopicNames,
      ...resolvedSubtopics.map((s) => s.name),
    ]

    let visualCatalog: VisualFigureCatalogEntry[] = []
    if (
      hasTextbookImageLibrary &&
      Number.isFinite(textbookId) &&
      !isExamPrepMode &&
      imageTopicFilter.length > 0
    ) {
      try {
        visualCatalog = await buildVisualFigureCatalog({
          textbookId,
          topics: imageTopicFilter,
          questionCount: count,
        })
        if (visualCatalog.length > 0) {
          console.log(
            `Vision catalog: ${visualCatalog.length} figure(s) scoped to [${imageTopicFilter.slice(0, 4).join(', ')}]`,
          )
        }
      } catch (visionErr) {
        console.error('Vision catalog build failed:', visionErr)
      }
    } else if (isCustomTopicQuiz && !isExamPrepMode && imageTopicFilter.length > 0) {
      // Self-directed quiz: no textbook to scope to, so search the whole
      // vision-described library by content instead.
      //
      try {
        // A Checkpoint paper picks a figure PER TOPIC rather than taking the
        // best dozen for the paper as a whole.
        //
        // The pooled search returns figures chosen for the paper, which let the
        // model write several questions about one picture and then write to the
        // picture instead of the syllabus — six illustrated questions drawn
        // from three figures, and "the role of the ampulla in the vestibular
        // system" in a Stage 9 paper. Per topic, every figure belongs to a
        // topic the paper is already committed to asking about, and no two
        // questions can share one.
        visualCatalog = isCheckpoint
          ? await figuresForFoci(imageTopicFilter, maxQuestionsWithImages(count))
          : await buildVisualFigureCatalogForTopics({
              topics: imageTopicFilter,
              questionCount: count,
            })
        if (visualCatalog.length > 0) {
          console.log(
            `Vision catalog (${isCheckpoint ? 'per-topic' : 'library-wide'}): ${visualCatalog.length} figure(s) for [${imageTopicFilter.slice(0, 4).join(', ')}]`,
          )
        }
        // Worth saying out loud: "no figures" and "no APPROVED figures" look
        // identical on the page and have different fixes.
        if (isCheckpoint) console.log(`Approved drawn figures available: ${drawnFigureCount()}`)
      } catch (visionErr) {
        console.error('Library-wide vision catalog build failed:', visionErr)
      }
    }

    const hasVisionFigures = visualCatalog.length > 0
    const hasDiagramSupport = (isExamPrepMode && Boolean(textbookSourceText)) || hasVisionFigures
    const maxImageQuestions = maxQuestionsWithImages(count)
    // Self-directed quizzes name themselves after the topic ("The French
    // Revolution") so the student recognises them in their history — but that
    // string classifies as no domain at all, and worse, an incidental word can
    // classify as the wrong one ("English Premier League" reading as English
    // literature and forcing a comprehension passage). The broad subject is
    // sent separately for classification so display and behaviour can differ.
    const domainHint = String(body?.subjectDomainHint ?? '').trim()
    const subjectDomain = classifySubjectDomain(domainHint || promptSubject)

    const subjectPlan = assessSubjectPassagePlan({
      // Same hint as above: the passage plan is a domain decision, so it must
      // read the broad subject, not the display title. Specificity still
      // reaches it through `topics`.
      subject: domainHint || promptSubject,
      topics: promptTopics,
      count,
      hasSourceText,
    })
    const passageQuestionTarget = subjectPlan.passageQuestionCount
    const directQuestionTarget = subjectPlan.directQuestionCount
    const usePassageFlow =
      subjectPlan.usePassageFlow &&
      questionType !== 'interactive' &&
      questionType !== 'study_mixed'
    const requirePassagesAll = subjectPlan.requirePassageOnAll

    // ── Bedrock client (explicit timeouts + fallback model) ─────────────────
    // IMPORTANT: The AWS SDK will retry requests by default. When the model ID is
    // invalid for the account/region, those retries can make a single call take
    // minutes. We cap attempts and use a 60s budget before falling back.
    const bedrockClient = new BedrockRuntimeClient({
      region: AWS_REGION,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3_000,
        // Keep below the gateway window; the AbortController above enforces the
        // real per-attempt budget. A 70s socket would outlive the 504 by minutes.
        requestTimeout: 25_000,
      }),
      credentials: { accessKeyId, secretAccessKey },
    })

    const PREFIXES = ['eu', 'us', 'ap'] as const

    const stripPrefix = (id: string) => id.replace(/^(us|eu|ap)\./, '')

    const regionPrefix: (typeof PREFIXES)[number] =
      AWS_REGION.startsWith('eu-') ? 'eu' :
        AWS_REGION.startsWith('ap-') ? 'ap' :
          'us'

    function isModelIdError(err: any): boolean {
      const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
      return (
        text.includes('provided model identifier is invalid') ||
        text.includes('invalid model') ||
        text.includes('validationexception') ||
        text.includes('on-demand throughput')
      )
    }

    function buildModelCandidates(seedId: string): string[] {
      const expanded: string[] = []
      const clean = (seedId || '').trim()
      if (!clean) return expanded

      const bare = stripPrefix(clean)
      expanded.push(clean)
      expanded.push(bare)
      // Try the inferred prefix first, then others.
      expanded.push(`${regionPrefix}.${bare}`)
      PREFIXES.forEach((p) => expanded.push(`${p}.${bare}`))

      // Extra safety for known Gemma naming variants.
      if (bare === 'google.gemma-3-27b-it') {
        expanded.push('google.gemma-3-27b-it-v1:0')
        expanded.push(`${regionPrefix}.google.gemma-3-27b-it-v1:0`)
        PREFIXES.forEach((p) => expanded.push(`${p}.google.gemma-3-27b-it-v1:0`))
      }

      if (bare === 'google.gemma-3-12b-it') {
        expanded.push('google.gemma-3-12b-it-v1:0')
        expanded.push(`${regionPrefix}.google.gemma-3-12b-it-v1:0`)
        PREFIXES.forEach((p) => expanded.push(`${p}.google.gemma-3-12b-it-v1:0`))
      }

      return [...new Set(expanded.filter(Boolean))]
    }

    function buildBedrockBody(modelId: string, prompt: string, maxTokens: number): string {
      const m = stripPrefix(modelId)
      if (m.startsWith('amazon.nova')) {
        return JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens, temperature: 0.2 },
        })
      }
      if (m.startsWith('meta.llama')) {
        return JSON.stringify({
          prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
          max_gen_len: maxTokens,
          temperature: 0.2,
        })
      }
      // mistral, google, nvidia, openai on Bedrock
      // Use higher temperature for generation (variety) — grading routes use their own clients
      return JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.7 })
    }

    function extractBedrockText(modelId: string, body: any): string {
      const m = stripPrefix(modelId)
      if (m.startsWith('amazon.nova')) return body?.output?.message?.content?.[0]?.text ?? ''
      if (m.startsWith('meta.llama')) return body?.generation ?? ''
      return body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? body?.outputs?.[0]?.text ?? ''
    }

    async function callBedrock(prompt: string, maxTokens: number): Promise<string> {
      const preferredFromEnv =
        process.env.AWS_GENERATION_MODEL_ID ||
        process.env.AWS_BEDROCK_MODEL_ID ||
        process.env.AWS_MODEL_ID ||
        ''

      const seed = (preferredFromEnv || aiModel) as string
      const candidates = buildModelCandidates(seed)

      // Fallback to a DIFFERENT reliable model (not gemma — see model-id failures
      // in production logs). Nova Micro is the fastest on-demand Bedrock model.
      const FALLBACK_MODEL_ID = 'amazon.nova-micro-v1:0'
      // Budgets MUST fit inside the platform gateway window (~30s) or the client
      // gets a 504 while the function is still patiently waiting. Batches run in
      // parallel, so worst-case wall time ≈ one primary (18s) + one fallback (9s).
      const PRIMARY_CALL_BUDGET_MS = 18_000
      const FALLBACK_CALL_BUDGET_MS = 9_000
      const PER_ATTEMPT_TIMEOUT_MS = 18_000

      const tryModels = async (modelIds: string[], budgetMs: number): Promise<{
        text?: string
        lastErr?: any
        onlyModelIdErrors: boolean
        lastTimeout?: { modelId: string; ms: number } | null
      }> => {
        const started = Date.now()
        let lastErr: any
        let onlyModelIdErrors = modelIds.length > 0
        let lastTimeout: { modelId: string; ms: number } | null = null

        for (const modelId of modelIds) {
          const elapsed = Date.now() - started
          const remaining = budgetMs - elapsed
          if (remaining <= 0) break

          const perAttemptTimeoutMs = Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining)
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), perAttemptTimeoutMs)

          try {
            const cmd = new InvokeModelCommand({
              modelId,
              contentType: 'application/json',
              accept: 'application/json',
              body: buildBedrockBody(modelId, prompt, maxTokens),
            })
            // Every attempt is recorded, including the ones that fail over to
            // the next model id — a fallback that burned tokens still cost
            // money, and a ledger that only sees successes understates the
            // bill by exactly the amount worth knowing about.
            const res = await withUsageTracking(
              {
                modelId,
                feature: 'generate_assessment',
                requestId: usageRequestId,
                userId: usageUserId,
                parseBody: (r: InvokeModelCommandOutput) =>
                  JSON.parse(new TextDecoder().decode(r.body)),
              },
              () => bedrockClient.send(cmd, { abortSignal: controller.signal }),
            )
            const parsed = JSON.parse(new TextDecoder().decode(res.body))
            const text = extractBedrockText(modelId, parsed)
            if (!text?.trim()) throw new Error(`Empty model response from ${modelId}`)
            return { text, onlyModelIdErrors: false }
          } catch (err: any) {
            lastErr = err

            const isAbort = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted')
            if (isAbort) {
              onlyModelIdErrors = false
              lastTimeout = { modelId, ms: perAttemptTimeoutMs }
              console.warn(`Bedrock ${modelId} timed out after ${perAttemptTimeoutMs}ms — trying next model...`)
              continue
            }

            if (isModelIdError(err)) {
              console.warn(`Bedrock ${modelId} failed — trying alternate ID... [${String(err?.name || '')}: ${String(err?.message || '').slice(0, 160)}]`)
              continue
            }

            onlyModelIdErrors = false
            throw err
          } finally {
            clearTimeout(timeout)
          }
        }

        return { lastErr, onlyModelIdErrors, lastTimeout }
      }

      const primary = await tryModels(candidates, PRIMARY_CALL_BUDGET_MS)
      if (primary.text) return primary.text

      const fallbackCandidates = buildModelCandidates(FALLBACK_MODEL_ID)
      if (fallbackCandidates.length > 0) {
        console.warn('Primary model attempts failed or timed out. Falling back to google.gemma-3-12b-it...')
        const fallback = await tryModels(fallbackCandidates, FALLBACK_CALL_BUDGET_MS)
        if (fallback.text) return fallback.text

        let lastErr = fallback.lastErr || primary.lastErr
        const timeoutMeta = fallback.lastTimeout || primary.lastTimeout
        if (timeoutMeta && (lastErr?.name === 'AbortError' || String(lastErr?.message || '').toLowerCase().includes('aborted'))) {
          const e: any = new Error(`Bedrock request timed out after ${timeoutMeta.ms}ms (modelId=${timeoutMeta.modelId}).`)
          e.code = 'BEDROCK_TIMEOUT'
          lastErr = e
        }
        const attemptedModels = Array.from(new Set([...candidates, ...fallbackCandidates]))
        if (primary.onlyModelIdErrors && fallback.onlyModelIdErrors) {
          const e: any = new Error(
            'No valid Bedrock model identifier found for generation in this account/region. ' +
            'Set AWS_GENERATION_MODEL_ID (or AWS_BEDROCK_MODEL_ID) to a model you have access to.'
          )
          e.code = 'MODEL_ID_INVALID'
          e.attemptedModels = attemptedModels
          throw e
        }

        throw lastErr || new Error('All Bedrock model candidates failed.')
      }

      if (primary.onlyModelIdErrors) {
        const e: any = new Error(
          'No valid Bedrock model identifier found for generation in this account/region. ' +
          'Set AWS_GENERATION_MODEL_ID (or AWS_BEDROCK_MODEL_ID) to a model you have access to.'
        )
        e.code = 'MODEL_ID_INVALID'
        e.attemptedModels = candidates
        throw e
      }

      let lastErr = primary.lastErr
      if (primary.lastTimeout && (lastErr?.name === 'AbortError' || String(lastErr?.message || '').toLowerCase().includes('aborted'))) {
        const e: any = new Error(`Bedrock request timed out after ${primary.lastTimeout.ms}ms (modelId=${primary.lastTimeout.modelId}).`)
        e.code = 'BEDROCK_TIMEOUT'
        lastErr = e
      }

      throw lastErr || new Error('All Bedrock model candidates failed.')
    }

    // ── Stage 1: Question skeleton generation ────────────────────────────────
    // Nova Lite has a hard 5120 output-token limit. Smaller batches (5 questions) with a 40%
    // surplus = 7 requested per batch. 7 × 300 tokens ≈ 2100 tokens — well within the limit.
    // This ensures the model can always finish the batch without truncation.
    const BATCH_SIZE = 5

    async function tryGenerateBatch(
      batchCount: number,
      startId: number,
      paperPass?: 'short' | 'extended',
      questionParts?: { part: string | null; marks: number; format: 'short' | 'select' | 'tick' | 'table' | 'written' | 'justify' | 'composition' }[],
      batchTopics?: string[],
      assignedFigure?: { description: string; category: string; localPath: string },
      strandHint?: string,
    ): Promise<any[]> {
      // Request a 40% surplus so even if the model runs short we hit the target count.
      // The surplus is stripped after deduplication.
      // No surplus when the parts are named: asking for extra parts of a
      // question that has two is asking for a different question.
      const requestCount = questionParts?.length ? batchCount : batchCount + Math.ceil(batchCount * 0.4)

      // One exam question gets its OWN prompt, not the general one with an
      // exam-shaped instruction bolted on. The general prompt is 26,600
      // characters here and that is what was breaking generation: the same
      // model is perfect on this task at about 1,200.
      if (questionParts?.length && isCheckpoint) {
        // Draw the figure BEFORE writing the question, so the question can be
        // written against it. The other order -- question first, picture hunted
        // for afterwards -- is where every figure fault in this file came from.
        //
        // Only where the slot wanted a figure anyway, and only for the kinds
        // that can be drawn. Anything else falls through to the library below,
        // which is unchanged.
        let drawn: DrawnFigure | null = null
        const drawFocus = batchTopics?.[0]
        // On the focus alone, NOT on whether the library happened to find
        // something first.
        //
        // Gated behind `assignedFigure` this drew almost nothing: figures are
        // assigned to a handful of slots, and only where a library image
        // shares two words with the topic. A perfectly drawable focus with no
        // library match — which is most of them — never reached the drawing
        // at all. Drawing is the better source, so it is tried on its own
        // merits and the library is what catches what it cannot do.
        // An approved figure first, and no model call at all when there is
        // one. These were drawn in bulk and kept by a person, so they are
        // both cheaper and safer than asking again here -- asking here is how
        // a 10 cm by 10 cm rectangle became the figure for "cell structure
        // and function" without anyone seeing it first.
        const approved = drawFocus
          ? drawnFigureForFocus(drawFocus, { stage: Number(grade) || undefined, seed: startId })
          : null
        if (approved) {
          drawn = {
            svg: approved.svg,
            spec: { kind: approved.kind } as DrawnFigure['spec'],
            labels: approved.labels,
            description: approved.description,
            noun: nounForKind(approved.kind),
          }
          console.log(`Approved ${approved.kind} for "${drawFocus}"`)
        } else if (drawFocus && worthDrawing(drawFocus, promptSubject)) {
          try {
            const spec = await callBedrock(
              buildFigureSpecPrompt(promptSubject, `Stage ${gradeForPrompt}`, drawFocus),
              420,
            )
            drawn = drawFromReply(spec)
            if (drawn) console.log(`Drew a ${drawn.spec.kind} for "${drawFocus}"`)
          } catch {
            // A picture must never fail the paper. The library still has one.
          }
        }

        const focused = buildExamPaperPrompt({
          subject: promptSubject,
          level: `Stage ${gradeForPrompt}`,
          paperName: String(style || 'exam'),
          focus: batchTopics?.[0] || promptTopics[0] || promptSubject,
          strand: strandHint || promptSubject,
          parts: questionParts as ExamPartSpec[],
          commands: examCommandsFor(promptSubject),
          figure: drawn || !assignedFigure
            ? undefined
            : { description: assignedFigure.description, category: assignedFigure.category },
          drawnFigure: drawn
            ? { description: drawn.description, labels: drawn.labels, noun: drawn.noun }
            : undefined,
          passage: checkpointPassage || undefined,
        })
        const text = await callBedrock(focused, Math.min(2600, 700 + questionParts.length * 550))
        if (isRefusal(text)) throw new Error('Model refused to generate content.')
        const parsed = parseJsonRobust(fixLatexInRawJson(text))
        if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
        // EVERY part carries the figure, not just the first.
        //
        // A real paper prints the diagram once above the whole question and
        // all its parts refer to it; the screen shows one question at a time,
        // so each part needs it. Stamping only the first part meant (b) and
        // (c) repeated a scenario mentioning "the diagram" while having none,
        // and isUnanswerableWithoutVisual deleted them -- sixteen of
        // thirty-four questions in one run.
        // A question that printed the instructions instead of following them.
        // Unusable whatever else is right about it, and the retry loop will
        // write a replacement.
        const leaked = parsed.questions.filter((q: any) => q && typeof q === 'object' && questionLeaksInstructions(q.question))
        if (leaked.length) {
          console.log(`Rejected ${leaked.length} question(s) that copied the prompt into the stem`)
          parsed.questions = parsed.questions.filter((q: any) => !leaked.includes(q))
        }

        // A question about a story nobody wrote.
        //
        // "Clara stumbled upon an ancient oak tree. Write down the name of the
        // woman who guided Clara in the garden." -- asked three times in one
        // paper, about a story the learner was never shown. The prompt already
        // says to ask about THIS text; this checks, because the prompt saying
        // so has not once been enough here.
        if (checkpointPassage) {
          const invented = parsed.questions.filter((q: any) =>
            q && typeof q === 'object' && questionInventsItsOwnText(q.question, checkpointPassage))
          if (invented.length) {
            const names = [...new Set(invented.flatMap((q: any) => namesAbsentFromPassage(q.question, checkpointPassage)))]
            console.log(`Rejected ${invented.length} question(s) naming ${names.slice(0, 5).join(', ')}, who are not in the passage`)
            parsed.questions = parsed.questions.filter((q: any) => !invented.includes(q))
          }
        }

        if (drawn) {
          // A drawn figure is held to its own label list exactly -- it knows
          // what is on it, so this is a check rather than a guess. A question
          // naming something undrawn loses the figure and falls back to the
          // library, which is better than shipping "the part labelled A" over
          // a drawing with no A.
          const offenders = parsed.questions
            .flatMap((q: any) => (q && typeof q === 'object' ? questionNamesUndrawn(q.question, drawn!) : []))
          if (offenders.length) {
            console.log(`Discarded the drawn figure: the question named ${[...new Set(offenders)].join(', ')}, which it does not carry`)
            drawn = null
          }
        }

        for (const q of parsed.questions) {
          if (!q || typeof q !== 'object') continue
          if (drawn) q.diagram_svg = drawn.svg
          else if (assignedFigure) q.image_url = assignedFigure.localPath
        }
        return parsed.questions
      }

      const { prompt } = buildPrompt({
        subject: promptSubject,
        // A per-question batch gets ONLY its own focus. Handed the whole list,
        // sixteen parallel calls converged on whatever was most answerable and
        // six of them wrote about the Arctic hare.
        topics: batchTopics?.length ? batchTopics : promptTopics,
        count: requestCount, startId, style,
        curriculumName, curriculumBlock: enrichedCurriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade: gradeForPrompt,
        sourceText, sourceName: sourceLabel, visualCatalog, maxImageQuestions, requirePassagesAll,
        figureAppetite: isCheckpoint ? 'exam-paper' : 'default', paperPass, questionParts,
        assignedFigure: assignedFigure ? { description: assignedFigure.description, category: assignedFigure.category } : undefined,
      })
      // Nova Lite hard limit is 5120 output tokens. Cap at 4800 to leave JSON-framing headroom.
      // ~300-350 tokens per MCQ question (question + options + explanation).
      // Keep generation snappy: cap tokens more aggressively than the hard limit.
      // A per-question batch writes a scenario, repeats it on every part, and
      // carries marking criteria for the extended ones. At 300 tokens a
      // question that truncates mid-JSON, the batch fails to parse, and its
      // questions are simply missing -- sixteen of thirty-four in one run.
      const perQuestion = questionParts?.length ? 900 : 300
      const maxTokens = Math.min(4200, Math.max(1800, requestCount * perQuestion))
      const text = await callBedrock(prompt, maxTokens)

      if (isRefusal(text)) throw new Error(`Model refused to generate content. Try a different AI model.`)
      const parsed = parseJsonRobust(fixLatexInRawJson(text))
      if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
      // Attach here, not by asking the model for a key. The first part carries
      // the diagram; its siblings repeat the scenario in words and read fine
      // beside it once the paper groups them.
      if (assignedFigure && parsed.questions[0] && typeof parsed.questions[0] === 'object') {
        parsed.questions[0].image_url = assignedFigure.localPath
      }
      return parsed.questions
    }

    // ── Passage-first batch: uses an already-generated passage as context ────────
    // Each question in the result has q.passage and q.passage_source already set.
    async function tryGeneratePassageBatch(
      passage: { text: string; source: string },
      batchCount: number,
      startId: number
    ): Promise<any[]> {
      const requestCount = batchCount + Math.ceil(batchCount * 0.4)
      const sourcePromptOpts = {
        passage: passage.text,
        passageSource: passage.source,
        subject: promptSubject,
        topics: promptTopics,
        count: requestCount,
        startId,
        style,
        curriculumName,
        curriculumBlock: enrichedCurriculumBlock,
        questionType,
        difficultyLevel,
        grade,
      }
      const prompt =
        buildSubjectSourceQuestionPrompt(subjectDomain, {
          ...sourcePromptOpts,
          questionType: questionType as 'mcq' | 'longform' | 'mixed',
        }) ??
        buildPassageBasedPrompt(sourcePromptOpts)
      const maxTokens = Math.min(3800, Math.max(1800, requestCount * 320))
      const text = await callBedrock(prompt, maxTokens)
      if (isRefusal(text)) throw new Error(`Model refused to generate content.`)
      const parsed = parseJsonRobust(fixLatexInRawJson(text))
      if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
      parsed.questions.forEach((q: any) => { q.passage = passage.text; q.passage_source = passage.source })
      return parsed.questions
    }

    // Split count into batches of BATCH_SIZE (used for non-passage subjects)
    //
    // An exam paper is split by KIND first. `shortCount` comes from the
    // blueprint, which already knows how many one-mark items this component
    // has, so no batch ever has to decide -- every question in it is the same
    // kind and the schema for that kind is unconditional.
    type Batch = {
      count: number
      startId: number
      paperPass?: 'short' | 'extended'
      questionParts?: { part: string | null; marks: number; format: 'short' | 'select' | 'tick' | 'table' | 'written' | 'justify' | 'composition' }[]
      batchTopics?: string[]
      strandHint?: string
      assignedFigure?: { description: string; category: string; localPath: string }
    }
    const batches: Batch[] = []

    // An exam paper is generated ONE NUMBERED QUESTION AT A TIME, each with
    // its own focused prompt (lib/exam-paper-prompt.ts).
    //
    // This was tried once against the 26,600-character general prompt and
    // failed the whole paper in two runs of three -- 5, 8 and 10 questions of
    // 34. The cause was measured and it was not the model: Nova Lite is
    // perfect on this exact task at about 1,200 characters, as are Nova Pro,
    // Gemma 3 27B and both Claude models. It was the prompt.
    const slotPlan = Array.isArray(body.paperSlots) ? body.paperSlots : []
    // A reading paper needs its text before it can have questions.
    //
    // English and ESL comprehension is nothing without one, and questions
    // written first and given a passage afterwards are questions about
    // nothing. So the text is generated once, up front, and every question in
    // the paper is written against it -- which is also how a real paper works:
    // one passage, twenty questions on it.
    let checkpointPassage = ''
    // The SERVER decides this, not the client.
    //
    // It used to be `body?.needsPassage === true` alone — a boolean computed
    // in the browser from a component name, which for half the components was
    // `undefined`. When it came back false the paper was generated anyway, and
    // the model, handed comprehension foci and no text, invented a story per
    // question: "Clara stumbled upon an ancient oak tree. Write down the name
    // of the woman who guided Clara in the garden." Three questions of
    // forty-two opened on that same sentence, and the learner was never shown
    // a word of the story any of them asked about.
    //
    // Whether a question can be answered is not a thing to take on trust from
    // a form. Every English and ESL paper gets a text, and so does any paper
    // whose own slots name a reading strand.
    const readingStrandInPlan = slotPlan.some((s: any) =>
      /reading|comprehension/i.test(String(s?.strand ?? '')))
    const languagePaper = /\benglish\b|\besl\b|second language|\bliterature\b/i.test(promptSubject)
    const needsPassage = isCheckpoint && (body?.needsPassage === true || languagePaper || readingStrandInPlan)
    if (isCheckpoint) {
      console.log(
        `Passage decision: subject="${promptSubject}" language=${languagePaper} ` +
        `readingStrand=${readingStrandInPlan} clientFlag=${body?.needsPassage} -> ${needsPassage}`,
      )
    }
    if (needsPassage) {
      // Asked three times at most, because the first answer came back as
      // Bilbo Baggins, Gandalf and Smaug in the Shire. An exam board cannot
      // print someone else's story, and a comprehension text half the class
      // has already read tests nothing anyway.
      let made: { text: string; source: string } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        made = await generatePassageWithBedrock(
          `A reading text for a ${promptSubject} paper at Stage ${gradeForPrompt}.`,
          promptSubject,
          'A complete short text a learner can answer comprehension questions about.',
          callBedrock,
          gradeForPrompt,
          { topics: promptTopics },
        )
        const borrowed = passageBorrowsAKnownWork(made?.text)
        if (!borrowed) break
        console.log(`Reading text used "${borrowed}" — somebody else's story. Asking again.`)
        made = null
      }
      if (made?.text) {
        checkpointPassage = made.text
        console.log(`Checkpoint reading text: ${made.text.split(/\s+/).length} words`)
      } else {
        // Without the text every question would be about something the
        // learner cannot see, which is the one fault this paper must not
        // have. Better to fail the request than to ship that.
        return NextResponse.json(
          { error: 'Could not write the reading text for this paper. Please try again.' },
          { status: 502 },
        )
      }
    }

    if (isCheckpoint && slotPlan.length > 0) {
      const byQuestion = new Map<number, any[]>()
      for (const slot of slotPlan) {
        const q = Number(slot?.q)
        if (!Number.isFinite(q)) continue
        byQuestion.set(q, [...(byQuestion.get(q) ?? []), slot])
      }
      let startId = 1
      for (const [, allParts] of [...byQuestion.entries()].sort((a, b) => a[0] - b[0])) {
        // A ring-around part gets its OWN call.
        //
        // Asked for one among several parts, the model wrote every part as a
        // written answer and the ringed options never appeared -- the same
        // failure as asking one request to decide which questions were short.
        // A call whose whole job is "write one ring-around question" produces
        // one.
        // Every special format gets its OWN call. Asked for among other parts
        // each of them came back as a plain written answer; asked alone, with
        // an object template of its own shape, each comes back right.
        // 'justify' and 'composition' belong here for the same reason and
        // were missing: asked among other parts they came back as plain
        // written answers, and worse, the mapping below had no case for
        // either, so both fell through to 'short'. An English paper's 20-mark
        // composition was being asked for as a one-word answer -- which is
        // why the new formats were nowhere to be seen on the page.
        const SPECIAL = new Set(['select', 'tick', 'table', 'justify', 'composition'])
        const specialParts = allParts.filter((p: any) => SPECIAL.has(String(p?.format)))
        const parts = allParts.filter((p: any) => !SPECIAL.has(String(p?.format)))
        for (const special of specialParts) {
          batches.push({
            count: 1,
            startId,
            questionParts: [{
              part: null,
              marks: Number(special?.marks) || 1,
              format: special?.format as 'select' | 'tick' | 'table' | 'justify' | 'composition',
            }],
            batchTopics: [String(special?.focus || '')].filter(Boolean),
            strandHint: String(special?.strand || ''),
          })
          startId += 1
        }
        if (parts.length === 0) continue
        batches.push({
          count: parts.length,
          startId,
          questionParts: parts.map((p: any) => ({
            part: typeof p?.part === 'string' ? p.part : null,
            marks: Number(p?.marks) || 1,
            format: p?.format === 'written' ? 'written'
              : p?.format === 'select' ? 'select'
              : p?.format === 'tick' ? 'tick'
              : p?.format === 'table' ? 'table'
              : p?.format === 'justify' ? 'justify'
              : p?.format === 'composition' ? 'composition'
              : 'short',
          })),
          // Its own focus, never the whole list. Handed all of them, parallel
          // calls converged -- six questions about the Arctic hare in one paper.
          batchTopics: [...new Set<string>(parts.map((p: any) => String(p?.focus || '')).filter(Boolean) as string[])],
          strandHint: String(parts[0]?.strand || ''),
        })
        startId += parts.length
      }
    }

    const shortWanted = isCheckpoint ? Math.max(0, Math.min(count, Number(body.shortCount) || 0)) : 0
    if (batches.length === 0 && shortWanted > 0) {
      for (let i = 0; i < shortWanted; i += BATCH_SIZE) {
        batches.push({ count: Math.min(BATCH_SIZE, shortWanted - i), startId: i + 1, paperPass: 'short' })
      }
      for (let i = shortWanted; i < count; i += BATCH_SIZE) {
        batches.push({ count: Math.min(BATCH_SIZE, count - i), startId: i + 1, paperPass: 'extended' })
      }
    } else if (batches.length === 0) {
      for (let i = 0; i < count; i += BATCH_SIZE) {
        batches.push({ count: Math.min(BATCH_SIZE, count - i), startId: i + 1 })
      }
    }

    if (isCheckpoint && visualCatalog.length > 0 && batches.some((b) => b.questionParts)) {
      const spare = [...visualCatalog]
      const cap = maxQuestionsWithImages(count)
      let given = 0
      for (const batch of batches) {
        if (given >= cap || spare.length === 0 || !batch.batchTopics?.length) continue
        const focus = batch.batchTopics[0].toLowerCase()
        const words = focus.split(/\s+/).filter((w) => w.length > 3)
        let best = -1
        let bestScore = 0
        spare.forEach((fig, i) => {
          // A figure from another subject is never a match, however many words
          // it shares. Maslow's Hierarchy of Needs, from a Business Studies
          // coursebook, scored two against "human reproduction" -- the
          // pyramid's own caption lists reproduction under physiological
          // needs -- and was printed beside a Stage 9 Science question asking
          // the learner to name "the part labelled A". The description said
          // plainly that it was a psychological theory; nothing read it.
          if (!figureAllowedOnPaper(fig.localPath, promptSubject, Number(grade) || undefined)) return
          // On a Checkpoint paper the exam figure is not merely preferred.
          //
          // Weighting it was the first attempt, and a weighting is a tie
          // break: a textbook illustration that shared four words still beat
          // a purpose-drawn one that shared two, so the crescent Moon
          // cartoon, the cartoon solar system and the stock recycling image
          // kept arriving on papers meant to look like Cambridge's.
          //
          // It is affordable to insist. Of what a Stage 9 paper may reach,
          // 4,940 Science figures and 4,810 Mathematics ones were drawn for
          // an exam; the remainder are photographs and clip art. A slot with
          // no exam figure for its topic is better left with none.
          if (isCheckpoint && !isExamFigure(fig.localPath)) return
          const text = `${fig.description} ${fig.category}`.toLowerCase()
          let score = words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0)
          // A figure drawn FOR an exam beats one that merely sits near the
          // right words in a textbook. The first is purpose-drawn line art
          // with every part labelled -- a ruler, a marble, a container of
          // sand, "before" and "after". The second is a photograph or a stock
          // illustration. Both can score two shared words; only one looks
          // like the paper the learner is sitting.
          //
          // Weighted rather than absolute, so a genuinely better textbook
          // match still wins over a barely-relevant exam figure.
          if (score > 0 && isExamFigure(fig.localPath)) score += 2
          if (score > bestScore) { bestScore = score; best = i }
        })
        // TWO shared words, not one.
        //
        // One was far too loose. The library now holds IGCSE and O Level
        // figures, and a single shared word like "energy" matched a
        // carbocation energy-profile diagram to a Stage 9 question about
        // energy stores -- which the model then wrote to, producing
        // "name the transition state" in a paper for fourteen-year-olds.
        // A figure that does not clearly depict the topic is worse than none.
        if (best < 0 || bestScore < 2) continue
        const [fig] = spare.splice(best, 1)
        batch.assignedFigure = { description: fig.description, category: fig.category, localPath: fig.localPath }
        given++
      }
      if (given > 0) console.log(`Assigned ${given} figure(s) to questions by focus`)
    }

    let allQuestions: any[] = []
    let estimatedTime = 0
    // For passage subjects, we store the generated passages for use in retries
    let generatedPassages: { text: string; source: string }[] = []

    // Helper: deduplicate + validate a list of raw questions in place
    function deduplicateAndFix(qs: any[], existingSeen?: Set<string>): any[] {
      cleanQuestionTexts(qs)

      // Filter out questions that are not workable in this UI.
      const filtered = qs.filter((q: any) => {
        const qType = String(q?.type || '').toLowerCase()

        if (qType === 'interactive') {
          const normalized = normalizeInteractiveQuestion(q)
          if (!normalized) {
            console.warn(`Removed invalid interactive question: "${String(q?.question || '').slice(0, 80)}"`)
            return false
          }
          Object.assign(q, normalized)
          return true
        }

        if (questionType === 'mcq' && qType !== 'mcq') {
          console.warn(`Removed non-MCQ in MCQ-only request: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'longform' && qType !== 'longform') {
          console.warn(`Removed non-longform in longform-only request: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'interactive' && qType !== 'interactive') {
          console.warn(`Removed non-interactive in interactive-only request: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'study_mixed' && qType !== 'mcq' && qType !== 'interactive') {
          console.warn(`Removed invalid question type in study_mixed: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'mixed' && qType !== 'mcq' && qType !== 'longform') {
          console.warn(`Removed invalid question type: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (hasOrphanRomanNumeralRefs(q)) {
          console.warn(`Removed incomplete Roman-numeral question: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (isUnanswerableWithoutVisual(q, promptSubject, hasDiagramSupport)) {
          console.warn(`Removed unanswerable (visual-dependent) question: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (isLikelyOffTopicMathQuestion(q, promptSubject, promptTopics)) {
          console.warn(`Removed off-topic arithmetic question: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (isMisalignedQuestion(q, promptSubject)) {
          console.warn(`Removed misaligned question for ${subjectDomain}: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        return true
      })

      const seenQuestions = existingSeen ?? new Set<string>()
      const deduped = filtered.filter((q: any) => {
        const key = normalizeQuestionKey(String(q?.question || ''))
        if (!key) return false
        if (seenQuestions.has(key)) {
          console.warn(`Duplicate question removed: "${key.slice(0, 60)}"...`)
          return false
        }
        seenQuestions.add(key)
        return true
      })
      return deduped
    }

    try {
      if (usePassageFlow) {
        // ── PASSAGE-FIRST FLOW (full set or partial when mixed with direct topic questions) ──
        const numPassages = Math.max(1, Math.ceil(passageQuestionTarget / 10))
        const questionsPerPassage = Math.ceil(passageQuestionTarget / numPassages)

        const curriculumExcerpt =
          !hasSourceText && textbookSourceText
            ? excerptFromTextbookSource(
                textbookSourceText,
                promptTopics,
                sourceLabel || textbookName || 'Textbook',
              )
            : null

        if (curriculumExcerpt) {
          generatedPassages = [curriculumExcerpt]
        } else {
          const rawPassages = await Promise.all(
            Array.from({ length: numPassages }, (_, i) => {
              const baseHint = passageHintForSubject(subjectDomain, promptSubject, promptTopics, i)
              const topicHint = promptTopics.length > 0
                ? `${promptTopics.slice(0, 2).join(' and ')} — relevant to ${promptSubject}`
                : ''
              const fullHint = topicHint ? `${baseHint}. Topic focus: ${topicHint}` : baseHint
              return generatePassageWithBedrock('', promptSubject, fullHint, callBedrock, grade, {
                domain: subjectDomain,
                topics: promptTopics,
              })
            }),
          )
          generatedPassages = rawPassages.filter(Boolean) as { text: string; source: string }[]
        }

        if (generatedPassages.length === 0) {
          return NextResponse.json({ error: 'Failed to generate reading passages. Please try again.' }, { status: 500 })
        }

        const passageQResults = await Promise.all(
          generatedPassages.map((passage, i) => {
            const qCount = Math.min(questionsPerPassage, passageQuestionTarget - i * questionsPerPassage)
            if (qCount <= 0) return Promise.resolve([])
            return tryGeneratePassageBatch(passage, qCount, i * questionsPerPassage + 1)
          }),
        )
        const passageQuestions = passageQResults.flat().slice(0, passageQuestionTarget)

        if (directQuestionTarget > 0) {
          const directBatches: { count: number; startId: number }[] = []
          for (let i = 0; i < directQuestionTarget; i += BATCH_SIZE) {
            directBatches.push({ count: Math.min(BATCH_SIZE, directQuestionTarget - i), startId: passageQuestions.length + i + 1 })
          }
          const directSettled = await Promise.allSettled(
            directBatches.map((b) => tryGenerateBatch(b.count, b.startId)),
          )
          const directQuestions: any[] = []
          for (const result of directSettled) {
            if (result.status === 'fulfilled') directQuestions.push(...result.value)
          }
          const merged = [...directQuestions.slice(0, directQuestionTarget), ...passageQuestions]
          for (let i = merged.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[merged[i], merged[j]] = [merged[j], merged[i]]
          }
          allQuestions = merged
        } else {
          allQuestions = passageQuestions
        }
      } else {
        // ── STANDARD PARALLEL BATCH FLOW ─────────────────────────────────────
        // Use allSettled so one failed batch (e.g. JSON parse error) doesn't
        // kill the whole request — successful batches still contribute questions
        // and the retry loop below fills any shortfall.
        // Run in waves, not all at once.
        //
        // A whole paper used to be seven batches; generating one numbered
        // question at a time makes it seventeen, and seventeen simultaneous
        // Bedrock calls get throttled -- a run came back with 7 questions of
        // 34 because most batches were rejected rather than wrong.
        const WAVE = 5
        const batchSettled: PromiseSettledResult<any[]>[] = []
        for (let i = 0; i < batches.length; i += WAVE) {
          const wave = batches.slice(i, i + WAVE)
          batchSettled.push(...await Promise.allSettled(
            wave.map(async (b) => {
              // One retry per batch, and it matters far more here than it
              // used to. A kind-batch held five interchangeable questions and
              // the top-up loop could refill them; a question-batch holds ONE
              // numbered question with its parts, and losing it loses that
              // question outright. Two runs in three failed the whole paper
              // this way.
              try {
                return await tryGenerateBatch(b.count, b.startId, b.paperPass, b.questionParts, b.batchTopics, b.assignedFigure, b.strandHint)
              } catch (first) {
                if (!b.questionParts) throw first
                return await tryGenerateBatch(b.count, b.startId, b.paperPass, b.questionParts, b.batchTopics, b.assignedFigure, b.strandHint)
              }
            }),
          ))
        }
        const batchErrors: any[] = []
        for (const result of batchSettled) {
          if (result.status === 'fulfilled') allQuestions.push(...result.value)
          else batchErrors.push(result.reason)
        }
        // Only hard-fail if EVERY batch failed (nothing to work with)
        if (allQuestions.length === 0 && batchErrors.length > 0) throw batchErrors[0]
      }
    } catch (err: any) {
      console.error('Generation failed:', err)
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.error?.code === 'rate_limit_exceeded'
      const msg = is429
        ? 'AI is rate-limited. Please wait 30 seconds and try again.'
        : `Generation failed: ${err?.message ?? String(err)}`
      return NextResponse.json({ error: msg }, { status: is429 ? 429 : 500 })
    }

    // Deduplicate + fix first pass, then apply the quality filters BEFORE the
    // top-up loop below.
    //
    // These filters used to run after the retry loop had finished, so every
    // question they removed came straight off the final count — a paper of ten
    // came back as seven or eight. Cleaning first means the loop sees the real
    // shortfall and refills it, which is the difference between filtering and
    // silently shrinking the paper.
    /**
     * Everything that repairs or removes a question, in the order they have to
     * run: repair first, so a question is only dropped when nothing can save
     * it. Called wherever the paper is cleaned, because the retry loop's
     * condition has to see the count that will actually ship — a drop after the
     * loop comes straight off the paper.
     */
    const makeShippable = (questions: any[]): any[] => {
      // Past-paper banks store questions with their choices printed underneath,
      // and the model copies that block into the stem then leaves the options
      // array as ["A","B","C","D"]. Measured on WAEC Mathematics with a paper
      // attached, seven of ten came back that way — four bare letters to choose
      // between.
      const fixed = repairPaper(questions)
      if (fixed > 0) console.log(`Recovered inline options on ${fixed} question(s)`)

      // The figure catalogue's internal ids occasionally end up mid-sentence.
      const stripped = stripImageKeysFromPaper(questions)
      if (stripped > 0) console.log(`Stripped image_key from ${stripped} question(s)`)

      // Textbook-sourced questions carry the book's own furniture into the stem
      // — "Use the diagram on page 286 to support your explanation" — and the
      // student has no page 286.
      const unbooked = repairBookReferences(questions)
      if (unbooked > 0) console.log(`Removed a book cross-reference from ${unbooked} question(s)`)

      // A stem that promises attached content it never includes — "consider the
      // following code snippet" with no snippet — is unanswerable, and nothing
      // else in the pipeline looks for it.
      const { kept, dropped } = dropDanglingReferences(questions)
      if (dropped.length > 0) {
        console.log(`Dropped ${dropped.length} question(s) referencing absent ${[...new Set(dropped)].join('/')}`)
      }

      // A question naming something its figure does not contain.
      //
      // The generator never sees the image -- it is handed a written
      // description -- so when it needs a detail the description does not
      // give, it invents one. A stock illustration of a road was asked for
      // "the size of angle C if angle D is 120 degrees"; a mitochondrion
      // labelled Outer membrane and Cristae was asked to "name the part
      // labelled A"; fifteen painted flowers were asked about "the number of
      // cubes".
      //
      // The QUESTION goes, not the figure. Taking the figure away leaves
      // "Look at the diagram" with no diagram, which is exactly as
      // unanswerable -- swapping one broken question for another. Dropping
      // here, before the paper is trimmed, lets the top-up write a new one.
      const byPath = new Map(visualCatalog.map((c) => [c.localPath, c.description]))
      const matched = (questions as any[]).filter((q) => {
        const reasons = figureMismatchReasons(q, byPath.get(String(q?.image_url ?? '')))
        if (!reasons.length) return true
        console.log(`Dropped question: it ${reasons.join('; ')}`)
        return false
      })

      // A written answer with no mark scheme and no usable key is worth marks
      // nobody can award. Same class of fault as the stems above — a promise
      // the paper cannot keep — and dropped in the same place, while the
      // top-up loop can still refill the gap.
      // A scenario with no question, or two demands in a one-word box. Both
      // survived three rounds of prompt work and kept reaching real papers,
      // so they are removed rather than described.
      const answerable = dropUnanswerable(matched as any[])
      if (answerable.dropped.length > 0) {
        console.log(`Dropped ${answerable.dropped.length} unanswerable question(s): ${[...new Set(answerable.dropped)].join('; ')}`)
      }

      const markable = dropUnmarkable(answerable.kept as any[])
      if (markable.dropped > 0) {
        console.log(`Dropped ${markable.dropped} question(s) with nothing to mark against`)
      }

      return cleanQuestionPaper(markable.kept as any[])
    }

    allQuestions = makeShippable(deduplicateAndFix(allQuestions))

    // ── Retry: up to 3 passes to fill any shortfall ──────────────────────────
    for (let retryPass = 1; retryPass <= 3 && allQuestions.length < count; retryPass++) {
      const missing = count - allQuestions.length
      console.warn(`Short by ${missing} questions (pass ${retryPass}) — retrying...`)
      try {
        let retryQs: any[]
        if (usePassageFlow && generatedPassages.length > 0) {
          const retryPassageCount = Math.min(missing, passageQuestionTarget)
          const retryDirectCount = missing - retryPassageCount
          const retryParts: any[] = []
          if (retryDirectCount > 0) {
            retryParts.push(...await tryGenerateBatch(retryDirectCount, allQuestions.length + 1))
          }
          if (retryPassageCount > 0) {
            retryParts.push(...await tryGeneratePassageBatch(generatedPassages[0], retryPassageCount, allQuestions.length + retryParts.length + 1))
          }
          retryQs = retryParts
        } else {
          // Ask for meaningfully more than the shortfall, not just the
          // shortfall.
          //
          // The cleaners above had already removed a slice of the first pass —
          // duplicates, questions referencing a figure that does not exist —
          // and a retry asking for exactly what is missing walks into the same
          // rate of loss. Short by one meant two requested (the 40% surplus
          // rounds up), both near-duplicates of what was already there, both
          // deduplicated away; three passes gained nothing and the request
          // failed. Over-asking costs a few tokens; the surplus is trimmed to
          // the exact count below either way.
          //
          // Only padded while the ask still fits one batch: past that the
          // 40% surplus is already several questions, and a bigger request
          // buys truncation against Nova Lite's output limit rather than
          // more questions.
          const ask = missing <= BATCH_SIZE ? Math.min(BATCH_SIZE, missing + 2) : missing
          retryQs = await tryGenerateBatch(ask, allQuestions.length + 1)
        }
        const seenKeys = new Set(
          allQuestions.map((q) => normalizeQuestionKey(String(q?.question || ''))).filter(Boolean),
        )
        allQuestions.push(...deduplicateAndFix(retryQs, seenKeys))
        // Re-clean the combined set: a replacement can duplicate or contradict
        // something already in the paper, and the loop condition has to judge
        // the count that will actually ship.
        allQuestions = makeShippable(allQuestions)
      } catch (err: any) {
        console.error(`Retry pass ${retryPass} failed:`, err)
        break
      }
    }

    // If STILL short after all retries → return error
    if (allQuestions.length < count) {
      return NextResponse.json(
        { error: `Failed to generate ${count} questions. The AI produced ${allQuestions.length}. Please try again.` },
        { status: 500 }
      )
    }

    // Trim to EXACTLY the requested count (the 20% surplus buffer may have pushed us over)
    //
    // An exam paper trims BY KIND. Both passes over-generate, so a blind slice
    // returned 24 keyed short answers where the blueprint had 21 slots for
    // them -- and the three that spilled into 2- and 3-mark slots were worth
    // one mark each, leaving the paper worth 46 out of a promised 50.
    if (shortWanted > 0 && allQuestions.length > count) {
      const isKeyed = (q: any) =>
        Array.isArray(q?.short_answer?.accepted) &&
        q.short_answer.accepted.some((a: unknown) => typeof a === 'string' && a.trim())
      const keyed = allQuestions.filter(isKeyed)
      const rest = allQuestions.filter((q) => !isKeyed(q))
      const takeShort = keyed.slice(0, shortWanted)
      const takeRest = rest.slice(0, count - takeShort.length)
      // Only use the kind-aware trim when it can actually fill the paper; a
      // pass that came back thin must not shorten it further.
      if (takeShort.length + takeRest.length === count) {
        allQuestions = [...takeShort, ...takeRest]
      } else {
        allQuestions = allQuestions.slice(0, count)
      }
    } else if (allQuestions.length > count) {
      allQuestions = allQuestions.slice(0, count)
    }
    // Final re-number after trim
    allQuestions.forEach((q: any, i: number) => { q.id = i + 1 })

    // ── Final deterministic fix pass ──────────────────────────────────────────
    // Run all fixers one last time after trimming/renumbering so the explanation-based
    // fixer always has the last word — never let AI-generated indices stand unchecked.
    // Use custom time if provided, otherwise calculate from prompt helper
    if (customTime && customTime > 0) {
      estimatedTime = Number(customTime)
    } else {
      const { estimatedTime: et } = buildPrompt({
        subject: promptSubject, topics: promptTopics, count, startId: 1, style,
        curriculumName, curriculumBlock: enrichedCurriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade: gradeForPrompt,
        sourceText, sourceName: sourceLabel, requirePassagesAll,
      })
      estimatedTime = et
    }

    const assessmentData: any = { questions: allQuestions, estimated_time: estimatedTime }

    if (!Array.isArray(assessmentData.questions)) {
      return NextResponse.json({ error: 'AI returned invalid question data. Please try again.' }, { status: 500 })
    }

    // NOTE: the quality filters (duplicates, contradictions, examiner voice)
    // deliberately run earlier, before the top-up loop — see above. Removing
    // questions here, after the count has been settled and trimmed, is exactly
    // what turned a requested ten into a delivered seven.

    // Attach real figures — exam papers (Aloc) or school textbooks (PDF extract)
    if (hasDiagramSupport && textbookExam && textbookExamYear && textbookExamSubject) {
      const attached = attachSourceImages(assessmentData.questions, {
        exam: textbookExam,
        subject: textbookExamSubject,
        year: textbookExamYear,
      })
      if (attached > 0) console.log(`Attached ${attached} exam image(s) for ${textbookExam} ${textbookExamSubject} ${textbookExamYear}`)
    } else if (hasVisionFigures && visualCatalog.length > 0) {
      const attached = attachImagesFromCatalog(assessmentData.questions, visualCatalog)
      if (attached > 0) console.log(`Attached ${attached} vision-matched textbook image(s)`)

      // The same subject gate as the Checkpoint matcher, applied after the
      // fact because the general matcher lives in a module shared with
      // StudyLab. A figure from another subject is wrong here for the same
      // reason it is wrong there, and this is the only place it can be caught
      // without reshaping that module.
      {
        let crossed = 0
        for (const q of assessmentData.questions as any[]) {
          if (!q?.image_url) continue
          if (figureAllowedOnPaper(q.image_url, promptSubject, Number(grade) || undefined)) continue
          delete q.image_url
          crossed++
        }
        if (crossed > 0) console.log(`Removed ${crossed} figure(s) belonging to another subject`)
      }

      // An illustrated question has to be unanswerable without the picture.
      // The model agrees to that in the prompt and then writes "a map shows a
      // backyard during a rainfall… what does this indicate?" anyway, so the
      // paper is checked rather than trusted. A leaked answer takes the whole
      // question; a merely redundant or mislabelled figure takes only the
      // image, since the question still works as text and losing a question
      // costs the student practice.
      {
        // Only the figure is ever removed here, never the question.
        //
        // This runs after the paper has been trimmed to the requested count,
        // so dropping a question would shorten the paper with nothing left to
        // refill it — which is exactly the shortfall U2 reported and the
        // top-up loop exists to prevent. A question whose stem leaks its
        // answer is a weak question; a paper of nine when ten were asked for
        // is a broken promise. The stem-level faults are pushed back onto the
        // prompt, which now states the rule explicitly and, since figures
        // carry their own keying guidance, has far less reason to produce one.
        const byKey = new Map(visualCatalog.map((c) => [c.localPath, c]))

        let detached = 0
        for (const q of assessmentData.questions as any[]) {
          if (!q?.image_url) continue
          const verdict = judgeImageQuestion({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            visionType: byKey.get(q.image_url)?.category,
          })
          if (verdict.ok) continue

          // Detaching is only safe when the question still reads without the
          // picture. "The diagram shows a plant cell. Name the part labelled
          // A." does not: strip the figure and the stem promises something
          // the learner cannot see, which is the worse of the two faults and
          // the one that showed up 53 times in a sweep.
          //
          // The order of preference is the same one stated above — losing a
          // question costs the student practice — so a redundant or
          // mislabelled figure stays when the alternative is an unanswerable
          // stem. The paper keeps its length either way.
          // ANY dangling kind, not just 'figure'. Asking only about figures
          // let a picture go from "Look at the diagram. Simplify the
          // expression given by the function f(x)...", because the bare word
          // "function" made that stem read as a dangling CODE reference and
          // the check compared against the wrong string. What matters is
          // whether the question still stands without its picture, and any
          // unkept promise means it does not.
          const without = danglingReference({ ...q, image_url: undefined })
          if (without) {
            console.log(`Kept figure despite "${verdict.reason}": the stem depends on it (${without})`)
            continue
          }

          delete q.image_url
          detached++
          console.log(`Detached figure from question: ${verdict.reason}`)
        }
        if (detached) console.log(`Image-question check: detached ${detached} figure(s)`)
      }

      // A vision figure can be reused across several questions — group those
      // questions so they're contiguous (e.g. "Questions 4-6 refer to the
      // figure below") instead of the same image reappearing at random
      // positions in the paper. Renumber ids to match the new positions.
      if (attached > 0) {
        assessmentData.questions = groupQuestionsByFigure(assessmentData.questions)
        assessmentData.questions.forEach((q: any, i: number) => { q.id = i + 1 })
      }
    }

    {
      if (checkpointPassage) {
        for (const q of assessmentData.questions as any[]) {
          if (q && typeof q === 'object' && !q.passage) q.passage = checkpointPassage
        }
      }
      const tidied = tidyPaper(assessmentData.questions as any[])
      assessmentData.questions = tidied.questions
      if (tidied.removed > 0) console.log(`Removed ${tidied.removed} repeated figure(s)`)
    }

    // Strip internal generation fields (keep diagram hints for exam prep with visuals)
    assessmentData.questions = assessmentData.questions.map((q: any) => {
      const { needs_passage, passage_hint, image_key, ...rest } = q
      const cleaned = !hasDiagramSupport || hasVisionFigures
        ? (() => {
            const { needs_diagram, diagram_hint, ...clean } = rest
            return clean
          })()
        : rest
      return attachLongformHints(cleaned)
    })

    // ── Tag each question with the subtopic it covers ──────────────────────────
    // Resolve the candidate subtopics for this assessment (the chosen subtopics,
    // or every subtopic under the chosen topics) and tag each question locally so
    // results can be scored per subtopic and cascade up the gap map.
    let taggedSubtopicIds: number[] = []
    try {
      let candidateSubtopics: Array<{ id: number; name: string; topic_id: number | null }> = resolvedSubtopics
      if (candidateSubtopics.length === 0 && topicIds.length > 0) {
        let sql = 'SELECT subtopic_id, subtopic, topic_id FROM subtopics WHERE topic_id = ANY($1::int[])'
        const values: unknown[] = [topicIds]
        if (Number.isFinite(textbookId)) {
          sql += ' AND textbook_id = $2'
          values.push(textbookId)
        }
        sql += ' ORDER BY subtopic'
        const subRowsResult = await db.query(sql, values)
        candidateSubtopics = (subRowsResult.rows ?? [])
          .filter((r: any) => Number.isFinite(r?.subtopic_id) && r?.subtopic)
          .map((r: any) => ({ id: Number(r.subtopic_id), name: String(r.subtopic), topic_id: Number.isFinite(r.topic_id) ? Number(r.topic_id) : null }))
      }
      if (candidateSubtopics.length > 0) {
        taggedSubtopicIds = tagQuestionsWithSubtopics(assessmentData.questions, candidateSubtopics)
      }
    } catch (tagErr) {
      console.error('Subtopic tagging skipped:', tagErr)
    }

    // Backfill readable labels for anything the subtopic pass didn't cover —
    // custom-topic quizzes, and curriculum quizzes whose subtopic lookup failed
    // above. Runs outside that try so a DB error there still leaves the review
    // page with usable areas.
    tagQuestionsWithTopicLabels(assessmentData.questions, promptTopics)

    // ── Where each question came from ─────────────────────────────────────────
    // A student who disputes a question has nothing to check against, and a
    // teacher cannot confirm a paper matches the syllabus. Both facts are known
    // here. The page is keyed off the figure, because that is the only part of
    // the pipeline that tracks where content sat in the book, so text questions
    // carry a book and an area and no page rather than a plausible guess.
    {
      const pageByPath = new Map(visualCatalog.map((c) => [c.localPath, c.page]))
      for (const q of assessmentData.questions as any[]) {
        if (!q || typeof q !== 'object') continue
        const src = buildSource({
          textbook: textbookName,
          page: pageByPath.get(q.image_url),
          area: q.topic_label_matched ? q.topic_label : undefined,
        })
        if (src) q.source = src
        delete q.topic_label_matched
      }
    }

    // ── Stage 2b: Passages ────────────────────────────────────────────────────
    // For passage subjects using the passage-first flow, questions already have
    // q.passage set. Only run generateAllPassages for any stragglers that somehow
    // lack a passage (edge case), then skip fixupPassageQuestions entirely since
    // questions were written about the actual passage from the start.
    if (usePassageFlow) {
      const missing = assessmentData.questions.filter((q: any) => !q.passage)
      if (missing.length > 0) {
        // Fallback: stamp the first generated passage or generate fresh ones
        if (generatedPassages.length > 0) {
          missing.forEach((q: any) => { q.passage = generatedPassages[0].text; q.passage_source = generatedPassages[0].source })
        } else {
          await generateAllPassages(missing, promptSubject, callBedrock, grade)
          await fixupPassageQuestions(missing, callBedrock)
        }
      }
    } else if (!usePassageFlow && !checkpointPassage) {
      // Direct syllabus questions — no reading passage UI.
      //
      // `&& !checkpointPassage` is the whole fix for the Clara questions.
      // `usePassageFlow` is decided six hundred lines earlier, from the
      // subject plan, and is false for Checkpoint. So a Checkpoint English
      // paper generated its 520-word reading text, stamped it onto all forty
      // questions -- and then deleted it here, four lines before the
      // response. The text existed, the questions were written against it,
      // and the learner was shown none of it.
      assessmentData.questions.forEach((q: any) => {
        delete q.passage
        delete q.passage_source
        delete q.needs_passage
        delete q.passage_hint
      })
    }

    assessmentData.questions = assessmentData.questions.map((q: any) => attachLongformHints(q))

    // ── Save to database ───────────────────────────────────────────────────────
    // Tag the assessment with the curriculum it targets (textbook/topic/subtopic)
    // so the StudyLab Learning Gap Map can read real topic-level performance.
    const assessmentPayload: Record<string, any> = {
      user_id: user_id || null,
      subject: promptSubject,
      difficulty: style,
      duration: estimatedTime,
      questions_data: assessmentData.questions,
      status: 'completed',
      textbook_id: Number.isFinite(textbookId) ? textbookId : null,
      topic_ids: topicIds,
      subtopic_ids: taggedSubtopicIds.length > 0 ? taggedSubtopicIds : subtopicIds,
    }

    let dbAssessment: any = null
    let dbError: unknown = null

    try {
      const insertResult = await db.query(
        `INSERT INTO assessments (user_id, subject, difficulty, duration, questions_data, status, textbook_id, topic_ids, subtopic_ids)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::int[],$9::int[])
         RETURNING *`,
        [
          assessmentPayload.user_id,
          assessmentPayload.subject,
          assessmentPayload.difficulty,
          assessmentPayload.duration,
          jsonbParam(assessmentPayload.questions_data),
          assessmentPayload.status,
          assessmentPayload.textbook_id,
          intArrayParam(assessmentPayload.topic_ids),
          intArrayParam(assessmentPayload.subtopic_ids),
        ]
      )
      dbAssessment = insertResult.rows[0]
    } catch (err) {
      dbError = err
      if (isMissingColumn(err)) {
        try {
          const retryResult = await db.query(
            `INSERT INTO assessments (user_id, subject, difficulty, duration, questions_data, status)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6)
             RETURNING *`,
            [
              assessmentPayload.user_id,
              assessmentPayload.subject,
              assessmentPayload.difficulty,
              assessmentPayload.duration,
              jsonbParam(assessmentPayload.questions_data),
              assessmentPayload.status,
            ]
          )
          dbAssessment = retryResult.rows[0]
          dbError = null
        } catch (retryErr) {
          dbError = retryErr
        }
      }
    }

    if (dbError) console.error('DB save error:', dbError)

    if (userId) {
      await incrementFreeAssessmentUsage(userId)
    }

    return NextResponse.json({
      ...assessmentData,
      assessment_id: dbAssessment?.id || assessmentData.assessment_id,
      subject: promptSubject,
      topics: displayTopics,
      style,
      curriculum,
      questionType,
      textbook_id: Number.isFinite(textbookId) ? textbookId : null,
      topic_ids: topicIds,
      subtopic_ids: subtopicIds,
      subtopic_id: subtopicIds.length === 1 ? subtopicIds[0] : null,
    })
  } catch (error: any) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: `Failed to generate assessment: ${error?.message || String(error)}` },
      { status: 500 }
    )
  }
}
