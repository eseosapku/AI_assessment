/**
 * Locate textbook PDF files on disk for image/text extraction.
 */
const fs = require('fs')
const path = require('path')

const DEFAULT_ROOTS = [
  path.join(__dirname, '..', 'data', 'nerdc-textbooks'),
  'C:/Users/Stephen/Downloads/E-Library-20260617T045624Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/E-Library-20260617T044711Z-3-002/E-Library',
  'C:/Users/Stephen/Downloads/Cambridge/Cambridge',
]

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function readRootsFromEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return DEFAULT_ROOTS
  const env = fs.readFileSync(envPath, 'utf8')
  const m = env.match(/^TEXTBOOK_PDF_ROOTS=(.*)$/m)
  if (!m?.[1]?.trim()) return DEFAULT_ROOTS
  return m[1]
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function walkPdfs(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walkPdfs(p, out)
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(p)
  }
  return out
}

let pdfCache = null

function allPdfs(roots = readRootsFromEnv()) {
  if (pdfCache) return pdfCache
  const pdfs = []
  for (const root of roots) pdfs.push(...walkPdfs(root))
  pdfCache = pdfs
  return pdfs
}

function findTextbookPdf(filename, textbookName, roots) {
  const targets = new Set([norm(filename), norm(textbookName)].filter(Boolean))
  for (const p of allPdfs(roots)) {
    if (targets.has(norm(path.basename(p)))) return p
  }
  const tokens = norm(textbookName).split(' ').filter((w) => w.length > 4)
  if (tokens.length >= 3) {
    for (const p of allPdfs(roots)) {
      const bn = norm(path.basename(p))
      if (tokens.every((t) => bn.includes(t))) return p
    }
  }
  return null
}

function curriculumSlug(numeric) {
  if (numeric === 0) return 'rwanda'
  if (numeric === 1) return 'cambridge'
  if (numeric === 2) return 'nigeria'
  return 'other'
}

module.exports = {
  readRootsFromEnv,
  findTextbookPdf,
  curriculumSlug,
  allPdfs,
}
