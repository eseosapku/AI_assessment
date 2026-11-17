// lib/studylab/engines/cpu-cycle/cpu-cycle.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  cpuCycleEngine, framesOf, frameAt, initialMachine, transfersOf, expectedPart, instructionText,
  ADD_RAM, STORE_RAM, W as CONFIG_W, H as CONFIG_H,
  type CpuConfig, type CpuState, type PartId,
} from './config'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const add = cpuCycleEngine.parse({ task: 'cycle', program: 'add' })!
const store = cpuCycleEngine.parse({ task: 'fetch-decode-execute', program: 'store' })!
const programs = [add, store]

function play(config: CpuConfig, count: number): CpuState {
  const state: CpuState = { taps: [] }
  for (let i = 0; i < count; i++) {
    const next = expectedPart(config, state)
    if (!next) break
    state.taps!.push(next)
  }
  return state
}

describe('the processor model', () => {
  it('keeps instructions and data together in RAM', () => {
    expect(ADD_RAM).toEqual([104, 0, 0, 0, 4])
    expect(STORE_RAM).toEqual([304, 0, 0, 0, 0])
    expect(instructionText(105)).toBe('ADD 5')
    expect(instructionText(304)).toBe('STORE 4')
    expect(instructionText(0)).toBe('HLT')
  })

  it('starts each instruction with PC -> MAR, and increments PC on that transfer', () => {
    for (const config of programs) {
      const first = transfersOf(config, initialMachine(config))[0]
      expect(first).toMatchObject({ from: 'PC', to: 'MAR', token: 'address', phase: 'Fetch' })
      const f = framesOf(config)
      expect(f[1].machine).toMatchObject({ pc: 1, mar: 0 })
      expect(f[2].machine.pc).toBe(1)
    }
  })

  it('uses the address, control and data buses in the right order', () => {
    const first = framesOf(add).slice(0, 7).map((f) => f.transfer ? `${f.transfer.from}-${f.transfer.to}:${f.transfer.token}` : 'start')
    expect(first).toEqual([
      'start', 'PC-MAR:address', 'MAR-RAM:address', 'CU-RAM:control', 'RAM-MDR:instruction', 'MDR-CIR:instruction', 'CIR-CU:instruction',
    ])
  })

  it('executes ADD with a second RAM read and an ALU result into ACC', () => {
    const f = framesOf(add)
    const result = f.find((x) => x.transfer?.from === 'ALU' && x.transfer.to === 'ACC')!
    expect(result.machine.acc).toBe(11)
    expect(result.phase).toBe('Execute')
    expect(f[f.length - 1].halted).toBe(true)
    expect(f[f.length - 1].machine.pc).toBe(2)
  })

  it('executes STORE through MAR and MDR into the shared RAM', () => {
    const f = framesOf(store)
    const stored = f.find((x) => x.transfer?.from === 'MDR' && x.transfer.to === 'RAM')!
    expect(stored.machine.ram[4]).toBe(12)
    expect(stored.machine.mar).toBe(4)
    expect(f[f.length - 1].halted).toBe(true)
  })

  it('lets a wrong tap be said back without moving the machine or trapping the learner', () => {
    const state: CpuState = { taps: ['RAM', 'PC'] }
    const f = frameAt(add, state)
    expect(f.accepted).toBe(1)
    expect(f.wrong).toBe('RAM')
    expect(f.frame.machine).toMatchObject({ pc: 1, mar: 0 })
    expect(cpuCycleEngine.check(add, state).ok).toBe(false)
  })
})

describe('reading the semantic config', () => {
  it('reads broad phrasings, and only rejects what is not this scene', () => {
    expect(cpuCycleEngine.parse({ task: 'FDE', program: 'addition' })).toEqual(add)
    expect(cpuCycleEngine.parse({ task: { kind: 'von-neumann', operation: 'write memory' } })).toEqual(store)
    expect(cpuCycleEngine.parse({ program: 'ALU' })).toEqual(add)
    expect(cpuCycleEngine.parse({ task: 'cycle', program: 'jump' })).toEqual({ task: 'cycle', program: 'jump' })
    expect(cpuCycleEngine.parse({ task: 'performance', program: 'add' })).toBeNull()
    expect(cpuCycleEngine.parse(null)).toBeNull()
    expect(cpuCycleEngine.parse({ task: 'cycle', program: '' })).toBeNull()
  })

  it('refuses an unknown program narrowly, with a nearby working example', () => {
    const c = cpuCycleEngine.parse({ task: 'cycle', program: 'subtract' })!
    expect(cpuCycleEngine.faults(c)).toHaveLength(1)
    expect(cpuCycleEngine.faults(c)[0]).toMatch(/program "add"/)
    expect(cpuCycleEngine.faults(add)).toEqual([])
    expect(cpuCycleEngine.faults(store)).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it.each(programs)('starts unsolved and solves $program', (config) => {
    expect(cpuCycleEngine.check(config, cpuCycleEngine.initial(config)).ok).toBe(false)
    const solved = cpuCycleEngine.solve(config)
    expect(cpuCycleEngine.check(config, solved)).toEqual({ ok: true, wrongIds: [] })
    expect(frameAt(config, solved).frame.halted).toBe(true)
  })

  it.each(programs)('every prefix is drawable, unsolved until the end, and its next tap advances $program', (config) => {
    const all = cpuCycleEngine.solve(config).taps!.length
    for (let n = 0; n <= all; n++) {
      const state = play(config, n)
      expect(cpuCycleEngine.check(config, state).ok).toBe(n === all)
      const before = frameAt(config, state).accepted
      const next = expectedPart(config, state)
      if (next) expect(frameAt(config, { taps: [...state.taps!, next] }).accepted).toBe(before + 1)
    }
  })

  it.each(programs)('malformed or partial stored work never passes $program', (config) => {
    for (const state of [{}, { taps: null }, { taps: ['BAD'] }, { taps: [1, 2] }, { taps: ['PC', 'PC'] }, { taps: [] }] as unknown as CpuState[]) {
      expect(cpuCycleEngine.check(config, state).ok).toBe(false)
    }
  })
})

describe('catalogue and prompt', () => {
  it('is registered as cpu-cycle, with the same id, dimensions and examples', () => {
    expect(getEngine('cpu-cycle')).toBe(cpuCycleEngine)
    expect(cpuCycleEngine.isolates).toBe('order')
    expect(cpuCycleEngine.prompt).toMatch(/SCENE "cpu-cycle"/)
    expect(cpuCycleEngine.prompt).toMatch(/"engine":"cpu-cycle"/)
    expect(cpuCycleEngine.prompt).toMatch(/"apparatus":"scene:cpu-cycle"/)
    expect(cpuCycleEngine.prompt).toMatch(/"isolates":"order"/)
    expect(CONFIG_W).toBe(360)
    expect(CONFIG_H).toBe(306)
  })

  it('catches processor stations but not its neighbours', () => {
    expect(scenesFor('The fetch-decode-execute cycle and CPU registers').map((e) => e.id)).toContain('cpu-cycle')
    expect(scenesFor('Von Neumann architecture and the stored program').map((e) => e.id)).toContain('cpu-cycle')
    expect(sceneCatalogue('Factors affecting CPU performance: clock speed, cache and cores')).not.toContain('SCENE "cpu-cycle"')
    expect(sceneCatalogue('Binary and hexadecimal data representation')).not.toContain('SCENE "cpu-cycle"')
    expect(sceneCatalogue('Trace tables for a linear search algorithm')).not.toContain('SCENE "cpu-cycle"')
  })

  it('catches prompts that name the next sender or the result', () => {
    expect(cpuCycleEngine.promptFaults!(add, 'First tap PC, then tap MAR.').join(' ')).toMatch(/gives the transfer order/)
    expect(cpuCycleEngine.promptFaults!(add, 'Run ADD until ACC is 11.').join(' ')).toMatch(/gives the transfer order/)
    expect(cpuCycleEngine.promptFaults!(store, 'Copy ACC to MDR and store 12 in RAM address 4.').join(' ')).toMatch(/gives the transfer order/)
    expect(cpuCycleEngine.promptFaults!(add, 'Set the clock speed to 4 GHz.').join(' ')).toMatch(/does not show/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('cpu-cycle')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]+\})/g)]
    expect(found).toHaveLength(2)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
  })
})

describe('the card on the board', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'cpu-cycle', config }, success: { kind: 'scene' } } },
  } as never)))

  it('has real buttons for every register, unit and RAM cell', () => {
    const html = card(add, 'Operate the ADD program until it stops.')
    expect(html).toMatch(/aria-label="Send from program counter/)
    expect(html.match(/data-part="RAM"/g)).toHaveLength(5)
    for (const p of ['PC', 'MAR', 'MDR', 'CIR', 'ACC', 'CU', 'ALU']) expect(html).toContain(`data-part="${p}"`)
    expect(html).toContain('address bus')
    expect(html).toContain('data bus')
    expect(html).toContain('control bus')
  })

  it('leaks no next sender or final answer before marking', () => {
    const html = card(add, 'Operate the ADD program until it stops.').replace('Operate the ADD program until it stops.', '')
    expect(html).not.toMatch(/ACC now holds|result 11|7 \+ 4|Tap PC|PC sends/)
    expect(html).not.toMatch(/Yes\./)
    expect(html).toContain('Ready to fetch')
  })

  it('says what was made after a wrong mark, and the register roles after a right one', () => {
    const wrong = card({ task: 'cycle', program: 'add', taps: [] }, 'Operate ADD.')
    expect(wrong).toBeTruthy()
    // Direct view rendering covers the two marked states without relying on ActivityNode's local state.
    return import('./View').then(({ CpuCycleView }) => {
      const render = (marked: 'right' | 'wrong', state: CpuState) => renderToStaticMarkup(createElement(CpuCycleView, {
        config: add, state, setState: () => {}, marked, reduced: true, locked: marked === 'right',
      }))
      expect(render('right', cpuCycleEngine.solve(add))).toMatch(/giving 11/)
      expect(render('wrong', { taps: [] })).toMatch(/part way through/)
    })
  })
})
