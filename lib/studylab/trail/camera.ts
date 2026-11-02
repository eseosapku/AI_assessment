// lib/studylab/trail/camera.ts
import type { Point, Rect, Size, TrailWorld } from './types'

/**
 * Where the camera goes on the Trail. Nothing here touches the board; the canvas
 * hands the answer to React Flow.
 */

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export const CAMERA_MS = 1100
/** Below this a card stops being readable, so a taller one is panned instead. */
export const MIN_ZOOM = 0.6

const MAX_ZOOM = 1
const PAN_STEP = 80

/** The same curve the cards slide on, so they arrive together with the camera. */
export function easeOut(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t)
}

/**
 * The view that shows `frame` in the room `insets` leave. What fits is centred;
 * what does not shows its start, so a tall card opens at its first line, clear
 * of the top bar and above the button.
 */
export function cameraFor(frame: Rect, box: Size, insets: Insets, opts: { minZoom?: number } = {}): { x: number; y: number; zoom: number } {
  const roomW = Math.max(1, box.w - insets.left - insets.right)
  const roomH = Math.max(1, box.h - insets.top - insets.bottom)
  const zoom = Math.min(MAX_ZOOM, Math.max(opts.minZoom ?? MIN_ZOOM, Math.min(roomW / frame.w, roomH / frame.h)))
  const along = (start: number, size: number, room: number, inset: number) =>
    size * zoom > room ? inset - start * zoom : inset + (room - size * zoom) / 2 - start * zoom
  return { x: along(frame.x, frame.w, roomW, insets.left), y: along(frame.y, frame.h, roomH, insets.top), zoom }
}

/** After a station: the one just finished and the one ahead, with the trail between them. */
export function journeyFrame(world: TrailWorld, done: number, next: number): Rect {
  const a = world.plots[done]
  const b = world.plots[next]
  if (!a || !b) return world.bounds
  const left = Math.min(a.rect.x, b.rect.x)
  const top = Math.min(a.label.y, b.label.y)
  const right = Math.max(a.rect.x + a.rect.w, b.rect.x + b.rect.w)
  const bottom = Math.max(a.rect.y + a.rect.h, b.rect.y + b.rect.h)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** How far an arrow key moves the board, in screen pixels. */
export function panForKey(key: string): Point | null {
  if (key === 'ArrowLeft') return { x: PAN_STEP, y: 0 }
  if (key === 'ArrowRight') return { x: -PAN_STEP, y: 0 }
  if (key === 'ArrowUp') return { x: 0, y: PAN_STEP }
  if (key === 'ArrowDown') return { x: 0, y: -PAN_STEP }
  return null
}
