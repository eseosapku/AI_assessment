import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'
import { subjectFromTextbookName } from '@/lib/textbook-subject'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const className = String(searchParams.get('class_name') ?? '').trim()
        const curriculumParam = searchParams.get('curriculum')

        if (!className) {
            return NextResponse.json({ error: 'class_name is required' }, { status: 400 })
        }

        let curriculum: number | null = null
        if (curriculumParam !== null && curriculumParam !== '') {
            const c = Number(curriculumParam)
            if (!Number.isFinite(c)) {
                return NextResponse.json({ error: 'Invalid curriculum' }, { status: 400 })
            }
            curriculum = c
        }

        const classResult = await db.query(
            'SELECT id, name FROM classes WHERE name = $1 LIMIT 1',
            [className]
        )
        const classRow = classResult.rows[0]
        if (!classRow) {
            return NextResponse.json({
                data: [],
                meta: { class_name: className, curriculum },
            })
        }

        const linksResult = await db.query(
            `SELECT ct.textbook_id, t.textbook_name, t.curriculum, t.filename
             FROM class_textbooks ct
             JOIN textbooks t ON t.textbook_id = ct.textbook_id
             WHERE ct.class_id = $1
             ORDER BY t.textbook_name`,
            [classRow.id]
        )

        const textbooks = linksResult.rows.map((textbook: any) => ({
            id: textbook.textbook_id,
            name: textbook.textbook_name,
            subjectName: subjectFromTextbookName(textbook.textbook_name),
            curriculum: textbook.curriculum,
            filename: textbook.filename,
        }))

        const filtered = curriculum === null ? textbooks : textbooks.filter((t: any) => t.curriculum === curriculum)

        return NextResponse.json({
            data: filtered,
            meta: { class_name: className, curriculum },
        })
    } catch (err) {
        console.error('Class textbooks fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load class textbooks') }, { status: 500 })
    }
}
