// lib/studylab/engines/money-change/money-change.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  moneyChangeEngine as e, COINS, CURRENCIES, ITEMS, MAX_CHANGE, MAX_COINS, MAX_FEWEST, MAX_PAID, MAX_PAY,
  amountsIn, done, drawable, fewestOf, fmt, goodPrompt, madeText, paidPieces, pieceName, readAmount, runningOf, said, targetOf, working,
  type ChangeConfig, type MoneyConfig, type PayConfig,
} from './config'
import { H, LAST, ON_COUNTER, TILL, W, X0, coinCentre, labelDrop, layoutOf, radiusOf, stepFor, tickAfter, wellsOf, MoneyChangeView, type Box } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const change = (price: number, paid: number, more: Partial<ChangeConfig> = {}): ChangeConfig => ({ task: 'change', price, paid, fewest: false, currency: 'pounds', item: 'book', ...more })
const pay = (price: number, more: Partial<PayConfig> = {}): PayConfig => ({ task: 'pay', price, fewest: false, currency: 'pounds', item: 'apple', ...more })
const render = (config: MoneyConfig, coins: number[], marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(MoneyChangeView, { config, state: { coins }, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const name = (c: unknown) => JSON.stringify(c)

/** Every way to put up to `k` coins on the counter, in non-decreasing order (order never changes the amount). */
function multisets(values: number[], k: number): number[][] {
  const out: number[][] = [[]]
  const grow = (from: number, at: number[]) => {
    if (at.length === k) return
    for (let i = from; i < values.length; i++) {
      const next = [...at, values[i]]
      out.push(next)
      grow(i, next)
    }
  }
  grow(0, [])
  return out
}

describe('money, from first principles', () => {
  it('writes amounts the school way: pence under a pound, a point and two places from a pound up', () => {
    expect(fmt('pounds', 5)).toBe('5p')
    expect(fmt('pounds', 99)).toBe('99p')
    expect(fmt('pounds', 100)).toBe('£1.00')
    expect(fmt('pounds', 105)).toBe('£1.05')
    expect(fmt('pounds', 150)).toBe('£1.50')
    expect(fmt('dollars', 635)).toBe('$6.35')
    expect(fmt('dollars', 25)).toBe('25c')
    expect(pieceName('pounds', 200)).toBe('£2')
    expect(pieceName('pounds', 1000)).toBe('£10')
    expect(pieceName('dollars', 25)).toBe('25c')
    expect(said('pounds', 105)).toBe('1 pound and 5 pence')
    expect(said('pounds', 150)).toBe('1 pound and 50 pence')
    expect(said('pounds', 201)).toBe('2 pounds and 1 penny')
    expect(said('dollars', 101)).toBe('1 dollar and 1 cent')
    expect(said('pounds', 300)).toBe('3 pounds')
  })

  it('finds the fewest coins, checked against trying every handful of coins', () => {
    for (const cur of CURRENCIES) {
      const values = COINS[cur]
      const best = new Map<number, number>()
      for (const m of multisets(values, 5)) {
        const s = m.reduce((a, b) => a + b, 0)
        if (!best.has(s) || best.get(s)! > m.length) best.set(s, m.length)
      }
      for (const [amount, n] of best) {
        if (amount === 0) continue
        const f = fewestOf(values, amount)!
        expect(f.reduce((a, b) => a + b, 0), `${cur} ${amount}`).toBe(amount)
        // Anything five coins can make, the table makes in no more.
        expect(f.length, `${cur} ${amount}`).toBe(n)
      }
    }
    expect(fewestOf(COINS.pounds, 160)).toEqual([10, 50, 100])
    expect(fewestOf(COINS.pounds, 499)).toHaveLength(8)
    expect(fewestOf(COINS.dollars, 30)).toEqual([5, 25])
    // Not "biggest coin first" by accident: a set where that fails is still solved right.
    expect(fewestOf([1, 3, 4], 6)).toEqual([3, 3])
  })

  it('draws what the customer handed over as the fewest notes and coins', () => {
    expect(paidPieces(change(340, 500))).toEqual([500])
    expect(paidPieces(change(465, 700))).toEqual([500, 200])
    expect(paidPieces(change(1240, 1500))).toEqual([1000, 500])
    expect(paidPieces(change(35, 50))).toEqual([50])
  })

  it('gives change as paid minus price, counted on from the price', () => {
    const c = change(340, 500)
    expect(targetOf(c)).toBe(160)
    expect(runningOf(c, [10, 50, 100])).toEqual([350, 400, 500])
    expect(done(c, { coins: [10, 50, 100] })).toBe(true)
    expect(done(c, { coins: [100, 50, 10] })).toBe(true)
    expect(done(c, { coins: [50, 50, 50, 10] })).toBe(true)
    expect(done(c, { coins: [50, 100] })).toBe(false)
    expect(done({ ...c, fewest: true }, { coins: [50, 50, 50, 10] })).toBe(false)
    expect(done({ ...c, fewest: true }, { coins: [100, 10, 50] })).toBe(true)
    expect(done(pay(105), { coins: [100, 5] })).toBe(true)
    expect(done(pay(105), { coins: [100, 50] })).toBe(false)
  })

  it('marks exactly by the rule over every handful of up to five coins', () => {
    for (const config of [change(340, 500), change(340, 500, { fewest: true }), pay(105), pay(105, { fewest: true }), change(635, 1000, { currency: 'dollars', fewest: true })]) {
      const values = COINS[config.currency as 'pounds' | 'dollars']
      const best = fewestOf(values, targetOf(config))!.length
      let right = 0
      for (const m of multisets(values, 5)) {
        const sum = m.reduce((a, b) => a + b, 0)
        const should = sum === targetOf(config) && (!config.fewest || m.length === best)
        expect(e.check(config, { coins: m }).ok, `${name(config)} ${m}`).toBe(should)
        if (should) right++
      }
      expect(right, name(config)).toBeGreaterThan(0)
    }
  })

  it('reads only real coins of this till from stored work', () => {
    const c = change(340, 500)
    expect(drawable(c, { coins: [10, 3, 25, 50, '£1' as never, 100] })).toEqual([10, 50, 100])
    expect(drawable(c, { coins: Array(20).fill(1) })).toHaveLength(MAX_COINS)
    expect(drawable(c, null)).toEqual([])
    expect(drawable({ ...c, currency: 'dollars' }, { coins: [2, 25] })).toEqual([25])
    expect(e.check(c, {} as never).ok).toBe(false)
  })
})

describe('reading and refusing configs', () => {
  it('reads money however it is written', () => {
    expect(readAmount('£3.40')).toEqual({ pence: 340, hint: 'pounds' })
    expect(readAmount('3.40')).toEqual({ pence: 340, hint: null })
    expect(readAmount('340p')).toEqual({ pence: 340, hint: 'pounds' })
    expect(readAmount('$6.35')).toEqual({ pence: 635, hint: 'dollars' })
    expect(readAmount('25c')).toEqual({ pence: 25, hint: 'dollars' })
    expect(readAmount('5 pounds')).toEqual({ pence: 500, hint: 'pounds' })
    expect(readAmount(3.4)).toEqual({ pence: 340, hint: null })
    expect(readAmount(5)).toEqual({ pence: 500, hint: null })
    expect(readAmount('£1.05')!.pence).toBe(105)
    expect(readAmount('three pounds')).toBeNull()
  })

  it('parses broad phrasings, nested tasks and defaults', () => {
    expect(e.parse({ task: 'change', price: '£3.40', paid: '£5', item: 'book' })).toEqual(change(340, 500))
    expect(e.parse({ task: 'give change', cost: 3.4, paidWith: 5 })).toEqual(change(340, 500))
    expect(e.parse({ task: { kind: 'counting-on', price: '£3.40', paid: '£5' } })).toEqual(change(340, 500))
    expect(e.parse({ price: '£3.40', paid: '£5' })).toEqual(change(340, 500))
    // With no money handed over named, the next round amount above the price.
    expect(e.parse({ task: 'change', price: '£3.40' })).toEqual(change(340, 500))
    expect(e.parse({ task: 'change', price: '$6.35', paid: '$10' })).toEqual(change(635, 1000, { currency: 'dollars' }))
    expect(e.parse({ task: 'pay', price: '£1.05', fewest: true, item: 'an apple' })).toEqual(pay(105, { fewest: true }))
    expect(e.parse({ task: 'fewest coins', price: '£1.05', item: 'Apples' })).toEqual(pay(105, { fewest: true }))
    expect(e.parse({ task: 'pay', price: '£1.05', fewest: 'yes', item: 'apple', currency: 'GBP' })).toEqual(pay(105, { fewest: true }))
    expect(e.parse({ task: 'pay', price: 1.05, currency: '$', item: 'toy car' })).toEqual(pay(105, { currency: 'dollars', item: 'car' }))
    expect(e.parse({ task: 'make', price: '45p' })).toEqual(pay(45, { item: 'book' }))
    expect(e.parse({ task: 'pay', price: '£1.05', item: 'sandwich', currency: 'euros' })).toEqual(pay(105, { item: 'sandwich', currency: 'euros' }))
    expect(e.parse(null)).toBeNull()
    expect(e.parse({ task: 'juggle', price: '£1' })).toBeNull()
    expect(e.parse({ task: 'change' })).toBeNull()
    expect(e.parse({ task: 'change', price: 'lots' })).toBeNull()
    expect(e.parse({ task: 'pay', price: '£1', fewest: 'perhaps' })).toBeNull()
  })

  it('refuses only what it cannot draw or mark, each time with a nearby example that works', () => {
    const fix = (c: MoneyConfig, pattern: RegExp) => {
      const f = e.faults(c)
      expect(f.join(' '), name(c)).toMatch(pattern)
      // The example in the message must itself be a working config.
      const price = f.join(' ').match(/price "([^"]+)"/)
      const paid = f.join(' ').match(/paid "([^"]+)"/)
      if (price || paid) {
        const raw: Record<string, unknown> = { task: c.task, price: price ? price[1] : fmt(c.currency as 'pounds', c.price), currency: c.currency, item: c.item }
        if (c.task === 'change') raw.paid = paid ? paid[1] : fmt(c.currency as 'pounds', c.paid)
        const fixed = e.parse(raw)!
        expect(e.faults(fixed), `${name(c)} -> ${name(fixed)}`).toEqual([])
      }
    }
    fix(change(500, 500), /more than the price.*paid "£10.00"/)
    fix(change(600, 500), /more than the price/)
    fix(change(100, 1000), /change would be £9.00.*price "£8.40" with paid "£10.00"/)
    fix(change(340.5, 500), /whole number of pence/)
    fix(change(340, 5000), /at most £20.00/)
    fix(change(340, 800), /takes 3 notes and coins/)
    fix(change(501, 1000, { currency: 'dollars' }), /needs 10 coins.*price "\$8.40" with paid "\$10.00"/)
    fix(pay(1200), /up to £10.00/)
    fix(pay(0), /more than nothing/)
    fix(pay(499, { currency: 'dollars' }), /needs 10 coins/)
    expect(e.faults(pay(105, { item: 'sandwich' }))[0]).toMatch(/no drawing of "sandwich".*item "book"/)
    expect(e.faults(pay(105, { currency: 'euros' }))[0]).toMatch(/not "euros".*currency "pounds"/)
    expect(e.faults(change(340, 500))).toEqual([])
    expect(e.faults(pay(105))).toEqual([])
  })
})

/** Every valid card: each price below each sensible amount handed over, and each price to pay, in both currencies. */
function everyConfig(): MoneyConfig[] {
  const out: MoneyConfig[] = []
  for (const currency of CURRENCIES) {
    for (const fewest of [false, true]) {
      for (const paid of [50, 100, 200, 300, 500, 700, 1000, 1500, 2000]) {
        for (let price = Math.max(1, paid - MAX_CHANGE); price < paid; price++) {
          const c = change(price, paid, { currency, fewest, item: ITEMS[price % ITEMS.length] })
          if (e.faults(c).length === 0) out.push(c)
        }
      }
      for (let price = 1; price <= MAX_PAY; price++) {
        const c = pay(price, { currency, fewest, item: ITEMS[price % ITEMS.length] })
        if (e.faults(c).length === 0) out.push(c)
      }
    }
  }
  return out
}

describe('every valid configuration', { timeout: 60_000 }, () => {
  const all = everyConfig()

  it('starts unsolved, can be solved within the counter, and its own good prompt passes', () => {
    expect(all.length).toBeGreaterThan(5_000)
    for (const c of all) {
      expect(e.check(c, e.initial(c)).ok, `initial ${name(c)}`).toBe(false)
      const s = e.solve(c)
      expect(e.check(c, s).ok, `solve ${name(c)}`).toBe(true)
      expect(s.coins.length, name(c)).toBeLessThanOrEqual(MAX_COINS)
      expect(e.promptFaults!(c, goodPrompt(c)), `${name(c)} ${goodPrompt(c)}`).toEqual([])
    }
  })

  it('parses back to itself from the way a writer would write it', () => {
    for (const c of all.filter((_, i) => i % 7 === 0)) {
      const cur = c.currency as 'pounds' | 'dollars'
      const raw: Record<string, unknown> = { task: c.task, price: fmt(cur, c.price), fewest: c.fewest, currency: c.currency, item: c.item }
      if (c.task === 'change') raw.paid = fmt(cur, c.paid)
      expect(e.parse(raw), name(raw)).toEqual(c)
    }
  })

  it('draws every card, before and after marking, with nothing touching and nothing outside the plate', () => {
    for (const [k, c] of all.entries()) {
      if (k % 211 !== 0) continue
      const s = e.solve(c).coins
      expect(render(c, [])).toContain('<svg')
      for (const m of ['right', 'wrong', 'shown'] as const) expect(render(c, s, m, true)).toContain('<svg')
      expectClear(layoutOf(c, s), name(c))
    }
  })
})

/** No two boxes overlap (a text box may not touch anything), and every box is inside the plate. */
function expectClear(boxes: Box[], label: string) {
  for (const b of boxes) {
    expect(b.x, `${label} ${b.name} left`).toBeGreaterThanOrEqual(2)
    expect(b.y, `${label} ${b.name} top`).toBeGreaterThanOrEqual(2)
    expect(b.x + b.w, `${label} ${b.name} right`).toBeLessThanOrEqual(W - 2)
    expect(b.y + b.h, `${label} ${b.name} bottom`).toBeLessThanOrEqual(H - 2)
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      // The customer's two pieces of money lie on each other, as money does.
      if (a.name.startsWith('paid ') && b.name.startsWith('paid ') && !a.text && !b.text) continue
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      expect(ox > 0.5 && oy > 0.5, `${label}: ${a.name} touches ${b.name}`).toBe(false)
    }
  }
}

describe('the drawing', () => {
  it('agrees with the config it cannot import at load time', () => {
    expect(ON_COUNTER).toBe(MAX_COINS)
    expect(MAX_FEWEST).toBeLessThanOrEqual(ON_COUNTER)
    expect(MAX_PAID).toBe(2000)
    expect(wellsOf(COINS.pounds)).toHaveLength(8)
    for (const cur of CURRENCIES) {
      for (const w of wellsOf(COINS[cur])) {
        const r = radiusOf(cur, w.value)
        expect(2 * r, `${cur} ${w.value} fits its well`).toBeLessThanOrEqual(w.w)
        expect(w.x).toBeGreaterThanOrEqual(TILL.x)
        expect(w.x + w.w).toBeLessThanOrEqual(TILL.x + TILL.w)
      }
    }
  })

  it('keeps a full counter of the widest counts apart: coins, counts, the start and the till', () => {
    const worst: [MoneyConfig, number[]][] = [
      [change(1500, 2000), [200, 200, 200, 200, 200, 200, 200, 200]],
      [change(1999, 2000), [1, 1, 1, 1, 1, 1, 1, 1]],
      [change(1250, 1500, { currency: 'dollars' }), [25, 25, 50, 50, 200, 200, 200, 200]],
      [pay(1000), [200, 200, 200, 200, 100, 50, 20, 20]],
      [pay(5), [1, 1, 1, 1, 1, 1, 1, 1]],
      [change(1240, 1500, { item: 'ball' }), [10, 50, 200]],
      [change(465, 700, { item: 'car' }), [5, 10, 20, 200]],
      [change(35, 50, { item: 'pencil' }), [5, 10]],
    ]
    for (const [c, coins] of worst) {
      for (let n = 0; n <= coins.length; n++) expectClear(layoutOf(c, coins.slice(0, n)), `${name(c)} ${n} coins`)
    }
  })

  it('lets the row close up as coins arrive, and never leaves the counter', () => {
    expect(stepFor(1)).toBe(50)
    expect(stepFor(6)).toBe(50)
    expect(stepFor(8)).toBeLessThan(40)
    expect(X0 + stepFor(ON_COUNTER) * ON_COUNTER).toBeLessThanOrEqual(LAST + 1e-9)
    for (let n = 1; n <= ON_COUNTER; n++) {
      for (let i = 0; i < n; i++) {
        const c = coinCentre(i, n, 18)
        const t = tickAfter(i, n)
        // A coin sits over its own hop, between the tick it leaves and the tick it lands on.
        expect(c.x).toBeGreaterThan(t.x - stepFor(n))
        expect(c.x).toBeLessThan(t.x)
      }
    }
    expect(labelDrop(['£3.50', '£4.00'], 2)).toBe(false)
    expect(labelDrop(Array(8).fill('£20.00'), 8)).toBe(true)
  })

  it('changes the picture with the smallest move, and says where the count has got to', () => {
    const c = change(340, 500)
    expect(render(c, [])).not.toBe(render(c, [1]))
    expect(render(c, [1], 'idle', true)).not.toBe(render(c, [2], 'idle', true))
    expect(render(c, [10, 50])).toMatch(/data-count="350"[^>]*>£3.50</)
    expect(render(c, [10, 50])).toMatch(/data-count="400"[^>]*>£4.00</)
    expect(render(c, [10, 50])).toMatch(/Counted up to/)
    expect(render(pay(105), [100, 50])).toMatch(/data-count="150"[^>]*>£1.50</)
  })

  it('has a real button for each coin in the till and for each coin on the counter, and none once solved', () => {
    const s = render(change(340, 500), [10, 50])
    expect(s.match(/aria-label="Count out a [^"]+ coin from the till"/g)).toHaveLength(8)
    expect(s).toMatch(/aria-label="Put the 10p back in the till"/)
    expect(s).toMatch(/aria-label="Put the 50p back in the till"/)
    const p = render(pay(105, { currency: 'dollars' }), [25])
    expect(p.match(/aria-label="Put a [^"]+ coin on the counter"/g)).toHaveLength(7)
    expect(p).toMatch(/Put the 25c back with your coins/)
    const full = render(change(340, 500), Array(8).fill(20))
    expect(full.match(/<button[^>]*disabled=""[^>]*aria-label="Count out/g)).toHaveLength(8)
    expect(render(change(340, 500), [10, 50, 100], 'right')).not.toMatch(/<button/)
    expect(render(change(340, 500), [], 'shown')).not.toMatch(/<button/)
  })

  it('flies a coin in only when motion is allowed', () => {
    // Server-rendered coins were already there, so none flies; reduced motion never animates.
    expect(render(change(340, 500), [10])).not.toMatch(/class="mc-fly"/)
    expect(render(change(340, 500), [10], 'idle', true)).not.toMatch(/transition/)
  })

  it('says what was made when wrong, and the counting on when right', () => {
    const c = change(340, 500)
    expect(render(c, [], 'wrong')).toMatch(/No coins are on the counter yet/)
    expect(madeText(c, [100, 100])).toMatch(/counted up to £5.40, past the £5.00 that was paid.*too much change/)
    expect(madeText(c, [100, 50])).toMatch(/counted up to £4.90, but £5.00 was paid.*too little change/)
    expect(madeText({ ...c, fewest: true }, [50, 50, 50, 10])).toMatch(/with 4 coins.*fewer/)
    expect(madeText(c, [50, 50, 50, 10])).not.toMatch(/fewer/)
    expect(madeText(pay(105, { fewest: true }), [50, 50, 5])).toMatch(/with 3 coins. Fewer coins can make it/)
    expect(working(c, [10, 50, 100])).toBe('Yes. The change is £1.60. Counting on from the price: £3.40, then 10p makes £3.50, 50p makes £4.00 and £1 makes £5.00, which is what was paid.')
    expect(working(c, [50, 50, 50, 10])).toMatch(/fewest coins for £1.60 would be 3: £1, 50p and 10p/)
    expect(working({ ...c, fewest: true }, [10, 50, 100])).toMatch(/Three coins are the fewest/)
    expect(madeText(pay(105), [100, 50])).toBe('You put £1.50 on the counter, which is 1 pound and 50 pence. The price, £1.05, is 1 pound and 5 pence.')
    expect(working(pay(105), [100, 5])).toMatch(/exactly £1.05. £1.05 is 1 pound and 5 pence, which is 105p/)
    expect(working(pay(45), [20, 20, 5])).toMatch(/45p is 45 pence, the same as £0.45/)
    expect(render(c, [10, 50, 100], 'right')).toMatch(/Yes\. The change is £1.60\./)
    expect(render(c, [], 'shown')).toMatch(/The change is £1.60/)
  })

  it('keeps the answer out of the server-rendered card before marking', () => {
    const card = (config: MoneyConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'money-change', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    const s = card(change(340, 500), 'Give the change.')
    expect(s).toContain('<svg')
    expect(s).not.toMatch(/£1\.60|160p|The change is|Yes\.|You counted|fewest coins for/)
    const p = card(pay(105, { fewest: true }), 'Pay exactly.')
    expect(p).not.toMatch(/1 pound and 5 pence|105p|fewest that can|You put/)
  })
})

describe('catalogue and prompts', () => {
  it('is found for money stations and not for the near misses', () => {
    expect(getEngine('money-change')).toBe(e)
    expect(e.isolates).toBe('quantity')
    for (const s of ['Money: giving change', 'Working out change from £5', 'Pounds and pence', 'Coins and notes', 'Recognising coins', 'Making amounts with coins', 'Adding money',
      'Money problems', 'Dollars and cents', 'Using the fewest coins', 'Counting money', 'The shopkeeper method for change']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "money-change"')
    }
    for (const s of ['Giving change', 'Pounds and pence', 'Recognising coins']) expect(scenesFor(s).map((x) => x.id), s).toContain('money-change')
    for (const s of ['Tossing a coin: probability', 'Functions of money', 'The money supply', 'Exchange rates and currency', 'Break-even analysis', 'Simple and compound interest',
      'Pounds and ounces: imperial units', 'Place value: tens and ones', 'Changes of state', 'Climate change', 'Double entry bookkeeping', 'Percentages of amounts',
      'Shopping centres and retail parks', 'Profit and loss']) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "money-change"')
    }
  })

  it('finds every amount of money written in a prompt', () => {
    expect(amountsIn('costs £3.40, pays £5, gets 160p, or 1.60, then 10p and 2 pounds and five pence').map((a) => a.pence)).toEqual([340, 500, 160, 160, 10, 200, 5])
    expect(amountsIn('a $6.35 ball, 25c and 3 dollars').map((a) => [a.pence, a.hint])).toEqual([[635, 'dollars'], [25, 'dollars'], [300, 'dollars']])
    expect(amountsIn('Tap a coin in the till.')).toEqual([])
  })

  it('catches prompts that give the answer away or promise what the card does not do', () => {
    const c = change(340, 500)
    const good = goodPrompt(c)
    expect(e.promptFaults!(c, good)).toEqual([])
    expect(e.promptFaults!(c, `${good} The change is £1.60.`).join(' ')).toMatch(/names "£1.60"/)
    expect(e.promptFaults!(c, `${good} Start with a 10p coin.`).join(' ')).toMatch(/names "10p"/)
    expect(e.promptFaults!(c, `${good} Count on to £3.50 first.`).join(' ')).toMatch(/names "£3.50"/)
    expect(e.promptFaults!(c, `${good} You need three coins.`).join(' ')).toMatch(/how many coins/)
    expect(e.promptFaults!(c, `${good} Give 3 silver coins.`).join(' ')).toMatch(/how many coins/)
    expect(e.promptFaults!(c, `${good} Use the fewest coins.`).join(' ')).toMatch(/set "fewest": true/)
    expect(e.promptFaults!({ ...c, fewest: true }, good).join(' ')).toMatch(/must ask for them/)
    expect(e.promptFaults!(c, good.replace('£3.40', '$3.40').replace('£5', '$5')).join(' ')).toMatch(/pounds and pence/)
    expect(e.promptFaults!(c, 'Tap a coin in the till. The book costs £3.40 and the customer pays with a £5 note. Count on from the price.').join(' ')).toMatch(/must ask for the change/)
    expect(e.promptFaults!(c, good.replace('book', 'apple')).join(' ')).toMatch(/draws a book, not an apple/)
    expect(e.promptFaults!(c, `Drag the coins onto the counter. ${good}`).join(' ')).toMatch(/promises/)
    expect(e.promptFaults!(pay(105), 'Tap one of your coins to put it on the counter. The apple costs £1.05. Work out the change.').join(' ')).toMatch(/gives no change/)
    expect(e.promptFaults!(pay(105), 'Tap one of your coins to put it on the counter. The apple costs £1.05, which is 105p. Pay exactly that.')).toEqual([])
    expect(e.promptFaults!(pay(105), 'Tap one of your coins to put it on the counter. The apple costs £1.05. Use £1 and 5p.').join(' ')).toMatch(/names "£1" and "5p"/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(c, m[2]).not.toBeNull()
      expect(e.faults(c), m[2]).toEqual([])
      expect(e.promptFaults!(c, m[1]), m[1]).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
    expect(e.prompt).toMatch(/"isolates":"quantity"/)
    expect(e.prompt).not.toMatch(/"isolates":"(?!quantity)/)
  })
})
