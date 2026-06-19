import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'
import { normalizeCountry, countryToDb } from '@/lib/countries'

function normalizeIds(value: unknown): number[] {
    if (!Array.isArray(value)) return []
    const ids = value
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    return Array.from(new Set(ids))
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
        country: normalizeCountry(row.country ?? 'RW'),
        created_at: row.created_at,
        updated_at: row.updated_at,
        textbooks,
        textbook_ids: textbookIds,
    }
}

export async function GET(request: NextRequest) {
    try {
        const country = normalizeCountry(request.nextUrl.searchParams.get('country') ?? 'RW')

        let sql = `
            SELECT c.id, c.name, c.country, c.created_at, c.updated_at,
                   ct.textbook_id,
                   t.textbook_name, t.curriculum, t.filename
            FROM classes c
            LEFT JOIN class_textbooks ct ON ct.class_id = c.id
            LEFT JOIN textbooks t ON t.textbook_id = ct.textbook_id
        `
        const values: unknown[] = []

        if (country === 'NG') {
            sql += ' WHERE c.country = $1'
            values.push('NG')
        } else {
            const classCountry = country === 'INT' ? 'RW' : country
            sql += ' WHERE c.country = $1 OR c.country IS NULL'
            values.push(classCountry)
        }

        sql += ' ORDER BY c.name, ct.textbook_id'

        const result = await db.query(sql, values)
        const byClass = new Map<number, any[]>()
        for (const row of result.rows) {
            const list = byClass.get(row.id) ?? []
            list.push(row)
            byClass.set(row.id, list)
        }

        const classes = Array.from(byClass.values())
            .map(buildClassFromRows)
            .filter(Boolean)

        return NextResponse.json({ data: classes })
    } catch (err) {
        console.error('Classes fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load classes') }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? '').trim()
        const textbookIds = normalizeIds(body?.textbook_ids)

        if (!name) {
            return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
        }

        const country = normalizeCountry(body?.country ?? 'RW')

        let created: any
        try {
            const result = await db.query(
                'INSERT INTO classes (name, country) VALUES ($1, $2) RETURNING id, name, country, created_at, updated_at',
                [name, countryToDb(country)]
            )
            created = result.rows[0]
        } catch (createError) {
            const status = isUniqueViolation(createError) ? 409 : 500
            console.error('Class create error:', createError)
            return NextResponse.json({ error: pgErrorMessage(createError) }, { status })
        }

        if (textbookIds.length > 0) {
            for (const textbookId of textbookIds) {
                await db.query(
                    'INSERT INTO class_textbooks (class_id, textbook_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [created.id, textbookId]
                )
            }
        }

        return NextResponse.json({
            data: {
                id: created.id,
                name: created.name,
                country: normalizeCountry(created.country ?? country),
                created_at: created.created_at,
                updated_at: created.updated_at,
                textbook_ids: textbookIds,
            },
        })
    } catch (err) {
        console.error('Class create error:', err)
        return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
    }
}
