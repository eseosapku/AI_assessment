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

// Robust JSON parser: try native → jsonrepair → throw
function parseJsonRobust(text: string): any {
  // Strip markdown fences
  let t = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  // Extract first {...} block if there's leading noise
  if (!t.startsWith('{')) { const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0] }

  // 1. Try native parse first (fastest path)
  try { return JSON.parse(t) } catch { /* fall through */ }

  // 2. jsonrepair — handles unescaped quotes, bad escapes, trailing commas, etc.
  try { return JSON.parse(jsonrepair(t)) } catch { /* fall through */ }

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
        if (VALID_AFTER_SLASH.has(next)) {
          // Valid escape — keep as-is (handle \uXXXX too)
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


const PASSAGE_PROMPT = (question: string, subject: string, hint: string) => `You are creating a reading extract for a ${subject} exam paper.

QUESTION THE STUDENT WILL ANSWER: "${question}"
WHAT THE PASSAGE SHOULD BE: ${hint}

Write a high-quality reading extract. Requirements:
- AT LEAST 450 words (aim for 500–650 words)
- Prioritise public-domain literary authors (Dickens, Austen, Hardy, Brontë, Eliot, Conrad, Achebe, Shakespeare, etc.) OR write original literary-quality prose that matches the style of a CAIE/Cambridge unseen comprehension passage
- Rich in language techniques, vivid description, or strong argument — something worth analysing
- Natural paragraph breaks
- The student MUST be able to answer the question from this text

Return your response in this EXACT format (no extra text, no markdown):
PASSAGE:
[full passage text here, with blank lines between paragraphs]

SOURCE:
[Author, Full Title (Year), Chapter — e.g. "Charles Dickens, Great Expectations (1861), Chapter 1" or "Original passage written in the style of a CAIE IGCSE unseen comprehension text"]`

function parsePassageResponse(raw: string): { text: string; source: string } | null {
  const passageMatch = raw.match(/PASSAGE:\s*([\s\S]*?)(?=\nSOURCE:|$)/i)
  const sourceMatch = raw.match(/SOURCE:\s*([\s\S]*?)$/i)
  const text = passageMatch?.[1]?.trim() ?? ''
  const source = sourceMatch?.[1]?.trim() ?? 'Original passage'
  if (text.split(/\s+/).filter(Boolean).length < 120) return null
  return { text, source }
}

// ── Passage generation via Bedrock ───────────────────────────────────────────
async function generatePassageWithBedrock(
  question: string,
  subject: string,
  hint: string,
  callFn: (prompt: string, maxTokens: number) => Promise<string>
): Promise<{ text: string; source: string } | null> {
  try {
    const raw = await callFn(PASSAGE_PROMPT(question, subject, hint), 1400)
    return parsePassageResponse(raw)
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
function sharedPassageHint(groupIdx: number): string {
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
  callFn: (prompt: string, maxTokens: number) => Promise<string>
): Promise<void> {
  const needsWork = questions.filter(q => !q.passage)
  if (needsWork.length === 0) {
    questions.forEach(q => { delete q.needs_passage; delete q.passage_hint })
    return
  }

  const useShared = needsWork.length > 10
  const QS_PER_PASSAGE = 10

  if (useShared) {
    const numPassages = Math.ceil(needsWork.length / QS_PER_PASSAGE)
    const anchorResults = await Promise.all(
      Array.from({ length: numPassages }, (_, gi) => {
        const hint = sharedPassageHint(gi)
        const pivotQ = needsWork[gi * QS_PER_PASSAGE]?.question ?? ''
        const fullHint = `${hint}. The passage must support questions on: ${pivotQ.slice(0, 100)}`
        return generatePassageWithBedrock(pivotQ, subject, fullHint, callFn).catch(() => null)
      })
    )
    needsWork.forEach((q, i) => {
      const anchor = anchorResults[Math.floor(i / QS_PER_PASSAGE)]
      if (anchor) { q.passage = anchor.text; q.passage_source = anchor.source }
      delete q.needs_passage; delete q.passage_hint
    })
  } else {
    const jobs = needsWork.map(q => {
      if (!q.passage_hint) q.passage_hint = `A rich literary or non-fiction extract directly relevant to: "${q.question.slice(0, 120)}"`
      return q
    })
    await Promise.all(
      jobs.map(q =>
        generatePassageWithBedrock(q.question, subject, q.passage_hint, callFn)
          .then((result: { text: string; source: string } | null) => { if (result) { q.passage = result.text; q.passage_source = result.source } })
          .catch(() => null)
      )
    )
    jobs.forEach(q => { delete q.needs_passage; delete q.passage_hint })
  }

  questions.forEach(q => { delete q.needs_passage; delete q.passage_hint })
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

  const lfSchemaNoPassage = `{
      "id": <number>,
      "type": "longform",
      "question": "<question requiring an extended written answer>",
      "marks": <integer 2-8>,
      "marking_criteria": ["<criterion 1>", "<criterion 2>", "..."],
      "model_answer": "<80-120 word outline of a strong answer>",
      "explanation": "<what this question tests>"
    }`

  const activeLfSchema = subjectNeedsPassage ? lfSchema : lfSchemaNoPassage

  let questionsBlock = ''
  let questionInstruction = ''

  if (questionType === 'mcq') {
    questionInstruction = `Generate exactly ${count} multiple-choice questions.${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres.` : ''}`
    questionsBlock = `    ${mcqSchema}`
  } else if (questionType === 'longform') {
    questionInstruction = `Generate exactly ${count} long-form questions (4–8 marks each, one criterion per mark).${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres across the set.` : ''}`
    questionsBlock = `    ${activeLfSchema}`
  } else {
    questionInstruction = `Generate exactly ${count} questions: ${mcqCount} MCQ (type "mcq") and ${lfCount} long-form (type "longform") in a logical mixed order.${subjectNeedsPassage ? ` Add passage_hint to every question. Use at least 3 different authors/genres.` : ''}`
    questionsBlock = `    ${mcqSchema},
    ${activeLfSchema}`
  }

  const difficultyInstruction = difficultyLevel ? (DIFFICULTY_INSTRUCTIONS[difficultyLevel] ?? '') : ''

  const isPrimaryGrade = opts.grade && Number(opts.grade) >= 1 && Number(opts.grade) <= 6
  const gradeAgeNote = isPrimaryGrade
    ? `**GRADE CONTEXT:** This is Grade ${opts.grade} (Primary School, ages ${5 + Number(opts.grade)}–${6 + Number(opts.grade)}). ALL questions MUST be age-appropriate for young learners at this level. Use simple, clear vocabulary. Mathematics questions must use numbers appropriate for this grade. Do NOT include secondary-school level content.`
    : ''

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
- CRITICAL: The "question" field must contain ONLY the question text itself. Do NOT include the answer choices "(A) ..., (B) ..., (C) ..., (D) ..." inside the question field. The options go in the "options" array only.
- For sequence/order questions (e.g. "what comes after X"): make the question unambiguous and ensure the answer IS in the options.
- The explanation MUST describe the same answer as correct_answer. They must ALWAYS agree.

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

    // Skip when options are sequences (contain commas, e.g. "3, 5, 8, 12") — these are
    // ordering questions handled by fixOrderingQuestions, not numeric extraction.
    if (q.options.some((o: any) => String(o).includes(','))) continue

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
      // Addition word: "combining/adding X and Y", "add X more", "get X more", "X and Y more"
      const aw = text.match(/(?:combining|adding)\s+(\d+)\s+and\s+(\d+)/i)
        || text.match(/(\d+)\s+(?:\w+\s+){0,8}(?:add[s]?\s+(\d+)\s+more|get[s]?\s+(\d+)\s+more|and\s+(\d+)\s+more|plus\s+(\d+))/i)
        || text.match(/have\s+(\d+)\s+(?:\w+\s+){0,6}add[s]?\s+(\d+)/i)
      if (aw) {
        const b = Number(aw[2] || aw[3] || aw[4])
        if (Number.isFinite(b)) computed = +aw[1] + b
      }
    }

    if (computed !== null && Number.isFinite(computed)) {
      patchAnswer(q, computed)
      continue
    }

    // ── Strategy 2: Extract answer from explanation text ──────────────────────
    if (q.explanation) {
      const expl = (q.explanation as string).replace(/\$+/g, '').replace(/[−–]/g, '-')
      // Ordered by reliability: inline arithmetic first (AI math is right even when its
      // stated conclusion is wrong), then explicit statements, then looser matches.
      const patterns = [
        /\d+\s*[+\-×*]\s*\d+\s*=\s*(-?\d+(?:\.\d+)?)/,            // "5 + 3 = 8" — most reliable
        /missing\s+number\s+is\s+(-?\d+(?:\.\d+)?)/i,               // "missing number is 1"
        /the\s+(?:result|sum|total|difference|product|answer)\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /(?:therefore|thus|so|hence)[,\s]+(?:the\s+)?(?:correct\s+)?answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /(?:the\s+)?(?:only\s+)?correct\s+answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /equals?\s+(-?\d+(?:\.\d+)?)/i,
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
    // Catches any "which combination makes N?" / "adds up to N?" phrasing where
    // the AI put four valid sums as options. Keep the marked answer; replace others.
    // Guard: skip if the question is asking for an INCORRECT/wrong answer.
    const definedSums = optionSums.filter((s): s is number => s !== null)
    if (definedSums.length === 4 && definedSums.every(s => s === definedSums[0])) {
      const target = definedSums[0]
      const isNegativeQ = /\b(?:not|incorrect|wrong|false|does\s+not)\b/i.test(qText)
      if (!isNegativeQ && qText.includes(String(target))) {
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
        console.warn(`All-equal-sum fix: all 4 options summed to ${target}, kept idx ${keep}`)
        continue
      }
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
      // Some models need the "us." cross-region prefix (Nova, Llama).
      // Others (Gemma, GPT-OSS, some Mistral/NVIDIA) use bare IDs.
      // Try the ID as given first, then the alternative form on "invalid" errors.
      const alt = aiModel.startsWith('us.') ? aiModel.slice(3) : `us.${aiModel}`
      const candidates = [aiModel, alt]

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

    // ── Stage 1: Question skeleton generation (Bedrock or Groq) ──────────────
    // Batched: max 20 per call to stay within token limits.
    const BATCH_SIZE = 20

    async function tryGenerateBatch(batchCount: number, startId: number): Promise<any[]> {
      // Request a small surplus so even if the model runs short we hit the target count.
      // The surplus is stripped after deduplication.
      const requestCount = batchCount + Math.ceil(batchCount * 0.2)
      const { prompt } = buildPrompt({
        subject, topics, count: requestCount, startId, style,
        curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel, grade,
      })
      // Give generous token budget: ~500 tokens/question for MCQ, more for mixed/longform
      const maxTokens = requestCount <= 12 ? 5000 : 10000
      const text = await callBedrock(prompt, maxTokens)

      if (isRefusal(text)) throw new Error(`Model refused to generate content. Try a different AI model.`)
      const parsed = parseJsonRobust(fixLatexInRawJson(text))
      if (!Array.isArray(parsed.questions)) throw new SyntaxError('No questions array')
      return parsed.questions
    }

    // Split count into batches of BATCH_SIZE
    const batches: { count: number; startId: number }[] = []
    for (let i = 0; i < count; i += BATCH_SIZE) {
      batches.push({ count: Math.min(BATCH_SIZE, count - i), startId: i + 1 })
    }

    let allQuestions: any[] = []
    let estimatedTime = 0
    try {
      // Run batches sequentially to avoid saturating TPM
      for (const batch of batches) {
        const qs = await tryGenerateBatch(batch.count, batch.startId)
        allQuestions.push(...qs)
      }
    } catch (err: any) {
      console.error('Generation failed:', err)
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.error?.code === 'rate_limit_exceeded'
      const msg = is429
        ? 'AI is rate-limited. Please wait 30 seconds and try again.'
        : `Generation failed: ${err?.message ?? String(err)}`
      return NextResponse.json({ error: msg }, { status: is429 ? 429 : 500 })
    }

    // Strip embedded "(A)...(D)" options from question text before any processing
    cleanQuestionTexts(allQuestions)

    // Remove duplicate questions — normalise by stripping any residual option suffix before comparing
    const seenQuestions = new Set<string>()
    allQuestions = allQuestions.filter((q: any) => {
      const raw = (q.question || '').toLowerCase().trim()
      // Strip trailing MCQ option block "(a) ..." if present, then take first 100 chars
      const aIdx = raw.search(/\s*[\(\[]\s*a\s*[\)\]]/)
      const key = (aIdx > 10 ? raw.slice(0, aIdx) : raw).slice(0, 100)
      if (seenQuestions.has(key)) { console.warn(`Duplicate question removed: "${key.slice(0, 60)}"...`); return false }
      seenQuestions.add(key); return true
    })

    // Re-number questions sequentially in case the model drifted
    allQuestions.forEach((q, i) => { q.id = i + 1 })

    // Fix any MCQ questions where the AI put the wrong correct_answer index
    validateMcqAnswers(allQuestions)

    // Fix expression-option MCQs (e.g. number bond questions where options are "A+B")
    fixExpressionMcqs(allQuestions)
    fixOrderingQuestions(allQuestions)

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

    // ── Ensure passage fields are present for passage subjects ────────────────
    // LLMs sometimes forget to include needs_passage/passage_hint despite the prompt.
    // Stamp them here so generateAllPassages never silently skips a question.
    if (needsPassage(subject)) {
      assessmentData.questions.forEach((q: any) => {
        if (!q.passage_hint) {
          q.needs_passage = true
          q.passage_hint = `A rich reading extract that a student would need to answer this ${subject} question: "${q.question.slice(0, 120)}"`
        }
      })
    }

    // Strip diagram hint fields (diagram generation not supported)
    assessmentData.questions = assessmentData.questions.map((q: any) => {
      const { needs_diagram, diagram_hint, ...rest } = q
      return rest
    })

    // ── Stage 2b: Passages via Bedrock ───────────────────────────────────────
    if (needsPassage(subject)) {
      await generateAllPassages(assessmentData.questions, subject, callBedrock)
    } else {
      assessmentData.questions.forEach((q: any) => {
        delete q.needs_passage
        delete q.passage_hint
      })
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
