import { describe, it, expect } from 'vitest'
import { getApparatus, apparatusNames } from './index'
import { validateMaterial } from '../validate'
import { tick } from '../interpreter'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { MaterialState } from '../types'
import type { SuccessRule } from '@/lib/studylab/activities/types'

const placed = (
  placement: Record<string, string>,
  controls: Record<string, number> = {},
): MaterialState =>
  ({ placement, controls, attempts: 0, rejectedMoves: [], status: 'in_progress' })

interface Case {
  apparatus: string
  pattern: string
  payload: unknown
  success: unknown
  placements: Record<string, string>[]
  controls?: Record<string, number>[]
  toWork(placement: Record<string, string>, controls?: Record<string, number>): unknown
}

const CASES: Case[] = [
  {
    apparatus: 'sorting-frame',
    pattern: 'sort',
    payload: {
      bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
      items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }, { id: 'koh', label: 'KOH', binId: 'base' }],
    },
    success: { kind: 'binAssignment', assign: { hcl: 'acid', koh: 'base' } },
    placements: [
      { hcl: 'acid', koh: 'base' },
      { hcl: 'base', koh: 'acid' },
      { hcl: 'acid' },
      {},
    ],
    toWork: (placement) => ({ assign: placement }),
  },
  {
    apparatus: 'venn-sets',
    pattern: 'compare',
    payload: {
      sets: [{ id: 'plants', label: 'Plants' }, { id: 'animals', label: 'Animals' }],
      items: [
        { id: 'fern', label: 'Fern', belongs: 'left' },
        { id: 'coral', label: 'Coral', belongs: 'both' },
      ],
    },
    success: { kind: 'binAssignment', assign: { fern: 'left', coral: 'both' } },
    placements: [
      { fern: 'left', coral: 'both' },
      { fern: 'right', coral: 'left' },
      { fern: 'left' },
      {},
    ],
    toWork: (placement) => ({ assign: placement }),
  },
  {
    apparatus: 'ordering-track',
    pattern: 'sequence',
    payload: {
      items: [
        { id: 'seed', label: 'Seed' },
        { id: 'sprout', label: 'Sprout' },
        { id: 'plant', label: 'Plant' },
      ],
      orientation: 'horizontal',
    },
    success: { kind: 'exactOrder', itemIds: ['seed', 'sprout', 'plant'] },
    placements: [
      { seed: '0', sprout: '1', plant: '2' },
      { seed: '2', sprout: '1', plant: '0' },
      { seed: '0', sprout: '1' },
      {},
    ],
    toWork: (placement) => ({
      order: Object.keys(placement).sort((a, b) => Number(placement[a]) - Number(placement[b])),
    }),
  },
  {
    apparatus: 'three-period-cards',
    pattern: 'threePeriod',
    payload: {
      items: [{ id: 'sun', label: 'Sun' }, { id: 'moon', label: 'Moon' }],
      phases: ['present', 'identify', 'recall'],
    },
    success: { kind: 'pairing', pairs: [['sun', 'Sun'], ['moon', 'Moon']] },
    placements: [
      { sun: 'answer-sun', moon: 'answer-moon' },
      { sun: 'answer-moon', moon: 'answer-sun' },
      { sun: 'answer-sun' },
      {},
    ],
    toWork: (placement) => {
      const labels = new Map([['sun', 'Sun'], ['moon', 'Moon']])
      return {
        phase: 2,
        answers: Object.fromEntries(
          Object.entries(placement).map(([pieceId, groupId]) => [
            pieceId,
            labels.get(groupId.replace(/^answer-/, '')) ?? '',
          ]),
        ),
      }
    },
  },
  {
    apparatus: 'labelled-diagram',
    pattern: 'label',
    payload: {
      image: { imageUrl: 'asset:cell', width: 100, height: 100 },
      hotspots: [
        { id: 'nucleus', x: 30, y: 30, r: 8, label: 'Nucleus' },
        { id: 'membrane', x: 70, y: 70, r: 8, label: 'Membrane' },
      ],
    },
    success: { kind: 'pairing', pairs: [['nucleus', 'Nucleus'], ['membrane', 'Membrane']] },
    placements: [
      { Nucleus: 'nucleus', Membrane: 'membrane' },
      { Nucleus: 'membrane', Membrane: 'nucleus' },
      { Nucleus: 'nucleus' },
      {},
    ],
    toWork: (placement) => ({
      assign: Object.fromEntries(Object.entries(placement).map(([label, hotspot]) => [hotspot, label])),
    }),
  },
  {
    apparatus: 'balance-beam',
    pattern: 'balance',
    payload: {
      left: [],
      right: [],
      pool: [
        { id: 'a', label: 'A', weight: 1 },
        { id: 'b', label: 'B', weight: 2 },
        { id: 'c', label: 'C', weight: 3 },
      ],
      mode: 'weights',
    },
    success: { kind: 'numericWithin', target: 0, tolerance: 0 },
    placements: [
      { a: 'left', b: 'left', c: 'right' },
      { a: 'left', b: 'left', c: 'left' },
      { a: 'left' },
      {},
    ],
    toWork: (placement) => ({
      left: Object.keys(placement).filter((id) => placement[id] === 'left'),
      right: Object.keys(placement).filter((id) => placement[id] === 'right'),
    }),
  },
  {
    apparatus: 'variable-model',
    pattern: 'vary',
    payload: {
      variable: { id: 'temperature', label: 'Temperature', min: 0, max: 10, step: 1 },
      model: { kind: 'bars', bars: [{ label: 'Height', expr: 'temperature', max: 10 }] },
      readouts: [{ label: 'Temperature', expr: 'temperature' }],
      target: { expr: 'temperature', value: 5, tolerance: 0.5 },
    },
    success: { kind: 'numericWithin', target: 5, tolerance: 0.5 },
    placements: [{}, {}, {}, {}],
    controls: [
      { temperature: 5 },
      { temperature: 0 },
      { temperature: 4 },
      { temperature: 10 },
    ],
    toWork: (_placement, controls) => ({ value: controls?.temperature ?? 0 }),
  },
  {
    apparatus: 'decision-branch',
    pattern: 'scenario',
    payload: {
      situation: 'Which route is safe?',
      choices: [
        { id: 'safe', label: 'Use the bridge', consequence: 'You cross safely.', defensible: true },
        { id: 'unsafe', label: 'Enter the flood', consequence: 'The current is dangerous.' },
      ],
    },
    success: { kind: 'exactSet', itemIds: ['safe'] },
    placements: [
      { safe: 'chosen' },
      { unsafe: 'chosen' },
      { safe: 'pool' },
      {},
    ],
    toWork: (placement) => ({
      chosen: Object.keys(placement).find((id) => placement[id] === 'chosen') ?? null,
    }),
  },
  {
    apparatus: 'bonding-ring',
    pattern: 'compose',
    payload: {
      parts: [
        { id: 'o', label: 'O', slots: 2 },
        { id: 'h1', label: 'H', slots: 1 },
        { id: 'h2', label: 'H', slots: 1 },
      ],
      validJoins: [{ a: 'H', b: 'O' }],
      target: { label: 'Water', formula: 'H2O' },
    },
    success: { kind: 'exactSet', itemIds: ['h1-o', 'h2-o'] },
    placements: [
      { 'bond-h1-o': 'joined', 'bond-h2-o': 'joined' },
      { 'bond-h1-o': 'joined', 'bond-h2-o': 'pool' },
      { 'bond-h1-o': 'joined' },
      {},
    ],
    toWork: (placement) => ({
      joins: Object.entries(placement)
        .filter(([, groupId]) => groupId === 'joined')
        .map(([bondId]) => bondId.replace(/^bond-/, '').split('-') as [string, string]),
    }),
  },
]

describe('the canon', () => {
  it('uses a Map, so a name out of model output cannot reach Object.prototype', () => {
    expect(getApparatus('__proto__')).toBeNull()
    expect(getApparatus('constructor')).toBeNull()
    expect(getApparatus('nope')).toBeNull()
  })

  it('returns null instead of throwing on hostile legacy payloads', () => {
    const cases = [
      ['sorting-frame', 'bins'],
      ['ordering-track', 'items'],
      ['three-period-cards', 'items'],
      ['venn-sets', 'sets'],
      ['balance-beam', 'pool'],
      ['labelled-diagram', 'hotspots'],
      ['variable-model', 'variable'],
      ['decision-branch', 'choices'],
      ['bonding-ring', 'parts'],
    ] as const

    for (const [name, property] of cases) {
      const hostile = Object.defineProperty({}, property, {
        get() {
          throw new Error('hostile getter')
        },
      })
      const convert = () => getApparatus(name)!.legacy!.fromLegacy(hostile)
      expect(convert).not.toThrow()
      expect(convert()).toBeNull()
    }
  })

  it('every entry is itself a valid material', () => {
    // The canon is written in the vocabulary, not above it. An entry that
    // could not pass the gate would be a second, privileged mechanism.
    for (const name of apparatusNames()) {
      const a = getApparatus(name)!
      const r = validateMaterial(a.base, a.maxVaryingTraits)
      expect(r.ok, `${name}: ${r.ok === false ? r.reason : ''}`).toBe(true)
    }
  })
})

describe('every apparatus that replaces a pattern agrees with it', () => {
  it('covers every apparatus that declares a legacy pattern', () => {
    const declared = apparatusNames().filter((name) => getApparatus(name)!.legacy)
    expect(CASES.map((c) => c.apparatus).sort()).toEqual(declared.sort())
  })

  for (const c of CASES) {
    it(`${c.apparatus} calls the same boards solved as ${c.pattern}`, () => {
      const spec = getApparatus(c.apparatus)!.legacy!.fromLegacy(c.payload, c.success as SuccessRule)!
      const legacy = getPatternModule(c.pattern as never)!
      for (const [index, placement] of c.placements.entries()) {
        const controls = c.controls?.[index] ?? {}
        const mine = tick(spec, placed(
          Object.fromEntries(Object.entries(placement).map(([pieceId, groupId]) => [pieceId, `s-${groupId}`])),
          controls,
        )).solved
        const theirs = legacy.validate(
          c.payload as never,
          c.toWork(placement, controls) as never,
          c.success as never,
        ).ok
        expect(mine, `${c.apparatus} ${JSON.stringify({ placement, controls })}`).toBe(theirs)
      }
    })
  }
})

describe('sorting-frame fromLegacy preserves catalogue art', () => {
  it('maps legal imageUrl (including asset: prefix) onto piece.art', () => {
    const payload = {
      bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
      items: [
        { id: 'hcl', label: 'HCl', binId: 'acid', imageUrl: 'asset:balance-scale' },
        { id: 'koh', label: 'KOH', binId: 'base', imageUrl: 'neuron' },
        { id: 'water', label: 'Water', binId: 'base', imageUrl: 'asset:https://evil.example/x.png' },
        { id: 'salt', label: 'Salt', binId: 'base' },
      ],
    }
    const success = {
      kind: 'binAssignment' as const,
      assign: { hcl: 'acid', koh: 'base', water: 'base', salt: 'base' },
    }
    const spec = getApparatus('sorting-frame')!.legacy!.fromLegacy(payload, success)!
    const byId = Object.fromEntries(spec.pieces.map((p) => [p.id, p]))

    expect(byId.hcl.art).toBe('balance-scale')
    expect(byId.koh.art).toBe('neuron')
    expect(byId.water.art).toBeUndefined()
    expect(byId.salt.art).toBeUndefined()
  })
})

describe('venn-sets fromLegacy preserves catalogue art', () => {
  it('maps legal imageUrl onto piece.art', () => {
    const payload = {
      sets: [{ id: 'plants', label: 'Plants' }, { id: 'animals', label: 'Animals' }],
      items: [
        { id: 'a', label: 'A only', belongs: 'left' as const, imageUrl: 'asset:balance-scale' },
        { id: 'b', label: 'Both', belongs: 'both' as const, imageUrl: 'neuron' },
        { id: 'c', label: 'Bad', belongs: 'right' as const, imageUrl: 'asset:https://evil.example/x.png' },
        { id: 'd', label: 'Plain', belongs: 'right' as const },
      ],
    }
    const success = {
      kind: 'binAssignment' as const,
      assign: { a: 'left', b: 'both', c: 'right', d: 'right' },
    }
    const spec = getApparatus('venn-sets')!.legacy!.fromLegacy(payload, success)!
    const byId = Object.fromEntries(spec.pieces.map((p) => [p.id, p]))
    expect(byId.a.art).toBe('balance-scale')
    expect(byId.b.art).toBe('neuron')
    expect(byId.c.art).toBeUndefined()
    expect(byId.d.art).toBeUndefined()
  })
})

describe('balance-beam fromLegacy preserves catalogue art', () => {
  it('maps legal imageUrl onto piece.art', () => {
    const payload = {
      left: [],
      right: [],
      pool: [
        { id: 'a', label: 'A', weight: 1, imageUrl: 'asset:balance-scale' },
        { id: 'b', label: 'B', weight: 2, imageUrl: 'neuron' },
        { id: 'c', label: 'C', weight: 3, imageUrl: 'asset:https://evil.example/x.png' },
        { id: 'd', label: 'D', weight: 4 },
      ],
      mode: 'weights' as const,
    }
    const success = {
      kind: 'numericWithin' as const,
      target: 0,
      tolerance: 0,
    }
    const spec = getApparatus('balance-beam')!.legacy!.fromLegacy(payload, success)!
    const byId = Object.fromEntries(spec.pieces.map((p) => [p.id, p]))
    expect(byId.a.art).toBe('balance-scale')
    expect(byId.b.art).toBe('neuron')
    expect(byId.c.art).toBeUndefined()
    expect(byId.d.art).toBeUndefined()
  })
})

describe('ordering-track fromLegacy preserves catalogue art', () => {
  it('maps legal imageUrl (including asset: prefix) onto piece.art', () => {
    const payload = {
      orientation: 'horizontal' as const,
      items: [
        { id: 'first', label: 'First', imageUrl: 'asset:balance-scale' },
        { id: 'second', label: 'Second', imageUrl: 'neuron' },
        { id: 'third', label: 'Third', imageUrl: 'asset:https://evil.example/x.png' },
        { id: 'fourth', label: 'Fourth' },
      ],
    }
    const success = {
      kind: 'exactOrder' as const,
      itemIds: ['first', 'second', 'third', 'fourth'],
    }
    const spec = getApparatus('ordering-track')!.legacy!.fromLegacy(payload, success)!
    const byId = Object.fromEntries(spec.pieces.map((p) => [p.id, p]))

    expect(byId.first.art).toBe('balance-scale')
    expect(byId.second.art).toBe('neuron')
    expect(byId.third.art).toBeUndefined()
    expect(byId.fourth.art).toBeUndefined()
  })
})

describe('fromLegacy treats success as the grading authority', () => {
  it('variable-model ignores a conflicting payload target', () => {
    const payload = {
      variable: { id: 'value', label: 'Value', min: 0, max: 10, step: 1 },
      model: { kind: 'bars' as const, bars: [{ label: 'Value', expr: 'value', max: 10 }] },
      readouts: [],
      target: { expr: 'value', value: 2, tolerance: 0 },
    }
    const success = { kind: 'numericWithin' as const, target: 8, tolerance: 0 }
    const spec = getApparatus('variable-model')!.legacy!.fromLegacy(payload, success)!

    expect(tick(spec, placed({}, { value: 8 })).solved).toBe(true)
    expect(tick(spec, placed({}, { value: 2 })).solved).toBe(false)
  })

  it('decision-branch follows success even when defensible metadata disagrees', () => {
    const payload = {
      situation: 'Choose one.',
      choices: [
        { id: 'marked', label: 'Marked defensible', consequence: 'No.', defensible: true },
        { id: 'answer', label: 'Actual answer', consequence: 'Yes.', defensible: false },
      ],
    }
    const success = { kind: 'exactSet' as const, itemIds: ['answer'] }
    const spec = getApparatus('decision-branch')!.legacy!.fromLegacy(payload, success)!

    expect(tick(spec, placed({ answer: 's-chosen' })).solved).toBe(true)
    expect(tick(spec, placed({ marked: 's-chosen' })).solved).toBe(false)
  })

  it('bonding-ring requires only the success subset of label-valid bonds', () => {
    const payload = {
      parts: [
        { id: 'o', label: 'O', slots: 2 },
        { id: 'h1', label: 'H', slots: 1 },
        { id: 'h2', label: 'H', slots: 1 },
      ],
      validJoins: [{ a: 'H', b: 'O' }],
      target: { label: 'Hydroxyl' },
    }
    const success = { kind: 'exactSet' as const, itemIds: ['h1-o'] }
    const spec = getApparatus('bonding-ring')!.legacy!.fromLegacy(payload, success)!

    expect(tick(spec, placed({ 'bond-h1-o': 's-joined' })).solved).toBe(true)
    expect(tick(spec, placed({ 'bond-h2-o': 's-joined' })).solved).toBe(false)
  })

  it('bonding-ring rejects required degrees above a part slot count', () => {
    const payload = {
      parts: [
        { id: 'o', label: 'O', slots: 1 },
        { id: 'h1', label: 'H', slots: 1 },
        { id: 'h2', label: 'H', slots: 1 },
      ],
      validJoins: [{ a: 'H', b: 'O' }],
      target: { label: 'Impossible' },
    }
    const success = { kind: 'exactSet' as const, itemIds: ['h1-o', 'h2-o'] }

    expect(getApparatus('bonding-ring')!.legacy!.fromLegacy(payload, success)).toBeNull()
  })
})
