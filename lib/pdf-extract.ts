import path from 'path'
import { pathToFileURL } from 'url'
import pdfParse from 'pdf-parse'
import { PDF_MAX_PAGES, pixelsToImage, type RawPdfImage } from '@/lib/pdf-source'

/**
 * Text and embedded pictures from a student's PDF.
 *
 * pdf.js reads the page's image objects without rendering the page, so a
 * figure can be shown beside a question. If that fails, the text-only reader
 * still returns the words and the quiz goes ahead without pictures.
 */

export interface PdfRead {
  text: string
  pageCount: number
  figures: RawPdfImage[]
}

function pageCaption(items: readonly { str?: string }[]): string {
  return items
    .map((item) => String(item.str ?? '').trim())
    .filter((line) => line.length > 12)
    .slice(0, 4)
    .join(' ')
    .slice(0, 400)
}

async function readWithPdfjs(bytes: Uint8Array): Promise<PdfRead> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')).href,
  }).promise

  const pageCount = Math.min(doc.numPages, PDF_MAX_PAGES)
  const pages: string[] = []
  const figures: RawPdfImage[] = []
  const opCodes = pdfjs.OPS as unknown as Record<string, number>
  const paint = new Set(
    ['paintImageXObject', 'paintImageXObjectRepeat', 'paintInlineImageXObject']
      .map((name) => opCodes[name])
      .filter((op): op is number => typeof op === 'number'),
  )

  try {
    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      const page = await doc.getPage(pageNo)
      const content = await page.getTextContent()
      const lines = (content.items as { str?: string }[])
        .map((item) => String(item.str ?? '').trim())
        .filter(Boolean)
      if (lines.length) pages.push(lines.join(' '))
      const caption = pageCaption(content.items as { str?: string }[])

      const ops = await page.getOperatorList()
      const seen = new Set<string>()
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (!paint.has(ops.fnArray[i])) continue
        const name = String(ops.argsArray[i]?.[0] ?? '')
        if (!name || seen.has(name)) continue
        seen.add(name)
        const obj = await new Promise<any>((resolve) => {
          page.objs.get(name, resolve)
        }).catch(() => null)
        const width = Number(obj?.width)
        const height = Number(obj?.height)
        const data: Uint8Array | null = obj?.data instanceof Uint8Array ? obj.data : null
        if (!data) continue
        const image = pixelsToImage(width, height, data)
        if (!image) continue
        figures.push({ page: pageNo, width, height, caption, bytes: image.bytes, mime: image.mime })
      }
    }
  } finally {
    await doc.destroy()
  }

  return { text: pages.join('\n\n'), pageCount: doc.numPages, figures }
}

function within(ms: number, work: Promise<PdfRead>): Promise<PdfRead> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PDF read took too long')), ms)
    work.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  // pdf.js hands its buffer to a worker and detaches it. A later reader then
  // sees "stream must have data". Each reader gets its own copy, taken first.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

export async function readPdf(bytes: Uint8Array): Promise<PdfRead> {
  const forText = copyBytes(bytes)
  const forPictures = copyBytes(bytes)

  let text = ''
  let pageCount = 0
  try {
    const parsed = await pdfParse(Buffer.from(forText))
    text = String(parsed.text ?? '')
    pageCount = Number(parsed.numpages) || 0
  } catch (error) {
    console.error('PDF text extract failed:', error instanceof Error ? error.message : error)
  }

  let figures: RawPdfImage[] = []
  try {
    const pictures = await within(20_000, readWithPdfjs(forPictures))
    figures = pictures.figures
    if (!text.trim()) text = pictures.text
    if (!pageCount) pageCount = pictures.pageCount
  } catch (error) {
    // The words are already in hand. A slow or failed picture pass must not
    // fail the upload.
    console.error('PDF picture extract failed:', error instanceof Error ? error.message : error)
  }

  return { text, pageCount, figures }
}
