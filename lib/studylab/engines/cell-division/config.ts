// lib/studylab/engines/cell-division-kimi31/config.ts
//
// Chromosome sets, handled rather than named. Two representative homologous pairs (one long, one short),
// already copied into sister chromatids. The learner pulls each copied chromosome to a pole and divides the cell.
// Mitosis lines every copied chromosome on the equator, then separates its two sister chromatids to opposite poles;
// meiosis separates whole homologues, then carries out its second division.
// The drawing is deliberately a model: a human cell's real 46 chromosomes could not be handled or counted on a card.
//
// Sources: Cambridge 0610 outcomes and uses (https://www.tutopiya.com/blog/cambridge-igcse-biology/mitosis-cambridge-igcse-biology/);
// what separates in each division, and the four genetically different gametes (https://learn.genetics.utah.edu/content/basics/meiosis);
// human 23 pairs / two sets (https://learn.genetics.utah.edu/content/basics/chromosomes).
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CellDivisionView } from './View'

export const CHROMOSOMES = ['long-blue', 'long-ochre', 'short-blue', 'short-ochre'] as const
export type ChromosomeId = (typeof CHROMOSOMES)[number]
export type Side = 'left' | 'right' | 'equator' | 'none'
export type DivisionState = { sides?: Partial<Record<ChromosomeId, Side>>; divided?: boolean }
export type DivisionConfig = { task: 'mitosis' | 'meiosis'; organism: 'human' | 'fruit fly' }
export type Allocation = Record<ChromosomeId, Side>

export const PAIRS = [
  { pair: 'long', a: 'long-blue' as ChromosomeId, b: 'long-ochre' as ChromosomeId },
  { pair: 'short', a: 'short-blue' as ChromosomeId, b: 'short-ochre' as ChromosomeId },
]
export const COUNTS = { human: { diploid: 46, haploid: 23 }, 'fruit fly': { diploid: 8, haploid: 4 } }

export function sidesOf(state: DivisionState | null | undefined): Allocation {
  const stored = state?.sides ?? {}
  return Object.fromEntries(CHROMOSOMES.map((id) => [id, stored[id] === 'left' || stored[id] === 'right' || stored[id] === 'equator' ? stored[id] : 'none'])) as Allocation
}

export function setSide(state: DivisionState, id: ChromosomeId, side: Side): DivisionState {
  return { sides: { ...sidesOf(state), [id]: side }, divided: false }
}

/** The chromosome sets at the two poles. Every chromosome must be handled before the membrane will divide. */
export function complete(config: DivisionConfig, state: DivisionState): boolean {
  const a = sidesOf(state)
  if (CHROMOSOMES.some((id) => a[id] === 'none') || state.divided) return false
  // Metaphase: every copied chromosome is attached to both poles at the equator. Division then
  // separates its sister chromatids, so each daughter receives every colour and every length.
  if (config.task === 'mitosis') return CHROMOSOMES.every((id) => a[id] === 'equator')
  // Each intermediate cell needs one homologue of each length. The short pair may orient either way:
  // that independent assortment is precisely what makes the colour combinations of the gametes differ.
  // Every chromosome must reach a pole: one left on the equator would otherwise pass the opposite-poles test.
  return CHROMOSOMES.every((id) => a[id] === 'left' || a[id] === 'right') && PAIRS.every((p) => a[p.a] !== a[p.b])
}

/** Exact allocation marking; the drawing is never inspected. */
export function correct(config: DivisionConfig, state: DivisionState): boolean {
  return state.divided === true && complete(config, { ...state, divided: false })
}

const keyOf = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readTask(raw: unknown): DivisionConfig['task'] | null {
  const k = keyOf(raw)
  if (['mitosis', 'mitotic', 'growth', 'repair', 'asexual', 'asexual-reproduction', 'identical-cells', 'growth-and-repair', 'sister-chromatids'].includes(k)) return 'mitosis'
  if (['meiosis', 'meiotic', 'gametes', 'gamete', 'gamete-formation', 'gametes-and-fertilisation', 'gametes-and-fertilization', 'reduction-division', 'haploid', 'sexual-reproduction', 'fertilisation', 'fertilization', 'homologous-pairs'].includes(k)) return 'meiosis'
  return null
}
function readOrganism(raw: unknown): DivisionConfig['organism'] {
  const k = keyOf(raw)
  return ['fruit-fly', 'fruit-flies', 'drosophila', 'fly', 'insect'].includes(k) ? 'fruit fly' : 'human'
}

const examplePrompt = (config: DivisionConfig) => config.task === 'mitosis'
  ? 'Drag every copied chromosome onto the equator, then press “Divide the cell”.'
  : 'Drag each copied chromosome left or right. Give each gamete one chromosome of each length, with different colour combinations, then press “Divide twice”.'

/** What the learner's allocation contains, used after marking without giving away a correct arrangement. */
export function madeText(config: DivisionConfig, state: DivisionState): string {
  const a = sidesOf(state)
  const name = (id: ChromosomeId) => id.replace('-', ' ')
  if (config.task === 'mitosis') {
    const off = CHROMOSOMES.filter((id) => a[id] !== 'equator')
    if (off.length) {
      const list = off.length === 1 ? name(off[0]) : `${off.slice(0, -1).map(name).join(', ')} and ${name(off[off.length - 1])}`
      return `Not on the equator: ${list}. Every copied chromosome must line up there so its sister chromatids can separate to opposite poles.`
    }
    if (!state.divided) return 'All four copied chromosomes are on the equator, but the cell has not divided yet.'
    return 'The copied chromosomes were aligned, but division was not completed.'
  }
  const unmoved = CHROMOSOMES.filter((id) => a[id] === 'none').length
  if (unmoved) return `${unmoved === 1 ? 'One copied chromosome is' : `${unmoved} copied chromosomes are`} still in the middle. Move every one to a pole before dividing.`
  if (!state.divided) return 'Your chromosome sets are ready at the poles, but the cell has not divided yet. Press the division button to see the result.'
  {
    if (CHROMOSOMES.some((id) => a[id] === 'equator')) return 'A copied chromosome is still on the equator. In the first division of meiosis each homologue goes to a pole.'
    const joined = PAIRS.filter((p) => a[p.a] === a[p.b])
    if (joined.length) return `The ${joined.map((p) => p.pair).join(' and ')} homologous pair${joined.length > 1 ? 's' : ''} stayed together. Homologues move to opposite poles first; sister chromatids separate in the second division.`
  }
  return 'The chromosome sets do not yet give each new cell one of every kind.'
}

export function working(config: DivisionConfig): string {
  const n = COUNTS[config.organism]
  if (config.task === 'mitosis') {
    return `Yes. Each daughter cell received one sister copy of every chromosome: two identical diploid sets, ${n.diploid} chromosomes in a ${config.organism} cell. Mitosis makes cells for growth, repair and asexual reproduction.`
  }
  return `Yes. Homologues separated, then sister chromatids. Four genetically different haploid gametes formed, each with ${n.haploid} chromosomes. Fertilisation joins two gametes and restores the diploid number, ${n.diploid}.`
}

export const cellDivisionEngine: SceneEngine<DivisionConfig, DivisionState> = {
  id: 'cell-division',
  covers: ['mitosis', 'meiosis', 'chromosomes', 'diploid', 'haploid', 'gametes'],
  phrases: [
    'cell division', 'chromosomes in cell division', 'mitosis and meiosis', 'meiosis and mitosis', 'cell cycle',
    'chromosome number', 'chromosome numbers', 'sister chromatids', 'homologous chromosomes', 'homologous pairs',
    'gametes and fertilisation', 'gametes and fertilization', 'fertilisation restores', 'fertilization restores',
    'growth and repair of cells', 'growth repair and asexual reproduction', 'asexual reproduction by mitosis',
    'reduction division', 'genetically identical daughter cells', 'genetically different gametes', 'variation from meiosis',
  ],
  notFor: [
    'punnett', 'inheritance of traits', 'monohybrid', 'genetic cross', 'alleles', 'protein synthesis', 'transcription', 'translation',
    'cell structure', 'organelles', 'diffusion', 'osmosis', 'surface area', 'reproductive organs', 'human reproductive system',
    'flower reproduction', 'pollination', 'fertilisation in flowers', 'fertilization in flowers', 'cancer', 'tumour', 'tumor',
    'stem cells', 'differentiation', 'cloning', 'genetic engineering', 'dna fingerprinting',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = first(src, nested ? ['kind', 'task', 'type', 'division'] : ['task', 'kind', 'type', 'mode', 'division'])
    const task = readTask(word)
    if (!task) return null
    return { task, organism: readOrganism(first(src, ['organism', 'species', 'cell'])) }
  },

  faults() {
    // Both semantic tasks have a complete, solvable model; unknown task words never parse.
    return []
  },

  promptFaults(config, prompt) {
    const example = examplePrompt(config)
    if (/\b(?:46|23|8|4)\s+chromosomes?\b|\b(?:46|23)\b\s*(?:→|->|to)\s*(?:23|46)\b|\b(?:two|2|four|4)\s+(?:genetically\s+)?(?:identical\s+)?(?:daughter\s+cells|gametes|cells)\b/i.test(prompt)) {
      return [`the prompt gives the chromosome counts or cell outcomes, which the card holds back until marking -- ask for the allocation and gesture only ("${example}")`]
    }
    const answer = config.task === 'mitosis'
      ? /\bsister\s+chromatids?\s+(?:separate|split|move)|\bone\s+(?:copy|chromatid).*(?:each|both)|\balternate|\balternating|\bdiploid\b|\bgenetically\s+identical\b/i.test(prompt)
      : /\bhomologous\s+pairs?\s+(?:separate|split|move)|\bkeep\s+homologous\s+pairs?\s+together|\bhaploid\b|\bgenetically\s+different\b|\bindependent\s+assortment\b/i.test(prompt)
    if (answer) return [`the prompt states the separation rule or outcome the learner is finding -- ask for the sets and gesture only ("${example}")`]
    if (/\bprophase\b|\bmetaphase\b|\banaphase\b|\btelophase\b|\binterphase\b|\bcrossing\s+over\b|\bPunnett\b|\ballele\b|\bstem\s+cell|\bcancer\b/i.test(prompt)) {
      return [`the prompt promises stages or ideas this model does not show: it starts with copied chromosomes and the learner allocates them before division ("${example}")`]
    }
    return []
  },

  initial() { return { sides: {}, divided: false } },
  check(config, state) { return { ok: correct(config, state), wrongIds: correct(config, state) ? [] : ['chromosomes'] } },
  solve(config) {
    const sides = Object.fromEntries(CHROMOSOMES.map((id) => [id, config.task === 'mitosis' ? 'equator' : id.endsWith('blue') ? 'left' : 'right'])) as Allocation
    return { sides, divided: true }
  },
  View: CellDivisionView,

  prompt: `SCENE "cell-division" -- a light microscope-style plate with a real cell membrane, spindle fibres, and two representative pairs of copied chromosomes (long and short; blue and ochre homologues), each drawn as two joined chromatids with a centromere. This is explicitly a two-pair model, not all 46 human chromosomes. Every chromosome has a white arrow handle. In mitosis drag each X onto the dashed equator (or focus it and use arrow keys); division visibly splits every X into sister chromatids going to opposite poles, then shows two daughters each containing all four colours and lengths. In meiosis drag each X broadly left or right: its chromatids and spindle attachments move. The membrane pinches only after a division press; meiosis visibly carries out a second split and shows four gametes with small exchanged colour tips, so the gametes differ. Before marking no outcome counts or correctness are shown. Wrong marking says what the learner allocated; right marking gives human 46/23 (or fruit fly 8/4), diploid/haploid and the biological purpose.
  For: mitosis, meiosis, chromosomes in cell division, sister chromatids versus homologous pairs, maintaining/halving chromosome number, diploid and haploid, growth/repair/asexual reproduction, gametes and fertilisation restoring the diploid number, variation from meiosis.
  config: { "task":"mitosis"|"meiosis", "organism":"human" (default)|"fruit fly" }.
  mitosis: put every copied chromosome on the equator, then divide once; sister chromatids separate automatically and both daughters get all four kinds. meiosis: separate each homologous pair, so every pole receives one long and one short copied chromosome; either independent orientation of the short pair is correct, then divide twice.
  Not shown: DNA replication happening, named mitotic stages, detailed meiotic stage names, crossing over as a controllable event, Punnett squares, alleles, protein synthesis, stem cells, cancer, organ anatomy or all chromosomes at life size. Do not put 46, 23, 8, 4, the daughter/gamete counts, the separation rule, diploid/haploid or identical/different outcomes in the prompt.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag every copied chromosome onto the equator, then press “Divide the cell”.",
    "payload": { "engine":"cell-division", "config": { "task":"mitosis", "organism":"human" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cell-division", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each copied chromosome left or right. Give each gamete one chromosome of each length, with different colour combinations, then press “Divide twice”.",
    "payload": { "engine":"cell-division", "config": { "task":"meiosis", "organism":"human" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cell-division", "why":"..." } }`,
}

registerEngine(cellDivisionEngine as SceneEngine<unknown, unknown>)
