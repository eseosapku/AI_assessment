# Figure Library in Production Quizzes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production quizzes take figures from the figure library (rows in Postgres, images from CloudFront), and a signed-in student is never shown the same figure with the same question twice.

**Architecture:**
- An additive migration adds three tables, and a publish script fills them from the local SQLite staging store.
- The quiz route gains a Postgres source beside the local one, chosen by `FIGURE_LIBRARY_SOURCE`.
- Repeat avoidance moves from question wordings to (figure, question) pairs, read from all of a student's recent quizzes, and no longer lets repeats through.

**Tech Stack:** Next.js 16 route handlers, TypeScript, `pg`, `node:sqlite` (through `process.getBuiltinModule`), vitest, jiti for scripts.

**Spec:** `docs/superpowers/specs/2026-10-16-figure-library-production-design.md`

## Global Constraints

- **Database writes.** Additive only. The migration uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. The publish script writes only `figure_library`, `figure_library_topics` and `figure_library_questions`, with `INSERT … ON CONFLICT DO NOTHING`. It never runs UPDATE or DELETE.
- **Secrets.** Never print `DATABASE_URL`. Print the provider kind only.
- **Files not to touch:** `app/api/studylab/grade/route.ts`, `app/api/studylab/snap/route.ts`, `lib/textbook-vision-images.ts`.
- **Commits.** Commits stay local until the rollout task's push. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts` or the deletion of `data/audit/paper-style.json`.
- **Bundle size.** No data files may enter the Next bundle. The Amplify build output must stay under 230,686,720 bytes.
- **Asset base.** `FIGURE_ASSET_BASE` in production is `https://dtj4jtk2hgh9l.cloudfront.net/figure-library`, and `NEXT_PUBLIC_FIGURE_BASE_URL` is `https://dtj4jtk2hgh9l.cloudfront.net`.
- **Running scripts.** A script that imports `lib/` runs with `JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti <script>`.

## Review Focus

1. **A student with a long history.** 50 quizzes can mean 1,500+ seen figure images. The SQL exclusion list must still go through as one array parameter, and the quiz must still build. (Task 4 test: 2,000 excluded assets.)
2. **Every library figure on the quiz's topics already seen.** The Postgres source returns nothing, and the quiz builds from the banks and text questions without error. (Task 4 test.)
3. **The publish script stopped half way and run again.** No duplicates and no errors, because every insert is `ON CONFLICT DO NOTHING`. (Task 5 test.)
4. **`FIGURE_ASSET_BASE` written with a trailing slash.** No double slash in figure URLs, and seen images are still recognised. (Task 4 test.)
5. **A seen figure whose only allowed question was asked with it.** It is never chosen, by the bank ordering or by the library picker. (Task 1 and Task 2 tests.)

---

### Task 1: Seen pairs, history from all quizzes, no repeats by default

**Files:**
- Modify: `lib/student-figure-history.ts`
- Test: `lib/student-figure-history.test.ts`

**Interfaces:**
- Produces:
  - `SeenFigures` gains `askedWith: Map<string, Set<string>>` (image → `questionKey`s asked with it);
  - `askedWith(seen: SeenFigures, image: string): ReadonlySet<string>`;
  - `isSeenPair(seen: SeenFigures, image: string, text: unknown): boolean`;
  - `readSeenFigures(db: Database, userId: string, limit?: number): Promise<SeenFigures>`;
  - `orderForStudent(figures, seen, hasFresh, maxRepeats = 0)`.

- [ ] **Step 1: Write the failing tests.** In `lib/student-figure-history.test.ts`:
  - change the import to `import { askedWith, isSeenPair, NO_HISTORY, orderForStudent, readSeenFigures, seenFromRows } from './student-figure-history'`;
  - add `askedWith: new Map()` to both object literals (`seen` and `none`);
  - pass `2` explicitly in the test "puts unseen figures first, then seen ones with a new question, then a few repeats" (`orderForStudent(figures, seen, hasFresh, 2)`);
  - append:

```ts
describe('pairs of figure and question', () => {
  it('records which questions were asked with which figure', () => {
    const seen = seenFromRows([{ image: '/a.png', text: 'What is the median?' }, { image: '/b.png', text: 'What is the range?' }])
    expect(isSeenPair(seen, '/a.png', 'what is the  median?')).toBe(true)
    // The same wording on another figure is a new pair: a drawn family asks it of a thousand figures.
    expect(isSeenPair(seen, '/b.png', 'What is the median?')).toBe(false)
    expect([...askedWith(seen, '/a.png')]).toEqual([questionKey('What is the median?')])
    expect(askedWith(seen, '/none.png').size).toBe(0)
  })

  it('lets no figure through whose questions were all asked with it, unless told to', () => {
    const fig = (id: string) => ({ id, localPath: `/${id}.png` })
    const seen = { images: new Set(['/old.png']), questions: new Set<string>(), askedWith: new Map() }
    expect(orderForStudent([fig('old'), fig('new')], seen, () => false).map((f) => f.id)).toEqual(['new'])
  })
})

describe('readSeenFigures', () => {
  it("reads the student's last quizzes of any kind and any book", async () => {
    const calls: [string, unknown[] | undefined][] = []
    const db = { query: async (sql: string, values?: unknown[]) => { calls.push([sql, values]); return { rows: [{ image: '/a.png', text: 'Q?' }] } as never } }
    const seen = await readSeenFigures(db, 'u1')
    expect(isSeenPair(seen, '/a.png', 'Q?')).toBe(true)
    expect(calls[0][0]).not.toMatch(/textbook_id/)
    expect(calls[0][1]).toEqual(['u1', 50])
  })

  it('gives no history when the lookup fails', async () => {
    const db = { query: async () => { throw new Error('down') } }
    const seen = await readSeenFigures(db as never, 'u1')
    expect(seen.images.size + seen.questions.size + seen.askedWith.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run them and watch them fail.**
  Run: `npx vitest run lib/student-figure-history.test.ts`
  Expected: FAIL (`isSeenPair`, `askedWith` and `readSeenFigures` are not exported).

- [ ] **Step 3: Implement.** In `lib/student-figure-history.ts`:

```ts
import type { Database } from './db'

export interface SeenFigures {
  /** Figure images (their public paths) the student was shown. */
  images: Set<string>
  /** questionKey() of every question the student was asked. */
  questions: Set<string>
  /** questionKey()s asked with each figure image: the pairs a student must not be shown again (spec 2026-10-16 3.4). */
  askedWith: Map<string, Set<string>>
}

export const NO_HISTORY: SeenFigures = { images: new Set(), questions: new Set(), askedWith: new Map() }
const NONE: ReadonlySet<string> = new Set()

export function seenFromRows(rows: readonly { image?: unknown; text?: unknown }[]): SeenFigures {
  const seen: SeenFigures = { images: new Set(), questions: new Set(), askedWith: new Map() }
  for (const r of rows) {
    const image = String(r.image ?? '').trim()
    const key = questionKey(r.text)
    if (image) seen.images.add(image)
    if (key) seen.questions.add(key)
    if (image && key) seen.askedWith.set(image, (seen.askedWith.get(image) ?? new Set()).add(key))
  }
  return seen
}

/** The questions (questionKey form) a student has already been asked with this figure. */
export function askedWith(seen: SeenFigures, image: string): ReadonlySet<string> {
  return seen.askedWith.get(image) ?? NONE
}

/** Whether asking this question with this figure would show the student a pair they have had. */
export function isSeenPair(seen: SeenFigures, image: string, text: unknown): boolean {
  return askedWith(seen, image).has(questionKey(text))
}

/**
 * The figure questions a student had in their last `limit` quizzes of any kind and any book. A
 * lookup that fails gives no history: the quiz is built as it would be for a new student.
 */
export async function readSeenFigures(db: Database, userId: string, limit = 50): Promise<SeenFigures> {
  try {
    const { rows } = await db.query(
      `SELECT q->>'image_url' AS image, q->>'question' AS text
         FROM (SELECT questions_data FROM assessments
                WHERE user_id::text = $1 AND jsonb_typeof(questions_data) = 'array'
                ORDER BY created_at DESC LIMIT $2) a,
              jsonb_array_elements(a.questions_data) q
        WHERE q->>'image_url' IS NOT NULL`,
      [userId, limit],
    )
    return seenFromRows(rows ?? [])
  } catch (error) {
    console.error('Recent quizzes lookup for figures failed:', error)
    return { images: new Set(), questions: new Set(), askedWith: new Map() }
  }
}
```

Also:
- change `orderForStudent`'s default to `maxRepeats = 0`;
- rewrite its doc line to: "then, only if asked for, at most `maxRepeats` whose questions were all asked with them";
- update the file's header comment: seen figures come back only with a question new to them on that figure.

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run lib/student-figure-history.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/student-figure-history.ts lib/student-figure-history.test.ts
git commit -m "feat(figures): repeats are judged by figure-and-question pair, over all of a student's quizzes, and none get through

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: The library picker never returns a seen pair

**Files:**
- Modify: `lib/figure-library/pick.ts`
- Test: `lib/figure-library/pick.test.ts`

**Interfaces:**
- Consumes: `isSeenPair`, `SeenFigures` with `askedWith` (Task 1).
- Produces: `pickLibraryFigures`, unchanged signature.

- [ ] **Step 1: Write the failing tests.** In `pick.test.ts`:
  - replace the test "puts figures the student has not seen first, with a question they have not had" with the block below;
  - add `askedWith: new Map()` to any other `SeenFigures` literal.

```ts
  it('puts unseen figures first; a seen figure comes back only with a question not asked with it', () => {
    const figures = [fig('lib:a', 'a'), fig('lib:b', 'b')]
    const questions = new Map([['lib:a', [mcq('Old?'), mcq('New?')]], ['lib:b', [mcq('Other?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['old?']), askedWith: new Map([['/x/lib:a', new Set(['old?'])]]) }
    const chosen = pick({ library: figures, questions, seen, room: 2 })
    expect(chosen.map((f) => f.id)).toEqual(['lib:b', 'lib:a'])
    expect(chosen[1].reserved?.question.question).toBe('New?')
  })

  it('never shows a figure again with a question it was asked with', () => {
    const figures = [fig('lib:a', 'a')]
    const questions = new Map([['lib:a', [mcq('Only?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['only?']), askedWith: new Map([['/x/lib:a', new Set(['only?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 1 })).toEqual([])
  })

  it('asks a wording seen on one figure of another figure: it is a new pair', () => {
    const { figures, questions } = family('box', 2, ['What is the median?'])
    const seen: SeenFigures = { images: new Set([figures[0].localPath]), questions: new Set(['what is the median?']),
      askedWith: new Map([[figures[0].localPath, new Set(['what is the median?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 2 }).map((f) => f.id)).toEqual([figures[1].id])
  })
```

- [ ] **Step 2: Run them and watch them fail.**
  Run: `npx vitest run lib/figure-library/pick.test.ts`
  Expected: FAIL on "never shows a figure again…" (the old code falls back to a seen question).

- [ ] **Step 3: Implement.** In `pick.ts`:
  - import `isSeenPair` from `@/lib/student-figure-history`;
  - replace the `fresh` line, the `ordered` line and the pool choice:

```ts
  // A question is fresh when the student has not been asked it WITH THIS FIGURE (spec 2026-10-16 3.4).
  const fresh = (f: LibraryFigure, q: VettedQuestion) => !isSeenPair(o.seen, f.localPath, q.question?.question)
  const usable = o.library.filter((f) => allowed(f).length)
  const ordered = orderForStudent(interleave(shuffled(usable, next)), o.seen, (f) => allowed(f).some((q) => fresh(f, q)))
```

  and inside the loop:

```ts
    const open = allowed(f).filter((q) => !taken.has(questionKey(q.question?.question)))
    // Never a pair the student has had: a seen figure comes back only with a new question.
    const pool = open.filter((q) => fresh(f, q))
    if (!pool.length) continue
```

  Delete the old `unseen` and `pool` lines, and update the doc comment's last sentence to say this.

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run lib/figure-library/pick.test.ts lib/student-figure-history.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/figure-library/pick.ts lib/figure-library/pick.test.ts
git commit -m "feat(figure-library): the picker never returns a figure with a question the student was asked on it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: A source-aware switch and shared helpers in the local source

**Files:**
- Modify: `lib/figure-library/local-source.ts`
- Test: `lib/figure-library/local-source.test.ts`

**Interfaces:**
- Produces:
  - `librarySource(env?): 'postgres' | 'local' | null`;
  - `libraryEnabled(env?)` (true when `librarySource` is not null);
  - `nounFor(origin: string, kind: string): string`;
  - exported `drawnShows(family: string | null, kind: string, spec: string | null): string`;
  - `openStaging(file: string): StagingDb`, where `StagingDb = { prepare(sql: string): { all(...p: unknown[]): unknown[] }; close(): void }`.

- [ ] **Step 1: Write the failing test.** In `local-source.test.ts`:
  - change the import to `import { drawnShows, libraryEnabled, libraryFigures, librarySource, nounFor, toVetted } from './local-source'`;
  - add inside the describe:

```ts
  it('reads Postgres when FIGURE_LIBRARY_SOURCE says so, still needing the asset base', () => {
    expect(librarySource({ FIGURE_LIBRARY_SOURCE: 'postgres', FIGURE_ASSET_BASE: 'https://cdn/figure-library' })).toBe('postgres')
    expect(librarySource({ FIGURE_LIBRARY_SOURCE: 'postgres' })).toBe(null)
    expect(librarySource({ FIGURE_LIBRARY_DIR: 'C:/lib', FIGURE_ASSET_BASE: '/x' })).toBe('local')
    expect(librarySource({})).toBe(null)
    expect(libraryEnabled({ FIGURE_LIBRARY_SOURCE: 'postgres', FIGURE_ASSET_BASE: 'https://cdn' })).toBe(true)
  })

  it('names a figure as a reader would, and a drawn one by its family and title', () => {
    expect(nounFor('wikimedia', 'photo.micrograph')).toBe('micrograph')
    expect(nounFor('openstax', 'unknown.kind')).toBe('image')
    expect(nounFor('drawn', 'graph.bar')).toBe('diagram')
    expect(drawnShows('bar_chart', 'graph.bar', '{"title": "Rain in Huye"}')).toBe('bar chart: Rain in Huye')
  })
```

- [ ] **Step 2: Run it and watch it fail.**
  Run: `npx vitest run lib/figure-library/local-source.test.ts`
  Expected: FAIL (`librarySource` and `nounFor` are not exported).

- [ ] **Step 3: Implement.** In `local-source.ts`:

```ts
export type StagingDb = { prepare(sql: string): { all(...p: unknown[]): unknown[] }; close(): void }
// Loaded at call time: bundlers and jiti rewrite a static import of node:sqlite.
const sqlite = () => (process as unknown as { getBuiltinModule(id: string): { DatabaseSync: new (f: string, o?: object) => StagingDb } })
  .getBuiltinModule('node:sqlite')

/** The staging store, opened read-only. */
export function openStaging(file: string): StagingDb {
  return new (sqlite().DatabaseSync)(file, { readOnly: true })
}

/** Where library figures come from: Postgres in production, the local staging store in development, or nowhere. */
export function librarySource(env: Record<string, string | undefined> = process.env): 'postgres' | 'local' | null {
  if (!env.FIGURE_ASSET_BASE) return null
  if (env.FIGURE_LIBRARY_SOURCE === 'postgres') return 'postgres'
  return env.FIGURE_LIBRARY_DIR ? 'local' : null
}

export function libraryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return librarySource(env) !== null
}

/** What a reader calls the figure in a question: a real image by its kind, a drawn one a diagram. */
export function nounFor(origin: string, kind: string): string {
  return origin !== 'drawn' ? NOUNS[kind] ?? 'image' : 'diagram'
}
```

Also:
- rename the private `Db` type to `StagingDb`;
- make `drawnShows` `export function`;
- in `libraryFigures`, replace `new (sqlite().DatabaseSync)(file, { readOnly: true })` with `openStaging(file)`, and replace `noun: real ? NOUNS[r.kind] ?? 'image' : 'diagram'` with `noun: nounFor(r.origin, r.kind)`;
- update the file header: Postgres is the production source (`pg-source.ts`), this one is for development.

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run lib/figure-library/local-source.test.ts`
  Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add lib/figure-library/local-source.ts lib/figure-library/local-source.test.ts
git commit -m "feat(figure-library): FIGURE_LIBRARY_SOURCE=postgres switch; naming helpers shared with the Postgres source

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: The Postgres source

**Files:**
- Create: `lib/figure-library/pg-source.ts`
- Test: `lib/figure-library/pg-source.test.ts`

**Interfaces:**
- Consumes: `nounFor`, `toVetted`, `LibraryFigure` (Task 3); `Database` from `@/lib/db`.
- Produces:
  - `libraryFiguresPg(db: Database, o: { topicIds: readonly number[]; excludeAssets?: readonly string[]; limit?: number; base?: string; timeoutMs?: number }): Promise<{ figures: LibraryFigure[]; questions: Map<string, VettedQuestion[]> }>`;
  - `seenAssets(images: ReadonlySet<string>, base: string): string[]`.

- [ ] **Step 1: Write the failing tests.** Create `lib/figure-library/pg-source.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail.**
  Run: `npx vitest run lib/figure-library/pg-source.test.ts`
  Expected: FAIL (module `./pg-source` not found).

- [ ] **Step 3: Implement.** Create `lib/figure-library/pg-source.ts`:

```ts
/**
 * The figure library's approved figures from Postgres, for production quizzes (spec 2026-10-16 3.3).
 * Rows are published from the staging store by scripts/figure-library/publish.ts; files are on
 * CloudFront under FIGURE_ASSET_BASE. A lookup that fails or is slow gives nothing: the quiz is built
 * from the banks, as before. Server-only.
 */
import type { Database } from '@/lib/db'
import type { VettedQuestion } from '@/lib/figure-question-bank'
import { nounFor, toVetted, type LibraryFigure } from './local-source'

type FigureRow = { id: string; origin: string; family: string | null; kind: string; asset: string; credit: string | null
  shows: string | null; topic: string | null; book: string | null; books: string | null }
type QuestionRow = { figure_id: string; kind: string; stem: string; options: unknown; answer: string; accepted: unknown; explanation: string | null }

const trim = (base: string) => base.replace(/\/+$/, '')

/** The asset paths of library figures among a student's seen images, for leaving them out of a sample. */
export function seenAssets(images: ReadonlySet<string>, base: string): string[] {
  const prefix = `${trim(base)}/`
  return [...images].filter((i) => i.startsWith(prefix)).map((i) => i.slice(prefix.length))
}

export async function libraryFiguresPg(db: Database, o: {
  topicIds: readonly number[]; excludeAssets?: readonly string[]; limit?: number; base?: string; timeoutMs?: number
}): Promise<{ figures: LibraryFigure[]; questions: Map<string, VettedQuestion[]> }> {
  const empty = { figures: [] as LibraryFigure[], questions: new Map<string, VettedQuestion[]>() }
  const topicIds = o.topicIds.filter((n) => Number.isFinite(n))
  if (!topicIds.length) return empty
  const base = trim(o.base ?? process.env.FIGURE_ASSET_BASE ?? '')

  const work = async () => {
    const { rows } = await db.query<FigureRow>(
      `SELECT f.id, f.origin, f.family, f.kind, f.asset, f.credit, f.shows, f.topic, f.book, f.books
         FROM figure_library f
        WHERE f.id IN (SELECT figure_id FROM figure_library_topics WHERE topic_id = ANY($1::int[]))
          AND NOT (f.asset = ANY($2::text[]))
        ORDER BY random() LIMIT $3`,
      [topicIds, [...(o.excludeAssets ?? [])], o.limit ?? 300],
    )
    if (!rows.length) return empty
    const { rows: qs } = await db.query<QuestionRow>(
      `SELECT figure_id, kind, stem, options, answer, accepted, explanation
         FROM figure_library_questions WHERE figure_id = ANY($1::text[]) ORDER BY figure_id, n`,
      [rows.map((r) => r.id)],
    )
    const questions = new Map<string, VettedQuestion[]>()
    for (const q of qs) {
      const id = `lib:${q.figure_id}`
      questions.set(id, [...(questions.get(id) ?? []), toVetted({ kind: q.kind, stem: q.stem, options: JSON.stringify(q.options ?? []),
        answer: q.answer, accepted: JSON.stringify(q.accepted ?? []), explanation: q.explanation ?? '' })])
    }
    const figures: LibraryFigure[] = rows.map((r) => ({
      id: `lib:${r.id}`, source: r.family ?? r.origin,
      textbookIds: String(r.books ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite),
      textbookName: r.book ?? '', page: 0, localPath: `${base}/${r.asset}`, noun: nounFor(r.origin, r.kind),
      shows: r.shows ?? '', labels: [], topic: r.topic ?? '', original: '',
      ...(r.origin !== 'drawn' && r.credit ? { credit: r.credit } : {}),
    }))
    return { figures, questions }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const slow = new Promise<typeof empty>((resolve) => {
      timer = setTimeout(() => { console.error('Figure library lookup timed out'); resolve(empty) }, o.timeoutMs ?? 2000)
    })
    return await Promise.race([work(), slow])
  } catch (err) {
    console.error('Figure library unavailable:', (err as Error).message)
    return empty
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run lib/figure-library/pg-source.test.ts`
  Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add lib/figure-library/pg-source.ts lib/figure-library/pg-source.test.ts
git commit -m "feat(figure-library): a Postgres source for production quizzes, sampling the quiz topics and leaving out seen figures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: The migration and the publish script

**Files:**
- Create: `migrations/add-figure-library.sql`
- Create: `lib/figure-library/publish.ts`
- Create: `scripts/figure-library/publish.ts`
- Test: `lib/figure-library/publish.test.ts`

**Interfaces:**
- Consumes: `openStaging`, `drawnShows` (Task 3); `openPhraseAnswer` from `@/lib/figure-question-bank`.
- Produces:
  - `MIGRATION_FILE: string`;
  - `stagingBatches(file: string, size?: number): Generator<PublishBatch>`;
  - `writeBatch(db: Database, b: PublishBatch): Promise<void>`;
  - `PublishBatch` (figures, topics and questions rows as below).

- [ ] **Step 1: Write the migration.** Create `migrations/add-figure-library.sql`:

```sql
-- The figure library in production (docs/superpowers/specs/2026-10-16-figure-library-production-design.md 3.1).
-- Additive only; filled by scripts/figure-library/publish.ts, which applies this file first.
CREATE TABLE IF NOT EXISTS figure_library (
  id text PRIMARY KEY,
  origin text NOT NULL,
  family text,
  kind text NOT NULL,
  subject text NOT NULL,
  band text NOT NULL,
  asset text NOT NULL,
  preview text,
  width integer,
  height integer,
  credit text,
  shows text,
  topic text,
  book text,
  books text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS figure_library_topics (
  topic_id integer NOT NULL,
  figure_id text NOT NULL REFERENCES figure_library(id),
  PRIMARY KEY (topic_id, figure_id)
);
CREATE TABLE IF NOT EXISTS figure_library_questions (
  id text PRIMARY KEY,
  figure_id text NOT NULL REFERENCES figure_library(id),
  n integer NOT NULL,
  kind text NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  answer text NOT NULL,
  accepted jsonb NOT NULL DEFAULT '[]',
  explanation text NOT NULL DEFAULT '',
  tolerance real NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS figure_library_questions_figure ON figure_library_questions (figure_id);
```

- [ ] **Step 2: Write the failing tests.** Create `lib/figure-library/publish.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../../scripts/figure-library/store'
import { stagingBatches, writeBatch, type PublishBatch } from './publish'

function makeStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-pub-'))
  const file = path.join(dir, 'figures.db')
  const db = openStore(file, process.cwd())
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:2', 'cambridge', 77, 'IGCSE Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('jamb:Bio:1', 'jamb', NULL, 'JAMB Biology', 'biology', 'UP', 'Cells')").run()
  const fig = (id: string, origin: string, status: string, family: string | null, kind: string, credit: string | null, topics: string[], spec = '{}') => {
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, spec, credit, status, created_at)
      VALUES (?, ?, ?, ?, 'biology', 'UP', ?, ?, ?, ?, ?, 'now')`).run(id, origin, family, kind, `assets/${id}.svg`, `assets/${id}.png`, spec, credit, status)
    for (const t of topics) db.prepare('INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, ?)').run(id, t)
  }
  fig('wikimedia/1', 'wikimedia', 'approved', null, 'photo.micrograph', 'By A, CC BY 4.0', ['db:2'])
  fig('drawn/bar_chart/1', 'drawn', 'approved', 'bar_chart', 'graph.bar', null, ['db:2', 'jamb:Bio:1'], '{"title": "Rain"}')
  fig('drawn/bar_chart/2', 'drawn', 'approved', 'bar_chart', 'graph.bar', null, ['jamb:Bio:1'])
  fig('drawn/bar_chart/3', 'drawn', 'rejected', 'bar_chart', 'graph.bar', null, ['db:2'])
  db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES ('wikimedia/1', 'm', 1, 'Onion cells', '{}', 'now')").run()
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model) VALUES
    ('wikimedia/1#1', 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dot?', '["Nucleus","Wall"]', '0', '[]', 'DNA.', 'sonnet'),
    ('wikimedia/1#2', 'wikimedia/1', 2, 'UP', 'short', 'Why this shape?', '[]', 'they fit together tightly', '["they fit together tightly","to fit together with no gaps"]', '', 'sonnet'),
    ('drawn/bar_chart/1#1', 'drawn/bar_chart/1', 1, 'UP', 'short', 'How many mm?', '[]', '12', '["12","12 mm"]', '', 'code')`).run()
  db.close()
  return file
}

describe('publishing the library', () => {
  it('copies approved figures that reach a database topic, with only those links, and the questions a quiz can mark', () => {
    const [batch, ...rest] = [...stagingBatches(makeStore())]
    expect(rest).toEqual([])
    expect(batch.figures.map((f) => f.id)).toEqual(['drawn/bar_chart/1', 'wikimedia/1'])
    expect(batch.figures[0]).toMatchObject({ asset: 'assets/drawn/bar_chart/1.svg', shows: 'bar chart: Rain', topic: 'Cells', book: 'IGCSE Biology', books: '77', credit: null })
    expect(batch.figures[1]).toMatchObject({ shows: 'Onion cells', credit: 'By A, CC BY 4.0' })
    expect(batch.topics).toEqual([{ topic_id: 2, figure_id: 'drawn/bar_chart/1' }, { topic_id: 2, figure_id: 'wikimedia/1' }])
    // The open-phrase short answer is dropped, as the quiz drops it: it is marked by exact match.
    expect(batch.questions.map((q) => q.id)).toEqual(['drawn/bar_chart/1#1', 'wikimedia/1#1'])
    expect(batch.questions[1]).toMatchObject({ kind: 'mcq', options: '["Nucleus","Wall"]', answer: '0' })
  })

  it('splits into batches of the given size', () => {
    expect([...stagingBatches(makeStore(), 1)].map((b) => b.figures.length)).toEqual([1, 1])
  })

  it('writes a batch in one transaction, adding only what is new, and rolls back on error', async () => {
    const batch = [...stagingBatches(makeStore())][0]
    const sqls: string[] = []
    const ok = { query: async (sql: string) => { sqls.push(sql.trim().split(/\s+/).slice(0, 3).join(' ')); return { rows: [] } as never } }
    await writeBatch(ok, batch)
    expect(sqls).toEqual(['BEGIN', 'INSERT INTO figure_library', 'INSERT INTO figure_library_topics', 'INSERT INTO figure_library_questions', 'COMMIT'])

    const seen: string[] = []
    const failing = { query: async (sql: string) => { seen.push(sql.trim().split(/\s+/)[0]); if (sql.includes('figure_library_topics')) throw new Error('x'); return { rows: [] } as never } }
    await expect(writeBatch(failing, batch)).rejects.toThrow('x')
    expect(seen.at(-1)).toBe('ROLLBACK')
  })

  it('never updates or deletes: every insert does nothing on conflict', async () => {
    const batch: PublishBatch = [...stagingBatches(makeStore())][0]
    const full: string[] = []
    await writeBatch({ query: async (sql: string) => { full.push(sql); return { rows: [] } as never } }, batch)
    const inserts = full.filter((s) => s.includes('INSERT'))
    expect(inserts).toHaveLength(3)
    for (const s of inserts) expect(s).toMatch(/ON CONFLICT DO NOTHING/)
    expect(full.join(' ')).not.toMatch(/\b(UPDATE|DELETE)\b/)
  })
})
```

- [ ] **Step 3: Run them and watch them fail.**
  Run: `npx vitest run lib/figure-library/publish.test.ts`
  Expected: FAIL (module `./publish` not found).

- [ ] **Step 4: Implement `lib/figure-library/publish.ts`.**

```ts
/**
 * Publishing the figure library to Postgres (spec 2026-10-16 3.2): approved figures that reach a
 * database topic, those links only, and the questions a quiz can mark, read from the staging store
 * in batches and inserted with ON CONFLICT DO NOTHING -- never an update or a delete, so a run that
 * stopped half way is simply run again. Used by scripts/figure-library/publish.ts.
 */
import path from 'node:path'
import type { Database } from '../db'
import { openPhraseAnswer } from '../figure-question-bank'
import { drawnShows, openStaging } from './local-source'

export const MIGRATION_FILE = path.join(process.cwd(), 'migrations', 'add-figure-library.sql')

export interface PublishBatch {
  figures: { id: string; origin: string; family: string | null; kind: string; subject: string; band: string; asset: string; preview: string | null
    width: number | null; height: number | null; credit: string | null; shows: string; topic: string; book: string; books: string }[]
  topics: { topic_id: number; figure_id: string }[]
  questions: { id: string; figure_id: string; n: number; kind: string; stem: string; options: string; answer: string; accepted: string
    explanation: string; tolerance: number }[]
}

const list = (s: unknown): string[] => {
  try {
    const v = JSON.parse(String(s ?? '[]'))
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function* stagingBatches(file: string, size = 2000): Generator<PublishBatch> {
  const db = openStaging(file)
  try {
    const ids = (db.prepare(`SELECT DISTINCT f.id FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id
        WHERE f.status = 'approved' AND ft.topic_key LIKE 'db:%' ORDER BY f.id`).all() as { id: string }[]).map((r) => r.id)
    for (let i = 0; i < ids.length; i += size) {
      const chunk = ids.slice(i, i + size)
      const marks = chunk.map(() => '?').join(', ')
      const figs = db.prepare(`SELECT f.id, f.origin, f.family, f.kind, f.subject, f.band, f.asset, f.preview, f.width, f.height, f.spec, f.credit,
            s.shows, MIN(t.name) AS topic, MIN(t.book) AS book, GROUP_CONCAT(DISTINCT t.textbook_id) AS books
          FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
          LEFT JOIN screenings s ON s.figure_id = f.id
         WHERE f.id IN (${marks}) AND ft.topic_key LIKE 'db:%' GROUP BY f.id ORDER BY f.id`).all(...chunk) as Record<string, any>[]
      const links = db.prepare(`SELECT figure_id, topic_key FROM figure_topics
         WHERE figure_id IN (${marks}) AND topic_key LIKE 'db:%' ORDER BY topic_key, figure_id`).all(...chunk) as { figure_id: string; topic_key: string }[]
      const qs = db.prepare(`SELECT id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance FROM figure_questions
         WHERE figure_id IN (${marks}) ORDER BY figure_id, n`).all(...chunk) as Record<string, any>[]
      yield {
        figures: figs.map((r) => ({
          id: r.id, origin: r.origin, family: r.family ?? null, kind: r.kind, subject: r.subject, band: r.band, asset: r.asset,
          preview: r.preview ?? null, width: r.width ?? null, height: r.height ?? null, credit: r.origin !== 'drawn' ? r.credit ?? null : null,
          shows: (r.origin !== 'drawn' && r.shows) || drawnShows(r.family ?? null, r.kind, r.origin === 'drawn' ? r.spec ?? null : null),
          topic: r.topic ?? '', book: r.book ?? '', books: String(r.books ?? ''),
        })),
        topics: links.map((l) => ({ topic_id: Number(l.topic_key.slice(3)), figure_id: l.figure_id })).filter((l) => Number.isInteger(l.topic_id)),
        // A short answer only a sentence can give is dropped, as the quiz drops it (local-source.ts).
        questions: qs.filter((q) => !(q.kind === 'short' && openPhraseAnswer(list(q.accepted), q.stem))).map((q) => ({
          id: q.id, figure_id: q.figure_id, n: Number(q.n), kind: q.kind, stem: q.stem, options: String(q.options ?? '[]'), answer: String(q.answer),
          accepted: String(q.accepted ?? '[]'), explanation: q.explanation ?? '', tolerance: Number(q.tolerance ?? 0),
        })),
      }
    }
  } finally {
    db.close()
  }
}

/** One batch, all or nothing, adding only rows not already there. `db` must be ONE connection (a pg Client). */
export async function writeBatch(db: Database, b: PublishBatch): Promise<void> {
  const col = <T, K extends keyof T>(rows: T[], k: K) => rows.map((r) => r[k])
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO figure_library (id, origin, family, kind, subject, band, asset, preview, width, height, credit, shows, topic, book, books)
      SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::int[], $10::int[],
                           $11::text[], $12::text[], $13::text[], $14::text[], $15::text[])
      ON CONFLICT DO NOTHING`,
      (['id', 'origin', 'family', 'kind', 'subject', 'band', 'asset', 'preview', 'width', 'height', 'credit', 'shows', 'topic', 'book', 'books'] as const)
        .map((k) => col(b.figures, k)))
    await db.query(`INSERT INTO figure_library_topics (topic_id, figure_id)
      SELECT * FROM unnest($1::int[], $2::text[]) ON CONFLICT DO NOTHING`, [col(b.topics, 'topic_id'), col(b.topics, 'figure_id')])
    await db.query(`INSERT INTO figure_library_questions (id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance)
      SELECT id, figure_id, n, kind, stem, options::jsonb, answer, accepted::jsonb, explanation, tolerance
        FROM unnest($1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::real[])
          AS t(id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance)
      ON CONFLICT DO NOTHING`,
      (['id', 'figure_id', 'n', 'kind', 'stem', 'options', 'answer', 'accepted', 'explanation', 'tolerance'] as const).map((k) => col(b.questions, k)))
    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}
```

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run lib/figure-library/publish.test.ts`
  Expected: PASS (4 tests).

- [ ] **Step 6: Write the CLI.** Create `scripts/figure-library/publish.ts`:

```ts
/**
 * Publish the figure library to the app's Postgres (spec 2026-10-16 3.2).
 *
 *   JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/figure-library/publish.ts
 *       dry run (the default): counts and an estimated size; writes nothing
 *   ... --apply --yes-production
 *       applies migrations/add-figure-library.sql (additive), then inserts in batches; safe to re-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { MIGRATION_FILE, stagingBatches, writeBatch } from '../../lib/figure-library/publish'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  try { process.loadEnvFile(path.join(process.cwd(), '.env')) } catch { /* settings from the environment */ }
  const file = path.join(process.env.FIGURE_LIBRARY_DIR || 'C:/Users/Stephen/figure-library', 'figures.db')
  const totals = { figures: 0, topics: 0, questions: 0, bytes: 0 }
  const add = (b: { figures: unknown[]; topics: unknown[]; questions: unknown[] }) => {
    totals.figures += b.figures.length; totals.topics += b.topics.length; totals.questions += b.questions.length
    totals.bytes += JSON.stringify(b).length
  }
  if (!apply) {
    for (const b of stagingBatches(file)) add(b)
    console.log(`Dry run: ${totals.figures} figures, ${totals.topics} topic links, ${totals.questions} questions, about ${(totals.bytes / 1e6).toFixed(0)} MB of row data (plus indexes). Nothing written.`)
    return
  }
  if (!args.includes('--yes-production')) throw new Error('--apply also needs --yes-production')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const host = new URL(url).hostname
  console.log(`Writing to ${host.includes('rds.amazonaws.com') ? 'AWS RDS' : host.includes('supabase') ? 'Supabase' : 'another Postgres host'}`)
  const client = new Client({ connectionString: url, ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(fs.readFileSync(MIGRATION_FILE, 'utf8'))
    let n = 0
    for (const b of stagingBatches(file)) {
      await writeBatch(client, b)
      add(b)
      if (++n % 10 === 0) console.log(`  ${totals.figures} figures written`)
    }
    const { rows } = await client.query(`SELECT (SELECT count(*) FROM figure_library) AS figures,
      (SELECT count(*) FROM figure_library_topics) AS topics, (SELECT count(*) FROM figure_library_questions) AS questions`)
    console.log(`Published. In the database now: ${rows[0].figures} figures, ${rows[0].topics} topic links, ${rows[0].questions} questions.`)
  } finally {
    await client.end()
  }
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
```

- [ ] **Step 7: Dry-run it against the real staging store.**
  Run: `JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/figure-library/publish.ts`
  Expected: "Dry run: about 318 000 figures, about 1 857 000 topic links, about 9xx 000 questions …". Nothing is written.

- [ ] **Step 8: Commit.**

```bash
git add migrations/add-figure-library.sql lib/figure-library/publish.ts lib/figure-library/publish.test.ts scripts/figure-library/publish.ts
git commit -m "feat(figure-library): additive tables and a publish script from the staging store (dry run by default)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Wire the quiz route

**Files:**
- Modify: `app/api/generate-assessment/route.ts` (the history block at ~L1721–1740, the bank ordering at ~L1765, the library block at ~L1776–1788, the `vettedFor` call at ~L2482)

**Interfaces:**
- Consumes:
  - `readSeenFigures`, `askedWith`, `NO_HISTORY`, `SeenFigures` (Task 1);
  - `librarySource`, `libraryEnabled`, `libraryFigures` (Task 3);
  - `libraryFiguresPg`, `seenAssets` (Task 4).

- [ ] **Step 1: Replace the history block.** Replace the whole `let seenFigures: SeenFigures = NO_HISTORY` … `}` block with:

```ts
    // The figure questions this student had in their recent quizzes of any kind, so no figure comes
    // back with a question they were asked on it (spec 2026-10-16 3.4). A failed lookup costs nothing.
    const seenFigures: SeenFigures = userId ? await readSeenFigures(db, String(userId)) : NO_HISTORY
```

  Add `readSeenFigures, askedWith` to the existing import from `@/lib/student-figure-history`.

- [ ] **Step 2: Judge bank figures by pair.**
  - Replace `seenFigures, (f) => hasFreshVetted(f.id, figureKinds, seenFigures.questions))` with `seenFigures, (f) => hasFreshVetted(f.id, figureKinds, askedWith(seenFigures, f.localPath)))`.
  - Update the comment above it to: "Unseen first, then seen ones with a question not yet asked with them; none that would repeat a pair."
  - In `generateTextbookFigureQuestion`, replace `vettedFor(fig.id, allowed, kind, undefined, seenFigures.questions)` with `vettedFor(fig.id, allowed, kind, undefined, askedWith(seenFigures, fig.localPath))`.

- [ ] **Step 3: Read the library from the configured source.** Replace `const library = libraryFigures({ topicIds: libraryTopics })` with:

```ts
      const library = librarySource() === 'postgres'
        ? await libraryFiguresPg(db, { topicIds: libraryTopics, excludeAssets: seenAssets(seenFigures.images, process.env.FIGURE_ASSET_BASE ?? '') })
        : libraryFigures({ topicIds: libraryTopics })
```

  Then:
  - add `librarySource` to the existing `local-source` import;
  - add `import { libraryFiguresPg, seenAssets } from '@/lib/figure-library/pg-source'`;
  - update the comment above `figureShare`: Postgres in production (`FIGURE_LIBRARY_SOURCE=postgres`), the local store in development.

- [ ] **Step 4: Type-check and run the related tests.**
  Run: `npx tsc --noEmit -p . 2>&1 | grep -E "generate-assessment/route|figure-library|student-figure-history"`
  Expected: no output.
  Run: `npx vitest run lib/student-figure-history.test.ts lib/figure-library lib/figure-question-bank.test.ts lib/textbook-figure-bank.test.ts`
  Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add app/api/generate-assessment/route.ts
git commit -m "feat(assessment): quizzes take library figures from Postgres in production; history covers every quiz and repeats no pair

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Publish, check the build, push, verify live

**Files:** none (rollout). Each step's result goes in the ledger.

- [ ] **Step 1: Publish.** The user approved publishing in the spec (approach A). Run in the background and wait for it:
  `JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/figure-library/publish.ts --apply --yes-production`
  Expected: "Published. In the database now: N figures, M topic links, K questions", where N, M and K match the dry run.

- [ ] **Step 2: Read-only smoke test of the source against production.** Create the scratchpad script `pg_smoke.ts`. It loads `.env`, opens `lib/db`, and calls `libraryFiguresPg(db, { topicIds: [<a topic id with library figures, from the dry run>], base: 'https://dtj4jtk2hgh9l.cloudfront.net/figure-library' })` twice. It prints the figure count, the questions per figure, one `localPath`, and the time each call took.
  Expected: about 300 figures, under 1 s; the `localPath` returns 200 from `curl -I`.

- [ ] **Step 3: Production build and size estimate.**
  - Run `npx next build` and confirm it completes.
  - Estimate the Amplify build output as the size-limit memory describes: the union of every file in `.next/server/**/*.nft.json` and `.next/next-server.js.nft.json` (git-tracked files only), plus `.next` minus `cache`, `dev` and `trace`.
  - Expected: at most about 150 million bytes.

- [ ] **Step 4: Boot test a database route.**
  - Run `npx next start -p 3200` in the background.
  - Run `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3200/api/classes?country=RW"`.
  - Expected: `200`. Then stop the server.

- [ ] **Step 5: The user sets three Amplify environment variables** (App → Hosting → Environment variables, branch `aws_deploy`):
  - `NEXT_PUBLIC_FIGURE_BASE_URL=https://dtj4jtk2hgh9l.cloudfront.net`
  - `FIGURE_LIBRARY_SOURCE=postgres`
  - `FIGURE_ASSET_BASE=https://dtj4jtk2hgh9l.cloudfront.net/figure-library`

  Wait for the user to confirm they are saved.

- [ ] **Step 6: Push.** Use the push-account helper:
  `git -c credential.helper= -c 'credential.helper=!f() { test "$1" = get || exit 0; echo username=eseosapku; echo "password=$(gh auth token --user eseosapku)"; }; f' push origin aws_deploy`
  Check it landed with `git ls-remote` (using the same helper).

- [ ] **Step 7: Verify live.**
  - The user confirms the Amplify build for the pushed commit succeeded.
  - `curl -sL https://studysquare.org/assessment` gives 200.
  - The user takes a quiz on a library topic with a test account they control: figures load from `dtj4jtk2hgh9l.cloudfront.net`, and the Next button stays put.
  - A second quiz on the same topic shows no figure with a question it was asked with before.

### Task 8: Take the textbook images out of the repository

**Files:**
- Delete: `public/textbook-images/**`, `public/exam-images/**` (tracked files only)

- [ ] **Step 1: Confirm live images come from CloudFront.** `curl -sL https://studysquare.org` must still load, and a figure question in a live quiz must show an image whose URL starts with `https://dtj4jtk2hgh9l.cloudfront.net/textbook-images/`. The user checks this in the browser.

- [ ] **Step 2: Remove and commit.**

```bash
git rm -r -q --cached public/textbook-images public/exam-images
git commit -m "chore: textbook and exam images are served from CloudFront; take them out of the repository

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

  Keep the local copies on disk, untracked (`.gitignore` gains `public/textbook-images/` and `public/exam-images/`).

- [ ] **Step 3: Push and verify.** Push with the helper. When the build deploys, the user checks one textbook-figure quiz again. A fresh clone can now use `git clone --depth 1 -b aws_deploy https://github.com/eseosapku/AI_assessment.git`.
