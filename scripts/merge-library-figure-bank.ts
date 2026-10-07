/**
 * Add a set of judged library figures to the textbook figure bank.
 *
 * Append-only, unlike merge-textbook-figure-bank.ts, which rebuilds the bank
 * from its raw files and tags: run now, that would undo the chapter re-check
 * (scripts/recheck-figure-topics.ts) and the compacted crops' paths, and refuse
 * every library figure for having no exercise -- most of them sit on a page
 * without one. Only the set's own entries (its id prefix) are replaced; every
 * other figure is kept as it is.
 *
 *   (default)           the Rwanda books: prefix rw, textbook-rwanda-figures.raw.json, textbook-figure-bank.rwanda-tags.json
 *   --set=library       Cambridge library-only books: prefix lb, textbook-library-figures.raw.json, textbook-figure-bank.library-tags.json
 *
 * Out: data/textbook-figure-bank.json
 * Run with:  npx jiti scripts/merge-library-figure-bank.ts [--set=library]
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadRawTextbookFigures } from './textbook-figure-raw'
import { isSelfAssessmentChart } from '../lib/textbook-figure-bank'

const ROOT = process.cwd()
const BANK = path.join(ROOT, 'data', 'textbook-figure-bank.json')
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
// --books=12,20: crops newly taken from those books' PDFs (build_textbook_
// question_figures.py, locate-scanned-figures.ts), judged into the shared tags
// file. Their ids are "tb..." like every other crop, so they are replaced by
// id, not by prefix.
const BOOKS = arg('books').split(',').filter(Boolean).map(Number)
const SET = BOOKS.length
  ? { prefix: '', raw: '', tags: 'textbook-figure-bank.tags.json' }
  : process.argv.includes('--set=library')
    ? { prefix: 'lb', raw: 'textbook-library-figures.raw.json', tags: 'textbook-figure-bank.library-tags.json' }
    : { prefix: 'rw', raw: 'textbook-rwanda-figures.raw.json', tags: 'textbook-figure-bank.rwanda-tags.json' }
const raw: any[] = BOOKS.length
  ? loadRawTextbookFigures().filter((f) => BOOKS.includes(f.textbookId))
  : JSON.parse(fs.readFileSync(path.join(ROOT, 'data', SET.raw), 'utf8')).figures
const tags: Record<string, any> = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', SET.tags), 'utf8'))
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'))

const kept: any[] = []
const refused: Record<string, number> = {}
const refuse = (why: string) => { refused[why] = (refused[why] ?? 0) + 1 }
for (const f of raw) {
  const t = tags[f.id]
  if (!t) { refuse('not judged yet'); continue }
  if (!t.standard) { refuse('not up to standard'); continue }
  if (!String(t.topic ?? '').trim()) { refuse('no topic'); continue }
  const shows = String(t.shows ?? '').trim()
  if (shows.length <= 20) { refuse('no description'); continue }
  if (/cut off|not shown|not visible|is missing|are missing|partly hidden|outside the crop/i.test(shows)) { refuse('description admits the crop is incomplete'); continue }
  if (/^(an?|two|three|four|five|several)?\s*(empty|blank)\b/i.test(shows)) { refuse('a blank form to fill in'); continue }
  if (isSelfAssessmentChart({ shows, labels: Array.isArray(t.labels) ? t.labels : [] })) { refuse('a self-assessment chart'); continue }
  if (!fs.existsSync(path.join(ROOT, 'public', f.localPath.replace(/^\//, '')))) { refuse('image missing on disk'); continue }
  kept.push({
    id: f.id, textbookIds: f.textbookIds, textbookName: f.textbookName, page: f.page, localPath: f.localPath,
    noun: String(t.noun ?? 'diagram').toLowerCase().split(/[,/]/)[0].trim() || 'diagram',
    shows,
    labels: Array.isArray(t.labels) ? t.labels.map(String).filter(Boolean).slice(0, 40) : [],
    topic: String(t.content_topic || t.topic).trim(),
    original: String(t.original ?? '').trim(),
  })
}

const rawIds = new Set(raw.map((f) => f.id))
const others = bank.figures.filter((f: any) => (BOOKS.length ? !rawIds.has(f.id) : !String(f.id).startsWith(SET.prefix)))
fs.writeFileSync(BANK, JSON.stringify({ figures: [...others, ...kept] }, null, 1))
console.log(`kept ${kept.length} ${SET.prefix || "book"} figure(s) of ${raw.length}; the bank holds ${others.length + kept.length}`)
console.log('refused:', refused)
