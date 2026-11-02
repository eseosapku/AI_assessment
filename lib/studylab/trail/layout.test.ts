// lib/studylab/trail/layout.test.ts
import { describe, it, expect } from 'vitest'
import { trailLayout, FINISHED_W, FILED_W, FOCUS_W } from './layout'
import type { CardInput, DetourInput, PlotBox, PlotInput, PlotState, Rect, TrailLayoutInput, TrailWorld } from './types'

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const boxOf = (p: PlotBox): Rect => ({ x: Math.min(p.rect.x, p.label.x), y: p.label.y, w: Math.max(p.rect.w, p.label.w), h: p.rect.y + p.rect.h - p.label.y })
const tileBox = (t: { x: number; y: number }): Rect => ({ x: t.x - 9, y: t.y - 9, w: 18, h: 18 })

const card = (id: string, w = 400, h = 400): CardInput => ({ id, natural: { w, h } })
const plot = (i: number, state: PlotState, over: Partial<PlotInput> = {}): PlotInput => ({ id: `s${i}`, title: `Station ${i}`, state, focus: null, finished: [], filed: [], notes: 0, ...over })
const world = (stations: PlotInput[], detours: DetourInput[] = []): TrailLayoutInput => ({ stations, detours, focusWidth: FOCUS_W, speaker: true })
const oneCurrent = (over: Partial<PlotInput> = {}) => world([plot(0, 'done'), plot(1, 'current', over), plot(2, 'future'), plot(3, 'future')])
const allFuture = (n: number) => world(Array.from({ length: n }, (_, i) => plot(i, 'future')))
const statesOf = (states: PlotState[]) => world(states.map((s, i) => plot(i, s)))
const withDetour = (n: number, at: number) =>
  world(
    Array.from({ length: n }, (_, i) => plot(i, i < at ? 'done' : i === at ? 'current' : 'future')),
    [{ id: 'd', station: at, focus: null, filed: [card('x')] }],
  )
const tilesAfter = (w: TrailWorld, i: number) => w.tiles.filter((t) => t.kind !== 'branch' && t.segment === i)

/** A small seeded generator, so a failure names a board that can be rebuilt. */
function seeded(seed: number) {
  let s = seed
  return (lo: number, hi: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return lo + Math.floor((s / 4294967296) * (hi - lo + 1))
  }
}

function scenario(n: number, current: number, seed: number): TrailLayoutInput {
  const rnd = seeded(seed * 7919 + n * 31 + current)
  let next = 0
  const someCard = () => card(`c${next++}`, rnd(300, 720), rnd(200, 1200))
  const some = (lo: number, hi: number) => Array.from({ length: rnd(lo, hi) }, someCard)
  const detourOpen = seed % 3 === 0 && current >= 0
  const stations = Array.from({ length: n }, (_, i) => {
    if (current === -1 || i < current) return plot(i, 'done', { filed: some(0, 12) })
    if (i === current) return plot(i, 'current', { finished: some(0, 12), focus: detourOpen ? null : someCard() })
    return plot(i, 'future')
  })
  const detours: DetourInput[] = []
  for (let i = 0; i < n; i++) {
    for (let d = rnd(0, seed % 2 === 0 ? 3 : 1); d > 0; d--) detours.push({ id: `d${detours.length}`, station: i, focus: null, filed: some(0, 4) })
  }
  if (detourOpen) {
    detours.push({ id: 'open', station: current, focus: someCard(), filed: some(0, 3) })
  }
  return world(stations, detours)
}

describe('trailLayout', () => {
  for (let n = 3; n <= 10; n++) {
    for (const current of [-1, ...Array.from({ length: n }, (_, i) => i)]) {
      for (const seed of [1, 2, 3]) {
        it(`no overlaps: ${n} stations, current ${current}, seed ${seed}`, () => {
          const input = scenario(n, current, seed)
          const w = trailLayout(input)
          const boxes = [w.title, ...w.plots.map(boxOf), ...w.detours.map((d) => d.rect)]
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j])).toBe(false)
          const cards = Object.values(w.cards)
          for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) expect(hit(cards[i], cards[j])).toBe(false)
          for (const t of w.tiles.filter((t) => t.kind !== 'branch')) for (const b of boxes) expect(hit(tileBox(t), b)).toBe(false)
          expect(trailLayout(input)).toEqual(w)
        })
      }
    }
  }

  it('a branch crosses no plot and no detour but its own, and a detour sits off the row, away from the next plot', () => {
    const w = trailLayout(withDetour(8, 2))
    const d = w.detours[0]
    const own = w.plots[d.station].rect
    const branch = w.tiles.filter((t) => t.kind === 'branch')
    expect(branch.length).toBeGreaterThan(0)
    for (const t of branch) for (const p of w.plots) expect(hit(tileBox(t), boxOf(p))).toBe(false)
    expect(d.rect.y + d.rect.h <= own.y || d.rect.y >= own.y + own.h).toBe(true)
  })

  it('in a second row, a detour branches below, away from the row above', () => {
    const w = trailLayout(withDetour(8, 6))
    const d = w.detours[0]
    expect(d.rect.y).toBeGreaterThanOrEqual(w.plots[6].rect.y + w.plots[6].rect.h)
    for (const t of w.tiles.filter((t) => t.kind === 'branch')) for (const p of w.plots) expect(hit(tileBox(t), boxOf(p))).toBe(false)
  })

  it.each([3, 4, 5, 6, 7, 8, 9, 10])('%i future plots read at 1440x900: fit zoom >= 0.35', (n) => {
    const { bounds } = trailLayout(allFuture(n))
    expect(Math.min(1440 / bounds.w, 900 / bounds.h)).toBeGreaterThanOrEqual(0.35)
  })

  it('sizes match the spec', () => {
    const w = trailLayout(oneCurrent({ focus: card('f', 320), finished: [card('a', 300)], filed: [] }))
    expect(w.cards.f).toMatchObject({ role: 'focus', scale: 1.5 })
    expect(w.cards.a).toMatchObject({ role: 'finished', w: FINISHED_W })
    expect(trailLayout(oneCurrent({ focus: card('f', 800) })).cards.f.w).toBe(FOCUS_W)
    const done = trailLayout(world([plot(0, 'done', { filed: [card('z', 500)] }), plot(1, 'current'), plot(2, 'future')]))
    expect(done.cards.z).toMatchObject({ role: 'filed', w: FILED_W })
  })

  it('a current plot holds its finished cards, focus and speaker', () => {
    const w = trailLayout(oneCurrent({ focus: card('f', 640), finished: [card('a', 300), card('b', 300)] }))
    const box = w.plots.find((p) => p.state === 'current')!.rect
    const inside = (r: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h
    for (const r of [w.cards.f, w.cards.a, w.cards.b, w.speaker!.bubble]) expect(inside(r)).toBe(true)
    expect(w.cards.a.x + w.cards.a.w).toBeLessThanOrEqual(w.cards.f.x)
  })

  it('the speaker frame takes in the card and the bubble, for the camera', () => {
    const w = trailLayout(oneCurrent({ focus: card('f', 640) }))
    const { frame, bubble } = w.speaker!
    for (const r of [w.cards.f, bubble]) {
      expect(r.x).toBeGreaterThanOrEqual(frame.x)
      expect(r.y).toBeGreaterThanOrEqual(frame.y)
      expect(r.x + r.w).toBeLessThanOrEqual(frame.x + frame.w)
      expect(r.y + r.h).toBeLessThanOrEqual(frame.y + frame.h)
    }
  })

  it('with no speaker, nothing reserves a strip, and the card fits the given width', () => {
    const w = trailLayout({ ...oneCurrent({ focus: card('f', 560) }), focusWidth: 358, speaker: false })
    expect(w.speaker).toBeNull()
    expect(w.cards.f.w).toBe(358)
  })

  it('with nothing in focus, there is no speaker', () => {
    expect(trailLayout(allFuture(4)).speaker).toBeNull()
  })

  it('a dashed link runs through the finished cards to the focus card', () => {
    const w = trailLayout(oneCurrent({ focus: card('f'), finished: [card('a'), card('b')] }))
    expect(w.links).toHaveLength(2)
    expect(w.links[1].to.x).toBeCloseTo(w.cards.f.x + w.cards.f.w / 2)
  })

  it('a reopened card overlays without moving anything else', () => {
    const input = oneCurrent({ focus: card('f', 640), finished: [card('a', 300)] })
    const plain = trailLayout(input)
    const open = trailLayout({ ...input, reopened: { id: 'a', natural: { w: 300, h: 300 }, at: { x: 5, y: 6 } } })
    expect(open.cards.a).toMatchObject({ role: 'reopened', x: 5, y: 6, scale: 1.5 })
    expect(open.cards.f).toEqual(plain.cards.f)
    expect(open.plots).toEqual(plain.plots)
  })

  it('statuses out of order: a done plot after the current one keeps its green tiles', () => {
    const w = trailLayout(statesOf(['done', 'current', 'done', 'future']))
    const kinds = (i: number) => new Set(tilesAfter(w, i).map((t) => t.kind))
    expect(kinds(0)).toEqual(new Set(['done']))
    expect(kinds(1)).toEqual(new Set(['trail']))
    expect(kinds(2)).toEqual(new Set(['done']))
  })

  it('a plot carries what the board draws on it', () => {
    const w = trailLayout(world([plot(0, 'current', { locked: true, notes: 2 }), plot(1, 'future'), plot(2, 'future')]))
    expect(w.plots[0]).toMatchObject({ title: 'Station 0', locked: true, notes: 2 })
    expect(w.plots[1]).toMatchObject({ locked: false, notes: 0 })
  })

  it('the bounds take in the whole world', () => {
    const w = trailLayout(withDetour(8, 2))
    for (const r of [w.title, ...w.plots.map(boxOf), ...w.detours.map((d) => d.rect)]) {
      expect(r.x).toBeGreaterThanOrEqual(w.bounds.x)
      expect(r.y).toBeGreaterThanOrEqual(w.bounds.y)
      expect(r.x + r.w).toBeLessThanOrEqual(w.bounds.x + w.bounds.w)
      expect(r.y + r.h).toBeLessThanOrEqual(w.bounds.y + w.bounds.h)
    }
    for (const t of w.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(w.bounds.x)
      expect(t.x).toBeLessThanOrEqual(w.bounds.x + w.bounds.w)
    }
  })
})

describe('a speech that needs more room', () => {
  it('pushes the card down rather than running over it', () => {
    const input = oneCurrent({ focus: card('f', 640) })
    const roomy = trailLayout({ ...input, speakerH: 320 })
    expect(roomy.speaker!.bubble.h).toBe(320)
    expect(roomy.cards.f.y).toBeGreaterThanOrEqual(roomy.speaker!.bubble.y + 320)
    expect(roomy.speaker!.frame.h).toBeGreaterThan(trailLayout(input).speaker!.frame.h)
  })
  it('a column of small filed cards takes only the room they need', () => {
    const detour = { id: 'x', station: 0, focus: card('d', 640), filed: [card('old', 300)] }
    const w = trailLayout({ ...allFuture(3), detours: [detour] })
    expect(w.cards.d.x - (w.cards.old.x + w.cards.old.w)).toBeLessThan(120)
  })
})

describe('a tall card in focus', () => {
  const tall = { id: 'f', fit: true, natural: { w: 420, h: 800 } }
  const reading = { id: 'f', natural: { w: 426, h: 900 } }
  it('comes down to fit the screen, so its controls are not under the button', () => {
    const big = trailLayout(oneCurrent({ focus: tall }))
    const fitted = trailLayout({ ...oneCurrent({ focus: tall }), speakerH: 176, focusRoom: 1200 })
    expect(fitted.cards.f.h).toBeLessThan(big.cards.f.h)
    expect(fitted.cards.f.h).toBeLessThanOrEqual(1200 - 176)
  })
  it('stays big enough to read', () => {
    const w = trailLayout({ ...oneCurrent({ focus: tall }), focusRoom: 300 })
    expect(w.cards.f.scale).toBeGreaterThanOrEqual(1.15)
    expect(w.cards.f).toMatchObject({ scrolls: true, h: 300 * 0.5 })
  })
  it('a long card to read keeps its full width, and scrolls in its frame', () => {
    const w = trailLayout({ ...oneCurrent({ focus: reading }), speakerH: 176, focusRoom: 726 })
    expect(w.cards.f.w).toBeCloseTo(639, 0)
    expect(w.cards.f).toMatchObject({ scrolls: true, h: 726 - 176 - 24 })
  })
  it('a card that fits does not scroll', () => {
    const w = trailLayout({ ...oneCurrent({ focus: { id: 'f', natural: { w: 426, h: 200 } } }), speakerH: 176, focusRoom: 726 })
    expect(w.cards.f.scrolls).toBeUndefined()
  })
  it('however much she is saying, the card keeps its share of the room', () => {
    const w = trailLayout({ ...oneCurrent({ focus: reading }), speakerH: 400, focusRoom: 700 })
    expect(w.cards.f.h).toBe(700 * 0.5)
  })
  it('a short card is left alone', () => {
    const short = { id: 'f', type: 'quiz', natural: { w: 640, h: 300 } }
    expect(trailLayout({ ...oneCurrent({ focus: short }), focusRoom: 700 }).cards.f.w).toBe(640)
  })
})
