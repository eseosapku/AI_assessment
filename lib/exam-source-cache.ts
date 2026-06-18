import fs from 'fs'
import path from 'path'
import { examSubjectMatches } from './exam-subject-aliases'

export type CachedExamPaper = {
  key: string
  id: number
  exam: 'waec' | 'jamb'
  year: number
  subject: string
  diet: string
  name: string
  sourceText: string
  charCount: number
  authority: string
  sourceUrl?: string
}

type Manifest = {
  version: number
  papers: CachedExamPaper[]
}

const CACHE_DIR = path.join(process.cwd(), 'data', 'exam-sources', 'cache')
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json')
const CACHE_ID_BASE = 900_000

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) return { version: 1, papers: [] }
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    return { version: 1, papers: Array.isArray(raw?.papers) ? raw.papers : [] }
  } catch {
    return { version: 1, papers: [] }
  }
}

export function listCachedExamPapers(exam?: string, subject?: string): CachedExamPaper[] {
  const manifest = readManifest()
  let papers = manifest.papers
  if (exam) papers = papers.filter((p) => p.exam === exam.toLowerCase())
  if (subject) {
    papers = papers.filter(
      (p) => examSubjectMatches(subject, p.subject) || examSubjectMatches(subject, p.name),
    )
  }
  return papers
}

export function getCachedExamPaperById(id: number): CachedExamPaper | null {
  return readManifest().papers.find((p) => p.id === id) ?? null
}

export function upsertCachedExamPaper(entry: Omit<CachedExamPaper, 'id' | 'key'> & { key?: string }): CachedExamPaper {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const manifest = readManifest()
  const key =
    entry.key ??
    `${entry.exam}-${entry.year}-${entry.subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${entry.diet}`

  const existing = manifest.papers.find((p) => p.key === key)
  const paper: CachedExamPaper = {
    key,
    id: existing?.id ?? CACHE_ID_BASE + manifest.papers.length + 1,
    exam: entry.exam,
    year: entry.year,
    subject: entry.subject,
    diet: entry.diet,
    name: entry.name,
    sourceText: entry.sourceText,
    charCount: entry.charCount,
    authority: entry.authority,
    sourceUrl: entry.sourceUrl,
  }

  if (existing) {
    const idx = manifest.papers.findIndex((p) => p.key === key)
    manifest.papers[idx] = paper
  } else {
    manifest.papers.push(paper)
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
  return paper
}

export function isCachePaperId(id: number): boolean {
  return Number.isFinite(id) && id >= CACHE_ID_BASE
}
