'use client'

import { useMemo, useState } from 'react'
import { GripVertical, Check, X } from 'lucide-react'
import type {
  InteractiveAnswer,
  InteractiveQuestion,
  MatchInteractiveQuestion,
  OrderInteractiveQuestion,
  CategorizeInteractiveQuestion,
  FillBlankInteractiveQuestion,
  TrueFalseInteractiveQuestion,
  MultiSelectInteractiveQuestion,
  OddOneOutInteractiveQuestion,
} from '@/types/interactive'

function LatexText({ children }: { children: string }) {
  const text = String(children ?? '')
  return <span className="leading-relaxed">{text}</span>
}

// ── Match pairs (tap left, then right) ───────────────────────────────────────

function MatchPairs({
  question,
  value,
  onChange,
  disabled,
}: {
  question: MatchInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const pairs = value?.kind === 'match' ? value.pairs : {}
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)

  const usedRights = useMemo(() => new Set(Object.values(pairs)), [pairs])

  const handleLeft = (i: number) => {
    if (disabled) return
    setSelectedLeft(selectedLeft === i ? null : i)
  }

  const handleRight = (j: number) => {
    if (disabled || selectedLeft === null) return
    const next = { ...pairs }
    for (const [l, r] of Object.entries(next)) {
      if (r === j) delete next[Number(l)]
    }
    next[selectedLeft] = j
    onChange({ kind: 'match', pairs: next })
    setSelectedLeft(null)
  }

  const clearPair = (leftIdx: number) => {
    if (disabled) return
    const next = { ...pairs }
    delete next[leftIdx]
    onChange({ kind: 'match', pairs: next })
  }

  // Letters for the right column so a made pair can be read at a glance:
  // the term shows the letter it points at, the definition shows the number
  // pointing back. Without that, a matched pair was only discoverable by
  // reading a truncated line of small text under the term.
  const letter = (j: number) => String.fromCharCode(65 + j)

  const matchedCount = Object.keys(pairs).length
  const total = question.left_items.length
  const activeTerm = selectedLeft !== null ? question.left_items[selectedLeft] : null

  return (
    <div>
      {/* Standing instruction + progress. The two-step nature of this
          interaction was previously only hinted at, and only after the first
          tap — so a student who tapped a definition first got no response and
          no explanation. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ss-line bg-ss-chip px-3.5 py-2.5">
        <p className="text-[12.5px] font-semibold text-ss-ink">
          {disabled
            ? 'Matches'
            : activeTerm
              ? <>Now pick the match for <span className="text-ss-accent">“{activeTerm}”</span></>
              : 'Tap a term, then tap its match'}
        </p>
        <span className="shrink-0 rounded-full bg-ss-panel px-2.5 py-1 text-[11.5px] font-extrabold text-ss-slate">
          {matchedCount} of {total} matched
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ss-slate">Terms</p>
          {question.left_items.map((item, i) => {
            const pairedRight = pairs[i]
            const isPaired = pairedRight !== undefined
            const isSelected = selectedLeft === i
            return (
              <div
                key={i}
                className={`flex items-stretch overflow-hidden rounded-xl border-2 text-sm transition-all ${
                  isSelected
                    ? 'border-ss-accent bg-[color:var(--ss-accent)]/8 ring-2 ring-[color:var(--ss-accent)]/25'
                    : isPaired
                      ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-900/10'
                      : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div
                  role="button"
                  aria-pressed={isSelected}
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => handleLeft(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleLeft(i)
                    }
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 p-3 text-left ${
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ss-chip text-[11px] font-extrabold text-ss-slate">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <LatexText>{item}</LatexText>
                  </span>
                  {isPaired && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-500 text-[11px] font-extrabold text-white">
                      {letter(pairedRight)}
                    </span>
                  )}
                </div>
                {isPaired && !disabled && (
                  <button
                    type="button"
                    onClick={() => clearPair(i)}
                    aria-label={`Clear match for ${item}`}
                    className="shrink-0 border-l border-emerald-200 px-3 text-ss-slate hover:bg-red-50 hover:text-red-500 dark:border-emerald-800 dark:hover:bg-red-900/20"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ss-slate">Matches</p>
          {question.right_items.map((item, j) => {
            const isUsed = usedRights.has(j)
            // The number of the term this definition is currently claimed by,
            // so the link is visible from both columns.
            const ownerIdx = Object.entries(pairs).find(([, r]) => r === j)?.[0]
            const awaiting = selectedLeft !== null
            return (
              <button
                key={j}
                type="button"
                disabled={disabled || (isUsed && selectedLeft === null)}
                onClick={() => handleRight(j)}
                className={`flex w-full items-center gap-2.5 rounded-xl border-2 p-3 text-left text-sm transition-all ${
                  isUsed
                    ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10'
                    : awaiting
                      ? 'border-[color:var(--ss-accent)]/40 hover:border-ss-accent hover:bg-[color:var(--ss-accent)]/8'
                      : 'border-gray-200 dark:border-gray-700'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${
                    isUsed ? 'bg-emerald-500 text-white' : 'bg-ss-chip text-ss-slate'
                  }`}
                >
                  {letter(j)}
                </span>
                <span className="min-w-0 flex-1">
                  <LatexText>{item}</LatexText>
                </span>
                {ownerIdx !== undefined && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-100 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {Number(ownerIdx) + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Order items (drag to reorder) ────────────────────────────────────────────

function OrderItems({
  question,
  value,
  onChange,
  disabled,
}: {
  question: OrderInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const order = useMemo(() => {
    if (value?.kind === 'order' && value.order.length === question.items.length) return value.order
    return question.items.map((_, i) => i)
  }, [value, question.items])

  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const moveItem = (from: number, to: number) => {
    if (disabled || from === to) return
    const next = [...order]
    const [removed] = next.splice(from, 1)
    next.splice(to, 0, removed)
    onChange({ kind: 'order', order: next })
  }

  return (
    <div className="space-y-2">
      {order.map((itemIdx, pos) => (
        <div
          key={itemIdx}
          draggable={!disabled}
          onDragStart={() => setDragIdx(pos)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragIdx !== null) moveItem(dragIdx, pos); setDragIdx(null) }}
          onDragEnd={() => setDragIdx(null)}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 bg-white dark:bg-gray-900/40 cursor-grab active:cursor-grabbing transition-shadow ${
            dragIdx === pos ? 'border-blue-400 shadow-md' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <GripVertical className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold flex items-center justify-center shrink-0">
            {pos + 1}
          </span>
          <span className="flex-1 text-sm"><LatexText>{question.items[itemIdx]}</LatexText></span>
          {/* Drag is a desktop-only shortcut — HTML5 drag never fires on touch,
              so these buttons are the real control on a phone. They were 12px
              grey glyphs with no label; now they are proper tap targets. */}
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              disabled={disabled || pos === 0}
              onClick={() => moveItem(pos, pos - 1)}
              aria-label={`Move "${question.items[itemIdx]}" up to position ${pos}`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-700 hover:border-ss-accent hover:text-ss-accent disabled:opacity-30 dark:border-gray-600 dark:text-gray-300"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={disabled || pos === order.length - 1}
              onClick={() => moveItem(pos, pos + 1)}
              aria-label={`Move "${question.items[itemIdx]}" down to position ${pos + 2}`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-700 hover:border-ss-accent hover:text-ss-accent disabled:opacity-30 dark:border-gray-600 dark:text-gray-300"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs text-ss-slate text-center mt-2">Drag items or use arrows to reorder</p>
    </div>
  )
}

// ── Categorize (drag items into bins) ────────────────────────────────────────

function CategorizeItems({
  question,
  value,
  onChange,
  disabled,
}: {
  question: CategorizeInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const assignments = value?.kind === 'categorize' ? value.assignments : {}

  const pool = question.items
    .map((item, i) => ({ item, i }))
    .filter(({ i }) => assignments[i] === undefined)

  const itemsInCategory = (catIdx: number) =>
    question.items
      .map((item, i) => ({ item, i }))
      .filter(({ i }) => assignments[i] === catIdx)

  const assign = (itemIdx: number, catIdx: number | undefined) => {
    if (disabled) return
    const next = { ...assignments }
    if (catIdx === undefined) delete next[itemIdx]
    else next[itemIdx] = catIdx
    onChange({ kind: 'categorize', assignments: next })
  }

  const [dragItem, setDragItem] = useState<number | null>(null)
  // Tap-to-place selection. HTML5 drag does not fire on touch devices, so drag
  // alone made this question type impossible to answer on a phone — items in
  // the pool could never reach a category. Selection works for touch, mouse,
  // keyboard and screen readers alike; drag stays as a desktop shortcut.
  const [picked, setPicked] = useState<number | null>(null)

  const place = (catIdx: number) => {
    if (disabled || picked === null) return
    assign(picked, catIdx)
    setPicked(null)
  }

  const sorted = question.items.length - pool.length
  const pickedLabel = picked !== null ? question.items[picked] : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ss-line bg-ss-chip px-3.5 py-2.5">
        <p className="text-[12.5px] font-semibold text-ss-ink">
          {disabled
            ? 'Sorted items'
            : pickedLabel
              ? <>Now tap a category for <span className="text-ss-accent">“{pickedLabel}”</span></>
              : 'Tap an item, then tap the category it belongs to'}
        </p>
        <span className="shrink-0 rounded-full bg-ss-panel px-2.5 py-1 text-[11.5px] font-extrabold text-ss-slate">
          {sorted} of {question.items.length} sorted
        </span>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Items to sort</p>
        <div className="flex min-h-[48px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-gray-300 p-3 dark:border-gray-700">
          {pool.length === 0 && (
            <span className="text-[12.5px] italic text-gray-500">All items sorted — tap one in a category to bring it back.</span>
          )}
          {pool.map(({ item, i }) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              aria-pressed={picked === i}
              onClick={() => setPicked(picked === i ? null : i)}
              draggable={!disabled}
              onDragStart={() => setDragItem(i)}
              onDragEnd={() => setDragItem(null)}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                picked === i
                  ? 'border-ss-accent bg-[color:var(--ss-accent)]/15 font-semibold text-ss-ink ring-2 ring-[color:var(--ss-accent)]/30'
                  : 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${question.categories.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {question.categories.map((cat, catIdx) => {
          const awaiting = picked !== null && !disabled
          return (
            <div
              key={catIdx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragItem !== null) assign(dragItem, catIdx); setDragItem(null) }}
              className={`rounded-xl border-2 p-3 transition-colors ${
                awaiting
                  ? 'border-[color:var(--ss-accent)]/50 bg-[color:var(--ss-accent)]/5'
                  : 'border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/20'
              }`}
            >
              <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{cat}</p>

              {/* The category itself is the drop target when an item is held,
                  so the whole box is tappable rather than a hidden hotspot. */}
              {awaiting && (
                <button
                  type="button"
                  onClick={() => place(catIdx)}
                  // Names the category too: every category renders one of these
                  // at once, so "Put X here" alone gives a screen-reader user
                  // several identical buttons with no way to tell them apart.
                  aria-label={`Put “${pickedLabel}” in ${cat}`}
                  className="mb-2 w-full rounded-lg border border-dashed border-ss-accent px-3 py-2 text-[12.5px] font-bold text-ss-accent hover:bg-[color:var(--ss-accent)]/10"
                >
                  Put “{pickedLabel}” here
                </button>
              )}

              <div className="flex min-h-[40px] flex-wrap gap-2">
                {itemsInCategory(catIdx).map(({ item, i }) => (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => assign(i, undefined)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:border-red-400 dark:border-gray-600 dark:bg-gray-800"
                    title="Tap to return this item to the pool"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Fill blanks (word bank) ──────────────────────────────────────────────────

function FillBlanks({
  question,
  value,
  onChange,
  disabled,
}: {
  question: FillBlankInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const values = value?.kind === 'fill_blank' ? value.values : {}
  const usedWords = useMemo(() => new Set(Object.values(values).filter(Boolean)), [values])

  const setBlank = (id: string, word: string) => {
    if (disabled) return
    onChange({ kind: 'fill_blank', values: { ...values, [id]: word } })
  }

  const clearBlank = (id: string) => {
    if (disabled) return
    const next = { ...values }
    delete next[id]
    onChange({ kind: 'fill_blank', values: next })
  }

  const parts = question.template.split(/(\{\{\d+\}\})/)

  return (
    <div className="space-y-5">
      <div className="text-base sm:text-lg leading-loose">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\d+)\}\}$/)
          if (!m) return <span key={i}><LatexText>{part}</LatexText></span>
          const id = m[1]
          const filled = values[id]
          return (
            <span key={i} className="inline-block mx-1 align-middle">
              {filled ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => clearBlank(id)}
                  className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 text-blue-800 dark:text-blue-200 font-medium text-sm"
                >
                  {filled}
                </button>
              ) : (
                <span className="inline-block min-w-[80px] px-3 py-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-ss-slate text-sm text-center">
                  ?
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ss-slate mb-2">Word bank</p>
        <div className="flex flex-wrap gap-2">
          {question.word_bank.map((word, i) => {
            const isUsed = usedWords.has(word)
            return (
              <button
                key={i}
                type="button"
                disabled={disabled || isUsed}
                onClick={() => {
                  const emptyBlank = question.blanks.find((b) => !values[b.id])
                  if (emptyBlank) setBlank(emptyBlank.id, word)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  isUsed
                    ? 'opacity-40 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {word}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-ss-slate mt-2">Tap a word, then it fills the next empty gap. Tap a filled gap to remove.</p>
      </div>
    </div>
  )
}

// ── True / False statements ──────────────────────────────────────────────────

function TrueFalseStatements({
  question,
  value,
  onChange,
  disabled,
}: {
  question: TrueFalseInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const answers = value?.kind === 'true_false' ? value.answers : {}

  const setAnswer = (i: number, val: boolean) => {
    if (disabled) return
    onChange({ kind: 'true_false', answers: { ...answers, [i]: val } })
  }

  return (
    <div className="space-y-3">
      {question.statements.map((stmt, i) => {
        const chosen = answers[i]
        return (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20"
          >
            <p className="flex-1 text-sm leading-relaxed"><LatexText>{stmt}</LatexText></p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAnswer(i, true)}
                // State was carried by fill colour alone, so a screen reader
                // announced "True button" whether or not it was chosen.
                aria-pressed={chosen === true}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  chosen === true
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-200 dark:border-gray-600 hover:border-green-400 text-gray-600 dark:text-gray-300'
                }`}
              >
                True
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAnswer(i, false)}
                aria-pressed={chosen === false}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  chosen === false
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'border-gray-200 dark:border-gray-600 hover:border-red-400 text-gray-600 dark:text-gray-300'
                }`}
              >
                False
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Multi-select (select all that apply) ─────────────────────────────────────

function MultiSelectOptions({
  question,
  value,
  onChange,
  disabled,
}: {
  question: MultiSelectInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const selected = value?.kind === 'multi_select' ? value.selected : []
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (i: number) => {
    if (disabled) return
    const next = new Set(selectedSet)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    onChange({ kind: 'multi_select', selected: [...next].sort((a, b) => a - b) })
  }

  return (
    <div className="flex flex-wrap gap-3">
      {question.options.map((opt, i) => {
        const isOn = selectedSet.has(i)
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => toggle(i)}
            role="checkbox"
            aria-checked={isOn}
            className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-left max-w-full ${
              isOn
                ? 'bg-indigo-500 border-indigo-500 text-white shadow-md scale-[1.02]'
                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 bg-white dark:bg-gray-900/40'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 ${
                isOn ? 'border-white bg-white/20' : 'border-gray-300 dark:border-gray-600'
              }`}>
                {isOn && <Check className="w-3 h-3" />}
              </span>
              <LatexText>{opt}</LatexText>
            </span>
          </button>
        )
      })}
      <p className="w-full text-xs text-ss-slate mt-1">Tap every option that applies — you can select more than one</p>
    </div>
  )
}

// ── Odd one out ──────────────────────────────────────────────────────────────

function OddOneOutGrid({
  question,
  value,
  onChange,
  disabled,
}: {
  question: OddOneOutInteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const selected = value?.kind === 'odd_one_out' ? value.selected : undefined

  return (
    // role="radio" is only meaningful inside a group; without this the options
    // are announced as radios with no set to belong to.
    <div role="radiogroup" aria-label="Pick the odd one out" className="grid grid-cols-2 gap-3">
      {question.items.map((item, i) => {
        const isSelected = selected === i
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ kind: 'odd_one_out', selected: i })}
            role="radio"
            aria-checked={isSelected}
            className={`p-4 rounded-2xl text-sm font-medium border-2 transition-all text-center min-h-[80px] flex items-center justify-center ${
              isSelected
                ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-lg scale-[1.03] ring-2 ring-amber-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/10'
            }`}
          >
            <LatexText>{item}</LatexText>
          </button>
        )
      })}
    </div>
  )
}

// ── Main player ──────────────────────────────────────────────────────────────

export function InteractiveQuestionPlayer({
  question,
  value,
  onChange,
  disabled,
}: {
  question: InteractiveQuestion
  value: InteractiveAnswer | undefined
  onChange: (a: InteractiveAnswer) => void
  disabled?: boolean
}) {
  const kindLabel: Record<string, string> = {
    match: 'Matching',
    order: 'Put in order',
    categorize: 'Sort into groups',
    fill_blank: 'Fill in the gaps',
    true_false: 'True or False',
    multi_select: 'Select all that apply',
    odd_one_out: 'Odd one out',
  }

  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-4">
        ✦ Interactive · {kindLabel[question.kind] ?? question.kind}
      </div>
      {question.kind === 'match' && (
        <MatchPairs question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'order' && (
        <OrderItems question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'categorize' && (
        <CategorizeItems question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'fill_blank' && (
        <FillBlanks question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'true_false' && (
        <TrueFalseStatements question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'multi_select' && (
        <MultiSelectOptions question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
      {question.kind === 'odd_one_out' && (
        <OddOneOutGrid question={question} value={value} onChange={onChange} disabled={disabled} />
      )}
    </div>
  )
}

// ── Results card ─────────────────────────────────────────────────────────────

export function InteractiveResultCard({
  question,
  answer,
  grade,
  idx,
}: {
  question: InteractiveQuestion
  answer: InteractiveAnswer | undefined
  grade: { marks_awarded: number; marks_total: number; item_results: { label: string; correct: boolean }[] }
  idx: number
}) {
  const passed = grade.marks_awarded >= grade.marks_total / 2
  const kindLabel: Record<string, string> = {
    match: 'Matching',
    order: 'Ordering',
    categorize: 'Sorting',
    fill_blank: 'Fill in gaps',
    true_false: 'True / False',
    multi_select: 'Multi-select',
    odd_one_out: 'Odd one out',
  }

  return (
    <div className={`rounded-2xl p-6 border-l-4 ${passed ? 'border-l-green-500' : 'border-l-red-500'} bg-white dark:bg-[#1c1c1e] border border-gray-200/50 dark:border-gray-800/50`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-lg font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
          {grade.marks_awarded}/{grade.marks_total}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold">
          Interactive · {kindLabel[question.kind]}
        </span>
        <span className="text-sm text-ss-slate">Question {idx + 1}</span>
      </div>
      <h3 className="text-lg font-medium mb-4">{question.question}</h3>

      <div className="space-y-1.5 mb-4">
        {grade.item_results.map((r, i) => (
          <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            r.correct ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {r.correct ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            <span>{r.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm">
        <span className="font-semibold">Explanation: </span>
        {question.explanation}
      </div>
    </div>
  )
}

export function isInteractiveQuestionType(q: { type?: string }): boolean {
  return String(q?.type || '').toLowerCase() === 'interactive'
}
