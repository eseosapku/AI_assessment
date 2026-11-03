// lib/studylab/engines/solutions-ph/solutions-ph.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  solutionsEngine as engine, ACIDS, ALKALIS, CONCS, DILUTE_CONCS, DROP, GRACE, INDICATORS, MAX_DROPS, MAX_NEED_CM3, MAX_TUBES, MIN_NEED_CM3, VOLUMES,
  endpointDrops, equivalenceCm3, equivalenceDrops, indicatorFrac, madeDilute, madeTitrate, phAt, reachable, startPh, stepsNeeded, titrationVerdict, tubePh, workingDilute, workingTitrate,
  type SolutionsConfig as Cfg, type SolutionsState as St,
} from './config'
import { CHART, H_DILUTE, H_TITRATE, MAX_TUBES_DRAWN, PX_PER_CM3, SolutionsView, W, ZERO_Y } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Titr = Extract<Cfg, { task: 'titrate' }>
type Dil = Extract<Cfg, { task: 'dilute' }>

const acids = Object.keys(ACIDS)
const alkalis = Object.keys(ALKALIS)
const TITRATES: Titr[] = []
for (const a of acids) for (const b of alkalis) for (const flaskIsAcid of [true, false]) for (const indicator of INDICATORS) for (const flaskVolume of VOLUMES) for (const flaskConc of CONCS) for (const buretteConc of CONCS) {
  const c: Titr = { task: 'titrate', flask: flaskIsAcid ? a : b, burette: flaskIsAcid ? b : a, indicator, flaskVolume, flaskConc, buretteConc }
  if (engine.faults(c).length === 0) TITRATES.push(c)
}
const DILUTES: Dil[] = []
for (const substance of [...acids, ...alkalis]) for (const concentration of DILUTE_CONCS) for (const target of Array.from({ length: 14 }, (_, i) => i + 1)) {
  const c: Dil = { task: 'dilute', substance, concentration, target }
  if (engine.faults(c).length === 0) DILUTES.push(c)
}
const ALL: Cfg[] = [...TITRATES, ...DILUTES]
const nameOf = (c: Cfg) => JSON.stringify(c)

const T1: Titr = { task: 'titrate', flask: 'hydrochloric acid', burette: 'sodium hydroxide', indicator: 'phenolphthalein', flaskVolume: 25, flaskConc: 0.1, buretteConc: 0.2 }
const T2: Titr = { task: 'titrate', flask: 'sodium hydroxide', burette: 'nitric acid', indicator: 'methyl orange', flaskVolume: 20, flaskConc: 0.2, buretteConc: 0.1 }
const D1: Dil = { task: 'dilute', substance: 'hydrochloric acid', concentration: 0.1, target: 5 }
const D2: Dil = { task: 'dilute', substance: 'sodium hydroxide', concentration: 0.01, target: 9 }

describe('the chemistry', () => {
  it('neutralises exactly where moles meet, and is pH 7 there', () => {
    expect(equivalenceCm3(T1)).toBe(12.5)
    expect(equivalenceDrops(T1)).toBe(250)
    expect(equivalenceCm3(T2)).toBe(40)
  })

  it('a flask of acid starts acidic, and one drop of excess either side of equivalence is about 4 or 10', () => {
    expect(phAt(T1, 0)).toBeCloseTo(1, 5)
    expect(phAt(T1, 250)).toBe(7)
    expect(phAt(T1, 251)).toBeGreaterThan(9.5)
    expect(phAt(T1, 251)).toBeLessThan(10.5)
    expect(phAt(T1, 249)).toBeLessThan(4.5)
    expect(phAt(T1, 249)).toBeGreaterThan(3.5)
    expect(phAt(T2, 0)).toBeCloseTo(13.3, 1)
  })

  it('every drop only moves the pH one way, so there is one end-point', () => {
    for (const c of TITRATES) {
      const dir = isAcidFlask(c) ? 1 : -1
      let last = phAt(c, 0)
      for (let d = 1; d <= MAX_DROPS; d++) {
        const p = phAt(c, d)
        expect((p - last) * dir, `${nameOf(c)} ${d}`).toBeGreaterThanOrEqual(-1e-9)
        last = p
      }
    }
  })

  it('the end-point is at or just after equivalence, a few drops before it at worst (dilute methyl orange), never long after', () => {
    for (const c of TITRATES) {
      const e = endpointDrops(c)
      const q = equivalenceDrops(c)
      expect(e, nameOf(c)).toBeGreaterThan(q - 8)
      expect(e, nameOf(c)).toBeLessThan(q + 8)
      expect(Number.isInteger(q), nameOf(c)).toBe(true)
    }
    // Phenolphthalein, acid in the flask: colourless until the first drop past equivalence.
    expect(endpointDrops(T1)).toBe(251)
    // Phenolphthalein, alkali in the flask: the pink goes at equivalence.
    expect(endpointDrops({ ...T1, flask: 'sodium hydroxide', burette: 'hydrochloric acid' })).toBe(250)
  })

  it('indicators sit in their usual ranges', () => {
    expect(indicatorFrac('phenolphthalein', 7)).toBe(0)
    expect(indicatorFrac('phenolphthalein', 10)).toBe(1)
    expect(indicatorFrac('methyl orange', 3)).toBe(0)
    expect(indicatorFrac('methyl orange', 4.4)).toBe(1)
    expect(indicatorFrac('methyl orange', 3.75)).toBeCloseTo(0.5, 6)
  })

  it('verdicts: early, on the drop or one after, then late', () => {
    const e = endpointDrops(T1)
    expect(titrationVerdict(T1, 0)).toBe('early')
    expect(titrationVerdict(T1, e - 1)).toBe('early')
    expect(titrationVerdict(T1, e)).toBe('right')
    expect(titrationVerdict(T1, e + GRACE)).toBe('right')
    expect(titrationVerdict(T1, e + GRACE + 1)).toBe('late')
    expect(titrationVerdict(T1, MAX_DROPS)).toBe('late')
  })

  it('a tenfold dilution moves the pH one unit towards 7', () => {
    expect(startPh(D1)).toBe(1)
    expect(startPh({ ...D1, concentration: 0.01 })).toBe(2)
    expect(startPh(D2)).toBe(12)
    expect(startPh({ ...D2, concentration: 0.1 })).toBe(13)
    expect([0, 1, 2, 3, 4].map((n) => tubePh(D1, n))).toEqual([1, 2, 3, 4, 5])
    expect([0, 1, 2, 3].map((n) => tubePh(D2, n))).toEqual([12, 11, 10, 9])
    expect(stepsNeeded(D1)).toBe(4)
    expect(stepsNeeded(D2)).toBe(3)
    expect(reachable(D1)).toEqual([2, 3, 4, 5, 6])
    expect(reachable(D2)).toEqual([11, 10, 9, 8])
    expect(reachable({ ...D2, concentration: 0.1 })).toEqual([12, 11, 10, 9, 8])
  })

  it('the chart has a colour for every pH, all different', () => {
    expect(CHART).toHaveLength(14)
    expect(new Set(CHART).size).toBe(14)
  })
})

const isAcidFlask = (c: Titr) => c.flask in ACIDS

describe('every configuration', { timeout: 30_000 }, () => {
  it('has plenty, each parses to itself, has no fault, starts unsolved and can be solved', () => {
    expect(TITRATES.length).toBeGreaterThanOrEqual(150)
    expect(DILUTES.length).toBeGreaterThanOrEqual(30)
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('marks by the rule over every state: right only on the end-point or the next drop, or on the right number of tubes', () => {
    for (const c of TITRATES) {
      const e = endpointDrops(c)
      for (let d = 0; d <= MAX_DROPS; d++) {
        expect(engine.check(c, { drops: d }).ok, `${nameOf(c)} ${d}`).toBe(d === e || d === e + GRACE)
      }
    }
    for (const c of DILUTES) {
      for (let s = 0; s <= MAX_TUBES; s++) expect(engine.check(c, { steps: s }).ok, `${nameOf(c)} ${s}`).toBe(tubePh(c, s) === c.target)
    }
  })

  it('every titration needs a sensible amount, and leaves room above the end-point', () => {
    for (const c of TITRATES) {
      const need = equivalenceCm3(c)
      expect(need, nameOf(c)).toBeLessThanOrEqual(MAX_NEED_CM3)
      expect(need, nameOf(c)).toBeGreaterThanOrEqual(MIN_NEED_CM3)
    }
  })

  it('can be solved by taps, and the end-point is reachable by whole cm3 then drops', () => {
    for (const c of TITRATES) {
      let d = 0
      const e = endpointDrops(c)
      while (d + 20 < e - 1) d += 20
      while (d < e) d += 1
      expect(engine.check(c, { drops: d }).ok, nameOf(c)).toBe(true)
    }
  })

  it('reads a state that could not have been made as the start', () => {
    expect(engine.check(T1, {} as St).ok).toBe(false)
    expect(engine.check(T1, null as never).ok).toBe(false)
    expect(engine.check(T1, { drops: 'x' as never }).ok).toBe(false)
    expect(engine.check(D1, { steps: -3 }).ok).toBe(false)
    expect(engine.check(D1, { steps: 99 }).ok).toBe(false)
  })

  it('says something true when marked, and what was made when wrong', () => {
    for (const c of TITRATES) {
      const right = workingTitrate(c, endpointDrops(c))
      expect(right.startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(right).toContain(`${equivalenceCm3(c).toFixed(2)} cm³`)
      expect(right).toContain(`${c.flaskConc.toFixed(3)} mol/dm³`)
      expect(madeTitrate(c, 0).startsWith('Yes.')).toBe(false)
      expect(madeTitrate(c, MAX_DROPS)).toMatch(/already changed/)
    }
    for (const c of DILUTES) {
      expect(workingDilute(c, stepsNeeded(c)).startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(workingDilute(c, stepsNeeded(c))).toContain(Math.pow(10, stepsNeeded(c)).toLocaleString('en-GB'))
      expect(madeDilute(c, 0)).toMatch(/No tube/)
    }
    expect(madeTitrate(T1, 40)).toBe('2.00 cm³ has been added and the colour has not changed yet.')
    expect(madeDilute(D1, 2)).toContain('pH 3')
    // It never says where the answer is.
    expect(madeTitrate(T1, 100)).not.toMatch(/12\.5|equivalen|neutral/)
    expect(madeDilute(D1, 2)).not.toMatch(/pH 5|four|4 tubes/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'titration', flask: 'HCl', burette: 'NaOH', indicator: 'phenolphthalein indicator', flaskVolume: '25 cm3', flaskConc: '0.1 mol/dm3', buretteConc: '0.2 M' })).toEqual(T1)
    expect(engine.parse({ task: 'titrate', burette: 'sodium hydroxide solution' })).toEqual({ ...T1, buretteConc: 0.1 })
    expect(engine.parse({ task: 'titrate' })).toEqual({ ...T1, buretteConc: 0.1 })
    expect(engine.parse({ task: 'titrate', flask: 'an alkali', indicator: 'Methyl Orange' })).toEqual({ ...T1, flask: 'sodium hydroxide', burette: 'hydrochloric acid', indicator: 'methyl orange', buretteConc: 0.1 })
    expect(engine.parse({ flask: 'nitric acid', burette: 'KOH' })).toEqual({ ...T1, flask: 'nitric acid', burette: 'potassium hydroxide', buretteConc: 0.1 })
    expect(engine.parse({ task: { kind: 'dilution', substance: 'HCl', target: 'pH 5' } })).toEqual(D1)
    expect(engine.parse({ task: 'serial dilution', substance: 'NaOH', concentration: '0.01 mol/dm3', target: 9 })).toEqual(D2)
    expect(engine.parse({ target: 3 })).toEqual({ ...D1, target: 3 })
    expect(engine.parse({ task: 'dilute' })).toEqual({ ...D1, target: 4 })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('titration')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'titrate', flaskVolume: 'lots' })).toBeNull()
    expect(engine.parse({ task: 'titrate', flask: 5 })).toBeNull()
    expect(engine.parse({ task: 'dilute', target: {} })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    expect(engine.parse({ task: 'titrate', flask: 'ethanoic acid' })).not.toBeNull()
    expect(engine.parse({ task: 'titrate', indicator: 'litmus' })).not.toBeNull()
    expect(engine.parse({ task: 'dilute', target: 9 })).not.toBeNull()
    expect(engine.parse({ task: 'dilute', substance: 'vinegar' })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: Cfg, said: string): Cfg => {
      const m = said.match(/e\.g\. (\w+) (?:"([^"]+)"|([\d.]*\d))/)
      expect(m, said).not.toBeNull()
      const key = m![1]
      const raw = m![2] ?? m![3]
      const value = /^[\d.]+$/.test(raw) ? Number(raw) : raw
      return { ...c, [key]: value } as Cfg
    }
    const cases: [Cfg, RegExp][] = [
      [{ ...T1, flask: 'ethanoic acid' }, /weak acids/],
      [{ ...T1, flask: 'sulfuric acid' }, /sulfuric acid/],
      [{ ...T1, burette: 'water' }, /hydrochloric acid, nitric acid/],
      [{ ...T1, burette: 'nitric acid' }, /both acids/],
      [{ ...T1, flask: 'sodium hydroxide' }, /both alkalis/],
      [{ ...T1, indicator: 'litmus' }, /phenolphthalein or methyl orange/],
      [{ ...T1, indicator: 'universal indicator' }, /gradually/],
      [{ ...T1, flaskVolume: 30 }, /20 or 25/],
      [{ ...T1, flaskConc: 0.15 }, /0\.05, 0\.1 or 0\.2/],
      [{ ...T1, buretteConc: 1 }, /0\.05, 0\.1 or 0\.2/],
      [{ ...T1, flaskConc: 0.2, buretteConc: 0.05 }, /more than a 50 cm³ burette/],
      [{ ...D1, substance: 'vinegar' }, /not a solution this card draws/],
      [{ ...D1, concentration: 1 }, /0\.1 or 0\.01/],
      [{ ...D1, target: 7 }, /never as far as 7/],
      [{ ...D1, target: 10 }, /towards 7/],
      [{ ...D1, target: 0 }, /towards 7/],
      [{ ...D1, concentration: 0.01, target: 1 }, /towards 7/],
      [{ ...D2, target: 5 }, /towards 7/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), `${nameOf(c)} -> ${nameOf(fixed)}`).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    for (const [c] of cases) {
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => renderToStaticMarkup(createElement(SolutionsView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false })), nameOf(c)).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: Cfg, p: string) => engine.promptFaults!(c, p)
  const good = (c: Cfg) => pf(c, 'x')

  it('asking for the outcome is fine', () => {
    expect(pf(T1, 'Open the tap to let the burette run into the flask: use the buttons to add titrant, a few cm³ at a time and then a drop at a time. Stop as soon as the indicator has changed colour.')).toEqual([])
    expect(pf(T1, 'Add the sodium hydroxide from the burette to 25.0 cm³ of the acid. Stop as soon as the indicator changes.')).toEqual([])
    expect(pf(D1, 'Add tubes to the rack: each new tube is 1 cm³ of the one before made up to 10 cm³ with water. Keep going until the last tube is the colour of pH 5 on the chart.')).toEqual([])
    expect(pf(D2, 'Make the last tube the colour of pH 9.')).toEqual([])
    expect(good(T1)).toEqual([])
  })

  it('how much, what colour, or what each step does is not', () => {
    for (const p of ['Add 12.5 cm³ of alkali.', 'Add titrant until you have run in about 12 mL.', 'Stop one drop past the equivalence point.', 'Add two drops after it turns.', 'Stop when the flask turns pink.', 'Add until faint pink persists.']) {
      expect(pf(T1, p), p).toHaveLength(1)
    }
    for (const p of ['Make four dilutions.', 'Add 4 tubes.', 'Each tube is ten times more dilute.', 'Dilute tenfold each time.', 'Dilute by a factor of 10.', 'The pH goes up one unit each tube.', 'Dilute 10000 times.']) {
      expect(pf(D1, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Swirl the flask as you add.', 'Calculate the concentration.', 'Plot the pH curve.', 'Drag the tap open.', 'Titrate the weak acid.']) {
      expect(pf(T1, p), p).toHaveLength(1)
      expect(pf(T1, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each offers fits its own config, and passes', () => {
    const quoted = (c: Cfg) => pf(c, c.task === 'titrate' ? 'Add 12 cm³.' : 'Make four dilutions.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) {
      const fix = quoted(c)
      expect(pf(c, fix), nameOf(c)).toEqual([])
      if (c.task === 'dilute') expect(fix).toContain(`pH ${c.target}`)
      else expect(fix).toMatch(/Stop as soon as the indicator/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"solutions-ph", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['titrate', 'dilute']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "solutions-ph"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'solutions-ph')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Chemical properties of acids and bases', 'Acids, bases and salts', 'Acids and alkalis', 'Titration', 'Acid-base titrations', 'Titration calculations', 'Neutralisation',
      'Neutralisation reactions', 'Preparation of Salts and Identification of Ions', 'Indicators and the pH scale', 'Universal indicator', 'Using a burette', 'Methyl orange and phenolphthalein',
      'Acidity and alkalinity', 'Soil acidity and liming', 'Diluting acids', 'Concentration of solutions', 'Chapter 8: Acids, alkalis and indicators',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'The solution to an equation', 'Solving equations', 'Solutions of quadratic equations', 'Simultaneous equations', 'Solutions to inequalities', 'Solution of triangles', 'A solution for the problem', 'Finding solutions',
      'Solubility and saturated solutions', 'Solvents and solutes', 'Dissolving', 'Mixtures and solutions', 'Salt solutions',
      'Amino acids and proteins', 'Fatty acids and lipids', 'Nucleic acids', 'Carboxylic acids', 'Organic acids', 'Acid rain', 'Ocean acidification', 'Stomach acid and digestion',
      'Alkali metals', 'Group 1: the alkali metals', 'Alkaline earth metals', 'Alkaline batteries', 'Number bases', 'Base pairs in DNA', 'Economic indicators', 'Indicator species', 'Key performance indicators',
      'Weak acids and buffers', 'Weak acids', 'Buffer solutions', 'Acid dissociation constants', 'Strong and weak acids', 'Lewis acids and bases', 'Neutrons, protons and electrons', 'Neutral buoyancy',
      'Scale drawings', 'The ph of a lake', 'Dilution of bacterial cultures', 'Titanium and its alloys', 'Fractions and ratios', 'Electrolysis', 'Rates of reaction',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('solutions-ph')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "solutions-ph"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:solutions-ph"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const n of ['hydrochloric acid', 'nitric acid', 'sodium hydroxide', 'potassium hydroxide', 'phenolphthalein', 'methyl orange']) expect(engine.prompt).toContain(n)
  })

  it('the numbers in its catalogue entry are the ones it marks to', () => {
    expect(engine.prompt).toContain(`acid of 0.1: ${reachable(D1)[0]} to ${reachable(D1).at(-1)}; 0.01: ${reachable({ ...D1, concentration: 0.01 })[0]} to ${reachable(D1).at(-1)}`)
    expect(engine.prompt).toContain(`alkali 0.1: ${reachable({ ...D2, concentration: 0.1 })[0]} to ${reachable({ ...D2, concentration: 0.1 }).at(-1)}; 0.01: ${reachable(D2)[0]} to ${reachable(D2).at(-1)}`)
    expect(engine.prompt).toContain(`${MIN_NEED_CM3} to ${MAX_NEED_CM3} cm³`)
    expect(engine.prompt).toContain(`${DROP} cm³`)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const PROMPTS = {
    titrate: 'Open the tap to let the burette run into the flask: use the buttons to add titrant, a few cm³ at a time and then a drop at a time. Stop as soon as the indicator has changed colour.',
    dilute: 'Add tubes to the rack: each new tube is 1 cm³ of the one before made up to 10 cm³ with water. Keep going until the last tube is the colour of pH 5 on the chart.',
  }
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'solutions-ph', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: Cfg, state: St, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(SolutionsView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says the answer, the working or a count of it', () => {
    for (const [cfg, prompt] of [[T1, PROMPTS.titrate], [T2, PROMPTS.titrate], [D1, PROMPTS.dilute], [D2, PROMPTS.dilute]] as [Cfg, string][]) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'neutral', 'equivalen', 'exactly', 'fold', 'times less', 'ten times', 'already', 'went past', 'not yet', 'logarithm', 'titre', '12.50', 'mol, which']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('names every part it draws, on the card, before marking', () => {
    const t = text(raw(T1, {}, 'idle'))
    for (const name of ['burette', 'tap', 'conical flask', 'with phenolphthalein', 'hydrochloric acid', 'sodium hydroxide', '0.200 mol/dm³', '0.100 mol/dm³', 'Burette reading', 'Open the tap', '+5 cm³', '+1 cm³', '+1 drop', 'Start again']) expect(t).toContain(name)
    const d = text(raw(D1, { steps: 1 }, 'idle'))
    for (const name of ['start', '+ water', '1 cm³', 'target', 'Tubes added', '14']) expect(d).toContain(name)
  })

  it('one drop changes the picture, and so does one tube, even with nothing animating', () => {
    for (const c of [T1, T2]) {
      const e = endpointDrops(c)
      const a = raw(c, { drops: e - 1 }, 'idle', true)
      const b = raw(c, { drops: e }, 'idle', true)
      expect(a, nameOf(c)).not.toBe(b)
      // The flask snaps to the other colour with one drop.
      const flask = (h: string) => h.match(/data-flask-colour="1"/) && h.match(/fill="(rgb\([^)]*\))"[^>]*data-flask-colour/)?.[1]
      expect(flask(a), nameOf(c)).not.toBe(flask(b))
      expect(a).not.toMatch(/transition:\s*[a-z]/)
    }
    for (const c of [D1, D2]) {
      const frames = Array.from({ length: MAX_TUBES + 1 }, (_, s) => raw(c, { steps: s }, 'idle', true))
      expect(new Set(frames).size).toBe(frames.length)
      for (const f of frames) expect(f).not.toMatch(/transition:\s*[a-z]/)
    }
    expect(raw(T1, { drops: 10 }, 'idle', false)).toMatch(/transition:fill 450ms/)
  })

  it('the burette level follows the drops', () => {
    const level = (drops: number) => Number(raw(T1, { drops }, 'idle').match(/data-meniscus="([\d.]+)"/)![1])
    expect(level(0)).toBe(ZERO_Y)
    expect(level(20)).toBeCloseTo(ZERO_Y + PX_PER_CM3, 5)
    expect(level(250)).toBeCloseTo(ZERO_Y + 12.5 * PX_PER_CM3, 1)
  })

  it('marking gives the working, and says what was made when wrong', () => {
    expect(text(raw(T1, { drops: 251 }, 'right'))).toContain('12.55 cm³')
    expect(text(raw(T1, { drops: 251 }, 'right'))).toContain('0.00250 mol')
    expect(text(raw(T1, { drops: 400 }, 'wrong'))).toContain('already changed')
    expect(text(raw(T1, { drops: 40 }, 'wrong'))).toContain('has not changed yet')
    expect(text(raw(D1, { steps: 4 }, 'right'))).toContain('10,000')
    expect(text(raw(D1, { steps: 2 }, 'wrong'))).toContain('pH 3')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    expect(text(raw(T1, {}, 'shown'))).toContain('12.55 cm³')
    expect(raw(T1, {}, 'shown')).toContain('data-reading="12.55"')
    expect(raw(D1, {}, 'shown')).toContain('data-steps="4"')
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    const t = raw(T1, {}, 'idle')
    const labels = [...t.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1])
    expect(labels).toHaveLength(4)
    expect(new Set(labels).size).toBe(4)
    for (const m of t.matchAll(/<button[^>]*>/g)) expect(m[0]).toContain('type="button"')
    expect(t).toContain('nodrag')
    expect(t).toMatch(/aria-label="Start again: refill the burette"[^>]*disabled/)
    const d = raw(D1, {}, 'idle')
    expect([...d.matchAll(/<button[^>]*aria-label="([^"]+)"/g)]).toHaveLength(2)
    expect(d).toMatch(/aria-label="Take the last tube away"[^>]*disabled/)
    expect(raw(D1, { steps: MAX_TUBES }, 'idle')).toMatch(/aria-label="Add a tube[^"]*"[^>]*disabled/)
    for (const [c, s] of [[T1, { drops: 251 }], [D1, { steps: 4 }]] as [Cfg, St][]) {
      const html = raw(c, s, 'right')
      for (const m of html.matchAll(/<button[^>]*>/g)) expect(m[0]).toContain('disabled')
    }
    // Arrow keys stay on the card.
    expect(t).toContain('nodrag')
  })

  it('tells a screen reader what is seen, never what is right', () => {
    const live = attrs(raw(T1, { drops: 251 }, 'idle'))
    expect(live).toContain('12.55 cm³')
    expect(live).toContain('pink')
    expect(attrs(raw(T1, {}, 'idle'))).toContain('colourless')
    expect(attrs(raw(D1, { steps: 2 }, 'idle'))).toContain('Tube 3 is orange')
    for (const s of [attrs(raw(T1, {}, 'idle')), attrs(raw(D1, { steps: 2 }, 'idle'))]) expect(s).not.toMatch(/correct|right|target|end-point/i)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [c, s] of [[T1, { drops: 251 }], [T2, { drops: 0 }], [D1, { steps: 3 }], [D2, { steps: 3 }]] as [Cfg, St][]) {
      for (const marked of ['idle', 'right', 'wrong'] as const) {
        const html = raw(c, s, marked)
        for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
      }
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    const html = raw(T1, {}, 'idle')
    expect(html).toContain(`viewBox="0 0 ${W} ${H_TITRATE}"`)
    expect(raw(D1, {}, 'idle')).toContain(`viewBox="0 0 ${W} ${H_DILUTE}"`)
    expect(MAX_TUBES_DRAWN).toBe(MAX_TUBES)
    // The burette's scale runs 0 to 50 cm3 down its tube.
    expect(ZERO_Y + 50 * PX_PER_CM3).toBeLessThanOrEqual(178)
    // A drop on the card is a drop in the rules.
    expect(DROP).toBe(0.05)
    // 20 tick-bearing labels fit: the longest flask line stays on the plate (about 6.4 px a character at 13 px).
    const longest = `${T1.flaskVolume.toFixed(1)} cm³ of 0.100 mol/dm³`.length * 6.6
    expect(172 + longest).toBeLessThanOrEqual(W)
    expect(getEngine('solutions-ph')).toBe(engine)
  })

  it('labels sit by the part they name', () => {
    const html = raw(T1, {}, 'idle')
    const at = (word: string) => {
      const m = html.match(new RegExp(`<text x="(\\d+)" y="(\\d+)"[^>]*>${word}</text>`))
      return m ? { x: Number(m[1]), y: Number(m[2]) } : null
    }
    // The burette's label is level with the burette's top and beside its tube; the tap's is level with the tap; the flask's with the flask.
    expect(at('burette')!.y).toBeLessThan(ZERO_Y + 4)
    expect(at('tap')!.y).toBeGreaterThan(180)
    expect(at('tap')!.y).toBeLessThan(212)
    expect(at('conical flask')!.y).toBeGreaterThan(222)
    expect(at('conical flask')!.y).toBeLessThan(294)
    expect(at('tap')!.y).toBeLessThan(at('conical flask')!.y - 20)
  })
})

describe('keyboard and board', () => {
  it('stops the arrows so the board does not move the card', () => {
    const src = SolutionsView.toString()
    expect(src.length).toBeGreaterThan(0)
    const html = renderToStaticMarkup(createElement(SolutionsView, { config: T1, state: {}, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain('nodrag')
  })
})
