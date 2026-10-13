import fs from 'fs'
import os from 'os'
import path from 'path'
import { callGemma, type ImageInput } from '@/lib/bedrock'
import { describeForPrompt } from '@/lib/figure-keying'
import { figureSrc } from '@/lib/figure-src'
import {
  getImagesForTextbook,
  getDescribedImages,
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

/**
 * Max distinct figures to describe with vision per assessment.
 * Every figure is already vision-described and cached ahead of time (see
 * data/textbook-images/vision-cache.json), so pulling more figures per
 * assessment is nearly free — this is a variety cap, not a cost cap.
 */
export const MAX_VISION_FIGURES = 12
/**
 * Target number of questions that may carry an image_key (figures can be
 * reused, but see groupQuestionsByFigure for how reused figures are kept
 * contiguous). Roughly half the paper, with a floor for very short papers.
 */
export function maxQuestionsWithImages(questionCount: number): number {
  return Math.max(3, Math.round(questionCount * 0.5))
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

// NOTE: minScore was investigated as a possible variety bottleneck and left at
// 0.35. Sampling real catalogs (e.g. Cambridge Physics chapters on "Electric
// current, potential difference and resistance" and "Magnetic fields and
// electromagnetism") showed the score distribution is bimodal: genuine
// content matches cluster at 0.5+, while 0.2-0.34 is dominated by figures
// that share only a single generic word with the topic name (e.g. "current"
// matching a Tesla-coil photo, "resistance" matching a roller-coaster energy
// diagram, "difference" matching an unrelated potential-energy graph).
// Lowering the threshold admits that noise without meaningfully raising the
// count of genuinely relevant figures, so it was left unchanged. The actual
// variety bottleneck was MAX_VISION_FIGURES and the prompt language above.
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
  const origin =
    appOrigin() ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '')
  const fromCdn = figureSrc(localPath)
  const url = fromCdn !== localPath ? fromCdn : origin ? `${origin}/${normalized}` : ''

  if (!url) return null

  try {
    const response = await fetch(url, { cache: 'no-store' })
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

/**
 * How many of the most relevant matches stay in play before variety selection.
 *
 * Wide enough that two quizzes on the same topic don't show an identical set of
 * figures, narrow enough that the pool is still genuinely about the topic.
 */
const RELEVANCE_SHORTLIST = 60

/**
 * Words that describe the figure rather than its subject. Nearly every
 * vision-written description contains several, so they match everything and
 * mean nothing — counting them as topical overlap is what lets "Pawn structure"
 * find a diagram of a chloroplast.
 */
const FIGURE_BOILERPLATE = new Set([
  'diagram', 'diagrams', 'image', 'images', 'photograph', 'photo', 'picture',
  'shows', 'show', 'showing', 'shown', 'illustrates', 'illustrating', 'illustration',
  'depicts', 'depicting', 'figure', 'figures', 'labeled', 'labelled', 'labels', 'label',
  'graph', 'chart', 'table', 'diagrammatic', 'key', 'this', 'that', 'these', 'with',
  'from', 'which', 'their', 'there', 'includes', 'including', 'various', 'different',
  'showing', 'above', 'below', 'left', 'right', 'each', 'used', 'also', 'such',
])

/**
 * Distinctive words in a phrase: long enough to carry meaning, and not part of
 * the boilerplate every description shares.
 */
function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of String(text || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)) {
    if (w.length > 3 && !FIGURE_BOILERPLATE.has(w)) out.add(w)
  }
  return out
}

/**
 * Rank library-wide candidates by how many distinctive words they share with
 * the topic vocabulary.
 *
 * `filterImagesByTopics` is deliberately not reused here. It normalises overlap
 * by the shorter word set, so a two-word topic that matches a single word in a
 * long description scores 1.0 — which is a sensible signal inside one on-topic
 * textbook, and useless across a hundred books, where it matched a chess quiz
 * to a Golgi apparatus and a football quiz to a logarithm graph. Requiring two
 * distinct shared content words is what separates "about this" from "mentions a
 * word from this", and topics with no coverage in the library correctly return
 * nothing rather than something confidently wrong.
 */
const MIN_SHARED_WORDS = 2

export function rankImagesForFreeTopics(
  images: TextbookSourceImage[],
  topics: string[],
): TextbookSourceImage[] {
  const vocab = contentWords(topics.join(' '))
  if (vocab.size === 0) return []

  const scored: { img: TextbookSourceImage; shared: number }[] = []
  for (const img of images) {
    const text = `${img.description || ''} ${img.keywords || ''}`
    let shared = 0
    for (const w of contentWords(text)) if (vocab.has(w)) shared++
    if (shared >= MIN_SHARED_WORDS) scored.push({ img, shared })
  }

  // Ties on shared-word count are common, so break them on figure type before
  // image quality: among equally on-topic candidates a labelled diagram teaches
  // more than an incidental photograph, and quality alone would rank a
  // well-shot picture of silver foil above a diagram of a chloroplast.
  scored.sort(
    (a, b) =>
      b.shared - a.shared ||
      diagramTypeBonus(b.img.visionType) - diagramTypeBonus(a.img.visionType) ||
      (b.img.qualityScore || 0) - (a.img.qualityScore || 0),
  )
  return scored.map((s) => s.img)
}

/**
 * Find figures for a self-directed quiz, which has no textbook to scope to.
 *
 * Same selection and description pipeline as `buildVisualFigureCatalog`; only
 * the candidate pool differs — every described figure in the library rather
 * than one book's. Returns an empty catalog when nothing matches well, and the
 * generator then simply writes a quiz without figures.
 */
export async function buildVisualFigureCatalogForTopics(opts: {
  topics: string[]
  questionCount: number
}): Promise<VisualFigureCatalogEntry[]> {
  const topics = opts.topics.map((t) => t.trim()).filter(Boolean)
  if (!topics.length) return []

  const ranked = rankImagesForFreeTopics(getDescribedImages(), topics)
  if (!ranked.length) return []

  // `selectFiguresForAssessment` re-sorts by image quality, which is right for a
  // textbook lookup where every candidate already comes from the student's own
  // on-topic book — but across the whole library it would surface the
  // best-looking figures rather than the ones about this topic. Cut to a
  // relevance shortlist first so quality only breaks ties among relevant ones.
  const shortlist = ranked.slice(0, RELEVANCE_SHORTLIST)

  const selected = selectFiguresForAssessment(
    shortlist,
    Math.min(MAX_VISION_FIGURES, maxQuestionsWithImages(opts.questionCount)),
  )

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
  // Each figure carries its own instruction, because what can honestly be
  // asked depends on how that figure is keyed. 46% of the library names its
  // parts in the image, which makes "identify the axon" a reading exercise
  // rather than a question — see lib/figure-keying.ts.
  const lines = catalog.map((c) => describeForPrompt(c))
  return `
AVAILABLE TEXTBOOK FIGURES (vision-described; topic-filtered):
${lines.join('\n')}

FIGURE RULES:
- Use a figure WHEREVER it genuinely carries the question — aim to get close to ${maxImageQuestions} question(s) in this batch using "image_key". Treat that number as a target to approach, not a ceiling to avoid.
- PREFER VARIETY: spread image_key usage across the different figures listed above rather than leaning on one or two of them. Only reuse the same image_key when you've already put every relevant figure to good use.
- Only set image_key when the question is directly answerable from that figure's description.
- When image_key is set, write the question about THAT figure — do not invent a different diagram.
- Do NOT use phrases like "refer to the diagram" unless image_key is set.
- Leave image_key empty only when no listed figure genuinely fits that question.
- THE TEST FOR AN ILLUSTRATED QUESTION: a student who cannot see the figure must be unable to answer it. If the question can be answered from its own wording, the figure is decoration — remove the figure or rewrite the question.
- NEVER describe the figure's contents in the question. Point at it ("In the diagram…", "Using the graph…") and stop. Writing "the image shows a backyard during a rainfall" tells the student everything and makes the picture pointless.
- NEVER state or paraphrase the answer in the question. A stem mentioning "rainfall" whose answer is "a rainy day" is a broken question.
- Name the figure correctly. Call a photograph a photograph, a diagram a diagram. Calling a photograph "a map" is confusing to read and actively misleading to a student using a screen reader.
- Ask the student to DO something with the figure: read a value from it, compare two regions, put stages in order, work out a consequence. Avoid "what does this show?", which is answerable by guessing.
- EACH FIGURE ABOVE CARRIES ITS OWN INSTRUCTION after "For this figure:". Follow it. A figure whose parts are already named in the image cannot be used for a naming question — the answer is printed on it, and the student would be reading rather than thinking.
`
}

/**
 * Does this figure have anything at all to do with this question?
 *
 * The model chooses each question's figure from the catalogue, and it
 * occasionally picks one with no connection — a photo of base-ten blocks
 * attached to "Which shape has four right angles?". A wrong figure is worse
 * than none: the student reads it as part of the question and tries to answer
 * from it.
 *
 * The bar is deliberately low — one shared content word — because it only needs
 * to catch pairings with literally nothing in common. Question text alone is
 * too thin (figure-dependent questions often just say "in the diagram above"),
 * so options and explanation are included, which is where the subject matter
 * is actually named.
 */
export function figureMatchesQuestion(
  question: { question?: unknown; options?: unknown; explanation?: unknown },
  figure: { description?: string },
): boolean {
  const figureWords = contentWords(figure.description || '')
  if (figureWords.size === 0) return true // nothing to judge against; leave it alone

  const questionText = [
    String(question.question ?? ''),
    Array.isArray(question.options) ? question.options.join(' ') : '',
    String(question.explanation ?? ''),
  ].join(' ')

  for (const w of contentWords(questionText)) if (figureWords.has(w)) return true
  return false
}

export function attachImagesFromCatalog(
  questions: Array<{ image_key?: string; image_url?: string; question?: unknown; options?: unknown; explanation?: unknown }>,
  catalog: VisualFigureCatalogEntry[],
): number {
  const byKey = new Map(catalog.map((c) => [c.key, c]))
  let n = 0
  for (const q of questions) {
    const key = String(q.image_key || '').trim()
    if (!key) continue
    const entry = byKey.get(key)
    // Drop a figure the model attached to an unrelated question rather than
    // showing it — the question still works without one.
    if (entry && figureMatchesQuestion(q, entry)) {
      q.image_url = entry.localPath
      n++
    }
    delete q.image_key
  }
  return n
}
