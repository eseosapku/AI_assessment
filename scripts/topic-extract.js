/**
 * Shared textbook syllabus extraction: text PDF → vision (Gemma) → known-syllabi fallback.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime')

const known = JSON.parse(fs.readFileSync(path.join(__dirname, 'known-syllabi.json'), 'utf8'))

const BARE_TOPIC_RE = /^(?:unit|chapter)\s*\d+\s*$/i
const MIN_TITLE_LEN = 12

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isBareTopicName(name) {
  const n = String(name || '').trim()
  if (BARE_TOPIC_RE.test(n)) return true
  // "Chapter 3" with no colon/title
  return /^(?:unit|chapter)\s*\d+[a-z]?\s*$/i.test(n)
}

function topicQuality(topics) {
  if (!topics?.length) return { score: 0, bare: 0, gaps: true }
  const bare = topics.filter((t) => isBareTopicName(t.name)).length
  const nums = topics
    .map((t) => {
      const m = String(t.name).match(/(?:unit|chapter)\s*(\d+)/i)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n) => n != null && n <= 40)
  let gaps = false
  if (nums.length >= 3) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 2) {
        gaps = true
        break
      }
    }
  }
  const titled = topics.filter((t) => String(t.name).length >= MIN_TITLE_LEN && !isBareTopicName(t.name)).length
  const score = titled / topics.length
  return { score, bare, gaps, titled, total: topics.length }
}

function needsRepair(topics) {
  const q = topicQuality(topics)
  if (!topics?.length) return false
  if (q.bare >= Math.ceil(q.total * 0.4)) return true
  if (q.score < 0.5) return true
  if (q.gaps && q.score < 0.8) return true
  return false
}

function extractTextOutline(pdfPath) {
  const py = process.platform === 'win32' ? 'python' : 'python3'
  const raw = execFileSync(py, [path.join(__dirname, 'extract_book_outline.py'), pdfPath], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  return JSON.parse(raw)
}

function renderPages(pdfPath, maxPages = 12) {
  const py = process.platform === 'win32' ? 'python' : 'python3'
  const raw = execFileSync(py, [path.join(__dirname, 'render_pdf_pages.py'), pdfPath, String(maxPages)], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(raw).images || []
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return {
    region: get('AWS_REGION') || 'eu-west-1',
    accessKeyId: get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: get('AWS_SECRET_ACCESS_KEY'),
    model:
      get('AWS_GENERATION_MODEL_ID') ||
      get('AWS_BEDROCK_MODEL_ID') ||
      get('AWS_MODEL_ID') ||
      'google.gemma-3-27b-it',
  }
}

function buildModelCandidates(seedId, region) {
  const prefixes = ['eu', 'us', 'ap']
  const bare = seedId.replace(/^(us|eu|ap)\./, '')
  const rp = region.startsWith('eu-') ? 'eu' : region.startsWith('ap-') ? 'ap' : 'us'
  const out = [seedId, bare, `${rp}.${bare}`, ...prefixes.map((p) => `${p}.${bare}`)]
  if (bare === 'google.gemma-3-27b-it') {
    out.push('google.gemma-3-27b-it-v1:0')
    prefixes.forEach((p) => out.push(`${p}.google.gemma-3-27b-it-v1:0`))
  }
  if (bare === 'google.gemma-3-12b-it') {
    out.push('google.gemma-3-12b-it-v1:0')
    prefixes.forEach((p) => out.push(`${p}.google.gemma-3-12b-it-v1:0`))
  }
  return [...new Set(out.filter(Boolean))]
}

function parseJsonFromModel(text) {
  let t = String(text || '').trim()
  t = t.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const m = t.match(/\{[\s\S]*\}/)
  if (m) t = m[0]
  return JSON.parse(t)
}

async function extractVisionOutline(pdfPath, bookTitle) {
  const cfg = loadEnv()
  if (!cfg.accessKeyId || !cfg.secretAccessKey) {
    return { topics: [], source: 'vision-no-aws' }
  }

  const images = renderPages(pdfPath)
  if (!images.length) return { topics: [], source: 'vision-no-pages' }

  const promptBase = `You are reading the table of contents from a textbook PDF.
Book: ${bookTitle}

Extract EVERY main chapter or unit with its full descriptive title visible on this page.
Return ONLY valid JSON:
{
  "topics": [
    { "name": "Chapter 1: Kinematics – describing motion", "subtopics": ["Speed", "Velocity"] },
    { "name": "Unit 2: Market failure", "subtopics": [] }
  ]
}

Rules:
- Each topic name MUST include the number AND full title (never just "Unit 1" or "Chapter 3").
- List in syllabus order. Include ALL chapters/units you can read.
- subtopics: optional section headings (omit if unclear).
- Skip preface, index, acknowledgements.
- If unreadable, return { "topics": [] }.`

  const client = new BedrockRuntimeClient({
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })

  const candidates = [
    ...buildModelCandidates(cfg.model, cfg.region),
    ...buildModelCandidates('google.gemma-3-12b-it', cfg.region),
  ]

  const allTopics = []
  const seen = new Set()
  let lastErr = null

  for (const img of images.slice(0, 4)) {
    const content = [
      { type: 'text', text: `${promptBase}\n\nPage number: ${img.page}` },
      { type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.base64}` } },
    ]
    const body = JSON.stringify({
      messages: [{ role: 'user', content }],
      max_tokens: 4000,
      temperature: 0.2,
    })

    let pageTopics = []
    for (const modelId of candidates) {
      try {
        const res = await client.send(
          new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body,
          })
        )
        const payload = JSON.parse(new TextDecoder().decode(res.body))
        const text =
          payload?.choices?.[0]?.message?.content ||
          payload?.output?.message?.content?.[0]?.text ||
          ''
        const data = parseJsonFromModel(text)
        pageTopics = (data.topics || [])
          .map((item) => ({
            name: String(item.name || '').trim().slice(0, 180),
            subtopics: (item.subtopics || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 30),
          }))
          .filter((t) => t.name && !isBareTopicName(t.name))
        pageTopics = normalizeVisionTopics(pageTopics)
        if (pageTopics.length) break
      } catch (err) {
        lastErr = err
        const msg = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
        if (msg.includes('invalid') || msg.includes('validation')) continue
        throw err
      }
    }
    for (const t of pageTopics) {
      const key = t.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        allTopics.push(t)
      }
    }
  }

  if (allTopics.length) return { topics: allTopics, source: 'vision', pages: images.length }
  return { topics: [], source: `vision-error:${lastErr?.message || 'unknown'}` }
}

function looksInconsistentWithBook(topics, bookTitle) {
  const blob = `${bookTitle} ${topics.map((t) => t.name).join(' ')}`.toLowerCase()
  const title = bookTitle.toLowerCase()
  if (/english language/.test(title) && /kinematics|market failure|economics/.test(blob)) return true
  if (/information and communication technology|ict/.test(title) && /market failure|economic environment|enterprise|stakeholders in a business/.test(blob)) return true
  if (/\bit coursebook\b|level it /.test(title) && /enterprise|business structure|stakeholders in a business/.test(blob)) return true
  const units = topics.filter((t) => /^unit\s/i.test(t.name)).length
  const chapters = topics.filter((t) => /^chapter\s/i.test(t.name)).length
  if (units >= 2 && chapters >= 4 && /english/.test(title)) return true
  return false
}

async function extractOutlineForBook(pdfPath, bookTitle, opts = {}) {
  const key = norm(bookTitle)
  const knownTopics = known[key]?.topics
  let result = { topics: [], source: 'none' }

  if (pdfPath && fs.existsSync(pdfPath)) {
    try {
      const parsed = extractTextOutline(pdfPath)
      const q = topicQuality(parsed.topics || [])
      if ((parsed.topics || []).length && q.score >= 0.6 && !parsed.image_only) {
        result = { topics: parsed.topics, source: 'pdf-text', text_chars: parsed.text_chars }
      } else if (parsed.image_only || opts.preferVision) {
        result = await extractVisionOutline(pdfPath, bookTitle)
      } else if ((parsed.topics || []).length && !needsRepair(parsed.topics)) {
        result = { topics: parsed.topics, source: 'pdf-text-partial', text_chars: parsed.text_chars }
      } else if (!result.topics?.length) {
        result = await extractVisionOutline(pdfPath, bookTitle)
      }
      if (!result.topics?.length && (parsed.topics || []).length) {
        result = { topics: parsed.topics, source: 'pdf-text-fallback', text_chars: parsed.text_chars }
      }
    } catch (e) {
      result = { topics: [], source: `pdf-error:${e.message}` }
    }
  }

  const outQ = topicQuality(result.topics)
  const knownQ = knownTopics ? topicQuality(knownTopics) : { score: 0 }
  if (
    knownTopics &&
    (!result.topics.length ||
      outQ.score < Math.max(0.85, knownQ.score) ||
      looksInconsistentWithBook(result.topics, bookTitle))
  ) {
    return { topics: knownTopics, source: 'known-syllabus' }
  }

  if (!result.topics.length && knownTopics) {
    return { topics: knownTopics, source: 'known-syllabus' }
  }

  return result
}

function hasDuplicateTopics(topics) {
  const seen = new Set()
  for (const t of topics) {
    const key = String(t.name || t.topic || '').trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function isCoursebookName(name) {
  return /coursebook|student book|learner'?s book|learners book|textbook|e-book/i.test(String(name || ''))
}

function needsComprehensiveFix(topics, textbookName) {
  if (!topics?.length) return true
  if (topics.length === 1 && isCoursebookName(textbookName)) return true
  if (needsRepair(topics)) return true
  if (hasDuplicateTopics(topics)) return true
  if (isCoursebookName(textbookName) && topics.length <= 4) return true
  const q = topicQuality(topics)
  if (q.gaps && isCoursebookName(textbookName)) return true
  return false
}

function normalizeVisionTopics(topics) {
  return topics.filter((t) => {
    const name = String(t.name || '').trim()
    if (!name || isBareTopicName(name)) return false
    if (/^(Unit|Chapter)\s+\d+\s+[A-Za-z]/i.test(name) && !/^(Unit|Chapter)\s+\d+\s*:/i.test(name)) {
      return false
    }
    if (/market failure|economic environment|kinematics/i.test(name)) return false
    return true
  })
}

module.exports = {
  norm,
  isBareTopicName,
  topicQuality,
  needsRepair,
  hasDuplicateTopics,
  needsComprehensiveFix,
  isCoursebookName,
  extractOutlineForBook,
  extractVisionOutline,
  extractTextOutline,
}
