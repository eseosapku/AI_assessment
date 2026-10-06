/** The raw textbook figures from both sources, in one shape. Shared by the tagger and the merge. */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIGITAL = path.join(ROOT, 'data', 'textbook-question-figures.raw.json')
const SCANNED = path.join(ROOT, 'data', 'textbook-scan-figures.raw.json')
const RWANDA = path.join(ROOT, 'data', 'textbook-rwanda-figures.raw.json')

export type RawTextbookFigure = {
  id: string; textbookId: number; textbookIds: number[]; textbookName: string; page: number
  localPath: string; labels: string[]; heading: string | null; question: string; scanned: boolean
}

/** Both sources, in one shape. */
export function loadRawTextbookFigures(): RawTextbookFigure[] {
  const out: RawTextbookFigure[] = []
  if (fs.existsSync(DIGITAL)) {
    for (const f of JSON.parse(fs.readFileSync(DIGITAL, 'utf8')).figures) out.push({ ...f, scanned: false })
  }
  // A book listed twice in the database (IGCSE Biology is rows 1 and 54) is
  // scanned once and serves every row that is it.
  const MAP = path.join(ROOT, 'data', 'cambridge-textbook-pdf-map.json')
  const idsFor = new Map<number, number[]>()
  if (fs.existsSync(MAP)) {
    const map: { id: number; pdf: string | null }[] = JSON.parse(fs.readFileSync(MAP, 'utf8'))
    for (const m of map) {
      if (!m.pdf) continue
      idsFor.set(m.id, map.filter((x) => x.pdf === m.pdf).map((x) => x.id))
    }
  }
  if (fs.existsSync(SCANNED)) {
    for (const rec of Object.values<any>(JSON.parse(fs.readFileSync(SCANNED, 'utf8')))) {
      rec.figures.forEach((f: any, i: number) => out.push({
        id: `tb${rec.textbookId}-s${rec.page}-${i}`, textbookId: rec.textbookId,
        textbookIds: idsFor.get(rec.textbookId) ?? [rec.textbookId],
        textbookName: rec.textbookName, page: rec.page, localPath: f.localPath, labels: [],
        heading: f.heading || null, question: String(f.question ?? ''), scanned: true,
      }))
    }
  }
  // The Rwanda books' library images (scripts/rwanda-figure-raw.ts). Their
  // "question" is the text of the page the image is on, not an exercise.
  if (fs.existsSync(RWANDA)) {
    for (const f of JSON.parse(fs.readFileSync(RWANDA, 'utf8')).figures) out.push({ ...f, scanned: false })
  }
  return out
}

