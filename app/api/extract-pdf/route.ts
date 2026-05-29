import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'

const MAX_SOURCE_CHARS = 12000

function normalizePdfText(raw: string) {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return { text: '', truncated: false }
    if (cleaned.length <= MAX_SOURCE_CHARS) return { text: cleaned, truncated: false }
    return { text: cleaned.slice(0, MAX_SOURCE_CHARS), truncated: true }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 })
        }

        const filename = String(file.name || 'uploaded.pdf')
        const isPdf = file.type ? file.type.includes('pdf') : filename.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return NextResponse.json({ error: 'PDF file is empty.' }, { status: 400 })
        }

        const data = await pdfParse(Buffer.from(arrayBuffer))
        const normalized = normalizePdfText(data.text || '')

        if (!normalized.text) {
            return NextResponse.json({ error: 'No readable text found in this PDF.' }, { status: 400 })
        }

        return NextResponse.json({
            text: normalized.text,
            truncated: normalized.truncated,
            pageCount: Number.isFinite(data.numpages) ? data.numpages : null,
            charCount: data.text ? data.text.length : null,
            filename,
        })
    } catch (error) {
        console.error('PDF extract error:', error)
        return NextResponse.json({ error: 'Failed to extract PDF text.' }, { status: 500 })
    }
}
