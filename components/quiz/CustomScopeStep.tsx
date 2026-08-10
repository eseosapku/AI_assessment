'use client'

import { motion } from 'framer-motion'
import { Check, Loader2, Plus, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { FOCUS_AREA_MAX_LENGTH, type QuizScope } from '@/lib/quiz-topic'

/**
 * Choose which parts of a free-typed topic the quiz should cover.
 *
 * The selected areas become the `topics[]` the generator receives, which is
 * what keeps questions on target and drives the figure lookup — so this step is
 * doing real work, not just confirming. It stays optional though: if scoping
 * failed or returned nothing, the topic alone is a valid quiz and the wizard
 * must not dead-end.
 */
export function CustomScopeStep({
  loading,
  scope,
  degraded,
  selected,
  onToggle,
  onSetAll,
  onAddCustom,
}: {
  loading: boolean
  scope: QuizScope | null
  /** Scoping fell back — say so plainly rather than pretending it worked. */
  degraded: boolean
  selected: string[]
  onToggle: (area: string) => void
  onSetAll: (areas: string[]) => void
  onAddCustom: (area: string) => void
}) {
  const [draft, setDraft] = useState('')

  const commitDraft = () => {
    const value = draft.trim()
    if (!value) return
    onAddCustom(value)
    setDraft('')
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-ss-accent" />
        <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Working out what to cover…</p>
        <p className="mt-1 text-[12.5px] text-gray-400">Breaking your topic into areas you can pick from.</p>
      </motion.div>
    )
  }

  if (!scope) return null

  const areas = scope.focusAreas
  const allSelected = areas.length > 0 && areas.every((a) => selected.includes(a))

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
        {scope.subject}
      </p>
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{scope.topic}</h3>

      {!scope.teachable && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[12.5px] font-medium text-amber-800 dark:text-amber-200">
            I couldn&apos;t break this one down into study areas. You can still carry on — the quiz will
            just cover the topic broadly.
          </p>
        </div>
      )}

      {degraded && scope.teachable && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <p className="text-[12.5px] font-medium text-gray-600 dark:text-gray-300">
            Couldn&apos;t suggest areas just now. Add your own below, or carry on and the quiz will cover
            the topic broadly.
          </p>
        </div>
      )}

      {areas.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">
            {selected.length} of {areas.length} selected
          </p>
          <button
            type="button"
            onClick={() => onSetAll(allSelected ? [] : areas)}
            className="text-[12px] font-bold text-ss-accent hover:underline"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const on = selected.includes(area)
          return (
            <motion.button
              key={area}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onToggle(area)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                on
                  ? 'border-ss-accent bg-ss-accent-soft text-gray-900 dark:text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              <span
                className={`grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full ${
                  on ? 'bg-ss-accent' : 'border border-gray-300 dark:border-gray-600'
                }`}
              >
                {on && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
              </span>
              {area}
            </motion.button>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          maxLength={FOCUS_AREA_MAX_LENGTH}
          placeholder="Add your own area…"
          aria-label="Add your own focus area"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-gray-900 outline-none transition-colors placeholder:font-normal placeholder:text-gray-400 focus:border-ss-accent dark:border-gray-800 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={!draft.trim()}
          className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-gray-200 px-3.5 text-[12.5px] font-bold text-gray-700 transition-colors hover:border-ss-accent hover:text-ss-accent disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </motion.div>
  )
}
