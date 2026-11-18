'use client'

import { useEffect, useRef } from 'react'
import type { Box } from '@/lib/studylab/tour/place'

/** The element a `data-tour` anchor names, if it is on screen. */
export function findAnchor(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(anchor)}"]`)
}

/** An element's box in the viewport, or null when it is not drawn. */
export function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
}

const same = (a: Box | null, b: Box | null) => (a === b) || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5)

/**
 * Follows a control while something points at it: every frame, one measure, and
 * `onBox` is called only when it actually moved. Nothing re-renders; the caller
 * writes the box into its own elements. Stopped (no frames at all) when `find` is null.
 */
export function useFollow(find: (() => HTMLElement | null) | null, onBox: (box: Box | null) => void): void {
  const cb = useRef(onBox)
  cb.current = onBox
  useEffect(() => {
    if (!find) return
    let raf = 0
    let last: Box | null | undefined
    const frame = () => {
      const box = boxOf(find())
      if (last === undefined || !same(box, last)) {
        last = box
        cb.current(box)
      }
      raf = requestAnimationFrame(frame)
    }
    const onResize = () => {
      last = undefined
    }
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [find])
}

export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
