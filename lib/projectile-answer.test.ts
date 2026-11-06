import { describe, expect, it } from 'vitest'
import { repairProjectileAnswer } from './projectile-answer'
const part = (scenario: string, question: string) => ({ type: 'longform', exam_question_id: '1', scenario, question, marks: 2, model_answer: 'Wrong answer.' })
describe('numerical projectile answers observed in live exams', () => {
  it('handles spelled-out height units without silently treating an elevated launch as ground level', () => {
    const q = part('A ball is thrown vertically upwards from a height of 2 metres above the ground with an initial velocity of 15 m/s.', 'Calculate the maximum height above the ground.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('13.48 m')
  })
  it('distinguishes returning to launch height from landing on the ground', () => {
    const q = part('A ball is projected vertically upwards from a height of 3 metres with an initial speed of 24 m/s.', 'Find the time taken for the ball to return to the same height of 3 metres.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('4.898 s')
    expect(q.model_answer).not.toContain('5.0199')
  })
  it('recognises an elevated platform and inverse-second velocity notation', () => {
    const q = part('A stone is projected vertically upwards from a platform 30 metres above the ground with an initial velocity of 20 ms^-1.', 'Calculate the time taken to hit the ground.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('0 = 30 +')
  })
  it('does not replace proof demands or a supplied height-time function with a different task', () => {
    expect(repairProjectileAnswer(part('A projectile is launched with an initial velocity of 15 m/s at an angle of 45 degrees.', 'Show that the ascent and descent times are equal.'))).toBe(false)
    expect(repairProjectileAnswer(part('A projectile is launched with an initial velocity of 20 m/s at an angle of 30 degrees. h(t) = 10t - 5t².', 'Calculate the time to maximum height.'))).toBe(false)
  })
  it('uses the ground-level root rather than doubling peak time from a raised launch', () => {
    const q = part('A stone is thrown vertically upwards from the top of a 25 m high building with an initial speed of 20 m/s.', 'Calculate the total time the stone is in the air until it hits the ground.')
    expect(repairProjectileAnswer(q)).toBe(true)
    expect(q.model_answer).toContain('5.085 s')
  })
  it('does not add the launch height to a rise above launch', () => {
    const q = part('A projectile is launched from a height of 10 m with an initial velocity of 15 m/s at an angle of 45 degrees.', 'Find the maximum height reached above the launch point.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('5.7398 m')
  })
  it('eliminates time consistently in the Cartesian equation', () => {
    const q = part('A projectile is launched from the ground with an initial velocity of 10 m/s at an angle of 60 degrees.', 'State the Cartesian equation of the trajectory.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('1.7321x − 0.196x²')
  })
  it('computes impact velocity using the cliff height', () => {
    const q = part('A stone is thrown vertically upwards from the top of a 30 m high cliff with an initial speed of 15 m/s.', 'Find the velocity when it hits the ground.')
    repairProjectileAnswer(q)
    expect(q.model_answer).toContain('28.513 m/s downwards')
  })
  it('leaves symbolic and nonstandard problems to the normal checker', () => {
    expect(repairProjectileAnswer(part('A projectile is launched at speed u.', 'Find its range in terms of u.'))).toBe(false)
    expect(repairProjectileAnswer(part('A projectile is launched with an initial velocity of 20 m/s at an angle of 30 degrees against a steady wind.', 'Calculate its range.'))).toBe(false)
  })
})
