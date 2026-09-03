// lib/studylab/imageMime.ts

/**
 * The image type the bytes actually are, whatever the file said it was.
 *
 * A file's extension and a browser's `File.type` are both hearsay: one of the
 * two homework pages this was built against is named `.gif` and is a PNG.
 * Bedrock reads the magic bytes and refuses the whole call on a mismatch —
 * "the detected file MIME type image/png does not match the expected type
 * image/gif" — so a student photographing their homework would have got
 * nothing back, for a reason they could not act on.
 *
 * Returns null when the header is not one we recognise, so the caller can keep
 * whatever it had rather than assert something equally unfounded.
 */
export function sniffImageMime(base64: string): string | null {
  // 12 bytes covers every signature below; 16 base64 chars decode to 12 bytes.
  let head: Uint8Array
  try {
    const bin = atob(base64.slice(0, 24))
    head = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
  const is = (...bytes: number[]) => bytes.every((b, i) => head[i] === b)

  if (is(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (is(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (is(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  // RIFF....WEBP
  if (is(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45) return 'image/webp'
  return null
}

/** The same image, labelled with the type it really is. */
export function correctImageMime<T extends { base64: string; mimeType: string }>(image: T): T {
  const actual = sniffImageMime(image.base64)
  return actual && actual !== image.mimeType ? { ...image, mimeType: actual } : image
}

/**
 * A `data:` URL as something a model call can take, labelled honestly.
 *
 * Anything that is not a data URL comes back null rather than as a half-built
 * image, because a malformed one fails the whole call rather than the part of
 * it that wanted a picture.
 */
export function parseImageDataUrl(value: unknown): { mimeType: string; base64: string } | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return correctImageMime({ mimeType: m[1], base64: m[2] })
}
