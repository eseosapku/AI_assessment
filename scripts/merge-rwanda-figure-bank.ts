/**
 * Add the judged Rwanda library figures to the textbook figure bank.
 *
 * Append-only, unlike merge-textbook-figure-bank.ts, which rebuilds the bank
 * from its raw files and tags: run now, that would undo the chapter re-check
 * (scripts/recheck-figure-topics.ts) and the compacted crops' paths, and refuse
 * every Rwanda figure for having no exercise -- most of them sit on a page
 * without one. Only `rw` entries are replaced; every other figure is kept as
 * it is.
 *
 * In:  data/textbook-rwanda-figures.raw.json, data/textbook-figure-bank.rwanda-tags.json
 * Out: data/textbook-figure-bank.json
 * Run with:  npx jiti scripts/merge-rwanda-figure-bank.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BANK = path.join(ROOT, 'data', 'textbook-figure-bank.json')
const raw: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-rwanda-figures.raw.json'), 'utf8')).figures
const tags: Record<string, any> = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-figure-bank.rwanda-tags.json'), 'utf8'))
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
  if (!fs.existsSync(path.join(ROOT, 'public', f.localPath.replace(/^\//, '')))) { refuse('image missing on disk'); continue }
  kept.push({
    id: f.id, textbookIds: f.textbookIds, textbookName: f.textbookName, page: f.page, localPath: f.localPath,
    noun: String(t.noun ?? 'diagram').toLowerCase().split(/[,/]/)[0].trim() || 'diagram',
    shows,
    labels: Array.isArray(t.labels) ? t.labels.map(String).filter(Boolean).slice(0, 40) : [],
    topic: String(t.topic).trim(),
    original: String(t.original ?? '').trim(),
  })
}

const others = bank.figures.filter((f: any) => !String(f.id).startsWith('rw'))
fs.writeFileSync(BANK, JSON.stringify({ figures: [...others, ...kept] }, null, 1))
console.log(`kept ${kept.length} Rwanda figure(s) of ${raw.length}; the bank holds ${others.length + kept.length}`)
console.log('refused:', refused)
