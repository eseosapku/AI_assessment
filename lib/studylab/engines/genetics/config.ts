// lib/studylab/engines/genetics/config.ts
//
// Two ideas of school genetics, each handled with the hands:
//   cross  -- a Punnett square of one gene. Each parent shows two allele tiles; the tiles ARE the gametes along the
//             square's top and side. The learner taps a tile to change which allele it is, and the four offspring
//             in the square redraw at once, as real flowers, peas or plants. The task is to set the parents so a
//             stated number of the four boxes show one form. Working backwards from offspring to parents is the
//             hard half of the topic, and the square is the instrument.
//   mutate -- DNA to protein. A short real stretch of a gene is a row of bases, copied below as mRNA and read in
//             threes into amino acids. The learner taps one DNA base to change it, and the protein chain answers:
//             a bead the same, a bead different, or a stop sign where the chain ends. The task is to change one
//             base so that a stated thing happens to the protein.
//
// The rules, all computed here and never read from the drawing:
//   - an offspring box shows the dominant form when it holds at least one dominant allele;
//   - the number of boxes showing a form is counted from the square;
//   - translation uses the standard genetic code (64 codons), read from the mRNA that is the complement of the DNA;
//   - a change is silent if the protein is identical, nonsense if a stop codon appears, otherwise missense.
//
// Facts:
//   - the traits are Mendel's pea traits: purple (dominant) over white flowers, yellow over green seeds, tall over
//     short plants (Mendel 1866; any school genetics text);
//   - genetic code table, in TCAG order: the NCBI "standard code" (translation table 1);
//   - beta-globin codons 5-8 are CCU GAG GAG AAG (Pro Glu Glu Lys), the stretch whose codon 6 GAG -> GUG is the
//     sickle-cell change (HBB); the insulin stretch UUU GUG AAC CAA (Phe Val Asn Gln) opens the B chain, written
//     from general knowledge of the insulin gene. Neither is a whole gene: each is "a stretch of" it, and no stretch
//     starts at a start codon, so no mutation here loses a start. The third, a made-up stretch, is called a practice one.
//
// Ideas taken, never code or art:
//   - the one move that makes a mutation obvious is to make it yourself and watch the chain: the sickle-cell
//     GAG -> GTG demonstration in open mutation-impact simulators, which are text printouts, so the picture is ours;
//   - why the code lets so many single changes pass unseen: the redundancy of the code, as the SUNY microbiology notes
//     on silent, missense and nonsense mutations put it (GAA -> GAG, GAA -> GUA, GAA -> UAA);
//   - the classroom misconception that a Punnett square predicts a real family. It shows the chance for one offspring,
//     which is why a box is called "one possible offspring", and the result text says so after marking.
// Refused for later: pedigrees (a tree of people with a rule is a different drawing), two genes at once (a 4x4
// square), incomplete dominance and sex linkage (separate rules), frameshifts (a different reading), and drawing the
// ribosome and tRNA (a row of labels and no act).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { GeneticsView } from './View'

export type TraitKey = 'flower' | 'pea' | 'height'
export const TRAIT_KEYS: TraitKey[] = ['flower', 'pea', 'height']
export const TRAITS: Record<TraitKey, { name: string; letter: string; dom: string; rec: string; noun: string }> = {
  flower: { name: 'flower colour', letter: 'P', dom: 'purple', rec: 'white', noun: 'flowers' },
  pea: { name: 'pea colour', letter: 'Y', dom: 'yellow', rec: 'green', noun: 'peas' },
  height: { name: 'plant height', letter: 'T', dom: 'tall', rec: 'short', noun: 'plants' },
}

export type Form = 'dominant' | 'recessive'
export const EFFECTS = ['silent', 'missense', 'nonsense'] as const
export type Effect = (typeof EFFECTS)[number]

export type GenConfig =
  /** trait: a key, or any word (faults says what would work). given: parent 1's dominant alleles (0-2), or null when both are free. count: boxes of the four showing `form`. */
  | { task: 'cross'; trait: string; given: number | null; form: Form; count: number }
  /** gene: a key, or any word. effect: what the one changed base must do to the protein. */
  | { task: 'mutate'; gene: string; effect: string }

/** cross: a and b are the dominant alleles each parent holds (0, 1 or 2). mutate: the DNA as it stands now. */
export type GenState = { a?: number; b?: number; bases?: string }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ---------------------------------------------------------------------------
// Crosses.

export const SHARE_WORDS = ['none', 'a quarter', 'half', 'three quarters', 'all']
const NUM_WORDS = ['none', 'one', 'two', 'three', 'all']

const traitOf = (c: { trait: string }) => (has(TRAITS, c.trait) ? TRAITS[c.trait as TraitKey] : TRAITS.flower)

/** Alleles in one parent's two gametes, dominant first: true is the dominant allele. */
export const gametes = (dominant: number): boolean[] => [0, 1].map((i) => i < dominant)

export type Box = { n: number; shows: 'dominant' | 'recessive' }
/** The square: rows are parent 2's gametes, columns are parent 1's. `n` counts the dominant alleles in the offspring. */
export function squareOf(a: number, b: number): Box[][] {
  return gametes(b).map((gb) => gametes(a).map((ga) => { const n = Number(ga) + Number(gb); return { n, shows: n >= 1 ? 'dominant' : 'recessive' } }))
}

export function showing(a: number, b: number, form: Form): number {
  return squareOf(a, b).flat().filter((x) => x.shows === form).length
}

export function genotypeText(letter: string, dominant: number): string {
  const lower = letter.toLowerCase()
  return dominant >= 2 ? letter + letter : dominant === 1 ? letter + lower : lower + lower
}

const near = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 2 ? v : d)

/** The parents as the learner has set them, with a fixed parent 1 always as given. */
export function parentsOf(config: GenConfig, state: GenState): { a: number; b: number } {
  if (config.task !== 'cross') return { a: 2, b: 2 }
  return { a: config.given !== null && Number.isInteger(config.given) ? near(config.given, 2) : near(state?.a, 2), b: near(state?.b, 2) }
}

const ORDER: [number, number][] = [[2, 2], [0, 0], [1, 1], [2, 0], [2, 1], [1, 0], [0, 1], [0, 2], [1, 2]]
/** Every pair of parents the learner can make. */
export function crossOptions(config: Extract<GenConfig, { task: 'cross' }>): { a: number; b: number }[] {
  const g = config.given !== null && Number.isInteger(config.given) && config.given >= 0 && config.given <= 2 ? config.given : null
  return ORDER.filter(([a]) => g === null || a === g).map(([a, b]) => ({ a, b }))
}
const solves = (c: Extract<GenConfig, { task: 'cross' }>, p: { a: number; b: number }) => showing(p.a, p.b, c.form) === c.count

// ---------------------------------------------------------------------------
// DNA to protein.

const BASES = 'TCAG'
// NCBI standard code, translation table 1, in TCAG order (first base slowest).
const CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'
const AMINO: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
}
export const STOP = '*'

/** The amino acid letter for an mRNA codon (U or T both read as T), or `*` for stop. */
export function aminoOf(codon: string): string {
  const c = codon.replace(/U/g, 'T')
  return CODE[16 * BASES.indexOf(c[0]) + 4 * BASES.indexOf(c[1]) + BASES.indexOf(c[2])]
}
export const aminoName = (letter: string) => AMINO[letter] ?? '?'

export const GENES = {
  'beta-globin': { name: 'beta-globin', mrna: 'CCUGAGGAGAAG' },
  insulin: { name: 'insulin', mrna: 'UUUGUGAACCAA' },
  practice: { name: 'practice gene', mrna: 'GCUUCCGGACUG' },
} as const
export type GeneKey = keyof typeof GENES
export const GENE_KEYS = Object.keys(GENES) as GeneKey[]
export const BASE_COUNT = 12

const PAIR_DNA_TO_RNA: Record<string, string> = { A: 'U', T: 'A', C: 'G', G: 'C' }
const PAIR_RNA_TO_DNA: Record<string, string> = { A: 'T', U: 'A', G: 'C', C: 'G' }
export const mrnaOf = (dna: string) => [...dna].map((b) => PAIR_DNA_TO_RNA[b] ?? '?').join('')
export const dnaOfMrna = (rna: string) => [...rna].map((b) => PAIR_RNA_TO_DNA[b] ?? '?').join('')
export const codonsOf = (s: string): string[] => Array.from({ length: Math.floor(s.length / 3) }, (_, i) => s.slice(i * 3, i * 3 + 3))

const geneOf = (c: { gene: string }) => (has(GENES, c.gene) ? GENES[c.gene as GeneKey] : GENES.practice)
/** The DNA the learner starts from: the strand that is read, the complement of the gene's mRNA. */
export const originalDna = (config: Extract<GenConfig, { task: 'mutate' }>) => dnaOfMrna(geneOf(config).mrna)

/** The chain a strand makes: amino acid letters, ending at the first stop (which is recorded, not a bead). */
export function proteinOf(dna: string): { chain: string[]; stopAt: number } {
  const chain: string[] = []
  const codons = codonsOf(mrnaOf(dna))
  for (let i = 0; i < codons.length; i++) {
    const a = aminoOf(codons[i])
    if (a === STOP) return { chain, stopAt: i }
    chain.push(a)
  }
  return { chain, stopAt: -1 }
}

export function effectOf(before: string, after: string): Effect {
  const p = proteinOf(before)
  const q = proteinOf(after)
  if (q.stopAt >= 0 && p.stopAt < 0) return 'nonsense'
  return p.chain.join('') === q.chain.join('') && p.stopAt === q.stopAt ? 'silent' : 'missense'
}

/** The strand now, read safely: anything else counts as unchanged. */
export function basesOf(config: GenConfig, state: GenState): string {
  const start = config.task === 'mutate' ? originalDna(config) : ''
  const s = state?.bases
  return typeof s === 'string' && /^[ACGT]+$/.test(s) && s.length === start.length ? s : start
}
export const changedAt = (config: Extract<GenConfig, { task: 'mutate' }>, state: GenState): number[] => {
  const was = originalDna(config)
  const now = basesOf(config, state)
  return [...now].map((b, i) => (b === was[i] ? -1 : i)).filter((i) => i >= 0)
}
export const nextBase = (b: string) => 'ACGT'[('ACGT'.indexOf(b) + 1) % 4]

/** Every single change and what it does, in position order. */
export function singleChanges(config: Extract<GenConfig, { task: 'mutate' }>): { at: number; base: string; effect: Effect; dna: string }[] {
  const was = originalDna(config)
  const out: { at: number; base: string; effect: Effect; dna: string }[] = []
  for (let at = 0; at < was.length; at++) {
    for (const base of 'ACGT') {
      if (base === was[at]) continue
      const dna = was.slice(0, at) + base + was.slice(at + 1)
      out.push({ at, base, effect: effectOf(was, dna), dna })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Marking.

export function done(config: GenConfig, state: GenState): boolean {
  if (config.task === 'cross') return solves(config, parentsOf(config, state))
  const changed = changedAt(config, state)
  return changed.length === 1 && effectOf(originalDna(config), basesOf(config, state)) === config.effect
}

const formWord = (c: Extract<GenConfig, { task: 'cross' }>, form: Form) => (form === 'dominant' ? traitOf(c).dom : traitOf(c).rec)

function crossWhy(c: Extract<GenConfig, { task: 'cross' }>, recessiveBoxes: number): string {
  const t = traitOf(c)
  const l = t.letter.toLowerCase()
  const why = recessiveBoxes === 0
    ? `No offspring can be ${t.rec}: that needs a ${l} from each parent, and at least one parent has none to give.`
    : recessiveBoxes === 1
      ? `Each parent has one ${l} to give, so only one offspring in four gets a ${l} from both.`
      : recessiveBoxes === 2
        ? `One parent gives a ${l} every time and the other only half the time, so half the offspring get a ${l} from both.`
        : `Both parents give a ${l} every time, so every offspring is ${t.rec}.`
  return `${why} Each box is one equally likely outcome for a single offspring, not a count of a real family.`
}

/** What a correct cross says: what the learner found, and why. */
export function working(config: GenConfig, state: GenState): string {
  if (config.task === 'cross') {
    const p = parentsOf(config, state)
    const t = traitOf(config)
    const k = showing(p.a, p.b, config.form)
    const rec = showing(p.a, p.b, 'recessive')
    return `Yes. ${genotypeText(t.letter, p.a)} × ${genotypeText(t.letter, p.b)}: ${k} of the 4 boxes show ${formWord(config, config.form)}. ${crossWhy(config, rec)}`
  }
  const was = originalDna(config)
  const now = basesOf(config, state)
  const at = changedAt(config, state)[0]
  const cod = Math.floor(at / 3)
  const before = codonsOf(mrnaOf(was))[cod]
  const after = codonsOf(mrnaOf(now))[cod]
  const aa = (s: string) => aminoOf(s)
  if (config.effect === 'silent') {
    return `Yes. Codon ${cod + 1} went from ${before} to ${after}, and both mean ${aminoName(aa(before))}. The code has more than one codon for most amino acids, so the protein did not change. That is a silent mutation.`
  }
  if (config.effect === 'nonsense') {
    return `Yes. Codon ${cod + 1} went from ${before} to ${after}, which means stop. The chain ends there, ${say(cod, 'amino acid', 'amino acids')} long, and the rest is never made. That is a nonsense mutation.`
  }
  const sickle = config.gene === 'beta-globin' && before === 'GAG' && after === 'GUG'
  return `Yes. Codon ${cod + 1} went from ${before} to ${after}, so ${aminoName(aa(before))} became ${aminoName(aa(after))}. One different amino acid is a missense mutation.${sickle ? ' This very change in the beta-globin gene is the one behind sickle-cell disease.' : ''}`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: GenConfig, state: GenState): string {
  if (config.task === 'cross') {
    const p = parentsOf(config, state)
    const t = traitOf(config)
    const k = showing(p.a, p.b, config.form)
    return `You set ${genotypeText(t.letter, p.a)} × ${genotypeText(t.letter, p.b)}, and ${k} of the 4 boxes show ${formWord(config, config.form)}.`
  }
  const changed = changedAt(config, state)
  if (changed.length === 0) return 'No base is changed yet, so the protein is the same as at the start.'
  if (changed.length > 1) return `You changed ${changed.length} bases; this card is marked on a change of just one.`
  const effect = effectOf(originalDna(config), basesOf(config, state))
  const cod = Math.floor(changed[0] / 3)
  const was = aminoName(aminoOf(codonsOf(mrnaOf(originalDna(config)))[cod]))
  const now = codonsOf(mrnaOf(basesOf(config, state)))[cod]
  const what = effect === 'silent'
    ? `the protein is exactly the same`
    : effect === 'nonsense'
      ? `codon ${cod + 1} is now a stop, so the chain ends early`
      : `${was} became ${aminoName(aminoOf(now))}`
  return `You made a ${effect} change: ${what}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9/%.]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'cross' | 'mutate'> = {
  cross: 'cross', crosses: 'cross', 'punnett-square': 'cross', punnett: 'cross', 'genetic-cross': 'cross', 'monohybrid-cross': 'cross', monohybrid: 'cross', breed: 'cross', breeding: 'cross', parents: 'cross', 'choose-parents': 'cross',
  inheritance: 'cross', 'set-the-parents': 'cross', 'work-backwards': 'cross', alleles: 'cross', genotype: 'cross', genotypes: 'cross',
  mutate: 'mutate', mutation: 'mutate', mutations: 'mutate', 'point-mutation': 'mutate', 'dna-to-protein': 'mutate', 'protein-synthesis': 'mutate', protein: 'mutate', dna: 'mutate', codon: 'mutate', codons: 'mutate', translation: 'mutate', 'genetic-code': 'mutate', 'change-a-base': 'mutate',
}

const TRAIT_WORDS: Record<string, TraitKey> = {
  flower: 'flower', flowers: 'flower', 'flower-colour': 'flower', 'flower-color': 'flower', 'pea-flower': 'flower', purple: 'flower', 'purple-flowers': 'flower', 'purple-white': 'flower',
  pea: 'pea', peas: 'pea', 'pea-colour': 'pea', 'pea-color': 'pea', 'seed-colour': 'pea', 'seed-color': 'pea', seed: 'pea', seeds: 'pea', yellow: 'pea', 'yellow-green': 'pea', 'pea-seed': 'pea',
  height: 'height', 'plant-height': 'height', tall: 'height', 'tall-short': 'height', 'stem-height': 'height', 'stem-length': 'height', size: 'height',
}

const GENE_WORDS: Record<string, GeneKey> = {
  'beta-globin': 'beta-globin', 'beta-globin-gene': 'beta-globin', hbb: 'beta-globin', haemoglobin: 'beta-globin', hemoglobin: 'beta-globin', 'sickle-cell': 'beta-globin', sickle: 'beta-globin', globin: 'beta-globin',
  insulin: 'insulin', 'insulin-gene': 'insulin', practice: 'practice', 'practice-gene': 'practice', example: 'practice', short: 'practice', generic: 'practice', 'short-gene': 'practice',
}

const EFFECT_WORDS: Record<string, Effect> = {
  silent: 'silent', 'silent-mutation': 'silent', synonymous: 'silent', 'no-change': 'silent', unchanged: 'silent', 'same-protein': 'silent', 'same-amino-acid': 'silent', 'no-effect': 'silent', neutral: 'silent',
  missense: 'missense', 'missense-mutation': 'missense', 'different-amino-acid': 'missense', 'amino-acid-change': 'missense', 'change-amino-acid': 'missense', substitution: 'missense', 'one-amino-acid-changed': 'missense',
  nonsense: 'nonsense', 'nonsense-mutation': 'nonsense', stop: 'nonsense', 'stop-codon': 'nonsense', 'premature-stop': 'nonsense', shorter: 'nonsense', truncated: 'nonsense', 'shorter-protein': 'nonsense', terminate: 'nonsense', 'chain-stops': 'nonsense',
}

const GIVEN_WORDS: Record<string, number | null> = {
  heterozygous: 1, hybrid: 1, carrier: 1, heterozygote: 1, 'homozygous-dominant': 2, 'pure-dominant': 2, 'pure-breeding-dominant': 2, 'homozygous-recessive': 0, 'pure-recessive': 0, recessive: 0,
  none: null, free: null, null: null,
}

const SHARE_READ: Record<string, number> = {
  none: 0, no: 0, zero: 0, 'no-offspring': 0, 'a-quarter': 1, quarter: 1, 'one-quarter': 1, '1/4': 1, '25%': 1, 'one-in-four': 1, 'one-of-four': 1, 'one-of-the-four': 1,
  half: 2, 'a-half': 2, '1/2': 2, '2/4': 2, '50%': 2, 'two-in-four': 2, 'two-of-four': 2, 'one-half': 2,
  'three-quarters': 3, 'three-quarter': 3, '3/4': 3, '75%': 3, 'three-in-four': 3, 'three-of-four': 3,
  all: 4, every: 4, 'every-offspring': 4, '4/4': 4, '100%': 4, everything: 4, 'four-of-four': 4,
}

function readTrait(raw: unknown): string | null {
  if (raw === undefined) return 'flower'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw).replace(/^(?:the|a|an)-/, '')
  return has(TRAIT_WORDS, k) ? TRAIT_WORDS[k] : k || 'flower'
}

/** Parent 1's dominant alleles: from a genotype such as Pp, a word, or a number. Undefined means it cannot be read. */
function readGiven(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (/^[A-Za-z]{2}$/.test(t)) {
    const up = [...t].filter((c) => c === c.toUpperCase()).length
    return up
  }
  const k = keyOf(raw)
  return has(GIVEN_WORDS, k) ? GIVEN_WORDS[k] : undefined
}

function readShare(raw: unknown): number | null {
  if (raw === undefined) return 1
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return raw >= 0 && raw <= 4 ? raw : raw % 25 === 0 && raw <= 100 ? raw / 25 : raw
    return raw > 0 && raw < 1 ? Math.round(raw * 4) : raw
  }
  if (typeof raw !== 'string') return null
  const k = keyOf(raw).replace(/^(?:the-)/, '').replace(/-of-the-offspring$/, '').replace(/-of-offspring$/, '')
  if (has(SHARE_READ, k)) return SHARE_READ[k]
  const n = Number(k)
  return Number.isFinite(n) && k !== '' ? readShare(n) : null
}

function readForm(raw: unknown, trait: string): Form | null {
  if (raw === undefined) return 'recessive'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw)
  const t = has(TRAITS, trait) ? TRAITS[trait as TraitKey] : null
  if (k === 'dominant' || (t && k.startsWith(t.dom))) return 'dominant'
  if (k === 'recessive' || (t && k.startsWith(t.rec))) return 'recessive'
  if (['purple', 'yellow', 'tall'].includes(k)) return 'dominant'
  if (['white', 'green', 'short'].includes(k)) return 'recessive'
  return null
}

const nearestCount = (n: number) => Math.max(0, Math.min(4, Math.round(n)))

/** What a prompt can safely say: the gesture and the aim. */
function goodPrompt(config: GenConfig): string {
  if (config.task === 'cross') {
    const t = traitOf(config)
    const n = nearestCount(config.count)
    const form = config.form === 'dominant' ? t.dom : t.rec
    const lead = config.given !== null ? 'Parent 1 is fixed. Tap a letter beside the square to change parent 2.' : 'Tap a letter above or beside the square to change a parent.'
    const aim = n === 0 ? `Make none of the four boxes show ${form} ${t.noun}.` : n === 4 ? `Make all four boxes show ${form} ${t.noun}.` : `Make exactly ${NUM_WORDS[n]} of the four boxes show ${form} ${t.noun}.`
    return `${lead} ${aim}`
  }
  const aims: Record<string, string> = {
    silent: 'the protein stays exactly the same',
    missense: 'exactly one amino acid in the protein is different',
    nonsense: 'the protein chain stops short',
  }
  return `Tap a DNA base to change it. Change just one base so that ${aims[has(aims, config.effect) ? config.effect : 'silent']}.`
}

export const geneticsEngine: SceneEngine<GenConfig, GenState> = {
  id: 'genetics',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters, so "Mendel" would catch Mendeleev and
  // "phenotype" would catch phenols. Everything else is a whole phrase. Bare "cross", "dominant", "inheritance", "breeding",
  // "mutation" and "protein" belong to other subjects (cross-sections, dominant firms, inheritance in code, wildlife breeding,
  // food groups), so they are never offered alone.
  covers: ['Punnett', 'alleles', 'heredity', 'codons'],
  phrases: [
    'genetics', 'genetic', 'genetic inheritance', 'inheritance of traits', 'inherited traits', 'inherited characteristics', 'inheritance patterns', 'inherited change', 'inherited variation', 'inheritance in humans', 'inheritance in pea plants',
    'mendel', 'mendelian', 'mendelian genetics', 'monohybrid cross', 'monohybrid crosses', 'monohybrid inheritance', 'genetic cross', 'genetic crosses', 'genetic diagram', 'genetic diagrams', 'test cross', 'test crosses',
    'dominant and recessive', 'dominant alleles', 'recessive alleles', 'dominant allele', 'recessive allele', 'dominant and recessive alleles', 'dominant genes', 'recessive genes', 'dominant trait', 'recessive trait', 'dominant traits', 'recessive traits',
    'genotype', 'genotypes', 'phenotype', 'phenotypes', 'genotype and phenotype', 'genes and alleles', 'genes and inheritance', 'genes and chromosomes', 'heredity and variation', 'homozygous', 'heterozygous',
    'punnett square', 'punnett squares', 'selective breeding', 'plant breeding', 'animal breeding', 'cross breeding', 'crossbreeding', 'breeding livestock', 'breeding crops',
    'protein synthesis', 'dna to protein', 'dna and protein', 'dna and proteins', 'dna and the genetic code', 'the genetic code', 'genetic code', 'gene expression', 'transcription and translation', 'translation and transcription',
    'point mutation', 'point mutations', 'gene mutation', 'gene mutations', 'dna mutation', 'dna mutations', 'mutations in dna', 'types of mutation', 'types of mutations', 'silent mutation', 'missense mutation', 'nonsense mutation',
    'genes and proteins', 'genes and dna', 'from gene to protein',
  ],
  // Near misses: genetics the card cannot draw, and "cross", "dominant" or "inheritance" about something else.
  notFor: [
    'genetic engineering', 'genetic modification', 'genetically modified', 'gene technology', 'gene therapy', 'gene editing', 'genome editing', 'crispr', 'dna profiling', 'dna fingerprinting', 'dna extraction', 'dna sequencing', 'forensic', 'forensics', 'cloning',
    'genetic diversity', 'gene pool', 'genetic drift', 'population genetics', 'genetic screening', 'genetic testing', 'hardy weinberg', 'genetic counselling', 'genetic variation in populations',
    'dihybrid', 'sex linked', 'sex linkage', 'x linked', 'codominance', 'co dominance', 'incomplete dominance', 'blood group', 'blood groups', 'polygenic', 'multiple alleles', 'linkage', 'epistasis', 'frameshift', 'frame shift', 'insertion mutation', 'deletion mutation',
    'cross section', 'cross sections', 'cross sectional', 'cross curricular', 'cross cultural', 'cross country', 'cross product', 'cross multiplication', 'cross pollination', 'cross pollinating', 'cross fertilisation', 'cross fertilization', 'cross border', 'cross sell', 'cross training',
    'dominant strategy', 'dominant strategies', 'dominant firm', 'dominant firms', 'dominant species', 'dominant culture', 'dominant narrative', 'dominant design', 'dominant hand', 'dominant frequency', 'dominant market', 'dominant ideology', 'dominant power', 'dominant eigenvalue',
    'object oriented', 'inheritance tax', 'class inheritance', 'inheritance in programming', 'inheritance and polymorphism', 'classes and inheritance', 'inheritance law', 'wills and inheritance', 'estate',
    'captive breeding', 'breeding season', 'breeding grounds', 'breeding sites', 'breeding birds', 'conservation breeding',
    'mutation testing', 'mutation operators', 'genetic algorithm', 'genetic algorithms', 'evolutionary algorithm',
  ],
  // The learner changes which alleles or which base: the cause is varied and the result read off.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    let task: 'cross' | 'mutate' | null = word ? (has(TASK_WORDS, word) ? TASK_WORDS[word] : null) : null
    if (word && !task) return null
    if (!task) {
      task = src.gene !== undefined || src.effect !== undefined ? 'mutate' : src.trait !== undefined || src.share !== undefined || src.count !== undefined || src.given !== undefined ? 'cross' : null
    }
    if (!task) return null
    if (task === 'mutate') {
      const rawGene = first(src, ['gene', 'sequence', 'protein', 'name'])
      if (rawGene !== undefined && typeof rawGene !== 'string') return null
      const g = keyOf(rawGene === undefined ? 'practice' : rawGene).replace(/^(?:the|a|an)-/, '')
      const rawEffect = first(src, ['effect', 'mutation', 'result', 'outcome', 'aim'])
      if (rawEffect !== undefined && typeof rawEffect !== 'string') return null
      const e = rawEffect === undefined ? 'missense' : keyOf(rawEffect)
      return { task, gene: has(GENE_WORDS, g) ? GENE_WORDS[g] : g || 'practice', effect: has(EFFECT_WORDS, e) ? EFFECT_WORDS[e] : e }
    }
    const trait = readTrait(first(src, ['trait', 'characteristic', 'feature', 'organism']))
    if (trait === null) return null
    const given = readGiven(first(src, ['given', 'fixed', 'parent', 'parent1', 'parent_1', 'first_parent']))
    if (given === undefined) return null
    const form = readForm(first(src, ['form', 'show', 'shows', 'showing', 'phenotype', 'look']), trait)
    if (form === null) return null
    const count = readShare(first(src, ['count', 'share', 'number', 'offspring', 'fraction', 'want', 'boxes']))
    if (count === null) return null
    return { task, trait, given, form, count }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'mutate') {
      if (!has(GENES, config.gene)) out.push(`There is no "${config.gene}" gene drawn here: use one of ${GENE_KEYS.join(', ')}, e.g. gene "beta-globin".`)
      if (!(EFFECTS as readonly string[]).includes(config.effect)) out.push(`"${config.effect}" is not an effect the card can mark: use silent, missense or nonsense, e.g. effect "missense".`)
      else if (has(GENES, config.gene) && !singleChanges(config).some((x) => x.effect === config.effect)) {
        out.push(`No single base change in the ${config.gene} stretch is ${config.effect}: use another gene or effect, e.g. gene "practice".`)
      }
      return out
    }
    const t = traitOf(config)
    if (!has(TRAITS, config.trait)) out.push(`There is no "${config.trait}" trait drawn here: use flower colour, pea colour or plant height, e.g. trait "flower colour".`)
    if (config.given !== null && !(Number.isInteger(config.given) && config.given >= 0 && config.given <= 2)) {
      out.push(`Parent 1 cannot be given as ${config.given}: give a genotype such as "${t.letter}${t.letter.toLowerCase()}", or leave given out.`)
      return out
    }
    if (!(Number.isInteger(config.count) && config.count >= 0 && config.count <= 4)) {
      out.push(`${config.count} of the four boxes is not possible: share must be none, a quarter, half, three quarters or all, e.g. share "a quarter".`)
      return out
    }
    const options = crossOptions(config)
    const wins = options.filter((p) => solves(config, p))
    const reachable = [...new Set(options.map((p) => showing(p.a, p.b, config.form)))].sort((a, b) => a - b)
    const nearest = reachable.reduce((best, n) => (Math.abs(n - config.count) < Math.abs(best - config.count) ? n : best), reachable[0])
    const who = config.given !== null ? `With parent 1 fixed as ${genotypeText(t.letter, config.given)}, ` : 'For one gene, '
    if (wins.length === 0) {
      out.push(`${who}no parents can make ${config.count} of the four boxes show ${formWord(config, config.form)}: the possible numbers are ${reachable.join(', ')}, e.g. share "${SHARE_WORDS[nearest]}".`)
    } else if (wins.length === options.length) {
      out.push(`${who}every choice of parents gives ${config.count} of the four boxes ${formWord(config, config.form)}, so there is nothing for the learner to find: leave given out, or choose another share.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'cross') {
      const L = traitOf(config).letter
      const l = L.toLowerCase()
      const genotype = new RegExp(`\\b(?:${L}${L}|${L}${l}|${l}${l})\\b`).test(text) || /\b[A-Za-z]{2}\s+[x×]\s+[A-Za-z]{2}\b|\b[A-Za-z]{2}\s*×\s*[A-Za-z]{2}\b/.test(text)
      const named = /heterozyg|homozyg|\bcarrier|\bhybrid|pure[- ]?bred|true[- ]?breeding|\b3\s*:\s*1\b|\b1\s*:\s*2\s*:\s*1\b|\b(?:both|each|one) parents?\s+(?:must|needs?|carr|are|is|has|have)\b|\bone parent (?:must|needs?|carr|is|has)\b|\bhidden (?:allele|gene)|\bcarries? (?:a|the|one) (?:white|green|short|recessive|hidden)/i.test(text)
      if (genotype || named) {
        out.push(`the prompt gives the answer away: it names a parent's genotype or says what the parents must be, which the learner is to find with the tiles -- ask for the offspring only ("${example}")`)
      }
      if (/\bdrag\b|\bslide\b|\bpedigree|\bchromosome|\bmeiosis|\bratio\b|\bpercent|%|\bprobabilit|\bchance\b|\bsex\b|\bmale\b|\bfemale\b|\bx-linked|\bdihybrid/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it draws one gene's square and the learner taps the tiles, with no ratios, probabilities, chromosomes or pedigrees -- ask for that ("${example}")`)
      }
      return out
    }
    if (/\b(?:first|second|third|last|middle|1st|2nd|3rd)\s+(?:base|letter|nucleotide)\b|\bwobble\b|\bcodon\s*(?:\d|one|two|three|four)\b|\bU(?:AA|AG|GA)\b|\bT(?:AA|AG|GA)\b|\bto an? [ACGTU]\b|\bdegenerate\b|\bredundan|\bsame amino acid.*(?:third|codon)|\bsynonymous codon/i.test(text)) {
      out.push(`the prompt gives the answer away: it says which base or codon to change, to what, or why a change can pass unseen, which the learner is to find by changing bases -- ask for the effect only ("${example}")`)
    }
    if (/\bframeshift|\binsert|\bdelet|\bribosome|\btRNA|\banticodon|\bstart codon|\bsplic|\bintron|\bexon\b|\bdrag\b|\bslide\b|\bpedigree|\b(?:two|three|four|2|3|4)\s+bases\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws DNA, mRNA and the protein chain, and the learner taps one base at a time -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    if (config.task === 'mutate') return { bases: originalDna(config) }
    const opts = crossOptions(config)
    const pick = opts.find((p) => !solves(config, p)) ?? opts[0]
    return { a: pick.a, b: pick.b }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'mutate') {
      const hit = singleChanges(config).find((x) => x.effect === config.effect)
      return { bases: hit ? hit.dna : originalDna(config) }
    }
    const opts = crossOptions(config)
    const pick = opts.find((p) => solves(config, p)) ?? opts[0]
    return { a: pick.a, b: pick.b }
  },

  View: GeneticsView,

  prompt: `SCENE "genetics" -- two small genetics benches drawn on a quiet light panel.
  cross: a Punnett square of one gene. Parent 1's two allele tiles sit above the square's columns, parent 2's beside its rows, with each parent drawn as a real plant. A tile is a real button: the learner taps it to swap that allele between the capital and the small letter, and the four offspring boxes redraw at once as flowers, peas or plants, each with its letters. The learner works backwards: they set the parents so that a stated number of the four boxes show one form. The card shows the live boxes and the letters; it never says which parents are right or counts the boxes for them. A legend names the capital and small letter and what each shows; the capital shows over the small one.
  mutate: DNA to protein. A real short stretch of a gene is a row of 12 DNA bases in four colours, copied below as mRNA, read in threes into a chain of amino-acid beads (three-letter names). The learner taps a DNA base and it steps through A, C, G, T; a ring marks any base changed from the start, the mRNA and beads redraw at once, a bead that differs is ringed and says what it was, and a stop codon makes a red stop sign and ends the chain. The learner changes one base to make a stated thing happen to the protein.
  For: Punnett squares and genetic crosses of one gene, dominant and recessive alleles, genotype and phenotype, Mendel's peas, protein synthesis (DNA to mRNA to protein), the genetic code and point mutations. It answers "a Punnett square tells you what the family will be" and "most mutations change the protein".
  cross config: { "task":"cross", "trait":"flower colour"|"pea colour"|"plant height", "given":optional genotype of parent 1 such as "Pp" (fixed; parent 2 is the learner's), "form":"recessive" (default) or "dominant", "share": how many of the four boxes show that form: "none", "a quarter", "half", "three quarters" or "all" }. With form recessive the possible shares are none, a quarter, half and all; with form dominant they are none, half, three quarters and all; with a given parent only some of those are possible, and the card refuses the impossible with the list. Flower colour: P purple over p white. Pea colour: Y yellow over y green. Plant height: T tall over t short.
  mutate config: { "task":"mutate", "gene":"beta-globin"|"insulin"|"practice", "effect":"silent"|"missense"|"nonsense" }. Every gene is a stretch of four codons (beta-globin: Pro Glu Glu Lys; insulin: Phe Val Asn Gln; practice: Ala Ser Gly Leu), and every effect is possible on every gene. The learner must change exactly one base; changing two or none is marked wrong. Silent means the protein is the same; missense, one amino acid is different; nonsense, a stop ends the chain early.
  Before marking the card shows the plants, letters, colours, beads and stop signs, and names every colour and letter on the card. It holds back which parents or which base is right, and the names of the effects in the picture; marking says what the learner made, and the reason when right. The prompt must ask for the outcome only and give the gesture: do NOT name a parent's genotype ("Pp x Pp"), say what the parents must be (heterozygous, carriers, hybrid, a 3:1 ratio), say which base, which codon, what to change it to or why it passes unseen, or promise ratios, probabilities, pedigrees, chromosomes, frameshifts or the ribosome.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a letter above or beside the square to change a parent. Make exactly one of the four boxes show white flowers.",
    "payload": { "engine":"genetics", "config": { "task":"cross", "trait":"flower colour", "form":"recessive", "share":"a quarter" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:genetics", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Parent 1 is fixed. Tap a letter beside the square to change parent 2. Make exactly two of the four boxes show short plants.",
    "payload": { "engine":"genetics", "config": { "task":"cross", "trait":"plant height", "given":"Tt", "form":"recessive", "share":"half" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:genetics", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a DNA base to change it. Change just one base so that exactly one amino acid in the protein is different.",
    "payload": { "engine":"genetics", "config": { "task":"mutate", "gene":"beta-globin", "effect":"missense" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:genetics", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a DNA base to change it. Change just one base so that the protein chain stops short.",
    "payload": { "engine":"genetics", "config": { "task":"mutate", "gene":"insulin", "effect":"nonsense" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:genetics", "why":"..." } }`,
}

registerEngine(geneticsEngine as SceneEngine<unknown, unknown>)
