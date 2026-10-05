/**
 * Ids from a generation request, where only a positive number is an id.
 *
 * The form sends `textbook_id: null` for a quiz typed as a free topic, and
 * `Number(null)` is 0 -- a finite number. So the route took "no textbook" for
 * "textbook 0": it looked the book up, found nothing, and never reached the
 * library-wide figure search that exists for exactly this quiz. Every typed
 * topic came back without a picture. Database ids start at 1, and cached
 * past-paper ids are large and positive, so nothing real is lost by refusing
 * zero, negatives, empty strings and null.
 */
export function positiveId(value: unknown): number {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return NaN
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : NaN
}

/** A list of ids, de-duplicated, with anything that is not a positive id dropped. */
export function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(positiveId).filter((n) => Number.isFinite(n))))
}
