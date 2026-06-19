/**
 * Download real diagram images from Aloc API (Cloudinary URLs) for past-paper questions.
 * These are the original figures from the question bank — not AI-generated.
 *
 * Output:
 *   public/exam-images/{exam}/{slug}/{year}/{alocId}.{ext}
 *   data/exam-sources/images/manifest.json
 *
 * Usage:
 *   node scripts/extract-exam-images.js
 *   node scripts/extract-exam-images.js --dry-run
 *   node scripts/extract-exam-images.js --subject=physics --year=2020
 */
const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')

const DRY_RUN = process.argv.includes('--dry-run')
const SUBJECT_FILTER = (process.argv.find((a) => a.startsWith('--subject=')) || '').split('=')[1]?.toLowerCase()
const YEAR_FILTER = Number((process.argv.find((a) => a.startsWith('--year=')) || '').split('=')[1])

const PUBLIC_ROOT = path.join(__dirname, '..', 'public', 'exam-images')
const MANIFEST_DIR = path.join(__dirname, '..', 'data', 'exam-sources', 'images')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')

const ALOC_WAEC_SUBJECTS = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  mathematics: 'Mathematics',
  english: 'English Language',
  government: 'Government',
  economics: 'Economics',
  geography: 'Geography',
  commerce: 'Commerce',
  accounting: 'Financial Accounting',
  crk: 'Christian Religious Studies',
  englishlit: 'Literature in English',
}

const ALOC_JAMB_SUBJECTS = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  mathematics: 'Mathematics',
  english: 'Use of English',
  government: 'Government',
  economics: 'Economics',
  geography: 'Geography',
  commerce: 'Commerce',
  accounting: 'Principles of Accounts',
  crk: 'Christian Religious Studies',
  englishlit: 'Literature in English',
}

const ALOC_YEARS = [2015, 2016, 2017, 2018, 2019, 2020]
const FETCH_TIMEOUT_MS = 90000
const IMAGE_TIMEOUT_MS = 60000

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return { alocToken: get('ALOC_ACCESS_TOKEN') }
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extFromUrl(url) {
  const m = String(url).match(/\.(png|jpe?g|gif|webp)(?:\?|$)/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png'
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchAlocBatch(token, subject, type, year, retries = 3) {
  const url = `https://questions.aloc.com.ng/api/v2/m?subject=${subject}&type=${type}&year=${year}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json', AccessToken: token },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return []
      const data = body.data || body.questions || (Array.isArray(body) ? body : [])
      return Array.isArray(data) ? data : []
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'timeout' : err.message
      if (attempt === retries) {
        console.log(`    API FAIL ${subject} ${type} ${year}: ${msg}`)
        return []
      }
      console.log(`    RETRY ${subject} ${type} ${year} (${attempt}/${retries}): ${msg}`)
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  return []
}

async function downloadImage(url, destPath) {
  const res = await fetchWithTimeout(url, {}, IMAGE_TIMEOUT_MS)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 200) throw new Error('image too small')
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.writeFileSync(destPath, buf)
  return buf.length
}

function saveManifest(manifest) {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })
  manifest.extracted_at = new Date().toISOString()
  manifest.total = manifest.images.length
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
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

async function processBatch({ token, exam, slug, label, year, type, diet, manifest, stats }) {
  if (SUBJECT_FILTER && slug !== SUBJECT_FILTER) return
  if (Number.isFinite(YEAR_FILTER) && year !== YEAR_FILTER) return

  const questions = await fetchAlocBatch(token, slug, type, year)
  const withImages = questions.filter((q) => String(q.image || '').trim().startsWith('http'))
  if (!withImages.length) return

  console.log(`  ${exam.toUpperCase()} ${label} ${year}: ${withImages.length}/${questions.length} with images`)

  for (const q of withImages) {
    const alocId = Number(q.id)
    const imageUrl = String(q.image).trim()
    const ext = extFromUrl(imageUrl)
    const relDir = path.join(exam, slug, String(year))
    const filename = `${alocId}.${ext}`
    const diskPath = path.join(PUBLIC_ROOT, relDir, filename)
    const localPath = `/exam-images/${relDir.replace(/\\/g, '/')}/${filename}`
    const question = String(q.question || q.question_text || '').trim()
    const key = `aloc-${alocId}`

    const existing = manifest.images.find((e) => e.key === key)
    if (existing && fs.existsSync(path.join(__dirname, '..', 'public', existing.localPath.replace(/^\//, '')))) {
      stats.skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`    [DRY] ${key} → ${localPath}`)
      stats.dry++
      continue
    }

    try {
      const bytes = await downloadImage(imageUrl, diskPath)
      const entry = {
        key,
        alocId,
        exam,
        subject: label,
        subjectSlug: slug,
        year,
        diet,
        question,
        questionNorm: normalizeText(question),
        questionHash: createHash('sha1').update(normalizeText(question)).digest('hex').slice(0, 12),
        imageUrl,
        localPath,
        bytes,
        source: 'aloc',
      }
      const idx = manifest.images.findIndex((e) => e.key === key)
      if (idx >= 0) manifest.images[idx] = entry
      else manifest.images.push(entry)
      stats.downloaded++
      console.log(`    OK ${key} (${bytes} bytes)`)
      saveManifest(manifest)
    } catch (err) {
      stats.failed++
      console.log(`    FAIL ${key}: ${err.message}`)
    }
  }
}

async function main() {
  const { alocToken } = readEnv()
  if (!alocToken) {
    console.error('Missing ALOC_ACCESS_TOKEN in .env')
    process.exit(1)
  }

  const manifest = readManifest()
  const stats = { downloaded: 0, skipped: 0, failed: 0, dry: 0 }

  console.log('=== Extracting real diagram images from Aloc API ===')
  if (DRY_RUN) console.log('(dry run — no files written)\n')

  let batchNum = 0
  const totalBatches = ALOC_YEARS.length * (Object.keys(ALOC_JAMB_SUBJECTS).length + Object.keys(ALOC_WAEC_SUBJECTS).length)

  for (const year of ALOC_YEARS) {
    for (const [slug, label] of Object.entries(ALOC_JAMB_SUBJECTS)) {
      batchNum++
      process.stdout.write(`[${batchNum}/${totalBatches}] JAMB ${label} ${year}... `)
      await processBatch({
        token: alocToken,
        exam: 'jamb',
        slug,
        label,
        year,
        type: 'utme',
        diet: 'utme',
        manifest,
        stats,
      })
      console.log('done')
      await new Promise((r) => setTimeout(r, 400))
    }
    for (const [slug, label] of Object.entries(ALOC_WAEC_SUBJECTS)) {
      batchNum++
      process.stdout.write(`[${batchNum}/${totalBatches}] WAEC ${label} ${year}... `)
      await processBatch({
        token: alocToken,
        exam: 'waec',
        slug,
        label,
        year,
        type: 'wassce',
        diet: 'may-june',
        manifest,
        stats,
      })
      console.log('done')
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  if (!DRY_RUN && manifest.images.length) saveManifest(manifest)

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}:`)
  if (DRY_RUN) console.log(`  would download: ${stats.dry}`)
  else console.log(`  downloaded: ${stats.downloaded}`)
  console.log(`  skipped (already on disk): ${stats.skipped}`)
  console.log(`  failed: ${stats.failed}`)
  if (!DRY_RUN) console.log(`  manifest: ${manifest.images.length} images → ${MANIFEST_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
