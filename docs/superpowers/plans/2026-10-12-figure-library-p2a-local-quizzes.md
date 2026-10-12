# Figure Library P2a: Library Figures in Real Quizzes, Locally

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On this machine, an ordinary textbook quiz on a pilot topic shows approved library figures, drawn or real, with their checked questions. Real images carry their credit line. Nothing changes for production until S3 exists.

**Architecture:**
- **Source.** A server-only library source reads the local staging store, read-only, when `FIGURE_LIBRARY_DIR` and `FIGURE_ASSET_BASE` are both set. It returns approved figures linked to the quiz's topic ids (`db:<topic id>`), shaped as `TextbookFigure`, and their questions in the vetted-bank format.
- **Route.** The quiz route adds library figures after the existing bank figures, under the same 60% share, student-history ordering and vetted-question path. Each library question is registered in the vetted bank under the figure's `lib:` id.
- **Files.** A dev-only route serves the library's files from the local folder.
- **Credits.** `ExamFigure` gains a credit line.
- **Approval and coverage.** Drawn figures get an approval step to match real images, and a coverage script reports approved figures per topic.

**Tech Stack:** Next.js 16.3 route handlers (`params` is a Promise; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), `node:sqlite` through `process.getBuiltinModule`, vitest (node) and tsc.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`: section 5.4 (quiz route, credit), 5.6 (local first, `FIGURE_ASSET_BASE`, dev route) and section 9 (P2 exit).

## Global Constraints

- **Production is untouched.**
  - No write to the production database. The source opens the local store read-only.
  - With `FIGURE_ASSET_BASE` or `FIGURE_LIBRARY_DIR` unset, as on Amplify, the route behaves exactly as before.
  - The asset route answers 404 in production.
- **Existing behaviour stays.**
  - The banks stay first for their own books (spec 5.4).
  - Repeat avoidance (`orderForStudent`, `seenFromRows`) and question-key de-duplication apply unchanged.
- **Approval.**
  - Only approved figures are served: real images with status `approved` (P1b `approveReal`), and drawn figures with status `approved` (Task 1).
- **Commits and constraints carried over.**
  - Commits stay local on `aws_deploy`, and the three unrelated working-tree files stay out of them.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Do not touch `app/api/studylab/grade/route.ts`, `app/api/studylab/snap/route.ts` or `lib/textbook-vision-images.ts`.

## Review Focus

1. **The env vars unset, as in production.** Expected: no library code runs, and quizzes are built as before. Pinned in Task 2 (`is off without both settings`).
2. **A request for `../` or an absolute path in the asset route.** Expected: 404, and no file outside the library's `assets` folder is ever read. Pinned in Task 4.
3. **A topic with bank figures and library figures both.** Expected: the bank's come first, and the total stays within the quiz's figure share. Pinned in Task 3.
4. **A library figure with no question of the quiz's kinds** (an MCQ-only quiz with a short-answer-only figure). Expected: it is left out. Pinned in Task 3.
5. **The store missing or locked.** Expected: the quiz is built without library figures. Pinned in Task 2 (`gives nothing when the store cannot be opened`).

---

### Task 1: Approve drawn figures

**Files:** modify `scripts/figure-library/review.ts` and `scripts/figure-library/review-drawn.ts`; test `scripts/figure-library/review.test.ts`.

**Produces:** `approveDrawn(db, job) -> {approved, families}`. It approves every non-rejected figure of each family that passes in `job` (27 of 30). The `review-drawn.ts --approve` option runs it and sends nothing.

- [ ] **Step 1: Failing test.** Add to `review.test.ts` (and add `approveDrawn` to the import):

```ts
describe('approving drawn figures', () => {
  it('approves the figures of families that passed, leaving rejected figures and failing families alone', () => {
    const db = store()
    const fill = (family: string, n: number, failures: number) => {
      for (let s = 1; s <= n; s++) {
        const id = addFigure(db, family, s)
        saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: { ...parseVerdict(good, item), pass: s > failures } })
      }
    }
    fill('a', 30, 2)
    fill('b', 30, 5)
    expect(approveDrawn(db, 'j')).toEqual({ approved: 28, families: ['a'] })
    expect(db.prepare("SELECT COUNT(*) AS n FROM figures WHERE family = 'a' AND status = 'approved'").get()).toEqual({ n: 28 })
    expect(db.prepare("SELECT COUNT(*) AS n FROM figures WHERE family = 'a' AND status = 'rejected'").get()).toEqual({ n: 2 })
    expect(db.prepare("SELECT COUNT(*) AS n FROM figures WHERE family = 'b' AND status = 'approved'").get()).toEqual({ n: 0 })
  })
})
```

- [ ] **Step 2: Run it.** `npx vitest run scripts/figure-library/review.test.ts` → FAIL: `approveDrawn` is not a function.

- [ ] **Step 3: Implement** in `review.ts`:

```ts
/**
 * Approves the drawn figures of every family that passes its blind review in this job (27 of 30):
 * all its figures not rejected, including those beyond the reviewed sample, since a family is
 * judged as a whole. P2 serves figures with status 'approved'.
 */
export function approveDrawn(db: Store, job: string): { approved: number; families: string[] } {
  const families = familyScores(db, job).filter((s) => s.passes).map((s) => s.family)
  let approved = 0
  for (const family of families) {
    approved += Number(db.prepare("UPDATE figures SET status = 'approved', reason = NULL WHERE origin = 'drawn' AND family = ? AND status <> 'rejected'")
      .run(family).changes)
  }
  return { approved, families }
}
```

  In `review-drawn.ts`:
  - add `approve: 'flag'` to `parseArgs`;
  - after `openStore()`, add `if (args.approve) { const r = approveDrawn(db, REVIEW_JOB); console.log(\`Approved ${r.approved} figures in ${r.families.length} families\`); db.close(); return }`;
  - import `approveDrawn`.

- [ ] **Step 4: Run** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → pass. **Commit:** `feat(figure-library): approve the drawn figures of families that passed review`.

---

### Task 2: The local library source

**Files:** create `lib/figure-library/local-source.ts`; modify `lib/figure-question-bank.ts` (add `addVetted`) and `lib/textbook-figure-bank.ts` (an optional `credit` on `TextbookFigure`); test `lib/figure-library/local-source.test.ts`.

**Produces:**
- `libraryEnabled(env = process.env) -> boolean`, true only when both `FIGURE_LIBRARY_DIR` and `FIGURE_ASSET_BASE` are set.
- `libraryFigures({ topicIds, file?, base? }) -> { figures: TextbookFigure[]; questions: Map<string, VettedQuestion[]> }`:
  - every approved figure linked to `db:<id>` for any of `topicIds`;
  - id `lib:<figure id>`;
  - `localPath` = `<base>/<asset key>`;
  - `credit` set for real images;
  - `textbookIds` taken from the linked topics.
  - It never throws: a missing store gives empty results.
- `toVetted(row) -> VettedQuestion` (exported for the test):
  - MCQ → `{kind:'mcq', question:{type:'mcq', question, options, correct_answer, explanation}}`;
  - short → `{kind:'short', question:{type:'longform', question, marks:1, short_answer:{accepted}, explanation}}`.
- `addVetted(map)` in `figure-question-bank.ts` merges questions into the loaded bank, for `hasVetted` and `vettedFor`.

- [ ] **Step 1: Failing tests.** Create `lib/figure-library/local-source.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../../scripts/figure-library/store'
import { libraryEnabled, libraryFigures, toVetted } from './local-source'
import { addVetted, hasVetted, resetFigureQuestionBank, vettedFor } from '../figure-question-bank'

function makeStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-src-'))
  const file = path.join(dir, 'figures.db')
  const db = openStore(file, process.cwd())
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:2', 'cambridge', 77, 'Cambridge IGCSE Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:9', 'cambridge', 77, 'Cambridge IGCSE Biology', 'biology', 'UP', 'Enzymes')").run()
  const fig = (id: string, origin: string, status: string, family: string | null, kind: string, credit: string | null) => {
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, spec, credit, status, created_at)
      VALUES (?, ?, ?, ?, 'biology', 'UP', ?, ?, '{}', ?, ?, 'now')`).run(id, origin, family, kind, `assets/${id}.webp`, `assets/${id}-512.jpg`, credit, status)
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(id)
  }
  fig('wikimedia/1', 'wikimedia', 'approved', null, 'photo.micrograph', 'Onion cells by A, CC BY 4.0, via Wikimedia Commons')
  fig('wikimedia/2', 'wikimedia', 'screened', null, 'photo.micrograph', 'x')
  fig('drawn/punnett/1', 'drawn', 'approved', 'punnett', 'bio.genetics', null)
  db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES ('wikimedia/1', 'm', 1, 'Onion epidermis cells with nuclei', '{}', 'now')").run()
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model) VALUES
    ('wikimedia/1#sonnet#1', 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dark dot?', '["Nucleus","Vacuole","Wall","Membrane"]', '0', '[]', 'It holds DNA.', 'sonnet'),
    ('drawn/punnett/1#1', 'drawn/punnett/1', 1, 'UP', 'short', 'What percentage are short?', '[]', '25%', '["25%","25"]', '', 'code')`).run()
  db.close()
  return file
}

describe('the local library source', () => {
  it('is off without both settings, as in production', () => {
    expect(libraryEnabled({})).toBe(false)
    expect(libraryEnabled({ FIGURE_LIBRARY_DIR: 'C:/lib' })).toBe(false)
    expect(libraryEnabled({ FIGURE_ASSET_BASE: '/api/figure-library/asset' })).toBe(false)
    expect(libraryEnabled({ FIGURE_LIBRARY_DIR: 'C:/lib', FIGURE_ASSET_BASE: '/x' })).toBe(true)
  })

  it('gives the approved figures of the quiz topics, shaped like bank figures, with their credit', () => {
    const { figures, questions } = libraryFigures({ topicIds: [2], file: makeStore(), base: '/api/figure-library/asset' })
    expect(figures.map((f) => f.id).sort()).toEqual(['lib:drawn/punnett/1', 'lib:wikimedia/1'])
    const real = figures.find((f) => f.id === 'lib:wikimedia/1')!
    expect(real).toMatchObject({ textbookIds: [77], textbookName: 'Cambridge IGCSE Biology', topic: 'Cells',
      localPath: '/api/figure-library/asset/assets/wikimedia/1.webp', shows: 'Onion epidermis cells with nuclei',
      credit: 'Onion cells by A, CC BY 4.0, via Wikimedia Commons' })
    expect(figures.find((f) => f.id === 'lib:drawn/punnett/1')!.credit).toBeUndefined()
    expect(questions.get('lib:wikimedia/1')).toEqual([{ kind: 'mcq', question: { type: 'mcq', question: 'What is the dark dot?',
      options: ['Nucleus', 'Vacuole', 'Wall', 'Membrane'], correct_answer: 0, explanation: 'It holds DNA.' } }])
  })

  it('gives nothing for other topics, and nothing when the store cannot be opened', () => {
    expect(libraryFigures({ topicIds: [9], file: makeStore(), base: '/x' }).figures).toEqual([])
    expect(libraryFigures({ topicIds: [2], file: path.join(os.tmpdir(), 'no-such-dir', 'figures.db'), base: '/x' }).figures).toEqual([])
  })

  it('converts a short answer to the bank format', () => {
    expect(toVetted({ kind: 'short', stem: 'What %?', options: '[]', answer: '25%', accepted: '["25%","25"]', explanation: '' }))
      .toEqual({ kind: 'short', question: { type: 'longform', question: 'What %?', marks: 1, short_answer: { accepted: ['25%', '25'] }, explanation: '' } })
  })

  it('registers its questions with the vetted bank', () => {
    resetFigureQuestionBank(new Map())
    const { questions } = libraryFigures({ topicIds: [2], file: makeStore(), base: '/x' })
    addVetted(questions)
    expect(hasVetted('lib:wikimedia/1', ['mcq'])).toBe(true)
    expect(hasVetted('lib:drawn/punnett/1', ['mcq'])).toBe(false)
    expect(vettedFor('lib:drawn/punnett/1', ['short'])?.short_answer.accepted).toEqual(['25%', '25'])
    resetFigureQuestionBank()
  })
})
```

- [ ] **Step 2: Run them.** `npx vitest run lib/figure-library/local-source.test.ts` → FAIL: `./local-source` cannot be found.

- [ ] **Step 3: Implement.**
  - In `lib/textbook-figure-bank.ts`, add to `TextbookFigure`: `/** The credit line a real image must carry (author, licence, source); figure-library images only. */ credit?: string`.
  - In `lib/figure-question-bank.ts`:

```ts
/**
 * Adds questions to the loaded bank: the figure library's, registered per quiz under their
 * "lib:" ids so hasVetted and vettedFor treat them like any other vetted figure.
 */
export function addVetted(questions: ReadonlyMap<string, VettedQuestion[]>): void {
  const bank = loadFigureQuestionBank()
  for (const [id, list] of questions) if (list.length) bank.set(id, list)
}
```

  - Create `lib/figure-library/local-source.ts`:

```ts
/**
 * Figures from the figure library's local staging store, for quizzes on this machine before S3
 * exists (spec 5.6). Read-only, and only when FIGURE_LIBRARY_DIR and FIGURE_ASSET_BASE are both
 * set -- never on Amplify, where neither is. Server-only.
 */
import path from 'node:path'
import type { TextbookFigure } from '@/lib/textbook-figure-bank'
import type { VettedQuestion } from '@/lib/figure-question-bank'

type Db = { prepare(sql: string): { all(...p: unknown[]): unknown[] }; close(): void }
const sqlite = () => (process as unknown as { getBuiltinModule(id: string): { DatabaseSync: new (f: string, o?: object) => Db } })
  .getBuiltinModule('node:sqlite')

export function libraryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.FIGURE_LIBRARY_DIR && env.FIGURE_ASSET_BASE)
}

/** What a reader calls each kind of figure, for the figure's description in a question. */
const NOUNS: Record<string, string> = { 'photo.micrograph': 'micrograph', 'photo.landscape': 'photograph', 'photo.specimen': 'photograph',
  'photo.apparatus': 'photograph', 'photo.object': 'photograph', 'source.historical': 'source' }

const list = (s: unknown): string[] => { try { const v = JSON.parse(String(s ?? '[]')); return Array.isArray(v) ? v.map(String) : [] } catch { return [] } }

export function toVetted(q: { kind: string; stem: string; options: string; answer: string; accepted: string; explanation: string }): VettedQuestion {
  if (q.kind === 'mcq') {
    return { kind: 'mcq', question: { type: 'mcq', question: q.stem, options: list(q.options), correct_answer: Number(q.answer), explanation: q.explanation ?? '' } }
  }
  return { kind: 'short', question: { type: 'longform', question: q.stem, marks: 1, short_answer: { accepted: list(q.accepted) }, explanation: q.explanation ?? '' } }
}

export function libraryFigures(o: { topicIds: readonly number[]; file?: string; base?: string }): { figures: TextbookFigure[]; questions: Map<string, VettedQuestion[]> } {
  const empty = { figures: [] as TextbookFigure[], questions: new Map<string, VettedQuestion[]>() }
  const keys = o.topicIds.filter((n) => Number.isFinite(n)).map((n) => `db:${n}`)
  if (!keys.length) return empty
  const file = o.file ?? path.join(process.env.FIGURE_LIBRARY_DIR ?? '', 'figures.db')
  const base = (o.base ?? process.env.FIGURE_ASSET_BASE ?? '').replace(/\/+$/, '')
  let db: Db | null = null
  try {
    db = new (sqlite().DatabaseSync)(file, { readOnly: true })
    const marks = keys.map(() => '?').join(', ')
    const rows = db.prepare(`SELECT f.id, f.origin, f.family, f.kind, f.asset, f.credit, s.shows,
        MIN(t.name) AS topic, MIN(t.book) AS book, GROUP_CONCAT(DISTINCT t.textbook_id) AS books
      FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
      LEFT JOIN screenings s ON s.figure_id = f.id
      WHERE f.status = 'approved' AND ft.topic_key IN (${marks})
      GROUP BY f.id ORDER BY f.id`).all(...keys) as { id: string; origin: string; family: string | null; kind: string; asset: string;
      credit: string | null; shows: string | null; topic: string; book: string; books: string | null }[]
    const qs = db.prepare('SELECT kind, stem, options, answer, accepted, explanation FROM figure_questions WHERE figure_id = ? ORDER BY n')
    const figures: TextbookFigure[] = []
    const questions = new Map<string, VettedQuestion[]>()
    for (const r of rows) {
      const id = `lib:${r.id}`
      const real = r.origin !== 'drawn'
      figures.push({
        id, textbookIds: String(r.books ?? '').split(',').map(Number).filter(Number.isFinite), textbookName: r.book, page: 0,
        localPath: `${base}/${r.asset}`, noun: real ? NOUNS[r.kind] ?? 'image' : 'diagram',
        shows: r.shows || (r.family ?? r.kind).replace(/_/g, ' '), labels: [], topic: r.topic, original: '',
        ...(real && r.credit ? { credit: r.credit } : {}),
      })
      questions.set(id, (qs.all(r.id) as Parameters<typeof toVetted>[0][]).map(toVetted))
    }
    return { figures, questions }
  } catch (err) {
    console.error('Figure library unavailable:', (err as Error).message)
    return empty
  } finally {
    db?.close()
  }
}
```

- [ ] **Step 4: Run** `npx vitest run lib/figure-library lib/figure-question-bank.test.ts lib/textbook-figure-bank.test.ts && npx tsc --noEmit -p .` → pass. **Commit:** `feat(figure-library): a read-only local source of approved library figures for quizzes`.

---

### Task 3: Library figures in the quiz route

**Files:**
- Create `lib/figure-library/pick.ts`.
- Modify `app/api/generate-assessment/route.ts`, at the `quizFigures` block (about line 1742) and the vetted branch (about line 2462).
- Test `lib/figure-library/pick.test.ts`.

**Produces:** `withLibrary(bank, library, target, usable) -> TextbookFigure[]`. Bank figures come first, then library figures that pass `usable`, up to `target`.

- [ ] **Step 1: Failing test.** Create `lib/figure-library/pick.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { withLibrary } from './pick'

const f = (id: string) => ({ id, textbookIds: [], textbookName: '', page: 0, localPath: `/${id}`, noun: '', shows: '', labels: [], topic: '', original: '' })

describe('library figures after the bank', () => {
  it('keeps the bank first and the total within the share', () => {
    expect(withLibrary([f('b1'), f('b2')], [f('l1'), f('l2'), f('l3')], 3, () => true).map((x) => x.id)).toEqual(['b1', 'b2', 'l1'])
    expect(withLibrary([f('b1'), f('b2'), f('b3')], [f('l1')], 3, () => true).map((x) => x.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('leaves out library figures without a question this quiz can use', () => {
    expect(withLibrary([], [f('l1'), f('l2')], 5, (x) => x.id === 'l2').map((x) => x.id)).toEqual(['l2'])
  })
})
```

- [ ] **Step 2: Run it.** → FAIL: `./pick` cannot be found.

- [ ] **Step 3: Implement.** Create `lib/figure-library/pick.ts`:

```ts
import type { TextbookFigure } from '@/lib/textbook-figure-bank'

/**
 * A quiz's figures: the bank's first (spec 5.4: the existing banks stay first for their own
 * books), then the library's that have a question this quiz can use, up to the quiz's share.
 */
export function withLibrary<T extends Pick<TextbookFigure, 'id'>>(bank: readonly T[], library: readonly T[], target: number, usable: (f: T) => boolean): T[] {
  return [...bank, ...library.filter(usable)].slice(0, Math.max(0, target))
}
```

  In `route.ts`:
  - **Imports:** add `import { libraryEnabled, libraryFigures } from '@/lib/figure-library/local-source'` and `import { withLibrary } from '@/lib/figure-library/pick'`, and add `addVetted` to the `@/lib/figure-question-bank` import.
  - **The `quizFigures` block:** change `const quizFigures: TextbookFigure[] = bankApplies ? orderForStudent(...).slice(0, Math.max(0, Math.round(count * 0.6))) : []` so it is named `bankFigures`. Then add:

```ts
    // The figure library's approved figures for these topics, after the bank's (spec 5.4), on
    // this machine only until S3 exists: off unless FIGURE_LIBRARY_DIR and FIGURE_ASSET_BASE are set.
    const figureShare = Math.max(0, Math.round(count * 0.6))
    let quizFigures: TextbookFigure[] = bankFigures
    if (bankApplies && libraryEnabled() && bankFigures.length < figureShare && topicIds.length) {
      const library = libraryFigures({ topicIds })
      addVetted(library.questions)
      quizFigures = withLibrary(bankFigures, orderForStudent(library.figures, seenFigures,
        (f) => hasFreshVetted(f.id, figureKinds, seenFigures.questions)), figureShare, (f) => hasVetted(f.id, figureKinds))
      if (quizFigures.length > bankFigures.length) console.log(`Figure library: ${quizFigures.length - bankFigures.length} figure(s) for topics [${topicIds.slice(0, 4).join(', ')}]`)
    }
```

  - **The vetted branch of `generateTextbookFigureQuestion`:** after `vetted.vetted = true`, add `if (fig.credit) vetted.image_credit = fig.credit`.
  - Check that `topicIds` is an array of numbers there; adapt if it is held as strings, and record any adaptation as a ruling.

- [ ] **Step 4: Run** `npx vitest run lib/figure-library && npx tsc --noEmit -p .` → pass. **Commit:** `feat(figure-library): approved library figures join textbook quizzes, after the bank's`.

---

### Task 4: The dev-only asset route

**Files:** create `lib/figure-library/asset.ts` and `app/api/figure-library/asset/[...key]/route.ts`; test `lib/figure-library/asset.test.ts`.

**Produces:** `resolveAsset(dir, parts) -> { file, type } | null`. It returns only a file under `<dir>/assets` with a known image extension. The route serves it when `FIGURE_LIBRARY_DIR` is set and `NODE_ENV !== 'production'`, and answers 404 otherwise.

- [ ] **Step 1: Failing test.** Create `lib/figure-library/asset.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveAsset } from './asset'

describe('serving library files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-asset-'))
  fs.mkdirSync(path.join(dir, 'assets', 'wikimedia'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'assets', 'wikimedia', '1.webp'), 'x')
  fs.writeFileSync(path.join(dir, 'figures.db'), 'secret')

  it('finds a file under the assets folder, with its type', () => {
    expect(resolveAsset(dir, ['assets', 'wikimedia', '1.webp'])).toEqual({ file: path.join(dir, 'assets', 'wikimedia', '1.webp'), type: 'image/webp' })
  })

  it('never reaches outside the assets folder, nor serves other kinds of file', () => {
    expect(resolveAsset(dir, ['assets', '..', 'figures.db'])).toBeNull()
    expect(resolveAsset(dir, ['figures.db'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'wikimedia', '..', '..', '..', 'etc'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'wikimedia', 'missing.webp'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'notes.txt'])).toBeNull()
    expect(resolveAsset('', ['assets', 'wikimedia', '1.webp'])).toBeNull()
  })
})
```

- [ ] **Step 2: Run it.** → FAIL: `./asset` cannot be found.

- [ ] **Step 3: Implement.** Create `lib/figure-library/asset.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'

const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

/** A library file to serve: only under <dir>/assets, only an image, only if it exists. */
export function resolveAsset(dir: string, parts: readonly string[]): { file: string; type: string } | null {
  if (!dir) return null
  const root = path.resolve(dir, 'assets')
  const file = path.resolve(dir, ...parts)
  if (!file.startsWith(root + path.sep)) return null
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null
  return { file, type }
}
```

  Create `app/api/figure-library/asset/[...key]/route.ts`:

```ts
import fs from 'node:fs'
import { NextRequest } from 'next/server'
import { resolveAsset } from '@/lib/figure-library/asset'

/**
 * The figure library's local files, for quizzes on this machine before S3 and CloudFront exist
 * (spec 5.6). Development only: in production FIGURE_ASSET_BASE points at CloudFront and this
 * answers 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const dir = process.env.FIGURE_LIBRARY_DIR ?? ''
  if (process.env.NODE_ENV === 'production' || !dir) return new Response('Not found', { status: 404 })
  const { key } = await params
  const found = resolveAsset(dir, ['assets', ...(key ?? []).slice(key?.[0] === 'assets' ? 1 : 0)])
  if (!found) return new Response('Not found', { status: 404 })
  return new Response(fs.readFileSync(found.file), { headers: { 'Content-Type': found.type, 'Cache-Control': 'private, max-age=3600' } })
}
```

  `localPath` is `<base>/assets/...`, so with base `/api/figure-library/asset` the key starts with `assets`. The route strips that leading `assets` once, then resolves the rest under `assets/`.
- [ ] **Step 4: Run** `npx vitest run lib/figure-library && npx tsc --noEmit -p .` → pass. **Commit:** `feat(figure-library): a dev-only route serving the library's local files`.

---

### Task 5: The credit line

**Files:**
- Modify `components/ExamFigure.tsx`, adding a `credit?: string` prop rendered as a small line under the figure.
- Modify the call sites to pass `credit={q.image_credit}`: `app/assessment/page.tsx` (lines 385, 1912, 2472, 2532) and `app/(studio)/results/[id]/page.tsx` (284, 465).

- [ ] **Step 1:** In `ExamFigure`, add `credit?: string` to the props, documented as `/** Shown under the figure: a real image's author, licence and source, as CC BY and CC BY-SA require (spec 5.4). */`. Render `{credit && <p className="mt-1 text-[12px] leading-snug text-ss-muted">{credit}</p>}` directly after the figure's container div, inside the fragment.
- [ ] **Step 2:** Pass `credit={q.image_credit}` at each call site. Use the name the site's question variable has (`currentFigure.image_credit`, `question.image_credit`). Where the site's type lists the question fields, add `image_credit?: string` to it.
- [ ] **Step 3: Run** `npx tsc --noEmit -p .` → clean. Use `grep` to check that all six call sites pass `credit`. **Commit:** `feat(figure-library): real images show their credit line under the figure`.

---

### Task 6: Coverage report

**Files:** create `scripts/figure-library/coverage.ts` (with a `coverage(db)` function) and `scripts/figure-library/coverage-report.ts` (the CLI); test `scripts/figure-library/coverage.test.ts`.

**Produces:** `coverage(db) -> { topics: { key, name, approved, sources: number, largestShare }[], totals: { approved, drawn, real, topicsCovered } }`.
- A source is a drawn family or a real origin.
- `largestShare` is the biggest source's fraction (spec 3.4: at most 25%).
- The CLI writes `<library>/reports/coverage.json` and prints a summary.

- [ ] **Step 1: Failing test.** Create `scripts/figure-library/coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { coverage } from './coverage'

describe('coverage', () => {
  it('counts approved figures per topic, their sources, and the largest share', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'B', 'biology', 'UP', 'Cells')").run()
    const add = (id: string, origin: string, family: string | null, status = 'approved') => {
      db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, status, created_at) VALUES (?, ?, ?, 'k', 'biology', 'UP', 'a', ?, 'now')`).run(id, origin, family, status)
      db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(id)
    }
    add('d1', 'drawn', 'punnett'); add('d2', 'drawn', 'punnett'); add('d3', 'drawn', 'punnett'); add('w1', 'wikimedia', null); add('w2', 'wikimedia', null, 'rejected')
    expect(coverage(db)).toEqual({
      topics: [{ key: 'db:2', name: 'Cells', approved: 4, sources: 2, largestShare: 0.75 }],
      totals: { approved: 4, drawn: 3, real: 1, topicsCovered: 1 },
    })
  })
})
```

- [ ] **Step 2: Run it.** → FAIL: `./coverage` cannot be found.

- [ ] **Step 3: Implement.** Create `scripts/figure-library/coverage.ts`:

```ts
// scripts/figure-library/coverage.ts
import type { Store } from './store'

export interface TopicCoverage { key: string; name: string; approved: number; sources: number; largestShare: number }

/** Approved figures per topic, how many sources they come from, and the largest source's share (spec 3.4). */
export function coverage(db: Store): { topics: TopicCoverage[]; totals: { approved: number; drawn: number; real: number; topicsCovered: number } } {
  const rows = db.prepare(`SELECT t.key, t.name, COALESCE(f.family, f.origin) AS source, COUNT(*) AS n FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.status = 'approved' GROUP BY t.key, source ORDER BY t.key`).all() as { key: string; name: string; source: string; n: number }[]
  const byTopic = new Map<string, { name: string; counts: number[] }>()
  for (const r of rows) {
    const e = byTopic.get(r.key) ?? { name: r.name, counts: [] }
    e.counts.push(Number(r.n))
    byTopic.set(r.key, e)
  }
  const topics = [...byTopic].map(([key, e]) => {
    const approved = e.counts.reduce((a, b) => a + b, 0)
    return { key, name: e.name, approved, sources: e.counts.length, largestShare: Math.max(...e.counts) / approved }
  })
  const t = db.prepare(`SELECT COUNT(*) AS approved, SUM(origin = 'drawn') AS drawn, SUM(origin <> 'drawn') AS real FROM figures WHERE status = 'approved'`)
    .get() as { approved: number; drawn: number; real: number }
  return { topics, totals: { approved: Number(t.approved), drawn: Number(t.drawn ?? 0), real: Number(t.real ?? 0), topicsCovered: topics.length } }
}
```

  Create `scripts/figure-library/coverage-report.ts`:

```ts
// scripts/figure-library/coverage-report.ts
// Run: npx jiti scripts/figure-library/coverage-report.ts
// Approved library figures per topic against spec section 3: 50 per topic, 6 sources, no source above 25%.
import fs from 'node:fs'
import path from 'node:path'
import { libraryDir, openStore } from './store'
import { coverage } from './coverage'

const db = openStore()
const c = coverage(db)
db.close()
const out = path.join(libraryDir(), 'reports', 'coverage.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(c, null, 2))
console.log(`${c.totals.approved} approved figures (${c.totals.drawn} drawn, ${c.totals.real} real) on ${c.totals.topicsCovered} topics`)
for (const t of c.topics) {
  console.log(`  ${t.key.padEnd(34)} ${String(t.approved).padStart(4)} figures, ${t.sources} sources, largest ${(100 * t.largestShare).toFixed(0)}%  ${t.name.slice(0, 50)}`)
}
console.log(`Written to ${out}`)
```

- [ ] **Step 4: Run** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → pass. **Commit:** `feat(figure-library): coverage report of approved figures per topic`.

---

### Task 7: Run it locally

- [ ] **Approve.**
  - Run `npx jiti scripts/figure-library/review-drawn.ts --approve` to approve the drawn families.
  - Real images were approved in P1b.2 (`review-real.ts --approve`).
  - Run `npx jiti scripts/figure-library/coverage-report.ts`.
- [ ] **In-process check, writing nothing.** A scratch script runs `libraryFigures({ topicIds: [2] })` with the real store and the base `/api/figure-library/asset`, and does the same for one drawn-pilot topic. It prints the figures and their converted questions.
- [ ] **Production build.** Run `npx next build` to confirm the route and the new files compile. Then check that `node:sqlite` is not bundled by searching the build output for `getBuiltinModule`.
- [ ] **Real quiz.** This one is for the user: set `FIGURE_LIBRARY_DIR=C:/Users/Stephen/figure-library` and `FIGURE_ASSET_BASE=/api/figure-library/asset` in `.env.local`, run `npm run dev`, and start a quiz on a pilot topic, such as IGCSE Biology "Cells". Generating a quiz saves it to the database as usual, so this step is the user's, not the executor's.
- [ ] **Record.** Add the P2a result under P2 in the spec, and commit with `docs: P2a result`.
