import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  ledgerEngine as engine, entryOf, accountsShown, usedAccounts, balances, trialTotals, typedTotals, judgePosting, judgeRow,
  readAmount, rightRow, reason, explain, narrate, enginePosts, labelOf, RULES, TX_TYPES, MAX_ACCOUNTS,
  type LedgerConfig, type LedgerState, type Tx, type TxType, type By, type Posting,
} from './config'
import { LedgerView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Double entry, posted and balanced: the tutor names transactions, the engine
 * knows each one's debit and credit (Cambridge IGCSE Accounting 0452, 2.1 and
 * 3.1), the learner posts them, balances them or finds the reversed one.
 */

const POST = {
  task: {
    kind: 'post', owner: 'Amira',
    transactions: [
      { type: 'capital', amount: 500, by: 'cash' },
      { type: 'credit-purchase', amount: 200, name: 'Ali' },
      { type: 'sale', amount: 80, by: 'cash' },
    ],
  },
}

// Bank 600 - 250 + 90 - 40 = 400 Dr; Capital 600 Cr; Equipment 250 Dr; Lee 140 - 90 = 50 Dr; Sales 140 Cr; Rent 40 Dr.
const TB = {
  task: {
    kind: 'trial-balance', owner: 'Ben',
    transactions: [
      { type: 'capital', amount: 600, by: 'cheque' },
      { type: 'buy-equipment', amount: 250, by: 'cheque' },
      { type: 'credit-sale', amount: 140, name: 'Lee' },
      { type: 'customer-pays', amount: 90, by: 'cheque', name: 'Lee' },
      { type: 'pay-rent', amount: 40, by: 'cheque' },
    ],
  },
}

// Ali is paid in full, so his account has no balance.
const SETTLED = {
  task: {
    kind: 'trial-balance',
    transactions: [
      { type: 'capital', amount: 500, by: 'cash' },
      { type: 'credit-purchase', amount: 200, name: 'Ali' },
      { type: 'pay-supplier', amount: 200, by: 'cash', name: 'Ali' },
    ],
  },
}

const FIND = {
  task: {
    kind: 'find-error', owner: 'Sara',
    transactions: [
      { type: 'capital', amount: 300, by: 'cash' },
      { type: 'purchase', amount: 120, by: 'cash' },
      { type: 'pay-wages', amount: 50, by: 'cash' },
    ],
    reversed: 3,
  },
}

const read = (raw: unknown): LedgerConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error('did not parse')
  return c
}
const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const withTask = (base: { task: object }, change: Record<string, unknown>) => ({ task: { ...copy(base.task), ...change } })
const faults = (raw: unknown) => engine.faults(read(raw)).join('\n')
const text = (html: string) =>
  html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const view = (config: LedgerConfig, state: LedgerState, marked: SceneMarked, locked = marked === 'right') =>
  renderToStaticMarkup(createElement(LedgerView, { config, state, setState: () => {}, marked, reduced: true, locked }))

// ── The double entries ──────────────────────────────────────────────────────

describe('the double entry of each transaction (0452 syllabus 2.1)', () => {
  const tx = (type: TxType, by: By | null = null, name: string | null = null): Tx => ({ type, amount: 10, by: by ?? RULES[type].usual, name })
  it('debits and credits the accounts the syllabus does', () => {
    const table: [Tx, string, string][] = [
      [tx('capital', 'cash'), 'cash', 'capital'],
      [tx('capital', 'cheque'), 'bank', 'capital'],
      [tx('credit-purchase', null, 'Ali'), 'purchases', 'p-ali'],
      [tx('purchase', 'cash'), 'purchases', 'cash'],
      [tx('purchase', 'transfer'), 'purchases', 'bank'],
      [tx('sale', 'cash'), 'cash', 'sales'],
      [tx('sale', 'cheque'), 'bank', 'sales'],
      [tx('credit-sale', null, 'Lee'), 'p-lee', 'sales'],
      [tx('pay-supplier', 'cheque', 'Ali'), 'p-ali', 'bank'],
      [tx('pay-supplier', 'cash', 'Ali'), 'p-ali', 'cash'],
      [tx('buy-equipment', 'cheque'), 'equipment', 'bank'],
      [tx('customer-pays', 'cheque', 'Lee'), 'bank', 'p-lee'],
      [tx('customer-pays', 'cash', 'Lee'), 'cash', 'p-lee'],
      [tx('pay-rent', 'cash'), 'rent', 'cash'],
      [tx('pay-wages', 'cheque'), 'wages', 'bank'],
      [tx('drawings', 'cash'), 'drawings', 'cash'],
      [tx('drawings', 'transfer'), 'drawings', 'bank'],
      [tx('cash-to-bank'), 'bank', 'cash'],
      [tx('bank-to-cash'), 'cash', 'bank'],
    ]
    for (const [t, dr, cr] of table) expect(entryOf(t), `${t.type} ${t.by}`).toEqual({ dr, cr })
    // Every type is in the table.
    expect(new Set(table.map(([t]) => t.type))).toEqual(new Set(TX_TYPES))
  })

  it('pays the usual way when "by" is left out: rent, wages, drawings and sales in cash; suppliers and equipment by cheque', () => {
    const c = read({ task: { kind: 'post', transactions: [{ type: 'pay-rent', amount: 5 }, { type: 'buy-equipment', amount: 5 }, { type: 'pay-supplier', amount: 5, name: 'Ali' }] } })
    expect(c.task.transactions.map((t) => entryOf(t).cr)).toEqual(['cash', 'bank', 'bank'])
  })

  it('writes each transaction as the learner reads it, never with a side', () => {
    const c = read(POST)
    expect(c.task.transactions.map((t) => narrate(c, t))).toEqual([
      'Amira puts $500 of personal savings into the business, in cash.',
      'The business buys goods for resale for $200, on credit from Ali.',
      'The business sells goods for $80, paid in cash.',
    ])
    for (const type of TX_TYPES) {
      const said = narrate(c, { type, amount: 10, by: RULES[type].usual, name: 'Ali' })
      expect(said, type).not.toMatch(/debit|credited|\bdr\b|\bcr\b/i)
    }
  })

  it('explains each entry once marked, the business apart from its owner', () => {
    const c = read(POST)
    expect(explain(c, 0)).toEqual([
      'Debit Cash: cash came into the business.',
      'Credit Capital: the business is separate from Amira, and now owes Amira the $500 put in as capital.',
    ])
    const d = read({ task: { kind: 'post', transactions: [{ type: 'drawings', amount: 30 }] } })
    expect(explain(d, 0)[0]).toBe('Debit Drawings: the business is separate from the owner, and money the owner takes for personal use is drawings, not a business expense.')
  })
})

// ── Reading ─────────────────────────────────────────────────────────────────

describe('reading a ledger config', () => {
  it('reads the documented configs', () => {
    expect(engine.parse(POST)).toEqual({
      task: {
        kind: 'post', owner: 'Amira', reversed: null,
        transactions: [
          { type: 'capital', amount: 500, by: 'cash', name: null },
          { type: 'credit-purchase', amount: 200, by: null, name: 'Ali' },
          { type: 'sale', amount: 80, by: 'cash', name: null },
        ],
      },
    })
    expect(read(FIND).task.reversed).toBe(2)
  })

  it('reads reasonable phrasings', () => {
    const c = read({
      task: {
        kind: 'Trial balance', owner: '  amira ',
        transactions: [
          { type: 'Cash sale', amount: '$80', by: 'Cheque' },
          { type: 'buy on credit', amount: 200, supplier: 'ali' },
          { kind: 'receive payment', amount: 50, method: 'bank transfer', customer: 'Lee' },
          { type: 'Owner drawings', amount: 20, paid: 'in cash' },
        ],
      },
    })
    expect(c.task.kind).toBe('trial-balance')
    expect(c.task.owner).toBe('Amira')
    expect(c.task.transactions).toEqual([
      { type: 'sale', amount: 80, by: 'cheque', name: null },
      { type: 'credit-purchase', amount: 200, by: null, name: 'Ali' },
      { type: 'customer-pays', amount: 50, by: 'transfer', name: 'Lee' },
      { type: 'drawings', amount: 20, by: 'cash', name: null },
    ])
    expect(read(withTask(POST, { kind: 'posting' })).task.kind).toBe('post')
    expect(read(withTask(FIND, { kind: 'spot the error', reversed: '1' })).task.reversed).toBe(0)
  })

  it('puts the reversal somewhere of its own when find-error does not say, the same place every time', () => {
    const { reversed: _, ...rest } = FIND.task
    const a = read({ task: rest })
    expect(a.task.reversed).not.toBeNull()
    expect(a.task.reversed!).toBeGreaterThanOrEqual(0)
    expect(a.task.reversed!).toBeLessThan(3)
    expect(read({ task: copy(rest) }).task.reversed).toBe(a.task.reversed)
  })

  it('reads nothing it cannot honestly draw', () => {
    const bad = [
      null, {}, { task: null }, withTask(POST, { kind: 'explore' }), withTask(POST, { transactions: [] }),
      withTask(POST, { transactions: 'capital 500' }),
      withTask(POST, { transactions: Array.from({ length: 13 }, () => ({ type: 'sale', amount: 5 })) }),
      withTask(POST, { transactions: [{ type: 'loan', amount: 500 }] }),
      withTask(POST, { transactions: [{ type: 'sale', amount: 0 }] }),
      withTask(POST, { transactions: [{ type: 'sale', amount: -5 }] }),
      withTask(POST, { transactions: [{ type: 'sale', amount: 'lots' }] }),
      withTask(POST, { transactions: [{ type: 'sale', amount: 5, by: 'card' }] }),
      withTask(POST, { transactions: [{ type: 'sale', amount: 5, by: 3 }] }),
      withTask(POST, { transactions: [{ type: 'credit-sale', amount: 5, name: 7 }] }),
      withTask(POST, { owner: 42 }),
      withTask(FIND, { reversed: 'the second' }),
    ]
    for (const raw of bad) expect(engine.parse(raw), JSON.stringify(raw)).toBeNull()
  })
})

// ── Faults ──────────────────────────────────────────────────────────────────

describe('what the engine refuses', () => {
  it('finds nothing wrong with the sound configs', () => {
    for (const raw of [POST, TB, SETTLED, FIND]) expect(engine.faults(read(raw)), JSON.stringify(raw)).toEqual([])
  })

  it('keeps each kind to the transactions a card can hold', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ type: 'sale', amount: 10 + i }))
    expect(faults(withTask(POST, { transactions: five }))).toMatch(/"post" takes 1 to 4 transactions; this one has 5/)
    expect(faults({ task: { kind: 'trial-balance', transactions: [{ type: 'capital', amount: 5 }] } })).toMatch(/"trial-balance" takes 2 to 5/)
    expect(faults(withTask(FIND, { transactions: FIND.task.transactions.slice(0, 2), reversed: 1 }))).toMatch(/"find-error" takes 3 to 4/)
  })

  it('keeps amounts small and whole', () => {
    expect(faults(withTask(POST, { transactions: [{ type: 'sale', amount: 12.5 }] }))).toMatch(/12.5 is not a whole number/)
    expect(faults(withTask(POST, { transactions: [{ type: 'sale', amount: 1500 }] }))).toMatch(/\$1500 is too large/)
  })

  it('needs a name for every supplier and customer, one that is a person and has one role', () => {
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50 }] }))).toMatch(/needs the customer's name: add "name"/)
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50, name: 'Bank' }] }))).toMatch(/cannot be called "Bank"/)
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50, name: 'Bartholomew Smith' }] }))).toMatch(/at most 12 characters/)
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50, name: 'Dr Patel' }] }))).toMatch(/short name of letters/)
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50, name: 'Amira' }] }))).toMatch(/Amira is both the owner and a customer/)
    expect(faults(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50, name: 'Ali' }, { type: 'credit-purchase', amount: 20, name: 'Ali' }] }))).toMatch(/Ali is both a supplier and a customer/)
    expect(faults(withTask(POST, { owner: 'Cash' }))).toMatch(/owner cannot be called "Cash"/)
  })

  it('refuses the same transaction twice, except in a trial balance', () => {
    const twice = [{ type: 'sale', amount: 80 }, { type: 'sale', amount: 80 }]
    expect(faults(withTask(POST, { transactions: twice }))).toMatch(/Transaction 2 is the same as transaction 1/)
    expect(faults({ task: { kind: 'trial-balance', transactions: [{ type: 'capital', amount: 500 }, ...twice] } })).toBe('')
  })

  it('tells one possible story in a trial balance or find-error, from the business’s first day', () => {
    const tb = (transactions: unknown[]) => faults({ task: { kind: 'trial-balance', transactions } })
    expect(tb([{ type: 'pay-rent', amount: 40 }, { type: 'capital', amount: 500 }])).toMatch(/Transaction 1 spends \$40 more cash than the business has/)
    expect(tb([{ type: 'capital', amount: 100 }, { type: 'buy-equipment', amount: 300 }])).toMatch(/Transaction 2 takes the bank \$300 overdrawn/)
    expect(tb([{ type: 'capital', amount: 500, by: 'cheque' }, { type: 'credit-purchase', amount: 100, name: 'Ali' }, { type: 'pay-supplier', amount: 150, name: 'Ali' }])).toMatch(/pays Ali \$50 more than the business owes/)
    expect(tb([{ type: 'credit-sale', amount: 100, name: 'Lee' }, { type: 'customer-pays', amount: 120, name: 'Lee' }])).toMatch(/has Lee pay \$20 more than is owed/)
    // In post each transaction stands alone, as exam questions set them.
    expect(faults({ task: { kind: 'post', transactions: [{ type: 'pay-rent', amount: 40 }] } })).toBe('')
  })

  it('refuses a trial balance too wide for the card, or one where nothing has a balance', () => {
    const wide = [
      { type: 'capital', amount: 900 }, { type: 'credit-purchase', amount: 50, name: 'Ali' }, { type: 'credit-sale', amount: 60, name: 'Lee' },
      { type: 'pay-rent', amount: 10, by: 'cash' }, { type: 'sale', amount: 30 },
    ]
    expect(faults({ task: { kind: 'trial-balance', transactions: [...wide.slice(0, 4), { type: 'buy-equipment', amount: 50, by: 'cash' }] } })).toMatch(/use 8 accounts, and at most 7 fit/)
    expect(faults({ task: { kind: 'trial-balance', transactions: wide } })).toBe('')
  })

  it('needs find-error’s reversed transaction to be one of them', () => {
    expect(faults(withTask(FIND, { reversed: 4 }))).toMatch(/"reversed" must say which transaction .* from 1 to 3/)
    expect(faults(withTask(FIND, { reversed: 0 }))).toMatch(/"reversed" must say/)
  })

  it('is refused by the meaning gates when it would teach nothing, and passes them when sound', () => {
    const action = (config: unknown, prompt = 'Post each transaction to the ledger.') => ({ type: 'createActivity', id: 'l1', spec: { pattern: 'scene', prompt, payload: { engine: 'ledger', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(POST))).toEqual([])
    expect(validateSpec(action(POST).spec)).toBe(true)
    expect(meaningFaults(action(withTask(POST, { transactions: [{ type: 'credit-sale', amount: 50 }] }))).join('\n')).toMatch(/needs the customer's name/)
    expect(meaningFaults(action(POST, 'Debit Cash and credit Capital, then post the rest.')).join('\n')).toMatch(/says which side Capital and Cash take/)
  })
})

// ── The prompt ──────────────────────────────────────────────────────────────

describe('the prompt a ledger card is written with', () => {
  const post = read(POST)
  const pf = (c: LedgerConfig, prompt: string) => engine.promptFaults(c, prompt).join('\n')

  it('may not say which account is debited or credited', () => {
    for (const p of [
      'Debit Cash and credit Capital for the $500.',
      'Cash is debited when Amira brings money in. Post the rest.',
      'Post them: Dr Cash, Cr Capital.',
      'Post it to Purchases (Dr) and to Ali (Cr).',
      'Remember that Ali’s account should be credited.',
      'Sales are credited; post the cash sale.',
    ]) expect(pf(post, p), p).toMatch(/says which side/)
  })

  it('may ask, and may use "credit" in its everyday senses', () => {
    for (const p of [
      'Post each of Amira’s transactions to the ledger.',
      'Amira buys goods on credit from Ali. Post the double entry.',
      'Which account is debited when Amira puts cash in? Post all three.',
      'Is the cash sale a debit or a credit for Cash? Post it and see.',
      'Post the credit purchase and the cash sale, then the capital.',
      'Every transaction has a debit and a credit: post each one.',
    ]) expect(pf(post, p), p).toBe('')
  })

  it('in a trial balance, may not give a balance or the total', () => {
    const tb = read(TB)
    expect(pf(tb, 'Cash has a debit balance of $400.')).toMatch(/gives \$400, a balance or total/)
    expect(pf(tb, 'Bank has a debit balance.')).toMatch(/says which side Bank takes/)
    expect(pf(tb, 'The totals come to $740. Fill in the trial balance.')).toMatch(/gives \$740/)
    expect(pf(tb, 'Lee still owes $50: balance the accounts.')).toMatch(/gives \$50/)
    // An amount the transactions already show is not a balance given away.
    expect(pf(tb, 'Ben starts with $600 in the bank. Balance each account.')).toBe('')
    expect(pf(tb, 'Balance each account and enter the balances in the trial balance.')).toBe('')
  })

  it('in find-error, may not point at the reversed transaction', () => {
    const find = read(FIND)
    expect(pf(find, 'Transaction 3 has been posted the wrong way round. Correct it.')).toMatch(/points at transaction 3/)
    expect(pf(find, 'Look at the third transaction: what went wrong?')).toMatch(/points at transaction 3/)
    expect(pf(find, 'The last posting is reversed. Explain why.')).toMatch(/points at transaction 3/)
    expect(pf(find, 'The wages were posted the wrong way round. Find them.')).toMatch(/names Wages, which only the reversed transaction involves/)
    expect(pf(find, 'One posting is the wrong way round. Which one?')).toBe('')
    expect(pf(find, 'Check how each cash payment was posted, and find the one reversed.')).toBe('')
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('ledger')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

// ── Marking ─────────────────────────────────────────────────────────────────

describe('marking postings', () => {
  const c = read(POST)
  const P = (dr: string | null, cr: string | null): Posting => ({ dr, cr })

  it('starts unposted and is solved by the double entries', () => {
    expect(engine.initial(c)).toEqual({ posts: [P(null, null), P(null, null), P(null, null)] })
    expect(engine.check(c, engine.initial(c))).toEqual({ ok: false, wrongIds: ['t0', 't1', 't2'] })
    expect(engine.check(c, engine.solve(c))).toEqual({ ok: true, wrongIds: [] })
    expect(engine.check(c, { posts: [P('cash', 'capital'), P('p-ali', 'purchases'), P('cash', 'sales')] })).toEqual({ ok: false, wrongIds: ['t1'] })
  })

  it('says what the learner did, and why the account takes the other side', () => {
    const eq = read({ task: { kind: 'post', transactions: [{ type: 'buy-equipment', amount: 300, by: 'cheque' }] } })
    expect(judgePosting(eq, 0, P('bank', 'cash')).said).toEqual([
      'You debited Bank: money left the bank, so Bank is credited.',
      'You credited Cash, but this was by cheque.',
    ])
    expect(judgePosting(eq, 0, P('purchases', 'bank')).said).toEqual([
      'You debited Purchases, which this transaction does not touch: the business gained equipment, an asset it keeps and uses, not goods to resell, so Equipment is debited.',
    ])
    expect(judgePosting(c, 1, P('p-ali', 'purchases'))).toEqual({
      status: 'reversed',
      said: ['You debited Ali and credited Purchases, the wrong way round: goods for resale came in, and goods bought to resell are purchases, so Purchases is debited; Ali supplied the goods and is now owed $200, so Ali is credited.'],
    })
    expect(judgePosting(c, 0, P('cash', 'cash')).said).toEqual(['You debited and credited Cash: the two entries go to two different accounts.'])
    expect(judgePosting(c, 0, P('cash', null)).said).toEqual(['You have not chosen an account to credit.'])
    expect(judgePosting(c, 0, P(null, null))).toEqual({ status: 'unposted', said: ['You have not posted this one.'] })
    expect(judgePosting(c, 2, P('bank', 'sales')).said).toEqual(['You debited Bank, but this was in cash: cash came into the business, so Cash is debited.'])
  })

  it('never fails on a state it cannot read', () => {
    for (const bad of [null, undefined, {}, { posts: 'x' }, { posts: [null, 5, { dr: 'nowhere', cr: 7 }] }]) {
      expect(engine.check(c, bad as never).ok).toBe(false)
    }
  })
})

describe('marking a trial balance', () => {
  const c = read(TB)
  const row = (dr: string, cr: string) => ({ dr, cr })

  it('balances each account: debits less credits', () => {
    const b = balances(c)
    expect(Object.fromEntries([...b].map(([id, v]) => [id, v.balance]))).toEqual({ 'bank': 400, 'capital': -600, 'equipment': 250, 'p-lee': 50, 'rent': 40, 'sales': -140 })
    expect(trialTotals(c)).toEqual({ dr: 740, cr: 740 })
    expect(usedAccounts(c).map((a) => a.label)).toEqual(['Bank', 'Capital', 'Equipment', 'Lee', 'Rent', 'Sales'])
  })

  it('starts empty and is solved by each balance in its column, with totals that agree', () => {
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    const solved = engine.solve(c)
    expect(engine.check(c, solved)).toEqual({ ok: true, wrongIds: [] })
    expect(typedTotals(solved.rows!)).toEqual({ dr: 740, cr: 740 })
  })

  it('says what each wrong row did', () => {
    expect(judgeRow(c, 'bank', row('', '400')).said).toBe("You put Bank's balance in the credit column, but its debits ($690) are more than its credits ($290), so it is a debit balance.")
    expect(judgeRow(c, 'bank', row('', '300')).said).toBe("You put Bank's balance in the credit column, but its debits ($690) are more than its credits ($290), so it is a debit balance of the difference.")
    expect(judgeRow(c, 'bank', row('690', '')).said).toBe('You entered $690 for Bank, but its debits total $690 and its credits $290: the balance is the difference.')
    expect(judgeRow(c, 'bank', row('400', '400')).status).toBe('both')
    expect(judgeRow(c, 'bank', row('', '')).said).toBe('Bank has no balance entered.')
    expect(judgeRow(c, 'bank', row('four hundred', '')).said).toBe('You wrote "four hundred" for Bank, which is not a whole number of dollars.')
    expect(judgeRow(c, 'bank', row('$400', '')).status).toBe('right')
    expect(judgeRow(c, 'capital', row('', '600')).status).toBe('right')
  })

  it('leaves out an account with no balance', () => {
    const s = read(SETTLED)
    expect(balances(s).get('p-ali')).toEqual({ dr: 200, cr: 200, balance: 0 })
    expect(rightRow(s, 'p-ali')).toEqual({ dr: '', cr: '' })
    expect(judgeRow(s, 'p-ali', row('', '')).status).toBe('right')
    expect(judgeRow(s, 'p-ali', row('0', '')).status).toBe('right')
    expect(judgeRow(s, 'p-ali', row('', '200')).said).toBe('You entered $200 for Ali, but its debits and credits are equal ($200 each): it has no balance, so it is left out.')
    expect(engine.check(s, engine.solve(s)).ok).toBe(true)
  })

  it('reads amounts as whole dollars', () => {
    expect([readAmount('380'), readAmount('$380'), readAmount(' 1,200 '), readAmount('380.00'), readAmount(''), readAmount('3.5'), readAmount('x'), readAmount(undefined)])
      .toEqual([380, 380, 1200, 380, null, 'bad', 'bad', null])
  })

  it('never fails on a state it cannot read', () => {
    for (const bad of [null, {}, { rows: 'x' }, { rows: { bank: 5, capital: { dr: 3 } } }]) expect(engine.check(c, bad as never).ok).toBe(false)
  })
})

describe('marking find-error', () => {
  const c = read(FIND)
  it('shows the reversed posting swapped and the rest right', () => {
    expect(enginePosts(c)).toEqual([{ dr: 'cash', cr: 'capital' }, { dr: 'purchases', cr: 'cash' }, { dr: 'cash', cr: 'wages' }])
    // A complete reversal leaves the trial balance agreeing (0452 syllabus 3.2).
    const t = trialTotals(c)
    expect(t.dr).toBe(t.cr)
  })
  it('is right only for the reversed transaction', () => {
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    expect(engine.check(c, { pick: 2 })).toEqual({ ok: true, wrongIds: [] })
    expect(engine.check(c, { pick: 0 })).toEqual({ ok: false, wrongIds: ['t0'] })
    expect(engine.check(c, { pick: 9 } as never).ok).toBe(false)
  })
})

// ── Every config ────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUPPLIERS = ['Ali', 'Musa', 'Ngozi Obi']
const CUSTOMERS = ['Lee', 'Tari', 'Ines']
const OWNERS = [null, 'Amira', 'Ben', 'Sara Mensah']

/** Every type with every way it may be paid. */
const VARIANTS: { type: TxType; by: By | null }[] = TX_TYPES.flatMap((type) => (RULES[type].methods ?? [null]).map((by) => ({ type, by })))

const asTx = (v: { type: TxType; by: By | null }, amount: number, rand: () => number): Record<string, unknown> => ({
  type: v.type, amount, ...(v.by ? { by: v.by } : {}),
  ...(RULES[v.type].person ? { name: (RULES[v.type].person === 'supplier' ? SUPPLIERS : CUSTOMERS)[Math.floor(rand() * 3)] } : {}),
})

/** A story that can happen, from the business's first day, for trial-balance and find-error. */
function story(rand: () => number, n: number): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  let cash = 0
  let bank = 0
  const owed = new Map<string, number>()
  const owing = new Map<string, number>()
  const amount = (most: number) => 1 + Math.floor(rand() * Math.max(1, Math.min(999, most)))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  for (let k = 0; k < n; k++) {
    const can: (() => Record<string, unknown>)[] = [
      () => { const a = amount(999); const by = pick(['cash', 'cheque'] as const); if (by === 'cash') cash += a; else bank += a; return { type: 'capital', amount: a, by } },
      () => { const a = amount(500); const by = pick(['cash', 'transfer'] as const); if (by === 'cash') cash += a; else bank += a; return { type: 'sale', amount: a, by } },
      () => { const a = amount(400); const name = pick(SUPPLIERS); owed.set(name, (owed.get(name) ?? 0) + a); return { type: 'credit-purchase', amount: a, name } },
      () => { const a = amount(400); const name = pick(CUSTOMERS); owing.set(name, (owing.get(name) ?? 0) + a); return { type: 'credit-sale', amount: a, name } },
    ]
    const spend = (type: string, extra: Record<string, unknown> = {}, limit = Infinity) => {
      if (cash > 0) can.push(() => { const a = amount(Math.min(cash, limit)); cash -= a; if (extra.name) owed.set(extra.name as string, owed.get(extra.name as string)! - a); return { type, amount: a, by: 'cash', ...extra } })
      if (bank > 0) can.push(() => { const a = amount(Math.min(bank, limit)); bank -= a; if (extra.name) owed.set(extra.name as string, owed.get(extra.name as string)! - a); return { type, amount: a, by: pick(['cheque', 'transfer']), ...extra } })
    }
    for (const type of ['purchase', 'buy-equipment', 'pay-rent', 'pay-wages', 'drawings']) spend(type)
    for (const [name, due] of owed) if (due > 0) spend('pay-supplier', { name }, due)
    for (const [name, due] of owing) {
      if (due > 0) can.push(() => { const a = amount(due); owing.set(name, due - a); const by = pick(['cash', 'cheque'] as const); if (by === 'cash') cash += a; else bank += a; return { type: 'customer-pays', amount: a, by, name } })
    }
    if (cash > 0) can.push(() => { const a = amount(cash); cash -= a; bank += a; return { type: 'cash-to-bank', amount: a } })
    if (bank > 0) can.push(() => { const a = amount(bank); bank -= a; cash += a; return { type: 'bank-to-cash', amount: a } })
    out.push(pick(can)())
  }
  return out
}

/** Valid configs of one kind, at random. */
function randomConfigs(kind: 'post' | 'trial-balance' | 'find-error', count: number, seed: number): LedgerConfig[] {
  const rand = mulberry32(seed)
  const out: LedgerConfig[] = []
  for (let tries = 0; out.length < count && tries < count * 50; tries++) {
    const owner = OWNERS[Math.floor(rand() * OWNERS.length)]
    let transactions: Record<string, unknown>[]
    if (kind === 'post') {
      const n = 1 + Math.floor(rand() * 4)
      transactions = Array.from({ length: n }, () => asTx(VARIANTS[Math.floor(rand() * VARIANTS.length)], 1 + Math.floor(rand() * 999), rand))
    } else {
      transactions = story(rand, kind === 'trial-balance' ? 2 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 2))
    }
    const raw = { task: { kind, ...(owner ? { owner } : {}), transactions, ...(kind === 'find-error' && rand() < 0.5 ? { reversed: 1 + Math.floor(rand() * transactions.length) } : {}) } }
    const c = engine.parse(raw)
    if (c && engine.faults(c).length === 0) out.push(c)
  }
  return out
}

/** Every way the promises can break for one config, in words; `marked` also draws it marked every way. */
function broken(c: LedgerConfig, marked = true): string[] {
  const bad: string[] = []
  const name = `${c.task.kind} ${JSON.stringify(c.task.transactions.map((t) => [t.type, t.by, t.amount, t.name]))}`
  const ok = (s: LedgerState) => engine.check(c, s).ok
  if (ok(engine.initial(c))) bad.push(`${name}: solved at the start`)
  const solved = engine.solve(c)
  if (!ok(solved)) bad.push(`${name}: its solution fails`)

  if (c.task.kind === 'post') {
    const shown = accountsShown(c)
    const ids = shown.map((a) => a.id)
    if (shown.length < 4 || shown.length > MAX_ACCOUNTS) bad.push(`${name}: ${shown.length} accounts shown`)
    if (new Set(shown.map((a) => a.label.toLowerCase())).size !== shown.length) bad.push(`${name}: two accounts share a label`)
    if ([...ids].sort((a, b) => labelOf(c, a).localeCompare(labelOf(c, b), 'en', { sensitivity: 'base' })).join() !== ids.join()) bad.push(`${name}: accounts not alphabetical`)
    c.task.transactions.forEach((t, i) => {
      const e = entryOf(t)
      if (e.dr === e.cr) bad.push(`${name}: transaction ${i + 1} debits and credits one account`)
      if (!ids.includes(e.dr) || !ids.includes(e.cr)) bad.push(`${name}: transaction ${i + 1}'s accounts are not shown`)
      if (!reason(c, t, 'dr') || !reason(c, t, 'cr')) bad.push(`${name}: transaction ${i + 1} has no reason`)
      const posts = solved.posts!.map((p) => ({ ...p }))
      const at = (p: Posting) => ok({ posts: posts.map((q, j) => (j === i ? p : q)) })
      if (at({ dr: e.cr, cr: e.dr })) bad.push(`${name}: transaction ${i + 1} passes reversed`)
      for (const id of ids) {
        if (id !== e.dr && at({ dr: id, cr: e.cr })) bad.push(`${name}: transaction ${i + 1} passes debiting ${id}`)
        if (id !== e.cr && at({ dr: e.dr, cr: id })) bad.push(`${name}: transaction ${i + 1} passes crediting ${id}`)
      }
      if (judgePosting(c, i, { dr: e.cr, cr: e.dr }).said.length === 0) bad.push(`${name}: a reversal says nothing`)
    })
  }

  if (c.task.kind === 'trial-balance') {
    const rows = solved.rows!
    const t = trialTotals(c)
    if (t.dr !== t.cr || t.dr === 0) bad.push(`${name}: the trial balance does not agree (${t.dr} against ${t.cr})`)
    const typed = typedTotals(rows)
    if (typed.dr !== t.dr || typed.cr !== t.cr) bad.push(`${name}: the solution's totals are not the trial balance's`)
    for (const a of usedAccounts(c)) {
      const r = rows[a.id]
      const b = balances(c).get(a.id)!.balance
      if ((b > 0 && a.role === 'supplier') || (b < 0 && (a.role === 'customer' || a.id === 'cash' || a.id === 'bank'))) bad.push(`${name}: ${a.id} ends on the wrong side`)
      if (b === 0) {
        if (ok({ rows: { ...rows, [a.id]: { dr: '1', cr: '' } } })) bad.push(`${name}: ${a.id} passes with an amount it does not have`)
        continue
      }
      if (ok({ rows: { ...rows, [a.id]: { dr: r.cr, cr: r.dr } } })) bad.push(`${name}: ${a.id} passes in the wrong column`)
      const off = String(Math.abs(b) + 1)
      if (ok({ rows: { ...rows, [a.id]: b > 0 ? { dr: off, cr: '' } : { dr: '', cr: off } } })) bad.push(`${name}: ${a.id} passes with the wrong amount`)
      if (ok({ rows: { ...rows, [a.id]: { dr: '', cr: '' } } })) bad.push(`${name}: ${a.id} passes left out`)
    }
  }

  if (c.task.kind === 'find-error') {
    const r = c.task.reversed!
    c.task.transactions.forEach((_, i) => {
      if (i !== r && ok({ pick: i })) bad.push(`${name}: transaction ${i + 1} passes as the reversed one`)
    })
    const posts = enginePosts(c)
    const right = enginePosts(c, false)
    posts.forEach((p, i) => {
      const same = p.dr === right[i].dr && p.cr === right[i].cr
      if (same !== (i !== r)) bad.push(`${name}: transaction ${i + 1} is ${same ? 'not ' : ''}reversed`)
    })
    const t = trialTotals(c)
    if (t.dr !== t.cr) bad.push(`${name}: the reversal unbalanced the trial balance`)
  }

  // Nothing names the answer before it is marked; every marking draws.
  const idle = text(view(c, engine.initial(c), 'idle', false))
  if (/debited|credited|Not right|posted correctly|balance of \$|totals agree|is posted the wrong way round:/.test(idle)) bad.push(`${name}: the idle card names an answer`)
  c.task.transactions.forEach((t) => {
    for (const side of ['dr', 'cr'] as const) if (idle.includes(reason(c, t, side))) bad.push(`${name}: the idle card gives a reason`)
  })
  if (!marked) return bad
  for (const [mark, state] of [['wrong', engine.initial(c)], ['right', solved], ['shown', engine.initial(c)]] as const) {
    try {
      view(c, state, mark)
    } catch (err) {
      bad.push(`${name}: the ${mark} card failed: ${String(err)}`)
    }
  }
  return bad
}

describe('every config the engine accepts', { timeout: 30_000 }, () => {
  it('post, every transaction alone and every pair (every type and way of paying): starts unsolved, is solved by its double entries, fails every other posting, names nothing before marking', () => {
    const rand = mulberry32(1)
    const singles = VARIANTS.map((v) => read({ task: { kind: 'post', transactions: [asTx(v, 120, rand)] } }))
    expect(singles).toHaveLength(31)
    const pairs = VARIANTS.flatMap((a) => VARIANTS.map((b) => engine.parse({ task: { kind: 'post', owner: 'Amira', transactions: [asTx(a, 75, rand), asTx(b, 40, rand)] } })!))
      .filter((c) => engine.faults(c).length === 0)
    expect(pairs).toHaveLength(31 * 31)
    // Drawn marked for every single transaction; the pairs are drawn unmarked, where an answer could leak.
    expect([...singles.flatMap((c) => broken(c)), ...pairs.flatMap((c) => broken(c, false))]).toEqual([])
  })

  it('post, 300 random of one to four transactions: the same', () => {
    const configs = randomConfigs('post', 300, 11)
    expect(configs).toHaveLength(300)
    expect(new Set(configs.map((c) => c.task.transactions.length))).toEqual(new Set([1, 2, 3, 4]))
    expect(configs.flatMap((c) => broken(c))).toEqual([])
  })

  it('trial-balance, 300 random stories: agrees, every balance on the side its account takes, fails every wrong row', () => {
    const configs = randomConfigs('trial-balance', 300, 22)
    expect(configs).toHaveLength(300)
    expect(configs.flatMap((c) => broken(c))).toEqual([])
    // Some stories close an account, which the trial balance leaves out.
    expect(configs.some((c) => [...balances(c).values()].some((b) => b.balance === 0))).toBe(true)
  })

  it('find-error, 300 random stories: exactly the reversed posting is swapped, the trial balance still agrees, only it passes', () => {
    const configs = randomConfigs('find-error', 300, 33)
    expect(configs).toHaveLength(300)
    expect(configs.flatMap((c) => broken(c))).toEqual([])
  })

  it('never fails on a config it refuses, either', () => {
    const rand = mulberry32(44)
    for (let i = 0; i < 300; i++) {
      const kind = (['post', 'trial-balance', 'find-error'] as const)[i % 3]
      const n = 1 + Math.floor(rand() * 7)
      const transactions = Array.from({ length: n }, () => {
        const v = VARIANTS[Math.floor(rand() * VARIANTS.length)]
        const t = asTx(v, 1 + Math.floor(rand() * 2000), rand)
        if (rand() < 0.2) delete t.name
        return t
      })
      const c = engine.parse({ task: { kind, transactions, reversed: Math.floor(rand() * 9) } })
      if (!c) continue
      expect(() => {
        engine.faults(c)
        engine.promptFaults(c, 'Debit Cash and credit Lee; transaction 2 is the 400 one.')
        engine.check(c, engine.solve(c))
        for (const marked of ['idle', 'wrong', 'right', 'shown'] as const) view(c, engine.solve(c), marked)
      }).not.toThrow()
    }
  })
})

// ── On the board ────────────────────────────────────────────────────────────

describe('the ledger scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'ledger', config }, success: { kind: 'scene' } } },
    } as never)))

  it('post: draws every account as a T with a debit side and a credit side to tap, alphabetically, and says no side before marking', () => {
    const prompt = 'Post each of Amira’s transactions to the ledger.'
    const html = card(POST, prompt)
    const c = read(POST)
    const shown = accountsShown(c)
    // The accounts used, and the ones learners confuse them with.
    expect(shown.map((a) => a.label)).toEqual(['Ali', 'Bank', 'Capital', 'Cash', 'Drawings', 'Purchases', 'Sales'])
    for (const a of shown) {
      expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${a.label}, debit side: empty"`))
      expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${a.label}, credit side: empty"`))
    }
    expect(html).toMatch(/touch-manipulation/)
    const words = text(html.replace(prompt, ''))
    expect(words).toMatch(/Amira puts \$500 of personal savings into the business, in cash\./)
    expect(words).toMatch(/Posting transaction 1: tap the Dr side of the account to debit and the Cr side of the account to credit\./)
    expect(words).not.toMatch(/debited|credited|came into|left the|owes|separate from Amira, and|Right|dual aspect/)
  })

  it('trial-balance: draws the engine’s postings and an empty trial balance, with no balance before marking', () => {
    const prompt = 'Balance each of Ben’s accounts and enter the balances in the trial balance.'
    const html = card(TB, prompt)
    const words = text(html.replace(prompt, ''))
    for (const a of ['Bank', 'Capital', 'Equipment', 'Lee', 'Rent', 'Sales']) {
      expect(html).toMatch(new RegExp(`aria-label="${a}, debit column"`))
      expect(html).toMatch(new RegExp(`aria-label="${a}, credit column"`))
    }
    // The entries are there: Bank's details name the other account of each posting.
    expect(words).toMatch(/Bank, debit side: Dr 1 Capital 600 4 Lee 90/)
    expect(words).toMatch(/Bank, credit side: Cr 2 Equipment 250 5 Rent 40/)
    // But no balance: Bank's 400, Lee's 50 and the 740 total appear nowhere.
    expect(words).not.toMatch(/\b(400|50|740)\b/)
    expect(words).not.toMatch(/balance of|debit balance|credit balance|totals agree/)
  })

  it('find-error: posts every transaction alike, the reversed one with nothing to mark it out', () => {
    const prompt = 'One of Sara’s transactions has been posted the wrong way round. Which one?'
    const html = card(FIND, prompt)
    const buttons = [...html.matchAll(/<button[^>]*aria-pressed="false"[^>]*>/g)].map((m) => m[0].replace(/ref="[^"]*"/, ''))
    expect(buttons).toHaveLength(3)
    expect(new Set(buttons).size).toBe(1)
    const entries = [...html.matchAll(/<span data-entry="(\d)-(dr|cr)"[^>]*>/g)].map((m) => m[0].replace(/data-entry="[^"]*"/, ''))
    expect(entries).toHaveLength(6)
    expect(new Set(entries).size).toBe(1)
    expect(text(html.replace(prompt, ''))).not.toMatch(/posted correctly|is posted the wrong way round:|cannot reveal|\bthird\b/)
  })
})

describe('what the learner sees once marked', () => {
  it('post, wrong: says which are right and what each wrong one did', () => {
    const c = read(POST)
    const html = text(view(c, { posts: [{ dr: 'capital', cr: 'cash' }, { dr: 'purchases', cr: 'p-ali' }, { dr: 'bank', cr: 'sales' }] }, 'wrong'))
    expect(html).toMatch(/You posted 1 of 3 transactions right\./)
    expect(html).toMatch(/You debited Capital and credited Cash, the wrong way round: cash came into the business, so Cash is debited; the business is separate from Amira/)
    expect(html).toMatch(/You debited Bank, but this was in cash/)
    expect(html).not.toMatch(/dual aspect/)
  })

  it('post, right: explains every entry and the dual aspect', () => {
    const c = read(POST)
    const html = text(view(c, engine.solve(c), 'right'))
    expect(html).toMatch(/Debit Purchases: goods for resale came in, and goods bought to resell are purchases\./)
    expect(html).toMatch(/Credit Ali: Ali supplied the goods and is now owed \$200\./)
    expect(html).toMatch(/Debits total \$780, and credits total \$780\. Every transaction is recorded twice, once on each side, for the same amount: the dual aspect\./)
  })

  it('trial-balance: says what each wrong row did, and that totals can agree and still be wrong', () => {
    const c = read(TB)
    // Two errors that cancel: the totals agree, and the trial balance is still wrong.
    const cancel = { ...engine.solve(c).rows!, bank: { dr: '410', cr: '' }, 'p-lee': { dr: '40', cr: '' } }
    const html = text(view(c, { rows: cancel }, 'wrong'))
    expect(html).toMatch(/4 of 6 rows are right\. Your totals agree at \$740, but a trial balance can agree and still be wrong\./)
    expect(html).toMatch(/You entered \$410 for Bank, but its debits total \$690 and its credits \$290: the balance is the difference\./)
    const swapped = { ...engine.solve(c).rows!, bank: { dr: '', cr: '400' }, capital: { dr: '600', cr: '' } }
    const off = text(view(c, { rows: swapped }, 'wrong'))
    expect(off).toMatch(/Your totals do not agree: \$940 against \$540\./)
    expect(off).toMatch(/You put Bank's balance in the credit column/)
    const right = text(view(c, engine.solve(c), 'right'))
    expect(right).toMatch(/The totals agree: \$740 each\./)
    expect(right).toMatch(/Lee: a debit balance of \$50\./)
    const settled = text(view(read(SETTLED), engine.solve(read(SETTLED)), 'right'))
    expect(settled).toMatch(/Ali: its debits and credits are equal, so it has no balance and is left out\./)
  })

  it('find-error: names the reversal once found, and why the trial balance misses it', () => {
    const c = read(FIND)
    const right = text(view(c, { pick: 2 }, 'right'))
    expect(right).toMatch(/Transaction 3 is posted the wrong way round: Cash was debited and Wages credited\./)
    expect(right).toMatch(/Debit Wages: wages are an expense of the business\./)
    expect(right).toMatch(/so the trial balance agrees \(\$350 each\) and cannot reveal it/)
    const wrong = text(view(c, { pick: 0 }, 'wrong'))
    expect(wrong).toMatch(/You chose transaction 1, which is posted correctly: Cash was debited and Capital credited\./)
  })
})

describe('the catalogue entry', () => {
  const examples = engine.prompt.split(/\n\s*(?=\{ "type":"createActivity")/).slice(1).map((s) => JSON.parse(s))

  it('is registered for the tutor, isolating category', () => {
    expect(getEngine('ledger')).toBe(engine)
    expect(engine.isolates).toBe('category')
    expect(engine.prompt).toMatch(/^SCENE "ledger"/)
    for (const kind of ['post', 'trial-balance', 'find-error']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
  })

  it('gives examples the engine accepts as they stand, one of each kind', () => {
    expect(examples.map((e) => e.spec.payload.config.task.kind)).toEqual(['post', 'trial-balance', 'find-error'])
    for (const ex of examples) {
      expect(ex.spec.payload.engine).toBe('ledger')
      expect(ex.spec.success).toEqual({ kind: 'scene' })
      expect(ex.intent).toMatchObject({ isolates: 'category', apparatus: 'scene:ledger' })
      expect(engine.faults(read(ex.spec.payload.config))).toEqual([])
      expect(validateSpec(ex.spec)).toBe(true)
      expect(meaningFaults(ex)).toEqual([])
    }
  })

  it('is offered to the stations that teach double entry and the trial balance, and not to others', () => {
    for (const station of ['Double entry book-keeping – Part A', 'Extracting a Trial Balance', 'Chapter 4: Balancing accounts', 'Ledgers', 'Debits and credits']) {
      expect(sceneCatalogue(station), station).toContain('SCENE "ledger"')
    }
    for (const station of ['Phases of the Moon', 'Equivalent fractions', 'Break-even analysis']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "ledger"')
    }
    expect(scenesFor('The trial balance').map((e) => e.id)).toContain('ledger')
    expect(scenesFor('Double entry').map((e) => e.id)).toContain('ledger')
  })
})
