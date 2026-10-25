import fs from 'fs'
import path from 'path'
import { sameExamPaperSubject } from '@/lib/exam-subject-aliases'

export interface ExamSourceImage {
  key: string
  alocId: number
  exam: string
  subject: string
  subjectSlug: string
  year: number
  diet: string
  question: string
  questionNorm: string
  questionHash: string
  imageUrl: string
  localPath: string
  bytes?: number
  source: string
}

interface ExamImageManifest {
  version: number
  extracted_at?: string
  total?: number
  images: ExamSourceImage[]
}

const MANIFEST_PATH = path.join(process.cwd(), 'data', 'exam-sources', 'images', 'manifest.json')

let cachedManifest: ExamImageManifest | null = null

function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 3)
  )
}

function overlapScore(a: string, b: string): number {
  const wa = significantWords(a)
  const wb = significantWords(b)
  if (!wa.size || !wb.size) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.min(wa.size, wb.size)
}

export function loadExamImageManifest(): ExamImageManifest {
  if (cachedManifest) return cachedManifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    cachedManifest = { version: 1, images: [] }
    return cachedManifest
  }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ExamImageManifest
    cachedManifest = { version: 1, images: Array.isArray(raw?.images) ? raw.images : [] }
  } catch {
    cachedManifest = { version: 1, images: [] }
  }
  return cachedManifest
}

export function getImagesForPaper(opts: {
  exam: 'waec' | 'jamb'
  subject: string
  year: number
}): ExamSourceImage[] {
  const manifest = loadExamImageManifest()
  const subjectNorm = normalizeText(opts.subject)
  return manifest.images.filter((img) => {
    if (img.exam !== opts.exam) return false
    if (img.year !== opts.year) return false
    return sameExamPaperSubject(opts.subject, img.subject) || sameExamPaperSubject(subjectNorm, normalizeText(img.subject))
  })
}

function questionNeedsFigure(text: string): boolean {
  return /\b(figure|diagram|graph|chart|circuit|shown above|shown below|shown in the|illustration|sketch|picture|image|table below|map below)\b/i.test(text)
}

export function matchQuestionToImage(
  questionText: string,
  candidates: ExamSourceImage[],
  minScore = 0.55,
): ExamSourceImage | null {
  if (!candidates.length) return null
  const needsFigure = questionNeedsFigure(questionText)
  // Never glue a past-paper figure onto a text-only generated question.
  if (!needsFigure) return null

  const qNorm = normalizeText(questionText)
  const qPrefix = qNorm.slice(0, 60)
  const sharesPrefix = (c: ExamSourceImage) =>
    Boolean(
      c.questionNorm &&
        qPrefix.length >= 40 &&
        (qNorm.includes(c.questionNorm.slice(0, 60)) || c.questionNorm.includes(qPrefix)),
    )
  // Two different questions can open with the same 60 characters. A boost
  // then attached the first of them, whichever the generated question was.
  const prefixIsUnique = candidates.filter(sharesPrefix).length === 1
  let best: ExamSourceImage | null = null
  let bestScore = 0

  for (const c of candidates) {
    if (!questionNeedsFigure(c.question)) continue
    const score = overlapScore(questionText, c.question)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
    if (prefixIsUnique && sharesPrefix(c) && 0.85 > bestScore) {
      bestScore = 0.85
      best = c
    }
  }

  return bestScore >= minScore ? best : null
}

export function attachSourceImages(
  questions: Array<{ question?: string; image_url?: string }>,
  opts: { exam: 'waec' | 'jamb'; subject: string; year: number }
): number {
  const candidates = getImagesForPaper(opts)
  if (!candidates.length) return 0

  let attached = 0
  const used = new Set<string>()

  for (const q of questions) {
    if (!q.question || q.image_url) continue
    const match = matchQuestionToImage(q.question, candidates.filter((c) => !used.has(c.key)))
    if (match) {
      q.image_url = match.localPath
      used.add(match.key)
      attached++
    }
  }

  return attached
}

export function examFromCurriculum(curriculum: number | null | undefined): 'waec' | 'jamb' | null {
  if (curriculum === 3) return 'waec'
  if (curriculum === 4) return 'jamb'
  return null
}
