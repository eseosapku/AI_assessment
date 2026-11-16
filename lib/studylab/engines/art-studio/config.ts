// lib/studylab/engines/art-studio/config.ts
//
// A painter's table. Free drawing cannot be marked, so the card asks for the two things in a studio that can be:
//   mix    -- a painting of a jug has a bare patch. The learner taps paints on a wooden palette, a dab at a time; each dab
//             swirls into the puddle, and the patch shows the puddle's colour. When the mix is right the seam melts and
//             the patch disappears into the painting. That is how a painter or a restorer judges a colour, by eye;
//   repeat -- a length of cloth is part printed with a carved block. The learner presses the block on the rest of the
//             cloth, carrying the pattern on: a pattern is one motif and one rule, applied again and again.
//
// The paint model. Paint takes light away, so colours are not averaged. Each paint is a reflectance curve over 16 bands from
// 400 to 700 nm, mixed by the single-constant form of Kubelka and Munk (1931): K/S = (1-R)^2 / 2R adds by amount, and
// R = 1 + K/S - sqrt((K/S)^2 + 2 K/S) comes back out. So red and yellow make orange, yellow and blue make green (the one band they
// both reflect), all three go muddy, white makes a tint and black a strong shade, none of it written down as a rule.
// The curves and strengths were fitted by hand to look like school paint; they are not measurements of a named pigment.
// CIE 1931 2-degree observer and illuminant D65, every 20 nm, then the IEC 61966-2-1 sRGB matrix and curve; CIELAB for the eye.
//
// Marking reads only the numbers. A colour match is forgiving, as a good eye is: within MATCH_TOLERANCE in CIELAB is right, with
// the exact mix given ("Near enough"). A print always lands on a half-step crossing of the chalk grid, so it cannot be nearly in place.
//
// Read, and what was taken (ideas only, no code or art):
//   - Mixbox (scrtwpns.com/mixbox): painting software's colours "do not act like real pigments", and Kubelka-Munk is what fixes it.
//     Its code is non-commercial, so it is not used; the 1931 equations are;
//   - Martini, Tombolato and D'Ugo, "Primary colors as a source of possible misconceptions" (Color Culture and Science Journal 11(2)):
//     teachers and fifth-graders alike do not separate the physics of light, the eye and painters' practice. So this card is only paint;
//   - drawpaintacademy.com on muddy colours: mud comes from guessing and losing control of the palette, so the card's wrong answer says
//     which way the mix is off, and wiping the palette is one tap. artistsnetwork.com "6 Crucial Tips": white flattens, and a muddy mix
//     is mended with more of an original colour;
//   - madegooddesigns.com "Repeat Patterns Explained": block, half-drop, brick and mirror, and "never judge from one tile", hence a cloth
//     already part printed;
//   - the misconceptions "all three primaries make black" and "keep adding until it goes muddy": classroom guides (flipeducation.ai lesson
//     pages, seen only in search results, citing no study), so practitioners' lore rather than research.
// Weighed and left out:
//   - one-point perspective: it is a good move (drag a pin and watch every line swing), but it is a pencil-and-ruler idea with its own
//     picture, not this table's. It should be its own card;
//   - free drawing, shading, clay, weaving, lettering: nothing a rule could mark honestly; a colour wheel to fill in: recognition, no act;
//   - mixing light: the `light` engine's science, and the misconception above says not to blur the two.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ArtStudioView } from './View'

// ---------------------------------------------------------------------------
// The paints.

export const PAINTS = ['white', 'yellow', 'red', 'blue', 'black'] as const
export type Paint = (typeof PAINTS)[number]
export type Amounts = Partial<Record<Paint, number>>

/** The most paint the palette holds: enough for every recipe twice over, and never a dead end, since a dab can be taken back. */
export const MAX_DABS = 12
/** How far off, in CIELAB, a good eye still calls a match. At this distance the patch's edge is only just there. */
export const MATCH_TOLERANCE = 10
/** Closer than this, nobody could tell: the mix is simply right. */
export const SPOT_ON = 2

const BANDS = 16
// 400, 420 ... 700 nm.
const CIE_X = [0.01431, 0.13438, 0.3483, 0.2908, 0.09564, 0.0049, 0.06327, 0.2904, 0.5945, 0.9163, 1.0622, 0.8544, 0.4479, 0.1649, 0.0468, 0.0114]
const CIE_Y = [0.0004, 0.004, 0.023, 0.06, 0.139, 0.323, 0.71, 0.954, 0.995, 0.87, 0.631, 0.381, 0.175, 0.061, 0.017, 0.0041]
const CIE_Z = [0.0679, 0.6456, 1.7471, 1.6692, 0.813, 0.272, 0.0782, 0.0203, 0.0039, 0.0017, 0.0008, 0.0002, 0, 0, 0, 0]
const D65 = [82.75, 93.43, 104.86, 117.81, 115.92, 109.35, 104.79, 104.41, 100, 95.79, 90.01, 87.7, 83.7, 80.21, 78.28, 71.61]
const Y_SUM = CIE_Y.reduce((s, y, i) => s + y * D65[i], 0)

// strength: how hard a dab of it pulls the mix. Reflectance by band: red is cool enough to make a purple, the blue reflects a little
// green so that it can make a green with yellow. Black is strong, as black paint is; white tints quickly, as titanium white does.
const PIGMENT: Record<Paint, { strength: number; curve: number[] }> = {
  red: { strength: 0.62, curve: [0.2, 0.17, 0.14, 0.1, 0.06, 0.05, 0.05, 0.06, 0.1, 0.3, 0.66, 0.82, 0.86, 0.88, 0.88, 0.88] },
  yellow: { strength: 1.25, curve: [0.05, 0.04, 0.04, 0.05, 0.08, 0.24, 0.6, 0.82, 0.89, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91] },
  blue: { strength: 0.8, curve: [0.32, 0.46, 0.56, 0.56, 0.47, 0.36, 0.24, 0.14, 0.08, 0.05, 0.05, 0.07, 0.1, 0.14, 0.18, 0.22] },
  white: { strength: 1.5, curve: Array.from({ length: BANDS }, () => 0.94) },
  black: { strength: 0.55, curve: Array.from({ length: BANDS }, () => 0.03) },
}

const absorbs = (r: number) => ((1 - r) * (1 - r)) / (2 * r)
const reflects = (k: number) => 1 + k - Math.sqrt(k * k + 2 * k)

/** The light the mix sends back, band by band. Fractions of a dab are fine: the swirl draws them on the way. */
export function reflectance(amounts: Amounts): number[] {
  let total = 0
  for (const p of PAINTS) total += Math.max(0, amounts[p] ?? 0) * PIGMENT[p].strength
  if (total <= 0) return Array.from({ length: BANDS }, () => 1)
  return Array.from({ length: BANDS }, (_, band) => {
    let k = 0
    for (const p of PAINTS) {
      const share = (Math.max(0, amounts[p] ?? 0) * PIGMENT[p].strength) / total
      if (share > 0) k += share * absorbs(PIGMENT[p].curve[band])
    }
    return reflects(k)
  })
}

function xyzOf(amounts: Amounts): [number, number, number] {
  const r = reflectance(amounts)
  let x = 0
  let y = 0
  let z = 0
  for (let i = 0; i < BANDS; i++) {
    x += r[i] * CIE_X[i] * D65[i]
    y += r[i] * CIE_Y[i] * D65[i]
    z += r[i] * CIE_Z[i] * D65[i]
  }
  return [x / Y_SUM, y / Y_SUM, z / Y_SUM]
}

/** What the mix looks like on a screen. */
export function hexOf(amounts: Amounts): string {
  const [x, y, z] = xyzOf(amounts)
  const linear = [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z]
  return `#${linear.map((v) => {
    const c = Math.max(0, Math.min(1, v))
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
    return Math.round(g * 255).toString(16).padStart(2, '0')
  }).join('')}`
}

export type Lab = [number, number, number]
export function labOf(amounts: Amounts): Lab {
  const [x, y, z] = xyzOf(amounts)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x / 0.9505)
  const fy = f(y)
  const fz = f(z / 1.089)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
export const labDistance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// ---------------------------------------------------------------------------
// The colours a card can ask for. Each recipe's parts are the simplest whole numbers that make it.

export type Family = 'secondary' | 'tertiary' | 'tint' | 'shade' | 'neutral' | 'brown'
export type Colour = { recipe: Amounts; family: Family }

export const COLOURS: Record<string, Colour> = {
  orange: { recipe: { red: 1, yellow: 1 }, family: 'secondary' },
  green: { recipe: { yellow: 1, blue: 1 }, family: 'secondary' },
  purple: { recipe: { red: 1, blue: 1 }, family: 'secondary' },
  'red-orange': { recipe: { red: 3, yellow: 1 }, family: 'tertiary' },
  'yellow-orange': { recipe: { red: 1, yellow: 3 }, family: 'tertiary' },
  'yellow-green': { recipe: { yellow: 3, blue: 1 }, family: 'tertiary' },
  'blue-green': { recipe: { yellow: 1, blue: 3 }, family: 'tertiary' },
  'red-purple': { recipe: { red: 3, blue: 1 }, family: 'tertiary' },
  'blue-purple': { recipe: { red: 1, blue: 3 }, family: 'tertiary' },
  pink: { recipe: { red: 1, white: 3 }, family: 'tint' },
  'sky blue': { recipe: { blue: 1, white: 3 }, family: 'tint' },
  cream: { recipe: { yellow: 1, white: 5 }, family: 'tint' },
  mint: { recipe: { yellow: 1, blue: 1, white: 3 }, family: 'tint' },
  lilac: { recipe: { red: 1, blue: 1, white: 3 }, family: 'tint' },
  peach: { recipe: { red: 1, yellow: 1, white: 3 }, family: 'tint' },
  maroon: { recipe: { red: 4, black: 1 }, family: 'shade' },
  navy: { recipe: { blue: 4, black: 1 }, family: 'shade' },
  olive: { recipe: { yellow: 3, black: 1 }, family: 'shade' },
  'dark green': { recipe: { yellow: 2, blue: 2, black: 1 }, family: 'shade' },
  brown: { recipe: { red: 2, yellow: 2, blue: 1 }, family: 'brown' },
  grey: { recipe: { white: 2, black: 1 }, family: 'neutral' },
  'light grey': { recipe: { white: 6, black: 1 }, family: 'neutral' },
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

const PRIMARY_LIKE = ['red', 'yellow', 'blue', 'white', 'black']

// ---------------------------------------------------------------------------
// The repeats a card can ask for.

export const RULES = ['block', 'half-drop', 'brick', 'mirror', 'turn'] as const
export type RuleName = (typeof RULES)[number]
export const MOTIFS = ['leaf', 'fish', 'bird'] as const
export type MotifName = (typeof MOTIFS)[number]

export const COLS = 4
export const ROWS = 3
/** Crossings of the chalk grid, across and down. A print sits on one, in half-steps of its own width. */
export const SPOTS_X = COLS * 2
export const SPOTS_Y = ROWS * 2

export type Print = { x: number; y: number; turn: number; flip: boolean }

export type ArtConfig =
  | { task: 'mix'; colour: string }
  | { task: 'repeat'; rule: string; motif: string }

export type ArtState = {
  /** Dabs on the palette, in the order they went on. */
  dabs?: Paint[]
  /** The learner's own prints on the cloth. */
  prints?: Print[]
  /** How the block is being held. */
  turn?: number
  flip?: boolean
}

export const spotKey = (p: { x: number; y: number }) => `${p.x},${p.y}`
const isRule = (r: string): r is RuleName => (RULES as readonly string[]).includes(r)
const ruleOf = (config: ArtConfig): RuleName => (config.task === 'repeat' && isRule(config.rule) ? config.rule : 'block')

/** The whole pattern, in order, from the rule. */
export function patternOf(rule: RuleName): (Print & { col: number; row: number })[] {
  const out: (Print & { col: number; row: number })[] = []
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      out.push({
        col,
        row,
        x: col * 2 + (rule === 'brick' && row % 2 === 1 ? 1 : 0),
        y: row * 2 + (rule === 'half-drop' && col % 2 === 1 ? 1 : 0),
        turn: rule === 'turn' ? col % 4 : 0,
        flip: rule === 'mirror' && col % 2 === 1,
      })
    }
  }
  return out
}

/** What is printed before the learner starts: enough of the pattern to read its rule, and half of it left to do. */
export function givenPrints(rule: RuleName): Print[] {
  const given = (p: { col: number; row: number }) => (rule === 'brick' ? p.row === 0 || (p.row === 1 && p.col < 2) : p.col < 2)
  return patternOf(rule).filter(given).map(({ x, y, turn, flip }) => ({ x, y, turn, flip }))
}

export const printsToMake = (rule: RuleName): Print[] => {
  const given = new Set(givenPrints(rule).map(spotKey))
  return patternOf(rule).filter((p) => !given.has(spotKey(p))).map(({ x, y, turn, flip }) => ({ x, y, turn, flip }))
}

// ---------------------------------------------------------------------------
// The state, read safely.

const isPaint = (p: unknown): p is Paint => typeof p === 'string' && (PAINTS as readonly string[]).includes(p)

export function dabsOf(state: ArtState | null | undefined): Paint[] {
  const raw = state?.dabs
  return Array.isArray(raw) ? raw.filter(isPaint).slice(0, MAX_DABS) : []
}

export function amountsOf(dabs: Paint[]): Amounts {
  const out: Amounts = {}
  for (const d of dabs) out[d] = (out[d] ?? 0) + 1
  return out
}

const wholeTurn = (t: unknown) => (typeof t === 'number' && Number.isFinite(t) ? ((Math.round(t) % 4) + 4) % 4 : 0)

/** The learner's prints, each spot once and on the grid; a print on a given one counts for nothing. */
export function printsOf(config: ArtConfig, state: ArtState | null | undefined): Print[] {
  const raw = state?.prints
  if (!Array.isArray(raw)) return []
  const seen = new Set(givenPrints(ruleOf(config)).map(spotKey))
  const out: Print[] = []
  for (const p of raw) {
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) continue
    if (p.x < 0 || p.y < 0 || p.x >= SPOTS_X || p.y >= SPOTS_Y) continue
    if (seen.has(spotKey(p))) continue
    seen.add(spotKey(p))
    out.push({ x: p.x, y: p.y, turn: wholeTurn(p.turn), flip: !!p.flip })
  }
  return out
}

export const heldTurn = (state: ArtState | null | undefined) => wholeTurn(state?.turn)
export const heldFlip = (state: ArtState | null | undefined) => !!state?.flip

// ---------------------------------------------------------------------------
// Marking: from the numbers, always.

const colourOf = (config: ArtConfig): Colour => (config.task === 'mix' && has(COLOURS, config.colour) ? COLOURS[config.colour] : COLOURS.orange)
export const targetAmounts = (config: ArtConfig): Amounts => colourOf(config).recipe

/** How far the mix is from the jug, as an eye would judge it. Infinity for a bare palette. */
export function mixDistance(config: ArtConfig, state: ArtState): number {
  const dabs = dabsOf(state)
  if (!dabs.length) return Infinity
  return labDistance(labOf(amountsOf(dabs)), labOf(targetAmounts(config)))
}

export type RepeatTally = { placed: number; missing: number; off: number; wrongWay: number }
export function tally(config: ArtConfig, state: ArtState): RepeatTally {
  const want = new Map(printsToMake(ruleOf(config)).map((p) => [spotKey(p), p]))
  let placed = 0
  let off = 0
  let wrongWay = 0
  for (const p of printsOf(config, state)) {
    const w = want.get(spotKey(p))
    if (!w) off++
    else if (w.turn !== p.turn || w.flip !== p.flip) wrongWay++
    else placed++
  }
  return { placed, off, wrongWay, missing: want.size - placed - wrongWay }
}

export function done(config: ArtConfig, state: ArtState): boolean {
  if (config.task === 'mix') return mixDistance(config, state) <= MATCH_TOLERANCE
  const t = tally(config, state)
  return t.off === 0 && t.wrongWay === 0 && t.missing === 0
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no word of the recipe or the rule.

const parts = (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`

/** "1 part red to 3 parts white", or "equal parts of red and yellow". */
export function recipeText(recipe: Amounts): string {
  const used = (['red', 'yellow', 'blue', 'white', 'black'] as Paint[]).filter((p) => (recipe[p] ?? 0) > 0).sort((x, y) => (recipe[y] ?? 0) - (recipe[x] ?? 0))
  if (used.length === 1) return `plain ${used[0]}`
  const allSame = used.every((p) => recipe[p] === recipe[used[0]])
  if (allSame) return `equal parts of ${used.slice(0, -1).join(', ')} and ${used[used.length - 1]}`
  return used.map((p) => `${parts(recipe[p] ?? 0)} ${p}`).reduce((all, one, i) => (i === 0 ? one : i === used.length - 1 ? `${all} to ${one}` : `${all}, ${one}`), '')
}

function whyOf(colour: string): string {
  const c = COLOURS[colour] ?? COLOURS.orange
  const used = PAINTS.filter((p) => (c.recipe[p] ?? 0) > 0)
  switch (c.family) {
    case 'secondary':
      return 'Two primaries mixed make a secondary colour.'
    case 'tertiary':
      return 'Mostly one primary and a little of its neighbour makes a tertiary colour, between a primary and a secondary.'
    case 'tint':
      return `White makes a tint: the same colour, only paler.${used.length > 2 ? ' Get the colour first, then pale it.' : ''}`
    case 'shade':
      return 'Black makes a shade: the same colour, only darker. It is strong paint, so a little goes a long way.'
    case 'brown':
      return 'All three primaries together make a brown. Too much of each and it goes to mud, which is why painters add the third colour a little at a time.'
    default:
      return 'Black and white make a neutral grey, with no colour in it. Black is the stronger paint, so it takes more white than you would think.'
  }
}

const RULE_WHY: Record<RuleName, string> = {
  block: 'A block repeat, or straight repeat: the motif sits in straight rows and columns, the plainest rule there is.',
  'half-drop': 'A half-drop repeat: every second column starts half a block lower, so the eye cannot run along straight rows. Printed cloth uses it more than any other.',
  brick: 'A brick repeat: every second row starts half a block along, like bricks in a wall.',
  mirror: 'A mirror repeat: every second column is flipped, so neighbouring motifs face each other.',
  turn: 'A rotated repeat: each column turns a quarter turn further on, and after four turns it is back where it began.',
}

/** What a correct card says. */
export function working(config: ArtConfig, state: ArtState): string {
  if (config.task === 'repeat') return `Yes. ${RULE_WHY[ruleOf(config)]} One motif and one rule make the whole cloth.`
  const name = has(COLOURS, config.colour) ? config.colour : 'orange'
  const recipe = recipeText(COLOURS[name].recipe)
  const d = mixDistance(config, state)
  const Name = name[0].toUpperCase() + name.slice(1)
  if (d <= SPOT_ON) return `Yes. ${Name} is ${recipe}. ${whyOf(name)}`
  return `Near enough: a good eye would pass that. The exact mix is ${recipe}. ${whyOf(name)}`
}

/** The hues a mix can lean towards, by angle round CIELAB. */
const LEANS: [string, number][] = [['red', 35], ['yellow', 90], ['green', 150], ['blue', 275]]

/** Which way a hue has gone from the target, in the name of the first landmark it is heading for. */
function leanOf(mine: Lab, want: Lab): string | null {
  const chroma = (l: Lab) => Math.hypot(l[1], l[2])
  if (chroma(mine) < 12 || chroma(want) < 12) return null
  const angle = (l: Lab) => (Math.atan2(l[2], l[1]) * 180) / Math.PI
  const a = angle(want)
  const delta = ((angle(mine) - a + 540) % 360) - 180
  if (Math.abs(delta) < 7) return null
  const ahead = LEANS.map(([name, h]) => ({ name, gap: (((h - a) * Math.sign(delta)) % 360 + 360) % 360 }))
  return ahead.reduce((best, x) => (x.gap < best.gap ? x : best)).name
}

/** Which way the mix is off: the eye's own words, never the recipe. */
export function missText(mineAmounts: Amounts, wantAmounts: Amounts): string[] {
  const mine = labOf(mineAmounts)
  const want = labOf(wantAmounts)
  const out: string[] = []
  const lean = leanOf(mine, want)
  if (lean) out.push(`too ${lean}`)
  if (mine[0] - want[0] > 5) out.push('too pale')
  else if (want[0] - mine[0] > 5) out.push('too dark')
  const c = Math.hypot(mine[1], mine[2]) - Math.hypot(want[1], want[2])
  if (c < -9 && !out.includes('too pale')) out.push('too dull')
  else if (c > 9 && !lean) out.push('too strong')
  return out
}

const list = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`)
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What a wrong card says: what the learner made, and which way it is off; never the recipe. */
export function madeText(config: ArtConfig, state: ArtState): string {
  if (config.task === 'mix') {
    const dabs = dabsOf(state)
    if (!dabs.length) return 'The palette is empty, so the patch is still bare. Tap a paint to start.'
    const mine = amountsOf(dabs)
    const off = missText(mine, targetAmounts(config))
    const said = off.length ? `Your mix is ${list(off)} for the jug, so the patch still shows.` : 'Your mix is close, but the patch still shows.'
    const threeInIt = (mine.red ?? 0) > 0 && (mine.yellow ?? 0) > 0 && (mine.blue ?? 0) > 0
    const threeWanted = (targetAmounts(config).red ?? 0) > 0 && (targetAmounts(config).yellow ?? 0) > 0 && (targetAmounts(config).blue ?? 0) > 0
    return threeInIt && !threeWanted ? `${said} All three primaries are in it, and that always dulls a colour.` : said
  }
  const t = tally(config, state)
  const wrong: string[] = []
  if (t.off > 0) wrong.push(`${count(t.off, 'print is', 'prints are')} out of step with the pattern`)
  if (t.wrongWay > 0) wrong.push(`${count(t.wrongWay, 'print is', 'prints are')} in the right place but facing the wrong way`)
  if (t.missing > 0) wrong.push(`${count(t.missing, 'place is', 'places are')} still bare`)
  return `${wrong.join(', and ')}.`.replace(/^./, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'mix' | 'repeat'> = {
  mix: 'mix', mixing: 'mix', 'mix-paint': 'mix', 'mix-colour': 'mix', 'mix-color': 'mix', 'colour-mixing': 'mix', 'color-mixing': 'mix', 'paint-mixing': 'mix', paint: 'mix', palette: 'mix',
  match: 'mix', 'match-colour': 'mix', 'match-color': 'mix', 'colour-match': 'mix', 'color-match': 'mix', colour: 'mix', color: 'mix', tint: 'mix', tints: 'mix', shade: 'mix', shades: 'mix',
  repeat: 'repeat', repeats: 'repeat', pattern: 'repeat', patterns: 'repeat', 'repeat-pattern': 'repeat', 'pattern-repeat': 'repeat', motif: 'repeat', motifs: 'repeat', stamp: 'repeat', stamping: 'repeat',
  print: 'repeat', printing: 'repeat', 'block-print': 'repeat', 'block-printing': 'repeat',
}

/** Other names for the colours on the list. */
const COLOUR_WORDS: Record<string, string> = {
  violet: 'purple', mauve: 'lilac', lavender: 'lilac', 'light-purple': 'lilac', 'pale-purple': 'lilac',
  'orange-red': 'red-orange', vermilion: 'red-orange', 'orange-yellow': 'yellow-orange', amber: 'yellow-orange', gold: 'yellow-orange', golden: 'yellow-orange',
  'green-yellow': 'yellow-green', lime: 'yellow-green', 'lime-green': 'yellow-green', chartreuse: 'yellow-green', 'green-blue': 'blue-green', teal: 'blue-green', turquoise: 'blue-green',
  'purple-red': 'red-purple', 'red-violet': 'red-purple', 'violet-red': 'red-purple', magenta: 'red-purple', 'purple-blue': 'blue-purple', 'blue-violet': 'blue-purple', 'violet-blue': 'blue-purple', indigo: 'blue-purple',
  'light-red': 'pink', 'pale-red': 'pink', rose: 'pink', 'sky-blue': 'sky blue', sky: 'sky blue', 'light-blue': 'sky blue', 'pale-blue': 'sky blue', 'baby-blue': 'sky blue',
  'light-yellow': 'cream', 'pale-yellow': 'cream', 'light-green': 'mint', 'pale-green': 'mint', 'mint-green': 'mint', 'light-orange': 'peach', 'pale-orange': 'peach', apricot: 'peach',
  'dark-red': 'maroon', burgundy: 'maroon', crimson: 'maroon', 'dark-blue': 'navy', 'navy-blue': 'navy', 'dark-yellow': 'olive', 'olive-green': 'olive', 'forest-green': 'dark green', 'dark-green': 'dark green',
  gray: 'grey', 'mid-grey': 'grey', 'mid-gray': 'grey', 'light-grey': 'light grey', 'light-gray': 'light grey', 'pale-grey': 'light grey', 'pale-gray': 'light grey', silver: 'light grey',
  'tint-of-red': 'pink', 'tint-of-blue': 'sky blue', 'tint-of-yellow': 'cream', 'tint-of-green': 'mint', 'tint-of-purple': 'lilac', 'tint-of-orange': 'peach',
  'shade-of-red': 'maroon', 'shade-of-blue': 'navy', 'shade-of-yellow': 'olive', 'shade-of-green': 'dark green',
}

const RULE_WORDS: Record<string, RuleName> = {
  block: 'block', 'block-repeat': 'block', straight: 'block', 'straight-repeat': 'block', 'full-drop': 'block', grid: 'block', square: 'block', 'square-repeat': 'block',
  'half-drop': 'half-drop', 'half-drop-repeat': 'half-drop', halfdrop: 'half-drop', drop: 'half-drop', 'drop-repeat': 'half-drop',
  brick: 'brick', 'brick-repeat': 'brick', 'half-brick': 'brick', 'half-brick-repeat': 'brick',
  mirror: 'mirror', 'mirror-repeat': 'mirror', mirrored: 'mirror', reflect: 'mirror', reflected: 'mirror', reflection: 'mirror', flip: 'mirror', flipped: 'mirror',
  turn: 'turn', turned: 'turn', 'turn-repeat': 'turn', rotate: 'turn', rotated: 'turn', rotation: 'turn', 'rotated-repeat': 'turn', 'rotation-repeat': 'turn',
}

const MOTIF_WORDS: Record<string, MotifName> = { leaf: 'leaf', leaves: 'leaf', fish: 'fish', bird: 'bird', birds: 'bird' }

const readColour = (raw: unknown, taskWord: string): string => {
  const key = keyOf(raw)
  // { task: "tint", colour: "red" } says the same as colour "tint of red".
  const asked = (taskWord === 'tint' || taskWord === 'tints' || taskWord === 'shade' || taskWord === 'shades') ? `${taskWord.replace(/s$/, '')}-of-${key}` : key
  if (has(COLOUR_WORDS, asked)) return COLOUR_WORDS[asked]
  if (has(COLOURS, asked)) return asked
  if (has(COLOUR_WORDS, key)) return COLOUR_WORDS[key]
  return has(COLOURS, key) ? key : key.replace(/-/g, ' ')
}
const readRule = (raw: unknown): string => {
  const key = keyOf(raw)
  return has(RULE_WORDS, key) ? RULE_WORDS[key] : key
}
const readMotif = (raw: unknown): string => {
  const key = keyOf(raw)
  return has(MOTIF_WORDS, key) ? MOTIF_WORDS[key] : key
}

const MIX_PROMPT = 'Tap a paint to add a dab, and watch it swirl into the mix on the palette. Mix the colour of the jug, until the bare patch disappears into the painting.'
const goodPrompt = (config: ArtConfig) => {
  if (config.task === 'mix') return MIX_PROMPT
  const rule = ruleOf(config)
  const extra = rule === 'mirror' ? ' Use the button to flip the block when you need to.' : rule === 'turn' ? ' Use the button to turn the block when you need to.' : ''
  return `Tap the cloth to press the block and print the motif, and tap one of your prints to lift it.${extra} Carry the pattern on until the cloth is full.`
}

export const artStudioEngine: SceneEngine<ArtConfig, ArtState> = {
  id: 'art-studio',
  // Only words a station uses for this and nothing else. "Colour", "pattern", "shade", "tone", "line" and "paint" are all in other lessons.
  covers: ['tints'],
  phrases: [
    'colour mixing', 'color mixing', 'mixing colours', 'mixing colors', 'mix colours', 'mix colors', 'mixing paint', 'mixing paints', 'paint mixing', 'mix paint', 'mixed paint', 'colour mixes', 'mixing pigments',
    'primary colours', 'primary colors', 'primary colour', 'primary color', 'secondary colours', 'secondary colors', 'secondary colour', 'secondary color', 'tertiary colour', 'tertiary color', 'tertiary colours', 'tertiary colors',
    'tint', 'tints and shades', 'tint and shade', 'shades and tints', 'colour wheel', 'color wheel', 'colour in art', 'color in art', 'colour theory', 'color theory',
    'painting', 'painting techniques', 'art techniques', 'visual arts techniques', 'fine arts', 'drawing and craft', 'still life',
    'motif', 'motifs', 'motif design', 'pattern design', 'pattern designs', 'pattern making', 'repeat pattern', 'repeat patterns',
    'block repeat', 'half-drop', 'half drop', 'brick repeat', 'mirror repeat', 'block printing', 'block print', 'block prints', 'potato print', 'potato printing', 'lino print', 'lino printing', 'printing with blocks', 'fabric printing', 'textile printing',
  ],
  // Near misses: colour in light and chemistry, motifs in books, music and cells, printing in history, paint on metal or by the litre.
  // A notFor word under three letters is dropped by the matcher, which would widen the phrase, so none is used.
  notFor: [
    'primary colours of light', 'primary colors of light', 'secondary colours of light', 'secondary colors of light', 'colours of light', 'colors of light', 'coloured light', 'colored light', 'coloured lights', 'colored lights', 'mixing light', 'light mixing', 'colour of light', 'color of light', 'additive', 'prism', 'prisms', 'spectrum', 'filter', 'filters', 'pixels', 'rgb', 'screen', 'screens',
    'literary', 'literature', 'novel', 'poem', 'poetry', 'shakespeare', 'macbeth', 'romeo', 'drama', 'themes and motifs', 'theme and motif', 'motifs and themes', 'motif and theme', 'recurring motif', 'recurring motifs', 'symbolism', 'narrative', 'fiction', 'musical', 'music', 'melody', 'composer', 'symphony', 'leitmotif',
    'sequence motif', 'sequence motifs', 'protein', 'proteins', 'dna', 'rna', 'amino', 'gene', 'genes', 'structural motif', 'structural motifs',
    'rust', 'rusting', 'corrosion', 'galvanising', 'galvanizing', 'cave painting', 'cave paintings', 'rock painting', 'rock paintings', 'wall painting', 'wall paintings', 'ancient', 'renaissance', 'art history', 'history of art', 'history of painting', 'area', 'perimeter', 'litres', 'cost',
    'printing press', 'gutenberg', 'invention', 'history of printing', 'dynasty', 'photosynthesis', 'chlorophyll', 'chromatography', 'skin colour', 'eye colour', 'flame', 'number pattern', 'number patterns', 'sequence', 'sequences', 'decimal', 'decimals',
  ],
  // What the learner decides is what a colour or a pattern is made of: how much of each paint, and where the rule puts each print.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const taskWord = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const rawColour = first(src, ['colour', 'color', 'target', 'name', 'mix'])
    const rawRule = first(src, ['rule', 'repeat', 'layout', 'pattern'])
    const rawMotif = first(src, ['motif', 'block', 'stamp', 'shape'])
    if (taskWord && !has(TASK_WORDS, taskWord)) return null
    const task = taskWord ? TASK_WORDS[taskWord] : rawColour !== undefined ? 'mix' : rawRule !== undefined || rawMotif !== undefined ? 'repeat' : null
    if (!task) return null
    if (task === 'mix') {
      if (rawColour !== undefined && typeof rawColour !== 'string') return null
      return { task, colour: rawColour === undefined ? 'orange' : readColour(rawColour, taskWord) }
    }
    if ((rawRule !== undefined && typeof rawRule !== 'string') || (rawMotif !== undefined && typeof rawMotif !== 'string')) return null
    return { task, rule: rawRule === undefined ? 'half-drop' : readRule(rawRule), motif: rawMotif === undefined ? 'leaf' : readMotif(rawMotif) }
  },

  faults(config) {
    if (config.task === 'mix') {
      if (has(COLOURS, config.colour)) return []
      const name = config.colour || 'that colour'
      if (PRIMARY_LIKE.includes(config.colour)) {
        return [`${name[0].toUpperCase()}${name.slice(1)} comes straight from the tube, and no other paints can mix it, so there is nothing to do: use a mixed colour, e.g. colour "orange" or "pink".`]
      }
      return [`There is no "${name}" on this palette: use one of ${Object.keys(COLOURS).join(', ')}, e.g. colour "purple".`]
    }
    const out: string[] = []
    if (!isRule(config.rule)) out.push(`There is no "${config.rule}" repeat: use one of ${RULES.join(', ')}, e.g. rule "half-drop".`)
    if (!(MOTIFS as readonly string[]).includes(config.motif)) out.push(`There is no "${config.motif}" block: use one of ${MOTIFS.join(', ')}, which all look different flipped or turned, e.g. motif "leaf".`)
    return out
  },

  promptFaults(config, prompt) {
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'mix') {
      // Its own name is no giveaway, nor "a tint of blue": take those out, and look for paints in what is left.
      const text = prompt.replace(/\s+/g, ' ').toLowerCase()
        .replace(new RegExp(`\\b${config.colour.replace(/[^a-z ]/g, '.')}\\b`, 'g'), ' ')
        .replace(/\b(?:tint|shade)s? of \w+/g, ' ')
      const paint = '(?:red|yellow|blue|white|black)'
      const recipe = PAINTS.filter((p) => (targetAmounts(config)[p] ?? 0) > 0)
      const says = new RegExp(`\\b${paint}\\b.*\\b(?:and|with|plus|to|then|into)\\b.*\\b${paint}\\b|\\b(?:add|adding|use|using|needs?|take|from|more|little|some)\\b[^.]*\\b${paint}\\b|\\b${paint}\\b\\s*(?:\\+|&)`).test(text)
        || recipe.some((p) => new RegExp(`\\b${p}\\b`).test(text))
      const howMuch = /\b\d+\s*(?:parts?|dabs?)\b|\b(?:one|two|three|four|five|six|equal)\s+(?:parts?|dabs?)\b|\b\d+\s*:\s*\d+\b|\bratio\b|\btwice as\b|\ball three\b|\bthree primar/.test(text)
      if (says || howMuch) out.push(`the prompt gives the mix away: it names the paints or how much of each, which the learner is to find on the palette -- ask for the match only ("${example}")`)
      if (/\bdrag\b|\bcoloured? lights?\b|\bmixing light\b|\brainbow\b|\bprism\b|\bdraw\b|\bsketch\b|\bbrush ?strokes?\b|\bperspective\b|\bcolou?r wheel\b/.test(text)) {
        out.push(`the prompt promises something the card does not show: it has a jug, a palette and paints, and the learner taps the paints -- ask for that ("${example}")`)
      }
      return out
    }
    const text = prompt.replace(/\s+/g, ' ').toLowerCase()
    const rule = ruleOf(config)
    const names = /\bhalf[- ]?drop\b|\bbrick\b|\bmirror|\breflect|\brotat|\bblock repeat\b|\bstraight (?:repeat|rows?)\b|\bfull drop\b/.test(text)
    const describes = /\bevery (?:other|second|alternate)\b|\beach (?:new |next )?(?:column|row)\b|\balternat|\bhalf a (?:block|step|column|row|print)\b|\bhalfway\b|\bstagger|\boffset\b|\blower\b|\bquarter\b|\bshift/.test(text)
    const gesture = (rule !== 'mirror' && /\bflip/.test(text)) || (rule !== 'turn' && /\bturn\b/.test(text))
    if (names || describes || gesture) out.push(`the prompt gives the rule away: it names the repeat or says how each print moves, which the learner is to read from the cloth -- ask them to carry it on ("${example}")`)
    if (/\bdrag\b|\bdraw\b|\bdesign your own\b|\bcolou?r\b|\bpaint\b|\bbatik\b|\bdye\b|\bweav|\bembroider|\blettering\b/.test(text)) {
      out.push(`the prompt promises something the card does not show: it has a cloth and one block of one ink, and the learner taps the cloth to print -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'mix' ? { dabs: [] } : { prints: [], turn: 0, flip: false }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'mix') {
      const recipe = targetAmounts(config)
      return { dabs: PAINTS.flatMap((p) => Array.from({ length: recipe[p] ?? 0 }, () => p)) }
    }
    return { prints: printsToMake(ruleOf(config)), turn: 0, flip: false }
  },

  View: ArtStudioView,

  prompt: `SCENE "art-studio" -- a painter's table on a warm light panel, with two tasks. Free drawing cannot be marked, so it does not offer it.
  mix: a small painting of a jug stands on an easel, with a bare patch of canvas in the jug's belly, beside a wooden palette with five paints (white, yellow, red, blue, black, each named). The learner taps a paint: a brush carries a dab to the middle of the palette, where it visibly swirls into the mix, and the bare patch takes the colour of the mix. Paint mixes as paint does, taking light away, so red and yellow make orange, yellow and blue make green, and all three go muddy; this is not coloured light. When the mix is right the edge of the patch melts into the jug. A row under the picture shows the dabs in the mix, with buttons to take one back or wipe the palette. Marking is forgiving, as a good eye is: near is right, and it gives the exact mix. colour: one of orange, green, purple (secondary); red-orange, yellow-orange, yellow-green, blue-green, red-purple, blue-purple (tertiary); pink, sky blue, cream, mint, lilac, peach (tints, with white); maroon, navy, olive, dark green (shades, with black); brown (all three primaries); grey, light grey. "tint of blue" and "shade of red" also work. Plain red, yellow, blue, white and black are refused: they come from the tube.
  repeat: a length of cloth marked with a chalk grid, already part printed with a motif in indigo, beside a carved block on an ink pad. The learner taps the cloth: the block comes down and leaves a print on the nearest chalk crossing. Tapping one of their own prints lifts it. They read the rule from what is printed, and carry it on until the cloth is full. rule: block (straight rows and columns), half-drop (every second column half a block lower), brick (every second row half a block along), mirror (every second column flipped; a button flips the block), turn (each column a quarter turn further on; a button turns the block). motif: leaf, fish or bird; other motifs are refused.
  For: colour mixing, primary, secondary and tertiary colours, tints and shades, using colour in art; motifs, repeat patterns, block printing and pattern design. It answers "mixing all three primaries makes black" (it goes muddy brown), "any colour can be mixed if you keep adding paint" and "a pattern is the same thing drawn lots of times, with no rule". Use "light" for the science of colour in light, and a chart or timeline for art history. Not drawn: free drawing, shading, perspective, clay, weaving, lettering.
  Before marking the card shows the jug, the paints and the learner's own dabs, or the cloth, the block and the prints so far, with short names. It holds back the recipe and the name of the repeat. Marking gives the recipe, or the rule's name and why, or says which way a mix is off (too red, too dark, too dull) or how many prints are out of step. The prompt must ask only for the match or for the pattern to be carried on, and say the gesture: do NOT name the paints, the parts or "all three" for a mix; do NOT name the repeat or say how each print moves.
  config: { "task":"mix", "colour":"orange" }  -- the prompt says "${MIX_PROMPT}"
       or { "task":"mix", "colour":"sky blue" }  -- the same prompt
       or { "task":"repeat", "rule":"half-drop", "motif":"leaf" }  -- the prompt says "Tap the cloth to press the block and print the motif, and tap one of your prints to lift it. Carry the pattern on until the cloth is full."
       or { "task":"repeat", "rule":"mirror", "motif":"fish" }  -- the prompt says "Tap the cloth to press the block and print the motif, and tap one of your prints to lift it. Use the button to flip the block when you need to. Carry the pattern on until the cloth is full."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${MIX_PROMPT}",
    "payload": { "engine":"art-studio", "config": { "task":"mix", "colour":"orange" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:art-studio", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the cloth to press the block and print the motif, and tap one of your prints to lift it. Carry the pattern on until the cloth is full.",
    "payload": { "engine":"art-studio", "config": { "task":"repeat", "rule":"half-drop", "motif":"leaf" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:art-studio", "why":"..." } }`,
}

registerEngine(artStudioEngine as SceneEngine<unknown, unknown>)
