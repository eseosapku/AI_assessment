// lib/studylab/engines/energy-resources/energy-resources.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  energyEngine as E, solarOf, renewAt, coalAt, litAt, co2Of, readState, done, goalText, captionText, verdictOf, verdictText, jumpTo, co2Label, momentsOf,
  EXAMPLES, TIMES,
  type PowerConfig, type PowerState, type Moment, type MomentIn,
} from './config'
import { EnergyView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const [STILL_EVE, SUNNY_NOON, SUN_THEN_DARK, WINDY_DAY] = EXAMPLES.map((e) => e.config)
const m = (time: string, wind = 'still', sky = 'clear'): MomentIn => ({ time, wind, sky })
const cfg = (moments: MomentIn[], maxCo2: number | null = null, plots = 4): PowerConfig => ({ kind: 'power-town', moments, maxCo2, plots })
const st = (turbines: number, panels: number, coal: number, shown = 0): PowerState => ({ turbines, panels, coal, shown })

const MOMENT_SETS: MomentIn[][] = []
for (const a of TIMES) {
  for (const b of [undefined, ...TIMES]) {
    for (const c of [undefined, ...TIMES]) {
      const ts = [a, b, c].filter((x): x is (typeof TIMES)[number] => !!x)
      if (ts.some((t, i) => i > 0 && TIMES.indexOf(t) <= TIMES.indexOf(ts[i - 1]))) continue
      for (const wind of ['still', 'windy']) {
        for (const sky of ['clear', 'cloudy']) MOMENT_SETS.push(ts.map((t) => m(t, wind, sky)))
      }
    }
  }
}
/** Every valid config over a spread of limits and plots. */
function allConfigs(): PowerConfig[] {
  const out: PowerConfig[] = []
  for (const moments of MOMENT_SETS) for (const maxCo2 of [null, 0, 6, 12, 18, 54]) for (const plots of [2, 3, 4, 6]) out.push(cfg(moments, maxCo2, plots))
  return out.filter((c) => E.faults(c).length === 0)
}

const render = (config: PowerConfig, state: PowerState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(EnergyView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

suite('the model', () => {
  it('follows the design for sun, wind and coal', () => {
    expect(solarOf('noon', 'clear')).toBe(3)
    expect(solarOf('noon', 'cloudy')).toBe(1)
    expect(solarOf('evening', 'clear')).toBe(0)
    expect(solarOf('night', 'cloudy')).toBe(0)
    const mm = (time: Moment['time'], wind: Moment['wind'], sky: Moment['sky']): Moment => ({ time, wind, sky })
    expect(renewAt(mm('noon', 'windy', 'clear'), st(1, 1, 0))).toBe(6)
    expect(renewAt(mm('noon', 'still', 'clear'), st(3, 1, 0))).toBe(3)
    expect(coalAt(mm('evening', 'still', 'clear'), st(0, 0, 3))).toBe(6)
    expect(coalAt(mm('evening', 'still', 'clear'), st(0, 0, 1))).toBe(3)
    expect(coalAt(mm('noon', 'still', 'clear'), st(0, 1, 2))).toBe(3)
    expect(coalAt(mm('noon', 'still', 'clear'), st(0, 2, 2))).toBe(0)
    expect(litAt(mm('evening', 'still', 'clear'), st(1, 2, 1))).toBe(3)
    expect(litAt(mm('evening', 'windy', 'clear'), st(2, 0, 0))).toBe(6)
    expect(co2Of(momentsOf(SUN_THEN_DARK), st(0, 2, 2))).toBe(6)
    expect(co2Of(momentsOf(SUN_THEN_DARK), st(0, 0, 2))).toBe(12)
  })
})

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(500)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      const s = E.solve(c)
      expect(E.check(c, s).ok, `cannot solve ${tag}`).toBe(true)
      expect(s.shown).toBe(0)
      expect(verdictOf(c, s).kind).toBe('pass')
      expect(verdictText(c, s)).toBeTruthy()
    }
  })

  it('solves the four catalogue tasks the way the design says', () => {
    expect(E.solve(STILL_EVE)).toEqual(st(0, 0, 2))
    expect(E.solve(SUNNY_NOON)).toEqual(st(0, 2, 0))
    expect(E.solve(SUN_THEN_DARK)).toEqual(st(0, 2, 2))
    expect(E.solve(WINDY_DAY)).toEqual(st(2, 0, 2))
  })

  it('has one answer for the two tasks the design calls the only answer', () => {
    for (const c of [SUN_THEN_DARK, WINDY_DAY]) {
      const wins: PowerState[] = []
      for (let t = 0; t <= 3; t++) for (let p = 0; p <= 3; p++) for (let k = 0; k <= 3; k++) if (E.check(c, st(t, p, k)).ok) wins.push(st(t, p, k))
      expect(wins, JSON.stringify(c)).toEqual([E.solve(c)])
    }
  })

  it('marks every moment, the limit and the room', () => {
    // Lit at noon but not in the evening.
    expect(E.check(SUN_THEN_DARK, st(0, 2, 0)).ok).toBe(false)
    // Lit at both times, over the CO2 limit (12 against 6).
    expect(E.check(SUN_THEN_DARK, st(0, 0, 2)).ok).toBe(false)
    // Over the room: 3 + 2 + 1 = 6 stations on 4 places.
    expect(E.check(STILL_EVE, st(3, 2, 1)).ok).toBe(false)
    // No limit: spare stations do no harm.
    expect(E.check(STILL_EVE, st(1, 1, 2)).ok).toBe(true)
    expect(E.check(STILL_EVE, st(0, 0, 1)).ok).toBe(false)
    // The shown time does not matter to marking.
    expect(E.check(STILL_EVE, st(0, 0, 2, 2)).ok).toBe(true)
  })

  it('reads corrupt stored work as nothing built and never accepts it', () => {
    expect(readState(null)).toEqual(st(0, 0, 0))
    expect(readState({ turbines: 9, panels: -1, coal: 1.5, shown: 7 } as PowerState)).toEqual(st(0, 0, 0))
    expect(E.check(STILL_EVE, {} as PowerState).ok).toBe(false)
    expect(E.check(STILL_EVE, { turbines: 0, panels: 0, coal: 4, shown: 0 }).ok).toBe(false)
    expect(done(cfg([m('noon')], null, 9), st(0, 2, 0))).toBe(false)
  })
})

suite('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(E.parse(STILL_EVE)).toEqual(STILL_EVE)
    expect(E.parse({ moments: [{ time: 'Evening', wind: 'calm', sky: 'clear' }] })).toEqual(STILL_EVE)
    expect(E.parse({ moments: [{ time: 'midday', wind: 'no wind', sky: 'sunny' }], maxCo2: '0 units' })).toEqual(SUNNY_NOON)
    expect(E.parse({ moments: [{ time: 'noon', wind: true, sky: 'overcast' }, { time: 'dusk' }] })).toEqual(cfg([m('noon', 'windy', 'cloudy'), m('evening')]))
    expect(E.parse({ time: 'evening', wind: 'still', sky: 'clear', plots: '4', maxCo2: 'no limit' })).toEqual(STILL_EVE)
    expect(E.parse([{ time: 'noon' }, { time: 'evening' }])).toEqual(cfg([m('noon'), m('evening')]))
    expect(E.parse({ moments: ['noon', 'night'] })).toEqual(cfg([m('noon'), m('night')]))
    expect(E.parse(null)).toBeNull()
    expect(E.parse('energy')).toBeNull()
    expect(E.parse({})).toBeNull()
    expect(E.parse({ moments: [3] })).toBeNull()
  })

  it('refuses what cannot be drawn, with an example that works', () => {
    const f = (raw: unknown) => E.faults(E.parse(raw)!)
    expect(f({ moments: [] })[0]).toMatch(/1 to 3 moments/)
    expect(f({ moments: [m('noon'), m('evening'), m('night'), m('night')] })[0]).toMatch(/1 to 3 moments/)
    expect(f({ moments: [m('night'), m('noon')] })[0]).toMatch(/day order.*"noon","wind":"still"/)
    expect(f({ moments: [m('noon'), m('noon', 'windy')] })[0]).toMatch(/day order/)
    expect(f({ moments: [m('teatime')] })[0]).toMatch(/"noon", "evening" or "night"/)
    expect(f({ moments: [m('noon', 'gale')] })[0]).toMatch(/"still" or "windy"/)
    expect(f({ moments: [m('noon', 'still', 'foggy')] })[0]).toMatch(/"clear" or "cloudy"/)
    expect(f({ moments: [m('noon')], plots: 1 })[0]).toMatch(/2 to 6 stations, not 1.*"plots":4/)
    expect(f({ moments: [m('noon')], plots: 7 })[0]).toMatch(/not 7/)
    expect(f({ moments: [m('noon')], maxCo2: -1 })[0]).toMatch(/0 to 54/)
    expect(f({ moments: [m('noon')], maxCo2: 2.5 })[0]).toMatch(/not 2.5/)
    expect(f({ moments: [m('noon')], maxCo2: 55 })[0]).toMatch(/not 55/)
    expect(f({ moments: [m('evening')], maxCo2: 0 })[0]).toMatch(/limit of 0.*raise it to 6.*"maxCo2":6/)
    expect(f({ moments: [m('evening')], maxCo2: 6 })).toEqual([])
    expect(f({ moments: [m('noon')], maxCo2: 0 })).toEqual([])
    expect(f({ moments: [m('evening')], maxCo2: 5 })[0]).toMatch(/raise it to 6/)
    expect(E.check({ ...STILL_EVE, plots: 9 }, st(0, 0, 2)).ok).toBe(false)
  })
})

suite('prompts', () => {
  it('catches prompts that give the answer away', () => {
    for (const t of [
      'Build two coal stations. Tap the + buttons.', 'Use solar. Tap the + buttons.', 'Use the wind. Tap the + buttons.', 'Try 3 turbines with the + buttons.', 'Add a coal station with the + buttons.',
      "Wind won't work at night: use the + buttons.", 'Solar is useless in the evening. Use the + buttons.', 'The wind stops. Use the + buttons.', 'Solar makes nothing after dark. Use the + buttons.',
      'You will need a backup. Use the + buttons.', 'Coal is reliable. Use the + buttons.', 'There is no sun at night. Use the + buttons.', 'The sun has set. Use the + buttons.',
    ]) expect(E.promptFaults!(STILL_EVE, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(STILL_EVE, 'A sunny, windy, cloudy, dark, still evening. Tap the + buttons to light every home.')).toEqual([])
  })

  it('asks for the + buttons, and for the tap on each time when there are several', () => {
    expect(E.promptFaults!(STILL_EVE, 'Light every home in a dark evening.').join(' ')).toMatch(/\+ buttons/)
    expect(E.promptFaults!(SUN_THEN_DARK, 'Light every home at noon and in the evening with the + buttons.').join(' ')).toMatch(/tap each time/)
    expect(E.promptFaults!(SUN_THEN_DARK, 'Use the + buttons, then tap noon and evening.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('energy-resources')!
    expect(e).toBe(E)
    expect(EXAMPLES).toHaveLength(4)
    for (const { prompt, config } of EXAMPLES) {
      expect(e.prompt).toContain(JSON.stringify(config))
      expect(e.prompt).toContain(prompt)
      const parsed = e.parse(JSON.parse(JSON.stringify(config)))!
      expect(parsed).toEqual(config)
      expect(e.faults(parsed), prompt).toEqual([])
      expect(e.promptFaults!(parsed, prompt), prompt).toEqual([])
      expect(e.check(parsed, e.initial(parsed)).ok).toBe(false)
      expect(e.check(parsed, e.solve(parsed)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((x) => x[1])).toEqual(['consequence'])
    expect(e.isolates).toBe('consequence')
  })
})

suite('the words on the card', () => {
  it('says what is happening as an observation, never right or wrong', () => {
    expect(goalText(STILL_EVE)).toBe('Light every home in the evening')
    expect(goalText(SUNNY_NOON)).toBe('Light every home at noon, with no CO2')
    expect(goalText(WINDY_DAY)).toBe('Light every home at noon, in the evening and at night, with no more than 6 units of CO2')
    expect(co2Label(momentsOf(STILL_EVE))).toBe('CO2 this evening')
    expect(co2Label(momentsOf(SUNNY_NOON))).toBe('CO2 at noon')
    expect(co2Label(momentsOf(WINDY_DAY))).toBe('CO2 today')

    expect(captionText(STILL_EVE, st(0, 0, 0))).toBe("Evening, after sunset, still and clear. Nothing is built yet, so the town has no power. Each station makes up to 3 homes' worth.")
    expect(captionText(STILL_EVE, st(0, 1, 1))).toBe('Evening, after sunset, still and clear. Panels dark, coal burning for 3 homes. 3 of 6 homes have power.')
    expect(captionText(STILL_EVE, st(0, 0, 2))).toBe('Evening, after sunset, still and clear. Coal burning for 6 homes.')
    expect(captionText(SUN_THEN_DARK, st(0, 2, 2, 0))).toBe('Noon, still and clear. Panels in full sun, coal idle.'.replace('coal idle', 'coal stations idle'))
    expect(captionText(WINDY_DAY, st(2, 1, 0, 0))).toBe('Noon, windy and cloudy. Turbines turning, panels under cloud.')
    expect(captionText(WINDY_DAY, st(2, 0, 2, 2))).toBe('Night, still and clear. Rotors still, coal burning for 6 homes.')
    expect(captionText(WINDY_DAY, st(1, 0, 0, 2))).toMatch(/Rotor still\. 0 of 6 homes have power\./)
  })

  it('gives the four verdicts from the design', () => {
    expect(verdictText(STILL_EVE, st(0, 0, 0))).toBe('There were no power stations, so no home had power.')
    expect(verdictText(SUN_THEN_DARK, st(0, 2, 2))).toBe('Every home stayed lit at noon and in the evening. Coal made 6 units of CO2, within the limit of 6.')
    expect(verdictText(STILL_EVE, st(0, 0, 2))).toBe('Every home stayed lit in the evening. Coal made 6 units of CO2.')
    expect(verdictText(SUN_THEN_DARK, st(0, 2, 0))).toBe('Homes went dark in the evening: only 0 of 6 had power.')
    expect(verdictText(WINDY_DAY, st(2, 0, 0))).toBe('Homes went dark at night: only 0 of 6 had power.')
    expect(verdictText(WINDY_DAY, st(2, 0, 1))).toBe('Homes went dark at night: only 3 of 6 had power.')
    expect(verdictText(SUN_THEN_DARK, st(0, 0, 2))).toBe('All homes were lit, but coal made 12 units of CO2 against a limit of 6.')
    expect(verdictText({ ...SUN_THEN_DARK, plots: 9 }, st(0, 2, 2))).toBe('')
    expect(jumpTo(WINDY_DAY, st(2, 0, 1))).toBe(2)
    expect(jumpTo(SUN_THEN_DARK, st(0, 2, 2))).toBeNull()
  })
})

suite('catalogue matching', () => {
  it('is offered for energy resources, and not for its neighbours', () => {
    for (const station of ['Energy resources', 'Renewable and non-renewable energy', 'Generating electricity', 'Power stations', 'Wind power and solar power', 'Fossil fuels', 'Renewables and nonrenewables', 'Sources of energy']) {
      expect(scenesFor(station).map((x) => x.id), station).toContain('energy-resources')
      expect(sceneCatalogue(station), station).toContain('SCENE "energy-resources"')
    }
    for (const station of ['Energy stores and transfers', 'Efficiency of energy transfers', 'The national grid and transformers', 'The greenhouse effect', 'Climate change', 'Fossil evidence and the fossil record', 'The solar system', 'Nuclear fission', 'Cost of electricity']) {
      expect(scenesFor(station).map((x) => x.id), station).not.toContain('energy-resources')
    }
  })
})

suite('the card', () => {
  it('renders every task with no answer before marking, on the server', () => {
    for (const config of allConfigs().filter((_, i) => i % 23 === 0)) {
      const html = render(config, E.initial(config))
      expect(html).toContain('Goal')
      expect(html).toContain(goalText(config))
      expect(html).toContain('Homes lit')
      expect(html).toContain('Places left')
      expect(html).not.toMatch(/data-done/)
      expect(html).not.toMatch(/stayed lit|went dark|There were no power stations|against a limit|within the limit/)
      expect(html.match(/aria-pressed/g)?.length ?? 0).toBe(config.moments.length > 1 ? config.moments.length : 0)
      for (const l of ['Build a wind turbine', 'Take down a wind turbine', 'Build a row of solar panels', 'Remove a row of solar panels', 'Build a coal power station', 'Close a coal power station']) expect(html).toContain(`aria-label="${l}"`)
    }
  })

  it('does not tell the answer in the screen-reader text, even with a full build, before marking', () => {
    for (const config of allConfigs().filter((_, i) => i % 17 === 0)) {
      for (const state of [E.initial(config), E.solve(config), st(1, 1, 1, 0)]) {
        const words = render(config, state).replace(/ class="[^"]*"/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')
        expect(words).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved|well done)\b/i)
        expect(words).not.toMatch(/stayed lit|went dark|There were no power stations|against a limit|within the limit/)
      }
    }
  })

  it('disables a minus at zero and every plus when the places run out or at three', () => {
    const none = render(STILL_EVE, st(0, 0, 0))
    expect((none.match(/disabled=""/g) ?? []).length).toBe(3)
    const full = render(STILL_EVE, st(2, 1, 1))
    // 4 of 4 places used: all three plus buttons disabled.
    expect((full.match(/disabled=""/g) ?? []).length).toBe(3)
    expect(full).toContain('0 of 4')
    const three = render({ ...STILL_EVE, plots: 6 }, st(3, 0, 0))
    expect(three).toMatch(/aria-label="Build a wind turbine" disabled=""/)
    expect(three).not.toMatch(/aria-label="Build a coal power station" disabled=""/)
  })

  it('shows the time buttons only for two or three moments, with the weather in their names', () => {
    expect(render(STILL_EVE, E.initial(STILL_EVE))).not.toContain('Time of day')
    const html = render(WINDY_DAY, E.initial(WINDY_DAY))
    expect(html).toContain('aria-label="Show the evening: dark, windy"'.replace('dark, windy', 'dark and windy'))
    expect(html).toContain('aria-label="Show the noon: cloudy and windy"')
    expect(html).toContain('aria-label="Show the night: dark and still"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Noon/)
    expect(render(WINDY_DAY, st(2, 0, 2, 2))).toMatch(/aria-pressed="true"[^>]*>Night/)
  })

  it('shows the verdict once marked, locks the builds, and opens a failed card on the first dark time', () => {
    const right = render(SUN_THEN_DARK, E.solve(SUN_THEN_DARK), 'right')
    expect(right).toContain('Every home stayed lit at noon and in the evening')
    expect(right).toContain('data-done="1"')
    expect(right).toMatch(/aria-label="Build a coal power station" disabled=""/)
    const dark = render(WINDY_DAY, st(2, 0, 1, 0), 'wrong')
    expect(dark).toContain('Homes went dark at night: only 3 of 6 had power.')
    expect(dark).toContain('data-done="0"')
    expect(dark).toMatch(/aria-pressed="true"[^>]*>Night/)
    const over = render(SUN_THEN_DARK, st(0, 0, 2), 'wrong')
    expect(over).toContain('coal made 12 units of CO2 against a limit of 6')
    const shown = render(WINDY_DAY, E.initial(WINDY_DAY), 'shown')
    expect(shown).toContain('within the limit of 6')
    expect(shown).toContain('data-done="1"')
  })

  it('still renders with reduced motion and with an unreadable config', () => {
    expect(render(WINDY_DAY, st(2, 0, 2, 2), 'idle', true)).toContain('coal burning for 6 homes')
    expect(render({ ...STILL_EVE, plots: 1 }, E.initial(STILL_EVE))).toBe('')
    expect(render({ ...STILL_EVE, moments: [] }, E.initial(STILL_EVE))).toBe('')
  })

  it('renders inside the activity node', () => {
    const html = renderToStaticMarkup(
      createElement(ReactFlowProvider, null, createElement(ActivityNode, {
        id: 'n', type: 'activity', selected: false, dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0,
        data: { spec: { pattern: 'scene', prompt: EXAMPLES[2].prompt, payload: { engine: 'energy-resources', config: SUN_THEN_DARK }, success: { kind: 'scene' } }, work: E.initial(SUN_THEN_DARK), status: 'open' },
      } as never)),
    )
    expect(html).toContain('Build a coal power station')
  })
})
