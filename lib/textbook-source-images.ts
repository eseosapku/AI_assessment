import fs from 'fs'
import path from 'path'

export interface TextbookSourceImage {
  key: string
  textbookId: number
  curriculum: number
  curriculumSlug: string
  textbookName: string
  page: number
  imageIndex: number
  kind: 'embedded' | 'page' | string
  width: number
  height: number
  pageText: string
  localPath: string
  bytes?: number
  source: string
  qualityScore?: number
  qualityReasons?: string[]
  category?: string
}

interface TextbookImageManifest {
  version: number
  extracted_at?: string
  filtered_at?: string
  total?: number
  images: TextbookSourceImage[]
}

const MANIFEST_PATH = path.join(process.cwd(), 'data', 'textbook-images', 'manifest.json')
const CURATED_MANIFEST_PATH = path.join(process.cwd(), 'data', 'textbook-images', 'manifest.curated.json')

/** Corrupt or unusable extractions excluded at load time. */
const BLOCKED_IMAGE_KEYS = new Set(['tb-190-p269-embedded-0'])

let cachedManifest: TextbookImageManifest | null = null

function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 3)
  )
}

function overlapScore(a: string, b: string): number {
  const wa = significantWords(a)
  const wb = significantWords(b)
  if (!wa.size || !wb.size) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.min(wa.size, wb.size)
}

function questionNeedsFigure(text: string): boolean {
  return /\b(figure|diagram|graph|chart|circuit|shown|illustration|sketch|picture|image|table|map|labelled|labeled)\b/i.test(text)
}

export function loadTextbookImageManifest(): TextbookImageManifest {
  if (cachedManifest) return cachedManifest
  const manifestPath = fs.existsSync(CURATED_MANIFEST_PATH) ? CURATED_MANIFEST_PATH : MANIFEST_PATH
  if (!fs.existsSync(manifestPath)) {
    cachedManifest = { version: 1, images: [] }
    return cachedManifest
  }
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as TextbookImageManifest
    const images = Array.isArray(raw?.images) ? raw.images : []
    cachedManifest = {
      version: 1,
      images: images.filter((img) => !BLOCKED_IMAGE_KEYS.has(img.key)),
    }
  } catch {
    cachedManifest = { version: 1, images: [] }
  }
  return cachedManifest
}

export function getImagesForTextbook(textbookId: number): TextbookSourceImage[] {
  return loadTextbookImageManifest().images.filter((img) => img.textbookId === textbookId)
}

export function textbookHasImages(textbookId: number): boolean {
  return getImagesForTextbook(textbookId).length > 0
}

function scoreImageForQuestion(
  img: TextbookSourceImage,
  questionText: string,
  topics: string[]
): number {
  let score = overlapScore(questionText, img.pageText)
  for (const topic of topics) {
    const t = normalizeText(topic)
    if (!t) continue
    if (normalizeText(img.pageText).includes(t)) score += 0.25
    if (normalizeText(questionText).includes(t)) score += 0.1
  }
  if (img.kind === 'embedded') score += 0.05
  return score
}

export function attachTextbookImages(
  questions: Array<{ question?: string; image_url?: string; needs_diagram?: boolean }>,
  opts: { textbookId: number; topics?: string[]; maxImages?: number }
): number {
  const candidates = getImagesForTextbook(opts.textbookId)
  if (!candidates.length) return 0

  const topics = opts.topics ?? []
  const maxImages = opts.maxImages ?? 4
  const used = new Set<string>()
  let attached = 0

  const needsVisual = questions.filter(
    (q) => q.question && !q.image_url && (q.needs_diagram === true || questionNeedsFigure(q.question))
  )

  for (const q of needsVisual) {
    if (attached >= maxImages) break
    let best: TextbookSourceImage | null = null
    let bestScore = 0.2

    for (const img of candidates) {
      if (used.has(img.key)) continue
      const score = scoreImageForQuestion(img, q.question!, topics)
      if (score > bestScore) {
        bestScore = score
        best = img
      }
    }

    if (best) {
      q.image_url = best.localPath
      used.add(best.key)
      attached++
    }
  }

  return attached
}

export function isSchoolCurriculum(curriculum: number | null | undefined): boolean {
  return curriculum === 0 || curriculum === 1 || curriculum === 2
}
