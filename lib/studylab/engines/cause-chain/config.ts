// lib/studylab/engines/cause-chain/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CauseChainView } from './View'

/**
 * Cause and consequence as a structure the learner builds. The tutor names the
 * factors, where the chain starts, and the links it teaches ("drought causes
 * crop failure"). The learner joins the factors with arrows and says what each
 * one does. The engine marks the structure against the stated links and, once
 * marked, lights the chain from the start so the consequences can be seen to
 * spread.
 *
 * There is no physical model here to get wrong: the facts are the tutor's
 * links. What the engine guarantees is that the structure is one a learner can
 * work out -- a chain, not a star or a loop; every factor following from the
 * start; no link the learner could not know was wanted -- and that the cards'
 * places never spell the answer.
 */

export const EFFECTS = ['causes', 'increases', 'decreases'] as const
export type Effect = (typeof EFFECTS)[number]
export interface Factor { id: string; label: string }
export interface Link { from: string; to: string; effect: Effect }
export type CauseChainConfig = { task: { kind: 'build-chain'; factors: Factor[]; links: Link[]; start: string } }
/** The links the learner has drawn, in the order drawn. */
export type CauseChainState = { links: Link[] }

/** What a chain may hold and still be drawn clearly and worked out. */
export const LIMITS = { minFactors: 3, maxFactors: 7, minLinks: 2, maxLinks: 8, maxLabel: 32 } as const
/** Beyond these, parse gives up: the config is not a chain anyone meant. */
const PARSE_MAX_FACTORS = 12
const PARSE_MAX_LINKS = 16

/**
 * The sign of a link. "Causes" and "increases" both say the cause brings its
 * consequence about or pushes it up; "decreases" pushes it down. Which of the
 * first two a link uses cannot be argued from the factors alone, so the marking
 * reads the sign, and a chain may use one of them, not both (a fault).
 */
export const polarity = (e: Effect): 1 | -1 => (e === 'decreases' ? -1 : 1)

/** "Crop failure", "crop_failure" and "crop-failure" are one id. Letters of any script are kept. */
export const slug = (s: string) =>
  s.trim().toLowerCase().replace(/['’"]/g, '').replace(/[\s_.,;:!?()[\]{}/\\|&+*=<>~`^]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ')
const fromId = (id: string) => {
  const s = id.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const KINDS = new Set(['build-chain', 'chain', 'build-a-chain', 'cause-chain', 'causal-chain'])

const EFFECT_WORDS = new Map<string, Effect>([
  ['causes', 'causes'], ['cause', 'causes'], ['caused', 'causes'], ['leads-to', 'causes'], ['led-to', 'causes'], ['results-in', 'causes'],
  ['increases', 'increases'], ['increase', 'increases'], ['raises', 'increases'], ['raise', 'increases'], ['boosts', 'increases'],
  ['decreases', 'decreases'], ['decrease', 'decreases'], ['reduces', 'decreases'], ['reduce', 'decreases'], ['lowers', 'decreases'], ['lower', 'decreases'],
])

/** An effect however it is written; a link with none simply causes. Null for a word that is not one. */
function readEffect(raw: unknown): Effect | null {
  if (raw === undefined || raw === null) return 'causes'
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t === '+') return 'increases'
  if (t === '-' || t === '−') return 'decreases'
  return EFFECT_WORDS.get(slug(t)) ?? null
}

/** A factor as `{ id, label }`, `{ label }`, `{ id }` or just its label. */
function readFactor(raw: unknown): Factor | null {
  if (typeof raw === 'string') {
    const label = tidy(raw)
    return slug(label) ? { id: slug(label), label } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = [r.label, r.name, r.text].find((v): v is string => typeof v === 'string' && tidy(v) !== '')
  const id = slug(typeof r.id === 'string' && slug(r.id) ? r.id : text ?? '')
  if (!id) return null
  return { id, label: text ? tidy(text) : fromId(id) }
}

/** The one factor that leads on and that nothing leads into, or null when there is not exactly one. */
function onlyRoot(factors: Factor[], links: Link[]): string | null {
  const roots = factors.filter((f) => links.some((l) => l.from === f.id) && !links.some((l) => l.to === f.id))
  return roots.length === 1 ? roots[0].id : null
}

const pairKey = (from: string, to: string) => `${from}>${to}`
const samePair = (a: Link, b: { from: string; to: string }) =>
  (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from)

/** Each factor's label by id; the first one wins if two share an id. */
function labels(config: CauseChainConfig): Map<string, string> {
  const m = new Map<string, string>()
  for (const f of config.task.factors) if (!m.has(f.id)) m.set(f.id, f.label)
  return m
}

export function labelOf(config: CauseChainConfig, id: string): string {
  return labels(config).get(id) ?? id
}

/** "Drought causes Crop failure": a link in words. */
export function sentence(config: CauseChainConfig, link: Link): string {
  return `${labelOf(config, link.from)} ${link.effect} ${labelOf(config, link.to)}`
}

/** The stated links between two known, different factors, each ordered pair once (the first stated). */
export function statedLinks(config: CauseChainConfig): Link[] {
  const ids = labels(config)
  const seen = new Set<string>()
  const out: Link[] = []
  for (const l of config.task.links) {
    if (l.from === l.to || !ids.has(l.from) || !ids.has(l.to) || seen.has(pairKey(l.from, l.to))) continue
    seen.add(pairKey(l.from, l.to))
    out.push(l)
  }
  return out
}

/** Everything reachable from `from` along `links`, with the way each was first reached. */
function reach(from: string, links: Link[]): Map<string, string | null> {
  const came = new Map<string, string | null>([[from, null]])
  const queue = [from]
  while (queue.length) {
    const at = queue.shift()!
    for (const l of links) {
      if (l.from === at && !came.has(l.to)) {
        came.set(l.to, at)
        queue.push(l.to)
      }
    }
  }
  return came
}

/** A loop in the links, as the ids round it (first repeated last), or null. */
function findLoop(ids: string[], links: Link[]): string[] | null {
  const mark = new Map<string, 'open' | 'done'>()
  const stack: string[] = []
  const visit = (id: string): string[] | null => {
    mark.set(id, 'open')
    stack.push(id)
    for (const l of links) {
      if (l.from !== id) continue
      if (mark.get(l.to) === 'open') return [...stack.slice(stack.indexOf(l.to)), l.to]
      if (!mark.has(l.to)) {
        const loop = visit(l.to)
        if (loop) return loop
      }
    }
    stack.pop()
    mark.set(id, 'done')
    return null
  }
  for (const id of ids) {
    if (mark.has(id)) continue
    const loop = visit(id)
    if (loop) return loop
  }
  return null
}

/**
 * The two effects the learner chooses between: the config's own word for a
 * push up ("causes" in a chain of events, "increases" in a chain of amounts),
 * and "decreases". Always both, so the sign is always the learner's to decide.
 */
export function effectChoices(config: CauseChainConfig): [Effect, Effect] {
  return [config.task.links.some((l) => l.effect === 'causes') ? 'causes' : 'increases', 'decreases']
}

export type LinkStatus = 'right' | 'reversed' | 'opposite' | 'extra'
export interface Judged { link: Link; status: LinkStatus }

/**
 * The learner's links that the engine can read: between two known, different
 * factors, with an effect; the last word on an ordered pair stands.
 */
export function learnerLinks(config: CauseChainConfig, state: CauseChainState | null | undefined): Link[] {
  const ids = labels(config)
  const raw: unknown[] = Array.isArray(state?.links) ? state!.links : []
  const kept = new Map<string, Link>()
  for (const l of raw) {
    if (!l || typeof l !== 'object') continue
    const { from, to, effect } = l as Record<string, unknown>
    if (typeof from !== 'string' || typeof to !== 'string' || from === to || !ids.has(from) || !ids.has(to)) continue
    if (typeof effect !== 'string' || !(EFFECTS as readonly string[]).includes(effect)) continue
    kept.delete(pairKey(from, to))
    kept.set(pairKey(from, to), { from, to, effect: effect as Effect })
  }
  return [...kept.values()]
}

/**
 * Each of the learner's links against the stated ones: right (the stated link,
 * same sign), opposite (the stated link, the other sign), reversed (a stated
 * link drawn the wrong way round) or extra (one the tutor did not state, never
 * marked). Solved when every stated link is drawn right and nothing goes
 * against one.
 */
export function judge(config: CauseChainConfig, state: CauseChainState | null | undefined): { judged: Judged[]; missing: Link[]; ok: boolean } {
  const stated = statedLinks(config)
  const judged: Judged[] = learnerLinks(config, state).map((link) => {
    const same = stated.find((s) => s.from === link.from && s.to === link.to)
    if (same) return { link, status: polarity(same.effect) === polarity(link.effect) ? 'right' : 'opposite' }
    if (stated.some((s) => s.from === link.to && s.to === link.from)) return { link, status: 'reversed' }
    return { link, status: 'extra' }
  })
  const missing = stated.filter((s) => !judged.some((j) => j.status === 'right' && j.link.from === s.from && j.link.to === s.to))
  const ok = stated.length > 0 && missing.length === 0 && judged.every((j) => j.status === 'right' || j.status === 'extra')
  return { judged, missing, ok }
}

/**
 * How the start's effects spread through the learner's right links: each
 * factor reached, with its step from the start, and the right links in the
 * order they carry the effect on (`at` is the step their consequence lights).
 */
export function propagation(config: CauseChainConfig, state: CauseChainState | null | undefined): { depth: Map<string, number>; order: { link: Link; at: number }[] } {
  const stated = statedLinks(config)
  const right = judge(config, state).judged.filter((j) => j.status === 'right').map((j) => j.link)
  const depth = new Map<string, number>()
  if (!labels(config).has(config.task.start)) return { depth, order: [] }
  depth.set(config.task.start, 0)
  let frontier = [config.task.start]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      for (const l of right) {
        if (l.from === id && !depth.has(l.to)) {
          depth.set(l.to, depth.get(id)! + 1)
          next.push(l.to)
        }
      }
    }
    frontier = next
  }
  const rank = (l: Link) => stated.findIndex((s) => s.from === l.from && s.to === l.to)
  const order = right
    .filter((l) => depth.has(l.from))
    .map((link) => ({ link, at: depth.get(link.from)! + 1 }))
    .sort((a, b) => a.at - b.at || rank(a.link) - rank(b.link))
  return { depth, order }
}

/** The state with `link` drawn: any link already between the two factors, either way round, gives way to it. */
export function withLink(state: CauseChainState | null | undefined, link: Link): CauseChainState {
  const rest = (Array.isArray(state?.links) ? state!.links : []).filter((l) => !samePair(l, link))
  return { links: [...rest, link] }
}

/** The state with any link between the two factors, either way round, taken out. */
export function withoutLink(state: CauseChainState | null | undefined, a: string, b: string): CauseChainState {
  return { links: (Array.isArray(state?.links) ? state!.links : []).filter((l) => !samePair(l, { from: a, to: b })) }
}

// ── Where the cards go ──────────────────────────────────────────────────────

/** FNV-1a: a config's own seed, so the same chain is always laid out the same way. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()]
  const out: T[][] = []
  items.forEach((item, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([item, ...rest])
  })
  return out
}

/** Whether reading the ring one way round from the start meets every link's cause before its consequence. */
export function readsInOrder(ring: string[], links: Link[], clockwise = true): boolean {
  const n = ring.length
  const at = new Map(ring.map((id, i) => [id, clockwise || i === 0 ? i : n - i]))
  return links.every((l) => (at.get(l.from) ?? 0) < (at.get(l.to) ?? 0))
}

/**
 * How much a ring gives away or tangles, lower being better: read clockwise
 * from the start it must not follow the chain (the order a reader's eye takes),
 * nor, where avoidable, anticlockwise; not every link may join neighbours; and
 * the finished chain should cross itself as little as it can, so the picture
 * stays clear.
 */
function layoutScore(ring: string[], links: Link[]): number {
  const n = ring.length
  const at = new Map(ring.map((id, i) => [id, i]))
  const neighbours = (l: Link) => {
    const d = Math.abs(at.get(l.from)! - at.get(l.to)!)
    return d === 1 || d === n - 1
  }
  let crossings = 0
  for (let i = 0; i < links.length; i++) {
    for (let j = i + 1; j < links.length; j++) {
      const [a, b] = [at.get(links[i].from)!, at.get(links[i].to)!].sort((x, y) => x - y)
      const c = at.get(links[j].from)!
      const d = at.get(links[j].to)!
      if (new Set([a, b, c, d]).size < 4) continue
      if ((a < c && c < b) !== (a < d && d < b)) crossings++
    }
  }
  const slack = n >= 6 ? 1 : 0
  return (readsInOrder(ring, links, true) ? 10000 : 0) + (readsInOrder(ring, links, false) ? 1000 : 0) +
    (links.length > 0 && links.every(neighbours) ? 500 : 0) + 10 * Math.max(0, crossings - slack)
}

const LAYOUTS = new Map<string, string[]>()

/**
 * The cards round the ring, clockwise from the start (on the left). The rest
 * are placed by the config's own seed among the layouts that give least away
 * (every arrangement is weighed for up to seven factors), so where a card sits
 * never tells the learner what it leads to.
 */
export function ringOrder(config: CauseChainConfig): string[] {
  const ids = [...labels(config).keys()]
  const start = ids.includes(config.task.start) ? config.task.start : ids[0]
  const links = statedLinks(config)
  const key = JSON.stringify([ids, start, links.map((l) => [l.from, l.to])])
  const cached = LAYOUTS.get(key)
  if (cached) return cached
  const seed = hash(key)
  const others = ids.filter((id) => id !== start)
  let candidates: string[][]
  if (others.length <= 6) {
    candidates = permutations(others)
  } else {
    const rand = mulberry32(seed)
    candidates = Array.from({ length: 400 }, () => {
      const p = others.slice()
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[p[i], p[j]] = [p[j], p[i]]
      }
      return p
    })
  }
  let best: string[][] = []
  let bestScore = Infinity
  for (const p of candidates) {
    const s = layoutScore([start, ...p], links)
    if (s < bestScore) {
      bestScore = s
      best = [p]
    } else if (s === bestScore) {
      best.push(p)
    }
  }
  const ring = [start, ...best[seed % best.length]]
  if (LAYOUTS.size > 64) LAYOUTS.delete(LAYOUTS.keys().next().value!)
  LAYOUTS.set(key, ring)
  return ring
}

// ── How a label fits its card ───────────────────────────────────────────────

/** A card's width in a ring of n, in the ring's 360-wide units: seven cards leave room for narrower ones only. */
export const cardWidth = (n: number) => (n >= 7 ? 104 : 112)
export const CARD_HEIGHT = 52
/** A card's padding either side of its label, px. */
export const CARD_PAD_X = 3
/**
 * A card's label is set at 12px on 14px lines, and never smaller: text on a
 * learning card must stay readable. A label that cannot fit whole at that size
 * is refused (a fault), never shrunk and never broken inside a word.
 */
export const LABEL_SIZE = 12
export const LABEL_LINE = 14
/** As many lines as the card holds inside its border. */
export const LABEL_LINES = Math.floor((CARD_HEIGHT - 4) / LABEL_LINE)
/**
 * The width a label has on a card in a ring of n: the card less a 2px border
 * and the padding each side, and 1.5px for the widths' rounding and the scene
 * being drawn a little under 360 wide.
 */
export const labelRoom = (n: number) => cardWidth(n) - (2 * 2 + 2 * CARD_PAD_X + 1.5)

/**
 * Plus Jakarta Sans at weight 700 (the board's font, as the cards' `font-bold`):
 * each character's advance in ems, measured in Chrome with canvas measureText
 * and rounded to hundredths. Kerning only narrows a word.
 */
const ADVANCE: Record<string, number> = {
  ' ': 0.18, A: 0.71, B: 0.69, C: 0.77, D: 0.74, E: 0.6, F: 0.59, G: 0.81, H: 0.73, I: 0.28, J: 0.39, K: 0.68, L: 0.54, M: 0.89,
  N: 0.74, O: 0.88, P: 0.65, Q: 0.88, R: 0.66, S: 0.65, T: 0.54, U: 0.72, V: 0.7, W: 1.02, X: 0.66, Y: 0.66, Z: 0.57,
  a: 0.58, b: 0.67, c: 0.61, d: 0.67, e: 0.61, f: 0.41, g: 0.65, h: 0.59, i: 0.25, j: 0.25, k: 0.58, l: 0.25, m: 0.92,
  n: 0.59, o: 0.65, p: 0.67, q: 0.67, r: 0.37, s: 0.51, t: 0.41, u: 0.59, v: 0.57, w: 0.88, x: 0.56, y: 0.59, z: 0.48,
  0: 0.71, 1: 0.4, 2: 0.6, 3: 0.61, 4: 0.65, 5: 0.62, 6: 0.6, 7: 0.56, 8: 0.63, 9: 0.6,
  '-': 0.6, "'": 0.31, '’': 0.36, ',': 0.36, '.': 0.38, '(': 0.38, ')': 0.38, '&': 0.79, '/': 0.51, ':': 0.38, ';': 0.4,
  '!': 0.37, '?': 0.58, '%': 1.05, '—': 0.99, '–': 0.66,
  é: 0.61, è: 0.61, ê: 0.61, ë: 0.61, à: 0.58, â: 0.58, ä: 0.58, ô: 0.65, ö: 0.65, ü: 0.59, ç: 0.61, ñ: 0.59, í: 0.23, ó: 0.65, ú: 0.59,
}
/** Anything unmeasured counts as wide as the widest measured character. */
const UNMEASURED = 1.05

/** How wide a run of text is at a size, px. */
export function textWidth(s: string, px: number): number {
  let em = 0
  for (const ch of s) em += ADVANCE[ch] ?? UNMEASURED
  return em * px
}

/** The words of a label too wide for a card's line at 12px, in a ring of n. */
export function wideWords(label: string, n: number): string[] {
  return label.trim().split(/\s+/).filter((w) => textWidth(w, LABEL_SIZE) > labelRoom(n))
}

/**
 * How a label sits on its card at 12px: its lines, broken only between words,
 * the way the browser lays them. Null when it cannot fit whole: a word wider
 * than the card, or more lines than the card holds.
 */
export function labelFit(label: string, n: number): { lines: string[] } | null {
  const room = labelRoom(n)
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (wideWords(label, n).length) return null
  const lines: string[] = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last !== undefined && textWidth(`${last} ${w}`, LABEL_SIZE) <= room) lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w)
  }
  return lines.length <= LABEL_LINES ? { lines } : null
}

// ── The card's prompt ───────────────────────────────────────────────────────

/** Words that carry a cause on to its consequence, between the two ("drought causes crop failure"). */
const FORWARD = /caus|lead|\bled\b|result|bring|brought|increas|rais|boost|decreas|reduc|lower|\bthen\b|\bso\b|→|->|=>/
/** Words that point back from a consequence to its cause ("crop failure, caused by drought"). */
const BACKWARD = /caused by|because|due to|result(s|ed)? (of|from)|comes? from|came from|follows? from|←|<-/

/**
 * Why the card's prompt would give the chain away before it is marked: it
 * states a link the learner is to find, in either order, or lists the factors
 * in the chain's own order. Naming the start and asking is fine.
 */
export function promptFaults(config: CauseChainConfig, prompt: string): string[] {
  const text = prompt.toLowerCase().replace(/\s+/g, ' ')
  const name = labels(config)
  const said = (id: string) => `"${name.get(id) ?? id}"`
  const spots = (id: string): number[] => {
    const words = (name.get(id) ?? id).toLowerCase()
    const out: number[] = []
    for (let i = text.indexOf(words); i >= 0; i = text.indexOf(words, i + 1)) out.push(i)
    return out
  }
  const between = (a: string, b: string, words: RegExp) => {
    const la = (name.get(a) ?? a).length
    return spots(a).some((i) => spots(b).some((j) => j > i + la && j - (i + la) <= 40 && words.test(text.slice(i + la, j))))
  }
  const out: string[] = []
  const stated = statedLinks(config)
  for (const l of stated) {
    if (between(l.from, l.to, FORWARD) || between(l.to, l.from, BACKWARD)) {
      out.push(`The prompt gives away the link from ${said(l.from)} to ${said(l.to)}, which the learner is to find: name the start and ask, never the links.`)
    }
  }
  // Three or more factors named in the chain's own order spell it out, as a layout would.
  const named = [...name.keys()].filter((id) => spots(id).length).sort((a, b) => spots(a)[0] - spots(b)[0])
  const among = stated.filter((l) => named.includes(l.from) && named.includes(l.to))
  if (named.length >= 3 && among.length >= 2 && among.every((l) => named.indexOf(l.from) < named.indexOf(l.to))) {
    out.push(`The prompt names ${named.map(said).join(', ')} in the chain's own order, which gives the chain away: name the start and ask.`)
  }
  return out
}

// ── The engine ──────────────────────────────────────────────────────────────

export const causeChainEngine: SceneEngine<CauseChainConfig, CauseChainState> & { promptFaults(config: CauseChainConfig, prompt: string): string[] } = {
  id: 'cause-chain',
  covers: [
    'causes and consequences', 'chains of cause and effect', 'knock-on effects', 'short- and long-term consequences of an event',
    'positive and negative relationships between factors', 'causes of historical events',
    'effects of human activity on the environment', 'economic chains: interest rates, prices, demand, employment',
  ],
  isolates: 'consequence',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    if (t.kind !== undefined && !(typeof t.kind === 'string' && KINDS.has(slug(t.kind)))) return null
    if (!Array.isArray(t.factors) || !Array.isArray(t.links)) return null
    if (t.factors.length === 0 || t.factors.length > PARSE_MAX_FACTORS || t.links.length > PARSE_MAX_LINKS) return null
    const factors: Factor[] = []
    for (const f of t.factors) {
      const read = readFactor(f)
      if (!read) return null
      factors.push(read)
    }
    // A link may name a factor by its id or by its label.
    const resolve = (v: unknown): string | null => {
      if (typeof v !== 'string' || !slug(v)) return null
      const s = slug(v)
      return factors.some((f) => f.id === s) ? s : factors.find((f) => slug(f.label) === s)?.id ?? s
    }
    const links: Link[] = []
    for (const l of t.links) {
      if (!l || typeof l !== 'object') return null
      const r = l as Record<string, unknown>
      const from = resolve(r.from)
      const to = resolve(r.to)
      const effect = readEffect(r.effect)
      if (!from || !to || !effect) return null
      links.push({ from, to, effect })
    }
    const start = t.start === undefined ? onlyRoot(factors, links) : resolve(t.start)
    if (!start) return null
    return { task: { kind: 'build-chain', factors, links, start } }
  },

  faults(config) {
    const { factors, links, start } = config.task
    const name = labels(config)
    const said = (id: string) => `"${name.get(id) ?? id}"`
    const out: string[] = []

    if (factors.length < LIMITS.minFactors) out.push(`A chain needs at least ${LIMITS.minFactors} factors; this one has ${factors.length}: add the factors between the cause and its consequences.`)
    if (factors.length > LIMITS.maxFactors) out.push(`At most ${LIMITS.maxFactors} factors fit on the card; this one has ${factors.length}: keep the ones that carry the chain.`)
    const ids = new Set<string>()
    const texts = new Set<string>()
    // The cards are as wide as the ring the factors make allows.
    const ring = Math.min(LIMITS.maxFactors, Math.max(LIMITS.minFactors, name.size))
    for (const f of factors) {
      if (ids.has(f.id)) out.push(`Two factors share the id "${f.id}": give each factor its own id.`)
      else if (texts.has(f.label.toLowerCase())) out.push(`Two factors are both labelled "${f.label}": give each a label of its own.`)
      ids.add(f.id)
      texts.add(f.label.toLowerCase())
      if (f.label.length > LIMITS.maxLabel) out.push(`"${f.label}" is ${f.label.length} characters, too long for its card: keep each label to ${LIMITS.maxLabel}, a short noun phrase.`)
      else if (!labelFit(f.label, ring)) {
        const wide = wideWords(f.label, ring)
        const wider = ring >= 7 && labelFit(f.label, 6) ? ', or use six factors or fewer, whose cards are wider' : ''
        out.push(wide.length
          ? `"${f.label}" has a word too wide for its card at a readable size (${wide.map((w) => `"${w}"`).join(', ')}): say it in shorter words, as "Moving out of cities" says "Counterurbanisation"${wider}.`
          : `"${f.label}" needs more than ${LABEL_LINES} lines on its card: shorten it to a few short words${wider}.`)
      }
    }
    if (!ids.has(start)) out.push(`The start "${start}" is not one of the factors: set "start" to a factor's id.`)

    if (links.length < LIMITS.minLinks) out.push(`A chain needs at least ${LIMITS.minLinks} links; this one has ${links.length}: state how the start leads on to the other factors.`)
    if (links.length > LIMITS.maxLinks) out.push(`At most ${LIMITS.maxLinks} links can be drawn clearly; this one has ${links.length}: keep the ones that carry the chain.`)
    const seen = new Set<string>()
    for (const l of links) {
      const unknown = [l.from, l.to].filter((id) => !ids.has(id))
      if (unknown.length) {
        out.push(`The link from "${l.from}" to "${l.to}" names ${unknown.map((u) => `"${u}"`).join(' and ')}, which ${unknown.length > 1 ? 'are not factors' : 'is not a factor'}: use the factors' ids.`)
      } else if (l.from === l.to) {
        out.push(`${said(l.from)} is linked to itself: a link joins two different factors.`)
      } else if (seen.has(pairKey(l.from, l.to))) {
        out.push(`The link from ${said(l.from)} to ${said(l.to)} is stated twice: state each link once.`)
      }
      seen.add(pairKey(l.from, l.to))
    }
    if (links.some((l) => l.effect === 'causes') && links.some((l) => l.effect === 'increases')) {
      out.push('The links say both "causes" and "increases", which a learner cannot tell apart: use "causes" (and "decreases") for a chain of events, or "increases" and "decreases" for a chain of amounts.')
    }

    // The shape of the chain, on the links that can be read.
    const clean = statedLinks(config)
    const known = [...name.keys()]
    const loop = findLoop(known, clean)
    if (loop) out.push(`The links go round in a loop (${loop.map((id) => name.get(id) ?? id).join(' → ')}): a chain runs one way from its start, so take out one link of the loop.`)
    const touched = new Set(clean.flatMap((l) => [l.from, l.to]))
    for (const id of known) if (!touched.has(id)) out.push(`${said(id)} is in no link: link it into the chain, or leave it out.`)
    if (ids.has(start)) {
      const reached = reach(start, clean)
      for (const id of known) {
        if (touched.has(id) && !reached.has(id)) out.push(`${said(id)} cannot be reached from the start ${said(start)} by following the links: every factor must follow from the start.`)
      }
      if (clean.length >= LIMITS.minLinks && clean.every((l) => l.from === start || l.to === start)) {
        out.push(`Every link joins the start ${said(start)}, so the learner only has to join it to everything: a chain needs links between the later factors too (one leads to the next, which leads to the next).`)
      }
    }
    if (!loop) {
      for (const l of clean) {
        // A direct link that a longer path already carries: the learner could not know it was wanted as well.
        const others = clean.filter((o) => o !== l)
        const came = reach(l.from, others)
        if (!came.has(l.to)) continue
        const path = [l.to]
        while (came.get(path[0])) path.unshift(came.get(path[0])!)
        out.push(`The link from ${said(l.from)} to ${said(l.to)} is already carried by ${path.map((id) => name.get(id) ?? id).join(' → ')}, so a learner would not know to draw it as well: leave the direct link out.`)
      }
    }
    return out
  },

  initial() {
    return { links: [] }
  },

  check(config, state) {
    const { judged, ok } = judge(config, state)
    return { ok, wrongIds: judged.filter((j) => j.status === 'reversed' || j.status === 'opposite').map((j) => pairKey(j.link.from, j.link.to)) }
  },

  solve(config) {
    return { links: statedLinks(config).map((l) => ({ ...l })) }
  },

  promptFaults,

  View: CauseChainView,

  // The catalogue example's economics: Cambridge IGCSE Economics (0455), monetary policy -- a higher
  // interest rate makes borrowing dearer, so households borrow and spend less, and inflation falls.
  prompt: `SCENE "cause-chain" -- the factors of a cause-and-consequence chain as cards in a ring, the start on the
  left and the rest placed so their order never spells the chain. The learner joins one factor to another (tap
  one, then the one it affects; or Tab and Enter) and says whether it causes/increases it or decreases it; arrows
  are drawn as they go. The engine marks the links against the ones you state, then lights the chain from the
  start so the learner sees the consequences spread. For: causes and consequences in history, knock-on effects in
  geography, chains of effects in economics and social studies.
  config: { "task": { "kind":"build-chain", "start":"<id of the first cause>",
            "factors": [{ "id":"<short-id>", "label":"<a short noun phrase in short words, at most 32 characters>" }, ...],  -- 3 to 7
            "links": [{ "from":"<id>", "to":"<id>", "effect":"<causes | increases | decreases>" }, ...] } }  -- 2 to 8
  - every factor follows from the start along your links; no loops; not every link from the start (a star is not
    a chain); each link once, and never a direct link that a longer path of yours already carries.
  - "causes" (and "decreases") for a chain of events, labelled as events ("Rising food prices"); "increases" and
    "decreases" for a chain of amounts, labelled as amounts ("Food prices"). Never "causes" and "increases" together.
  - the card's prompt names the start and asks; it never states the links. Links the learner adds that you did not
    state are allowed and left unmarked.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The interest rate rises. Link what follows, and say how each changes the next.",
    "payload": { "engine":"cause-chain", "config": { "task": { "kind":"build-chain", "start":"interest-rate",
      "factors": [{ "id":"interest-rate", "label":"Interest rate" }, { "id":"borrowing", "label":"Borrowing" },
        { "id":"spending", "label":"Consumer spending" }, { "id":"inflation", "label":"Inflation" }],
      "links": [{ "from":"interest-rate", "to":"borrowing", "effect":"decreases" },
        { "from":"borrowing", "to":"spending", "effect":"increases" },
        { "from":"spending", "to":"inflation", "effect":"increases" }] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cause-chain", "why":"..." } }`,
}

registerEngine(causeChainEngine as SceneEngine<unknown, unknown>)
