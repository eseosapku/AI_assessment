// lib/studylab/engines/cell-division/cell-division.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { cellDivisionEngine, CHROMOSOMES, complete, correct, madeText, PAIRS, setSide, sidesOf, working, type DivisionConfig, type DivisionState } from './config'
import { CellDivisionView, H, W } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const configs: DivisionConfig[] = [
  { task: 'mitosis', organism: 'human' }, { task: 'mitosis', organism: 'fruit fly' },
  { task: 'meiosis', organism: 'human' }, { task: 'meiosis', organism: 'fruit fly' },
]
const view = (config: DivisionConfig, state: DivisionState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(CellDivisionView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('chromosome allocation and division', () => {
  it('reads broad task and organism phrasings, and refuses only an unknown task', () => {
    expect(cellDivisionEngine.parse({ task: 'mitosis' })).toEqual({ task: 'mitosis', organism: 'human' })
    expect(cellDivisionEngine.parse({ task: { kind: 'reduction division', species: 'Drosophila' } })).toEqual({ task: 'meiosis', organism: 'fruit fly' })
    expect(cellDivisionEngine.parse({ kind: 'growth and repair' })).toEqual({ task: 'mitosis', organism: 'human' })
    expect(cellDivisionEngine.parse({ task: 'gametes and fertilisation' })).toEqual({ task: 'meiosis', organism: 'human' })
    expect(cellDivisionEngine.parse({ task: 'stem cells' })).toBeNull()
    expect(cellDivisionEngine.parse(null)).toBeNull()
    for (const c of configs) expect(cellDivisionEngine.faults(c)).toEqual([])
  })

  it('keeps every stored allocation safe, and changing a piece undoes a division', () => {
    expect(sidesOf(null)['long-blue']).toBe('none')
    expect(sidesOf({ sides: { 'long-blue': 'somewhere' as never } })['long-blue']).toBe('none')
    const s = setSide({ sides: {}, divided: true }, 'long-blue', 'left')
    expect(s.divided).toBe(false)
    expect(s.sides?.['long-blue']).toBe('left')
  })

  it('mitosis separates sister copies; meiosis separates homologues but keeps lengths represented', () => {
    const m = cellDivisionEngine.solve(configs[0])
    const r = cellDivisionEngine.solve(configs[2])
    const a = sidesOf(m)
    // Mitosis: every copied chromosome lines up on the equator; division then splits each into its sister chromatids.
    for (const id of CHROMOSOMES) expect(a[id]).toBe('equator')
    const b = sidesOf(r)
    for (const p of PAIRS) expect(b[p.a]).not.toBe(b[p.b])
    expect(b['long-blue']).toBe(b['short-blue'])
    expect(complete(configs[0], m)).toBe(false) // the event, not only the sets, is required
    expect(correct(configs[0], m)).toBe(true)
    expect(correct(configs[2], r)).toBe(true)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves, and exhaustively marks all 3^4 allocations in both division states', () => {
    for (const config of configs) {
      expect(cellDivisionEngine.check(config, cellDivisionEngine.initial(config)).ok).toBe(false)
      const answer = cellDivisionEngine.solve(config)
      expect(cellDivisionEngine.check(config, answer).ok).toBe(true)
      for (let n = 0; n < 81; n++) {
        let k = n
        let state: DivisionState = { sides: {}, divided: false }
        for (const id of CHROMOSOMES) {
          state = setSide(state, id, (['none', 'left', 'right'] as const)[k % 3])
          k = Math.floor(k / 3)
        }
        for (const divided of [false, true]) {
          const now = { ...state, divided }
          const expected = cellDivisionEngine.check(config, now).ok
          expect(correct(config, now)).toBe(expected)
          expect(view(config, now, expected ? 'right' : 'wrong')).toContain('svg')
        }
      }
    }
  })
})

describe('feedback names what was made', () => {
  it('describes unmoved pieces, undivided cells, wrong mitotic sets and wrong meiotic pairs', () => {
    expect(madeText(configs[0], cellDivisionEngine.initial(configs[0]))).toMatch(/Not on the equator/)
    const allLeft = { sides: Object.fromEntries(CHROMOSOMES.map((id) => [id, 'left'])) }
    const allEquator = { sides: Object.fromEntries(CHROMOSOMES.map((id) => [id, 'equator'])) }
    expect(madeText(configs[0], allEquator)).toMatch(/has not divided/)
    expect(madeText(configs[0], { ...allLeft, divided: true })).toMatch(/Not on the equator/)
    expect(madeText(configs[2], { sides: { 'long-blue': 'left', 'long-ochre': 'left', 'short-blue': 'right', 'short-ochre': 'right' }, divided: true })).toMatch(/homologous pairs stayed together/)
    // The other independent orientation of the short pair is equally valid.
    expect(correct(configs[2], { sides: { 'long-blue': 'left', 'long-ochre': 'right', 'short-blue': 'right', 'short-ochre': 'left' }, divided: true })).toBe(true)
    const lengthsTogether: DivisionState = { sides: { 'long-blue': 'left', 'long-ochre': 'right', 'short-blue': 'left', 'short-ochre': 'left' }, divided: true }
    expect(madeText(configs[2], lengthsTogether)).toMatch(/short homologous pair stayed together/)
    expect(working(configs[0])).toMatch(/46 chromosomes/)
    expect(working(configs[0])).toMatch(/growth, repair and asexual reproduction/)
    expect(working(configs[2])).toMatch(/Four genetically different haploid gametes/)
    expect(working(configs[2])).toMatch(/Fertilisation.*46/)
    expect(working({ task: 'meiosis', organism: 'fruit fly' })).toMatch(/haploid gametes formed, each with 4 chromosomes/)
  })
})

describe('the picture before and after marking', () => {
  const card = (config: DivisionConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'cell-division', config }, success: { kind: 'scene' } } },
  } as never)))

  it('has four keyboard-operable chromosome handles, direct colour names, and a real division button', () => {
    const html = view(configs[0], cellDivisionEngine.initial(configs[0]))
    expect(html.match(/role="slider"/g)).toHaveLength(4)
    expect(html.match(/data-chromosome=/g)).toHaveLength(4)
    expect(html).toContain('aria-label="Divide the cell"')
    expect(html).toContain('Blue homologue')
    expect(html).toContain('Ochre homologue')
    expect(html).toContain('model: two chromosome pairs')
  })

  it('gives no hidden answer counts or correctness before marking, including a server render', () => {
    const prompt = 'Drag every copied chromosome left or right. Give both daughter cells the same set, then press “Divide the cell”.'
    const html = card(configs[0], prompt).replace(prompt, '')
    expect(html).not.toMatch(/46|23 chromosomes|genetically identical|correct allocation|right answer/i)
    expect(html).not.toContain('data-daughters="1"')
    expect(view(configs[2], cellDivisionEngine.initial(configs[2]))).not.toMatch(/haploid|four gametes|23 chromosomes/)
  })

  it('shows the actual event: two cells or four gametes, and the learner can undo a wrong division', () => {
    const m = cellDivisionEngine.solve(configs[0])
    expect(view(configs[0], m)).toContain('data-daughters="1"')
    const r = cellDivisionEngine.solve(configs[2])
    expect(view(configs[2], r)).toContain('data-gametes="1"')
    expect(view(configs[2], r)).toContain('gamete 4')
    expect(view(configs[2], r, 'wrong')).toContain('Undo division')
    // Reduced motion is the same final informative frame, never a blank or a parent-only frame.
    expect(view(configs[2], r, 'idle', true)).toContain('data-gametes="1"')
  })

  it('names the made allocation only after a wrong mark and the rule after a right one', () => {
    const allLeft = { sides: Object.fromEntries(CHROMOSOMES.map((id) => [id, 'left'])), divided: true }
    expect(view(configs[0], allLeft, 'wrong')).toMatch(/Not on the equator/)
    expect(view(configs[0], cellDivisionEngine.solve(configs[0]), 'right')).toMatch(/46 chromosomes/)
    expect(view(configs[2], cellDivisionEngine.solve(configs[2]), 'right')).toMatch(/Fertilisation/)
  })

  it('keeps the plate dimensions and labels within its quiet picture panel', () => {
    expect(W).toBe(360)
    expect(H).toBeLessThanOrEqual(260)
    const html = view(configs[0], cellDivisionEngine.initial(configs[0]))
    for (const label of ['left pole', 'right pole', 'model: two chromosome pairs']) expect(html).toContain(label)
  })
})

describe('catalogue matching and prompt gates', () => {
  it('registers the exact scene id and catches cell-division stations, not neighbours', () => {
    expect(getEngine('cell-division')).toBe(cellDivisionEngine)
    expect(cellDivisionEngine.isolates).toBe('consequence')
    expect(scenesFor('Mitosis and meiosis: chromosomes in cell division').map((e) => e.id)).toContain('cell-division')
    expect(scenesFor('Haploid and diploid nuclei').map((e) => e.id)).toContain('cell-division')
    expect(scenesFor('Gametes and fertilisation as a chromosome count').map((e) => e.id)).toContain('cell-division')
    expect(scenesFor('Growth and repair of cells').map((e) => e.id)).toContain('cell-division')
    expect(sceneCatalogue('Punnett squares and inheritance')).not.toContain('SCENE "cell-division"')
    expect(sceneCatalogue('Cell structure and organelles')).not.toContain('SCENE "cell-division"')
    expect(sceneCatalogue('Protein synthesis')).not.toContain('SCENE "cell-division"')
    expect(sceneCatalogue('Stem cells and differentiation')).not.toContain('SCENE "cell-division"')
  })

  it('refuses answers and unshown promises in a prompt', () => {
    const m = cellDivisionEngine.promptFaults!(configs[0], 'Mitosis makes 46 chromosomes stay 46 and produces genetically identical diploid cells.')
    expect(m.join(' ')).toMatch(/gives the chromosome counts|separation rule/)
    expect(cellDivisionEngine.promptFaults!(configs[2], 'Watch crossing over in prophase and metaphase.').join(' ')).toMatch(/does not show/)
    expect(cellDivisionEngine.promptFaults!(configs[0], 'Drag every copied chromosome left or right. Give both daughter cells the same set, then press “Divide the cell”.')).toEqual([])
    expect(cellDivisionEngine.promptFaults!(configs[2], 'Drag each copied chromosome left or right. Give each gamete one chromosome of each length, with different colour combinations, then press “Divide twice”.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('cell-division')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const match of found) expect(e.promptFaults!(e.parse(JSON.parse(match[2]))!, match[1])).toEqual([])
  })
})
