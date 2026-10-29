/**
 * Level for a book, taken from its title. The Rwanda grade link is not read.
 */

export interface BookLevel {
  system: string
  level: string
  subject: string
  needs_review: boolean
}

const SYSTEMS: Record<number, string> = {
  0: 'reb',
  1: 'cambridge',
  2: 'nerdc',
  3: 'waec',
  4: 'jamb',
}

export function levelFromBook(name: string, curriculum: number): BookLevel {
  const title = String(name ?? '')
  const system = SYSTEMS[curriculum] ?? 'unknown'
  const subject = title.replace(/\s+/g, ' ').trim()
  if (system === 'cambridge') return { system, subject, ...cambridgeLevel(title) }
  if (system === 'reb') return { system, subject, ...rebLevel(title) }
  return { system, level: '', subject, needs_review: true }
}

function cambridgeLevel(title: string): { level: string; needs_review: boolean } {
  const t = title.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  if (/lower secondary/.test(t)) return { level: 'lower_secondary_checkpoint', needs_review: false }
  if (/primary checkpoint|cambridge primary/.test(t)) return { level: 'primary_checkpoint', needs_review: false }
  if (/\bigcse\b/.test(t)) return { level: 'igcse', needs_review: false }
  if (/o level|ordinary level/.test(t)) return { level: 'o_level', needs_review: false }
  if (/\bas\s*(?:&|and)?\s*a level\b/.test(t)) return { level: 'as_and_a_level', needs_review: true }
  const as = /\bas level\b|advanced subsidiary/.test(t)
  const a2 = /\ba level\b|advanced level/.test(t)
  if (as && a2) return { level: 'as_and_a_level', needs_review: true }
  if (as) return { level: 'as_level', needs_review: false }
  if (a2) return { level: 'a_level', needs_review: false }
  return { level: '', needs_review: true }
}

function rebLevel(title: string): { level: string; needs_review: boolean } {
  const senior = title.match(/\bS([1-6])\b/i)
  if (senior) return { level: `s${senior[1]}`, needs_review: false }
  const primary = title.match(/\bP([1-6])\b/i)
  if (primary) return { level: `p${primary[1]}`, needs_review: false }
  return { level: '', needs_review: true }
}

/** Level of a paper from its folder. IGCSE is recorded, not dropped, when the folder is present. */
export function levelFromPaperPath(rel: string): BookLevel {
  const segs = rel.split(/\\|\//)
  const top = (segs[0] ?? '').toLowerCase()
  const second = segs[1] ?? ''
  const system = top === 'cambridge' ? 'cambridge' : top === 'reb' ? 'reb' : 'unknown'
  const folder = second.toLowerCase()
  const level = system === 'cambridge'
    ? ({
      igcse: 'igcse',
      olevel: 'o_level',
      'as and alevel': 'as_and_a_level',
      primary_checkpoints: 'primary_checkpoint',
    } as Record<string, string>)[folder] ?? ''
    : system === 'reb'
      ? folder.toLowerCase()
      : ''
  return {
    system,
    level,
    subject: segs[2] && !segs[2].includes('.') ? segs[2] : '',
    needs_review: level === 'as_and_a_level' || level === '',
  }
}
