/**
 * Delete Cambridge textbook image files not in manifest.curated.json.
 *
 * Usage:
 *   node scripts/prune-textbook-images.js --dry-run
 *   node scripts/prune-textbook-images.js
 */
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const RAW_PATH = path.join(ROOT, 'data', 'textbook-images', 'manifest.json')
const CURATED_PATH = path.join(ROOT, 'data', 'textbook-images', 'manifest.curated.json')

function diskPath(localPath) {
  return path.join(PUBLIC, String(localPath).replace(/^\//, '').replace(/\//g, path.sep))
}

function main() {
  if (!fs.existsSync(CURATED_PATH)) {
    console.error('Missing curated manifest. Run: npm run filter:textbook-images')
    process.exit(1)
  }
  if (!fs.existsSync(RAW_PATH)) {
    console.error('Missing raw manifest:', RAW_PATH)
    process.exit(1)
  }

  const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'))
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))

  const keptPaths = new Set((curated.images || []).map((i) => i.localPath))
  const keptKeys = new Set((curated.images || []).map((i) => i.key))

  let deleted = 0
  let missing = 0
  let skipped = 0

  const cambridgeRaw = (raw.images || []).filter(
    (i) => i.curriculum === 1 || i.curriculumSlug === 'cambridge',
  )

  console.log(`=== Prune rejected Cambridge images${DRY_RUN ? ' (dry run)' : ''} ===`)
  console.log(`Raw Cambridge entries: ${cambridgeRaw.length}`)
  console.log(`Curated (keep): ${keptPaths.size}`)

  for (const img of cambridgeRaw) {
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

  // Orphan files on disk not listed in curated manifest
  const cambridgeDir = path.join(PUBLIC, 'textbook-images', 'cambridge')
  let orphans = 0
  if (fs.existsSync(cambridgeDir)) {
    for (const tbDir of fs.readdirSync(cambridgeDir, { withFileTypes: true })) {
      if (!tbDir.isDirectory()) continue
      const dir = path.join(cambridgeDir, tbDir.name)
      for (const file of fs.readdirSync(dir)) {
        if (file === '.gitkeep') continue
        const localPath = `/textbook-images/cambridge/${tbDir.name}/${file}`
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
    const nonCambridge = (raw.images || []).filter(
      (i) => i.curriculum !== 1 && i.curriculumSlug !== 'cambridge',
    )
    raw.images = [...nonCambridge, ...(curated.images || [])]
    raw.pruned_at = new Date().toISOString()
    raw.total = raw.images.length
    raw.cambridge_curated = true
    fs.writeFileSync(RAW_PATH, JSON.stringify(raw, null, 2), 'utf8')

    // Remove empty textbook folders
    if (fs.existsSync(cambridgeDir)) {
      for (const tbDir of fs.readdirSync(cambridgeDir, { withFileTypes: true })) {
        if (!tbDir.isDirectory()) continue
        const dir = path.join(cambridgeDir, tbDir.name)
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
    console.log(`Updated ${RAW_PATH} → ${raw.images.length} entries (curated Cambridge only)`)
  }
}

main()
