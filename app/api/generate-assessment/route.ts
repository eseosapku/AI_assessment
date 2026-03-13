import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import { getCambridgeCurriculumContext, type CambridgeGrade } from '@/lib/cambridge-curriculum'

const MAX_DIAGRAMS = 4

// Fix LaTeX backslashes in the RAW JSON string before JSON.parse.
function fixLatexInRawJson(raw: string): string {
  return raw.replace(/(?<!\\)\\(?!["\\/nrtbfuU])([a-zA-Z])/g, '\\\\$1')
}

// ── Gemini 2.0 Flash for accurate SVG diagram generation ──────────────────────
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

    if (!res.ok) {
      console.error('Gemini diagram error:', await res.text())
      return null
    }

    const data = await res.json()
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/```svg\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/<svg[\s\S]*?<\/svg>/i)
    return match ? match[0] : null
  } catch (err) {
    console.error('Gemini diagram generation failed:', err)
    return null
  }
}

// Subjects that require a reading passage / extract for long-form questions
const PASSAGE_SUBJECTS = [
  'english', 'english language', 'english literature', 'literature', 'literature in english',
  'french', 'kinyarwanda', 'swahili', 'history', 'general paper', 'global perspectives',
  'language arts', 'reading', 'social studies',
]

function needsPassage(subject: string): boolean {
  return PASSAGE_SUBJECTS.some((s) => subject.toLowerCase().includes(s))
}

// ── Build prompt based on question type ──────────────────────────────────────
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

  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const estimatedTime = mcqCount * 2 + lfCount * 8

  const subjectNeedsPassage = needsPassage(subject)

  const diagramNote = hasDiagramSupport
    ? `DIAGRAMS: For up to ${MAX_DIAGRAMS} MCQ questions where a visual is essential, add "needs_diagram": true and "diagram_hint": "<precise description of what to draw and where to place the X marker>". Do NOT add for text/calculation questions.`
    : ''

  const passageNote = subjectNeedsPassage
    ? `PASSAGES: For every long-form question, you MUST include:
   - "passage": a self-contained extract (150–350 words) of high-quality prose, poetry, or non-fiction relevant to the topic. Write original literary-style text or use public-domain works (pre-1928 authors: Dickens, Austen, Hardy, Shakespeare, etc.). The extract must be rich enough for the student to answer the question from it.
   - "passage_source": the attribution string, e.g. "Charles Dickens, Great Expectations (1861), Chapter 1" or "Original passage" if you wrote it.
   For MCQ questions about a passage, include the same passage and source fields.`
    : `PASSAGES: Only include "passage" and "passage_source" if the specific question genuinely requires a source text to answer (e.g. a history source question). Leave them out for questions the student can answer from knowledge alone.`

  const mcqSchema = `{
      "id": <number>,
      "type": "mcq",
      "question": "<question text>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_answer": <0-3>,
      "explanation": "<detailed explanation>"${hasDiagramSupport ? `,
      "needs_diagram": false,
      "diagram_hint": ""` : ''}${subjectNeedsPassage ? `,
      "passage": "<extract text for the student to read — required for English/language subjects>",
      "passage_source": "<author, title, year, chapter if applicable>"` : ''}
    }`

  const lfSchema = `{
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
      "explanation": "<what this question tests>",
      "passage": "<extract — REQUIRED for ${subject}. 150-350 words of relevant prose, poetry, or non-fiction the student must read and respond to>",
      "passage_source": "<attribution: author, title, year>"
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
    questionInstruction = `Generate exactly ${count} multiple-choice questions.`
    questionsBlock = `    ${mcqSchema}`
  } else if (questionType === 'longform') {
    questionInstruction = `Generate exactly ${count} long-form questions that require extended written answers. Each question must have between 2 and 8 marks. Provide one clear marking criterion per mark.${subjectNeedsPassage ? ' Every question MUST include a "passage" extract for the student to read and respond to.' : ''}`
    questionsBlock = `    ${activeLfSchema}`
  } else {
    questionInstruction = `Generate exactly ${count} questions total: ${mcqCount} multiple-choice (type "mcq") and ${lfCount} long-form (type "longform"). Mix them in a logical order.${subjectNeedsPassage ? ' Every question (MCQ and long-form) MUST include a "passage" extract.' : ''}`
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
3. LaTeX in JSON: use doubled backslashes — \\\\frac, \\\\sqrt, \\\\circ, \\\\pi, \\\\theta, \\\\times, \\\\pm, \\\\angle, \\\\triangle.
${questionType !== 'longform' ? `4. ${diagramNote}` : ''}
${`5. ${passageNote}`}

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

    // Curriculum context
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

    // ── Step 1: Groq generates questions ─────────────────────────────────────
    const { prompt, estimatedTime } = buildPrompt({
      subject,
      topics,
      count,
      style,
      curriculumName,
      curriculumBlock,
      questionType,
      hasDiagramSupport,
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
        return NextResponse.json({ error: 'AI rate limit exceeded. Please wait a minute.' }, { status: 429 })
      }
      return NextResponse.json({ error: `AI generation failed: ${err.message}` }, { status: 500 })
    }

    // ── Step 2: Generate SVG diagrams via Gemini (MCQ only) ───────────────────
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
          const { idx } = diagramJobs[jobIdx]
          if (svg) {
            assessmentData.questions[idx].diagram_svg = svg
          }
        })
      }

      // Clean up internal diagram hint fields
      assessmentData.questions = assessmentData.questions.map((q: any) => {
        const { needs_diagram, diagram_hint, ...rest } = q
        return rest
      })
    }

    // Save to database
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
