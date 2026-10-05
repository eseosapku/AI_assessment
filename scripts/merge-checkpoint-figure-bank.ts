/**
 * Join the cut figures to their tags and keep only what a question can be
 * written about.
 *
 * In:  data/checkpoint-figure-bank.raw.json, data/checkpoint-figure-bank.tags.json
 * Out: data/checkpoint-figure-bank.json  (what lib/checkpoint-figure-bank.ts reads)
 *
 * A focus the tagger wrote that is not on the syllabus list is refused rather
 * than matched loosely: the slot matcher compares foci exactly, so a figure
 * filed under a focus no slot carries would simply never be printed, and one
 * filed under the wrong strand would move a slot across the strand report.
 * Crops for refused figures stay unless --prune is passed (see below).
 *
 * Run with:  npx jiti scripts/merge-checkpoint-figure-bank.ts [--prune]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fociFor } from '../lib/checkpoint-paper'
import { CHECKPOINT_SUBJECTS } from '../lib/cambridge-checkpoint'

const ROOT = process.cwd()
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'checkpoint-figure-bank.raw.json'), 'utf8')).figures
const tags = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'checkpoint-figure-bank.tags.json'), 'utf8'))

const strandOf = new Map<string, Map<string, string>>()
for (const s of CHECKPOINT_SUBJECTS) {
  const m = new Map<string, string>()
  for (const strand of s.strands) for (const f of fociFor(s, strand)) m.set(f.toLowerCase(), strand)
  strandOf.set(s.code, m)
}

const out: any[] = []
const refused: Record<string, number> = {}
const refuse = (why: string) => { refused[why] = (refused[why] ?? 0) + 1 }
for (const f of raw) {
  const t = tags[f.id]
  if (!t) { refuse('not tagged (listening paper)'); continue }
  if (!t.usable) { refuse('judged unusable'); continue }
  // Question text printed in the middle of the figure, where no trim can
  // reach it without cutting the figure too.
  if (f.stem_inside) { refuse('question text inside the figure'); continue }
  // Filed under the nearest focus on the list rather than its own -- see
  // scripts/check-figure-focus-fit.ts. A kidney diagram filed as digestion
  // gets a digestion question.
  if (t.fit === 'no') { refuse('filed under a focus it is not about'); continue }
  // The tagger's own account admits part of the figure is missing. It is
  // told to call such a crop unusable and sometimes describes the cut and
  // passes it anyway -- a Group 1 table "with the element names not shown"
  // went out under a question about lithium. A cell blacked out on purpose
  // ("predict the melting point of sodium") is the paper's design, not a cut.
  if (/cut off|not shown|not visible|is missing|are missing|partly hidden|outside the crop/i.test(String(t.shows ?? ''))) {
    refuse('description admits the crop is incomplete'); continue
  }
  const strand = strandOf.get(f.code)?.get(String(t.focus ?? '').toLowerCase())
  if (!strand) { refuse('focus not on the syllabus list'); continue }
  if (!String(t.shows ?? '').trim() || !String(t.original ?? '').trim()) { refuse('no description or no question'); continue }
  out.push({
    id: f.id, code: f.code, stage: f.stage, component: f.component, session: f.session,
    localPath: f.localPath,
    noun: String(t.noun ?? 'diagram').toLowerCase().split(/[,/]/)[0].trim() || 'diagram',
    shows: String(t.shows).trim(),
    labels: f.labels,
    // The syllabus spelling, not the tagger's.
    focus: fociFor(CHECKPOINT_SUBJECTS.find((s) => s.code === f.code)!, strand)
      .find((x) => x.toLowerCase() === String(t.focus).toLowerCase()),
    strand,
    original: String(t.original).trim(),
    primaryOk: Boolean(t.primary_ok),
  })
}

// With --prune, every crop the bank does not print goes, including ones left
// by earlier builds whose figures were since merged or renamed -- swept from
// the folder, not looked up from the raw list, which no longer names them.
//
// Opt-in, because once papers are saved a refused figure is still printed on
// every paper that already carries it. Pruning a crop a learner's saved paper
// points at turns that question into a broken image -- which is exactly what
// a walk through a paper generated an hour before a prune showed.
const PRUNE = process.argv.includes('--prune')
const kept = new Set(out.map((f) => f.localPath))
const BANK_DIR = path.join(ROOT, 'public', 'textbook-images', 'checkpoint-bank')
let deleted = 0
for (const dir of PRUNE && fs.existsSync(BANK_DIR) ? fs.readdirSync(BANK_DIR) : []) {
  const full = path.join(BANK_DIR, dir)
  for (const file of fs.readdirSync(full)) {
    if (kept.has(`/textbook-images/checkpoint-bank/${dir}/${file}`)) continue
    fs.unlinkSync(path.join(full, file))
    deleted++
  }
  if (!fs.readdirSync(full).length) fs.rmdirSync(full)
}

fs.writeFileSync(path.join(ROOT, 'data', 'checkpoint-figure-bank.json'), JSON.stringify({ figures: out }, null, 1))
const byCode: Record<string, number> = {}
for (const f of out) byCode[f.code] = (byCode[f.code] ?? 0) + 1
console.log(`kept ${out.length} of ${raw.length}`, byCode)
console.log('refused:', refused, `; deleted ${deleted} unreachable crops`)
console.log('0862 also answerable at Stage 6:', out.filter((f) => f.code === '0862' && f.primaryOk).length)
