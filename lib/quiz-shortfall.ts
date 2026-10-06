/**
 * How many questions short a quiz may still ship.
 *
 * An ordinary quiz has 30 seconds (the route's maxDuration), and no retry
 * pass starts late in them. When it is the clock rather than the model that
 * stopped the retries, a quiz a few questions short is a better answer than
 * "Please try again": a 20-question Chemistry quiz came back 17 of 20, twice,
 * and was refused both times.
 */
export function shortfallTolerance(count: number, opts: { checkpoint: boolean; outOfTime: boolean }): number {
  if (opts.checkpoint) return Math.min(3, Math.floor(count * 0.1))
  const usual = count >= 8 ? 1 : 0
  return opts.outOfTime ? Math.max(usual, Math.floor(count * 0.4)) : usual
}
