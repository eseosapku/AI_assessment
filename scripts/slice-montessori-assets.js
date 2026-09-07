/**
 * Slice the generated Montessori asset sheets into individual files.
 *
 *   sheet 1 (901x768)  — 5x5 tactile texture swatches (grey gutters)
 *   sheet 2 (1408x768) — 7x5 flat vector illustrations (off-white bg)
 *   sheet 3 (1408x768) — 5x5 isometric 3D materials (off-white bg)
 *
 * Output: public/art/montessori/{textures,illus,iso}/*.webp
 *
 * Usage:
 *   node scripts/slice-montessori-assets.js
 *   node scripts/slice-montessori-assets.js --src="C:/path/to/folder"
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

sharp.cache(false)

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`))
  return a ? a.split('=').slice(1).join('=').replace(/^"|"$/g, '') : d
}
const SRC = arg('src', 'C:/Users/Stephen/Downloads/montessori assets')
// Later sheets were dropped straight into Downloads rather than the subfolder.
const SRC2 = arg('src2', 'C:/Users/Stephen/Downloads')
const OUT = path.join(__dirname, '..', 'public', 'art', 'montessori')

const SHEETS = {
  textures: {
    file: 'Gemini_Generated_Image_ycsii2ycsii2ycsi.png',
    cols: 5, rows: 5,
    // This sheet is NOT full-bleed: the swatch grid sits inside a grey margin
    // with shadowed gutters, so the bounds are measured explicitly. Swatches are
    // uniform material, so a generous centre crop is both safe and ideal.
    grid: { x: 77, y: 28, w: 770, h: 717 },
    inset: 0.16, size: 256,
    names: [
      'wood-maple', 'wood-birch-ribbed', 'wood-oak', 'wood-walnut', 'wood-bamboo',
      'felt-green', 'felt-red', 'felt-blue', 'felt-cream', 'felt-charcoal',
      'cork', 'paper-kraft', 'paper-handmade', 'linen', 'card-manila',
      'slate', 'marble', 'terracotta', 'sandstone', 'concrete',
      'rattan', 'jute', 'silk-raw', 'brass', 'leather',
    ],
  },
  illus: {
    file: 'Gemini_Generated_Image_obbnhbobbnhbobbn.png',
    cols: 7, rows: 5,
    inset: 0.04, size: 320,
    names: [
      'hands-block', 'sorting-tray', 'blank-1', 'balance-scale', 'bar-chart', 'bead-chains', 'bead-chain-loop',
      'magnifier-leaf', 'beaker', 'map-puzzle', 'sequence-cards', 'sequence-cards-alt', 'plant-jar', 'plant-jar-alt',
      'magnet', 'prism', 'prism-alt', 'gears', 'soil-layers', 'globe-stand', 'globe-stand-alt',
      'clock', 'fraction-circles', 'fraction-circles-alt', 'sandpaper-letter', 'abacus', 'venn', 'venn-alt',
      'tuning-fork', 'paper-shapes', 'paper-shapes-alt', 'ruler-pencil', 'stacked-cubes', 'notebook', 'blank-2',
    ],
  },
  iso: {
    file: 'Gemini_Generated_Image_63rnkn63rnkn63rn.png',
    cols: 5, rows: 5,
    inset: 0.04, size: 320,
    names: [
      'bead-thousand-cube', 'bead-ten-bar', 'bead-hundred-square', 'cube-grid', 'number-rod',
      'pink-tower', 'brown-stair', 'cylinder-block', 'bead-bowl', 'tray-felt',
      'geometric-solids', 'triangle-box', 'spindle-box', 'colour-tablets', 'hundred-board',
      'fraction-insets', 'sandpaper-letter', 'movable-alphabet', 'bells', 'cylinders-red-blue',
      'leaf-card', 'globe', 'map-piece', 'weather-dial', 'tray-empty',
    ],
  },

  // ── Labelled-diagram backplates: 2x2 sheets, one domain each ───────────────
  // Deliberately wordless — the `label` pattern has the student drag names on,
  // so any printed text in the art would give the answer away.
  'diagrams-plant': {
    base: SRC2, file: 'sheet a.png', cols: 2, rows: 2, inset: 0.03, size: 460, out: 'diagrams',
    names: ['plant-cell', 'leaf-section', 'flower-section', 'root-section'],
  },
  'diagrams-organs': {
    base: SRC2, file: 'sheet b.png', cols: 2, rows: 2, inset: 0.03, size: 460, out: 'diagrams',
    names: ['heart', 'lungs', 'digestive-system', 'nephron'],
  },
  'diagrams-earth': {
    base: SRC2, file: 'sheet d.png', cols: 2, rows: 2, inset: 0.03, size: 460, out: 'diagrams',
    names: ['volcano', 'river-profile', 'soil-profile', 'earth-layers'],
  },
  'diagrams-physics': {
    base: SRC2, file: 'sheet e.png', cols: 2, rows: 2, inset: 0.03, size: 460, out: 'diagrams',
    names: ['circuit-series', 'lever', 'microscope', 'bunsen-burner'],
  },
  'diagrams-cells': {
    base: SRC2, file: 'sheet F.png', cols: 2, rows: 2, inset: 0.03, size: 460, out: 'diagrams',
    names: ['animal-cell', 'bacterial-cell', 'tooth-section', 'skeleton'],
  },

  // Sheet C had to be split in two and generated as side-by-side pairs: asking
  // for four anatomical subjects at once kept summoning printed labels.
  'diagrams-senses': {
    base: SRC2, file: 'sheet c1.png', cols: 2, rows: 1, inset: 0.02, size: 460, out: 'diagrams',
    names: ['eye', 'ear'],
  },
  'diagrams-tissue': {
    base: SRC2, file: 'sheet c 2.png', cols: 2, rows: 1, inset: 0.02, size: 460, out: 'diagrams',
    names: ['skin-section', 'neuron'],
  },

  // ── Subject object tokens: 9x6 = 54 ───────────────────────────────────────
  tokens: {
    base: SRC2, file: 'Subject object tokens.jpg', cols: 9, rows: 6, inset: 0.06, size: 200, out: 'tokens',
    names: [
      'ice-cube', 'water-drop', 'steam', 'candle', 'ice-cream', 'magnet', 'battery', 'battery-alt', 'storm-cloud',
      'light-bulb', 'plug', 'spring', 'pulley', 'gear', 'thermometer', 'balance-scale', 'globe', 'balance-scale-alt',
      'measuring-cylinder', 'test-tube', 'conical-flask', 'pipette', 'funnel', 'fern', 'moss', 'rock-igneous', 'rock-granite',
      'sunflower', 'cactus', 'mushroom', 'acorn-leaf', 'goldfish', 'frog', 'lizard', 'rock-marble', 'rock-sedimentary',
      'sparrow', 'rabbit', 'butterfly', 'spider', 'crystal-quartz', 'earthworm', 'snail', 'rain-cloud', 'sun',
      'snowflake', 'lightning', 'ant', 'maize', 'rice', 'coffee-beans', 'gold-nugget', 'cow', 'chicken',
    ],
  },

  // ── Scenario scenes: 5x5 = 25, wordless and culture-neutral ───────────────
  scenarios: {
    base: SRC2, file: 'scenario scenes.png', cols: 5, rows: 5, inset: 0.02, size: 340, out: 'scenarios',
    names: [
      'workshop-spill', 'frayed-cable', 'road-crossing', 'market-transaction', 'sharing-food',
      'littering', 'helping-elderly', 'arguing-over-toy', 'taking-from-desk', 'shopkeeper-change',
      'queue-pushing', 'lost-wallet', 'group-work', 'exam-cheating', 'online-stranger',
      'medicine-reach', 'tap-running', 'tree-planting', 'waste-sorting', 'handwashing',
      'fire-exit', 'feeding-dog', 'community-circle', 'safety-goggles', 'bike-helmet',
    ],
  },
}

async function sliceSheet(key, cfg) {
  const src = path.join(cfg.base ?? SRC, cfg.file)
  if (!fs.existsSync(src)) {
    console.log(`SKIP ${key}: missing ${cfg.file}`)
    return 0
  }
  const dir = path.join(OUT, cfg.out ?? key)
  fs.mkdirSync(dir, { recursive: true })
  const meta = await sharp(src).metadata()
  // Sheets are full-bleed unless an explicit grid box is supplied.
  const g = cfg.grid ?? { x: 0, y: 0, w: meta.width, h: meta.height }
  const cw = g.w / cfg.cols
  const ch = g.h / cfg.rows
  const ix = Math.round(cw * cfg.inset)
  const iy = Math.round(ch * cfg.inset)

  let n = 0
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const name = cfg.names[r * cfg.cols + c]
      if (!name || name.startsWith('blank')) continue
      const left = Math.round(g.x + c * cw + ix)
      const top = Math.round(g.y + r * ch + iy)
      const width = Math.round(cw - ix * 2)
      const height = Math.round(ch - iy * 2)
      await sharp(src)
        .extract({ left, top, width, height })
        .resize(cfg.size, cfg.size, { fit: key === 'textures' ? 'fill' : 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(path.join(dir, `${name}.webp`))
      n++
    }
  }
  console.log(`${key}: ${n} assets -> public/art/montessori/${cfg.out ?? key}/`)
  return n
}

;(async () => {
  console.log(`=== Slicing Montessori asset sheets ===\nsource: ${SRC}`)
  let total = 0
  for (const [key, cfg] of Object.entries(SHEETS)) total += await sliceSheet(key, cfg)
  console.log(`\nDone: ${total} assets`)
})().catch((e) => { console.error(e); process.exit(1) })
