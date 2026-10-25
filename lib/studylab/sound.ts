import { useEffect, useState } from 'react'

/**
 * The lesson's sounds, behind one mute.
 *
 * Six short CC0 clips (see public/sounds/LICENSES.md). They confirm what the
 * learner already sees -- sound is never the only signal -- so a muted lesson
 * loses nothing.
 *
 * Nothing plays before the learner has touched the page. Browsers refuse
 * autoplay anyway, and a lesson that chimes the moment it opens in a quiet
 * classroom is the embarrassment the design rules out. The mute is remembered
 * per browser under `ss-sound`, and covers the tutor's voice too (Phase 5).
 */
export type SoundName = 'correct' | 'wrong' | 'tap' | 'drop' | 'complete' | 'lessonComplete'

export const SOUND_FILES: Record<SoundName, string> = {
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  tap: '/sounds/tap.mp3',
  drop: '/sounds/drop.mp3',
  complete: '/sounds/complete.mp3',
  lessonComplete: '/sounds/lesson-complete.mp3',
}

const KEY = 'ss-sound'
const VOLUME = 0.5

let unlocked = false
const audio = new Map<SoundName, HTMLAudioElement>()
const subscribers = new Set<(muted: boolean) => void>()

function hasWindow(): boolean {
  return typeof window !== 'undefined'
}

function unlock() {
  unlocked = true
  if (!hasWindow()) return
  window.removeEventListener('pointerdown', unlock)
  window.removeEventListener('keydown', unlock)
}

if (hasWindow() && typeof window.addEventListener === 'function') {
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function isMuted(): boolean {
  if (!hasWindow()) return false
  try {
    return window.localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  if (hasWindow()) {
    try {
      window.localStorage.setItem(KEY, muted ? 'off' : 'on')
    } catch {
      // Blocked storage: the choice lasts for this page only.
    }
  }
  memory = muted
  subscribers.forEach((fn) => fn(muted))
}

/** Last choice on this page, so blocked storage still honours a mute. */
let memory: boolean | null = null

function mutedNow(): boolean {
  return memory ?? isMuted()
}

export function subscribeMuted(fn: (muted: boolean) => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export function playSound(name: SoundName): void {
  if (!hasWindow() || !unlocked || mutedNow()) return
  if (typeof Audio === 'undefined') return
  try {
    let el = audio.get(name)
    if (!el) {
      el = new Audio(SOUND_FILES[name])
      el.preload = 'auto'
      el.volume = VOLUME
      audio.set(name, el)
    }
    el.currentTime = 0
    void el.play()?.catch?.(() => {})
  } catch {
    // A sound is a nicety; never let it break a lesson.
  }
}

/** The mute, as React state that follows changes made anywhere on the page. */
export function useMuted(): [boolean, (muted: boolean) => void] {
  const [muted, setState] = useState(false)
  useEffect(() => {
    setState(mutedNow())
    return subscribeMuted(setState)
  }, [])
  return [muted, setMuted]
}
