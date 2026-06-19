import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

        const { data: rows, error } = await supabase
            .from('classes')
            .select(`
        id,
        name,
        class_textbooks (
          textbook_id,
          textbooks (
            textbook_id,
            textbook_name,
            curriculum,
            filename
          )
        )
      `)
            .eq('name', className)

        if (error) {
            console.error('Class textbooks fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const classRows = Array.isArray(rows) ? rows : []
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
        return NextResponse.json({ error: 'Failed to load class textbooks' }, { status: 500 })
    }
}
