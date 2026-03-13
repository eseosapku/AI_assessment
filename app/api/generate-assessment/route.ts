import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import { getCambridgeCurriculumContext, type CambridgeGrade } from '@/lib/cambridge-curriculum'

const MAX_DIAGRAMS = 4

// Fix LaTeX backslashes in the RAW JSON string before JSON.parse.
function fixLatexInRawJson(raw: string): string {
  return raw.replace(/(?<!\\)\\(?!["\\/nrtbfuU])([a-zA-Z])/g, '\\\\$1')
}

// ── Gemini 2.0 Flash for SVG diagram generation ───────────────────────────────
async function generateDiagramSvg(
  question: string,
  subject: string,
  diagramHint: string,
  geminiKey: string
): Promise<string | null> {
  try {
    const prompt = `You are an expert educational diagram creator. Generate a precise, accurate SVG diagram for this exam question.

QUESTION: "${question}"
SUBJECT: ${subject}
WHAT TO DRAW: ${diagramHint}

STRICT RULES:
1. Return ONLY the raw SVG code. No markdown, no backticks, no explanation.
2. Start exactly with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
3. End exactly with: </svg>
4. DO NOT SPOIL THE ANSWER — never include text labels that match any answer option.
5. Marker style: red arrow + red "X" label (fill="#dc2626" stroke="#dc2626"). Other shapes: stroke="#1e293b" stroke-width="2" fill="none".
6. SPATIAL ACCURACY: concentric shapes must be correctly nested; geometry vertices at mathematically sensible positions; circuits as closed loops.
7. Use font-family="sans-serif" for any text elements.

Generate the SVG now:`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/```svg\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/<svg[\s\S]*?<\/svg>/i)
    return match ? match[0] : null
  } catch {
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

// ── Stage 2: Generate a single full passage for one question ──────────────────
// Called in batches AFTER the main question generation to avoid TPM spikes.
async function generatePassage(
  question: string,
  subject: string,
  hint: string,
  groq: Groq
): Promise<{ text: string; source: string } | null> {
  const prompt = `You are creating a reading extract for a ${subject} exam paper.

QUESTION THE STUDENT WILL ANSWER: "${question}"
PASSAGE DESCRIPTION: ${hint}

Write a high-quality reading extract (AT LEAST 500 words, aim for 550–700 words) that:
1. Is directly relevant to the question above — the student MUST be able to answer using this text
2. Prioritises real public-domain literary works (Dickens, Austen, Hardy, Brontë, Eliot, Conrad, Achebe, Shakespeare, etc.) or original passages written in the style of a CAIE/Cambridge unseen comprehension text
3. Is rich in language techniques, vivid description, character voice, or argument — something worth analysing
4. Has natural paragraph breaks (use \\n\\n between paragraphs)
5. Reads exactly as it would appear printed in a real exam booklet

Return ONLY valid JSON (no markdown):
{
  "text": "<full passage, 500–700 words, paragraph breaks as \\n\\n>",
  "source": "<specific attribution — Author, Full Title (Year), Chapter/Line if applicable, e.g. 'Charles Dickens, Great Expectations (1861), Chapter 1' OR 'Original passage written in the style of a CAIE IGCSE unseen comprehension text'>"
}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      response_format: { type: 'json_object' },
    })
    let text = (completion.choices[0]?.message?.content || '').trim()
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const data = JSON.parse(text)
    if (!data.text || data.text.split(/\s+/).length < 200) return null
    return { text: data.text, source: data.source || 'Original passage' }
  } catch (err) {
    console.error('Passage generation failed:', err)
    return null
  }
}

// Process passage jobs in batches of 2, with a 4-second gap between batches
// to stay comfortably under Groq's free-tier TPM limit.
const PASSAGE_BATCH_SIZE = 2
const PASSAGE_BATCH_DELAY_MS = 4000

async function generateAllPassages(
  questions: any[],
  groq: Groq,
  subject: string
): Promise<void> {
  const jobs = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => q.needs_passage && q.passage_hint)

  for (let i = 0; i < jobs.length; i += PASSAGE_BATCH_SIZE) {
    const batch = jobs.slice(i, i + PASSAGE_BATCH_SIZE)

    // Delay between batches (skip before first batch)
    if (i > 0) {
      await new Promise((r) => setTimeout(r, PASSAGE_BATCH_DELAY_MS))
    }

    const results = await Promise.all(
      batch.map(({ q, idx }) =>
        generatePassage(q.question, subject, q.passage_hint, groq)
          .then((result) => ({ idx, result }))
          .catch(() => ({ idx, result: null }))
      )
    )

    results.forEach(({ idx, result }) => {
      if (result) {
        questions[idx].passage = result.text
        questions[idx].passage_source = result.source
      }
      // Remove internal staging fields
      delete questions[idx].needs_passage
      delete questions[idx].passage_hint
    })
  }

  // Clean up any remaining staging fields on questions that didn't need a passage
  questions.forEach((q) => {
    delete q.needs_passage
    delete q.passage_hint
  })
}

// ── Build the main question-generation prompt ─────────────────────────────────
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
    ? `DIAGRAMS: For up to ${MAX_DIAGRAMS} MCQ questions where a visual is ESSENTIAL (geometry, circuits, anatomy, graphs), add "needs_diagram": true and "diagram_hint": "<precise description>". Do NOT add for text/calculation questions.`
    : ''

  // For passage subjects, the main call only asks for a short passage_hint.
  // Full 500+ word passages are generated separately to avoid TPM overload.
  const passageNote = subjectNeedsPassage
    ? `PASSAGES: For EVERY question, add:
   - "needs_passage": true
   - "passage_hint": a 40-60 word description of what kind of passage to write — include: suggested author/work (e.g. "opening of a Dickens novel about poverty"), genre, tone, what literary techniques it should feature, and what aspect the question will ask about. Make each question's passage_hint DIFFERENT from the others — use at least 3 different authors/genres/styles across the assessment.
   Do NOT write the actual passage text here — it will be generated separately.`
    : `PASSAGES: Only add "needs_passage": true and "passage_hint" if the question genuinely requires a source text (e.g. a history source question). Leave them out for knowledge-based questions.`

  const mcqSchema = `{
      "id": <number>,
      "type": "mcq",
      "question": "<question text directly about the passage — e.g. 'How does the writer create a sense of dread in lines 1-8?'>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_answer": <0-3>,
      "explanation": "<detailed explanation referencing the passage>"${hasDiagramSupport ? `,
      "needs_diagram": false,
      "diagram_hint": ""` : ''}${subjectNeedsPassage ? `,
      "needs_passage": true,
      "passage_hint": "<40-60 word description of the passage to write>"` : ''}
    }`

  const lfSchema = `{
      "id": <number>,
      "type": "longform",
      "question": "<analytical question requiring extended writing — e.g. 'How does the writer use language to convey the character's isolation? Refer closely to the text.'>",
      "marks": <integer 4-8>,
      "marking_criteria": [
        "<criterion 1 — e.g. 'Identifies a language technique with a direct quote from the passage'>",
        "<criterion 2 — e.g. 'Explains the effect of the technique on the reader'>",
        "<criterion 3>",
        "..."
      ],
      "model_answer": "<200-350 word model answer using P.E.E structure with specific textual evidence>",
      "explanation": "<what analytical skill this question assesses>"${subjectNeedsPassage ? `,
      "needs_passage": true,
      "passage_hint": "<40-60 word description of the passage to write — different author/style from other questions>"` : ''}
    }`

  const lfSchemaNoPassage = `{
      "id": <number>,
      "type": "longform",
      "question": "<question requiring an extended written answer>",
      "marks": <integer 2-8 based on complexity>,
      "marking_criteria": [
        "<criterion 1 — one mark point per entry>",
        "<criterion 2>",
        "..."
      ],
      "model_answer": "<comprehensive model answer a top student would write>",
      "explanation": "<what this question tests>"
    }`

  const activeLfSchema = subjectNeedsPassage ? lfSchema : lfSchemaNoPassage

  let questionsBlock = ''
  let questionInstruction = ''

  if (questionType === 'mcq') {
    questionInstruction = `Generate exactly ${count} multiple-choice questions.${subjectNeedsPassage ? ` Every MCQ must reference a passage. Use at least 3 different passage_hints with different authors/styles.` : ''}`
    questionsBlock = `    ${mcqSchema}`
  } else if (questionType === 'longform') {
    questionInstruction = `Generate exactly ${count} long-form analytical questions. Each must have 4–8 marks with one criterion per mark.${subjectNeedsPassage ? ` Every question needs a passage. Use at least 3 different passage_hints pointing to different authors/genres — do NOT repeat the same text.` : ''}`
    questionsBlock = `    ${activeLfSchema}`
  } else {
    questionInstruction = `Generate exactly ${count} questions: ${mcqCount} MCQ (type "mcq") and ${lfCount} long-form (type "longform"), mixed in logical order.${subjectNeedsPassage ? ` Every question needs a passage. Use at least 3 different passage_hints across the set.` : ''}`
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
1. All questions must be strictly based on the ${curriculumName} syllabus topics listed above.
2. Vary difficulty: recall, application, analysis.
3. LaTeX in JSON: use doubled backslashes — \\\\frac, \\\\sqrt, \\\\circ, \\\\pi, \\\\theta.
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

// ── Main route handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set on server' }, { status: 500 })
    }
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
      curriculumBlock = `**Target Audience/Grade Level:** ${className}`
    }

    const isCambridge = curriculum === 'cambridge'
    const curriculumName = isCambridge
      ? 'Cambridge International (CAIE)'
      : 'Rwanda National Competence-Based Curriculum (REB)'
    const hasDiagramSupport = geminiKey.length > 0

    // ── Stage 1: Generate question skeletons (no full passages yet) ───────────
    const { prompt, estimatedTime } = buildPrompt({
      subject, topics, count, style, curriculumName, curriculumBlock, questionType, hasDiagramSupport,
    })

    let assessmentData: any
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      let text = (completion.choices[0]?.message?.content || '').trim()
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      if (!text.startsWith('{')) {
        const m = text.match(/\{[\s\S]*\}/)
        if (m) text = m[0]
      }
      text = fixLatexInRawJson(text)
      assessmentData = JSON.parse(text)
    } catch (err: any) {
      console.error('Groq/parse error:', err)
      if (err.message?.includes('429')) {
        return NextResponse.json({ error: 'AI rate limit exceeded. Please wait a minute and try again.' }, { status: 429 })
      }
      return NextResponse.json({ error: `AI generation failed: ${err.message}` }, { status: 500 })
    }

    // ── Stage 2a: Generate SVG diagrams via Gemini (MCQ only, parallel) ───────
    if (hasDiagramSupport && Array.isArray(assessmentData.questions)) {
      const diagramJobs: Array<{ idx: number; hint: string }> = []
      assessmentData.questions.forEach((q: any, idx: number) => {
        if (q.type !== 'longform' && q.needs_diagram && q.diagram_hint && diagramJobs.length < MAX_DIAGRAMS) {
          diagramJobs.push({ idx, hint: q.diagram_hint })
        }
      })
      if (diagramJobs.length > 0) {
        const svgResults = await Promise.all(
          diagramJobs.map(({ hint, idx }) =>
            generateDiagramSvg(assessmentData.questions[idx].question, subject, hint, geminiKey)
          )
        )
        svgResults.forEach((svg, jobIdx) => {
          if (svg) assessmentData.questions[diagramJobs[jobIdx].idx].diagram_svg = svg
        })
      }
      assessmentData.questions = assessmentData.questions.map((q: any) => {
        const { needs_diagram, diagram_hint, ...rest } = q
        return rest
      })
    }

    // ── Stage 2b: Generate full passages in batches (avoids TPM spike) ────────
    if (Array.isArray(assessmentData.questions) && needsPassage(subject)) {
      await generateAllPassages(assessmentData.questions, groq, subject)
    } else if (Array.isArray(assessmentData.questions)) {
      // Non-passage subjects — still clean up any stray staging fields
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
