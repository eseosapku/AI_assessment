import { describe, it, expect } from 'vitest'
import { pickPracticeCard } from './practice-card'
import { getEngine } from '@/lib/studylab/engines'
import { examplesOf } from '@/lib/studylab/engines/examples'
import real from './practice-cards.json'

const list: Record<string, [string, number]> = {
  'number:equations': ['area-grid', 0],
  'matter:equations': ['equation-balancer', 0],
  'number:first': ['area-grid', 0],
  'number:second': ['bar-model', 0],
  'number:ghost': ['no-such-engine', 0],
  'number:badindex': ['area-grid', 999],
}

describe('pickPracticeCard', () => {
  it('the first name wins, in order', () => expect(pickPracticeCard(['First', 'Second'], 'Mathematics', list)?.engineId).toBe('area-grid'))
  it('uses a later name when earlier ones have no entry', () => expect(pickPracticeCard(['Nothing', 'Second'], 'Mathematics', list)?.engineId).toBe('bar-model'))
  it('keeps equations in matter apart from equations in number', () => {
    expect(pickPracticeCard(['Equations'], 'Chemistry', list)?.engineId).toBe('equation-balancer')
    expect(pickPracticeCard(['Equations'], 'Mathematics', list)?.engineId).toBe('area-grid')
  })
  it('skips an unknown engine and carries on', () => expect(pickPracticeCard(['Ghost', 'Second'], 'Mathematics', list)?.engineId).toBe('bar-model'))
  it('skips a bad index and carries on', () => expect(pickPracticeCard(['BadIndex', 'Second'], 'Mathematics', list)?.engineId).toBe('bar-model'))
  it('gives null with no entry', () => expect(pickPracticeCard(['Nothing'], 'Mathematics', list)).toBeNull())
  it('gives null when only bad entries exist', () => expect(pickPracticeCard(['Ghost', 'BadIndex'], 'Mathematics', list)).toBeNull())
  it('matches names regardless of case', () => expect(pickPracticeCard(['SECOND'], 'Mathematics', list)?.engineId).toBe('bar-model'))
})

describe('the judged list', () => {
  it('finds the brackets card', () => expect(pickPracticeCard(['Expanding brackets'], 'Mathematics')?.engineId).toBe('area-grid'))
  it('finds a chapter the way the rack spells it, without Chapter 5:', () => expect(pickPracticeCard(['Trigonometry'], 'Mathematics')?.engineId).toBe('trig-circle'))
  it('points every entry at a registered engine and a real example', () => {
    for (const [key, [id, index]] of Object.entries(real as unknown as Record<string, [string, number]>)) {
      const engine = getEngine(id)
      expect(engine, key).toBeTruthy()
      expect(index >= 0 && index < examplesOf(engine!).length, key).toBe(true)
    }
  })
})
