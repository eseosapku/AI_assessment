'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Brain, Layers, Play, RotateCcw } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { backfillRecall, fetchRecallSummary } from '@/lib/recall/client'
import { subjectArt } from '@/lib/studio/subjectArt'
import type { RecallSummary } from '@/lib/recall/types'
import ProductTour from '@/components/studio/ProductTour'

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
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <Link href="/practice" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-ss-slate hover:text-ss-ink">
          <ArrowLeft className="h-4 w-4" /> Practice
        </Link>
        <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-ss-accent">Recall</p>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-tight text-ss-ink">
          Spaced <span className="text-ss-accent">repetition</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm font-semibold text-ss-slate">
          Cards come back just before you would forget them, and they build themselves from the questions you get wrong.
        </p>
      </header>

      <section data-tour="recall-due" className="relative mb-8 overflow-hidden rounded-[24px] px-9 py-8 text-white" style={{ background: 'linear-gradient(115deg,#0C74B4,#1AA0DC 52%,#3ED3F5)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/recall.png" alt="" aria-hidden className="pointer-events-none absolute right-3 top-1/2 hidden h-[112%] -translate-y-1/2 object-contain opacity-90 sm:block" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-white/80">Due today</p>
            <p className="mt-1 text-6xl font-extrabold tabular-nums">{loading ? '—' : due}</p>
            <p className="mt-2 text-sm font-semibold text-white/75">{total} card{total !== 1 ? 's' : ''} in your library</p>
          </div>
          <div className="relative flex flex-col gap-3 sm:items-end">
            {due > 0 ? (
              <Link href="/recall/review" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#13202A] px-8 py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]">
                <Play className="h-4 w-4" /> Review {due} card{due !== 1 ? 's' : ''}
              </Link>
            ) : (
              <p className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white/90">
                {total === 0 ? 'Take a quiz and the ones you miss land here' : 'Nothing due — come back tomorrow'}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: RotateCcw, title: 'Just before you forget', text: 'Cards return on a schedule built around when memory fades, not a fixed timetable.' },
          { icon: Brain, title: 'Built from your mistakes', text: 'Every question you get wrong becomes a card here automatically.' },
          { icon: Layers, title: 'Different job to a quiz', text: 'A quiz finds out what you know. This is what stops you losing it again.' },
        ].map((item) => (
          <div key={item.title} className="rounded-[18px] border border-ss-line bg-ss-panel p-5">
            <item.icon className="h-5 w-5 text-ss-accent" strokeWidth={1.9} />
            <p className="mt-3 text-sm font-extrabold text-ss-ink">{item.title}</p>
            <p className="mt-1 text-xs font-semibold text-ss-slate">{item.text}</p>
          </div>
        ))}
      </div>

      <section>
        <p data-tour="recall-decks" className="mb-4 text-[12px] font-bold uppercase tracking-[0.25em] text-ss-slate">Your decks</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
          </div>
        ) : (summary?.decks?.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {summary!.decks.map((deck) => {
              const cards = deck.card_count ?? 0
              const dueNow = deck.due_count ?? 0
              // What's resting vs waiting. A bare "3 due / 20 cards" gave no
              // sense of whether a deck was in good shape or piling up.
              const restingPct = cards > 0 ? Math.round(((cards - dueNow) / cards) * 100) : 0
              return (
                <div key={deck.id} className="rounded-[18px] border border-ss-line bg-ss-panel px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={subjectArt(deck.subject)} alt="" aria-hidden className="h-9 w-9 shrink-0 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold text-ss-ink">{deck.title}</p>
                      {deck.subject && <p className="truncate text-xs font-semibold text-ss-slate">{deck.subject}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      {dueNow > 0 ? (
                        <span className="rounded-full bg-[color:var(--ss-accent)]/12 px-2.5 py-1 text-[13px] font-extrabold text-ss-accent">
                          {dueNow} due
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-extrabold text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400">
                          Rested
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--ss-ink)]/8">
                      <div
                        className="h-full rounded-full bg-ss-accent transition-[width] duration-500"
                        style={{ width: `${Math.max(restingPct, 2)}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-[12px] font-bold text-ss-slate">
                      {cards} card{cards !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-[20px] border border-ss-line bg-ss-panel py-12 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/empty-state.png" alt="" className="mb-3 h-24 w-auto" />
            <p className="text-sm font-extrabold text-ss-ink">Nothing to review yet</p>
            <p className="mx-auto mt-2 max-w-sm text-xs font-semibold text-ss-slate">
              Take a quiz and the questions you miss become flashcards here automatically.
            </p>
          </div>
        )}
      </section>

      <ProductTour id="recall" />
    </div>
  )
}
