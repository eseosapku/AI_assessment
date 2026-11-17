// lib/studylab/engines/organic-chemistry/config.ts
//
// A displayed-formula workbench. The learner changes connectivity, never a label:
// build a molecule carbon by carbon; open C=C and add bromine, hydrogen or steam;
// or open three monomers and join them into one addition-polymer chain.
//
// School chemistry: carbon valence four; alkanes CnH2n+2 and alkenes CnH2n;
// alcohols contain -OH and carboxylic acids -COOH. Bromine water is orange and is
// decolourised by addition to C=C. Addition polymerisation uses the whole monomer,
// with no small molecule lost. Sources: RSC, "Everything you need to introduce
// alkenes" (2024), "Teaching alcohols at 14-16", and "How to teach polymers".
// No mechanism, stereochemistry or Markovnikov rule is claimed.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { OrganicChemistryView } from './View'

export const MAX_CARBONS = 4
export const MONOMERS = 3
export type Family = 'alkane' | 'alkene' | 'alcohol' | 'acid'
export type Reagent = 'bromine' | 'hydrogen' | 'steam'
export type Molecule = { n: number; edges: [number, number, number][]; groups: Record<number, Family>; additions?: Record<number, string> }

export type OrganicConfig =
  | { task: 'build'; family: string; carbons: number; isomer: number }
  | { task: 'add'; carbons: number; reagent: string }
  | { task: 'polymer'; monomer: string }
/** Carbon skeleton, bond orders and functional-group placements; atom order is irrelevant. */
export type OrganicState = { n?: number; edges?: [number, number, number][]; groups?: Record<number, string>; added?: boolean; joined?: number[] }

export const FAMILIES: Family[] = ['alkane', 'alkene', 'alcohol', 'acid']
export const REAGENTS: Reagent[] = ['bromine', 'hydrogen', 'steam']
export const MONOMER_NAMES = ['ethene', 'propene', 'chloroethene', 'pvc', 'vinyl-chloride']
export const POLY_WIDTH = 360
export const POLY_HEIGHT = 238
export const POLY_CENTRES = [76, 180, 284]

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const cleanEdges = (edges: unknown, n: number): [number, number, number][] => Array.isArray(edges)
  ? edges.filter((e): e is [number, number, number] => Array.isArray(e) && e.length === 3 && e.slice(0, 2).every((v) => Number.isInteger(v) && v >= 0 && v < n) && e[0] !== e[1] && Number.isInteger(e[2]) && e[2] >= 1 && e[2] <= 2)
    .map((e) => [Math.min(e[0], e[1]), Math.max(e[0], e[1]), e[2]])
  : []

/** Safe reading of stored work. Invalid or disconnected molecules remain drawable but wrong. */
export function moleculeOf(state: OrganicState | null | undefined, fallback: Molecule): Molecule {
  if (!state || typeof state !== 'object') return fallback
  const n = Number.isInteger(state.n) ? Math.max(1, Math.min(MAX_CARBONS, state.n!)) : fallback.n
  const raw = cleanEdges(state.edges, n)
  const edges = raw.filter((e, i) => raw.findIndex((x) => x[0] === e[0] && x[1] === e[1]) === i)
  const groups: Record<number, Family> = {}
  if (state.groups && typeof state.groups === 'object') {
    for (const [k, v] of Object.entries(state.groups)) {
      const i = Number(k)
      if (Number.isInteger(i) && i >= 0 && i < n && (v === 'alcohol' || v === 'acid')) groups[i] = v
    }
  }
  return { n, edges, groups }
}

export const targetMolecule = (config: Extract<OrganicConfig, { task: 'build' }>): Molecule => {
  const n = Math.max(1, Math.min(MAX_CARBONS, config.carbons))
  const family = FAMILIES.includes(config.family as Family) ? config.family as Family : 'alkane'
  if (family === 'alkane' && n === 4 && config.isomer === 1) return { n, edges: [[0, 1, 1], [1, 2, 1], [1, 3, 1]], groups: {} }
  const edges: [number, number, number][] = Array.from({ length: Math.max(0, n - 1) }, (_, i) => [i, i + 1, 1])
  const groups: Record<number, Family> = {}
  if (family === 'alkene' && n >= 2) edges[Math.max(0, Math.min(n - 2, config.isomer))][2] = 2
  if (family === 'alcohol') groups[Math.max(0, Math.min(n - 1, config.isomer))] = 'alcohol'
  if (family === 'acid') groups[0] = 'acid'
  return { n, edges, groups }
}

export function startingMolecule(config: OrganicConfig): Molecule {
  if (config.task === 'build') return { n: 1, edges: [], groups: {} }
  if (config.task === 'add') {
    const n = Math.max(2, Math.min(MAX_CARBONS, config.carbons))
    return { n, edges: [...Array.from({ length: n - 1 }, (_, i) => [i, i + 1, 1] as [number, number, number]), ...([] as never[])].map((e, i) => i === 0 ? [0, 1, 2] : e), groups: {} }
  }
  return config.monomer === 'propene'
    ? { n: 3, edges: [[0, 1, 2], [1, 2, 1]], groups: {} }
    : { n: 2, edges: [[0, 1, 2]], groups: {} }
}

export function connected(m: Molecule): boolean {
  if (m.edges.length !== m.n - 1) return false
  const seen = new Set([0])
  let changed = true
  while (changed) {
    changed = false
    for (const [a, b] of m.edges) {
      if (seen.has(a) && !seen.has(b)) { seen.add(b); changed = true }
      if (seen.has(b) && !seen.has(a)) { seen.add(a); changed = true }
    }
  }
  return seen.size === m.n
}

export const orderAt = (m: Molecule, a: number, b: number) => m.edges.find((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))?.[2] ?? 0

/** Exact valence accounting. Hydrogens occupy every remaining carbon bond; acid OH is included. */
export function carbonValence(m: Molecule, i: number): number {
  return m.edges.reduce((s, [a, b, o]) => s + (a === i || b === i ? o : 0), 0) + (m.groups[i] === 'acid' ? 3 : m.groups[i] === 'alcohol' ? 1 : 0) + (m.additions?.[i]?.length ?? 0)
}
export const validMolecule = (m: Molecule) => connected(m) && Array.from({ length: m.n }, (_, i) => carbonValence(m, i)).every((v) => v <= 4)

function sameMolecule(a: Molecule, b: Molecule): boolean {
  if (a.n !== b.n) return false
  const permutations = (xs: number[]): number[][] => xs.length < 2 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
  return permutations(Array.from({ length: a.n }, (_, i) => i)).some((p) => {
    for (let i = 0; i < a.n; i++) for (let j = i; j < a.n; j++) {
      if (orderAt(a, i, j) !== orderAt(b, p[i], p[j])) return false
    }
    return Array.from({ length: a.n }, (_, i) => a.groups[i] ?? null).every((g, i) => g === (b.groups[p[i]] ?? null))
  })
}

export const done = (config: OrganicConfig, state: OrganicState): boolean => {
  if (config.task === 'build') {
    const made = moleculeOf(state, startingMolecule(config))
    return validMolecule(made) && sameMolecule(made, targetMolecule(config))
  }
  if (config.task === 'add') return state.added === true
  return Array.isArray(state.joined) && state.joined.length === MONOMERS && new Set(state.joined).size === MONOMERS && state.joined.every((j) => Number.isInteger(j) && j >= 0 && j < MONOMERS)
}

export const familyName = (family: string) => family === 'acid' ? 'carboxylic acid' : family
export const moleculeName = (family: string, n: number) => {
  const stems = ['meth', 'eth', 'prop', 'but']
  const stem = stems[Math.max(0, Math.min(3, n - 1))]
  if (family === 'alkene') return `${stem}ene`
  if (family === 'alcohol') return `${stem}anol`
  if (family === 'acid') return `${stem}anoic acid`
  return `${stem}ane`
}
export const monomerName = (id: string) => id === 'propene' ? 'propene' : id === 'chloroethene' ? 'chloroethene' : 'ethene'
export const reagentName = (id: string) => id === 'hydrogen' ? 'hydrogen' : id === 'steam' ? 'steam' : 'bromine water'

export function addedMolecule(config: Extract<OrganicConfig, { task: 'add' }>): Molecule {
  const start = startingMolecule(config)
  return { ...start, edges: start.edges.map((e, i) => i === 0 ? [e[0], e[1], 1] : e) }
}

export function working(config: OrganicConfig): string {
  if (config.task === 'build') {
    const name = moleculeName(config.family, config.carbons)
    if (config.family === 'alkane' && config.carbons === 4 && config.isomer === 1) return 'Yes: methylpropane, a branched isomer of C4H10. The same molecular formula can join its atoms in a different order. Every carbon still has four bonds.'
    const facts: Record<string, string> = {
      alkane: `Alkanes share CnH2n+2 and only single carbon–carbon bonds.`,
      alkene: `The C=C bond makes this an alkene, with general formula CnH2n.`,
      alcohol: `The –OH functional group makes it an alcohol; alcohols share similar chemical properties.`,
      acid: `The –COOH functional group makes it a carboxylic acid. Its carbonyl C=O and hydroxyl O–H are both shown.`,
    }
    return `Yes: ${name}. ${facts[config.family] ?? facts.alkane} Every carbon has four bonds; unused bonds carry H.`
  }
  if (config.task === 'add') {
    if (config.reagent === 'bromine') return 'Yes. One Br has joined to each carbon of the old double bond, leaving C–C. The orange bromine water is colourless because its bromine has been used up: this is an addition reaction.'
    if (config.reagent === 'hydrogen') return 'Yes. H–H has added across C=C: one H joined each carbon, leaving an alkane with only single bonds. This addition is called hydrogenation.'
    return 'Yes. H joined one carbon and –OH the other, making ethanol. Steam addition needs heat and a phosphoric acid catalyst; the card shows the overall bonds made.'
  }
  const name = config.monomer === 'propene' ? 'poly(propene)' : config.monomer === 'chloroethene' ? 'poly(chloroethene)' : 'poly(ethene)'
  return `Yes: one chain of ${name}. Each double bond opened and joined the next monomer. No atoms were lost: the bracketed repeat unit keeps the monomer's atoms, with single bonds continuing at both ends.`
}

export function madeText(config: OrganicConfig, state: OrganicState): string {
  if (config.task === 'add') return 'The reagent is still waiting. Bring it onto the double bond so both of its parts can attach.'
  if (config.task === 'polymer') {
    const n = Array.isArray(state.joined) ? new Set(state.joined).size : 0
    return n === 0 ? 'The monomers are still separate. Open a double bond, then join the next monomer.' : `You joined ${n} of the three monomers. Join all three into one continuous chain.`
  }
  const m = moleculeOf(state, startingMolecule(config))
  if (!connected(m)) return `You have ${m.n} carbon${m.n === 1 ? '' : 's'}, but they are not all joined into one molecule yet.`
  const over = Array.from({ length: m.n }, (_, i) => carbonValence(m, i)).findIndex((v) => v > 4)
  if (over >= 0) return `Carbon ${over + 1} has more than four bonds. Remove a bond or functional group there.`
  return `You made a molecule with ${m.n} carbon${m.n === 1 ? "" : "s"}, but its bonds do not match the one asked for. Count the bonds on each carbon, and check which bond should be double.`
}

const TASK_WORDS: Record<string, OrganicConfig['task']> = {
  build: 'build', molecule: 'build', 'build-molecule': 'build', draw: 'build', 'displayed-formula': 'build', structural: 'build', isomer: 'build', isomers: 'build', homologous: 'build',
  add: 'add', addition: 'add', bromine: 'add', 'bromine-water': 'add', hydrogenate: 'add', hydrogenation: 'add', hydration: 'add', steam: 'add', unsaturated: 'add',
  polymer: 'polymer', polymerise: 'polymer', polymerize: 'polymer', polymerisation: 'polymer', polymerization: 'polymer', 'addition-polymerisation': 'polymer', 'addition-polymerization': 'polymer',
}
const FAMILY_WORDS: Record<string, Family> = { alkane: 'alkane', alkanes: 'alkane', saturated: 'alkane', alkene: 'alkene', alkenes: 'alkene', unsaturated: 'alkene', alcohol: 'alcohol', alcohols: 'alcohol', acid: 'acid', 'carboxylic-acid': 'acid', 'carboxylic-acids': 'acid' }
const REAGENT_WORDS: Record<string, Reagent> = { bromine: 'bromine', 'bromine-water': 'bromine', br2: 'bromine', hydrogen: 'hydrogen', h2: 'hydrogen', hydrogenation: 'hydrogen', steam: 'steam', water: 'steam', hydration: 'steam' }

const goodPrompt = (config: OrganicConfig) => {
  if (config.task === 'build') {
    const isomer = config.family === 'alkane' && config.carbons === 4 && config.isomer === 1 ? 'the branched isomer of butane' : moleculeName(config.family, config.carbons)
    return `Build ${isomer}. Select a carbon and tap + carbon to join another; tap a bond to change single/double${config.family === 'alcohol' || config.family === 'acid' ? ', and use Place to add its functional group' : ''}.`
  }
  if (config.task === 'add') return `Drag the ${reagentName(config.reagent)} molecule onto C=C, or tap it then tap the double bond. Make the addition product and watch what happens.`
  return `Make one chain from all three ${monomerName(config.monomer)} monomers. Tap each C=C to open it, then tap the glowing join between neighbouring monomers.`
}

export const organicChemistryEngine: SceneEngine<OrganicConfig, OrganicState> = {
  id: 'organic-chemistry',
  covers: ['alkanes', 'alkenes', 'hydrocarbons', 'homologous', 'isomers', 'polymerisation'],
  phrases: [
    'organic chemistry', 'organic molecules', 'organic compounds', 'functional groups', 'functional group', 'homologous series', 'general formula', 'structural isomers', 'structural isomerism', 'displayed formulae', 'displayed formulas', 'displayed formula', 'structural formulae', 'structural formulas',
    'saturated hydrocarbons', 'unsaturated hydrocarbons', 'saturated and unsaturated', 'bromine water', 'test for alkenes', 'testing for alkenes', 'addition reactions', 'addition reaction', 'alkene reactions', 'hydrogenation of alkenes', 'hydration of ethene',
    'addition polymers', 'addition polymerisation', 'addition polymerization', 'polymers and polymerisation', 'polymers and polymerization', 'polythene', 'poly(ethene)', 'polypropene', 'poly(propene)', 'PVC', 'repeat unit', 'repeat units', 'monomers and polymers',
  ],
  notFor: [
    'covalent bonding', 'dot-and-cross', 'dot and cross', 'fractional distillation', 'separating mixtures', 'separation techniques', 'fuels and climate', 'carbon cycle', 'climate change', 'global warming', 'rates of reaction', 'rate of reaction', 'collision theory',
    'proteins', 'protein synthesis', 'DNA', 'RNA', 'enzymes', 'biological polymers', 'condensation polymerisation', 'condensation polymerization', 'condensation polymers', 'polyesters', 'polyamides', 'nylon',
    'cracking', 'electrophilic mechanisms', 'curly arrows', 'Markovnikov', 'optical isomerism', 'stereoisomerism', 'benzene', 'arenas',
  ],
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const rawFamily = first(src, ['family', 'series', 'group'])
    const rawReagent = first(src, ['reagent', 'reactant', 'test'])
    const rawMonomer = first(src, ['monomer', 'alkene'])
    let task = word && has(TASK_WORDS, word) ? TASK_WORDS[word] : null
    if (word && !task) return null
    if (!task) task = rawMonomer !== undefined ? 'polymer' : rawReagent !== undefined ? 'add' : rawFamily !== undefined || src.carbons !== undefined ? 'build' : null
    if (!task) return null
    const number = first(src, ['carbons', 'carbonAtoms', 'carbonCount', 'n', 'size'])
    const carbons = typeof number === 'string' && number.trim() ? Number(number) : number
    if (carbons !== undefined && (typeof carbons !== 'number' || !Number.isFinite(carbons))) return null
    const isoRaw = first(src, ['isomer', 'position', 'doubleBond', 'branch'])
    const isomer = typeof isoRaw === 'string' ? Number(keyOf(isoRaw).replace(/^(?:isomer|position)-/, '')) : isoRaw
    if (isomer !== undefined && (typeof isomer !== 'number' || !Number.isFinite(isomer))) return null
    if (task === 'build') {
      const family = rawFamily === undefined ? 'alkane' : keyOf(rawFamily)
      return { task, family: has(FAMILY_WORDS, family) ? FAMILY_WORDS[family] : family, carbons: carbons ?? 2, isomer: Math.max(0, Math.round((isomer as number) ?? 0)) }
    }
    if (task === 'add') {
      const reagent = rawReagent === undefined ? (word === 'hydrogenation' || word === 'hydrogenate' ? 'hydrogen' : word === 'hydration' || word === 'steam' ? 'steam' : 'bromine') : keyOf(rawReagent)
      return { task, carbons: carbons ?? 2, reagent: has(REAGENT_WORDS, reagent) ? REAGENT_WORDS[reagent] : reagent }
    }
    const monomer = rawMonomer === undefined ? 'ethene' : keyOf(rawMonomer).replace(/^poly-/, '')
    return { task, monomer }
  },

  faults(config) {
    if (config.task === 'build') {
      const out: string[] = []
      if (!FAMILIES.includes(config.family as Family)) out.push(`There is no "${config.family}" family here: use alkane, alkene, alcohol or acid, e.g. family "alkene".`)
      if (!Number.isInteger(config.carbons) || config.carbons < 1 || config.carbons > MAX_CARBONS) out.push(`${config.carbons} carbons cannot be drawn: use a whole number from 1 to 4, e.g. carbons 2.`)
      if (config.family === 'alkene' && config.carbons < 2) out.push('An alkene needs at least two carbons for C=C: use carbons 2, e.g. ethene.')
      if (config.family === 'alkane' && config.carbons < 4 && config.isomer !== 0) out.push('Straight-chain alkanes have no chain isomer below four carbons: use carbons 4 and isomer 1 for methylpropane, or isomer 0.')
      if (config.family === 'alkene' && config.isomer > config.carbons - 2) out.push(`That double-bond position does not fit a ${config.carbons}-carbon chain: use isomer 0 for the first bond.`)
      if (config.family === 'alcohol' && config.isomer >= config.carbons) out.push(`That –OH position is beyond the chain: use isomer 0, or a number below ${config.carbons}.`)
      if (config.family === 'acid' && config.isomer !== 0) out.push('The –COOH group is at the end carbon by definition: use isomer 0.')
      return out
    }
    if (config.task === 'add') {
      const out: string[] = []
      if (!REAGENTS.includes(config.reagent as Reagent)) out.push(`There is no "${config.reagent}" reagent drawn: use bromine, hydrogen or steam, e.g. reagent "bromine".`)
      if (!Number.isInteger(config.carbons) || config.carbons < 2 || config.carbons > MAX_CARBONS) out.push(`Addition needs a chain of 2 to 4 carbons: use carbons 2 for ethene.`)
      if (config.reagent === 'steam' && config.carbons !== 2) out.push('Steam addition is supported only for ethene, where either carbon gives ethanol: use carbons 2 and reagent "steam".')
      return out
    }
    return MONOMER_NAMES.includes(config.monomer) ? [] : [`There is no "${config.monomer}" monomer drawn: use ethene, propene or chloroethene, e.g. monomer "ethene".`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    if (config.task === 'build') {
      if (/\b(?:CH3|CH2|CH\d+|C[1-4]H\d+|H[2-9]H)\b/i.test(text) || /\bfour hydrogens\b|\b\d+\s+(?:hydrogens?|bonds?|single bonds?|double bonds?)\b/i.test(text) || /methylpropane|2-methylpropane/i.test(text)) {
        return [`the prompt gives away the formula or connectivity the learner is to construct -- ask for the molecule and give the gestures only ("${example}")`]
      }
    } else if (config.task === 'add') {
      if (/decolou|decolor|colourless|colorless|orange to colourless|orange to colorless|dibromo|1,2-|hydrogenation|ethanol|saturated alkane/i.test(text)) {
        return [`the prompt gives away the observation or product, which the card shows only after the addition -- ask for the reaction only ("${example}")`]
      }
    } else if (/repeat unit|\bno (?:atoms|small molecule)|poly\(|polythene|polypropene|PVC|single bonds? (?:at|continuing)/i.test(text)) {
      return [`the prompt names or describes the polymer answer, which is held back until marked -- ask for one chain from the three monomers ("${example}")`]
    }
    if (/\b(?:drag atoms|3D|dot-and-cross|curly arrows|fractionating|distillation|crack|combust|protein|DNA|condensation|Markovnikov)\b/i.test(text)) {
      return [`the prompt promises something this 2D displayed-formula workbench does not show -- use its actual gestures ("${example}")`]
    }
    return []
  },

  initial(config) {
    return config.task === 'build' ? (targetMolecule(config).n === 1 ? { n: 2, edges: [], groups: {} } : { n: 1, edges: [], groups: {} }) : config.task === 'add' ? { added: false } : { joined: [] }
  },
  check(config, state) { return { ok: done(config, state ?? {}), wrongIds: [] } },
  solve(config) {
    if (config.task === 'build') {
      const t = targetMolecule(config)
      return { n: t.n, edges: t.edges.map((e) => [...e] as [number, number, number]), groups: { ...t.groups } }
    }
    return config.task === 'add' ? { added: true } : { joined: [0, 1, 2] }
  },
  View: OrganicChemistryView,

  prompt: `SCENE "organic-chemistry" -- a crafted displayed-formula workbench on a quiet light panel. Atoms are engraved letter tiles with fine real bonds; unused carbon valences are filled with H automatically. It is about atom connectivity and what a C=C bond can do, not general dot-and-cross bonding.
  build: the learner builds a molecule, not picks one. Select a carbon, use + carbon / - carbon; tap a C-C bond to cycle single and double; with an alcohol or acid task, tap the selected carbon's functional-group button to place or remove -OH / -COOH. A reset button restores one carbon. At most four carbons. Marking compares connectivity up to atom renumbering, so drawing order and layout never matter. Every carbon must have valence four and all carbons must be connected. Once marked, the card names the molecule and its family/functional group/general formula. config { "task":"build", "family":"alkane"|"alkene"|"alcohol"|"acid", "carbons":1..4, "isomer":0 }. For an alkene, isomer is the zero-based double-bond position; for an alcohol, the zero-based carbon carrying -OH. Alkane with carbons 4 and isomer 1 requests branched methylpropane. Acid always uses the end carbon.
  add: one alkene with C=C at the start of its chain, plus a real reagent molecule: Br-Br in orange bromine water, H-H, or H-OH. Drag the reagent onto C=C (a large landing target), or tap reagent then double bond. One line of C=C visibly opens; Br, H and H, or H and OH attach to the two carbons. Bromine water visibly turns from orange to colourless. No regioselectivity: steam is accepted only for ethene. config { "task":"add", "carbons":2..4, "reagent":"bromine"|"hydrogen"|"steam" }.
  polymer: three separate ethene, propene or chloroethene monomers, drawn across one panel with substituents clearly shown. Tap each C=C to open it, then tap the glowing joins between neighbours to link all three. The chain visibly grows. The repeat-unit bracket and polymer name appear only when marked. config { "task":"polymer", "monomer":"ethene"|"propene"|"chloroethene" }.
  For: homologous series, functional groups, alkanes, alkenes, alcohols and carboxylic acids up to four carbons, displayed/structural formulae, structural isomers, saturated/unsaturated, the bromine-water test, addition with bromine/hydrogen/steam, and addition polymerisation. Not for cracking, distillation, combustion, condensation polymers, proteins/DNA, mechanisms or 3D shape.
  Before marking the card shows the structure, current atoms/bonds, and the event happening; it never names the target beyond the prompt or the product/polymer. The prompt must give the exact gesture and not state formulas, atom counts, product names, colour changes or repeat units.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Build ethene. Select a carbon and tap + carbon to join another, then tap the bond to change single/double.",
    "payload": { "engine":"organic-chemistry", "config": { "task":"build", "family":"alkene", "carbons":2, "isomer":0 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:organic-chemistry", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the bromine water molecule onto C=C, or tap it then tap the double bond. Make the addition product and watch what happens.",
    "payload": { "engine":"organic-chemistry", "config": { "task":"add", "carbons":2, "reagent":"bromine" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:organic-chemistry", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Make one chain from all three ethene monomers. Tap each C=C to open it, then tap the glowing join between neighbouring monomers.",
    "payload": { "engine":"organic-chemistry", "config": { "task":"polymer", "monomer":"ethene" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:organic-chemistry", "why":"..." } }`,
}

registerEngine(organicChemistryEngine as SceneEngine<unknown, unknown>)
