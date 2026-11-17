import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { engines, scenesFor, sceneCatalogue, getEngine } from '@/lib/studylab/engines'
import { meaningFaults } from '@/lib/studylab/meaning'

const ids = (station: string) => scenesFor(station).map((e) => e.id)

describe('which scene a station is offered', () => {
  it('every engine listed in the index registers, once', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../lib/studylab/engines/index.ts'), 'utf8')
    const listed = src.match(/import '\.\/[^']+\/config'/g) ?? []
    const registered = engines()
    expect(registered).toHaveLength(listed.length)
    expect(new Set(registered.map((e) => e.id)).size).toBe(registered.length)
    expect(registered.length).toBeGreaterThanOrEqual(60)
  })

  it('a phrase match offers the circuit, and a shared stem does not', () => {
    expect(ids('Series and parallel circuits')).toContain('circuit')
    expect(ids("Ohm's law and resistors")).toContain('circuit')
    expect(ids('Circulation of the blood')).not.toContain('circuit')
    expect(ids('Air resistance of a falling ball')).not.toContain('circuit')
    expect(getEngine('__proto__')).toBeNull()
    expect(getEngine(null)).toBeNull()
  })

  it('food webs match the food-web scene, and an unrelated station matches nothing from it', () => {
    expect(ids('Food chains and food webs')).toContain('food-web')
    expect(ids('Solving quadratic equations by factorising')).not.toContain('food-web')
  })

  it('the prompt lists only the nearby scenes, and everything when no station is given', () => {
    const all = sceneCatalogue()
    const nearby = sceneCatalogue('Series and parallel circuits')
    expect(all.length).toBeGreaterThan(nearby.length)
    expect(nearby.toLowerCase()).toContain('circuit')
    expect(sceneCatalogue('The history of the roman forum')).not.toContain(getEngine('circuit')!.prompt)
  })

  it('a scene that would teach nothing is named, and a readable one is not rejected for being unreadable', () => {
    const broken = meaningFaults({ type: 'createActivity', spec: { pattern: 'scene', payload: { engine: 'nope', config: {} }, prompt: '' } })
    expect(broken.join(' ')).toMatch(/cannot be read/)
    const fine = meaningFaults({
      type: 'createActivity',
      spec: { pattern: 'scene', payload: { engine: 'circuit', config: { task: 'light', volts: 6, ohms: 3 } }, prompt: 'Close the switches so both bulbs light.' },
    })
    expect(fine.join(' ')).not.toMatch(/cannot be read/)
  })
})
