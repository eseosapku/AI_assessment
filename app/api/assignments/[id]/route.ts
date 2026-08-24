import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingColumn, pgErrorMessage } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'
import { attachLongformHints } from '@/lib/longform-hints'

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
        let result
        try {
            result = await db.query(
                `SELECT id, title, subject, topics, grade, curriculum, difficulty_level, question_count,
                        style, question_type, classroom_id, status, max_attempts, questions_data,
                        estimated_time, deadline, strict_mode, hints_enabled, created_at, updated_at
                 FROM assignments WHERE id = $1 LIMIT 1`,
                [assignmentId]
            )
        } catch (err) {
            if (!isMissingColumn(err)) throw err
            result = await db.query(
                `SELECT id, title, subject, topics, grade, curriculum, difficulty_level, question_count,
                        style, question_type, classroom_id, status, max_attempts, questions_data,
                        estimated_time, deadline, strict_mode, created_at, updated_at
                 FROM assignments WHERE id = $1 LIMIT 1`,
                [assignmentId]
            )
        }
        const data = result.rows[0]
        if (!data) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
        }

        const linksResult = await db.query(
            'SELECT classroom_id FROM assignment_classrooms WHERE assignment_id = $1',
            [assignmentId]
        )

        const classroomIds = (linksResult.rows ?? [])
            .map((row: any) => String(row.classroom_id ?? '').trim())
            .filter(Boolean)

        const payload = {
            ...data,
            hints_enabled: data.hints_enabled !== false,
            classroom_ids: classroomIds.length > 0
                ? classroomIds
                : (data.classroom_id ? [data.classroom_id] : []),
        }

        return NextResponse.json({ data: payload })
    } catch (err) {
        console.error('Assignment fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load assignment') }, { status: 500 })
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
        const questionsData = body?.questions_data !== undefined
            ? (Array.isArray(body.questions_data)
                ? body.questions_data.map((q: Record<string, any>) => attachLongformHints(q))
                : body.questions_data)
            : null
        const estimatedTime = body?.estimated_time !== undefined ? Number(body.estimated_time) : null
        const deadline = body?.deadline !== undefined ? String(body.deadline).trim() : null
        const strictMode = body?.strict_mode !== undefined ? Boolean(body.strict_mode) : null
        const hintsEnabled = body?.hints_enabled !== undefined ? Boolean(body.hints_enabled) : null

        const sets = ['updated_at = NOW()']
        const values: unknown[] = []
        let idx = 1

        if (title !== null) { sets.push(`title = $${idx++}`); values.push(title) }
        if (subject !== null) { sets.push(`subject = $${idx++}`); values.push(subject) }
        if (topics !== null) { sets.push(`topics = $${idx++}`); values.push(topics) }
        if (grade !== null) { sets.push(`grade = $${idx++}`); values.push(grade) }
        if (curriculum !== null) { sets.push(`curriculum = $${idx++}`); values.push(curriculum) }
        if (difficultyLevel !== null) { sets.push(`difficulty_level = $${idx++}`); values.push(difficultyLevel) }
        if (questionCount !== null) { sets.push(`question_count = $${idx++}`); values.push(questionCount) }
        if (style !== null) { sets.push(`style = $${idx++}`); values.push(style) }
        if (questionType !== null) { sets.push(`question_type = $${idx++}`); values.push(questionType) }
        if (rawMaxAttempts !== null) {
            if (!Number.isFinite(rawMaxAttempts) || rawMaxAttempts < 1) {
                return NextResponse.json({ error: 'max_attempts must be at least 1' }, { status: 400 })
            }
            sets.push(`max_attempts = $${idx++}`)
            values.push(Math.floor(rawMaxAttempts))
        }
        if (questionsData !== null) {
            sets.push(`questions_data = $${idx++}::jsonb`)
            values.push(jsonbParam(questionsData))
        }
        if (estimatedTime !== null) {
            sets.push(`estimated_time = $${idx++}`)
            values.push(Number.isFinite(estimatedTime) && estimatedTime > 0 ? estimatedTime : null)
        }
        if (deadline !== null) { sets.push(`deadline = $${idx++}`); values.push(deadline || null) }
        if (strictMode !== null) { sets.push(`strict_mode = $${idx++}`); values.push(strictMode) }
        if (hintsEnabled !== null) { sets.push(`hints_enabled = $${idx++}`); values.push(hintsEnabled) }

        if (sets.length === 1) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const assignmentPlaceholder = `$${idx}`
        values.push(assignmentId)
        const sql = `UPDATE assignments SET ${sets.join(', ')} WHERE id = ${assignmentPlaceholder}`
        try {
            await db.query(sql, values)
        } catch (err) {
            if (!isMissingColumn(err)) throw err
            const hintClause = sets.find((s) => s.startsWith('hints_enabled'))
            if (!hintClause) throw err
            const hintValueIndex = sets.indexOf(hintClause) - 1
            const fallbackSets = sets.filter((s) => s !== hintClause)
            const fallbackValues = values.filter((_, i) => i !== hintValueIndex)
            const fallbackSql = fallbackSets
                .map((clause, i) => {
                    if (i === 0) return clause
                    return clause.replace(/\$\d+/, `$${i}`)
                })
                .join(', ')
            await db.query(
                `UPDATE assignments SET ${fallbackSql} WHERE id = $${fallbackValues.length}`,
                fallbackValues,
            )
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment update error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to update assignment') }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM assignments WHERE id = $1', [assignmentId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete assignment') }, { status: 500 })
    }
}
