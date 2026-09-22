/**
 * Copy vision descriptions into the live manifest. Nothing else.
 *
 * `apply-vision-curation.js` does this and more: it also deletes figures the
 * vision pass flagged as decorative and REWRITES both manifests from the
 * curated snapshot. That snapshot predates the past-paper re-crop, so running
 * it now would throw away 8,663 figures to add descriptions to some of them.
 *
 * This only ever fills in a missing description. It deletes nothing, drops
 * nothing, and reorders nothing.
 *
 * Why it matters: a figure with no description cannot have a question written
 * against it, because the writer never sees the image -- it writes from the
 * description alone. Given none it invents what the picture shows, which is
 * how a paper ended up captioning three plainly different triangles
 * "Triangles A, B and C are identical".
 *
 *   node scripts/merge-vision-descriptions.js --dry-run
 *   node scripts/merge-vision-descriptions.js
 */
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'data', 'textbook-images')
const MANIFEST = path.join(DATA, 'manifest.json')
const DESC = path.join(DATA, 'vision-descriptions.json')

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const images = manifest.images || manifest
const desc = JSON.parse(fs.readFileSync(DESC, 'utf8'))

let filled = 0
let already = 0
let noVision = 0
const bySource = {}

for (const img of images) {
  const src = String(img.source ?? 'textbook')
  bySource[src] = bySource[src] || { described: 0, undescribed: 0 }

  if (String(img.description ?? '').trim()) {
    already++
    bySource[src].described++
    continue
  }

  const v = desc[img.key]
  const text = String(v?.description ?? '').trim()
  if (!text) {
    noVision++
    bySource[src].undescribed++
    continue
  }

  if (!DRY_RUN) {
    img.description = text
    if (Array.isArray(v.keywords) && v.keywords.length) img.keywords = v.keywords
    if (v.type) img.visionType = v.type
  }
  filled++
  bySource[src].described++
}

console.log(`=== Merge vision descriptions${DRY_RUN ? ' (dry run)' : ''} ===`)
console.log(`figures in manifest:  ${images.length}`)
console.log(`already described:    ${already}`)
console.log(`descriptions added:   ${filled}`)
console.log(`still undescribed:    ${noVision}`)
console.log('per source:', JSON.stringify(bySource))

if (!DRY_RUN && filled > 0) {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest))
  console.log(`wrote ${MANIFEST}`)
} else if (DRY_RUN) {
  console.log('\n(dry run — no writes)')
}
