// lib/studylab/checkFormats.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
vi.spyOn(console, 'error').mockImplementation(() => {})

import { QuizNode } from '@/components/studylab/QuizNode'
import { StageContext } from '@/components/studylab/stage/StageContext'
import { ANSWER_TARGETS } from '@/components/studylab/check/targets'
import { DIAGRAM_REGIONS } from '@/lib/studylab/check/diagramRegions'

/**
 * The new formats as a learner first meets them in a check: everything to
 * press is a button, so a keyboard reaches all of it, and nothing printed
 * gives the answer away.
 */
const card = (question: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(QuizNode as never, {
    id: 'n1', data: { quiz: { checkpointId: 'cp', gate: 'hard', state: 'unanswered', question, ...extra } },
  } as never)))
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

describe('fill the blanks', () => {
  const q = { id: 'f1', format: 'fill', prompt: 'Complete the sentence.', text: 'Plants make ___ from carbon dioxide and ___.', tiles: ['glucose', 'water', 'oxygen'], answer: ['glucose', 'water'] }
  it('shows the sentence with a place for each blank, and each tile once, as buttons', () => {
    const html = card(q)
    expect(html).toContain('Plants make')
    expect(count(html, /data-part="blank-\d+"/g)).toBe(2)
    for (const t of q.tiles) expect(count(html, new RegExp(`<button[^>]*>(?:<span[^>]*>)?${t}(?:</span>)?</button>`, 'g')), t).toBe(1)
  })
  it('puts back what was placed when the card is reloaded', () => {
    const html = card(q, { given: ['glucose', ''] })
    // What the blank shows, not its label: the tile sits inside it.
    const inside = (n: number) => (new RegExp(`data-part="blank-${n}"[^>]*>(.*?)</button>`).exec(html)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    expect(inside(1)).toBe('glucose')
    expect(inside(2)).toBe('')
  })
})

describe('put in order', () => {
  const q = { id: 'o1', format: 'order', prompt: 'Put the stages in order.', items: ['Egg', 'Larva', 'Pupa', 'Adult'], clues: [{ text: 'The larva hatches from the egg.', before: 'Egg', after: 'Larva' }] }
  it('shows numbered slots, the items out of order as buttons, and each clue as a line to tick', () => {
    const html = card(q)
    expect(count(html, /data-part="slot-\d+"/g)).toBe(4)
    const shown = q.items.map((i) => [i, html.search(new RegExp(`>(?:<span[^>]*>)?${i}(?:</span>)?</button>`))] as const).sort((a, b) => a[1] - b[1]).map(([i]) => i)
    expect(shown.every((_, i) => html.search(new RegExp(`>(?:<span[^>]*>)?${q.items[i]}(?:</span>)?</button>`)) >= 0)).toBe(true)
    expect(shown).not.toEqual(q.items)
    // A clue is shown as the pair it checks, never the writer's sentence, which can claim more than it ticks.
    expect(html).toContain('Egg before Larva')
    expect(html).not.toContain('The larva hatches from the egg.')
  })
})

describe('tap the part', () => {
  const q = { id: 't1', format: 'tap', prompt: 'Tap the nucleus.', figure: 'asset:plant-cell', answer: ['nucleus'] }
  it('shows the diagram with a button on every mapped spot, and no part named', () => {
    const html = card(q)
    expect(html).toContain('/art/montessori/diagrams/plant-cell.webp')
    const spots = DIAGRAM_REGIONS['plant-cell'].regions.reduce((n, r) => n + r.spots.length, 0)
    expect(count(html, /data-part="region-[a-z0-9-]+"/g)).toBe(spots)
    for (const r of DIAGRAM_REGIONS['plant-cell'].regions) expect(html).not.toContain(`>${r.label}<`)
    expect(html).not.toMatch(/aria-label="[^"]*(Nucleus|Vacuole|Chloroplast)/)
  })
})

describe('marked', () => {
  const fill = { id: 'f1', format: 'fill', prompt: 'Complete the sentence.', text: 'Plants make ___ from carbon dioxide and ___.', tiles: ['glucose', 'water', 'oxygen'], answer: ['glucose', 'water'] }
  const order = { id: 'o1', format: 'order', prompt: 'Put the stages in order.', items: ['Egg', 'Larva', 'Pupa', 'Adult'] }
  it('after a miss in a test, shows the right piece beside each wrong one only', () => {
    const f = card(fill, { given: ['glucose', 'oxygen'], state: 'incorrect', attempts: 1 })
    expect(f).toContain('→ water')
    expect(f).not.toContain('→ glucose')
    const o = card(order, { given: ['Larva', 'Egg', 'Pupa', 'Adult'], state: 'incorrect', attempts: 1 })
    expect(o).toContain('→ Egg')
    expect(o).toContain('→ Larva')
    expect(o).not.toContain('→ Pupa')
  })
  it('while learning, a first miss keeps the answer hidden for the next go', () => {
    const f = card(fill, { gate: 'soft', given: ['glucose', 'oxygen'], state: 'unanswered', attempts: 1 })
    expect(f).not.toContain('→')
  })
})

describe('keyboard', () => {
  it('returns focus to the parts of a new-format question after Try again', () => {
    for (const sel of ['[data-part^="blank-"]', '[data-part^="slot-"]', '[data-part^="region-"]', '[data-part^="tile-"]']) expect(ANSWER_TARGETS).toContain(sel)
  })
})

describe('a written answer on the Trail', () => {
  const stage = { look: 'trail', focus: new Set<string>(), owner: null, dockEl: null, continueFor: () => null, runContinue: () => {}, claim: () => () => {}, prefer: () => {} } as never
  const written = { id: 'q', format: 'short', prompt: 'P', rubric: 'R' }
  const onTrail = (cell: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(StageContext.Provider, { value: stage }, createElement(QuizNode as never, {
      id: 'n1', data: { quiz: { checkpointId: 'cp', gate: 'hard', question: written, ...cell } },
    } as never))))
  it('a miss is marked on the card, in red, whether or not Kana is in view', () => {
    const html = onTrail({ state: 'incorrect', given: 'no', attempts: 1 })
    expect(html).toContain('aria-label="Your answer, not right"')
    expect(html).toContain('--ss-bad')
    expect(html).toContain('A good answer')
  })
  it('a right one in green', () => {
    const html = onTrail({ state: 'correct', given: 'yes', attempts: 1 })
    expect(html).toContain('aria-label="Correct"')
    expect(html).toContain('--ss-good')
  })
  it('nothing marks it before it is answered', () => {
    expect(onTrail({ state: 'unanswered' })).not.toContain('aria-label="Your answer, not right"')
  })
})
