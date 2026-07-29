/**
 * Convert JPEG2000 (.jpx) textbook figures to compressed JPEG.
 * JPEG2000 doesn't render in Chrome/Firefox/Edge and can't be read by sharp or
 * described by the vision model — so these figures were effectively broken.
 * PyMuPDF decodes them; sharp compresses to web-friendly JPEG. Updates both
 * manifests (localPath + dims + bytes) and clears any stale vision entries.
 *
 * Usage:
 *   node scripts/fix-jpx-images.js --dry-run
 *   node scripts/fix-jpx-images.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const sharp = require('sharp')

sharp.cache(false); sharp.concurrency(1)
const DRY = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const DATA = path.join(ROOT, 'data', 'textbook-images')
const CURATED = path.join(DATA, 'manifest.curated.json')
const RAW = path.join(DATA, 'manifest.json')
const DESC = path.join(DATA, 'vision-descriptions.json')
const PY = process.env.PYTHON || 'python'
const disk = (lp) => path.join(PUBLIC, String(lp).replace(/^\//, '').split('/').join(path.sep))

async function main() {
  const curated = JSON.parse(fs.readFileSync(CURATED, 'utf8'))
  const jpx = curated.images.filter((i) => /\.jpx$/i.test(i.localPath))
  console.log(`=== Fix .jpx figures${DRY ? ' (dry run)' : ''} === found ${jpx.length}`)

  const updates = new Map() // key -> {localPath,width,height,bytes}
  let done = 0, failed = 0

  for (const img of jpx) {
    const jpxPath = disk(img.localPath)
    if (!fs.existsSync(jpxPath)) { failed++; continue }
    const tmpPng = jpxPath.replace(/\.jpx$/i, '.tmp.png')
    const newLocal = img.localPath.replace(/\.jpx$/i, '.jpeg')
    const newPath = disk(newLocal)
    try {
      execFileSync(PY, [path.join(__dirname, 'jpx_to_png.py'), jpxPath, tmpPng], { encoding: 'utf8' })
      const { data, info } = await sharp(tmpPng)
        .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
      if (!DRY) {
        fs.writeFileSync(newPath, data)
        fs.unlinkSync(tmpPng)
        fs.unlinkSync(jpxPath)
      } else if (fs.existsSync(tmpPng)) {
        fs.unlinkSync(tmpPng)
      }
      updates.set(img.key, { localPath: newLocal, width: info.width, height: info.height, bytes: data.length })
      done++
    } catch (e) {
      failed++
      if (failed <= 5) console.log(`  FAIL ${img.localPath}: ${String(e.message).split('\n')[0]}`)
      try { if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng) } catch {}
    }
  }

  console.log(`Converted: ${done} | failed: ${failed}`)
  if (DRY || !done) { console.log('(no manifest writes)'); return }

  for (const file of [CURATED, RAW]) {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const img of m.images) {
      const u = updates.get(img.key)
      if (u && /\.jpx$/i.test(img.localPath)) Object.assign(img, u)
    }
    fs.writeFileSync(file, JSON.stringify(m, null, 2))
  }

  // Clear vision entries for the converted keys so they get re-described
  if (fs.existsSync(DESC)) {
    const d = JSON.parse(fs.readFileSync(DESC, 'utf8'))
    let cleared = 0
    for (const key of updates.keys()) if (d[key]) { delete d[key]; cleared++ }
    fs.writeFileSync(DESC, JSON.stringify(d))
    console.log(`Cleared ${cleared} stale vision entries for re-description`)
  }
  console.log('Manifests updated (.jpx -> .jpeg)')
}

main().catch((e) => { console.error(e); process.exit(1) })
