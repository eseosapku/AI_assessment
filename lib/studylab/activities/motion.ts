// Reduced-motion guard shared by every control-of-error "wrong placement"
// shake (Sort, Label, Compose). framer-motion's `MotionConfig` (see
// ActivityFrame) already covers declarative `animate`/`layout` props, but the
// imperative Web Animations API call used for the shake bypasses it entirely
// — this is the one check that stands in for `prefers-reduced-motion` there.

/**
 * True when the user's OS/browser asks for reduced motion. False in any
 * environment without a live `matchMedia` (SSR, the node test runner) so the
 * check degrades safely instead of throwing off the render path.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Play a short "rejected" shake on an element via the Web Animations API,
 * unless the user prefers reduced motion. The caller's state update still
 * happens either way — the piece still springs back, it just does so without
 * the shake when motion is reduced.
 */
export function shakeElement(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions = { duration: 220, easing: 'ease-out' },
): void {
  if (!el || prefersReducedMotion()) return
  el.animate(keyframes, options)
}
