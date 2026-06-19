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

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Terms</p>
        {question.left_items.map((item, i) => {
          const pairedRight = pairs[i]
          const isSelected = selectedLeft === i
          return (
            <div
              key={i}
              className={`flex items-stretch rounded-xl border-2 text-sm transition-all overflow-hidden ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : pairedRight !== undefined
                    ? 'border-green-300 bg-green-50/80 dark:border-green-700 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => handleLeft(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleLeft(i)
                  }
                }}
                className={`flex-1 text-left p-3 min-w-0 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}`}
              >
                <LatexText>{item}</LatexText>
                {pairedRight !== undefined && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
                    → {question.right_items[pairedRight]}
                  </p>
                )}
              </div>
              {pairedRight !== undefined && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => clearPair(i)}
                  aria-label="Clear match"
                  className="px-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-l border-gray-200 dark:border-gray-700 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Definitions</p>
        {question.right_items.map((item, j) => {
          const isUsed = usedRights.has(j)
          return (
            <button
              key={j}
              type="button"
              disabled={disabled || (isUsed && selectedLeft === null)}
              onClick={() => handleRight(j)}
              className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                isUsed
                  ? 'border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900/40'
                  : selectedLeft !== null
                    ? 'border-blue-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <LatexText>{item}</LatexText>
            </button>
          )
        })}
      </div>
      {selectedLeft !== null && (
        <p className="sm:col-span-2 text-sm text-blue-600 dark:text-blue-400 text-center">
          Now tap the matching definition on the right
        </p>
      )}
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
          <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
            {pos + 1}
          </span>
          <span className="flex-1 text-sm"><LatexText>{question.items[itemIdx]}</LatexText></span>
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              type="button"
              disabled={disabled || pos === 0}
              onClick={() => moveItem(pos, pos - 1)}
              className="text-xs text-gray-400 hover:text-blue-500 disabled:opacity-30 px-1"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={disabled || pos === order.length - 1}
              onClick={() => moveItem(pos, pos + 1)}
              className="text-xs text-gray-400 hover:text-blue-500 disabled:opacity-30 px-1"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 text-center mt-2">Drag items or use arrows to reorder</p>
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Items to sort</p>
        <div className="flex flex-wrap gap-2 min-h-[48px] p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          {pool.length === 0 && (
            <span className="text-xs text-gray-400 italic">All items sorted — drag back here to undo</span>
          )}
          {pool.map(({ item, i }) => (
            <span
              key={i}
              draggable={!disabled}
              onDragStart={() => setDragItem(i)}
              onDragEnd={() => setDragItem(null)}
              className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm cursor-grab border border-blue-200 dark:border-blue-800"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${question.categories.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {question.categories.map((cat, catIdx) => (
          <div
            key={catIdx}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragItem !== null) assign(dragItem, catIdx); setDragItem(null) }}
            className="rounded-xl border-2 border-gray-200 dark:border-gray-700 p-3 min-h-[100px] bg-gray-50/50 dark:bg-gray-900/20"
          >
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{cat}</p>
            <div className="flex flex-wrap gap-2">
              {itemsInCategory(catIdx).map(({ item, i }) => (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => assign(i, undefined)}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-sm border border-gray-200 dark:border-gray-600 hover:border-red-300"
                  title="Click to return to pool"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center">Drag items into categories, or tap an item to return it</p>
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
                <span className="inline-block min-w-[80px] px-3 py-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-sm text-center">
                  ?
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Word bank</p>
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
        <p className="text-xs text-gray-400 mt-2">Tap a word, then it fills the next empty gap. Tap a filled gap to remove.</p>
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
      <p className="w-full text-xs text-gray-400 mt-1">Tap every option that applies — you can select more than one</p>
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
    <div className="grid grid-cols-2 gap-3">
      {question.items.map((item, i) => {
        const isSelected = selected === i
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ kind: 'odd_one_out', selected: i })}
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
        <span className="text-sm text-gray-400">Question {idx + 1}</span>
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
