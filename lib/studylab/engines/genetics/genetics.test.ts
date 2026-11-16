// lib/studylab/engines/genetics/genetics.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  geneticsEngine as engine, GENES, GENE_KEYS, TRAITS, TRAIT_KEYS, aminoName, aminoOf, basesOf, changedAt, crossOptions, dnaOfMrna, done, effectOf, genotypeText, madeText, mrnaOf, originalDna, parentsOf,
  proteinOf, showing, singleChanges, squareOf, working, type GenConfig, type GenState,
} from './config'
import {
  BEAD_H, BEAD_Y, CELL, COL_TILES, CROSS_H, DNA_Y, GRID_X, GRID_Y, HIT_H, HIT_W, MUTATE_H, MUTATE_TAGS, PLANT_A, PLANT_B, RNA_Y, ROW_TILES, STEP, TILE, TILE_H, TILE_W, W, X0, crossTags, tileX, GeneticsView,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Cross = Extract<GenConfig, { task: 'cross' }>
type Mutate = Extract<GenConfig, { task: 'mutate' }>

const CROSSES: Cross[] = TRAIT_KEYS.flatMap((trait) => [null, 0, 1, 2].flatMap((given) => (['dominant', 'recessive'] as const).flatMap((form) => [0, 1, 2, 3, 4].map((count) => ({ task: 'cross' as const, trait, given, form, count })))))
const MUTATES: Mutate[] = GENE_KEYS.flatMap((gene) => (['silent', 'missense', 'nonsense'] as const).map((effect) => ({ task: 'mutate' as const, gene, effect })))
const VALID: GenConfig[] = [...CROSSES, ...MUTATES].filter((c) => engine.faults(c).length === 0)
const nameOf = (c: GenConfig) => JSON.stringify(c)

describe('the genetics, from first principles', () => {
  it('translates with the standard code', () => {
    expect(aminoOf('AUG')).toBe('M')
    expect(aminoOf('UAA')).toBe('*')
    expect(aminoOf('UAG')).toBe('*')
    expect(aminoOf('UGA')).toBe('*')
    expect(aminoOf('UGG')).toBe('W')
    expect(aminoOf('GAG')).toBe('E')
    expect(aminoOf('GUG')).toBe('V')
    expect(aminoOf('CCU')).toBe('P')
    expect(aminoOf('AAG')).toBe('K')
    // Six codons for serine and three stops: 61 sense codons and 20 amino acids in all.
    const all = 'UCAG'.split('').flatMap((a) => 'UCAG'.split('').flatMap((b) => 'UCAG'.split('').map((c) => a + b + c)))
    expect(all.filter((c) => aminoOf(c) === 'S')).toHaveLength(6)
    expect(all.filter((c) => aminoOf(c) === '*')).toHaveLength(3)
    expect(new Set(all.map(aminoOf).filter((a) => a !== '*')).size).toBe(20)
  })

  it('the genes are the real stretches, and their DNA is the complement of the mRNA', () => {
    expect(proteinOf(originalDna({ task: 'mutate', gene: 'beta-globin', effect: 'silent' })).chain.map(aminoName)).toEqual(['Pro', 'Glu', 'Glu', 'Lys'])
    expect(proteinOf(originalDna({ task: 'mutate', gene: 'insulin', effect: 'silent' })).chain.map(aminoName)).toEqual(['Phe', 'Val', 'Asn', 'Gln'])
    expect(proteinOf(originalDna({ task: 'mutate', gene: 'practice', effect: 'silent' })).chain.map(aminoName)).toEqual(['Ala', 'Ser', 'Gly', 'Leu'])
    for (const g of GENE_KEYS) {
      expect(mrnaOf(dnaOfMrna(GENES[g].mrna))).toBe(GENES[g].mrna)
      expect(proteinOf(dnaOfMrna(GENES[g].mrna)).stopAt).toBe(-1)
    }
    expect(mrnaOf('GGACTCCTCTTC')).toBe('CCUGAGGAGAAG')
  })

  it('the sickle-cell change is a missense one, GAG to GUG, Glu to Val', () => {
    const c: Mutate = { task: 'mutate', gene: 'beta-globin', effect: 'missense' }
    const sickle = singleChanges(c).find((x) => x.at === 4 && x.base === 'A')!
    expect(mrnaOf(sickle.dna).slice(3, 6)).toBe('GUG')
    expect(sickle.effect).toBe('missense')
    expect(proteinOf(sickle.dna).chain.map(aminoName)).toEqual(['Pro', 'Val', 'Glu', 'Lys'])
    expect(working(c, { bases: sickle.dna })).toContain('sickle-cell')
  })

  it('classifies each change, and every gene has all three effects', () => {
    for (const g of GENE_KEYS) {
      const c: Mutate = { task: 'mutate', gene: g, effect: 'silent' }
      const found = new Set(singleChanges(c).map((x) => x.effect))
      expect([...found].sort(), g).toEqual(['missense', 'nonsense', 'silent'])
      for (const x of singleChanges(c)) {
        const before = proteinOf(originalDna(c))
        const after = proteinOf(x.dna)
        if (x.effect === 'nonsense') expect(after.stopAt).toBeGreaterThanOrEqual(0)
        if (x.effect === 'silent') expect(after.chain).toEqual(before.chain)
        if (x.effect === 'missense') { expect(after.stopAt).toBe(-1); expect(after.chain).not.toEqual(before.chain) }
        expect(effectOf(originalDna(c), x.dna)).toBe(x.effect)
      }
    }
  })

  it('a stop ends the chain: what follows is not made', () => {
    expect(proteinOf('GGAATCCTCTTC').chain).toEqual(['P'])
    expect(proteinOf('GGAATCCTCTTC').stopAt).toBe(1)
  })

  it('the Punnett square is the product of the two parents’ gametes', () => {
    const count = (a: number, b: number, n: number) => squareOf(a, b).flat().filter((x) => x.n === n).length
    // Pp x Pp: 1 PP, 2 Pp, 1 pp.
    expect([count(1, 1, 2), count(1, 1, 1), count(1, 1, 0)]).toEqual([1, 2, 1])
    expect([count(1, 0, 1), count(1, 0, 0)]).toEqual([2, 2])
    expect(count(2, 2, 2)).toBe(4)
    expect(count(0, 0, 0)).toBe(4)
    expect(showing(1, 1, 'recessive')).toBe(1)
    expect(showing(1, 1, 'dominant')).toBe(3)
    expect(showing(2, 0, 'recessive')).toBe(0)
    expect(genotypeText('P', 1)).toBe('Pp')
    expect(genotypeText('T', 2)).toBe('TT')
    expect(genotypeText('Y', 0)).toBe('yy')
    // Whatever the parents, the four boxes sum to four.
    for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) expect(showing(a, b, 'dominant') + showing(a, b, 'recessive')).toBe(4)
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('has many valid configs', () => {
    expect(VALID.length).toBeGreaterThanOrEqual(60)
    expect(VALID.filter((c) => c.task === 'mutate')).toHaveLength(9)
  })

  it('parses to itself, starts unsolved and can be solved', () => {
    for (const c of VALID) {
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('refuses a cross with nothing to find or no answer, and says what would work', () => {
    const fixed = (given: number, form: 'dominant' | 'recessive', count: number): Cross => ({ task: 'cross', trait: 'flower', given, form, count })
    expect(engine.faults(fixed(2, 'recessive', 0))[0]).toMatch(/nothing for the learner to find/)
    expect(engine.faults(fixed(2, 'recessive', 2))[0]).toMatch(/no parents can make 2/)
    expect(engine.faults({ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 3 })[0]).toMatch(/possible numbers are 0, 1, 2, 4, e\.g\. share "(?:half|all)"/)
    expect(engine.faults({ task: 'cross', trait: 'flower', given: null, form: 'dominant', count: 1 })[0]).toMatch(/possible numbers are 0, 2, 3, 4/)
    expect(engine.faults({ task: 'cross', trait: 'cats', given: null, form: 'recessive', count: 1 })[0]).toMatch(/flower colour, pea colour or plant height/)
    expect(engine.faults({ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 7 })[0]).toMatch(/none, a quarter, half, three quarters or all/)
    expect(engine.faults({ task: 'cross', trait: 'flower', given: 5, form: 'recessive', count: 1 })[0]).toMatch(/e\.g\. "Pp"|"Pp"/)
    expect(engine.faults({ task: 'mutate', gene: 'bacon', effect: 'silent' })[0]).toMatch(/beta-globin, insulin, practice/)
    expect(engine.faults({ task: 'mutate', gene: 'insulin', effect: 'frameshift' })[0]).toMatch(/silent, missense or nonsense/)
  })

  it('marks a cross by the rule, over every pair of parents', () => {
    for (const c of CROSSES.filter((x) => engine.faults(x).length === 0)) {
      for (const p of crossOptions(c)) {
        expect(engine.check(c, { a: p.a, b: p.b }).ok, `${nameOf(c)} ${p.a}${p.b}`).toBe(showing(p.a, p.b, c.form) === c.count)
      }
    }
    // A fixed parent is read from the config, not from the state.
    const f: Cross = { task: 'cross', trait: 'flower', given: 1, form: 'recessive', count: 2 }
    expect(engine.check(f, { a: 2, b: 0 }).ok).toBe(true)
    expect(parentsOf(f, { a: 0, b: 0 })).toEqual({ a: 1, b: 0 })
  })

  it('marks a mutation only when exactly one base changed and it does the stated thing', () => {
    for (const c of MUTATES) {
      const hits = singleChanges(c).filter((x) => x.effect === c.effect)
      expect(hits.length, nameOf(c)).toBeGreaterThan(0)
      for (const x of singleChanges(c)) expect(engine.check(c, { bases: x.dna }).ok, `${nameOf(c)} ${x.at}${x.base}`).toBe(x.effect === c.effect)
      // Two bases changed is never right, whatever it does.
      const two = hits[0].dna.slice(0, 11) + (hits[0].dna[11] === 'A' ? 'C' : 'A')
      expect(changedAt(c, { bases: two }).length).toBeGreaterThanOrEqual(1)
      if (changedAt(c, { bases: two }).length === 2) expect(engine.check(c, { bases: two }).ok).toBe(false)
      expect(engine.check(c, { bases: originalDna(c) }).ok).toBe(false)
    }
  })

  it('refuses a state that could not have been made', () => {
    const c: Mutate = { task: 'mutate', gene: 'insulin', effect: 'silent' }
    expect(engine.check(c, {} as GenState).ok).toBe(false)
    expect(engine.check(c, { bases: 'XXX' }).ok).toBe(false)
    expect(engine.check(c, { bases: 7 as never }).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(basesOf(c, { bases: 'ACGT' })).toBe(originalDna(c))
    const x: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
    expect(engine.check(x, { a: 9, b: -1 } as never).ok).toBe(false)
    expect(engine.check(x, null as never).ok).toBe(false)
  })

  it('can be solved by taps from the start', () => {
    for (const c of MUTATES) {
      const goal = engine.solve(c) as { bases: string }
      const at = changedAt(c, goal)[0]
      let s: GenState = engine.initial(c)
      // Tapping steps A, C, G, T round: at most three taps.
      for (let k = 0; k < 4 && basesOf(c, s)[at] !== goal.bases[at]; k++) s = { bases: basesOf(c, s).slice(0, at) + 'CGTA'['ACGT'.indexOf(basesOf(c, s)[at])] + basesOf(c, s).slice(at + 1) }
      expect(engine.check(c, s).ok, nameOf(c)).toBe(true)
    }
  })

  it('says what is true when marked, and what was made when wrong', () => {
    for (const c of VALID) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(madeText(c, engine.initial(c)).startsWith('Yes.'), nameOf(c)).toBe(false)
    }
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
    expect(working(c, { a: 1, b: 1 })).toContain('Pp × Pp: 1 of the 4 boxes show white')
    expect(working(c, { a: 1, b: 1 })).toMatch(/not a count of a real family/)
    expect(madeText(c, { a: 1, b: 0 })).toBe('You set Pp × pp, and 2 of the 4 boxes show white.')
    const m: Mutate = { task: 'mutate', gene: 'beta-globin', effect: 'nonsense' }
    expect(madeText(m, { bases: originalDna(m) })).toMatch(/No base is changed yet/)
    expect(madeText(m, { bases: 'GGGCTCCTCTTC' })).toBe('You made a silent change: the protein is exactly the same.')
    expect(madeText(m, { bases: 'GGACACCTCTTC' })).toBe('You made a missense change: Glu became Val.')
    expect(madeText(m, { bases: 'GGGCACCTCTTC' })).toMatch(/You changed 2 bases/)
    expect(working(m, { bases: 'GGAATCCTCTTC' })).toMatch(/Codon 2 went from GAG to UAG, which means stop\. The chain ends there, 1 amino acid long/)
    expect(madeText({ ...m, effect: 'silent' }, { bases: 'GGAATCCTCTTC' })).toMatch(/nonsense change: codon 2 is now a stop/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'cross', trait: 'flower colour', share: 'a quarter' })).toEqual({ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 })
    expect(engine.parse({ task: 'Punnett square', trait: 'Pea colour', given: 'Yy', form: 'dominant', share: '3/4' })).toEqual({ task: 'cross', trait: 'pea', given: 1, form: 'dominant', count: 3 })
    expect(engine.parse({ task: 'cross', trait: 'plant height', given: 'heterozygous', share: 'half' })).toEqual({ task: 'cross', trait: 'height', given: 1, form: 'recessive', count: 2 })
    expect(engine.parse({ trait: 'tall', share: 0.25 })).toEqual({ task: 'cross', trait: 'height', given: null, form: 'recessive', count: 1 })
    expect(engine.parse({ task: 'cross', trait: 'flowers', given: 'tt', form: 'white', count: 4 })).toEqual({ task: 'cross', trait: 'flower', given: 0, form: 'recessive', count: 4 })
    expect(engine.parse({ task: 'cross', share: '25%' })).toEqual({ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 })
    expect(engine.parse({ task: { kind: 'monohybrid cross', trait: 'seed colour', share: 'none' } })).toEqual({ task: 'cross', trait: 'pea', given: null, form: 'recessive', count: 0 })
    expect(engine.parse({ task: 'mutate', gene: 'Beta globin', effect: 'Missense mutation' })).toEqual({ task: 'mutate', gene: 'beta-globin', effect: 'missense' })
    expect(engine.parse({ task: 'point mutation', gene: 'insulin gene', effect: 'premature stop' })).toEqual({ task: 'mutate', gene: 'insulin', effect: 'nonsense' })
    expect(engine.parse({ gene: 'sickle cell', effect: 'silent' })).toEqual({ task: 'mutate', gene: 'beta-globin', effect: 'silent' })
    expect(engine.parse({ task: 'DNA to protein' })).toEqual({ task: 'mutate', gene: 'practice', effect: 'missense' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('cross')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'cross', trait: 5 })).toBeNull()
    expect(engine.parse({ task: 'cross', given: 'mystery' })).toBeNull()
    expect(engine.parse({ task: 'cross', share: 'plenty' })).toBeNull()
    expect(engine.parse({ task: 'mutate', gene: {} })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    expect(engine.parse({ task: 'cross', trait: 'eye colour', share: 'half' })).not.toBeNull()
    expect(engine.parse({ task: 'cross', share: 9 })).not.toBeNull()
    expect(engine.parse({ task: 'mutate', gene: 'bacon', effect: 'shift' })).not.toBeNull()
  })

  it('a nearby example in a fault works', () => {
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 3 }
    const said = engine.faults(c)[0].match(/share "([^"]+)"/)![1]
    const fixed = engine.parse({ task: 'cross', trait: 'flower', share: said })!
    expect(engine.faults(fixed)).toEqual([])
    expect(engine.check(fixed, engine.solve(fixed)).ok).toBe(true)
    // Nothing a refused config can do crashes the rest.
    for (const bad of [c, { task: 'cross', trait: 'cats', given: 7, form: 'recessive', count: 12 } as Cross, { task: 'mutate', gene: 'x', effect: 'y' } as Mutate]) {
      expect(engine.check(bad, engine.initial(bad)).ok).toBe(false)
      expect(() => renderToStaticMarkup(createElement(GeneticsView, { config: bad, state: engine.initial(bad), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: GenConfig, p: string) => engine.promptFaults!(c, p)
  const flower: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
  const given: Cross = { task: 'cross', trait: 'height', given: 1, form: 'recessive', count: 2 }
  const beta: Mutate = { task: 'mutate', gene: 'beta-globin', effect: 'missense' }
  const silent: Mutate = { task: 'mutate', gene: 'insulin', effect: 'silent' }

  it('asking for the outcome is fine', () => {
    expect(pf(flower, 'Tap a letter above or beside the square to change a parent. Make exactly one of the four boxes show white flowers.')).toEqual([])
    expect(pf(flower, 'Work backwards from the offspring. Change the parents until none of the four boxes show purple flowers.')).toEqual([])
    expect(pf(given, 'Parent 1 is fixed. Tap a letter beside the square to change parent 2. Make exactly two of the four boxes show short plants.')).toEqual([])
    expect(pf(beta, 'Tap a DNA base to change it. Change just one base so that exactly one amino acid in the protein is different.')).toEqual([])
    expect(pf(silent, 'Tap a DNA base to change it. Change just one base so that the protein stays exactly the same. This is a silent mutation.')).toEqual([])
  })

  it('naming the parents, or what they must be, is not', () => {
    for (const p of ['Make Pp × Pp.', 'Cross Pp with Pp and see.', 'Set both parents to Pp.', 'Both parents must be heterozygous.', 'Each parent carries a hidden p.', 'Cross two hybrids.', 'Use a carrier.', 'Make a pp parent.']) {
      expect(pf(flower, p), p).toHaveLength(1)
    }
    expect(pf(given, 'Cross it with a tt plant.')).toHaveLength(1)
  })

  it('naming the base, the codon or the reason is not', () => {
    for (const p of ['Change the third base of codon 2.', 'Change the last letter of a codon.', 'Make the stop codon UAG.', 'Change a C to an A.', 'The code is redundant, so change the wobble position.', 'Change the first base.']) {
      expect(pf(beta, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Show the probability of a white flower.', 'Draw the pedigree.', 'Drag the allele into the box.', 'Give the ratio of the offspring.', 'Use the chromosomes in meiosis.']) {
      expect(pf(flower, p), p).toHaveLength(1)
      expect(pf(flower, p)[0], p).toMatch(/does not show/)
    }
    for (const p of ['Insert a base.', 'Delete a base to cause a frameshift.', 'Show the ribosome reading it.', 'Change two bases.']) {
      expect(pf(beta, p), p).toHaveLength(1)
      expect(pf(beta, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of VALID) {
      const bad = c.task === 'cross' ? 'Make Pp × Pp or YY × TT.' : 'Change the third base.'
      const msg = pf(c, c.task === 'cross' ? `Make ${genotypeText(TRAITS[c.trait as keyof typeof TRAITS].letter, 1)} × ${genotypeText(TRAITS[c.trait as keyof typeof TRAITS].letter, 1)}.` : bad)
      expect(msg, nameOf(c)).toHaveLength(1)
      const fix = msg[0].match(/\("([^"]+)"\)/)![1]
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'cross' ? /four boxes/ : /DNA base/)
      if (c.task === 'cross' && c.given !== null) expect(fix).toMatch(/Parent 1 is fixed/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"genetics", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, f[2]).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, f[2]).toBe(true)
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['cross', 'mutate']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "genetics"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'genetics')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Genetics', 'Inherited change', 'Genetics and inheritance', 'Punnett squares', 'Monohybrid crosses', 'Genetic crosses', 'Mendel and his peas', 'Mendelian genetics', 'Dominant and recessive alleles',
      'Genotype and phenotype', 'Alleles', 'Heredity', 'Selective breeding', 'Protein synthesis', 'From DNA to protein', 'The genetic code', 'Point mutations', 'Gene mutations', 'Codons and amino acids',
      'Inheritance of traits', 'Chapter 16: Inheritance in humans', 'Breeding livestock', 'Transcription and translation', 'Gene expression',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Cross-sections of solids', 'Cross section of a leaf', 'The vector cross product', 'Cross multiplication', 'Cross-curricular project', 'Cross pollination and seed dispersal', 'Cross-country skiing', 'Crossing the road safely',
      'Dominant strategies in game theory', 'A dominant firm in a market', 'Dominant species in a woodland', 'The dominant culture', 'The dominant hand', 'Dominant and subdominant chords',
      'Inheritance in object-oriented programming', 'Inheritance tax', 'Class inheritance and polymorphism', 'Wills and inheritance law',
      'Captive breeding of endangered species', 'The breeding season of birds', 'Mendeleev and the periodic table', 'Phenols and alcohols', 'Mutation testing in software', 'Genetic algorithms',
      'Genetic engineering', 'Genetically modified crops', 'Gene therapy', 'DNA profiling', 'DNA fingerprinting in forensics', 'Cloning and stem cells', 'Genetic diversity and conservation', 'Dihybrid crosses', 'Sex-linked inheritance', 'Codominance and blood groups', 'Incomplete dominance', 'Frameshift mutations',
      'Proteins in the diet', 'Protein structure', 'Food groups: proteins and fats', 'Social networks', 'Translation of poems', 'Transcription of speech', 'Photosynthesis', 'Food webs', 'Cell membranes',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('genetics')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "genetics"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:genetics"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const g of GENE_KEYS) expect(engine.prompt).toContain(g)
    expect(engine.prompt).toContain('beta-globin: Pro Glu Glu Lys')
    expect(engine.prompt).toContain('insulin: Phe Val Asn Gln')
    expect(engine.prompt).toContain('practice: Ala Ser Gly Leu')
  })

  it('the shares it names for each form are the ones it marks', () => {
    const reach = (form: 'dominant' | 'recessive') => [...new Set(crossOptions({ task: 'cross', trait: 'flower', given: null, form, count: 0 }).map((p) => showing(p.a, p.b, form)))].sort()
    expect(reach('recessive')).toEqual([0, 1, 2, 4])
    expect(reach('dominant')).toEqual([0, 2, 3, 4])
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const tagBox = (t: { text: string; x: number; y: number; anchor: string }): Box => {
    const wide = t.text.length * 7.6
    const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - wide : t.x - wide / 2
    return { left, right: left + wide, top: t.y - 12, bottom: t.y + 3 }
  }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const center = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 })
  const around = (x: number, y: number, hw: number, hh: number): Box => ({ left: x - hw, right: x + hw, top: y - hh, bottom: y + hh })

  it('the cross: every label is on the plate, touches nothing, and sits nearest its own part', () => {
    for (const fixed of [false, true]) {
      const tags = crossTags(fixed)
      // Everything a tag could touch: both plants, every tile, the square.
      const parts: Box[] = [
        around(PLANT_A.x, PLANT_A.y, 30, 30), around(PLANT_B.x, PLANT_B.y, 30, 30),
        ...COL_TILES.map((c) => around(c.x, c.y, TILE / 2, TILE / 2)), ...ROW_TILES.map((r) => around(r.x, r.y, TILE / 2, TILE / 2)),
        { left: GRID_X, right: GRID_X + CELL * 2, top: GRID_Y, bottom: GRID_Y + CELL * 2 },
      ]
      for (const t of tags) {
        const b = tagBox(t)
        expect(b.left, t.text).toBeGreaterThanOrEqual(0)
        expect(b.right, t.text).toBeLessThanOrEqual(W)
        expect(b.top, t.text).toBeGreaterThanOrEqual(0)
        expect(b.bottom, t.text).toBeLessThanOrEqual(CROSS_H)
        parts.forEach((p, i) => expect(hits(b, p), `${t.text} touches part ${i}`).toBe(false))
        for (const o of tags) if (o !== t) {
          expect(hits(b, tagBox(o)), `${t.text} / ${o.text}`).toBe(false)
          const here = center(b)
          expect(Math.hypot(here.x - t.part.x, here.y - t.part.y), `${t.text} nearer ${o.text}`).toBeLessThan(Math.hypot(here.x - o.part.x, here.y - o.part.y))
        }
      }
    }
  })

  it('the cross: the tiles, boxes and plants sit on the plate, apart, and every button has room', () => {
    const inside = (x: number, y: number, hw: number, hh: number) => { expect(x - hw).toBeGreaterThanOrEqual(0); expect(x + hw).toBeLessThanOrEqual(W); expect(y - hh).toBeGreaterThanOrEqual(0); expect(y + hh).toBeLessThanOrEqual(CROSS_H) }
    for (const t of [...COL_TILES, ...ROW_TILES]) inside(t.x, t.y, HIT_W / 2, HIT_H / 2)
    inside(PLANT_A.x, PLANT_A.y, 30, 30)
    inside(PLANT_B.x, PLANT_B.y, 30, 30)
    inside(GRID_X + CELL, GRID_Y + CELL, CELL, CELL)
    const tiles = [...COL_TILES, ...ROW_TILES]
    tiles.forEach((a, i) => tiles.forEach((b, j) => { if (j > i) expect(hits(around(a.x, a.y, HIT_W / 2, HIT_H / 2), around(b.x, b.y, HIT_W / 2, HIT_H / 2)), `tiles ${i} ${j}`).toBe(false) }))
    // The tiles clear the square and the plants.
    for (const t of tiles) {
      expect(hits(around(t.x, t.y, TILE / 2, TILE / 2), { left: GRID_X, right: GRID_X + CELL * 2, top: GRID_Y, bottom: GRID_Y + CELL * 2 }), 'tile on square').toBe(false)
      expect(hits(around(t.x, t.y, TILE / 2, TILE / 2), around(PLANT_A.x, PLANT_A.y, 30, 30)), 'tile on plant 1').toBe(false)
      expect(hits(around(t.x, t.y, TILE / 2, TILE / 2), around(PLANT_B.x, PLANT_B.y, 30, 30)), 'tile on plant 2').toBe(false)
    }
    // Each tile is aligned with its column or row.
    expect(COL_TILES.map((c) => c.x)).toEqual([GRID_X + CELL / 2, GRID_X + CELL * 1.5])
    expect(ROW_TILES.map((r) => r.y)).toEqual([GRID_Y + CELL / 2, GRID_Y + CELL * 1.5])
  })

  it('DNA to protein: twelve tiles in four codons fit the plate, and every label is clear', () => {
    expect(tileX(0)).toBe(X0)
    expect(tileX(11) + TILE_W).toBeLessThanOrEqual(W - X0 + 4)
    for (let i = 0; i < 11; i++) expect(tileX(i + 1) - (tileX(i) + TILE_W), String(i)).toBeGreaterThanOrEqual(2)
    expect(STEP).toBeGreaterThanOrEqual(TILE_W + 2)
    expect(BEAD_Y + BEAD_H + 22).toBeLessThanOrEqual(MUTATE_H)
    const rows = [{ y: DNA_Y, h: TILE_H }, { y: RNA_Y, h: TILE_H }, { y: BEAD_Y, h: BEAD_H }]
    for (const t of MUTATE_TAGS) {
      const b = tagBox(t)
      expect(b.left).toBeGreaterThanOrEqual(0)
      expect(b.right).toBeLessThanOrEqual(W)
      for (const r of rows) expect(hits(b, { left: 0, right: W, top: r.y, bottom: r.y + r.h }), `${t.text} touches a row`).toBe(false)
      // Nearer its own row than any other row.
      const here = center(b)
      const own = Math.abs(here.y - t.part.y)
      for (const o of MUTATE_TAGS) if (o !== t) expect(own, `${t.text} nearer ${o.text}`).toBeLessThan(Math.abs(here.y - o.part.y))
      for (const o of MUTATE_TAGS) if (o !== t) expect(hits(b, tagBox(o))).toBe(false)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time, so it writes its own; these tests hold them together.
    const html = renderToStaticMarkup(createElement(GeneticsView, { config: CROSSES[0], state: engine.initial(CROSSES[0]), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain(`viewBox="0 0 ${W} ${CROSS_H}"`)
    expect(TRAIT_KEYS).toEqual(['flower', 'pea', 'height'])
    for (const k of TRAIT_KEYS) expect(html.length).toBeGreaterThan(0), expect(TRAITS[k].letter).toMatch(/^[A-Z]$/)
    const m = renderToStaticMarkup(createElement(GeneticsView, { config: MUTATES[0], state: engine.initial(MUTATES[0]), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(m).toContain(`viewBox="0 0 ${W} ${MUTATE_H}"`)
    expect([...m.matchAll(/data-dna="(\d+)"/g)]).toHaveLength(12)
    expect([...m.matchAll(/data-rna="(\d+)"/g)]).toHaveLength(12)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'genetics', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: GenConfig, state: GenState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(GeneticsView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [GenConfig, string][] = [
    [{ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }, 'Tap a letter above or beside the square to change a parent. Make exactly one of the four boxes show white flowers.'],
    [{ task: 'cross', trait: 'height', given: 1, form: 'recessive', count: 2 }, 'Parent 1 is fixed. Tap a letter beside the square to change parent 2. Make exactly two of the four boxes show short plants.'],
    [{ task: 'mutate', gene: 'beta-globin', effect: 'missense' }, 'Tap a DNA base to change it. Change just one base so that exactly one amino acid in the protein is different.'],
    [{ task: 'mutate', gene: 'insulin', effect: 'nonsense' }, 'Tap a DNA base to change it. Change just one base so that the protein chain stops short.'],
    [{ task: 'mutate', gene: 'practice', effect: 'silent' }, 'Tap a DNA base to change it. Change just one base so that the protein stays exactly the same.'],
  ]

  it('before marking, nothing says the answer or the name of the effect', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'silent', 'missense', 'nonsense', 'sickle', 'redundan', 'heterozyg', 'carrier', 'real family', 'is a ', 'was a ']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('names every colour and letter it draws, before marking', () => {
    const f = text(raw({ task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }, { a: 2, b: 2 }, 'idle'))
    for (const name of ['parent 1', 'parent 2', 'purple flowers', 'white flowers', 'Parents', 'Each box is one possible offspring']) expect(f).toContain(name)
    const g = text(raw({ task: 'cross', trait: 'height', given: 1, form: 'recessive', count: 2 }, { a: 1, b: 1 }, 'idle'))
    for (const name of ['parent 1 (fixed)', 'tall plants', 'short plants']) expect(g).toContain(name)
    const p = text(raw({ task: 'mutate', gene: 'beta-globin', effect: 'silent' }, { bases: originalDna({ task: 'mutate', gene: 'beta-globin', effect: 'silent' }) }, 'idle'))
    for (const name of ['DNA', 'mRNA', 'protein', 'Pro', 'Glu', 'Lys', 'Bases changed', 'A ring marks']) expect(p).toContain(name)
  })

  it('the picture changes with every move, and nothing animates under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const first = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      if (cfg.task === 'cross') {
        const p = parentsOf(cfg, engine.initial(cfg))
        const moves: GenState[] = [{ a: p.a === 0 ? 1 : p.a - 1, b: p.b }, { a: p.a, b: p.b === 0 ? 1 : p.b - 1 }].filter((_, i) => i === 1 || cfg.given === null)
        for (const m of moves) expect(raw(cfg, m, 'idle', true), nameOf(cfg)).not.toBe(first)
      } else {
        const was = originalDna(cfg)
        for (let i = 0; i < was.length; i++) {
          expect(raw(cfg, { bases: was.slice(0, i) + 'ACGT'['ACGT'.indexOf(was[i]) === 0 ? 1 : 0] + was.slice(i + 1) }, 'idle', true), `${nameOf(cfg)} ${i}`).not.toBe(first)
        }
      }
    }
    expect(raw(EXAMPLES[0][0], { a: 2, b: 2 }, 'idle', false)).toMatch(/transition:fill 600ms/)
  })

  it('one smallest move on a cross changes the drawing: a tile and the boxes under it', () => {
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
    const before = raw(c, { a: 2, b: 2 }, 'idle', true)
    const after = raw(c, { a: 1, b: 2 }, 'idle', true)
    expect([...before.matchAll(/data-shows="recessive"/g)]).toHaveLength(0)
    expect(before.match(/data-tile="small"/g)).toBeNull()
    expect(after.match(/data-tile="small"/g)).toHaveLength(1)
    // Pp x PP stays all purple: one move need not change the offspring, but the parent's own drawing is still the same colour.
    const pp = raw(c, { a: 0, b: 2 }, 'idle', true)
    expect(pp.match(/data-form="rec"/g)).toHaveLength(1)
    const both = raw(c, { a: 0, b: 0 }, 'idle', true)
    expect(both.match(/data-shows="recessive"/g)).toHaveLength(4)
  })

  it('a stop shows as a stop, and the chain after it is empty', () => {
    const m: Mutate = { task: 'mutate', gene: 'beta-globin', effect: 'nonsense' }
    const html = raw(m, { bases: 'GGAATCCTCTTC' }, 'idle', true)
    expect(html).toContain('data-state="stop"')
    expect([...html.matchAll(/data-state="none"/g)]).toHaveLength(2)
    expect(html).toContain('was Glu')
    expect(html).toContain('data-ring="1"')
    expect(html).toContain('data-changed="1"')
    const same = raw(m, { bases: originalDna(m) }, 'idle', true)
    expect(same).not.toContain('data-state="stop"')
    expect(same).not.toContain('was ')
    expect(same).toContain('data-changed="0"')
  })

  it('marking gives the reason, and what was made when wrong', () => {
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
    expect(text(raw(c, { a: 1, b: 1 }, 'right'))).toContain('Pp × Pp: 1 of the 4 boxes show white')
    expect(text(raw(c, { a: 1, b: 0 }, 'wrong'))).toContain('You set Pp × pp, and 2 of the 4 boxes show white')
    expect(text(raw({ task: 'mutate', gene: 'beta-globin', effect: 'missense' }, { bases: 'GGACACCTCTTC' }, 'right'))).toContain('Glu became Val')
    expect(text(raw({ task: 'mutate', gene: 'beta-globin', effect: 'silent' }, { bases: 'GGACACCTCTTC' }, 'wrong'))).toContain('You made a missense change: Glu became Val')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 4 }
    const html = raw(c, { a: 2, b: 2 }, 'shown')
    expect(html.match(/data-shows="recessive"/g)).toHaveLength(4)
    const m: Mutate = { task: 'mutate', gene: 'insulin', effect: 'nonsense' }
    expect(raw(m, {}, 'shown')).toContain('data-state="stop"')
  })

  it('every control is a real button with its own label, and none when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      const want = cfg.task === 'mutate' ? 12 : cfg.given === null ? 4 : 2
      expect(buttons.length, nameOf(cfg)).toBe(want)
      expect(new Set(buttons.map((m) => m[1])).size, nameOf(cfg)).toBe(want)
      for (const m of buttons) expect(m[0], m[1]).toContain('type="button"')
      expect(idle, nameOf(cfg)).toContain('nodrag')
      expect(raw(cfg, engine.solve(cfg), 'right'), nameOf(cfg)).not.toContain('<button')
    }
    // Keyboard help is for keyboard users.
    const html = raw(EXAMPLES[0][0], { a: 2, b: 2 }, 'idle')
    expect(html).toContain('[&amp;:has(button:focus-visible)_.gn-kbd]:block')
    expect(html).toMatch(/gn-kbd hidden/)
  })

  it('the tab order and labels do not follow the answer', () => {
    const idle = raw(EXAMPLES[2][0], engine.initial(EXAMPLES[2][0]), 'idle')
    const labels = [...idle.matchAll(/aria-label="(DNA base \d+ of 12[^"]*)"/g)].map((m) => m[1])
    expect(labels.map((l) => Number(l.match(/base (\d+)/)![1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(attrs(idle)).not.toMatch(/silent|missense|nonsense/)
  })

  it('tells a screen reader what is seen, never what is right', () => {
    const c: Cross = { task: 'cross', trait: 'flower', given: null, form: 'recessive', count: 1 }
    const html = raw(c, { a: 1, b: 1 }, 'idle')
    expect(attrs(html)).toContain('3 of the 4 boxes show purple')
    expect(text(html)).toContain('1 show white')
    expect(attrs(html)).not.toMatch(/correct|right|wrong|answer/i)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
