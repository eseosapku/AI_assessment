/**
 * A library-wide figure catalogue that only offers figures this quiz may print.
 *
 * `buildVisualFigureCatalogForTopics` ranks the whole library on topic words
 * and the subject and level gates ran afterwards, on the finished paper. So
 * the four catalogue places went to whatever ranked highest -- an O Level
 * past-paper circuit on a Stage 8 quiz -- and were then taken off again: a
 * typed "Electric circuits" quiz attached three figures and removed all three
 * as "belonging to another subject", and shipped with none. Filtering the pool
 * first means every place in the catalogue holds a figure that can be shown.
 *
 * Built from the shared module's own pieces, which are not ours to reshape
 * (it is shared with StudyLab).
 *
 * Server-only.
 */
import { getDescribedImages } from './textbook-source-images'
import {
  describeFigureWithVision, maxQuestionsWithImages, MAX_VISION_FIGURES, rankImagesForFreeTopics,
  selectFiguresForAssessment, type VisualFigureCatalogEntry,
} from './textbook-vision-images'
import { figureAllowedOnPaper } from './figure-provenance'

/** How many of the best topic matches stay in play before the quality pick. Same reasoning as the shared module. */
const RELEVANCE_SHORTLIST = 60

export async function buildSubjectFigureCatalog(opts: {
  topics: string[]
  questionCount: number
  subject: string
  stage?: number
}): Promise<VisualFigureCatalogEntry[]> {
  const topics = opts.topics.map((t) => t.trim()).filter(Boolean)
  if (!topics.length) return []
  const pool = getDescribedImages().filter((img) => figureAllowedOnPaper(img.localPath, opts.subject, opts.stage))
  const ranked = rankImagesForFreeTopics(pool, topics)
  if (!ranked.length) return []
  const selected = selectFiguresForAssessment(
    ranked.slice(0, RELEVANCE_SHORTLIST),
    Math.min(MAX_VISION_FIGURES, maxQuestionsWithImages(opts.questionCount)),
  )
  const catalog: VisualFigureCatalogEntry[] = []
  for (const img of selected) {
    const description = await describeFigureWithVision(img)
    if (!description) continue
    catalog.push({ key: img.key, localPath: img.localPath, category: img.category || 'diagram', description, page: img.page })
  }
  return catalog
}
