export type RecallCardInput = {
  front: string
  back: string
  hint?: string | null
  front_image_url?: string | null
  front_diagram_svg?: string | null
}

export type RecallCard = RecallCardInput & {
  id: string
  deck_id: string
  user_id: string
  subject?: string | null
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: string
  last_reviewed_at?: string | null
  created_at: string
}

export type RecallDeck = {
  id: string
  user_id: string
  title: string
  subject?: string | null
  card_count?: number
  due_count?: number
  created_at: string
}

export type RecallSummary = {
  due_today: number
  total_cards: number
  decks: RecallDeck[]
  storage: 'database' | 'local'
}
