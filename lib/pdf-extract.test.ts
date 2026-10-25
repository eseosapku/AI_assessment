import { describe, expect, it } from 'vitest'
import { readPdf } from './pdf-extract'

/** A one-page PDF whose only content is a sentence. Offsets are computed. */
function textPdf(sentence: string): Uint8Array {
  const safe = sentence.replace(/[()\\]/g, '')
  const stream = `BT /F1 16 Tf 72 720 Td (${safe}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body))
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Uint8Array(Buffer.from(body))
}

describe('reading a PDF', () => {
  it('returns the sentence on the page', async () => {
    const sentence = 'Photosynthesis converts light into chemical energy inside a chloroplast.'
    const read = await readPdf(textPdf(sentence))
    expect(read.text).toContain('Photosynthesis')
    expect(read.pageCount).toBe(1)
    expect(read.figures).toEqual([])
  }, 20000)
})
