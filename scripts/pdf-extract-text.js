/**
 * Extract plain text from a PDF file (Node wrapper around pdf-parse).
 */
const fs = require('fs')
const pdfParse = require('pdf-parse')

async function extractPdfText(pdfPath, maxChars = null) {
  const buf = fs.readFileSync(pdfPath)
  const data = await pdfParse(buf)
  let text = String(data.text || '').replace(/\s+/g, ' ').trim()
  const pageCount = Number.isFinite(data.numpages) ? data.numpages : null
  const fullLen = text.length
  if (maxChars && text.length > maxChars) {
    text = text.slice(0, maxChars)
  }
  return { text, pageCount, charCount: fullLen }
}

module.exports = { extractPdfText }
