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
import { rankImagesForFreeTopics, MAX_VISION_FIGURES } from './textbook-vision-images'

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
 * Split the foci into the slices needed to reach `target` figures.
 *
 * `buildVisualFigureCatalogForTopics` caps any single call at
 * `MAX_VISION_FIGURES` (12), so a thirty-four question paper wanting half its
 * questions illustrated cannot get there in one ask. Asking in slices — each a
 * different set of topics — returns a different set of figures, and the caller
 * merges them.
 *
 * Done here, at the call site, rather than by raising the cap inside
 * `lib/textbook-vision-images.ts`: that ceiling protects every other quiz in
 * the product, and a Checkpoint paper's appetite is not a reason to raise it
 * for a ten-question revision quiz.
 */
export function splitForCatalogue(foci: string[], target: number): string[][] {
  const usable = Array.isArray(foci) ? foci.filter((f) => typeof f === 'string' && f.trim()) : []
  if (usable.length === 0) return []

  const calls = Math.max(1, Math.ceil(target / MAX_VISION_FIGURES))
  // Never more slices than foci, or a slice would be empty and its model call
  // wasted.
  const slices = Math.min(calls, usable.length)
  const per = Math.ceil(usable.length / slices)

  const out: string[][] = []
  for (let i = 0; i < usable.length; i += per) out.push(usable.slice(i, i + per))
  return out
}
