import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeTopics(value: unknown): string[] | null {
    if (value === undefined) return null
    if (!Array.isArray(value)) return []
    return value.map((t) => String(t ?? '').trim()).filter(Boolean)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        const { data, error } = await supabase
            .from('assignments')
            .select(`
        id,
        title,
        subject,
        topics,
        grade,
        curriculum,
        difficulty_level,
        question_count,
        style,
        question_type,
        classroom_id,
        status,
        max_attempts,
        questions_data,
        estimated_time,
        deadline,
        strict_mode,
        created_at,
        updated_at
      `)
            .eq('id', assignmentId)
            .single()

        if (error) {
            console.error('Assignment fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const { data: classroomLinks, error: classroomError } = await supabase
            .from('assignment_classrooms')
            .select('classroom_id')
            .eq('assignment_id', assignmentId)

        if (classroomError) {
            console.error('Assignment classrooms fetch error:', classroomError)
            return NextResponse.json({ error: classroomError.message }, { status: 500 })
        }

        const classroomIds = (classroomLinks ?? [])
            .map((row: any) => String(row.classroom_id ?? '').trim())
            .filter(Boolean)

        const payload = {
            ...data,
            classroom_ids: classroomIds.length > 0
                ? classroomIds
                : (data.classroom_id ? [data.classroom_id] : []),
        }

        return NextResponse.json({ data: payload })
    } catch (err) {
        console.error('Assignment fetch error:', err)
        return NextResponse.json({ error: 'Failed to load assignment' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const title = body?.title !== undefined ? String(body.title).trim() : null
        const subject = body?.subject !== undefined ? String(body.subject).trim() : null
        const topics = normalizeTopics(body?.topics)
        const grade = body?.grade !== undefined ? String(body.grade).trim() : null
        const curriculum = body?.curriculum !== undefined ? String(body.curriculum).trim() : null
        const difficultyLevel = body?.difficulty_level !== undefined ? String(body.difficulty_level).trim() : null
        const questionCount = body?.question_count !== undefined ? Number(body.question_count) : null
        const style = body?.style !== undefined ? String(body.style).trim() : null
        const questionType = body?.question_type !== undefined ? String(body.question_type).trim() : null
        const rawMaxAttempts = body?.max_attempts !== undefined ? Number(body.max_attempts) : null
        const questionsData = body?.questions_data !== undefined ? body.questions_data : null
        const estimatedTime = body?.estimated_time !== undefined ? Number(body.estimated_time) : null
        const deadline = body?.deadline !== undefined ? String(body.deadline).trim() : null
        const strictMode = body?.strict_mode !== undefined ? Boolean(body.strict_mode) : null

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }

        if (title !== null) updatePayload.title = title
        if (subject !== null) updatePayload.subject = subject
        if (topics !== null) updatePayload.topics = topics
        if (grade !== null) updatePayload.grade = grade
        if (curriculum !== null) updatePayload.curriculum = curriculum
        if (difficultyLevel !== null) updatePayload.difficulty_level = difficultyLevel
        if (questionCount !== null) updatePayload.question_count = questionCount
        if (style !== null) updatePayload.style = style
        if (questionType !== null) updatePayload.question_type = questionType
        if (rawMaxAttempts !== null) {
            if (!Number.isFinite(rawMaxAttempts) || rawMaxAttempts < 1) {
                return NextResponse.json({ error: 'max_attempts must be at least 1' }, { status: 400 })
            }
            updatePayload.max_attempts = Math.floor(rawMaxAttempts)
        }
        if (questionsData !== null) updatePayload.questions_data = questionsData
        if (estimatedTime !== null) {
            updatePayload.estimated_time = Number.isFinite(estimatedTime) && estimatedTime > 0 ? estimatedTime : null
        }
        if (deadline !== null) updatePayload.deadline = deadline || null
        if (strictMode !== null) updatePayload.strict_mode = strictMode

        if (Object.keys(updatePayload).length === 1) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const { error } = await supabase
            .from('assignments')
            .update(updatePayload)
            .eq('id', assignmentId)

        if (error) {
            console.error('Assignment update error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment update error:', err)
        return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', assignmentId)

        if (error) {
            console.error('Assignment delete error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment delete error:', err)
        return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
    }
}
