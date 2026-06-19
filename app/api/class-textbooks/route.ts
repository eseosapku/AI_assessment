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

        const classesResult = await db.query(
            `SELECT c.id, c.name,
                    ct.textbook_id,
                    t.textbook_name, t.curriculum, t.filename
             FROM classes c
             LEFT JOIN class_textbooks ct ON ct.class_id = c.id
             LEFT JOIN textbooks t ON t.textbook_id = ct.textbook_id
             WHERE c.name = $1
             ORDER BY t.textbook_name`,
            [className],
        )

        const classRowsMap = new Map<number, { id: number; name: string; links: any[] }>()
        for (const row of classesResult.rows) {
            const classId = Number(row.id)
            if (!classRowsMap.has(classId)) {
                classRowsMap.set(classId, { id: classId, name: String(row.name), links: [] })
            }
            if (row.textbook_id) {
                classRowsMap.get(classId)!.links.push({
                    textbooks: {
                        textbook_id: row.textbook_id,
                        textbook_name: row.textbook_name,
                        curriculum: row.curriculum,
                        filename: row.filename,
                    },
                })
            }
        }

        const classRows = [...classRowsMap.values()].map((c) => ({
            id: c.id,
            name: c.name,
            class_textbooks: c.links,
        }))

        let data = classRows[0] ?? null
        if (classRows.length > 1 && curriculum === 1) {
            data = classRows.find((row: any) => {
                const links = Array.isArray(row?.class_textbooks) ? row.class_textbooks : []
                return links.some((link: any) => Number(link?.textbooks?.curriculum) === 1)
            }) ?? data
        } else if (classRows.length > 1) {
            data = classRows.find((row: any) => {
                const links = Array.isArray(row?.class_textbooks) ? row.class_textbooks : []
                return links.some((link: any) => curriculum === null || Number(link?.textbooks?.curriculum) === curriculum)
            }) ?? data
        }

        const links = Array.isArray((data as any)?.class_textbooks) ? (data as any).class_textbooks : []
        const textbooks = links
            .map((link: any) => link.textbooks)
            .filter(Boolean)
            .map((textbook: any) => ({
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
