// lib/studylab/engines/respiration/respiration.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  respirationEngine, goodPrompt, muscleOf, yeastOf, advanceMuscle, advanceYeast, addGlucose,
  limeAppearance, muscleDone, yeastDone, VIEW_W, VIEW_H, MUSCLE_STEP_SECONDS,
  type RespirationConfig, type RespirationState,
} from './config'
import { RespirationView, W, H } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const muscle = { task: 'muscle' } as RespirationConfig
const yeast = { task: 'yeast' } as RespirationConfig
const html = (config: RespirationConfig, state: RespirationState, marked: 'idle' | 'right' | 'wrong' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(RespirationView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the staged muscle model', () => {
  it('changes lactic acid only when oxygen demand outruns supply, and clears it in recovery', () => {
    let s = muscleOf({})
    s = advanceMuscle({ ...s, pace: 'walk' })
    expect(s).toMatchObject({ pace: 'walk', seconds: 5, lactic: 0, sprinted: false })
    s = advanceMuscle({ ...s, pace: 'jog' })
    expect(s.lactic).toBe(0)
    s = advanceMuscle({ ...s, pace: 'sprint' })
    expect(s).toMatchObject({ seconds: 15, lactic: 2, sprinted: true })
    s = advanceMuscle({ ...s, pace: 'rest' })
    expect(s).toMatchObject({ seconds: 20, lactic: 0 })
    expect(muscleDone(s)).toBe(true)
  })

  it('cannot mistake a later sprint for having already recovered', () => {
    const s = advanceMuscle({ ...muscleOf({}), pace: 'sprint' })
    expect(s.lactic).toBe(2)
    expect(muscleDone(s)).toBe(false)
    expect(muscleDone(advanceMuscle({ ...s, pace: 'rest' }))).toBe(true)
    expect(muscleDone({ ...s, pace: 'rest', lactic: 0, seconds: 10 })).toBe(true)
  })

  it('reads malformed stored work safely and never lets it pass', () => {
    expect(muscleOf({})).toEqual({ pace: 'rest', seconds: 0, lactic: 0, sprinted: false })
    expect(muscleOf({ pace: 'fly', seconds: -4, lactic: 100, sprinted: 'yes' } as unknown as RespirationState)).toEqual({ pace: 'rest', seconds: 0, lactic: 6, sprinted: false })
    expect(respirationEngine.check(muscle, {} as RespirationState).ok).toBe(false)
    expect(respirationEngine.check(muscle, { pace: 'rest', lactic: 0, sprinted: false, seconds: 100 }).ok).toBe(false)
  })
})

describe('the yeast practical', () => {
  it('starts clear, clouds after one minute with glucose and becomes milky after two', () => {
    expect(limeAppearance({ spoons: 0, minutes: 0 })).toBe('clear')
    expect(limeAppearance({ spoons: 0, minutes: 4 })).toBe('clear')
    expect(limeAppearance({ spoons: 1, minutes: 1 })).toBe('cloudy')
    expect(limeAppearance({ spoons: 1, minutes: 2 })).toBe('milky')
    expect(yeastDone({ spoons: 1, minutes: 2 })).toBe(true)
    expect(yeastDone({ spoons: 0, minutes: 4 })).toBe(false)
  })

  it('starts timing when the first glucose is added, and gives every stage a finite bound', () => {
    expect(addGlucose({ spoons: 0, minutes: 3 })).toEqual({ spoons: 1, minutes: 0 })
    expect(addGlucose({ spoons: 3, minutes: 2 })).toEqual({ spoons: 3, minutes: 2 })
    expect(advanceYeast({ spoons: 1, minutes: 4 })).toEqual({ spoons: 1, minutes: 4 })
    expect(advanceYeast({ spoons: 0, minutes: 0 })).toEqual({ spoons: 0, minutes: 0 })
    expect(yeastOf({ spoons: 20, minutes: -2 })).toEqual({ spoons: 3, minutes: 0 })
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const configs = [muscle, yeast]
  it('starts unsolved and solve passes exactly', () => {
    for (const config of configs) {
      expect(respirationEngine.faults(config)).toEqual([])
      expect(respirationEngine.check(config, respirationEngine.initial(config)).ok).toBe(false)
      expect(respirationEngine.check(config, respirationEngine.solve(config))).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('accepts reasonable phrasings and rejects only unreadable configs', () => {
    expect(respirationEngine.parse({ task: 'anaerobic respiration in muscles' })).toEqual(muscle)
    expect(respirationEngine.parse({ task: 'respiration' })).toEqual(muscle)
    expect(respirationEngine.parse({ task: 'Aerobic respiration' })).toEqual(muscle)
    expect(respirationEngine.parse({ task: { kind: 'oxygen-debt' } })).toEqual(muscle)
    expect(respirationEngine.parse({ organism: 'yeast' })).toEqual(yeast)
    expect(respirationEngine.parse({ task: 'Fermentation' })).toEqual(yeast)
    expect(respirationEngine.parse({ task: 'respiration in plants' })).toEqual({ task: 'respiration-in-plants' })
    expect(respirationEngine.faults({ task: 'respiration-in-plants' })[0]).toMatch(/task "muscle".*task "yeast"/)
    expect(respirationEngine.parse(null)).toBeNull()
    expect(respirationEngine.parse({})).toBeNull()
    expect(respirationEngine.parse({ task: '' })).toBeNull()
  })
})

describe('the catalogue and near misses', () => {
  it('is registered with the stated dimension and valid examples', () => {
    expect(getEngine('respiration')).toBe(respirationEngine)
    expect(respirationEngine.isolates).toBe('consequence')
    expect(respirationEngine.prompt).toContain('SCENE "respiration"')
    expect(respirationEngine.prompt).toContain('"apparatus":"scene:respiration"')
    expect(respirationEngine.prompt).toContain('"isolates":"consequence"')
    expect(scenesFor('Anaerobic respiration and oxygen debt').map((e) => e.id)).toContain('respiration')
    expect(scenesFor('Yeast respiration and fermentation').map((e) => e.id)).toContain('respiration')
    expect(sceneCatalogue('Respiration releases energy from glucose')).toContain('SCENE "respiration"')
    expect(scenesFor('Breathing system: ventilation and gas exchange').map((e) => e.id)).not.toContain('respiration')
    expect(scenesFor('Photosynthesis and limiting factors').map((e) => e.id)).not.toContain('respiration')
    expect(scenesFor('Food tests: test for glucose').map((e) => e.id)).not.toContain('respiration')
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('respiration')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found).toHaveLength(2)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('refuses prompts that reveal the pathway or promise apparatus not drawn', () => {
    const faults = respirationEngine.promptFaults!
    expect(faults(muscle, goodPrompt(muscle))).toEqual([])
    expect(faults(yeast, goodPrompt(yeast))).toEqual([])
    expect(faults(muscle, 'Sprint to make lactic acid, then see the oxygen debt.').join(' ')).toMatch(/gives .* away/)
    expect(faults(muscle, 'Measure your heart rate with a stopwatch.').join(' ')).toMatch(/does not show/)
    expect(faults(yeast, 'Watch anaerobic fermentation make ethanol and carbon dioxide.').join(' ')).toMatch(/gives .* away/)
    expect(faults(yeast, 'Heat the water bath and measure gas volume.').join(' ')).toMatch(/does not show/)
  })
})

describe('the drawn cards', () => {
  it('uses the dimensions agreed between view and config', () => {
    expect(W).toBe(VIEW_W)
    expect(H).toBe(VIEW_H)
    expect(MUSCLE_STEP_SECONDS).toBe(5)
  })

  it('names the goal and live measures, with real accessible controls', () => {
    const m = html(muscle, respirationEngine.initial(muscle))
    expect(m).toContain('Exercise the muscle, then let it recover.')
    expect(m).toContain('Lactic acid')
    expect(m).toContain('Breathing')
    expect(m).toContain('aria-label="Choose a faster exercise pace"')
    expect(m).toContain('aria-label="Advance five seconds"')
    const y = html(yeast, respirationEngine.initial(yeast))
    expect(y).toContain('Goal: show yeast respiring')
    expect(y).toContain('aria-label="Add a spoon of glucose"')
    expect(y).toContain('aria-label="Wait one minute"')
    expect(y).toContain('limewater: clear')
  })

  it('changes the apparatus and live observations after each smallest stage', () => {
    const y0 = html(yeast, { spoons: 0, minutes: 0 })
    const y1 = html(yeast, { spoons: 1, minutes: 1 })
    const y2 = html(yeast, { spoons: 1, minutes: 2 })
    expect(y0).not.toBe(y1)
    expect(y1).toContain('limewater: cloudy')
    expect(y2).toContain('limewater: milky')
    const m0 = html(muscle, { pace: 'rest', seconds: 0, lactic: 0, sprinted: false })
    const m1 = html(muscle, { pace: 'sprint', seconds: 5, lactic: 2, sprinted: true })
    expect(m0).not.toBe(m1)
    expect(m1).toContain('lactic acid')
    expect(m1).toContain('Sprinting — 5 s')
  })

  it('renders the same informative frames with reduced motion', () => {
    expect(html(muscle, respirationEngine.solve(muscle), 'idle', true)).toContain('Resting — 10 s')
    expect(html(yeast, respirationEngine.solve(yeast), 'idle', true)).toContain('limewater: milky')
  })

  it('keeps pathway names, products and oxygen debt out of all visible and screen-reader text before marking', () => {
    for (const config of [muscle, yeast]) {
      const before = html(config, respirationEngine.initial(config))
      expect(before).not.toMatch(/anaerobic|aerobic|oxygen debt|ethanol|carbon dioxide|fermentation/i)
      const solved = html(config, respirationEngine.solve(config))
      expect(solved).not.toMatch(/anaerobic|aerobic|oxygen debt|ethanol|carbon dioxide|fermentation/i)
      const wrong = html(config, respirationEngine.initial(config), 'wrong')
      expect(wrong).not.toMatch(/anaerobic|aerobic|oxygen debt|ethanol|carbon dioxide|fermentation/i)
      const right = html(config, respirationEngine.solve(config), 'right')
      expect(right).toMatch(/anaerobic/i)
      expect(right).toMatch(/oxygen|glucose/i)
    }
  })

  it('has no answer words in a server-rendered ActivityNode', () => {
    const node = (config: RespirationConfig) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'r1', data: { spec: { pattern: 'scene', prompt: goodPrompt(config), payload: { engine: 'respiration', config }, success: { kind: 'scene' } } },
    } as never)))
    for (const config of [muscle, yeast]) {
      const rendered = node(config).replace(goodPrompt(config), '')
      expect(rendered).not.toMatch(/anaerobic|aerobic|oxygen debt|ethanol|carbon dioxide|fermentation/i)
    }
  })

  it('explains what was made when wrong, and the syllabus relationship when right', () => {
    expect(html(muscle, respirationEngine.initial(muscle), 'wrong')).toContain('You have not made lactic acid yet')
    expect(html(yeast, { spoons: 1, minutes: 1 }, 'wrong')).toContain('only cloudy')
    expect(html(muscle, respirationEngine.solve(muscle), 'right')).toContain('much less energy')
    expect(html(yeast, respirationEngine.solve(yeast), 'right')).toContain('bread rise')
  })
})
