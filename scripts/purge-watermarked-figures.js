/**
 * Remove figures taken from watermarked papers, and never take them again.
 *
 * Some papers in the archive were downloaded from a scraper site that stamps
 * its own name across every page. Extracted, that stamp lands in the middle of
 * a figure and a learner sits an exam with another company's branding across
 * the diagram. It looks like theft because it is somebody else's.
 *
 * 69 of the 1,519 papers in the second archive carry one; the Checkpoint
 * papers supplied directly carry none.
 *
 * The mark is not in the text layer and not a repeated image — it is drawn
 * into the page — so it is detected in the raw bytes of the PDF, which is
 * where the name survives whatever it was drawn with.
 *
 * Run:  node scripts/purge-watermarked-figures.js [--dry-run]
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const MANIFEST = path.join(REPO, 'data', 'textbook-images', 'manifest.json')
const PUBLIC = path.join(REPO, 'public')
const DRY = process.argv.includes('--dry-run')

/** Scraper sites that brand the papers they redistribute. */
const SCRAPER = /papacambridge|pastpapers\.co|xtremepapers|dynamicpapers|savemyexams|bestexamhelp/i

const ROOTS = [
  'C:/Users/Stephen/Downloads/pastPapers-20260919T222238Z-1-001',
  'C:/Users/Stephen/Downloads/Cambridge Past Papers_Etoile X Brain Ink-20260919T214745Z-1-001',
]

function walk(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.toLowerCase().endsWith('.pdf')) out.push(full)
  }
  return out
}

/** Does this paper carry a scraper's brand anywhere in its bytes? */
function isWatermarked(pdfPath) {
  try {
    return SCRAPER.test(fs.readFileSync(pdfPath, 'latin1'))
  } catch {
    return false
  }
}

function main() {
  const marked = new Set()
  for (const root of ROOTS) {
    for (const pdf of walk(root)) {
      if (isWatermarked(pdf)) marked.add(path.basename(pdf))
    }
  }
  console.log(`papers carrying a scraper watermark: ${marked.size}`)
  if (marked.size === 0) return

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const images = Array.isArray(manifest) ? manifest : manifest.images
  if (!Array.isArray(images)) {
    console.error('manifest has no images array')
    process.exit(1)
  }

  const keep = []
  const drop = []
  for (const img of images) {
    if (img?.source === 'pastpaper' && marked.has(String(img.sourceFile || ''))) drop.push(img)
    else keep.push(img)
  }
  console.log(`figures taken from them: ${drop.length}`)
  if (DRY) {
    for (const d of drop.slice(0, 8)) console.log(`   would remove ${d.localPath}`)
    return
  }

  let unlinked = 0
  for (const d of drop) {
    const file = path.join(PUBLIC, String(d.localPath || '').replace(/^\//, ''))
    try { fs.unlinkSync(file); unlinked++ } catch { /* already gone */ }
  }

  if (Array.isArray(manifest)) fs.writeFileSync(MANIFEST, JSON.stringify(keep, null, 1))
  else fs.writeFileSync(MANIFEST, JSON.stringify({ ...manifest, images: keep }, null, 1))

  console.log(`removed ${drop.length} figure(s), deleted ${unlinked} file(s)`)
  console.log(`manifest now holds ${keep.length}`)
}

module.exports = { isWatermarked, SCRAPER }

if (require.main === module) main()
