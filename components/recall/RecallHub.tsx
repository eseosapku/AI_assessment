'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Brain, Layers, Play, RotateCcw } from 'lucide-react'
import { Marker } from '@/components/StudioPrimitives'
import { useAuth } from '@/components/AuthProvider'
import { backfillRecall, fetchRecallSummary } from '@/lib/recall/client'
import type { RecallSummary } from '@/lib/recall/types'

export default function RecallHub() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<RecallSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!user?.id) return
    setSummary(await fetchRecallSummary(user.id))
  }

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        // Pull misses from past assessments first, then show the library.
        await backfillRecall(user.id)
        if (!cancelled) await refresh()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const due = summary?.due_today ?? 0
  const total = summary?.total_cards ?? 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-10">
        <Link
          href="/practice"
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-brand-slate hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Practice
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue">Recall</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.04em] sm:text-5xl">
          Spaced <Marker tone="blue">repetition</Marker>
        </h1>
        <p className="mt-3 max-w-xl text-sm font-semibold text-brand-slate">
          Flip cards on a smart schedule so facts stick. Cards are built automatically from the questions you miss in quizzes.
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-gradient-to-br from-brand-ink via-[#1a2744] to-brand-blue p-8 text-white shadow-studio"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-sky">Due today</p>
            <p className="mt-1 font-display text-6xl font-black tabular-nums">{loading ? '—' : due}</p>
            <p className="mt-2 text-sm font-semibold text-white/70">
              {total} card{total !== 1 ? 's' : ''} in your library
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            {due > 0 ? (
              <Link
                href="/recall/review"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-black text-brand-ink shadow-lg hover:scale-[1.02] transition-transform"
              >
                <Play className="h-4 w-4" />
                Start review
              </Link>
            ) : (
              <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
                {total === 0 ? 'Finish a quiz to start a deck' : 'All caught up — nice work'}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: RotateCcw, title: 'Review daily', text: 'Cards come back when you are about to forget them.' },
          { icon: Brain, title: 'From your misses', text: 'After a quiz, save wrong answers as flashcards.' },
          { icon: Layers, title: 'Separate from tests', text: 'Practice tests knowledge; Recall keeps it.' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-brand-blue" />
            <p className="mt-3 font-display text-sm font-black text-brand-ink">{item.title}</p>
            <p className="mt-1 text-xs font-semibold text-brand-slate">{item.text}</p>
          </div>
        ))}
      </div>

      <section>
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">Your decks</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
          </div>
        ) : (summary?.decks?.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {summary!.decks.map((deck) => (
              <div
                key={deck.id}
                className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white px-5 py-4 shadow-sm"
              >
                <div>
                  <p className="font-display font-black text-brand-ink">{deck.title}</p>
                  {deck.subject && <p className="text-xs font-semibold text-brand-slate">{deck.subject}</p>}
                </div>
                <div className="text-right text-xs font-bold">
                  <p className="text-brand-blue">{deck.due_count ?? 0} due</p>
                  <p className="text-brand-slate">{deck.card_count ?? 0} cards</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-black/10 py-14 text-center">
            <p className="text-sm font-black text-brand-ink">No decks yet</p>
            <p className="mt-2 max-w-sm mx-auto text-xs font-semibold text-brand-slate">
              Take a quiz and the questions you miss become flashcards here automatically.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
