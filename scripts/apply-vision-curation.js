/**
 * Apply the vision curation results to the manifests + disk.
 *   - attaches description / keywords / visionType to each kept figure
 *     (used for content-based image->question matching at runtime)
 *   - drops figures the vision model flagged as decorative/non-educational
 *   - deletes the dropped image files from public/textbook-images/*
 *   - rewrites manifest.curated.json and manifest.json to the kept set
 *
 * Requires: data/textbook-images/vision-descriptions.json (from
 *           scripts/vision-curate-textbook-images.js)
 *
 * Usage:
 *   node scripts/apply-vision-curation.js --dry-run
 *   node scripts/apply-vision-curation.js
 */
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const DATA = path.join(ROOT, 'data', 'textbook-images')
const CURATED = path.join(DATA, 'manifest.curated.json')
const RAW = path.join(DATA, 'manifest.json')
const DESC = path.join(DATA, 'vision-descriptions.json')

const diskPath = (lp) => path.join(PUBLIC, String(lp).replace(/^\//, '').split('/').join(path.sep))
const currName = (c) => (c === 1 ? 'cambridge' : c === 0 ? 'rwanda' : String(c))

function main() {
  const manifest = JSON.parse(fs.readFileSync(CURATED, 'utf8'))
  const desc = JSON.parse(fs.readFileSync(DESC, 'utf8'))

  const kept = []
  const stats = {}
  let dropped = 0, described = 0, undescribed = 0, deleted = 0, missing = 0

  for (const img of manifest.images) {
    const cn = currName(img.curriculum)
    stats[cn] = stats[cn] || { kept: 0, dropped: 0, undescribed: 0 }
    const d = desc[img.key]
    if (!d) {
      undescribed++
      stats[cn].undescribed++
      kept.push(img) // never drop what we didn't inspect
      continue
    }
    described++
    if (d.verdict === 'drop') {
      dropped++
      stats[cn].dropped++
      const fp = diskPath(img.localPath)
      if (fs.existsSync(fp)) { if (!DRY_RUN) fs.unlinkSync(fp); deleted++ } else { missing++ }
      continue
    }
    kept.push({
      ...img,
      description: d.description || undefined,
      keywords: d.keywords || undefined,
      visionType: d.type || undefined,
    })
    stats[cn].kept++
  }

  console.log(`=== Apply vision curation${DRY_RUN ? ' (dry run)' : ''} ===`)
  console.log(`Inspected: ${described} | undescribed (kept): ${undescribed}`)
  console.log(`Dropped (decorative): ${dropped} | files deleted: ${deleted} | already missing: ${missing}`)
  console.log('Per curriculum:', JSON.stringify(stats))
  console.log(`Kept total: ${kept.length} (was ${manifest.images.length})`)

  if (DRY_RUN) { console.log('\n(dry run — no writes)'); return }

  const stamp = new Date().toISOString()
  const outCurated = { ...manifest, images: kept, total: kept.length, vision_curated_at: stamp }
  fs.writeFileSync(CURATED, JSON.stringify(outCurated, null, 2))

  // Keep raw manifest in sync (post-prune invariant: raw == curated kept set)
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'))
  raw.images = kept
  raw.total = kept.length
  raw.vision_curated_at = stamp
  fs.writeFileSync(RAW, JSON.stringify(raw, null, 2))

  // Remove empty textbook folders
  for (const slug of ['cambridge', 'rwanda']) {
    const base = path.join(PUBLIC, 'textbook-images', slug)
    if (!fs.existsSync(base)) continue
    for (const tb of fs.readdirSync(base, { withFileTypes: true })) {
      if (!tb.isDirectory()) continue
      const dir = path.join(base, tb.name)
      if (fs.readdirSync(dir).filter((f) => f !== '.gitkeep').length === 0) fs.rmdirSync(dir)
    }
  }

  console.log(`\nWrote ${CURATED} and ${RAW} (${kept.length} figures)`)
}

main()
