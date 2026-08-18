/**
 * Shrink oversized textbook figures.
 *
 * These are served to students on metered mobile connections. The library had
 * 33 figures over 400KB and one at 7.3MB — several megabytes before the first
 * question is answered, since an assessment can carry up to twelve.
 *
 * The large ones turned out to be CMYK JPEGs straight from print-ready
 * textbook PDFs, at print resolution. Re-encoding without converting to sRGB
 * keeps them CMYK and barely helps; converting and capping the width is what
 * takes a 7.3MB scan to 222KB.
 */
const fs = require('fs'), path = require('path'), sharp = require('sharp')

// sharp keeps decoded inputs (and their file handles) in a cache, which on
// Windows makes the very files we want to overwrite unopenable on a second
// pass. We are rewriting in place, so the cache is pure liability here.
sharp.cache(false)

const LIMIT = 400 * 1024
// A figure is read on a phone. Past ~1400px the extra pixels are invisible.
const MAX_W = 1400

let files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(png|jpe?g|webp)$/i.test(e.name) && fs.statSync(p).size > LIMIT) files.push(p)
  }
}
walk('public/textbook-images')

;(async () => {
  let before = 0, after = 0, changed = 0, kept = 0
  for (const f of files) {
    const b = fs.statSync(f).size
    before += b
    try {
      const out = await sharp(f)
        .rotate()
        .resize({ width: MAX_W, withoutEnlargement: true })
        .toColourspace('srgb')
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer()
      // Never write a bigger file than we started with.
      if (out.length < b) { fs.writeFileSync(f, out); after += out.length; changed++ }
      else { after += b; kept++ }
    } catch (e) {
      after += b; kept++
      console.warn('  skipped', f, e.message)
    }
  }
  console.log('candidates:', files.length, '| rewritten:', changed, '| left alone:', kept)
  console.log('before:', (before / 1048576).toFixed(1), 'MB  ->  after:', (after / 1048576).toFixed(1), 'MB')
  console.log('saved :', ((before - after) / 1048576).toFixed(1), 'MB')
})()
