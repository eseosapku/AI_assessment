// lib/studylab/engines/order-of-operations/order-of-operations.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  orderEngine, tokenize, evaluate, legalOps, readyOps, applyOp, replay, show, withBrackets, valueWith, wrapsOf, toggleWrap, solutions, layoutLine,
  MAX_LINE, PANEL_W, type BracketsConfig, type OooConfig, type OooState,
} from './config'
import { OrderOfOperationsView, W, panelHeight, rowsFor } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const order = (expr: string): OooConfig => ({ task: 'order', expr })
const brackets = (expr: string, target: number): BracketsConfig => ({ task: 'brackets', expr, target })
const val = (s: string) => evaluate(tokenize(s)!)
const render = (config: OooConfig, state: OooState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(OrderOfOperationsView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the rules', () => {
  it('evaluates the classic traps the right way', () => {
    expect(val('2 + 3 × 4')).toBe(14)
    expect(val('8 − 3 + 2')).toBe(7)
    expect(val('12 ÷ 2 × 3')).toBe(18)
    expect(val('8 ÷ 2 × 4')).toBe(16)
    expect(val('(2 + 3) × 4')).toBe(20)
    expect(val('10 − 2^3')).toBe(2)
    expect(val('2 × 3^2')).toBe(18)
    expect(val('(1 + 2)^2 + 1')).toBe(10)
    expect(val('20 − 4 − 3')).toBe(13)
    expect(val('2 × 3 + 4 × 5')).toBe(26)
  })
  it('knows which calculation the rules allow next', () => {
    const t = tokenize('2 + 3 × 4')!
    expect(legalOps(t)).toEqual([1])
    expect(legalOps(tokenize('8 − 3 + 2')!)).toEqual([0])
    expect(legalOps(tokenize('12 ÷ 2 × 3')!)).toEqual([0])
    expect(legalOps(tokenize('2 × 3 + 4 × 5')!)).toEqual([0, 2])
    expect(legalOps(tokenize('2 × (3 + 4)')!)).toEqual([1])
    expect(readyOps(tokenize('2 × (3 + 4)')!)).toEqual([1])
    expect(legalOps(tokenize('2 + 3^2')!)).toEqual([1])
  })
  it('works an operation out and drops a bracket round a lone number', () => {
    const a = applyOp(tokenize('(2 + 3) × 4')!, 0)!
    expect(show(a.toks)).toBe('5 × 4')
    expect(a.made).toBe(0)
    expect(a.result).toBe(5)
  })
  it('reads broad phrasings of a sum', () => {
    expect(show(tokenize('2 + 3 x 4')!)).toBe('2 + 3 × 4')
    expect(show(tokenize('12/2*3 = ?')!)).toBe('12 ÷ 2 × 3')
    expect(show(tokenize('10 - 2²')!)).toBe('10 − 2^2')
    expect(show(tokenize('[2+3]×4')!)).toBe('(2 + 3) × 4')
    expect(tokenize('2 +')).toBeNull()
    expect(tokenize('2(3 + 4)')).toBeNull()
    expect(tokenize('')).toBeNull()
  })
})

describe('reading and refusing configs', () => {
  it('parses both tasks', () => {
    expect(orderEngine.parse({ task: 'order', expr: '2 + 3 x 4' })).toEqual(order('2 + 3 × 4'))
    expect(orderEngine.parse({ expression: '8 - 3 + 2' })).toEqual(order('8 − 3 + 2'))
    expect(orderEngine.parse({ task: 'brackets', expr: '3 + 4 × 2', target: '14' })).toEqual(brackets('3 + 4 × 2', 14))
    expect(orderEngine.parse({ sum: '3 + 4 × 2', make: 14 })).toEqual(brackets('3 + 4 × 2', 14))
    expect(orderEngine.parse({ task: 'brackets', expr: '3 + 4 × 2' })).toBeNull()
    expect(orderEngine.parse(null)).toBeNull()
    expect(orderEngine.parse({ expr: 'banana' })).toBeNull()
  })
  it('refuses what teaches nothing or cannot be drawn, with a working example', () => {
    expect(orderEngine.faults(order('2 + 3 × 4'))).toEqual([])
    expect(orderEngine.faults(order('(2 + 3) × 4 + 3^2'))).toEqual([])
    expect(orderEngine.faults(order('2 + 3'))[0]).toMatch(/at least two operations.*2 \+ 3 × 4/)
    expect(orderEngine.faults(order('2 + 3 + 4'))[0]).toMatch(/no difference/)
    expect(orderEngine.faults(order('10 ÷ 4 + 1'))[0]).toMatch(/fraction/)
    expect(orderEngine.faults(order('3 − 8 + 10'))[0]).toMatch(/negative/)
    expect(orderEngine.faults(order('2.5 + 3 × 4'))[0]).toMatch(/whole numbers/)
    expect(orderEngine.faults(order('1 + 2 + 3 + 4 + 5 + 6'))[0]).toMatch(/at most 5 numbers/)
    expect(orderEngine.faults(order('2 + 3^4 + 1'))[0]).toMatch(/2 or 3/)
    expect(orderEngine.faults(order('((2 + 3) × 4) + 1'))[0]).toMatch(/one level/)
    expect(orderEngine.faults(order('(5) × 2 + 1'))[0]).toMatch(/does nothing/)
    expect(orderEngine.faults(brackets('3 + 4 × 2', 14))).toEqual([])
    expect(orderEngine.faults(brackets('3 + 4 × 2', 11))[0]).toMatch(/already makes 11/)
    expect(orderEngine.faults(brackets('3 + 4 × 2', 99))[0]).toMatch(/No way/)
    expect(orderEngine.faults(brackets('(3 + 4) × 2', 14))[0]).toMatch(/starts with none/)
    expect(orderEngine.faults(brackets('3 + 4', 7))[0]).toMatch(/2 or 3 operations/)
    expect(orderEngine.faults(brackets('3 + 5 ÷ 2', 4))[0]).toMatch(/fraction/)
  })
})

describe('marking', () => {
  it('passes a rule-following order and fails the classic wrong ones', () => {
    const c = order('2 + 3 × 4')
    expect(orderEngine.check(c, { picks: [1, 0] }).ok).toBe(true)
    const left = orderEngine.check(c, { picks: [0, 0] })
    expect(left.ok).toBe(false)
    expect(left.wrongIds).toEqual(['step1'])
    expect(replay(c, { picks: [0, 0] }).value).toBe(20)
    expect(orderEngine.check(c, { picks: [1] }).wrongIds).toEqual(['unfinished'])
    expect(orderEngine.check(order('8 − 3 + 2'), { picks: [1, 0] }).ok).toBe(false)
    expect(orderEngine.check(order('8 − 3 + 2'), { picks: [0, 0] }).ok).toBe(true)
    expect(orderEngine.check(order('12 ÷ 2 × 3'), { picks: [1, 0] }).ok).toBe(false)
  })
  it('forgives an order that cannot change the answer', () => {
    const c = order('2 × 3 + 4 × 5')
    expect(orderEngine.check(c, { picks: [2, 0, 0] }).ok).toBe(true)
    expect(orderEngine.check(c, { picks: [0, 1, 0] }).ok).toBe(true)
    expect(orderEngine.check(c, { picks: [1, 0, 0] }).ok).toBe(false)
  })
  it('ignores impossible or corrupt picks', () => {
    const c = order('2 × (3 + 4)')
    expect(replay(c, { picks: [0] }).picks).toEqual([])
    expect(replay(c, { picks: [9, -1, 1.5, 1, 0] }).value).toBe(14)
    expect(orderEngine.check(c, {} as OooState).ok).toBe(false)
  })
  it('marks brackets by the value the drawn sum has, and accepts any bracketing that reaches it', () => {
    const c = brackets('3 + 4 × 2', 14)
    expect(orderEngine.check(c, { wrapped: [] }).ok).toBe(false)
    expect(orderEngine.check(c, { wrapped: [1] }).ok).toBe(false)
    expect(orderEngine.check(c, { wrapped: [0] }).ok).toBe(true)
    const two = brackets('2 + 3 × 4 + 5', 45)
    expect(solutions(two).length).toBeGreaterThan(0)
    expect(valueWith(two, [0, 2])).toBe(45)
    expect(show(withBrackets(c, [0]))).toBe('(3 + 4) × 2')
  })
  it('swaps a wrap that shares a number, and cleans stored work', () => {
    expect(toggleWrap([0], 1)).toEqual([1])
    expect(toggleWrap([0], 2)).toEqual([0, 2])
    expect(toggleWrap([0, 2], 0)).toEqual([2])
    expect(wrapsOf(brackets('3 + 4 × 2', 14), { wrapped: [0, 1, 7, -1, 0.5] })).toEqual([0])
  })
})

/** Sums assembled from small numbers, in every shape the card allows. */
function everyOrderConfig(): OooConfig[] {
  const out: OooConfig[] = []
  const seen = new Set<string>()
  const nums = [2, 3, 4, 6, 8, 12, 5, 9]
  const ops = ['+', '−', '×', '÷']
  const shapes: ((n: number[], o: string[]) => string)[] = [
    (n, o) => `${n[0]} ${o[0]} ${n[1]} ${o[1]} ${n[2]}`,
    (n, o) => `(${n[0]} ${o[0]} ${n[1]}) ${o[1]} ${n[2]}`,
    (n, o) => `${n[0]} ${o[0]} (${n[1]} ${o[1]} ${n[2]})`,
    (n, o) => `${n[0]} ${o[0]} ${n[1]} ${o[1]} ${n[2]} ${o[2]} ${n[3]}`,
    (n, o) => `(${n[0]} ${o[0]} ${n[1]}) ${o[1]} ${n[2]} ${o[2]} ${n[3]}`,
    (n, o) => `${n[0]} ${o[0]} ${n[1]} ${o[1]} ${n[2]}^2`,
    (n, o) => `${n[0]} ${o[0]} (${n[1]} ${o[1]} ${n[2]})^2`,
  ]
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  for (let i = 0; i < 6000 && out.length < 400; i++) {
    const shape = pick(shapes)
    const s = shape([pick(nums), pick(nums), pick(nums), pick(nums)], [pick(ops), pick(ops), pick(ops)])
    const c = orderEngine.parse({ task: 'order', expr: s })
    if (!c || seen.has(c.task === 'order' ? c.expr : '') || orderEngine.faults(c).length) continue
    seen.add(c.expr)
    out.push(c)
  }
  return out
}

function everyBracketsConfig(): OooConfig[] {
  const out: OooConfig[] = []
  const nums = [2, 3, 4, 5, 6, 8, 10]
  for (const a of nums) for (const b of nums) for (const c of nums) for (const o1 of ['+', '−', '×']) for (const o2 of ['+', '−', '×']) {
    const expr = `${a} ${o1} ${b} ${o2} ${c}`
    for (const target of [a + b + c, (a + b) * c, a * (b + c), (a + b) - c, a - (b - c)]) {
      const cfg = orderEngine.parse({ task: 'brackets', expr, target })
      if (cfg && orderEngine.faults(cfg).length === 0) out.push(cfg)
    }
  }
  return out
}

describe('every valid config starts unsolved and solves', { timeout: 60_000 }, () => {
  const orders = everyOrderConfig()
  const marks = everyBracketsConfig()
  it('covers hundreds of orders and bracket targets', () => {
    expect(orders.length).toBeGreaterThanOrEqual(200)
    expect(marks.length).toBeGreaterThanOrEqual(200)
    for (const config of [...orders, ...marks]) {
      expect(orderEngine.check(config, orderEngine.initial(config)).ok, `starts solved ${JSON.stringify(config)}`).toBe(false)
      expect(orderEngine.check(config, orderEngine.solve(config)).ok, `cannot solve ${JSON.stringify(config)}`).toBe(true)
    }
  })
  it('keeps every line within the panel, and the layout in step with the view', () => {
    expect(W).toBe(PANEL_W)
    for (const c of orders) {
      const r = replay(c, orderEngine.solve(c))
      for (const l of r.lines) expect(layoutLine(l.toks).width).toBeLessThanOrEqual(MAX_LINE)
      expect(panelHeight(c)).toBeLessThan(260)
      expect(r.lines).toHaveLength(rowsFor(c))
    }
  })
  it('never puts two tiles on one another', () => {
    for (const c of orders.slice(0, 80)) {
      for (const l of replay(c, orderEngine.solve(c)).lines) {
        const items = layoutLine(l.toks).items
        for (let i = 1; i < items.length; i++) expect(items[i].x).toBeGreaterThanOrEqual(items[i - 1].x + items[i - 1].w - 3)
      }
    }
  })
})

describe('what the card says', () => {
  it('says what was done, then the rule', () => {
    const c = order('2 + 3 × 4')
    expect(render(c, { picks: [0, 0] }, 'wrong')).toMatch(/You worked out 2 \+ 3 too soon.*× and ÷ come before \+ and −, so 3 × 4 goes first.*You got 20; the answer is 14/)
    expect(render(c, orderEngine.solve(c), 'right')).toMatch(/The answer is 14.*2 \+ 3 × 4 = 2 \+ 12 = 14/)
    expect(render(order('8 − 3 + 2'), { picks: [1, 0] }, 'wrong')).toMatch(/\+ and − are worked out from left to right/)
    expect(render(order('2 × (3 + 4)'), { picks: [] }, 'wrong')).toMatch(/Not finished/)
    expect(render(brackets('3 + 4 × 2', 14), { wrapped: [1] }, 'wrong')).toMatch(/3 \+ \(4 × 2\) = 11, not 14/)
    expect(render(brackets('3 + 4 × 2', 14), { wrapped: [0] }, 'right')).toMatch(/\(3 \+ 4\) × 2 = 14/)
  })
  it('keeps answer words out of the card before marking', () => {
    const c = order('2 + 3 × 4')
    const idle = render(c, { picks: [] })
    expect(idle).not.toMatch(/Yes\.|Not quite|come before|left to right|Brackets come first|BIDMAS/i)
    expect(idle).not.toMatch(/>14</)
    const b = render(brackets('3 + 4 × 2', 14), { wrapped: [] })
    expect(b).not.toMatch(/\(3 \+ 4\)/)
    const card = (config: OooConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'order-of-operations', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    expect(card(c, 'Tap the calculation to do next.')).not.toMatch(/Yes\.|Not quite|come before|left to right/)
  })
})

describe('the drawing and accessible controls', () => {
  it('changes the picture with each move', () => {
    const c = order('2 + 3 × 4')
    const a = render(c, { picks: [] })
    const b = render(c, { picks: [1] })
    expect(a).not.toEqual(b)
    expect(b).toMatch(/data-tile="12"/)
    expect(a).not.toMatch(/data-tile="12"/)
    const k = brackets('3 + 4 × 2', 14)
    expect(render(k, { wrapped: [] })).not.toMatch(/data-bracket/)
    expect(render(k, { wrapped: [0] })).toMatch(/data-bracket="open"/)
  })
  it('has real buttons with labels that give nothing away', () => {
    const s = render(order('2 + 3 × 4'), { picks: [] })
    expect(s).toMatch(/aria-label="Work out 2 \+ 3"/)
    expect(s).toMatch(/aria-label="Work out 3 × 4"/)
    expect(s.match(/aria-label="Work out/g)).toHaveLength(2)
    const waiting = render(order('2 × (3 + 4)'), { picks: [] })
    expect(waiting).toMatch(/disabled=""[^>]*/)
    const k = render(brackets('3 + 4 × 2', 14), { wrapped: [] })
    expect(k).toMatch(/aria-label="Put brackets round 3 \+ 4"/)
    expect(k).toMatch(/aria-label="Put brackets round 4 × 2"/)
  })
  it('renders every task, marked state and motion setting without errors', () => {
    for (const config of [order('(2 + 3) × 4 + 3^2'), order('12 ÷ 2 × 3'), brackets('3 + 4 × 2', 14)]) {
      for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
        for (const reduced of [true, false]) {
          const state = marked === 'idle' || marked === 'wrong' ? orderEngine.initial(config) : orderEngine.solve(config)
          expect(render(config, state, marked, reduced)).toContain('<svg')
        }
      }
    }
  })
  it('does not animate under reduced motion', () => {
    const c = order('2 + 3 × 4')
    const r = render(c, { picks: [1] }, 'idle', true)
    expect(r).not.toMatch(/class="oo-in"|class="oo-pop"|transition:/)
  })
})

describe('catalogue matching and prompts', () => {
  it('is registered and matches order-of-operations stations, not the near misses', () => {
    expect(getEngine('order-of-operations')).toBe(orderEngine)
    expect(orderEngine.isolates).toBe('order')
    for (const station of ['The order of operations', 'BIDMAS and BODMAS', 'Using brackets in calculations', 'PEMDAS: what comes first', 'Putting brackets in to make a target', 'The order of calculations']) {
      expect(sceneCatalogue(station), station).toContain('SCENE "order-of-operations"')
    }
    expect(scenesFor('The order of operations').map((e) => e.id)).toContain('order-of-operations')
    for (const station of ['Expanding brackets in algebra', 'Function machines and inverse operations', 'Substituting into formulas', 'Place value', 'Order of the electromagnetic spectrum', 'Order of reactivity']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "order-of-operations"')
    }
  })
  it('catches prompts that print the answer, name the rule, or promise more', () => {
    const f = orderEngine.promptFaults!
    expect(f(order('2 + 3 × 4'), 'Tap to work out 2 + 3 × 4 = 14.').join(' ')).toMatch(/prints the answer/)
    expect(f(order('2 + 3 × 4'), 'Use BIDMAS and tap each calculation.').join(' ')).toMatch(/gives the rule/)
    expect(f(order('2 + 3 × 4'), 'Do it left to right. Tap.').join(' ')).toMatch(/gives the rule/)
    expect(f(order('2 + 3 × 4'), 'Work out the sum.').join(' ')).toMatch(/gesture/)
    expect(f(order('2 + 3 × 4'), 'Drag the calculation.').join(' ')).toMatch(/promises/)
    expect(f(brackets('3 + 4 × 2', 14), 'Tap to put brackets round (3 + 4).').join(' ')).toMatch(/where the brackets go/)
    expect(f(brackets('3 + 4 × 2', 14), 'Tap an operation to put brackets round it. Make the sum come to 14.')).toEqual([])
    expect(f(order('2 + 3 × 4'), 'Tap the calculation to do next, until one number is left.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('order-of-operations')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.promptFaults!(config, m[1]), m[1]).toEqual([])
      expect(e.faults(config), m[2]).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
    for (const m of e.prompt.matchAll(/config: (\{[^\n]*\})|or (\{ "task"[^\n]*\})/g)) {
      const config = e.parse(JSON.parse(m[1] ?? m[2]))!
      expect(e.faults(config), m[0]).toEqual([])
    }
    expect(e.prompt).toMatch(/"isolates":"order"/)
  })
})

describe('powers bind to their base', () => {
  it('cannot add to a base before squaring it, nor use an exponent as a number', () => {
    expect(readyOps(tokenize('4 + 3^2')!)).toEqual([1])
    expect(readyOps(tokenize('3^2 × 4')!)).toEqual([0])
    expect(applyOp(tokenize('4 + 3^2')!, 0)).toBeNull()
    expect(val('4 + 3^2')).toBe(13)
  })
})
