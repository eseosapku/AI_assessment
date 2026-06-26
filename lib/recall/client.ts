'use client'

import type { RecallCard, RecallSummary } from '@/lib/recall/types'
import { buildMissedRecallCards } from '@/lib/recall/build-missed-cards'
import { localAddCards, localDueCards, localReviewCard, localSummary } from '@/lib/recall/local-store'
import { scheduleReview, type RecallRating } from '@/lib/recall/sm2'

export async function fetchRecallSummary(userId: string): Promise<RecallSummary> {
  try {
    const res = await fetch(`/api/recall/summary?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    if (res.ok) return res.json()
  } catch {
    // local fallback
  }
  return localSummary(userId)
}

export async function fetchDueCards(userId: string): Promise<RecallCard[]> {
  try {
    const res = await fetch(`/api/recall/due?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      return json.cards ?? []
    }
  } catch {
    // local fallback
  }
  return localDueCards(userId)
}

export async function submitReview(userId: string, card: RecallCard, rating: RecallRating) {
  const next = scheduleReview(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
      due_at: card.due_at,
    },
    rating,
  )

  try {
    const res = await fetch('/api/recall/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, cardId: card.id, rating }),
    })
    if (res.ok) return
  } catch {
    // local fallback
  }

  localReviewCard(userId, card.id, next)
}

export async function importResultToRecall(userId: string, resultId: string) {
  try {
    const res = await fetch('/api/recall/import-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resultId }),
    })
    const json = await res.json()
    if (res.ok) return json
    if (res.status === 503) throw new Error('fallback')
  } catch (e: any) {
    if (e?.message !== 'fallback') throw e
  }

  // Local fallback: fetch result and build cards client-side
  const res = await fetch(`/api/results/${resultId}?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to load result')

  const row = json.data
  const questions = Array.isArray(row?.questions_data) ? row.questions_data : []
  const answers = row?.answers ?? {}
  const subject = row?.assessments?.subject ?? 'Assessment'
  const cards = buildMissedRecallCards(questions, answers, subject)

  if (!cards.length) return { added: 0 }
  return localAddCards(userId, { title: `${subject} — missed items`, subject, cards })
}

// Pull missed items from any past assessment results that aren't carded yet, so
// Recall fills from the student's real work. Safe to call on every Recall open.
export async function backfillRecall(userId: string): Promise<{ decksAdded: number; cardsAdded: number }> {
  try {
    const res = await fetch('/api/recall/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) return res.json()
  } catch {
    // no-op: Recall still works with whatever is already saved
  }
  return { decksAdded: 0, cardsAdded: 0 }
}
