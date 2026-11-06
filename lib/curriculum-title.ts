/** Reject identifiable PDF furniture/extraction scraps, not legitimate syllabus headings. */
export function isLearningTitle(value: unknown): boolean {
  const title = String(value ?? '').trim()
  const body = title.replace(/^(?:chapter|unit|topic)\s*\d+[a-z]?\s*[:.\-]?\s*/i, '').trim()
  if (!body || /^(?:unit contents|table of contents|contents|copyright|acknowledgements?|bibliography|glossary|index)$/i.test(body)) return false
  if (/^(?:introductory activity|end(?: of)? unit assessment|self assessment|unit review|review exercise)$/i.test(body)) return false
  if (/^(?:you will|you should|by the end|on completion)\b/i.test(body)) return false
  if (/\b(?:cm|mm|metres?)\s+side\b.*\bnot\b/i.test(body)) return false
  return true
}
