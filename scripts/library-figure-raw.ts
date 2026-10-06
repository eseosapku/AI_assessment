/**
 * A set of books' library images, as raw figures for the judge
 * (scripts/tag-textbook-figures.ts) and then the vetted questions.
 *
 * A quiz on a book with only library images drew its pictures by asking the
 * writer to pick one, and the writer mostly did not: five on-topic figures
 * offered to a ten-question Rwanda Chemistry quiz, none used; ten offered to
 * a twenty-question one, three used, all of one electrolysis page none of its
 * topics was about. These are the same images, put through the pipeline the
 * Cambridge school books' figures went through.
 *
 * The library keeps the page's text beside each image, so the judge sees what
 * the book says around it -- an activity, an exercise, or neither.
 *
 *   --slug=rwanda --prefix=rw   the Rwanda books (data/textbook-rwanda-figures.raw.json)
 *   --slug=cambridge --prefix=lb --books=11,17,...   Cambridge books with library images only
 *                               (data/textbook-library-figures.raw.json)
 *
 * Run with:  npx jiti scripts/library-figure-raw.ts [--slug=rwanda] [--prefix=rw] [--books=..] [--out=..]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
const SLUG = arg('slug') || 'rwanda'
const PREFIX = arg('prefix') || 'rw'
const BOOKS = arg('books').split(',').filter(Boolean).map(Number)
const OUT = arg('out') || (SLUG === 'rwanda' ? 'data/textbook-rwanda-figures.raw.json' : 'data/textbook-library-figures.raw.json')

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-images', 'manifest.json'), 'utf8'))
const entries: any[] = Array.isArray(manifest) ? manifest : manifest.images ?? Object.values(manifest)

// Story books read aloud to six-year-olds, and a Kinyarwanda guide: a
// question written in English about them is no use to anyone.
const SKIP = /read aloud|ibidukikije/i

const figures = entries
  .filter((e) => e.curriculumSlug === SLUG && !SKIP.test(String(e.textbookName)))
  .filter((e) => !BOOKS.length || BOOKS.includes(Number(e.textbookId)))
  .filter((e) => fs.existsSync(path.join(ROOT, 'public', String(e.localPath).replace(/^\//, ''))))
  .map((e) => ({
    id: `${PREFIX}${e.textbookId}-p${e.page}-${e.imageIndex ?? 0}`,
    textbookId: Number(e.textbookId),
    textbookIds: [Number(e.textbookId)],
    textbookName: String(e.textbookName).trim(),
    page: Number(e.page),
    localPath: String(e.localPath),
    labels: [],
    heading: null,
    question: String(e.pageText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1400),
  }))

fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify({ figures }, null, 1))
console.log(`${figures.length} figure(s) from ${new Set(figures.map((f) => f.textbookId)).size} book(s) -> ${OUT}`)
