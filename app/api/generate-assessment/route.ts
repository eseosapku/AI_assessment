import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import { getCambridgeCurriculumContext, type CambridgeGrade } from '@/lib/cambridge-curriculum'

const MAX_DIAGRAMS = 4

function fixLatexInRawJson(raw: string): string {
  return raw.replace(/(?<!\\)\\(?!["\\/nrtbfuU])([a-zA-Z])/g, '\\\\$1')
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

// ── Passage generation via Gemini (free tier: 15 RPM, generous tokens) ────────
async function generatePassageWithGemini(
  question: string,
  subject: string,
  hint: string,
  geminiKey: string
): Promise<{ text: string; source: string } | null> {
  try {
    const raw = await callGemini(`You are creating a reading extract for a ${subject} exam paper.

QUESTION THE STUDENT WILL ANSWER: "${question}"
WHAT THE PASSAGE SHOULD BE: ${hint}

Write a high-quality reading extract. Requirements:
- AT LEAST 500 words (aim for 550–700 words)
- Prioritise public-domain literary authors (Dickens, Austen, Hardy, Brontë, Eliot, Conrad, Achebe, Shakespeare, etc.) OR write original literary-quality prose that matches the style of a CAIE/Cambridge unseen comprehension passage
- Rich in language techniques, vivid description, or strong argument — something worth analysing
- Natural paragraph breaks
- The student MUST be able to answer the question from this text

Return your response in this EXACT format (no extra text, no markdown):
PASSAGE:
[full passage text here, with blank lines between paragraphs]

SOURCE:
[Author, Full Title (Year), Chapter — e.g. "Charles Dickens, Great Expectations (1861), Chapter 1" or "Original passage written in the style of a CAIE IGCSE unseen comprehension text"]`, geminiKey, 1800)

    // Parse the simple PASSAGE: / SOURCE: format
    const passageMatch = raw.match(/PASSAGE:\s*([\s\S]*?)(?=\nSOURCE:|$)/i)
    const sourceMatch = raw.match(/SOURCE:\s*([\s\S]*?)$/i)

    const text = passageMatch?.[1]?.trim() ?? ''
    const source = sourceMatch?.[1]?.trim() ?? 'Original passage'

    if (text.split(/\s+/).filter(Boolean).length < 150) return null
    return { text, source }
  } catch (err) {
    console.error('Gemini passage generation failed:', err)
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

// ── Generate all passages in parallel via Gemini ──────────────────────────────
// Gemini free tier allows 15 RPM so we can run these concurrently without worry.
async function generateAllPassages(
  questions: any[],
  geminiKey: string,
  subject: string
): Promise<void> {
  // For passage subjects, generate for every longform question regardless of whether
  // the LLM remembered to set needs_passage. Use the question text as fallback hint.
  const jobs = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => {
      if (q.needs_passage && q.passage_hint) return true
      // Fallback: any longform question in a passage subject should get a passage
      if (q.type === 'longform' && !q.passage) {
        q.passage_hint = q.passage_hint || `A rich literary or non-fiction extract directly relevant to this question: "${q.question.slice(0, 120)}"`
        return true
      }
      return false
    })

  if (jobs.length === 0) {
    questions.forEach((q) => { delete q.needs_passage; delete q.passage_hint })
    return
  }

  // All passages generated in parallel — Gemini handles the concurrency fine
  const results = await Promise.all(
    jobs.map(({ q, idx }) =>
      generatePassageWithGemini(q.question, subject, q.passage_hint, geminiKey)
        .then((result) => ({ idx, result }))
        .catch(() => ({ idx, result: null }))
    )
  )

  results.forEach(({ idx, result }) => {
    if (result) {
      questions[idx].passage = result.text
      questions[idx].passage_source = result.source
    }
    delete questions[idx].needs_passage
    delete questions[idx].passage_hint
  })

  // Clean any remaining staging fields
  questions.forEach((q) => { delete q.needs_passage; delete q.passage_hint })
}

// ── Build the main question-generation prompt (Groq — ONE call only) ──────────
function buildPrompt(opts: {
  subject: string
  topics: string[]
  count: number
  style: string
  curriculumName: string
  curriculumBlock: string
  questionType: 'mcq' | 'longform' | 'mixed'
  hasDiagramSupport: boolean
}): { prompt: string; estimatedTime: number } {
  const { subject, topics, count, style, curriculumName, curriculumBlock, questionType, hasDiagramSupport } = opts

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

  const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Total Questions:** ${count}
**Style:** ${style}

**Task:** ${questionInstruction}

**Requirements:**
1. All questions strictly based on the ${curriculumName} syllabus topics.
2. Vary difficulty: recall, application, analysis.
3. LaTeX: doubled backslashes — \\\\frac, \\\\sqrt, \\\\circ, \\\\pi, \\\\theta.
${questionType !== 'longform' ? `4. ${diagramNote}` : ''}
5. ${passageNote}

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
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

    const groq = new Groq({ apiKey: groqKey })
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY ?? ''

    const body = await request.json()
    const { subject, topics, count, style, className, grade, curriculum, user_id, questionType = 'mcq' } = body

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

    // ── Stage 1: Groq generates question skeletons ───────────────────────────
    // Primary model: llama-3.3-70b-versatile (6,000 TPM free tier)
    // Fallback model: llama-3.1-8b-instant   (20,000 TPM free tier — separate bucket)
    // If the primary is rate-limited we immediately retry with the fallback model,
    // no wait required because the two models have independent TPM counters.
    const { prompt, estimatedTime } = buildPrompt({
      subject, topics, count, style, curriculumName, curriculumBlock, questionType, hasDiagramSupport,
    })

    // Token budget: MCQ responses are ~800 tokens, longform ~2000, mixed ~3000
    const maxTokens = questionType === 'mcq' ? 2048 : questionType === 'longform' ? 3072 : 4096

    const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'] as const

    async function tryGenerate(model: string): Promise<any> {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      })
      let text = (completion.choices[0]?.message?.content || '').trim()
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      if (!text.startsWith('{')) {
        const m = text.match(/\{[\s\S]*\}/)
        if (m) text = m[0]
      }
      return JSON.parse(fixLatexInRawJson(text))
    }

    let assessmentData: any
    let lastError: any
    for (const model of MODELS) {
      try {
        assessmentData = await tryGenerate(model)
        break // success — stop trying
      } catch (err: any) {
        lastError = err
        const is429 = err.status === 429 || err.message?.includes('429') || err.error?.code === 'rate_limit_exceeded'
        if (is429) {
          console.warn(`Model ${model} rate-limited — trying fallback...`)
          continue // try next model
        }
        // Non-rate-limit error — fail immediately
        console.error('Groq/parse error:', err)
        return NextResponse.json({ error: `AI generation failed: ${err.message}` }, { status: 500 })
      }
    }

    if (!assessmentData) {
      console.error('All models rate-limited:', lastError)
      return NextResponse.json(
        { error: 'AI is temporarily busy. Please wait 30 seconds and try again.' },
        { status: 429 }
      )
    }

    if (!Array.isArray(assessmentData.questions)) {
      return NextResponse.json({ error: 'AI returned invalid question data. Please try again.' }, { status: 500 })
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

    // ── Stage 2b: Full passages via Gemini (parallel — no Groq, no rate limit) ──
    if (needsPassage(subject) && geminiKey) {
      await generateAllPassages(assessmentData.questions, geminiKey, subject)
    } else {
      // Non-passage subjects or no Gemini key: clean up staging fields
      assessmentData.questions.forEach((q: any) => {
        delete q.needs_passage
        delete q.passage_hint
      })
    }

    // ── Save to database ───────────────────────────────────────────────────────
    const { supabase } = require('@/lib/supabase')
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
