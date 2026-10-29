import fs from 'node:fs'
import { levelFromBook } from '../lib/past-paper/book-level.ts'

const snapshot = JSON.parse(fs.readFileSync(new URL('../curriculum/snapshot.json', import.meta.url), 'utf8'))
const FURNITURE = new Set([
  'introduction', 'end unit assessment', 'introductory activity', 'end of unit assessment',
  'learning intentions', 'unit summary', 'summary of the unit', 'unit assessment',
  'list of lessons/sub-heading', 'key unit competence', 'cross-cutting issues to be addressed',
  'additional activities', 'guidance on the introductory activity', 'check your progress',
  'unit evaluation', 'assessment', 'extended work', 'mise en situation',
  'activité de mise en situation', "activité d'exploitation lexicale",
  'activité de compréhension du texte', 'activité de production',
  "activité d'exploitation littéraire", "activité d'exploitation grammaticale",
  "j'observe, je lis et je réponds", "evaluation de l'unité",
])
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const books = new Map(snapshot.textbooks.map((b) => [b.textbook_id, b]))
const topics = new Map(snapshot.topics.map((t) => [t.topic_id, t]))
const byTopic = new Map()
for (const row of snapshot.subtopics) {
  const list = byTopic.get(row.topic_id) ?? []
  list.push(row)
  byTopic.set(row.topic_id, list)
}

const levelMap = snapshot.textbooks.map((book) => {
  const parsed = levelFromBook(book.textbook_name, Number(book.curriculum))
  return {
    textbook_id: book.textbook_id,
    system: parsed.system,
    level: parsed.level,
    subject: parsed.subject,
    parse_confidence: parsed.needs_review ? 'low' : 'high',
    parse_source: 'book title',
    needs_review: parsed.needs_review,
  }
})

const enrichment = []
let furnitureBeside = 0
let furnitureKept = 0
for (const [topicId, rows] of byTopic) {
  const topic = topics.get(topicId)
  const book = books.get(topic?.textbook_id)
  const furniture = rows.filter((row) => FURNITURE.has(norm(row.subtopic)))
  const hasContent = furniture.length < rows.length
  for (const row of rows) {
    const isFurniture = FURNITURE.has(norm(row.subtopic))
    const mappable = !isFurniture || !hasContent
    if (isFurniture && hasContent) furnitureBeside += 1
    if (isFurniture && !hasContent) furnitureKept += 1
    enrichment.push({
      subtopic_id: row.subtopic_id,
      description: `${row.subtopic}. Taught under ${topic?.topic ?? 'this topic'} in ${book?.textbook_name ?? 'this book'}.`,
      mappable,
      exclude_reason: mappable ? null : 'book furniture; the topic has a real subtopic beside it',
      generated_by: 'title and parent names',
      reviewed_by: null,
      reviewed_at: null,
    })
  }
}

const dir = new URL('../data/past-paper-corpus/', import.meta.url)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(new URL('../data/past-paper-corpus/book_level_map.json', import.meta.url), JSON.stringify(levelMap))
fs.writeFileSync(new URL('../data/past-paper-corpus/subtopic_enrichment.json', import.meta.url), JSON.stringify(enrichment))
const review = levelMap.filter((row) => row.needs_review).length
const mappable = enrichment.filter((row) => row.mappable).length
console.log(JSON.stringify({
  books: levelMap.length,
  books_need_review: review,
  subtopics: enrichment.length,
  mappable,
  furniture_not_mappable: furnitureBeside,
  furniture_kept: furnitureKept,
}, null, 2))
