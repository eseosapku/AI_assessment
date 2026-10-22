import { describe, it, expect } from 'vitest'
import { libraryFiguresPg, seenAssets } from './pg-source'

const FIG_ROWS = [
  { id: 'wikimedia/1', origin: 'wikimedia', family: null, kind: 'photo.micrograph', asset: 'assets/wikimedia/1.webp',
    credit: 'Onion cells by A, CC BY 4.0', shows: 'Onion cells', topic: 'Cells', book: 'IGCSE Biology', books: '77' },
  { id: 'drawn/bar_chart/1', origin: 'drawn', family: 'bar_chart', kind: 'graph.bar', asset: 'assets/drawn/bar_chart/1.svg',
    credit: null, shows: 'bar chart: Rain', topic: 'Cells', book: 'IGCSE Biology', books: '77,78' },
]
const Q_ROWS = [
  { figure_id: 'wikimedia/1', kind: 'mcq', stem: 'What is the dark dot?', options: ['Nucleus', 'Wall'], answer: '0', accepted: [], explanation: 'DNA.' },
  { figure_id: 'drawn/bar_chart/1', kind: 'short', stem: 'How many mm?', options: [], answer: '12', accepted: ['12', '12 mm'], explanation: '' },
]

function fakeDb(figRows = FIG_ROWS, qRows = Q_ROWS) {
  const calls: { sql: string; values: unknown[] }[] = []
  return {
    calls,
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values })
      // The questions query, not the figure query that checks a question's kind exists.
      return { rows: /SELECT figure_id, kind, stem/.test(sql) ? qRows : figRows } as never
    },
  }
}

describe('library figures from Postgres', () => {
  it('shapes rows like bank figures with CloudFront URLs, and their questions like the vetted bank', async () => {
    const db = fakeDb()
    const { figures, questions } = await libraryFiguresPg(db, { topicIds: [2], base: 'https://cdn.example/figure-library/' })
    expect(figures.map((f) => f.id)).toEqual(['lib:wikimedia/1', 'lib:drawn/bar_chart/1'])
    expect(figures[0]).toMatchObject({ source: 'wikimedia', noun: 'micrograph', textbookIds: [77], textbookName: 'IGCSE Biology', topic: 'Cells',
      localPath: 'https://cdn.example/figure-library/assets/wikimedia/1.webp', shows: 'Onion cells', credit: 'Onion cells by A, CC BY 4.0' })
    expect(figures[1]).toMatchObject({ source: 'bar_chart', noun: 'diagram', textbookIds: [77, 78] })
    expect(figures[1].credit).toBeUndefined()
    expect(questions.get('lib:wikimedia/1')).toEqual([{ kind: 'mcq', question: { type: 'mcq', question: 'What is the dark dot?', options: ['Nucleus', 'Wall'], correct_answer: 0, explanation: 'DNA.' } }])
    expect(questions.get('lib:drawn/bar_chart/1')?.[0]).toMatchObject({ kind: 'short', question: { short_answer: { accepted: ['12', '12 mm'] } } })
  })

  it('samples the quiz topics, leaving out figures the student has seen, however many', async () => {
    const db = fakeDb()
    const exclude = Array.from({ length: 2000 }, (_, i) => `assets/drawn/x/${i}.svg`)
    await libraryFiguresPg(db, { topicIds: [2, 9], excludeAssets: exclude, limit: 120, base: 'https://cdn' })
    // The topic links are sampled first (a narrow index-only sort), three times the figures wanted,
    // then only those figures are fetched: the whole-row random sort took 812 ms on an 8,618-figure topic.
    expect(db.calls[0].sql).toMatch(/FROM figure_library_topics WHERE topic_id = ANY\(\$1::int\[\]\) ORDER BY random\(\) LIMIT \$3/)
    expect(db.calls[0].values).toEqual([[2, 9], exclude, 360, 120, null])
    expect(db.calls[1].values).toEqual([['wikimedia/1', 'drawn/bar_chart/1']])
  })

  it('asks only for figures with a question of a kind the quiz uses', async () => {
    // A third of the published figures have no multiple-choice question, and a multiple-choice quiz
    // wasted that share of every sample on figures it could not ask about.
    const db = fakeDb()
    await libraryFiguresPg(db, { topicIds: [2], kinds: ['mcq', 'written'], base: 'https://cdn' })
    expect(db.calls[0].sql).toMatch(/EXISTS \(SELECT 1 FROM figure_library_questions q WHERE q.figure_id = f.id AND q.kind = ANY\(\$5::text\[\]\)\)/)
    expect(db.calls[0].values.at(-1)).toEqual(['mcq'])
    const shortOnly = fakeDb()
    await libraryFiguresPg(shortOnly, { topicIds: [2], kinds: ['short', 'written'], base: 'https://cdn' })
    expect(shortOnly.calls[0].values.at(-1)).toEqual(['short'])
  })

  it('lets the database itself abandon a slow lookup, not only stop waiting for it', async () => {
    // The 2-second guard returned nothing but left the query running on the server.
    const db = fakeDb()
    let timeout = 0
    const withTimeout = {
      ...db,
      withStatementTimeout: async <R>(ms: number, fn: (q: typeof db.query) => Promise<R>) => { timeout = ms; return fn(db.query) },
    }
    const { figures } = await libraryFiguresPg(withTimeout, { topicIds: [2], base: 'https://cdn', timeoutMs: 1500 })
    expect(timeout).toBe(1500)
    expect(figures).toHaveLength(2)
    expect(db.calls).toHaveLength(2)
  })

  it('reads a base URL with stray spaces', async () => {
    const { figures } = await libraryFiguresPg(fakeDb(), { topicIds: [2], base: '  https://cdn/figure-library/  ' })
    expect(figures[0].localPath).toBe('https://cdn/figure-library/assets/wikimedia/1.webp')
  })

  it('gives nothing, without asking, for no topics; and nothing when every figure was seen', async () => {
    const db = fakeDb([], [])
    expect((await libraryFiguresPg(db, { topicIds: [], base: 'https://cdn' })).figures).toEqual([])
    expect(db.calls).toHaveLength(0)
    expect((await libraryFiguresPg(db, { topicIds: [2], base: 'https://cdn' })).figures).toEqual([])
    expect(db.calls).toHaveLength(1)
  })

  it('gives nothing when the database fails or is slow, so the quiz is built without library figures', async () => {
    const failing = { query: async () => { throw new Error('down') } }
    expect((await libraryFiguresPg(failing as never, { topicIds: [2], base: 'https://cdn' })).figures).toEqual([])
    const stuck = { query: () => new Promise<never>(() => {}) }
    expect((await libraryFiguresPg(stuck as never, { topicIds: [2], base: 'https://cdn', timeoutMs: 20 })).figures).toEqual([])
  })

  it('turns seen figure URLs back into asset paths, whatever the trailing slash', () => {
    const images = new Set(['https://cdn/figure-library/assets/a.svg', '/textbook-images/b.png'])
    expect(seenAssets(images, 'https://cdn/figure-library/')).toEqual(['assets/a.svg'])
    expect(seenAssets(images, 'https://cdn/figure-library')).toEqual(['assets/a.svg'])
  })
})
