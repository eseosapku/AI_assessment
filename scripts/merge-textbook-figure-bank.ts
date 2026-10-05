/**
 * Keep the textbook figures that are up to standard.
 *
 * In:  the raw figures (scripts/textbook-figure-raw.ts) and data/textbook-figure-bank.tags.json
 * Out: data/textbook-figure-bank.json  (what lib/textbook-figure-bank.ts reads)
 *
 * Kept: judged standard, filed under a topic, described, with the book's own
 * exercise about it, and not admitting in its own description that part of it
 * is cut off -- the same backstop the past-paper bank needed. Crops are never
 * deleted here (see merge-checkpoint-figure-bank.ts for why).
 *
 * Run with:  npx jiti scripts/merge-textbook-figure-bank.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadRawTextbookFigures } from './textbook-figure-raw'

const ROOT = process.cwd()
const tags = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-figure-bank.tags.json'), 'utf8'))
const raw = loadRawTextbookFigures()

const out: any[] = []
const refused: Record<string, number> = {}
const refuse = (why: string) => { refused[why] = (refused[why] ?? 0) + 1 }
for (const f of raw) {
  const t = tags[f.id]
  if (!t) { refuse('not judged yet'); continue }
  if (!t.standard) { refuse('not up to standard'); continue }
  if (!String(t.topic ?? '').trim()) { refuse('no topic'); continue }
  if (!String(t.shows ?? '').trim() || !String(t.original ?? '').trim()) { refuse('no description or no exercise'); continue }
  if (/cut off|not shown|not visible|is missing|are missing|partly hidden|outside the crop/i.test(String(t.shows))) {
    refuse('description admits the crop is incomplete'); continue
  }
  // compact_textbook_bank.py turns large PNG crops into JPEGs.
  const localPath = fs.existsSync(path.join(ROOT, 'public', f.localPath)) ? f.localPath
    : f.localPath.replace(/\.png$/, '.jpg')
  if (!fs.existsSync(path.join(ROOT, 'public', localPath))) { refuse('crop missing on disk'); continue }
  // A figure that is blank as a whole -- "An empty results table", "A blank
  // tally chart" -- is a page for the learner to fill, with nothing to read
  // off it. The judge is told so and passed thirteen anyway. Only when the
  // description OPENS on it: a part-whole diagram with one empty circle is
  // a good question ("what goes in the empty circle?") and stays.
  if (/^(an?|two|three|four|five|several)?\s*(empty|blank)\b/i.test(String(t.shows).trim())) {
    refuse('a blank form to fill in'); continue
  }
  out.push({
    id: f.id, textbookIds: f.textbookIds, textbookName: f.textbookName, page: f.page, localPath,
    noun: String(t.noun ?? 'diagram').toLowerCase().split(/[,/]/)[0].trim() || 'diagram',
    shows: String(t.shows).trim(),
    labels: Array.isArray(t.labels) ? t.labels.map(String).filter(Boolean).slice(0, 40) : f.labels,
    topic: String(t.topic).trim(),
    original: String(t.original).trim(),
  })
}
fs.writeFileSync(path.join(ROOT, 'data', 'textbook-figure-bank.json'), JSON.stringify({ figures: out }, null, 1))
const byBook: Record<string, number> = {}
for (const f of out) byBook[f.textbookName.slice(0, 50)] = (byBook[f.textbookName.slice(0, 50)] ?? 0) + 1
console.log(`kept ${out.length} of ${raw.length}`)
console.log('refused:', refused)
for (const [k, v] of Object.entries(byBook).sort()) console.log(`  ${String(v).padStart(4)}  ${k}`)
