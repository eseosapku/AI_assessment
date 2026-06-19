import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'

function parseOptionalNumber(value: unknown, fieldName: string) {
    if (value === undefined) return { value: undefined as number | null | undefined }
    if (value === null || value === '') return { value: null as number | null }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${fieldName}` }
    }
    return { value: parsed }
}

function parseOptionalString(value: unknown) {
    if (value === undefined) return { value: undefined as string | null | undefined }
    if (value === null) return { value: null as string | null }
    const trimmed = String(value).trim()
    return { value: trimmed ? trimmed : null }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const curriculumParam = searchParams.get('curriculum')

        let sql = 'SELECT textbook_id, textbook_name, filename, curriculum FROM textbooks'
        const values: unknown[] = []

        if (curriculumParam !== null && curriculumParam !== '') {
            const curriculum = Number(curriculumParam)
            if (!Number.isFinite(curriculum)) {
                return NextResponse.json({ error: 'Invalid curriculum' }, { status: 400 })
            }
            values.push(curriculum)
            sql += ' WHERE curriculum = $1'
        }

        sql += ' ORDER BY textbook_name'

        const result = await db.query(sql, values)
        const normalized = (result.rows ?? []).map((row: any) => ({
            id: row.textbook_id,
            name: row.textbook_name,
            filename: row.filename,
            curriculum: row.curriculum,
        }))

        return NextResponse.json({ data: normalized })
    } catch (err) {
        console.error('Textbooks fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load textbooks') }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? body?.textbook_name ?? '').trim()
        const filenameResult = parseOptionalString(body?.filename)
        const curriculumResult = parseOptionalNumber(body?.curriculum, 'curriculum')

        if (!name) {
            return NextResponse.json({ error: 'Textbook name is required' }, { status: 400 })
        }
        if (curriculumResult.error) {
            return NextResponse.json({ error: curriculumResult.error }, { status: 400 })
        }

        const columns = ['textbook_name']
        const values: unknown[] = [name]
        const placeholders = ['$1']

        if (filenameResult.value !== undefined) {
            columns.push('filename')
            values.push(filenameResult.value)
            placeholders.push(`$${values.length}`)
        }
        if (curriculumResult.value !== undefined) {
            columns.push('curriculum')
            values.push(curriculumResult.value)
            placeholders.push(`$${values.length}`)
        }

        try {
            const result = await db.query(
                `INSERT INTO textbooks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING textbook_id, textbook_name, filename, curriculum`,
                values
            )
            const created = result.rows[0]

            return NextResponse.json({
                data: {
                    id: created.textbook_id,
                    name: created.textbook_name,
                    filename: created.filename,
                    curriculum: created.curriculum,
                },
            })
        } catch (createError) {
            const status = isUniqueViolation(createError) ? 409 : 500
            console.error('Textbook create error:', createError)
            return NextResponse.json({ error: pgErrorMessage(createError) }, { status })
        }
    } catch (err) {
        console.error('Textbook create error:', err)
        return NextResponse.json({ error: 'Failed to create textbook' }, { status: 500 })
    }
}
