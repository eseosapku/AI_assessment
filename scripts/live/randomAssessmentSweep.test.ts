/** Live, paid QA: 20 seeded random exams, ten per curriculum. Run against next start. */
import { expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import http from 'node:http'
import { auditPaper } from '@/lib/question-audit'
import { paperGroups } from '@/lib/exam-parts'
import { stageOfBook } from '@/lib/textbook-figure-bank'
import { figureSrc } from '@/lib/figure-src'
import { isLearningTitle } from '@/lib/curriculum-title'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const base = process.env.QA_BASE || 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This QA suite only runs against a local dev server.')
const resumeDir = process.env.QA_RESUME_DIR
const resumeManifest = resumeDir ? JSON.parse(fs.readFileSync(path.join(resumeDir, 'manifest.json'), 'utf8')) : null
const seed = Number(resumeManifest?.seed || process.env.QA_SEED || randomBytes(4).readUInt32LE()) >>> 0
let rngState = seed
const random = () => { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296 }
const shuffled = <T,>(list: T[]) => list.map((value) => ({ value, rank: random() })).sort((a, b) => a.rank - b.rank).map((x) => x.value)
const outDir = resumeDir || path.join(process.cwd(), 'data/audit', `random-sweep-${seed}`)
const buildId = fs.readFileSync('.next/BUILD_ID', 'utf8').trim()

async function generate(body: unknown, forwarded: string): Promise<{ status: number; ok: boolean; json: () => Promise<any> }> {
  const response = await new Promise<{ status: number; ok: boolean; json: () => Promise<any> }>((resolve, reject) => {
    const request = http.request(new URL('/api/generate-assessment', base), { method: 'POST', signal: AbortSignal.timeout(660000), headers: { 'Content-Type': 'application/json', 'x-forwarded-for': forwarded } }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode || 0, ok: response.statusCode === 200, json: async () => JSON.parse(text) }))
    })
    request.on('error', reject)
    request.end(JSON.stringify(body))
  })
  if (response.status !== 202) return response
  const queued = await response.json()
  if (!queued.job?.id) throw new Error('Generation submission returned no job ID')
  const started = Date.now()
  while (Date.now() - started < 20 * 60_000) {
    const poll = await fetch(`${base}/api/jobs/${queued.job.id}`)
    const { job, error } = await poll.json()
    if (!poll.ok || !job) throw new Error(error || 'Could not read generation job')
    if (job.status === 'succeeded') return { status: 200, ok: true, json: async () => job.result_payload }
    if (job.status === 'failed') return { status: job.result_payload?.statusCode || 500, ok: false, json: async () => job.result_payload?.errorPayload || { error: job.error_message } }
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }
  throw new Error('Assessment worker did not finish within twenty minutes')
}

it('generates twenty random REB/Cambridge exams with exact numbered counts and complete parts', async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 5000, query_timeout: 5000, max: 1 })
  const createdIds: string[] = []
  const results: any[] = []
  try {
    const productionAsset = await fetch(`${base}/_next/static/${buildId}/_buildManifest.js`)
    await productionAsset.body?.cancel()
    if (!productionAsset.ok) throw new Error('Run next build and next start before this production assessment sweep.')
    // Use the versioned catalogue for reproducible sampling; the real route resolves
    // and validates every selected ID against the current database on generation.
    const snapshot = JSON.parse(fs.readFileSync('curriculum/snapshot.json', 'utf8'))
    const books: any[] = snapshot.textbooks
    const topics: any[] = snapshot.topics.filter((t: any) => isLearningTitle(t.topic))
    const jobs: any[] = []
    const used = new Set<number>()
    const examOnly = process.env.QA_STYLES !== 'both'
    for (const curriculum of [0, 1]) for (const exam of (examOnly ? [true] : [true, false])) {
      const candidates = shuffled(books.filter((b) => Number(b.curriculum) === curriculum
        && /math|science|physics|chemistry|biology|english|history|geography|econom|comput|ict/i.test(b.textbook_name)
        && !/teacher|answer|solution|guide|workbook/i.test(b.textbook_name)
        && topics.some((t) => t.textbook_id === b.textbook_id)))
      for (let i = 0; i < (examOnly ? 10 : 5); i++) {
        const available = candidates.filter((b) => !used.has(b.textbook_id))
        const b = available.find((b) => {
          const g = stageOfBook(b.textbook_name) || Number(String(b.textbook_name).match(/\b[SP]([1-6])\b/i)?.[1] || 0) + (/\bS[1-6]\b/i.test(b.textbook_name) ? 6 : 0)
          return i === 0 ? g >= 1 && g <= 6 : i === 1 ? g >= 7 && g <= 9 : /igcse|level|\bS[4-6]\b/i.test(b.textbook_name)
        }) || available[0]
        if (!b) throw new Error(`Insufficient books for curriculum ${curriculum}`)
        used.add(b.textbook_id)
        const name = String(b.textbook_name)
        const grade = /\bS([1-6])\b/i.test(name) ? Number(name.match(/\bS([1-6])\b/i)![1]) + 6
          : /\bP([1-6])\b/i.test(name) ? Number(name.match(/\bP([1-6])\b/i)![1])
          : /as.*level|a level|advanced/i.test(name) ? 12 : /igcse|o level/i.test(name) ? 10 : stageOfBook(name) || 9
        const selected = shuffled(topics.filter((t) => t.textbook_id === b.textbook_id)).slice(0, random() < 0.5 ? 1 : 2)
        const questionType = exam ? 'longform' : ['mcq', 'longform', 'mixed', 'interactive', 'study_mixed'][i]
        const count = i % 5 === 4 ? 20 : 10
        jobs.push({ label: `${curriculum === 0 ? 'REB' : 'Cambridge'} / ${exam ? 'Exam' : 'Practice'} / ${name}`, exam, body: {
          subject: name, textbook_id: b.textbook_id, topic_ids: selected.map((t) => t.topic_id), topics: selected.map((t) => t.topic),
          curriculum: curriculum === 0 ? 'rwanda' : 'cambridge', grade,
          className: curriculum === 0 ? grade <= 6 ? `P${grade}` : `S${grade - 6}` : name,
          style: exam ? 'Exam Style (Past Papers)' : 'Test Style (Textbooks)', questionType, count,
          difficultyLevel: ['beginner', 'average', 'intermediate'][Math.floor(random() * 3)],
        } })
      }
    }
    const ordered: any[] = resumeManifest?.jobs || shuffled(jobs)
    const force = new Set(String(process.env.QA_RETRY_CASES || '').split(',').map(Number))
    const skip = new Set<number>()
    if (resumeManifest) for (let index = 0; index < ordered.length; index++) {
      const file = path.join(outDir, `${String(index + 1).padStart(2, '0')}.json`)
      if (!fs.existsSync(file)) continue
      const old = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (old.data?.questions) old.findings = auditPaper(old.data.questions.map((q: any) => ({ ...q, passage: q.passage || q.scenario })))
      if (old.data?.assessment_id) createdIds.push(old.data.assessment_id)
      if (old.stage === 'complete' && old.status === 200 && !old.error && !old.structureErrors?.length && !old.imageErrors?.length && !force.has(index + 1)) {
        results.push(old); skip.add(index)
        fs.writeFileSync(file, JSON.stringify(old, null, 2))
      } else fs.copyFileSync(file, file.replace('.json', `.attempt-${Date.now()}.json`))
    }
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ seed, baseUrl: base, buildId, jobs: ordered }, null, 2))
    console.log(`SEED ${seed}; report ${outDir}`)
    console.log(ordered.map((j, i) => `${i + 1}. ${j.label}: ${j.body.count} ${j.body.questionType}; ${j.body.topics.join('; ')}`).join('\n'))
    const { callGemma, parseJsonRobust } = await import('@/lib/bedrock')
    const reviewModel = process.env.QA_REVIEW_MODEL || 'amazon.nova-lite-v1:0'
    let next = 0
    async function worker() {
      while (next < ordered.length) {
        const index = next++
        if (skip.has(index)) continue
        const job = ordered[index]
        const started = Date.now()
        const row: any = { index: index + 1, label: job.label, request: job.body, seed, baseUrl: base, buildId, error: null }
        const checkpoint = (stage: string) => {
          row.stage = stage
          fs.writeFileSync(path.join(outDir, `${String(index + 1).padStart(2, '0')}.json`), JSON.stringify(row, null, 2))
        }
        checkpoint('generating')
        try {
          const response = await generate(job.body, `10.21.${seed % 250}.${index + 1}`)
          const data = await response.json()
          row.generationSeconds = Math.round((Date.now() - started) / 1000)
          row.status = response.status
          row.data = data
          checkpoint('generated')
          if (data.assessment_id && /^[a-f\d-]{36}$/i.test(data.assessment_id)) createdIds.push(data.assessment_id)
          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
          const questions = data.questions || []
          const groups = paperGroups(questions)
          row.numbered = job.exam ? groups.length : questions.length
          row.parts = questions.length
          row.structureErrors = []
          if (row.numbered !== job.body.count) row.structureErrors.push(`Requested ${job.body.count}; received ${row.numbered}`)
          if (job.exam && groups.some((g) => {
            const letters = questions.slice(g.start, g.end).map((q: any) => q.part).join('')
            return letters !== 'ab' && letters !== 'abc'
          })) row.structureErrors.push('Invalid exam part grouping')
          // The auditor reads standalone stems. Include visible shared context to avoid false missing-data/duplicate findings.
          row.findings = auditPaper(questions.map((q: any) => ({ ...q, passage: q.passage || q.scenario })))
          const urls = [...new Set<string>(questions.map((q: any) => String(q.image_url || '')).filter(Boolean))]
          row.figures = urls.length
          row.imageErrors = []
          checkpoint('checking-images')
          for (const url of urls) {
            if (url.startsWith('data:')) continue
            try {
              const image = await fetch(new URL(figureSrc(url), base), { signal: AbortSignal.timeout(15000) })
              if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) row.imageErrors.push(`${url}: HTTP ${image.status}`)
              await image.body?.cancel()
            } catch (e) { row.imageErrors.push(`${url}: ${String(e)}`) }
          }
          if (process.env.QA_REVIEW === '1') {
          const reviewGroups = groups.map((g) => ({
            number: g.number, context: questions[g.start]?.scenario, passage: questions[g.start]?.passage,
            figure: questions.slice(g.start, g.end).find((q: any) => q.image_alt)?.image_alt,
            questions: questions.slice(g.start, g.end).map((q: any) => {
              const { diagram_svg, image_url, passage, scenario, ...rest } = q
              return { ...rest, label: job.exam ? `${g.number}${q.part}` : String(g.number) }
            }),
          }))
          const prompt = `Independently audit this complete student assessment. Curriculum ${job.body.curriculum}; book ${job.body.subject}; grade ${job.body.grade}; requested topics ${job.body.topics.join('; ')}; format ${job.body.questionType}.
Solve/check the answers yourself. Check factual/numerical correctness, unique MCQ answers, answerable and age-appropriate demands, topic fit, correct model answers and marking criteria, no absent passages/data and no repeated question with the same data. Exam parts share context and earlier results. Symbolic answers and show-that targets are valid. Do not invent faults or demand numerical values for symbolic questions. Only report substantive issues you can demonstrate with evidence; include your corrected result. A description alone cannot establish that a picture's pixels are correct. Do not count style preferences as errors. For interactive questions inspect all answer mappings.
Return JSON only: {"reviewed_labels":[every question label],"issues":[{"label":"...","severity":"broken or poor","detail":"specific evidenced fault under 70 words","correction":"correct answer or required repair"}],"summary":"under 60 words"}.
ASSESSMENT: ${JSON.stringify(reviewGroups)}`
          checkpoint('reviewing')
          const reviewWith = (model: string) => callGemma(prompt, { model, maxTokens: 8000, temperature: 0,
            signal: AbortSignal.timeout(120000), usage: { feature: 'assessment_qa_review', requestId: randomUUID(), userId: null } })
          const review = await reviewWith(reviewModel)
          row.reviewModel = reviewModel
          row.review = parseJsonRobust(review)
          } else row.review = { skipped: 'Extra paid reviewer disabled; full questions retained for manual review.' }
        } catch (e) { row.error = String(e) }
        row.totalSeconds = Math.round((Date.now() - started) / 1000)
        row.stage = 'complete'
        results.push(row)
        fs.writeFileSync(path.join(outDir, `${String(index + 1).padStart(2, '0')}.json`), JSON.stringify(row, null, 2))
        fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ seed, results: results.map(({ data, ...r }) => r) }, null, 2))
        console.log(`CASE ${index + 1}/20 ${job.label}: ${row.status || 'ERROR'} ${row.numbered ?? 0}/${job.body.count}; ${row.generationSeconds ?? '?'}s; figures=${row.figures ?? 0}; structure=${row.structureErrors?.length ?? 0}; audit=${row.findings?.filter((f: any) => f.severity === 'broken').length ?? 0}; imageErrors=${row.imageErrors?.length ?? 0}; review=${row.review?.issues?.length ?? '?'}; ${row.error || ''}`)
      }
    }
    // Two learners at a time; each generation already runs bounded Bedrock batches internally.
    await Promise.all([worker(), worker()])
  } finally {
    fs.writeFileSync(path.join(outDir, 'created-assessment-ids.json'), JSON.stringify(createdIds))
    try {
      const cleanup = createdIds.length ? await pool.query('DELETE FROM assessments WHERE id = ANY($1::uuid[]) AND user_id IS NULL', [createdIds]) : { rowCount: 0 }
      fs.writeFileSync(path.join(outDir, 'cleanup.json'), JSON.stringify({ requested: createdIds.length, deleted: cleanup.rowCount }))
    } catch (e) {
      fs.writeFileSync(path.join(outDir, 'cleanup.json'), JSON.stringify({ requested: createdIds.length, error: String(e) }))
      console.warn('Could not clean up anonymous QA rows; exact IDs saved in report:', String(e))
    }
    await Promise.race([pool.end(), new Promise((resolve) => setTimeout(resolve, 6000))])
  }
  const failures = results.filter((r) => r.error || r.structureErrors?.length || r.imageErrors?.length || r.findings?.some((f: any) => f.severity === 'broken') || r.review?.issues?.some((f: any) => f.severity === 'broken'))
  console.log(`FINISHED seed=${seed}, completed=${results.length}, flagged=${failures.length}, report=${outDir}`)
  expect(results).toHaveLength(20)
  expect(failures.map((r) => `${r.index}: ${r.label}: ${r.error || `structure=${r.structureErrors?.length || 0}, images=${r.imageErrors?.length || 0}, structural-audit=${r.findings?.filter((f: any) => f.severity === 'broken').length || 0}, content-review=${r.review?.issues?.filter((f: any) => f.severity === 'broken').length || 0}`}`)).toEqual([])
}, 3_600_000)
