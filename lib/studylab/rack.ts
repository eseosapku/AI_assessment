/**
 * The tile rack's model: turns the Gap Map API response into trays, chapters
 * and sections, so every rule lives here under test and the components only
 * draw. No server imports; the client uses it.
 */
import { bandFor, type SectionBand } from './mastery-latest'
import { masteryNumber } from './mastery-numbers'
import { pickRequestedSubject, type UnplacedSubject, type UnlinkedResults } from './wall'
import { bookTitle } from './book-title'

export type ChapterState = 'gap' | 'gold' | 'shaky' | 'solid' | 'none'

export interface RackSection {
  key: string
  subtopicId: number | null
  name: string
  band: SectionBand
  score: number | null
  lowest: number | null
  lastAssessed: string | null
  attempts: number
}

export interface RackChapter {
  topicId: number
  textbookId: number
  name: string
  bookName: string
  /** Position in the book, kept when a tray puts gaps first. */
  order: number
  curriculumSlug: string | null
  art: string | null
  hasSections: boolean
  /** A topic the student typed themselves: no book behind it, negative topicId. */
  ownTopic?: boolean
  sections: RackSection[]
  /** A whole-chapter score that decides the tile because no section was tried. */
  wholeChapter: { band: SectionBand; score: number; lowest: number } | null
  state: ChapterState
  gapCount: number
  triedCount: number
}

export interface RackTray {
  key: string
  subject: string
  level: string | null
  chapters: RackChapter[]
  squares: SectionBand[]
  gapCount: number
  triedCount: number
  totalCount: number
}

export interface RackPick { chapter: RackChapter; section: RackSection | null; score: number }
export type RackSnapshot = Record<string, { state: ChapterState; bands: Record<string, SectionBand> }>
export interface SheetLine { lead: string; rest: string; actions: ('teach' | 'retake' | 'quiz')[] }

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)
const asId = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}
/** A chapter id from a link: a book chapter is positive, a typed topic is negative. */
const asChapterId = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n !== 0 ? n : null
}
const text = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => text(v).toLowerCase().replace(/\s+/g, ' ')
const pct = (n: number | null) => Math.round(n ?? 0)
const timeOf = (iso: string | null) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** "Chapter 1: Cells" becomes "Cells". Only a digit numeral with a separator or space after it. */
export function cleanChapterName(raw: string): string {
  const name = String(raw ?? '').trim()
  const m = /^(?:chapter|unit|topic|lesson|module|part)\s+\d+(?:\.\d+)*\s*(?:[:.\-–—)]\s*|\s+)(\S.*)$/i.exec(name)
  return m ? m[1].trim() : name
}

function sectionOf(raw: Raw): RackSection | null {
  const id = asId(raw.id)
  if (id === null) return null
  const score = masteryNumber(raw.score)
  const lowest = masteryNumber(raw.lowest) ?? score
  return {
    key: `s${id}`,
    subtopicId: id,
    name: text(raw.name) || 'Untitled',
    band: bandFor(score, score === null ? null : lowest),
    score,
    lowest: score === null ? null : lowest,
    lastAssessed: raw.last_assessed ? String(raw.last_assessed) : null,
    attempts: Math.max(0, masteryNumber(raw.attempts) ?? 0),
  }
}

function chapterOf(raw: unknown, book: { id: number; name: string; slug: string | null }): RackChapter | null {
  if (!isObj(raw)) return null
  const topicId = asId(raw.id)
  if (topicId === null) return null
  const name = cleanChapterName(text(raw.name)) || 'Untitled chapter'
  const score = masteryNumber(raw.score)
  const lowest = masteryNumber(raw.lowest) ?? score
  const real = (Array.isArray(raw.subtopics) ? raw.subtopics : []).map((s) => (isObj(s) ? sectionOf(s) : null)).filter((s): s is RackSection => !!s)
  const hasSections = real.length > 0

  let sections = real
  let wholeChapter: RackChapter['wholeChapter'] = null
  if (!hasSections) {
    sections = [{
      key: `t${topicId}`, subtopicId: null, name,
      band: bandFor(score, score === null ? null : lowest),
      score, lowest: score === null ? null : lowest,
      lastAssessed: raw.last_assessed ? String(raw.last_assessed) : null,
      attempts: Math.max(0, masteryNumber(raw.attempts) ?? 0),
    }]
  } else if (score !== null && !real.some((s) => s.attempts >= 3)) {
    // A few tagged questions must not throw away a whole-chapter score: sections win only with 3+ attempts.
    wholeChapter = { band: bandFor(score, lowest), score, lowest: lowest ?? score }
  }

  // What decides the tile: the tried sections, else the whole-chapter score.
  const deciding: SectionBand[] = wholeChapter ? [wholeChapter.band] : sections.map((s) => s.band).filter((b) => b !== 'none')
  const state: ChapterState = deciding.includes('gap') ? 'gap'
    : deciding.includes('gold') ? 'gold'
    : deciding.includes('shaky') ? 'shaky'
    : deciding.includes('solid') ? 'solid' : 'none'

  return {
    topicId, textbookId: book.id, name, bookName: book.name, order: 0, curriculumSlug: book.slug,
    art: typeof raw.art === 'string' && raw.art ? raw.art : null,
    hasSections, sections, wholeChapter, state,
    gapCount: deciding.filter((b) => b === 'gap').length,
    triedCount: sections.filter((s) => s.band !== 'none').length,
  }
}

/** One square per section, or one for a chapter judged as a whole. */
function squaresOf(chapter: RackChapter): SectionBand[] {
  if (chapter.wholeChapter) return [chapter.wholeChapter.band]
  return chapter.sections.map((s) => s.band)
}

/** Every place a fix could start, in rack order: a gap section, or a whole-chapter gap. */
function gapPicks(trays: readonly RackTray[]): (RackPick & { at: string | null })[] {
  const out: (RackPick & { at: string | null })[] = []
  for (const tray of trays) {
    for (const chapter of tray.chapters) {
      if (chapter.wholeChapter?.band === 'gap') {
        out.push({ chapter, section: null, score: chapter.wholeChapter.score, at: null })
      } else if (!chapter.wholeChapter) {
        for (const section of chapter.sections) {
          if (section.band === 'gap' && section.score !== null) out.push({ chapter, section, score: section.score, at: section.lastAssessed })
        }
      }
    }
  }
  return out
}

function lowestPick(picks: (RackPick & { at: string | null })[]): (RackPick & { at: string | null }) | null {
  let best: (RackPick & { at: string | null }) | null = null
  for (const p of picks) {
    if (!best || p.score < best.score || (p.score === best.score && (timeOf(p.at) > timeOf(best.at) || (timeOf(p.at) === timeOf(best.at) && p.chapter.order < best.chapter.order)))) best = p
  }
  return best
}

/** The lowest score that makes a chapter a gap, or null when it has none. */
function lowestGap(c: RackChapter): number | null {
  if (c.state !== 'gap') return null
  if (c.wholeChapter) return c.wholeChapter.band === 'gap' ? c.wholeChapter.score : null
  const scores = c.sections.filter((x) => x.band === 'gap' && x.score !== null).map((x) => x.score as number)
  return scores.length ? Math.min(...scores) : 0
}

/** Chapters with gaps first, lowest score first, then every other chapter in book order. */
function gapsFirst(chapters: RackChapter[]): RackChapter[] {
  const withGap = chapters.filter((c) => lowestGap(c) !== null)
  const rest = chapters.filter((c) => lowestGap(c) === null)
  withGap.sort((a, b) => (lowestGap(a) as number) - (lowestGap(b) as number) || a.order - b.order)
  return [...withGap, ...rest]
}

const OWN_KEY = 'own-topics'
const cleanOwnName = (raw: string) => text(raw).replace(/^mastering\s+/i, '').trim() || text(raw)
/** A stable negative integer from a name (FNV-1a), so ?chapter= survives a reload. */
function ownTopicId(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return -(1 + (h % 2000000000))
}

type OwnBucket = { raw: string; quizzes: { id: string; pct: number | null; at: string | null }[] }
/** Name-only buckets (no book, no chapters), merged by normalised name. */
function ownBuckets(textbooks: readonly unknown[]): Map<string, OwnBucket> {
  const out = new Map<string, OwnBucket>()
  for (const raw of Array.isArray(textbooks) ? textbooks : []) {
    if (!isObj(raw) || asId(raw.id) !== null) continue
    if (Array.isArray(raw.topics) && raw.topics.length > 0) continue
    const name = text(raw.name)
    const key = norm(name)
    if (!name || key === 'other') continue
    const quizzes = (Array.isArray(raw.assessments) ? raw.assessments : []).filter(isObj).map((a) => ({
      id: String(a.id ?? ''), pct: masteryNumber(a.percentage), at: a.created_at ? String(a.created_at) : null,
    }))
    const b = out.get(key) ?? { raw: name, quizzes: [] }
    b.quizzes.push(...quizzes)
    out.set(key, b)
  }
  for (const [k, b] of out) if (!b.quizzes.some((q) => q.pct !== null)) out.delete(k)
  return out
}

/** The ids of every quiz that sits on a typed-topic tile, so the quiet line can leave them out. */
export function ownTopicQuizIds(textbooks: readonly unknown[]): Set<string> {
  return new Set([...ownBuckets(textbooks).values()].flatMap((b) => b.quizzes.map((q) => q.id)))
}

export function ownTopicsTray(textbooks: readonly unknown[]): RackTray | null {
  const chapters: RackChapter[] = []
  for (const [key, b] of ownBuckets(textbooks)) {
    const scored = b.quizzes.filter((q) => q.pct !== null).sort((x, y) => timeOf(y.at) - timeOf(x.at))
    const score = scored[0].pct as number
    const lowest = Math.min(...scored.map((q) => q.pct as number))
    const name = cleanOwnName(b.raw)
    const topicId = ownTopicId(key)
    const band = bandFor(score, lowest)
    const lastAssessed = scored.reduce<string | null>((acc, q) => (q.at && timeOf(q.at) > timeOf(acc) ? q.at : acc), null)
    const section: RackSection = { key: `t${topicId}`, subtopicId: null, name, band, score, lowest, lastAssessed, attempts: scored.length }
    const state: ChapterState = band
    chapters.push({
      topicId, textbookId: 0, name, bookName: b.raw, order: 0, curriculumSlug: null, art: null,
      hasSections: false, ownTopic: true, sections: [section], wholeChapter: null, state,
      gapCount: band === 'gap' ? 1 : 0, triedCount: 1,
    })
  }
  if (chapters.length === 0) return null
  chapters.forEach((c, i) => { c.order = i })
  const ordered = gapsFirst(chapters)
  const squares = ordered.flatMap(squaresOf)
  return {
    key: OWN_KEY, subject: 'Your own topics', level: null, chapters: ordered, squares,
    gapCount: ordered.reduce((n, c) => n + c.gapCount, 0), triedCount: squares.length, totalCount: squares.length,
  }
}

export function buildRack(textbooks: readonly unknown[], _canonicalise?: (s: string) => string): RackTray[] {
  const byKey = new Map<string, { subject: string; level: string | null; chapters: RackChapter[] }>()
  for (const raw of Array.isArray(textbooks) ? textbooks : []) {
    if (!isObj(raw)) continue
    const bookId = asId(raw.id)
    const bookName = text(raw.name)
    if (bookId === null || !bookName || !Array.isArray(raw.topics)) continue
    const { subject, level } = bookTitle(bookName)
    const book = { id: bookId, name: bookName, slug: text(raw.curriculum_slug) || null }
    const chapters = raw.topics.map((t) => chapterOf(t, book)).filter((c): c is RackChapter => !!c)
    if (chapters.length === 0) continue
    const key = `${norm(subject)}|${norm(level)}`
    const tray = byKey.get(key) ?? { subject, level, chapters: [] }
    tray.chapters.push(...chapters)
    byKey.set(key, tray)
  }

  const ownTray = ownTopicsTray(textbooks)
  const trays: RackTray[] = [...byKey].map(([key, t]) => {
    t.chapters.forEach((c, i) => { c.order = i })
    const chapters = gapsFirst(t.chapters)
    const squares = chapters.flatMap(squaresOf)
    return {
      key, subject: t.subject, level: t.level, chapters, squares,
      gapCount: chapters.reduce((n, c) => n + c.gapCount, 0),
      triedCount: squares.filter((b) => b !== 'none').length,
      totalCount: squares.length,
    }
  })

  if (ownTray) trays.push(ownTray)

  // The tray holding the lowest gap, then gap trays by count, then anything tried, then the rest.
  const holder = lowestPick(gapPicks(trays))?.chapter
  const holderKey = holder ? trays.find((t) => t.chapters.includes(holder))?.key : undefined
  const tier = (t: RackTray) => (t.key === holderKey ? 0 : t.gapCount > 0 ? 1 : t.triedCount > 0 ? 2 : 3)
  return trays.sort((a, b) => tier(a) - tier(b) || (tier(a) === 1 ? b.gapCount - a.gapCount : 0) || a.subject.localeCompare(b.subject) || norm(a.level).localeCompare(norm(b.level)))
}

/** The quizzes that sit on no chapter, as one count and one average weighted by quiz count. */
export function otherQuizzesSummary(
  unplaced: readonly UnplacedSubject[],
  unlinked: UnlinkedResults | null,
  /** Quizzes already shown on a tile (typed topics): left out of the count and the average. */
  skip?: ReadonlySet<string>,
): { count: number; average: number | null } | null {
  let count = 0, weighted = 0, scored = 0
  const add = (n: number, avg: number | null) => {
    count += n
    if (avg !== null && n > 0) { weighted += avg * n; scored += n }
  }
  for (const s of unplaced) {
    if (!skip || skip.size === 0) { add(s.quizzes.length, s.average); continue }
    const rest = s.quizzes.filter((q) => !skip.has(q.id))
    const scores = rest.map((q) => q.percentage).filter((p): p is number => p !== null)
    add(rest.length, scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null)
  }
  if (unlinked) add(unlinked.count, unlinked.average)
  if (count === 0) return null
  return { count, average: scored ? Math.round(weighted / scored) : null }
}

export function totalGaps(trays: readonly RackTray[]): number {
  return trays.reduce((n, t) => n + t.gapCount, 0)
}

export function nextFix(trays: readonly RackTray[]): RackPick | null {
  const best = lowestPick(gapPicks(trays))
  return best ? { chapter: best.chapter, section: best.section, score: best.score } : null
}

export function kanaHomeLine(trays: readonly RackTray[], pick: RackPick | null, hasOtherResults = false): string {
  if (!pick) {
    if (trays.length === 0) {
      return hasOtherResults
        ? "Your quiz results are below, but they aren't linked to chapters yet. Take a quiz from a book and I'll show you where your gaps are."
        : "Take your first quiz and I'll show you where your gaps are."
    }
    if (!trays.some((t) => t.triedCount > 0)) return "Nothing tried here yet. Pick a chapter and I'll start you off."
    return 'Every tile is back in its slot. Pick something new to try.'
  }
  const name = pick.section?.name ?? pick.chapter.name
  return `Tiles sticking up have gaps, and you have ${totalGaps(trays)}. Let's start with ${name}, it's your lowest.`
}

export function visibleTrays(trays: readonly RackTray[], showAll: boolean, limit = 6): { shown: RackTray[]; hidden: number } {
  if (showAll || trays.length <= limit) return { shown: [...trays], hidden: 0 }
  return { shown: trays.slice(0, limit), hidden: trays.length - limit }
}

/** Pixel size of a subject card's squares, shrinking as there are more of them. */
export function squareSize(count: number): number {
  return count < 50 ? 13 : count <= 100 ? 9 : 6
}

export function findChapter(trays: readonly RackTray[], topicId: number): { tray: RackTray; chapter: RackChapter } | null {
  for (const tray of trays) {
    const chapter = tray.chapters.find((c) => c.topicId === topicId)
    if (chapter) return { tray, chapter }
  }
  return null
}

export function sectionToStart(chapter: RackChapter, wanted?: number | null): RackSection | null {
  if (wanted) {
    const hit = chapter.sections.find((s) => s.subtopicId === wanted)
    if (hit) return hit
  }
  if (chapter.wholeChapter) return null
  let lowest: RackSection | null = null
  for (const s of chapter.sections) {
    if (s.band === 'gap' && s.score !== null && (!lowest || s.score < (lowest.score ?? 101))) lowest = s
  }
  return lowest ?? chapter.sections.find((s) => s.band === 'none') ?? chapter.sections[0] ?? null
}

export function chapterLabel(chapter: RackChapter): string {
  const gaps = chapter.sections.filter((s) => s.band === 'gap').map((s) => s.name)
  switch (chapter.state) {
    case 'gap':
      if (chapter.wholeChapter || chapter.ownTopic || gaps.length === 0) return `${chapter.name}, a gap`
      return `${chapter.name}, ${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}: ${gaps.join(', ')}`
    case 'gold': return `${chapter.name}, a gap you closed`
    case 'shaky': return `${chapter.name}, shaky`
    case 'solid': return `${chapter.name}, solid`
    default: return `${chapter.name}, not tried yet`
  }
}

export function sectionLabel(section: RackSection): string {
  const s = pct(section.score)
  switch (section.band) {
    case 'gap': return `${section.name}, ${s}%, a gap`
    case 'gold': return `${section.name}, gap closed, ${pct(section.lowest)}% to ${s}%`
    case 'shaky': return `${section.name}, ${s}%, shaky`
    case 'solid': return `${section.name}, ${s}%, solid`
    default: return `${section.name}, not tried yet`
  }
}

export function aboutLine(chapter: RackChapter): string | null {
  if (!chapter.hasSections) return null
  const names = chapter.sections.map((s) => s.name)
  if (names.length === 0) return null
  if (names.length > 3) return `Covers ${names.slice(0, 3).join(', ')} and more`
  if (names.length === 1) return `Covers ${names[0]}`
  return `Covers ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function sheetLine(
  chapter: RackChapter,
  section: RackSection | null,
  cheer?: { name: string; next: RackSection | null } | null,
): SheetLine {
  if (cheer) {
    return cheer.next
      ? { lead: `Nice, ${cheer.name} is gold now.`, rest: ` Next up, ${cheer.next.name}.`, actions: cheer.next.score !== null ? ['teach', 'retake'] : ['teach', 'quiz'] }
      : { lead: 'Nice, that was the last gap here.', rest: ' Go back and watch this tile drop into its slot.', actions: [] }
  }
  const lead = section ? section.name : 'This chapter'
  const band: SectionBand = section ? section.band : chapter.wholeChapter?.band ?? 'none'
  const score = section ? section.score : chapter.wholeChapter?.score ?? null
  const lowest = section ? section.lowest : chapter.wholeChapter?.lowest ?? null
  switch (band) {
    case 'gap':
      return { lead, rest: ` is on ${pct(score)}%. Want me to teach it, then you retake it?`, actions: ['teach', 'retake'] }
    case 'shaky':
      return { lead, rest: ` is shaky at ${pct(score)}%. Want me to teach it, then you retake it?`, actions: ['teach', 'retake'] }
    case 'solid':
      return { lead, rest: ` is solid at ${pct(score)}%. Retake it any time to keep it that way.`, actions: ['retake', 'teach'] }
    case 'gold':
      return { lead: 'You closed this gap.', rest: ` ${pct(lowest)}% to ${pct(score)}%, well done.`, actions: ['retake'] }
    default:
      return { lead, rest: ' is new to us. A short quiz shows where you stand.', actions: ['teach', 'quiz'] }
  }
}

export function resolveDeepLink(
  trays: readonly RackTray[],
  textbooks: readonly unknown[],
  want: { chapter?: string | null; section?: string | null; subject?: string | null; focus?: string | null; assessment?: string | null },
): { topicId: number | null; subtopicId: number | null; trayKey: string | null } {
  const none = { topicId: null, subtopicId: null, trayKey: null }

  if (want.chapter !== undefined && want.chapter !== null && want.chapter !== '') {
    const topicId = asChapterId(want.chapter)
    const hit = topicId === null ? null : findChapter(trays, topicId)
    if (!hit) return none
    const sid = asId(want.section)
    const subtopicId = sid !== null && hit.chapter.sections.some((s) => s.subtopicId === sid) ? sid : null
    return { topicId: hit.chapter.topicId, subtopicId, trayKey: hit.tray.key }
  }

  const subject = text(want.subject)
  const assessment = text(want.assessment)
  const focus = norm(want.focus)
  if (!subject && !assessment && !focus) return none

  // Which tray: the quiz decides first, then the subject's name.
  let tray: RackTray | null = null
  if (assessment || subject) {
    const picked = pickRequestedSubject(
      (Array.isArray(textbooks) ? textbooks : []).filter(isObj).map((t) => ({
        id: asId(t.id), name: text(t.name),
        topics_assessed: Number(t.topics_assessed) || 0,
        last_assessed: t.last_assessed ? String(t.last_assessed) : null,
        assessments: Array.isArray(t.assessments) ? (t.assessments as { id: string }[]).filter(isObj) : [],
      })),
      { assessmentId: assessment, name: subject },
    )
    if (picked && picked.id !== null) tray = trays.find((t) => t.chapters.some((c) => c.textbookId === picked.id)) ?? null
    // A typed topic has no book: its tile is found by the bucket's name.
    if (picked && picked.id === null) {
      const own = trays.find((t) => t.key === OWN_KEY)
      const mine = own?.chapters.find((c) => norm(c.bookName) === norm(picked.name))
      if (own && mine) {
        if (!focus) return { topicId: mine.topicId, subtopicId: null, trayKey: own.key }
        tray = own
      }
    }
    if (!tray && subject) {
      const s = norm(subject)
      tray = trays.find((t) => norm(t.subject) === s) ?? trays.find((t) => norm(t.subject).includes(s) || s.includes(norm(t.subject))) ?? null
    }
  }

  const result = { topicId: null as number | null, subtopicId: null as number | null, trayKey: tray?.key ?? null }
  if (!focus) return result

  // Which chapter or section: an exact name beats a partial one; among equals, one with a gap, then book order.
  const within = tray ? [tray] : trays
  type Found = { rank: number; gap: boolean; topicId: number; subtopicId: number | null; trayKey: string }
  const found: Found[] = []
  const consider = (rank: number, chapter: RackChapter, subtopicId: number | null, trayKey: string) => {
    found.push({ rank, gap: chapter.gapCount > 0, topicId: chapter.topicId, subtopicId, trayKey })
  }
  const rankOf = (name: string): number | null => {
    const n = norm(name)
    if (n === focus) return 0
    if (n.length >= 3 && focus.length >= 3 && (n.includes(focus) || focus.includes(n))) return 1
    return null
  }
  for (const t of within) {
    for (const c of t.chapters) {
      const cr = rankOf(c.name)
      if (cr !== null) consider(cr, c, null, t.key)
      if (c.hasSections) {
        for (const s of c.sections) {
          const sr = rankOf(s.name)
          if (sr !== null) consider(sr, c, s.subtopicId, t.key)
        }
      }
    }
  }
  // Candidates arrive in book order; a stable pick keeps the first of equals.
  let best: Found | null = null
  for (const f of found) {
    if (!best || f.rank < best.rank || (f.rank === best.rank && f.gap && !best.gap)) best = f
  }
  if (!best) return result
  return { topicId: best.topicId, subtopicId: best.subtopicId, trayKey: best.trayKey }
}

export function snapshotRack(trays: readonly RackTray[]): RackSnapshot {
  const out: RackSnapshot = {}
  for (const tray of trays) {
    for (const c of tray.chapters) {
      out[String(c.topicId)] = { state: c.state, bands: Object.fromEntries(c.sections.map((s) => [s.key, s.band])) }
    }
  }
  return out
}

export function changesSince(before: RackSnapshot | null, trays: readonly RackTray[]): { dropped: number[]; gold: string[] } {
  const out = { dropped: [] as number[], gold: [] as string[] }
  if (!before) return out
  for (const tray of trays) {
    for (const c of tray.chapters) {
      const was = before[String(c.topicId)]
      if (!was) continue
      if (was.state === 'gap' && c.state !== 'gap') out.dropped.push(c.topicId)
      for (const s of c.sections) if (was.bands[s.key] === 'gap' && s.band === 'gold') out.gold.push(s.key)
    }
  }
  return out
}
