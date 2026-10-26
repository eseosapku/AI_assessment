// lib/studylab/engines/food-web/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FoodWebView } from './View'

/**
 * Food chains and food webs, as Cambridge Lower Secondary Science and IGCSE
 * Biology 0610 teach them (0610 topic 19, "Organisms and their environment":
 * food chains and food webs, producers and consumers, trophic levels; an arrow
 * shows the energy passing from an organism to the one that eats it).
 *
 * The tutor names a habitat and what to ask. The engine supplies the organisms
 * and who feeds on whom from its own data, so no writer can get a feeding
 * relationship wrong. Three tasks:
 *  - draw-arrows: the field notes say what each animal feeds on; the learner
 *    draws the energy arrows. The classic error, an arrow from the feeder to
 *    its food ("eats"), is marked and said back.
 *  - roles: the web is drawn; the learner names each organism's role.
 *  - remove: one species is taken out; the learner predicts, for each animal
 *    whose change the arrows alone decide, whether it rises or falls.
 *
 * Every web is layered: each consumer feeds on one trophic level only, so its
 * own level is unarguable. No omnivore is in any web (a live judge refused a
 * chicken, whose level depends on what it is fed), and no filter feeder or
 * scavenger whose food spans levels.
 */

export const HABITATS = ['pond', 'woodland', 'grassland', 'savanna'] as const
export type HabitatId = (typeof HABITATS)[number]

export const ROLES = ['producer', 'primary', 'secondary', 'tertiary'] as const
export type Role = (typeof ROLES)[number]
/** How each role is said in a sentence. */
export const ROLE_NAMES: Record<Role, string> = {
  producer: 'producer', primary: 'primary consumer', secondary: 'secondary consumer', tertiary: 'tertiary consumer',
}
/** The role in a word, for the tag on a card. */
export const ROLE_TAGS: Record<Role, string> = { producer: 'Producer', primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary' }

export const KINDS = ['draw-arrows', 'roles', 'remove'] as const
export type Kind = (typeof KINDS)[number]

export const CHANGES = ['rise', 'fall'] as const
export type Change = (typeof CHANGES)[number]

export interface Organism {
  id: string
  /** As said mid-sentence, in lower case: "water flea". */
  name: string
  /** "water fleas"; a mass noun ("algae", "grass") is its own plural. */
  plural: string
  /** Other words a prompt may use for it, matched as whole words. */
  also?: string[]
  /** The ids of what it feeds on in this web; none for a producer. */
  eats: string[]
}
export interface Habitat { id: HabitatId; name: string; organisms: Organism[] }

/** An arrow as drawn: it leaves `from` and points at `to`. Energy passes from the food to the feeder. */
export interface Arrow { from: string; to: string }

export type FoodWebConfig = { task: { kind: 'draw-arrows' | 'roles'; habitat: HabitatId } | { kind: 'remove'; habitat: HabitatId; remove: string } }
/**
 * draw-arrows: the learner's arrows. roles: the role they gave each organism.
 * remove: the change they predicted for each animal asked about.
 */
export type FoodWebState = { arrows?: Arrow[]; roles?: Record<string, Role>; changes?: Record<string, Change> }

// ── The webs ────────────────────────────────────────────────────────────────

const o = (id: string, name: string, plural: string, eats: string[], also?: string[]): Organism => ({ id, name, plural, eats, ...(also ? { also } : {}) })

/**
 * The webs. Each follows the standard textbook web for its habitat, as drawn in
 * Cambridge IGCSE Biology and lower secondary texts, kept to links whose diet
 * facts are well established.
 */
export const WEBS: Record<HabitatId, Habitat> = {
  // A freshwater pond: algae and pondweed grazed by water fleas, pond snails and mayfly nymphs;
  // sticklebacks on the small invertebrates; pike and grey herons on the sticklebacks. Diets as in
  // The Wildlife Trusts' and the Freshwater Biological Association's species guides (Daphnia
  // filter-feeds on algae; mayfly nymphs graze algae; sticklebacks take crustaceans and insect larvae).
  pond: {
    id: 'pond', name: 'pond',
    organisms: [
      o('algae', 'algae', 'algae', [], ['alga']),
      o('pondweed', 'pondweed', 'pondweed', [], ['pond weed', 'elodea']),
      o('water-flea', 'water flea', 'water fleas', ['algae'], ['daphnia']),
      o('pond-snail', 'pond snail', 'pond snails', ['algae', 'pondweed'], ['snail', 'snails']),
      o('mayfly-nymph', 'mayfly nymph', 'mayfly nymphs', ['algae'], ['mayfly', 'mayflies', 'nymph', 'nymphs']),
      o('stickleback', 'stickleback', 'sticklebacks', ['water-flea', 'mayfly-nymph']),
      o('pike', 'pike', 'pike', ['stickleback'], ['pikes']),
      o('heron', 'heron', 'herons', ['stickleback']),
    ],
  },
  // An oak woodland: caterpillars and aphids on the oak, roe deer browsing bramble and oak leaves;
  // ladybirds on the aphids; shrews on caterpillars (insect larvae, their main prey -- The Wildlife
  // Trusts, common shrew); tawny owls on shrews.
  woodland: {
    id: 'woodland', name: 'woodland',
    organisms: [
      o('oak-tree', 'oak tree', 'oak trees', [], ['oak', 'oaks']),
      o('bramble', 'bramble', 'bramble', [], ['brambles', 'blackberry', 'blackberries']),
      o('caterpillar', 'caterpillar', 'caterpillars', ['oak-tree']),
      o('aphid', 'aphid', 'aphids', ['oak-tree'], ['greenfly']),
      o('deer', 'deer', 'deer', ['oak-tree', 'bramble'], ['roe deer']),
      o('ladybird', 'ladybird', 'ladybirds', ['aphid'], ['ladybug', 'ladybugs']),
      o('shrew', 'shrew', 'shrews', ['caterpillar']),
      o('tawny-owl', 'tawny owl', 'tawny owls', ['shrew'], ['owl', 'owls']),
    ],
  },
  // A grassland: rabbits, grasshoppers and field voles on the grass; stoats on rabbits and voles;
  // kestrels on voles and large insects such as grasshoppers; common frogs on insects; grass snakes on
  // frogs (The Wildlife Trusts species guides: stoat, kestrel, common frog, grass snake, field vole).
  grassland: {
    id: 'grassland', name: 'grassland',
    organisms: [
      o('grass', 'grass', 'grass', [], ['grasses']),
      o('rabbit', 'rabbit', 'rabbits', ['grass']),
      o('grasshopper', 'grasshopper', 'grasshoppers', ['grass']),
      o('field-vole', 'field vole', 'field voles', ['grass'], ['vole', 'voles']),
      o('frog', 'frog', 'frogs', ['grasshopper']),
      o('stoat', 'stoat', 'stoats', ['rabbit', 'field-vole']),
      o('kestrel', 'kestrel', 'kestrels', ['field-vole', 'grasshopper']),
      o('grass-snake', 'grass snake', 'grass snakes', ['frog'], ['snake', 'snakes']),
    ],
  },
  // An African savanna: zebra and wildebeest graze, giraffes browse acacia, impala do both; lions
  // take zebra, wildebeest and giraffe, cheetahs take impala (the savanna web of lower secondary texts;
  // diets as in the African Wildlife Foundation's species pages).
  savanna: {
    id: 'savanna', name: 'savanna',
    organisms: [
      o('grass', 'grass', 'grass', [], ['grasses']),
      o('acacia-tree', 'acacia tree', 'acacia trees', [], ['acacia', 'acacias']),
      o('zebra', 'zebra', 'zebras', ['grass']),
      o('wildebeest', 'wildebeest', 'wildebeest', ['grass'], ['gnu', 'gnus']),
      o('giraffe', 'giraffe', 'giraffes', ['acacia-tree']),
      o('impala', 'impala', 'impala', ['grass', 'acacia-tree'], ['impalas']),
      o('lion', 'lion', 'lions', ['zebra', 'wildebeest', 'giraffe']),
      o('cheetah', 'cheetah', 'cheetahs', ['impala']),
    ],
  },
}

/** The most organisms a web may hold, and the fewest. */
export const LIMITS = { min: 5, max: 8 } as const

export const habitatOf = (config: FoodWebConfig): Habitat => WEBS[config.task.habitat]
export const organismOf = (h: Habitat, id: string): Organism | undefined => h.organisms.find((x) => x.id === id)
/** "Water flea": a name as a card or a sentence's start says it. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const nameOf = (h: Habitat, id: string) => organismOf(h, id)?.name ?? id

/** Every feeding link of a web, as the energy arrow it is: from the food to the feeder. */
export function webArrows(h: Habitat): Arrow[] {
  return h.organisms.flatMap((x) => x.eats.map((food) => ({ from: food, to: x.id })))
}

/** Each organism's trophic level: 0 for a producer, one more than its food's for a consumer. */
export function levels(h: Habitat): Map<string, number> {
  const out = new Map<string, number>()
  const visit = (id: string, path: string[]): number => {
    const known = out.get(id)
    if (known !== undefined) return known
    const x = organismOf(h, id)
    if (!x || path.includes(id)) return 0
    const level = x.eats.length === 0 ? 0 : 1 + Math.max(...x.eats.map((f) => visit(f, [...path, id])))
    out.set(id, level)
    return level
  }
  for (const x of h.organisms) visit(x.id, [])
  return out
}

export function roleOf(h: Habitat, id: string): Role {
  return ROLES[Math.min(3, levels(h).get(id) ?? 0)]
}

/**
 * Why a web could not be taught from, in words: the checks every web in WEBS
 * passes (its tests prove it). A web must be layered, so every consumer's level
 * is unarguable from the arrows: each one feeds on a single level.
 */
export function webFaults(h: Habitat): string[] {
  const out: string[] = []
  const ids = new Set(h.organisms.map((x) => x.id))
  if (ids.size !== h.organisms.length) out.push(`${h.name}: two organisms share an id`)
  if (h.organisms.length < LIMITS.min || h.organisms.length > LIMITS.max) out.push(`${h.name}: ${h.organisms.length} organisms, not ${LIMITS.min} to ${LIMITS.max}`)
  const lv = levels(h)
  for (const x of h.organisms) {
    for (const f of x.eats) if (!ids.has(f)) out.push(`${h.name}: ${x.name} feeds on "${f}", which is not in the web`)
    if (x.eats.includes(x.id)) out.push(`${h.name}: ${x.name} feeds on itself`)
    const foodLevels = new Set(x.eats.filter((f) => ids.has(f)).map((f) => lv.get(f)))
    if (foodLevels.size > 1) out.push(`${h.name}: ${x.name} feeds on more than one trophic level, so its own level could be argued`)
    if ((lv.get(x.id) ?? 0) > 3) out.push(`${h.name}: ${x.name} is above a tertiary consumer`)
  }
  const linked = new Set(webArrows(h).flatMap((a) => [a.from, a.to]))
  for (const x of h.organisms) if (!linked.has(x.id)) out.push(`${h.name}: ${x.name} is in no link`)
  if (!h.organisms.some((x) => x.eats.length === 0)) out.push(`${h.name}: no producer`)
  return out
}

// ── Removing a species ──────────────────────────────────────────────────────

export interface Effect { id: string; change: Change; because: string }

/**
 * What taking `removed` out of the web does, where the arrows alone decide it:
 * an animal whose only food it was falls (it has nothing else to eat here), and
 * an organism whose only predator it was rises (nothing else here eats it).
 * Anything else -- an animal with other food, prey with other predators, the
 * knock-on effects further along -- could be argued, so it is not asked.
 */
export function removalEffects(h: Habitat, removed: string): Effect[] {
  const gone = organismOf(h, removed)
  if (!gone) return []
  const out: Effect[] = []
  for (const x of h.organisms) {
    if (x.id === removed) continue
    if (x.eats.length === 1 && x.eats[0] === removed) {
      out.push({ id: x.id, change: 'fall', because: `It fed only on ${gone.plural}.` })
    }
    const eaters = h.organisms.filter((y) => y.eats.includes(x.id))
    if (eaters.length === 1 && eaters[0].id === removed) {
      out.push({ id: x.id, change: 'rise', because: `Only ${gone.plural} fed on it.` })
    }
  }
  return out
}

/** The organisms of a web whose removal asks at least one question. */
export const removable = (h: Habitat) => h.organisms.filter((x) => removalEffects(h, x.id).length > 0).map((x) => x.id)

// ── Reading the config ──────────────────────────────────────────────────────

/** "Draw arrows", "draw_arrows" and "Draw-Arrows" are one word. */
const key = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : '')

const KIND_WORDS = new Map<string, Kind>([
  ['draw-arrows', 'draw-arrows'], ['arrows', 'draw-arrows'], ['draw-the-arrows', 'draw-arrows'], ['energy-arrows', 'draw-arrows'],
  ['draw-energy-arrows', 'draw-arrows'], ['draw-web', 'draw-arrows'], ['build-web', 'draw-arrows'], ['draw-food-web', 'draw-arrows'], ['build-food-web', 'draw-arrows'],
  ['roles', 'roles'], ['name-roles', 'roles'], ['name-the-roles', 'roles'], ['trophic-levels', 'roles'], ['trophic-level', 'roles'], ['levels', 'roles'], ['classify', 'roles'],
  ['remove', 'remove'], ['remove-species', 'remove'], ['remove-a-species', 'remove'], ['removal', 'remove'], ['predict-removal', 'remove'],
])

const HABITAT_WORDS = new Map<string, HabitatId>([
  ['pond', 'pond'], ['freshwater-pond', 'pond'], ['freshwater', 'pond'],
  ['woodland', 'woodland'], ['wood', 'woodland'], ['woods', 'woodland'], ['oak-woodland', 'woodland'], ['deciduous-woodland', 'woodland'],
  ['grassland', 'grassland'], ['meadow', 'grassland'],
  ['savanna', 'savanna'], ['savannah', 'savanna'], ['african-savanna', 'savanna'], ['african-savannah', 'savanna'],
])

function readHabitat(raw: unknown): HabitatId | null {
  const k = key(raw).replace(/^(a|an|the)-/, '').replace(/-(habitat|ecosystem|food-web|web)$/, '')
  return HABITAT_WORDS.get(k) ?? null
}

/** An organism of the web by its id, name, plural or other word ("Sticklebacks", "water_flea"). */
function readOrganism(h: Habitat, raw: unknown): string | null {
  const k = key(raw).replace(/^(a|an|the)-/, '')
  if (!k) return null
  const hit = h.organisms.find((x) => [x.id, x.name, x.plural, ...(x.also ?? [])].some((f) => key(f) === k))
  return hit?.id ?? null
}

// ── Marking ─────────────────────────────────────────────────────────────────

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const arrowKey = (a: Arrow) => `${a.from}>${a.to}`

/** The learner's arrows that can be read: between two organisms of the web; one per pair, the last drawn. */
export function learnerArrows(config: FoodWebConfig, state: FoodWebState | null | undefined): Arrow[] {
  const h = habitatOf(config)
  const raw: unknown[] = Array.isArray(state?.arrows) ? state!.arrows : []
  const kept = new Map<string, Arrow>()
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue
    const { from, to } = a as Record<string, unknown>
    if (typeof from !== 'string' || typeof to !== 'string' || from === to || !organismOf(h, from) || !organismOf(h, to)) continue
    kept.delete(pairKey(from, to))
    kept.set(pairKey(from, to), { from, to })
  }
  return [...kept.values()]
}

export type ArrowStatus = 'right' | 'reversed' | 'extra'
export interface JudgedArrow { arrow: Arrow; status: ArrowStatus }

/**
 * Each of the learner's arrows against the web: right (food to feeder),
 * reversed (from a feeder to its food, the classic error) or extra (no feeding
 * the field notes give). Solved when every link is drawn right and nothing else.
 */
export function judgeArrows(config: FoodWebConfig, state: FoodWebState | null | undefined): { judged: JudgedArrow[]; missing: Arrow[]; ok: boolean } {
  const web = webArrows(habitatOf(config))
  const judged: JudgedArrow[] = learnerArrows(config, state).map((arrow) => {
    if (web.some((w) => w.from === arrow.from && w.to === arrow.to)) return { arrow, status: 'right' }
    if (web.some((w) => w.from === arrow.to && w.to === arrow.from)) return { arrow, status: 'reversed' }
    return { arrow, status: 'extra' }
  })
  const missing = web.filter((w) => !judged.some((j) => j.status === 'right' && j.arrow.from === w.from && j.arrow.to === w.to))
  return { judged, missing, ok: missing.length === 0 && judged.every((j) => j.status === 'right') }
}

/** The state with an arrow from `from` to `to` drawn, or taken away if it was there; one arrow joins a pair. */
export function toggleArrow(state: FoodWebState | null | undefined, from: string, to: string): FoodWebState {
  const arrows = Array.isArray(state?.arrows) ? state!.arrows : []
  const had = arrows.some((a) => a.from === from && a.to === to)
  const rest = arrows.filter((a) => pairKey(a.from, a.to) !== pairKey(from, to))
  return { ...state, arrows: had ? rest : [...rest, { from, to }] }
}

export function withoutArrow(state: FoodWebState | null | undefined, a: string, b: string): FoodWebState {
  return { ...state, arrows: (Array.isArray(state?.arrows) ? state!.arrows : []).filter((x) => pairKey(x.from, x.to) !== pairKey(a, b)) }
}

/** The roles the learner has given, kept only for organisms of the web and roles that exist. */
export function learnerRoles(config: FoodWebConfig, state: FoodWebState | null | undefined): Record<string, Role> {
  const h = habitatOf(config)
  const raw = state?.roles && typeof state.roles === 'object' ? state.roles : {}
  const out: Record<string, Role> = {}
  for (const x of h.organisms) {
    const r = (raw as Record<string, unknown>)[x.id]
    if (typeof r === 'string' && (ROLES as readonly string[]).includes(r)) out[x.id] = r as Role
  }
  return out
}

export function withRole(state: FoodWebState | null | undefined, id: string, role: Role | null): FoodWebState {
  const roles = { ...(state?.roles ?? {}) }
  if (role) roles[id] = role
  else delete roles[id]
  return { ...state, roles }
}

/** The changes the learner has predicted, kept only for the animals asked about. */
export function learnerChanges(config: FoodWebConfig, state: FoodWebState | null | undefined): Record<string, Change> {
  if (config.task.kind !== 'remove') return {}
  const asked = removalEffects(habitatOf(config), config.task.remove).map((e) => e.id)
  const raw = state?.changes && typeof state.changes === 'object' ? state.changes : {}
  const out: Record<string, Change> = {}
  for (const id of asked) {
    const c = (raw as Record<string, unknown>)[id]
    if (c === 'rise' || c === 'fall') out[id] = c
  }
  return out
}

export function withChange(state: FoodWebState | null | undefined, id: string, change: Change | null): FoodWebState {
  const changes = { ...(state?.changes ?? {}) }
  if (change) changes[id] = change
  else delete changes[id]
  return { ...state, changes }
}

// ── Where the cards go ──────────────────────────────────────────────────────

/** The ring, in its own units: the cards sit round an ellipse. */
export const RING = { w: 360, cardW: 92, cardH: 50, pad: 6 } as const
/** How tall the ring is for each number of cards, and where the first card sits: enough that every arrow clears every card (pinned by the tests). */
const RY: Record<number, number> = { 5: 104, 6: 112, 7: 124, 8: 128 }
const OFFSET: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: Math.PI / 8 }

type Pt = { x: number; y: number }

/** The ring's size, its centre, and where each card's centre sits, clockwise from the left. */
export function ringGeometry(n: number): { w: number; h: number; centre: Pt; slots: Pt[]; card: { w: number; h: number } } {
  const rx = RING.w / 2 - RING.cardW / 2 - 2
  const ry = RY[n] ?? 128
  const off = OFFSET[n] ?? 0
  const angles = Array.from({ length: n }, (_, k) => off + (2 * Math.PI * k) / n)
  const reach = Math.max(0, ...angles.map((t) => Math.abs(Math.sin(t)))) * ry
  const h = Math.round(2 * (reach + RING.cardH / 2 + RING.pad))
  const centre = { x: RING.w / 2, y: h / 2 }
  return {
    w: RING.w, h, centre, card: { w: RING.cardW, h: RING.cardH },
    slots: angles.map((t) => ({ x: centre.x - rx * Math.cos(t), y: centre.y - ry * Math.sin(t) })),
  }
}

/** Whether the levels round the ring, read one way from some card, never step back: the roles in order. */
export function readsInLevelOrder(levelsRound: number[]): boolean {
  const n = levelsRound.length
  const steps = (dir: 1 | -1) => levelsRound.filter((l, i) => dir * (levelsRound[(i + 1) % n] - l) < 0).length
  return steps(1) <= 1 || steps(-1) <= 1
}

/** How strongly a card's level follows where it sits, from -1 to 1: 0 says nothing. */
export function correlation(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
}

/** How many pairs of links cross, with the cards round a ring at these places. */
export function crossings(ring: string[], arrows: Arrow[]): number {
  const at = new Map(ring.map((id, i) => [id, i]))
  let n = 0
  for (let i = 0; i < arrows.length; i++) {
    for (let j = i + 1; j < arrows.length; j++) {
      const [a, b] = [at.get(arrows[i].from)!, at.get(arrows[i].to)!].sort((x, y) => x - y)
      const c = at.get(arrows[j].from)!
      const d = at.get(arrows[j].to)!
      if (new Set([a, b, c, d]).size < 4) continue
      if ((a < c && c < b) !== (a < d && d < b)) n++
    }
  }
  return n
}

/** FNV-1a: a habitat's own seed, so its web is always laid out the same way. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * How much a layout gives away or tangles, lower being better. Where a card
 * sits must not tell its role: producers are not all at the bottom (the
 * textbook drawing, which spells the levels), the levels do not run in order
 * round the ring, and cards of one level do not huddle together. Among those,
 * fewer crossing arrows, and no arrow squeezed between two cards side by side,
 * keep the web clear.
 */
export function layoutScore(h: Habitat, ring: string[]): number {
  const ids = h.organisms.map((x) => x.id)
  return scorer(h)(ring.map((id) => ids.indexOf(id)))
}

/**
 * The score of a ring given as organism indices, slot by slot. It runs on
 * every arrangement of eight cards (40,320) the first time a web is drawn, in
 * the browser, so it works on numbers and allocates nothing.
 */
function scorer(h: Habitat): (ring: ArrayLike<number>) => number {
  const n = h.organisms.length
  const geo = ringGeometry(n)
  const lvMap = levels(h)
  const lv = h.organisms.map((x) => lvMap.get(x.id) ?? 0)
  // A layout's correlation with height or with left-to-right, over the same levels every time:
  // only the sum of level times centred position changes from one layout to the next.
  const centred = (vs: number[]) => {
    const m = vs.reduce((a, b) => a + b, 0) / n
    return vs.map((v) => v - m)
  }
  const ys = centred(geo.slots.map((s) => s.y))
  const xs = centred(geo.slots.map((s) => s.x))
  const lc = centred(lv)
  const sll = lc.reduce((a, b) => a + b * b, 0)
  const norm = (vs: number[]) => Math.sqrt(sll * vs.reduce((a, b) => a + b * b, 0)) || 1
  const [ny, nx] = [norm(ys), norm(xs)]
  const ids = h.organisms.map((x) => x.id)
  const links = webArrows(h).map((a) => [ids.indexOf(a.from), ids.indexOf(a.to)] as const)
  const at = new Int8Array(n)
  // Two cards side by side in a row (the pair at the top, the pair at the bottom) have only a
  // sliver between them, where an arrow is a cramped hook: a link is better drawn across the ring.
  const tight = new Uint8Array(n * n)
  for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) tight[p * n + q] = p !== q && sideBySide(geo.slots[p], geo.slots[q], geo.card) ? 1 : 0
  const cramped = (p: number, q: number) => tight[p * n + q] === 1
  return (ring) => {
    let sy = 0
    let sx = 0
    let huddled = 0
    let up = 0
    let down = 0
    for (let i = 0; i < n; i++) {
      at[ring[i]] = i
      const l = lv[ring[i]]
      sy += lc[ring[i]] * ys[i]
      sx += lc[ring[i]] * xs[i]
      const next = lv[ring[(i + 1) % n]]
      if (next === l) huddled++
      else if (next < l) down++
      else up++
    }
    // Read one way round from some card, the levels never step back: the roles in order.
    const sorted = down <= 1 || up <= 1
    let crossed = 0
    let hooked = 0
    for (let i = 0; i < links.length; i++) {
      const p = at[links[i][0]]
      const q = at[links[i][1]]
      if (cramped(p, q)) hooked++
      const a = p < q ? p : q
      const b = p < q ? q : p
      for (let j = i + 1; j < links.length; j++) {
        const c = at[links[j][0]]
        const d = at[links[j][1]]
        if (c === a || c === b || d === a || d === b) continue
        if ((a < c && c < b) !== (a < d && d < b)) crossed++
      }
    }
    return (sorted ? 10000 : 0) + 300 * (Math.abs(sy / ny) + Math.abs(sx / nx)) + 25 * huddled + 12 * crossed + 40 * hooked
  }
}

/** Whether two cards sit side by side in one row, so an arrow between them has only the gap to bend through. */
export function sideBySide(a: Pt, b: Pt, card: { w: number; h: number }): boolean {
  return Math.abs(a.y - b.y) < card.h && Math.abs(a.x - b.x) < 2 * card.w
}

const LAYOUTS = new Map<HabitatId, string[]>()

/**
 * The organisms round the ring, clockwise from the left: the best layout by
 * `layoutScore` over every arrangement (Heap's algorithm, in place), ties
 * broken by the habitat's own seed, so it is the same every time.
 */
export function ringOrder(h: Habitat): string[] {
  const cached = LAYOUTS.get(h.id)
  if (cached) return cached
  const n = h.organisms.length
  const score = scorer(h)
  const p = Array.from({ length: n }, (_, i) => i)
  const c = new Array<number>(n).fill(0)
  let best: number[][] = [p.slice()]
  let bestScore = score(p)
  for (let i = 1; i < n; ) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i]
      ;[p[j], p[i]] = [p[i], p[j]]
      const s = score(p)
      if (s < bestScore - 1e-9) {
        bestScore = s
        best = [p.slice()]
      } else if (Math.abs(s - bestScore) <= 1e-9) {
        best.push(p.slice())
      }
      c[i]++
      i = 1
    } else {
      c[i] = 0
      i++
    }
  }
  const ring = best[hash(h.id) % best.length].map((k) => h.organisms[k].id)
  LAYOUTS.set(h.id, ring)
  return ring
}

// ── The card's prompt ───────────────────────────────────────────────────────

/** Where the prompt names an organism of the web: the longest name first, so "grass snake" is not "grass". */
export function mentions(h: Habitat, text: string): { id: string; at: number; end: number }[] {
  const lower = text.toLowerCase().replace(/[-_’]/g, (c) => (c === '’' ? "'" : ' '))
  const forms = h.organisms
    .flatMap((x) => [...new Set([x.name, x.plural, ...(x.also ?? [])])].map((f) => ({ id: x.id, f })))
    .sort((a, b) => b.f.length - a.f.length)
  const taken = new Array<boolean>(lower.length).fill(false)
  const out: { id: string; at: number; end: number }[] = []
  for (const { id, f } of forms) {
    const re = new RegExp(`(?<![a-z])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'g')
    for (const m of lower.matchAll(re)) {
      const at = m.index ?? 0
      const end = at + f.length
      if (taken.slice(at, end).some(Boolean)) continue
      for (let i = at; i < end; i++) taken[i] = true
      out.push({ id, at, end })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Words that say one organism feeds on another, between their names. */
const FEEDING = /\b(eats?|eaten|eating|ate|feeds?|fed|feeding|preys?|preyed|preying|predators?|predated|hunts?|hunted|hunting|consumes?|consumed|consuming|grazes?|grazed|grazing|browses?|browsed|catch(es)?|caught|food|diet|meals?)\b|→|->|=>|<-|←/
/** "From the algae to the water flea" says an arrow when the clause is about energy or arrows. */
const ALONG = /\b(to|into|towards?)\b/
const ENERGY = /\b(energy|arrows?|pass(es|ed)?|flows?|transfer(s|red)?|points?)\b/
const ROLE_WORDS = /\b(producers?|primary|secondary|tertiary|quaternary|herbivor\w*|carnivor\w*|omnivor\w*|top predators?|apex predators?)\b/
/** The rule the draw-arrows card tests, said outright. */
const DIRECTION = [
  /from\s+(the\s+|its\s+|each\s+)?(food|prey|plants?|organisms? (that is|being) eaten)\s+to\s+(the\s+|its\s+|each\s+)?(feeders?|eaters?|consumers?|predators?|animals?|organisms? that eats?)/,
  /arrows?\s+(always\s+)?(points?|go(es)?|runs?)\s+(to|towards|at|into)\s+(the\s+)?(feeders?|eaters?|consumers?|predators?|(animals?|organisms?|ones?) (that|which|who) eats?)/,
  /arrows?\s+(always\s+)?(points?|go(es)?|runs?)\s+(away\s+)?from\s+(the\s+)?(food|prey|plants?|(organisms?|ones?) (that is|being) eaten)/,
]
/** Words that say how a population changes. */
const CHANGE_WORDS = /\b(rises?|rising|rose|increases?|increasing|increased|grows?|growing|grew|booms?|falls?|falling|fell|decreases?|decreasing|decreased|drops?|dropping|dropped|declines?|declining|declined|shrinks?|shrinking|starves?|starving|starved|dies? out|dying out|goes up|go up|goes down|go down|more|fewer)\b/
/** Asking which way is not saying which way: "rise or fall" is blanked before the check. */
const NEUTRAL = /\b(rises?|increases?|grows?|goes up|go up|up)\s*(,|or|and\/or|\/)\s*(falls?|decreases?|shrinks?|goes down|go down|down)\b|\b(falls?|decreases?|shrinks?|goes down|go down|down)\s*(,|or|and\/or|\/)\s*(rises?|increases?|grows?|goes up|go up|up)\b/g

/**
 * Why the card's prompt would give away what the scene keeps hidden until it
 * is marked: who feeds on whom (the scene's own data says that, rightly), an
 * organism's role, the organisms named in the order energy passes, the rule
 * for which way an arrow points, or how a population changes.
 */
export function promptFaults(config: FoodWebConfig, prompt: string): string[] {
  const h = habitatOf(config)
  const text = prompt.toLowerCase().replace(/[-_’]/g, (c) => (c === '’' ? "'" : ' ')).replace(NEUTRAL, (m) => ' '.repeat(m.length))
  const found = mentions(h, text)
  const clause = (i: number) => text.slice(0, i).split(/[.!?;:\n]/).length
  const snippet = (a: number, b: number) => prompt.slice(Math.max(0, a), Math.min(prompt.length, b)).trim()
  const out: string[] = []

  // Who feeds on whom, between two names in one clause.
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const [a, b] = [found[i], found[j]]
      if (a.id === b.id || clause(a.at) !== clause(b.at) || b.at - a.end > 48) continue
      const between = text.slice(a.end, b.at)
      const sentence = text.split(/[.!?;:\n]/)[clause(a.at) - 1] ?? ''
      if (FEEDING.test(between) || (ALONG.test(between) && ENERGY.test(sentence))) {
        out.push(`The prompt says who feeds on whom ("${snippet(a.at, b.end)}"): the scene supplies the feeding relationships from its own data, so name the habitat and ask, never state one.`)
        i = found.length
        break
      }
    }
  }

  // A role, next to a name.
  for (const m of found) {
    const sentence = clause(m.at)
    const near = [...text.matchAll(new RegExp(ROLE_WORDS.source, 'g'))].find((r) => {
      const at = r.index ?? 0
      return clause(at) === sentence && (at >= m.end ? at - m.end <= 32 : m.at - (at + r[0].length) <= 32)
    })
    if (near) {
      out.push(`The prompt gives the ${nameOf(h, m.id)} a role ("${snippet(Math.min(m.at, near.index ?? 0), Math.max(m.end, (near.index ?? 0) + near[0].length))}"), which the learner is to work out: ask for the roles, never state one.`)
      break
    }
  }

  // Three or more names in the order energy passes, either way: that spells a chain.
  const first: string[] = []
  for (const m of found) if (!first.includes(m.id)) first.push(m.id)
  const lv = levels(h)
  const ls = first.map((id) => lv.get(id) ?? 0)
  if (first.length >= 3 && (ls.every((l, i) => i === 0 || l > ls[i - 1]) || ls.every((l, i) => i === 0 || l < ls[i - 1]))) {
    out.push(`The prompt names ${first.map((id) => `the ${nameOf(h, id)}`).join(', ')} in the order energy passes along a chain, which gives it away: name the habitat and ask.`)
  }

  if (config.task.kind === 'draw-arrows') {
    for (const re of DIRECTION) {
      const m = text.match(re)
      if (m) {
        out.push(`The prompt says which way the arrows point ("${snippet(m.index ?? 0, (m.index ?? 0) + m[0].length)}"), which is what the card tests: ask for the energy arrows and let the learner choose their direction.`)
        break
      }
    }
  }

  if (config.task.kind === 'remove') {
    const removed = config.task.remove
    for (const m of found) {
      if (m.id === removed) continue
      const words = [...text.matchAll(new RegExp(CHANGE_WORDS.source, 'g'))]
      const said = words.find((w) => {
        const at = w.index ?? 0
        return clause(at) === clause(m.at) && (at >= m.end ? at - m.end <= 28 : m.at - (at + w[0].length) <= 20)
      })
      if (said) {
        out.push(`The prompt says what happens to the ${nameOf(h, m.id)} ("${snippet(Math.min(m.at, said.index ?? 0), Math.max(m.end, (said.index ?? 0) + said[0].length))}"), which the learner is to predict: name the species taken out and ask.`)
        break
      }
    }
  }
  return out
}

// ── The engine ──────────────────────────────────────────────────────────────

export const foodWebEngine: SceneEngine<FoodWebConfig, FoodWebState> & { promptFaults(config: FoodWebConfig, prompt: string): string[] } = {
  id: 'food-web',
  covers: ['food chains', 'food webs', 'trophic levels', 'predators and prey'],
  isolates: 'structure',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = KIND_WORDS.get(key(t.kind))
    const habitat = readHabitat(t.habitat)
    if (!kind || !habitat) return null
    if (kind !== 'remove') return { task: { kind, habitat } }
    const remove = readOrganism(WEBS[habitat], t.remove ?? t.species ?? t.organism)
    return remove ? { task: { kind, habitat, remove } } : null
  },

  faults(config) {
    if (config.task.kind !== 'remove') return []
    const h = habitatOf(config)
    if (removalEffects(h, config.task.remove).length > 0) return []
    return [
      `Taking the ${nameOf(h, config.task.remove)} out of the ${h.name} changes no population in a way the arrows alone decide (every organism linked to it has other food or other predators): remove one of ${removable(h).map((id) => `"${nameOf(h, id)}"`).join(', ')}.`,
    ]
  },

  promptFaults,

  initial(config) {
    if (config.task.kind === 'draw-arrows') return { arrows: [] }
    if (config.task.kind === 'roles') return { roles: {} }
    return { changes: {} }
  },

  check(config, state) {
    const h = habitatOf(config)
    const task = config.task
    if (task.kind === 'remove') {
      const effects = removalEffects(h, task.remove)
      const said = learnerChanges(config, state)
      return {
        ok: effects.length > 0 && effects.every((e) => said[e.id] === e.change),
        wrongIds: effects.filter((e) => said[e.id] && said[e.id] !== e.change).map((e) => e.id),
      }
    }
    if (task.kind === 'draw-arrows') {
      const { judged, ok } = judgeArrows(config, state)
      return { ok, wrongIds: judged.filter((j) => j.status !== 'right').map((j) => arrowKey(j.arrow)) }
    }
    const given = learnerRoles(config, state)
    const wrong = Object.entries(given).filter(([id, r]) => r !== roleOf(h, id)).map(([id]) => id)
    return { ok: h.organisms.every((x) => given[x.id] === roleOf(h, x.id)), wrongIds: wrong }
  },

  solve(config) {
    const h = habitatOf(config)
    const task = config.task
    if (task.kind === 'remove') return { changes: Object.fromEntries(removalEffects(h, task.remove).map((e) => [e.id, e.change])) }
    if (task.kind === 'draw-arrows') return { arrows: webArrows(h) }
    return { roles: Object.fromEntries(h.organisms.map((x) => [x.id, roleOf(h, x.id)])) }
  },

  View: FoodWebView,

  prompt: `SCENE "food-web" -- the real organisms of a habitat as cards in a ring, placed so that where a card sits never
  tells its role (producers are not drawn at the bottom). The engine supplies the organisms and who feeds on whom
  from its own sourced data: you name the habitat and the task, never a feeding relationship. Habitats:
  ${HABITATS.map((id) => `${id} (${WEBS[id].organisms.map((x) => x.name).join(', ')})`).join(';\n  ')}.
  For: food chains and food webs, energy arrows, producers and primary, secondary and tertiary consumers, predicting
  what happens when a species is removed.
  config: { "task": { "kind":"draw-arrows", "habitat":"<pond | woodland | grassland | savanna>" } }  -- field notes say
            what each animal feeds on; the learner taps one organism then another to draw each energy arrow. Marked
            wrong: an arrow from a feeder to its food (the classic error), a missing or an extra arrow.
       or { "task": { "kind":"roles", "habitat":"<habitat>" } }  -- the web's arrows are drawn; the learner names each
            organism producer, primary, secondary or tertiary consumer.
       or { "task": { "kind":"remove", "habitat":"<habitat>", "remove":"<an organism of that habitat>" } }  -- that species
            is taken out; the learner predicts whether each animal it fed or fed on rises or falls (only those the
            arrows alone decide are asked). Only these removals ask something --
            ${HABITATS.map((id) => `${id}: ${removable(WEBS[id]).map((x) => nameOf(WEBS[id], x)).join(', ')}`).join(';\n            ')}.
  - the prompt names the habitat and asks. It never says who eats whom, never gives an organism's role, never says
    which way an arrow points, and for remove never says what happens to a population.
  - to teach roles after arrows, follow a draw-arrows card with a roles card on the same habitat.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Draw the energy arrows in this pond food web.",
    "payload": { "engine":"food-web", "config": { "task": { "kind":"draw-arrows", "habitat":"pond" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:food-web", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Name the role of each organism in this woodland food web.",
    "payload": { "engine":"food-web", "config": { "task": { "kind":"roles", "habitat":"woodland" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:food-web", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"All the sticklebacks are taken out of the pond. Predict what happens to each animal marked.",
    "payload": { "engine":"food-web", "config": { "task": { "kind":"remove", "habitat":"pond", "remove":"stickleback" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:food-web", "why":"..." } }`,
}

registerEngine(foodWebEngine as SceneEngine<unknown, unknown>)
