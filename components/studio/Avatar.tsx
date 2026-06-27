'use client'

import { useEffect, useState } from 'react'
import { AVATAR_EVENT, DEFAULT_AVATAR, getAvatar } from '@/lib/studio/avatar'

// Reactive read of the current user's avatar: re-renders when the photo changes
// anywhere (settings upload/remove) via the AVATAR_EVENT, and across tabs via
// the storage event.
export function useAvatar(userId?: string | null): string {
  const [src, setSrc] = useState<string>(DEFAULT_AVATAR)

  useEffect(() => {
    setSrc(getAvatar(userId))
    const update = () => setSrc(getAvatar(userId))
    window.addEventListener(AVATAR_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(AVATAR_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [userId])

  return src
}

export default function Avatar({
  userId,
  name,
  size = 36,
  className = '',
}: {
  userId?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const src = useAvatar(userId)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ? `${name}'s profile photo` : 'Profile photo'}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-ss-chip object-cover ${className}`}
    />
  )
}
