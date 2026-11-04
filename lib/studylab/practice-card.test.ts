import { describe, it, expect } from 'vitest'
import { pickPracticeEntry } from './practice-card'
import { getEngine } from '@/lib/studylab/engines'
import { examplesOf } from '@/lib/studylab/engines/examples'
import real from './practice-cards.json'

const list: Record<string, [string, number]> = {
  'number:equations': ['area-grid', 0],
  'matter:equations': ['equation-balancer', 0],
  'number:first': ['area-grid', 0],
  'number:second': ['bar-model', 3],
}

describe('pickPracticeEntry', () => {
  it('the first name wins, in order', () => expect(pickPracticeEntry(['First', 'Second'], 'Mathematics', list)).toEqual({ engineId: 'area-grid', exampleIndex: 0 }))
  it('uses a later name when earlier ones have no entry', () => expect(pickPracticeEntry(['Nothing', 'Second'], 'Mathematics', list)).toEqual({ engineId: 'bar-model', exampleIndex: 3 }))
  it('keeps equations in matter apart from equations in number', () => {
    expect(pickPracticeEntry(['Equations'], 'Chemistry', list)?.engineId).toBe('equation-balancer')
    expect(pickPracticeEntry(['Equations'], 'Mathematics', list)?.engineId).toBe('area-grid')
  })
  it('gives null with no entry', () => expect(pickPracticeEntry(['Nothing'], 'Mathematics', list)).toBeNull())
  it('matches names regardless of case', () => expect(pickPracticeEntry(['SECOND'], 'Mathematics', list)?.engineId).toBe('bar-model'))
})

describe('the judged list', () => {
  it('finds the brackets card', () => expect(pickPracticeEntry(['Expanding brackets'], 'Mathematics')?.engineId).toBe('area-grid'))
  it('finds a chapter the way the rack spells it, without Chapter 5:', () => expect(pickPracticeEntry(['Trigonometry'], 'Mathematics')?.engineId).toBe('trig-circle'))
  it('gives a language book no science card', () => expect(pickPracticeEntry(['Weather'], 'IGCSE German')).toBeNull())
  it('points every entry at a registered engine and a real example', () => {
    for (const [key, [id, index]] of Object.entries(real as unknown as Record<string, [string, number]>)) {
      const engine = getEngine(id)
      expect(engine, key).toBeTruthy()
      expect(index >= 0 && index < examplesOf(engine!).length, key).toBe(true)
    }
  })
})
