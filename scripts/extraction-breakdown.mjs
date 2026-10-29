import fs from 'node:fs'
import readline from 'node:readline'

const file = new URL('../data/past-paper-corpus/papers.jsonl', import.meta.url)
const rl = readline.createInterface({ input: fs.createReadStream(file) })
const by = new Map()
for await (const line of rl) {
  const row = JSON.parse(line)
  const segs = String(row.path).split(/\\|\//)
  const key = `${segs[0]} / ${segs[1]}`
  if (!by.has(key)) by.set(key, { files: 0, extracted: 0, review: 0, scans: 0, questions: 0 })
  const cell = by.get(key)
  cell.files += 1
  if (row.status === 'extracted') cell.extracted += 1
  else cell.review += 1
  if ((row.reasons ?? []).includes('no text layer')) cell.scans += 1
  cell.questions += (row.questions ?? []).length
}
for (const [k, v] of [...by.entries()].sort()) {
  console.log(`${k}\t${v.files}\t${v.extracted}\t${v.review}\t${v.scans}\t${v.questions}`)
}
