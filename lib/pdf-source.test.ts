import { describe, expect, it } from 'vitest'
import { PDF_TEXT_MAX_CHARS } from './pdf-upload'
import {
  assignPdfFigures,
  composePdfSource,
  encodePng,
  keepPdfFigures,
  pdfCanStartQuiz,
  pdfFigureRules,
  pdfRejection,
  pixelsToImage,
  sanitizePdfFigures,
  PDF_MAX_BYTES,
  type PdfFigure,
} from './pdf-source'

const png = () => {
  const pixels = new Uint8Array(90 * 90 * 4)
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 17) & 255
  return pixelsToImage(90, 90, pixels)!
}

describe('how much of a PDF the quiz is allowed to read', () => {
  it('keeps a long chapter instead of the first few pages', () => {
    expect(PDF_TEXT_MAX_CHARS).toBeGreaterThanOrEqual(100_000)
  })
})

describe('whether a PDF may be uploaded', () => {
  it('accepts a real PDF under 10 MB', () => {
    const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
    expect(pdfRejection({ name: 'notes.pdf', type: 'application/pdf', size: 1000, header })).toBeNull()
  })

  it('refuses anything over 10 MB, an empty file, and a file that is not a PDF', () => {
    expect(pdfRejection({ name: 'big.pdf', type: 'application/pdf', size: PDF_MAX_BYTES + 1 })).toMatch(/10 MB/)
    expect(pdfRejection({ name: 'empty.pdf', type: 'application/pdf', size: 0 })).toMatch(/empty/)
    expect(pdfRejection({ name: 'notes.docx', type: 'application/msword', size: 100 })).toMatch(/Only PDF/)
    const header = new Uint8Array([1, 2, 3, 4, 5])
    expect(pdfRejection({ name: 'fake.pdf', type: 'application/pdf', size: 20, header })).toMatch(/not a PDF/)
  })
})

describe('whether the quiz can start', () => {
  it('starts from the PDF alone and still allows a prompt', () => {
    expect(pdfCanStartQuiz({ text: 'x'.repeat(120), figureCount: 0, prompt: '' })).toBe(true)
    expect(pdfCanStartQuiz({ text: 'x'.repeat(50), figureCount: 2, prompt: '' })).toBe(true)
    expect(pdfCanStartQuiz({ text: '', figureCount: 0, prompt: 'cells' })).toBe(false)
  })
})

describe('which pictures are worth a question', () => {
  it('keeps a real picture and drops a tiny or repeated one', () => {
    const image = png()
    const kept = keepPdfFigures([
      { page: 1, width: 90, height: 90, caption: 'A labelled plant cell.', bytes: image.bytes, mime: image.mime },
      { page: 1, width: 90, height: 90, caption: 'same bytes', bytes: image.bytes, mime: image.mime },
      { page: 2, width: 16, height: 16, caption: 'icon', bytes: image.bytes, mime: image.mime },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0].id).toBe('pdf-1')
    expect(kept[0].dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('encodes pixels as a PNG', () => {
    const rgba = new Uint8Array([255, 0, 0, 255])
    expect([...encodePng(1, 1, rgba).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(pixelsToImage(1, 1, new Uint8Array([0xff, 0xd8, 0, 1]))?.mime).toBe('image/jpeg')
  })
})

describe('showing a PDF figure on the question about it', () => {
  const figure = (over: Partial<PdfFigure> = {}): PdfFigure => ({
    id: 'pdf-1',
    page: 2,
    caption: 'A plant cell with the chloroplast labelled beside the cell wall.',
    dataUrl: 'data:image/png;base64,aaaa',
    width: 200,
    height: 200,
    ...over,
  })

  it('uses the key the model set', () => {
    const questions: { question: string; image_key?: string; image_url?: string }[] = [
      { question: 'Name the part labelled chloroplast in the diagram.', image_key: 'pdf-1' },
    ]
    expect(assignPdfFigures(questions, [figure()])).toBe(1)
    expect(questions[0].image_url).toBe('data:image/png;base64,aaaa')
  })

  it('still attaches when the key was left empty but the question is about that caption', () => {
    const questions: { question: string; image_url?: string }[] = [
      { question: 'In the diagram, name the chloroplast beside the cell wall.' },
    ]
    expect(assignPdfFigures(questions, [figure()])).toBe(1)
  })

  it('does not attach a picture the question never uses, and does not reuse one', () => {
    const questions: { question: string; image_url?: string }[] = [
      { question: 'In the diagram, name the chloroplast beside the cell wall.' },
      { question: 'In the diagram, name the chloroplast beside the cell wall.' },
      { question: 'What is 2 + 2?' },
    ]
    expect(assignPdfFigures(questions, [figure()])).toBe(1)
    expect(questions[1].image_url).toBeUndefined()
    expect(questions[2].image_url).toBeUndefined()
  })

  it('refuses a figure the browser did not extract', () => {
    expect(sanitizePdfFigures([
      { id: 'pdf-1', page: 1, caption: 'cell', dataUrl: 'data:image/png;base64,aaaa', width: 10, height: 10 },
      { id: '../x', dataUrl: 'https://evil.test/a.png' },
      { id: 'pdf-2', dataUrl: 'data:text/html;base64,aaaa' },
    ])).toHaveLength(1)
  })

  it('puts the figure list in the source without the image bytes', () => {
    const source = composePdfSource('Photosynthesis uses light.', [figure()], 500)
    expect(source).toContain('[Figure pdf-1, page 2]')
    expect(source).not.toContain('base64')
    expect(pdfFigureRules(1)).toContain('image_key')
    expect(pdfFigureRules(0)).toBe('')
  })
})
