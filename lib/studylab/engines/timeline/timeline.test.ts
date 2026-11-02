// lib/studylab/engines/timeline/timeline.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  timelineEngine as engine, axisOf, fmtYear, handlesOf, laneOrder, numText, overlapSolution, startAt, suggestionFor, closePair, readYear, running, targetSet, toAstro, toHist, windowsOf, yearsBetween,
  type TimelineConfig, type TimelineState,
} from './config'
import { LANE_H, NAME_DY, TOP, TRACK_DY, TimelineView, X0, X1, axisY, xOf } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const place: TimelineConfig = {
  task: 'place',
  items: [
    { name: 'Magna Carta', year: 1215, given: false }, { name: 'Black Death', year: 1348, given: false },
    { name: 'Battle of Hastings', year: 1066, given: true }, { name: 'Battle of Agincourt', year: 1415, given: false },
  ],
}
const overlap: TimelineConfig = {
  task: 'overlap',
  spans: [
    { name: 'Henry VIII', start: 1509, end: 1547, given: false }, { name: 'Francis I', start: 1515, end: 1547, given: false },
    { name: 'Elizabeth I', start: 1558, end: 1603, given: false },
  ],
  together: ['Henry VIII', 'Francis I'],
}

// A small seeded generator, so the property tests are the same every run.
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
const hy = (r: () => number, lo: number, hi: number) => { const y = lo + Math.floor(r() * (hi - lo + 1)); return y === 0 ? 1 : y }

function randomConfigs(count: number): TimelineConfig[] {
  const r = rng(7)
  const out: TimelineConfig[] = []
  for (let k = 0; k < count; k++) {
    const eras: [number, number][] = [[-3000, -200], [-300, 300], [400, 1900], [1700, 2020], [-60, 40]]
    const [lo, hi] = eras[k % eras.length]
    if (k % 2 === 0) {
      const n = 2 + Math.floor(r() * 4)
      const items = Array.from({ length: n }, (_, i) => {
        if (r() < 0.25) { const s = hy(r, lo, hi); return { name: NAMES[i], start: s, end: s + 1 + Math.floor(r() * (hi - lo) / 3 + 1), given: i === 0 } }
        return { name: NAMES[i], year: hy(r, lo, hi), given: i === 0 }
      })
      out.push({ task: 'place', items })
    } else {
      const n = 2 + Math.floor(r() * 3)
      const spans = Array.from({ length: n }, (_, i) => { const s = hy(r, lo, hi); return { name: NAMES[i], start: s, end: s + 1 + Math.floor(r() * (hi - lo) / 2 + 1), given: false } })
      const group = NAMES.slice(0, n).filter((_, i) => i < 2 || r() < 0.3)
      out.push({ task: 'overlap', spans, together: group })
    }
  }
  return out
}

describe('the calendar, exactly', () => {
  it('has no year 0: 44 BCE to 14 CE is 57 years, 1 BCE to 1 CE is 1', () => {
    expect(yearsBetween(-44, 14)).toBe(57)
    expect(yearsBetween(-1, 1)).toBe(1)
    expect(yearsBetween(1066, 1215)).toBe(149)
    expect(yearsBetween(-500, -400)).toBe(100)
  })
  it('converts both ways', () => {
    for (const h of [-5000, -44, -1, 1, 476, 2024]) expect(toHist(toAstro(h))).toBe(h)
    expect(toAstro(-1)).toBe(0)
  })
  it('reads years as a tutor writes them', () => {
    expect(readYear('44 BC')).toBe(-44)
    expect(readYear('44 BCE')).toBe(-44)
    expect(readYear('1066 AD')).toBe(1066)
    expect(readYear('AD 476')).toBe(476)
    expect(readYear('c. 1066')).toBe(1066)
    expect(readYear(-300)).toBe(-300)
    expect(readYear('last year')).toBeNull()
    expect(readYear(undefined)).toBeNull()
  })
  it('labels BCE and CE', () => {
    expect(fmtYear(-44, false)).toBe('44 BCE')
    expect(fmtYear(1066, true)).toBe('1066')
    expect(fmtYear(476, false)).toBe('476 CE')
  })
  it('draws a BCE to CE axis with no tick at the year that does not exist', () => {
    const ax = axisOf([{ name: 'A', year: -200, given: false }, { name: 'B', year: 300, given: false }])
    expect(ax.ticks.length).toBeLessThanOrEqual(5)
    for (const t of ax.ticks) expect(toHist(t)).not.toBe(0)
    expect(ax.ticks.every((t) => t >= ax.from && t <= ax.to)).toBe(true)
  })
})

describe('parse', () => {
  it('reads both task kinds and the phrasings around them', () => {
    expect(engine.parse(place)).toEqual(place)
    const p = engine.parse({ task: 'place', events: [{ name: 'Caesar killed', date: '44 BC' }, { label: 'Augustus dies', when: '14 AD', anchor: true }] })!
    expect(p).toMatchObject({ task: 'place' })
    expect((p as Extract<TimelineConfig, { task: 'place' }>).items.map((i) => i.year)).toEqual([-44, 14])
    expect(engine.parse({ task: 'overlap', spans: [{ name: 'A', begin: 1500, finish: 1520 }, { name: 'B', start: 1510, end: 1530 }], who: 'A' })).toMatchObject({ task: 'overlap', together: ['A'] })
  })
  it('returns null for what it cannot read', () => {
    for (const bad of [null, 'x', {}, { task: 'place' }, { task: 'place', events: [{ name: 'A', year: 'soon' }] }, { task: 'overlap', spans: [] }, { task: 'quiz' }]) {
      expect(engine.parse(bad)).toBeNull()
    }
  })
  it('parses what it then refuses, so the writer is told why', () => {
    const c = engine.parse({ task: 'place', events: [{ name: 'A', year: 0 }, { name: 'B', year: 5 }] })!
    expect(engine.faults(c).join(' ')).toMatch(/no year 0/)
  })
})

describe('faults', () => {
  const f = (c: unknown) => engine.faults(engine.parse(c)!)
  it('passes both catalogue examples', () => {
    expect(engine.faults(place)).toEqual([])
    expect(engine.faults(overlap)).toEqual([])
  })
  it('refuses events the learner could swap and still pass, names the scale, and the example it gives works', () => {
    const c = { task: 'place', events: [{ name: 'A', year: 1914 }, { name: 'B', year: 1918 }, { name: 'C', year: 1815, given: true }] }
    const out = f(c)
    expect(out.join(' ')).toMatch(/swapping them would still pass/)
    expect(out.join(' ')).toMatch(/years wide/)
    const its = (engine.parse(c) as Extract<TimelineConfig, { task: 'place' }>).items
    const fix = suggestionFor(its, closePair(its)!)!
    const m = /^(.+) in (\d+)(?: CE)?$/.exec(fix)!
    const events = (c.events as { name: string; year: number; given?: boolean }[]).map((e) => (e.name === m[1] ? { ...e, year: Number(m[2]) } : e))
    expect(f({ task: 'place', events })).toEqual([])
  })
  it('lets ordinary history through: the stations the real tutor was refused on', () => {
    const ok = (events: unknown[]) => expect(f({ task: 'place', events })).toEqual([])
    ok([{ name: 'World War I', start: 1914, end: 1918 }, { name: 'Magna Carta', year: 1215, given: true }, { name: 'French Revolution', year: 1789 }])
    ok([{ name: 'Henry VII', start: 1485, end: 1509 }, { name: 'Henry VIII', start: 1509, end: 1547 }, { name: 'Battle of Hastings', year: 1066, given: true }])
    ok([{ name: 'Henry VIII', start: 1509, end: 1547 }, { name: 'Elizabeth I', start: 1558, end: 1603 }, { name: 'Battle of Hastings', year: 1066, given: true }])
    ok([{ name: 'Black Death', year: 1348 }, { name: 'Peasants Revolt', year: 1381 }, { name: 'Battle of Hastings', year: 1066, given: true }])
    ok([{ name: 'Printing press', year: 1450 }, { name: 'Columbus voyage', year: 1492 }, { name: 'Battle of Hastings', year: 1066, given: true }])
    ok([{ name: 'Stone Age', year: -3000000 }, { name: 'Agriculture begins', year: -10000 }, { name: 'Rome founded', year: -753, given: true }])
  })
  it('a short span is drawn and marked as one point at its start; dates come at marking', () => {
    const c = engine.parse({ task: 'place', events: [{ name: 'World War I', start: 1914, end: 1918 }, { name: 'Magna Carta', year: 1215, given: true }, { name: 'French Revolution', year: 1789 }] })!
    const items = (c as Extract<TimelineConfig, { task: 'place' }>).items
    const hs = handlesOf(items).filter((h) => !h.given)
    expect(hs.map((h) => h.part)).toEqual(['point', 'point'])
    expect(hs[0].year).toBe(1914)
    expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    const html = renderToStaticMarkup(createElement(TimelineView, { config: c, state: engine.solve(c), setState: () => {}, marked: 'right', reduced: false, locked: true }))
    expect(html.replace(/<[^>]*>/g, ' ')).toMatch(/World War I, 1914 to 1918 \(4 years\)/)
  })
  it('deep time: 5 million BCE draws, with labels that read', () => {
    expect(numText(-3000000)).toBe('3 million')
    expect(numText(2500000)).toBe('2.5 million')
    expect(numText(50000)).toBe('50,000')
    expect(fmtYear(-3000000, false)).toBe('3 million BCE')
    const c = engine.parse({ task: 'place', events: [{ name: 'First tools', year: -3000000 }, { name: 'Fire used', year: -1000000 }, { name: 'Agriculture begins', year: -10000, given: true }] })!
    expect(engine.faults(c)).toEqual([])
    expect(axisOf((c as Extract<TimelineConfig, { task: 'place' }>).items).ticks.length).toBeLessThanOrEqual(3)
    expect(engine.faults(engine.parse({ task: 'place', events: [{ name: 'A', year: -6000000 }, { name: 'B', year: 100 }] })!).join(' ')).toMatch(/beyond[^]*e\.g\./)
  })
  it('refuses a missing, impossible or reversed date', () => {
    expect(f({ task: 'place', events: [{ name: 'A', year: 0 }, { name: 'B', year: 100 }] }).join(' ')).toMatch(/year 0/)
    expect(f({ task: 'place', events: [{ name: 'A', year: 1.5 }, { name: 'B', year: 100 }] }).join(' ')).toMatch(/whole/)
    expect(f({ task: 'place', events: [{ name: 'A', start: 500, end: 400 }, { name: 'B', year: 900 }] }).join(' ')).toMatch(/before or when it starts/)
    expect(f({ task: 'place', events: [{ name: 'A', year: 100 }, { name: 'B', year: 9000000 }] }).join(' ')).toMatch(/beyond/)
  })
  it('refuses too few, too many, duplicates, nothing to place, long names', () => {
    expect(f({ task: 'place', events: [{ name: 'A', year: 100 }] }).join(' ')).toMatch(/at least 2/)
    expect(f({ task: 'place', events: [1, 2, 3, 4, 5, 6].map((n) => ({ name: `E${n}`, year: n * 100 })) }).join(' ')).toMatch(/more than the board holds/)
    expect(f({ task: 'place', events: [{ name: 'A', year: 100 }, { name: 'a', year: 900 }] }).join(' ')).toMatch(/twice/)
    expect(f({ task: 'place', events: [{ name: 'A', year: 100, given: true }, { name: 'B', year: 900, given: true }] }).join(' ')).toMatch(/nothing to place/)
    expect(f({ task: 'place', events: [{ name: 'A very very long event name indeed', year: 100 }, { name: 'B', year: 900 }] }).join(' ')).toMatch(/characters/)
  })
  it('refuses overlap cards with no honest answer', () => {
    expect(f({ ...overlap, together: ['Nobody'] }).join(' ')).toMatch(/not one of the spans/)
    expect(f({ ...overlap, together: ['Henry VIII'] }).join(' ')).toMatch(/at least two/)
    expect(f({ ...overlap, together: ['Henry VIII', 'Francis I', 'Elizabeth I'] }).join(' ')).toMatch(/every span/)
    expect(f({ ...overlap, together: ['Henry VIII', 'Elizabeth I'] }).join(' ')).toMatch(/never running at the same time/)
  })
  it('refuses a window too narrow to land on', () => {
    const c = { task: 'overlap', spans: [{ name: 'A', start: 1000, end: 1500 }, { name: 'B', start: 1498, end: 1900 }, { name: 'C', start: 1000, end: 1400 }], together: ['A', 'B'] }
    expect(f(c).join(' ')).toMatch(/too narrow|never running/)
  })
})

describe('marking, by the date itself', () => {
  const ok = (c: TimelineConfig, s: TimelineState) => engine.check(c, s).ok
  it('place: within tolerance is right, outside is wrong, unplaced is wrong', () => {
    const ax = axisOf((place as Extract<TimelineConfig, { task: 'place' }>).items)
    const s = engine.solve(place)
    expect(ok(place, s)).toBe(true)
    const key = Object.keys(s.at!)[0]
    expect(ok(place, { at: { ...s.at, [key]: s.at![key] + ax.tol } })).toBe(true)
    expect(ok(place, { at: { ...s.at, [key]: s.at![key] - ax.tol - 1 } })).toBe(false)
    expect(engine.check(place, { at: { ...s.at, [key]: s.at![key] + ax.tol + 5 } }).wrongIds).toEqual([key])
    expect(ok(place, { at: {} })).toBe(false)
    expect(ok(place, { at: { ...s.at, [key]: NaN } })).toBe(false)
  })
  it('place: the order the tutor listed things in never matters', () => {
    const items = (place as Extract<TimelineConfig, { task: 'place' }>).items
    const rev: TimelineConfig = { task: 'place', items: [...items].reverse() }
    expect(ok(rev, engine.solve(rev))).toBe(true)
    expect(axisOf(items)).toEqual(axisOf([...items].reverse()))
  })
  it('overlap: the set of bars the line crosses must be exactly the named ones', () => {
    expect(ok(overlap, { year: 1530 })).toBe(true)
    expect(ok(overlap, { year: 1512 })).toBe(false) // only Henry
    expect(ok(overlap, { year: 1580 })).toBe(false) // only Elizabeth
    expect(ok(overlap, { year: 1547 })).toBe(true) // ends are inclusive
    expect(ok(overlap, { year: 1548 })).toBe(false)
  })
  it('overlap across BCE and CE counts no year 0', () => {
    const c: TimelineConfig = { task: 'overlap', spans: [{ name: 'A', start: -50, end: -1, given: false }, { name: 'B', start: 1, end: 60, given: false }, { name: 'C', start: -40, end: 30, given: false }], together: ['A', 'C'] }
    expect(engine.faults(c)).toEqual([])
    // A is 50 BCE..1 BCE = astro -49..0, B starts at astro 1: they touch but never share a year.
    expect(running(c.task === 'overlap' ? c.spans : [], 0)).toEqual([0, 2])
    expect(running(c.task === 'overlap' ? c.spans : [], 1)).toEqual([1, 2])
    expect(engine.check(c, engine.solve(c)).ok).toBe(true)
  })
})

describe('every valid config starts unsolved and can be solved', { timeout: 30_000 }, () => {
  const all = randomConfigs(2000).map((c) => ({ c, faults: engine.faults(c) }))
  const valid = all.filter((x) => x.faults.length === 0).map((x) => x.c)

  it('enough of the generated configs are valid to mean something, in both tasks and across the era', () => {
    expect(valid.filter((c) => c.task === 'place').length).toBeGreaterThan(60)
    expect(valid.filter((c) => c.task === 'overlap').length).toBeGreaterThan(40)
    const bce = valid.filter((c) => handlesOf(c.task === 'place' ? c.items : c.spans).some((h) => h.year <= 0))
    expect(bce.length).toBeGreaterThan(20)
  })
  it('initial never passes; solve always passes; parse round-trips', () => {
    for (const c of valid) {
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, JSON.stringify(c)).toBe(true)
      expect(engine.parse(JSON.parse(JSON.stringify(c)))).toEqual(c)
    }
  })
  it('place: one tolerance off breaks it; the axis always holds every date with room', () => {
    for (const c of valid) {
      if (c.task !== 'place') continue
      const ax = axisOf(c.items)
      for (const h of handlesOf(c.items)) { expect(h.year).toBeGreaterThan(ax.from); expect(h.year).toBeLessThan(ax.to) }
      const s = engine.solve(c)
      for (const k of Object.keys(s.at!)) {
        expect(engine.check(c, { at: { ...s.at, [k]: s.at![k] + ax.tol + 1 } }).ok).toBe(false)
      }
    }
  })
  it('overlap: the window is wide enough to land on and the solution is inside it', () => {
    for (const c of valid) {
      if (c.task !== 'overlap') continue
      const ax = axisOf(c.spans)
      const runs = windowsOf(c.spans, c.together)
      expect(Math.max(...runs.map((r) => r[1] - r[0] + 1))).toBeGreaterThanOrEqual(Math.max(1, Math.round(ax.span * 0.04)))
      expect(running(c.spans, overlapSolution(c.spans, c.together))).toEqual(targetSet(c.spans, c.together))
    }
  })
  it('no two movable starts (or ends) could be swapped and still pass', () => {
    for (const c of valid) if (c.task === 'place') expect(closePair(c.items)).toBeNull()
  })
  it('every disc starts away from its own date', () => {
    for (const c of valid) {
      if (c.task !== 'place') continue
      const ax = axisOf(c.items)
      const at = startAt(c.items)
      for (const h of handlesOf(c.items).filter((x) => !x.given)) expect(Math.abs(at[h.key] - h.year)).toBeGreaterThan(ax.tol)
    }
  })
})

describe('promptFaults', () => {
  const pf = (c: TimelineConfig, p: string) => engine.promptFaults!(c, p)
  it('lets the outcome be asked and never prints a date the learner is to find', () => {
    expect(pf(place, 'Drag each event to when it happened.')).toEqual([])
    expect(pf(place, 'Place the Battle of Hastings (1066) first.')).toEqual([]) // given, so it is shown anyway
    expect(pf(place, 'Magna Carta was sealed in 1215. Place the rest.')).toHaveLength(1)
    expect(pf(overlap, 'Move the line to a year when Henry VIII and Francis I were both on the throne.')).toEqual([])
    expect(pf(overlap, 'Henry VIII reigned from 1509. Move the line to where he overlapped Francis I.')).toHaveLength(1)
    expect(pf(overlap, 'Find where they overlap from the 1520s.')).toHaveLength(1)
  })
  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]+)",\s*\n\s*"payload": \{ "engine":"timeline", "config": (\{.*\}) \},\s*\n/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const c = engine.parse(JSON.parse(m[2]))!
      expect(c, m[1]).not.toBeNull()
      expect(engine.faults(c), m[1]).toEqual([])
      expect(engine.promptFaults!(c, m[1]), m[1]).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    }
  })
})

describe('the timeline scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'timeline', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: TimelineConfig, state: TimelineState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(TimelineView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('is registered', () => {
    expect(getEngine('timeline')).toBe(engine)
  })

  it('place: before marking there are sliders and no date to place, only the given one and the scale', () => {
    const html = card(place, 'Drag each event to when it happened.')
    expect(html).toContain('role="slider"')
    expect(html).toContain('touch-none')
    const t = text(html)
    for (const hidden of ['1215', '1348', '1415']) expect(t, hidden).not.toContain(hidden)
    expect(t).toContain('1066')
    for (const n of ['Magna Carta', 'Black Death', 'Battle of Agincourt', 'Battle of Hastings']) expect(t).toContain(n)
    expect(html).not.toContain('too early')
  })

  it('overlap: before marking the bars are drawn but nobody says who overlapped', () => {
    const html = card(overlap, 'Move the line to a year when Henry VIII and Francis I were both on the throne.')
    expect(html).toContain('role="slider"')
    const t = text(html)
    expect(t).not.toMatch(/were running|was running|none of them/)
    for (const hidden of ['1509', '1515', '1547', '1558', '1603']) expect(t, hidden).not.toContain(hidden)
  })

  it('names the answer only once marked, and says what the learner made', () => {
    const wrong = text(raw(place, { at: { e0: toAstro(1300), e1: toAstro(1348), e3: toAstro(1415) } }, 'wrong'))
    expect(wrong).toMatch(/You put Magna Carta \d+ years too late; it was 1215/)
    expect(text(raw(place, { at: {} }, 'wrong'))).toMatch(/too (early|late)/)
    const right = text(raw(place, engine.solve(place), 'right'))
    expect(right).toContain('Magna Carta, 1215')
    expect(text(raw(overlap, { year: 1580 }, 'wrong'))).toMatch(/In 1580 only Elizabeth I was running/)
    expect(text(raw(overlap, { year: 1530 }, 'right'))).toMatch(/Henry VIII and Francis I were all running at once|Henry VIII and Francis I were/)
  })

  it('the strip shows the learner\'s own gaps, in years', () => {
    const t = text(raw(place, { at: { e0: toAstro(1215), e1: toAstro(1348) } }, 'idle'))
    expect(t).toMatch(/\d+ years/)
  })

  it('draws a BCE to CE card with labelled eras', () => {
    const c = engine.parse({ task: 'place', events: [{ name: 'Rome founded', year: '753 BCE', given: true }, { name: 'Caesar killed', year: '44 BCE' }, { name: 'Rome falls', year: '476 CE' }] })!
    expect(engine.faults(c)).toEqual([])
    const t = text(raw(c, { at: {} }, 'idle'))
    expect(t).toMatch(/BCE/)
    expect(t).toMatch(/CE/)
    expect(t).not.toContain('Year 0')
  })
})

describe('the picture holds together', () => {
  it('lanes are never in date order, so the layout and tab order give nothing away', () => {
    const r = rng(3)
    for (let k = 0; k < 80; k++) {
      const n = 3 + (k % 3)
      const items = Array.from({ length: n }, (_, i) => ({ name: `${NAMES[i]}${k}`, year: 1000 + i * 100 + Math.floor(r() * 10), given: false }))
      const order = laneOrder(items)
      expect([...order].sort()).toEqual(items.map((_, i) => i).sort())
      expect(order).not.toEqual(items.map((_, i) => i))
      expect(order).not.toEqual(items.map((_, i) => n - 1 - i))
      expect(laneOrder(items)).toEqual(order)
    }
  })
  it('each name sits nearer its own lane than any other, and discs stay inside the axis', () => {
    const lanes = 5
    for (let r = 0; r < lanes; r++) {
      const nameY = TOP + r * LANE_H + NAME_DY
      const dists = Array.from({ length: lanes }, (_, q) => Math.abs(nameY - (TOP + q * LANE_H + TRACK_DY)))
      expect(dists.indexOf(Math.min(...dists))).toBe(r)
    }
    expect(axisY(lanes)).toBeGreaterThan(TOP + (lanes - 1) * LANE_H + TRACK_DY)
    const ax = axisOf((place as Extract<TimelineConfig, { task: 'place' }>).items)
    expect(xOf(ax.from, ax)).toBe(X0)
    expect(xOf(ax.to, ax)).toBe(X1)
  })
  it('tick labels fit: at most five ticks, however wide the axis', () => {
    const r = rng(11)
    for (let k = 0; k < 300; k++) {
      const a = hy(r, -9000, 1800)
      const b = a + 2 + Math.floor(r() * 4000)
      const ax = axisOf([{ name: 'A', year: a, given: false }, { name: 'B', year: b === 0 ? 5 : b, given: false }])
      expect(ax.ticks.length).toBeLessThanOrEqual(5)
      expect(ax.ticks.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for history stations', () => {
    for (const s of ['Medieval England', 'The Roman Empire', 'Timelines of the Cold War', 'Dynasties of ancient China', 'The Renaissance', 'The Industrial Revolution', 'The Middle Ages', 'World War Two', 'Reigns of the Tudors', 'The development of art through the ages', 'Chronology of the 20th century']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "timeline"')
      expect(scenesFor(s).some((e) => e.id === 'timeline'), s).toBe(true)
    }
  })
  it('is not offered where a period or a time means something else', () => {
    for (const s of ['The period of a pendulum', 'Time and distance graphs', 'Date of birth validation', 'The periodic table', 'Time complexity', 'Distance-time graphs', 'Bar charts and pie charts', 'Orbital period', 'Revolutions per minute', 'Time value of money']) {
      expect(scenesFor(s).some((e) => e.id === 'timeline'), s).toBe(false)
    }
  })
})
