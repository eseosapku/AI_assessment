/**
 * Rule-based curation of textbook images (Cambridge + Rwanda/REB).
 * Bans full-page screenshots; keeps figures, graphs, science diagrams, device photos, tables.
 *
 * Cambridge (curriculum 1) is scored with the original rules only, so its
 * curated set is unchanged. Rwanda (curriculum 0) adds REB-subject keyword
 * cues (geography/maps, agriculture, economics, ICT/CS, maths, history) on top
 * of the shared rules.
 *
 * Input:  data/textbook-images/manifest.json
 * Output: data/textbook-images/manifest.curated.json
 *
 * Usage:
 *   node scripts/filter-textbook-images.js
 *   node scripts/filter-textbook-images.js --dry-run
 */
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const RAW_PATH = path.join(__dirname, '..', 'data', 'textbook-images', 'manifest.json')
const OUT_PATH = path.join(__dirname, '..', 'data', 'textbook-images', 'manifest.curated.json')

const MIN_DIM = 120
const MIN_AREA = 18_000
const MIN_BYTES = 4_000
const MAX_ASPECT = 8
const KEEP_THRESHOLD = 35
const REB_CAP_PER_BOOK = 70 // top figures kept per REB textbook (matches Cambridge density)

/** Corrupt or unusable extractions — never include in curated manifest. */
const BLOCKED_KEYS = new Set([
  'tb-190-p269-embedded-0', // titration apparatus; mostly black, unreadable
])

const FIGURE_CAPTION = /\bfigure\s+[\d]+(?:\.[\d]+)?\b/i
const TABLE_CAPTION = /\btable\s+[\d]+(?:\.[\d]+)?\b/i
const ADV_DISADV = /\badvantages?\b|\bdisadvantages?\b/i
const DIAGRAM_CUE = /\b(diagram|illustration|graph|chart|sketch|labelled|labeled|shown in)\b/i
const ACTIVITY_CUE = /\b(test yourself|activity|worked example|sample question|exam-style)\b/i
const ACCOUNTING_CUE = /\b(ledger|t-?account|debit|credit|balance c\/d|balance b\/d)\b/i
const COPYRIGHT_ONLY = /\b(isbn|copyright|published by|all rights reserved|cambridge university press)\b/i

const SCIENCE_TOPIC =
  /\b(plant cell|animal cell|cell wall|cell membrane|nucleus|chloroplast|mitochondria|chromosome|dna|rna|photosynthesis|respiration|ecosystem|food chain|food web|chicken|hen|rooster|egg|embryo|dissection|cross.?section|microscope|organism|bacteria|virus|fungus|leaf|root|stem|flower|seed|germination|heart|lung|kidney|liver|brain|skeleton|muscle|neuron|nerve|blood|circulatory|digestive|reproductive|amoeba|paramecium|onion cell|cheek cell|specimen|biology|anatomy|physiology)\b/i

const STEM_DIAGRAM =
  /\b(circuit|resistor|capacitor|magnet|magnetic|waveform|prism|lens|ray|refraction|reflection|force diagram|free.?body|velocity|acceleration|projectile|pendulum|molecule|atom|bond|periodic|reaction|apparatus|beaker|burette|titration)\b/i

// REB-specific subject cues (Rwanda only). Broad on purpose — REB textbooks
// caption most figures, but these rescue labelled diagrams/maps/charts that
// lack an explicit "Figure X.Y" caption on the page.
const REB_GEO_CUE =
  /\b(map|climate|rainfall|temperature|weather|river|lake|mountain|valley|plateau|relief|contour|drainage|latitude|longitude|erosion|vegetation|rock|mineral|soil|settlement|population|continent|ocean|basin|savanna|volcano|tourism)\b/i
const REB_AGRI_CUE =
  /\b(crop|livestock|cattle|poultry|fertili[sz]er|irrigation|harvest|seedling|germinat|pest|manure|farming|cultivation|greenhouse|pasture|breed|planting|nursery bed)\b/i
const REB_STEM2_CUE =
  /\b(demand|supply|equilibrium|elasticity|inflation|revenue|computer|hardware|software|keyboard|monitor|motherboard|network|flowchart|algorithm|pseudocode|database|spreadsheet|binary|programming|graph|angle|triangle|coordinate|geometry|vector|histogram|bar chart|pie chart|cylinder|polygon)\b/i

function scoreImage(img, isReb = false) {
  const reject = (reason) => ({ keep: false, score: 0, reasons: [reason], rejectReason: reason })

  if (BLOCKED_KEYS.has(img.key)) return reject('blocked_key')
  if (img.kind === 'page') return reject('full_page_banned')

  const w = Number(img.width) || 0
  const h = Number(img.height) || 0
  const bytes = Number(img.bytes) || 0
  const text = String(img.pageText || '')

  if (w < MIN_DIM || h < MIN_DIM) return reject('too_small')
  if (w * h < MIN_AREA) return reject('low_area')
  if (bytes > 0 && bytes < MIN_BYTES) return reject('low_bytes')

  const aspect = Math.min(w, h) > 0 ? Math.max(w, h) / Math.min(w, h) : 99
  if (aspect > MAX_ASPECT) return reject('extreme_aspect')

  if (COPYRIGHT_ONLY.test(text) && text.length < 400 && !FIGURE_CAPTION.test(text)) {
    return reject('copyright_page')
  }

  let score = 0
  const reasons = []

  if (FIGURE_CAPTION.test(text)) {
    score += 40
    reasons.push('figure_caption')
  }
  if (TABLE_CAPTION.test(text)) {
    score += 35
    reasons.push('table_caption')
  }
  if (ADV_DISADV.test(text)) {
    score += 25
    reasons.push('adv_disadv')
  }
  if (SCIENCE_TOPIC.test(text)) {
    score += 30
    reasons.push('science_topic')
  }
  if (STEM_DIAGRAM.test(text)) {
    score += 28
    reasons.push('stem_diagram')
  }
  if (DIAGRAM_CUE.test(text)) {
    score += 15
    reasons.push('diagram_cue')
  }
  if (ACTIVITY_CUE.test(text)) {
    score += 12
    reasons.push('activity')
  }
  if (ACCOUNTING_CUE.test(text)) {
    score += 25
    reasons.push('accounting')
  }

  if (isReb) {
    if (REB_GEO_CUE.test(text)) {
      score += 26
      reasons.push('reb_geo')
    }
    if (REB_AGRI_CUE.test(text)) {
      score += 26
      reasons.push('reb_agri')
    }
    if (REB_STEM2_CUE.test(text)) {
      score += 24
      reasons.push('reb_stem')
    }
  }

  if (img.kind === 'embedded' && w >= 200 && h >= 150) {
    score += 10
    reasons.push('embedded_size')
  }

  // Large embedded assets (device photos, labelled diagrams) without relying on page snippet alone
  if (img.kind === 'embedded' && w >= 180 && h >= 180 && w * h >= 80_000) {
    score += 22
    reasons.push('large_embedded')
  }

  // Medium product-style photos (trackerball, remote, etc.)
  if (img.kind === 'embedded' && w >= 120 && h >= 160 && w <= 900 && h <= 900 && w * h >= 35_000) {
    score += 8
    reasons.push('object_photo')
  }

  const keep = score >= KEEP_THRESHOLD
  return {
    keep,
    score,
    reasons: keep ? reasons : [...reasons, 'low_score'],
    rejectReason: keep ? null : 'low_score',
  }
}

function categorize(img, reasons) {
  if (reasons.includes('reb_geo')) return 'map_geo'
  if (reasons.includes('reb_agri')) return 'agriculture'
  if (reasons.includes('reb_stem')) return 'chart_diagram'
  if (reasons.includes('figure_caption') || reasons.includes('diagram_cue') || reasons.includes('stem_diagram')) {
    return 'diagram'
  }
  if (reasons.includes('table_caption') || reasons.includes('accounting')) return 'table'
  if (reasons.includes('adv_disadv') || reasons.includes('object_photo')) return 'device_photo'
  if (reasons.includes('science_topic')) return 'science_diagram'
  if (reasons.includes('large_embedded')) return 'illustration'
  return 'other'
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error('Missing raw manifest:', RAW_PATH)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
  const isCambridge = (img) => img.curriculum === 1 || img.curriculumSlug === 'cambridge'
  const isRwanda = (img) => img.curriculum === 0 || img.curriculumSlug === 'rwanda'
  const cambridge = (raw.images || []).filter(isCambridge)
  const rwanda = (raw.images || []).filter(isRwanda)

  const rejected = { cambridge: {}, rwanda: {} }

  const runSet = (images, isReb, bucket) => {
    const localKept = []
    for (const img of images) {
      const result = scoreImage(img, isReb)
      if (result.keep) {
        localKept.push({
          ...img,
          qualityScore: result.score,
          qualityReasons: result.reasons,
          category: categorize(img, result.reasons),
        })
      } else {
        const key = result.rejectReason || result.reasons[0] || 'unknown'
        rejected[bucket][key] = (rejected[bucket][key] || 0) + 1
      }
    }
    return localKept
  }

  // Keep only the top-scoring figures per textbook so no single book dominates
  // (REB books are figure-dense; the vision matcher only uses a few per quiz).
  const capPerTextbook = (images, cap) => {
    const byBook = new Map()
    for (const img of images) {
      const arr = byBook.get(img.textbookId) || []
      arr.push(img)
      byBook.set(img.textbookId, arr)
    }
    const out = []
    for (const arr of byBook.values()) {
      arr.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      out.push(...arr.slice(0, cap))
    }
    return out
  }

  const camKept = runSet(cambridge, false, 'cambridge')
  const rebKept = capPerTextbook(runSet(rwanda, true, 'rwanda'), REB_CAP_PER_BOOK)
  const kept = [...camKept, ...rebKept]

  const byCategory = (list) =>
    list.reduce((acc, img) => {
      acc[img.category] = (acc[img.category] || 0) + 1
      return acc
    }, {})

  const out = {
    version: 1,
    filtered_at: new Date().toISOString(),
    source: 'manifest.json',
    curriculum: 'cambridge+rwanda',
    rules: {
      full_page_banned: true,
      keep_threshold: KEEP_THRESHOLD,
      min_dim: MIN_DIM,
      min_area: MIN_AREA,
    },
    stats: {
      raw_cambridge: cambridge.length,
      raw_rwanda: rwanda.length,
      kept: kept.length,
      kept_cambridge: camKept.length,
      kept_rwanda: rebKept.length,
      rejected_cambridge: cambridge.length - camKept.length,
      rejected_rwanda: rwanda.length - rebKept.length,
      reject_reasons_cambridge: rejected.cambridge,
      reject_reasons_rwanda: rejected.rwanda,
      by_category_cambridge: byCategory(camKept),
      by_category_rwanda: byCategory(rebKept),
    },
    images: kept,
    total: kept.length,
  }

  console.log('=== Textbook image filter (Cambridge + Rwanda) ===')
  console.log(`Cambridge: kept ${camKept.length}/${cambridge.length}` + (cambridge.length ? ` (${((camKept.length / cambridge.length) * 100).toFixed(1)}%)` : ''))
  console.log(`Rwanda:    kept ${rebKept.length}/${rwanda.length}` + (rwanda.length ? ` (${((rebKept.length / rwanda.length) * 100).toFixed(1)}%)` : ''))
  console.log('Rwanda reject reasons:', rejected.rwanda)
  console.log('Rwanda categories:', out.stats.by_category_rwanda)

  if (!DRY_RUN) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8')
    console.log(`\nWrote ${OUT_PATH}`)
  } else {
    console.log('\n(dry run — no file written)')
  }
}

main()
