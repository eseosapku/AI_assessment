// Compact, topic-mapped references for BOTH assessment pipelines. No raw PDF corpus in production.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const dir = path.join(root, 'data/past-paper-corpus')
const mappings = fs.readFileSync(path.join(dir, 'mappings.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)
const wanted = new Map()
for (const m of mappings) {
  if (m.status !== 'assigned' || m.confidence !== 'high' || !m.textbook_id) continue
  const key = `${m.path}:${m.index}`
  const list = wanted.get(key) || []
  list.push(m)
  wanted.set(key, list)
}
const references = []
const seen = new Set()
const perArea = new Map()
for (const line of fs.readFileSync(path.join(dir, 'papers.jsonl'), 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue
  const paper = JSON.parse(line)
  if (paper.status !== 'extracted') continue
  for (const [index, q] of (paper.questions || []).entries()) {
    const mapped = wanted.get(`${paper.path}:${index}`) || []
    const flatten = (part) => [part.text, ...(part.parts || []).map(flatten)].filter(Boolean).join(' ')
    const text = [q.stem, ...(q.parts || []).map(flatten)].join(' ').replace(/\s+/g, ' ').trim()
    // Text-layer scraps and questions requiring an absent picture are not usable source material.
    if (text.length < 45 || text.length > 1800 || /\b(diagram|figure|graph|table|photograph|shown|above|below|opposite|recording|insert)\b/i.test(text)) continue
    if ((text.match(/[a-z]/gi) || []).length / text.length < 0.55) continue
    for (const m of mapped) {
      const area = `${m.textbook_id}:${m.subtopic_id || m.topic_id}`
      const key = `${m.textbook_id}:${text}`
      if (seen.has(key) || (perArea.get(area) || 0) >= 4) continue
      seen.add(key)
      perArea.set(area, (perArea.get(area) || 0) + 1)
      references.push({ textbookId: m.textbook_id, topicId: m.topic_id, subtopicId: m.subtopic_id, paper: paper.path.replace(/\\/g, '/'), number: q.number, text })
    }
  }
}
const target = path.join(root, 'data/past-paper-references.json')
fs.writeFileSync(target, JSON.stringify(references))
console.log(`${references.length} mapped references; ${fs.statSync(target).size} bytes`)
