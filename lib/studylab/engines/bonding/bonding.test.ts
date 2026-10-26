// lib/studylab/engines/bonding/bonding.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  bondingEngine, ELEMENTS, ION_CHARGES, METALS, NONMETALS, MOLECULE_IDS, MOLECULES, formulaCounts, ionicFormula,
  ionicAtoms, startShells, moveElectron, readShells, sharePair, unsharePair, covalentCounts, unshared, outer, capacity,
  configText, chargeText, bondSummary, ionicFaults, covalentFaults,
  type BondingConfig, type BondingState, type MoleculeId,
} from './config'
import { BondingView } from './View'
import type { SceneMarked } from '../types'
import { getEngine } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const ionic = (metal: string, nonmetal: string) => bondingEngine.parse({ task: { kind: 'make-ionic', metal, nonmetal } })
const covalent = (molecule: string) => bondingEngine.parse({ task: { kind: 'make-covalent', molecule } })

/** Every config parse accepts: all 36 pairs from the table, all 9 molecules. */
const PAIRS = METALS.flatMap((m) => NONMETALS.map((n) => ionic(m, n)!))
const MOLS = MOLECULE_IDS.map((m) => covalent(m)!)
const ALL = [...PAIRS, ...MOLS]
/** The ones the tutor may write: no faults. */
const VALID = ALL.filter((c) => bondingEngine.faults(c).length === 0)

/** A small seeded generator, so a failing walk can be replayed. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Dot-and-cross bonding, computed from real electron configurations: the
 * tutor names a metal and a non-metal, or a molecule; the engine draws the
 * atoms and marks the shells the learner makes. Nothing names the ions, the
 * formula or the bonds until it is marked.
 */
describe('the elements as the engine knows them', () => {
  it('has every element to Z = 20, and bromine, with shells that add up to the proton number', () => {
    const zs = Object.values(ELEMENTS).map((e) => e.z).sort((a, b) => a - b)
    expect(zs).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), 35])
    for (const [el, e] of Object.entries(ELEMENTS)) expect(e.shells.reduce((s, n) => s + n, 0), el).toBe(e.z)
    expect(configText('Na', 1)).toBe('2,8,1')
    expect(configText('Na', 0)).toBe('2,8')
    expect(configText('Cl', 8)).toBe('2,8,8')
    expect(configText('K', 1)).toBe('2,8,8,1')
    expect(configText('Br', 8)).toBe('2,8,18,8')
  })

  it('works out the syllabus ion charges from the shells', () => {
    for (const m of METALS) expect(outer(m), m).toBe(ION_CHARGES[m])
    for (const n of NONMETALS) expect(outer(n) - 8, n).toBe(ION_CHARGES[n])
    expect(chargeText(1)).toBe('+')
    expect(chargeText(3)).toBe('3+')
    expect(chargeText(-2)).toBe('2−')
  })

  it('makes the neutral compound in the right ratio', () => {
    expect(ionicFormula('Na', 'Cl')).toBe('NaCl')
    expect(ionicFormula('Mg', 'Cl')).toBe('MgCl2')
    expect(ionicFormula('Mg', 'O')).toBe('MgO')
    expect(ionicFormula('Na', 'O')).toBe('Na2O')
    expect(ionicFormula('Al', 'O')).toBe('Al2O3')
    expect(ionicFormula('Al', 'F')).toBe('AlF3')
    expect(ionicFormula('Li', 'N')).toBe('Li3N')
    expect(ionicFormula('Mg', 'N')).toBe('Mg3N2')
    expect(ionicFormula('Ca', 'F')).toBe('CaF2')
    for (const m of METALS) for (const n of NONMETALS) {
      const [a, b] = formulaCounts(m, n)
      expect(a * ION_CHARGES[m] + b * ION_CHARGES[n], `${m}${n}`).toBe(0)
      // Never more than three of either, so every row fits the card.
      expect(Math.max(a, b)).toBeLessThanOrEqual(3)
    }
  })
})

describe('the bonding engine reads what the tutor writes', () => {
  it('reads elements by symbol or name, either way round', () => {
    expect(ionic('Na', 'Cl')).toEqual({ task: { kind: 'make-ionic', metal: 'Na', nonmetal: 'Cl' } })
    expect(ionic('sodium', 'chloride')).toEqual({ task: { kind: 'make-ionic', metal: 'Na', nonmetal: 'Cl' } })
    expect(ionic('Magnesium', 'oxygen')).toEqual({ task: { kind: 'make-ionic', metal: 'Mg', nonmetal: 'O' } })
    expect(ionic('cl', 'na')).toEqual({ task: { kind: 'make-ionic', metal: 'Na', nonmetal: 'Cl' } })
    expect(ionic('aluminum', 'sulphur')).toEqual({ task: { kind: 'make-ionic', metal: 'Al', nonmetal: 'S' } })
    expect(bondingEngine.parse({ task: { kind: 'make ionic', metal: 'K', 'non-metal': 'Br' } })).toEqual({ task: { kind: 'make-ionic', metal: 'K', nonmetal: 'Br' } })
  })

  it('reads a molecule by formula or name', () => {
    expect(covalent('H2O')).toEqual({ task: { kind: 'make-covalent', molecule: 'H2O' } })
    expect(covalent('h2o')).toEqual({ task: { kind: 'make-covalent', molecule: 'H2O' } })
    expect(covalent('H₂O')).toEqual({ task: { kind: 'make-covalent', molecule: 'H2O' } })
    expect(covalent('Carbon dioxide')).toEqual({ task: { kind: 'make-covalent', molecule: 'CO2' } })
    expect(covalent('an ammonia molecule')).toEqual({ task: { kind: 'make-covalent', molecule: 'NH3' } })
    expect(covalent('HCl')).toEqual({ task: { kind: 'make-covalent', molecule: 'HCl' } })
  })

  it('refuses what it cannot honestly draw', () => {
    expect(ionic('Fe', 'Cl')).toBeNull()
    expect(ionic('Na', 'K')).toBeNull()
    expect(ionic('Cl', 'O')).toBeNull()
    expect(ionic('Na', 'I')).toBeNull()
    expect(covalent('C2H4')).toBeNull()
    expect(covalent('hydrochloric acid')).toBeNull()
    expect(bondingEngine.parse({ task: { kind: 'explore' } })).toBeNull()
    expect(bondingEngine.parse({ task: 'make-ionic' })).toBeNull()
    expect(bondingEngine.parse(null)).toBeNull()
  })

  it('says why six pairs are not drawn as ions, and passes the other thirty', () => {
    const faulted = PAIRS.filter((c) => bondingEngine.faults(c).length > 0).map((c) => c.task.kind === 'make-ionic' && `${c.task.metal}-${c.task.nonmetal}`)
    expect(faulted.sort()).toEqual(['Al-Br', 'Al-Cl', 'Al-N', 'Al-S', 'K-N', 'Na-N'])
    expect(bondingEngine.faults(ionic('Al', 'Cl')!)[0]).toMatch(/covalent.*fluorine or oxygen/)
    expect(bondingEngine.faults(ionic('Na', 'N')!)[0]).toMatch(/lithium, magnesium or calcium/)
    expect(VALID).toHaveLength(30 + 9)
    for (const c of MOLS) expect(bondingEngine.faults(c)).toEqual([])
  })
})

describe('every config the tutor can write', () => {
  it('starts unsolved, and its solution passes', () => {
    for (const c of VALID) {
      const start = bondingEngine.check(c, bondingEngine.initial(c))
      expect(start.ok, JSON.stringify(c)).toBe(false)
      expect(start.wrongIds.length, JSON.stringify(c)).toBeGreaterThan(0)
      expect(bondingEngine.check(c, bondingEngine.solve(c)).ok, JSON.stringify(c)).toBe(true)
    }
  })

  it('can be solved by the learner’s own moves from anywhere a random walk reaches (ionic)', () => {
    const next = rng(20261026)
    for (const c of VALID) {
      if (c.task.kind !== 'make-ionic') continue
      const atoms = ionicAtoms(c.task.metal, c.task.nonmetal)
      for (let walk = 0; walk < 30; walk++) {
        let shells = startShells(atoms)
        for (let step = 0; step < 25; step++) {
          const from = Math.floor(next() * atoms.length)
          const to = Math.floor(next() * atoms.length)
          const m = moveElectron(atoms, shells, from, to)
          if ('next' in m) shells = m.next
          // Every electron is still somewhere, once; no shell over 8.
          expect(readShells(atoms, { shells }), JSON.stringify(shells)).not.toBeNull()
        }
        // The learner can always finish: send each metal electron to a non-metal with room.
        for (let guard = 0; guard < 40; guard++) {
          const from = atoms.findIndex((a, i) => a.metal && shells[i].length > 0)
          if (from < 0) break
          const to = atoms.findIndex((a, i) => !a.metal && shells[i].length < 8)
          const m = moveElectron(atoms, shells, from, to)
          expect('next' in m).toBe(true)
          if ('next' in m) shells = m.next
        }
        expect(bondingEngine.check(c, { shells }).ok, `${JSON.stringify(c)} ${JSON.stringify(shells)}`).toBe(true)
      }
    }
  })

  it('can be solved by the learner’s own moves from anywhere a random walk reaches (covalent), and draws every electron', () => {
    const next = rng(7)
    for (const c of VALID) {
      if (c.task.kind !== 'make-covalent') continue
      const mol = MOLECULES[c.task.molecule]
      const want = (bondingEngine.solve(c) as BondingState).pairs!
      for (let walk = 0; walk < 30; walk++) {
        let pairs = mol.dirs.map(() => 0)
        for (let step = 0; step < 20; step++) {
          const j = Math.floor(next() * mol.dirs.length)
          const m = next() < 0.7 ? sharePair(mol, pairs, 0, j + 1) : unsharePair(pairs, j)
          if ('next' in m) pairs = m.next
          const counts = covalentCounts(mol, pairs)
          mol.atoms.forEach((el, i) => {
            expect(counts[i]).toBeLessThanOrEqual(capacity(el))
            // Each unshared electron has a place on the ring.
            const placed = unshared(mol, pairs, i).reduce((s, p) => s + p.n, 0)
            expect(placed, `${c.task.kind} ${i} ${pairs}`).toBe(outer(el) - (counts[i] - outer(el)))
          })
        }
        // Take back what does not belong, then share what is missing.
        for (let j = 0; j < pairs.length; j++) {
          while (pairs[j] > want[j]) { const m = unsharePair(pairs, j); if ('next' in m) pairs = m.next }
        }
        for (let j = 0; j < pairs.length; j++) {
          while (pairs[j] < want[j]) {
            const m = sharePair(mol, pairs, 0, j + 1)
            expect('next' in m, `${c.task.molecule} ${pairs}`).toBe(true)
            if ('next' in m) pairs = m.next
          }
        }
        expect(bondingEngine.check(c, { pairs }).ok).toBe(true)
      }
    }
  })

  it('marks a scrambled or forged state wrong, never right', () => {
    const c = ionic('Mg', 'Cl')!
    expect(bondingEngine.check(c, {}).ok).toBe(false)
    expect(bondingEngine.check(c, { shells: [[], ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '0.0'], ['2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '0.0']] }).ok).toBe(false)
    expect(bondingEngine.check(c, { shells: [[], ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '0.0'], ['2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '9.9']] }).ok).toBe(false)
    const w = covalent('H2O')!
    expect(bondingEngine.check(w, { pairs: [2, 2] }).ok).toBe(false)
    expect(bondingEngine.check(w, { pairs: [1] }).ok).toBe(false)
    expect(bondingEngine.check(w, { pairs: [1, 1] }).ok).toBe(true)
  })
})

describe('what the engine says about the learner’s diagram', () => {
  it('draws one Mg and two Cl, two Al and three O', () => {
    expect(ionicAtoms('Mg', 'Cl').map((a) => a.el)).toEqual(['Mg', 'Cl', 'Cl'])
    expect(ionicAtoms('Al', 'O').map((a) => a.el)).toEqual(['Al', 'Al', 'O', 'O', 'O'])
  })

  it('says what a metal still has and what a non-metal lacks', () => {
    const atoms = ionicAtoms('Mg', 'Cl')
    const m = moveElectron(atoms, startShells(atoms), 0, 1)
    if (!('next' in m)) throw new Error('refused')
    expect(ionicFaults(atoms, m.next)).toEqual([
      'The magnesium still has 1 electron in its outer shell.',
      'The chlorine on the right has 7 electrons in its outer shell, not yet full.',
    ])
    expect(bondingEngine.check(ionic('Mg', 'Cl')!, { shells: m.next }).wrongIds).toEqual(['magnesium: 1 in outer shell', 'chlorine on the right: 7 in outer shell'])
  })

  it('moves the last electron to arrive first, so moving one back undoes it', () => {
    const atoms = ionicAtoms('Na', 'Cl')
    const there = moveElectron(atoms, startShells(atoms), 0, 1)
    if (!('next' in there)) throw new Error('refused')
    const back = moveElectron(atoms, there.next, 1, 0)
    expect('next' in back && back.next).toEqual(startShells(atoms))
    const full = moveElectron(atoms, there.next, 0, 1)
    expect('refused' in full && full.refused).toBe('The sodium has no electrons in its outer shell to move.')
  })

  it('refuses a pair between atoms that do not touch, or into a full shell', () => {
    const water = MOLECULES.H2O
    const apart = sharePair(water, [0, 0], 1, 2)
    expect('refused' in apart && apart.refused).toMatch(/hydrogen on the left and the hydrogen on the right are not next to each other/)
    const full = sharePair(water, [1, 0], 0, 1)
    expect('refused' in full && full.refused).toBe('The outer shell of the hydrogen on the left is full: it holds 2.')
    expect(covalentFaults(water, [1, 0])).toEqual([
      'The oxygen has 7 electrons in its outer shell, not yet full.',
      'The hydrogen on the right has 1 electron in its outer shell, not yet full.',
    ])
  })

  it('counts the bonds once made', () => {
    const counted = Object.fromEntries(MOLECULE_IDS.map((m) => [m, bondSummary((bondingEngine.solve(covalent(m)!) as BondingState).pairs!)]))
    expect(counted).toEqual({
      H2: '1 single bond', Cl2: '1 single bond', HCl: '1 single bond', H2O: '2 single bonds', NH3: '3 single bonds',
      CH4: '4 single bonds', O2: '1 double bond', N2: '1 triple bond', CO2: '2 double bonds',
    } satisfies Record<MoleculeId, string>)
  })

  it('is registered for the tutor, with every option in its catalogue entry', () => {
    expect(getEngine('bonding')).toBe(bondingEngine)
    expect(bondingEngine.isolates).toBe('structure')
    expect(bondingEngine.prompt).toMatch(/SCENE "bonding"/)
    expect(bondingEngine.prompt).toMatch(/"engine":"bonding"/)
    expect(bondingEngine.prompt).toMatch(/"apparatus":"scene:bonding"/)
    expect(bondingEngine.prompt).toMatch(/"isolates":"structure"/)
    expect(bondingEngine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    for (const s of [...METALS, ...NONMETALS, ...MOLECULE_IDS]) expect(bondingEngine.prompt).toContain(s)
    // Every prompt example parses and passes.
    for (const m of bondingEngine.prompt.matchAll(/"config": (\{.*?\} \}) \}/g)) {
      const c = bondingEngine.parse(JSON.parse(m[1]))
      expect(c).not.toBeNull()
      expect(bondingEngine.faults(c!)).toEqual([])
    }
  })
})

describe('the bonding scene on the board', () => {
  const card = (config: unknown, prompt = 'Build it.') =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'bonding', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (config: BondingConfig, state: BondingState, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(BondingView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

  it('draws each atom as a button the keyboard can reach', () => {
    const html = card({ task: { kind: 'make-ionic', metal: 'Al', nonmetal: 'O' } })
    expect(html.match(/role="button" tabindex="0"/g)).toHaveLength(5)
    expect(html).toMatch(/aria-label="The aluminium on the left: 3 electrons in its outer shell/)
    expect(html).toMatch(/2,8,3/)
    expect(html).toMatch(/Start again/)
    const water = card({ task: { kind: 'make-covalent', molecule: 'H2O' } })
    expect(water.match(/role="button" tabindex="0"/g)).toHaveLength(3)
  })

  it('names no ion, charge, formula or compound before it is marked, for every ionic config', () => {
    for (const c of VALID) {
      if (c.task.kind !== 'make-ionic') continue
      const html = card(c)
      const formula = ionicFormula(c.task.metal, c.task.nonmetal)
      expect(html.toLowerCase(), formula).not.toMatch(/fluoride|chloride|bromide|oxide|sulfide|nitride|\bions?\b|\bcharge/)
      expect(html, formula).not.toMatch(/<sup|<sub|−|\d\+|[a-z]\+/i)
      if (formula.length > 2) expect(text(html), formula).not.toContain(formula)
    }
  })

  it('names no molecule and counts no bonds before it is marked, for every molecule', () => {
    const elements = new Set<string>(Object.values(ELEMENTS).map((e) => e.name))
    for (const c of MOLS) {
      if (c.task.kind !== 'make-covalent') continue
      const html = card(c).toLowerCase()
      const name = MOLECULES[c.task.molecule].name
      // A molecule of one element shares the element's name; any other name is the answer.
      if (!elements.has(name)) expect(html, name).not.toContain(name)
      expect(html, name).not.toMatch(/\b(single|double|triple)\b|\bbonds?\b|<sub/)
    }
  })

  it('shows the ions, their charges, the formula and the name once marked right', () => {
    const mg = ionic('Mg', 'Cl')!
    const shown = text(view(mg, bondingEngine.solve(mg), 'right'))
    expect(shown).toMatch(/Mg 2\+ and 2 Cl − ions: magnesium chloride ?, MgCl 2/)
    const al = ionic('Al', 'O')!
    expect(text(view(al, bondingEngine.solve(al), 'right'))).toMatch(/2 Al 3\+ and 3 O 2− ions: aluminium oxide ?, Al 2 O 3/)
    // The brackets' charges, on the diagram itself.
    expect(view(al, bondingEngine.solve(al), 'right')).toMatch(/>3\+<\/text>/)
    // A compound's name mid-sentence is lower case: CSS capitalize made it "Magnesium Chloride".
    expect(view(mg, bondingEngine.solve(mg), 'right')).not.toMatch(/capitalize/)
  })

  it('counts the bonds and names the molecule once marked right', () => {
    const co2 = covalent('CO2')!
    // Only the first letter takes a capital, opening the line: not "Carbon Dioxide".
    expect(text(view(co2, bondingEngine.solve(co2), 'right'))).toMatch(/Carbon dioxide ?, CO 2 : 2 double bonds/)
    expect(view(co2, bondingEngine.solve(co2), 'right')).not.toMatch(/capitalize/)
    const n2 = covalent('N2')!
    expect(text(view(n2, bondingEngine.solve(n2), 'right'))).toMatch(/Nitrogen ?, N 2 : 1 triple bond/)
  })

  it('says what is left or not yet full when marked wrong, and names nothing', () => {
    const mg = ionic('Mg', 'Cl')!
    const wrong = text(view(mg, bondingEngine.initial(mg), 'wrong'))
    expect(wrong).toMatch(/The magnesium still has 2 electrons in its outer shell\./)
    expect(wrong).toMatch(/The chlorine on the left has 7 electrons in its outer shell, not yet full\./)
    expect(wrong.toLowerCase()).not.toMatch(/chloride|\bions?\b/)
    const nh3 = covalent('NH3')!
    const left = text(view(nh3, { pairs: [1, 1, 0] }, 'wrong'))
    expect(left).toMatch(/The nitrogen has 7 electrons in its outer shell, not yet full\./)
    expect(left).toMatch(/The hydrogen below has 1 electron in its outer shell, not yet full\./)
    expect(left.toLowerCase()).not.toMatch(/ammonia|single|bonds?\b/)
  })

  it('draws a shared pair as a button that takes it back', () => {
    const html = view(covalent('O2')!, { pairs: [1] }, 'idle')
    expect(html).toMatch(/aria-label="1 shared pair between the oxygen on the left and the oxygen on the right\. Press Enter to take one back\."/)
  })

  it('still draws when the saved state is not one it can read', () => {
    const html = view(ionic('Na', 'Cl')!, { shells: [['nonsense']] } as BondingState, 'idle')
    expect(html).toMatch(/2,8,1/)
    expect(view(covalent('CH4')!, { pairs: [9] }, 'idle')).toMatch(/role="button"/)
  })
})

describe('the prompt a bonding card is written with', () => {
  const ionic = (prompt: string) => { const e = getEngine('bonding')!; return e.promptFaults!(e.parse({ task: { kind: 'make-ionic', metal: 'Mg', nonmetal: 'Cl' } })!, prompt) }
  const covalent = (prompt: string) => { const e = getEngine('bonding')!; return e.promptFaults!(e.parse({ task: { kind: 'make-covalent', molecule: 'CO2' } })!, prompt) }
  it('may not give the ion charges or the bonds the scene works out', () => {
    expect(ionic('Make magnesium chloride from Mg2+ and Cl- ions.').join(' ')).toMatch(/gives the answer away/)
    expect(ionic('Make Mg²⁺ and two Cl⁻ ions.').join(' ')).toMatch(/gives the answer away/)
    expect(covalent('Make carbon dioxide with its two double bonds.').join(' ')).toMatch(/gives the answer away/)
  })
  it('names the compound and asks for the full shells', () => {
    expect(ionic('Make magnesium chloride: move electrons until every atom has a full outer shell.')).toEqual([])
    expect(covalent('Make a carbon dioxide molecule, CO2: share electrons until every shell is full.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('bonding')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})
