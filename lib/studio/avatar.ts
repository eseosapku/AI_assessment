// Profile-photo storage.
//
// The user record is the source of truth, so a photo set on one device shows up
// everywhere. localStorage is kept purely as a cache: it lets the avatar paint
// on first render without waiting for a request, and keeps the photo visible
// offline. Reads stay synchronous for that reason — components render the
// cached value, and `hydrateAvatar` reconciles it with the server after login.

import { checkAvatarDataUrl } from './avatar-validate'

export const DEFAULT_AVATAR = '/art/avatar-default.png'
export const AVATAR_EVENT = 'ss-avatar-change'
const KEY = (userId: string) => `ss-avatar:${userId}`

function notify(userId: string) {
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }))
}

/** Cached photo for immediate render, or the themed default. */
export function getAvatar(userId?: string | null): string {
  if (!userId || typeof window === 'undefined') return DEFAULT_AVATAR
  try {
    return localStorage.getItem(KEY(userId)) || DEFAULT_AVATAR
  } catch {
    return DEFAULT_AVATAR
  }
}

/** Update the local cache only. Exported for `hydrateAvatar` and the savers. */
export function cacheAvatar(userId: string, dataUrl: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (dataUrl) localStorage.setItem(KEY(userId), dataUrl)
    else localStorage.removeItem(KEY(userId))
  } catch {
    // Private mode or quota: the photo still lives on the server, so the cache
    // failing to write is a lost optimisation rather than lost data.
  }
  notify(userId)
}

/**
 * Persist a new photo.
 *
 * The cache is written first so the new photo appears instantly, then the
 * server call decides the outcome — on failure the cache is rolled back, so the
 * UI never shows a photo that another device will not see.
 */
export async function saveAvatar(userId: string, dataUrl: string): Promise<void> {
  const check = checkAvatarDataUrl(dataUrl)
  if (!check.ok) throw new Error(check.reason ?? 'That image could not be used.')

  const previous = getAvatar(userId)
  cacheAvatar(userId, dataUrl)
  try {
    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, avatar: dataUrl }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Could not save your photo.')
  } catch (err) {
    cacheAvatar(userId, previous === DEFAULT_AVATAR ? null : previous)
    throw err
  }
}

/** Remove the photo everywhere. */
export async function removeAvatar(userId: string): Promise<void> {
  const previous = getAvatar(userId)
  cacheAvatar(userId, null)
  try {
    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, avatar: null }),
    })
    if (!res.ok) throw new Error('Could not remove your photo.')
  } catch (err) {
    cacheAvatar(userId, previous === DEFAULT_AVATAR ? null : previous)
    throw err
  }
}

/**
 * Reconcile cache and server after sign-in.
 *
 * Two directions matter. A device that has never seen this account pulls the
 * photo down. A device that set a photo before photos were stored server-side
 * pushes its local copy up — without that, everyone who already has an avatar
 * would silently lose it the first time they signed in elsewhere.
 *
 * Best-effort throughout: a failure here must never block signing in.
 */
export async function hydrateAvatar(userId: string, serverAvatar?: string | null): Promise<void> {
  if (typeof window === 'undefined' || !userId) return

  try {
    let remote = serverAvatar ?? null
    if (remote === undefined || remote === null) {
      // The auth response omits it before the migration runs, so ask directly
      // rather than assuming "no photo".
      const res = await fetch(`/api/user/avatar?user_id=${encodeURIComponent(userId)}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok) remote = json?.avatar ?? null
    }

    if (remote) {
      cacheAvatar(userId, remote)
      return
    }

    const local = getAvatar(userId)
    if (local !== DEFAULT_AVATAR) {
      await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, avatar: local }),
      })
    }
  } catch {
    // Offline or not migrated: the cached photo still renders.
  }
}

// Read an uploaded image File, square-crop (cover) and downscale it to a small
// JPEG data URL so it stays well under the storage budget (~20-30KB).
export function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image.'))
        return
      }
      // Cover crop: scale so the shorter side fills the square, center the rest.
      const scale = Math.max(size / img.width, size / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image.'))
    }
    img.src = url
  })
}
