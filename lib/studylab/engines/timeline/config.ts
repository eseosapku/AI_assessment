// lib/studylab/engines/timeline/config.ts
//
// A scaled time axis. Every date comes from the tutor's config -- the engine invents none -- and the engine marks by
// the date itself, never by the order the tutor listed things in.
//
// Years are whole numbers. The tutor writes BCE as a negative number or "44 BCE"/"44 BC", CE as a plain number or
// "1066 CE"/"1066 AD". There is no year 0 (1 BCE is followed by 1 CE), so the axis uses astronomical numbering inside
// (1 BCE = 0, 2 BCE = -1) and every distance, tolerance and label is converted exactly: 44 BCE to 14 CE is 57 years.
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TimelineView } from './View'

export const TASKS = ['place', 'overlap'] as const
export type Task = (typeof TASKS)[number]

export const ITEMS_MIN = 2
export const PLACE_MAX = 5
export const SPAN_MIN = 2
export const SPAN_MAX = 4
export const NAME_MAX = 22
/** The dates on one place card must span at least this many years, or a drop cannot tell them apart. */
export const MIN_RANGE = 20
export const YEAR_LIMIT = 5_000_000
/** Fraction of the axis either side of a date that still counts as right. */
export const TOL_FRACTION = 0.03
/** The data sits in the middle; this much of its range is left empty at each end. */
export const PAD_FRACTION = 0.14

export type Item = { name: string; year?: number; start?: number; end?: number; given: boolean }
export type TimelineConfig =
  | { task: 'place'; items: Item[] }
  | { task: 'overlap'; spans: Item[]; together: string[] }
export type TimelineState = { at?: Record<string, number>; year?: number }

// ---- calendar, exactly --------------------------------------------------------------------------------------------

/** Historic year (negative = BCE, no 0) to astronomical (1 BCE = 0). */
export const toAstro = (h: number) => (h < 0 ? h + 1 : h)
export const toHist = (a: number) => (a <= 0 ? a - 1 : a)
/** Whole years from historic year `a` to historic year `b`, with no year 0 between BCE and CE. */
export const yearsBetween = (a: number, b: number) => toAstro(b) - toAstro(a)

/** 1200 -> "1200", 50000 -> "50,000", 3000000 -> "3 million", 2500000 -> "2.5 million". */
export function numText(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${Number((a / 1_000_000).toFixed(2))} million`
  if (a >= 10_000) return String(a).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return String(a)
}
export function fmtYear(h: number, plain: boolean): string {
  return h < 0 ? `${numText(h)} BCE` : plain ? numText(h) : `${numText(h)} CE`
}
const plural = (n: number) => `${numText(n).replace(/ million$/, ' million')} ${n === 1 ? 'year' : 'years'}`
export const yearsText = plural

// ---- axis ---------------------------------------------------------------------------------------------------------

export type Handle = { key: string; item: number; part: 'point' | 'start' | 'end'; year: number; given: boolean }

/** Every date on the board, as astronomical years. Item i is "e<i>"; a span has "e<i>s" and "e<i>e". */
export function rawHandles(items: Item[]): Handle[] {
  const out: Handle[] = []
  items.forEach((it, i) => {
    if (it.start !== undefined && it.end !== undefined) {
      out.push({ key: `e${i}s`, item: i, part: 'start', year: toAstro(it.start), given: it.given })
      out.push({ key: `e${i}e`, item: i, part: 'end', year: toAstro(it.end), given: it.given })
    } else if (it.year !== undefined) {
      out.push({ key: `e${i}`, item: i, part: 'point', year: toAstro(it.year), given: it.given })
    }
  })
  return out
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000, 2000000, 2500000, 5000000, 10000000]
export type Axis = { from: number; to: number; span: number; ticks: number[]; plain: boolean; tol: number; unit: number }

export function axisOf(items: Item[]): Axis {
  const ys = rawHandles(items).map((h) => h.year)
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = Math.max(1, Math.ceil((hi - lo) * PAD_FRACTION))
  const from = lo - pad
  const to = hi + pad
  const span = to - from
  const hist = [toHist(from), toHist(to)]
  const maxTicks = Math.max(Math.abs(hist[0]), Math.abs(hist[1])) >= 1_000_000 ? 3 : 5
  let ticks: number[] = []
  for (const s of STEPS) {
    ticks = ticksFor(from, to, s)
    if (ticks.length <= maxTicks) break
  }
  return {
    from, to, span, ticks,
    plain: hist[0] >= 1000,
    tol: Math.max(1, Math.round(span * TOL_FRACTION)),
    unit: Math.max(1, Math.round(span / 100)),
  }
}

/**
 * The dates the learner places. A span too short to drag out with two discs (under three tolerances) is drawn and marked
 * as a single point at its start; its dates are said at marking. Given spans always keep both ends.
 */
export function handlesOf(items: Item[]): Handle[] {
  const tol = axisOf(items).tol
  return rawHandles(items).flatMap((h, i, all) => {
    const it = items[h.item]
    if (h.given || it.start === undefined || it.end === undefined) return [h]
    if (yearsBetween(it.start, it.end) >= 3 * tol) return [h]
    if (h.part === 'start') return [{ ...h, key: `e${h.item}`, part: 'point' as const }]
    void all; void i
    return []
  })
}

/** Tick years (astronomical) at multiples of `step` in the historic count, skipping the year that does not exist. */
function ticksFor(from: number, to: number, step: number): number[] {
  const out: number[] = []
  const hFrom = toHist(from)
  const hTo = toHist(to)
  for (let k = Math.floor(hFrom / step); k <= Math.ceil(hTo / step); k++) {
    const h = k * step
    if (h === 0) continue
    const a = toAstro(h)
    if (a >= from && a <= to) out.push(a)
  }
  return out
}

// ---- deterministic lane order (never the order of the dates) -----------------------------------------------------

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}
/** Lane order: by a hash of the name, nudged if it happens to run oldest-first or newest-first. */
export function laneOrder(items: Item[]): number[] {
  const idx = items.map((_, i) => i)
  const when = (i: number) => toAstro(items[i].year ?? items[i].start ?? 0)
  idx.sort((a, b) => hash(items[a].name) - hash(items[b].name) || a - b)
  const chrono = [...idx].sort((a, b) => when(a) - when(b))
  const same = idx.every((v, k) => v === chrono[k])
  const rev = idx.every((v, k) => v === chrono[chrono.length - 1 - k])
  if ((same || rev) && idx.length > 2) { const first = idx.shift() as number; idx.splice(1, 0, first) }
  return idx
}

// ---- place task ---------------------------------------------------------------------------------------------------

export function movable(items: Item[]): Handle[] {
  return handlesOf(items).filter((h) => !h.given)
}

export const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export function placeMiss(h: Handle, placed: number | undefined): number | null {
  return placed === undefined ? null : placed - h.year
}

// ---- overlap task -------------------------------------------------------------------------------------------------

export const running = (items: Item[], astroYear: number): number[] =>
  items.flatMap((it, i) => (it.start !== undefined && it.end !== undefined && astroYear >= toAstro(it.start) && astroYear <= toAstro(it.end) ? [i] : []))

export function targetSet(spans: Item[], together: string[]): number[] {
  const names = together.map(slug)
  return spans.flatMap((s, i) => (names.includes(slug(s.name)) ? [i] : []))
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** The astronomical years in [from,to] when exactly the named spans were running, as [first, last] runs. */
export function windowsOf(spans: Item[], together: string[]): [number, number][] {
  const ax = axisOf(spans)
  const want = targetSet(spans, together)
  const cuts = new Set<number>([ax.from, ax.to + 1])
  for (const h of rawHandles(spans)) { cuts.add(h.part === 'end' ? h.year + 1 : h.year) }
  const pts = [...cuts].filter((p) => p >= ax.from && p <= ax.to + 1).sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (let k = 0; k < pts.length - 1; k++) {
    const lo = pts[k]
    const hi = pts[k + 1] - 1
    if (!sameSet(running(spans, lo), want)) continue
    const last = runs[runs.length - 1]
    if (last && last[1] + 1 === lo) last[1] = hi
    else runs.push([lo, hi])
  }
  return runs
}

export function overlapSolution(spans: Item[], together: string[]): number {
  const runs = windowsOf(spans, together)
  const best = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a), runs[0] ?? [axisOf(spans).from, axisOf(spans).from])
  return Math.floor((best[0] + best[1]) / 2)
}

export const namesText = (items: Item[], idx: number[]) => {
  const n = idx.map((i) => items[i].name)
  return n.length === 0 ? 'nothing' : n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

/** What the learner made, in words, once marked. */
export function madePlace(items: Item[], at: Record<string, number> | undefined, plainAxis: boolean): string[] {
  const out: string[] = []
  for (const h of movable(items)) {
    const placed = at?.[h.key]
    const it = items[h.item]
    const what = h.part === 'point' ? it.name : `the ${h.part} of ${it.name}`
    if (placed === undefined) { out.push(`${it.name} is not on the line yet.`); continue }
    const miss = placed - h.year
    const tolOf = axisOf(items).tol
    if (Math.abs(miss) <= tolOf) continue
    out.push(`You put ${what} ${plural(Math.abs(miss))} too ${miss < 0 ? 'early' : 'late'}; it was ${fmtYear(toHist(h.year), plainAxis)}.`)
  }
  return out
}

export function workingPlace(items: Item[], plainAxis: boolean): string {
  const rows = items.map((it) => it.year !== undefined
    ? { when: toAstro(it.year), text: `${it.name}, ${fmtYear(it.year, plainAxis)}` }
    : { when: toAstro(it.start as number), text: `${it.name}, ${fmtYear(it.start as number, plainAxis)} to ${fmtYear(it.end as number, plainAxis)} (${plural(yearsBetween(it.start as number, it.end as number))})` })
  rows.sort((a, b) => a.when - b.when)
  return rows.map((r) => r.text).join('; ') + '.'
}

export function madeOverlap(spans: Item[], year: number, plainAxis: boolean): string {
  const r = running(spans, year)
  return `In ${fmtYear(toHist(year), plainAxis)} ${r.length === 0 ? 'none of them was running' : r.length === 1 ? `only ${namesText(spans, r)} was running` : `${namesText(spans, r)} were running`}.`
}
export function workingOverlap(config: Extract<TimelineConfig, { task: 'overlap' }>, year: number, plainAxis: boolean): string {
  const r = running(config.spans, year)
  return `In ${fmtYear(toHist(year), plainAxis)}, ${namesText(config.spans, r)} ${r.length === 1 ? 'was' : 'were'} all running at once.`
}

// ---- reading what the tutor wrote ---------------------------------------------------------------------------------

/** A year as the tutor may write it: -44, "44 BCE", "44 BC", "1066", "AD 1066", "c. 1066 CE". Returns null when unreadable. */
export function readYear(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let s = v.trim().toLowerCase().replace(/[.,]/g, '').replace(/^(c|ca|circa|about|around)\s+/, '').replace(/^(c|ca)(?=\d)/, '')
  s = s.replace(/\s+/g, ' ')
  let m = /^(\d+)\s*(bce|bc|b c e|before common era|before christ)$/.exec(s)
  if (m) return -Number(m[1])
  m = /^(\d+)\s*(ce|ad|a d|c e|common era)$/.exec(s)
  if (m) return Number(m[1])
  m = /^(ad|ce)\s*(\d+)$/.exec(s)
  if (m) return Number(m[2])
  m = /^(bc|bce)\s*(\d+)$/.exec(s)
  if (m) return -Number(m[2])
  m = /^-?\d+$/.exec(s)
  return m ? Number(s) : null
}

/** Every disc starts spread across the axis, each well away from its own date, so a move is always a visible change. */
export function startAt(items: Item[]): Record<string, number> {
  const ax = axisOf(items)
  const at: Record<string, number> = {}
  const FR = [0.12, 0.5, 0.82, 0.3, 0.68, 0.2, 0.9, 0.4]
  const hs = movable(items)
  const lane = laneOrder(items)
  for (const h of hs) {
    const row = lane.indexOf(h.item)
    const mates = hs.filter((m) => m.item === h.item)
    const off = h.part === 'end' ? 0.2 : 0
    let pick = ax.from
    for (let k = 0; k < FR.length; k++) {
      const f = FR[(row + k) % FR.length]
      const y = Math.round(ax.from + clamp01(f + off) * ax.span)
      if (mates.every((m) => Math.abs(y - m.year) > 2 * ax.tol)) { pick = y; break }
      pick = y
    }
    if (!mates.every((m) => Math.abs(pick - m.year) > 2 * ax.tol)) {
      // None of the usual spots clears it: take the spot on the axis farthest from this item's own dates.
      let far = -1
      for (let k = 0; k <= 60; k++) {
        const y = Math.round(ax.from + (k / 60) * ax.span)
        const d = Math.min(...mates.map((m) => Math.abs(y - m.year)))
        if (d > far) { far = d; pick = y }
      }
    }
    at[h.key] = pick
  }
  return at
}

const clamp01 = (v: number) => Math.max(0.04, Math.min(0.96, v))
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = first(o, ['name', 'label', 'event', 'title'])
  if (typeof name !== 'string' || !name.trim()) return null
  const given = first(o, ['given', 'anchor', 'fixed', 'shown']) === true
  const sRaw = first(o, ['start', 'begin', 'from', 'began'])
  const eRaw = first(o, ['end', 'finish', 'to', 'ended'])
  if (sRaw !== undefined || eRaw !== undefined) {
    const start = readYear(sRaw)
    const end = readYear(eRaw)
    return start === null || end === null ? null : { name: name.trim(), start, end, given }
  }
  const year = readYear(first(o, ['year', 'date', 'when', 'at']))
  return year === null ? null : { name: name.trim(), year, given }
}

function readList(v: unknown): Item[] | null {
  if (!Array.isArray(v)) return null
  const items = v.map(readItem)
  return items.every((x): x is Item => x !== null) ? (items as Item[]) : null
}

// ---- the engine ---------------------------------------------------------------------------------------------------

/** Two events the learner could swap and still pass: like with like (start with start, end with end), within one tolerance. */
export function closePair(items: Item[]): [Handle, Handle] | null {
  const ax = axisOf(items)
  const hs = handlesOf(items).filter((h) => !h.given)
  const kind = (h: Handle) => (h.part === 'end' ? 'end' : 'start')
  for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) {
    if (hs[a].item !== hs[b].item && kind(hs[a]) === kind(hs[b]) && Math.abs(hs[a].year - hs[b].year) <= ax.tol) return [hs[a], hs[b]]
  }
  return null
}
/** A date for the later of the pair that does work, found by trying: "Printing press 1500 CE". */
function suggestApart(items: Item[], pair: [Handle, Handle]): string | null {
  const later = pair[0].year >= pair[1].year ? pair[0] : pair[1]
  const it = items[later.item]
  const base = it.year ?? it.start
  if (base === undefined) return null
  const span = axisOf(items).span
  for (let k = 1; k <= 40; k++) {
    const d = Math.max(1, Math.round((span * k) / 20))
    const hist = toHist(toAstro(base) + d)
    const moved = items.map((x, i) => i !== later.item ? x : x.year !== undefined ? { ...x, year: hist } : { ...x, start: hist, end: toHist(toAstro(x.end as number) + d) })
    if (!closePair(moved) && BADYEAR(moved[later.item], hist) === null) return `${it.name} in ${fmtYear(hist, true)}`
  }
  return null
}
export const suggestionFor = suggestApart

const BADYEAR = (it: Item, y: number) => y === 0 ? `${it.name}: there is no year 0 (1 BCE is followed by 1 CE) -- write 1 CE or 1 BCE, e.g. "1 BCE".`
  : !Number.isInteger(y) ? `${it.name}: write years as whole numbers, e.g. 1066 or "44 BCE".`
  : Math.abs(y) > YEAR_LIMIT ? `${it.name}: ${y} is beyond what this timeline draws (${numText(YEAR_LIMIT)} years either side of 1 CE): use e.g. 10000 BCE or 3 million years ago written as -3000000.`
  : null

export const timelineEngine: SceneEngine<TimelineConfig, TimelineState> = {
  id: 'timeline',
  // Distinctive topics only. "time", "date" and "period" alone would catch a period in physics and a time on a graph,
  // so the everyday words go in `phrases`, matched whole.
  covers: ['chronology', 'timeline', 'timelines', 'dynasty', 'dynasties', 'reign', 'reigns', 'medieval', 'renaissance', 'prehistory'],
  // A war's causes are a chain, not a line: cause-chain is for those.
  notFor: ['causes of', 'reasons for', 'why did', 'consequences of', 'effects of', 'impact of'],
  phrases: [
    'ancient greeks', 'ancient egyptians', 'ancient romans', 'ancient civilisations', 'ancient civilizations', 'ancient china', 'ancient india', 'empires rise', 'rise and fall',
    'time line', 'time lines', 'historical periods', 'historical period', 'historical events', 'key events', 'key dates', 'important dates',
    'sequence of events', 'order of events', 'events in order', 'cold war', 'world war', 'first world war', 'second world war', 'world war one', 'world war two',
    'the industrial revolution', 'the french revolution', 'the russian revolution', 'the roman empire', 'ancient egypt', 'ancient greece', 'ancient rome',
    'the middle ages', 'the stone age', 'the bronze age', 'the iron age', 'the tudors', 'the stuarts', 'the victorians', 'the slave trade', 'the scramble for africa',
    'independence movements', 'the british empire', 'the history of', 'history of art', 'development of art', 'art through the ages', 'through the ages',
    'geological time', 'geologic time', 'evolution of life', 'history of the earth', 'history of computing', 'history of computers', 'how long ago',
  ],
  // The learner places a date on a true scale, or moves a year-line to see who overlapped.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const kind = String(first(o, ['task', 'kind']) ?? '').trim().toLowerCase()
    if (['place', 'placing', 'order', 'dates'].includes(kind)) {
      const items = readList(first(o, ['events', 'items', 'dates']))
      return items ? { task: 'place', items } : null
    }
    if (['overlap', 'overlaps', 'overlapping', 'span', 'spans', 'together'].includes(kind)) {
      const spans = readList(first(o, ['spans', 'reigns', 'items', 'events']))
      const t = first(o, ['together', 'who', 'overlapping', 'at_once', 'during'])
      const together = Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string').map((x) => x.trim()) : typeof t === 'string' ? [t.trim()] : null
      return spans && together ? { task: 'overlap', spans, together } : null
    }
    return null
  },

  faults(config) {
    const out: string[] = []
    const items = config.task === 'place' ? config.items : config.spans
    const hs = handlesOf(items)
    const slugs = items.map((i) => slug(i.name))
    items.forEach((it, i) => {
      if (slugs.indexOf(slugs[i]) !== i) out.push(`"${it.name}" is listed twice: give each its own name.`)
      if (it.name.length > NAME_MAX) out.push(`"${it.name}" is ${it.name.length} characters: names are at most ${NAME_MAX} so they fit on the card (e.g. "Battle of Hastings").`)
      for (const y of [it.year, it.start, it.end]) if (y !== undefined) { const b = BADYEAR(it, y); if (b && !out.includes(b)) out.push(b) }
      if (it.start !== undefined && it.end !== undefined && it.end <= it.start && BADYEAR(it, it.start) === null && BADYEAR(it, it.end) === null && toAstro(it.end) <= toAstro(it.start)) {
        out.push(`${it.name} ends (${it.end}) before or when it starts (${it.start}): give the start year first and a later end year.`)
      }
    })
    if (out.length) return out

    if (config.task === 'place') {
      const n = items.length
      if (n < ITEMS_MIN) return [`a timeline needs at least ${ITEMS_MIN} events; give 3 or 4 (e.g. Magna Carta 1215, Black Death 1348).`]
      if (n > PLACE_MAX) return [`${n} events is more than the board holds (${PLACE_MAX}): keep ${PLACE_MAX} or fewer, and split the rest across cards.`]
      if (!items.some((i) => !i.given)) return ['every event is given, so there is nothing to place: leave at least one without "given".']
      if (!items.some((i) => i.given)) {
        // Allowed (the lesson may have taught the dates), but with no anchor the learner is guessing a scale: say so only when it cannot be read at all.
      }
      const ax = axisOf(items)
      const hy = handlesOf(items).map((h) => h.year)
      const range = Math.max(...hy) - Math.min(...hy)
      if (range < MIN_RANGE) return [`all these dates fall within ${plural(range)}, too close to tell apart on a timeline: spread them over at least ${plural(MIN_RANGE)}, e.g. Magna Carta 1215 and Black Death 1348.`]
      const pair = closePair(items)
      if (pair) {
        const [x, y] = pair
        const fix = suggestApart(items, pair)
        out.push(`${items[x.item].name} and ${items[y.item].name} ${x.part === 'end' ? 'end' : 'begin'} only ${plural(Math.abs(x.year - y.year))} apart, but this timeline is ${plural(ax.span)} wide, where a drop within ${plural(ax.tol)} counts, so swapping them would still pass. Move one further away${fix ? `, e.g. ${fix}` : ''}, or put them on separate cards.`)
      }
      return out
    }

    // overlap
    const n = items.length
    if (items.some((i) => i.start === undefined)) out.push('every item of an overlap card needs a start and an end year (a reign, a life, a war).')
    if (n < SPAN_MIN || n > SPAN_MAX) out.push(`an overlap card needs ${SPAN_MIN} to ${SPAN_MAX} spans; this has ${n}.`)
    if (out.length) return out
    const want = targetSet(items, config.together)
    const unknown = config.together.filter((t) => !slugs.includes(slug(t)))
    if (unknown.length) return [`together names "${unknown[0]}", which is not one of the spans (${items.map((i) => i.name).join(', ')}): copy a span's name exactly.`]
    if (want.length < 2) return ['together must name at least two spans that ran at the same time.']
    if (want.length >= n) return ['together names every span, so the line would be right almost anywhere: name a smaller group, so that at least one span is left out.']
    const ax = axisOf(items)
    const runs = windowsOf(items, config.together)
    const widest = runs.reduce((m, r) => Math.max(m, r[1] - r[0] + 1), 0)
    if (widest === 0) return [`${namesText(items, want)} were never running at the same time without another one too, so no year is right. Change the dates, or name a different group.`]
    const need = Math.max(1, Math.round(ax.span * 0.04))
    if (widest < need) return [`the years when exactly ${namesText(items, want)} were running last only ${plural(widest)}, too narrow to land on a timeline ${plural(ax.span)} wide (needs ${plural(need)}). Choose spans that overlap for longer.`]
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const items = config.task === 'place' ? config.items : config.spans
    const years = new Set<number>()
    for (const it of items) {
      if (config.task === 'place' && it.given) continue
      for (const y of [it.year, it.start, it.end]) if (y !== undefined) years.add(Math.abs(y))
    }
    for (const y of years) {
      if (new RegExp(`(?<![\\d.,])${y}(?![\\d])`).test(text)) {
        return [config.task === 'place'
          ? `the prompt gives the answer away: it prints ${y}, a date the learner is to place -- say what to do ("Drag each event to when it happened.") and leave the dates to the lesson.`
          : `the prompt gives the answer away: it prints ${y}, a date of one of the spans -- ask for the outcome only ("Move the line to a year when ${config.together.slice(0, 2).join(' and ')} were both running.").`]
      }
    }
    if (config.task === 'overlap' && /\boverlap(?:ped|ping|s)?\s+(?:from|between|in|during)\b/i.test(text)) {
      return ['the prompt says where the spans overlap, which the learner is to find by moving the line -- ask for the outcome only.']
    }
    return []
  },

  initial(config) {
    if (config.task !== 'place') return { year: axisOf(config.spans).from }
    return { at: startAt(config.items) }
  },

  check(config, state) {
    if (config.task === 'place') {
      const ax = axisOf(config.items)
      const wrong = movable(config.items).filter((h) => {
        const p = state?.at?.[h.key]
        return typeof p !== 'number' || !Number.isFinite(p) || Math.abs(p - h.year) > ax.tol
      }).map((h) => h.key)
      return { ok: wrong.length === 0, wrongIds: wrong }
    }
    const y = state?.year
    const ok = typeof y === 'number' && Number.isFinite(y) && sameSet(running(config.spans, y), targetSet(config.spans, config.together))
    return { ok, wrongIds: ok ? [] : ['year'] }
  },

  solve(config) {
    if (config.task === 'place') {
      const at: Record<string, number> = {}
      for (const h of movable(config.items)) at[h.key] = h.year
      return { at }
    }
    return { year: overlapSolution(config.spans, config.together) }
  },

  View: TimelineView,

  prompt: `SCENE "timeline" -- a true-scale time axis, for history and anything where WHEN and HOW LONG matter. Every date comes from your config; the engine draws the scale, so the learner feels how long the gaps are.
  place: one lane for each event, in a shuffled order, with the axis and its years along the bottom. The learner drags each event's disc along its lane to the date it belongs at; a strip under the axis shows the gaps their placements leave, in years. A span (a reign, a war) has two discs, a start and an end, with a bar between them. Every disc starts spread out, away from its date. Events marked "given" are already in place with their date shown, so the learner can place the rest against them. A drop within about 3% of the axis counts as right. A span too short to drag out (a short war) is drawn as one disc at its start and its dates are said at marking. Marking names the dates.
  overlap: bars for 2 to 4 spans (reigns, lives, wars) at their true places, one lane each, and a vertical year line the learner drags along the axis. The bars the line crosses fill in, the others stay pale. The task is to put the line in a year when exactly the spans you name in "together" were running. Marking names who was running in the year the learner chose.
  For: chronology, timelines, dynasties and reigns, historical periods, how long events lasted, who overlapped with whom, the order of eras.
  Years are whole numbers. Write BCE as a negative number or "44 BCE", CE as 1066 or "1066 CE"; there is no year 0. Event names are at most 22 characters. Deep time is fine, down to 5 million years BCE (write -3000000). Never invent a date: use only the ones the lesson gives.
  place: events is 2 to 5 items, each { "name", "year" } or a span { "name", "start", "end" }, with optional "given": true; leave at least one not given. Two events' starts (or two ends) must be more than about 3% of the whole axis apart, so one could not be swapped for the other; spans that touch (one reign ends as the next begins) are fine.
  overlap: spans is 2 to 4 items { "name", "start", "end" }; together names 2 or more of them (not all) that ran at the same time for a good stretch.
  config: { "task":"place", "events":[ {"name":"Magna Carta","year":1215}, {"name":"Black Death","year":1348}, {"name":"Battle of Hastings","year":1066,"given":true}, {"name":"Battle of Agincourt","year":1415} ] }  -- the prompt says "Drag each event to when it happened." (do NOT print its date)
       or { "task":"overlap", "spans":[ {"name":"Henry VIII","start":1509,"end":1547}, {"name":"Francis I","start":1515,"end":1547}, {"name":"Elizabeth I","start":1558,"end":1603} ], "together":["Henry VIII","Francis I"] }  -- the prompt says "Move the line to a year when Henry VIII and Francis I were both on the throne." (do NOT say which years)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each event to when it happened.",
    "payload": { "engine":"timeline", "config": { "task":"place", "events":[ {"name":"Magna Carta","year":1215}, {"name":"Black Death","year":1348}, {"name":"Battle of Hastings","year":1066,"given":true}, {"name":"Battle of Agincourt","year":1415} ] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:timeline", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Move the line to a year when Henry VIII and Francis I were both on the throne.",
    "payload": { "engine":"timeline", "config": { "task":"overlap", "spans":[ {"name":"Henry VIII","start":1509,"end":1547}, {"name":"Francis I","start":1515,"end":1547}, {"name":"Elizabeth I","start":1558,"end":1603} ], "together":["Henry VIII","Francis I"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:timeline", "why":"..." } }`,
}

registerEngine(timelineEngine as SceneEngine<unknown, unknown>)
