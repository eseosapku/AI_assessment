import { deflateSync } from 'zlib'
import { PDF_MAX_BYTES, pdfCanStartQuiz } from '@/lib/pdf-upload'

export { PDF_MAX_BYTES, pdfCanStartQuiz }

/**
 * A student's own PDF as the source of a "quiz me on anything" quiz.
 *
 * The written prompt stays optional. The file does not: over 10 MB is refused
 * before it is parsed, and only real pictures (not logos and rules) are kept
 * to show beside a question.
 */
export const PDF_MAX_PAGES = 30
export const PDF_MAX_FIGURES = 6
/** A rule, an icon or a bullet is not a figure a question can be about. */
export const PDF_MIN_IMAGE_PX = 80
export const PDF_MAX_FIGURE_BYTES = 350_000

export interface PdfFigure {
  id: string
  page: number
  caption: string
  dataUrl: string
  width: number
  height: number
}

const DATA_URL = /^data:image\/(?:png|jpeg);base64,[a-z0-9+/]+=*$/i

export function pdfRejection(input: { name?: unknown; type?: unknown; size?: unknown; header?: Uint8Array | null }): string | null {
  const name = String(input.name ?? '')
  const type = String(input.type ?? '').toLowerCase()
  const looksPdf = type.includes('pdf') || name.toLowerCase().endsWith('.pdf')
  if (!looksPdf) return 'Only PDF files are supported.'
  const size = Number(input.size)
  if (!Number.isFinite(size) || size <= 0) return 'PDF file is empty.'
  if (size > PDF_MAX_BYTES) return 'PDF must be 10 MB or smaller.'
  const header = input.header
  if (header && header.length >= 5) {
    const mark = String.fromCharCode(...header.subarray(0, 5))
    if (mark !== '%PDF-') return 'That file is not a PDF.'
  }
  return null
}

export interface RawPdfImage {
  page: number
  width: number
  height: number
  caption: string
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
}

/** Drop decorations, duplicates and anything too large to store on a question. */
export function keepPdfFigures(images: readonly RawPdfImage[]): PdfFigure[] {
  const kept: PdfFigure[] = []
  const seen = new Set<string>()
  for (const image of images) {
    if (kept.length >= PDF_MAX_FIGURES) break
    if (image.width < PDF_MIN_IMAGE_PX || image.height < PDF_MIN_IMAGE_PX) continue
    if (image.width > 4000 || image.height > 4000) continue
    if (image.bytes.byteLength < 100 || image.bytes.byteLength > PDF_MAX_FIGURE_BYTES) continue
    const signature = `${image.mime}:${image.bytes.byteLength}:${image.bytes[0]}:${image.bytes[image.bytes.byteLength - 1]}`
    if (seen.has(signature)) continue
    seen.add(signature)
    const id = `pdf-${kept.length + 1}`
    kept.push({
      id,
      page: image.page,
      caption: image.caption.replace(/\s+/g, ' ').trim().slice(0, 400),
      dataUrl: `data:${image.mime};base64,${Buffer.from(image.bytes).toString('base64')}`,
      width: image.width,
      height: image.height,
    })
  }
  return kept
}

/** What the client sent, minus anything that is not one of our figures. */
export function sanitizePdfFigures(value: unknown): PdfFigure[] {
  if (!Array.isArray(value)) return []
  const out: PdfFigure[] = []
  for (const item of value) {
    if (out.length >= PDF_MAX_FIGURES) break
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.id ?? '')
    const dataUrl = String(row.dataUrl ?? '')
    if (!/^pdf-\d+$/.test(id)) continue
    if (!DATA_URL.test(dataUrl) || dataUrl.length > PDF_MAX_FIGURE_BYTES * 2) continue
    const page = Number(row.page)
    out.push({
      id,
      page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
      caption: String(row.caption ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
      dataUrl,
      width: Math.max(0, Number(row.width) || 0),
      height: Math.max(0, Number(row.height) || 0),
    })
  }
  return out
}

/** The part of the source the model can point a question at. Data URLs stay off the prompt. */
export function pdfFigureBlock(figures: readonly Pick<PdfFigure, 'id' | 'page' | 'caption'>[]): string {
  if (!figures.length) return ''
  return figures
    .map((f) => `[Figure ${f.id}, page ${f.page}] ${f.caption || 'A figure from the uploaded PDF.'}`)
    .join('\n')
}

export function composePdfSource(text: string, figures: readonly Pick<PdfFigure, 'id' | 'page' | 'caption'>[], maxChars: number): string {
  const block = pdfFigureBlock(figures)
  const body = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!block) return body.slice(0, maxChars)
  const room = Math.max(0, maxChars - block.length - 2)
  return `${body.slice(0, room)}\n\n${block}`.trim()
}

function words(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 3),
  )
}

function overlap(a: string, b: string): number {
  const left = words(a)
  const right = words(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const w of left) if (right.has(w)) shared++
  return shared / Math.min(left.size, right.size)
}

const NEEDS_PICTURE = /\b(diagram|figure|graph|chart|picture|image|illustration|photo|photograph|shown|table|map)\b/i

/**
 * Put a PDF figure on the question that is actually about it.
 *
 * The model is asked to set image_key. It often does not, so a question that
 * says "in the diagram" and shares the figure's caption still receives it.
 * Each figure is used once.
 */
export function assignPdfFigures<T extends { question?: unknown; image_key?: unknown; image_url?: unknown; image_alt?: unknown }>(
  questions: readonly T[],
  figures: readonly PdfFigure[],
  used: Set<string> = new Set(),
): number {
  let attached = 0
  for (const q of questions) {
    if (!q || typeof q !== 'object' || q.image_url) continue
    const stem = String(q.question ?? '')
    const key = String(q.image_key ?? '').trim()
    const keyed = figures.find((f) => f.id === key && !used.has(f.id))
    if (keyed && (NEEDS_PICTURE.test(stem) || overlap(stem, keyed.caption) >= 0.2)) {
      q.image_url = keyed.dataUrl
      q.image_alt = keyed.caption.slice(0, 300)
      used.add(keyed.id)
      attached++
      continue
    }
    if (!NEEDS_PICTURE.test(stem)) continue
    let best: PdfFigure | null = null
    let bestScore = 0
    for (const figure of figures) {
      if (used.has(figure.id)) continue
      const score = overlap(stem, figure.caption)
      if (score > bestScore) {
        best = figure
        bestScore = score
      }
    }
    if (!best || bestScore < 0.34) continue
    q.image_url = best.dataUrl
    q.image_alt = best.caption.slice(0, 300)
    used.add(best.id)
    attached++
  }
  return attached
}

/** Extra source rules when the student's PDF has figures they can be shown. */
export function pdfFigureRules(figureCount: number): string {
  if (figureCount <= 0) return ''
  return `
PDF FIGURES:
- The lines marked [Figure pdf-N] are real pictures extracted from the student's PDF. They ARE shown beside the question when you set "image_key" to that id (for example "pdf-1").
- Set image_key only when the question cannot be answered without seeing that picture, and never use the same id twice.
- In the question text say "in the diagram" or "in the graph". Do not write the marker, a page number, or "Figure 3.2".
- A picture that is not in the list does not exist. Do not ask about it.`
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const name = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([len, name, data, crc])
}

/** RGBA pixels to a PNG. Used when a PDF figure is not already a JPEG. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (width < 1 || height < 1 || rgba.length < width * height * 4) {
    throw new Error('PNG pixels do not match the image size')
  }
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((byte, i) => {
      raw[row + 1 + i] = byte
    })
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Turn pdf.js pixel data into a file the browser can show, or null when it is not a picture. */
export function pixelsToImage(width: number, height: number, data: Uint8Array): { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null {
  if (width < 1 || height < 1 || !data?.length) return null
  if (data[0] === 0xff && data[1] === 0xd8) return { bytes: data, mime: 'image/jpeg' }
  const pixels = width * height
  let rgba: Uint8Array | null = null
  if (data.length === pixels * 4) rgba = data
  else if (data.length === pixels * 3) {
    rgba = new Uint8Array(pixels * 4)
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = data[i * 3]
      rgba[i * 4 + 1] = data[i * 3 + 1]
      rgba[i * 4 + 2] = data[i * 3 + 2]
      rgba[i * 4 + 3] = 255
    }
  } else if (data.length === pixels) {
    rgba = new Uint8Array(pixels * 4)
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i]
      rgba[i * 4 + 3] = 255
    }
  }
  if (!rgba) return null
  return { bytes: encodePng(width, height, rgba), mime: 'image/png' }
}
