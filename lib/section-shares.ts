/**
 * A share of the book's sections for each parallel batch of an ordinary quiz.
 *
 * Batches were handed chapter names, and with fewer chapters than batches two or three got the
 * same chapter and the same prompt. They wrote the same few obvious questions: a 40-question
 * Primary Science quiz on three chapters wrote 62 and lost 30 as repeats, and a follow-up asked
 * for 14 more wrote 23 and kept 1 ("Which planet in our solar system is closest to the Sun?"
 * three times) -- with the paper's questions listed in the prompt as ones not to ask. A named,
 * specific focus per batch is what made Checkpoint papers come back whole, and the book's own
 * sections ("Evaporation", "Sunrise and sunset") are that focus, inside what the book teaches.
 *
 * Shared round-robin in book order, so a batch mixes chapters. When the paper already has
 * questions (a follow-up), the sections it covers least go first.
 */

export interface BookSection {
  topic: string
  section: string
}

// Section-title words that say nothing about what a question would be about.
const EMPTY = new Set([
  'investigating', 'exploring', 'what', 'does', 'useful', 'from', 'with', 'invented', 'who', 'need', 'grow',
  'only', 'once', 'every', 'because', 'giving', 'about', 'which', 'their', 'these', 'that', 'this', 'they',
  'when', 'have', 'into', 'than', 'them', 'then', 'there', 'other', 'some', 'more', 'most', 'also',
])

const wordsOf = (text: string): string[] =>
  String(text ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !EMPTY.has(w)).map((w) => w.slice(0, 6))

/** One list of focus labels ("Evaporation (States of matter)") per batch, or [] when there is nothing to share. */
export function sectionShares(sections: readonly BookSection[], batches: number, paperStems: readonly string[] = []): string[][] {
  const unique = [...new Map(
    sections.filter((s) => String(s?.section ?? '').trim()).map((s) => [`${s.topic}\u0000${s.section}`.toLowerCase(), s]),
  ).values()]
  if (unique.length < 2 || batches < 2) return []

  const paper = paperStems.map((s) => ` ${wordsOf(s).join(' ')} `)
  const covered = (s: BookSection) => {
    const keys = wordsOf(s.section)
    return keys.length ? paper.filter((p) => keys.some((k) => p.includes(` ${k}`))).length : 0
  }
  const ordered = unique.map((s, i) => ({ s, i, c: covered(s) })).sort((a, b) => a.c - b.c || a.i - b.i).map((x) => x.s)

  const label = (s: BookSection) => `${s.section.trim()} (${s.topic.trim()})`
  if (ordered.length < batches) return Array.from({ length: batches }, (_, k) => [label(ordered[k % ordered.length])])
  return Array.from({ length: batches }, (_, k) => ordered.filter((_, i) => i % batches === k).map(label))
}

/**
 * The `n` sections the paper covers least, as focus labels, for a follow-up too small to split and
 * for the retry passes. Those re-sent the same prompt with the chapter names and wrote the same
 * questions again. Ties are rotated by `rand`, so two retries in a row do not get the same ones.
 */
export function leastCoveredSections(
  sections: readonly BookSection[],
  paperStems: readonly string[],
  n = 4,
  rand: () => number = Math.random,
): string[] {
  const unique = [...new Map(
    sections.filter((s) => String(s?.section ?? '').trim()).map((s) => [`${s.topic}\u0000${s.section}`.toLowerCase(), s]),
  ).values()]
  if (!unique.length) return []
  const paper = paperStems.map((s) => ` ${wordsOf(s).join(' ')} `)
  const tiers = new Map<number, BookSection[]>()
  for (const s of unique) {
    const keys = wordsOf(s.section)
    const c = keys.length ? paper.filter((p) => keys.some((k) => p.includes(` ${k}`))).length : 0
    tiers.set(c, [...(tiers.get(c) ?? []), s])
  }
  const ordered = [...tiers.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, tier]) => {
    const r = Math.floor(rand() * tier.length) % tier.length
    return [...tier.slice(r), ...tier.slice(0, r)]
  })
  return ordered.slice(0, n).map((s) => `${s.section.trim()} (${s.topic.trim()})`)
}

export interface ChapterBrief {
  topic: string
  teaches: string
}

const pointsOf = (b: ChapterBrief): string[] =>
  String(b?.teaches ?? '').split(/(?<=[.;])\s+/).map((p) => p.trim().replace(/[.;]$/, '')).filter((p) => p.length >= 12)

/**
 * A share of what the book teaches for each batch: the chapter briefs' points ("Condensation: water
 * vapour cools to liquid"), every point used once, chapters mixed within a batch.
 *
 * Sections were not enough. Every prompt carried the whole brief and the rule to cover every chapter,
 * so each batch wrote the brief's first, most obvious points -- three batches each handed different
 * sections all asked why we have day and night. Points the paper already covers go last; a batch
 * that is the only one (a small follow-up) takes the six least covered.
 */
export function pointShares(briefs: readonly ChapterBrief[], batches: number, paperStems: readonly string[] = []): string[][] {
  const per = briefs.map((b) => pointsOf(b).map((p) => `(${String(b.topic).trim()}) ${p}`))
  const interleaved: string[] = []
  const longest = Math.max(0, ...per.map((ps) => ps.length))
  for (let i = 0; i < longest; i++) for (const ps of per) if (ps[i]) interleaved.push(ps[i])
  if (!interleaved.length || batches < 1) return []

  const paper = paperStems.map((s) => ` ${wordsOf(s).join(' ')} `)
  const covered = (p: string) => {
    const keys = [...new Set(wordsOf(p.replace(/^\([^)]*\)\s*/, '')))]
    return keys.length ? paper.filter((s) => keys.some((k) => s.includes(` ${k}`))).length : 0
  }
  const ordered = interleaved.map((p, i) => ({ p, i, c: covered(p) })).sort((a, b) => a.c - b.c || a.i - b.i).map((x) => x.p)

  if (batches === 1) return [ordered.slice(0, 6)]
  if (ordered.length < batches) return Array.from({ length: batches }, (_, k) => [ordered[k % ordered.length]])
  // Dealt with a shift each round, so a quiz with as many chapters as batches still mixes them.
  const shares: string[][] = Array.from({ length: batches }, () => [])
  ordered.forEach((p, i) => shares[(i + Math.floor(i / batches)) % batches].push(p))
  return shares
}
