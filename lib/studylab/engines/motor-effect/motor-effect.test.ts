import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  cleanAmps, cleanAngle, forceSign, FULL_TURN, motorEffectEngine, motorFeedback, nextMotorAngle, nextMotorState,
  wireFeedback, wireWay, type MotorConfig, type MotorState,
} from './config'
import { motorCurrent, motorStage, MotorEffectView, sideForces, wireSwingDegrees, W, H } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '../magnetism/config'
import '../circuit/config'
import '../moments-machines/config'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const wire = (swing: string, current: number) => motorEffectEngine.parse({ task: 'wire', swing, current })!
const motor = () => motorEffectEngine.parse({ task: 'motor' })!

function everyConfig(): MotorConfig[] {
  const out: MotorConfig[] = []
  for (const swing of ['left', 'right']) {
    for (let current = 1; current <= 3; current++) out.push(wire(swing, current))
  }
  out.push(motor())
  return out
}

describe('the physical rules', () => {
  it('reverses the force for current or field alone, but not for both', () => {
    expect(forceSign({ supply: 1, poles: 1 })).toBe(1)
    expect(forceSign({ supply: -1, poles: 1 })).toBe(-1)
    expect(forceSign({ supply: 1, poles: -1 })).toBe(-1)
    expect(forceSign({ supply: -1, poles: -1 })).toBe(1)
    // Current down (supply 1) with N behind (poles 1): F = I L x B points left, by Fleming's left-hand rule.
    expect(wireWay(wire('left', 2), { amps: 2, supply: 1, poles: 1 })).toBe('left')
    expect(wireWay(wire('left', 2), { amps: 2, supply: -1, poles: 1 })).toBe('right')
    expect(wireWay(wire('left', 2), { amps: 2, supply: 1, poles: -1 })).toBe('right')
    expect(wireWay(wire('left', 2), { amps: 0, supply: 1, poles: 1 })).toBe('still')
  })

  it('makes each one-amp change visible, with a still wire at zero', () => {
    expect(wireSwingDegrees(0, 1)).toBe(0)
    expect(Math.abs(wireSwingDegrees(1, 1) - wireSwingDegrees(0, 1))).toBe(9)
    expect(Math.abs(wireSwingDegrees(2, 1) - wireSwingDegrees(1, 1))).toBe(4)
    expect(Math.abs(wireSwingDegrees(3, 1) - wireSwingDegrees(2, 1))).toBe(4)
    expect(Math.sign(wireSwingDegrees(2, 1))).not.toBe(Math.sign(wireSwingDegrees(2, -1)))
  })

  it('turns continuously with a split ring and stops upright with slip rings', () => {
    let split: MotorState = { contacts: 'split', angle: 0 }
    for (const angle of [1, 2, 3, FULL_TURN]) {
      split = { contacts: 'split', angle: nextMotorAngle(split) }
      expect(cleanAngle(split)).toBe(angle)
    }
    expect(nextMotorAngle(split)).toBe(4)
    expect(motorCurrent(1, 'split').dead).toBe(true)
    expect(motorCurrent(2, 'split').reversed).toBe(true)
    expect(motorCurrent(2, 'slip').reversed).toBe(false)
    let slip: MotorState = { contacts: 'slip', angle: 0 }
    const seen = [0]
    for (let n = 0; n < 4; n++) {
      slip = nextMotorState(slip)
      seen.push(cleanAngle(slip))
    }
    expect(seen).toEqual([0, 1, 1, 1, 1])
    expect(slip.pushes).toBe(3)
  })

  it('pushes the right-hand side up and the left-hand side down, and nothing at a split-ring gap', () => {
    expect(sideForces(0, 'split')).toEqual({ a: 1, b: -1 })
    expect(sideForces(90, 'split')).toEqual({ a: 0, b: 0 })
    expect(sideForces(180, 'split')).toEqual({ a: -1, b: 1 })
    expect(sideForces(270, 'split')).toEqual({ a: 0, b: 0 })
    // Slip rings never swap the current: past upright the same forces turn the coil back.
    expect(sideForces(130, 'slip')).toEqual({ a: 1, b: -1 })
  })

  it('names each stage in words and units', () => {
    expect(motorStage(0, 'slip')).toBe('Start · 0°')
    expect(motorStage(1, 'split')).toMatch(/Quarter-turn.*90°.*contact gap/)
    expect(motorStage(2, 'split')).toMatch(/Half-turn.*180°.*current reversed/)
    expect(motorStage(1, 'slip')).toMatch(/Quarter-turn.*90°.*stops upright/)
    expect(motorStage(4, 'split')).toBe('Full turn · 360°')
    expect(FULL_TURN).toBe(4)
  })
})

describe('reading the tutor config', () => {
  it('reads the two tasks and reasonable wire phrasings', () => {
    expect(wire('left', 2)).toEqual({ task: 'wire', swing: 'left', amps: 2 })
    expect(motorEffectEngine.parse({ task: { kind: 'kicking wire', direction: 'to the right', amps: '3 A' } })).toEqual({ task: 'wire', swing: 'right', amps: 3 })
    expect(motorEffectEngine.parse({ kind: 'Fleming’s left hand rule', target: 'left' })).toEqual({ task: 'wire', swing: 'left', amps: 2 })
    expect(motorEffectEngine.parse({ task: 'd.c. motor' })).toEqual({ task: 'motor' })
    expect(motorEffectEngine.parse({ commutator: true })).toEqual({ task: 'motor' })
    expect(motorEffectEngine.parse(null)).toBeNull()
    expect(motorEffectEngine.parse({ task: 'loudspeaker' })).toBeNull()
    expect(motorEffectEngine.parse({ task: 'wire', current: 'lots' })).toBeNull()
  })

  it('refuses narrowly, with a nearby setting that works', () => {
    expect(motorEffectEngine.faults(wire('left', 2))).toEqual([])
    expect(motorEffectEngine.faults(wire('right', 3))).toEqual([])
    expect(motorEffectEngine.faults(motor())).toEqual([])
    expect(motorEffectEngine.faults(wire('up', 2)).join(' ')).toMatch(/only swing left or right.*swing "left"/)
    expect(motorEffectEngine.faults(wire('left', 9)).join(' ')).toMatch(/whole number from 1 to 3 A.*current 3/)
    expect(motorEffectEngine.faults(wire('left', 1.5)).join(' ')).toMatch(/current 2/)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = everyConfig()
  it('starts unsolved and solves cleanly', () => {
    for (const config of all) {
      expect(motorEffectEngine.check(config, motorEffectEngine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(motorEffectEngine.check(config, motorEffectEngine.solve(config))).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('never marks malformed work right', () => {
    for (const config of all) {
      expect(motorEffectEngine.check(config, {} as MotorState).ok).toBe(false)
      expect(motorEffectEngine.check(config, null as unknown as MotorState).ok).toBe(false)
      expect(motorEffectEngine.check(config, { amps: NaN, angle: NaN }).ok).toBe(false)
          if (config.task === 'wire') expect(motorEffectEngine.check(config, { amps: 99, angle: 99 }).ok).toBe(false)
      if (config.task === 'motor') expect(motorEffectEngine.check(config, { contacts: 'split', angle: 99 }).ok).toBe(true)
    }
  })

  it('reports useful wrong parts', () => {
    expect(motorEffectEngine.check(wire('left', 2), { amps: 3, supply: -1, poles: 1 }).wrongIds).toEqual(['current', 'direction'])
    expect(motorEffectEngine.check(motor(), { contacts: 'slip', angle: 2 }).wrongIds).toEqual(['contacts', 'angle'])
    expect(motorEffectEngine.check(motor(), { contacts: 'split', angle: 3 }).wrongIds).toEqual(['angle'])
  })
})

describe('feedback says what was made', () => {
  it('explains the wire’s actual direction and current, then the aim', () => {
    const c = wire('left', 2)
    expect(wireFeedback(c, { amps: 0, supply: 1, poles: 1 }, false)[0]).toMatch(/No current flows.*hangs still/)
    expect(wireFeedback(c, { amps: 3, supply: -1, poles: 1 }, false)[0]).toBe('The wire swings right at 3 A.')
    expect(wireFeedback(c, motorEffectEngine.solve(c), true)[0]).toMatch(/^Yes/)
  })

  it('explains slip rings turning back and split rings exchanging contacts', () => {
    expect(motorFeedback(motor(), { contacts: 'slip', angle: 1 }, false).join(' ')).toMatch(/push it back.*stops at 90°/)
    expect(motorFeedback(motor(), motorEffectEngine.solve(motor()), true).join(' ')).toMatch(/Fixed brushes exchange half-rings every half-turn.*reversing coil current/i)
  })
})

describe('the prompt a card is written with', () => {
  it('keeps the wire setting and the discovered rule out of the prompt', () => {
    expect(motorEffectEngine.promptFaults!(wire('left', 2), 'Reverse the supply, then set 2 A to swing left.').join(' ')).toMatch(/gives away/)
    expect(motorEffectEngine.promptFaults!(wire('left', 2), 'Notice that reversing the current reverses the force.').join(' ')).toMatch(/gives away/)
    expect(motorEffectEngine.promptFaults!(wire('left', 2), 'Turn the coil with the split ring.').join(' ')).toMatch(/different apparatus/)
  })

  it('keeps the working motor contacts and their explanation out', () => {
    expect(motorEffectEngine.promptFaults!(motor(), 'Fit the split ring to reverse the current and turn fully.').join(' ')).toMatch(/gives away/)
    expect(motorEffectEngine.promptFaults!(motor(), 'Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('motor-effect')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThanOrEqual(3)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('the motor-effect scene on the board', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'motor-effect', config }, success: { kind: 'scene' } } },
  } as never)))

  it('has real labelled controls and a visible goal and live measure', () => {
    const html = card({ task: 'wire', swing: 'left', current: 2 }, 'Use the current, supply and magnet controls to make the copper wire swing left at 2 A.')
    expect(html).toMatch(/aria-label="Decrease current by 1 amp"/)
    expect(html).toMatch(/aria-label="Increase current by 1 amp"/)
    expect(html).toMatch(/aria-label="Reverse the supply"/)
    expect(html).toMatch(/aria-label="Swap the north and south poles"/)
    expect(html).toMatch(/Swing left · 2 A/)
    const motorHtml = card({ task: 'motor' }, 'Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.')
    expect(motorHtml).toMatch(/Coil turned/)
    expect(motorHtml).toMatch(/0° of 360°/)
    expect(motorHtml).toMatch(/role="group" aria-label="Contacts"/)
    expect(motorHtml).toMatch(/aria-pressed="true"[^>]*>Slip rings</)
    expect(motorHtml).toMatch(/aria-label="Turn the coil 90 degrees"/)
  })

  it('holds back the control answer and the commutation explanation before marking', () => {
    const html = card({ task: 'wire', swing: 'left', current: 2 }, 'Use the current, supply and magnet controls to make the copper wire swing left at 2 A.').replace('Use the current, supply and magnet controls to make the copper wire swing left at 2 A.', '')
    expect(html).not.toMatch(/Reversing either the supply/)
    expect(html).not.toMatch(/Reversing both/)
    expect(html).not.toMatch(/turning effect stays/)
    const m = card({ task: 'motor' }, 'Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.').replace('Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.', '')
    expect(m).not.toMatch(/The split ring has carried/)
    expect(m).not.toMatch(/exchange contacts/)
    expect(m).not.toMatch(/turns back instead of completing/)
  })

  it('shows feedback only when marked', () => {
    const c = wire('left', 2)
    const view = (marked: 'idle' | 'right' | 'wrong') => renderToStaticMarkup(createElement(MotorEffectView, {
      config: c, state: motorEffectEngine.solve(c), setState: () => {}, marked, reduced: true, locked: marked === 'right',
    }))
    expect(view('idle')).not.toMatch(/Reversing either/)
    expect(view('right')).toMatch(/Yes\. The wire swings left at 2 A/)
    expect(view('wrong')).toMatch(/Reverse supply or magnets/)
    const m = renderToStaticMarkup(createElement(MotorEffectView, {
      config: motor(), state: motorEffectEngine.solve(motor()), setState: () => {}, marked: 'right', reduced: true, locked: true,
    }))
    expect(m).toMatch(/through 360°/)
    expect(m).toMatch(/every half-turn/)
  })

  it('fits its drawing and gives no unmet vector symbols', () => {
    expect(W).toBe(360)
    expect(H).toBe(240)
    const html = renderToStaticMarkup(createElement(MotorEffectView, {
      config: motor(), state: { contacts: 'slip', angle: 1 }, setState: () => {}, marked: 'idle', reduced: true, locked: false,
    }))
    expect(html).not.toMatch(/⊙|⊗/)
    expect(html).toMatch(/Past here the forces push it back/)
    const split = renderToStaticMarkup(createElement(MotorEffectView, {
      config: motor(), state: { contacts: 'split', angle: 1 }, setState: () => {}, marked: 'idle', reduced: true, locked: false,
    }))
    expect(split).toMatch(/gaps are under the brushes, so no current/)
    expect(split).toMatch(/contact gap/)
  })
})

describe('station matching', () => {
  it('catches its stations and leaves its near misses to their own scenes', () => {
    expect(scenesFor('The motor effect: force on a current-carrying conductor').map((e) => e.id)).toContain('motor-effect')
    expect(scenesFor('The d.c. motor and split-ring commutator').map((e) => e.id)).toContain('motor-effect')
    expect(scenesFor('Electric motors').map((e) => e.id)).toContain('motor-effect')
    expect(scenesFor('Electromagnetic induction in generators').map((e) => e.id)).not.toContain('motor-effect')
    expect(scenesFor('Electric circuits in series and parallel').map((e) => e.id)).not.toContain('motor-effect')
    expect(scenesFor('Turning forces and the principle of moments').map((e) => e.id)).not.toContain('motor-effect')
    expect(sceneCatalogue('Electromagnetic induction and induced emf')).not.toContain('SCENE "motor-effect"')
    expect(sceneCatalogue('Fleming left-hand rule')).toContain('SCENE "motor-effect"')
  })

  it('is registered with the isolate named in its examples', () => {
    expect(getEngine('motor-effect')).toBe(motorEffectEngine)
    expect(motorEffectEngine.isolates).toBe('consequence')
    expect(motorEffectEngine.prompt).toMatch(/SCENE "motor-effect"/)
    expect([...motorEffectEngine.prompt.matchAll(/"isolates":"(\w+)"/g)].every((m) => m[1] === 'consequence')).toBe(true)
  })
})
