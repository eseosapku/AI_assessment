// scripts/figure-library/screen.ts
import { readJson, type Store } from './store'
import { LEVELS } from './review'

export const SCREEN_JOB = 'p1b2-screen'
/**
 * Haiku screens. Nova Lite, the spec's choice, copied the example reply (599 of 600 kept), then
 * wrote "<true>" and kept office blocks and cancer slides: the pilot's finding (P1b).
 */
export const SCREEN_MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
/** A 512 px image (about 350 tokens), a 600-token prompt, and two sentences and nine judgements back. */
export const SCREEN_USD_PER_ITEM = 0.0016

export interface ScreenItem { figureId: string; subject: string; band: string; topic: string; subtopics: string[]; title: string; description: string; preview: string }
export interface Screening { keep: boolean; shows: string; reasons: string[]; type: string }

/** Each judgement, the answer that keeps the image, and the reason recorded when it does not. */
const CHECKS: [string, boolean, string][] = [
  ['educational', true, 'not educational'],
  ['in_syllabus', true, 'not in the syllabus'],
  ['clear', true, 'not clear enough'],
  ['beyond_level', false, 'beyond this level'],
  ['unfamiliar_example', false, 'an unfamiliar example'],
  ['person_is_subject', false, 'a person is the subject'],
  ['mostly_text', false, 'mostly text'],
  ['foreign_labels', false, 'labels not in English'],
  ['decorative', false, 'decorative'],
]
const TYPES = ['diagram', 'photo', 'micrograph', 'map']
/**
 * Subjects where a distant place or case is held against an image. Elsewhere what an organism,
 * object or cell shows is the same anywhere: the screener rejected a bee showing insect features
 * and a dissected flower as "unfamiliar" until this rule.
 */
const PLACE_SUBJECTS = new Set(['geography', 'history', 'social-studies'])

export function screenPrompt(item: ScreenItem): string {
  // No example values: Nova Lite copied a filled-in example reply word for word. The screener
  // describes and weighs the image against the syllabus points before each judgement.
  return [
    `This image may be used in a ${item.subject} quiz for learners at ${LEVELS[item.band] ?? item.band} in Rwanda and East Africa, on the topic "${item.topic}".`,
    ...(item.subtopics.length ? [`Syllabus points: ${item.subtopics.join('; ')}.`] : []),
    `Its file is called "${item.title}".${item.description ? ` Its description says: "${item.description.slice(0, 300)}"` : ''}`,
    '',
    'Look at the image, then answer in this order:',
    '1. shows: one sentence on what the image actually shows.',
    '2. image_type: diagram (a drawing or labelled diagram), photo, micrograph, map, or other.',
    '3. topic_fit: one sentence on which syllabus point it teaches, if any, and whether a teacher of these learners would use it.',
    '4. Each judgement below, true or false, from what you see:',
    '- educational: it clearly shows something these learners study, well enough to ask a question about. A plain picture of an object with nothing to learn from it beyond its name is not educational.',
    '- in_syllabus: it shows something these syllabus points teach, at this level.',
    '- clear: sharp and well lit, with the thing that matters large enough to see.',
    '- beyond_level: a figure from a research paper (often several labelled panels), specialist or medical detail, or anything beyond what these learners study.',
    '- unfamiliar_example: a particular place, landscape or case from far away that the syllabus does not name, where a diagram or an example from Rwanda or East Africa would teach the same thing. An organism, object, cell or piece of apparatus is never an unfamiliar example: what it shows is the same anywhere.',
    '- person_is_subject: one or more identifiable people are the main subject (a portrait, a selfie, people posing or working as the focus).',
    '- mostly_text: it is mainly words or a table.',
    '- foreign_labels: it has labels or captions in a language other than English.',
    '- decorative: a logo, an icon, clip art, an advert or a decoration.',
    '',
    'Reply with JSON only: an object with these keys in this order, each judgement a JSON true or false of your own:',
    '{"shows": string, "image_type": string, "topic_fit": string, "educational": boolean, "in_syllabus": boolean, "clear": boolean, "beyond_level": boolean, "unfamiliar_example": boolean, "person_is_subject": boolean, "mostly_text": boolean, "foreign_labels": boolean, "decorative": boolean}',
  ].join('\n')
}

/** The screener's reply. Whether to keep is worked out here; a reply missing any judgement is refused, never read as a keep. */
export function parseScreen(raw: unknown, subject?: string): Screening {
  if (!raw || typeof raw !== 'object') throw new Error('The screening is not a JSON object')
  const r = raw as Record<string, unknown>
  const reasons: string[] = []
  for (const [key, keeps, why] of CHECKS) {
    if (typeof r[key] !== 'boolean') throw new Error(`The screening has no ${key} judgement`)
    const heldToPlace = key !== 'unfamiliar_example' || !subject || PLACE_SUBJECTS.has(subject)
    if (r[key] !== keeps && heldToPlace) reasons.push(why)
  }
  const shows = String(r.shows ?? '').trim()
  if (!shows) throw new Error('The screening does not say what the image shows')
  const said = String(r.image_type ?? '').trim().toLowerCase()
  const type = TYPES.includes(said) ? said : 'other'
  return { keep: reasons.length === 0, shows: shows.slice(0, 300), reasons, type }
}

/** Real candidates not yet screened, with their topic and its syllabus points, oldest first. */
export function toScreen(db: Store, o: { limit?: number } = {}): ScreenItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.spec, f.preview, MIN(ft.topic_key) AS topic_key FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id
    WHERE f.origin <> 'drawn' AND f.status = 'candidate' AND f.id NOT IN (SELECT figure_id FROM screenings)
    GROUP BY f.id ORDER BY f.id LIMIT ?`).all(o.limit ?? 1_000_000) as { id: string; subject: string; band: string; spec: string; preview: string; topic_key: string }[]
  const topicName = db.prepare('SELECT name FROM topics WHERE key = ?')
  const subs = db.prepare('SELECT name FROM subtopics WHERE topic_key = ? ORDER BY key')
  return rows.map((r) => {
    const spec = readJson<{ title?: string; description?: string }>(r.spec, {})
    return {
      figureId: r.id, subject: r.subject, band: r.band, topic: (topicName.get(r.topic_key) as { name: string }).name,
      subtopics: (subs.all(r.topic_key) as { name: string }[]).map((s) => s.name),
      title: spec.title ?? '', description: spec.description ?? '', preview: r.preview,
    }
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

/** Puts every real image back to be screened again, after a change to the screen. Returns how many. */
export function resetScreens(db: Store): number {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM screenings s JOIN figures f ON f.id = s.figure_id WHERE f.origin <> 'drawn'").get() as { n: number }).n
  db.exec('BEGIN')
  try {
    db.prepare("DELETE FROM screenings WHERE figure_id IN (SELECT id FROM figures WHERE origin <> 'drawn')").run()
    db.prepare("UPDATE figures SET status = 'candidate', reason = NULL WHERE origin <> 'drawn' AND status IN ('screened', 'rejected')").run()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return Number(n)
}

/**
 * Works each stored screening out again from the screener's own judgements, under the current
 * rules (such as which subjects hold a distant example against an image). Nothing is sent.
 * Returns how many verdicts changed.
 */
export function regradeScreens(db: Store): number {
  const rows = db.prepare(`SELECT s.figure_id AS id, s.keep, s.detail, f.subject FROM screenings s JOIN figures f ON f.id = s.figure_id
    WHERE f.origin <> 'drawn'`).all() as { id: string; keep: number; detail: string; subject: string }[]
  let changed = 0
  for (const r of rows) {
    let screening: Screening
    try {
      screening = parseScreen(readJson<unknown>(r.detail, null), r.subject)
    } catch {
      continue  // a screening from an older prompt without today's judgements stays as it is
    }
    if (screening.keep === (r.keep === 1)) continue
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE screenings SET keep = ? WHERE figure_id = ?').run(screening.keep ? 1 : 0, r.id)
      db.prepare('UPDATE figures SET status = ?, reason = ? WHERE id = ?')
        .run(screening.keep ? 'screened' : 'rejected', screening.keep ? null : screening.reasons.join('; '), r.id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    changed++
  }
  return changed
}
