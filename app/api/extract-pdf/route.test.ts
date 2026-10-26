import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/pdf-extract', () => ({ readPdf: vi.fn() }))

import { readPdf } from '@/lib/pdf-extract'
import { POST } from './route'

const pngBytes = (() => {
  const pixels = new Uint8Array(90 * 90 * 4).fill(9)
  return pixels
})()

function pdfFile(over: { name?: string; type?: string; bytes?: Uint8Array } = {}) {
  const bytes = over.bytes ?? new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
  return new File([Buffer.from(bytes)], over.name ?? 'notes.pdf', { type: over.type ?? 'application/pdf' })
}

const post = (file: File | null) => {
  const body = new FormData()
  if (file) body.set('file', file)
  return POST(new NextRequest('http://localhost/api/extract-pdf', { method: 'POST', body }))
}

beforeEach(() => {
  vi.mocked(readPdf).mockReset()
  vi.mocked(readPdf).mockResolvedValue({
    text: 'Photosynthesis converts light into chemical energy inside the chloroplast of a green plant. '.repeat(4),
    pageCount: 2,
    figures: [{
      page: 1,
      width: 90,
      height: 90,
      caption: 'A plant cell.',
      bytes: pngBytes,
      mime: 'image/png',
    }],
  })
})

describe('reading an uploaded PDF', () => {
  it('returns the text and a figure the quiz can show', async () => {
    const res = await post(pdfFile())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.text).toContain('Photosynthesis')
    expect(body.figures).toHaveLength(1)
    expect(body.figures[0].id).toBe('pdf-1')
    expect(body.figures[0].dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('refuses a file over 10 MB before reading it', async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1)
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0)
    const res = await post(pdfFile({ bytes }))
    expect(res.status).toBe(400)
    expect(readPdf).not.toHaveBeenCalled()
  })

  it('refuses a file that is not a PDF', async () => {
    const res = await post(pdfFile({ name: 'notes.txt', type: 'text/plain', bytes: new Uint8Array([1, 2, 3, 4, 5]) }))
    expect(res.status).toBe(400)
    expect(readPdf).not.toHaveBeenCalled()
  })
})
