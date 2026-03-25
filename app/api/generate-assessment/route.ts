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

// ── Gemini helper (used for both diagrams AND passages) ───────────────────────
async function callGemini(prompt: string, geminiKey: string, maxTokens = 2048): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: maxTokens },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── SVG diagram generation via Gemini ─────────────────────────────────────────
async function generateDiagramSvg(
  question: string,
  subject: string,
  hint: string,
  geminiKey: string
): Promise<string | null> {
  try {
    const raw = await callGemini(`You are an expert educational diagram creator. Generate a precise SVG diagram.

QUESTION: "${question}"
SUBJECT: ${subject}
WHAT TO DRAW: ${hint}

RULES:
1. Return ONLY raw SVG. No markdown, no backticks.
2. Start with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
3. End with: </svg>
4. Never spoil the answer. Use a red "X" marker (fill="#dc2626") to indicate the focus area.
5. All other shapes: stroke="#1e293b" stroke-width="2" fill="none".
6. Use font-family="sans-serif" for text.

Generate now:`, geminiKey, 2048)

    const cleaned = raw.replace(/```svg\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/<svg[\s\S]*?<\/svg>/i)
    return match ? match[0] : null
  } catch {
    return null
  }
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

// ── Passage generation via Gemini (preferred — generous token limits) ──────────
async function generatePassageWithGemini(
  question: string,
  subject: string,
  hint: string,
  geminiKey: string
): Promise<{ text: string; source: string } | null> {
  try {
    const raw = await callGemini(PASSAGE_PROMPT(question, subject, hint), geminiKey, 1800)
    return parsePassageResponse(raw)
  } catch (err) {
    console.error('Gemini passage generation failed:', err)
    return null
  }
}

// ── Passage generation via Groq (fallback — uses llama-3.1-8b-instant, separate TPM bucket) ──
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
// For ≤10 questions: one passage per question (original approach).
// For >10 questions: group into anchor passages (1 per 10 Qs) so we make at
// most 4 passage API calls for 40 questions — well within Groq's free TPM.
async function generateAllPassages(
  questions: any[],
  geminiKey: string,
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
        const gen = geminiKey
          ? generatePassageWithGemini(pivotQ, subject, fullHint, geminiKey)
              .then(r => r ?? generatePassageWithBedrock(pivotQ, subject, fullHint, callFn))
          : generatePassageWithBedrock(pivotQ, subject, fullHint, callFn)
        return gen.catch(() => null)
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
      jobs.map(q => {
        const gen = geminiKey
          ? generatePassageWithGemini(q.question, subject, q.passage_hint, geminiKey)
              .then((r: { text: string; source: string } | null) => r ?? generatePassageWithBedrock(q.question, subject, q.passage_hint, callFn))
          : generatePassageWithBedrock(q.question, subject, q.passage_hint, callFn)
        return gen
          .then((result: { text: string; source: string } | null) => { if (result) { q.passage = result.text; q.passage_source = result.source } })
          .catch(() => null)
      })
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

  const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Total Questions:** ${count}
**Style:** ${style}
${difficultyInstruction ? `**${difficultyInstruction}**` : ''}

**Task:** ${questionInstruction}

**Requirements:**
1. All questions strictly based on the ${curriculumName} syllabus topics.
2. ${difficultyInstruction || 'Vary difficulty: recall, application, analysis.'}
3. LaTeX math MUST be wrapped in dollar signs: $...$ for inline (e.g. $\\\\frac{1}{x}$, $\\\\sqrt{2}$, $x^2 + y^2$) and $$...$$ for display. This applies in ALL fields including explanations and model_answer. Never write bare LaTeX outside of dollar signs.
4. MCQ "explanation" field: 100-150 words. Write a thorough explanation covering: (a) the concept or skill this question tests, (b) exactly why the correct answer is right with specific reasoning, evidence, or working shown, (c) why each of the three wrong options is incorrect and what misconception leads a student to pick it. Do NOT just restate the question. Write in full sentences.
5. Longform "explanation" field: 40-60 words. State the skill being assessed (e.g. "This question tests inference skills..."), then describe what a strong answer must include. Longform "model_answer" field: MINIMUM 80 words, MAXIMUM 120 words. Write a full P.E.E. paragraph — Point, Evidence (quote or example), Explanation of effect — that a student could use as a model answer. Do NOT use bullet points.
6. Question "id" fields: number from ${startId} to ${startId + count - 1}.
${questionType !== 'longform' ? `7. ${diagramNote}` : ''}
8. ${passageNote}

**CRITICAL: Return ONLY valid JSON. No markdown. No extra text.**

Schema:
{
  "assessment_id": "auto",
  "estimated_time": ${estimatedTime},
  "questions": [
${questionsBlock}
  ]
}

Generate all ${count} questions now.`

  return { prompt, estimatedTime }
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY ?? ''

    const body = await request.json()
    const { subject, topics, count, style, className, grade, curriculum, user_id, questionType = 'mcq', difficultyLevel, aiModel = 'us.amazon.nova-micro-v1:0', customTime } = body

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
    const hasDiagramSupport = geminiKey.length > 0

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
          inferenceConfig: { maxTokens, temperature: 0.7 },
        })
      }
      if (m.startsWith('meta.llama')) {
        return JSON.stringify({
          prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
          max_gen_len: maxTokens,
          temperature: 0.7,
        })
      }
      // mistral, google, nvidia, openai on Bedrock
      return JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.7 })
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
      const { prompt } = buildPrompt({
        subject, topics, count: batchCount, startId, style,
        curriculumName, curriculumBlock, questionType, hasDiagramSupport, difficultyLevel,
      })
      const maxTokens = batchCount <= 10 ? 3500 : 6000
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

    // Re-number questions sequentially in case the model drifted
    allQuestions.forEach((q, i) => { q.id = i + 1 })

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

    // ── Stage 2a: SVG diagrams via Gemini (parallel, MCQ only) ───────────────
    if (hasDiagramSupport) {
      const diagramJobs = assessmentData.questions
        .map((q: any, idx: number) => ({ q, idx }))
        .filter(({ q }: any) => q.type !== 'longform' && q.needs_diagram && q.diagram_hint)
        .slice(0, MAX_DIAGRAMS)

      if (diagramJobs.length > 0) {
        const svgResults = await Promise.all(
          diagramJobs.map(({ q }: any) =>
            generateDiagramSvg(q.question, subject, q.diagram_hint, geminiKey)
          )
        )
        svgResults.forEach((svg, i) => {
          if (svg) assessmentData.questions[diagramJobs[i].idx].diagram_svg = svg
        })
      }

      assessmentData.questions = assessmentData.questions.map((q: any) => {
        const { needs_diagram, diagram_hint, ...rest } = q
        return rest
      })
    }

    // ── Stage 2b: Passages — Gemini preferred, Bedrock fallback ─────────────
    if (needsPassage(subject)) {
      await generateAllPassages(assessmentData.questions, geminiKey, subject, callBedrock)
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
