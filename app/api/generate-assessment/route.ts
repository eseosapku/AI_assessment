import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { jsonrepair } from 'jsonrepair'
import { supabase } from '@/lib/supabase'
import { authorityForCurriculum, isExamPrepCurriculumNumeric } from '@/lib/curriculum-registry'
import { normalizeCountry } from '@/lib/countries'
import { getNigeriaCurriculumContext, type NigeriaLevel } from '@/lib/nigeria-curriculum'
import { examPrepContext } from '@/lib/nigeria-exam-syllabi'
import { getCachedExamPaperById, isCachePaperId } from '@/lib/exam-source-cache'
import {
  assertSubscriptionAccess,
  incrementFreeAssessmentUsage,
  subscriptionPaywallBody,
} from '@/lib/subscription-server'

const MAX_DIAGRAMS = 4
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
const TAG_STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'this', 'from', 'what', 'which', 'when', 'how', 'why',
  'who', 'whom', 'into', 'onto', 'over', 'under', 'between', 'about', 'their', 'there', 'these', 'those',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'has', 'have', 'had', 'been', 'being', 'does',
  'did', 'not', 'all', 'any', 'each', 'its', 'his', 'her', 'they', 'them', 'you', 'your', 'one', 'two',
  'following', 'true', 'false', 'best', 'most', 'correct', 'answer', 'option', 'options', 'question',
  'explain', 'describe', 'state', 'define', 'list', 'name', 'give', 'show', 'work', 'out', 'use', 'using',
])

function tagTokens(value: string): string[] {
  return (String(value || '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !TAG_STOPWORDS.has(w)
  )
}

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
    const chosen = bestScore > 0 && best ? best : candidates[rr++ % candidates.length]
    q.subtopic_id = chosen.id
    q.topic_id = chosen.topic_id ?? null
    used.add(chosen.id)
  }
  return [...used]
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

Return your response in this EXACT format (no extra text, no markdown):
PASSAGE:
[full passage text here]

SOURCE:
[e.g. "Original passage written for ${gradeLabel} students" or author/title if using a real text]`
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
  grade?: number | string
): Promise<{ text: string; source: string } | null> {
  try {
    const spec = gradePassageSpec(grade)
    const raw = await callFn(PASSAGE_PROMPT(question, subject, hint, grade), spec.maxTokens)
    return parsePassageResponse(raw, spec.minWords)
  } catch (err) {
    console.error('Bedrock passage generation failed:', err)
    return null
  }
}

// ── Subjects that need reading passages ───────────────────────────────────────
const PASSAGE_SUBJECTS = [
  'english', 'english language', 'english literature', 'literature', 'literature in english',
  'french', 'kinyarwanda', 'swahili', 'history', 'general paper', 'global perspectives',
  'language arts', 'reading', 'social studies',
]

function needsPassage(subject: string): boolean {
  return PASSAGE_SUBJECTS.some((s) => subject.toLowerCase().includes(s))
}

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
  const subjectAllows = /\b(math|mathematics|statistics)\b/.test(subjectText)
  const topicAllows = /\b(number|addition|subtraction|multiplication|division|fraction|decimal|percent|percentage|ratio|proportion|equation|algebra|geometry|measure|measurement|length|area|perimeter|volume|angle|graph|chart|data|statistics|probability|time|speed|distance|temperature|money|currency|budget|discount|interest)\b/.test(topicText)
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
  questionType: 'mcq' | 'longform' | 'mixed'
  hasDiagramSupport: boolean
  difficultyLevel?: string
  grade?: number | string
  sourceText?: string
  sourceName?: string
}): { prompt: string; estimatedTime: number } {
  const { subject, topics, count, startId = 1, style, curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel, sourceText, sourceName } = opts

  const subjectNeedsPassage = !sourceText && needsPassage(subject)

  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const mcqTime = subjectNeedsPassage ? 4 : 2
  const lfTime = subjectNeedsPassage ? 12 : 8
  const estimatedTime = mcqCount * mcqTime + lfCount * lfTime

  const diagramNote = hasDiagramSupport
    ? `DIAGRAMS: When a visual is essential (geometry, circuits, anatomy, graphs, labelled diagrams from past papers), set "needs_diagram": true and "diagram_hint": "<clear description for image generation>". Use for up to ${MAX_DIAGRAMS} questions. Theory (longform) questions may also reference diagrams when the past-paper source includes them.`
    : ''

  // IMPORTANT: we only ask for a short passage_hint here — the full passage is generated
  // separately by Gemini, not by this Groq call. This keeps the Groq output small.
  const passageNote = subjectNeedsPassage
    ? `PASSAGES: Every question MUST have a reading passage. Add these two fields to every question:
   - "needs_passage": true
   - "passage_hint": a 30-40 word description of a passage that matches the topic and grade. Use a DIFFERENT author/genre for each question — at least 3 distinct styles across the assessment.
   Do NOT write the passage text — passages are generated separately.`
    : `PASSAGES: Only add "needs_passage": true and "passage_hint" if a question genuinely requires a source text.`

  // Keep model_answer SHORT here — it only needs to outline the key points (full model answers are heavy on tokens)
  const mcqSchema = `{
      "id": <number>,
      "type": "mcq",
      "question": "<question directly about the passage or topic>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_answer": <0-3>,
      "explanation": "<clear explanation of the correct answer>"${hasDiagramSupport ? `,
      "needs_diagram": false,
      "diagram_hint": ""` : ''}${subjectNeedsPassage ? `,
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
      "model_answer": "<concise 80-120 word outline of a top answer using P.E.E structure>",
      "explanation": "<what skill this question assesses>"${subjectNeedsPassage ? `,
      "needs_passage": true,
      "passage_hint": "<30-40 word description — different author/genre from other questions>"` : ''}
    }`

  const gradeNum = Number(opts.grade) || 99
  const allowArithmetic = allowsArithmeticForSelection(subject, topics)
  const isPrimaryLow = gradeNum >= 1 && gradeNum <= 2
  const lfMarksRange = isPrimaryLow ? '2-3' : '2-8'
  const lfQuestionDesc = isPrimaryLow
    ? (allowArithmetic
      ? '<simple, one-step word problem aligned to the selected topic. Include "Show your working.">'
      : '<simple, one-step question aligned to the selected topic. Do NOT ask for calculations or "Show your working.">')
    : '<question requiring an extended written answer>'
  const lfSchemaNoPassage = `{
      "id": <number>,
      "type": "longform",
      "question": "${lfQuestionDesc}",
      "marks": <integer ${lfMarksRange}>,
      "marking_criteria": ["<criterion 1>", "<criterion 2>", "..."],
      "model_answer": "<80-120 word outline of a strong answer>",
      "explanation": "<what this question tests>"
    }`

  const activeLfSchema = subjectNeedsPassage ? lfSchema : lfSchemaNoPassage

  let questionsBlock = ''
  let questionInstruction = ''

  const lfInstructionMarks = isPrimaryLow ? '2–3 marks each' : '4–8 marks each'
  if (questionType === 'mcq') {
    questionInstruction = `Generate exactly ${count} multiple-choice questions.${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres.` : ''}`
    questionsBlock = `    ${mcqSchema}`
  } else if (questionType === 'longform') {
    questionInstruction = `Generate exactly ${count} long-form questions (${lfInstructionMarks}, one criterion per mark).${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres across the set.` : ''}`
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
- If a quote is needed, copy exact words from the source text.`
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
  const uiConstraints = hasDiagramSupport
    ? `**UI CONSTRAINTS (EXAM PREP WITH PAST-PAPER SOURCE):**
- Adapt questions from the past-paper reference. MCQ and theory may include diagrams when the source material requires them.
- For diagram-dependent questions, set "needs_diagram": true and a detailed "diagram_hint".
- Do NOT ask students to draw, sketch, or plot unless it is standard WASSCE theory style (describe in words if no diagram).
- Never ask students to measure something on-screen or to use a ruler/protractor.`
    : `**UI CONSTRAINTS (NON-NEGOTIABLE):**
- All questions must be answerable from text alone. If a shape/object is needed, describe it fully in words with quantities.
- Do NOT write any question that depends on a picture/diagram/graph/figure being shown.
- Do NOT reference colors/shading/parts of "this shape" or "this picture".
- NEVER use prompts like "imagine", "as shown above/below", "see the diagram", "look at the picture", or "look at this".
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

${uiConstraints}

**Requirements:**
1. All questions strictly based on the ${curriculumName} syllabus topics listed above.
2. ${difficultyInstruction || 'Vary difficulty: recall, application, analysis.'}
3. LaTeX math MUST be wrapped in dollar signs: $...$ for inline (e.g. $\\\\frac{1}{x}$, $\\\\sqrt{2}$, $x^2 + y^2$) and $$...$$ for display. This applies in ALL fields including explanations and model_answer. Never write bare LaTeX outside of dollar signs.
4. MCQ "explanation" field: 100-150 words. Write a thorough explanation covering: (a) the concept or skill this question tests, (b) exactly why the correct answer is right with specific reasoning, evidence, or working shown, (c) why each of the three wrong options is incorrect and what misconception leads a student to pick it. Do NOT just restate the question. Write in full sentences.
5. Longform "explanation" field: 40-60 words. State the skill being assessed (e.g. "This question tests inference skills..."), then describe what a strong answer must include. Longform "model_answer" field: MINIMUM 80 words, MAXIMUM 120 words. Write a full P.E.E. paragraph — Point, Evidence (quote or example), Explanation of effect — that a student could use as a model answer. Do NOT use bullet points.
6. Question "id" fields: number from ${startId} to ${startId + count - 1}.
${questionType !== 'longform' || hasDiagramSupport ? `7. ${diagramNote || 'N/A'}` : ''}
8. ${passageNote}

**MCQ ANSWER INTEGRITY — NON-NEGOTIABLE:**
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
- BANNED QUESTION FORMAT — "which GROUP of numbers can be divided by N / is divisible by N / are multiples of N": This format ALWAYS produces multiple correct answers. You MUST NEVER use it. Instead, ask about a SINGLE number with options where only ONE matches the property.

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
  count: number
  startId: number
  style: string
  curriculumName: string
  curriculumBlock: string
  questionType: 'mcq' | 'longform' | 'mixed'
  difficultyLevel?: string
  grade?: number | string
}): string {
  const { passage, subject, count, startId, style, curriculumName, curriculumBlock, questionType, difficultyLevel, grade } = opts
  const difficultyInstruction = difficultyLevel ? (DIFFICULTY_INSTRUCTIONS[difficultyLevel] ?? '') : ''

  const isPrimaryGrade = grade && Number(grade) >= 1 && Number(grade) <= 6
  const gradeNote = isPrimaryGrade
    ? `Grade ${grade} students (ages ${5 + Number(grade)}–${6 + Number(grade)}). Use simple, age-appropriate vocabulary.`
    : grade ? `Grade ${grade}` : 'secondary level'

  const mcqSchema = `{ "id": <number>, "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correct_answer": <0-3>, "explanation": "100-150 words explaining why the correct answer is right and why each wrong option is wrong" }`
  const lfSchema = `{ "id": <number>, "type": "longform", "question": "...", "marks": <4-8>, "marking_criteria": ["one point per mark — each must be achievable from this passage"], "model_answer": "80-120 words — full P.E.E. paragraph using ACTUAL verbatim quotes from the passage", "explanation": "40-60 words: what skill this tests" }`

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

function isUnanswerableWithoutVisual(q: any, subject = '', allowDiagrams = false): boolean {
  const question = String(q?.question ?? '').trim()
  if (!question) return true

  if (allowDiagrams && q?.needs_diagram === true) return false

  const lower = question.toLowerCase()

  const science = isScienceSubject(subject)
  if (science && /\b(circuit|resistor|force diagram|free-body)\b/i.test(question) && !/\b(imagine|as shown|see the|look at the|this diagram|this figure)\b/i.test(lower)) {
    return false
  }

  if (q?.needs_diagram === true) return !allowDiagrams

  // Disallow any draw/plot or imagine prompts entirely.
  if (/\b(draw|sketch|plot|imagine)\b/.test(lower)) {
    return true
  }

  // References to missing figures/diagrams.
  if (/\b(as\s+shown|shown\s+(?:above|below|here)|see\s+(?:the|this|these)\s+(?:diagram|picture|figure|graph|image|photo|illustration|map|chart|table)|look\s+at\s+(?:the|this|these)\s+(?:diagram|picture|figure|graph|image|photo|illustration|map|chart|table)|in\s+the\s+(?:diagram|picture|figure|graph|image|photo|illustration|map|chart|table)|on\s+the\s+graph)\b/i.test(question)) {
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
  if (allowsArithmeticForSelection(subject, topics)) return false
  const question = String(q?.question ?? '').toLowerCase()
  if (!question) return true

  const hasDigits = /\d/.test(question)
  const hasSymbols = /[+\-*\/=]/.test(question)
  const arithmeticWords = /\b(add|added|sum|total|altogether|in\s+all|difference|subtract|minus|plus|left|remain|remaining|increase|decrease|multiply|product|times|divide|quotient|share)\b/.test(question)
  const storyPattern = /\bhas\s+\d+.*\b(give|gives|gave|get|gets|got|buy|buys|bought|take|takes|took|lose|loses|lost|more|less)\b.*\bhow\s+many\b/.test(question)
  const howManyTotal = /\bhow\s+many\b/.test(question) && /\b(total|altogether|left|remain|remaining|now|in\s+all|sum)\b/.test(question)

  return (hasDigits && hasSymbols) || (hasDigits && (arithmeticWords || storyPattern || howManyTotal))
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
      aiModel = 'eu.google.gemma-3-27b-it-v1:0',
      customTime,
      textbook_id,
      topic_ids,
      subtopic_ids,
      subtopic_id,
      examPrepContext: rawExamPrepContext,
    } = body

    const questionType =
      requestedQuestionType === 'mcq' || requestedQuestionType === 'longform' || requestedQuestionType === 'mixed'
        ? requestedQuestionType
        : 'mcq'

    const userId = String(user_id ?? '').trim()

    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'assessment')
      if (!gate.allowed) {
        return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
      }
    }

    const AWS_REGION = process.env.AWS_REGION || 'eu-west-1'
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    if (!accessKeyId || !secretAccessKey) {
      console.error('Generate assessment: AWS credentials missing on server')
      return NextResponse.json(
        {
          error: 'AI generation is not configured on the server. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to Vercel environment variables.',
          code: 'AWS_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

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

    if (Number.isFinite(textbookId)) {
      if (isCachePaperId(textbookId)) {
        const cached = getCachedExamPaperById(textbookId)
        if (cached) {
          textbookName = cached.name
          textbookSourceText = cached.sourceText
          textbookExamYear = cached.year
        }
      } else {
        const { data, error } = await supabase
          .from('textbooks')
          .select('textbook_id,textbook_name,source_text,exam_year,source_authority,filename,curriculum')
          .eq('textbook_id', textbookId)
          .maybeSingle()
        if (error) console.error('Textbook lookup error:', error)
        if (data?.textbook_name) textbookName = String(data.textbook_name)
        if (data?.source_text) textbookSourceText = String(data.source_text)
        if (data && Number.isFinite(data.exam_year)) textbookExamYear = Number(data.exam_year)
        if (data && userId && isExamPrepCurriculumNumeric(data.curriculum)) {
          const { data: profile } = await supabase.from('users').select('country').eq('id', userId).maybeSingle()
          if (normalizeCountry(profile?.country) !== 'NG') {
            return NextResponse.json({ error: 'Exam prep is only available for Nigeria accounts.' }, { status: 403 })
          }
        }
      }
    }

    const curriculumSlugEarly = String(curriculum ?? 'rwanda').toLowerCase()
    const isExamPrepCurriculum = curriculumSlugEarly === 'waec' || curriculumSlugEarly === 'jamb'
    if (isExamPrepCurriculum && userId) {
      const { data: profile } = await supabase.from('users').select('country').eq('id', userId).maybeSingle()
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
      let q = supabase
        .from('topics')
        .select('topic_id,topic,textbook_id')
        .in('topic_id', topicIds)
      if (Number.isFinite(textbookId)) q = q.eq('textbook_id', textbookId)
      const { data, error } = await q.order('topic')
      if (error) {
        console.error('Topics lookup error:', error)
      } else {
        const rows = Array.isArray(data) ? (data as any[]) : []
        for (const r of rows) {
          if (Number.isFinite(r.topic_id) && r.topic) topicNameById.set(Number(r.topic_id), String(r.topic))
        }
        dbTopicNames = topicIds.map((id) => topicNameById.get(id)).filter(Boolean) as string[]
      }
    }

    if (subtopicIds.length > 0) {
      let q = supabase
        .from('subtopics')
        .select('subtopic_id,subtopic,topic_id,textbook_id')
        .in('subtopic_id', subtopicIds)
      if (Number.isFinite(textbookId)) q = q.eq('textbook_id', textbookId)
      const { data, error } = await q.order('subtopic')
      if (error) {
        console.error('Subtopic lookup error:', error)
      } else {
        const rows = Array.isArray(data) ? (data as any[]) : []
        for (const row of rows) {
          if (!Number.isFinite(row?.subtopic_id) || !row?.subtopic) continue
          resolvedSubtopics.push({
            id: Number(row.subtopic_id),
            name: String(row.subtopic),
            topic_id: Number.isFinite(row.topic_id) ? Number(row.topic_id) : null,
          })
        }
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
    const curriculumName = authorityForCurriculum(curriculumSlug)
    let enrichedCurriculumBlock = curriculumBlock

    if (curriculumSlug === 'nigeria' && className) {
      enrichedCurriculumBlock = `${getNigeriaCurriculumContext(className as NigeriaLevel, promptSubject, promptTopics)}\n${curriculumBlock}`
    } else if (curriculumSlug === 'waec' || curriculumSlug === 'jamb') {
      const extra = String(rawExamPrepContext ?? '').trim()
      enrichedCurriculumBlock = extra || `${examPrepContext(curriculumSlug, promptSubject, promptTopics)}\n${curriculumBlock}`
    }

    const isCambridge = curriculumSlug === 'cambridge'
    const isExamPrepMode = curriculumSlug === 'waec' || curriculumSlug === 'jamb'
    const hasDiagramSupport = isExamPrepMode && Boolean(textbookSourceText)
    const usePassageFlow = !hasSourceText && needsPassage(promptSubject)

    // ── Bedrock client (explicit timeouts + fallback model) ─────────────────
    // IMPORTANT: The AWS SDK will retry requests by default. When the model ID is
    // invalid for the account/region, those retries can make a single call take
    // minutes. We cap attempts and use a 60s budget before falling back.
    const bedrockClient = new BedrockRuntimeClient({
      region: AWS_REGION,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3_000,
        requestTimeout: 70_000,
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

    function buildModelCandidates(seedId: string, opts?: { fallbackOnly?: boolean }): string[] {
      const bare = stripPrefix((seedId || 'google.gemma-3-27b-it').trim())
      const primary = bare.includes('12b') ? bare : 'google.gemma-3-27b-it'

      const regionalPrimary = [
        `${regionPrefix}.${primary}`,
        `${regionPrefix}.${primary}-v1:0`,
      ]
      const regionalFallback = [
        `${regionPrefix}.google.gemma-3-12b-it`,
        `${regionPrefix}.google.gemma-3-12b-it-v1:0`,
      ]

      const list = opts?.fallbackOnly ? regionalFallback : [...regionalPrimary, ...regionalFallback]
      return [...new Set(list.filter(Boolean))]
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

      const FALLBACK_MODEL_ID = 'google.gemma-3-12b-it'
      const PRIMARY_CALL_BUDGET_MS = 90_000
      const FALLBACK_CALL_BUDGET_MS = 45_000
      const PER_ATTEMPT_TIMEOUT_MS = 45_000

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
            const res = await bedrockClient.send(cmd, { abortSignal: controller.signal })
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
              console.warn(`Bedrock ${modelId} failed — trying alternate ID...`)
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

      const fallbackCandidates = buildModelCandidates(FALLBACK_MODEL_ID, { fallbackOnly: true })
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

    async function tryGenerateBatch(batchCount: number, startId: number): Promise<any[]> {
      // Request a 40% surplus so even if the model runs short we hit the target count.
      // The surplus is stripped after deduplication.
      const requestCount = batchCount + Math.ceil(batchCount * 0.4)
      const { prompt } = buildPrompt({
        subject: promptSubject, topics: promptTopics, count: requestCount, startId, style,
        curriculumName, curriculumBlock: enrichedCurriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade,
        sourceText, sourceName: sourceLabel,
      })
      // Nova Lite hard limit is 5120 output tokens. Cap at 4800 to leave JSON-framing headroom.
      // ~300-350 tokens per MCQ question (question + options + explanation).
      // Keep generation snappy: cap tokens more aggressively than the hard limit.
      const maxTokens = Math.min(3600, Math.max(1600, requestCount * 300))
      const text = await callBedrock(prompt, maxTokens)

      if (isRefusal(text)) throw new Error(`Model refused to generate content. Try a different AI model.`)
      const parsed = parseJsonRobust(fixLatexInRawJson(text))
      if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
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
      const prompt = buildPassageBasedPrompt({
        passage: passage.text, passageSource: passage.source,
        subject: promptSubject, count: requestCount, startId, style,
        curriculumName, curriculumBlock: enrichedCurriculumBlock, questionType,
        difficultyLevel, grade,
      })
      const maxTokens = Math.min(3800, Math.max(1800, requestCount * 320))
      const text = await callBedrock(prompt, maxTokens)
      if (isRefusal(text)) throw new Error(`Model refused to generate content.`)
      const parsed = parseJsonRobust(fixLatexInRawJson(text))
      if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
      parsed.questions.forEach((q: any) => { q.passage = passage.text; q.passage_source = passage.source })
      return parsed.questions
    }

    // Split count into batches of BATCH_SIZE (used for non-passage subjects)
    const batches: { count: number; startId: number }[] = []
    for (let i = 0; i < count; i += BATCH_SIZE) {
      batches.push({ count: Math.min(BATCH_SIZE, count - i), startId: i + 1 })
    }

    let allQuestions: any[] = []
    let estimatedTime = 0
    // For passage subjects, we store the generated passages for use in retries
    let generatedPassages: { text: string; source: string }[] = []

    // Helper: deduplicate + validate a list of raw questions in place
    function deduplicateAndFix(qs: any[]): any[] {
      cleanQuestionTexts(qs)

      // Filter out questions that are not workable in this UI.
      const filtered = qs.filter((q: any) => {
        const qType = String(q?.type || '').toLowerCase()
        if (questionType === 'mcq' && qType !== 'mcq') {
          console.warn(`Removed non-MCQ in MCQ-only request: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'longform' && qType !== 'longform') {
          console.warn(`Removed non-longform in longform-only request: "${String(q?.question || '').slice(0, 80)}"`)
          return false
        }
        if (questionType === 'mixed' && qType !== 'mcq' && qType !== 'longform') {
          console.warn(`Removed invalid question type: "${String(q?.question || '').slice(0, 80)}"`)
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
        return true
      })

      const seenQuestions = new Set<string>()
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
        // ── PASSAGE-FIRST FLOW ────────────────────────────────────────────────
        // Step 1: Generate passages in parallel (one per 10 questions).
        // Step 2: Generate questions per passage in parallel — each question
        //         is written about the actual passage text, so it can never
        //         reference features that don't exist.
        const numPassages = Math.max(1, Math.ceil(count / 10))
        const questionsPerPassage = Math.ceil(count / numPassages)

        // Build a topic-aware hint so passages are relevant to what was selected
        const topicHint = promptTopics.length > 0
          ? `${promptTopics.slice(0, 2).join(' and ')} — relevant to a ${promptSubject} assessment`
          : ''

        const rawPassages = await Promise.all(
          Array.from({ length: numPassages }, (_, i) => {
            const baseHint = sharedPassageHint(i, grade)
            const fullHint = topicHint ? `${baseHint}. Topic focus: ${topicHint}` : baseHint
            return generatePassageWithBedrock('', promptSubject, fullHint, callBedrock, grade)
          })
        )
        generatedPassages = rawPassages.filter(Boolean) as { text: string; source: string }[]
        if (generatedPassages.length === 0) {
          return NextResponse.json({ error: 'Failed to generate reading passages. Please try again.' }, { status: 500 })
        }

        // Step 2: Generate questions for each passage in parallel
        const passageQResults = await Promise.all(
          generatedPassages.map((passage, i) => {
            const qCount = Math.min(questionsPerPassage, count - i * questionsPerPassage)
            if (qCount <= 0) return Promise.resolve([])
            return tryGeneratePassageBatch(passage, qCount, i * questionsPerPassage + 1)
          })
        )
        allQuestions = passageQResults.flat()
      } else {
        // ── STANDARD PARALLEL BATCH FLOW ─────────────────────────────────────
        // Use allSettled so one failed batch (e.g. JSON parse error) doesn't
        // kill the whole request — successful batches still contribute questions
        // and the retry loop below fills any shortfall.
        const batchSettled = await Promise.allSettled(
          batches.map(b => tryGenerateBatch(b.count, b.startId))
        )
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

    // Deduplicate + fix first pass
    allQuestions = deduplicateAndFix(allQuestions)

    // ── Retry: up to 5 passes to fill any shortfall ──────────────────────────
    for (let retryPass = 1; retryPass <= 5 && allQuestions.length < count; retryPass++) {
      const missing = count - allQuestions.length
      console.warn(`Short by ${missing} questions (pass ${retryPass}) — retrying...`)
      try {
        let retryQs: any[]
        if (usePassageFlow && generatedPassages.length > 0) {
          // Retry using the first available passage so questions still match the text
          retryQs = await tryGeneratePassageBatch(generatedPassages[0], missing, allQuestions.length + 1)
        } else {
          retryQs = await tryGenerateBatch(missing, allQuestions.length + 1)
        }
        allQuestions.push(...deduplicateAndFix(retryQs))
      } catch (err: any) {
        console.error(`Retry pass ${retryPass} failed:`, err)
        break
      }
    }

    const minRequired = Math.max(1, Math.ceil(count * 0.8))
    if (allQuestions.length < minRequired) {
      return NextResponse.json(
        {
          error: `Failed to generate ${count} questions. The AI produced ${allQuestions.length}. Please try again with fewer questions or a different subject.`,
          produced: allQuestions.length,
          requested: count,
        },
        { status: 500 }
      )
    }

    if (allQuestions.length < count) {
      console.warn(`Returning ${allQuestions.length}/${count} questions after retries`)
    }

    // Trim to requested count (may be below target if we accepted partial set above minRequired)
    const targetCount = Math.min(count, allQuestions.length)
    if (allQuestions.length > targetCount) {
      allQuestions = allQuestions.slice(0, targetCount)
    }
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
        curriculumName, curriculumBlock: enrichedCurriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade,
        sourceText, sourceName: sourceLabel,
      })
      estimatedTime = et
    }

    const assessmentData: any = { questions: allQuestions, estimated_time: estimatedTime }

    if (!Array.isArray(assessmentData.questions)) {
      return NextResponse.json({ error: 'AI returned invalid question data. Please try again.' }, { status: 500 })
    }

    // Strip internal generation fields (keep diagram hints for exam prep with visuals)
    assessmentData.questions = assessmentData.questions.map((q: any) => {
      const { needs_passage, passage_hint, ...rest } = q
      if (!hasDiagramSupport) {
        const { needs_diagram, diagram_hint, ...clean } = rest
        return clean
      }
      return rest
    })

    // ── Tag each question with the subtopic it covers ──────────────────────────
    // Resolve the candidate subtopics for this assessment (the chosen subtopics,
    // or every subtopic under the chosen topics) and tag each question locally so
    // results can be scored per subtopic and cascade up the gap map.
    let taggedSubtopicIds: number[] = []
    try {
      let candidateSubtopics: Array<{ id: number; name: string; topic_id: number | null }> = resolvedSubtopics
      if (candidateSubtopics.length === 0 && topicIds.length > 0) {
        let sq = supabase
          .from('subtopics')
          .select('subtopic_id,subtopic,topic_id')
          .in('topic_id', topicIds)
        if (Number.isFinite(textbookId)) sq = sq.eq('textbook_id', textbookId)
        const { data: subRows } = await sq.order('subtopic')
        candidateSubtopics = (subRows ?? [])
          .filter((r: any) => Number.isFinite(r?.subtopic_id) && r?.subtopic)
          .map((r: any) => ({ id: Number(r.subtopic_id), name: String(r.subtopic), topic_id: Number.isFinite(r.topic_id) ? Number(r.topic_id) : null }))
      }
      if (candidateSubtopics.length > 0) {
        taggedSubtopicIds = tagQuestionsWithSubtopics(assessmentData.questions, candidateSubtopics)
      }
    } catch (tagErr) {
      console.error('Subtopic tagging skipped:', tagErr)
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
    }

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

    let { data: dbAssessment, error: dbError } = await supabase
      .from('assessments')
      .insert([assessmentPayload])
      .select()
      .single()

    // Graceful fallback if the StudyLab migration hasn't been applied yet
    // (the textbook_id/topic_ids/subtopic_ids columns won't exist).
    if (dbError && (dbError.code === 'PGRST204' || /column .* does not exist/i.test(String(dbError.message ?? '')) || /Could not find the .* column/i.test(String(dbError.message ?? '')))) {
      const { textbook_id: _t, topic_ids: _ti, subtopic_ids: _si, ...legacyPayload } = assessmentPayload
      const retry = await supabase
        .from('assessments')
        .insert([legacyPayload])
        .select()
        .single()
      dbAssessment = retry.data
      dbError = retry.error
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
