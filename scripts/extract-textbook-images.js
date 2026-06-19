/**
 * Extract real figures from school textbook PDFs (REB, Cambridge, NERDC).
 * Separate from exam-paper images — uses local PDFs, not Aloc.
 *
 * Output:
 *   public/textbook-images/{curriculum}/{textbookId}/page{n}-{kind}-{i}.{ext}
 *   data/textbook-images/manifest.json
 *
 * Usage:
 *   node scripts/extract-textbook-images.js
 *   node scripts/extract-textbook-images.js --dry-run
 *   node scripts/extract-textbook-images.js --id=208
 *   node scripts/extract-textbook-images.js --curriculum=1
 *
 * Optional .env:
 *   TEXTBOOK_PDF_ROOTS=path1;path2
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')
const { findTextbookPdf, curriculumSlug, readRootsFromEnv } = require('./textbook-pdf-locate')

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_ID = Number((process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1])
const CURRICULUM_FILTER = (process.argv.find((a) => a.startsWith('--curriculum=')) || '').split('=')[1]
const MAX_PAGES = Number((process.argv.find((a) => a.startsWith('--max-pages=')) || '').split('=')[1]) || 0

const PUBLIC_ROOT = path.join(__dirname, '..', 'public', 'textbook-images')
const MANIFEST_DIR = path.join(__dirname, '..', 'data', 'textbook-images')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')
const PY = process.env.PYTHON || 'python'

const SCHOOL_CURRICULA = [0, 1, 2]

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { version: 1, images: [] }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    return { version: 1, images: Array.isArray(raw?.images) ? raw.images : [] }
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
  const raw = execFileSync(PY, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const result = JSON.parse(raw)
  if (result.error) throw new Error(result.error)
  return result
}

async function main() {
  const { url, key } = readEnv()
  const sb = createClient(url, key)
  const manifest = readManifest()
  const stats = { books: 0, images: 0, skipped: 0, noPdf: 0, failed: 0 }

  let q = sb
    .from('textbooks')
    .select('textbook_id,textbook_name,filename,curriculum')
    .in('curriculum', SCHOOL_CURRICULA)
    .order('textbook_id')

  if (Number.isFinite(ONLY_ID)) q = q.eq('textbook_id', ONLY_ID)
  if (CURRICULUM_FILTER !== undefined && CURRICULUM_FILTER !== '') {
    q = q.eq('curriculum', Number(CURRICULUM_FILTER))
  }

  const { data: textbooks, error } = await q
  if (error) throw error

  const roots = readRootsFromEnv()
  console.log('=== Extracting textbook images (REB / Cambridge / NERDC) ===')
  console.log(`PDF search roots: ${roots.length}`)
  if (DRY_RUN) console.log('(dry run)\n')

  for (const tb of textbooks || []) {
    const slug = curriculumSlug(Number(tb.curriculum))
    const pdf = findTextbookPdf(tb.filename, tb.textbook_name, roots)
    if (!pdf) {
      console.log(`SKIP no PDF: [${tb.textbook_id}] ${tb.textbook_name}`)
      stats.noPdf++
      continue
    }

    const existing = manifest.images.filter((i) => i.textbookId === tb.textbook_id)
    if (existing.length > 0 && !Number.isFinite(ONLY_ID)) {
      console.log(`SKIP cached: [${tb.textbook_id}] ${existing.length} image(s)`)
      stats.skipped++
      continue
    }

    console.log(`\n[${tb.textbook_id}] ${tb.textbook_name}`)
    console.log(`  PDF: ${pdf}`)

    if (DRY_RUN) {
      stats.books++
      continue
    }

    try {
      const outDir = path.join(PUBLIC_ROOT, slug, String(tb.textbook_id))
      const result = extractPdfImages(pdf, MAX_PAGES, outDir)
      console.log(`  scanned ${result.pages_scanned}/${result.page_count} pages → ${result.images.length} image(s)`)

      fs.mkdirSync(outDir, { recursive: true })

      manifest.images = manifest.images.filter((i) => i.textbookId !== tb.textbook_id)

      for (const img of result.images) {
        const fname = img.filename || `page${img.page}-${img.kind}-${img.imageIndex}.${img.ext || 'png'}`
        const localPath = `/textbook-images/${slug}/${tb.textbook_id}/${fname}`

        const key = `tb-${tb.textbook_id}-p${img.page}-${img.kind}-${img.imageIndex}`
        manifest.images.push({
          key,
          textbookId: tb.textbook_id,
          curriculum: Number(tb.curriculum),
          curriculumSlug: slug,
          textbookName: tb.textbook_name,
          page: img.page,
          imageIndex: img.imageIndex,
          kind: img.kind,
          width: img.width,
          height: img.height,
          pageText: img.pageText || '',
          localPath,
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
  console.log(`  skipped (cached): ${stats.skipped}`)
  console.log(`  no PDF found: ${stats.noPdf}`)
  console.log(`  failed: ${stats.failed}`)
  if (!DRY_RUN) console.log(`  manifest: ${manifest.images.length} total → ${MANIFEST_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
