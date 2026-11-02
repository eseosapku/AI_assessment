// lib/studylab/engines/equation-balancer/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EquationBalancerView } from './View'

/**
 * Atoms are never made or lost, they only change partners. Two tasks:
 *
 * balance: the tutor gives the formulae of the reactants and products. The learner
 * taps + and - on the number in FRONT of each formula (the coefficient); whole
 * molecules appear and leave, and the atoms of each element on the two sides are
 * counted beside them. The small numbers inside a formula (subscripts) cannot be
 * touched, which is the misconception this scene is for: changing the subscript changes
 * the substance (H2O to H2O2), changing the coefficient only changes how many.
 * The engine parses the formulae exactly (brackets included), finds the smallest
 * whole-number coefficients itself by solving the atom-conservation equations, and
 * marks by atom counts. Any whole-number multiple is balanced but not simplest.
 *
 * quantities: the equation is given balanced (the engine computes it) with a number
 * of molecules of each reactant. The learner taps + and - on how many times the
 * reaction runs; each run uses up reactant molecules and makes product molecules.
 * The task is to run it as many times as the atoms allow: the reactant that runs
 * out first limits it, and the others are left over.
 *
 * Nothing here is chemistry the engine invents. The formulae come from the tutor;
 * the engine checks only that the atoms are conserved. Element symbols are the
 * IUPAC periodic table. All arithmetic is exact whole numbers.
 *
 * Research behind the design (ideas only, nothing copied): PhET "Balancing
 * Chemical Equations" (molecules drawn as atom balls, a per-element count on both
 * sides, tap to change a coefficient, subscripts locked) and PhET "Reactants,
 * Products and Leftovers" (the sandwich analogy, leftovers shown as what remains);
 * the classroom literature on students changing subscripts instead of coefficients
 * (Yarroch 1985, J. Res. Sci. Teach.).
 */

export const COEF_MIN = 1
/** The learner's + stops here. */
export const COEF_MAX = 8
/** The tutor's smallest balanced coefficients may be at most this. */
export const MIN_SOLUTION_MAX = 6
export const SIDE_MAX = 3
export const TOTAL_MAX = 5
export const HAVE_MAX = 8
export const PRODUCT_DRAW_MAX = 12
/** A molecule of at most this many atoms is drawn atom by atom; a bigger one as one ball per element. */
export const DRAW_ATOMS_MAX = 8
export const ELEMENTS_PER_FORMULA_MAX = 5

export type Atoms = Record<string, number>
export type EquationConfig =
  | { task: 'balance'; reactants: string[]; products: string[] }
  | { task: 'quantities'; reactants: string[]; products: string[]; have: number[] }
export type EquationState = { co: number[]; runs: number }

// IUPAC symbols, atomic numbers 1 to 118.
const SYMBOLS = new Set(
  ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe ' +
    'Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr ' +
    'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '),
)

/** The atoms in one formula, brackets and subscripts exact, or null when it cannot be read. */
export function parseFormula(raw: string): Atoms | null {
  if (typeof raw !== 'string') return null
  const s = raw
    .replace(/[\u2080-\u2089]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, '')
    .replace(/\((?:s|l|g|aq)\)$/, '')
  if (!s) return null
  let i = 0
  const num = (): number | null => {
    const m = /^\d+/.exec(s.slice(i))
    if (!m) return 1
    i += m[0].length
    const n = Number(m[0])
    return n >= 1 && n <= 99 ? n : null
  }
  const seq = (close: string | null): Atoms | null => {
    const out: Atoms = {}
    let any = false
    while (i < s.length) {
      const c = s[i]
      if (c === ')' || c === ']') return close === c && any ? out : null
      if (c === '(' || c === '[') {
        i++
        const inner = seq(c === '(' ? ')' : ']')
        if (!inner || s[i] !== (c === '(' ? ')' : ']')) return null
        i++
        const n = num()
        if (n === null) return null
        for (const [el, k] of Object.entries(inner)) out[el] = (out[el] ?? 0) + k * n
        any = true
        continue
      }
      if (!/[A-Z]/.test(c)) return null
      const two = c + (s[i + 1] ?? '')
      const el = /^[A-Z][a-z]$/.test(two) && SYMBOLS.has(two) ? two : SYMBOLS.has(c) ? c : null
      if (!el) return null
      i += el.length
      const n = num()
      if (n === null) return null
      out[el] = (out[el] ?? 0) + n
      any = true
    }
    return close === null && any ? out : null
  }
  const r = seq(null)
  if (!r) return null
  return Object.values(r).reduce((a, b) => a + b, 0) <= 200 ? r : null
}

export const atomTotal = (a: Atoms) => Object.values(a).reduce((x, y) => x + y, 0)

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

/**
 * The smallest whole-number coefficients that conserve every atom, found by solving
 * the conservation equations exactly, or a reason there are none.
 */
export function smallestCoefficients(reactants: string[], products: string[]): { co: number[] } | { none: 'unreadable' | 'cannot' | 'many' } {
  const all = [...reactants, ...products].map(parseFormula)
  if (all.some((a) => !a) || all.length < 2) return { none: 'unreadable' }
  const atoms = all as Atoms[]
  const elements = [...new Set(atoms.flatMap((a) => Object.keys(a)))]
  const n = atoms.length
  // One row per element: reactant atoms minus product atoms = 0.
  const rows = elements.map((el) => atoms.map((a, j) => (a[el] ?? 0) * (j < reactants.length ? 1 : -1)))
  const pivots: number[] = []
  let r = 0
  for (let c = 0; c < n && r < rows.length; c++) {
    const p = rows.findIndex((row, k) => k >= r && row[c] !== 0)
    if (p < 0) continue
    ;[rows[r], rows[p]] = [rows[p], rows[r]]
    for (let k = 0; k < rows.length; k++) {
      if (k === r || rows[k][c] === 0) continue
      const f = rows[k][c]
      const g = rows[r][c]
      rows[k] = rows[k].map((v, j) => v * g - rows[r][j] * f)
      const d = rows[k].reduce((acc, v) => gcd(acc, v), 0)
      if (d > 1) rows[k] = rows[k].map((v) => v / d)
    }
    pivots.push(c)
    r++
  }
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => !pivots.includes(j))
  if (free.length === 0) return { none: 'cannot' }
  if (free.length > 1) return { none: 'many' }
  const f = free[0]
  // x_f = 1 (as a fraction over a common denominator); each pivot variable follows.
  const num: number[] = Array(n).fill(0)
  const den: number[] = Array(n).fill(1)
  num[f] = 1
  pivots.forEach((c, k) => {
    // rows[k][c] * x_c + rows[k][f] * x_f = 0
    let a = -rows[k][f]
    let b = rows[k][c]
    if (b < 0) { a = -a; b = -b }
    const g = gcd(a, b) || 1
    num[c] = a / g
    den[c] = b / g
  })
  const L = den.reduce((acc, d) => lcm(acc, d), 1)
  let co = num.map((v, j) => (v * L) / den[j])
  if (co.some((v) => v <= 0)) co = co.map((v) => -v)
  if (co.some((v) => v <= 0 || !Number.isInteger(v))) return { none: 'cannot' }
  const g = co.reduce((acc, v) => gcd(acc, v), 0)
  return { co: co.map((v) => v / g) }
}

/** Atoms of each element on the reactant side and the product side for given coefficients. */
export function countAtoms(config: EquationConfig, co: number[]): { el: string; left: number; right: number }[] {
  const nr = config.reactants.length
  const sums = new Map<string, { left: number; right: number }>()
  ;[...config.reactants, ...config.products].forEach((f, j) => {
    const a = parseFormula(f) ?? {}
    const k = Number.isInteger(co[j]) ? co[j] : 0
    for (const [el, n] of Object.entries(a)) {
      const cur = sums.get(el) ?? { left: 0, right: 0 }
      if (j < nr) cur.left += n * k
      else cur.right += n * k
      sums.set(el, cur)
    }
  })
  return [...sums.entries()].map(([el, v]) => ({ el, ...v }))
}

export type BalanceKind = 'simplest' | 'multiple' | 'unbalanced'
export function balanceKind(config: EquationConfig, co: number[]): BalanceKind {
  const best = smallestCoefficients(config.reactants, config.products)
  const n = config.reactants.length + config.products.length
  if (!('co' in best) || !Array.isArray(co) || co.length !== n || co.some((v) => !Number.isInteger(v) || v < COEF_MIN)) return 'unbalanced'
  if (countAtoms(config, co).some((c) => c.left !== c.right)) return 'unbalanced'
  return co.every((v, j) => v === best.co[j]) ? 'simplest' : 'multiple'
}

/** How many times the reaction can run, and what is left over. */
export function quantitiesOf(config: Extract<EquationConfig, { task: 'quantities' }>) {
  const best = smallestCoefficients(config.reactants, config.products)
  const co = 'co' in best ? best.co : config.reactants.concat(config.products).map(() => 1)
  const nr = config.reactants.length
  const runsEach = config.have.map((h, i) => Math.floor(h / co[i]))
  const max = Math.min(...runsEach)
  const limiting = config.reactants.filter((_, i) => runsEach[i] === max)
  return { co, max, limiting, runsEach, nr }
}

/** The molecules left of each reactant after `runs` runs; negative means it ran out. */
export const remaining = (config: Extract<EquationConfig, { task: 'quantities' }>, co: number[], runs: number) =>
  config.have.map((h, i) => h - runs * co[i])

const clean = (f: string) => f.replace(/\s+/g, '').replace(/\((?:s|l|g|aq)\)$/, '')
const sub = (f: string) => f.replace(/[\u2080-\u2089]/g, (c) => String(c.charCodeAt(0) - 0x2080))

function readSide(v: unknown): string[] | null {
  if (typeof v === 'string') {
    const parts = v.split(/\s*\+\s*/).map((x) => x.trim()).filter(Boolean)
    return parts.length ? parts : null
  }
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x.trim())) return v.map((x: string) => x.trim())
  return null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

export const equationBalancerEngine: SceneEngine<EquationConfig, EquationState> = {
  id: 'equation-balancer',
  // "equation" alone is in every maths topic; only words that are chemistry's own are single covers.
  covers: ['stoichiometry', 'stoichiometric'],
  phrases: [
    'balancing equations', 'balancing chemical equations', 'balance chemical equations', 'balanced equations', 'balanced chemical equations',
    'chemical equations', 'symbol equations', 'word equations', 'equation balancing', 'writing equations', 'conservation of mass',
    'law of conservation of mass', 'reacting quantities', 'reacting amounts', 'reacting masses', 'limiting reagent', 'limiting reactant', 'limiting reagents',
    'limiting reactants', 'excess reactant', 'excess reagent', 'mole ratio', 'mole ratios', 'mole concept', 'chemical formulae and equations',
    'formulae and equations', 'formulas and equations', 'reacting ratios', 'reaction stoichiometry',
  ],
  // The learner varies how many of each molecule there are, or how many times it runs.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const src = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : o
    let reactants = readSide(first(src, ['reactants', 'left', 'from']))
    let products = readSide(first(src, ['products', 'right', 'to']))
    const eq = first(src, ['equation', 'reaction'])
    if ((!reactants || !products) && typeof eq === 'string') {
      const halves = eq.split(/\s*(?:-->|->|\u2192|\u27f6|=>|\u21cc|=)\s*/)
      if (halves.length === 2) {
        reactants = readSide(halves[0])
        products = readSide(halves[1])
      }
    }
    if (!reactants || !products) return null
    const kindRaw = first(src, ['task', 'kind', 'type'])
    const have = first(src, ['have', 'amounts', 'start', 'quantities'])
    const kind = typeof kindRaw === 'string' ? kindRaw.toLowerCase() : ''
    const quantities = /quant|react|limit|leftover|left over|amount/.test(kind) || (!/balanc/.test(kind) && have !== undefined)
    if (!quantities) return { task: 'balance', reactants, products }
    let haveList: number[] | null = null
    if (Array.isArray(have) && have.length === reactants.length && have.every((x) => typeof x === 'number' && Number.isFinite(x))) haveList = have as number[]
    else if (have && typeof have === 'object' && !Array.isArray(have)) {
      const map = new Map(Object.entries(have as Record<string, unknown>).map(([k, v]) => [clean(sub(k)), v]))
      const vals = reactants.map((f) => map.get(clean(sub(f))))
      if (map.size === reactants.length && vals.every((x) => typeof x === 'number' && Number.isFinite(x))) haveList = vals as number[]
    }
    return haveList ? { task: 'quantities', reactants, products, have: haveList } : null
  },

  faults(config) {
    const out: string[] = []
    const e = 'e.g. "Mg + O2 -> MgO" or "Fe + O2 -> Fe2O3"'
    const { reactants, products } = config
    if (reactants.length > SIDE_MAX || products.length > SIDE_MAX || reactants.length + products.length > TOTAL_MAX) {
      out.push(`the card draws at most ${SIDE_MAX} formulae a side and ${TOTAL_MAX} in all, and this has ${reactants.length} and ${products.length}: ${e}.`)
    }
    const bad = [...reactants, ...products].filter((f) => !parseFormula(f))
    for (const f of bad) {
      out.push(`"${f}" cannot be read as a formula: write it as H2O, Ca(OH)2 or Al2(SO4)3 with real element symbols and no number in front, ${e}.`)
    }
    if (bad.length) return out
    const names = [...reactants, ...products].map((f) => clean(sub(f)))
    if (new Set(names).size !== names.length) out.push(`a formula appears twice, which the card cannot tell apart, so list each substance once: ${e}.`)
    for (const f of [...reactants, ...products]) {
      const a = parseFormula(f) as Atoms
      if (Object.keys(a).length > ELEMENTS_PER_FORMULA_MAX) out.push(`${f} has more than ${ELEMENTS_PER_FORMULA_MAX} elements, more than a molecule ball can show: ${e}.`)
    }
    const best = smallestCoefficients(reactants, products)
    if (!('co' in best)) {
      out.push(
        best.none === 'many'
          ? `these formulae balance in more than one independent way, so there is no single answer: give one reaction, ${e}.`
          : `these formulae cannot be balanced by coefficients alone (an element is missing from one side, or the atoms cannot match): check the formulae, ${e}.`,
      )
      return out
    }
    const big = Math.max(...best.co)
    if (big > MIN_SOLUTION_MAX) {
      out.push(`this needs a coefficient of ${big}, more than the card can draw (${MIN_SOLUTION_MAX}): use a smaller equation, ${e}.`)
    }
    if (config.task === 'balance' && best.co.every((v) => v === 1)) {
      out.push(`this is already balanced with 1 in front of everything, so there is nothing to do: choose one that needs numbers, ${e}.`)
    }
    if (config.task === 'quantities') {
      const q = config
      if (q.have.length !== reactants.length) {
        out.push(`have must give one number of molecules for each reactant, in order (${reactants.length} here).`)
        return out
      }
      if (q.have.some((h) => !Number.isInteger(h) || h < 1 || h > HAVE_MAX)) {
        out.push(`each amount in have must be a whole number of molecules from 1 to ${HAVE_MAX}, e.g. have [4, 3].`)
        return out
      }
      const { max, runsEach } = quantitiesOf(q)
      if (max < 1) out.push(`one reactant has fewer molecules than one run needs, so the reaction cannot run even once: give at least ${best.co.slice(0, reactants.length).join(', ')} molecules.`)
      else if (runsEach.every((r) => r === max) && reactants.every((_, i) => q.have[i] === max * best.co[i])) {
        out.push('every reactant is used up exactly, so nothing is left over and no reactant limits the reaction: give more of at least one, e.g. one extra molecule.')
      }
      if (max >= 1) {
        const mostProduct = Math.max(...best.co.slice(reactants.length)) * max
        if (mostProduct > PRODUCT_DRAW_MAX) out.push(`that would make ${mostProduct} molecules of one product, more than the card can draw (${PRODUCT_DRAW_MAX}): give fewer reactant molecules.`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const best = smallestCoefficients(config.reactants, config.products)
    if (!('co' in best)) return []
    const formulas = [...config.reactants, ...config.products].map((f) => clean(sub(f)).replace(/[()[\]]/g, '\\$&'))
    if (config.task === 'balance') {
      const front = formulas.some((f) => new RegExp(`(?<![A-Za-z0-9(])(?:[2-9]|1\\d)\\s?${f}(?![a-z0-9])`).test(text))
      const list = new RegExp(`(?<!\\d|\\d\\.)${best.co.join('\\s*(?:,|:|;|and|then|-|/|\\s)\\s*(?:and\\s+)?')}(?!\\d|\\.\\d)`, 'i').test(text) && best.co.length > 1
      return front || list
        ? ['the prompt gives the answer away: it writes the coefficients, which the learner is to find by tapping -- ask only for the outcome ("Balance the equation using the smallest whole numbers.")']
        : []
    }
    const { max, limiting } = quantitiesOf(config)
    const said =
      new RegExp(`(?<![\\d.])${max}\\s*(?:times|runs|lots|batches|sets|rounds|go|goes)\\b`, 'i').test(text) ||
      /\b(?:limiting|limited)\s+(?:reagent|reactant)\s+(?:is|will be)\b/i.test(text) ||
      limiting.some((f) => new RegExp(`${clean(sub(f)).replace(/[()[\]]/g, '\\$&')}\\s+(?:runs out|is used up|limits)`, 'i').test(text))
    return said
      ? ['the prompt gives the answer away: it says how many times it runs or which reactant runs out, which the learner is to find -- ask only for the outcome ("Run the reaction as many times as the molecules allow.")']
      : []
  },

  initial(config) {
    const n = config.reactants.length + config.products.length
    const best = smallestCoefficients(config.reactants, config.products)
    return { co: config.task === 'quantities' && 'co' in best ? best.co : Array(n).fill(1), runs: 0 }
  },

  check(config, state) {
    if (config.task === 'quantities') {
      const ok = Number.isInteger(state?.runs) && state.runs === quantitiesOf(config).max
      return { ok, wrongIds: ok ? [] : ['runs'] }
    }
    const ok = balanceKind(config, state?.co) === 'simplest'
    return { ok, wrongIds: ok ? [] : ['co'] }
  },

  solve(config) {
    const best = smallestCoefficients(config.reactants, config.products)
    const co = 'co' in best ? best.co : []
    return config.task === 'quantities' ? { co, runs: quantitiesOf(config).max } : { co, runs: 0 }
  },

  View: EquationBalancerView,

  prompt: `SCENE "equation-balancer" -- atoms are never made or lost. The learner changes the number IN FRONT of each formula; whole molecules, drawn as big labelled atom balls, appear and leave, and a bar for each element shows how many atoms are on the two sides. The small numbers inside a formula can not be touched. The engine reads the formulae exactly, finds the smallest whole numbers itself and marks by atom counts.
  balance: reactants on top, products below, a round - and + beside each formula (every ball carries its element symbol). Below, one bar a side for each element. Before marking nothing says whether it is balanced, except that the bars match or do not. Marking says the atoms on each side, and a correct set that is a multiple of the smallest ("2, 4, 2") is reported as balanced but not in the smallest numbers.
  quantities: the balanced equation is shown with its numbers, with a tray of the reactant molecules you give. The learner taps + and - on how many times the reaction runs; each run moves the molecules it uses into the products. A missing molecule shows as a dashed ring. The task is to run it as many times as the molecules allow. Marking says which reactant ran out and what is left over.
  For: balancing chemical equations, symbol equations, conservation of mass, stoichiometry, limiting reagent, reacting quantities, mole ratios.
  config: reactants and products are lists of formulae, or give "equation": "H2 + O2 -> H2O". Write NO numbers in front. Brackets are fine: Ca(OH)2, Al2(SO4)3. State symbols (aq) are dropped. At most 3 formulae a side, 5 in all, the smallest numbers at most 6, each formula 5 elements at most. The formulae must really balance: the engine refuses one that can not.
  quantities adds "have": molecules of each reactant in order, 1 to 8 each, enough for at least one run, with something left over, e.g. [4, 3].
  config: { "task":"balance", "reactants":["Fe","O2"], "products":["Fe2O3"] }  -- the prompt says "Balance the equation using the smallest whole numbers." (do NOT write the numbers)
       or { "task":"quantities", "reactants":["H2","O2"], "products":["H2O"], "have":[5,3] }  -- the prompt says "Run the reaction as many times as the molecules allow." (do NOT say how many times or which runs out)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Balance the equation using the smallest whole numbers.",
    "payload": { "engine":"equation-balancer", "config": { "task":"balance", "reactants":["Fe","O2"], "products":["Fe2O3"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:equation-balancer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Run the reaction as many times as the molecules allow.",
    "payload": { "engine":"equation-balancer", "config": { "task":"quantities", "reactants":["H2","O2"], "products":["H2O"], "have":[5,3] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:equation-balancer", "why":"..." } }`,
}

registerEngine(equationBalancerEngine as SceneEngine<unknown, unknown>)

// ---------------------------------------------------------------------------
// What is said back once the learner has been marked.

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function balanceSaid(config: EquationConfig, co: number[]): string {
  const counts = countAtoms(config, co)
  const kind = balanceKind(config, co)
  if (kind === 'simplest') return `Balanced: ${counts.map((c) => `${c.left} ${c.el}`).join(' and ')} on each side.`
  if (kind === 'multiple') {
    const best = smallestCoefficients(config.reactants, config.products)
    const g = 'co' in best ? co.reduce((acc, v, j) => gcd(acc, v / best.co[j]), 0) : 1
    return `Balanced, with ${counts.map((c) => `${c.left} ${c.el}`).join(' and ')} on each side, but every number can be divided by ${g} to give the smallest whole numbers.`
  }
  const off = counts.filter((c) => c.left !== c.right)
  return `Not balanced yet: ${off.map((c) => `${c.el} has ${c.left} on the reactant side and ${c.right} on the product side`).join('; ')}.`
}

export function quantitiesSaid(config: Extract<EquationConfig, { task: 'quantities' }>, runs: number): string {
  const { co, max, limiting } = quantitiesOf(config)
  const nr = config.reactants.length
  const left = remaining(config, co, max)
  const over = config.reactants.map((f, i) => (left[i] > 0 ? `${left[i]} ${f}` : '')).filter(Boolean).join(' and ')
  const out = limiting.join(' and ')
  const made = config.products.map((f, k) => `${max * co[nr + k]} ${f}`).join(' and ')
  const truth = `It can run ${plural(max, 'time')}, then there is not enough ${out} for another run. Left over: ${over}. Made: ${made}.`
  if (runs === max) return truth
  if (runs > max) return `You ran it ${plural(runs, 'time')}, but there is only enough for ${max}. ${truth}`
  return `You ran it ${plural(runs, 'time')}, but there is enough for more. ${truth}`
}
