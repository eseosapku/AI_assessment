import fs from 'node:fs'
import path from 'node:path'

export interface PaperReference {
  textbookId: number
  topicId: number
  subtopicId: number
  paper: string
  number: string
  text: string
}

let cache: PaperReference[] | undefined
function load(): PaperReference[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/past-paper-references.json'), 'utf8'))
    cache = Array.isArray(parsed) ? parsed : []
  } catch { cache = [] }
  return cache!
}

/** Source selection is independent of style. Do not borrow another book's level or topics. */
export function pastPaperReferences(opts: { textbookId?: number; topicIds: number[]; subtopicIds: number[]; seed?: number }, bank = load()): string {
  if (!opts.textbookId || (!opts.topicIds.length && !opts.subtopicIds.length)) return ''
  const matching = bank.filter((r) => r.textbookId === opts.textbookId && (
    opts.subtopicIds.length ? opts.subtopicIds.includes(r.subtopicId) : opts.topicIds.includes(r.topicId)
  ))
  if (!matching.length) return ''
  const offset = Math.abs(Math.trunc(opts.seed ?? 0)) % matching.length
  const rotated = [...matching.slice(offset), ...matching.slice(0, offset)]
  const picked: PaperReference[] = []
  // Spread references over the selected areas before adding another from the same area.
  for (const area of new Set(rotated.map((r) => r.subtopicId || r.topicId))) {
    const item = rotated.find((r) => (r.subtopicId || r.topicId) === area)!
    picked.push(item)
    if (picked.length === 4) break
  }
  return [
    'SAVED PAST-PAPER REFERENCES: use these alongside the textbook and curriculum scope.',
    'Adapt their content and demand to the selected answer format. Practice uses one direct demand per exercise; exam uses a shared setup with two or three parts. Supply all required data and write a fresh checked answer key. Never copy PDF furniture or refer to an unseen source.',
    ...picked.map((r) => `[${r.paper}, question ${r.number}] ${r.text}`),
  ].join('\n')
}
