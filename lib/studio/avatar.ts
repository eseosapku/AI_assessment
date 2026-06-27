// Profile-photo storage. Avatars are kept client-side as a compressed data URL
// in localStorage, keyed per user, and fall back to the themed default avatar.
// This is presentation-only — no backend column required. Swap getAvatar for a
// server URL later without touching consumers.

export const DEFAULT_AVATAR = '/art/avatar-default.png'
export const AVATAR_EVENT = 'ss-avatar-change'
const KEY = (userId: string) => `ss-avatar:${userId}`

export function getAvatar(userId?: string | null): string {
  if (!userId || typeof window === 'undefined') return DEFAULT_AVATAR
  try {
    return localStorage.getItem(KEY(userId)) || DEFAULT_AVATAR
  } catch {
    return DEFAULT_AVATAR
  }
}

export function setAvatar(userId: string, dataUrl: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY(userId), dataUrl)
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }))
}

export function clearAvatar(userId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY(userId))
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }))
}

// Read an uploaded image File, square-crop (cover) and downscale it to a small
// JPEG data URL so it stays well under the localStorage budget (~20-30KB).
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
