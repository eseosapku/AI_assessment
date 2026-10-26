'use client'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Account, Entry, LedgerConfig, LedgerState, Posting, Side, TbRow } from './config'
import {
  accountsShown, balances, enginePosts, entriesOf, explain, judgePosting, judgeRow, labelOf, narrate,
  pickOf, postsOf, rightRow, rowsOf, trialTotals, typedTotals, usedAccounts,
} from './config'

type Props = SceneViewProps<LedgerConfig, LedgerState>
type Tone = 'good' | 'bad' | undefined

const SIDE_NAME: Record<Side, string> = { dr: 'debit', cr: 'credit' }
const plural = (k: number, one: string, many: string) => (k === 1 ? one : many)

/** The arrows belong to the scene, not to the board that moves cards with them. */
const keepArrows = (e: KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** The heading every kind shares: whose ledger this is, the business apart from its owner. */
function Heading({ config }: { config: LedgerConfig }) {
  const owner = config.task.owner
  return (
    <p className="text-[12px] leading-snug text-ss-slate">
      <span className="font-extrabold text-ss-ink">The business&apos;s ledger.</span>{' '}
      {owner ? `${owner} owns the business, but its books record the business only, kept apart from ${owner}'s own money.` : "Its books record the business only, kept apart from its owner's own money."}
    </p>
  )
}

/** One entry on a side of a T-account: the transaction's number, the other account (its details) and the amount. */
function EntryLine({ config, e, tone, lit }: { config: LedgerConfig; e: Entry; tone: Tone; lit: boolean }) {
  return (
    <span
      data-entry={`${e.tx}-${e.side}`}
      className="flex flex-wrap items-baseline justify-between gap-x-1 rounded px-0.5 text-[12px] leading-[16px] text-ss-ink"
      style={{
        backgroundColor: lit ? 'var(--subject-soft)' : undefined,
        textDecorationLine: tone === 'bad' ? 'underline' : undefined,
        textDecorationStyle: tone === 'bad' ? 'wavy' : undefined,
        textDecorationColor: tone === 'bad' ? 'var(--ss-bad)' : undefined,
        color: tone === 'good' ? 'var(--ss-good)' : tone === 'bad' ? 'var(--ss-bad)' : undefined,
      }}
    >
      <span className="min-w-0">
        <span className="font-semibold tabular-nums text-ss-slate">{e.tx + 1}</span> {e.other ? labelOf(config, e.other) : '…'}
      </span>
      <span className="ml-auto font-bold tabular-nums">{e.amount}</span>
    </span>
  )
}

const entryWords = (config: LedgerConfig, list: Entry[]) =>
  list.length === 0
    ? 'empty'
    : list.map((e) => `transaction ${e.tx + 1}, ${e.other ? labelOf(config, e.other) : 'other side not chosen'}, ${e.amount} dollars`).join('; ')

/**
 * A T-account: its name over the T, the debit side on the left and the credit
 * side on the right. In post each side is a button the learner posts to.
 */
function TAccount({
  config, account, entries, tone, lit, post, index,
}: {
  config: LedgerConfig
  account: Account
  entries: Entry[]
  tone?: (e: Entry) => Tone
  lit?: (e: Entry) => boolean
  index: number
  post?: {
    locked: boolean
    onSide(side: Side): void
    onKey(e: KeyboardEvent, at: number): void
    refs: React.MutableRefObject<(HTMLButtonElement | null)[]>
  }
}) {
  const side = (s: Side) => {
    const list = entries.filter((e) => e.side === s)
    const inner = (
      <>
        <span aria-hidden="true" className="block text-[12px] font-bold leading-[16px] text-ss-slate">{s === 'dr' ? 'Dr' : 'Cr'}</span>
        {list.map((e) => <EntryLine key={`${e.tx}-${e.side}`} config={config} e={e} tone={tone?.(e)} lit={!!lit?.(e)} />)}
      </>
    )
    const style = { borderLeft: s === 'cr' ? '2px solid var(--ss-ink)' : undefined }
    const box = 'flex min-h-[48px] flex-col gap-0.5 px-1 pb-1 pt-0.5 text-left'
    if (!post) {
      return (
        <div key={s} className={box} style={style}>
          <span className="sr-only">{`${account.label}, ${SIDE_NAME[s]} side: `}</span>
          {inner}
        </div>
      )
    }
    const at = index * 2 + (s === 'dr' ? 0 : 1)
    return (
      <button
        key={s}
        ref={(el) => {
          post.refs.current[at] = el
        }}
        type="button"
        lang="en"
        disabled={post.locked}
        aria-label={`${account.label}, ${SIDE_NAME[s]} side: ${entryWords(config, list)}`}
        onClick={() => post.onSide(s)}
        onKeyDown={(e) => post.onKey(e, at)}
        className={`nodrag touch-manipulation outline-none hover:bg-ss-chip focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default disabled:hover:bg-transparent ${box}`}
        style={style}
      >
        {inner}
      </button>
    )
  }
  return (
    <div className="min-w-0 rounded-lg border border-ss-line bg-ss-panel px-1 pb-0.5 pt-1" data-account={account.id}>
      <p className="truncate px-1 pb-0.5 text-center text-[13px] font-extrabold leading-[18px] text-ss-ink">{account.label}</p>
      <div className="grid grid-cols-2" style={{ borderTop: '2px solid var(--ss-ink)' }}>
        {side('dr')}
        {side('cr')}
      </div>
    </div>
  )
}

function Ledger({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function Lines({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div className="mt-1 flex flex-col gap-0.5 pl-7 text-[12px] leading-snug">
      {lines.map((l) => (
        <p key={l} className="text-ss-ink">{l}</p>
      ))}
    </div>
  )
}

const Badge = ({ n }: { n: number }) => (
  <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ss-chip text-[12px] font-extrabold tabular-nums text-ss-ink">{n}</span>
)

const Verdict = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <span className="ml-1 whitespace-nowrap text-[12px] font-extrabold" style={{ color: ok ? 'var(--ss-good)' : 'var(--ss-bad)' }}>{children}</span>
)

// ── post ────────────────────────────────────────────────────────────────────

function PostTask({ config, state, setState, marked, reduced, locked }: Props) {
  const txs = config.task.transactions
  const accounts = accountsShown(config)
  const posts = postsOf(config, state)
  const [current, setCurrent] = useState(0)
  const [said, setSaid] = useState('')
  const sideRefs = useRef<(HTMLButtonElement | null)[]>([])
  const txRefs = useRef<(HTMLButtonElement | null)[]>([])
  const at = Math.min(current, txs.length - 1)
  const editing = !locked
  const done = marked !== 'idle'
  const named = marked === 'right' || marked === 'shown'
  const verdicts = marked === 'wrong' || marked === 'right' ? posts.map((p, i) => judgePosting(config, i, p)) : null
  const entries = entriesOf(config, named && marked === 'shown' ? enginePosts(config, false) : posts)

  const tapSide = (account: string, side: Side) => {
    if (locked) return
    const next: Posting[] = posts.map((p) => ({ ...p }))
    const p = next[at]
    const was = p[side]
    p[side] = was === account ? null : account
    setState({ posts: next })
    const L = labelOf(config, account)
    let line = was === account
      ? `Transaction ${at + 1}: taken off the ${SIDE_NAME[side]} side of ${L}.`
      : `Transaction ${at + 1}: ${txs[at].amount} dollars on the ${SIDE_NAME[side]} side of ${L}.`
    if (p.dr && p.cr) {
      // On to the next transaction still to post, if there is one.
      for (let k = 1; k < txs.length; k++) {
        const j = (at + k) % txs.length
        if (!next[j].dr || !next[j].cr) {
          setCurrent(j)
          line += ` Now transaction ${j + 1}.`
          break
        }
      }
    }
    setSaid(line)
  }

  const onSideKey = (e: KeyboardEvent, i: number) => {
    const n = accounts.length * 2
    const step = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 } as Record<string, number>)[e.key]
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, i + step))
    sideRefs.current[j]?.focus()
  }
  const onTxKey = (e: KeyboardEvent, i: number) => {
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (step === undefined) return
    e.preventDefault()
    e.stopPropagation()
    const j = (i + step + txs.length) % txs.length
    setCurrent(j)
    txRefs.current[j]?.focus()
  }

  const right = verdicts?.filter((v) => v.status === 'right').length ?? 0
  const total = txs.reduce((s, t) => s + t.amount, 0)
  const fade = reduced ? undefined : 'background-color 200ms, border-color 200ms'

  return (
    <div className="nodrag flex flex-col gap-3" onKeyDown={keepArrows}>
      <Heading config={config} />
      <ol className="flex flex-col gap-1.5" aria-label="The transactions">
        {txs.map((t, i) => {
          const p = posts[i]
          const on = editing && at === i
          const v = verdicts?.[i]
          return (
            <li key={i}>
              <button
                ref={(el) => {
                  txRefs.current[i] = el
                }}
                type="button"
                lang="en"
                disabled={locked}
                aria-pressed={on}
                onClick={() => {
                  setCurrent(i)
                  setSaid(`Posting transaction ${i + 1}.`)
                }}
                onKeyDown={(e) => onTxKey(e, i)}
                className="nodrag flex w-full items-start gap-2 rounded-lg border-[1.5px] px-2 py-1.5 text-left disabled:cursor-default"
                style={{ borderColor: on ? 'var(--subject)' : 'var(--ss-line)', backgroundColor: on ? 'var(--subject-soft)' : 'var(--ss-panel)', transition: fade }}
              >
                <Badge n={i + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold leading-snug text-ss-ink">{narrate(config, t)}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ss-slate">
                    Debit: <span className="font-bold text-ss-ink">{labelOf(config, p.dr) || '—'}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                    Credit: <span className="font-bold text-ss-ink">{labelOf(config, p.cr) || '—'}</span>
                    {v && <Verdict ok={v.status === 'right'}>{v.status === 'right' ? 'Right' : 'Not right'}</Verdict>}
                  </span>
                </span>
              </button>
              {v && v.status !== 'right' && marked === 'wrong' && <Lines lines={v.said} />}
              {named && <Lines lines={explain(config, i)} />}
            </li>
          )
        })}
      </ol>

      {editing && (
        <p className="text-[12px] font-semibold leading-snug text-ss-slate">
          {`Posting transaction ${at + 1}: tap the Dr side of the account to debit and the Cr side of the account to credit.`}
        </p>
      )}

      <div role="group" aria-label="The ledger accounts. Each has a debit side and a credit side; the arrow keys move between them.">
        <Ledger>
          {accounts.map((a, k) => (
            <TAccount
              key={a.id}
              index={k}
              config={config}
              account={a}
              entries={entries.filter((e) => e.account === a.id)}
              lit={(e) => editing && e.tx === at}
              tone={(e) => (verdicts && marked === 'wrong' ? (verdicts[e.tx].status === 'right' ? 'good' : 'bad') : marked === 'right' ? 'good' : undefined)}
              post={{ locked, onSide: (s) => tapSide(a.id, s), onKey: onSideKey, refs: sideRefs }}
            />
          ))}
        </Ledger>
      </div>

      {done && (
        <div role="status" className="text-[12px] font-semibold leading-snug text-ss-ink">
          {marked === 'wrong' && (
            <p className="font-extrabold">{`You posted ${right} of ${txs.length} ${plural(txs.length, 'transaction', 'transactions')} right.`}</p>
          )}
          {named && (
            <p>
              <span className="font-extrabold">{`Debits total $${total}, and credits total $${total}.`}</span>{' '}
              Every transaction is recorded twice, once on each side, for the same amount: the dual aspect.
            </p>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  )
}

// ── trial-balance ───────────────────────────────────────────────────────────

function TransactionList({ config, open }: { config: LedgerConfig; open?: boolean }) {
  return (
    <details className="rounded-lg border border-ss-line bg-ss-panel px-2 py-1" open={open}>
      <summary className="nodrag cursor-pointer text-[12px] font-bold text-ss-ink">{`The ${config.task.transactions.length} transactions`}</summary>
      <ol className="mt-1 flex flex-col gap-1 pb-1">
        {config.task.transactions.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-ss-ink">
            <Badge n={i + 1} />
            <span>{narrate(config, t)}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function TrialBalanceTask({ config, state, setState, marked, reduced, locked }: Props) {
  const accounts = usedAccounts(config)
  const entries = entriesOf(config, enginePosts(config))
  const shown = marked === 'shown'
  const rows = shown ? Object.fromEntries(accounts.map((a) => [a.id, rightRow(config, a.id)])) as Record<string, TbRow> : rowsOf(config, state)
  const totals = typedTotals(rows)
  const done = marked !== 'idle'
  const all = balances(config)
  const judged = done ? accounts.map((a) => ({ a, ...judgeRow(config, a.id, rows[a.id], all) })) : null
  const wrong = judged?.filter((j) => j.status !== 'right') ?? []
  const nil = accounts.filter((a) => rightRow(config, a.id).dr === '' && rightRow(config, a.id).cr === '')
  const right = trialTotals(config)

  const setCell = (id: string, side: Side, value: string) => {
    if (locked) return
    setState({ rows: { ...rowsOf(config, state), [id]: { ...rows[id], [side]: value.slice(0, 8) } } })
  }
  const status = (id: string) => judged?.find((j) => j.a.id === id)?.status
  const cell = (a: Account, side: Side) => {
    const s = status(a.id)
    const bad = marked === 'wrong' && s !== undefined && s !== 'right'
    return (
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        lang="en"
        value={rows[a.id][side]}
        disabled={locked || shown}
        aria-label={`${a.label}, ${SIDE_NAME[side]} column`}
        aria-invalid={bad || undefined}
        onChange={(e) => setCell(a.id, side, e.target.value)}
        // The board's own keys stay out of the box.
        onKeyDown={(e) => e.stopPropagation()}
        className="nodrag h-8 w-full rounded-md border-2 bg-ss-panel px-1.5 text-right text-[13px] font-bold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)] disabled:opacity-100"
        style={{ borderColor: bad ? 'var(--ss-bad)' : marked === 'right' ? 'var(--ss-good)' : 'var(--ss-line)', transition: reduced ? undefined : 'border-color 200ms' }}
      />
    )
  }

  return (
    <div className="nodrag flex flex-col gap-3" onKeyDown={keepArrows}>
      <Heading config={config} />
      <Ledger>
        {accounts.map((a, k) => (
          <TAccount key={a.id} index={k} config={config} account={a} entries={entries.filter((e) => e.account === a.id)} />
        ))}
      </Ledger>
      <TransactionList config={config} />

      <div>
        <p className="mb-1 text-[12px] font-extrabold text-ss-ink">Trial balance</p>
        {!done && !locked && <p className="mb-1.5 text-[12px] leading-snug text-ss-slate">Balance each account, then enter its balance in the debit or the credit column. An account with no balance is left empty.</p>}
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-ss-slate">
              <th scope="col" className="pb-1 text-left font-bold">Account</th>
              <th scope="col" className="w-[84px] pb-1 pr-1 text-right font-bold">Debit $</th>
              <th scope="col" className="w-[84px] pb-1 text-right font-bold">Credit $</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <th scope="row" className="py-0.5 pr-1 text-left text-[12px] font-semibold text-ss-ink">{a.label}</th>
                <td className="py-0.5 pr-1">{cell(a, 'dr')}</td>
                <td className="py-0.5">{cell(a, 'cr')}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--ss-ink)' }}>
              <th scope="row" className="pt-1 text-left text-[12px] font-extrabold text-ss-ink">Total</th>
              <td className="pr-2.5 pt-1 text-right text-[13px] font-extrabold tabular-nums text-ss-ink" data-total="dr">{totals.dr}</td>
              <td className="pr-1.5 pt-1 text-right text-[13px] font-extrabold tabular-nums text-ss-ink" data-total="cr">{totals.cr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {done && (
        <div role="status" className="flex flex-col gap-1 text-[12px] leading-snug text-ss-ink">
          {marked === 'wrong' ? (
            <>
              <p className="font-extrabold">
                {`${accounts.length - wrong.length} of ${accounts.length} ${plural(accounts.length, 'row is', 'rows are')} right. `}
                {totals.dr === totals.cr ? `Your totals agree at $${totals.dr}, but a trial balance can agree and still be wrong.` : `Your totals do not agree: $${totals.dr} against $${totals.cr}.`}
              </p>
              {wrong.map((j) => <p key={j.a.id}>{j.said}</p>)}
            </>
          ) : (
            <>
              <p>
                <span className="font-extrabold">{`The totals agree: $${right.dr} each.`}</span>{' '}
                Every transaction was posted once on each side for the same amount (the dual aspect), so the debit balances equal the credit balances.
              </p>
              {accounts.filter((a) => !nil.includes(a)).map((a) => {
                const r = rightRow(config, a.id)
                return <p key={a.id}>{`${a.label}: a ${r.dr ? 'debit' : 'credit'} balance of $${r.dr || r.cr}.`}</p>
              })}
              {nil.map((a) => <p key={a.id}>{`${a.label}: its debits and credits are equal, so it has no balance and is left out.`}</p>)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── find-error ──────────────────────────────────────────────────────────────

function FindErrorTask({ config, state, setState, marked, reduced, locked }: Props) {
  const txs = config.task.transactions
  const accounts = usedAccounts(config)
  const posts = enginePosts(config)
  const entries = entriesOf(config, posts)
  const shown = marked === 'shown'
  const r = config.task.reversed ?? -1
  // A config whose reversal is not one of its transactions is refused before it is served; it still draws.
  const valid = r >= 0 && r < txs.length
  const pick = shown ? (valid ? r : null) : pickOf(config, state)
  const named = (marked === 'right' || shown) && valid
  const txRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [said, setSaid] = useState('')
  const totals = trialTotals(config)

  const choose = (i: number) => {
    if (locked) return
    setState({ pick: pick === i ? null : i })
    setSaid(pick === i ? `Transaction ${i + 1} no longer chosen.` : `Transaction ${i + 1} chosen.`)
  }
  const onTxKey = (e: KeyboardEvent, i: number) => {
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (step === undefined) return
    e.preventDefault()
    e.stopPropagation()
    txRefs.current[(i + step + txs.length) % txs.length]?.focus()
  }
  const fade = reduced ? undefined : 'background-color 200ms, border-color 200ms'
  const posted = (i: number) => `${labelOf(config, posts[i].dr)} was debited and ${labelOf(config, posts[i].cr)} credited`

  return (
    <div className="nodrag flex flex-col gap-3" onKeyDown={keepArrows}>
      <Heading config={config} />
      {!locked && !shown && <p className="text-[12px] font-semibold leading-snug text-ss-slate">One transaction is posted the wrong way round, its debit and credit swapped. Tap it.</p>}
      <ol className="flex flex-col gap-1.5" aria-label="The transactions">
        {txs.map((t, i) => {
          const on = pick === i
          return (
            <li key={i}>
              <button
                ref={(el) => {
                  txRefs.current[i] = el
                }}
                type="button"
                lang="en"
                disabled={locked || shown}
                aria-pressed={on}
                onClick={() => choose(i)}
                onKeyDown={(e) => onTxKey(e, i)}
                className="nodrag flex w-full items-start gap-2 rounded-lg border-[1.5px] px-2 py-1.5 text-left disabled:cursor-default"
                style={{ borderColor: on ? 'var(--subject)' : 'var(--ss-line)', backgroundColor: on ? 'var(--subject-soft)' : 'var(--ss-panel)', transition: fade }}
              >
                <Badge n={i + 1} />
                <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-ss-ink">{narrate(config, t)}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <Ledger>
        {accounts.map((a, k) => (
          <TAccount
            key={a.id}
            index={k}
            config={config}
            account={a}
            entries={entries.filter((e) => e.account === a.id)}
            lit={(e) => e.tx === pick}
            tone={(e) => (named && e.tx === r ? 'bad' : undefined)}
          />
        ))}
      </Ledger>
      {marked !== 'idle' && pick !== null && (
        <div role="status" className="flex flex-col gap-1 text-[12px] leading-snug text-ss-ink">
          {named ? (
            <>
              <p className="font-extrabold">{`Transaction ${r + 1} is posted the wrong way round: ${posted(r)}.`}</p>
              {explain(config, r).map((l) => <p key={l}>{l}</p>)}
              <p>{`A complete reversal still puts the same amount on each side, so the trial balance agrees ($${totals.dr} each) and cannot reveal it.`}</p>
            </>
          ) : (
            <>
              <p className="font-extrabold">{`You chose transaction ${pick + 1}, which is posted correctly: ${posted(pick)}.`}</p>
              {explain(config, pick).map((l) => <p key={l}>{l}</p>)}
            </>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  )
}

/**
 * A business's ledger as T-accounts. post: the learner posts each transaction
 * to the Dr side of one account and the Cr side of another. trial-balance: the
 * learner balances the engine's accounts into a trial balance. find-error: the
 * learner finds the one posting that is reversed.
 */
export function LedgerView(props: Props) {
  const kind = props.config.task.kind
  if (kind === 'post') return <PostTask {...props} />
  if (kind === 'trial-balance') return <TrialBalanceTask {...props} />
  return <FindErrorTask {...props} />
}

