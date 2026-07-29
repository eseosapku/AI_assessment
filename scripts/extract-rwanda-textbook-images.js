/**
 * Extract real figures from Rwandan (REB) school textbook PDFs.
 *
 * Mirrors scripts/extract-textbook-images.js but:
 *   - reads the textbook list from RDS/Postgres (the runtime source of truth),
 *     NOT the legacy Supabase table — so manifest keys match the ids the app
 *     uses at generation time.
 *   - locates PDFs in the REB textbook download folder.
 *   - skips language subjects (Kinyarwanda, Kiswahili, French, English,
 *     Literature) which have no exam-figure value.
 *   - only extracts EMBEDDED raster images (same as the Cambridge run); full
 *     page renders are banned by the curator anyway.
 *
 * Output:
 *   public/textbook-images/rwanda/{textbookId}/page{n}-embedded-{i}.{ext}
 *   data/textbook-images/manifest.json   (Rwanda entries appended)
 *
 * Usage:
 *   node scripts/extract-rwanda-textbook-images.js --dry-run
 *   node scripts/extract-rwanda-textbook-images.js
 *   node scripts/extract-rwanda-textbook-images.js --id=180
 *   node scripts/extract-rwanda-textbook-images.js --limit=5
 *   node scripts/extract-rwanda-textbook-images.js --root="C:/path/to/textbooks"
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { Pool } = require('pg')
const { findTextbookPdf } = require('./textbook-pdf-locate')

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_ID = Number((process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1])
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 0
const ROOT_ARG = (process.argv.find((a) => a.startsWith('--root=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '')
const MAX_PAGES = Number((process.argv.find((a) => a.startsWith('--max-pages=')) || '').split('=')[1]) || 0

const CURRICULUM = 0 // REB / Rwanda
const SLUG = 'rwanda'
const DEFAULT_ROOT = 'C:/Users/Stephen/Downloads/textbooks-20260724T111107Z-1-004/textbooks/textbooks'
const PDF_ROOT = ROOT_ARG || DEFAULT_ROOT

const PUBLIC_ROOT = path.join(__dirname, '..', 'public', 'textbook-images')
const MANIFEST_DIR = path.join(__dirname, '..', 'data', 'textbook-images')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')
const PY = process.env.PYTHON || 'python'

// REB books embed hundreds of tiny/repeated decorative images per book. Extract
// selectively: drop small images, dedup repeated logos/headers by content hash,
// and cap per page. The curator + per-book cap trims further.
process.env.EXTRACT_MIN_PX = process.env.EXTRACT_MIN_PX || '140'
process.env.EXTRACT_MIN_BYTES = process.env.EXTRACT_MIN_BYTES || '6000'
process.env.EXTRACT_MAX_PER_PAGE = process.env.EXTRACT_MAX_PER_PAGE || '8'
process.env.EXTRACT_DEDUP = process.env.EXTRACT_DEDUP || '1'

// Language / language-arts subjects — excluded per product decision.
const LANGUAGE_WORDS = ['kinyarwanda', 'ikinyarwanda', 'kiswahili', 'swahili', 'french', 'francais', 'english', 'literature']
function isLanguageBook(name, filename) {
  const norm = `${name || ''} ${filename || ''}`.toLowerCase().replace(/[^a-z]+/g, ' ')
  return LANGUAGE_WORDS.some((w) => new RegExp('(^| )' + w + '( |$)').test(norm))
}

function readEnv(key) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  return (env.match(new RegExp('^' + key + '=(.*)$', 'm')) || [])[1]?.trim()
}

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

function extractPdfImages(pdfPath, maxPages, outDir) {
  const args = [path.join(__dirname, 'extract_pdf_images.py'), pdfPath, String(maxPages > 0 ? maxPages : 0)]
  if (outDir) args.push(outDir)
  const raw = execFileSync(PY, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const result = JSON.parse(raw)
  if (result.error) throw new Error(result.error)
  return result
}

async function main() {
  const pool = new Pool({ connectionString: readEnv('DATABASE_URL'), ssl: { rejectUnauthorized: false } })
  const manifest = readManifest()
  const stats = { books: 0, images: 0, cached: 0, language: 0, noPdf: 0, failed: 0 }

  let sql = 'SELECT textbook_id, textbook_name, filename FROM textbooks WHERE curriculum = $1'
  const params = [CURRICULUM]
  if (Number.isFinite(ONLY_ID)) {
    sql += ' AND textbook_id = $2'
    params.push(ONLY_ID)
  }
  sql += ' ORDER BY textbook_id'
  const { rows: textbooks } = await pool.query(sql, params)
  await pool.end()

  console.log('=== Extracting REB (Rwanda) textbook images ===')
  console.log(`PDF root: ${PDF_ROOT}`)
  console.log(`Textbooks (curriculum ${CURRICULUM}): ${textbooks.length}`)
  if (DRY_RUN) console.log('(dry run)\n')

  let processed = 0
  for (const tb of textbooks) {
    if (LIMIT && processed >= LIMIT) break

    if (isLanguageBook(tb.textbook_name, tb.filename)) {
      console.log(`SKIP language: [${tb.textbook_id}] ${tb.textbook_name}`)
      stats.language++
      continue
    }

    const existing = manifest.images.filter((i) => i.textbookId === tb.textbook_id)
    if (existing.length > 0 && !Number.isFinite(ONLY_ID)) {
      console.log(`SKIP cached: [${tb.textbook_id}] ${existing.length} image(s)`)
      stats.cached++
      continue
    }

    const pdf = findTextbookPdf(tb.filename, tb.textbook_name, [PDF_ROOT])
    if (!pdf) {
      console.log(`SKIP no PDF: [${tb.textbook_id}] ${tb.textbook_name}`)
      stats.noPdf++
      continue
    }

    console.log(`\n[${tb.textbook_id}] ${tb.textbook_name}`)
    console.log(`  PDF: ${pdf}`)
    processed++

    if (DRY_RUN) {
      stats.books++
      continue
    }

    try {
      const outDir = path.join(PUBLIC_ROOT, SLUG, String(tb.textbook_id))
      const result = extractPdfImages(pdf, MAX_PAGES, outDir)
      console.log(`  scanned ${result.pages_scanned}/${result.page_count} pages → ${result.images.length} image(s)`)

      fs.mkdirSync(outDir, { recursive: true })
      manifest.images = manifest.images.filter((i) => i.textbookId !== tb.textbook_id)

      for (const img of result.images) {
        const fname = img.filename || `page${img.page}-${img.kind}-${img.imageIndex}.${img.ext || 'png'}`
        manifest.images.push({
          key: `tb-${tb.textbook_id}-p${img.page}-${img.kind}-${img.imageIndex}`,
          textbookId: tb.textbook_id,
          curriculum: CURRICULUM,
          curriculumSlug: SLUG,
          textbookName: tb.textbook_name,
          page: img.page,
          imageIndex: img.imageIndex,
          kind: img.kind,
          width: img.width,
          height: img.height,
          pageText: img.pageText || '',
          localPath: `/textbook-images/${SLUG}/${tb.textbook_id}/${fname}`,
          bytes: img.bytes,
          source: 'pdf',
        })
        stats.images++
      }

      saveManifest(manifest)
      stats.books++
    } catch (err) {
      stats.failed++
      console.log(`  FAIL: ${err.message}`)
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}:`)
  console.log(`  textbooks processed: ${stats.books}`)
  console.log(`  images saved: ${stats.images}`)
  console.log(`  skipped language: ${stats.language}`)
  console.log(`  skipped cached: ${stats.cached}`)
  console.log(`  no PDF found: ${stats.noPdf}`)
  console.log(`  failed: ${stats.failed}`)
  if (!DRY_RUN) console.log(`  manifest: ${manifest.images.length} total → ${MANIFEST_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
