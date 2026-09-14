/**
 * Which Checkpoint foci the platform's own figure library can illustrate.
 *
 * A real Checkpoint paper is full of diagrams, tables and graphs. This build
 * reached about two questions in twelve, and the reason was not that figures
 * were unavailable: the library holds ten thousand vision-described figures and
 * the route already searches all of them, because a Checkpoint request carries
 * no textbook_id and so qualifies for the library-wide lookup.
 *
 * Two things held it down, and this module addresses the second of them.
 *
 * 1. The prompt told the model most questions should be text-only. That is a
 *    prompt change, made where the prompt is built.
 * 2. **The paper was commissioning questions the library cannot illustrate.**
 *    Measured against a full Science paper, nine of thirty-four foci had no
 *    figure at all — *the periodic table*, *how soil forms*, *day, night and
 *    the seasons*. Asking for a diagram on those is asking for something that
 *    does not exist, and the model either invents a reference to a figure
 *    nobody will see (which `dropDanglingReferences` then deletes, shortening
 *    the paper) or writes text-only. Either way the figure never arrives.
 *
 * So the blueprint now prefers foci the library can actually illustrate. It
 * **prefers** rather than restricts: a syllabus is not a list of things we
 * happen to own pictures of, and excluding the rest would both distort the
 * paper and make every sitting the same. Uncovered foci are used once the
 * covered ones are spent.
 *
 * Nothing here reproduces a Cambridge figure. These are the platform's own
 * catalogued textbook figures, matched by what they depict.
 *
 * **Server-only.** `getDescribedImages()` reads a 13MB manifest off disk, so
 * anything importing this module must stay on the server — which is why the
 * blueprint is built behind an API route rather than in the browser.
 */
import { getDescribedImages, type TextbookSourceImage } from './textbook-source-images'
import {
  rankImagesForFreeTopics,
  describeFigureWithVision,
  type VisualFigureCatalogEntry,
} from './textbook-vision-images'

/**
 * The subset of `foci` that at least one library figure depicts.
 *
 * Each focus is ranked on its own rather than as one pooled vocabulary: pooled,
 * a figure sharing two words with *any* focus counts for all of them, which is
 * the right behaviour when picking figures for a paper and the wrong one when
 * asking which individual topics are illustrable. This is the stricter reading,
 * which suits a preference — over-counting coverage would defeat the point.
 *
 * `images` is injectable so this can be tested without the real manifest.
 */
export function fociWithFigures(
  foci: string[],
  images: TextbookSourceImage[] = getDescribedImages(),
): Set<string> {
  const covered = new Set<string>()
  if (!Array.isArray(foci) || images.length === 0) return covered
  for (const focus of foci) {
    if (typeof focus !== 'string' || focus.trim().length === 0) continue
    if (rankImagesForFreeTopics(images, [focus]).length > 0) covered.add(focus)
  }
  return covered
}

/**
 * One figure per focus, chosen for that focus.
 *
 * The library-wide search pools every focus into one vocabulary and returns the
 * best-matching figures overall, capped at `MAX_VISION_FIGURES`. For a revision
 * quiz that is right. For a paper it produced two faults that a live run made
 * plain:
 *
 *  - **Clustering.** Six illustrated questions drew on three figures, because
 *    nothing stopped the model writing several questions about one picture.
 *    That is where the near-duplicates came from — "What is the primary reason
 *    for the greenhouse effect?" beside "What is the main reason for the
 *    greenhouse effect?", which differ by one word and so slip past the
 *    deduplicator.
 *  - **Drift off the syllabus.** Handed a diagram of the ear, the model wrote
 *    "the role of the ampulla in the vestibular system" — a question about the
 *    figure rather than about Stage 9 science. The figure had been chosen to
 *    match the paper as a whole, not any question in it.
 *
 * Selecting per focus fixes both at once: every figure is picked because it
 * depicts a topic the paper is already committed to asking about, and each one
 * belongs to a different question, so there is nothing to cluster on.
 *
 * The cap inside `lib/textbook-vision-images.ts` is left alone. It protects
 * every other quiz in the product, and a Checkpoint paper's appetite is not a
 * reason to raise it for a ten-question revision quiz.
 *
 * Describing a figure is nearly free — the whole library is vision-described
 * ahead of time and cached — so the cost here is in the ranking, not the model.
 */
export async function figuresForFoci(
  foci: string[],
  target: number,
  images: TextbookSourceImage[] = getDescribedImages(),
  // Injectable so the selection can be tested without reaching the network:
  // describing a figure resolves an app origin and calls out, which a unit
  // test has no business doing.
  describe: (img: TextbookSourceImage) => Promise<string | null> = describeFigureWithVision,
): Promise<VisualFigureCatalogEntry[]> {
  const usable = Array.isArray(foci) ? foci.filter((f) => typeof f === 'string' && f.trim()) : []
  if (usable.length === 0 || target <= 0 || images.length === 0) return []

  const taken = new Set<string>()
  const picked: { focus: string; img: TextbookSourceImage }[] = []

  for (const focus of usable) {
    if (picked.length >= target) break
    const ranked = rankImagesForFreeTopics(images, [focus])
    // A focus whose best figure is already spoken for takes its next best
    // rather than sharing: two questions on one picture is the clustering this
    // exists to prevent.
    const next = ranked.find((img) => !taken.has(img.key))
    if (!next) continue
    taken.add(next.key)
    picked.push({ focus, img: next })
  }

  const catalog: VisualFigureCatalogEntry[] = []
  for (const { img } of picked) {
    const description = await describe(img)
    // A figure nobody can describe cannot be reasoned about from its
    // description alone, which is the one thing the prompt promises.
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
