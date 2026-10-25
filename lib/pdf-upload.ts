/**
 * Checks the browser can run before a PDF is uploaded.
 *
 * Kept out of lib/pdf-source.ts because that file encodes images with zlib,
 * which the wizard cannot import.
 */

export const PDF_MAX_BYTES = 10 * 1024 * 1024
/**
 * How much of a PDF is given to the quiz writer.
 *
 * A 10 MB file can hold a long chapter. 12,000 characters was a few pages and
 * threw the rest away. 100,000 is enough for that chapter without sending the
 * whole file into the model.
 */
export const PDF_TEXT_MAX_CHARS = 100_000

export interface UploadedPdf {
  filename: string
  text: string
  pageCount: number | null
  truncated: boolean
  figures: { id: string; page: number; caption: string; dataUrl: string; width: number; height: number }[]
}

/** A quiz can start from the file alone. A prompt is allowed and never required. */
export function pdfCanStartQuiz(input: { text?: unknown; figureCount?: unknown; prompt?: unknown }): boolean {
  const text = String(input.text ?? '').trim()
  const figures = Number(input.figureCount) || 0
  const prompt = String(input.prompt ?? '').trim()
  if (text.length >= 120) return true
  if (figures > 0 && (text.length >= 40 || prompt.length >= 2)) return true
  return false
}
