/**
 * Validation for stored profile photos.
 *
 * Avatars are held as compressed data URLs rather than files in object storage:
 * `fileToAvatarDataUrl` already crops and downscales to a 256px JPEG (~20-30KB),
 * which is small enough to live in a TEXT column and keeps the whole feature to
 * one database write with no bucket, signing or lifecycle to manage.
 *
 * That makes the value user-supplied text going into the database and back out
 * into an <img src>, so it is validated on the server rather than trusted from
 * the client. Shared by the API route and the uploader so both agree on limits.
 */

/**
 * Hard cap on a stored avatar. The encoder targets ~30KB; this leaves generous
 * headroom for an unusual image while refusing anything that would bloat every
 * login response that carries it.
 */
export const AVATAR_MAX_BYTES = 200 * 1024

/** Raster formats a browser will render from a data URL. */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Deliberately excludes image/svg+xml: an SVG data URL can carry script, and
 * this string is rendered back into an <img src> for other people to load.
 */
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/

export interface AvatarCheck {
  ok: boolean
  /** Present when ok is false — safe to show the user. */
  reason?: string
}

/** Approximate decoded byte length of a base64 payload, without decoding it. */
export function base64Bytes(payload: string): number {
  const len = payload.length
  if (len === 0) return 0
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

/** Check an avatar data URL before it is stored. */
export function checkAvatarDataUrl(value: unknown): AvatarCheck {
  if (typeof value !== 'string' || !value) {
    return { ok: false, reason: 'No image provided.' }
  }
  const match = DATA_URL.exec(value.trim())
  if (!match) {
    return { ok: false, reason: 'That image could not be read.' }
  }
  const [, mime, payload] = match
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, reason: 'Use a JPEG, PNG or WebP image.' }
  }
  if (base64Bytes(payload) > AVATAR_MAX_BYTES) {
    return { ok: false, reason: 'That image is too large.' }
  }
  return { ok: true }
}
