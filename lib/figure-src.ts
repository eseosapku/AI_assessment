/**
 * Where a question figure is loaded from.
 *
 * Figures are stored, in the JSON banks and in every saved quiz and recall
 * card, as site paths: "/textbook-images/...", "/exam-images/...". They are
 * resolved here, at the moment they are drawn or fetched, so nothing stored
 * has to change when the files move. With NEXT_PUBLIC_FIGURE_BASE_URL unset
 * they load from the app's own public/ folder.
 *
 * Only those two folders. Anything else -- /art, a data: URL, an uploaded
 * photo, a full URL -- is returned untouched.
 */
const FIGURE_PREFIXES = ['/textbook-images/', '/exam-images/']

export function figureBaseUrl(): string {
  // Spelled out in full: Next.js inlines NEXT_PUBLIC_* into client code only
  // where the property is written literally.
  return String(process.env.NEXT_PUBLIC_FIGURE_BASE_URL ?? '').trim().replace(/\/+$/, '')
}

export function isFigurePath(src: unknown): src is string {
  return typeof src === 'string' && FIGURE_PREFIXES.some((p) => src.startsWith(p))
}

export function figureSrc(src: string, base: string = figureBaseUrl()): string {
  if (!base || !isFigurePath(src)) return src
  return `${base}${src}`
}
