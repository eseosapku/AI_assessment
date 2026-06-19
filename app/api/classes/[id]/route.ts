import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'

function normalizeIds(value: unknown): number[] {
    if (!Array.isArray(value)) return []
    const ids = value
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    return Array.from(new Set(ids))
}

function parseClassId(rawId: string | undefined): number | null {
    const id = Number(rawId)
    return Number.isFinite(id) ? id : null
}

function buildClassFromRows(rows: any[]) {
    if (rows.length === 0) return null
    const row = rows[0]
    const textbooks: any[] = []
    const textbookIds: number[] = []
    const seenTextbookIds = new Set<number>()

    for (const r of rows) {
        if (r.textbook_id != null && Number.isFinite(r.textbook_id) && !seenTextbookIds.has(r.textbook_id)) {
            seenTextbookIds.add(r.textbook_id)
            textbookIds.push(r.textbook_id)
            if (r.textbook_name) {
                textbooks.push({
                    id: r.textbook_id,
                    name: r.textbook_name,
                    curriculum: r.curriculum,
                    filename: r.filename,
                })
            }
        }
    }

    return {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        textbooks,
        textbook_ids: textbookIds,
    }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        const result = await db.query(
            `SELECT c.id, c.name, c.created_at, c.updated_at,
                    ct.textbook_id,
                    t.textbook_name, t.curriculum, t.filename
             FROM classes c
             LEFT JOIN class_textbooks ct ON ct.class_id = c.id
             LEFT JOIN textbooks t ON t.textbook_id = ct.textbook_id
             WHERE c.id = $1
             ORDER BY ct.textbook_id`,
            [classId]
        )

        const data = buildClassFromRows(result.rows)
        if (!data) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('Class fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load class') }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const name = body?.name !== undefined ? String(body.name).trim() : null
        const textbookIds = body?.textbook_ids !== undefined ? normalizeIds(body.textbook_ids) : null

        if (name !== null && !name) {
            return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
        }

        if (name === null && textbookIds === null) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        if (name !== null) {
            try {
                await db.query(
                    'UPDATE classes SET name = $1, updated_at = NOW() WHERE id = $2',
                    [name, classId]
                )
            } catch (updateError) {
                const status = isUniqueViolation(updateError) ? 409 : 500
                console.error('Class update error:', updateError)
                return NextResponse.json({ error: pgErrorMessage(updateError) }, { status })
            }
        }

        if (textbookIds !== null) {
            await db.query('DELETE FROM class_textbooks WHERE class_id = $1', [classId])

            for (const textbookId of textbookIds) {
                await db.query(
                    'INSERT INTO class_textbooks (class_id, textbook_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [classId, textbookId]
                )
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Class update error:', err)
        return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM classes WHERE id = $1', [classId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Class delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete class') }, { status: 500 })
    }
}
