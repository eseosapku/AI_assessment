// scripts/figure-library/screen.ts
import { readJson, type Store } from './store'
import { LEVELS } from './review'

export const SCREEN_JOB = 'p1b-screen'
/** A 512 px image (about 600 tokens) and a short prompt to Nova Lite, with a sentence back. */
export const SCREEN_USD_PER_ITEM = 0.0003

export interface ScreenItem { figureId: string; subject: string; band: string; topic: string; title: string; description: string; preview: string }
export interface Screening { keep: boolean; shows: string; reasons: string[] }

/** Each judgement, the answer that keeps the image, and the reason recorded when it does not. */
const CHECKS: [string, boolean, string][] = [
  ['educational', true, 'not educational'],
  ['on_topic', true, 'off the topic'],
  ['clear', true, 'not clear enough'],
  ['beyond_level', false, 'beyond this level'],
  ['person_is_subject', false, 'a person is the subject'],
  ['mostly_text', false, 'mostly text'],
  ['foreign_labels', false, 'labels not in English'],
  ['decorative', false, 'decorative'],
]

export function screenPrompt(item: ScreenItem): string {
  return [
    `This image may be used in a ${item.subject} quiz for learners at ${LEVELS[item.band] ?? item.band}, on the topic "${item.topic}".`,
    `Its file is called "${item.title}".${item.description ? ` Its description says: "${item.description.slice(0, 300)}"` : ''}`,
    '',
    'Look at the image and judge it:',
    '- educational: it clearly shows something learners of this topic study (an organism, a cell, a landform, apparatus, a historical source, a process), well enough to ask a question about.',
    '- on_topic: it fits this topic, not only the subject in general.',
    '- clear: sharp and well lit, with the thing that matters large enough to see.',
    '- beyond_level: a figure from a research paper (often several labelled panels), specialist or medical detail, or anything beyond what learners at this level study.',
    '- person_is_subject: an identifiable person is the main subject (a portrait, a selfie, a posed group).',
    '- mostly_text: it is mainly words or a table.',
    '- foreign_labels: it has labels or captions in a language other than English.',
    '- decorative: a logo, an icon, clip art, an advert or a decoration.',
    '',
    'Reply with JSON only: {"shows":"one sentence on what the image shows","educational":true,"on_topic":true,"clear":true,"beyond_level":false,"person_is_subject":false,"mostly_text":false,"foreign_labels":false,"decorative":false}',
  ].join('\n')
}

/** The screener's reply. Whether to keep is worked out here; a reply missing any judgement is refused, never read as a keep. */
export function parseScreen(raw: unknown): Screening {
  if (!raw || typeof raw !== 'object') throw new Error('The screening is not a JSON object')
  const r = raw as Record<string, unknown>
  const reasons: string[] = []
  for (const [key, keeps, why] of CHECKS) {
    if (typeof r[key] !== 'boolean') throw new Error(`The screening has no ${key} judgement`)
    if (r[key] !== keeps) reasons.push(why)
  }
  const shows = String(r.shows ?? '').trim()
  if (!shows) throw new Error('The screening does not say what the image shows')
  return { keep: reasons.length === 0, shows: shows.slice(0, 300), reasons }
}

/** Real candidates not yet screened, with their topic, oldest first. */
export function toScreen(db: Store, o: { limit?: number } = {}): ScreenItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.spec, f.preview, MIN(t.name) AS topic FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.origin <> 'drawn' AND f.status = 'candidate' AND f.id NOT IN (SELECT figure_id FROM screenings)
    GROUP BY f.id ORDER BY f.id LIMIT ?`).all(o.limit ?? 1_000_000) as { id: string; subject: string; band: string; spec: string; preview: string; topic: string }[]
  return rows.map((r) => {
    const spec = readJson<{ title?: string; description?: string }>(r.spec, {})
    return { figureId: r.id, subject: r.subject, band: r.band, topic: r.topic, title: spec.title ?? '', description: spec.description ?? '', preview: r.preview }
  })
}

/** Records one screening, replacing any earlier one; the figure becomes screened, or rejected with the reasons. */
export function saveScreen(db: Store, o: { figureId: string; model: string; screening: Screening; detail: unknown }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(figure_id) DO UPDATE SET model = excluded.model, keep = excluded.keep, shows = excluded.shows, detail = excluded.detail, at = excluded.at`)
      .run(o.figureId, o.model, o.screening.keep ? 1 : 0, o.screening.shows, JSON.stringify(o.detail ?? null), new Date().toISOString())
    db.prepare('UPDATE figures SET status = ?, reason = ? WHERE id = ?')
      .run(o.screening.keep ? 'screened' : 'rejected', o.screening.keep ? null : o.screening.reasons.join('; '), o.figureId)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
