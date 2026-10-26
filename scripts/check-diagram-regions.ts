// scripts/check-diagram-regions.ts
//
// Draws every mapped region over its diagram so a person can look and see that
// each circle sits on its part. Writes PNGs to the folder given (default: the
// system temp folder); never into the repo.
//
// Run: npx tsx scripts/check-diagram-regions.ts <out-dir>
import sharp from 'sharp'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { DIAGRAM_REGIONS } from '../lib/studylab/check/diagramRegions'

const out = process.argv[2] ?? path.join(os.tmpdir(), 'diagram-regions')
fs.mkdirSync(out, { recursive: true })

const COLOURS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#f032e6', '#9a6324', '#000075', '#800000', '#469990']
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')

async function main() {
  for (const [name, map] of Object.entries(DIAGRAM_REGIONS)) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${map.height}">`
    map.regions.forEach((region, i) => {
      const c = COLOURS[i % COLOURS.length]
      for (const spot of region.spots) {
        svg += `<circle cx="${spot.x}" cy="${spot.y}" r="${spot.r}" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="2"/>`
        svg += `<text x="${spot.x + spot.r + 2}" y="${spot.y + 4}" font-size="11" font-family="sans-serif" fill="${c}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(region.id)}</text>`
      }
    })
    svg += '</svg>'
    await sharp(`public/art/montessori/diagrams/${name}.webp`)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(path.join(out, `${name}.png`))
  }
  console.log(`wrote ${Object.keys(DIAGRAM_REGIONS).length} overlays to ${out}`)
}

main()
