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
  /** Vision-generated: what the figure actually depicts (content-based matching). */
  description?: string
  /** Vision-generated: comma-separated search keywords for the figure's content. */
  keywords?: string
  /** Vision-classified figure type (diagram, map, apparatus, etc.). */
  visionType?: string
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

/**
 * A catalogued figure whose file is not on disk.
 *
 * `manifest.curated.json` lists 653 images that were never written out —
 * 425 of the 1,567 `cambridge-papers` directories are empty. Nothing checked,
 * so they were offered to the picker like any other figure, and a live Stage 6
 * Science paper shipped five questions under the heading
 *
 *   QUESTIONS 5-9 REFER TO THE FIGURE BELOW
 *
 * above an empty box: /textbook-images/cambridge-papers/966315/p2-fig-9.png,
 * 404. Five questions with nothing to answer them from.
 *
 * `BLOCKED_IMAGE_KEYS` above is the hand-maintained version of this idea and
 * holds exactly one key. The disk already knows the answer for all of them.
 *
 * One `existsSync` per entry, once per process — the manifest is cached right
 * after this and never re-read. Directories are cached because the extractions
 * cluster into them, so most entries cost a map lookup rather than a syscall.
 */
const dirCache = new Map<string, Set<string> | null>()

function fileIsThere(localPath: unknown): boolean {
  const rel = String(localPath ?? '')
  // An entry with no path at all is not ours to judge here; the callers that
  // need one already check for it.
  if (!rel) return true

  const full = path.join(process.cwd(), 'public', rel)
  const dir = path.dirname(full)

  let entries = dirCache.get(dir)
  if (entries === undefined) {
    try {
      entries = new Set(fs.readdirSync(dir))
    } catch {
      entries = null
    }
    dirCache.set(dir, entries)
  }
  return entries === null ? false : entries.has(path.basename(full))
}

/** Diagrammatic figure types preferred over tangential photos on ties. */
const DIAGRAM_TYPES = new Set(['diagram', 'graph', 'chart', 'map', 'table', 'apparatus'])

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
      images: images.filter((img) => !BLOCKED_IMAGE_KEYS.has(img.key) && fileIsThere(img.localPath)),
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

/**
 * Every figure in the library that carries a vision-generated description.
 *
 * Used by self-directed quizzes, which have no textbook to scope to and so must
 * search the whole library by content. Un-described figures are excluded on
 * purpose: without a description the only thing left to match on is the raw
 * page text, which across ~100 books produces confident-looking matches from
 * incidental word overlap. Textbook-scoped lookups keep using the full set,
 * where surrounding context makes page text a reasonable signal.
 */
export function getDescribedImages(): TextbookSourceImage[] {
  return loadTextbookImageManifest().images.filter(
    (img) => typeof img.description === 'string' && img.description.trim().length > 0
  )
}

function scoreImageForQuestion(
  img: TextbookSourceImage,
  questionText: string,
  topics: string[]
): number {
  // Prefer what the figure actually depicts (vision description + keywords)
  // over the surrounding page text, which is noisier.
  const content = `${img.description || ''} ${img.keywords || ''}`.trim()
  const haystack = content || img.pageText
  let score = overlapScore(questionText, haystack)
  for (const topic of topics) {
    const t = normalizeText(topic)
    if (!t) continue
    if (normalizeText(haystack).includes(t)) score += 0.25
    if (normalizeText(questionText).includes(t)) score += 0.1
  }
  if (img.kind === 'embedded') score += 0.05
  // Prefer genuine diagrams/charts/maps over tangential photos on ties.
  if (img.visionType && DIAGRAM_TYPES.has(img.visionType)) score += 0.08
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
