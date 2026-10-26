// lib/studylab/engines/atom/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { AtomView } from './View'

/**
 * Elements 1 to 20: symbol, name (Cambridge spellings: aluminium, sulfur) and
 * the mass number of the most abundant isotope.
 *
 * Source for the mass numbers: NIST, "Atomic Weights and Isotopic Compositions
 * for All Elements" (Coursey et al., NIST PML), which tabulates the IUPAC/CIAAW
 * representative isotopic compositions (Meija et al., Pure Appl. Chem. 88,
 * 293-306, 2016). Each agrees with the rounded relative atomic mass on the
 * Cambridge IGCSE Chemistry (0620) Periodic Table, except chlorine (Ar 35.5,
 * whose commonest isotope is chlorine-35 at 75.8%).
 */
const TABLE: readonly (readonly [symbol: string, name: string, mass: number])[] = [
  ['H', 'hydrogen', 1], ['He', 'helium', 4], ['Li', 'lithium', 7], ['Be', 'beryllium', 9],
  ['B', 'boron', 11], ['C', 'carbon', 12], ['N', 'nitrogen', 14], ['O', 'oxygen', 16],
  ['F', 'fluorine', 19], ['Ne', 'neon', 20], ['Na', 'sodium', 23], ['Mg', 'magnesium', 24],
  ['Al', 'aluminium', 27], ['Si', 'silicon', 28], ['P', 'phosphorus', 31], ['S', 'sulfur', 32],
  ['Cl', 'chlorine', 35], ['Ar', 'argon', 40], ['K', 'potassium', 39], ['Ca', 'calcium', 40],
]

export interface Element { z: number; symbol: string; name: string; mass: number }

/** The elements by atomic number: ELEMENTS[0] is hydrogen. */
export const ELEMENTS: readonly Element[] = TABLE.map(([symbol, name, mass], i) => ({ z: i + 1, symbol, name, mass }))

export const element = (z: number): Element | null => (Number.isInteger(z) && z >= 1 && z <= ELEMENTS.length ? ELEMENTS[z - 1] : null)

/**
 * The isotopes a task may name with `mass`, by atomic number: every naturally
 * occurring isotope in the NIST/CIAAW table above, plus the two radioactive
 * ones school courses name, hydrogen-3 (tritium, half-life 12.32 y) and
 * carbon-14 (half-life 5700 y), from NUBASE2020 (Kondev et al., Chinese
 * Physics C 45, 030001, 2021).
 */
export const ISOTOPES: Readonly<Record<number, readonly number[]>> = {
  1: [1, 2, 3], 2: [3, 4], 3: [6, 7], 4: [9], 5: [10, 11],
  6: [12, 13, 14], 7: [14, 15], 8: [16, 17, 18], 9: [19], 10: [20, 21, 22],
  11: [23], 12: [24, 25, 26], 13: [27], 14: [28, 29, 30], 15: [31],
  16: [32, 33, 34, 36], 17: [35, 37], 18: [36, 38, 40], 19: [39, 40, 41], 20: [40, 42, 43, 44, 46, 48],
}

/**
 * The common ion of each element that forms one, as charge. Source: the
 * Cambridge IGCSE Chemistry (0620) syllabus, 2.4 "Ions and ionic bonds" and
 * its qualitative-analysis notes: Group I metals lose one electron, Group II
 * two, aluminium three; nitrogen gains three, Group VI two, Group VII one.
 * Hydrogen (H+, a bare proton) is left out: it has no shells to draw.
 */
export const COMMON_IONS: Readonly<Record<number, number>> = {
  3: 1, 11: 1, 19: 1, 12: 2, 20: 2, 13: 3, 7: -3, 8: -2, 16: -2, 9: -1, 17: -1,
}

/**
 * How many electrons each shell holds in the school model for elements 1-20:
 * 2, then 8, then 8, then the fourth shell starts (2 at calcium). Source: the
 * Cambridge IGCSE Chemistry (0620) syllabus, 2.3 "Electronic configuration",
 * proton numbers 1 to 20, written as 2,8,1.
 */
export const SHELL_CAPS = [2, 8, 8, 2] as const
export const MAX_PROTONS = ELEMENTS.length
export const MAX_NEUTRONS = 30
export const MAX_ELECTRONS = SHELL_CAPS.reduce((a, b) => a + b, 0)

export type AtomTask =
  | { kind: 'build-atom'; z: number; mass: number }
  | { kind: 'build-ion'; z: number; mass: number; charge: number }
export type AtomConfig = { task: AtomTask }
/** What the learner has built: protons and neutrons in the nucleus, electrons in each shell from the inside out. */
export type AtomState = { protons: number; neutrons: number; shells: number[] }

// ── The rules ──────────────────────────────────────────────────────────────

/** Electrons filling the shells from the inside out: 11 gives [2, 8, 1, 0]. */
export function fill(electrons: number): number[] {
  let left = electrons
  return SHELL_CAPS.map((cap) => {
    const here = Math.max(0, Math.min(cap, left))
    left -= here
    return here
  })
}

export const totalElectrons = (shells: readonly number[]) => shells.reduce((a, b) => a + b, 0)

/** Whether every shell holding electrons sits outside full shells. */
export function inOrder(shells: readonly number[]): boolean {
  return shells.every((n, i) => n >= 0 && n <= SHELL_CAPS[i] && (i === 0 || n === 0 || shells[i - 1] === SHELL_CAPS[i - 1]))
}

/** The first inner shell left part-filled under an occupied outer one, numbered from 1; null when in order. */
export function gapShell(shells: readonly number[]): number | null {
  const outer = shells.reduce((last, n, i) => (n > 0 ? i : last), -1)
  for (let i = 0; i < outer; i++) if (shells[i] < SHELL_CAPS[i]) return i + 1
  return null
}

/** The configuration as written in class, "2,8,1"; trailing empty shells dropped. */
export function configString(shells: readonly number[]): string {
  const last = shells.reduce((l, n, i) => (n > 0 ? i : l), -1)
  return shells.slice(0, last + 1).join(',')
}

/** A charge as said: 0, 1+, 2−. */
export function chargeText(charge: number): string {
  return charge === 0 ? '0' : `${Math.abs(charge)}${charge > 0 ? '+' : '−'}`
}

/** A charge as written on a symbol: Na⁺ takes "+", Mg²⁺ "2+", Cl⁻ "−". */
export function ionSuffix(charge: number): string {
  return charge === 0 ? '' : `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '−'}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

/** What a state is, worked out from its parts. */
export function made(state: AtomState) {
  const el = element(state.protons)
  const electrons = totalElectrons(state.shells)
  const mass = state.protons + state.neutrons
  return {
    element: el,
    mass,
    charge: state.protons - electrons,
    electrons,
    config: configString(state.shells),
    gap: gapShell(state.shells),
    /** A real isotope we have data for, so "chlorine-37" can be said. */
    known: !!el && (ISOTOPES[el.z] ?? []).includes(mass),
  }
}

/**
 * The names of the common negative ions: a chlorine atom that gains an
 * electron is a chloride ion, never a "chlorine ion" (Cambridge IGCSE
 * Chemistry 0620, 2.4 and its naming of ionic compounds).
 */
export const ANION_NAMES: Readonly<Record<number, string>> = { 7: 'nitride', 8: 'oxide', 9: 'fluoride', 16: 'sulfide', 17: 'chloride' }

/** The ion's own name when the charge is the element's common one: "sodium ion", "chloride ion". */
function ionName(z: number, charge: number): string | null {
  if (COMMON_IONS[z] !== charge) return null
  return `${charge < 0 ? ANION_NAMES[z] : element(z)!.name} ion`
}

/** The nucleus in words: "chlorine-37" for an isotope we have data for, else "sodium with 11 neutrons". */
function nucleusName(state: AtomState, m: ReturnType<typeof made>): string {
  return m.known ? `${m.element!.name}-${m.mass}` : `${m.element!.name} with ${state.neutrons} ${state.neutrons === 1 ? 'neutron' : 'neutrons'}`
}

/** The name of what is built, for a right answer: "Sodium atom", "Chlorine-37 atom", "Chloride ion". */
export function builtName(state: AtomState): string {
  const m = made(state)
  if (!m.element) return 'No element'
  const isotope = m.mass !== m.element.mass ? `-${m.mass}` : ''
  if (m.charge === 0) return `${cap(m.element.name)}${isotope} atom`
  const ion = ionName(m.element.z, m.charge)
  if (!ion) return `${cap(m.element.name)}${isotope} with charge ${chargeText(m.charge)}`
  return isotope ? `${cap(ion)} from ${m.element.name}${isotope}` : cap(ion)
}

/**
 * What the learner made, said back when it is marked wrong: "You made a
 * magnesium-24 atom", "You made a chloride ion from chlorine-35", "You made
 * sodium-23 with charge 2+". An ion is named only when it is a real one.
 */
export function madeSentence(state: AtomState): string {
  const m = made(state)
  if (!m.element) return 'You made no element: there are no protons'
  const nucleus = nucleusName(state, m)
  if (m.charge === 0) {
    return m.known ? `You made ${article(nucleus)} ${nucleus} atom` : `You made ${article(nucleus)} ${m.element.name} atom with ${state.neutrons} ${state.neutrons === 1 ? 'neutron' : 'neutrons'}`
  }
  const ion = ionName(m.element.z, m.charge)
  return ion ? `You made ${article(ion)} ${ion} from ${nucleus}` : `You made ${nucleus}${m.known ? ' with' : ' and'} charge ${chargeText(m.charge)}`
}

/** The electrons as built, with what is out of order: "Electrons 2,7,3: shell 2 is not full". */
export function electronsLine(state: AtomState): string {
  const m = made(state)
  if (m.electrons === 0) return 'No electrons'
  return `Electrons ${m.config}${m.gap ? `: shell ${m.gap} is not full` : ''}`
}

// ── Reading what the tutor wrote ────────────────────────────────────────────

const BY_NAME = new Map<string, number>([
  ...ELEMENTS.map((e) => [e.name, e.z] as const),
  // Symbols are distinct from each other, case aside, for elements 1-20.
  ...ELEMENTS.map((e) => [e.symbol.toLowerCase(), e.z] as const),
  ['aluminum', 13], ['sulphur', 16],
])

const signOf = (c: string) => (c === '+' ? 1 : -1)
const SIGN = '[+\\-−–]'

/** "Na", "sodium", 11, "chlorine-37", "37Cl", "Mg2+", "Cl-" and "Mg+2" all name an element, some with a mass or charge. */
export function readElement(raw: unknown): { z: number; mass?: number; charge?: number } | null {
  if (typeof raw === 'number') return element(raw) ? { z: raw } : null
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/\s+(atom|ion|isotope)$/, '').trim()
  const z = (w: string) => BY_NAME.get(w) ?? null
  let m: RegExpMatchArray | null
  if (/^\d+$/.test(s)) return element(Number(s)) ? { z: Number(s) } : null
  // An ion, its charge written after the symbol: "mg2+", "cl-", "o 2−", "mg^2+".
  if ((m = s.match(new RegExp(`^([a-z]+)\\s*\\^?\\s*(\\d*)\\s*(${SIGN})$`)))) {
    const at = z(m[1])
    return at ? { z: at, charge: signOf(m[3]) * (m[2] ? Number(m[2]) : 1) } : null
  }
  // "mg+2": a plus before digits is a charge (an isotope is written with a hyphen).
  if ((m = s.match(/^([a-z]+)\s*\^?\s*\+\s*(\d+)$/))) {
    const at = z(m[1])
    return at ? { z: at, charge: Number(m[2]) } : null
  }
  // An isotope: "chlorine-37", "cl 37", "c14", "37cl".
  if ((m = s.match(/^([a-z]+)\s*[-–]?\s*(\d+)$/))) {
    const at = z(m[1])
    return at ? { z: at, mass: Number(m[2]) } : null
  }
  if ((m = s.match(/^(\d+)\s*[-–]?\s*([a-z]+)$/))) {
    const at = z(m[2])
    return at ? { z: at, mass: Number(m[1]) } : null
  }
  const at = z(s)
  return at ? { z: at } : null
}

/** 2, "+2", "2+", "-1", "1−", "−": a whole-number charge. Undefined when absent, null when unreadable. */
export function readCharge(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(new RegExp(`^(${SIGN})?\\s*(\\d*)\\s*(${SIGN})?$`))
  if (!m || (m[1] && m[3]) || (!m[1] && !m[2] && !m[3])) return null
  const size = m[2] ? Number(m[2]) : 1
  const sign = m[1] ?? m[3]
  return sign ? signOf(sign) * size : size
}

function readMass(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return undefined
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

function readKind(raw: unknown): AtomTask['kind'] | null {
  const k = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[\s_]+/g, '-') : ''
  return k === 'build-atom' || k === 'make-atom' ? 'build-atom' : k === 'build-ion' || k === 'make-ion' ? 'build-ion' : null
}

/** The state exactly as stored, or null if any part is missing or out of range. */
function readState(raw: unknown): AtomState | null {
  const s = raw as Partial<AtomState> | null
  const whole = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
  if (!s || !whole(s.protons, MAX_PROTONS) || !whole(s.neutrons, MAX_NEUTRONS)) return null
  if (!Array.isArray(s.shells) || s.shells.length !== SHELL_CAPS.length || !s.shells.every((n, i) => whole(n, SHELL_CAPS[i]))) return null
  return { protons: s.protons as number, neutrons: s.neutrons as number, shells: [...s.shells] }
}

/** The state as the view can draw it: anything unreadable becomes an empty atom. */
export function drawable(raw: unknown): AtomState {
  return readState(raw) ?? { protons: 0, neutrons: 0, shells: SHELL_CAPS.map(() => 0) }
}

/** How many electrons the finished task has. */
export const targetElectrons = (task: AtomTask) => (task.kind === 'build-ion' ? task.z - task.charge : task.z)

export function isotopeName(z: number, mass: number): string {
  return `${element(z)?.name ?? 'element'}-${mass}`
}

export const atomEngine: SceneEngine<AtomConfig, AtomState> = {
  id: 'atom',
  covers: [
    'atomic structure', 'protons, neutrons and electrons', 'proton number and mass number', 'isotopes',
    'electron shells', 'electronic configuration (2,8,1)', 'how ions form', 'ions of elements 1 to 20',
  ],
  isolates: 'structure',

  parse(raw) {
    const task = (raw as { task?: Record<string, unknown> } | null)?.task
    if (!task || typeof task !== 'object') return null
    const kind = readKind(task.kind)
    const el = readElement(task.element)
    if (!kind || !el) return null
    const given = readMass(task.mass)
    if (given === null || (given !== undefined && el.mass !== undefined && given !== el.mass)) return null
    const mass = given ?? el.mass ?? element(el.z)!.mass
    // A nucleus the scene can draw: no fewer nucleons than protons, and room for the neutrons.
    if (mass < el.z || mass - el.z > MAX_NEUTRONS) return null
    const charge = readCharge(task.charge)
    if (charge === null || (charge !== undefined && el.charge !== undefined && charge !== el.charge)) return null
    if (kind === 'build-atom') {
      // An atom is neutral: a charge here means the writer wanted an ion.
      if (el.charge !== undefined || (charge !== undefined && charge !== 0)) return null
      return { task: { kind, z: el.z, mass } }
    }
    const q = charge ?? el.charge
    // An ion has a charge, and electrons the shells can hold.
    if (q === undefined || q === 0 || el.z - q < 0 || el.z - q > MAX_ELECTRONS) return null
    return { task: { kind, z: el.z, mass, charge: q } }
  },

  faults({ task }) {
    const el = element(task.z)!
    const out: string[] = []
    const isotopes = ISOTOPES[task.z] ?? []
    if (!isotopes.includes(task.mass)) {
      const list = isotopes.map((m) => isotopeName(task.z, m))
      out.push(`${isotopeName(task.z, task.mass)} is not an isotope this scene has data for: set mass to one of ${list.join(', ')}, or leave mass out for ${isotopeName(task.z, el.mass)}`)
    }
    if (task.kind === 'build-ion') {
      const common = COMMON_IONS[task.z]
      if (common === undefined) {
        const ions = Object.entries(COMMON_IONS).map(([z, q]) => `${element(Number(z))!.symbol}${ionSuffix(q)}`)
        out.push(`${el.name} forms no ion this scene supports: use build-atom, or one of ${ions.join(', ')}`)
      } else if (common !== task.charge) {
        out.push(`${el.name} forms ${el.symbol}${ionSuffix(common)}, not charge ${chargeText(task.charge)}: set charge to ${common}`)
      }
    }
    return out
  },

  // The element, its mass number and an ion's charge are the task; the counts and shells are what is worked out.
  promptFaults(_config, prompt) {
    const said = /\b\d+\s*(protons?|neutrons?|electrons?)\b/i.exec(prompt) ?? /\b\d\s*[,.]\s*\d\b/.exec(prompt)
    return said ? [`the prompt gives the answer away ("${said[0]}"): the learner works out the particles and shells from the element -- name the element and its mass number only ("Build an atom of sodium-23.")`] : []
  },

  initial({ task }) {
    // An atom is built from nothing; an ion starts as its neutral atom, so the learner moves only electrons.
    if (task.kind === 'build-atom') return { protons: 0, neutrons: 0, shells: fill(0) }
    return { protons: task.z, neutrons: task.mass - task.z, shells: fill(task.z) }
  },

  check({ task }, raw) {
    const s = readState(raw)
    if (!s) return { ok: false, wrongIds: ['protons', 'neutrons', 'electrons', 'shells'] }
    const wrongIds: string[] = []
    if (s.protons !== task.z) wrongIds.push('protons')
    if (s.neutrons !== task.mass - task.z) wrongIds.push('neutrons')
    if (totalElectrons(s.shells) !== targetElectrons(task)) wrongIds.push('electrons')
    if (!inOrder(s.shells)) wrongIds.push('shells')
    return { ok: wrongIds.length === 0, wrongIds }
  },

  solve({ task }) {
    return { protons: task.z, neutrons: task.mass - task.z, shells: fill(targetElectrons(task)) }
  },

  View: AtomView,

  prompt: `SCENE "atom" -- an atom the learner builds: protons and neutrons in the nucleus, electrons in shells
  round it (the inner shell holds 2, the next two hold 8, the fourth starts after them). Buttons, keys or a tap on a
  shell add and remove each particle; the counts and the charge show live. The element's name, its symbol with
  mass and atomic numbers, and its electron configuration ("2,8,1") appear only once it is marked. Elements 1-20
  (hydrogen to calcium), real mass numbers. For: atomic structure; protons, neutrons and electrons; proton number
  and mass number; isotopes; electron shells and configuration; how ions form.
  config: { "task": { "kind":"build-atom", "element":"<symbol or name, H to Ca>" } }  -- build it from nothing, as
            its most common isotope (sodium-23, chlorine-35)
       or { "task": { "kind":"build-atom", "element":"chlorine", "mass":37 } }  -- a named isotope: any naturally
            occurring one (hydrogen-2, carbon-13, chlorine-37, ...) or hydrogen-3 or carbon-14
       or { "task": { "kind":"build-ion", "element":"Mg", "charge":2 } }  -- starts as the neutral atom with its
            nucleus fixed; the learner adds or takes away electrons. Ions: Li+ Na+ K+ (charge 1), Mg2+ Ca2+ (2),
            Al3+ (3), F- Cl- (-1), O2- S2- (-2), N3- (-3)
  The scene never names the element before marking, so the prompt must, with the mass number unless the learner
  should read it from a periodic table: "Build an atom of sodium-23", "Make the magnesium ion, Mg2+".
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Build an atom of sodium-23: its protons, its neutrons, and its electrons in their shells.",
    "payload": { "engine":"atom", "config": { "task": { "kind":"build-atom", "element":"Na" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:atom", "why":"..." } }`,
}

registerEngine(atomEngine as SceneEngine<unknown, unknown>)
