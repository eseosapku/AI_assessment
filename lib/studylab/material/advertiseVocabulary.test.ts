import { describe, it, expect } from 'vitest'
import { advertiseVocabulary } from './advertiseVocabulary'
import { MATERIAL_BOX } from './fit'
import { apparatusNames } from './canon'

describe('advertiseVocabulary', () => {
  it('quotes every MATERIAL_BOX limit from the live object', () => {
    const text = advertiseVocabulary()
    expect(text).toContain(String(MATERIAL_BOX.widthPx))
    expect(text).toContain(String(MATERIAL_BOX.heightPx))
    expect(text).toContain(String(MATERIAL_BOX.maxGroupsPerRow))
    expect(text).toContain(String(MATERIAL_BOX.maxSlotsPerRow))
    expect(text).toContain(String(MATERIAL_BOX.maxRows))
    expect(text).toContain(String(MATERIAL_BOX.maxTotalSlots))
  })

  it('lists every canon apparatus name', () => {
    const text = advertiseVocabulary()
    for (const name of apparatusNames()) {
      expect(text).toContain(name)
    }
  })

  it('is not empty', () => {
    expect(advertiseVocabulary().trim().length).toBeGreaterThan(0)
  })

  it('outlines MaterialSpec nouns the ACTION TYPES line promises', () => {
    const text = advertiseVocabulary()
    for (const noun of ['pieces', 'groups', 'slots', 'rules', 'goal', 'MaterialSpec']) {
      expect(text).toContain(noun)
    }
    expect(text).toContain('exactSet')
    expect(text).toContain('derive')
    expect(text).toContain('NOT ActivitySpec')
  })

  it('advertises both balance-beam isolates', () => {
    expect(advertiseVocabulary()).toContain('balance-beam — isolates: quantity | structure')
  })
})
