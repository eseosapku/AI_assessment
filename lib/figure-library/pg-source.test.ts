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
      return { rows: /figure_library_questions/.test(sql) ? qRows : figRows } as never
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
    expect(db.calls[0].sql).toMatch(/ORDER BY random\(\)/)
    expect(db.calls[0].values).toEqual([[2, 9], exclude, 120])
    expect(db.calls[1].values).toEqual([['wikimedia/1', 'drawn/bar_chart/1']])
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
