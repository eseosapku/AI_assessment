import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import '..'
import {
  opportunityCostEngine, CHOICES, CROP_OUTPUT, MIX_WORKERS, outputAt, costAt, workersOf,
  type OpportunityConfig,
} from './config'
import { W, CHOICE_H, PPC_H } from './View'

vi.spyOn(console, 'error').mockImplementation(() => {})

describe('the economics', () => {
  it('uses all six workers and a disclosed bowed-out production model', () => {
    expect(CROP_OUTPUT).toEqual([0, 12, 22, 30, 36, 40, 42])
    for (let wheat = 0; wheat <= 6; wheat++) {
      const o = outputAt(wheat)
      expect(o.wheat).toBe(CROP_OUTPUT[wheat])
      expect(o.vegetables).toBe(CROP_OUTPUT[6 - wheat])
    }
    // Each further wheat worker costs more vegetables: increasing opportunity cost.
    expect([1, 2, 3, 4, 5, 6].map((w) => costAt(w).lostVegetables)).toEqual([2, 4, 6, 8, 10, 12])
    expect(costAt(4)).toEqual({ gainedWheat: 6, lostVegetables: 8 })
  })

  it('identifies one second choice, never the sum of alternatives', () => {
    expect(CHOICES.afternoon.next).toBe('study')
    expect(CHOICES.weekend.next).toBe('cinema')
    expect(opportunityCostEngine.solve({ task: 'choice', scenario: 'afternoon' })).toEqual({ picked: 'study' })
  })
})

describe('reading configs', () => {
  it('reads semantic names and aliases broadly', () => {
    const p = opportunityCostEngine.parse
    expect(p({ task: 'next best alternative' })).toEqual({ task: 'choice', scenario: 'afternoon' })
    expect(p({ task: { kind: 'choice', story: 'weekend' } })).toEqual({ task: 'choice', scenario: 'weekend' })
    expect(p({ task: 'scarcity', example: 'part time work' })).toEqual({ task: 'choice', scenario: 'afternoon' })
    expect(p({ task: 'production possibilities curve', mix: 'mostly wheat' })).toEqual({ task: 'ppc', scenario: 'farm', mix: 'more-wheat' })
    expect(p({ task: 'PPF', combination: 'vegetable heavy' })).toEqual({ task: 'ppc', scenario: 'farm', mix: 'more-vegetables' })
    expect(p({ task: 'allocation' })).toEqual({ task: 'ppc', scenario: 'farm', mix: 'balanced' })
    expect(p(null)).toBeNull()
    expect(p({ task: 'supply and demand' })).toBeNull()
    expect(p({})).toBeNull()
  })

  it('refuses only unknown stories or mixes, with a working nearby example', () => {
    const faults = (raw: unknown) => {
      const c = opportunityCostEngine.parse(raw)
      expect(c).not.toBeNull()
      return opportunityCostEngine.faults(c!)
    }
    expect(faults({ task: 'choice', scenario: 'holiday' })[0]).toMatch(/afternoon.*weekend/)
    expect(faults({ task: 'ppc', scenario: 'cars' })[0]).toMatch(/farm.*balanced/)
    expect(faults({ task: 'ppc', mix: 'maximum' })[0]).toMatch(/balanced.*more-wheat.*more-vegetables/)
    for (const raw of [
      { task: 'choice', scenario: 'afternoon' }, { task: 'choice', scenario: 'weekend' },
      ...Object.keys(MIX_WORKERS).map((mix) => ({ task: 'ppc', scenario: 'farm', mix })),
    ]) expect(faults(raw)).toEqual([])
  })
})

const configs: OpportunityConfig[] = [
  ...Object.keys(CHOICES).map((scenario): OpportunityConfig => ({ task: 'choice', scenario })),
  ...Object.keys(MIX_WORKERS).map((mix): OpportunityConfig => ({ task: 'ppc', scenario: 'farm', mix })),
]

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves exactly, and rejects every other reachable state', () => {
    expect(configs).toHaveLength(5)
    for (const config of configs) {
      const initial = opportunityCostEngine.initial(config)
      const solved = opportunityCostEngine.solve(config)
      expect(opportunityCostEngine.check(config, initial).ok, JSON.stringify(config)).toBe(false)
      expect(opportunityCostEngine.check(config, solved)).toEqual({ ok: true, wrongIds: [] })
      if (config.task === 'choice') {
        for (const option of CHOICES[config.scenario].options) {
          expect(opportunityCostEngine.check(config, { picked: option.id }).ok).toBe(option.id === CHOICES[config.scenario].next)
        }
        expect(opportunityCostEngine.check(config, { picked: 'not-an-option' }).ok).toBe(false)
      } else {
        for (let wheat = 0; wheat <= 6; wheat++) {
          expect(opportunityCostEngine.check(config, { wheat }).ok).toBe(wheat === MIX_WORKERS[config.mix])
        }
      }
    }
  })

  it('clamps malformed saved worker state instead of drawing outside the model', () => {
    expect(workersOf({ wheat: 99 })).toBe(6)
    expect(workersOf({ wheat: -2 })).toBe(0)
    expect(workersOf({ wheat: 2.5 })).toBe(0)
    expect(workersOf(undefined)).toBe(0)
  })
})

describe('prompts', () => {
  const faults = (config: OpportunityConfig, prompt: string) => opportunityCostEngine.promptFaults!(config, prompt)

  it('refuses a named second choice or an allocation given in advance', () => {
    expect(faults({ task: 'choice', scenario: 'afternoon' }, 'Drag Study into the tray: it is next best.').join(' ')).toMatch(/gives the opportunity cost away/)
    expect(faults({ task: 'choice', scenario: 'weekend' }, 'The opportunity cost is Cinema.').join(' ')).toMatch(/gives the opportunity cost away/)
    expect(faults({ task: 'ppc', scenario: 'farm', mix: 'balanced' }, 'Move 3 workers to wheat.').join(' ')).toMatch(/gives the worker allocation/)
    expect(faults({ task: 'ppc', scenario: 'farm', mix: 'more-wheat' }, 'The opportunity cost is 8 tonnes of vegetables.').join(' ')).toMatch(/gives the worker allocation or opportunity cost/)
  })

  it('refuses promises the card cannot keep, with the right fix for each task', () => {
    expect(faults({ task: 'choice', scenario: 'afternoon' }, 'Calculate the money cost in pounds.').join(' ')).toMatch(/activity cards/)
    expect(faults({ task: 'ppc', scenario: 'farm', mix: 'balanced' }, 'Drag the curve outwards to show economic growth.').join(' ')).toMatch(/does not shift the curve/)
    expect(faults({ task: 'ppc', scenario: 'farm', mix: 'balanced' }, 'Fill the order: 30 tonnes of wheat and 22 tonnes of vegetables.').join(' ')).toMatch(/30 tonnes of wheat and 30 tonnes of vegetables/)
  })

  it('allows a good prompt for every config kind and mix', () => {
    expect(faults({ task: 'choice', scenario: 'afternoon' }, 'You choose Café shift. Tap the next-best activity you give up, or drag it into the Give up tray.')).toEqual([])
    expect(faults({ task: 'choice', scenario: 'weekend' }, 'You choose Study. Tap the next-best activity you give up, or drag it into the Give up tray.')).toEqual([])
    for (const mix of Object.keys(MIX_WORKERS)) {
      const c: OpportunityConfig = { task: 'ppc', scenario: 'farm', mix }
      const o = outputAt(MIX_WORKERS[mix])
      expect(faults(c, `Tap minus or plus to move workers between the crops. Fill the order: ${o.wheat} tonnes of wheat and ${o.vegetables} tonnes of vegetables.`)).toEqual([])
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('opportunity-cost')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{ "task":"(?:choice|ppc)", "scenario":"[^"]+"(?:, "mix":"[^"]+")? \})/g)]
    expect(found).toHaveLength(4)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('catalogue matching', () => {
  it('catches its stations and leaves neighbouring economics scenes alone', () => {
    for (const station of ['Opportunity cost', 'Scarcity and the basic economic problem', 'Production possibility curves', 'PPC', 'Factors of production']) {
      expect(scenesFor(station).map((e) => e.id)).toContain('opportunity-cost')
    }
    for (const station of ['Supply, demand and price determination', 'Price elasticity of demand', 'International trade and specialisation', 'Business costs and break-even', 'Inflation and the macro economy']) {
      expect(scenesFor(station).map((e) => e.id)).not.toContain('opportunity-cost')
      expect(sceneCatalogue(station)).not.toContain('SCENE "opportunity-cost"')
    }
  })
})

describe('the card rendered through ActivityNode', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'opportunity-cost', config }, success: { kind: 'scene' } } },
  } as never)))

  it('gives no verdict or next-best identification before marking, including screen-reader text', () => {
    const prompt = 'You choose Café shift. Tap the next-best activity you give up, or drag it into the Give up tray.'
    const html = card({ task: 'choice', scenario: 'afternoon' }, prompt).replace(prompt, '')
    expect(html).not.toMatch(/is the opportunity cost|next-best alternative\. The other|You put/)
    expect(html).not.toMatch(/Yes\./)
    expect(html).toContain('Give up tray')
    expect(html.match(/data-choice=/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Give up Study"')
  })

  it('shows live outputs, an exact order and operable worker controls without revealing the sacrifice', () => {
    const prompt = 'Tap minus or plus to move workers between the crops. Fill the order: 30 tonnes of wheat and 30 tonnes of vegetables.'
    const html = card({ task: 'ppc', scenario: 'farm', mix: 'balanced' }, prompt).replace(prompt, '')
    expect(html).toContain('data-wheat-output')
    expect(html).toContain('data-production-point')
    expect(html).toContain('aria-label="Move one worker to wheat"')
    expect(html).toContain('aria-label="Move one worker to vegetables"')
    expect(html).toContain('role="spinbutton"')
    expect(html).not.toMatch(/opportunity cost|last worker|Yes\./)
  })

  it('uses the view dimensions independently declared to avoid the circular import crash', () => {
    expect(W).toBe(360)
    expect(CHOICE_H).toBe(220)
    expect(PPC_H).toBe(270)
  })
})
