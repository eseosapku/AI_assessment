// lib/studylab/engines/equation-balancer/equation-balancer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  equationBalancerEngine as engine, COEF_MAX, HAVE_MAX, balanceKind, balanceSaid, countAtoms, parseFormula, quantitiesOf, quantitiesSaid,
  smallestCoefficients, type EquationConfig, type EquationState,
} from './config'
import { EquationBalancerView, moleculeLayout } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

// Real reactions, with their well-known smallest whole-number balances.
const BANK: [string[], string[], number[]][] = [
  [['Fe', 'O2'], ['Fe2O3'], [4, 3, 2]],
  [['H2', 'O2'], ['H2O'], [2, 1, 2]],
  [['Al', 'O2'], ['Al2O3'], [4, 3, 2]],
  [['Mg', 'O2'], ['MgO'], [2, 1, 2]],
  [['N2', 'H2'], ['NH3'], [1, 3, 2]],
  [['CH4', 'O2'], ['CO2', 'H2O'], [1, 2, 1, 2]],
  [['C3H8', 'O2'], ['CO2', 'H2O'], [1, 5, 3, 4]],
  [['Ca(OH)2', 'HCl'], ['CaCl2', 'H2O'], [1, 2, 1, 2]],
  [['Al2(SO4)3', 'Ca(OH)2'], ['Al(OH)3', 'CaSO4'], [1, 3, 2, 3]],
  [['KClO3'], ['KCl', 'O2'], [2, 2, 3]],
  [['C6H12O6', 'O2'], ['CO2', 'H2O'], [1, 6, 6, 6]],
  [['Fe2O3', 'CO'], ['Fe', 'CO2'], [1, 3, 2, 3]],
  [['H2O2'], ['H2O', 'O2'], [2, 2, 1]],
  [['NH3', 'O2'], ['NO', 'H2O'], [4, 5, 4, 6]],
  [['Al', 'HCl'], ['AlCl3', 'H2'], [2, 6, 2, 3]],
  [['Pb(NO3)2'], ['PbO', 'NO2', 'O2'], [2, 2, 4, 1]],
  [['Na', 'Cl2'], ['NaCl'], [2, 1, 2]],
]
const bal = (reactants: string[], products: string[]): EquationConfig => ({ task: 'balance', reactants, products })
const BALANCE = BANK.map(([r, p]) => bal(r, p))
const QUANT_EQS = BANK.filter(([r, p]) => r.length === 2 && r.length + p.length <= 4 && Math.max(...BANK.find((b) => b[0] === r && b[1] === p)![2]) <= 6)
const QUANT: EquationConfig[] = QUANT_EQS.flatMap(([r, p]) =>
  Array.from({ length: HAVE_MAX }, (_, a) => Array.from({ length: HAVE_MAX }, (_, b) => ({ task: 'quantities' as const, reactants: r, products: p, have: [a + 1, b + 1] }))).flat())
const VALID = [...BALANCE, ...QUANT].filter((c) => engine.faults(c).length === 0)

describe('formulae are read exactly', () => {
  it('counts atoms, brackets included', () => {
    expect(parseFormula('H2O')).toEqual({ H: 2, O: 1 })
    expect(parseFormula('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 })
    expect(parseFormula('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 })
    expect(parseFormula('Mg3(PO4)2')).toEqual({ Mg: 3, P: 2, O: 8 })
    expect(parseFormula('K4[Fe(CN)6]')).toEqual({ K: 4, Fe: 1, C: 6, N: 6 })
    expect(parseFormula('C6H12O6')).toEqual({ C: 6, H: 12, O: 6 })
    expect(parseFormula('NaCl(aq)')).toEqual({ Na: 1, Cl: 1 })
    expect(parseFormula('CO')).toEqual({ C: 1, O: 1 })
    expect(parseFormula('Co')).toEqual({ Co: 1 })
    expect(parseFormula('H₂O')).toEqual({ H: 2, O: 1 })
  })

  it('refuses what is not a formula', () => {
    for (const bad of ['', '2H2O', 'h2o', 'Xx', 'H2O)', '(H2O', 'Ca()2', 'H0', 'Hz', 'H2O+', 'Ca(OH', '123']) expect(parseFormula(bad), bad).toBeNull()
  })

  it('finds the smallest whole numbers for real reactions', () => {
    for (const [r, p, co] of BANK) expect(smallestCoefficients(r, p), r.join('+')).toEqual({ co })
  })

  it('says why it can not', () => {
    expect(smallestCoefficients(['H2'], ['O2'])).toEqual({ none: 'cannot' })
    expect(smallestCoefficients(['H2', 'O2'], ['H2O', 'H2O2'])).toEqual({ none: 'many' })
    expect(smallestCoefficients(['H2', 'O2'], ['H2O', 'NaCl'])).toEqual({ none: 'cannot' })
    expect(smallestCoefficients(['2H2'], ['H2'])).toEqual({ none: 'unreadable' })
  })
})

describe('marking is by atoms', () => {
  const fe = bal(['Fe', 'O2'], ['Fe2O3'])
  it('balanced and smallest passes; a multiple is balanced but not simplest; the rest is unbalanced', () => {
    expect(balanceKind(fe, [4, 3, 2])).toBe('simplest')
    expect(balanceKind(fe, [8, 6, 4])).toBe('multiple')
    expect(balanceKind(fe, [1, 1, 1])).toBe('unbalanced')
    expect(balanceKind(fe, [4, 3])).toBe('unbalanced')
    expect(balanceKind(fe, [4, 3, 2.5])).toBe('unbalanced')
    expect(engine.check(fe, { co: [8, 6, 4], runs: 0 }).ok).toBe(false)
    expect(balanceSaid(fe, [8, 6, 4])).toMatch(/divided by 2/)
    expect(balanceSaid(fe, [2, 1, 1])).toMatch(/Not balanced/)
    expect(balanceSaid(fe, [4, 3, 2])).toBe('Balanced: 4 Fe and 6 O on each side.')
  })

  it('counts atoms with the coefficient times the subscript, and a bracket times its number', () => {
    const c = bal(['Ca(OH)2', 'HCl'], ['CaCl2', 'H2O'])
    expect(countAtoms(c, [1, 2, 1, 2])).toEqual([
      { el: 'Ca', left: 1, right: 1 }, { el: 'O', left: 2, right: 2 }, { el: 'H', left: 4, right: 4 }, { el: 'Cl', left: 2, right: 2 },
    ])
  })

  it('any coefficient vector passes check exactly when it is the smallest balance', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
    for (const c of BALANCE) {
      const n = c.reactants.length + c.products.length
      const best = (smallestCoefficients(c.reactants, c.products) as { co: number[] }).co
      for (let i = 0; i < 60; i++) {
        const co = Array.from({ length: n }, () => 1 + Math.floor(rnd() * COEF_MAX))
        expect(engine.check(c, { co, runs: 0 }).ok).toBe(co.every((v, j) => v === best[j]))
      }
    }
  })
})

describe('reacting quantities', () => {
  const h2o: EquationConfig = { task: 'quantities', reactants: ['H2', 'O2'], products: ['H2O'], have: [5, 3] }
  it('runs as often as the scarcer reactant allows, and says what is left', () => {
    const q = quantitiesOf(h2o as never)
    expect(q.co).toEqual([2, 1, 2])
    expect(q.max).toBe(2)
    expect(q.limiting).toEqual(['H2'])
    expect(quantitiesSaid(h2o as never, 2)).toBe('It can run 2 times, then there is not enough H2 for another run. Left over: 1 H2 and 1 O2. Made: 4 H2O.')
    expect(quantitiesSaid(h2o as never, 4)).toMatch(/^You ran it 4 times, but there is only enough for 2\./)
    expect(quantitiesSaid(h2o as never, 1)).toMatch(/^You ran it 1 time, but there is enough for more\./)
  })

  it('refuses amounts with nothing left over, too few to run, or too many to draw', () => {
    const f = (have: number[]) => engine.faults({ ...h2o, have } as never)
    expect(f([4, 2]).join(' ')).toMatch(/used up exactly/)
    expect(f([1, 5]).join(' ')).toMatch(/cannot run even once/)
    expect(f([4, 9]).join(' ')).toMatch(/1 to 8/)
    expect(f([4, 3])).toEqual([])
  })
})

describe('the engine contract', () => {
  it('reads a config however it is written, and nothing else', () => {
    const want = bal(['H2', 'O2'], ['H2O'])
    expect(engine.parse({ task: 'balance', reactants: ['H2', 'O2'], products: ['H2O'] })).toEqual(want)
    expect(engine.parse({ equation: 'H2 + O2 -> H2O' })).toEqual(want)
    expect(engine.parse({ equation: 'H2 + O2 → H2O' })).toEqual(want)
    expect(engine.parse({ reactants: 'H2 + O2', products: 'H2O' })).toEqual(want)
    expect(engine.parse({ task: 'quantities', reactants: ['H2', 'O2'], products: ['H2O'], have: { O2: 3, H2: 5 } })).toEqual({ task: 'quantities', reactants: ['H2', 'O2'], products: ['H2O'], have: [5, 3] })
    expect(engine.parse({ task: 'limiting reagent', equation: 'H2 + O2 -> H2O', have: [5, 3] })).toMatchObject({ task: 'quantities', have: [5, 3] })
    for (const bad of [null, 'x', {}, { reactants: ['H2'] }, { reactants: [], products: ['H2'] }, { reactants: [1], products: ['H2'] }, { task: 'quantities', reactants: ['H2'], products: ['H2'] }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('parses broadly and refuses narrowly, with an example that works', () => {
    const f = (c: EquationConfig) => engine.faults(c).join(' | ')
    expect(f(bal(['2H2', 'O2'], ['H2O']))).toMatch(/cannot be read as a formula.*e\.g\./)
    expect(f(bal(['H2'], ['O2']))).toMatch(/cannot be balanced.*e\.g\./)
    expect(f(bal(['H2', 'O2'], ['H2O', 'H2O2']))).toMatch(/more than one independent way/)
    expect(f(bal(['C', 'O2'], ['CO2']))).toMatch(/already balanced.*e\.g\./)
    expect(f(bal(['H2', 'O2', 'N2', 'Cl2'], ['NH3', 'HCl', 'H2O']))).toMatch(/at most 3 formulae a side/)
    expect(f(bal(['C7H16', 'O2'], ['CO2', 'H2O']))).toMatch(/coefficient of 11, more than the card can draw \(6\).*e\.g\./)
    expect(f(bal(['H2', 'H2'], ['H2O']))).toMatch(/appears twice/)
    expect(f(bal(['Fe', 'O2'], ['Fe2O3']))).toBe('')
    expect(f(bal(['Al2(SO4)3', 'Ca(OH)2'], ['Al(OH)3', 'CaSO4']))).toBe('')
  })

  it('starts unsolved and can always be solved, over every valid config', { timeout: 30_000 }, () => {
    expect(VALID.length).toBeGreaterThan(300)
    for (const c of VALID) {
      const parsed = engine.parse(JSON.parse(JSON.stringify(c)))
      expect(parsed).toEqual(c)
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, JSON.stringify(c)).toBe(true)
    }
  })

  it('a quantities card has something left over and a product count that fits', () => {
    for (const c of VALID.filter((v) => v.task === 'quantities')) {
      const q = quantitiesOf(c as never)
      expect(q.max).toBeGreaterThanOrEqual(1)
      expect((c as never as { have: number[] }).have.some((h, i) => h > q.max * q.co[i])).toBe(true)
    }
  })

  it('is registered', () => {
    expect(getEngine('equation-balancer')).toBe(engine)
  })
})

describe('prompt faults', () => {
  const pf = (c: EquationConfig, p: string) => engine.promptFaults!(c, p)
  const fe = bal(['Fe', 'O2'], ['Fe2O3'])
  it('refuses a prompt that writes the coefficients', () => {
    expect(pf(fe, 'Balance 4Fe + 3O2 -> 2Fe2O3.')).toHaveLength(1)
    expect(pf(fe, 'Balance it: 4 Fe + 3 O2 gives 2 Fe2O3')).toHaveLength(1)
    expect(pf(fe, 'The coefficients are 4, 3 and 2.')).toHaveLength(1)
    expect(pf(fe, 'Balance Fe + O2 -> Fe2O3 using the smallest whole numbers.')).toEqual([])
  })
  it('refuses a prompt that says how many runs or what runs out', () => {
    const q = { task: 'quantities', reactants: ['H2', 'O2'], products: ['H2O'], have: [5, 3] } as EquationConfig
    expect(pf(q, 'The reaction can run 2 times. Run it.')).toHaveLength(1)
    expect(pf(q, 'The limiting reagent is H2.')).toHaveLength(1)
    expect(pf(q, 'H2 runs out first, so run it.')).toHaveLength(1)
    expect(pf(q, 'Run the reaction as many times as the molecules allow.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"equation-balancer", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const cfg = engine.parse(JSON.parse(m[2]))!
      expect(engine.faults(cfg), m[2]).toEqual([])
      expect(engine.promptFaults!(cfg, m[1])).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of ['Balancing chemical equations', 'Balancing equations', 'Chemical equations', 'Symbol equations', 'Stoichiometry', 'Limiting reagent and yield',
      'The mole concept and gas laws', 'Conservation of mass', 'Reacting quantities', 'Writing word equations']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "equation-balancer"')
      expect(scenesFor(s).some((e) => e.id === 'equation-balancer'), s).toBe(true)
    }
  })

  it('is not offered for other equations, or for rates and bonding stations', () => {
    for (const s of ['Linear equations', 'Quadratic equations', 'Equations of motion', 'Solving simultaneous equations', 'Differential equations', 'Rates of reaction',
      'Collision theory and reaction rates', 'Chemical bonding', 'Ionic and covalent bonding', 'Dynamic equilibrium', 'Balancing a budget', 'The balance sheet',
      'Moles of a gas', 'Energy changes in reactions', 'Equation of a straight line']) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "equation-balancer"')
      expect(scenesFor(s).some((e) => e.id === 'equation-balancer'), s).toBe(false)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  const formulas = [...new Set(BANK.flatMap(([r, p]) => [...r, ...p]))]
  it('every ball is at least 12 px across, inside its box, and apart from the others', () => {
    for (const f of formulas) {
      const { w, h, balls } = moleculeLayout(parseFormula(f)!)
      expect(balls.length).toBeGreaterThan(0)
      for (const b of balls) {
        expect(b.r * 2, f).toBeGreaterThanOrEqual(12)
        expect(b.x - b.r, f).toBeGreaterThanOrEqual(0)
        expect(b.y - b.r, f).toBeGreaterThanOrEqual(0)
        expect(b.x + b.r, f).toBeLessThanOrEqual(w + 1e-9)
        expect(b.y + b.r, f).toBeLessThanOrEqual(h + 1e-9)
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        expect(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y), f).toBeGreaterThanOrEqual(balls[i].r + balls[j].r)
      }
    }
  })

  it('a small molecule is one ball per atom; a big one is one ball per element with its count', () => {
    expect(moleculeLayout(parseFormula('H2O')!).balls.map((b) => b.el)).toEqual(['H', 'H', 'O'])
    const big = moleculeLayout(parseFormula('Al2(SO4)3')!)
    expect(big.balls.map((b) => [b.el, b.n])).toEqual([['Al', 2], ['S', 3], ['O', 12]])
  })

  it('a molecule drawn at the largest coefficient still fits its row without crossing the card', () => {
    for (const f of formulas) {
      const { w } = moleculeLayout(parseFormula(f)!)
      expect(w, f).toBeLessThanOrEqual(112)
    }
  })
})

describe('the equation-balancer scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'equation-balancer', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: EquationConfig, state: EquationState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(EquationBalancerView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<style>.*?<\/style>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const fe = bal(['Fe', 'O2'], ['Fe2O3'])
  const q = { task: 'quantities', reactants: ['H2', 'O2'], products: ['H2O'], have: [5, 3] } as EquationConfig

  it('balance: a plus and a minus on every formula, nothing else to press, and no answer before marking', () => {
    const html = card(fe, 'Balance the equation using the smallest whole numbers.')
    expect((html.match(/aria-label="(?:Add one|Take one)/g) ?? []).length).toBe(6)
    expect(html).toContain('aria-label="Add one Fe2O3 molecule"')
    expect(html).toContain('aria-label="Take one O2 molecule away"')
    expect(html).not.toContain('role="slider"')
    const shown = text(html.replace('Balance the equation using the smallest whole numbers.', ''))
    for (const secret of ['Balanced', 'balanced', 'smallest', 'divided', 'Not ']) expect(shown, secret).not.toContain(secret)
    expect(shown).toContain('reactant atoms')
    // Every colour is named: each element's ball carries its symbol.
    expect(html).toContain('>Fe</text>')
    expect(html).toContain('>O</text>')
  })

  it('balance: the sentence once marked', () => {
    expect(text(raw(fe, { co: [4, 3, 2], runs: 0 }, 'right'))).toContain('Balanced: 4 Fe and 6 O on each side.')
    expect(text(raw(fe, { co: [8, 6, 4], runs: 0 }, 'wrong'))).toContain('divided by 2')
    expect(text(raw(fe, { co: [1, 1, 1], runs: 0 }, 'wrong'))).toContain('Not balanced yet')
  })

  it('quantities: the equation is given, molecules are drawn, and nothing about the limit shows before marking', () => {
    const html = card(q, 'Run the reaction as many times as the molecules allow.')
    expect(html).toContain('aria-label="Run the reaction one more time"')
    const shown = text(html.replace('Run the reaction as many times as the molecules allow.', ''))
    for (const secret of ['not enough', 'Left over', 'only enough', 'limiting', 'It can run']) expect(shown, secret).not.toContain(secret)
    expect((html.match(/<circle/g) ?? []).length).toBe(5 * 2 + 3 * 2)
    // Running 4 times asks for molecules that are not there: dashed rings, and no more products than 2 runs make.
    const over = raw(q, { co: [], runs: 4 }, 'idle')
    expect(over).toContain('stroke-dasharray')
    expect((raw(q, { co: [], runs: 2 }, 'idle').match(/<circle/g) ?? []).length).toBe(1 * 2 + 1 * 2 + 4 * 3)
    expect((over.match(/<circle/g) ?? []).length).toBeGreaterThan(0)
  })

  it('quantities: the sentence once marked', () => {
    expect(text(raw(q, { co: [], runs: 2 }, 'right'))).toContain('It can run 2 times, then there is not enough H2 for another run.')
    expect(text(raw(q, { co: [], runs: 3 }, 'wrong'))).toContain('You ran it 3 times, but there is only enough for 2.')
  })

  it('under reduced motion nothing fades in or grows', () => {
    expect(raw(fe, { co: [4, 3, 2], runs: 0 }, 'idle', true)).not.toContain('class="eb-in"')
    expect(raw(fe, { co: [4, 3, 2], runs: 0 }, 'idle', true)).not.toContain('transition-[width]')
    expect(raw(fe, { co: [4, 3, 2], runs: 0 }, 'idle', false)).toContain('eb-in')
  })

  it('no text is under 12 px', () => {
    const html = raw(fe, { co: [4, 3, 2], runs: 0 }, 'wrong')
    for (const m of html.matchAll(/text-\[(\d+)px\]|font-size="(\d+)"|fontSize="(\d+)"/g)) expect(Number(m[1] ?? m[2] ?? m[3])).toBeGreaterThanOrEqual(12)
  })
})
