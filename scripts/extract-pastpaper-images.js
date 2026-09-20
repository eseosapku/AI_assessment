/**
 * Extract figures from past-paper PDFs into the shared figure library.
 *
 * Question papers are the best figure source there is for exam practice: every
 * diagram in one was drawn to be asked about, at the right level, in the right
 * style. A textbook figure has to be repurposed; a past-paper figure already
 * IS an exam figure.
 *
 * These are somebody else's copyrighted papers. Every entry is tagged
 * `source: 'pastpaper'` with the board and the file it came from, so the whole
 * set can be found and removed in one pass if the licensing position changes:
 *
 *   node scripts/extract-pastpaper-images.js --purge --board=cambridge
 *
 * Papers are not textbooks and have no row in the textbooks table, so ids are
 * assigned from a stable hash of the file path -- the same paper extracted
 * twice lands on the same id instead of duplicating.
 *
 * Usage:
 *   node scripts/extract-pastpaper-images.js --root="C:/path" --board=cambridge --label="Checkpoint" --dry-run
 *   node scripts/extract-pastpaper-images.js --root="C:/path" --board=cambridge --label="Checkpoint"
 *   node scripts/extract-pastpaper-images.js --purge --board=cambridge
 */
const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')
const { execFileSync } = require('child_process')

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '')
const DRY_RUN = process.argv.includes('--dry-run')
const PURGE = process.argv.includes('--purge')
const ROOT = arg('root')
const BOARD = (arg('board') || 'cambridge').toLowerCase()
const LABEL = arg('label') || 'Past paper'
const LIMIT = Number(arg('limit')) || 0

const PY = process.env.PYTHON || 'python'
const MANIFEST_DIR = path.join(__dirname, '..', 'data', 'textbook-images')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')
const PUBLIC_ROOT = path.join(__dirname, '..', 'public', 'textbook-images')
const SLUG = `${BOARD}-papers`

// A question paper renders fractions, roman-numeral lists and bracket glyphs
// as tiny embedded images. Those are typography, not figures, and at the
// textbook defaults they flood the library. Raised deliberately.
process.env.EXTRACT_MIN_PX = process.env.EXTRACT_MIN_PX || '180'
process.env.EXTRACT_MIN_BYTES = process.env.EXTRACT_MIN_BYTES || '12000'
process.env.EXTRACT_MAX_PER_PAGE = process.env.EXTRACT_MAX_PER_PAGE || '4'
process.env.EXTRACT_DEDUP = process.env.EXTRACT_DEDUP || '1'

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { version: 1, images: [] }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    return { ...raw, version: 1, images: Array.isArray(raw?.images) ? raw.images : [] }
  } catch {
    return { version: 1, images: [] }
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })
  manifest.extracted_at = new Date().toISOString()
  manifest.total = manifest.images.length
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

function walkPdfs(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walkPdfs(p, out)
    else if (/\.pdf$/i.test(ent.name)) out.push(p)
  }
  return out
}

/** Stable per-paper id, so re-running replaces rather than duplicates. */
function paperId(file) {
  const h = createHash('sha1').update(path.basename(file).toLowerCase()).digest('hex')
  // Kept clear of real textbook_id values, which are small integers.
  return 900000 + (parseInt(h.slice(0, 8), 16) % 99999)
}

function main() {
  const manifest = readManifest()

  if (PURGE) {
    const before = manifest.images.length
    manifest.images = manifest.images.filter((i) => !(i.source === 'pastpaper' && i.board === BOARD))
    console.log(`purged ${before - manifest.images.length} ${BOARD} past-paper figure(s)`)
    if (!DRY_RUN) saveManifest(manifest)
    return
  }

  if (!ROOT) { console.error('--root is required'); process.exit(1) }
  const pdfs = walkPdfs(ROOT)
  console.log(`=== Past-paper figures: ${LABEL} (${BOARD}) ===`)
  console.log(`root: ${ROOT}`)
  console.log(`papers: ${pdfs.length}${DRY_RUN ? '  (dry run)' : ''}\n`)

  const stats = { papers: 0, images: 0, cached: 0, failed: 0 }
  for (const pdf of pdfs) {
    if (LIMIT && stats.papers >= LIMIT) break
    const id = paperId(pdf)
    const name = path.basename(pdf).replace(/\.pdf$/i, '')

    if (manifest.images.some((i) => i.textbookId === id)) { stats.cached++; continue }
    stats.papers++
    if (DRY_RUN) { console.log(`  would scan [${id}] ${name.slice(0, 70)}`); continue }

    try {
      const outDir = path.join(PUBLIC_ROOT, SLUG, String(id))
      // Vector, not raster. Cambridge papers contain no embedded bitmaps at
      // all -- a Science paper's 140 "images" are text glyphs, and every
      // diagram is drawn as paths. The figures are found geometrically and
      // rendered instead.
      const raw = execFileSync(PY, [path.join(__dirname, 'extract_vector_figures.py'), pdf, outDir], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      })
      const result = JSON.parse(raw)
      if (result.error) throw new Error(result.error)
      result.images = (result.figures || []).map((f) => ({
        page: f.page, imageIndex: f.imageIndex, kind: 'vector',
        width: f.width, height: f.height, bytes: f.bytes,
        filename: f.file, ext: 'png',
        // The line above the figure is what the question calls it, and it is
        // the only text a vector diagram carries into the library.
        pageText: f.nearby || '',
      }))

      fs.mkdirSync(outDir, { recursive: true })
      for (const img of result.images) {
        const fname = img.filename || `page${img.page}-${img.kind}-${img.imageIndex}.${img.ext || 'png'}`
        manifest.images.push({
          key: `pp-${id}-p${img.page}-${img.kind}-${img.imageIndex}`,
          textbookId: id,
          curriculum: 1,
          curriculumSlug: SLUG,
          textbookName: `${LABEL}: ${name}`,
          page: img.page,
          imageIndex: img.imageIndex,
          kind: img.kind,
          width: img.width,
          height: img.height,
          pageText: img.pageText || '',
          localPath: `/textbook-images/${SLUG}/${id}/${fname}`,
          bytes: img.bytes,
          // The tag that makes the whole set removable in one pass.
          source: 'pastpaper',
          board: BOARD,
          sourceFile: path.basename(pdf),
        })
        stats.images++
      }
      console.log(`  [${id}] ${result.images.length.toString().padStart(3)} fig  ${name.slice(0, 62)}`)
      saveManifest(manifest)
    } catch (e) {
      stats.failed++
      console.log(`  FAIL ${name.slice(0, 60)}: ${String(e.message).slice(0, 80)}`)
    }
  }

  if (!DRY_RUN) saveManifest(manifest)
  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}:`)
  console.log(`  papers scanned: ${stats.papers}`)
  console.log(`  figures saved:  ${stats.images}`)
  console.log(`  already cached: ${stats.cached}`)
  console.log(`  failed:         ${stats.failed}`)
  console.log(`  manifest total: ${manifest.images.length}`)
}

main()
