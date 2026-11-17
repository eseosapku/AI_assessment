// lib/studylab/engines/electrolysis/electrolysis.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import {
  CELLS, ELECTROLYTE_NAMES, PRODUCT_NAMES, electrolysisEngine, cellOf, circuitOf, requiredCircuit, validConfig,
  type ElectrolysisConfig, type ElectrolysisState, type Product,
} from './config'
import { ElectrolysisView, SNAP_RADIUS } from './View'

vi.spyOn(console, 'error').mockImplementation(() => {})
const view = (config: ElectrolysisConfig, state: ElectrolysisState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
  renderToStaticMarkup(createElement(ElectrolysisView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
const products: ElectrolysisConfig = { task: 'products', electrolyte: 'brine', electrodes: 'carbon', product: 'hydrogen', side: 'left' }
const purify: ElectrolysisConfig = { task: 'purify', side: 'left' }

describe('the chemistry and the complete circuit', () => {
  it('has the IGCSE products and exact half-equations', () => {
    expect(CELLS['lead-bromide'].cathode.equation).toBe('Pb²⁺ + 2e⁻ → Pb')
    expect(CELLS['lead-bromide'].anode.equation).toBe('2Br⁻ → Br₂ + 2e⁻')
    expect(CELLS.brine.cathode.product).toBe('hydrogen')
    expect(CELLS.brine.anode.product).toBe('chlorine')
    expect(CELLS['dilute-brine'].anode.product).toBe('oxygen')
    expect(CELLS['sulfuric-acid'].cathode.product).toBe('hydrogen')
    expect(CELLS['sulfuric-acid'].anode.product).toBe('oxygen')
    expect(CELLS['copper-carbon'].anode.product).toBe('oxygen')
    expect(CELLS['copper-copper'].anode.kind).toBe('dissolve')
    expect(CELLS['copper-copper'].anode.equation).toBe('Cu → Cu²⁺ + 2e⁻')
    expect(CELLS.cryolite.cathode.equation).toBe('Al³⁺ + 3e⁻ → Al')
  })

  it('needs one lead on each electrode, never both on one', () => {
    expect(circuitOf({ red: null, black: null })).toBeNull()
    expect(circuitOf({ red: 'left', black: null })).toBeNull()
    expect(circuitOf({ red: 'left', black: 'left' })).toBeNull()
    expect(circuitOf({ red: 'left', black: 'right' })).toEqual({ positive: 'left', negative: 'right' })
    expect(circuitOf({ red: 'bad', black: 'right' } as unknown as ElectrolysisState)).toBeNull()
  })

  it('reversing the leads reverses the electrode that receives the product', () => {
    expect(requiredCircuit(products)).toEqual({ positive: 'right', negative: 'left' })
    expect(requiredCircuit({ ...products, product: 'chlorine' })).toEqual({ positive: 'left', negative: 'right' })
    expect(requiredCircuit({ ...products, side: 'right' })).toEqual({ positive: 'left', negative: 'right' })
    expect(requiredCircuit(purify)).toEqual({ positive: 'right', negative: 'left' })
  })
})

describe('reading the tutor’s config broadly and refusing narrowly', () => {
  it('reads common chemical names, formulae and nested tasks', () => {
    expect(electrolysisEngine.parse({ task: 'electrolysis', electrolyte: 'concentrated aqueous sodium chloride', product: 'Cl2', electrodes: 'inert', side: 'right' }))
      .toEqual({ task: 'products', electrolyte: 'brine', electrodes: 'carbon', product: 'chlorine', side: 'right' })
    expect(electrolysisEngine.parse({ task: { kind: 'products', compound: 'molten lead(II) bromide', target: 'Pb', side: 'left' } }))
      .toEqual({ task: 'products', electrolyte: 'lead-bromide', electrodes: 'carbon', product: 'lead', side: 'left' })
    expect(electrolysisEngine.parse({ task: 'electrolysis', electrolyte: 'CuSO4', electrodes: 'copper', product: 'copper' }))
      .toEqual({ task: 'products', electrolyte: 'copper-carbon', electrodes: 'copper', product: 'copper', side: 'left' })
    expect(electrolysisEngine.parse({ task: 'electroplating', electrolyte: 'copper sulphate', product: 'Cu' })).not.toBeNull()
    expect(electrolysisEngine.parse({ task: 'extraction', electrolyte: 'aluminium oxide in molten cryolite', product: 'Al' })).not.toBeNull()
    expect(electrolysisEngine.parse({ task: 'purification of copper', pureSide: 'right' })).toEqual({ task: 'purify', side: 'right' })
    expect(electrolysisEngine.parse({ task: 'electrolysis', electrolyte: 'dilute sulphuric acid', product: 'O2' })).not.toBeNull()
    expect(electrolysisEngine.parse(null)).toBeNull()
    expect(electrolysisEngine.parse({ task: 'galvanic-cell' })).toBeNull()
  })

  it('keeps unknown values parseable, then gives an actionable fault and a working example', () => {
    const unknown = electrolysisEngine.parse({ task: 'products', electrolyte: 'silver-nitrate', electrodes: 'carbon', product: 'hydrogen', side: 'left' })!
    expect(electrolysisEngine.faults(unknown).join(' ')).toMatch(/not one this cell can draw.*e\.g\. electrolyte "brine"/)
    expect(electrolysisEngine.faults({ ...products, electrolyte: 'sodium chloride' } as ElectrolysisConfig)[0]).toMatch(/electrolyte "brine"/)
    expect(electrolysisEngine.faults({ ...products, product: 'chlorine', side: 'middle' } as ElectrolysisConfig)[0]).toMatch(/use side "left" or "right"/)
    expect(electrolysisEngine.faults({ ...products, electrolyte: 'sulfuric-acid', product: 'copper' }).join(' ')).toMatch(/makes hydrogen and oxygen, not copper/)
    expect(electrolysisEngine.faults({ ...products, electrodes: 'copper' }).join(' ')).toMatch(/only in aqueous copper\(II\) sulfate/)
    expect(electrolysisEngine.faults({ ...products, electrodes: 'zinc' }).join(' ')).toMatch(/use "carbon".*"copper"/)
    expect(electrolysisEngine.faults({ ...products, product: 'silver' }).join(' ')).toMatch(/e\.g\. product "hydrogen"/)
    expect(electrolysisEngine.faults(products)).toEqual([])
    expect(electrolysisEngine.faults(purify)).toEqual([])
  })
})

function everyConfig(): ElectrolysisConfig[] {
  const out: ElectrolysisConfig[] = []
  for (const side of ['left', 'right']) {
    out.push({ task: 'purify', side })
    for (const electrolyte of ELECTROLYTE_NAMES) for (const electrodes of ['carbon', 'copper']) for (const product of PRODUCT_NAMES) {
      out.push({ task: 'products', electrolyte, electrodes, product, side })
    }
  }
  return out
}

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = everyConfig()
  it('enumerates the full product/electrode/side grid and starts unsolved but can always solve', () => {
    expect(all).toHaveLength(2 * (1 + ELECTROLYTE_NAMES.length * 2 * PRODUCT_NAMES.length))
    let valid = 0
    for (const config of all) {
      if (electrolysisEngine.faults(config).length) continue
      valid++
      expect(validConfig(config), JSON.stringify(config)).toBe(true)
      expect(electrolysisEngine.check(config, electrolysisEngine.initial(config)).ok).toBe(false)
      expect(electrolysisEngine.check(config, electrolysisEngine.solve(config))).toEqual({ ok: true, wrongIds: [] })
      const solved = electrolysisEngine.solve(config)
      const reversed: ElectrolysisState = { red: solved.black, black: solved.red }
      expect(electrolysisEngine.check(config, reversed).ok).toBe(false)
      expect(view(config, electrolysisEngine.initial(config), 'idle')).toContain('Connect both leads')
      expect(view(config, solved, 'right')).toMatch(/Yes —/)
      expect(view(config, reversed, 'wrong')).toMatch(/You made/)
      expect(view(config, solved, 'idle')).not.toMatch(/Cathode \(/)
    }
    expect(valid).toBe(28)
  })
})

describe('the picture and marking', () => {
  it('has accessible drag/tap plug controls and a generous visible snap target', () => {
    const html = view(products, { red: null, black: null }, 'idle')
    expect(html.match(/<g role="button"/g)).toHaveLength(2)
    expect(html).toContain('Red positive plug')
    expect(html).toContain('Black negative plug')
    expect(SNAP_RADIUS).toBeGreaterThanOrEqual(28)
    const running = view(products, electrolysisEngine.solve(products), 'idle')
    expect(running).toContain('transition:transform')
    expect(running).toContain('Circuit complete')
  })

  it('shows the actual event only once the circuit is complete', () => {
    expect(view(products, { red: null, black: null }, 'idle')).not.toContain('Circuit complete')
    expect(view(products, electrolysisEngine.solve(products), 'idle')).toContain('Circuit complete')
    expect(view({ ...products, electrolyte: 'copper-carbon', product: 'copper' }, electrolysisEngine.solve({ ...products, electrolyte: 'copper-carbon', product: 'copper' }), 'idle')).toContain('#C9794D')
  })

  it('locks the plugs once solved', () => {
    const html = view(products, electrolysisEngine.solve(products), 'right')
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2)
  })

  it('says what a reversed cell made and supplies both electrode equations', () => {
    const wrong = view(products, { red: 'left', black: 'right' }, 'wrong')
    expect(wrong).toContain('You made chlorine at the left electrode and hydrogen at the right electrode.')
    expect(wrong).toContain('Put the red lead on the right and the black lead on the left.')
    expect(wrong).toContain('Cathode (−), right: 2H⁺ + 2e⁻ → H₂')
    expect(wrong).toContain('Anode (+), left: 2Cl⁻ → Cl₂ + 2e⁻')
    const good = view(purify, electrolysisEngine.solve(purify), 'right')
    expect(good).toContain('copper has transferred onto the pure left electrode')
    expect(good).toContain('Cu²⁺ + 2e⁻ → Cu')
  })

  it('does not name products, anode or cathode before marking, even in screen-reader text', () => {
    const card = (config: ElectrolysisConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'electrolysis', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    const running = card(products, 'Make hydrogen at the left electrode.')
      // Remove only the target words printed by the frame; the view itself must not contain them.
      .replace(/Make hydrogen at the left electrode\./g, '')
    expect(running).not.toMatch(/\banode\b|\bcathode\b/i)
    // The initial state has no gas/coating observation and no electrode equations.
    expect(running).not.toMatch(/hydrogen bubbles|chlorine|2H⁺|2Cl⁻/)
    const idleRunning = view(products, electrolysisEngine.solve(products), 'idle')
    expect(idleRunning).not.toMatch(/\banode\b|\bcathode\b/i)
    expect(idleRunning).not.toMatch(/hydrogen|chlorine|2H⁺|2Cl⁻/)
    const marked = view(products, electrolysisEngine.solve(products), 'right')
    expect(marked).toMatch(/hydrogen|chlorine|Cathode|Anode/)
  })
})

describe('the catalogue and the stations it meets', () => {
  it('is registered with the exact scene id and matching intent dimension', () => {
    expect(getEngine('electrolysis')).toBe(electrolysisEngine)
    expect(electrolysisEngine.id).toBe('electrolysis')
    expect(electrolysisEngine.isolates).toBe('consequence')
    expect(electrolysisEngine.prompt).toContain('SCENE "electrolysis"')
    expect(electrolysisEngine.prompt).toContain('"engine":"electrolysis"')
    expect(electrolysisEngine.prompt).toContain('"apparatus":"scene:electrolysis"')
    expect(electrolysisEngine.prompt).toContain('"isolates":"consequence"')
  })

  it('matches electrolysis stations but not its neighbours or unrelated electrolytes', () => {
    expect(scenesFor('Electrolysis of aqueous solutions').map((e) => e.id)).toContain('electrolysis')
    expect(scenesFor('Electroplating jewellery').map((e) => e.id)).toContain('electrolysis')
    expect(scenesFor('Extraction of aluminium from cryolite').map((e) => e.id)).toContain('electrolysis')
    expect(scenesFor('Purifying copper by electrolysis').map((e) => e.id)).toContain('electrolysis')
    expect(scenesFor('Electrolytes in the body and sports drinks').map((e) => e.id)).not.toContain('electrolysis')
    expect(scenesFor('Electric circuits and current').map((e) => e.id)).not.toContain('electrolysis')
    expect(scenesFor('Batteries and fuel cells').map((e) => e.id)).not.toContain('electrolysis')
    expect(scenesFor('Ionic bonding and electron configuration').map((e) => e.id)).not.toContain('electrolysis')
    expect(scenesFor('Electrolysis hair removal').map((e) => e.id)).not.toContain('electrolysis')
    expect(sceneCatalogue('Electrolytes in sports drinks')).not.toContain('SCENE "electrolysis"')
  })
})

describe('prompt faults', () => {
  const faults = (config: ElectrolysisConfig, prompt: string) => electrolysisEngine.promptFaults!(config, prompt)
  it('refuses a prompt that gives the electrode identity or lead placement', () => {
    expect(faults(products, 'Connect the black lead to the left cathode.').join(' ')).toMatch(/gives the wiring/)
    expect(faults(products, 'The right electrode is the anode.').join(' ')).toMatch(/gives the wiring/)
    expect(faults(products, 'Write 2H+ + 2e- -> H2 after connecting.').join(' ')).toMatch(/gives the wiring/)
  })
  it('refuses promises the apparatus cannot keep', () => {
    expect(faults(products, 'Drag the ions, test the gas and change the voltage.').join(' ')).toMatch(/promises/)
  })
  it('accepts the product and side with the actual gesture', () => {
    expect(faults(products, 'Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Make hydrogen at the left electrode.')).toEqual([])
    expect(faults(purify, 'Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Purify the copper by coating the pure electrode on the left.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('electrolysis')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]+\})/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })
})
