import fs from 'fs'
import os from 'os'
import path from 'path'
import { callGemma, type ImageInput } from '@/lib/bedrock'
import {
  getImagesForTextbook,
  type TextbookSourceImage,
} from '@/lib/textbook-source-images'

export interface VisualFigureCatalogEntry {
  key: string
  localPath: string
  category: string
  description: string
  page: number
}

// The bundled cache (committed at build time) is read-only on serverless hosts
// (Lambda/Amplify) where process.cwd() is not writable — writing it throws EROFS.
// So we READ the bundled cache as a warm seed and WRITE runtime additions to a
// writable temp dir, merging the two on read.
const BUNDLED_CACHE_PATH = path.join(process.cwd(), 'data', 'textbook-images', 'vision-cache.json')
const RUNTIME_CACHE_PATH = path.join(os.tmpdir(), 'vision-cache.json')
const PUBLIC_ROOT = path.join(process.cwd(), 'public')

/** Max figures to describe with vision per assessment (cost cap). */
export const MAX_VISION_FIGURES = 5
/** Max questions that should use an image_key (figures can be reused). */
export function maxQuestionsWithImages(questionCount: number): number {
  if (questionCount <= 5) return 3
  if (questionCount <= 10) return 5
  return Math.min(6, Math.ceil(questionCount * 0.4))
}

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
      .filter((w) => w.length > 3),
  )
}

/** Prefer diagrammatic figures over tangential photos when scores tie. */
const DIAGRAM_TYPES = new Set(['diagram', 'graph', 'chart', 'map', 'table', 'apparatus'])
function diagramTypeBonus(visionType?: string): number {
  return visionType && DIAGRAM_TYPES.has(visionType) ? 0.08 : 0
}

function topicOverlap(topics: string[], haystack: string): number {
  const hay = normalizeText(haystack)
  if (!hay || !topics.length) return 0
  let best = 0
  for (const topic of topics) {
    const t = normalizeText(topic)
    if (!t) continue
    if (hay.includes(t)) {
      best = Math.max(best, 0.85)
      continue
    }
    const words = significantWords(t)
    if (!words.size) continue
    let shared = 0
    for (const w of words) if (hay.includes(w)) shared++
    best = Math.max(best, shared / words.size)
  }
  return best
}

export function filterImagesByTopics(
  images: TextbookSourceImage[],
  topics: string[],
  minScore = 0.35,
): TextbookSourceImage[] {
  const topicList = topics.map((t) => t.trim()).filter(Boolean)
  if (!topicList.length) return []

  const scored = images
    .map((img) => ({
      img,
      // Match on the figure's actual depicted content (vision description +
      // keywords) first, falling back to page text for un-described images.
      // Nudge genuine diagrams/charts/maps above tangential photos on ties.
      score:
        topicOverlap(
          topicList,
          `${img.description || ''} ${img.keywords || ''} ${img.pageText} ${img.textbookName} ${img.category || ''}`,
        ) + diagramTypeBonus(img.visionType),
    }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.img.qualityScore || 0) - (a.img.qualityScore || 0))

  return scored.map((s) => s.img)
}

export function selectFiguresForAssessment(
  images: TextbookSourceImage[],
  limit = MAX_VISION_FIGURES,
): TextbookSourceImage[] {
  if (!images.length) return []
  const pool = [...images].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
  const top = pool.slice(0, Math.min(pool.length, Math.max(limit * 3, limit)))
  const picked: TextbookSourceImage[] = []
  const used = new Set<string>()

  while (picked.length < limit && top.length > 0) {
    const idx = Math.floor(Math.random() * Math.min(top.length, limit * 2))
    const candidate = top.splice(idx, 1)[0]
    if (!candidate || used.has(candidate.key)) continue
    used.add(candidate.key)
    picked.push(candidate)
  }

  return picked
}

type VisionCache = Record<string, { description: string; cached_at: string }>

function readCacheFile(file: string): VisionCache {
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as VisionCache
  } catch {
    return {}
  }
}

function readVisionCache(): VisionCache {
  // Runtime additions take precedence over the bundled seed.
  return { ...readCacheFile(BUNDLED_CACHE_PATH), ...readCacheFile(RUNTIME_CACHE_PATH) }
}

function writeVisionCache(cache: VisionCache) {
  // Best-effort: a read-only filesystem must never break generation.
  try {
    fs.writeFileSync(RUNTIME_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
  } catch {
    /* non-fatal — describing again next time is cheaper than crashing */
  }
}

function mimeForPath(localPath: string): string {
  const ext = path.extname(localPath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

function appOrigin(): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  if (configured) return configured
  const vercel = String(process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel}`
  return ''
}

async function loadImageInput(localPath: string): Promise<ImageInput | null> {
  const normalized = localPath.replace(/^\//, '')
  const disk = path.join(PUBLIC_ROOT, normalized.replace(/\//g, path.sep))
  if (fs.existsSync(disk)) {
    const buf = fs.readFileSync(disk)
    if (buf.length >= 500) {
      return {
        base64: buf.toString('base64'),
        mimeType: mimeForPath(localPath),
      }
    }
  }

  const origin = appOrigin()
  if (!origin) return null

  try {
    const response = await fetch(`${origin}/${normalized}`, { cache: 'no-store' })
    if (!response.ok) return null
    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length < 500) return null
    return {
      base64: buf.toString('base64'),
      mimeType: mimeForPath(localPath),
    }
  } catch {
    return null
  }
}

const VISION_PROMPT =
  'Describe this textbook figure for a teacher writing exam questions. In 2-4 short sentences state: what it shows, any labels/axes/values, the topic, and how it could be tested. Plain text only.'

export async function describeFigureWithVision(img: TextbookSourceImage): Promise<string | null> {
  const cache = readVisionCache()
  if (cache[img.key]?.description) return cache[img.key].description

  const image = await loadImageInput(img.localPath)
  if (!image) return img.pageText?.trim() || null

  try {
    const description = await callGemma(VISION_PROMPT, {
      maxTokens: 220,
      temperature: 0.2,
      image,
      maxCandidates: 2,
    })
    const text = description.trim()
    if (!text) return null
    cache[img.key] = { description: text, cached_at: new Date().toISOString() }
    writeVisionCache(cache)
    return text
  } catch (err) {
    console.error(`Vision describe failed for ${img.key}:`, err)
    return img.pageText?.trim() || null
  }
}

export async function buildVisualFigureCatalog(opts: {
  textbookId: number
  topics: string[]
  questionCount: number
}): Promise<VisualFigureCatalogEntry[]> {
  const all = getImagesForTextbook(opts.textbookId)
  const filtered = filterImagesByTopics(all, opts.topics)
  if (!filtered.length) return []

  const selected = selectFiguresForAssessment(
    filtered,
    Math.min(MAX_VISION_FIGURES, maxQuestionsWithImages(opts.questionCount)),
  )
  if (!selected.length) return []

  const catalog: VisualFigureCatalogEntry[] = []
  for (const img of selected) {
    const description = await describeFigureWithVision(img)
    if (!description) continue
    catalog.push({
      key: img.key,
      localPath: img.localPath,
      category: img.category || 'diagram',
      description,
      page: img.page,
    })
  }
  return catalog
}

export function buildVisualCatalogPromptBlock(
  catalog: VisualFigureCatalogEntry[],
  maxImageQuestions: number,
): string {
  if (!catalog.length) return ''
  const lines = catalog.map(
    (c) =>
      `- image_key: "${c.key}" | page ${c.page} | ${c.category} | ${c.description}`,
  )
  return `
AVAILABLE TEXTBOOK FIGURES (vision-described; topic-filtered):
${lines.join('\n')}

FIGURE RULES (STRICT):
- Use "image_key" on at most ${maxImageQuestions} question(s) in this batch. The same image_key may be reused on multiple questions with different wording.
- Only set image_key when the question is directly answerable from that figure's description.
- When image_key is set, write the question about THAT figure — do not invent a different diagram.
- Do NOT use phrases like "refer to the diagram" unless image_key is set.
- Most questions should have NO image_key (text-only).
`
}

export function attachImagesFromCatalog(
  questions: Array<{ image_key?: string; image_url?: string }>,
  catalog: VisualFigureCatalogEntry[],
): number {
  const byKey = new Map(catalog.map((c) => [c.key, c.localPath]))
  let n = 0
  for (const q of questions) {
    const key = String(q.image_key || '').trim()
    if (!key) continue
    const url = byKey.get(key)
    if (url) {
      q.image_url = url
      n++
    }
    delete q.image_key
  }
  return n
}
