import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LabBenchView } from './View'

/*
 * Separating mixtures, as the syllabus teaches it:
 * - Cambridge IGCSE Chemistry 0620 (syllabus for 2023, 2024 and 2025), topic 12, "Experimental techniques
 *   and chemical analysis":
 *   - 12.1: the terms solvent, solute, solution, saturated solution, residue and filtrate;
 *   - 12.3: paper chromatography separates mixtures of soluble coloured substances in a suitable solvent
 *     (pencil baseline, solvent front);
 *   - 12.4: separation and purification by a suitable solvent, filtration, crystallisation, simple
 *     distillation and fractional distillation, and suggesting the technique from the substances' properties.
 * - Cambridge Lower Secondary Science (0893), chemistry strand "Properties of materials": separating mixtures
 *   by filtering, evaporating, distilling and paper chromatography.
 * - Iron filings and sulfur: the standard lower secondary mixture-or-compound demonstration. A magnet pulls
 *   the iron out of the mixture; heating makes the compound iron(II) sulfide (Fe + S -> FeS) instead.
 * - Boiling points at 1 atm: water 100 °C, ethanol 78 °C (CRC Handbook of Chemistry and Physics).
 *
 * What a method "gets" is worked out from each substance's properties (liquid and boiling point, dissolves in
 * water, magnetic, coloured), never written per pair; the tests pin the result to the syllabus answers.
 */

/** The shelf, in order. Each apparatus carries out one method. */
export const METHODS = ['filtration', 'evaporation', 'simple-distillation', 'fractional-distillation', 'chromatography', 'magnet'] as const
export type MethodId = (typeof METHODS)[number]

/** What the shelf shows: the apparatus are the choices, so their names may be seen before marking. */
export const APPARATUS: Record<MethodId, string> = {
  filtration: 'Filter funnel and paper',
  evaporation: 'Evaporating basin and Bunsen',
  'simple-distillation': 'Distillation set-up',
  'fractional-distillation': 'Fractionating column',
  chromatography: 'Chromatography paper and solvent',
  magnet: 'Magnet',
}

/** The method each apparatus carries out: said only once the choice is marked. */
export const METHOD_NAMES: Record<MethodId, string> = {
  filtration: 'filtration',
  evaporation: 'evaporation',
  'simple-distillation': 'simple distillation',
  'fractional-distillation': 'fractional distillation',
  chromatography: 'paper chromatography',
  magnet: 'a magnet',
}

export type SubstanceId = 'water' | 'ethanol' | 'salt' | 'sand' | 'dyes' | 'iron' | 'sulfur'
export type DyeColour = 'blue' | 'red' | 'yellow'

export interface Substance {
  /** Its name, said once marked. */
  name: string
  /** A liquid: its boiling point, °C at 1 atm. */
  boils?: number
  /** A solid that dissolves in water. */
  dissolves?: boolean
  magnetic?: boolean
  /** How it looks on its own, never naming it: what the learner sees before marking. */
  looks: string
  /** A mixture of dyes: each climbs chromatography paper to its own height (its Rf). */
  dyes?: readonly { colour: DyeColour; rf: number }[]
}

export const SUBSTANCES: Record<SubstanceId, Substance> = {
  water: { name: 'water', boils: 100, looks: 'a clear, colourless liquid' },
  ethanol: { name: 'ethanol', boils: 78, looks: 'a clear, colourless liquid' },
  salt: { name: 'salt', dissolves: true, looks: 'white crystals' },
  sand: { name: 'sand', looks: 'pale brown grains' },
  // A black ink of three water-soluble dyes. The Rf values are illustrative: real ones depend on the ink, the paper and the solvent.
  dyes: { name: 'dyes', dissolves: true, looks: 'a dark, inky solid', dyes: [{ colour: 'blue', rf: 0.25 }, { colour: 'red', rf: 0.55 }, { colour: 'yellow', rf: 0.85 }] },
  iron: { name: 'iron filings', magnetic: true, looks: 'grey filings' },
  sulfur: { name: 'sulfur', looks: 'yellow powder' },
}

export type MixtureId = 'sand-salt-water' | 'salt-water' | 'ethanol-water' | 'ink' | 'iron-sulfur'

export interface Mixture {
  name: string
  parts: readonly SubstanceId[]
  /** The parts the tutor may ask for. Each is got by one method, or one family of them (the tests prove it). */
  wants: readonly SubstanceId[]
  /** Heating makes a new substance instead of separating. */
  heated?: { name: string; looks: string }
  /** Other ways the tutor may write it. */
  also?: readonly string[]
}

/**
 * The mixtures the bench can honestly separate. Sand and plain water is left out on purpose: evaporating it
 * leaves the sand as surely as filtering does, so "get the sand" would have two right answers. With salt in
 * the water, only filtration gets the sand on its own.
 */
export const MIXTURES: Record<MixtureId, Mixture> = {
  'sand-salt-water': { name: 'sand and salt water', parts: ['sand', 'salt', 'water'], wants: ['sand', 'water'], also: ['sand, salt and water', 'salty sand and water'] },
  'salt-water': { name: 'salt water', parts: ['salt', 'water'], wants: ['salt', 'water'], also: ['seawater', 'sea water', 'salt solution', 'salty water', 'salt and water', 'brine', 'sodium chloride solution'] },
  'ethanol-water': { name: 'ethanol and water', parts: ['ethanol', 'water'], wants: ['ethanol'], also: ['alcohol and water'] },
  ink: { name: 'ink', parts: ['dyes', 'water'], wants: ['dyes', 'water'], also: ['black ink', 'ink dyes', 'ink and water'] },
  'iron-sulfur': { name: 'iron filings and sulfur', parts: ['iron', 'sulfur'], wants: ['iron', 'sulfur'], heated: { name: 'iron(II) sulfide', looks: 'a black solid' } },
}

/** Other ways of naming each wanted part. */
const WANT_WORDS: Record<SubstanceId, readonly string[]> = {
  water: ['water', 'distilled water'],
  ethanol: ['ethanol', 'alcohol'],
  salt: ['salt', 'sodium chloride', 'salt crystals'],
  sand: ['sand'],
  dyes: ['dyes', 'dye', 'colours', 'colors', 'pigments'],
  iron: ['iron'],
  sulfur: ['sulfur'],
}

export type LabBenchConfig = { task: { kind: 'separate'; mixture: MixtureId; want: SubstanceId } }
/** The apparatus the learner has picked, or none yet. */
export type LabBenchState = { method: MethodId | null }

/** What a method did with a mixture: what ended up where. */
export type Outcome =
  | { method: 'filtration'; dry: boolean; residue: SubstanceId[]; filtrate: SubstanceId[] }
  | { method: 'evaporation'; reacted: boolean; lost: SubstanceId[]; left: SubstanceId[] }
  | { method: 'simple-distillation' | 'fractional-distillation'; reacted: boolean; distillate: SubstanceId[]; flask: SubstanceId[]; reading: number | null }
  | { method: 'chromatography'; moved: SubstanceId[]; stayed: SubstanceId[]; unseen: SubstanceId[] }
  | { method: 'magnet'; pulled: SubstanceId[]; left: SubstanceId[] }

const isLiquid = (id: SubstanceId) => SUBSTANCES[id].boils !== undefined
const isDyes = (id: SubstanceId) => !!SUBSTANCES[id].dyes

/** A mixture's parts by kind: liquids from the lowest boiling point, and which solids are dissolved. */
export function split(mixture: MixtureId) {
  const parts = MIXTURES[mixture].parts
  const liquids = parts.filter(isLiquid).sort((a, b) => SUBSTANCES[a].boils! - SUBSTANCES[b].boils!)
  const solids = parts.filter((p) => !isLiquid(p))
  const dissolved = liquids.length ? solids.filter((s) => SUBSTANCES[s].dissolves) : []
  const undissolved = solids.filter((s) => !dissolved.includes(s))
  return { liquids, solids, dissolved, undissolved }
}

/** Runs a method on a mixture: the separation follows from the parts' properties alone. */
export function run(mixture: MixtureId, method: MethodId): Outcome {
  const { liquids, solids, dissolved, undissolved } = split(mixture)
  const reacted = !!MIXTURES[mixture].heated
  switch (method) {
    case 'filtration':
      // The paper holds back undissolved solids; a liquid carries what is dissolved in it through.
      return liquids.length
        ? { method, dry: false, residue: undissolved, filtrate: [...dissolved, ...liquids] }
        : { method, dry: true, residue: [...solids], filtrate: [] }
    case 'evaporation':
      // An open basin heated to dryness: every liquid goes into the air, every solid stays.
      return reacted ? { method, reacted, lost: [], left: [] } : { method, reacted, lost: liquids, left: solids }
    case 'simple-distillation':
    case 'fractional-distillation': {
      if (reacted) return { method, reacted, distillate: [], flask: [], reading: null }
      // Simple: every liquid in the mixture boils over together (the bench has no two liquids far enough
      // apart to part in one boiling). Fractional: the column sends the lowest-boiling liquid over first.
      const distillate = method === 'fractional-distillation' ? liquids.slice(0, 1) : liquids
      // A flask is never boiled dry: the solids stay in what liquid is left.
      const kept = method === 'fractional-distillation' && liquids.length > 1 ? liquids.slice(1) : liquids
      const reading = distillate.length === 1 ? SUBSTANCES[distillate[0]].boils! : null
      return { method, reacted, distillate, flask: [...solids, ...kept], reading }
    }
    case 'chromatography': {
      // The solvent is water. Dissolved coloured substances climb the paper; what does not dissolve stays on
      // the pencil line; liquids and colourless solutes leave nothing to see.
      const moved = dissolved.filter(isDyes)
      return { method, moved, stayed: undissolved, unseen: [...liquids, ...dissolved.filter((s) => !isDyes(s))] }
    }
    case 'magnet': {
      const pulled = solids.filter((s) => SUBSTANCES[s].magnetic)
      return { method, pulled, left: MIXTURES[mixture].parts.filter((p) => !pulled.includes(p)) }
    }
  }
}

/** One part on its own; a mix of dyes only counts once its dyes are apart. */
const alone = (ids: SubstanceId[]): SubstanceId[] => (ids.length === 1 && !isDyes(ids[0]) ? ids : [])

/** The parts a method collected on their own. */
export function gets(o: Outcome): SubstanceId[] {
  switch (o.method) {
    case 'filtration':
      return o.dry ? alone(o.residue) : [...alone(o.residue), ...alone(o.filtrate)]
    case 'evaporation':
      return o.reacted ? [] : alone(o.left)
    case 'simple-distillation':
    case 'fractional-distillation':
      return o.reacted ? [] : alone(o.distillate)
    case 'chromatography':
      return o.moved.filter((s) => (SUBSTANCES[s].dyes?.length ?? 0) > 1)
    case 'magnet':
      return o.pulled.length ? [...alone(o.pulled), ...alone(o.left)] : []
  }
}

/** The methods that get the wanted part on its own. */
export function rightMethods(mixture: MixtureId, want: SubstanceId): MethodId[] {
  return METHODS.filter((m) => gets(run(mixture, m)).includes(want))
}

// ---- Words -------------------------------------------------------------------------------------------

/** "a", "a and b", "a, b and c". */
export const list = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** The parts' names: "sand, salt and water". */
export const names = (ids: readonly SubstanceId[]) => list(ids.map((id) => SUBSTANCES[id].name))
const looks = (ids: readonly SubstanceId[]) => list(ids.map((id) => SUBSTANCES[id].looks))
const liquidLooks = (ids: readonly SubstanceId[]) => (ids.some(isDyes) ? 'a dark, inky liquid' : 'a clear, colourless liquid')
/** A place's contents as seen: a liquid with what is suspended in it, or the solids. */
function mixLooks(ids: readonly SubstanceId[]): string {
  if (!ids.some(isLiquid)) return looks(ids)
  const stuck = ids.filter((id) => !isLiquid(id) && !SUBSTANCES[id].dissolves)
  return `${liquidLooks(ids)}${stuck.length ? ` with ${looks(stuck)} in it` : ''}`
}
const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five']

/** What the wanted part is called on the card: the goal, never the method. */
export function wantLabel(want: SubstanceId): string {
  return want === 'dyes' ? 'each dye on its own' : `the ${SUBSTANCES[want].name}`
}

/**
 * What the learner sees the apparatus do, in looks only: no method's name and no substance's, so the
 * learner reasons from "white crystals" to salt. Shown before marking.
 */
export function observe(mixture: MixtureId, method: MethodId): string {
  const o = run(mixture, method)
  const product = MIXTURES[mixture].heated?.looks ?? 'something new'
  switch (o.method) {
    case 'filtration':
      if (o.dry) return `Everything stayed on the paper: ${looks(o.residue)}. Nothing ran through into the flask.`
      return `${o.residue.length ? `Left on the paper: ${looks(o.residue)}.` : 'Nothing was left on the paper.'} Ran through into the flask: ${liquidLooks(o.filtrate)}.`
    case 'evaporation':
      if (o.reacted) return `The powders glowed red-hot and turned into ${product}.`
      return `${o.lost.length === 1 && o.lost[0] === 'water' ? 'Steam' : 'Vapour'} rose from the basin until no liquid was left. ${o.left.length ? `Left in the basin: ${looks(o.left)}.` : 'The basin was left empty.'}`
    case 'simple-distillation':
    case 'fractional-distillation': {
      if (o.reacted) return `The powders in the flask glowed red-hot and turned into ${product}. Nothing dripped into the beaker.`
      const temp = o.reading !== null ? `The thermometer held at ${o.reading} °C.` : 'The thermometer reading kept rising.'
      return `${temp} Dripped into the beaker: ${liquidLooks(o.distillate)}. Left in the flask: ${mixLooks(o.flask)}.`
    }
    case 'chromatography': {
      const dyes = o.moved.flatMap((s) => SUBSTANCES[s].dyes ?? [])
      if (dyes.length) return `The solvent soaked up the paper, and the spot spread into ${NUMBERS[dyes.length]} spots at different heights: ${list(dyes.map((d) => d.colour))}.`
      if (o.stayed.length) return `The solvent soaked up the paper; ${looks(o.stayed)} stayed on the pencil line.`
      return 'The solvent soaked up the paper; no spots could be seen.'
    }
    case 'magnet':
      if (o.pulled.length) return `${cap(looks(o.pulled))} jumped onto the magnet. Left in the dish: ${mixLooks(o.left)}.`
      return 'Nothing stuck to the magnet; the mixture stayed in the dish.'
  }
}

/**
 * What the method did, with every part named: shown once marked. When it is wrong it says honestly where the
 * wanted part went ("Filtration let the dissolved salt through with the water").
 */
export function explain(mixture: MixtureId, method: MethodId, want: SubstanceId): string {
  const m = MIXTURES[mixture]
  const o = run(mixture, method)
  const { liquids, dissolved } = split(mixture)
  const w = SUBSTANCES[want].name
  const got = gets(o).includes(want)
  const heated = `Heating made the ${names(m.parts)} react to form ${m.heated?.name}, a new substance`
  switch (o.method) {
    case 'filtration': {
      if (o.dry) return `Filtration needs a liquid to carry something through the paper: the dry ${names(o.residue)} stayed on it together.`
      const still = liquids.includes(want) && dissolved.length ? ` The ${w} still has the ${names(dissolved)} in it.` : ''
      if (!o.residue.length && dissolved.length) return `Filtration let the dissolved ${names(dissolved)} through with the ${names(liquids)}; nothing was left on the paper.${still}`
      if (!o.residue.length) return `Filtration let the ${names(liquids)} straight through: liquids that mix pass through the paper together.`
      const through = dissolved.length ? `the ${names(liquids)}, with the ${names(dissolved)} dissolved in it,` : `the ${names(liquids)}`
      return `Filtration kept the ${names(o.residue)} on the paper as the residue, and ${through} ran through as the filtrate.${still}`
    }
    case 'evaporation': {
      if (o.reacted) return `${heated}, instead of separating them.`
      const off = `Evaporation boiled the ${names(o.lost)} off into the air${o.lost.length === 1 && o.lost[0] === 'water' ? ' as steam' : ''}`
      const lost = o.lost.includes(want) ? ` The ${w} was lost.` : ''
      if (!o.left.length) return `${off}, leaving the basin empty.${lost}`
      const one = o.left.length === 1 ? o.left[0] : null
      const left = one && isDyes(one) ? 'all the dyes together in the basin as one dark solid'
        : one ? `the ${names(o.left)} in the basin as ${SUBSTANCES[one].looks}`
        : `the ${names(o.left)} together in the basin`
      const apart = want === 'dyes' ? ' The dyes were not separated from each other.' : ''
      const also = got && dissolved.includes(want) ? ` Crystallisation, heating only until crystals start to form and then leaving it to cool, gets the ${w} too.` : ''
      return `${off}, leaving ${left}.${lost}${apart}${also}`
    }
    case 'simple-distillation':
    case 'fractional-distillation': {
      const Name = cap(METHOD_NAMES[o.method])
      if (o.reacted) return `${heated}; nothing distilled over.`
      if (o.distillate.length > 1) {
        const [low, ...rest] = o.distillate
        const bps = list(o.distillate.map((id) => `${SUBSTANCES[id].boils} °C`))
        return `${Name} boiled off the ${SUBSTANCES[low].name} with a lot of the ${names(rest)}: at ${bps}, their boiling points are too close for one boiling to separate them.`
      }
      if (liquids.length > 1) {
        const [low, ...rest] = liquids
        return `${Name} separated them: in the column the ${names(rest)} condenses and runs back, so the ${SUBSTANCES[low].name}, which boils at ${SUBSTANCES[low].boils} °C, distilled over first.`
      }
      const l = SUBSTANCES[o.distillate[0]].name
      let s = `${Name} boiled the ${l} off and condensed it back to a liquid: the distillate is pure ${l}.`
      const solids = o.flask.filter((id) => !isLiquid(id))
      if (solids.length) s += ` The ${names(solids)} stayed in the flask, in the ${l} left there${solids.some(isDyes) ? ', still mixed together' : ''}.`
      if (solids.includes(want)) s += isDyes(want) ? ' The dyes were not separated from each other.' : ` A flask is never boiled dry, so the ${w} was not collected on its own.`
      if (got && o.method === 'fractional-distillation') s += ` Only the ${l} boils here, so the column was not needed: simple distillation does the same.`
      return s
    }
    case 'chromatography': {
      if (o.moved.length) {
        const s = 'Paper chromatography carried each dye up the paper at its own speed, so the dyes separated into their own spots.'
        return liquids.includes(want) ? `${s} The ${w} just soaked into the paper; none was collected.` : s
      }
      const why: string[] = []
      if (o.stayed.length) why.push(`the ${names(o.stayed)} did not dissolve, so ${o.stayed.length > 1 ? 'they' : 'it'} stayed on the pencil line${o.stayed.length > 1 ? ', still mixed' : ''}`)
      const colourless = o.unseen.filter((id) => !isLiquid(id))
      if (colourless.length) why.push(`the ${names(colourless)} ${colourless.length > 1 ? 'are' : 'is'} colourless, so ${colourless.length > 1 ? 'they' : 'it'} could not be seen`)
      if (!why.length) why.push(`the ${names(o.unseen)} just soaked into the paper`)
      return `Paper chromatography separates coloured substances that dissolve in the solvent, as spots on the paper: ${why.join('; ')}. Nothing was collected.`
    }
    case 'magnet':
      if (o.pulled.length) return `The magnet pulled the ${names(o.pulled)} out, leaving the ${names(o.left)} behind in the dish.`
      return `Nothing in the ${m.name} is magnetic, so the magnet picked nothing out.`
  }
}

// ---- Reading the tutor's config -----------------------------------------------------------------------

const DROP = new Set(['a', 'an', 'the', 'and', 'with', 'in', 'of', 'mixture', 'mixed', 'some', 'filings', 'powder', 'pure', 'separate', 'separated', 'each', 'its', 'own', 'on', 'out', 'from', 'get', 'only'])

/** A phrase as an order-free key: "Iron and sulphur" and "sulfur-iron mixture" both read "iron sulfur". */
function key(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const words = raw.toLowerCase().replace(/sulph/g, 'sulf').replace(/[^a-z]+/g, ' ').trim().split(' ').filter((w) => w && !DROP.has(w))
  return words.length ? words.sort().join(' ') : null
}

const MIXTURE_KEYS = new Map<string, MixtureId>()
for (const id of Object.keys(MIXTURES) as MixtureId[]) {
  for (const phrase of [id, MIXTURES[id].name, ...(MIXTURES[id].also ?? [])]) MIXTURE_KEYS.set(key(phrase)!, id)
}
const WANT_KEYS = new Map<string, SubstanceId>()
for (const id of Object.keys(WANT_WORDS) as SubstanceId[]) for (const phrase of WANT_WORDS[id]) WANT_KEYS.set(key(phrase)!, id)

/** Every phrase the engine reads for each mixture and wanted part, for the tests. */
export const PHRASES = {
  mixtures: [...MIXTURE_KEYS.keys()],
  wants: (Object.keys(WANT_WORDS) as SubstanceId[]).flatMap((id) => WANT_WORDS[id].map((p) => ({ id, p }))),
}

export const labBenchEngine: SceneEngine<LabBenchConfig, LabBenchState> = {
  id: 'lab-bench',
  covers: [
    'separating mixtures', 'choosing a separation method', 'filtration (residue and filtrate)', 'evaporation and crystallisation',
    'simple distillation', 'fractional distillation', 'paper chromatography', 'separating iron with a magnet', 'mixtures and compounds (iron and sulfur)',
  ],
  isolates: 'category',

  parse(raw) {
    const task = (raw as { task?: { kind?: unknown; mixture?: unknown; want?: unknown } } | null)?.task
    if (!task || typeof task !== 'object' || task.kind !== 'separate') return null
    const mk = key(task.mixture)
    const wk = key(task.want)
    const mixture = mk ? MIXTURE_KEYS.get(mk) : undefined
    const want = wk ? WANT_KEYS.get(wk) : undefined
    if (!mixture || !want || !MIXTURES[mixture].wants.includes(want)) return null
    return { task: { kind: 'separate', mixture, want } }
  },

  // Parse admits only the table's pairs, and the tests prove each has a right method; this guards the table.
  faults(config) {
    const { mixture, want } = config.task
    return rightMethods(mixture, want).length ? [] : [`no apparatus on the shelf gets ${wantLabel(want)} out of ${MIXTURES[mixture].name}; ask for another part`]
  },

  // Choosing the method is the task: a prompt that names one has chosen it.
  promptFaults(_config, prompt) {
    const named = /\bfilt(er|ration|ering)|\bevaporat|\bcrystalli[sz]|\bdistil|\bchromatograph|\bmagnet/i.exec(prompt)
    return named ? [`the prompt names the method ("${named[0]}"), which the learner is to choose from the shelf -- write the job instead ("Get the salt out of this salt water.")`] : []
  },

  initial() {
    return { method: null }
  },

  check(config, state) {
    const method = state?.method
    return { ok: !!method && rightMethods(config.task.mixture, config.task.want).includes(method), wrongIds: [] }
  },

  solve(config) {
    return { method: rightMethods(config.task.mixture, config.task.want)[0] }
  },

  View: LabBenchView,

  prompt: `SCENE "lab-bench" -- a lab bench with a mixture in a beaker and a shelf of apparatus: filter funnel and
  paper, evaporating basin and Bunsen, distillation set-up, fractionating column, chromatography paper and solvent,
  magnet. The learner picks one; the engine runs it on the mixture and shows what collects where (residue,
  filtrate, distillate, spots, on the magnet). It is marked right when that apparatus gets the wanted part on its
  own, and says honestly what a wrong one did. For: separating mixtures, choosing a separation method,
  filtration, evaporation and crystallisation, simple and fractional distillation, paper chromatography, magnets.
  config: { "task": { "kind":"separate", "mixture":"<mixture>", "want":"<part>" } }, these pairs only:
    "sand and salt water" -> "sand" | "water"      "salt water" -> "salt" | "water"
    "ethanol and water" -> "ethanol"               "ink" -> "dyes" | "water"
    "iron and sulfur" -> "iron" | "sulfur"
  (Sand and plain water is not offered: evaporating it leaves the sand too, so it has no single right answer.)
  Write the prompt as the job ("Get the salt out of this salt water"); never name the method.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Get the salt out of this salt water.",
    "payload": { "engine":"lab-bench", "config": { "task": { "kind":"separate", "mixture":"salt water", "want":"salt" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:lab-bench", "why":"..." } }`,
}

registerEngine(labBenchEngine as SceneEngine<unknown, unknown>)
