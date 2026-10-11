// scripts/figure-library/concepts.ts
import type { Band } from './levels'
import { readJson, type Store } from './store'

export interface Concept {
  id: string
  subject: string
  name: string
  bands: Band[]
  aliases: string[]
}

const BANDS: readonly Band[] = ['P', 'LS', 'UP', 'AL']

export function slug(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

/** A topic or subtopic name and every level it is taught at. */
export interface NamedLevel {
  name: string
  bands: Band[]
}

/**
 * Names once each, regardless of case and spacing, with every level they are
 * taught at. Without levels the model marked nearly every Geography concept
 * upper secondary, so Lower Secondary topics saw 22 of 129 concepts.
 */
export function namesWithBands(rows: readonly { name: string; band: string }[]): NamedLevel[] {
  const seen = new Map<string, NamedLevel>()
  for (const row of rows) {
    const name = String(row.name ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase().replace(/\s+/g, ' ')
    const have = seen.get(key) ?? { name, bands: [] }
    const band = String(row.band).toUpperCase()
    if ((BANDS as readonly string[]).includes(band) && !have.bands.includes(band as Band)) have.bands.push(band as Band)
    seen.set(key, have)
  }
  return [...seen.values()]
    .map((n) => ({ name: n.name, bands: BANDS.filter((b) => n.bands.includes(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export function conceptPrompt(subject: string, names: readonly NamedLevel[], existing: readonly Concept[]): string {
  const local = (id: string) => id.slice(subject.length + 1)
  return [
    `You are building the controlled list of CONCEPTS for the school subject "${subject}".`,
    'Below are topic and subtopic names from several curricula (Rwanda, Cambridge, Nigeria NERDC, WAEC, JAMB).',
    'A concept is one teachable idea that a figure could illustrate, at the grain of a textbook section:',
    '"photosynthesis", "cell structure", "simultaneous equations", "rivers: erosion and transport".',
    'Not a whole chapter ("Biology") and not a single fact ("chlorophyll is green").',
    'Merge names that mean the same thing across curricula. Every name below must fit at least one concept.',
    'Never list the same idea twice under different ids (for example "plate-tectonics" and "tectonic-plates").',
    'Each name shows in brackets the levels it is taught at. A concept\'s bands are every level of the names it covers.',
    existing.length
      ? `Concepts already listed for this subject. Reuse one when a name fits it, and do not list it again:\n${existing.map((c) => `${local(c.id)}: ${c.name}`).join('\n')}`
      : '',
    '',
    'NAMES:',
    ...names.map((n) => `- ${n.name} [${n.bands.join(', ')}]`),
    '',
    'For each NEW concept give: id (lowercase words joined by hyphens, unique), name, bands (where it is taught: P primary, LS lower secondary, UP upper secondary / IGCSE / WAEC / JAMB, AL AS and A Level), aliases (other names for it, up to 5).',
    'Reply with JSON only: {"concepts":[{"id":"","name":"","bands":[""],"aliases":[""]}]}',
  ].filter(Boolean).join('\n')
}

export function parseConcepts(subject: string, raw: unknown): Concept[] {
  const list = (raw as { concepts?: unknown } | null)?.concepts
  if (!Array.isArray(list)) return []
  const out = new Map<string, Concept>()
  for (const item of list) {
    const c = (item ?? {}) as Record<string, unknown>
    const id = slug(String(c.id || c.name || ''))
    const name = String(c.name ?? '').trim()
    const bands = (Array.isArray(c.bands) ? c.bands : [])
      .map((b) => String(b).toUpperCase())
      .filter((b): b is Band => (BANDS as readonly string[]).includes(b))
    if (id.length < 2 || !name || !bands.length) continue
    const aliases = (Array.isArray(c.aliases) ? c.aliases : []).map((a) => String(a).trim()).filter(Boolean).slice(0, 5)
    const key = `${subject}.${id}`
    if (!out.has(key)) out.set(key, { id: key, subject, name, bands: [...new Set(bands)], aliases })
  }
  return [...out.values()]
}

export function mergeConcepts(lists: readonly (readonly Concept[])[]): Concept[] {
  const out = new Map<string, Concept>()
  for (const list of lists) {
    for (const c of list) {
      const have = out.get(c.id)
      if (!have) {
        out.set(c.id, { ...c, bands: [...c.bands], aliases: [...c.aliases] })
        continue
      }
      have.bands = BANDS.filter((b) => have.bands.includes(b) || c.bands.includes(b))
      have.aliases = [...new Set([...have.aliases, ...c.aliases])].slice(0, 8)
    }
  }
  return [...out.values()]
}

/**
 * A subject built in several calls names some ideas twice ("enzymes",
 * "enzymes-types"), and a figure tagged with one would not reach a topic
 * mapped to the other. One more call groups them.
 */
/**
 * A section-grain size for a subject: about one concept per four names.
 * Returned only when the list is well over it. Too fine a list stops figures
 * being shared; too coarse is harmless, so it is left alone.
 */
export function coarsenTarget(conceptCount: number, nameCount: number): number | null {
  const target = Math.max(10, Math.round(nameCount / 4))
  return conceptCount > 60 && conceptCount > 1.5 * target ? target : null
}

export function consolidationPrompt(subject: string, concepts: readonly Concept[], target?: number | null): string {
  const local = (id: string) => id.slice(subject.length + 1)
  return [
    `These are the concepts listed for the school subject "${subject}". They were built in parts, so some name the same teachable idea twice under different ids.`,
    target
      ? `There are ${concepts.length} concepts; at the grain of a textbook section this subject needs about ${target}. Merge until the list is close to that, but never merge ideas a textbook teaches as separate sections.`
      : '',
    'Find every group of ids that name the same idea at the grain of a textbook section, for example "enzymes", "enzymes-types" and "enzyme-characteristics".',
    'Keep ideas apart when a textbook would teach them as different sections, for example "enzyme-inhibitors" and "enzyme-technology".',
    '',
    'CONCEPTS (id: name):',
    ...concepts.map((c) => `${local(c.id)}: ${c.name}`),
    '',
    'For each group give the id to keep and the ids to merge into it. Leave out ids that are already unique.',
    'Reply with JSON only: {"merges":[{"keep":"","merge":[""]}]}',
  ].join('\n')
}

/** Folds each merged concept into the one kept: levels joined, its name kept as an alias. Unknown ids are ignored. */
export function applyMerges(subject: string, concepts: readonly Concept[], raw: unknown): { concepts: Concept[]; merged: number } {
  const byId = new Map(concepts.map((c) => [c.id, { ...c, bands: [...c.bands], aliases: [...c.aliases] }]))
  const full = (s: unknown) => {
    const id = String(s ?? '').trim()
    return id.startsWith(`${subject}.`) ? id : `${subject}.${id}`
  }
  const merges = (raw as { merges?: unknown } | null)?.merges
  let merged = 0
  for (const item of Array.isArray(merges) ? merges : []) {
    const m = (item ?? {}) as { keep?: unknown; merge?: unknown }
    const keep = byId.get(full(m.keep))
    if (!keep) continue
    for (const x of Array.isArray(m.merge) ? m.merge : []) {
      const id = full(x)
      const gone = byId.get(id)
      if (!gone || id === keep.id) continue
      keep.bands = BANDS.filter((b) => keep.bands.includes(b) || gone.bands.includes(b))
      keep.aliases = [...new Set([...keep.aliases, gone.name, ...gone.aliases])].slice(0, 8)
      byId.delete(id)
      merged++
    }
  }
  return { concepts: [...byId.values()], merged }
}

/** Topics of a subject that already have a plan, which names its concept ids. */
export function mappedTopicCount(db: Store, subject: string): number {
  return Number((db.prepare('SELECT COUNT(*) AS n FROM topic_map m JOIN topics t ON t.key = m.topic_key WHERE t.subject = ?').get(subject) as { n: number }).n)
}

/**
 * Replaces a subject's concepts whole. Topic plans name concept ids, so
 * replacing the ids under them would leave plans pointing at concepts that no
 * longer exist while still counting as done. Refused while plans exist, unless
 * `remap` clears them so they are mapped again. Returns the plans cleared.
 */
export function replaceSubjectConcepts(db: Store, subject: string, concepts: readonly Concept[], remap: boolean): number {
  const mapped = mappedTopicCount(db, subject)
  if (mapped > 0 && !remap) {
    throw new Error(`${subject} has ${mapped} topic plans using its concepts; rerun with --remap to replace them and clear those plans`)
  }
  const insert = db.prepare('INSERT OR REPLACE INTO concepts (id, subject, name, bands, aliases) VALUES (?, ?, ?, ?, ?)')
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM subtopic_map WHERE subtopic_key IN (SELECT s.key FROM subtopics s JOIN topics t ON t.key = s.topic_key WHERE t.subject = ?)').run(subject)
    db.prepare('DELETE FROM topic_map WHERE topic_key IN (SELECT key FROM topics WHERE subject = ?)').run(subject)
    db.prepare('DELETE FROM concepts WHERE subject = ?').run(subject)
    for (const c of concepts) insert.run(c.id, c.subject, c.name, JSON.stringify(c.bands), JSON.stringify(c.aliases))
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return mapped
}

export function loadConcepts(db: Store): Map<string, Concept[]> {
  const rows = db.prepare('SELECT id, subject, name, bands, aliases FROM concepts ORDER BY id').all() as Record<string, string>[]
  const out = new Map<string, Concept[]>()
  for (const r of rows) {
    const c: Concept = { id: r.id, subject: r.subject, name: r.name, bands: readJson<Band[]>(r.bands, []), aliases: readJson<string[]>(r.aliases, []) }
    out.set(c.subject, [...(out.get(c.subject) ?? []), c])
  }
  return out
}
