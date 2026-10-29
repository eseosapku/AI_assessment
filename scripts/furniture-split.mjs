import fs from 'node:fs'

const snapshot = JSON.parse(fs.readFileSync(new URL('../curriculum/snapshot.json', import.meta.url), 'utf8'))

/** Book apparatus, not a thing being taught. Exact names only, after trimming and lowercasing. */
const FURNITURE = new Set([
  'introduction',
  'end unit assessment',
  'introductory activity',
  'end of unit assessment',
  'learning intentions',
  'unit summary',
  'summary of the unit',
  'unit assessment',
  'list of lessons/sub-heading',
  'key unit competence',
  'cross-cutting issues to be addressed',
  'additional activities',
  'guidance on the introductory activity',
  'check your progress',
  'unit evaluation',
  'assessment',
  'extended work',
  'mise en situation',
  'activité de mise en situation',
  'activite de mise en situation',
  'activité d\'exploitation lexicale',
  'activité de compréhension du texte',
  'activité de production',
  'activité d\'exploitation littéraire',
  'activité d\'exploitation grammaticale',
  'j\'observe, je lis et je réponds',
  'evaluation de l\'unité',
  'évaluation de l\'unité',
])

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const byTopic = new Map()
for (const row of snapshot.subtopics) {
  const key = String(row.topic_id)
  if (!byTopic.has(key)) byTopic.set(key, [])
  byTopic.get(key).push(row)
}

const topicName = new Map(snapshot.topics.map((t) => [String(t.topic_id), t]))
const bookName = new Map(snapshot.textbooks.map((t) => [String(t.textbook_id), t.textbook_name]))

let topicsWithAlternative = 0
let furnitureBesideContent = 0
let topicsFurnitureOnly = 0
let furnitureKept = 0
const furnitureOnlyTopics = []
const termCounts = new Map()

for (const rows of byTopic.values()) {
  const furniture = rows.filter((r) => FURNITURE.has(norm(r.subtopic)))
  const content = rows.length - furniture.length
  for (const r of furniture) {
    const n = norm(r.subtopic)
    termCounts.set(n, (termCounts.get(n) ?? 0) + 1)
  }
  if (furniture.length && content > 0) {
    topicsWithAlternative += 1
    furnitureBesideContent += furniture.length
  } else if (furniture.length && content === 0) {
    topicsFurnitureOnly += 1
    furnitureKept += furniture.length
    const topic = topicName.get(String(rows[0].topic_id))
    furnitureOnlyTopics.push({
      topic_id: rows[0].topic_id,
      topic: topic?.topic ?? '',
      book: bookName.get(String(rows[0].textbook_id)) ?? '',
      rows: furniture.length,
    })
  }
}

const out = {
  topics_with_subtopics: byTopic.size,
  topics_furniture_beside_real_content: topicsWithAlternative,
  furniture_rows_not_mappable: furnitureBesideContent,
  topics_whose_only_subtopics_are_furniture: topicsFurnitureOnly,
  furniture_rows_kept_mappable: furnitureKept,
  furniture_only_topics: furnitureOnlyTopics,
  terms: [...termCounts.entries()].sort((a, b) => b[1] - a[1]),
}
console.log(JSON.stringify(out, null, 2))
