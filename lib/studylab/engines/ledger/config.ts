// lib/studylab/engines/ledger/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LedgerView } from './View'

/**
 * Double entry at Cambridge IGCSE Accounting (0452) level: a business's ledger
 * as T-accounts, each with a debit (Dr) and a credit (Cr) side. The tutor names
 * transactions from a fixed list; the engine writes them out, knows each one's
 * double entry, posts or marks it, and balances the accounts.
 *
 * Source for every rule here: Cambridge IGCSE Accounting 0452 syllabus,
 *   2.1 The double entry system of book-keeping (post transactions to ledger
 *       accounts; balance them; the sales, purchases and nominal ledgers);
 *   3.1 The trial balance (prepare one from a list of balances);
 *   3.2 Correction of errors (complete reversal of entries is an error the
 *       trial balance does not reveal);
 *   7.1 Accounting principles (business entity; duality, the dual aspect).
 * Account names follow the syllabus and its endorsed coursebooks, as the
 * repo's own figure families do (scripts/figgen/families/t_account.py,
 * trial_balance.py): goods bought for resale go to Purchases, not Inventory
 * (Inventory is only the year-end figure); a credit customer or supplier has a
 * personal account in their own name.
 *
 * Only transactions whose double entry cannot be argued are offered. Returns,
 * discounts, loans, credit purchases of non-current assets, opening balances
 * and the balancing (c/d, b/d) lines themselves are left for later.
 */

// ── Accounts ────────────────────────────────────────────────────────────────

export const FIXED = ['bank', 'capital', 'cash', 'drawings', 'equipment', 'purchases', 'rent', 'sales', 'wages'] as const
export type FixedId = (typeof FIXED)[number]
export const FIXED_LABEL: Record<FixedId, string> = {
  bank: 'Bank', capital: 'Capital', cash: 'Cash', drawings: 'Drawings', equipment: 'Equipment',
  purchases: 'Purchases', rent: 'Rent', sales: 'Sales', wages: 'Wages',
}
export type Side = 'dr' | 'cr'
export type Role = 'supplier' | 'customer'
export interface Account { id: string; label: string; role: Role | null }

/** "Ali Khan", "ali-khan" and "ALI KHAN" are one person. */
export const slug = (s: string) => s.trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tidy = (s: string) => s.trim().replace(/\s+/g, ' ')
/** A person's account id, apart from the fixed accounts' ids. */
export const personId = (name: string) => `p-${slug(name)}`
const upper = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ── Transactions ────────────────────────────────────────────────────────────

export const TX_TYPES = [
  'capital', 'credit-purchase', 'purchase', 'sale', 'credit-sale', 'pay-supplier', 'buy-equipment',
  'customer-pays', 'pay-rent', 'pay-wages', 'drawings', 'cash-to-bank', 'bank-to-cash',
] as const
export type TxType = (typeof TX_TYPES)[number]
/** How money moves: notes and coins (the Cash account), or through the bank (the Bank account). */
export const METHODS = ['cash', 'cheque', 'transfer'] as const
export type By = (typeof METHODS)[number]
export interface Tx { type: TxType; amount: number; by: By | null; name: string | null }

export const KINDS = ['post', 'trial-balance', 'find-error'] as const
export type Kind = (typeof KINDS)[number]
export interface LedgerConfig {
  task: {
    kind: Kind
    /** The owner's name, or null for "the owner". */
    owner: string | null
    transactions: Tx[]
    /** find-error: which transaction (from 0) is posted the wrong way round; null otherwise. */
    reversed: number | null
  }
}

/** One transaction's two entries, as the learner chose them: account ids, or null when not yet chosen. */
export interface Posting { dr: string | null; cr: string | null }
/** A trial-balance row as typed: the debit column and the credit column. */
export interface TbRow { dr: string; cr: string }
/** post: `posts`; trial-balance: `rows` by account id; find-error: `pick`, the transaction chosen (from 0). */
export interface LedgerState { posts?: Posting[]; rows?: Record<string, TbRow>; pick?: number | null }

/**
 * Each transaction the engine knows, with its double entry (0452 syllabus 2.1).
 * `money` is Cash when paid in cash, Bank when by cheque or bank transfer.
 */
interface Rule {
  /** In a fault: "transaction 2 (a credit purchase)". */
  title: string
  /** Who the named person is, for those that need one. */
  person: Role | null
  /** The ways it may be paid, or null when the type says (cash into the bank). */
  methods: readonly By[] | null
  usual: By | null
  dr: 'money' | 'person' | FixedId
  cr: 'money' | 'person' | FixedId
  /** Accounts a learner is apt to confuse it with, shown beside the right ones in post. */
  foils: FixedId[]
}

const ALL: readonly By[] = METHODS
export const RULES: Record<TxType, Rule> = {
  // The owner brings money in: the business has it (Dr Cash/Bank) and owes it to the owner (Cr Capital).
  'capital': { title: 'capital brought in', person: null, methods: ALL, usual: 'cash', dr: 'money', cr: 'capital', foils: ['drawings'] },
  // Goods for resale bought on credit: Dr Purchases, Cr the supplier's personal account.
  'credit-purchase': { title: 'a credit purchase', person: 'supplier', methods: null, usual: null, dr: 'purchases', cr: 'person', foils: ['cash'] },
  // Goods for resale bought and paid for now: Dr Purchases, Cr Cash/Bank.
  'purchase': { title: 'a cash purchase', person: null, methods: ALL, usual: 'cash', dr: 'purchases', cr: 'money', foils: ['sales'] },
  // Goods sold and paid for now: Dr Cash/Bank, Cr Sales.
  'sale': { title: 'a cash sale', person: null, methods: ALL, usual: 'cash', dr: 'money', cr: 'sales', foils: ['purchases'] },
  // Goods sold on credit: Dr the customer's personal account, Cr Sales.
  'credit-sale': { title: 'a credit sale', person: 'customer', methods: null, usual: null, dr: 'person', cr: 'sales', foils: ['cash'] },
  // A supplier paid: Dr the supplier (owed less), Cr Cash/Bank.
  'pay-supplier': { title: 'paying a supplier', person: 'supplier', methods: ALL, usual: 'cheque', dr: 'person', cr: 'money', foils: ['purchases'] },
  // A non-current asset bought for use, not resale: Dr Equipment, Cr Cash/Bank (an error of principle puts it in Purchases).
  'buy-equipment': { title: 'buying equipment', person: null, methods: ALL, usual: 'cheque', dr: 'equipment', cr: 'money', foils: ['purchases'] },
  // A credit customer pays: Dr Cash/Bank, Cr the customer (owes less).
  'customer-pays': { title: 'a customer paying', person: 'customer', methods: ALL, usual: 'cheque', dr: 'money', cr: 'person', foils: ['sales'] },
  // An expense paid: Dr the expense account, Cr Cash/Bank.
  'pay-rent': { title: 'paying rent', person: null, methods: ALL, usual: 'cash', dr: 'rent', cr: 'money', foils: [] },
  'pay-wages': { title: 'paying wages', person: null, methods: ALL, usual: 'cash', dr: 'wages', cr: 'money', foils: [] },
  // The owner takes money for personal use: Dr Drawings (business entity: not a business expense), Cr Cash/Bank.
  'drawings': { title: 'drawings', person: null, methods: ALL, usual: 'cash', dr: 'drawings', cr: 'money', foils: ['capital'] },
  // Contra entries between the business's own cash and bank: Dr the one receiving, Cr the one giving.
  'cash-to-bank': { title: 'cash paid into the bank', person: null, methods: null, usual: null, dr: 'bank', cr: 'cash', foils: [] },
  'bank-to-cash': { title: 'cash taken from the bank', person: null, methods: null, usual: null, dr: 'cash', cr: 'bank', foils: [] },
}

/** The account a transaction's money moves through. */
const moneyOf = (t: Tx): FixedId => (t.by === 'cash' ? 'cash' : 'bank')

function accountOf(t: Tx, which: Rule['dr']): string {
  if (which === 'money') return moneyOf(t)
  if (which === 'person') return personId(t.name ?? '')
  return which
}

/** The transaction's double entry, as the 0452 syllabus has it. */
export function entryOf(t: Tx): { dr: string; cr: string } {
  const r = RULES[t.type]
  return { dr: accountOf(t, r.dr), cr: accountOf(t, r.cr) }
}

// ── Words ───────────────────────────────────────────────────────────────────

const money = (n: number) => `$${n}`
const how = (by: By | null) => (by === 'cash' ? 'in cash' : by === 'transfer' ? 'by bank transfer' : 'by cheque')
const ownerName = (c: LedgerConfig) => c.task.owner ?? 'the owner'

/** The transaction as the learner reads it: what happened, never how it is posted. */
export function narrate(c: LedgerConfig, t: Tx): string {
  const owner = upper(ownerName(c))
  const a = money(t.amount)
  const name = t.name ?? 'a supplier'
  switch (t.type) {
    case 'capital':
      return t.by === 'cash'
        ? `${owner} puts ${a} of personal savings into the business, in cash.`
        : `${owner} pays ${a} of personal savings into the business's bank account, ${how(t.by)}.`
    case 'credit-purchase': return `The business buys goods for resale for ${a}, on credit from ${name}.`
    case 'purchase': return `The business buys goods for resale for ${a}, paying ${how(t.by)}.`
    case 'sale': return `The business sells goods for ${a}, paid ${how(t.by)}.`
    case 'credit-sale': return `The business sells goods for ${a}, on credit to ${t.name ?? 'a customer'}.`
    case 'pay-supplier': return `The business pays ${name}, a supplier, ${a} ${how(t.by)}.`
    case 'buy-equipment': return `The business buys equipment for its own use for ${a}, paying ${how(t.by)}.`
    case 'customer-pays': return `${t.name ?? 'A customer'}, a customer, pays the business ${a} ${how(t.by)}.`
    case 'pay-rent': return `The business pays rent of ${a} ${how(t.by)}.`
    case 'pay-wages': return `The business pays wages of ${a} ${how(t.by)}.`
    case 'drawings':
      return t.by === 'cash'
        ? `${owner} takes ${a} in cash out of the business for personal use.`
        : `${owner} takes ${a} from the business's bank account for personal use.`
    case 'cash-to-bank': return `The business pays ${a} of its cash into its bank account.`
    case 'bank-to-cash': return `The business takes ${a} out of its bank account as cash for the till.`
  }
}

/**
 * Why an account of the transaction takes the side it does, as a clause that
 * reads after "Debit Cash: " or before ", so Cash is debited". Shown only once
 * the scene is marked.
 */
export function reason(c: LedgerConfig, t: Tx, side: Side): string {
  const r = RULES[t.type]
  const which = side === 'dr' ? r.dr : r.cr
  const owner = ownerName(c)
  const name = t.name ?? 'the other party'
  const contra = t.type === 'cash-to-bank' || t.type === 'bank-to-cash'
  if (which === 'money' || (contra && (which === 'cash' || which === 'bank'))) {
    const acc = which === 'money' ? moneyOf(t) : which
    if (acc === 'cash') return side === 'dr' ? (contra ? 'cash came into the till' : 'cash came into the business') : (contra ? 'cash left the till' : 'cash left the business')
    return side === 'dr' ? 'money came into the bank' : 'money left the bank'
  }
  switch (t.type) {
    case 'capital': return `the business is separate from ${owner}, and now owes ${owner} the ${money(t.amount)} put in as capital`
    case 'credit-purchase': return side === 'dr' ? 'goods for resale came in, and goods bought to resell are purchases' : `${name} supplied the goods and is now owed ${money(t.amount)}`
    case 'purchase': return 'goods for resale came in, and goods bought to resell are purchases'
    case 'sale': return 'goods went out to a customer, and goods sold are sales'
    case 'credit-sale': return side === 'dr' ? `${name} received the goods and now owes the business ${money(t.amount)}` : 'goods went out to a customer, and goods sold are sales'
    case 'pay-supplier': return `${name} received the money, so the business owes ${name} less`
    case 'buy-equipment': return 'the business gained equipment, an asset it keeps and uses, not goods to resell'
    case 'customer-pays': return `${name} paid, so ${name} owes the business less`
    case 'pay-rent': return 'rent is an expense of the business'
    case 'pay-wages': return 'wages are an expense of the business'
    case 'drawings': return `the business is separate from ${owner}, and money ${owner} takes for personal use is drawings, not a business expense`
    default: return ''
  }
}

const sideWord = (side: Side) => (side === 'dr' ? 'debited' : 'credited')

/** The two lines that explain a transaction's double entry: "Debit Cash: cash came into the business." */
export function explain(c: LedgerConfig, i: number): [string, string] {
  const t = c.task.transactions[i]
  const e = entryOf(t)
  return [`Debit ${labelOf(c, e.dr)}: ${reason(c, t, 'dr')}.`, `Credit ${labelOf(c, e.cr)}: ${reason(c, t, 'cr')}.`]
}

// ── The accounts on the card ────────────────────────────────────────────────

/** Every account a config can name: the fixed ones and each named person (the first role given wins). */
function everyAccount(c: LedgerConfig): Map<string, Account> {
  const m = new Map<string, Account>()
  for (const id of FIXED) m.set(id, { id, label: FIXED_LABEL[id], role: null })
  for (const t of c.task.transactions) {
    const role = RULES[t.type].person
    if (role && t.name && !m.has(personId(t.name))) m.set(personId(t.name), { id: personId(t.name), label: t.name, role })
  }
  return m
}

export function labelOf(c: LedgerConfig, id: string | null | undefined): string {
  if (!id) return ''
  return everyAccount(c).get(id)?.label ?? id
}

/** At most this many T-accounts fit on the card. */
export const MAX_ACCOUNTS = 8
/** post shows at least this many, so the learner always has accounts to choose between. */
const MIN_ACCOUNTS = 4
const FALLBACK: FixedId[] = ['capital', 'sales', 'purchases', 'drawings', 'cash', 'bank']

const byLabel = (a: Account, b: Account) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })

/** The accounts the transactions are posted to, in alphabetical order. */
export function usedAccounts(c: LedgerConfig): Account[] {
  const all = everyAccount(c)
  const ids = new Set<string>()
  for (const t of c.task.transactions) {
    const e = entryOf(t)
    ids.add(e.dr)
    ids.add(e.cr)
  }
  return [...ids].map((id) => all.get(id) ?? { id, label: id, role: null }).sort(byLabel)
}

/**
 * The T-accounts on the card, alphabetical so where one sits never says which
 * side it takes. In post: the accounts the transactions use, and the ones a
 * learner is apt to confuse them with (Bank for Cash, Purchases for Equipment),
 * up to eight; at least four, so there is always a choice.
 */
export function accountsShown(c: LedgerConfig): Account[] {
  const used = usedAccounts(c)
  if (c.task.kind !== 'post') return used
  const all = everyAccount(c)
  const ids = new Set(used.map((a) => a.id))
  const add = (id: string) => {
    if (ids.size < MAX_ACCOUNTS) ids.add(id)
  }
  for (const t of c.task.transactions) {
    const r = RULES[t.type]
    if (r.methods) add(moneyOf(t) === 'cash' ? 'bank' : 'cash')
    for (const f of r.foils) add(f)
  }
  for (const f of FALLBACK) if (ids.size < MIN_ACCOUNTS) ids.add(f)
  return [...ids].map((id) => all.get(id) ?? { id, label: id, role: null }).sort(byLabel)
}

// ── Posting and balancing ───────────────────────────────────────────────────

export interface Entry { tx: number; account: string; side: Side; amount: number; other: string | null }

/** The entries a set of postings makes, transaction by transaction: debit first, then credit. */
export function entriesOf(c: LedgerConfig, posts: Posting[]): Entry[] {
  const out: Entry[] = []
  c.task.transactions.forEach((t, i) => {
    const p = posts[i]
    if (!p) return
    if (p.dr) out.push({ tx: i, account: p.dr, side: 'dr', amount: t.amount, other: p.cr })
    if (p.cr) out.push({ tx: i, account: p.cr, side: 'cr', amount: t.amount, other: p.dr })
  })
  return out
}

/** The right postings; in find-error, the reversed one swapped, as the engine shows it. */
export function enginePosts(c: LedgerConfig, withError = c.task.kind === 'find-error'): Posting[] {
  return c.task.transactions.map((t, i) => {
    const e = entryOf(t)
    return withError && i === c.task.reversed ? { dr: e.cr, cr: e.dr } : { dr: e.dr, cr: e.cr }
  })
}

/** Each account's debits, credits and balance (debits less credits: above 0 is a debit balance). */
export function balances(c: LedgerConfig, posts: Posting[] = enginePosts(c)): Map<string, { dr: number; cr: number; balance: number }> {
  const m = new Map<string, { dr: number; cr: number; balance: number }>()
  for (const a of usedAccounts(c)) m.set(a.id, { dr: 0, cr: 0, balance: 0 })
  for (const e of entriesOf(c, posts)) {
    const row = m.get(e.account) ?? { dr: 0, cr: 0, balance: 0 }
    row[e.side] += e.amount
    row.balance = row.dr - row.cr
    m.set(e.account, row)
  }
  return m
}

/** The trial balance's two totals from a set of postings: equal whenever every posting has one debit and one credit. */
export function trialTotals(c: LedgerConfig, posts: Posting[] = enginePosts(c)): { dr: number; cr: number } {
  let dr = 0
  let cr = 0
  for (const { balance } of balances(c, posts).values()) {
    if (balance > 0) dr += balance
    else cr -= balance
  }
  return { dr, cr }
}

// ── The learner's work ──────────────────────────────────────────────────────

/** The learner's postings, one per transaction, keeping only accounts on the card. */
export function postsOf(c: LedgerConfig, state: LedgerState | null | undefined): Posting[] {
  const shown = new Set(accountsShown(c).map((a) => a.id))
  const raw: unknown[] = Array.isArray(state?.posts) ? state!.posts : []
  const ok = (v: unknown) => (typeof v === 'string' && shown.has(v) ? v : null)
  return c.task.transactions.map((_, i) => {
    const p = raw[i] as Record<string, unknown> | null | undefined
    return p && typeof p === 'object' ? { dr: ok(p.dr), cr: ok(p.cr) } : { dr: null, cr: null }
  })
}

export type PostStatus = 'right' | 'reversed' | 'wrong' | 'unposted'

/** How one transaction was posted, with what to say when it is not right. */
export function judgePosting(c: LedgerConfig, i: number, p: Posting): { status: PostStatus; said: string[] } {
  const t = c.task.transactions[i]
  const e = entryOf(t)
  const L = (id: string | null) => labelOf(c, id)
  if (p.dr === e.dr && p.cr === e.cr) return { status: 'right', said: [] }
  if (!p.dr && !p.cr) return { status: 'unposted', said: ['You have not posted this one.'] }
  if (p.dr === e.cr && p.cr === e.dr) {
    return {
      status: 'reversed',
      said: [`You debited ${L(p.dr)} and credited ${L(p.cr)}, the wrong way round: ${reason(c, t, 'dr')}, so ${L(e.dr)} is debited; ${reason(c, t, 'cr')}, so ${L(e.cr)} is credited.`],
    }
  }
  if (p.dr && p.dr === p.cr) {
    return { status: 'wrong', said: [`You debited and credited ${L(p.dr)}: the two entries go to two different accounts.`] }
  }
  const said: string[] = []
  const explained = new Set<string>()
  for (const side of ['dr', 'cr'] as const) {
    const mine = p[side]
    const right = e[side]
    const other: Side = side === 'dr' ? 'cr' : 'dr'
    const did = side === 'dr' ? 'debited' : 'credited'
    if (mine === right) continue
    if (!mine) {
      said.push(`You have not chosen an account to ${side === 'dr' ? 'debit' : 'credit'}.`)
      continue
    }
    if (mine === e[other]) {
      // The learner's account is in the transaction, on the other side.
      said.push(`You ${did} ${L(mine)}: ${reason(c, t, other)}, so ${L(mine)} is ${sideWord(other)}.`)
      explained.add(mine)
      continue
    }
    const tail = explained.has(right) ? '' : `: ${reason(c, t, side)}, so ${L(right)} is ${sideWord(side)}`
    explained.add(right)
    if ((mine === 'cash' || mine === 'bank') && (right === 'cash' || right === 'bank') && t.by) {
      said.push(`You ${did} ${L(mine)}, but this was ${how(t.by)}${tail}.`)
    } else {
      said.push(`You ${did} ${L(mine)}, which this transaction does not touch${tail}.`)
    }
  }
  return { status: 'wrong', said }
}

/** A typed amount: a whole number of dollars, nothing typed, or something that is not an amount. */
export function readAmount(raw: unknown): number | null | 'bad' {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 ? raw : 'bad'
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[\s,]/g, '')
  if (s === '') return null
  const m = /^\$?(\d{1,7})(\.0{1,2})?$/.exec(s)
  return m ? Number(m[1]) : 'bad'
}

/** The learner's trial balance, one row per account posted to. */
export function rowsOf(c: LedgerConfig, state: LedgerState | null | undefined): Record<string, TbRow> {
  const raw = state?.rows && typeof state.rows === 'object' ? (state.rows as Record<string, unknown>) : {}
  const out: Record<string, TbRow> = {}
  for (const a of usedAccounts(c)) {
    const r = raw[a.id] as Record<string, unknown> | undefined
    const text = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
    out[a.id] = { dr: text(r?.dr), cr: text(r?.cr) }
  }
  return out
}

export type RowStatus = 'right' | 'empty' | 'column' | 'amount' | 'both' | 'bad' | 'nil'

/** How one row of the learner's trial balance was filled in, with what to say when it is not right. */
export function judgeRow(c: LedgerConfig, id: string, row: TbRow, all = balances(c)): { status: RowStatus; said: string } {
  const b = all.get(id) ?? { dr: 0, cr: 0, balance: 0 }
  const L = labelOf(c, id)
  const dr = readAmount(row.dr)
  const cr = readAmount(row.cr)
  const bad = dr === 'bad' ? row.dr : cr === 'bad' ? row.cr : null
  if (bad !== null) return { status: 'bad', said: `You wrote "${bad.trim()}" for ${L}, which is not a whole number of dollars.` }
  const d = (dr as number | null) ?? 0
  const k = (cr as number | null) ?? 0
  if (b.balance === 0) {
    if (d === 0 && k === 0) return { status: 'right', said: '' }
    return { status: 'nil', said: `You entered ${money(d || k)} for ${L}, but its debits and credits are equal (${money(b.dr)} each): it has no balance, so it is left out.` }
  }
  if (d === 0 && k === 0) return { status: 'empty', said: `${L} has no balance entered.` }
  if (d !== 0 && k !== 0) return { status: 'both', said: `You put amounts in both columns for ${L}: a balance goes in one column only.` }
  const side: Side = b.balance > 0 ? 'dr' : 'cr'
  const typed = d || k
  const typedSide: Side = d ? 'dr' : 'cr'
  const more = side === 'dr' ? `its debits (${money(b.dr)}) are more than its credits (${money(b.cr)})` : `its credits (${money(b.cr)}) are more than its debits (${money(b.dr)})`
  const column = (s: Side) => (s === 'dr' ? 'debit' : 'credit')
  if (typedSide === side && typed === Math.abs(b.balance)) return { status: 'right', said: '' }
  if (typedSide !== side) {
    return { status: 'column', said: `You put ${L}'s balance in the ${column(typedSide)} column, but ${more}, so it is a ${column(side)} balance${typed === Math.abs(b.balance) ? '' : ' of the difference'}.` }
  }
  return { status: 'amount', said: `You entered ${money(typed)} for ${L}, but its debits total ${money(b.dr)} and its credits ${money(b.cr)}: the balance is the difference.` }
}

/** A row's right entry: the balance in its column, or nothing for an account with no balance. */
export function rightRow(c: LedgerConfig, id: string): TbRow {
  const b = balances(c).get(id)?.balance ?? 0
  return b > 0 ? { dr: String(b), cr: '' } : b < 0 ? { dr: '', cr: String(-b) } : { dr: '', cr: '' }
}

/** What the learner's trial balance adds up to: only the amounts that can be read. */
export function typedTotals(rows: Record<string, TbRow>): { dr: number; cr: number } {
  let dr = 0
  let cr = 0
  for (const r of Object.values(rows)) {
    const d = readAmount(r.dr)
    const k = readAmount(r.cr)
    if (typeof d === 'number') dr += d
    if (typeof k === 'number') cr += k
  }
  return { dr, cr }
}

export function pickOf(c: LedgerConfig, state: LedgerState | null | undefined): number | null {
  const p = state?.pick
  return typeof p === 'number' && Number.isInteger(p) && p >= 0 && p < c.task.transactions.length ? p : null
}

// ── Reading what the tutor writes ───────────────────────────────────────────

const KIND_WORDS = new Map<string, Kind>([
  ['post', 'post'], ['posting', 'post'], ['post-transactions', 'post'], ['post-entries', 'post'], ['double-entry', 'post'], ['record', 'post'],
  ['trial-balance', 'trial-balance'], ['tb', 'trial-balance'], ['balance', 'trial-balance'], ['balance-accounts', 'trial-balance'], ['extract-trial-balance', 'trial-balance'],
  ['find-error', 'find-error'], ['find-the-error', 'find-error'], ['spot-error', 'find-error'], ['spot-the-error', 'find-error'],
  ['reversal', 'find-error'], ['complete-reversal', 'find-error'], ['find-reversal', 'find-error'],
])

const TYPE_WORDS = new Map<string, TxType>([
  ...TX_TYPES.map((t): [string, TxType] => [t, t]),
  ['introduce-capital', 'capital'], ['capital-introduced', 'capital'], ['owner-capital', 'capital'], ['owner-introduces-capital', 'capital'],
  ['buy-on-credit', 'credit-purchase'], ['purchase-on-credit', 'credit-purchase'], ['credit-purchases', 'credit-purchase'], ['buys-on-credit', 'credit-purchase'],
  ['buy-inventory-on-credit', 'credit-purchase'], ['buys-inventory-on-credit', 'credit-purchase'], ['inventory-on-credit', 'credit-purchase'], ['goods-on-credit', 'credit-purchase'],
  ['cash-purchase', 'purchase'], ['buy-goods', 'purchase'], ['buys-goods', 'purchase'], ['buy-inventory', 'purchase'], ['purchases', 'purchase'],
  ['cash-sale', 'sale'], ['sales', 'sale'], ['sell-goods', 'sale'], ['sells-goods', 'sale'],
  ['sale-on-credit', 'credit-sale'], ['sell-on-credit', 'credit-sale'], ['sells-on-credit', 'credit-sale'], ['credit-sales', 'credit-sale'],
  ['pays-supplier', 'pay-supplier'], ['supplier-payment', 'pay-supplier'], ['pay-creditor', 'pay-supplier'], ['pay-a-supplier', 'pay-supplier'],
  ['equipment', 'buy-equipment'], ['buys-equipment', 'buy-equipment'], ['equipment-purchase', 'buy-equipment'], ['purchase-equipment', 'buy-equipment'],
  ['receive-payment', 'customer-pays'], ['receives-payment', 'customer-pays'], ['customer-payment', 'customer-pays'], ['receipt-from-customer', 'customer-pays'], ['customer-pay', 'customer-pays'],
  ['rent', 'pay-rent'], ['pays-rent', 'pay-rent'], ['rent-paid', 'pay-rent'],
  ['wages', 'pay-wages'], ['pays-wages', 'pay-wages'], ['wages-paid', 'pay-wages'],
  ['draw', 'drawings'], ['owner-drawings', 'drawings'], ['draws-cash', 'drawings'], ['personal-use', 'drawings'],
  ['bank-cash', 'cash-to-bank'], ['deposit', 'cash-to-bank'], ['cash-banked', 'cash-to-bank'], ['pay-cash-into-bank', 'cash-to-bank'],
  ['cash-from-bank', 'bank-to-cash'], ['withdraw-cash', 'bank-to-cash'], ['cash-withdrawn', 'bank-to-cash'],
])

const METHOD_WORDS = new Map<string, By>([
  ['cash', 'cash'], ['in-cash', 'cash'],
  ['cheque', 'cheque'], ['check', 'cheque'], ['by-cheque', 'cheque'], ['bank', 'cheque'],
  ['transfer', 'transfer'], ['bank-transfer', 'transfer'], ['credit-transfer', 'transfer'], ['by-bank-transfer', 'transfer'],
])

/** Beyond this many transactions, parse gives up: no card could be meant. */
const PARSE_MAX_TX = 12

function readAmountField(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw !== 'string') return null
  const m = /^\s*\$?\s*(\d+(\.\d+)?)\s*$/.exec(raw.replace(/,/g, ''))
  return m && Number(m[1]) > 0 ? Number(m[1]) : null
}

function readTx(raw: unknown): Tx | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const word = [r.type, r.kind, r.transaction].find((v): v is string => typeof v === 'string')
  const type = word ? TYPE_WORDS.get(slug(word)) : undefined
  if (!type) return null
  const amount = readAmountField(r.amount ?? r.value)
  if (amount === null) return null
  const rule = RULES[type]
  let by: By | null = rule.usual
  const method = r.by ?? r.method ?? r.paid
  if (rule.methods && method !== undefined && method !== null) {
    if (typeof method !== 'string') return null
    const m = METHOD_WORDS.get(slug(method))
    if (!m) return null
    by = m
  }
  let name: string | null = null
  if (rule.person) {
    const n = [r.name, r[rule.person], r.person, r.who].find((v) => v !== undefined && v !== null)
    if (n !== undefined && typeof n !== 'string') return null
    name = typeof n === 'string' && tidy(n) ? upper(tidy(n)) : null
  }
  return { type, amount, by, name }
}

/** FNV-1a: the same transactions always put the error in the same place. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function parseLedger(raw: unknown): LedgerConfig | null {
  const task = (raw as { task?: unknown } | null)?.task
  if (!task || typeof task !== 'object') return null
  const t = task as Record<string, unknown>
  const kind = typeof t.kind === 'string' ? KIND_WORDS.get(slug(t.kind)) : undefined
  if (!kind) return null
  const list = t.transactions ?? t.transaction
  if (!Array.isArray(list) || list.length === 0 || list.length > PARSE_MAX_TX) return null
  const transactions: Tx[] = []
  for (const item of list) {
    const tx = readTx(item)
    if (!tx) return null
    transactions.push(tx)
  }
  let owner: string | null = null
  if (t.owner !== undefined && t.owner !== null) {
    if (typeof t.owner !== 'string') return null
    owner = tidy(t.owner) ? upper(tidy(t.owner)) : null
  }
  let reversed: number | null = null
  if (kind === 'find-error') {
    if (t.reversed === undefined || t.reversed === null) {
      reversed = hash(JSON.stringify(transactions)) % transactions.length
    } else {
      const n = typeof t.reversed === 'number' ? t.reversed : typeof t.reversed === 'string' && /^\s*\d+\s*$/.test(t.reversed) ? Number(t.reversed) : NaN
      if (!Number.isInteger(n)) return null
      reversed = n - 1
    }
  }
  return { task: { kind, owner, transactions, reversed } }
}

// ── What the engine refuses ─────────────────────────────────────────────────

export const LIMITS: Record<Kind, { min: number; max: number }> = {
  'post': { min: 1, max: 4 },
  'trial-balance': { min: 2, max: 5 },
  'find-error': { min: 3, max: 4 },
}
/** Amounts are small whole numbers, so the learner adds them in their head. */
export const MAX_AMOUNT = 999
/** trial-balance and find-error post to every account used: at most this many fit. */
export const MAX_USED = 7
/** A name fits its T-account's heading and its entries' details. */
const MAX_NAME = 12
const NAME_OK = /^[A-Za-z][A-Za-z' -]*$/

const nth = (i: number) => `Transaction ${i + 1}`

/**
 * The story trial-balance and find-error tell starts on the business's first
 * day: what it must never do. Cash cannot go below nothing; the engine keeps
 * the bank out of overdraft too (0452 allows one, but a first version keeps
 * every asset a debit balance); a supplier is paid no more than is owed, and a
 * customer pays no more than is owed.
 */
function storyFaults(c: LedgerConfig): string[] {
  const out: string[] = []
  const run = new Map<string, number>()
  const said = new Set<string>()
  const posts = enginePosts(c, false)
  c.task.transactions.forEach((t, i) => {
    const p = posts[i]
    run.set(p.dr!, (run.get(p.dr!) ?? 0) + t.amount)
    run.set(p.cr!, (run.get(p.cr!) ?? 0) - t.amount)
    for (const [id, bal] of run) {
      if (said.has(id)) continue
      const role = everyAccount(c).get(id)?.role
      if (id === 'cash' && bal < 0) {
        out.push(`${nth(i)} spends ${money(-bal)} more cash than the business has (its cash starts at nothing): bring cash in first (capital in cash, a cash sale), or lower the amount.`)
      } else if (id === 'bank' && bal < 0) {
        out.push(`${nth(i)} takes the bank ${money(-bal)} overdrawn (the bank starts at nothing): pay money into the bank first (capital by cheque, a customer's cheque), or lower the amount.`)
      } else if (role === 'supplier' && bal > 0) {
        out.push(`${nth(i)} pays ${labelOf(c, id)} ${money(bal)} more than the business owes: pay a supplier no more than was bought on credit from them, after buying.`)
      } else if (role === 'customer' && bal < 0) {
        out.push(`${nth(i)} has ${labelOf(c, id)} pay ${money(-bal)} more than is owed: a customer pays no more than was sold to them on credit, after the sale.`)
      } else {
        continue
      }
      said.add(id)
    }
  })
  return out
}

export function ledgerFaults(c: LedgerConfig): string[] {
  const { kind, owner, transactions: txs, reversed } = c.task
  const out: string[] = []
  const lim = LIMITS[kind]
  if (txs.length < lim.min || txs.length > lim.max) {
    out.push(`"${kind}" takes ${lim.min === lim.max ? lim.min : `${lim.min} to ${lim.max}`} transactions; this one has ${txs.length}: ${txs.length > lim.max ? 'keep the ones that carry the idea' : 'add transactions'}.`)
  }
  const fixedLabels = new Set(FIXED.map((id) => FIXED_LABEL[id].toLowerCase()))
  const badName = (n: string) => n.length > MAX_NAME || !NAME_OK.test(n) || n.split(' ').some((w) => /^(dr|cr)$/i.test(w))
  if (owner !== null) {
    if (owner.length > 16 || !NAME_OK.test(owner)) out.push(`The owner "${owner}" should be a first name of letters, at most 16 characters.`)
    if (fixedLabels.has(owner.toLowerCase())) out.push(`The owner cannot be called "${owner}", the name of an account.`)
  }
  const roles = new Map<string, Role>()
  txs.forEach((t, i) => {
    const r = RULES[t.type]
    if (!Number.isInteger(t.amount)) out.push(`${nth(i)}'s amount ${t.amount} is not a whole number: amounts are whole dollars.`)
    else if (t.amount > MAX_AMOUNT) out.push(`${nth(i)}'s amount ${money(t.amount)} is too large: keep amounts to small whole numbers, ${MAX_AMOUNT} at most.`)
    if (r.person) {
      if (!t.name) {
        out.push(`${nth(i)} (${r.title}) needs the ${r.person}'s name: add "name", e.g. "name":"${r.person === 'supplier' ? 'Ali' : 'Lee'}".`)
        return
      }
      if (badName(t.name)) out.push(`"${t.name}" should be a short name of letters, at most ${MAX_NAME} characters (it heads a T-account).`)
      if (fixedLabels.has(t.name.toLowerCase())) out.push(`A ${r.person} cannot be called "${t.name}", the name of an account: give a person's name.`)
      if (owner && slug(owner) === slug(t.name)) out.push(`${t.name} is both the owner and a ${r.person}: the business keeps its owner apart from the people it trades with, so give the ${r.person} another name.`)
      const before = roles.get(slug(t.name))
      if (before && before !== r.person) out.push(`${t.name} is both a supplier and a customer: give each their own name.`)
      roles.set(slug(t.name), before ?? r.person)
    }
  })
  if (kind !== 'trial-balance') {
    const seen = new Map<string, number>()
    txs.forEach((t, i) => {
      const key = JSON.stringify([t.type, t.amount, t.by, t.name && slug(t.name)])
      if (seen.has(key)) out.push(`${nth(i)} is the same as transaction ${seen.get(key)! + 1}: make each one different.`)
      else seen.set(key, i)
    })
  }
  if (out.some((f) => /needs the (supplier|customer)'s name/.test(f))) return out
  if (kind === 'trial-balance' || kind === 'find-error') {
    out.push(...storyFaults(c))
    const used = usedAccounts(c).length
    if (used > MAX_USED) out.push(`These transactions use ${used} accounts, and at most ${MAX_USED} fit beside a trial balance: use fewer different kinds of transaction.`)
  }
  if (kind === 'trial-balance' && [...balances(c).values()].every((b) => b.balance === 0)) {
    out.push('Every account balances to nothing, so the trial balance would be empty: add a transaction that leaves a balance, such as capital.')
  }
  if (kind === 'find-error' && (reversed === null || reversed < 0 || reversed >= txs.length)) {
    out.push(`"reversed" must say which transaction is posted the wrong way round, from 1 to ${txs.length}.`)
  }
  return out
}

// ── The card's prompt ───────────────────────────────────────────────────────

/** Uses of "credit" and "debit" that say nothing about which account takes which side. */
const SAFE = [
  /\bon credit\b/g,
  /\bcredit (sale|sales|purchase|purchases|customer|customers|supplier|suppliers|terms|transfer|transfers|card|cards|note|notes|limit|period|control|transaction|transactions)\b/g,
  /\bdebit cards?\b/g,
  /\btrade credit\b/g,
  /\b(debit|debits|debited) (and|or) (a |an |the )?(credit|credits|credited)\b/g,
  /\b(credit|credits|credited) (and|or) (a |an |the )?(debit|debits|debited)\b/g,
  /\bdr (and|or) cr\b/g,
  /\b(which|what) (\w+ ){0,2}(is|are|gets|get|should be|will be|would be|to be|to) (debited|credited|debit|credit)\b/g,
]
const SIDE_WORD = /^(debit|debits|debited|debiting|credit|credits|credited|crediting|dr|cr)$/
/** How many words may sit between "debit" and an account's name and still say which side it takes. */
const NEAR = 3
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']
const POINTERS = /^(transaction|transactions|posting|postings|entry|entries|item|items|line|one|number|no)$/

/** The prompt as words, a "|" where a sentence ends, so nearness never crosses one. */
function tokens(prompt: string): string[] {
  let s = prompt.toLowerCase().replace(/['’]s\b/g, '').replace(/[’']/g, '')
  for (const re of SAFE) s = s.replace(re, ' | ')
  return s.replace(/[.!?;\n]+/g, ' | ').split(/[^a-z0-9|$]+/).filter(Boolean).flatMap((w) => (w.includes('|') ? ['|'] : [w]))
}

/** Where a name (one or more words) appears among the tokens. */
function spots(words: string[], name: string): number[] {
  const parts = name.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean)
  const out: number[] = []
  if (!parts.length) return out
  for (let i = 0; i + parts.length <= words.length; i++) {
    // The word, its plural, or its singular ("sale" for Sales, "drawing" for Drawings).
    if (parts.every((p, k) => words[i + k] === p || words[i + k] === `${p}s` || (p.length > 3 && p.endsWith('s') && words[i + k] === p.slice(0, -1)))) out.push(i)
  }
  return out
}

/**
 * What the card's prompt gives away that the scene hides until marked: which
 * account is debited or credited ("debit", "credit", "Dr" or "Cr" beside an
 * account's name); in trial-balance, a balance or the total; in find-error,
 * which transaction is reversed.
 */
export function ledgerPromptFaults(c: LedgerConfig, prompt: string): string[] {
  const out: string[] = []
  const words = tokens(prompt)
  const sides = words.map((w, i) => (SIDE_WORD.test(w) ? i : -1)).filter((i) => i >= 0)
  const near = (a: number, b: number) => {
    const [lo, hi] = a < b ? [a, b] : [b, a]
    return hi - lo - 1 <= NEAR && !words.slice(lo, hi).includes('|')
  }
  const named = new Set<string>()
  for (const acc of accountsShown(c)) {
    if (spots(words, acc.label).some((at) => sides.some((s) => near(s, at)))) named.add(acc.label)
  }
  if (named.size) {
    out.push(`The prompt says which side ${[...named].join(' and ')} ${named.size > 1 ? 'take' : 'takes'} ("debit", "credit", "Dr" or "Cr" beside the account), which the learner is to decide: ask them to post the transactions, and never name a side for an account.`)
  }
  if (c.task.kind === 'trial-balance') {
    const amounts = new Set(c.task.transactions.map((t) => t.amount))
    const hidden = new Set<number>()
    for (const b of balances(c).values()) if (b.balance !== 0) hidden.add(Math.abs(b.balance))
    hidden.add(trialTotals(c).dr)
    const given = words.map((w) => w.replace(/^\$/, '')).filter((w) => /^\d+$/.test(w)).map(Number).filter((n) => hidden.has(n) && !amounts.has(n))
    if (given.length) out.push(`The prompt gives ${given.map(money).join(', ')}, a balance or total the learner is to work out: leave the numbers to the scene.`)
  }
  if (c.task.kind === 'find-error' && c.task.reversed !== null && c.task.reversed >= 0 && c.task.reversed < c.task.transactions.length) {
    const r = c.task.reversed
    const n = String(r + 1)
    const points = words.some((w, i) =>
      (w === n && i > 0 && POINTERS.test(words[i - 1])) ||
      (w === `${n}st` || w === `${n}nd` || w === `${n}rd` || w === `${n}th` || w === ORDINALS[r] || (w === 'last' && r === c.task.transactions.length - 1)) &&
        words.slice(i + 1, i + 3).some((x) => POINTERS.test(x)))
    if (points) out.push(`The prompt points at transaction ${n}, the one posted the wrong way round, which the learner is to find: ask which one, without naming it.`)
    // A word that picks out the reversed transaction alone: an account or a person only it involves.
    const e = entryOf(c.task.transactions[r])
    const others = c.task.transactions.filter((_, i) => i !== r).flatMap((t) => [entryOf(t).dr, entryOf(t).cr])
    const only = [e.dr, e.cr].filter((id) => !others.includes(id) && spots(words, labelOf(c, id)).length > 0)
    if (only.length) out.push(`The prompt names ${only.map((id) => labelOf(c, id)).join(' and ')}, which only the reversed transaction involves, so it points at the answer: ask which one is reversed, without naming it.`)
  }
  return out
}

// ── The engine ──────────────────────────────────────────────────────────────

export const ledgerEngine: SceneEngine<LedgerConfig, LedgerState> & { promptFaults(config: LedgerConfig, prompt: string): string[] } = {
  id: 'ledger',
  covers: [
    'double entry', 'double-entry bookkeeping', 'ledger accounts', 'posting transactions to the ledger', 'T-accounts',
    'debits and credits', 'trial balance', 'balancing accounts', 'dual aspect', 'reversal of entries',
  ],
  isolates: 'category',

  parse: parseLedger,
  faults: ledgerFaults,
  promptFaults: ledgerPromptFaults,

  initial(config) {
    if (config.task.kind === 'post') return { posts: config.task.transactions.map(() => ({ dr: null, cr: null })) }
    if (config.task.kind === 'trial-balance') return { rows: Object.fromEntries(usedAccounts(config).map((a) => [a.id, { dr: '', cr: '' }])) }
    return { pick: null }
  },

  check(config, state) {
    const kind = config.task.kind
    if (kind === 'post') {
      const posts = postsOf(config, state)
      const wrong = posts.map((p, i) => (judgePosting(config, i, p).status === 'right' ? null : `t${i}`)).filter((x): x is string => x !== null)
      return { ok: wrong.length === 0, wrongIds: wrong }
    }
    if (kind === 'trial-balance') {
      const rows = rowsOf(config, state)
      const all = balances(config)
      const wrong = usedAccounts(config).filter((a) => judgeRow(config, a.id, rows[a.id], all).status !== 'right').map((a) => a.id)
      return { ok: wrong.length === 0, wrongIds: wrong }
    }
    const pick = pickOf(config, state)
    const ok = pick !== null && pick === config.task.reversed
    return { ok, wrongIds: !ok && pick !== null ? [`t${pick}`] : [] }
  },

  solve(config) {
    if (config.task.kind === 'post') return { posts: enginePosts(config, false) }
    if (config.task.kind === 'trial-balance') return { rows: Object.fromEntries(usedAccounts(config).map((a) => [a.id, rightRow(config, a.id)])) }
    return { pick: config.task.reversed }
  },

  View: LedgerView,

  prompt: `SCENE "ledger" -- double entry at Cambridge IGCSE Accounting (0452) level: a business's ledger as T-accounts, each
  with a debit (Dr) and a credit (Cr) side. You name transactions from a fixed list; the engine writes each one out
  as the learner reads it, knows its double entry, and marks it.
    post: the learner posts each transaction (taps the Dr side of one account and the Cr side of another, or Tab and
      Enter) and the amounts appear in the T-accounts. The accounts shown are those the transactions use, plus ones
      learners confuse them with (Bank for Cash, Purchases for Equipment), in alphabetical order.
    trial-balance: the engine posts the transactions; the learner balances each account and enters its balance in the
      debit or credit column of a trial balance, whose totals must agree.
    find-error: the engine posts the transactions with one complete reversal (its debit and credit swapped); the
      learner finds it, and is shown why a trial balance cannot reveal it.
  For: double entry, ledger accounts, debits and credits, the trial balance, the dual aspect and business entity
  concepts, complete reversal of entries.
  config: { "task": { "kind":"<post | trial-balance | find-error>", "owner":"<the owner's first name; optional>",
            "transactions": [{ "type":"<type>", "amount":<whole number, 1 to 999>, "by":"<cash | cheque | transfer>",
              "name":"<the supplier's or customer's name>" }, ...],
            "reversed":<find-error only, optional: the transaction posted the wrong way round, 1 = the first> } }
  types, with the double entry the engine marks (for you only, never for the prompt):
    capital          the owner puts money in             Dr Cash or Bank, Cr Capital        by: cash (default) | cheque | transfer
    credit-purchase  goods for resale on credit          Dr Purchases, Cr <supplier>        needs "name"
    purchase         goods for resale, paid now          Dr Purchases, Cr Cash or Bank      by: cash (default) | cheque | transfer
    sale             goods sold, paid now                Dr Cash or Bank, Cr Sales          by: cash (default) | cheque | transfer
    credit-sale      goods sold on credit                Dr <customer>, Cr Sales            needs "name"
    pay-supplier     a supplier is paid                  Dr <supplier>, Cr Bank or Cash     needs "name"; by: cheque (default) | cash | transfer
    buy-equipment    equipment for the business's use    Dr Equipment, Cr Bank or Cash      by: cheque (default) | cash | transfer
    customer-pays    a credit customer pays              Dr Bank or Cash, Cr <customer>     needs "name"; by: cheque (default) | cash | transfer
    pay-rent         rent paid                           Dr Rent, Cr Cash or Bank           by: cash (default) | cheque | transfer
    pay-wages        wages paid                          Dr Wages, Cr Cash or Bank          by: cash (default) | cheque | transfer
    drawings         the owner takes money for own use   Dr Drawings, Cr Cash or Bank       by: cash (default) | cheque | transfer
    cash-to-bank     cash paid into the bank             Dr Bank, Cr Cash
    bank-to-cash     cash taken out of the bank          Dr Cash, Cr Bank
  - post: 1 to 4 transactions; trial-balance: 2 to 5; find-error: 3 or 4. Each one different (except in a trial
    balance). A name is a short first name; one person is a supplier or a customer, not both, and not the owner.
  - trial-balance and find-error tell one business's story from its first day: cash and bank never go below nothing,
    a supplier is paid only what was bought on credit from them, a customer pays only what they owe. At most 7 accounts.
  - the prompt asks; it never says which account is debited or credited (no "debit", "credit", "Dr" or "Cr" beside an
    account's name), never gives a balance, and in find-error never points at the reversed transaction.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Post each of Amira's transactions to the ledger.",
    "payload": { "engine":"ledger", "config": { "task": { "kind":"post", "owner":"Amira", "transactions": [{ "type":"capital", "amount":500, "by":"cash" }, { "type":"credit-purchase", "amount":200, "name":"Ali" }, { "type":"sale", "amount":80, "by":"cash" }] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:ledger", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Balance each of Ben's accounts and enter the balances in the trial balance.",
    "payload": { "engine":"ledger", "config": { "task": { "kind":"trial-balance", "owner":"Ben", "transactions": [{ "type":"capital", "amount":600, "by":"cheque" }, { "type":"buy-equipment", "amount":250, "by":"cheque" }, { "type":"credit-sale", "amount":140, "name":"Lee" }, { "type":"customer-pays", "amount":90, "by":"cheque", "name":"Lee" }, { "type":"pay-rent", "amount":40, "by":"cheque" }] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:ledger", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"One of Sara's transactions has been posted the wrong way round. Which one?",
    "payload": { "engine":"ledger", "config": { "task": { "kind":"find-error", "owner":"Sara", "transactions": [{ "type":"capital", "amount":300, "by":"cash" }, { "type":"purchase", "amount":120, "by":"cash" }, { "type":"pay-wages", "amount":50, "by":"cash" }], "reversed":3 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:ledger", "why":"..." } }`,
}

registerEngine(ledgerEngine as SceneEngine<unknown, unknown>)
