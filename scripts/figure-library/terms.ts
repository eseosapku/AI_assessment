// scripts/figure-library/terms.ts
import type { Store } from './store'
import { LEVELS } from './review'

export const TERMS_JOB = 'p1b2-terms'

/** Where a source's learners are: examples from their world teach better than distant ones. */
export const LEARNERS: Record<string, string> = {
  rwanda: 'Rwanda',
  cambridge: 'Rwanda and East Africa, on the Cambridge curriculum',
  checkpoint: 'Rwanda and East Africa, on the Cambridge curriculum',
  nerdc: 'Nigeria',
  waec: 'West Africa',
  jamb: 'Nigeria',
}

export interface TermsItem { key: string; subject: string; band: string; source: string; topic: string; subtopics: string[] }
export interface Terms { diagrams: string[]; photos: string[] }

export function topicsForTerms(db: Store, keys: readonly string[]): TermsItem[] {
  const topic = db.prepare('SELECT key, subject, band, source, name FROM topics WHERE key = ?')
  const subs = db.prepare('SELECT name FROM subtopics WHERE topic_key = ? ORDER BY key')
  return keys.flatMap((key) => {
    const t = topic.get(key) as { key: string; subject: string; band: string; source: string; name: string } | undefined
    if (!t) return []
    return [{ key: t.key, subject: t.subject, band: t.band, source: t.source, topic: t.name, subtopics: (subs.all(key) as { name: string }[]).map((s) => s.name) }]
  })
}

export function termsPrompt(t: TermsItem): string {
  return [
    'Find teaching images on Wikimedia Commons for this syllabus topic.',
    `Subject: ${t.subject}. Level: ${LEVELS[t.band] ?? t.band}, for learners in ${LEARNERS[t.source] ?? 'Africa'}. Topic: ${t.topic}.`,
    ...(t.subtopics.length ? [`Syllabus points: ${t.subtopics.join('; ')}.`] : []),
    '',
    'Give search terms that find:',
    '- diagrams: 8 terms for labelled diagrams or textbook-style drawings of what these points teach (for example "plant cell labelled diagram").',
    '- photos: 6 terms for photographs of real examples the syllabus covers, that a learner here may meet or will be taught by name. For geography, prefer examples from Rwanda and East Africa; for history, the events, places and sources these points cover.',
    "Each term short (2 to 5 words), in English and specific. Never a person's name on its own.",
    '',
    'Reply with JSON only: {"diagrams": [string], "photos": [string]}',
  ].join('\n')
}

/** Short, distinct terms; a reply with fewer than three diagram terms is refused. */
export function parseTerms(raw: unknown): Terms {
  if (!raw || typeof raw !== 'object') throw new Error('The reply is not a JSON object')
  const clean = (list: unknown): string[] => {
    const out: string[] = []
    for (const t of Array.isArray(list) ? list : []) {
      const term = String(t ?? '').trim()
      if (term && term.length <= 60 && !out.some((o) => o.toLowerCase() === term.toLowerCase())) out.push(term)
    }
    return out.slice(0, 12)
  }
  const r = raw as { diagrams?: unknown; photos?: unknown }
  const terms = { diagrams: clean(r.diagrams), photos: clean(r.photos) }
  if (terms.diagrams.length < 3) throw new Error('The reply has fewer than three diagram terms')
  return terms
}

/** Replaces a topic's terms, diagrams first; a term in both lists is kept once, as a diagram. */
export function saveTerms(db: Store, key: string, model: string, terms: Terms): void {
  const at = new Date().toISOString()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM search_terms WHERE topic_key = ?').run(key)
    const put = db.prepare('INSERT OR IGNORE INTO search_terms (topic_key, term, kind, model, at) VALUES (?, ?, ?, ?, ?)')
    for (const term of terms.diagrams) put.run(key, term, 'diagram', model, at)
    for (const term of terms.photos) put.run(key, term, 'photo', model, at)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
