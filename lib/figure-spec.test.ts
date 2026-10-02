// lib/figure-spec.test.ts
import { describe, it, expect } from 'vitest'
import { parseFigureSpec } from './figure-spec'

// "The weight arrow points up" -- on three questions of one Primary paper,
// from library figures a person had approved. Air resistance pointing down;
// a satellite sitting on hatched ground beside a label reading "none". The
// spec format allows one arrow per direction, so a car with friction AND air
// resistance had to point one of them somewhere wrong.
describe('a force diagram has to be physics', () => {
  const forces = (object: string, arrows: [string, string][], surface?: string) =>
    parseFigureSpec({ kind: 'forces', object, arrows: arrows.map(([direction, label]) => ({ direction, label })), surface })

  it('takes a sound one', () => {
    expect(forces('book', [['down', 'weight 10 N'], ['up', 'normal force 10 N']], 'table')).not.toBeNull()
    expect(forces('car', [['right', 'driving force 600 N'], ['left', 'air resistance 200 N'], ['down', 'weight 9000 N'], ['up', 'normal force 9000 N']], 'road')).not.toBeNull()
  })

  it('refuses weight pointing anywhere but down', () => {
    expect(forces('car', [['up', 'weight 600 N'], ['right', 'driving force 600 N']], 'road')).toBeNull()
  })

  it('refuses a resistive force that is not against the motion', () => {
    expect(forces('car', [['right', 'engine force 600 N'], ['down', 'air resistance 200 N'], ['left', 'friction 50 N']], 'road')).toBeNull()
    expect(forces('cyclist', [['right', 'pedalling force 80 N'], ['right', 'friction 20 N'], ['down', 'weight 700 N']])).toBeNull()
  })

  it('refuses a support force pointing down', () => {
    expect(forces('box', [['down', 'normal force 20 N'], ['up', 'weight 20 N']], 'floor')).toBeNull()
  })

  it('refuses an object in orbit drawn on the ground, and a "none" label', () => {
    expect(forces('satellite', [['down', 'gravitational force from Earth'], ['up', 'centripetal force']], 'none')).toBeNull()
    expect(forces('ball', [['down', 'weight 5 N'], ['up', 'none']], 'grass')).toBeNull()
  })
})
