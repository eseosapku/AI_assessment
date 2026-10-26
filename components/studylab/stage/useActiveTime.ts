'use client'

import { useEffect, useRef } from 'react'
import { addActive } from '@/lib/studylab/scenes'

/**
 * Counts the time a learner actually spends in the lesson.
 *
 * The clock runs while the page is visible and the learner has touched a key
 * or the pointer in the last two minutes; a tab left open over lunch counts
 * two minutes, not the hour. The total is handed back every 15 seconds and
 * when the page is hidden, so it travels with the board's own save.
 */
export function useActiveTime(initialMs: number, onChange: (ms: number) => void) {
  const total = useRef(initialMs)
  const since = useRef(Date.now())
  const lastInput = useRef(Date.now())
  const report = useRef(onChange)
  report.current = onChange

  // A board loaded after the clock started brings its saved total with it.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || initialMs <= 0) return
    seeded.current = true
    total.current = Math.max(total.current, initialMs)
  }, [initialMs])

  useEffect(() => {
    const commit = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        total.current = addActive(total.current, since.current, now, lastInput.current)
      }
      since.current = now
      report.current(total.current)
    }
    const touched = () => {
      // Back from idle: the gap is not learning time.
      if (Date.now() - lastInput.current > 120_000) since.current = Date.now()
      lastInput.current = Date.now()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') commit()
      else since.current = Date.now()
    }
    const timer = setInterval(commit, 15_000)
    window.addEventListener('pointerdown', touched, true)
    window.addEventListener('keydown', touched, true)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', touched, true)
      window.removeEventListener('keydown', touched, true)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
