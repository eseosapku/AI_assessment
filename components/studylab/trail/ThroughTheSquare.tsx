'use client'

import { useEffect } from 'react'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'

const INTRO_MS = 1200
const QUIET_MS = 200

/**
 * The way into a lesson: the mark's four tiles land one by one, and the camera
 * goes through the square onto the board. Any key or tap skips it; under reduced
 * motion it is a short cross-fade. Decoration, so it says nothing to a screen reader.
 */
export function ThroughTheSquare({ onDone }: { onDone: () => void }) {
  const quiet = prefersReducedMotion()
  useEffect(() => {
    const timer = setTimeout(onDone, quiet ? QUIET_MS : INTRO_MS)
    window.addEventListener('keydown', onDone)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onDone)
    }
  }, [onDone, quiet])
  return (
    <div className={`ss-trail-intro${quiet ? ' ss-trail-intro-quiet' : ''}`} onPointerDown={onDone} aria-hidden>
      <svg viewBox="0 0 40 40" className="ss-trail-intro-mark">
        <defs>
          <linearGradient id="ss-trail-intro-grad" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2ACBF2" />
            <stop offset="1" stopColor="#0C86CE" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#ss-trail-intro-grad)" />
        <g fill="#fff">
          <rect className="ss-trail-intro-tile" style={{ animationDelay: '0ms' }} x="10.5" y="10.5" width="8" height="8" rx="2.4" fillOpacity="0.96" />
          <rect className="ss-trail-intro-tile" style={{ animationDelay: '110ms' }} x="21.5" y="10.5" width="8" height="8" rx="2.4" fillOpacity="0.5" />
          <rect className="ss-trail-intro-tile" style={{ animationDelay: '220ms' }} x="10.5" y="21.5" width="8" height="8" rx="2.4" fillOpacity="0.5" />
          <rect className="ss-trail-intro-tile" style={{ animationDelay: '330ms' }} x="21.5" y="21.5" width="8" height="8" rx="2.4" fillOpacity="0.96" />
        </g>
      </svg>
    </div>
  )
}
