// lib/studylab/engines/map-reader/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MapReaderView } from './View'

/**
 * Two map skills a hand can make obvious. Every map here is invented and drawn flat.
 *
 * grid: a plain map of an invented village, six squares by six, with eight named places. Grid lines are
 * numbered along the bottom (20 to 26) and up the left side (60 to 66). The learner puts a cursor on a square,
 * by tapping, dragging or the arrow keys; a blue line (the "along" line) and an orange line (the "up" line)
 * run out from the square's bottom-left corner to the numbers on the edges, so the four-figure reference
 * builds itself as they move: along the corridor first, then up the stairs. The reference of a square is the
 * number of the line on its left (eastings) then the number of the line along its bottom (northings).
 *   ask "place": the card names a place; the learner finds its square.
 *   ask "square": the scene shows the reference to find; the learner finds the square it names.
 *
 * cross-section: a hill drawn with contour lines every 20 m (invented, not a real place). A straight line
 * from A to B passes through the summit and turns in 30 degree steps; the ground along it is drawn beneath,
 * rising and falling as the line turns. The task is to turn the line to the steepest or the gentlest
 * profile. Steep ground is where the contours crowd together; the hill is lopsided on purpose, because the
 * common misconceptions are that hills are round and that close contours mean flat land.
 *
 * Source for the rules: the four-figure grid reference convention (eastings first, then northings, the
 * reference being that of the square's south-west corner), and contour interpretation as taught on the
 * Cambridge IGCSE / O Level Geography map-skills syllabus (0460/2217) and GCSE specifications. The hill is a
 * cosine bump, height = H (1 + cos(pi u)) / 2 with u the lopsided elliptical radius, so every contour is
 * known exactly (u = acos(2L/H - 1) / pi). One pixel on the map is 10 m. Slopes are rise over run in metres.
 */

export const TASKS = ['grid', 'cross-section'] as const
export type Task = (typeof TASKS)[number]
export type Ask = 'place' | 'square'
export type Goal = 'steepest' | 'gentlest'

// ---------------------------------------------------------------------------
// The grid map.

export const COLS = 6
export const ROWS = 6
export const EAST0 = 20
export const NORTH0 = 60

export const PLACE_IDS = ['church', 'school', 'farm', 'station', 'mill', 'pond', 'shop', 'quarry'] as const
/** Where each place sits: col from the left, row from the bottom, both from 0. No two share a square. */
export const PLACES: Record<string, { col: number; row: number }> = {
  church: { col: 1, row: 4 },
  school: { col: 4, row: 5 },
  farm: { col: 0, row: 2 },
  station: { col: 5, row: 3 },
  mill: { col: 2, row: 2 },
  pond: { col: 4, row: 1 },
  shop: { col: 3, row: 3 },
  quarry: { col: 1, row: 0 },
}

export const easting = (col: number) => EAST0 + col
export const northing = (row: number) => NORTH0 + row
export const refOf = (col: number, row: number) => `${easting(col)}${northing(row)}`
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const inGrid = (col: unknown, row: unknown): boolean =>
  typeof col === 'number' && typeof row === 'number' && Number.isInteger(col) && Number.isInteger(row) &&
  col >= 0 && col < COLS && row >= 0 && row < ROWS

export const placeAt = (col: number, row: number): string | null =>
  PLACE_IDS.find((id) => PLACES[id].col === col && PLACES[id].row === row) ?? null

// ---------------------------------------------------------------------------
// The hill.

export const HILLS = ['steep-north', 'steep-south', 'steep-east', 'steep-west', 'ridge-ew', 'ridge-ns'] as const
export const GOALS: Goal[] = ['steepest', 'gentlest']
export const DIRS = 6
export const STEP = 30
export const HMAX = 120
export const INTERVAL = 20
export const METRES_PER_PX = 10
export const RADIUS = 140

/** Semi-axes in map pixels, to the west, east, north and south of the summit. */
const AXES: Record<string, { aw: number; ae: number; bn: number; bs: number }> = {
  'steep-north': { aw: 110, ae: 110, bn: 55, bs: 110 },
  'steep-south': { aw: 110, ae: 110, bn: 110, bs: 55 },
  'steep-east': { aw: 110, ae: 55, bn: 110, bs: 110 },
  'steep-west': { aw: 55, ae: 110, bn: 110, bs: 110 },
  'ridge-ew': { aw: 130, ae: 130, bn: 60, bs: 60 },
  'ridge-ns': { aw: 60, ae: 60, bn: 130, bs: 130 },
}
export const axesOf = (hill: string) => AXES[hill]

/** Height in metres at (dx, dy) pixels from the summit, dy up the page (north). */
export function heightAt(hill: string, dx: number, dy: number): number {
  const a = AXES[hill]
  const u = Math.hypot(dx / (dx < 0 ? a.aw : a.ae), dy / (dy < 0 ? a.bs : a.bn))
  return u >= 1 ? 0 : (HMAX * (1 + Math.cos(Math.PI * u))) / 2
}

/** The contour heights drawn. */
export const LEVELS = Array.from({ length: HMAX / INTERVAL - 1 }, (_, i) => (i + 1) * INTERVAL)
export const uOfLevel = (level: number) => Math.acos((2 * level) / HMAX - 1) / Math.PI

/** A point on the contour of `level`, in the direction `theta` (degrees, anticlockwise from east), relative to the summit, dy up. */
export function contourPoint(hill: string, level: number, theta: number): { dx: number; dy: number } {
  const a = AXES[hill]
  const c = Math.cos((theta * Math.PI) / 180)
  const s = Math.sin((theta * Math.PI) / 180)
  const ax = c < 0 ? a.aw : a.ae
  const by = s < 0 ? a.bs : a.bn
  const rho = 1 / Math.hypot(c / ax, s / by)
  const u = uOfLevel(level)
  return { dx: u * rho * c, dy: u * rho * s }
}

/** The ground along a line through the summit pointing `phi` degrees from east: heights from end A (s = -RADIUS) to end B. */
export function profileOf(hill: string, phi: number, stepPx = 4): { s: number; h: number }[] {
  const c = Math.cos((phi * Math.PI) / 180)
  const sn = Math.sin((phi * Math.PI) / 180)
  const out: { s: number; h: number }[] = []
  for (let s = -RADIUS; s <= RADIUS + 1e-9; s += stepPx) out.push({ s, h: heightAt(hill, s * c, s * sn) })
  return out
}

/** The steepest part of the ground along a line: rise over run, and which end of the line it is nearer. */
export function steepestOf(hill: string, phi: number): { grad: number; end: 'A' | 'B' } {
  const p = profileOf(hill, phi, 1)
  let grad = 0
  let end: 'A' | 'B' = 'A'
  for (let i = 1; i < p.length; i++) {
    const g = Math.abs(p[i].h - p[i - 1].h) / METRES_PER_PX
    if (g > grad + 1e-12) { grad = g; end = p[i].s < 0 ? 'A' : 'B' }
  }
  return { grad, end }
}
export const degreesOf = (grad: number) => Math.round((Math.atan(grad) * 180) / Math.PI)

export const gradOfDir = (hill: string, dir: number) => steepestOf(hill, dir * STEP).grad

/** The directions that meet the goal: all that tie, so a symmetrical hill never has a wrong answer. */
export function goodDirs(hill: string, goal: string): number[] {
  if (!AXES[hill]) return []
  const g = Array.from({ length: DIRS }, (_, d) => gradOfDir(hill, d))
  const best = goal === 'gentlest' ? Math.min(...g) : Math.max(...g)
  return g.map((v, d) => (Math.abs(v - best) < 1e-6 ? d : -1)).filter((d) => d >= 0)
}

export const COMPASS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']
export const compassOf = (deg: number) => COMPASS[((Math.round(deg / 45) % 8) + 8) % 8]

export type MapReaderConfig =
  | { task: 'grid'; place: string; ask: Ask }
  | { task: 'cross-section'; hill: string; goal: Goal }

/** col, row: the cursor's square. dir: which of the six lines through the summit. */
export type MapReaderState = { col?: number; row?: number; dir?: number }

// ---------------------------------------------------------------------------
// What the scene says once marked.

export function gridWorking(place: string, col: number, row: number): string {
  const t = PLACES[place]
  if (t && t.col === col && t.row === row) {
    return `Square ${refOf(col, row)}: along ${easting(col)}, then up ${northing(row)}. That is the ${place}.`
  }
  return ''
}

export function madeGrid(config: Extract<MapReaderConfig, { task: 'grid' }>, col: number, row: number): string {
  const here = placeAt(col, row)
  const t = PLACES[config.place]
  const made = `You put the cursor on square ${refOf(col, row)}: along ${easting(col)}, then up ${northing(row)}.`
  const holds = here ? ` That square holds the ${here}.` : ' That square is open ground.'
  const want = t ? ` The ${config.place} is in square ${refOf(t.col, t.row)}.` : ''
  return made + holds + want
}

export function crossWorking(hill: string, dir: number, goal: string): string {
  const { grad, end } = steepestOf(hill, dir * STEP)
  const deg = degreesOf(grad)
  const phi = dir * STEP + (end === 'A' ? 180 : 0)
  if (goal === 'gentlest') {
    return `Along your line the steepest part is only about ${deg} degrees. This line stays where the contours are furthest apart.`
  }
  return `The steepest part of your line is about ${deg} degrees, on the ${compassOf(phi)} side, where the contours are closest together.`
}

export function madeCross(hill: string, dir: number, goal: string): string {
  const { grad } = steepestOf(hill, dir * STEP)
  const deg = degreesOf(grad)
  return goal === 'gentlest'
    ? `You made a line whose steepest part is about ${deg} degrees. Turn it to where the contours stay furthest apart to find a gentler one.`
    : `You made a line whose steepest part is only about ${deg} degrees. Turn it to cross where the contours crowd together to find a steeper one.`
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s_]+/g, '-') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readTask(raw: unknown): Task | null {
  const s = norm(raw)
  if (/contour|cross|section|profile|slope|relief|hill/.test(s)) return 'cross-section'
  if (/grid|reference|square|cursor|locate/.test(s)) return 'grid'
  return null
}

function readHill(raw: unknown): string | null {
  const s = norm(raw)
  if (!s) return null
  if (/^(north|south|east|west)$/.test(s)) return `steep-${s}`
  const m = /^(?:steep-)?(?:on-the-)?(north|south|east|west)(?:ern)?(?:-side|-face|-slope)?$/.exec(s)
  if (m) return `steep-${m[1]}`
  if (/ridge/.test(s)) return /(ns|north)/.test(s) ? 'ridge-ns' : 'ridge-ew'
  return s
}

function readGoal(raw: unknown): Goal | null {
  const s = norm(raw)
  if (/steep|most|max|highest/.test(s)) return 'steepest'
  if (/gentl|flat|shallow|easy|least|min|lowest/.test(s)) return 'gentlest'
  return null
}

export const mapReaderEngine: SceneEngine<MapReaderConfig, MapReaderState> = {
  id: 'map-reader',
  // Distinctive words only: "map", "scale" and "grid" alone would catch hash maps, model scales and grid computing.
  covers: ['topographic', 'topographical', 'cartography', 'eastings', 'northings'],
  phrases: [
    'contours', 'contour lines', 'contour line', 'contour map', 'contour maps', 'contour interval', 'contour intervals',
    'map skills', 'map reading', 'map reading skills', 'map work', 'reading maps', 'reading a map', 'using maps', 'using a map',
    'elements of a map', 'parts of a map', 'features of a map', 'types of maps', 'ordnance survey', 'topo maps',
    'grid reference', 'grid references', 'four figure grid references', 'four figure grid reference',
    'six figure grid references', 'six figure grid reference', '4 figure grid references', '6 figure grid references',
    'map grid', 'grid squares', 'compass directions', 'compass points', 'relief map', 'relief maps', 'physical maps',
    'steep and gentle slopes', 'gradient on maps', 'relief and slopes', 'cross sections of hills', 'cross section of a hill',
  ],
  // The learner puts a cursor on a square, or turns a line through a hill.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const task = readTask(first(o, ['task', 'kind', 'type', 'mode']))
    if (!task) return null
    if (task === 'grid') {
      const p = norm(first(o, ['place', 'target', 'feature', 'find']))
      const place = p.replace(/^the-/, '')
      if (!place) return null
      const ask: Ask = /square|ref|number|figure/.test(norm(first(o, ['ask', 'from', 'given']))) ? 'square' : 'place'
      return { task, place, ask }
    }
    const hill = readHill(first(o, ['hill', 'shape', 'landform', 'relief']))
    const goal = readGoal(first(o, ['goal', 'find', 'profile', 'target', 'slope']))
    return hill === null || goal === null ? null : { task, hill, goal }
  },

  faults(config) {
    if (config.task === 'grid') {
      return PLACES[config.place]
        ? []
        : [`place "${config.place}" is not on the map. Use one of: ${PLACE_IDS.join(', ')}, e.g. place church.`]
    }
    const out: string[] = []
    if (!AXES[config.hill]) out.push(`hill "${config.hill}" is not one of the hills drawn. Use one of: ${HILLS.join(', ')}, e.g. hill steep-west.`)
    if (!GOALS.includes(config.goal)) out.push(`goal "${config.goal}" must be steepest or gentlest, e.g. goal steepest.`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    if (config.task === 'grid') {
      const t = PLACES[config.place]
      if (!t) return []
      const e = String(easting(t.col))
      const n = String(northing(t.row))
      const out: string[] = []
      if (new RegExp(`(?<!\\d)(?:${e}|${n}|${e}${n})(?!\\d)`).test(text)) {
        out.push('the prompt gives the answer away: it prints a grid line number or the reference, which the learner is to read off the map -- ask only for the place, e.g. "Put the cursor on the church."')
      }
      if (config.ask === 'square' && new RegExp(`\\b${config.place}\\b`, 'i').test(text)) {
        out.push('the prompt names the place whose reference the card shows, so the learner would not need the reference -- say "Move the cursor onto the grid square shown at the top of the card."')
      }
      return out
    }
    const fix = config.goal === 'gentlest'
      ? '"Turn the line so that the ground along it is as gentle as it can be everywhere."'
      : '"Turn the line so that the ground along it is as steep as it can be somewhere."'
    const compass = /\b(?:north|south|east|west|north-?east|north-?west|south-?east|south-?west|n-s|e-w)\b/i.test(text)
    const rule = /\b(?:close(?:r)?|crowd\w*|squeez\w*|tight\w*|narrow\w*|wide\w*|far)\b.{0,30}\b(?:together|apart|spaced|spacing)\b|\b(?:together|apart)\b.{0,30}\bcontours?\b|\bcontours?\b.{0,30}\b(?:together|apart|spaced|spacing)\b/i.test(text)
    return compass || rule
      ? [`the prompt gives the answer away: it names a side of the hill or says how the contours are spaced, which the learner is to find by turning the line -- ask for the outcome only (${fix})`]
      : []
  },

  initial(config) {
    if (config.task === 'grid') {
      const t = PLACES[config.place]
      return t && t.col === 2 && t.row === 2 ? { col: 3, row: 3 } : { col: 2, row: 2 }
    }
    const good = goodDirs(config.hill, config.goal)
    const start = [1, 2, 4, 5, 0, 3].find((d) => !good.includes(d))
    return { dir: start ?? 0 }
  },

  check(config, state) {
    if (config.task === 'grid') {
      const t = PLACES[config.place]
      const ok = !!t && inGrid(state?.col, state?.row) && state.col === t.col && state.row === t.row
      return { ok, wrongIds: ok ? [] : ['cursor'] }
    }
    const d = state?.dir
    const ok = typeof d === 'number' && Number.isInteger(d) && d >= 0 && d < DIRS && goodDirs(config.hill, config.goal).includes(d)
    return { ok, wrongIds: ok ? [] : ['line'] }
  },

  solve(config) {
    if (config.task === 'grid') {
      const t = PLACES[config.place] ?? { col: 0, row: 0 }
      return { col: t.col, row: t.row }
    }
    return { dir: goodDirs(config.hill, config.goal)[0] ?? 0 }
  },

  View: MapReaderView,

  prompt: `SCENE "map-reader" -- two map skills with the hand. Every map is invented and drawn flat. The engine draws, computes and marks.
  grid: a 6 by 6 map of an invented village with eight named places (church, school, farm, station, mill, pond, shop, quarry), each labelled on its
    own square. Grid lines are numbered along the bottom and up the left side. The learner taps, drags or uses the arrow keys to put a cursor on a
    square. As the cursor moves, a blue line ("along") and an orange line ("up") run from the square's corner out to the numbers on the edges, so
    the four-figure reference builds itself on the map. Marking says the reference and the place.
    ask "place" (default): your prompt names a place; the learner finds its square. ask "square": the card prints a reference at the top and the
    learner finds the square it names (the prompt must not name the place).
  cross-section: a lopsided hill drawn with contour lines every 20 m, a straight line A to B through the summit, and the ground along the line drawn
    beneath. The learner turns the line (drag on the map, or the arrow keys on the B handle) in six steps; the profile below rises and falls as
    it turns. The task is to turn the line to the steepest or the gentlest ground. Marking says the steepest slope in degrees and where the
    contours are closest.
  For: map skills, grid references, four figure grid references, contour lines, cross sections of hills, steep and gentle slopes, reading maps.
  grid: place is one of church, school, farm, station, mill, pond, shop, quarry; ask is "place" or "square".
  cross-section: hill is steep-north, steep-south, steep-east, steep-west (that side of the hill is the steep one; the others gentle), ridge-ew or
    ridge-ns (a long ridge running that way, steep on its long sides); goal is "steepest" or "gentlest".
    Do not say in the prompt which side is steep or how the contours are spaced; do not print a grid line number or the reference.
  config: { "task":"grid", "place":"church", "ask":"place" }  -- the prompt says "Put the cursor on the church." (do NOT print any grid number)
       or { "task":"grid", "place":"mill", "ask":"square" }  -- the prompt says "Move the cursor onto the grid square shown at the top of the card." (do NOT name the place)
       or { "task":"cross-section", "hill":"steep-west", "goal":"steepest" }  -- the prompt says "Turn the line so that the ground along it is as steep as it can be somewhere." (do NOT name a side)
       or { "task":"cross-section", "hill":"ridge-ew", "goal":"gentlest" }  -- the prompt says "Turn the line so that the ground along it is as gentle as it can be everywhere."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Put the cursor on the church.",
    "payload": { "engine":"map-reader", "config": { "task":"grid", "place":"church", "ask":"place" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:map-reader", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Move the cursor onto the grid square shown at the top of the card.",
    "payload": { "engine":"map-reader", "config": { "task":"grid", "place":"mill", "ask":"square" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:map-reader", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Turn the line so that the ground along it is as steep as it can be somewhere.",
    "payload": { "engine":"map-reader", "config": { "task":"cross-section", "hill":"steep-west", "goal":"steepest" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:map-reader", "why":"..." } }`,
}

registerEngine(mapReaderEngine as SceneEngine<unknown, unknown>)
