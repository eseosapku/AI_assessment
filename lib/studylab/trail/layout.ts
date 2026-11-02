// lib/studylab/trail/layout.ts
import type { CardInput, CardPlace, DetourBox, PlotBox, PlotInput, Point, Rect, Tile, TrailLayoutInput, TrailWorld } from './types'

/**
 * Where everything sits on the Trail, worked out from the run and nothing else.
 *
 * Positions here are never saved: the classic view keeps its own, and the same
 * run always draws the same board. The rule that keeps it free of overlaps is
 * simple. Plots in a row have separate x-ranges, rows have separate y-ranges,
 * and detours have a lane of their own outside the row, so nothing has to be
 * nudged apart afterwards however big a station's cards turn out to be.
 */

export const FOCUS_W = 640
/** 0.42 of the focus card. */
export const FINISHED_W = 270
/** 0.27 of the focus card. */
export const FILED_W = 173
export const PLOT_MIN = 460
export const GAP_X = 240
export const GAP_Y = 260
export const WIND = 150
export const LABEL_H = 144
export const SPEAKER_H = 190
export const PAD = 48
export const TILE = 18
export const TILE_EVERY = 40
export const TITLE = { w: 900, h: 260 }

const MAX_FOCUS_SCALE = 1.5
/** A tall card comes down to fit the screen, but no further than it can be read. */
const MIN_TALL_SCALE = 1.15
const CARD_GAP = 24
const FILED_GAP = 16
const COLUMN_SIZE = 3
const ROW_SIZE = 4
const ONE_ROW_UP_TO = 5
const TITLE_GAP = 80
const LANE_GAP = 200
const DETOUR_GAP = 80
const TURN_REACH = 420
const MARGIN = 40
const KANA_W = 150
const BUBBLE_MIN_W = 360

function placeAt(card: CardInput, w: number, role: CardPlace['role'], x = 0, y = 0): CardPlace {
  const scale = w / card.natural.w
  return { x, y, w, h: card.natural.h * scale, scale, role }
}

function focusWidthOf(card: CardInput, focusWidth: number, room?: number): number {
  const wide = Math.min(card.natural.w * MAX_FOCUS_SCALE, focusWidth)
  if (!room || card.natural.h <= 0) return wide
  return Math.min(wide, card.natural.w * Math.max(MIN_TALL_SCALE, room / card.natural.h))
}

interface Contents {
  w: number
  h: number
  cards: Record<string, CardPlace>
  links: { from: Point; to: Point }[]
  speaker: { kana: Point; bubble: Rect; frame: Rect } | null
}

const centre = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** A plot in use: what is finished down one side, the focus card beside it, the speaker above that. */
function openContents(finished: CardInput[], filed: CardInput[], focus: CardInput | null, focusWidth: number, speaker: boolean, speakerH: number, focusRoom?: number): Contents {
  const cards: Contents['cards'] = {}
  const side: { card: CardInput; w: number; role: CardPlace['role'] }[] = [
    ...finished.map((card) => ({ card, w: FINISHED_W, role: 'finished' as const })),
    ...filed.map((card) => ({ card, w: FILED_W, role: 'filed' as const })),
  ]
  const columns = Math.ceil(side.length / COLUMN_SIZE)
  // Only as wide as what is in them, or small filed cards leave a gap beside the focus.
  const sideW = finished.length > 0 ? FINISHED_W : FILED_W
  let sideH = 0
  side.forEach(({ card, w, role }, i) => {
    const column = Math.floor(i / COLUMN_SIZE)
    const above = i % COLUMN_SIZE === 0 ? PAD : cards[side[i - 1].card.id].y + cards[side[i - 1].card.id].h + CARD_GAP
    cards[card.id] = placeAt(card, w, role, PAD + column * (sideW + CARD_GAP), above)
    sideH = Math.max(sideH, cards[card.id].y + cards[card.id].h - PAD)
  })

  const slotX = PAD + columns * (sideW + CARD_GAP)
  const showSpeaker = speaker && focus !== null
  const strip = showSpeaker ? speakerH + CARD_GAP : 0
  const focusW = focus ? focusWidthOf(focus, focusWidth, focusRoom === undefined ? undefined : focusRoom - strip) : focusWidth
  const slotW = Math.max(focusW, speaker ? KANA_W + BUBBLE_MIN_W : 0)
  let slotH = strip
  if (focus) {
    cards[focus.id] = placeAt(focus, focusW, 'focus', slotX, PAD + strip)
    slotH += cards[focus.id].h
  }

  const links: Contents['links'] = []
  const chain = [...finished.map((c) => cards[c.id]), ...(focus ? [cards[focus.id]] : [])]
  for (let i = 1; i < chain.length; i++) links.push({ from: centre(chain[i - 1]), to: centre(chain[i]) })

  let spoken: Contents['speaker'] = null
  if (showSpeaker && focus) {
    const place = cards[focus.id]
    const bubble = { x: slotX + KANA_W, y: PAD, w: slotW - KANA_W, h: speakerH }
    const right = Math.max(bubble.x + bubble.w, place.x + place.w)
    spoken = { kana: { x: slotX, y: PAD }, bubble, frame: { x: slotX, y: PAD, w: right - slotX, h: place.y + place.h - PAD } }
  }

  return {
    w: Math.max(PLOT_MIN, PAD + columns * (sideW + CARD_GAP) + slotW + PAD),
    h: Math.max(PLOT_MIN, PAD + Math.max(sideH, slotH) + PAD),
    cards,
    links,
    speaker: spoken,
  }
}

/** A plot at rest: its cards filed in neat rows of small thumbnails. */
function restingContents(filed: CardInput[]): Contents {
  const cards: Contents['cards'] = {}
  let top = PAD
  for (let i = 0; i < filed.length; i += ROW_SIZE) {
    const row = filed.slice(i, i + ROW_SIZE).map((card, j) => {
      const place = placeAt(card, FILED_W, 'filed', PAD + j * (FILED_W + FILED_GAP), top)
      cards[card.id] = place
      return place
    })
    top += Math.max(...row.map((p) => p.h)) + FILED_GAP
  }
  const across = Math.min(filed.length, ROW_SIZE)
  return {
    w: Math.max(PLOT_MIN, 2 * PAD + across * FILED_W + Math.max(0, across - 1) * FILED_GAP),
    h: Math.max(PLOT_MIN, top - (filed.length ? FILED_GAP : 0) + PAD),
    cards,
    links: [],
    speaker: null,
  }
}

function plotContents(p: PlotInput, focusWidth: number, speaker: boolean, speakerH: number, focusRoom?: number): Contents {
  return p.focus || p.state === 'current' ? openContents(p.finished, p.filed, p.focus, focusWidth, speaker, speakerH, focusRoom) : restingContents([...p.finished, ...p.filed])
}

/** Every `TILE_EVERY` along a path, clear of the plots at either end, two tones like the mark's squares. */
function layTiles(path: Point[], kind: Tile['kind'], segment: number): Tile[] {
  const lengths = [0]
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y))
  const total = lengths[lengths.length - 1]
  const tiles: Tile[] = []
  let at = 1
  let k = 0
  for (let d = TILE; d <= total - TILE; d += TILE_EVERY, k++) {
    while (at < path.length - 1 && lengths[at] < d) at++
    const a = path[at - 1]
    const b = path[at]
    const span = lengths[at] - lengths[at - 1] || 1
    const f = (d - lengths[at - 1]) / span
    tiles.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, tone: (k % 2) as 0 | 1, kind, segment })
  }
  return tiles
}

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, steps = 48): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const u = 1 - t
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    }
  })
}

/** Straight off the plot to the middle of the gap, along it, and straight on to the detour, with the corners rounded. */
function branchPath(from: Point, to: Point, gapY: number): Point[] {
  const across = to.x - from.x
  const radius = Math.min(60, Math.abs(across) / 2, LANE_GAP / 4)
  if (radius < 1) return [from, to]
  const side = Math.sign(across)
  const up = Math.sign(gapY - from.y)
  const corner = (start: Point, control: Point, end: Point) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8
      const u = 1 - t
      return { x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y }
    })
  return [
    from,
    ...corner({ x: from.x, y: gapY - up * radius }, { x: from.x, y: gapY }, { x: from.x + side * radius, y: gapY }),
    ...corner({ x: to.x - side * radius, y: gapY }, { x: to.x, y: gapY }, { x: to.x, y: gapY + up * radius }),
    to,
  ]
}

export function trailLayout(input: TrailLayoutInput): TrailWorld {
  const { stations, detours, focusWidth, speaker, speakerH = SPEAKER_H, focusRoom, reopened } = input
  const n = stations.length
  const contents = stations.map((s) => plotContents(s, focusWidth, speaker, speakerH, focusRoom))
  const detourContents = detours.map((d) => (d.focus ? openContents([], d.filed, d.focus, focusWidth, speaker, speakerH, focusRoom) : restingContents(d.filed)))

  const firstRow = n <= ONE_ROW_UP_TO ? n : Math.ceil(n / 2)
  const rows = [stations.map((_, i) => i).slice(0, firstRow), stations.map((_, i) => i).slice(firstRow)].filter((r) => r.length > 0)
  const rowOf = (station: number) => (station < firstRow ? 0 : 1)
  const rowHeight = (row: number[]) => Math.max(...row.map((i) => contents[i].h)) + LABEL_H + 2 * WIND
  const laneHeight = (row: number) => Math.max(0, ...detours.flatMap((d, i) => (rowOf(d.station) === row ? [detourContents[i].h] : [])))

  // Top to bottom: the title, the first row's detours, the rows, the second row's detours.
  const title: Rect = { x: 0, y: 0, w: TITLE.w, h: TITLE.h }
  let y = TITLE.h + TITLE_GAP
  const firstLaneH = laneHeight(0)
  const firstLaneTop = y
  if (firstLaneH > 0) y += firstLaneH + LANE_GAP
  const rowTops: number[] = []
  rows.forEach((row, i) => {
    if (i > 0) y += GAP_Y
    rowTops.push(y)
    y += rowHeight(row)
  })
  const secondLaneTop = y + LANE_GAP

  // Across: the first row runs left to right, the second comes back under it.
  const plots: PlotBox[] = new Array(n)
  rows.forEach((row, r) => {
    const mid = rowTops[r] + rowHeight(row) / 2 + LABEL_H / 2
    let cursor = 0
    if (r === 1) cursor = plots[rows[0][rows[0].length - 1]].rect.x + plots[rows[0][rows[0].length - 1]].rect.w
    row.forEach((i, along) => {
      const { w, h } = contents[i]
      const x = r === 0 ? cursor : cursor - w
      cursor = r === 0 ? cursor + w + GAP_X : x - GAP_X
      const rect = { x, y: mid + (along % 2 ? WIND : -WIND) - h / 2, w, h }
      const s = stations[i]
      plots[i] = {
        index: i,
        id: s.id,
        title: s.title,
        state: s.state,
        locked: !!s.locked,
        notes: s.notes,
        rect,
        label: { x: rect.x, y: rect.y - LABEL_H, w: rect.w, h: LABEL_H },
        badge: { x: rect.x + rect.w / 2, y: rect.y },
      }
    })
  })

  // Detours sit in the lane outside their station's row, in the order of the plots they grew from.
  const detourRects: Rect[] = new Array(detours.length)
  for (const row of [0, 1]) {
    const inLane = detours
      .map((d, i) => ({ d, i, from: plots[d.station] }))
      .filter(({ d }) => rowOf(d.station) === row)
      .sort((a, b) => a.from.rect.x - b.from.rect.x)
    let cursor = -Infinity
    for (const { i, from } of inLane) {
      const { w, h } = detourContents[i]
      const x = Math.max(cursor, from.rect.x + from.rect.w / 2 - w / 2)
      cursor = x + w + DETOUR_GAP
      detourRects[i] = { x, y: row === 0 ? firstLaneTop + firstLaneH - h : secondLaneTop, w, h }
    }
  }

  const tiles: Tile[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = plots[i].rect
    const b = plots[i + 1].rect
    const kind = stations[i].state === 'done' ? 'done' : 'trail'
    const start = { x: rowOf(i) === 0 ? a.x + a.w : a.x, y: a.y + a.h / 2 }
    if (rowOf(i) !== rowOf(i + 1)) {
      // The turn between rows swings out past the end of both, clear of the labels above the next plot.
      const end = { x: b.x + b.w, y: b.y + b.h / 2 }
      const reach = Math.max(start.x, end.x) + TURN_REACH
      tiles.push(...layTiles(bezier(start, { x: reach, y: start.y }, { x: reach, y: end.y }, end), kind, i))
    } else {
      const end = { x: rowOf(i) === 0 ? b.x : b.x + b.w, y: b.y + b.h / 2 }
      const mid = (start.x + end.x) / 2
      tiles.push(...layTiles(bezier(start, { x: mid, y: start.y }, { x: mid, y: end.y }, end), kind, i))
    }
  }
  detours.forEach((d, i) => {
    const plot = plots[d.station]
    const rect = detourRects[i]
    const row = rowOf(d.station)
    const x = plot.rect.x + plot.rect.w / 2
    const dx = rect.x + rect.w / 2
    const path =
      row === 0
        ? branchPath({ x, y: plot.label.y }, { x: dx, y: rect.y + rect.h }, rowTops[0] - LANE_GAP / 2)
        : branchPath({ x, y: plot.rect.y + plot.rect.h }, { x: dx, y: rect.y }, secondLaneTop - LANE_GAP / 2)
    tiles.push(...layTiles(path, 'branch', d.station))
  })

  const cards: TrailWorld['cards'] = {}
  const links: TrailWorld['links'] = []
  let spoken: TrailWorld['speaker'] = null
  const shifted = <T extends Point>(p: T, at: Point): T => ({ ...p, x: p.x + at.x, y: p.y + at.y })
  const settle = (c: Contents, at: Point) => {
    for (const [id, place] of Object.entries(c.cards)) cards[id] = shifted(place, at)
    for (const link of c.links) links.push({ from: shifted(link.from, at), to: shifted(link.to, at) })
    if (c.speaker) spoken = { kana: shifted(c.speaker.kana, at), bubble: shifted(c.speaker.bubble, at), frame: shifted(c.speaker.frame, at) }
  }
  contents.forEach((c, i) => settle(c, plots[i].rect))
  detourContents.forEach((c, i) => settle(c, detourRects[i]))

  // Over the plot in view, at reading size. Everything else stays exactly where it was.
  if (reopened) {
    const card = { id: reopened.id, natural: reopened.natural }
    cards[reopened.id] = placeAt(card, focusWidthOf(card, focusWidth), 'reopened', reopened.at.x, reopened.at.y)
  }

  const everything: Rect[] = [
    title,
    ...plots.map((p) => ({ x: p.rect.x, y: p.label.y, w: p.rect.w, h: p.rect.h + LABEL_H })),
    ...detourRects,
    ...tiles.map((t) => ({ x: t.x - TILE / 2, y: t.y - TILE / 2, w: TILE, h: TILE })),
  ]
  const left = Math.min(...everything.map((r) => r.x)) - MARGIN
  const top = Math.min(...everything.map((r) => r.y)) - MARGIN
  const right = Math.max(...everything.map((r) => r.x + r.w)) + MARGIN
  const bottom = Math.max(...everything.map((r) => r.y + r.h)) + MARGIN

  const boxes: DetourBox[] = detours.map((d, i) => ({ id: d.id, station: d.station, rect: detourRects[i], open: d.focus !== null }))
  return { bounds: { x: left, y: top, w: right - left, h: bottom - top }, title, plots, detours: boxes, tiles, links, cards, speaker: spoken }
}
