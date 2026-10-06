/**
 * The Rwanda books' library images, as raw figures for the judge
 * (scripts/tag-textbook-figures.ts) and then the vetted questions.
 *
 * A Rwanda quiz drew its pictures from the library by asking the writer to
 * pick one, and the writer mostly did not: five on-topic figures offered to a
 * ten-question Chemistry quiz, none used; ten offered to a twenty-question
 * one, three used, all of one electrolysis page none of its topics was about.
 * These are the same images, put through the Cambridge books' pipeline.
 *
 * The library keeps the page's text beside each image, so the judge sees what
 * the book says around it -- an activity, an exercise, or neither.
 *
 * Out: data/textbook-rwanda-figures.raw.json
 * Run with:  npx jiti scripts/rwanda-figure-raw.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-images', 'manifest.json'), 'utf8'))
const entries: any[] = Array.isArray(manifest) ? manifest : manifest.images ?? Object.values(manifest)

// Story books read aloud to six-year-olds, and a Kinyarwanda guide: a
// question written in English about them is no use to anyone.
const SKIP = /read aloud|ibidukikije/i

const figures = entries
  .filter((e) => e.curriculumSlug === 'rwanda' && !SKIP.test(String(e.textbookName)))
  .filter((e) => fs.existsSync(path.join(ROOT, 'public', String(e.localPath).replace(/^\//, ''))))
  .map((e) => ({
    id: `rw${e.textbookId}-p${e.page}-${e.imageIndex ?? 0}`,
    textbookId: Number(e.textbookId),
    textbookIds: [Number(e.textbookId)],
    textbookName: String(e.textbookName).trim(),
    page: Number(e.page),
    localPath: String(e.localPath),
    labels: [],
    heading: null,
    question: String(e.pageText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1400),
  }))

fs.writeFileSync(path.join(ROOT, 'data', 'textbook-rwanda-figures.raw.json'), JSON.stringify({ figures }, null, 1))
console.log(`${figures.length} figure(s) from ${new Set(figures.map((f) => f.textbookId)).size} book(s)`)
