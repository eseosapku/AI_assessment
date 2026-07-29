/**
 * Delete Rwanda (REB) textbook image files not in manifest.curated.json,
 * then rewrite manifest.json so its Rwanda entries equal the curated set.
 * Cambridge entries are left untouched.
 *
 * Usage:
 *   node scripts/prune-rwanda-textbook-images.js --dry-run
 *   node scripts/prune-rwanda-textbook-images.js
 */
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const RAW_PATH = path.join(ROOT, 'data', 'textbook-images', 'manifest.json')
const CURATED_PATH = path.join(ROOT, 'data', 'textbook-images', 'manifest.curated.json')

const isRwanda = (i) => i.curriculum === 0 || i.curriculumSlug === 'rwanda'

function diskPath(localPath) {
  return path.join(PUBLIC, String(localPath).replace(/^\//, '').replace(/\//g, path.sep))
}

function main() {
  if (!fs.existsSync(CURATED_PATH)) {
    console.error('Missing curated manifest. Run: node scripts/filter-textbook-images.js')
    process.exit(1)
  }
  if (!fs.existsSync(RAW_PATH)) {
    console.error('Missing raw manifest:', RAW_PATH)
    process.exit(1)
  }

  const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'))
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))

  const keptRwanda = (curated.images || []).filter(isRwanda)
  const keptPaths = new Set(keptRwanda.map((i) => i.localPath))
  const keptKeys = new Set(keptRwanda.map((i) => i.key))

  let deleted = 0
  let missing = 0
  let skipped = 0

  const rwandaRaw = (raw.images || []).filter(isRwanda)

  console.log(`=== Prune rejected Rwanda images${DRY_RUN ? ' (dry run)' : ''} ===`)
  console.log(`Raw Rwanda entries: ${rwandaRaw.length}`)
  console.log(`Curated (keep): ${keptPaths.size}`)

  for (const img of rwandaRaw) {
    if (keptKeys.has(img.key)) {
      skipped++
      continue
    }
    const fp = diskPath(img.localPath)
    if (!fs.existsSync(fp)) {
      missing++
      continue
    }
    if (DRY_RUN) {
      console.log(`  [DRY] delete ${img.localPath}`)
    } else {
      fs.unlinkSync(fp)
    }
    deleted++
  }

  // Orphan files on disk not listed in the curated manifest
  const rwandaDir = path.join(PUBLIC, 'textbook-images', 'rwanda')
  let orphans = 0
  if (fs.existsSync(rwandaDir)) {
    for (const tbDir of fs.readdirSync(rwandaDir, { withFileTypes: true })) {
      if (!tbDir.isDirectory()) continue
      const dir = path.join(rwandaDir, tbDir.name)
      for (const file of fs.readdirSync(dir)) {
        if (file === '.gitkeep') continue
        const localPath = `/textbook-images/rwanda/${tbDir.name}/${file}`
        if (keptPaths.has(localPath)) continue
        const fp = path.join(dir, file)
        if (DRY_RUN) {
          console.log(`  [DRY] orphan ${localPath}`)
        } else {
          fs.unlinkSync(fp)
        }
        orphans++
        deleted++
      }
    }
  }

  if (!DRY_RUN) {
    const nonRwanda = (raw.images || []).filter((i) => !isRwanda(i))
    raw.images = [...nonRwanda, ...keptRwanda]
    raw.pruned_at = new Date().toISOString()
    raw.total = raw.images.length
    raw.rwanda_curated = true
    fs.writeFileSync(RAW_PATH, JSON.stringify(raw, null, 2), 'utf8')

    // Remove empty textbook folders
    if (fs.existsSync(rwandaDir)) {
      for (const tbDir of fs.readdirSync(rwandaDir, { withFileTypes: true })) {
        if (!tbDir.isDirectory()) continue
        const dir = path.join(rwandaDir, tbDir.name)
        const files = fs.readdirSync(dir).filter((f) => f !== '.gitkeep')
        if (files.length === 0) fs.rmdirSync(dir)
      }
    }
  }

  console.log(`\nDeleted files: ${deleted}${DRY_RUN ? ' (dry)' : ''}`)
  console.log(`  from manifest rejects: ${deleted - orphans}`)
  console.log(`  orphans on disk: ${orphans}`)
  console.log(`  already missing: ${missing}`)
  console.log(`  kept (skipped): ${skipped}`)
  if (!DRY_RUN) {
    console.log(`Updated ${RAW_PATH} → ${raw.images.length} entries`)
  }
}

main()
