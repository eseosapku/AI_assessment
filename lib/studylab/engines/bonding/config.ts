// lib/studylab/engines/bonding/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { BondingView } from './View'

/**
 * Electrons per shell, innermost first.
 * Source: Cambridge IGCSE Chemistry 0620 syllabus (2023-2025), topic 2.2
 * (Atoms, electrons and compounds): "the electronic configuration of elements
 * and their ions with proton number 1 to 20, e.g. 2,8,3".
 * Bromine (35) is the one element past 20. 0620 uses it as a Group VII
 * element, where only its outer seven matter; its shells are 2,8,18,7.
 */
export const ELEMENTS = {
  H: { name: 'hydrogen', z: 1, shells: [1] },
  He: { name: 'helium', z: 2, shells: [2] },
  Li: { name: 'lithium', z: 3, shells: [2, 1] },
  Be: { name: 'beryllium', z: 4, shells: [2, 2] },
  B: { name: 'boron', z: 5, shells: [2, 3] },
  C: { name: 'carbon', z: 6, shells: [2, 4] },
  N: { name: 'nitrogen', z: 7, shells: [2, 5] },
  O: { name: 'oxygen', z: 8, shells: [2, 6] },
  F: { name: 'fluorine', z: 9, shells: [2, 7] },
  Ne: { name: 'neon', z: 10, shells: [2, 8] },
  Na: { name: 'sodium', z: 11, shells: [2, 8, 1] },
  Mg: { name: 'magnesium', z: 12, shells: [2, 8, 2] },
  Al: { name: 'aluminium', z: 13, shells: [2, 8, 3] },
  Si: { name: 'silicon', z: 14, shells: [2, 8, 4] },
  P: { name: 'phosphorus', z: 15, shells: [2, 8, 5] },
  S: { name: 'sulfur', z: 16, shells: [2, 8, 6] },
  Cl: { name: 'chlorine', z: 17, shells: [2, 8, 7] },
  Ar: { name: 'argon', z: 18, shells: [2, 8, 8] },
  K: { name: 'potassium', z: 19, shells: [2, 8, 8, 1] },
  Ca: { name: 'calcium', z: 20, shells: [2, 8, 8, 2] },
  Br: { name: 'bromine', z: 35, shells: [2, 8, 18, 7] },
} as const satisfies Record<string, { name: string; z: number; shells: readonly number[] }>
export type ElementId = keyof typeof ELEMENTS

export const METALS = ['Li', 'Na', 'K', 'Mg', 'Ca', 'Al'] as const
export const NONMETALS = ['F', 'Cl', 'Br', 'O', 'S', 'N'] as const
export type Metal = (typeof METALS)[number]
export type NonMetal = (typeof NONMETALS)[number]

/**
 * The charge on each element's ion, as the syllabus teaches it.
 * Source: Cambridge IGCSE Chemistry 0620 (2023-2025):
 * - 2.4, Ions and ionic bonds;
 * - 3.1, Formulae: "deduce the formula of an ionic compound from the charges
 *   on the ions".
 * The engine works each charge out from the shells (electrons lost or gained
 * to leave a full outer shell); the tests hold the two to each other.
 */
export const ION_CHARGES: Record<Metal | NonMetal, number> = {
  Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Al: 3,
  F: -1, Cl: -1, Br: -1, O: -2, S: -2, N: -3,
}

const ANION_NAMES: Record<NonMetal, string> = { F: 'fluoride', Cl: 'chloride', Br: 'bromide', O: 'oxide', S: 'sulfide', N: 'nitride' }

/**
 * Pairs from the table that are not drawn as ions, because the picture would
 * teach something false. These are kept out rather than guessed at.
 */
const NOT_IONIC: Partial<Record<`${Metal}-${NonMetal}`, string>> = {
  'Na-N': 'Sodium nitride is not a stable compound, so it is not drawn as ions here. For a nitride, use lithium, magnesium or calcium.',
  'K-N': 'Potassium nitride is not a stable compound, so it is not drawn as ions here. For a nitride, use lithium, magnesium or calcium.',
  'Al-Cl': 'Aluminium chloride is covalent, not ionic, so it is not drawn as ions here. Use aluminium with fluorine or oxygen, or another metal with chlorine.',
  'Al-Br': 'Aluminium bromide is covalent, not ionic, so it is not drawn as ions here. Use aluminium with fluorine or oxygen, or another metal with bromine.',
  'Al-S': 'Aluminium sulfide is partly covalent and is not an IGCSE example of ionic bonding. Use aluminium with fluorine or oxygen, or another metal with sulfur.',
  'Al-N': 'Aluminium nitride is a covalent network, not ionic, so it is not drawn as ions here. Use aluminium with fluorine or oxygen.',
}

/**
 * The molecules, as 0620 names them.
 * Source: 0620 (2023-2025), 2.5, Simple molecules and covalent bonds:
 * - core: H2, Cl2, H2O, CH4, NH3 and HCl;
 * - supplement: O2, CO2 and N2.
 *
 * Atom 0 joins every other atom. `dirs[j]` is where atom j+1 sits from atom 0,
 * in screen degrees (0 is right, 90 is down). Bond j joins atom 0 and atom j+1.
 */
export const MOLECULE_IDS = ['H2', 'Cl2', 'HCl', 'H2O', 'NH3', 'CH4', 'O2', 'N2', 'CO2'] as const
export type MoleculeId = (typeof MOLECULE_IDS)[number]
export type CovalentElement = 'H' | 'C' | 'N' | 'O' | 'Cl'
export interface Molecule { name: string; atoms: CovalentElement[]; dirs: number[] }
export const MOLECULES: Record<MoleculeId, Molecule> = {
  H2: { name: 'hydrogen', atoms: ['H', 'H'], dirs: [0] },
  Cl2: { name: 'chlorine', atoms: ['Cl', 'Cl'], dirs: [0] },
  HCl: { name: 'hydrogen chloride', atoms: ['Cl', 'H'], dirs: [180] },
  H2O: { name: 'water', atoms: ['O', 'H', 'H'], dirs: [135, 45] },
  NH3: { name: 'ammonia', atoms: ['N', 'H', 'H', 'H'], dirs: [180, 0, 90] },
  CH4: { name: 'methane', atoms: ['C', 'H', 'H', 'H', 'H'], dirs: [270, 0, 90, 180] },
  O2: { name: 'oxygen', atoms: ['O', 'O'], dirs: [0] },
  N2: { name: 'nitrogen', atoms: ['N', 'N'], dirs: [0] },
  CO2: { name: 'carbon dioxide', atoms: ['C', 'O', 'O'], dirs: [180, 0] },
}

export type BondingConfig = {
  task: { kind: 'make-ionic'; metal: Metal; nonmetal: NonMetal } | { kind: 'make-covalent'; molecule: MoleculeId }
}
/**
 * Ionic: `shells[i]` is the electrons in atom i's outer shell, in the order
 * they arrived. An electron's id is "<its own atom>.<k>".
 * Covalent: `pairs[j]` is the number of shared pairs on bond j.
 */
export type BondingState = { shells?: string[][]; pairs?: number[] }

/** A move the learner made, or why it could not be made, in words. */
export type Move<T> = { next: T } | { refused: string }

// ---------------------------------------------------------------------------
// Shells

export const outer = (el: ElementId): number => {
  const s = ELEMENTS[el].shells
  return s[s.length - 1]
}
/** At this level a first shell holds 2 and an outer shell 8. */
export const capacity = (el: ElementId): number => (el === 'H' ? 2 : 8)

/** The configuration with `n` electrons in the outer shell: "2,8,1", or "2,8" once it is empty. */
export function configText(el: ElementId, n: number): string {
  const inner = ELEMENTS[el].shells.slice(0, -1)
  return [...inner, ...(n > 0 ? [n] : [])].join(',')
}

/** "+", "2+", "−", "3−" (a true minus sign). */
export function chargeText(charge: number): string {
  if (charge === 0) return ''
  const size = Math.abs(charge) > 1 ? String(Math.abs(charge)) : ''
  return `${size}${charge > 0 ? '+' : '−'}`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------
// Ionic: electrons move from metal atoms to non-metal atoms

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** How many of each atom make the neutral compound: [metal, non-metal]. Al and O give [2, 3]. */
export function formulaCounts(metal: Metal, nonmetal: NonMetal): [number, number] {
  const lost = outer(metal)
  const gained = 8 - outer(nonmetal)
  const g = gcd(lost, gained)
  return [gained / g, lost / g]
}

export function ionicFormula(metal: Metal, nonmetal: NonMetal): string {
  const [m, n] = formulaCounts(metal, nonmetal)
  return `${metal}${m > 1 ? m : ''}${nonmetal}${n > 1 ? n : ''}`
}

export const compoundName = (metal: Metal, nonmetal: NonMetal): string => `${ELEMENTS[metal].name} ${ANION_NAMES[nonmetal]}`

/** One atom in the ionic scene: metals in the top row, non-metals below. */
export interface IonicAtom { el: Metal | NonMetal; metal: boolean; row: 0 | 1; col: number; of: number }

export function ionicAtoms(metal: Metal, nonmetal: NonMetal): IonicAtom[] {
  const [m, n] = formulaCounts(metal, nonmetal)
  return [
    ...Array.from({ length: m }, (_, col): IonicAtom => ({ el: metal, metal: true, row: 0, col, of: m })),
    ...Array.from({ length: n }, (_, col): IonicAtom => ({ el: nonmetal, metal: false, row: 1, col, of: n })),
  ]
}

/** Each atom with its own outer electrons. */
export function startShells(atoms: IonicAtom[]): string[][] {
  return atoms.map((a, i) => Array.from({ length: outer(a.el) }, (_, k) => `${i}.${k}`))
}

/** The atom an electron came from. */
export const originOf = (id: string): number => Number(id.split('.')[0])

const WHERE_IN_ROW = [[''], [' on the left', ' on the right'], [' on the left', ' in the middle', ' on the right']]

/** "chlorine on the left", or just "sodium" when it is the only one. */
export const ionicLabel = (a: IonicAtom): string => `${ELEMENTS[a.el].name}${WHERE_IN_ROW[a.of - 1]?.[a.col] ?? ''}`

/** The shells as the engine can trust them: every electron once, no shell over 8. Null otherwise. */
export function readShells(atoms: IonicAtom[], state: unknown): string[][] | null {
  const shells = (state as BondingState | null)?.shells
  if (!Array.isArray(shells) || shells.length !== atoms.length) return null
  const want = new Set(startShells(atoms).flat())
  const seen = new Set<string>()
  for (const shell of shells) {
    if (!Array.isArray(shell) || shell.length > 8) return null
    for (const e of shell) {
      if (typeof e !== 'string' || !want.has(e) || seen.has(e)) return null
      seen.add(e)
    }
  }
  return seen.size === want.size ? shells.map((s) => [...s]) : null
}

/**
 * Moves one electron from one atom's outer shell to another's: the last to
 * arrive goes first, so moving one back undoes a move.
 */
export function moveElectron(atoms: IonicAtom[], shells: string[][], from: number, to: number): Move<string[][]> {
  if (from === to || !atoms[from] || !atoms[to]) return { refused: 'Pick a different atom to move the electron to.' }
  if (shells[from].length === 0) return { refused: `The ${ionicLabel(atoms[from])} has no electrons in its outer shell to move.` }
  if (shells[to].length >= 8) return { refused: `The outer shell of the ${ionicLabel(atoms[to])} has no room: it holds 8.` }
  const next = shells.map((s) => [...s])
  next[to].push(next[from].pop() as string)
  return { next }
}

/** What is not yet right, atom by atom: what a metal still has, what a non-metal lacks. */
export function ionicFaults(atoms: IonicAtom[], shells: string[][]): string[] {
  const out: string[] = []
  atoms.forEach((a, i) => {
    const n = shells[i].length
    if (a.metal && n > 0) out.push(`The ${ionicLabel(a)} still has ${plural(n, 'electron')} in its outer shell.`)
    if (!a.metal && n !== 8) out.push(`The ${ionicLabel(a)} has ${plural(n, 'electron')} in its outer shell, not yet full.`)
  })
  return out
}

// ---------------------------------------------------------------------------
// Covalent: neighbouring atoms share pairs, one electron from each

/** How many electrons each atom's outer shell holds: its own, plus one more for each pair it shares. */
export function covalentCounts(mol: Molecule, pairs: number[]): number[] {
  const all = pairs.reduce((s, p) => s + p, 0)
  return mol.atoms.map((el, i) => outer(el) + (i === 0 ? all : pairs[i - 1]))
}

const rad = (deg: number) => (deg * Math.PI) / 180
function whereFrom(deg: number): string {
  const x = Math.cos(rad(deg))
  const y = Math.sin(rad(deg))
  return Math.abs(x) > 0.5 ? (x < 0 ? ' on the left' : ' on the right') : y > 0 ? ' below' : ' above'
}

/** "hydrogen on the left", or just "oxygen" when it is the only one. */
export function covalentLabel(mol: Molecule, i: number): string {
  const el = mol.atoms[i]
  const name = ELEMENTS[el].name
  if (mol.atoms.filter((a) => a === el).length < 2) return name
  if (i === 0) return mol.atoms.length === 2 ? `${name}${whereFrom(mol.dirs[0] + 180)}` : `${name} in the middle`
  return `${name}${whereFrom(mol.dirs[i - 1])}`
}

/** The bond between two atoms, or -1 when they are not next to each other. */
export function bondBetween(mol: Molecule, a: number, b: number): number {
  if (a === b) return -1
  const j = a === 0 ? b - 1 : b === 0 ? a - 1 : -1
  return j >= 0 && j < mol.dirs.length ? j : -1
}

/** Shares one more pair between two neighbouring atoms, when both shells have room. */
export function sharePair(mol: Molecule, pairs: number[], a: number, b: number): Move<number[]> {
  if (a === b || !mol.atoms[a] || !mol.atoms[b]) return { refused: 'Pick a different atom to share a pair with.' }
  const j = bondBetween(mol, a, b)
  if (j < 0) return { refused: `The ${covalentLabel(mol, a)} and the ${covalentLabel(mol, b)} are not next to each other: share with an atom next to it.` }
  const counts = covalentCounts(mol, pairs)
  for (const i of [a, b]) {
    if (counts[i] >= capacity(mol.atoms[i])) return { refused: `The outer shell of the ${covalentLabel(mol, i)} is full: it holds ${capacity(mol.atoms[i])}.` }
  }
  const next = [...pairs]
  next[j] += 1
  return { next }
}

/** Takes one shared pair back: each atom keeps its own electron. */
export function unsharePair(pairs: number[], j: number): Move<number[]> {
  if (!(pairs[j] > 0)) return { refused: 'There is no shared pair there to take back.' }
  const next = [...pairs]
  next[j] -= 1
  return { next }
}

/** The pairs as the engine can trust them: one count per bond, no shell over its room. Null otherwise. */
export function readPairs(mol: Molecule, state: unknown): number[] | null {
  const p = (state as BondingState | null)?.pairs
  if (!Array.isArray(p) || p.length !== mol.dirs.length) return null
  if (!p.every((n) => Number.isInteger(n) && n >= 0 && n <= 3)) return null
  const counts = covalentCounts(mol, p)
  return counts.every((c, i) => c <= capacity(mol.atoms[i])) ? [...p] : null
}

/** What is not yet full, atom by atom. */
export function covalentFaults(mol: Molecule, pairs: number[]): string[] {
  const counts = covalentCounts(mol, pairs)
  return mol.atoms.flatMap((el, i) =>
    counts[i] < capacity(el) ? [`The ${covalentLabel(mol, i)} has ${plural(counts[i], 'electron')} in its outer shell, not yet full.`] : [])
}

const same = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180) < 1
const norm = (deg: number) => ((deg % 360) + 360) % 360

/**
 * Where an atom's unshared electrons sit on its ring, as (angle, how many)
 * places. An outer shell has four places, one of them facing each neighbour.
 * - Electrons the atom can still share sit one to a place, facing a neighbour
 *   it has not yet shared with where it can.
 * - Its lone pairs (never shared at this level) take the places left.
 * - Places already holding a shared pair stay clear: those electrons are drawn
 *   in the overlap.
 * Hydrogen has one place, facing its neighbour.
 */
export function unshared(mol: Molecule, pairs: number[], i: number): { angle: number; n: 1 | 2 }[] {
  const el = mol.atoms[i]
  const bonds = i === 0
    ? mol.dirs.map((deg, j) => ({ deg, formed: pairs[j] > 0 }))
    : [{ deg: mol.dirs[i - 1] + 180, formed: pairs[i - 1] > 0 }]
  const places = el === 'H' ? [bonds[0].deg] : [0, 1, 2, 3].map((k) => bonds[0].deg + 90 * k)
  const facing = (deg: number) => bonds.find((b) => same(b.deg, deg))
  const open = [
    ...places.filter((d) => facing(d) && !facing(d)!.formed),
    ...places.filter((d) => !facing(d)),
  ]
  const b = covalentCounts(mol, pairs)[i] - outer(el)
  const singles = capacity(el) - outer(el) - b
  const lone = (2 * outer(el) - capacity(el)) / 2
  return [
    ...open.slice(0, singles).map((d) => ({ angle: norm(d), n: 1 as const })),
    ...open.slice(singles, singles + lone).map((d) => ({ angle: norm(d), n: 2 as const })),
  ]
}

/** "2 single bonds", "1 double bond", "1 triple bond", counted from the pairs made. */
export function bondSummary(pairs: number[]): string {
  const words = ['single', 'double', 'triple']
  const parts = [1, 2, 3].flatMap((order) => {
    const n = pairs.filter((p) => p === order).length
    return n ? [`${n} ${words[order - 1]} bond${n === 1 ? '' : 's'}`] : []
  })
  return parts.join(' and ')
}

// ---------------------------------------------------------------------------
// Reading what the tutor wrote

const NAMES: Record<string, Metal | NonMetal> = {
  lithium: 'Li', sodium: 'Na', potassium: 'K', magnesium: 'Mg', calcium: 'Ca', aluminium: 'Al', aluminum: 'Al',
  fluorine: 'F', fluoride: 'F', chlorine: 'Cl', chloride: 'Cl', bromine: 'Br', bromide: 'Br',
  oxygen: 'O', oxide: 'O', sulfur: 'S', sulphur: 'S', sulfide: 'S', sulphide: 'S', nitrogen: 'N', nitride: 'N',
}
const isMetal = (x: string): x is Metal => (METALS as readonly string[]).includes(x)
const isNonMetal = (x: string): x is NonMetal => (NONMETALS as readonly string[]).includes(x)

/** "Na", "na", "sodium", "Chloride", "chlorine atom" all name their element. */
function readElement(raw: unknown): Metal | NonMetal | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  const symbol = [...METALS, ...NONMETALS].find((s) => s.toLowerCase() === t.toLowerCase())
  if (symbol) return symbol
  return NAMES[t.toLowerCase().replace(/\s+(atoms?|ions?)$/, '')] ?? null
}

const MOLECULE_NAMES: Record<string, MoleculeId> = {
  hydrogen: 'H2', chlorine: 'Cl2', 'hydrogen chloride': 'HCl', water: 'H2O', ammonia: 'NH3',
  methane: 'CH4', oxygen: 'O2', nitrogen: 'N2', 'carbon dioxide': 'CO2',
}

/** "H2O", "h2o", "H₂O", "water", "a water molecule" all name it. */
function readMolecule(raw: unknown): MoleculeId | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
  const formula = MOLECULE_IDS.find((m) => m.toLowerCase() === t.replace(/\s+/g, '').toLowerCase())
  if (formula) return formula
  const words = t.toLowerCase().replace(/^an?\s+/, '').replace(/\s+(molecules?|gas)$/, '').replace(/\s+/g, ' ')
  return MOLECULE_NAMES[words] ?? null
}

const kindOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[\s_]+/g, '-') : '')

// ---------------------------------------------------------------------------
// The engine

export const bondingEngine: SceneEngine<BondingConfig, BondingState> = {
  id: 'bonding',
  covers: [
    'ionic bonding', 'covalent bonding', 'dot-and-cross diagrams', 'electron transfer and ion formation',
    'ion charges and the formulae of ionic compounds', 'shared pairs: single, double and triple bonds',
    'full outer shells', 'electronic configuration',
  ],
  isolates: 'structure',

  parse(raw) {
    const task = (raw as { task?: Record<string, unknown> } | null)?.task
    if (!task || typeof task !== 'object') return null
    const kind = kindOf(task.kind)
    if (kind === 'make-ionic' || kind === 'ionic') {
      const a = readElement(task.metal)
      const b = readElement(task.nonmetal ?? task.nonMetal ?? task['non-metal'] ?? task.non_metal)
      if (!a || !b) return null
      // Either way round, so long as there is one of each.
      const metal = isMetal(a) ? a : isMetal(b) ? b : null
      const nonmetal = isNonMetal(b) ? b : isNonMetal(a) ? a : null
      return metal && nonmetal ? { task: { kind: 'make-ionic', metal, nonmetal } } : null
    }
    if (kind === 'make-covalent' || kind === 'covalent') {
      const molecule = readMolecule(task.molecule)
      return molecule ? { task: { kind: 'make-covalent', molecule } } : null
    }
    return null
  },

  // Every covalent molecule, and every ionic pair but the six below, is real,
  // solvable and starts unsolved (pinned by the tests over every config).
  faults(config) {
    if (config.task.kind !== 'make-ionic') return []
    const why = NOT_IONIC[`${config.task.metal}-${config.task.nonmetal}`]
    return why ? [why] : []
  },

  // The compound is named as the task; its charges and bonds are what the learner works out.
  promptFaults(config, prompt) {
    const said = config.task.kind === 'make-ionic'
      ? /[⁺⁻]|\b[A-Z][a-z]?\s*\d?\s*[+\-−](?=\s|$|[,.;:)])|(^|\s)\d\s*[+\-−](?=\s|$|[,.;:)])/.exec(prompt)
      : /\b(single|double|triple)\s+bonds?\b|\b(\d+|one|two|three|four)\s+(shared\s+)?(pairs|bonds)\b/i.exec(prompt)
    if (!said) return []
    const what = config.task.kind === 'make-ionic' ? 'the ions\' charges' : 'the bonds'
    return [`the prompt gives the answer away: it says ${what} ("${said[0].trim()}"), which the scene shows once it is marked -- name the ${config.task.kind === 'make-ionic' ? 'compound' : 'molecule'} and ask for full shells`]
  },

  initial(config) {
    if (config.task.kind === 'make-covalent') return { pairs: MOLECULES[config.task.molecule].dirs.map(() => 0) }
    return { shells: startShells(ionicAtoms(config.task.metal, config.task.nonmetal)) }
  },

  check(config, state) {
    if (config.task.kind === 'make-covalent') {
      const mol = MOLECULES[config.task.molecule]
      const pairs = readPairs(mol, state)
      if (!pairs) return { ok: false, wrongIds: [] }
      const counts = covalentCounts(mol, pairs)
      const wrong = mol.atoms.flatMap((el, i) => (counts[i] === capacity(el) ? [] : [`${covalentLabel(mol, i)}: ${counts[i]} in outer shell`]))
      return { ok: wrong.length === 0, wrongIds: wrong }
    }
    const atoms = ionicAtoms(config.task.metal, config.task.nonmetal)
    const shells = readShells(atoms, state)
    if (!shells) return { ok: false, wrongIds: [] }
    const wrong = atoms.flatMap((a, i) =>
      (a.metal ? shells[i].length === 0 : shells[i].length === 8) ? [] : [`${ionicLabel(a)}: ${shells[i].length} in outer shell`])
    return { ok: wrong.length === 0, wrongIds: wrong }
  },

  solve(config) {
    if (config.task.kind === 'make-covalent') {
      // Each outer atom needs as many pairs as its shell lacks; the centre's need is their sum.
      const mol = MOLECULES[config.task.molecule]
      return { pairs: mol.dirs.map((_, j) => capacity(mol.atoms[j + 1]) - outer(mol.atoms[j + 1])) }
    }
    // Each metal electron goes to the first non-metal with room.
    const atoms = ionicAtoms(config.task.metal, config.task.nonmetal)
    let shells = startShells(atoms)
    atoms.forEach((a, from) => {
      if (!a.metal) return
      while (shells[from].length > 0) {
        const to = atoms.findIndex((b, i) => !b.metal && shells[i].length < 8)
        const m = moveElectron(atoms, shells, from, to)
        if (!('next' in m)) return
        shells = m.next
      }
    })
    return { shells }
  },

  View: BondingView,

  prompt: `SCENE "bonding" -- dot-and-cross diagrams the learner builds, each atom's outer shell drawn as dots or
  crosses (configurations real, to Z = 20, and bromine). Ionic: the engine draws the atoms of the neutral compound
  (one Mg and two Cl; two Al and three O); the learner moves electrons from metal atoms to non-metal atoms (drag, or
  pick one atom then another) until each metal's outer shell is empty and each non-metal's is full; once marked it
  shows the ions' charges, the formula and the name. Covalent: the molecule's atoms sit next to their neighbours;
  the learner shares pairs between neighbours (one electron from each) until every shell is full (2 for H, 8 for
  the rest); once marked it counts the single, double and triple bonds and names the molecule. For: ionic and
  covalent bonding, dot-and-cross diagrams, ion charges and formulae, single, double and triple bonds.
  config: { "task": { "kind":"make-ionic", "metal":"<Li | Na | K | Mg | Ca | Al>", "nonmetal":"<F | Cl | Br | O | S | N>" } }
            -- not Na or K with N (not stable), nor Al with Cl, Br, S or N (not ionic)
       or { "task": { "kind":"make-covalent", "molecule":"<H2 | Cl2 | HCl | H2O | NH3 | CH4 | O2 | N2 | CO2>" } }
  Name the compound or molecule in the prompt; never its charges, formula ratio or number of bonds -- the scene
  shows those once it is marked.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Make magnesium chloride: move electrons until every atom has a full outer shell.",
    "payload": { "engine":"bonding", "config": { "task": { "kind":"make-ionic", "metal":"Mg", "nonmetal":"Cl" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:bonding", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Make a water molecule: share electrons until every shell is full.",
    "payload": { "engine":"bonding", "config": { "task": { "kind":"make-covalent", "molecule":"H2O" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:bonding", "why":"..." } }`,
}

registerEngine(bondingEngine as SceneEngine<unknown, unknown>)
