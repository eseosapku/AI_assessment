import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'
import {
  getCambridgeCurriculumContext,
  type CambridgeGrade,
} from '@/lib/cambridge-curriculum'

// Max images the AI may request per assessment (credit management)
const MAX_IMAGE_QUERIES = 5

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
4. Questions should be appropriate for ${style.includes('Exam') ? 'high-stakes international exams' : 'classroom practice tests'}
5. Vary difficulty levels (recall, application, analysis)
6. IMAGES: For up to ${MAX_IMAGE_QUERIES} questions where a diagram, chart, photograph, or visual aid would genuinely help (e.g. circuit diagrams, cell diagrams, geometric figures, maps, graphs, biological structures), add an "image_search_query" field with a short Wikipedia search term (e.g. "mitochondria diagram", "series circuit diagram", "pythagoras theorem", "DNA double helix"). Only add this field when an image truly adds value – not for every question.
7. CRITICAL LATEX IN JSON: For math equations, use LaTeX with dollar signs. Since output is JSON, ALL LaTeX backslashes must be doubled. Use \\\\frac not \\frac, \\\\sqrt not \\sqrt, \\\\circ not \\circ, \\\\pi not \\pi, \\\\theta not \\theta, \\\\times not \\times, \\\\pm not \\pm. Examples: "$x^2 + y^2 = z^2$", "$\\\\frac{1}{2}$", "$\\\\sqrt{3}$", "$90^\\\\circ$".

**CRITICAL: Return ONLY a valid JSON object. No markdown, no explanation, no extra text — just the JSON.**

The JSON must follow this exact schema:
{
  "assessment_id": "auto",
  "estimated_time": ${count * 2},
  "questions": [
    {
      "id": 1,
      "question": "Full question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": 0,
      "explanation": "Detailed explanation of why the correct answer is right and why others are wrong",
      "image_search_query": "optional wikipedia search term for a helpful image"
    }
  ]
}

Rules:
- "correct_answer" is the zero-based index (0=A, 1=B, 2=C, 3=D)
- "image_search_query" is OPTIONAL – only include it on questions that genuinely benefit from a visual
- Generate all ${count} questions
- Do NOT wrap in markdown code blocks

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

      // Fix LaTeX backslashes corrupted by JSON parsing
      cleanedText = cleanedText.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1')

      if (!cleanedText.startsWith('{')) {
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }
      }

      let assessmentData: any
      try {
        assessmentData = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error('JSON parse failed. Raw response:', text)
        throw new Error(`AI returned invalid JSON. Raw: ${text.substring(0, 200)}`)
      }

      // Enforce image query cap
      let imageCount = 0
      if (Array.isArray(assessmentData.questions)) {
        assessmentData.questions = assessmentData.questions.map((q: any) => {
          if (q.image_search_query) {
            if (imageCount >= MAX_IMAGE_QUERIES) {
              delete q.image_search_query
            } else {
              imageCount++
            }
          }
          return q
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
