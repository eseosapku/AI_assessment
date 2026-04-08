import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { jsonrepair } from 'jsonrepair'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import { getCambridgeCurriculumContext, type CambridgeGrade } from '@/lib/cambridge-curriculum'
import { supabase } from '@/lib/supabase'

const MAX_DIAGRAMS = 4

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
}): { prompt: string; estimatedTime: number } {
  const { subject, topics, count, startId = 1, style, curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel } = opts

  const subjectNeedsPassage = needsPassage(subject)

  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const mcqTime = subjectNeedsPassage ? 4 : 2
  const lfTime = subjectNeedsPassage ? 12 : 8
  const estimatedTime = mcqCount * mcqTime + lfCount * lfTime

  const diagramNote = hasDiagramSupport
    ? `DIAGRAMS: For up to ${MAX_DIAGRAMS} MCQ questions where a visual is ESSENTIAL (geometry, circuits, anatomy, graphs), add "needs_diagram": true and "diagram_hint": "<description>". Skip for text/calculation questions.`
    : ''

  // IMPORTANT: we only ask for a short passage_hint here — the full passage is generated
  // separately by Gemini, not by this Groq call. This keeps the Groq output small.
  const passageNote = subjectNeedsPassage
    ? `PASSAGES: Every question MUST have a reading passage. Add these two fields to every question:
   - "needs_passage": true
   - "passage_hint": a 30-40 word description of the passage (e.g. "Opening of a Victorian novel by Dickens set in a London slum, describing poverty and injustice in gritty detail"). Use a DIFFERENT author/genre for each question — at least 3 distinct styles across the assessment.
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
  const isPrimaryLow = gradeNum >= 1 && gradeNum <= 2
  const lfMarksRange = isPrimaryLow ? '2-3' : '2-8'
  const lfQuestionDesc = isPrimaryLow
    ? '<simple word problem — e.g. "Manzi has 8 mangoes. He gives 3 away. How many does he have left? Show your working.">'
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

  const g = gradeNum
  let gradeAgeNote = ''
  if (g >= 1 && g <= 2) {
    gradeAgeNote = `**GRADE CONTEXT — Grade ${opts.grade} (Ages ${5 + g}–${6 + g}):**
- VOCABULARY: Use ONLY words a ${5 + g}–${6 + g} year old knows. Maximum 2 syllables per word (e.g. "big", "happy", "water", "school"). NO words like "comprehend", "demonstrate", "calculate", "evaluate", "analyse", "significant", or any word a child this age would not know.
- SENTENCE LENGTH: Maximum 8 words per sentence in question text. Keep it short and direct.
- NUMBERS: Use numbers 1–20 for addition/subtraction. No multiplication, fractions, or decimals unless explicitly in the topic.
- QUESTION STYLE: Simple, direct questions. "How many...?", "What colour...?", "Which is bigger...?". No complex sentence structures.
- Do NOT include secondary-school content of any kind.
- MCQ ANSWER UNIQUENESS: For any question about "which group can be divided by N" or "which numbers are multiples of N", you MUST verify that ALL three wrong options each contain at least one number that is NOT divisible/a multiple of N. Do NOT put two or more all-valid groups as options.
- DIVISION QUESTIONS: For division, ONLY ask direct computation questions (e.g. "What is 6 ÷ 2?") with single-number options. Do NOT ask "which group shows the correct way to divide X by Y" — this format is ambiguous and must not be used in Grade 1–2.
- LONG-FORM QUESTIONS: For Grade 1–2, long-form questions must be simple word problems ONLY. Example: "Manzi has 8 mangoes. He gives 3 to his friend. How many does he have left? Show your working." MAXIMUM 3 marks per long-form question. Do NOT ask children to design games, invent methods, write stories, propose ideas, or do any creative/abstract task. No Bloom's levels above "Apply". No "Design", "Propose", "Create", "Suggest", "Explain why", or "Compare" prompts — only "How many?", "Solve this problem:", "Work out:".`
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
    gradeAgeNote = ''  // Secondary — no restrictions needed
  }

  const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Total Questions:** ${count}
**Style:** ${style}
${gradeAgeNote ? `\n${gradeAgeNote}\n` : ''}
${difficultyInstruction ? `**${difficultyInstruction}**` : ''}

**Task:** ${questionInstruction}

**Requirements:**
1. All questions strictly based on the ${curriculumName} syllabus topics listed above.
2. ${difficultyInstruction || 'Vary difficulty: recall, application, analysis.'}
3. LaTeX math MUST be wrapped in dollar signs: $...$ for inline (e.g. $\\\\frac{1}{x}$, $\\\\sqrt{2}$, $x^2 + y^2$) and $$...$$ for display. This applies in ALL fields including explanations and model_answer. Never write bare LaTeX outside of dollar signs.
4. MCQ "explanation" field: 100-150 words. Write a thorough explanation covering: (a) the concept or skill this question tests, (b) exactly why the correct answer is right with specific reasoning, evidence, or working shown, (c) why each of the three wrong options is incorrect and what misconception leads a student to pick it. Do NOT just restate the question. Write in full sentences.
5. Longform "explanation" field: 40-60 words. State the skill being assessed (e.g. "This question tests inference skills..."), then describe what a strong answer must include. Longform "model_answer" field: MINIMUM 80 words, MAXIMUM 120 words. Write a full P.E.E. paragraph — Point, Evidence (quote or example), Explanation of effect — that a student could use as a model answer. Do NOT use bullet points.
6. Question "id" fields: number from ${startId} to ${startId + count - 1}.
${questionType !== 'longform' ? `7. ${diagramNote}` : ''}
8. ${passageNote}

**MCQ ANSWER INTEGRITY — NON-NEGOTIABLE:**
- Every MCQ must have EXACTLY ONE correct answer among the four options.
- The "correct_answer" field is a 0-based index (0=first option, 1=second, 2=third, 3=fourth). It MUST point to the option that is the ONLY correct answer.
- BEFORE writing each MCQ, mentally verify: "Is options[correct_answer] the one and only correct answer?" If not, rewrite.
- NEVER write a question where two or more options could both be correct. For example, if asking "which number bond to 10 is correct?", do NOT put multiple valid bonds (1+9, 2+8, 3+7, 5+5) as all four options — only ONE should be a correct bond and the other three must be WRONG (e.g. bonds that do NOT add to 10 like 3+8, 2+9, 4+5).
- NEVER write a question where none of the options is correct.
- NEVER generate the same question text twice. Every question in the assessment must test a DIFFERENT concept, fact, or calculation. Vary the numbers, operations, and contexts.
- Do NOT generate more than ONE ordering/sorting question per assessment. Use other question types for variety.
- Do NOT generate more than ONE number-bond question per assessment (e.g. "which bond adds up to 10"). These are repetitive — one is enough.
- Do NOT generate more than TWO "which number is larger/smaller" comparison questions. Vary the question types.
- QUESTION TYPE VARIETY: Across the full set of ${count} questions, use at least 5 different question categories (e.g. addition, subtraction, comparison, sequencing, word problem, place value, shapes, measurement, etc.). Do NOT repeat the same category more than twice in a row.
- For ordering/sorting questions (e.g. "correct order from smallest to largest"): ALL four options must be COMPLETE sequences of every number from the question. The correct sorted sequence MUST be one of the four options. NEVER use a bare number as an option for an ordering question.
- SINGLE CORRECT ANSWER RULE — NON-NEGOTIABLE: Every MCQ must have EXACTLY ONE correct option and THREE definitively wrong options. This applies to ALL question types without exception:
  • Times table / multiples: if asking "which is NOT in the 10 times table?", only ONE option must NOT be a multiple of 10 — the other three MUST all be multiples of 10. NEVER put four multiples of 10 as options for a "not in times table" question.
  • Even/odd questions: only one option should have the opposite parity.
  • Prime/composite: only one option should match or not match the property.
  • Any "which does NOT belong?" or "which IS X?" question: verify each option against the property before writing — three must clearly match the property, one must clearly not (or vice versa).
- CRITICAL: The "question" field must contain ONLY the question text itself. Do NOT include the answer choices "(A) ..., (B) ..., (C) ..., (D) ..." inside the question field. The options go in the "options" array only.
- For sequence/order questions (e.g. "what comes after X"): make the question unambiguous and ensure the answer IS in the options.
- The explanation MUST describe the same answer as correct_answer. They must ALWAYS agree.
- BANNED QUESTION FORMAT — "which GROUP of numbers can be divided by N / is divisible by N / are multiples of N": This format ALWAYS produces multiple correct answers (e.g. both "2,4,6" and "4,6,8" are fully divisible by 2). You MUST NEVER use it. Instead, ask about a SINGLE number: "Which of these numbers can be divided by 2 without a remainder?" with options like 3, 4, 7, 9 — where only ONE number is even.

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
  const lfCount  = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
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

// ── Post-generation MCQ answer validator ─────────────────────────────────────
// Two strategies in order of reliability:
// 1. Compute correct answer from question text arithmetic
// 2. Extract correct answer from explanation text (many patterns)
// If the answer is found but is NOT in the options, replace the AI-marked option
// with the correct value so the question is always answerable.
function validateMcqAnswers(questions: any[]): void {
  for (const q of questions) {
    if (q.type === 'longform' || !Array.isArray(q.options) || q.options.length !== 4) continue
    const ci = Number(q.correct_answer)
    if (isNaN(ci) || ci < 0 || ci > 3) q.correct_answer = 0

    // For divisibility/grouping questions (options contain commas like "2, 4, 6"):
    // Validate that ONLY ONE option has ALL numbers satisfying the divisibility property.
    if (q.options.some((o: any) => String(o).includes(','))) {
      const qText = (q.question || '').toLowerCase()
      const divByMatch = qText.match(/(?:can\s+be\s+)?divided?\s+by\s+(\d+)|multiple[s]?\s+of\s+(\d+)|divisible\s+by\s+(\d+)/i)
      if (divByMatch) {
        const divisor = Number(divByMatch[1] || divByMatch[2] || divByMatch[3])
        if (divisor > 1) {
          // For each option, check if ALL numbers in the group are divisible by divisor
          const allDivisible = (opt: any) => {
            const nums = String(opt).split(',').map((n: string) => Number(n.trim())).filter((n: number) => !isNaN(n))
            return nums.length > 0 && nums.every((n: number) => n % divisor === 0)
          }
          const validIndices = q.options.map((_: any, i: number) => i).filter((i: number) => allDivisible(q.options[i]))
          if (validIndices.length > 1) {
            // Multiple valid options — keep the AI-marked one as correct, fix the others
            // by replacing one number in each extra valid option with a non-divisible number
            for (const idx of validIndices) {
              if (idx === q.correct_answer) continue
              const nums = String(q.options[idx]).split(',').map((n: string) => n.trim())
              // Replace the last number with a nearby odd/non-divisible number
              const lastNum = Number(nums[nums.length - 1])
              const replacement = (lastNum % divisor === 0) ? lastNum + 1 : lastNum
              nums[nums.length - 1] = String(replacement % divisor !== 0 ? replacement : replacement + 1)
              q.options[idx] = nums.join(', ')
              console.warn(`Divisibility fix: option[${idx}] made non-all-divisible → "${q.options[idx]}"`)
            }
          }
        }
      }
      continue
    }

    // Skip when options are arithmetic expressions (e.g. "5+5", "3+7").
    const optionsAreExpressions = q.options.some((o: any) => /[+\-×÷\/]/.test(String(o)))
    if (optionsAreExpressions) continue

    // ── Strategy 1: Deterministic arithmetic from question text ───────────────
    const text = (q.question || '').replace(/\$+/g, '').trim()
    let computed: number | null = null

    const a = text.match(/(\d+)\s*\+\s*(\d+)\s*=?\s*\?/)
    if (a) computed = +a[1] + +a[2]
    if (computed === null) {
      const s = text.match(/(\d+)\s*[-−]\s*(\d+)\s*=?\s*\?/)
      if (s) computed = +s[1] - +s[2]
    }
    if (computed === null) {
      const m = text.match(/(\d+)\s*[×x*]\s*(\d+)\s*=?\s*\?/)
      if (m) computed = +m[1] * +m[2]
    }
    if (computed === null) {
      // "X + ? = Z" or "? + X = Z"
      const ma = text.match(/(\d+)\s*\+\s*\?\s*=\s*(\d+)/) || text.match(/\?\s*\+\s*(\d+)\s*=\s*(\d+)/)
      if (ma) computed = +ma[2] - +ma[1]
    }
    if (computed === null) {
      // "same sum: A + B and C + ?" → answer = (A+B) - C
      const sameSum = text.match(/(\d+)\s*\+\s*(\d+)\s+and\s+(\d+)\s*\+\s*\?/i)
      if (sameSum) computed = (+sameSum[1] + +sameSum[2]) - +sameSum[3]
    }
    if (computed === null) {
      // "number bond to Z for X" → Z - X
      const bf = text.match(/bond\s+to\s+(\d+)\s+for\s+(\d+)/i)
      if (bf) computed = +bf[1] - +bf[2]
    }
    if (computed === null) {
      // number bond fill: "X + ? ...bond... Z"
      const bfill = text.match(/(\d+)\s*\+\s*\?.*?(\d+)/)
      if (bfill && /bond/i.test(text)) { const v = +bfill[2] - +bfill[1]; if (v >= 0) computed = v }
    }
    if (computed === null) {
      const aft = text.match(/(?:comes?|right)\s+after\s+(\d+)/i)
      if (aft) computed = +aft[1] + 1
    }
    if (computed === null) {
      const bef = text.match(/(?:comes?|right)\s+before\s+(\d+)/i)
      if (bef) { const v = +bef[1] - 1; if (v >= 0) computed = v }
    }
    if (computed === null) {
      const diff = text.match(/difference\s+between\s+(\d+)\s+and\s+(\d+)/i)
      if (diff) computed = Math.abs(+diff[1] - +diff[2])
    }
    if (computed === null) {
      // Subtraction word: "X ... take away / give / minus Y"
      const sw = text.match(/(\d+)\s+(?:\w+\s+){0,8}(?:take\s+away|give[s]?(?:\s+away)?|subtract[s]?|minus|remove[s]?)\s+(\d+)/i)
      if (sw) computed = +sw[1] - +sw[2]
    }
    if (computed === null) {
      // "sum/total of A and B" — e.g. "What is the sum of 4 and 6?"
      const sumOf = text.match(/(?:sum|total)\s+of\s+(\d+)\s+and\s+(\d+)/i)
      if (sumOf) computed = +sumOf[1] + +sumOf[2]
    }
    if (computed === null) {
      // "product of A and B" — multiplication word form
      const prodOf = text.match(/product\s+of\s+(\d+)\s+and\s+(\d+)/i)
      if (prodOf) computed = +prodOf[1] * +prodOf[2]
    }
    if (computed === null) {
      // Addition word: "combining/adding X and Y", "add X more", "get X more", "X and Y more"
      const aw = text.match(/(?:combining|adding)\s+(\d+)\s+and\s+(\d+)/i)
        || text.match(/(\d+)\s+(?:\w+\s+){0,8}(?:add[s]?\s+(\d+)\s+more|get[s]?\s+(\d+)\s+more|and\s+(\d+)\s+more|plus\s+(\d+))/i)
        || text.match(/have\s+(\d+)\s+(?:\w+\s+){0,6}add[s]?\s+(\d+)/i)
      if (aw) {
        const b = Number(aw[2] || aw[3] || aw[4])
        if (Number.isFinite(b)) computed = +aw[1] + b
      }
    }
    if (computed === null) {
      // "gives/gave/bring/brought you X more" addition: "you have X ... gives you Y more"
      // e.g. "You have 5 apples. Your friend gives you 3 more. How many do you have now?"
      const giveMore = text.match(/have\s+(\d+)\s+(?:\w+[\s.]*){0,15}(?:gives?\s+(?:you\s+)?|gave\s+(?:you\s+)?|brings?\s+(?:you\s+)?|brought\s+(?:you\s+)?)(\d+)\s+more/i)
      if (giveMore) computed = +giveMore[1] + +giveMore[2]
    }
    if (computed === null) {
      // "X ... receives/gets/finds Y more": "have X ... receives Y"
      const receivesMore = text.match(/have\s+(\d+)\s+(?:\w+[\s.]*){0,15}(?:receives?\s+|gets?\s+|finds?\s+)(\d+)/i)
      if (receivesMore) computed = +receivesMore[1] + +receivesMore[2]
    }
    if (computed === null) {
      // Money/purchase word problem: "have X ... buy/cost Y ... left/change"
      // e.g. "If you have 12 Frw and you buy a toy that costs 6 Frw, how much money will you have left?"
      const moneyW = text.match(/have\s+(\d+)\s+(?:\w+\s*){0,12}(?:costs?\s+(?:\w+\s*){0,4}(\d+)|buy[s]?\s+(?:\w+\s*){0,6}(\d+))/i)
      if (moneyW) {
        const cost = Number(moneyW[2] || moneyW[3])
        if (Number.isFinite(cost) && +moneyW[1] >= cost) computed = +moneyW[1] - cost
      }
    }

    if (computed !== null && Number.isFinite(computed)) {
      patchAnswer(q, computed)
      continue
    }

    // ── Strategy 2: Extract answer from explanation text ──────────────────────
    if (q.explanation) {
      const expl = (q.explanation as string).replace(/\$+/g, '').replace(/[−–]/g, '-')
      // Ordered by reliability: arithmetic expressions first — the AI's math is right
      // even when its stated conclusion contradicts it (e.g. "correct answer is 7 because 5+3=8").
      // "answer is N" patterns come LAST because the AI often states them wrongly.
      const patterns = [
        /\d+\s*[+\-×*]\s*\d+\s*=\s*(-?\d+(?:\.\d+)?)/,                     // "5 + 3 = 8" — most reliable
        /\d+\s*[+\-×*]\s*\d+\s+equals?\s+(-?\d+(?:\.\d+)?)/i,               // "5 + 3 equals 8"
        /(?:sum|total)\s+of\s+\d+\s+and\s+\d+\s+is\s+(-?\d+)/i,             // "sum of 4 and 6 is 10"
        /missing\s+number\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /(?:therefore|thus|so|hence)[,\s]+(?:the\s+)?(?:correct\s+)?answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /(?:the\s+)?(?:only\s+)?correct\s+answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        // "the result/sum/total/answer is N" — unreliable when AI contradicts itself; check last
        /the\s+(?:result|sum|total|difference|product|answer)\s+is\s+(-?\d+(?:\.\d+)?)/i,
      ]
      for (const pat of patterns) {
        const m = expl.match(pat)
        if (m) {
          const val = Number(m[1])
          if (Number.isFinite(val)) {
            patchAnswer(q, val)
            break
          }
        }
      }
    }
  }
}

// Replace correct_answer index. If the computed answer isn't in the options,
// replace the option the AI marked as correct with the right value.
function patchAnswer(q: any, expected: number): void {
  if (!Number.isFinite(expected)) return
  const optNum = (o: any) => Number(String(o).replace(/[^0-9.\-]/g, ''))
  const currentVal = optNum(q.options[q.correct_answer])
  if (currentVal === expected) return // already correct

  const existingIdx = q.options.findIndex((o: any) => optNum(o) === expected)
  if (existingIdx !== -1) {
    // Answer is in the list — just fix the index
    console.warn(`MCQ idx fix: "${q.question?.slice(0, 55)}" → ${q.correct_answer}(${q.options[q.correct_answer]}) → ${existingIdx}(${q.options[existingIdx]})`)
    q.correct_answer = existingIdx
  } else {
    // Answer is NOT in the options at all — replace the AI-marked option with the correct value
    console.warn(`MCQ option fix: "${q.question?.slice(0, 55)}" — replacing option[${q.correct_answer}]="${q.options[q.correct_answer]}" with "${expected}"`)
    q.options[q.correct_answer] = String(expected)
    // options stay sorted as the AI intended but the marked slot now has the right value
  }
}

// ── Expression-option MCQ fixer ────────────────────────────────────────────────
// Handles questions where options are expressions like "3+7", "2+8".
// Validates number-bond style questions deterministically by evaluating each option.
function fixExpressionMcqs(questions: any[]): void {
  for (const q of questions) {
    if (q.type === 'longform' || !Array.isArray(q.options) || q.options.length !== 4) continue

    // Only apply to questions where options look like arithmetic expressions
    const optionSums: (number | null)[] = q.options.map((o: any) => {
      const m = String(o).match(/(\d+)\s*\+\s*(\d+)/)
      return m ? +m[1] + +m[2] : null
    })
    if (optionSums.every(s => s === null)) continue // no expression options

    const qText = (q.question || '').toLowerCase()

    // ── General: ALL 4 expression options sum to the SAME value ───────────────
    // When all 4 options are equally valid (or equally invalid) the question is broken.
    // Positive question → keep the AI-marked answer, make the other 3 wrong sums.
    // Negative question ("which is incorrect?") → create one wrong sum and mark it correct.
    const definedSums = optionSums.filter((s): s is number => s !== null)
    if (definedSums.length === 4 && definedSums.every(s => s === definedSums[0])) {
      const target = definedSums[0]
      const isNegativeQ = /\b(?:not|incorrect|wrong|false|does\s+not)\b/i.test(qText)
      if (!isNegativeQ) {
        // Positive: keep marked answer, replace others with invalid sums
        const keep = q.correct_answer
        let seed = 0
        for (let i = 0; i < 4; i++) {
          if (i !== keep) {
            const offset = [1, -1, 2, -2][seed % 4]
            const wrongSum = Math.max(2, target + offset)
            const a = Math.max(1, Math.floor(wrongSum / 2))
            q.options[i] = `${a} + ${Math.max(1, wrongSum - a)}`
            seed++
          }
        }
        console.warn(`All-equal-sum fix (+): all 4 summed to ${target}, kept idx ${keep}`)
      } else {
        // Negative: all options are valid → replace one with a wrong sum and mark it as answer
        const replaceIdx = q.correct_answer === 0 ? 1 : 0
        const wrongSum = target + 1
        const a = Math.max(1, Math.floor(wrongSum / 2))
        q.options[replaceIdx] = `${a} + ${Math.max(1, wrongSum - a)}`
        q.correct_answer = replaceIdx
        console.warn(`All-equal-sum fix (-): all 4 summed to ${target}, created wrong option at idx ${replaceIdx}`)
      }
      continue
    }

    // ── "Which number bond to N is correct?" ──────────────────────────────────
    const correctMatch = qText.match(/bond\s+to\s+(\d+)\s+is\s+correct/i)
      || qText.match(/correct\s+number\s+bond\s+to\s+(\d+)/i)
      || qText.match(/bond.*(?:correctly\s+)?adds?\s+up\s+to\s+(\d+)/i)
      || qText.match(/bond.*(?:equals?|sums?\s+to)\s+(\d+)/i)
    if (correctMatch) {
      const target = Number(correctMatch[1])
      const validIndices = optionSums.map((s, i) => s === target ? i : -1).filter(i => i !== -1)
      if (validIndices.length === 0) {
        // No valid bond at all — put one at the correct_answer slot
        q.options[q.correct_answer] = `${Math.floor(target / 2)} + ${target - Math.floor(target / 2)}`
        console.warn(`Bond fix (correct, no valid): replaced option[${q.correct_answer}] with valid bond`)
      } else {
        // Keep one valid bond (prefer the AI-marked index if it's valid, else take first)
        const keep = validIndices.includes(q.correct_answer) ? q.correct_answer : validIndices[0]
        q.correct_answer = keep
        // Replace every OTHER option that also sums to target with an invalid bond
        let seed = 0
        for (let i = 0; i < 4; i++) {
          if (i !== keep && optionSums[i] === target) {
            const offset = [1, -1, 2, -2][seed % 4]
            const wrongSum = target + offset
            const a = Math.max(1, Math.floor(wrongSum / 2))
            q.options[i] = `${a} + ${Math.max(1, wrongSum - a)}`
            seed++
          }
        }
        if (seed > 0) console.warn(`Bond fix (correct, dupes): kept idx ${keep}, replaced ${seed} duplicate valid bonds`)
      }
      continue
    }

    // ── "Which number bond to N is incorrect?" ────────────────────────────────
    const incorrectMatch = qText.match(/bond\s+to\s+(\d+)\s+is\s+incorrect/i)
      || qText.match(/incorrect\s+number\s+bond\s+to\s+(\d+)/i)
      || qText.match(/not\s+a\s+(?:correct\s+)?number\s+bond\s+to\s+(\d+)/i)
    if (incorrectMatch) {
      const target = Number(incorrectMatch[1])
      // The correct answer must be the option that does NOT sum to target
      const incorrectIdx = optionSums.findIndex(s => s !== null && s !== target)
      if (incorrectIdx !== -1 && incorrectIdx !== q.correct_answer) {
        console.warn(`Bond fix (incorrect): "${q.question.slice(0,60)}" → idx ${q.correct_answer} → ${incorrectIdx}`)
        q.correct_answer = incorrectIdx
      } else if (incorrectIdx === -1) {
        // All options sum to target — replace one distractor with a non-bond
        const replaceIdx = q.correct_answer === 0 ? 1 : 0
        q.options[replaceIdx] = `${Math.floor(target / 2)} + ${Math.floor(target / 2) + 1}` // e.g. 5+6 for target 10
        q.correct_answer = replaceIdx
        console.warn(`Bond fix (incorrect, replace): all options were valid bonds for target ${target}`)
      }
      continue
    }
  }
}

// ── Ordering question fixer ───────────────────────────────────────────────────
// Handles "correct order from smallest to largest / largest to smallest" questions.
// Deterministically computes the correct sorted sequence and ensures it is one of
// the four options. Also fixes the correct_answer index if it points to the wrong one.
function fixOrderingQuestions(questions: any[]): void {
  const norm = (s: any) => String(s).replace(/\s+/g, '').toLowerCase()

  for (const q of questions) {
    if (q.type === 'longform' || !Array.isArray(q.options) || q.options.length !== 4) continue
    // Only applies when options are sequences (comma-separated)
    if (!q.options.some((o: any) => String(o).includes(','))) continue

    const ascending = /smallest\s+to\s+largest|ascending\s+order|increasing\s+order/i.test(q.question)
    const descending = /largest\s+to\s+smallest|descending\s+order|decreasing\s+order/i.test(q.question)
    if (!ascending && !descending) continue

    // Extract all numbers from the question text
    const nums = (q.question.match(/\d+/g) || []).map(Number)
    if (nums.length < 2) continue

    const sorted = ascending
      ? [...nums].sort((a, b) => a - b)
      : [...nums].sort((a, b) => b - a)
    const correctSeq = sorted.join(', ')
    const correctNorm = norm(correctSeq)

    const existingIdx = q.options.findIndex((o: any) => norm(o) === correctNorm)
    if (existingIdx !== -1) {
      if (existingIdx !== q.correct_answer) {
        console.warn(`Ordering fix: "${q.question.slice(0, 60)}" → idx ${q.correct_answer} → ${existingIdx}`)
        q.correct_answer = existingIdx
      }
    } else {
      // Correct sequence not in options — replace the AI-marked slot with it
      console.warn(`Ordering fix: "${correctSeq}" missing — replacing option[${q.correct_answer}]`)
      q.options[q.correct_answer] = correctSeq
    }
  }
}

// ── Times-table / divisibility question fixer ────────────────────────────────
// Handles "Which is [NOT] in the N times table?" and similar divisibility questions.
// Ensures EXACTLY ONE option has the required property.
function fixTimesTableQuestions(questions: any[]): void {
  for (const q of questions) {
    if (q.type === 'longform' || !Array.isArray(q.options) || q.options.length !== 4) continue
    const qText = (q.question || '').toLowerCase()

    // Detect times-table questions: "N times table" or "multiples of N"
    const timesMatch = qText.match(/(\d+)\s+times\s+table/i) || qText.match(/multiples?\s+of\s+(\d+)/i)
    if (!timesMatch) continue
    const n = Number(timesMatch[1])
    if (!Number.isFinite(n) || n < 2) continue

    // Parse all options as plain numbers
    const optNums: (number | null)[] = q.options.map((o: any) => {
      const v = Number(String(o).trim())
      return Number.isFinite(v) && v > 0 ? v : null
    })
    if (optNums.some(v => v === null)) continue // skip non-numeric options

    const isMult = (v: number) => v % n === 0
    // A non-multiple replacement: pick base + smallest offset that isn't also a multiple
    const nonMultiple = (base: number) => {
      let off = Math.max(1, Math.ceil(n * 0.5))
      while ((base + off) % n === 0) off++
      return base + off
    }
    // A multiple replacement: round to nearest multiple
    const nearestMult = (base: number) => {
      const m = Math.round(base / n) * n
      return m > 0 ? m : n * 3
    }

    const isNegativeQ = /\b(?:not\b|isn'?t|is\s+not)\b/i.test(qText)

    if (isNegativeQ) {
      // "NOT in N times table" → need exactly ONE non-multiple (the answer), THREE multiples
      const nonMultIdxs = (optNums as number[]).map((v, i) => !isMult(v) ? i : -1).filter(i => i !== -1)

      if (nonMultIdxs.length === 0) {
        // All options are multiples → replace AI-marked option with a non-multiple
        const base = optNums[q.correct_answer] as number
        q.options[q.correct_answer] = String(nonMultiple(base))
        console.warn(`TimesTable fix (-): all multiples of ${n}, replaced option[${q.correct_answer}]`)
      } else {
        // Ensure correct_answer points to the non-multiple
        const keep = nonMultIdxs.includes(q.correct_answer) ? q.correct_answer : nonMultIdxs[0]
        q.correct_answer = keep
        // Replace any extra non-multiples with proper multiples
        for (const idx of nonMultIdxs) {
          if (idx !== keep) {
            q.options[idx] = String(nearestMult(optNums[idx] as number))
            console.warn(`TimesTable fix (-): replaced extra non-multiple at idx ${idx}`)
          }
        }
      }
    } else {
      // "In N times table" → need exactly ONE multiple (the answer), THREE non-multiples
      const multIdxs = (optNums as number[]).map((v, i) => isMult(v) ? i : -1).filter(i => i !== -1)

      if (multIdxs.length === 0) {
        // No multiples → replace AI-marked option with a multiple
        const base = optNums[q.correct_answer] as number
        q.options[q.correct_answer] = String(nearestMult(base))
        console.warn(`TimesTable fix (+): no multiples of ${n}, replaced option[${q.correct_answer}]`)
      } else {
        const keep = multIdxs.includes(q.correct_answer) ? q.correct_answer : multIdxs[0]
        q.correct_answer = keep
        // Replace extra multiples with non-multiples
        for (const idx of multIdxs) {
          if (idx !== keep) {
            q.options[idx] = String(nonMultiple(optNums[idx] as number))
            console.warn(`TimesTable fix (+): replaced extra multiple at idx ${idx}`)
          }
        }
      }
    }
  }
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, topics, count, style, className, grade, curriculum, user_id, questionType = 'mcq', difficultyLevel, aiModel = 'us.amazon.nova-lite-v1:0', customTime } = body

    if (!subject || !topics || !count) {
      return NextResponse.json({ error: 'Subject, topics, and count are required' }, { status: 400 })
    }

    let curriculumBlock = ''
    if (curriculum === 'rwanda-reb' && grade) {
      curriculumBlock = getCurriculumContext(grade as GradeLevel, subject, topics)
    } else if (curriculum === 'cambridge' && grade) {
      curriculumBlock = getCambridgeCurriculumContext(grade as CambridgeGrade, subject, topics)
    } else if (className) {
      curriculumBlock = `**Target Audience:** ${className}`
    }

    const isCambridge = curriculum === 'cambridge'
    const curriculumName = isCambridge ? 'Cambridge International (CAIE)' : 'Rwanda National Competence-Based Curriculum (REB)'
    const hasDiagramSupport = false

    // ── Bedrock client ────────────────────────────────────────────────────────
    const bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    const stripPrefix = (id: string) => id.replace(/^(us|eu|ap)\./, '')

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
      return JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.2 })
    }

    function extractBedrockText(modelId: string, body: any): string {
      const m = stripPrefix(modelId)
      if (m.startsWith('amazon.nova')) return body?.output?.message?.content?.[0]?.text ?? ''
      if (m.startsWith('meta.llama'))  return body?.generation ?? ''
      return body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? body?.outputs?.[0]?.text ?? ''
    }

    async function callBedrock(prompt: string, maxTokens: number): Promise<string> {
      // Derive the correct regional prefix from the configured AWS region.
      // Nova and Llama models require a cross-region inference prefix (us./eu./ap.).
      const awsRegion = process.env.AWS_REGION ?? 'us-east-1'
      const regionPrefix = awsRegion.startsWith('eu') ? 'eu' : awsRegion.startsWith('ap') ? 'ap' : 'us'
      const bareId = aiModel.replace(/^(us|eu|ap)\./, '')
      const prefixedId = `${regionPrefix}.${bareId}`
      // Try: region-prefixed ID first, then original from request, then bare ID
      const candidates = [...new Set([prefixedId, aiModel, bareId])]

      let lastErr: any
      for (const modelId of candidates) {
        try {
          const cmd = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: buildBedrockBody(modelId, prompt, maxTokens),
          })
          const res = await bedrockClient!.send(cmd)
          const parsed = JSON.parse(new TextDecoder().decode(res.body))
          return extractBedrockText(modelId, parsed)
        } catch (err: any) {
          lastErr = err
          const msg = err?.message ?? ''
          const retryable = msg.includes('invalid') || msg.includes('Invalid') ||
                            msg.includes('on-demand throughput') || msg.includes('ValidationException')
          if (retryable) { console.warn(`Bedrock ${modelId} failed — trying alternate ID...`); continue }
          throw err
        }
      }
      throw lastErr
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
        subject, topics, count: requestCount, startId, style,
        curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade,
      })
      // Nova Lite hard limit is 5120 output tokens. Cap at 4800 to leave JSON-framing headroom.
      // ~300-350 tokens per MCQ question (question + options + explanation).
      const maxTokens = Math.min(4800, Math.max(2000, requestCount * 420))
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
        subject, count: requestCount, startId, style,
        curriculumName, curriculumBlock, questionType,
        difficultyLevel, grade,
      })
      const maxTokens = Math.min(4800, Math.max(2000, requestCount * 500))
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
      const seenQuestions = new Set<string>()
      const deduped = qs.filter((q: any) => {
        const raw = (q.question || '').toLowerCase().trim()
        const aIdx = raw.search(/\s*[\(\[]\s*a\s*[\)\]]/)
        const key = (aIdx > 10 ? raw.slice(0, aIdx) : raw).slice(0, 100)
        if (seenQuestions.has(key)) { console.warn(`Duplicate question removed: "${key.slice(0, 60)}"...`); return false }
        seenQuestions.add(key); return true
      })
      validateMcqAnswers(deduped)
      fixExpressionMcqs(deduped)
      fixOrderingQuestions(deduped)
      fixTimesTableQuestions(deduped)
      return deduped
    }

    try {
      if (needsPassage(subject)) {
        // ── PASSAGE-FIRST FLOW ────────────────────────────────────────────────
        // Step 1: Generate passages in parallel (one per 10 questions).
        // Step 2: Generate questions per passage in parallel — each question
        //         is written about the actual passage text, so it can never
        //         reference features that don't exist.
        const numPassages = Math.max(1, Math.ceil(count / 10))
        const questionsPerPassage = Math.ceil(count / numPassages)

        // Build a topic-aware hint so passages are relevant to what was selected
        const topicHint = topics.length > 0
          ? `${topics.slice(0, 2).join(' and ')} — relevant to a ${subject} assessment`
          : ''

        const rawPassages = await Promise.all(
          Array.from({ length: numPassages }, (_, i) => {
            const baseHint = sharedPassageHint(i, grade)
            const fullHint = topicHint ? `${baseHint}. Topic focus: ${topicHint}` : baseHint
            return generatePassageWithBedrock('', subject, fullHint, callBedrock, grade)
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

    // ── Retry: up to 3 passes to fill any shortfall ──────────────────────────
    for (let retryPass = 1; retryPass <= 3 && allQuestions.length < count; retryPass++) {
      const missing = count - allQuestions.length
      console.warn(`Short by ${missing} questions (pass ${retryPass}) — retrying...`)
      try {
        let retryQs: any[]
        if (needsPassage(subject) && generatedPassages.length > 0) {
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

    // If STILL short after all retries → return error
    if (allQuestions.length < count) {
      return NextResponse.json(
        { error: `Failed to generate ${count} questions. The AI produced ${allQuestions.length}. Please try again.` },
        { status: 500 }
      )
    }

    // Trim to EXACTLY the requested count (the 20% surplus buffer may have pushed us over)
    if (allQuestions.length > count) {
      allQuestions = allQuestions.slice(0, count)
    }
    // Final re-number after trim
    allQuestions.forEach((q: any, i: number) => { q.id = i + 1 })

    // Use custom time if provided, otherwise calculate from prompt helper
    if (customTime && customTime > 0) {
      estimatedTime = Number(customTime)
    } else {
      const { estimatedTime: et } = buildPrompt({
        subject, topics, count, startId: 1, style,
        curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel,
      })
      estimatedTime = et
    }

    const assessmentData: any = { questions: allQuestions, estimated_time: estimatedTime }

    if (!Array.isArray(assessmentData.questions)) {
      return NextResponse.json({ error: 'AI returned invalid question data. Please try again.' }, { status: 500 })
    }

    // Strip internal generation fields
    assessmentData.questions = assessmentData.questions.map((q: any) => {
      const { needs_diagram, diagram_hint, needs_passage, passage_hint, ...rest } = q
      return rest
    })

    // ── Stage 2b: Passages ────────────────────────────────────────────────────
    // For passage subjects using the passage-first flow, questions already have
    // q.passage set. Only run generateAllPassages for any stragglers that somehow
    // lack a passage (edge case), then skip fixupPassageQuestions entirely since
    // questions were written about the actual passage from the start.
    if (needsPassage(subject)) {
      const missing = assessmentData.questions.filter((q: any) => !q.passage)
      if (missing.length > 0) {
        // Fallback: stamp the first generated passage or generate fresh ones
        if (generatedPassages.length > 0) {
          missing.forEach((q: any) => { q.passage = generatedPassages[0].text; q.passage_source = generatedPassages[0].source })
        } else {
          await generateAllPassages(missing, subject, callBedrock, grade)
          await fixupPassageQuestions(missing, callBedrock)
        }
      }
    }

    // ── Save to database ───────────────────────────────────────────────────────
    const { data: dbAssessment, error: dbError } = await supabase
      .from('assessments')
      .insert([{
        user_id: user_id || null,
        subject,
        difficulty: style,
        duration: estimatedTime,
        questions_data: assessmentData.questions,
        status: 'completed',
      }])
      .select()
      .single()

    if (dbError) console.error('DB save error:', dbError)

    return NextResponse.json({
      ...assessmentData,
      assessment_id: dbAssessment?.id || assessmentData.assessment_id,
      subject,
      topics,
      style,
      curriculum,
      questionType,
    })
  } catch (error: any) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: `Failed to generate assessment: ${error?.message || String(error)}` },
      { status: 500 }
    )
  }
}
