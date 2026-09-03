// lib/studylab/imageMime.test.ts
import { describe, it, expect } from 'vitest'
import { sniffImageMime, correctImageMime } from './imageMime'

/** The first bytes of a real file of each type, base64 as a data URL carries it. */
const b64 = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString('base64')

const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])
const GIF = b64([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0, 0x10, 0, 0x80, 0])
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

describe('sniffImageMime', () => {
  it('names the type from the bytes', () => {
    expect(sniffImageMime(PNG)).toBe('image/png')
    expect(sniffImageMime(JPEG)).toBe('image/jpeg')
    expect(sniffImageMime(GIF)).toBe('image/gif')
    expect(sniffImageMime(WEBP)).toBe('image/webp')
  })

  it('says nothing rather than guessing at a header it does not know', () => {
    expect(sniffImageMime(b64([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull()
    expect(sniffImageMime('')).toBeNull()
    expect(sniffImageMime('not base64 !!!')).toBeNull()
  })
})

describe('correctImageMime', () => {
  it('relabels a file whose extension lied', () => {
    // One of the two real homework pages is named `.gif` and is a PNG. Bedrock
    // reads the bytes, sees the mismatch, and refuses the entire call:
    // "the detected file MIME type image/png does not match the expected type
    // image/gif" — with nothing the student could do about it.
    expect(correctImageMime({ mimeType: 'image/gif', base64: PNG }).mimeType).toBe('image/png')
  })

  it('leaves an honest one alone', () => {
    const img = { mimeType: 'image/jpeg', base64: JPEG }
    expect(correctImageMime(img)).toBe(img)
  })

  it('keeps what it was given when the header means nothing to it', () => {
    const img = { mimeType: 'image/heic', base64: b64([0, 0, 0, 24, 102, 116, 121, 112, 1, 2, 3, 4]) }
    expect(correctImageMime(img).mimeType).toBe('image/heic')
  })

  it('carries the rest of the image through untouched', () => {
    const out = correctImageMime({ mimeType: 'image/gif', base64: PNG })
    expect(out.base64).toBe(PNG)
  })
})
