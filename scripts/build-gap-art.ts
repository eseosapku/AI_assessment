/**
 * Build the Gap Map picture map from the owner's approvals.
 *
 * Reads topics.json, progress.jsonl and verdicts.jsonl in .superpowers/gap-art/,
 * keeps the drawings whose last verdict is "keep" on their newest version, and
 * checks each with the same sanitiser the drawing run uses. Writes
 * lib/studylab/gap-art-map.json (topic id -> "<id>.v<N>") and the SVG files to
 * .superpowers/gap-art/publish/gap-art/ for upload to the figure host.
 * --dev also copies them to public/gap-art/ (git-ignored) for local viewing.
 *
 *   JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/build-gap-art.ts [--dev]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { keptPictures } from '../lib/studylab/gap-art'

const require = createRequire(import.meta.url)
const ART = path.join(process.cwd(), '.superpowers', 'gap-art')
const { sanitise, readLines } = require(path.join(ART, 'shared.js')) as {
  sanitise: (t: string) => { ok: boolean; svg?: string; why?: string }
  readLines: (f: string) => any[]
}

const DEV = process.argv.includes('--dev')
const topics = JSON.parse(fs.readFileSync(path.join(ART, 'topics.json'), 'utf8')) as { id: string; topicIds: number[] }[]
const progress = readLines(path.join(ART, 'progress.jsonl')).filter((p) => p.file)
const verdicts = readLines(path.join(ART, 'verdicts.jsonl')).filter((v) => v.verdict)

const kept = keptPictures(topics, progress, verdicts)
const names = [...new Set(Object.values(kept))].sort()

const outDir = path.join(ART, 'publish', 'gap-art')
const devDir = path.join(process.cwd(), 'public', 'gap-art')
fs.mkdirSync(outDir, { recursive: true })
if (DEV) fs.mkdirSync(devDir, { recursive: true })

const rejected: string[] = []
const good = new Set<string>()
let bytes = 0
for (const name of names) {
  const file = path.join(ART, 'svg', `${name}.svg`)
  const clean = fs.existsSync(file) ? sanitise(fs.readFileSync(file, 'utf8')) : { ok: false, why: 'file missing' }
  if (!clean.ok || !clean.svg) { rejected.push(`${name} (${clean.why})`); continue }
  fs.writeFileSync(path.join(outDir, `${name}.svg`), clean.svg)
  if (DEV) fs.writeFileSync(path.join(devDir, `${name}.svg`), clean.svg)
  bytes += Buffer.byteLength(clean.svg)
  good.add(name)
}

const map: Record<string, string> = {}
for (const key of Object.keys(kept).sort((a, b) => Number(a) - Number(b))) {
  if (good.has(kept[key])) map[key] = kept[key]
}
const mapPath = path.join(process.cwd(), 'lib', 'studylab', 'gap-art-map.json')
fs.writeFileSync(mapPath, JSON.stringify(map, null, 0) + '\n')

const allChapters = new Set(topics.flatMap((t) => t.topicIds))
console.log(`pictures kept: ${good.size} | total bytes: ${bytes}`)
console.log(`chapters with a picture: ${Object.keys(map).length} of ${allChapters.size} in topics.json (the app has 3,531)`)
console.log(`map size: ${fs.statSync(mapPath).size} bytes`)
if (rejected.length) console.log(`left out by the sanitiser:\n  ${rejected.join('\n  ')}`)
