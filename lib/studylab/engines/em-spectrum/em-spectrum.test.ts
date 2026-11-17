// lib/studylab/engines/em-spectrum/em-spectrum.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  emSpectrumEngine, REGIONS, REGION_IDS, SPEED_OF_LIGHT, frequencyOf, goodPrompt, madeAt, regionAt, regionById, regionForUse,
  startIndex, targetIndex, targetRegion, type EmConfig,
} from './config'
import { EmSpectrumView, TUNER_TOLERANCE, waveBracket, wavePath } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const regionConfigs = REGION_IDS.map((region) => ({ task: 'region', region }) as EmConfig)
const useConfigs = REGIONS.map((r) => ({ task: 'use', use: r.use }) as EmConfig)
const everyConfig = () => [...regionConfigs, ...useConfigs]

describe('the electromagnetic facts', () => {
  it('keeps the syllabus order and makes frequency x wavelength the vacuum speed', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['radio', 'microwave', 'infrared', 'visible', 'ultraviolet', 'xray', 'gamma'])
    for (let i = 0; i < REGIONS.length; i++) {
      expect(frequencyOf(REGIONS[i]) * REGIONS[i].wavelength).toBeCloseTo(SPEED_OF_LIGHT, 6)
      if (i) {
        expect(REGIONS[i].wavelength).toBeLessThan(REGIONS[i - 1].wavelength)
        expect(frequencyOf(REGIONS[i])).toBeGreaterThan(frequencyOf(REGIONS[i - 1]))
      }
    }
    expect(REGIONS[1].wavelength).toBe(0.12) // a real 2.45 GHz oven
    expect(REGIONS[2].wavelength).toBe(9.4e-7) // NASA's TV remote example
    expect(REGIONS[4].wavelength).toBe(3.65e-7) // near-UV security marking
    expect(REGIONS.every((r) => r.hazard.length > 10 && r.otherUses.length > 3)).toBe(true)
  })

  it('draws the bracket between real neighbouring crests', () => {
    for (let at = 0; at < 7; at++) {
      const b = waveBracket(at)
      expect(b.gap).toBeGreaterThan(20)
      expect(b.x).toBeGreaterThanOrEqual(52)
      expect(b.x + b.gap).toBeLessThanOrEqual(308)
      expect(b.labelX).toBeGreaterThanOrEqual(90)
      expect(b.labelX).toBeLessThanOrEqual(300)
    }
    expect(wavePath(0)).not.toBe(wavePath(6))
    expect(TUNER_TOLERANCE).toBe(0)
  })
})

describe('reading the tutor config', () => {
  it('reads broad region spellings and task forms', () => {
    expect(emSpectrumEngine.parse({ task: 'region', region: 'UV' })).toEqual({ task: 'region', region: 'ultraviolet' })
    expect(emSpectrumEngine.parse({ task: 'find', region: 'X-rays' })).toEqual({ task: 'region', region: 'xray' })
    expect(emSpectrumEngine.parse({ task: { kind: 'region', region: 'radio waves' } })).toEqual({ task: 'region', region: 'radio' })
    expect(emSpectrumEngine.parse({ task: 'use', use: 'TV remote' })).toEqual({ task: 'use', use: 'remote-control' })
    expect(emSpectrumEngine.parse({ task: 'application', application: 'banknotes' })).toEqual({ task: 'use', use: 'security-marking' })
    expect(emSpectrumEngine.parse({ use: 'medical-imaging' })).toEqual({ task: 'use', use: 'medical-imaging' })
    expect(emSpectrumEngine.parse({ region: 'gamma rays' })).toEqual({ task: 'region', region: 'gamma' })
    expect(emSpectrumEngine.parse(null)).toBeNull()
    expect(emSpectrumEngine.parse({ task: 'unknown', region: 'radio' })).toBeNull()
  })

  it('refuses narrowly, with the application that is actually drawn', () => {
    for (const c of everyConfig()) expect(emSpectrumEngine.faults(c)).toEqual([])
    expect(emSpectrumEngine.faults({ task: 'region', region: 'sound' })[0]).toMatch(/seven-stop tuner.*infrared/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'satellite' })[0]).toMatch(/cooking/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'thermal imaging' })[0]).toMatch(/remote-control/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'optical fibres' })[0]).toMatch(/photography/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'sterilising water' })[0]).toMatch(/security-marking/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'airport scanners' })[0]).toMatch(/medical-imaging/)
    expect(emSpectrumEngine.faults({ task: 'use', use: 'cancer treatment' })[0]).toMatch(/sterilising-equipment/)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves exactly at its region, and tolerates malformed stored work', () => {
    for (const config of everyConfig()) {
      expect(emSpectrumEngine.faults(config)).toEqual([])
      const initial = emSpectrumEngine.initial(config)
      const solved = emSpectrumEngine.solve(config)
      expect(emSpectrumEngine.check(config, initial).ok, JSON.stringify(config)).toBe(false)
      expect(emSpectrumEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(startIndex(config)).not.toBe(targetIndex(config))
      for (let at = 0; at < 7; at++) expect(emSpectrumEngine.check(config, { at }).ok).toBe(at === targetIndex(config))
      expect(emSpectrumEngine.check(config, {} as never).ok).toBe(false)
      expect(emSpectrumEngine.check(config, { at: NaN }).ok).toBe(false)
      expect(emSpectrumEngine.check(config, { at: 99 }).ok).toBe(false)
      expect(madeAt({ at: 2.6 })).toBe(3)
      expect(regionAt(99)).toBe(REGIONS[6])
      expect(regionById(targetRegion(config).id)).toBe(targetRegion(config))
      if (config.task === 'use') expect(regionForUse(config.use)).toBe(targetRegion(config))
    }
  })
})

describe('the card before and after marking', () => {
  const view = (config: EmConfig, at: number, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
    renderToStaticMarkup(createElement(EmSpectrumView, { config, state: { at }, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
  const card = (config: EmConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'em-spectrum', config }, success: { kind: 'scene' } } },
  } as never)))

  it('names only the requested region, never the answer order or the formula before marking', () => {
    for (const config of everyConfig()) {
      const html = view(config, emSpectrumEngine.initial(config).at)
      for (const r of REGIONS) {
        if (config.task === 'region' && r.id === config.region) continue
        expect(html, `${JSON.stringify(config)} leaked ${r.name}`).not.toContain(r.name)
      }
      expect(html).not.toMatch(/frequency × wavelength|frequency x wavelength|speed = frequency|c = f/)
      expect(html).toMatch(/role="slider"/)
      expect(html).toMatch(/aria-valuemin="1"/)
      expect(html).toMatch(/aria-valuemax="7"/)
      expect(html).toMatch(/Your goal/)
      expect(html).toMatch(/Speed in vacuum/)
      expect(html).not.toMatch(/Yes —|You tuned to/)
    }
  })

  it('shows the target receiver but its use event only at the matching region', () => {
    const config: EmConfig = { task: 'use', use: 'medical-imaging' }
    const wrong = view(config, 0)
    const right = view(config, 5)
    expect(wrong).toMatch(/X-ray screen/)
    expect(wrong).toMatch(/No response/)
    expect(right).toMatch(/X-ray screen/)
    expect(right).toMatch(/#315266/)
    expect(wrong).not.toMatch(/#315266/)
    expect(right).toMatch(/#315266/)
  })

  it('changes the wave and receiver after one stop without saying right or wrong', () => {
    const a = view({ task: 'region', region: 'visible' }, 0)
    const b = view({ task: 'region', region: 'visible' }, 1)
    expect(a).not.toBe(b)
    expect(a).not.toMatch(/\bcorrect\b|\bincorrect\b|Yes —|You tuned to/i)
    expect(b).not.toMatch(/\bcorrect\b|\bincorrect\b|Yes —|You tuned to/i)
  })

  it('says what was made, then the exact representative measurements and hazard', () => {
    const config: EmConfig = { task: 'use', use: 'security-marking' }
    expect(view(config, 0, 'wrong')).toMatch(/You tuned to radio waves/)
    const right = view(config, 4, 'right')
    expect(right).toMatch(/Yes — ultraviolet/)
    expect(right).toMatch(/365 nm/)
    expect(right).toMatch(/c = fλ = 3.0 × 10⁸ m\/s/)
    expect(right).toMatch(/skin and eyes/)
  })

  it('has no answer text in a server-rendered activity node', () => {
    const prompt = 'Drag the tuner, or use its + and − buttons, to make the bones appear on the X-ray screen.'
    const html = card({ task: 'use', use: 'medical-imaging' }, prompt).replace(prompt, '')
    expect(html).not.toMatch(/You tuned to|Yes —|frequency × wavelength/)
    for (const r of REGIONS) expect(html).not.toContain(r.name)
    expect(html).toMatch(/X-ray screen/)
  })

  it('keeps a still, state-dependent frame under reduced motion', () => {
    const config: EmConfig = { task: 'region', region: 'radio' }
    const a = view(config, 1)
    const b = view(config, 2)
    expect(a).not.toContain('animateMotion')
    expect(a).not.toBe(b)
  })
})

describe('prompts and catalogue', () => {
  it('accepts only prompts that say the gesture and withhold the answer', () => {
    for (const config of everyConfig()) expect(emSpectrumEngine.promptFaults!(config, goodPrompt(config))).toEqual([])
    const use: EmConfig = { task: 'use', use: 'security-marking' }
    expect(emSpectrumEngine.promptFaults!(use, 'Drag the tuner to find ultraviolet.').join(' ')).toMatch(/gives the answer away/)
    expect(emSpectrumEngine.promptFaults!(use, 'Drag the tuner to the fifth stop.').join(' ')).toMatch(/gives the answer away/)
    expect(emSpectrumEngine.promptFaults!(use, 'Find higher frequency and shorter wavelength by dragging.').join(' ')).toMatch(/gives the answer away/)
    expect(emSpectrumEngine.promptFaults!(use, 'Make the security mark appear.').join(' ')).toMatch(/gesture/)
    expect(emSpectrumEngine.promptFaults!(use, 'Type the region used.').join(' ')).toMatch(/promises/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('em-spectrum')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(config).not.toBeNull()
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
  })

  it('registers with the matching isolates and scene id', () => {
    expect(getEngine('em-spectrum')).toBe(emSpectrumEngine)
    expect(emSpectrumEngine.isolates).toBe('position')
    expect(emSpectrumEngine.prompt).toMatch(/SCENE "em-spectrum"/)
    expect(emSpectrumEngine.prompt).toMatch(/"apparatus":"scene:em-spectrum"/)
    expect(emSpectrumEngine.prompt).toMatch(/"isolates":"position"/)
  })

  it('catches its stations and leaves the near misses to their own scenes', () => {
    expect(scenesFor('The electromagnetic spectrum').map((e) => e.id)).toContain('em-spectrum')
    expect(scenesFor('Uses of electromagnetic waves').map((e) => e.id)).toContain('em-spectrum')
    expect(scenesFor('Dangers of electromagnetic radiation').map((e) => e.id)).toContain('em-spectrum')
    expect(scenesFor('The order of the spectrum').map((e) => e.id)).toContain('em-spectrum')
    for (const station of ['Sound and ultrasound', 'Refraction and lenses', 'Visible spectrum through a prism', 'Radioactivity and half-life', 'Heat transfer by radiation', 'Colour mixing in Art']) {
      expect(scenesFor(station), station).not.toContain('em-spectrum')
      expect(sceneCatalogue(station), station).not.toContain('SCENE "em-spectrum"')
    }
  })
})
