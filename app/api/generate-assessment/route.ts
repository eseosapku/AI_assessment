import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import { getCambridgeCurriculumContext, type CambridgeGrade } from '@/lib/cambridge-curriculum'

const MAX_DIAGRAMS = 4

// Fix LaTeX backslashes in the RAW JSON string before JSON.parse.
// Converts lone \frac → \\frac so that after JSON.parse the value is \frac (valid LaTeX).
// Excludes standard JSON escape sequences: \n \r \t \b \f \" \\ \/ \u
function fixLatexInRawJson(raw: string): string {
  return raw.replace(/(?<!\\)\\(?!["\\/nrtbfuU])([a-zA-Z])/g, '\\\\$1')
}

// ── Gemini 2.0 Flash (free tier) for accurate SVG diagram generation ──────────
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

STRICT RULES — read every rule carefully:
1. Return ONLY the raw SVG code. No markdown, no backticks, no explanation.
2. Start exactly with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
3. End exactly with: </svg>
4. DO NOT SPOIL THE ANSWER — never include text labels that match any answer option. The diagram must show the figure with only a red "X" (or numbered markers 1,2,3) indicating which part the question asks about.
5. All diagram parts should be visible and correctly shaped but UNLABELED. Only the "X" marker is needed.
6. Marker style: draw a red arrow pointing at the part + red "X" label. Use fill="#dc2626" stroke="#dc2626" for markers/arrows. Use stroke="#1e293b" stroke-width="2" fill="none" for all other shapes.
7. SPATIAL ACCURACY:
   - Biology cross-sections (eye, leaf, stem): outer layers must be LARGER rings containing inner layers — never let shapes overlap incorrectly. Use concentric circles/ellipses with correct radii (outer > inner).
   - Geometry figures: place vertices at mathematically sensible positions. For a triangle with angle A at bottom-left, B at bottom-right, C at top, use e.g. A=(60,240), B=(340,240), C=(200,40).
   - Circuits: draw wires as straight lines forming a closed loop. Place components (battery, resistor, bulb) on the sides of the rectangle, not overlapping wires.
   - Graphs: draw proper axes with arrow tips, grid lines if needed, and the exact curve/line the question describes.
8. Use font-family="sans-serif" for any text elements. Non-answer text (e.g. axis labels "x", "y", scale numbers, angle arc labels) is allowed and encouraged.
9. The diagram MUST be directly useful for answering the question — not illustrative, but functional.

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

    // Strip markdown fences if present
    const cleaned = raw.replace(/```svg\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/<svg[\s\S]*?<\/svg>/i)
    return match ? match[0] : null
  } catch (err) {
    console.error('Gemini diagram generation failed:', err)
    return null
  }
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
    const { subject, topics, count, style, className, grade, curriculum, user_id } = body

    if (!subject || !topics || !count) {
      return NextResponse.json(
        { error: 'Subject, topics, and count are required' },
        { status: 400 }
      )
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

    // ── Step 1: Groq generates questions (text only) ─────────────────────────
    const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create ${count} multiple-choice questions for a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Question Count:** ${count}
**Style:** ${style}

**Requirements:**
1. Generate exactly ${count} questions strictly based on the ${isCambridge ? 'Cambridge International' : 'REB'} syllabus topics
2. Each question must have exactly 4 options (A, B, C, D)
3. Include detailed explanations for correct answers
4. Vary difficulty: recall, application, analysis
5. LATEX IN JSON: For math, use LaTeX with doubled backslashes: \\\\frac, \\\\sqrt, \\\\circ, \\\\pi, \\\\theta, \\\\times, \\\\pm, \\\\angle, \\\\triangle. Examples: "$\\\\frac{1}{2}$", "$90^\\\\circ$".
${hasDiagramSupport ? `6. DIAGRAMS: For up to ${MAX_DIAGRAMS} questions where a visual diagram is ESSENTIAL to the question (the student cannot meaningfully answer without seeing a figure) — such as geometry figures, circuit diagrams, cross-section anatomy, ray diagrams, specific graphs — add these two fields:
   - "needs_diagram": true
   - "diagram_hint": a precise description of what to draw and WHERE to place the "X" marker, e.g. "cross-section of human eye as concentric ellipses — outermost=sclera, then cornea layer, then iris ring, innermost dark circle=pupil — place red X marker on the pupil (innermost circle)"
   Do NOT add needs_diagram for purely text/calculation questions.` : ''}

**CRITICAL: Return ONLY valid JSON. No markdown, no extra text.**

Schema:
{
  "assessment_id": "auto",
  "estimated_time": ${count * 2},
  "questions": [
    {
      "id": 1,
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0,
      "explanation": "Explanation text"${hasDiagramSupport ? `,
      "needs_diagram": false,
      "diagram_hint": ""` : ''}
    }
  ]
}

Rules:
- "correct_answer" is zero-based (0=A, 1=B, 2=C, 3=D)
- Generate all ${count} questions now`

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
      // Fix LaTeX backslashes in the raw JSON string BEFORE parsing so that
      // \frac → \\frac in JSON → \frac after parse → valid LaTeX for the renderer.
      text = fixLatexInRawJson(text)
      assessmentData = JSON.parse(text)
    } catch (err: any) {
      console.error('Groq/parse error:', err)
      if (err.message?.includes('429')) {
        return NextResponse.json({ error: 'AI rate limit exceeded. Please wait a minute.' }, { status: 429 })
      }
      return NextResponse.json({ error: `AI generation failed: ${err.message}` }, { status: 500 })
    }

    // ── Step 2: Generate SVG diagrams via Gemini (parallel) ──────────────────
    if (hasDiagramSupport && Array.isArray(assessmentData.questions)) {
      const diagramJobs: Array<{ idx: number; hint: string }> = []

      assessmentData.questions.forEach((q: any, idx: number) => {
        if (q.needs_diagram && q.diagram_hint && diagramJobs.length < MAX_DIAGRAMS) {
          diagramJobs.push({ idx, hint: q.diagram_hint })
        }
      })

      if (diagramJobs.length > 0) {
        const svgResults = await Promise.all(
          diagramJobs.map(({ hint, idx }) =>
            generateDiagramSvg(
              assessmentData.questions[idx].question,
              subject,
              hint,
              geminiKey
            )
          )
        )

        svgResults.forEach((svg, jobIdx) => {
          const { idx } = diagramJobs[jobIdx]
          if (svg) {
            assessmentData.questions[idx].diagram_svg = svg
          }
          // Clean up internal fields before sending to client
          delete assessmentData.questions[idx].needs_diagram
          delete assessmentData.questions[idx].diagram_hint
        })
      }

      // Clean diagram fields from questions that didn't get diagrams
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
        duration: count * 2,
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
    })
  } catch (error: any) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: `Failed to generate assessment: ${error?.message || String(error)}` },
      { status: 500 }
    )
  }
}
