import { initialCardState } from './sm2'
import type { RecallCard, RecallCardInput, RecallDeck, RecallSummary } from './types'

const KEY = 'ss_recall_v1'

type Store = {
  decks: RecallDeck[]
  cards: RecallCard[]
}

function load(): Store {
  if (typeof window === 'undefined') return { decks: [], cards: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { decks: [], cards: [] }
    return JSON.parse(raw) as Store
  } catch {
    return { decks: [], cards: [] }
  }
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

function uid() {
  return crypto.randomUUID()
}

export function localSummary(userId: string): RecallSummary {
  const store = load()
  const userCards = store.cards.filter(c => c.user_id === userId)
  const now = Date.now()
  const due = userCards.filter(c => new Date(c.due_at).getTime() <= now)
  const decks = store.decks
    .filter(d => d.user_id === userId)
    .map(d => ({
      ...d,
      card_count: userCards.filter(c => c.deck_id === d.id).length,
      due_count: userCards.filter(c => c.deck_id === d.id && new Date(c.due_at).getTime() <= now).length,
    }))

  return {
    due_today: due.length,
    total_cards: userCards.length,
    decks,
    storage: 'local',
  }
}

export function localDueCards(userId: string, limit = 30): RecallCard[] {
  const now = Date.now()
  return load()
    .cards.filter(c => c.user_id === userId && new Date(c.due_at).getTime() <= now)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, limit)
}

export function localAddCards(
  userId: string,
  payload: { title: string; subject?: string; cards: RecallCardInput[] },
): { deck: RecallDeck; added: number } {
  const store = load()
  const deck: RecallDeck = {
    id: uid(),
    user_id: userId,
    title: payload.title,
    subject: payload.subject ?? null,
    created_at: new Date().toISOString(),
  }
  store.decks.push(deck)

  const now = new Date().toISOString()
  const state = initialCardState()
  let added = 0
  for (const c of payload.cards) {
    const front = c.front.trim()
    const back = c.back.trim()
    if (!front || !back) continue
    store.cards.push({
      id: uid(),
      deck_id: deck.id,
      user_id: userId,
      front,
      back,
      hint: c.hint ?? null,
      front_image_url: c.front_image_url ?? null,
      front_diagram_svg: c.front_diagram_svg ?? null,
      subject: payload.subject ?? null,
      ...state,
      created_at: now,
    })
    added += 1
  }

  save(store)
  return { deck, added }
}

export function localReviewCard(userId: string, cardId: string, next: Pick<RecallCard, 'ease_factor' | 'interval_days' | 'repetitions' | 'due_at'>) {
  const store = load()
  const card = store.cards.find(c => c.id === cardId && c.user_id === userId)
  if (!card) return null
  Object.assign(card, next, { last_reviewed_at: new Date().toISOString() })
  save(store)
  return card
}
