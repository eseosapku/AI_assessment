'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { DayNightConfig, DayNightState } from './config'
import { dayNightEngine, hourAt, isDay, madeText, sunHeight, turnedOf, working, wrap24 } from './config'

type Props = SceneViewProps<DayNightConfig, DayNightState>

// Space is dark in both themes, so the top panel keeps its own colours (as orbit's does). The sky panel below keeps its
// own too: it is the colour of the sky at that moment. Flat colours only: no gradients, glows or shadows.
const SPACE = '#0E1A2B'
const SPACE_EDGE = '#1E2E45'
const STAR = '#DCE6F2'
const SUN_RIM = '#F2A81D'
const SUN_FACE = '#F8C04A'
const SUN_SPOT = '#E39A17'
const SUN_INK = '#6B3F00'
const BEAM = '#F6D27A'
const OCEAN = '#2D6FB8'
const LAND_FILL = '#76A55E'
const LAND_EDGE = '#4F7D42'
const ICE_FILL = '#E8EEF2'
const ICE_EDGE = '#B8C4CE'
const GLOBE_RIM = '#9DB4CC'
const NIGHT = '#050B16'
const LABEL = '#F8FAFC'
// The child: the same clothes on the globe and in the sky picture.
const SHIRT = '#E8743B'
const TROUSERS = '#6385C2'
const SKIN = '#B97A56'
const HAIR = '#2B1B12'

// ---------------------------------------------------------------------------
// Geometry (viewBox units). Literals, not config's constants: config.ts and this file import each other.

export const W = 360
export const SPACE_H = 196
export const SKY_H = 98
/** The Earth, seen from above the North Pole. */
export const CX = 222
export const CY = 98
export const R = 75
/** How far the child stands out from the Earth's edge. */
export const FIG = 19
/** The Sun, mostly beyond the left edge of the panel. */
export const SUN_X = -30
export const SUN_R = 72
/** The sky picture: the Sun's path runs from the east end of the horizon, over the top, to the west end. */
export const SKY_MID = 180
export const HORIZON = 78
export const ARC_A = 146
export const ARC_B = 56
export const SKY_SUN_R = 10

const rad = (d: number) => (d * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * Where you are on the turn, as an angle anticlockwise from the right (the side away from the Sun): midnight faces away
 * at 0, sunrise is at the top, midday faces the Sun on the left, sunset is at the bottom. The Earth turns anticlockwise
 * seen from above the North Pole, so the angle grows with time.
 */
export const turnAngle = (hour: number) => 15 * wrap24(hour)
export function personAt(hour: number, r = R): { x: number; y: number } {
  const a = rad(turnAngle(hour))
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }
}

/** Where the Sun is in your sky: east is on the left of the horizon, west on the right, highest at midday. */
export function sunInSky(hour: number): { x: number; y: number; height: number } {
  const t = rad(((wrap24(hour) - 6) / 12) * 180)
  return { x: SKY_MID - ARC_A * Math.cos(t), y: HORIZON - ARC_B * Math.sin(t), height: sunHeight(hour) }
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
export function mix(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1)
  const [p, q] = [hex(a), hex(b)]
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * k).toString(16).padStart(2, '0')).join('')}`
}
/** The sky's colour for the Sun's height in degrees: night, deep twilight, the warm glow of the horizon, then blue. */
const SKY_STOPS: [number, string][] = [[-18, '#101C33'], [-12, '#1D2B55'], [-7, '#40477A'], [-3, '#9A7E92'], [0, '#DDA27E'], [4, '#E8BE98'], [10, '#A8D3EE'], [25, '#86C3EA']]
export function skyColour(height: number): string {
  if (height <= SKY_STOPS[0][0]) return SKY_STOPS[0][1]
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [h1, c1] = SKY_STOPS[i]
    const [h0, c0] = SKY_STOPS[i - 1]
    if (height <= h1) return mix(c0, c1, (height - h0) / (h1 - h0))
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1]
}
/** Dark ink on a light sky, light ink on a dark one: by the sky's luminance (WCAG). */
export function inkOn(bg: string): string {
  const lin = hex(bg).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  return lum > 0.22 ? '#1E3A5F' : '#F1F5F9'
}
/** How lit the ground is: 0 at night, 1 by day, easing through twilight. */
export const daylight = (height: number) => clamp((height + 8) / 16, 0, 1)
export const starsShow = (height: number) => clamp((-height - 6) / 8, 0, 1)

// ---------------------------------------------------------------------------
// The Earth from above the North Pole: Natural Earth 1:110m land (public domain, naturalearthdata.com), projected
// orthographically from above the pole with d3-geo and simplified to about a pixel. Units: the equator has radius 100,
// and you stand at the right-hand end of the equator, in Kenya (37 degrees east).

export const LAND =
  'M9.4 -94.4L7.5 -95.3L8.9 -96.5L4.8 -97.3L10.8 -96.5L11.9 -95.2ZM-31.5 88.6L-25 91.4L-34 88.8ZM-41.4 82.4L-33.9 87.5L-39.4 85.4L-49.1 78.7ZM-19.3 -77.4' +
  'L-18.7 -79.6L-12.8 -82.4L-11.6 -81.5L-5.8 -82.8L-7.3 -83.4L-5.5 -85.5L-3.5 -83.5L-12.3 -80.5L-16.9 -76.7L-16.9 -74.1L-18.6 -72.7L-19.9 -74.9ZM-20.9 -6' +
  '8.6L-22.5 -67.8L-23.2 -69L-16.8 -72.9L-18.1 -67.7ZM-3.5 63.3L-4.3 64.4L-0.5 65.3L-0.1 68.6L-1.5 67.2L-2.9 68.3L-7.4 67L-4.1 62.4L-2.6 62.1ZM-18.1 -60.' +
  '6L-19.9 -62.5L-18.2 -62.6L-18 -64.6L-19.7 -66.4L-18.1 -67.1L-15.1 -57.8L-15.7 -56.1ZM44.2 42.4L42.2 45.2L40.4 42.9L40.7 40.1L42.6 39.3ZM39.9 33.5L40.4' +
  ' 35.3L41.6 33.6L42.8 36.1L49.4 35L50.9 36.4L47.6 43.3L47.5 40.4L45.6 41.4L46 40.3L44.5 39.5L45.1 37.8L41.9 38.5L40 37.5L38.7 34.8ZM-21.9 34.9L-20.2 39' +
  '.4L-25.1 36.8ZM24.9 31.3L26.7 32.5L25.2 36.8L22.1 37.9L22.4 36.9L20.6 37.1L21.6 36.2L19.8 36.2L19.7 35.1L22 34.7ZM-33.7 -21.1L-34.3 -18.9L-36.3 -18.4L' +
  '-36.2 -20.5L-37.6 -21.7L-32.9 -23.6L-33.8 -25.5L-28.7 -21.6ZM-45.8 88.9L-41.2 90.4L-53.2 82.9L-66.4 69.8L-73.3 60.4L-74.6 57.2L-73.6 56.1L-75 50.1L-74' +
  '.9 40.2L-76.1 41L-76.5 50.8L-78 46.5L-78.2 41.5L-76.9 42.4L-75.5 36.4L-76.1 31.3L-73.4 25.7L-63.3 20.9L-63.8 23.7L-62.5 23.4L-60.8 16.9L-52.2 8.2L-48.' +
  '5 -3.5L-50.7 -7.8L-47.6 -6.4L-51.8 -10.3L-53.9 -14.9L-53.8 -21.7L-53.3 -16.9L-50.1 -12.5L-49.2 -16.9L-47.8 -16.4L-45.5 -18.7L-42 -16.6L-42.1 -13.5L-40' +
  '.6 -13L-40 -16.1L-37.3 -17.5L-37 -14.6L-38.4 -13L-33.1 -14.2L-31.1 -7.5L-35.8 4.1L-32.3 8.6L-33.5 10.4L-32.2 10.8L-33.3 11.3L-31.8 16.8L-33 18.7L-31.8' +
  ' 21.6L-28.9 21.7L-28.5 25.2L-25.7 26L-26.4 28.2L-23.5 26.9L-23.4 24.7L-20.8 23L-21.9 32L-18.5 29L-17.2 30.2L-18.5 34.2L-21.5 33.5L-25.4 35.6L-30.3 35.' +
  '9L-34.3 38.5L-34.4 42L-27.9 49.8L-29.1 52.2L-28.4 55.9L-26.3 54.8L-26.1 51.6L-22 50.6L-22.3 46.7L-19.1 42L-13.8 46.4L-14.5 49.5L-13.3 51L-9.9 48.5L-8.' +
  '5 54.8L-4.4 57.7L-2.9 61.3L-7.8 63.5L-14.8 62.2L-17.5 63.1L-21.3 65L-13.6 63.9L-13.8 67.8L-10.3 68.8L-8.9 67.6L-8.2 69.1L-15.5 70.8L-16.3 69.5L-13.9 6' +
  '9L-21.3 69.1L-22.6 70.4L-21.8 71.5L-26.7 70.7L-24.5 71.5L-29.6 71.3L-31 73.3L-30.7 71.2L-31.9 71.8L-31.4 75L-40.5 75.1L-41.6 80.3L-44.7 74.1L-51 69.7L' +
  '-51.8 70.3L-57.9 65L-62.1 63.5L-65.2 65.5L-64.4 69.3L-58.8 74.1L-52.1 77.1L-56.4 77.9L-48.8 83.2L-50.3 84.3L-48.2 86.2L-40 90.4L-9.4 98.8L5.3 99.8L-19' +
  '.9 98L-33.3 94.3ZM-25.4 14L-25.6 16L-24.6 16L-25.8 18L-23.9 16.5L-23.4 17.3L-25.5 20.3L-25.4 22.9L-27.5 23.6L-31.8 18.1L-31.7 16.1L-30.9 14.8L-28.9 17' +
  '.1L-30.2 14.1L-28.6 14.5L-29 12.7ZM-16 24.1L-16.2 25.2L-13.7 24.4L-14.3 27.3L-12.5 26.9L-8.8 32.9L-8.6 34.5L-9.9 34.9L-6 38.8L-8 41.5L-10.4 38.9L-9.1 ' +
  '43.9L-9.6 44.9L-12 42.6L-10.7 45.8L-14.1 43.3L-15.9 39.7L-18.5 38.7L-14.9 38.8L-13 36.4L-14.9 30.5L-19.6 27.2L-18.4 24.3L-16.4 23.1L-15.1 23.4ZM-20.5 ' +
  '18.9L-19.8 20.4L-22.8 22.6L-22.9 19.5ZM-29.5 12.2L-30.8 11.1L-29.7 9.1L-25.7 8.4L-25.2 13.1ZM-7.7 -23.7L-7.8 -25L-5.5 -26L-4.4 -25.1L-4.9 -23.5ZM-19.6' +
  ' 13.6L-20.7 15.5L-23.1 13.7L-21.9 13.3L-23.1 10.9L-20.7 10.8L-21.1 13.3L-19.1 12.6ZM30.9 -11.6L31.6 -9.5L29.9 -7.7L24.4 -8.2L19.3 -11.7L28.7 -9.6ZM-14' +
  '.8 16.7L-14.7 20.1L-11.6 21.8L-12.2 23.5L-16.6 20.2L-16 16.5ZM73.5 -15.8L74.2 -17.7L76.3 -16L77.5 -16.7L76.5 -23.1L74.4 -22.6L73.7 -20.7L71.9 -23L71 -' +
  '21.3L72.5 -20.5L70.7 -19.6L69.7 -16.5L67.6 -19.5L65.7 -18.9L67.4 -14.5L70.2 -12ZM88.5 46.6L70.5 70.5L63.8 75.8L56 78.9L57 76.1L54.6 75L59.6 62.9L58.2 ' +
  '60.9L59.4 55.3L63.4 51.6L71.7 34.9L74.3 37.3L82.2 26.6L80.8 23.4L85 12.1L85.1 3.6L80.2 1.2L80.1 10.3L79.2 13L75.8 14.5L74.2 4.5L75.5 -1.8L74.6 -5.9L73' +
  '.3 -5.7L70.4 0.4L67.8 -2.5L69.1 2.5L70.6 0.8L71.4 3.9L70.1 5.6L69.2 4.5L68.3 7.5L72.7 11.9L74.6 10.7L73.9 18.9L76.6 17.6L77.1 19.5L78.1 19.3L77.2 21.2' +
  'L72.8 23.1L71.2 22.4L63.8 28.2L65.4 29.7L72.5 24.3L71.5 26.2L73.2 26.5L73.5 28.7L71.2 28.2L63.1 33.7L62.9 37L60.6 40.7L61.7 41.6L60.9 44.6L62.4 46.8L6' +
  '2.2 50.6L59.8 54.6L55.7 57.4L50.4 52.9L56.5 45.6L54.6 42.9L49.4 43.8L51.6 41.2L50.2 40.6L52.1 37.4L50.8 32.1L52.1 28.7L47.7 25.9L47.8 23.8L50.3 26L52.' +
  '8 25.8L55.5 17.3L54.9 15.5L51.9 14.3L53.1 12.1L49.8 12.1L49.5 6.9L48.7 12.3L47.1 13.2L44.2 12.6L40.6 8.4L39.7 10.5L43.3 15L45.1 16.3L47.4 15.6L52 20.1' +
  'L52.3 22.1L51.9 23.2L45.4 22.8L46.1 25.2L44.5 27.1L39.8 24.9L38.6 19.2L32.8 10.6L31.9 5L34.7 3.6L38.2 -2.7L40.7 -1L39.6 2.6L44.1 0L42 -0.1L43 -1.9L39.' +
  '8 -3.5L40.3 -4.9L36.3 -4.1L36.6 -6L39.1 -6.4L34.5 -10.4L35.5 -11.4L33.5 -13.4L34.1 -14.4L31.6 -13.8L31.8 -19.5L28.2 -16.1L25 -15.7L24.1 -17.2L32.9 -23' +
  '.4L29.8 -23.3L25.7 -18.7L23.4 -18L25 -20.5L23.1 -19.8L22.3 -21.9L20.4 -19.4L17.9 -21.1L16.5 -19.7L10.4 -21L8.2 -19.7L7.9 -22L5.4 -23.8L8.2 -26L4 -28.8' +
  'L0 -28.3L-2.5 -32.8L-2.9 -31L-7.1 -31L-6.9 -28.7L-11.7 -28.2L-14.4 -29.5L-17.4 -27.8L-19.6 -29.1L-22.8 -26.4L-24.6 -26.8L-23.4 -24.7L-28.7 -21.6L-33.8' +
  ' -25.5L-33 -27.3L-36.5 -28.1L-34.4 -36.5L-32.8 -36.6L-29.9 -40.3L-30.2 -43.1L-31.6 -43.2L-33.1 -47.1L-31.3 -54.6L-26.5 -48L-28.8 -38.7L-28 -36.6L-26.9' +
  ' -41.2L-25.3 -40L-23.7 -41.5L-23 -44.8L-24.1 -45.3L-13.5 -49.6L-8.2 -57.2L-14.9 -58.2L-15 -64.6L-9.9 -72L-6.7 -72.5L-0.7 -76.9L-3.4 -80L-3 -81.8L0.7 -' +
  '82.5L1.2 -80.1L0.2 -80L3.1 -78.6L2.3 -77.1L8.1 -77.4L6.4 -75.9L8.2 -75.5L12.8 -76.9L10.1 -79.1L6.4 -79.1L11.2 -81.2L7.6 -84.8L8.2 -87.7L17.8 -90.5L33.' +
  '9 -87.8L29.9 -93.2L36.8 -91.8L44 -86.7L46 -87.3L38.7 -92.2L47.5 -86.9L46.4 -86.4L47.2 -83.7L52.1 -80.8L51.3 -80L53.7 -75L75.3 -64.4L77.2 -57.2L75.7 -5' +
  '4.3L77.9 -51.5L78.7 -44.3L82.4 -37.6L85.3 -27.2L84.5 -17.9L85 -16.5L86.7 -18.1L88.2 -21.7L87.1 -22.7L88.3 -23.3L84.5 -29.7L85.8 -31L85.3 -35.9L91.1 -2' +
  '9.2L96.8 -12.2L93.1 -3.5L88.2 3.6L87 3.2L88.5 4.8L86.5 7.1L94.8 -0.8L96.1 -3.8L97.6 -12.2L94.9 -23.8L97.5 -20L99.4 -10.7L99.9 3.7L98.4 17.6L95 31.1ZM1' +
  '6.9 5.7L18.5 5.1L21.4 8.2L16.1 8ZM8.8 -17.2L10.1 -16.1L9.8 -13.6L7.8 -13ZM-10 14.9L-11.9 16.4L-13 15.5L-10.2 11.4ZM-3.2 11.6L-2.1 13.1L-5.5 16.8L-7.5 ' +
  '16.9L-9.6 20.7L-11.1 21.2L-13.9 18.8L-12.1 17.1L-11.4 18.3L-9.5 14L-8 14.5L-9.4 13.6L-8.8 11Z'
export const ICE =
  'M4.9 10.2L6.7 10.7L5.1 12.9L6.9 11.9L7.7 13.3L8.5 11.2L9.9 11.5L9.3 14.3L15 22.5L14.1 25L15.6 26.3L14.3 26.7L17.2 28.3L14.7 28.3L15.2 30.2L17.3 29.2L1' +
  '2.8 37.5L9.5 40.4L8.3 49.2L7.1 49.4L4 48.5L1.1 44.4L-0.7 38.8L1.3 34.3L-1 34.8L-0.8 32.8L0.9 33.3L-1.6 31.4L-2.4 24.9L-6.4 23.2L-7.1 21.3L-5.2 21.2L-7' +
  '.2 19.4L-4 18L-4.4 16.6L-2.4 14.1L0.6 13.1L2.1 14.3L2 11.6Z'

/** The Sun's light: parallel beams from the Sun to the lit half of the Earth. */
export const BEAMS = [-52, -26, 0, 26, 52].map((dy) => ({ y: CY + dy, x1: 52, x2: CX - Math.sqrt(R * R - dy * dy) - 5 }))

/** The arrow round the North Pole: the way the Earth spins, anticlockwise from above. */
export const POLE_R = 16
/**
 * An arrow most of the way round a circle, anticlockwise on the screen (the arc's sweep flag 0), with its head pointing
 * along the turn. The same arrow sits round the pole, on the turn buttons and in the caption.
 */
export function spinArrow(cx: number, cy: number, r: number, head: number) {
  const a1 = rad(-40)
  const a2 = rad(215)
  const s = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) }
  const e = { x: cx + r * Math.cos(a2), y: cy - r * Math.sin(a2) }
  // Moving anticlockwise, a point on the circle heads along (-sin, -cos) in screen coordinates.
  const t = { x: -Math.sin(a2), y: -Math.cos(a2) }
  const n = { x: -t.y, y: t.x }
  const tip = { x: e.x + t.x * head * 1.1, y: e.y + t.y * head * 1.1 }
  const b1 = { x: e.x - t.x * head * 0.35 + n.x * head, y: e.y - t.y * head * 0.35 + n.y * head }
  const b2 = { x: e.x - t.x * head * 0.35 - n.x * head, y: e.y - t.y * head * 0.35 - n.y * head }
  return {
    arc: `M${f1(s.x)} ${f1(s.y)}A${r} ${r} 0 1 0 ${f1(e.x)} ${f1(e.y)}`,
    head: `M${f1(tip.x)} ${f1(tip.y)}L${f1(b1.x)} ${f1(b1.y)}L${f1(b2.x)} ${f1(b2.y)}Z`,
    tangent: t,
  }
}
const poleArrow = () => spinArrow(CX, CY, POLE_R, 5)

/** Labels drawn on the space panel, with the box each takes, for the tests and the layout. */
export const SPACE_LABELS = [
  { text: 'Sun', x: 7, y: CY + 5, anchor: 'start' as const, size: 13 },
  { text: 'sunlight', x: 52, y: CY - 52 - 8, anchor: 'start' as const, size: 12 },
  { text: 'day', x: CX - 44, y: CY + 5, anchor: 'middle' as const, size: 13 },
  { text: 'night', x: CX + 46, y: CY + 5, anchor: 'middle' as const, size: 13 },
]

const SPACE_STARS = [[70, 14], [118, 22], [300, 12], [340, 40], [348, 112], [330, 172], [112, 166], [188, 190], [150, 8], [350, 152]]
const SKY_STARS = [[44, 16], [80, 34], [120, 12], [158, 30], [204, 12], [246, 30], [288, 14], [330, 34], [100, 50], [304, 52], [60, 48], [262, 50]]

// ---------------------------------------------------------------------------
// The drawings.

/** A child standing with feet at the origin and head up (towards negative y), about FIG tall. */
function Child({ scale = 1, dim = 0 }: { scale?: number; dim?: number }) {
  const c = (col: string) => mix(col, '#1A2436', dim * 0.55)
  return (
    <g transform={`scale(${scale})`}>
      <rect x={-2.7} y={-6.4} width={2.2} height={6.4} rx={0.9} fill={c(TROUSERS)} />
      <rect x={0.5} y={-6.4} width={2.2} height={6.4} rx={0.9} fill={c(TROUSERS)} />
      <path d="M-3.3 -10.8 L-4.5 -6.4 M3.3 -10.8 L4.5 -6.4" stroke={c(SKIN)} strokeWidth={1.5} strokeLinecap="round" />
      <rect x={-3.5} y={-12} width={7} height={6.6} rx={2.2} fill={c(SHIRT)} />
      <circle cx={0} cy={-14.6} r={2.9} fill={c(SKIN)} />
      <path d="M-2.9 -14.9 A2.9 2.9 0 0 1 2.9 -14.9 Q1.5 -16.2 -0.2 -15.9 Q-1.8 -15.7 -2.9 -14.9 Z" fill={c(HAIR)} />
    </g>
  )
}

/** The part of a disc centred off the left edge that shows on the panel: an arc closed by the edge, so nothing spills. */
function edgeDisc(r: number): string {
  const h = Math.sqrt(r * r - SUN_X * SUN_X)
  return `M0 ${f1(CY - h)}A${r} ${r} 0 0 1 0 ${f1(CY + h)}Z`
}

function Sun() {
  return (
    <g aria-hidden="true">
      <path d={edgeDisc(SUN_R)} fill={SUN_RIM} />
      <path d={edgeDisc(SUN_R - 7)} fill={SUN_FACE} />
      <circle cx={18} cy={CY - 34} r={3.2} fill={SUN_SPOT} />
      <circle cx={24} cy={CY + 38} r={2.4} fill={SUN_SPOT} />
      <circle cx={6} cy={CY + 22} r={1.8} fill={SUN_SPOT} />
    </g>
  )
}

function Beams() {
  return (
    <g aria-hidden="true" stroke={BEAM} strokeLinecap="round" opacity={0.75}>
      {BEAMS.map((b) => (
        <g key={b.y}>
          <line x1={b.x1} y1={b.y} x2={b.x2 - 4} y2={b.y} strokeWidth={1.6} strokeDasharray="10 6" />
          <path d={`M${f1(b.x2 - 6)} ${b.y - 3.6}L${f1(b.x2)} ${b.y}L${f1(b.x2 - 6)} ${b.y + 3.6}`} fill="none" strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  )
}

function Globe({ hour, clip }: { hour: number; clip: string }) {
  const turn = turnAngle(hour)
  const arrow = poleArrow()
  const k = R / 100
  return (
    <g>
      <clipPath id={clip}><circle cx={CX} cy={CY} r={R} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <circle cx={CX} cy={CY} r={R} fill={OCEAN} />
        <g transform={`translate(${CX} ${CY}) rotate(${f1(-turn)}) scale(${k})`} data-turn={f1(turn)}>
          <g stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={0.8 / k} fill="none">
            {[0, 30, 60, 90, 120, 150].map((d) => (
              <line key={d} x1={-100 * Math.cos(rad(d))} y1={-100 * Math.sin(rad(d))} x2={100 * Math.cos(rad(d))} y2={100 * Math.sin(rad(d))} />
            ))}
            <circle r={86.6} />
            <circle r={50} />
          </g>
          <path d={LAND} fill={LAND_FILL} stroke={LAND_EDGE} strokeWidth={0.7 / k} strokeLinejoin="round" />
          <path d={ICE} fill={ICE_FILL} stroke={ICE_EDGE} strokeWidth={0.7 / k} strokeLinejoin="round" />
        </g>
        {/* The half facing away from the Sun is in the Earth's own shadow. */}
        <path d={`M${CX} ${CY - R}A${R} ${R} 0 0 1 ${CX} ${CY + R}Z`} fill={NIGHT} opacity={0.62} data-night="1" />
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={GLOBE_RIM} strokeWidth={1.3} />
      {/* The North Pole, and the way the Earth spins round it. */}
      <g aria-hidden="true">
        <path d={arrow.arc} fill="none" stroke={SPACE} strokeWidth={5} strokeLinecap="round" />
        <path d={arrow.head} fill={SPACE} stroke={SPACE} strokeWidth={2.4} strokeLinejoin="round" />
        <path d={arrow.arc} fill="none" stroke={LABEL} strokeWidth={2.3} strokeLinecap="round" data-spin="anticlockwise" />
        <path d={arrow.head} fill={LABEL} />
        <circle cx={CX} cy={CY} r={2.6} fill={LABEL} stroke={SPACE} strokeWidth={1.2} />
      </g>
    </g>
  )
}

/** You, standing on the Earth with your head away from its middle. */
function OnGlobe({ hour }: { hour: number }) {
  const p = personAt(hour, R - 0.5)
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(90 - turnAngle(hour))})`} data-you="1" pointerEvents="none">
      <ellipse cx={0} cy={0.3} rx={5.4} ry={1.8} fill="#FFFFFF" opacity={0.9} />
      <Child scale={FIG / 17.5} />
    </g>
  )
}

function House({ lit, light }: { lit: boolean; light: number }) {
  const n = 1 - light
  return (
    <g aria-hidden="true">
      <rect x={174} y={50} width={5} height={10} fill={mix('#8A4B37', '#2E2422', n * 0.7)} />
      <rect x={148} y={56} width={36} height={19} fill={mix('#F2E6CC', '#4E4A45', n * 0.75)} />
      <path d="M144 57 L166 42 L188 57 Z" fill={mix('#C0563B', '#4A2A25', n * 0.7)} strokeLinejoin="round" />
      <rect x={155} y={63} width={8} height={12} rx={1} fill={mix('#7A4A2E', '#2A1F1A', n * 0.6)} />
      <rect x={169} y={61} width={10} height={8} rx={1} fill={lit ? '#FFD36B' : mix('#CFE6F5', '#3A4B63', n)} stroke={mix('#7A6A55', '#2A2622', n * 0.6)} strokeWidth={1} data-window={lit ? 'lit' : 'dark'} />
      <path d="M174 61 V69 M169 65 H179" stroke={mix('#7A6A55', '#2A2622', n * 0.6)} strokeWidth={0.9} />
    </g>
  )
}

function Tree({ light }: { light: number }) {
  const n = 1 - light
  const leaf = mix('#4E8F48', '#1E3A26', n * 0.8)
  return (
    <g aria-hidden="true">
      <rect x={202.5} y={58} width={5} height={16} rx={1.5} fill={mix('#7A5232', '#2B2019', n * 0.7)} />
      <circle cx={205} cy={53} r={10} fill={leaf} />
      <circle cx={196.5} cy={59} r={7.5} fill={leaf} />
      <circle cx={213.5} cy={59} r={7.5} fill={leaf} />
    </g>
  )
}

/** The curtains over your sky on a predict card: drawn closed until it is marked, then slid away. */
function Curtains({ open, reduced }: { open: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)' }
  // Fabric hung in soft folds: each fold a band, a little wider at the hem than at the rail, with a light crest.
  const FOLD = 30
  const drape = (side: -1 | 1) => {
    const x0 = side < 0 ? 0 : SKY_MID
    const folds = Array.from({ length: SKY_MID / FOLD }, (_, i) => x0 + i * FOLD)
    return (
      <g style={{ transform: open ? `translateX(${side * (SKY_MID + 4)}px)` : 'translateX(0px)', ...ease }} data-curtain={side < 0 ? 'left' : 'right'}>
        <rect x={x0} y={4} width={SKY_MID} height={SKY_H} fill="#4C7E9E" />
        {folds.map((x, i) => (
          <g key={x}>
            {i % 2 === 1 && <path d={`M${x + 3} 4 L${x + FOLD - 3} 4 L${x + FOLD + 1} ${SKY_H - 4} L${x - 1} ${SKY_H - 4} Z`} fill="#43718F" />}
            <path d={`M${x + FOLD / 2} 6 L${x + FOLD / 2 + 1} ${SKY_H - 6}`} stroke="#6A9BBA" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
            <path d={`M${x} ${SKY_H - 4} Q${x + FOLD / 2} ${SKY_H + 1} ${x + FOLD} ${SKY_H - 4} L${x + FOLD} ${SKY_H} L${x} ${SKY_H} Z`} fill="#3E6A86" />
          </g>
        ))}
        <rect x={side < 0 ? x0 + SKY_MID - 1.5 : x0} y={4} width={1.5} height={SKY_H} fill="#2F5670" />
      </g>
    )
  }
  return (
    <g aria-hidden="true">
      {drape(-1)}
      {drape(1)}
      <g style={{ opacity: open ? 0 : 1, transition: reduced ? undefined : 'opacity 300ms ease' }}>
        <rect x={0} y={0} width={W} height={6} fill="#5B4636" />
        {Array.from({ length: 13 }, (_, i) => <circle key={i} cx={14 + i * 27.6} cy={5} r={2.6} fill="none" stroke="#8C7360" strokeWidth={1.2} />)}
        <rect x={SKY_MID - 52} y={SKY_H / 2 - 12} width={104} height={22} rx={6} fill="#F8FAFC" stroke="#2A4D63" strokeWidth={1.2} />
        <text x={SKY_MID} y={SKY_H / 2 + 3} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1F3B4E">curtains closed</text>
      </g>
    </g>
  )
}

function Sky({ hour, curtains, open, reduced, clip }: { hour: number; curtains: boolean; open: boolean; reduced: boolean; clip: string }) {
  const sun = sunInSky(hour)
  const light = daylight(sun.height)
  const stars = starsShow(sun.height)
  const sky = skyColour(sun.height)
  const ground = mix('#5E9A4B', '#22392A', 1 - light)
  const near = mix('#4F8A3E', '#1B2F22', 1 - light)
  const sunFill = mix('#F08A24', '#FBC02D', clamp(sun.height / 20, 0, 1))
  const titleInk = inkOn(sky)
  return (
    <svg viewBox={`0 0 ${W} ${SKY_H}`} className="block h-auto w-full select-none" aria-hidden="true" data-sky={f1(sun.height)}>
      <clipPath id={clip}><rect x={0.75} y={0.75} width={W - 1.5} height={SKY_H - 1.5} rx={14} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width={W} height={SKY_H} fill={sky} />
        {stars > 0 && SKY_STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 1} fill={STAR} opacity={stars * 0.9} />)}
        {sun.height > -3 && (
          <g transform={`translate(${f1(sun.x)} ${f1(sun.y)})`} data-sky-sun="1">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4
              return <line key={i} x1={Math.cos(a) * (SKY_SUN_R + 2.5)} y1={Math.sin(a) * (SKY_SUN_R + 2.5)} x2={Math.cos(a) * (SKY_SUN_R + 6)} y2={Math.sin(a) * (SKY_SUN_R + 6)} stroke={sunFill} strokeWidth={2} strokeLinecap="round" />
            })}
            <circle r={SKY_SUN_R} fill={sunFill} />
          </g>
        )}
        <path d={`M0 80 C 50 79 90 72 150 73 C 210 74 250 70 300 75 C 330 78 345 80 ${W} 80 L${W} ${SKY_H} L0 ${SKY_H} Z`} fill={ground} />
        <path d={`M0 88 C 80 84 160 90 240 86 C 300 83 330 86 ${W} 87 L${W} ${SKY_H} L0 ${SKY_H} Z`} fill={near} />
        <House lit={sun.height < -2} light={light} />
        <Tree light={light} />
        <g transform="translate(128 74.5) scale(1.45)"><Child dim={1 - light} /></g>
        <g fontSize={12} fontWeight={700} fill={LABEL} stroke="#1E3324" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
          <text x={12} y={93}>east</text>
          <text x={W - 12} y={93} textAnchor="end">west</text>
        </g>
        <text x={12} y={18} fontSize={12} fontWeight={700} fill={titleInk}>your sky</text>
        {curtains && <Curtains open={open} reduced={reduced} />}
      </g>
      <rect x={0.75} y={0.75} width={W - 1.5} height={SKY_H - 1.5} rx={14} fill="none" stroke="#CBD5E1" strokeWidth={1.5} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// The turn, eased when a button is pressed so the eye sees the Sun move; straight under the finger when dragged.

function useEased(target: number, reduced: boolean, instant: boolean): number {
  const [shown, setShown] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    const from = cur.current
    // A drag follows the finger; anything that goes back (a fresh start) jumps, since the Earth never turns back.
    if (reduced || instant || target < from) {
      cur.current = target
      setShown(target)
      return
    }
    if (Math.abs(target - from) < 1e-6) return
    const dur = Math.min(1700, 520 + (target - from) * 160)
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      cur.current = from + (target - from) * e
      setShown(cur.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, instant])
  return reduced || instant ? target : shown
}

/** The goal as the card says it. Literals here: config's tables are not there yet while this file loads. */
export function goalWord(time: string): string {
  const said: Record<string, string> = { sunrise: 'sunrise', midday: 'midday', sunset: 'sunset', midnight: 'midnight', day: 'daytime', night: 'night-time' }
  return Object.prototype.hasOwnProperty.call(said, time) ? said[time] : 'sunrise'
}

function where(hour: number): string {
  const edge = Math.min(Math.abs(wrap24(hour) - 6), Math.abs(wrap24(hour) - 18))
  if (edge < 0.5) return 'near the edge between the light and the dark'
  return isDay(hour) ? 'in the daylight' : 'in the dark'
}
function skySaid(hour: number): string {
  const s = sunInSky(hour)
  if (s.height < -7) return 'In your sky the Sun is out of sight and the sky is dark.'
  if (s.height < 7) return `In your sky the Sun is on the horizon in the ${wrap24(hour) < 12 ? 'east' : 'west'}.`
  if (s.height > 75) return 'In your sky the Sun is high overhead.'
  return `In your sky the Sun is ${s.height < 40 ? 'low' : 'part-way up'} in the ${wrap24(hour) < 12 ? 'east' : 'west'}.`
}
function describe(hour: number, open: boolean): string {
  return `The Earth seen from above the North Pole, with the Sun shining on it from the left. The half facing the Sun is day and the other half is night, and an arrow round the pole shows the Earth spinning anticlockwise. You stand on the Earth, ${where(hour)}. ${open ? skySaid(hour) : 'Your curtains are closed.'}`
}

const TURN_BTN = 'nodrag flex h-7 shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** The turn arrow on the buttons and in the caption: the same anticlockwise arrow as round the pole. */
function SpinIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  const a = spinArrow(8, 8.4, 5.2, 3.4)
  return (
    <svg viewBox="0 0 16 16" className={`${className} shrink-0`} aria-hidden="true">
      <path d={a.arc} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
      <path d={a.head} fill="currentColor" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" />
    </svg>
  )
}

export function DayNightView({ config, state, setState, marked, reduced, locked }: Props) {
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const now = marked === 'shown' ? dayNightEngine.solve(config) : state
  const turned = turnedOf(now)
  const [dragging, setDragging] = useState(false)
  const shownTurned = useEased(turned, reduced, dragging)
  const hour = hourAt(config, { turned: shownTurned })
  const predict = config.task === 'predict'
  const open = !predict || marked !== 'idle'
  const finished = marked === 'right' || marked === 'shown'
  const canTurn = !locked && !finished

  const spaceRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: number; prev: number | null; unwrapped: number; high: number; base: number } | null>(null)
  const [pushedBack, setPushedBack] = useState(false)
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current) }, [])
  const sayOneWay = () => {
    setPushedBack(true)
    if (backTimer.current) clearTimeout(backTimer.current)
    backTimer.current = setTimeout(() => setPushedBack(false), 2600)
  }

  const turnTo = (next: number) => {
    if (!canTurn) return
    setState({ turned: Math.round(next * 100) / 100 })
  }
  /** The finger's angle round the North Pole, or null right over the pole, where an angle means nothing. */
  const angleAt = (e: ReactPointerEvent): number | null => {
    const m = spaceRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    if (Math.hypot(p.x - CX, p.y - CY) < 12) return null
    return (Math.atan2(-(p.y - CY), p.x - CX) * 180) / Math.PI
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canTurn || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, prev: angleAt(e), unwrapped: 0, high: 0, base: turned }
    setDragging(true)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const a = angleAt(e)
    // Crossing the pole, the angle jumps: take hold again where the finger comes out.
    if (a === null || d.prev === null) {
      d.prev = a
      return
    }
    const step = ((a - d.prev + 540) % 360) - 180
    d.prev = a
    d.unwrapped += step
    // The Earth turns one way only: pushed back, it holds still until the finger comes round again.
    if (d.unwrapped > d.high) {
      d.high = d.unwrapped
      turnTo(d.base + d.high / 15)
    } else if (d.high - d.unwrapped > 12 && !pushedBack) sayOneWay()
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = ({ ArrowRight: 1, ArrowUp: 1, PageUp: 6 } as Record<string, number>)[e.key]
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown'
    if (by === undefined && !back) return
    // The board moves a selected card with the arrows; here they turn the Earth.
    e.preventDefault()
    e.stopPropagation()
    if (back) sayOneWay()
    else turnTo(turned + by)
  }

  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^([^.]*\.)\s*(.*)$/)
  const hoursShown = Math.round(shownTurned)
  const hit = R + FIG + 4

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(.dn-globe:focus-visible)_.dn-kbd]:block">
      {/* The goal, in plain words: the time to make. Where it is on the turn is the learner's to find. */}
      <p className="flex items-baseline gap-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Make it</span>
        <span className="text-[15px] font-extrabold text-ss-ink">{goalWord(config.time)}</span>
        <span className="text-[12px] font-bold text-ss-slate">for you{predict ? ', with your curtains closed' : ''}</span>
      </p>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg ref={spaceRef} viewBox={`0 0 ${W} ${SPACE_H}`} role="img" aria-label={describe(hour, open)} className="block h-auto w-full select-none" data-hour={f1(hour)}>
            <clipPath id={`${ids}-panel`}><rect x={0} y={0} width={W} height={SPACE_H} rx={16} /></clipPath>
            <g clipPath={`url(#${ids}-panel)`}>
              <rect width={W} height={SPACE_H} fill={SPACE} />
              {SPACE_STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.2 : 0.85} fill={STAR} opacity={0.55} />)}
              <Sun />
              <Beams />
              <Globe hour={hour} clip={`${ids}-globe`} />
              <OnGlobe hour={hour} />
              <g aria-hidden="true" fontFamily="system-ui, sans-serif" fontWeight={700} strokeLinejoin="round" paintOrder="stroke">
                {SPACE_LABELS.map((l) => (
                  <text
                    key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={l.size}
                    fill={l.text === 'Sun' ? SUN_INK : l.text === 'sunlight' ? BEAM : LABEL}
                    stroke={l.text === 'Sun' ? 'none' : SPACE} strokeWidth={l.text === 'Sun' ? 0 : 3}
                  >{l.text}</text>
                ))}
                {pushedBack && (
                  <g fill={LABEL} fontSize={12} data-one-way="1">
                    <text x={10} y={SPACE_H - 25}>The Earth turns</text>
                    <text x={10} y={SPACE_H - 11}>one way only</text>
                  </g>
                )}
              </g>
            </g>
            <rect x={0.75} y={0.75} width={W - 1.5} height={SPACE_H - 1.5} rx={15.5} fill="none" stroke={SPACE_EDGE} strokeWidth={1.5} />
          </svg>
          {/* The Earth itself is the handle: drag it round. Also a slider for the keyboard. */}
          <div
            role="slider" tabIndex={canTurn ? 0 : -1} aria-label="Turn the Earth" aria-disabled={!canTurn || undefined}
            aria-valuemin={0} aria-valuemax={Math.max(240, hoursShown)} aria-valuenow={hoursShown} aria-valuetext={`${hoursShown} ${hoursShown === 1 ? 'hour' : 'hours'} turned`}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
            className={`dn-globe nodrag absolute touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${canTurn ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            style={{ left: `${((CX - hit) / W) * 100}%`, top: `${((CY - hit) / SPACE_H) * 100}%`, width: `${((2 * hit) / W) * 100}%`, height: `${((2 * hit) / SPACE_H) * 100}%` }}
          />
        </div>
        <Sky hour={hour} curtains={predict} open={open} reduced={reduced} clip={`${ids}-sky`} />
        <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span className="whitespace-nowrap">Seen from above the North Pole</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><SpinIcon className="h-3 w-3" />the way it spins</span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <svg viewBox="-6 -18 12 19" className="h-3.5 w-2.5 shrink-0" aria-hidden="true"><Child /></svg>you
          </span>
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Hours turned</span>
          <span className="min-w-[22px] text-[15px] font-extrabold tabular-nums text-ss-ink" data-turned={hoursShown}>{hoursShown}</span>
        </p>
        <span className="flex items-center gap-1.5">
          {[1, 6].map((h) => (
            <button key={h} type="button" className={TURN_BTN} disabled={!canTurn} aria-label={`Turn the Earth on ${h} ${h === 1 ? 'hour' : 'hours'}`} onClick={() => turnTo(turned + h)}>
              <SpinIcon />{h} {h === 1 ? 'hour' : 'hours'}
            </button>
          ))}
        </span>
      </div>

      <p className="dn-kbd hidden text-[12px] font-semibold text-ss-slate">Right arrow turns the Earth an hour; Page Up turns it six.</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
