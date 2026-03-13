import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import {
  getCambridgeCurriculumContext,
  type CambridgeGrade,
} from '@/lib/cambridge-curriculum'

// Max SVG diagrams per assessment (keep JSON payload manageable)
const MAX_DIAGRAMS = 4

// Apply LaTeX fix only to text fields (not SVG) to avoid corrupting SVG path data
function fixLatex(s: string): string {
  return s.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1')
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set on server' }, { status: 500 })
    }
    const groq = new Groq({ apiKey })
    const body = await request.json()
    const { subject, topics, count, style, className, grade, curriculum, user_id } = body

    if (!subject || !topics || !count) {
      return NextResponse.json(
        { error: 'Subject, topics, and count are required' },
        { status: 400 }
      )
    }

    // Build curriculum context block
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

    const prompt = `You are an expert educational assessment generator aligned with the ${curriculumName}. Create ${count} multiple-choice questions for a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Question Count:** ${count}
**Style:** ${style}

**Requirements:**
1. Generate exactly ${count} questions strictly based on the ${isCambridge ? 'Cambridge International syllabus' : 'Rwanda Education Board (REB) syllabus'} topics listed above
2. Each question must have 4 options (A, B, C, D)
3. Include detailed explanations for correct answers
4. Vary difficulty levels (recall, application, analysis)

**SVG DIAGRAMS (critical requirement):**
For up to ${MAX_DIAGRAMS} questions where the question REQUIRES a visual to be answerable or meaningful — such as:
- Geometry: a triangle with specific labeled angles/sides the student must calculate
- Physics circuits: a circuit diagram the student is asked about
- Ray diagrams: reflection or refraction figures
- Graphs: a specific graph the student must read/interpret
- Biology: a labeled diagram the student must identify parts of

You MUST generate an accurate SVG diagram in the "diagram_svg" field. Rules for the SVG:
- Must be a complete, self-contained SVG string starting with <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
- Draw the EXACT figure the question refers to (e.g. if asking "find angle C in triangle ABC where A=50° and B=70°", draw that exact triangle with A, B, C labeled and 50°, 70° shown, and ? at C)
- Use stroke="#1e293b" for lines/shapes, fill="none" for outlines, fill="#1e293b" for text
- Include clear labels using <text> elements with font-family="sans-serif"
- For circuits: draw the actual components (battery as two parallel lines of different lengths, resistor as a rectangle, bulb as a circle with X, switch as a gap with a line)
- Keep it clean and accurate — this diagram must directly support the question
- Do NOT add decorative elements; every element must be part of the question's figure

DO NOT add diagram_svg for questions that are purely calculation/recall/conceptual with no figure.

**LATEX IN JSON:** For math in question text, options, and explanations, use LaTeX dollar signs. ALL backslashes must be doubled in JSON: \\\\frac, \\\\sqrt, \\\\circ, \\\\pi, \\\\theta, \\\\times, \\\\pm, \\\\angle, \\\\triangle. Examples: "$x^2$", "$\\\\frac{1}{2}$", "$90^\\\\circ$", "$\\\\triangle ABC$".

**CRITICAL: Return ONLY a valid JSON object. No markdown, no extra text.**

Schema:
{
  "assessment_id": "auto",
  "estimated_time": ${count * 2},
  "questions": [
    {
      "id": 1,
      "question": "In triangle ABC, angle A = 50° and angle B = 70°. Find angle C.",
      "options": ["50°", "60°", "70°", "80°"],
      "correct_answer": 1,
      "explanation": "Angles in a triangle sum to 180°. C = 180 - 50 - 70 = 60°.",
      "diagram_svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 400 280\\"><polygon points=\\"60,240 340,240 200,40\\" fill=\\"none\\" stroke=\\"#1e293b\\" stroke-width=\\"2\\"/><text x=\\"40\\" y=\\"260\\" font-size=\\"15\\" font-family=\\"sans-serif\\" fill=\\"#1e293b\\">A</text><text x=\\"345\\" y=\\"260\\" font-size=\\"15\\" font-family=\\"sans-serif\\" fill=\\"#1e293b\\">B</text><text x=\\"193\\" y=\\"28\\" font-size=\\"15\\" font-family=\\"sans-serif\\" fill=\\"#1e293b\\">C</text><text x=\\"75\\" y=\\"238\\" font-size=\\"13\\" font-family=\\"sans-serif\\" fill=\\"#475569\\">50°</text><text x=\\"300\\" y=\\"238\\" font-size=\\"13\\" font-family=\\"sans-serif\\" fill=\\"#475569\\">70°</text><text x=\\"193\\" y=\\"60\\" font-size=\\"13\\" font-family=\\"sans-serif\\" fill=\\"#475569\\">?</text></svg>"
    }
  ]
}

Rules:
- "correct_answer" is zero-based index (0=A, 1=B, 2=C, 3=D)
- "diagram_svg" is ONLY for questions where the figure is part of the question itself
- Generate all ${count} questions

Generate the assessment now:`

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      const text = completion.choices[0]?.message?.content || ''

      let cleanedText = text.trim()
      cleanedText = cleanedText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      if (!cleanedText.startsWith('{')) {
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleanedText = jsonMatch[0]
      }

      let assessmentData: any
      try {
        assessmentData = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error('JSON parse failed. Raw response:', text)
        throw new Error(`AI returned invalid JSON. Raw: ${text.substring(0, 200)}`)
      }

      // Apply LaTeX fix to text fields only (not diagram_svg), and enforce diagram cap
      let diagramCount = 0
      if (Array.isArray(assessmentData.questions)) {
        assessmentData.questions = assessmentData.questions.map((q: any) => {
          const fixed: any = {
            ...q,
            question: fixLatex(q.question || ''),
            options: Array.isArray(q.options) ? q.options.map(fixLatex) : q.options,
            explanation: fixLatex(q.explanation || ''),
          }
          // Enforce diagram cap and validate SVG
          if (fixed.diagram_svg) {
            if (diagramCount >= MAX_DIAGRAMS || !fixed.diagram_svg.includes('<svg')) {
              delete fixed.diagram_svg
            } else {
              diagramCount++
            }
          }
          return fixed
        })
      }

      // Save assessment to database
      const { supabase } = require('@/lib/supabase')
      const { data: dbAssessment, error: dbError } = await supabase
        .from('assessments')
        .insert([
          {
            user_id: user_id || null,
            subject,
            difficulty: style,
            duration: count * 2,
            questions_data: assessmentData.questions,
            status: 'completed',
          },
        ])
        .select()
        .single()

      if (dbError) {
        console.error('Error saving assessment to DB:', dbError)
      }

      return NextResponse.json({
        ...assessmentData,
        assessment_id: dbAssessment?.id || assessmentData.assessment_id,
        subject,
        topics,
        style,
        curriculum,
      })
    } catch (aiError: any) {
      console.error('Groq AI Error:', aiError)
      if (aiError.message?.includes('429') || aiError.message?.includes('Quota')) {
        return NextResponse.json(
          { error: 'AI rate limit exceeded. Please wait a minute and try again.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: `AI generation failed: ${aiError.message || 'Unknown error'}. Please try again.` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: `Failed to generate assessment: ${error?.message || String(error)}` },
      { status: 500 }
    )
  }
}
