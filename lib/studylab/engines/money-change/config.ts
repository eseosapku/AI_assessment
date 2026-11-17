// lib/studylab/engines/money-change/config.ts
//
// Money at the shop counter. A till of coins, an empty number line on the counter, and the one move a shopkeeper makes:
//   change -- a customer has paid more than the price. Each coin taken from the till hops along the line from the price,
//             and the line says where the count has got to ("£3.40, then 10p makes £3.50, 50p makes £4.00, £1 makes
//             £5.00"), until it reaches what was paid. The change is the coins on the counter;
//   pay    -- the same line from 0p: put coins on the counter to make a price exactly. £1 and 50p land on £1.50, not on
//             £1.05, which is the decimal-point slip the task is for.
// Either task can ask for the fewest coins.
//
// The rules, all computed here and never read from the drawing: amounts are whole pence (or cents), so nothing is ever
// compared as a float; the change is paid minus price; the fewest coins come from trying every amount up (a coin
// table, so it is right for any set of coins, not only ones where taking the biggest coin first works).
//
// Facts:
//   - the coins are the UK's circulating set, 1p 2p 5p 10p 20p 50p £1 £2, and the notes £5 £10 £20 (Royal Mint, Bank of England);
//     the 20p and 50p are seven-sided, the £1 twelve-sided and the £2 two metals. Only those shapes are drawn: no national designs;
//   - the dollar set is a neutral one, 1c 5c 10c 25c 50c $1 $2 and notes $5 $10 $20, close to several dollar countries' coins
//     without being any one of them. The card writes cents with a plain c ("25c"), as Cambridge Primary does;
//   - amounts under one pound are written in pence ("45p"), amounts from a pound up with a point and two places ("£1.05"),
//     the usual school convention.
//
// Ideas taken, never code or art (notes in .superpowers/bakeoff/money-change/research.md):
//   - counting up from the price to the amount paid, on an empty number line or with coins in the hand: classroom guidance on
//     the common slips (adding the price to the money paid, "change is whatever coins the shopkeeper picks");
//   - a till of coin buttons, as in Shopkeeper Shrew, Money Lab and Candy Cashier; their running total in a box is replaced
//     by the counting line, so the counting on itself is what the learner sees;
//   - £1.05 read as "one pound five" and written £1.5 (decimal misconception research, Melbourne): the pay task.
// Refused: notes in the till (change stays at or under £5, all coins), a typed answer, real coin designs.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MoneyChangeView } from './View'

export const CURRENCIES = ['pounds', 'dollars'] as const
export type Currency = (typeof CURRENCIES)[number]
export const ITEMS = ['apple', 'ball', 'book', 'car', 'pencil'] as const
export type Item = (typeof ITEMS)[number]

/** The coins in the till, smallest first, in pence or cents. */
export const COINS: Record<Currency, number[]> = {
  pounds: [1, 2, 5, 10, 20, 50, 100, 200],
  dollars: [1, 5, 10, 25, 50, 100, 200],
}
/** The notes a customer may hand over. */
export const NOTES: Record<Currency, number[]> = { pounds: [500, 1000, 2000], dollars: [500, 1000, 2000] }

/** The counter holds one row of eight coins. */
export const MAX_COINS = 8
/** The fewest coins an answer may need: it must fit the counter. */
export const MAX_FEWEST = 8
export const MAX_CHANGE = 500
export const MAX_PAID = 2000
export const MAX_PAY = 1000
/** The customer's money is drawn as at most this many notes and coins. */
export const MAX_PAID_PIECES = 2

export type ChangeConfig = { task: 'change'; price: number; paid: number; fewest: boolean; currency: string; item: string }
export type PayConfig = { task: 'pay'; price: number; fewest: boolean; currency: string; item: string }
export type MoneyConfig = ChangeConfig | PayConfig
/** The coins on the counter, in the order they were counted out, in pence or cents. */
export type MoneyState = { coins: number[] }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const currencyOf = (config: MoneyConfig): Currency => (config.currency === 'dollars' ? 'dollars' : 'pounds')
export const coinsOf = (config: MoneyConfig) => COINS[currencyOf(config)]
export const itemOf = (config: MoneyConfig): Item => ((ITEMS as readonly string[]).includes(config.item) ? (config.item as Item) : 'book')

// ---------------------------------------------------------------------------
// Writing money.

/** "45p", "£1.05", "25c", "$6.35". */
export function fmt(currency: Currency, amount: number): string {
  const n = Math.round(amount)
  if (n < 100) return `${n}${currency === 'dollars' ? 'c' : 'p'}`
  return `${currency === 'dollars' ? '$' : '£'}${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`
}
/** A coin or note's own name: "10p", "£1", "£5", "25c", "$2". */
export function pieceName(currency: Currency, value: number): string {
  if (value < 100) return `${value}${currency === 'dollars' ? 'c' : 'p'}`
  return `${currency === 'dollars' ? '$' : '£'}${value / 100}`
}
/** "1 pound and 5 pence", "45 pence", "2 dollars": the amount said out, which is what the point means. */
export function said(currency: Currency, amount: number): string {
  const big = Math.floor(amount / 100)
  const small = amount % 100
  const bigWord = currency === 'dollars' ? (big === 1 ? 'dollar' : 'dollars') : big === 1 ? 'pound' : 'pounds'
  const smallWord = currency === 'dollars' ? (small === 1 ? 'cent' : 'cents') : small === 1 ? 'penny' : 'pence'
  if (big === 0) return `${small} ${smallWord}`
  if (small === 0) return `${big} ${bigWord}`
  return `${big} ${bigWord} and ${small} ${smallWord}`
}
/** Two, three ... eight, as words at the start of a sentence. */
const countWord = (n: number) => ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][n] ?? String(n)
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

// ---------------------------------------------------------------------------
// The fewest coins, by trying every amount up to the one asked: right for any set of coins.

const tables = new Map<string, number[]>()
function table(values: number[], upTo: number): number[] {
  const key = `${values.join(',')}:${upTo}`
  const known = tables.get(key)
  if (known) return known
  const best = Array.from({ length: upTo + 1 }, () => Infinity)
  best[0] = 0
  for (let a = 1; a <= upTo; a++) for (const v of values) if (v <= a && best[a - v] + 1 < best[a]) best[a] = best[a - v] + 1
  tables.set(key, best)
  return best
}

/** The fewest pieces from `values` that make `amount`, smallest first; null when none can. */
export function fewestOf(values: number[], amount: number): number[] | null {
  if (!Number.isInteger(amount) || amount < 0) return null
  const best = table(values, Math.max(amount, MAX_PAID))
  if (!Number.isFinite(best[amount])) return null
  const out: number[] = []
  let a = amount
  while (a > 0) {
    const v = [...values].reverse().find((c) => c <= a && best[a - c] === best[a] - 1)!
    out.push(v)
    a -= v
  }
  return out.sort((x, y) => x - y)
}
export const fewestCoins = (config: MoneyConfig, amount: number) => fewestOf(coinsOf(config), amount)
/** The customer's money: the fewest notes and coins that make what was paid, biggest first. */
export const paidPieces = (config: ChangeConfig) => (fewestOf([...COINS[currencyOf(config)], ...NOTES[currencyOf(config)]], config.paid) ?? []).reverse()

// ---------------------------------------------------------------------------
// The state, read safely, and the rule.

/** The coins on the counter, keeping only real coins of this till, at most a counter's worth. */
export function drawable(config: MoneyConfig, state: MoneyState | null | undefined): number[] {
  const raw = state && Array.isArray(state.coins) ? state.coins : []
  const real = coinsOf(config)
  return raw.filter((v) => typeof v === 'number' && real.includes(v)).slice(0, MAX_COINS)
}
export const sumOf = (coins: number[]) => coins.reduce((a, b) => a + b, 0)
/** Where the count starts: the price when giving change, nothing when paying. */
export const startOf = (config: MoneyConfig) => (config.task === 'change' ? config.price : 0)
/** Where the count must reach: what was paid, or the price. */
export const goalOf = (config: MoneyConfig) => (config.task === 'change' ? config.paid : config.price)
/** What the coins must add to: the change, or the price. */
export const targetOf = (config: MoneyConfig) => goalOf(config) - startOf(config)
/** Where the count stands after each coin, in order. */
export const runningOf = (config: MoneyConfig, coins: number[]) => {
  let at = startOf(config)
  return coins.map((c) => (at += c))
}
export const reachedOf = (config: MoneyConfig, coins: number[]) => startOf(config) + sumOf(coins)

export function done(config: MoneyConfig, state: MoneyState): boolean {
  const coins = drawable(config, state)
  if (sumOf(coins) !== targetOf(config)) return false
  return !config.fewest || coins.length === (fewestCoins(config, targetOf(config))?.length ?? -1)
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card shows only where the count has got to.

/** "£3.40, then 10p makes £3.50, 50p makes £4.00 and £1 makes £5.00". */
export function countingOn(config: MoneyConfig, coins: number[]): string {
  const cur = currencyOf(config)
  const run = runningOf(config, coins)
  const hops = coins.map((c, i) => `${pieceName(cur, c)} makes ${fmt(cur, run[i])}`)
  return `${fmt(cur, startOf(config))}, then ${list(hops)}`
}

/** What a correct card says: the amount, how the count went, and the fewest way when it was not asked. */
export function working(config: MoneyConfig, coins: number[]): string {
  const cur = currencyOf(config)
  const target = targetOf(config)
  const fewest = fewestCoins(config, target) ?? []
  const best = !config.fewest && coins.length > fewest.length
    ? ` The fewest coins for ${fmt(cur, target)} would be ${fewest.length}: ${list([...fewest].reverse().map((c) => pieceName(cur, c)))}.`
    : config.fewest ? ` ${coins.length === 1 ? 'One coin is' : `${countWord(coins.length)} coins are`} the fewest that can do it.` : ''
  if (config.task === 'change') {
    return `Yes. The change is ${fmt(cur, target)}. Counting on from the price: ${countingOn(config, coins)}, which is what was paid.${best}`
  }
  const words = target < 100
    ? `${fmt(cur, target)} is ${said(cur, target)}, the same as ${cur === 'dollars' ? '$' : '£'}0.${String(target).padStart(2, '0')}.`
    : `${fmt(cur, target)} is ${said(cur, target)}, which is ${target}${cur === 'dollars' ? 'c' : 'p'}.`
  return `Yes. That is exactly ${fmt(cur, target)}. ${words}${best}`
}

/** What a wrong card says: what the learner made, never which coins to use. */
export function madeText(config: MoneyConfig, coins: number[]): string {
  const cur = currencyOf(config)
  const n = coins.length
  const sum = sumOf(coins)
  const target = targetOf(config)
  if (n === 0) return config.task === 'change' ? 'No coins are on the counter yet: the count is still at the price.' : 'No coins are on the counter yet.'
  if (config.task === 'change') {
    const reached = reachedOf(config, coins)
    if (sum > target) return `You counted up to ${fmt(cur, reached)}, past the ${fmt(cur, config.paid)} that was paid, so the customer would get too much change.`
    if (sum < target) return `You counted up to ${fmt(cur, reached)}, but ${fmt(cur, config.paid)} was paid, so the customer would get too little change. Keep counting on.`
    const fewer = config.fewest && n > (fewestCoins(config, target)?.length ?? n)
    return `You counted up to ${fmt(cur, config.paid)} with ${n} ${n === 1 ? 'coin' : 'coins'}${fewer ? '. The same change can be made with fewer.' : ', which is what was paid.'}`
  }
  if (sum !== target) {
    return `You put ${fmt(cur, sum)} on the counter, which is ${said(cur, sum)}. The price, ${fmt(cur, target)}, is ${said(cur, target)}.`
  }
  const fewer = config.fewest && n > (fewestCoins(config, target)?.length ?? n)
  return `That makes ${fmt(cur, target)}, with ${n} ${n === 1 ? 'coin' : 'coins'}${fewer ? '. Fewer coins can make it.' : '.'}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'change' | 'pay'> = {
  change: 'change', 'give-change': 'change', 'giving-change': 'change', 'make-change': 'change', 'making-change': 'change', 'work-out-change': 'change',
  'working-out-change': 'change', 'find-change': 'change', 'calculate-change': 'change', 'count-on': 'change', 'counting-on': 'change', 'count-up': 'change',
  'counting-up': 'change', shopkeeper: 'change', 'shopkeepers-method': 'change', 'shopkeeper-s-method': 'change', 'shopkeeper-method': 'change', 'change-from': 'change',
  pay: 'pay', 'pay-exactly': 'pay', 'exact-money': 'pay', 'exact-amount': 'pay', exact: 'pay', make: 'pay', 'make-amount': 'pay', 'make-an-amount': 'pay',
  'make-the-amount': 'pay', 'making-amounts': 'pay', amount: 'pay', 'fewest-coins': 'pay', fewest: 'pay', 'count-money': 'pay', 'counting-money': 'pay',
  coins: 'pay', 'add-money': 'pay', 'adding-money': 'pay', total: 'pay', buy: 'pay',
}
const CURRENCY_WORDS: Record<string, Currency> = {
  pounds: 'pounds', pound: 'pounds', gbp: 'pounds', sterling: 'pounds', pence: 'pounds', 'pounds-and-pence': 'pounds', uk: 'pounds', p: 'pounds',
  dollars: 'dollars', dollar: 'dollars', usd: 'dollars', cents: 'dollars', 'dollars-and-cents': 'dollars', c: 'dollars',
}
const ITEM_WORDS: Record<string, Item> = {
  apple: 'apple', apples: 'apple', ball: 'ball', balls: 'ball', football: 'ball', 'soccer-ball': 'ball', book: 'book', books: 'book', 'story-book': 'book',
  car: 'car', cars: 'car', 'toy-car': 'car', 'toy-cars': 'car', pencil: 'pencil', pencils: 'pencil',
}

type Amount = { pence: number; hint: Currency | null }

/** "£3.40", "3.40", "340p", "$6.35", "25c", "5 pounds", 3.4 (a bare number is pounds or dollars). */
export function readAmount(raw: unknown): Amount | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? { pence: Math.round(raw * 100 * 1e6) / 1e6, hint: null } : null
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ')
  const m = s.match(/^([£$])?\s?(\d+(?:\.\d+)?|\.\d+)\s?(p|pence|penny|c|cents?|pounds?|dollars?|gbp|usd)?$/)
  if (!m) return null
  const n = Number(m[2])
  const unit = m[3] ?? ''
  const small = /^(p|pence|penny|c|cents?)$/.test(unit)
  const hint: Currency | null = m[1] === '£' || /^(p|pence|penny|pounds?|gbp)$/.test(unit) ? 'pounds' : m[1] === '$' || /^(c|cents?|dollars?|usd)$/.test(unit) ? 'dollars' : null
  return { pence: small && !m[1] ? n : Math.round(n * 100 * 1e6) / 1e6, hint }
}

function readFewest(raw: unknown, fromTask: boolean): boolean | null {
  if (raw === undefined || raw === null) return fromTask
  if (typeof raw === 'boolean') return raw
  const k = keyOf(raw)
  if (['true', 'yes', 'fewest', 'fewest-coins', 'least', 'minimum', 'min', '1'].includes(k)) return true
  if (['false', 'no', 'any', 'any-coins', '0', ''].includes(k)) return false
  return null
}

/** The smallest note or round amount a customer would hand over for this price. */
const handedFor = (price: number) => [100, 200, 500, 1000, 2000].find((p) => p > price) ?? 2000

/** What a prompt can safely say: the gesture, the item, the price and what was paid. */
export function goodPrompt(config: MoneyConfig): string {
  const cur = currencyOf(config)
  const item = itemOf(config)
  const few = config.fewest ? ', with the fewest coins you can' : ''
  if (config.task === 'change') {
    const pieces = paidPieces(config)
    const paid = pieces.length === 1 ? `a ${pieceName(cur, pieces[0])} ${pieces[0] >= 500 ? 'note' : 'coin'}` : fmt(cur, config.paid)
    return `Tap a coin in the till to count it out, and tap a coin on the counter to put it back. The ${item} costs ${fmt(cur, config.price)} and the customer pays with ${paid}. Count on from the price to give the right change${few}.`
  }
  return `Tap one of your coins to put it on the counter, and tap a coin on the counter to take it back. The ${item} costs ${fmt(cur, config.price)}. Pay exactly that${few}.`
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50 }

/** Every amount of money written in a prompt, in pence, with the currency its writing implies. */
export function amountsIn(text: string): { pence: number; hint: Currency | null; raw: string }[] {
  const out: { pence: number; hint: Currency | null; raw: string; at: number }[] = []
  const taken: [number, number][] = []
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x)
  const add = (m: RegExpMatchArray, pence: number, hint: Currency | null) => {
    const a = m.index!
    const b = a + m[0].length
    if (!free(a, b)) return
    taken.push([a, b])
    out.push({ pence: Math.round(pence * 1e6) / 1e6, hint, raw: m[0].trim(), at: a })
  }
  for (const m of text.matchAll(/([£$])\s?(\d+(?:\.\d+)?)/g)) add(m, Number(m[2]) * 100, m[1] === '£' ? 'pounds' : 'dollars')
  for (const m of text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s?(pence|penny|p|cents?|c)\b/gi)) add(m, Number(m[1]), /^p/i.test(m[2]) ? 'pounds' : 'dollars')
  for (const m of text.matchAll(/\b(\d+(?:\.\d+)?)\s+(pounds?|dollars?)\b/gi)) add(m, Number(m[1]) * 100, /^p/i.test(m[2]) ? 'pounds' : 'dollars')
  for (const m of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty)\s+(pounds?|dollars?|pence|cents?)\b/gi)) {
    const n = NUMBER_WORDS[m[1].toLowerCase()]
    add(m, /^(pence|cent)/i.test(m[2]) ? n : n * 100, /^p/i.test(m[2]) ? 'pounds' : 'dollars')
  }
  for (const m of text.matchAll(/(?<![\d.£$])(\d+\.\d\d)\b/g)) add(m, Number(m[1]) * 100, null)
  return out.sort((a, b) => a.at - b.at).map(({ pence, hint, raw }) => ({ pence, hint, raw }))
}

export const moneyChangeEngine: SceneEngine<MoneyConfig, MoneyState> = {
  id: 'money-change',
  // Few and distinctive: a covers word catches any station with that word, so "coins" (tossing a coin) and "pounds"
  // (pounds and ounces) live in phrases, with their near misses in notFor. "Change" is a word every topic uses.
  covers: ['pence'],
  phrases: [
    'money', 'coins', 'coins and notes', 'notes and coins', 'pounds and pence', 'dollars and cents', 'cents',
    'giving change', 'give change', 'working out change', 'work out change', 'calculating change', 'calculate change', 'making change', 'change from a note',
    'adding money', 'counting money', 'counting coins', 'money problems', 'making amounts', 'make amounts', 'making an amount', 'shopkeeper', 'shopping',
    'fewest coins', 'exact money', 'paying for things',
  ],
  // Near misses: money in economics, business and accounts; coins in probability; pounds as a weight; other scenes' money ideas.
  notFor: [
    'functions of money', 'money supply', 'supply of money', 'demand for money', 'quantity theory of money', 'money market', 'money markets', 'broad money', 'narrow money',
    'money creation', 'creation of money', 'money laundering', 'time value of money', 'money multiplier', 'money and banking', 'history of money', 'evolution of money',
    'characteristics of money', 'forms of money', 'barter', 'monetary policy', 'inflation', 'commodity money', 'fiat money',
    'exchange rate', 'exchange rates', 'currency exchange', 'foreign currency', 'foreign exchange', 'converting currency', 'currency conversion', 'converting currencies',
    'business costs', 'business finance', 'fixed costs', 'variable costs', 'profit and loss', 'profit', 'break-even', 'breakeven', 'revenue', 'cash flow',
    'bookkeeping', 'double entry', 'ledger', 'accounts', 'trial balance',
    'interest', 'simple interest', 'compound interest', 'interest rates', 'interest rate', 'savings account', 'percentages', 'percentage',
    'probability', 'tossing', 'toss', 'tosses', 'flipping', 'flip', 'flips', 'fair coin', 'biased coin', 'heads and tails',
    'pounds and ounces', 'ounces', 'imperial units', 'imperial measures', 'stones and pounds',
    'online shopping', 'shopping centre', 'shopping centres', 'shopping center', 'shopping centers', 'out of town shopping',
    'place value', 'climate change', 'change of state', 'changes of state', 'chemical change', 'physical change',
  ],
  // The learner varies how much money is on the counter, coin by coin.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ? { ...o, ...nested } : o
    const rawTask = first(src, nested ? ['kind', 'type', 'mode'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const priceRaw = first(src, ['price', 'cost', 'costs', 'amount', 'target', 'total', 'make'])
    const paidRaw = first(src, ['paid', 'pay', 'paidWith', 'paid_with', 'tendered', 'given', 'handed', 'note', 'customerPays', 'customer_pays'])
    const task = word ? TASK_WORDS[word] : paidRaw !== undefined ? 'change' : priceRaw !== undefined ? 'pay' : null
    if (!task) return null
    const price = readAmount(priceRaw)
    if (!price) return null
    const paid = task === 'change' ? (paidRaw === undefined ? { pence: handedFor(price.pence), hint: null } : readAmount(paidRaw)) : null
    if (task === 'change' && !paid) return null
    const fewest = readFewest(first(src, ['fewest', 'fewestCoins', 'fewest_coins', 'leastCoins', 'minimum']), /fewest/.test(word))
    if (fewest === null) return null
    const curRaw = first(src, ['currency', 'money', 'units'])
    const curKey = curRaw === '£' ? 'pounds' : curRaw === '$' ? 'dollars' : keyOf(curRaw)
    const currency = curRaw === undefined || curKey === ''
      ? price.hint ?? paid?.hint ?? 'pounds'
      : has(CURRENCY_WORDS, curKey) ? CURRENCY_WORDS[curKey] : curKey
    const itemRaw = first(src, ['item', 'thing', 'object', 'buying', 'product'])
    const itemKey = keyOf(itemRaw).replace(/^(?:a|an|the|one)-/, '')
    const item = itemRaw === undefined || itemKey === '' ? 'book' : has(ITEM_WORDS, itemKey) ? ITEM_WORDS[itemKey] : itemKey
    if (task === 'change') return { task, price: price.pence, paid: paid!.pence, fewest, currency, item }
    return { task, price: price.pence, fewest, currency, item }
  },

  faults(config) {
    const out: string[] = []
    if (!(CURRENCIES as readonly string[]).includes(config.currency)) {
      out.push(`The till counts only pounds and pence or dollars and cents, not "${config.currency}": use currency "pounds" or "dollars".`)
    }
    if (!(ITEMS as readonly string[]).includes(config.item)) {
      out.push(`There is no drawing of "${config.item}" on this counter: use one of ${list([...ITEMS])}, e.g. item "book".`)
    }
    const cur = currencyOf(config)
    const unit = cur === 'dollars' ? 'cent' : 'penny'
    const priceOk = Number.isInteger(config.price) && config.price > 0
    if (!Number.isInteger(config.price)) out.push(`The price must be a whole number of pence or cents, not part of a ${unit}: use e.g. price "${fmt(cur, 340)}".`)
    else if (config.price <= 0) out.push(`The price must be more than nothing: use e.g. price "${fmt(cur, 340)}".`)

    if (config.task === 'change') {
      const paidOk = Number.isInteger(config.paid) && config.paid > 0
      if (!paidOk) out.push(`What was paid must be a whole number of pence or cents, more than nothing: use e.g. paid "${fmt(cur, 500)}".`)
      else if (config.paid > MAX_PAID) out.push(`The customer pays with at most ${fmt(cur, MAX_PAID)} here: use e.g. paid "${fmt(cur, 500)}" or "${fmt(cur, 1000)}".`)
      else if (paidPieces(config).length > MAX_PAID_PIECES) {
        out.push(`${fmt(cur, config.paid)} takes ${paidPieces(config).length} notes and coins to hand over, and the counter shows at most ${MAX_PAID_PIECES}: pay with one note or coin, e.g. paid "${fmt(cur, handedFor(priceOk ? config.price : 340))}".`)
      }
      if (priceOk && paidOk && config.paid <= MAX_PAID) {
        const change = config.paid - config.price
        const nearPrice = config.paid > 160 ? config.paid - 160 : 340
        const nearPaid = config.paid > 160 ? config.paid : 500
        if (change <= 0) out.push(`The customer must pay more than the price (${fmt(cur, config.price)}) for there to be change: use e.g. paid "${fmt(cur, handedFor(config.price))}".`)
        else if (change > MAX_CHANGE) out.push(`The change would be ${fmt(cur, change)}, more than the till gives in coins (${fmt(cur, MAX_CHANGE)} at most): use e.g. price "${fmt(cur, nearPrice)}" with paid "${fmt(cur, nearPaid)}".`)
        else {
          const n = fewestCoins(config, change)?.length ?? Infinity
          if (n > MAX_FEWEST) out.push(`The change, ${fmt(cur, change)}, needs ${n} coins at the fewest, more than this card counts out (${MAX_FEWEST}): use e.g. price "${fmt(cur, nearPrice)}" with paid "${fmt(cur, nearPaid)}".`)
        }
      }
    } else if (priceOk) {
      if (config.price > MAX_PAY) out.push(`The card makes amounts up to ${fmt(cur, MAX_PAY)} in coins, not ${fmt(cur, config.price)}: use e.g. price "${fmt(cur, 105)}".`)
      else {
        const n = fewestCoins(config, config.price)?.length ?? Infinity
        if (n > MAX_FEWEST) out.push(`${fmt(cur, config.price)} needs ${n} coins at the fewest, more than this card counts out (${MAX_FEWEST}): use e.g. price "${fmt(cur, 105)}" or "${fmt(cur, 275)}".`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const cur = currencyOf(config)
    const example = goodPrompt(config)
    const out: string[] = []
    const allowed = new Set<number>([config.price, ...(config.task === 'change' ? [config.paid, ...paidPieces(config)] : [])])
    const found = amountsIn(text)
    const other = found.filter((a) => !allowed.has(a.pence)).map((a) => a.raw)
    if (other.length) {
      out.push(`the prompt names ${list(other.map((r) => `"${r}"`))}, an amount the learner is to find or a coin to use: give only the price${config.task === 'change' ? ' and what was paid' : ''} ("${example}")`)
    }
    const wrongCurrency = found.filter((a) => a.hint && a.hint !== cur).length > 0
      || (cur === 'pounds' ? /\b(?:dollars?|cents?)\b/i.test(text) : /\b(?:pounds?|pence|penny)\b/i.test(text))
    if (wrongCurrency) {
      out.push(`the card counts in ${cur === 'dollars' ? 'dollars and cents' : 'pounds and pence'}, so the prompt must write its amounts that way ("${example}")`)
    }
    if (/(?<![£$\d.])\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+)?coins?\b(?!\s+at\s+a\s+time)/i.test(text)) {
      out.push(`the prompt says how many coins, which the learner is to find with the till ("${example}")`)
    }
    const asksFewest = /\bfewest\b|\bleast\b[^.]{0,24}\bcoins?\b|\bas few\b|\bsmallest number of coins\b|\bminimum number of coins\b|\bfewer coins\b/i.test(text)
    if (asksFewest && !config.fewest) out.push(`the prompt asks for the fewest coins, but this config marks any coins that make the amount: set "fewest": true, or leave it out of the prompt ("${example}")`)
    if (!asksFewest && config.fewest) out.push(`this config marks only the fewest coins, so the prompt must ask for them ("${example}")`)
    if (config.task === 'change' && !/\bchange\b/i.test(text)) out.push(`this card gives change from what was paid, so the prompt must ask for the change ("${example}")`)
    if (config.task === 'pay' && /\b(?:give|giving|work out|count out|find|calculate)\s+(?:the\s+)?change\b/i.test(text)) {
      out.push(`this card pays a price exactly and gives no change; for change, use task "change" with what was paid ("${example}")`)
    }
    const items = ITEMS.filter((i) => i !== itemOf(config) && new RegExp(`\\b${i}s?\\b`, 'i').test(text))
    if (items.length) out.push(`the card draws ${itemOf(config) === 'apple' ? 'an' : 'a'} ${itemOf(config)}, not ${list(items.map((i) => `${i === 'apple' ? 'an' : 'a'} ${i}`))}: set item to match, or change the prompt ("${example}")`)
    if (/\bdrag|\bdrop\b|\bslide\b|\btype\b|\bwrite\b|\bcalculator|\breceipt|\bcard payment|\bcontactless|\bbank ?card|\bscan|\bnotes? (?:from|in) the till\b/i.test(text)) {
      out.push(`the prompt promises something the card does not do: the learner taps coins in the till onto the counter, and the till holds only coins ("${example}")`)
    }
    return out
  },

  initial() {
    return { coins: [] }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    // Smallest first is counting on: the small coins reach a round amount, then the big ones go on from there.
    return { coins: fewestCoins(config, targetOf(config)) ?? [] }
  },

  View: MoneyChangeView,

  prompt: `SCENE "money-change" -- a shop counter drawn on a quiet light panel, for money in the primary years. An item (apple, ball, book, toy car or pencil, named under it) with a paper price tag; for change, the customer's note or coins lie beside it, named "paid". Below sits a till drawer of flat coins, each with its value on it and the real shapes (20p and 50p seven-sided, £1 twelve-sided, £2 two metals; a neutral dollar set 1c 5c 10c 25c 50c $1 $2). The learner taps a coin in the till and it hops onto an empty number line on the counter; the line starts at the price (change) or at 0p (pay), and under each hop it writes where the count has got to, e.g. "£3.40, then 10p: £3.50, 50p: £4.00, £1: £5.00". Tapping a coin on the counter puts it back; the counter holds 8 coins. Under the picture: "Counted up to" and the goal ("Paid" or "Price"), and "Coins" when fewest is asked.
  For: recognising coins and their values, making an amount, making it with the fewest coins, giving change by counting on from the price to the amount paid (the shopkeeper's method), adding amounts, and pounds and pence (or dollars and cents) written with a point: £1.05 is 1 pound and 5 pence, not £1.50. Not for exchange rates, percentages, interest, profit, business costs or bookkeeping.
  change: the customer paid more than the price; the learner counts out the change from the till. Right when the coins come to paid minus price exactly. price and paid as money, e.g. "£3.40" and "£5" (paid is drawn as one or two notes or coins, at most £20; change at most £5, needing at most 8 coins). If paid is left out, the next round amount above the price is used.
  pay: the learner puts coins on the counter to make the price exactly (up to £10, at most 8 coins at the fewest).
  fewest: true marks only the fewest coins that make it (default false, when any coins that make it are right, and the marking then shows the fewest way). currency: "pounds" (default) or "dollars". item: apple, ball, book, car or pencil (default book).
  Before marking the card shows the price, what was paid, the coins counted and where the count has got to. It holds back the amount of change and whether it is right. Marking says the change and the counting on, or what the learner made. The prompt says the gesture, the item, the price and what was paid only: do NOT give the change, a coin to use, a count to reach on the way, or how many coins. If fewest is true the prompt must ask for the fewest coins; if not, it must not.
  config: { "task":"change", "price":"£3.40", "paid":"£5", "item":"book" }
       or { "task":"change", "price":"$6.35", "paid":"$10", "currency":"dollars", "fewest":true, "item":"ball" }
       or { "task":"pay", "price":"£1.05", "fewest":true, "item":"apple" }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a coin in the till to count it out, and tap a coin on the counter to put it back. The book costs £3.40 and the customer pays with a £5 note. Count on from the price to give the right change.",
    "payload": { "engine":"money-change", "config": { "task":"change", "price":"£3.40", "paid":"£5", "item":"book" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:money-change", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a coin in the till to count it out, and tap a coin on the counter to put it back. The ball costs $6.35 and the customer pays with a $10 note. Count on from the price to give the right change, with the fewest coins you can.",
    "payload": { "engine":"money-change", "config": { "task":"change", "price":"$6.35", "paid":"$10", "currency":"dollars", "fewest":true, "item":"ball" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:money-change", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap one of your coins to put it on the counter, and tap a coin on the counter to take it back. The apple costs £1.05. Pay exactly that, with the fewest coins you can.",
    "payload": { "engine":"money-change", "config": { "task":"pay", "price":"£1.05", "fewest":true, "item":"apple" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:money-change", "why":"..." } }`,
}

registerEngine(moneyChangeEngine as SceneEngine<unknown, unknown>)
