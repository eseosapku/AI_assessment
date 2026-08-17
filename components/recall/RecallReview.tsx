'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { fetchDueCards, submitReview } from '@/lib/recall/client'
import type { RecallCard } from '@/lib/recall/types'
import { type RecallRating } from '@/lib/recall/sm2'
import RecallCardFace from '@/components/recall/RecallCardFace'

const RATING_META: {
  rating: RecallRating
  label: string
  desc: string
  tone: string
  badge: string
}[] = [
  {
    rating: 1,
    label: 'I forgot',
    desc: "Didn't remember",
    tone: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-900',
    badge: 'bg-red-200/80 text-red-900',
  },
  {
    rating: 2,
    label: 'Almost',
    desc: 'Took effort',
    tone: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-950',
    badge: 'bg-amber-200/80 text-amber-950',
  },
  {
    rating: 3,
    label: 'Got it',
    desc: 'Remembered',
    tone: 'bg-ss-accent-soft hover:brightness-95 border-[color:var(--ss-accent)]/30 text-ss-ink',
    badge: 'bg-ss-accent-soft text-ss-accent',
  },
  {
    rating: 4,
    label: 'Too easy',
    desc: 'Already knew it',
    tone: 'bg-gradient-to-br from-ss-accent to-ss-accent-deep hover:brightness-95 border-ss-accent text-white',
    badge: 'bg-white/25 text-white',
  },
]

export default function RecallReview() {
  const { user } = useAuth()
  const [queue, setQueue] = useState<RecallCard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const cards = await fetchDueCards(user.id)
    setQueue(cards)
    setIndex(0)
    setFlipped(false)
    setDone(cards.length === 0)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const card = queue[index]

  const rate = async (rating: RecallRating) => {
    if (!user?.id || !card) return
    await submitReview(user.id, card, rating)
    setReviewed((r) => r + 1)
    setFlipped(false)
    if (index + 1 >= queue.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <p className="font-display text-3xl font-black text-ss-ink">
            {reviewed > 0 ? 'Session complete' : 'Nothing due'}
          </p>
          <p className="mt-2 text-sm font-semibold text-ss-slate">
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed !== 1 ? 's' : ''}. They will come back on schedule.`
              : 'Check back later or add cards from a quiz result.'}
          </p>
          <Link
            href="/recall"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ss-accent px-6 py-3 text-sm font-black text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Recall
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/recall"
          className="inline-flex items-center gap-1 text-sm font-bold text-ss-slate hover:text-ss-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Recall
        </Link>
        <p className="text-xs font-black tabular-nums text-ss-slate">
          {index + 1} / {queue.length}
        </p>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-ss-chip">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-ss-accent to-ss-accent-bright"
          animate={{ width: `${((index + (flipped ? 0.5 : 0)) / queue.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-2"
        >
          <div className="perspective-[1200px]">
            <motion.button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              // Grid rather than absolute faces: both faces share one cell, so
              // the card grows to fit the taller of the two. As absolutely
              // positioned children of a fixed-height box, a long answer spilled
              // straight over the controls below it.
              className="relative grid min-h-[17rem] w-full sm:min-h-[19rem]"
            >
              <div
                className="col-start-1 row-start-1 flex flex-col rounded-[1.75rem] border border-ss-line bg-ss-panel p-6 text-left shadow-studio sm:p-8"
                style={{ backfaceVisibility: 'hidden' }}
              >
                {card.subject && (
                  <span className="mb-3 inline-block w-fit rounded-full bg-ss-chip px-2.5 py-0.5 text-[12px] font-black uppercase tracking-widest text-ss-accent">
                    {card.subject}
                  </span>
                )}
                <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Question</p>
                <div className="mt-4 flex flex-1 items-center">
                  <RecallCardFace card={card} side="front" />
                </div>
                <p className="mt-4 text-center text-[12px] font-semibold text-[color:var(--ss-slate)]/80">Tap card to reveal answer</p>
              </div>

              <div
                className="col-start-1 row-start-1 flex flex-col rounded-[1.75rem] border border-ss-line bg-gradient-to-br from-ss-panel to-ss-accent-soft p-6 text-left shadow-studio sm:p-8"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                {card.subject && (
                  <span className="mb-3 inline-block w-fit rounded-full bg-ss-accent-soft px-2.5 py-0.5 text-[12px] font-black uppercase tracking-widest text-ss-accent">
                    {card.subject}
                  </span>
                )}
                <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent">Answer</p>
                <div className="mt-4 flex flex-1 items-center">
                  <RecallCardFace card={card} side="back" />
                </div>
              </div>
            </motion.button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:brightness-95"
            >
              {flipped ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Show question
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Reveal answer
                </>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {flipped && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-black text-ss-ink">How well did you remember?</p>
              <p className="mt-1 text-xs font-semibold text-ss-slate">
                Your choice sets when this card comes back.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp((h) => !h)}
              className="shrink-0 rounded-full p-2 text-ss-slate hover:bg-ss-chip hover:text-ss-ink"
              aria-label="How scheduling works"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>

          {showHelp && (
            <div className="mb-5 rounded-xl border border-ss-accent bg-ss-accent-soft px-4 py-3 text-xs font-semibold text-ss-ink">
              Cards you struggle with return sooner. Cards you know well are pushed further out — so you review right
              before you forget.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {RATING_META.map((r) => (
              <button
                key={r.rating}
                type="button"
                onClick={() => rate(r.rating)}
                className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${r.tone}`}
              >
                <p className="text-sm font-black">{r.label}</p>
                <p className="text-[12px] font-semibold opacity-80">{r.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
