/** Same catalogue rule as MaterialSpec piece parse (`parse.ts` ART_NAME_RE). */
const ART_NAME_RE = /^[a-z0-9-]+$/

/** Map legacy imageUrl onto piece.art; never pass through `asset:…`. */
export function catalogueArt(imageUrl: string | undefined): string | undefined {
  if (typeof imageUrl !== 'string') return undefined
  const name = imageUrl.trim().replace(/^asset:/, '')
  return ART_NAME_RE.test(name) ? name : undefined
}
