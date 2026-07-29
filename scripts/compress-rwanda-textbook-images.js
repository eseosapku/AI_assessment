/**
 * Downscale + re-encode kept Rwanda textbook figures in place so the committed
 * image set is deploy-friendly (REB books embed full-page scans up to 5 MB).
 * Targets Cambridge-comparable weight while staying legible for on-screen
 * display and vision description. Updates width/height/bytes in both manifests.
 *
 * Usage:
 *   node scripts/compress-rwanda-textbook-images.js --dry-run
 *   node scripts/compress-rwanda-textbook-images.js
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// REB scans are large; avoid libvips thread/memory blow-ups that make encodes
// fail intermittently under a long sequential loop.
sharp.cache(false)
sharp.concurrency(1)

const DRY_RUN = process.argv.includes('--dry-run')
const MAX_EDGE = 1100
const JPEG_Q = 80
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const CURATED = path.join(ROOT, 'data', 'textbook-images', 'manifest.curated.json')
const RAW = path.join(ROOT, 'data', 'textbook-images', 'manifest.json')

const isRwanda = (i) => i.curriculum === 0 || i.curriculumSlug === 'rwanda'
const diskPath = (lp) => path.join(PUBLIC, String(lp).replace(/^\//, '').split('/').join(path.sep))

async function main() {
  const curated = JSON.parse(fs.readFileSync(CURATED, 'utf8'))
  const targets = curated.images.filter(isRwanda)
  console.log(`=== Compress Rwanda figures${DRY_RUN ? ' (dry run)' : ''} ===`)
  console.log(`Images: ${targets.length} | max edge ${MAX_EDGE}px | jpeg q${JPEG_Q}`)

  const newDims = new Map() // key -> {width,height,bytes}
  let before = 0, after = 0, done = 0, failed = 0, skipped = 0

  for (const img of targets) {
    const fp = diskPath(img.localPath)
    if (!fs.existsSync(fp)) { skipped++; continue }
    const origBytes = fs.statSync(fp).size
    before += origBytes
    const ext = path.extname(fp).toLowerCase()
    try {
      let pipeline = sharp(fp, { failOn: 'none' }).rotate().resize({
        width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true,
      })
      if (ext === '.png') {
        pipeline = pipeline.png({ compressionLevel: 9, palette: true })
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: JPEG_Q })
      } else {
        pipeline = pipeline.jpeg({ quality: JPEG_Q, mozjpeg: true })
      }
      const { data: buf, info } = await pipeline.toBuffer({ resolveWithObject: true })
      // Only replace if we actually saved space
      const saved = buf.length < origBytes
      if (saved && !DRY_RUN) fs.writeFileSync(fp, buf)
      const finalBytes = saved ? buf.length : origBytes
      after += finalBytes
      newDims.set(img.key, { width: info.width, height: info.height, bytes: finalBytes })
      done++
      if (done % 1000 === 0) console.log(`  ...${done}/${targets.length}`)
    } catch (e) {
      failed++
      after += origBytes
      if (failed <= 5) console.log(`  FAIL ${img.localPath}: ${String(e.message).split('\n')[0]}`)
    }
  }

  if (!DRY_RUN) {
    for (const file of [CURATED, RAW]) {
      const m = JSON.parse(fs.readFileSync(file, 'utf8'))
      for (const img of m.images) {
        const d = newDims.get(img.key)
        if (d && isRwanda(img)) { img.width = d.width; img.height = d.height; img.bytes = d.bytes }
      }
      fs.writeFileSync(file, JSON.stringify(m, null, 2))
    }
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(0)
  console.log(`\nProcessed: ${done} | failed: ${failed} | missing: ${skipped}`)
  console.log(`Size: ${mb(before)} MB -> ${mb(after)} MB (${(100 * (1 - after / before)).toFixed(0)}% smaller)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
