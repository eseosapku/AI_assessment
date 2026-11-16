// lib/studylab/engines/atom/atom.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  atomEngine, ELEMENTS, ISOTOPES, COMMON_IONS, SHELL_CAPS, MAX_NEUTRONS, MAX_PROTONS,
  fill, inOrder, gapShell, configString, chargeText, ionSuffix, readElement, readCharge, madeSentence, builtName, electronsLine,
  type AtomConfig, type AtomState,
} from './config'
import { AtomView, electronAngles, nucleons } from './View'
import { getEngine } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * An atom the learner builds from its parts: the tutor names an element (and
 * an isotope or an ion), the engine counts what is built and marks it, and
 * names it only once it is marked.
 */
describe('the atom as the engine works it out', () => {
  it('fills shells from the inside out, 2 then 8 then 8 then 2', () => {
    expect(fill(1)).toEqual([1, 0, 0, 0])
    expect(fill(11)).toEqual([2, 8, 1, 0])
    expect(fill(18)).toEqual([2, 8, 8, 0])
    expect(fill(20)).toEqual([2, 8, 8, 2])
    expect(configString(fill(11))).toBe('2,8,1')
    expect(configString(fill(2))).toBe('2')
    expect(configString(fill(0))).toBe('')
  })

  it('knows shells out of order, and which inner one is not full', () => {
    expect(inOrder([2, 8, 1, 0])).toBe(true)
    expect(inOrder([2, 7, 2, 0])).toBe(false)
    expect(gapShell([2, 7, 2, 0])).toBe(2)
    expect(gapShell([1, 0, 0, 1])).toBe(1)
    expect(gapShell([2, 8, 1, 0])).toBeNull()
    expect(inOrder([3, 0, 0, 0])).toBe(false)
  })

  it('has real data: the commonest isotope is listed, and every listed one has a drawable nucleus', () => {
    expect(ELEMENTS).toHaveLength(20)
    expect(ELEMENTS.map((e) => e.symbol).join(' ')).toBe('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca')
    // Mass numbers of the commonest isotopes (NIST / CIAAW).
    expect(ELEMENTS.map((e) => e.mass)).toEqual([1, 4, 7, 9, 11, 12, 14, 16, 19, 20, 23, 24, 27, 28, 31, 32, 35, 40, 39, 40])
    for (const e of ELEMENTS) {
      expect(ISOTOPES[e.z], e.name).toContain(e.mass)
      for (const a of ISOTOPES[e.z]) {
        expect(a - e.z, `${e.name}-${a}`).toBeGreaterThanOrEqual(0)
        expect(a - e.z, `${e.name}-${a}`).toBeLessThanOrEqual(MAX_NEUTRONS)
      }
    }
    expect(ISOTOPES[6]).toContain(14)
    expect(ISOTOPES[17]).toEqual([35, 37])
  })

  it('gives each common ion a full outer shell', () => {
    const ions = Object.entries(COMMON_IONS).map(([z, q]) => [ELEMENTS[Number(z) - 1].symbol + ionSuffix(q), configString(fill(Number(z) - q))])
    expect(Object.fromEntries(ions)).toEqual({
      'Li+': '2', 'Na+': '2,8', 'K+': '2,8,8', 'Mg2+': '2,8', 'Ca2+': '2,8,8', 'Al3+': '2,8',
      'N3−': '2,8', 'O2−': '2,8', 'F−': '2,8', 'S2−': '2,8,8', 'Cl−': '2,8,8',
    })
  })

  it('writes charges as chemists do', () => {
    expect(chargeText(0)).toBe('0')
    expect(chargeText(2)).toBe('2+')
    expect(chargeText(-1)).toBe('1−')
    expect(ionSuffix(1)).toBe('+')
    expect(ionSuffix(-2)).toBe('2−')
  })
})

describe('reading what the tutor wrote', () => {
  it('reads an element by symbol, name, number, isotope or ion', () => {
    expect(readElement('Na')).toEqual({ z: 11 })
    expect(readElement('sodium')).toEqual({ z: 11 })
    expect(readElement(' Calcium atom ')).toEqual({ z: 20 })
    expect(readElement(11)).toEqual({ z: 11 })
    expect(readElement('aluminum')).toEqual({ z: 13 })
    expect(readElement('sulphur')).toEqual({ z: 16 })
    expect(readElement('chlorine-37')).toEqual({ z: 17, mass: 37 })
    expect(readElement('C-14')).toEqual({ z: 6, mass: 14 })
    expect(readElement('37Cl')).toEqual({ z: 17, mass: 37 })
    expect(readElement('Mg2+')).toEqual({ z: 12, charge: 2 })
    expect(readElement('Mg+2')).toEqual({ z: 12, charge: 2 })
    expect(readElement('Cl-')).toEqual({ z: 17, charge: -1 })
    expect(readElement('O2−')).toEqual({ z: 8, charge: -2 })
    expect(readElement('iron')).toBeNull()
    expect(readElement(26)).toBeNull()
    expect(readElement('Fe')).toBeNull()
    expect(readElement('')).toBeNull()
  })

  it('reads a charge however it is signed', () => {
    expect(readCharge(2)).toBe(2)
    expect(readCharge('2+')).toBe(2)
    expect(readCharge('+2')).toBe(2)
    expect(readCharge('-1')).toBe(-1)
    expect(readCharge('1−')).toBe(-1)
    expect(readCharge('−')).toBe(-1)
    expect(readCharge(undefined)).toBeUndefined()
    expect(readCharge('+2-')).toBeNull()
    expect(readCharge(1.5)).toBeNull()
    expect(readCharge('two')).toBeNull()
  })

  it('reads the tasks, and refuses what it cannot honestly draw', () => {
    const p = atomEngine.parse
    expect(p({ task: { kind: 'build-atom', element: 'Na' } })).toEqual({ task: { kind: 'build-atom', z: 11, mass: 23 } })
    expect(p({ task: { kind: 'build atom', element: 'chlorine', mass: 37 } })).toEqual({ task: { kind: 'build-atom', z: 17, mass: 37 } })
    expect(p({ task: { kind: 'build-atom', element: 'carbon-14' } })).toEqual({ task: { kind: 'build-atom', z: 6, mass: 14 } })
    expect(p({ task: { kind: 'build-ion', element: 'Mg', charge: 2 } })).toEqual({ task: { kind: 'build-ion', z: 12, mass: 24, charge: 2 } })
    expect(p({ task: { kind: 'build-ion', element: 'Cl-' } })).toEqual({ task: { kind: 'build-ion', z: 17, mass: 35, charge: -1 } })
    expect(p({ task: { kind: 'build-ion', element: 'oxygen', charge: '2-' } })).toEqual({ task: { kind: 'build-ion', z: 8, mass: 16, charge: -2 } })
    // Not something it can draw, or the writer contradicted themselves.
    expect(p({ task: { kind: 'build-atom', element: 'Fe' } })).toBeNull()
    expect(p({ task: { kind: 'build-atom', element: 'Na', charge: 1 } })).toBeNull()
    expect(p({ task: { kind: 'build-atom', element: 'Mg2+' } })).toBeNull()
    expect(p({ task: { kind: 'build-atom', element: 'chlorine-37', mass: 35 } })).toBeNull()
    expect(p({ task: { kind: 'build-atom', element: 'carbon', mass: 5 } })).toBeNull()
    expect(p({ task: { kind: 'build-atom', element: 'H', mass: 40 } })).toBeNull()
    expect(p({ task: { kind: 'build-ion', element: 'Na' } })).toBeNull()
    expect(p({ task: { kind: 'build-ion', element: 'Na', charge: 0 } })).toBeNull()
    expect(p({ task: { kind: 'build-ion', element: 'Mg2+', charge: 1 } })).toBeNull()
    expect(p({ task: { kind: 'build-ion', element: 'H', charge: 2 } })).toBeNull()
    expect(p({ task: { kind: 'bond', element: 'Na' } })).toBeNull()
    expect(p({ kind: 'build-atom', element: 'Na' })).toBeNull()
    expect(p(null)).toBeNull()
  })

  it('says what to fix for an isotope or ion it has no data for', () => {
    const faults = (task: unknown) => atomEngine.faults(atomEngine.parse({ task })!)
    expect(faults({ kind: 'build-atom', element: 'Na' })).toEqual([])
    expect(faults({ kind: 'build-atom', element: 'carbon', mass: 14 })).toEqual([])
    expect(faults({ kind: 'build-atom', element: 'carbon', mass: 15 })).toEqual([
      'carbon-15 is not an isotope this scene has data for: set mass to one of carbon-12, carbon-13, carbon-14, or leave mass out for carbon-12',
    ])
    expect(faults({ kind: 'build-ion', element: 'Na', charge: 2 })).toEqual(['sodium forms Na+, not charge 2+: set charge to 1'])
    expect(faults({ kind: 'build-ion', element: 'Ne', charge: 1 })[0]).toMatch(/^neon forms no ion this scene supports: use build-atom, or one of Li\+, .*Ca2\+$/)
  })
})

/** Every config parse can accept, within reach of the counters: each element, every mass its nucleus can hold, every charge its shells can. */
function everyConfig(): { raw: unknown; config: AtomConfig }[] {
  const out: { raw: unknown; config: AtomConfig }[] = []
  for (const e of ELEMENTS) {
    for (const mass of [undefined, ...Array.from({ length: MAX_NEUTRONS + 1 }, (_, n) => e.z + n)]) {
      const atom = { task: { kind: 'build-atom', element: e.symbol, mass } }
      const a = atomEngine.parse(atom)
      if (a) out.push({ raw: atom, config: a })
      for (let charge = -20; charge <= 20; charge++) {
        const ion = { task: { kind: 'build-ion', element: e.name, mass, charge } }
        const c = atomEngine.parse(ion)
        if (c) out.push({ raw: ion, config: c })
      }
    }
  }
  return out
}

const within = (s: AtomState) =>
  s.protons >= 0 && s.protons <= MAX_PROTONS && s.neutrons >= 0 && s.neutrons <= MAX_NEUTRONS &&
  s.shells.length === SHELL_CAPS.length && s.shells.every((n, i) => n >= 0 && n <= SHELL_CAPS[i])

describe('the atom engine, over every configuration', () => {
  const all = everyConfig()

  it('accepts the configs it should, and only clean ones pass its faults', () => {
    // 20 elements x 32 masses; each of the 20 elements' 31 drawable masses for build-atom plus its default.
    expect(all.filter((c) => c.config.task.kind === 'build-atom')).toHaveLength(20 * 32)
    const clean = all.filter((c) => atomEngine.faults(c.config).length === 0)
    const isotopes = Object.values(ISOTOPES).reduce((n, l) => n + l.length, 0)
    const ionIsotopes = Object.keys(COMMON_IONS).reduce((n, z) => n + ISOTOPES[Number(z)].length, 0)
    // Atoms: every listed isotope, by mass or by default. Ions: every listed isotope of the 11 ions, likewise.
    expect(clean.filter((c) => c.config.task.kind === 'build-atom')).toHaveLength(isotopes + 20)
    expect(clean.filter((c) => c.config.task.kind === 'build-ion')).toHaveLength(ionIsotopes + 11)
  })

  it('never starts solved, can always be solved, and only the one arrangement is right', () => {
    let seed = 7
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    for (const { raw, config } of all) {
      const start = atomEngine.initial(config)
      const done = atomEngine.solve(config)
      expect(within(start), JSON.stringify(raw)).toBe(true)
      expect(within(done), JSON.stringify(raw)).toBe(true)
      expect(atomEngine.check(config, start).ok, `starts solved: ${JSON.stringify(raw)}`).toBe(false)
      expect(atomEngine.check(config, done), `cannot be solved: ${JSON.stringify(raw)}`).toEqual({ ok: true, wrongIds: [] })
      // An ion's nucleus is fixed: the learner reaches the answer by electrons alone.
      if (config.task.kind === 'build-ion') {
        expect(start.protons).toBe(done.protons)
        expect(start.neutrons).toBe(done.neutrons)
      }
      // A random arrangement the counters could make is right exactly when it is the solution.
      const s: AtomState = { protons: rand(MAX_PROTONS + 1), neutrons: rand(MAX_NEUTRONS + 1), shells: SHELL_CAPS.map((c) => rand(c + 1)) }
      expect(atomEngine.check(config, s).ok).toBe(JSON.stringify(s) === JSON.stringify(done))
    }
  })

  it('marks what is wrong, part by part', () => {
    const na = atomEngine.parse({ task: { kind: 'build-atom', element: 'Na' } })!
    expect(atomEngine.check(na, { protons: 11, neutrons: 12, shells: [2, 8, 1, 0] }).ok).toBe(true)
    expect(atomEngine.check(na, { protons: 11, neutrons: 11, shells: [2, 8, 1, 0] }).wrongIds).toEqual(['neutrons'])
    expect(atomEngine.check(na, { protons: 11, neutrons: 12, shells: [2, 7, 2, 0] }).wrongIds).toEqual(['shells'])
    expect(atomEngine.check(na, { protons: 11, neutrons: 12, shells: [2, 8, 0, 0] }).wrongIds).toEqual(['electrons'])
    expect(atomEngine.check(na, { protons: 12, neutrons: 12, shells: [2, 8, 1, 0] }).wrongIds).toEqual(['protons'])
    // Stored work that is not an atom is never right.
    expect(atomEngine.check(na, {} as AtomState).ok).toBe(false)
    expect(atomEngine.check(na, { protons: 11, neutrons: 12, shells: [3, 8, 0, 0] }).ok).toBe(false)
    const mg = atomEngine.parse({ task: { kind: 'build-ion', element: 'Mg', charge: 2 } })!
    expect(atomEngine.initial(mg)).toEqual({ protons: 12, neutrons: 12, shells: [2, 8, 2, 0] })
    expect(atomEngine.check(mg, { protons: 12, neutrons: 12, shells: [2, 8, 0, 0] }).ok).toBe(true)
    expect(atomEngine.check(mg, { protons: 12, neutrons: 12, shells: [2, 6, 2, 0] }).wrongIds).toEqual(['shells'])
  })

  it('says back what the learner made', () => {
    // An isotope is named only when it is one the scene has data for; otherwise its neutrons are counted.
    expect(madeSentence({ protons: 6, neutrons: 7, shells: [2, 4, 0, 0] })).toBe('You made a carbon-13 atom')
    expect(madeSentence({ protons: 11, neutrons: 11, shells: [2, 8, 1, 0] })).toBe('You made a sodium atom with 11 neutrons')
    expect(madeSentence({ protons: 12, neutrons: 12, shells: [2, 7, 3, 0] })).toBe('You made a magnesium-24 atom')
    expect(madeSentence({ protons: 1, neutrons: 30, shells: [1, 0, 0, 0] })).toBe('You made a hydrogen atom with 30 neutrons')
    // An ion is named only when it is a real one, and a negative ion by its own name.
    expect(madeSentence({ protons: 11, neutrons: 12, shells: [2, 8, 0, 0] })).toBe('You made a sodium ion from sodium-23')
    expect(madeSentence({ protons: 17, neutrons: 20, shells: [2, 8, 8, 0] })).toBe('You made a chloride ion from chlorine-37')
    expect(madeSentence({ protons: 8, neutrons: 8, shells: [2, 8, 0, 0] })).toBe('You made an oxide ion from oxygen-16')
    expect(madeSentence({ protons: 11, neutrons: 12, shells: [2, 7, 0, 0] })).toBe('You made sodium-23 with charge 2+')
    expect(madeSentence({ protons: 11, neutrons: 30, shells: [2, 7, 0, 0] })).toBe('You made sodium with 30 neutrons and charge 2+')
    expect(madeSentence({ protons: 0, neutrons: 3, shells: [1, 0, 0, 0] })).toBe('You made no element: there are no protons')
    expect(electronsLine({ protons: 12, neutrons: 12, shells: [2, 7, 3, 0] })).toBe('Electrons 2,7,3: shell 2 is not full')
    expect(electronsLine({ protons: 3, neutrons: 4, shells: [0, 0, 0, 0] })).toBe('No electrons')
    expect(builtName({ protons: 11, neutrons: 12, shells: [2, 8, 1, 0] })).toBe('Sodium atom')
    expect(builtName({ protons: 17, neutrons: 20, shells: [2, 8, 7, 0] })).toBe('Chlorine-37 atom')
    expect(builtName({ protons: 12, neutrons: 12, shells: [2, 8, 0, 0] })).toBe('Magnesium ion')
    expect(builtName({ protons: 17, neutrons: 18, shells: [2, 8, 8, 0] })).toBe('Chloride ion')
    expect(builtName({ protons: 17, neutrons: 20, shells: [2, 8, 8, 0] })).toBe('Chloride ion from chlorine-37')
    expect(builtName({ protons: 11, neutrons: 12, shells: [2, 7, 0, 0] })).toBe('Sodium with charge 2+')
  })

  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('atom')).toBe(atomEngine)
    expect(atomEngine.isolates).toBe('structure')
    expect(atomEngine.prompt).toMatch(/SCENE "atom"/)
    expect(atomEngine.prompt).toMatch(/"engine":"atom"/)
    expect(atomEngine.prompt).toMatch(/"apparatus":"scene:atom"/)
    expect(atomEngine.prompt).toMatch(/"isolates":"structure"/)
    expect(atomEngine.prompt).toMatch(/build-ion/)
  })
})

describe('the drawing', () => {
  it('puts every nucleon in, protons spread through it', () => {
    const ns = nucleons(11, 12)
    expect(ns).toHaveLength(23)
    expect(ns.filter((n) => n.proton)).toHaveLength(11)
    expect(nucleons(20, 30).filter((n) => n.proton)).toHaveLength(20)
    expect(nucleons(0, 0)).toEqual([])
  })

  it('places electrons singly at the compass points before pairing them', () => {
    expect(electronAngles(2, 2)).toEqual([-90, 90])
    expect(electronAngles(4, 8)).toEqual([-90, 0, 90, 180])
    expect(electronAngles(5, 8)).toHaveLength(5)
    expect(electronAngles(8, 8)).toHaveLength(8)
  })
})

describe('the atom scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'atom', config }, success: { kind: 'scene' } } },
    } as never)))

  it('has counters the keyboard can set, and live counts and charge', () => {
    const html = card({ task: { kind: 'build-atom', element: 'Na' } }, 'Build an atom of sodium-23.')
    expect(html.match(/role="spinbutton"/g)).toHaveLength(6)
    expect(html).toMatch(/Protons/)
    expect(html).toMatch(/Shell 4/)
    expect(html).toMatch(/Charge/)
  })

  it('names no element and gives no configuration before it is marked, beyond what the prompt asks', () => {
    const atom = card({ task: { kind: 'build-atom', element: 'Na' } }, 'Build an atom of sodium-23.').replace('Build an atom of sodium-23.', '')
    expect(atom.toLowerCase()).not.toMatch(/sodium/)
    expect(atom).not.toMatch(/>\s*Na\s*</)
    expect(atom).not.toMatch(/2,8,1/)
    const ion = card({ task: { kind: 'build-ion', element: 'Mg', charge: 2 } }, 'Make the magnesium ion, Mg2+.').replace('Make the magnesium ion, Mg2+.', '')
    expect(ion.toLowerCase()).not.toMatch(/magnesium/)
    expect(ion).not.toMatch(/Mg/)
    expect(ion).not.toMatch(/2,8(?![,\d])/)
    // An ion starts as its atom: its nucleus is shown, but fixed.
    expect(ion.match(/role="spinbutton"/g)).toHaveLength(4)
  })

  it('once marked, writes the symbol with its mass and atomic numbers, and the configuration', () => {
    const view = (config: AtomConfig, state: AtomState, marked: 'right' | 'wrong') =>
      renderToStaticMarkup(createElement(AtomView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
    const na = atomEngine.parse({ task: { kind: 'build-atom', element: 'Na' } })!
    const right = view(na, atomEngine.solve(na), 'right')
    expect(right).toMatch(/Sodium atom/)
    expect(right).toMatch(/<span>23<\/span><span>11<\/span>/)
    expect(right).toMatch(/>Na</)
    expect(right).toMatch(/Electrons 2,8,1/)
    const wrong = view(na, { protons: 12, neutrons: 12, shells: [2, 8, 2, 0] }, 'wrong')
    // Isotope names keep their hyphen on one line (U+2011).
    expect(wrong).toMatch(/You made a magnesium\u201124 atom</)
    expect(wrong).toMatch(/Electrons 2,8,2</)
    const mg = atomEngine.parse({ task: { kind: 'build-ion', element: 'Mg', charge: 2 } })!
    const ion = view(mg, atomEngine.solve(mg), 'right')
    expect(ion).toMatch(/Magnesium ion/)
    const cl = atomEngine.parse({ task: { kind: 'build-ion', element: 'Cl-' } })!
    expect(view(cl, atomEngine.solve(cl), 'right')).toMatch(/Chloride ion</)
    expect(ion).toMatch(/>2\+</)
    expect(ion).toMatch(/Electrons 2,8</)
  })
})

describe('the prompt an atom card is written with', () => {
  const faults = (prompt: string) => { const e = getEngine('atom')!; return e.promptFaults!(e.parse({ task: { kind: 'build-atom', element: 'Na' } })!, prompt) }
  it('may not give the particle counts or the shells the learner works out', () => {
    expect(faults('Build sodium-23: 11 protons and 12 neutrons.').join(' ')).toMatch(/gives the answer away/)
    expect(faults('Build sodium, electrons 2,8,1.').join(' ')).toMatch(/gives the answer away/)
  })
  it('names the element, its mass number and any charge, as the task', () => {
    expect(faults('Build an atom of sodium-23: its protons, its neutrons, and its electrons in their shells.')).toEqual([])
    expect(faults('Make the sodium ion, Na+.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('atom')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})
