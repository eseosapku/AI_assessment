import { NextRequest, NextResponse } from 'next/server'
import { readPdf } from '@/lib/pdf-extract'
import { keepPdfFigures, pdfCanStartQuiz, pdfRejection, PDF_MAX_BYTES } from '@/lib/pdf-source'
import { PDF_TEXT_MAX_CHARS } from '@/lib/pdf-upload'

export const runtime = 'nodejs'

/**
 * Turn an uploaded PDF into the text and figures a quiz is written from.
 *
 * The file is not stored. The response is what the wizard sends on to
 * generation, and anything over 10 MB is refused before it is read.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 })
    }

    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    const rejected = pdfRejection({ name: file.name, type: file.type, size: file.size, header })
    if (rejected) return NextResponse.json({ error: rejected }, { status: 400 })
    if (file.size > PDF_MAX_BYTES) {
      return NextResponse.json({ error: 'PDF must be 10 MB or smaller.' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const read = await readPdf(bytes)
    const full = String(read.text ?? '').trim()
    const text = full.slice(0, PDF_TEXT_MAX_CHARS)
    const figures = keepPdfFigures(read.figures)

    if (!pdfCanStartQuiz({ text, figureCount: figures.length })) {
      return NextResponse.json(
        { error: 'No readable text or figures found in this PDF.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      text,
      truncated: full.length > text.length,
      pageCount: read.pageCount,
      filename: String(file.name || 'notes.pdf'),
      figures: figures.map(({ id, page, caption, dataUrl, width, height }) => ({
        id, page, caption, dataUrl, width, height,
      })),
    })
  } catch (error) {
    console.error('PDF extract error:', error)
    return NextResponse.json({ error: 'Failed to read that PDF.' }, { status: 500 })
  }
}
