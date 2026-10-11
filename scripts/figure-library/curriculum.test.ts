// scripts/figure-library/curriculum.test.ts
import { describe, it, expect } from 'vitest'
import { curriculumRows, displayName, stageCurriculum } from './curriculum'
import { openStore } from './store'

const input = {
  books: [
    { textbook_id: 10, textbook_name: 'Biology S2 SB', curriculum: 0 },
    { textbook_id: 205, textbook_name: 'Cambridge IGCSE™ ICT Coursebook', curriculum: 1 },
    { textbook_id: 30, textbook_name: 'NERDC Senior Secondary 2 — Physics', curriculum: 2 },
    { textbook_id: 40, textbook_name: 'WAEC 2015 — Biology (may-june)', curriculum: 3 },
  ],
  topics: [
    { topic_id: 1, textbook_id: 10, topic: 'Cells' },
    { topic_id: 2, textbook_id: 205, topic: 'Data handling\\b' },
    { topic_id: 3, textbook_id: 30, topic: 'Motion' },
    { topic_id: 4, textbook_id: 40, topic: '2015 may-june question bank' },
    { topic_id: 5, textbook_id: 10, topic: '   ' },
  ],
  subtopics: [
    { subtopic_id: 100, topic_id: 1, subtopic: 'Plant cells' },
    { subtopic_id: 101, topic_id: 1, subtopic: '' },
    { subtopic_id: 102, topic_id: 4, subtopic: 'should not appear' },
  ],
  waec: [{ name: 'Biology', topics: ['Cell biology', 'Ecology'] }],
  jamb: [{ name: 'Use of English', topics: ['Comprehension'] }],
  checkpoint: [{ programme: 'primary' as const, name: 'Science', code: '0097', strands: ['Biology', 'Physics'] }],
}

describe('the curriculum staged for mapping', () => {
  const rows = curriculumRows(input)

  it('takes Rwanda, Cambridge and NERDC topics from the database, and skips past-paper banks and blank names', () => {
    const db = rows.topics.filter((t) => t.key.startsWith('db:'))
    expect(db.map((t) => [t.key, t.source, t.subject, t.band])).toEqual([
      ['db:1', 'rwanda', 'biology', 'LS'],
      ['db:2', 'cambridge', 'computing', 'UP'],
      ['db:3', 'nerdc', 'physics', 'UP'],
    ])
  })

  it('keeps a name exactly as the database has it, and shows it clean', () => {
    // Book 205's chapter names end in a literal \b; lookups need the exact string.
    expect(rows.topics.find((t) => t.key === 'db:2')?.name).toBe('Data handling\\b')
    expect(displayName('Data handling\\b')).toBe('Data handling')
    expect(displayName('Forces\u0008 and\tmotion')).toBe('Forces and motion')
  })

  it('takes only named subtopics of staged topics', () => {
    expect(rows.subtopics).toEqual([{ key: 'db:100', topicKey: 'db:1', name: 'Plant cells' }])
  })

  it('adds the WAEC, JAMB and Checkpoint syllabus topics at their levels', () => {
    expect(rows.topics.filter((t) => !t.key.startsWith('db:')).map((t) => [t.key, t.subject, t.band])).toEqual([
      ['waec:Biology:0', 'biology', 'UP'],
      ['waec:Biology:1', 'biology', 'UP'],
      ['jamb:Use of English:0', 'english', 'UP'],
      ['checkpoint:primary:0097:0', 'science', 'P'],
      ['checkpoint:primary:0097:1', 'science', 'P'],
    ])
  })

  it('lists any name with no subject, so the rules can be fixed before mapping', () => {
    const odd = curriculumRows({ ...input, books: [{ textbook_id: 9, textbook_name: 'Mystery Book', curriculum: 0 }], topics: [{ topic_id: 9, textbook_id: 9, topic: 'X' }] })
    expect(odd.unmapped).toEqual(['Mystery Book'])
    expect(odd.uncertain).toEqual(['Mystery Book'])
  })
})

describe('staging a fresh export over an earlier one', () => {
  // A re-export kept a topic's plan after its name or subtopics changed, kept
  // topics deleted from production, and WAEC/JAMB keys are positions, so a
  // reordered syllabus pointed old plans at different topics.
  function earlier() {
    const db = openStore(':memory:')
    const topic = db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'Geography S2', 'geography', 'LS', ?)")
    topic.run('db:1', 'Rivers'); topic.run('db:2', 'Coasts'); topic.run('db:3', 'Deserts')
    db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('db:100', 'db:2', 'Spits')").run()
    const map = db.prepare("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES (?, '[]', '[\"geo.map\"]', '[]', 'high', 'm', 'now')")
    map.run('db:1'); map.run('db:2'); map.run('db:3')
    db.prepare("INSERT INTO subtopic_map (subtopic_key, concepts, kinds) VALUES ('db:100', '[]', '[\"geo.map\"]')").run()
    return db
  }
  const t = (key: string, name: string) => ({ key, source: 'rwanda' as const, textbookId: 10, book: 'Geography S2', subject: 'geography', band: 'LS' as const, name })

  it('keeps unchanged plans, clears changed ones, and removes topics production no longer has', () => {
    const db = earlier()
    const result = stageCurriculum(db, {
      topics: [t('db:1', 'Rivers'), t('db:2', 'Coastal landforms'), t('db:4', 'Glaciers')],
      subtopics: [{ key: 'db:100', topicKey: 'db:2', name: 'Spits' }],
    })
    expect(result).toEqual({ added: 1, changed: 1, removed: 1 })
    const mapped = (db.prepare('SELECT topic_key FROM topic_map ORDER BY topic_key').all() as { topic_key: string }[]).map((r) => r.topic_key)
    expect(mapped).toEqual(['db:1'])
    expect((db.prepare("SELECT COUNT(*) AS n FROM topics WHERE key = 'db:3'").get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM subtopic_map').get() as { n: number }).n).toBe(0)
  })

  it('clears a plan when its subtopics change, since the plan maps them by position', () => {
    const db = earlier()
    const result = stageCurriculum(db, {
      topics: [t('db:1', 'Rivers'), t('db:2', 'Coasts'), t('db:3', 'Deserts')],
      subtopics: [{ key: 'db:100', topicKey: 'db:2', name: 'Spits and bars' }],
    })
    expect(result).toEqual({ added: 0, changed: 1, removed: 0 })
    expect((db.prepare("SELECT COUNT(*) AS n FROM topic_map WHERE topic_key = 'db:2'").get() as { n: number }).n).toBe(0)
  })
})
