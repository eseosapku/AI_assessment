/**
 * Vision curation pass for textbook figures (Cambridge + Rwanda).
 *
 * Calls the same Bedrock model the app uses (amazon.nova-lite-v1:0) to LOOK at
 * every curated figure and return: a keep/drop verdict, a type, search
 * keywords, and a description. This makes image→question matching content-based
 * instead of page-text based, and flags decorative photos for removal.
 *
 * Output (resumable): data/textbook-images/vision-descriptions.json
 * Also seeds the runtime cache:  data/textbook-images/vision-cache.json
 *
 * Usage:
 *   node scripts/vision-curate-textbook-images.js --limit=20        # sample
 *   node scripts/vision-curate-textbook-images.js --curriculum=0    # REB only
 *   node scripts/vision-curate-textbook-images.js                   # both
 *   node scripts/vision-curate-textbook-images.js --concurrency=6
 */
const fs = require('fs')
const path = require('path')
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime')

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d }
const LIMIT = Number(arg('limit', 0)) || 0
const CURR = arg('curriculum', '')
const CONCURRENCY = Number(arg('concurrency', 5)) || 5

const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'data', 'textbook-images')
const CURATED = path.join(DATA, 'manifest.curated.json')
/**
 * Which manifest to read, and which slice of it.
 *
 * The curated manifest is a snapshot and the past-paper figures were
 * re-cropped after it was taken, so `--manifest=main --only=pastpaper`
 * points this at the live one. It matters: all 8,663 past-paper figures
 * carry NO description, and a figure with no description cannot have a
 * question written against it -- the writer never sees the image. Until
 * they are described they are unusable, which is why three of the diagrams
 * in the last round were captioned with questions about a different picture.
 */
const MANIFEST_PATH = arg('manifest', '') === 'main'
  ? path.join(DATA, 'manifest.json')
  : CURATED
const ONLY_SOURCE = arg('only', '')
const DESC_PATH = path.join(DATA, 'vision-descriptions.json')
const CACHE_PATH = path.join(DATA, 'vision-cache.json')

const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const REGION = g('AWS_REGION') || 'eu-west-1'
process.env.AWS_ACCESS_KEY_ID = g('AWS_ACCESS_KEY_ID')
process.env.AWS_SECRET_ACCESS_KEY = g('AWS_SECRET_ACCESS_KEY')
const PREFIX = REGION.startsWith('eu-') ? 'eu.' : REGION.startsWith('ap-') ? 'ap.' : REGION.startsWith('us-') ? 'us.' : ''
const MODEL = PREFIX + 'amazon.nova-lite-v1:0'
const client = new BedrockRuntimeClient({ region: REGION })

const PROMPT = `You are curating a school textbook figure for an exam-question image bank.
Reply in EXACTLY this format and nothing else:
VERDICT: keep OR drop
TYPE: diagram | graph | chart | map | table | apparatus | labelled-photo | specimen-photo | decorative | text
KEYWORDS: 3-8 comma-separated search terms naming the actual subject content shown
DESCRIPTION: 2-3 sentences: what it shows, key labels/axes/values, and how it could be tested.

Mark VERDICT drop ONLY if the image is purely decorative or non-educational: a plain photo or clip-art with no labels/data, a logo, a border, a person/scene with no scientific content, or a block of body text a question could not be built from. When unsure, keep.`

function loadJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseReply(text) {
  const get = (label) => (text.match(new RegExp(label + ':\\s*(.+)', 'i')) || [])[1]?.trim() || ''
  const verdict = /drop/i.test(get('VERDICT')) ? 'drop' : 'keep'
  const type = get('TYPE').toLowerCase().split(/[\s|,]/)[0] || 'other'
  const keywords = get('KEYWORDS')
  // description may span to end; grab everything after DESCRIPTION:
  const dm = text.match(/DESCRIPTION:\s*([\s\S]+)/i)
  const description = (dm ? dm[1] : text).replace(/\s+/g, ' ').trim().slice(0, 600)
  return { verdict, type, keywords, description }
}

async function describeOne(img) {
  const disk = path.join(ROOT, 'public', img.localPath.replace(/^\//, '').split('/').join(path.sep))
  const buf = fs.readFileSync(disk)
  const format = path.extname(disk).slice(1).toLowerCase().replace('jpg', 'jpeg')
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ image: { format, source: { bytes: buf.toString('base64') } } }, { text: PROMPT }] }],
    inferenceConfig: { maxTokens: 260, temperature: 0.1 },
  })
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body }))
      const payload = JSON.parse(Buffer.from(res.body).toString())
      const text = payload?.output?.message?.content?.[0]?.text ?? ''
      if (!text) throw new Error('empty')
      return parseReply(text)
    } catch (e) {
      lastErr = e
      const throttled = /throttl|too many|rate|timeout|503|500/i.test(String(e.name) + String(e.message))
      if (!throttled && attempt >= 1) break
      await sleep(800 * Math.pow(2, attempt) + Math.random() * 400)
    }
  }
  throw lastErr
}

async function main() {
  const manifest = loadJson(MANIFEST_PATH, { images: [] })
  let images = manifest.images || manifest
  if (CURR !== '') images = images.filter((i) => String(i.curriculum) === CURR)
  if (ONLY_SOURCE) images = images.filter((i) => String(i.source ?? '') === ONLY_SOURCE)
  const desc = loadJson(DESC_PATH, {})
  const cache = loadJson(CACHE_PATH, {})

  let todo = images.filter((i) => !desc[i.key])
  if (LIMIT) todo = todo.slice(0, LIMIT)

  console.log(`=== Vision curation ===`)
  console.log(`Model: ${MODEL} | concurrency ${CONCURRENCY}`)
  console.log(`Total curated: ${images.length} | already done: ${images.length - images.filter((i) => !desc[i.key]).length} | to do: ${todo.length}`)

  let done = 0, dropped = 0, failed = 0, sinceSave = 0
  const save = () => {
    fs.writeFileSync(DESC_PATH, JSON.stringify(desc))
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
  }

  let idx = 0
  async function worker() {
    while (idx < todo.length) {
      const img = todo[idx++]
      try {
        const r = await describeOne(img)
        desc[img.key] = r
        cache[img.key] = { description: r.description, cached_at: new Date().toISOString() }
        if (r.verdict === 'drop') dropped++
      } catch (e) {
        failed++
        desc[img.key] = { verdict: 'keep', type: 'other', keywords: '', description: (img.pageText || '').slice(0, 300), error: String(e.message).slice(0, 60) }
      }
      done++; sinceSave++
      if (sinceSave >= 50) { save(); sinceSave = 0 }
      if (done % 200 === 0) console.log(`  ${done}/${todo.length} (drop ${dropped}, fail ${failed})`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  save()

  console.log(`\nDone: described ${done} | flagged drop ${dropped} | failed ${failed}`)
  console.log(`Wrote ${DESC_PATH}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
