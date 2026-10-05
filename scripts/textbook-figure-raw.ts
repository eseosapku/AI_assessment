/** The raw textbook figures from both sources, in one shape. Shared by the tagger and the merge. */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIGITAL = path.join(ROOT, 'data', 'textbook-question-figures.raw.json')
const SCANNED = path.join(ROOT, 'data', 'textbook-scan-figures.raw.json')

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
  if (fs.existsSync(SCANNED)) {
    for (const rec of Object.values<any>(JSON.parse(fs.readFileSync(SCANNED, 'utf8')))) {
      rec.figures.forEach((f: any, i: number) => out.push({
        id: `tb${rec.textbookId}-s${rec.page}-${i}`, textbookId: rec.textbookId, textbookIds: [rec.textbookId],
        textbookName: rec.textbookName, page: rec.page, localPath: f.localPath, labels: [],
        heading: f.heading || null, question: String(f.question ?? ''), scanned: true,
      }))
    }
  }
  return out
}

