# Figure Library Plan 1: Staging Store and Concept Map (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map every topic and subtopic in StudySquare to the concepts it teaches and the figure kinds that can illustrate it, count how many real candidate images exist for each, and produce a feasibility report showing how every topic reaches 50 educational figures. Topics that cannot are named.

**Architecture:** Offline TypeScript scripts run with `npx jiti`. They keep all state in a local SQLite staging store (`figures.db`, Node's built-in `node:sqlite`) outside the repository, and read the production database only through `SELECT`. Model calls go to Claude Haiku 4.5 on Bedrock. Every call records its tokens in the store's `spend` table, and a guard refuses any job that would pass the $600 library cap or its own job cap. Pure logic (subject and level rules, prompts, parsers, feasibility maths) lives in small modules with vitest tests; scripts are thin wrappers around them.

**Tech Stack:** TypeScript (strict), `npx jiti`, `node:sqlite` (Node 25), `@aws-sdk/client-bedrock-runtime`, `pg` (read-only), vitest (node environment), the Wikimedia Commons search API.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md` (sections 2, 3, 5.1, 5.5, 5.6, 8, 9 P0, 12).

**Later plans** (not in this one): Plan 2, the pilot (P1); Plan 3, foundation and publish (P2); Plan 4 onward, drawn waves by subject (P3); then real images at scale (P4, waits for S3).

## Global Constraints

- The staging store and every file the library makes live under `FIGURE_LIBRARY_DIR`, default `C:/Users/Stephen/figure-library`, never inside the repository. `openStore` refuses a path inside the repo.
- Pipeline scripts never write to the production database. The only production access in this plan is `SELECT` in `export-curriculum.ts`.
- Model spend for the whole library never exceeds $600. `FIGURE_LIBRARY_CAP_USD` may lower the cap, never raise it.
- Job caps in this plan: `p0-concepts` $6, `p0-map` $34.
- Model: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, region `eu-west-1`, credentials `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from `.env`, priced at $1.10 / $5.50 per million input / output tokens.
- Wikimedia requests run one at a time, at least 250 ms apart, with User-Agent `StudySquareFigureLibrary/0.1 (https://www.studysquare.org)`. Never the account email.
- vitest node environment only; no `.test.tsx`. Tests sit next to their module in `scripts/figure-library/`.
- `npx tsc --noEmit -p .` stays clean and the full `npx vitest run` stays green after every task.
- Commits are local. Nothing in this plan changes the app, so nothing is pushed or deployed.
- Never echo `DATABASE_URL` or any key.

## Review Focus

1. Topic names with control characters or a trailing literal `\b` (book 205): stored exactly as the database has them, shown clean in prompts. Pinned in Task 6.
2. Topics with no subtopics (every NERDC, WAEC, JAMB and Checkpoint topic): the prompt says "none" and parsing expects zero subtopics. Pinned in Task 8.
3. Model replies that name ids outside the lists, or nothing valid: invalid ids are dropped; a reply with no valid concept or kind is retried once, then recorded as a failure and never stored. Pinned in Task 8.
4. A run stopped part-way (Ctrl-C, throttling, a budget stop): rerunning picks up only unfinished topics and terms, and spend already recorded is never repeated. Pinned in Tasks 8 and 9.
5. A subject with thousands of names (Mathematics): split into chunks, with earlier chunks' concept ids passed on so ids do not fork. Pinned in Task 7.

---

## File Structure

All new, under `scripts/figure-library/`:

| File | Responsibility |
|---|---|
| `node-sqlite.d.ts` | Minimal types for `node:sqlite` (`@types/node` is 20.x and has none) |
| `store.ts` | Library folder, SQLite schema, `openStore`, `readJson` |
| `spend.ts` | Prices, cost, spend ledger, budget guard |
| `subjects.ts` | Book or syllabus name → one of about 40 subject keys |
| `levels.ts` | Book name → level band P / LS / UP / AL |
| `figureKinds.ts` | The closed list of 47 figure kinds |
| `claude.ts` | `.env` loading, Bedrock sender, `askJson` with retries and spend, `runPool` |
| `curriculum.ts` | Pure: database and syllabus rows → staged topics and subtopics |
| `export-curriculum.ts` | Script: read production (SELECT only) → staging store |
| `concepts.ts` | Pure: concept prompt, parse, merge, chunk |
| `build-concepts.ts` | Script: concepts per subject |
| `topicMap.ts` | Pure: topic prompt, parse, which topics still need mapping |
| `map-topics.ts` | Script: map every topic and its subtopics |
| `wikimedia.ts` | Search URL, hit parsing, `countImages`, which terms still need probing |
| `probe-supply.ts` | Script: count Wikimedia candidates per search term |
| `feasibility.ts` | Pure: per-topic assessment and summary |
| `report.ts` | Script: feasibility report (JSON and Markdown) |

Each module above has a `*.test.ts` beside it, except the scripts and the `.d.ts`.

---

### Task 1: Staging store

**Files:**
- Create: `scripts/figure-library/node-sqlite.d.ts`
- Create: `scripts/figure-library/store.ts`
- Test: `scripts/figure-library/store.test.ts`

**Interfaces:**
- Produces: `libraryDir(): string`, `openStore(file?: string, repoRoot?: string): Store`, `type Store`, `readJson<T>(text: unknown, fallback: T): T`, `SCHEMA: string`.

- [ ] **Step 1: Add the `node:sqlite` types**

```ts
// scripts/figure-library/node-sqlite.d.ts
// The parts of node:sqlite the figure library uses. @types/node is 20.x here
// and has no node:sqlite types; delete this file once it is 22 or later.
declare module 'node:sqlite' {
  type SQLValue = null | number | bigint | string | Uint8Array
  interface StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    get(...params: SQLValue[]): unknown
    all(...params: SQLValue[]): unknown[]
  }
  class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// scripts/figure-library/store.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore, readJson } from './store'

describe('the staging store', () => {
  it('creates every table, and opening it again keeps what was there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-'))
    const file = path.join(dir, 'figures.db')
    const db = openStore(file, process.cwd())
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'rwanda', 'Biology S2 SB', 'biology', 'LS', 'Cells')").run()
    db.close()
    const again = openStore(file, process.cwd())
    const tables = (again.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['topics', 'subtopics', 'concepts', 'topic_map', 'subtopic_map', 'supply', 'spend']))
    expect((again.prepare('SELECT COUNT(*) AS n FROM topics').get() as { n: number }).n).toBe(1)
    again.close()
  })

  it('refuses to live inside the repository', () => {
    // About 6 GB of figures cannot go through git or Amplify's bundle.
    expect(() => openStore(path.join(process.cwd(), 'data', 'figures.db'), process.cwd())).toThrow(/outside the repository/)
  })

  it('reads a damaged JSON column as the fallback', () => {
    expect(readJson('not json', [])).toEqual([])
    expect(readJson('["a"]', [])).toEqual(['a'])
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/store.test.ts`
Expected: FAIL, "Failed to resolve import ./store".

- [ ] **Step 4: Implement**

```ts
// scripts/figure-library/store.ts
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Where the library is built until S3 exists (spec 5.6). Outside the
 * repository on purpose: about 6 GB of figures cannot go through git or
 * Amplify's 230 MB bundle.
 */
export function libraryDir(): string {
  return path.resolve(process.env.FIGURE_LIBRARY_DIR || 'C:/Users/Stephen/figure-library')
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS topics (
  key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  textbook_id INTEGER,
  book TEXT NOT NULL,
  subject TEXT NOT NULL,
  band TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopics (
  key TEXT PRIMARY KEY,
  topic_key TEXT NOT NULL REFERENCES topics(key),
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  bands TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS topic_map (
  topic_key TEXT PRIMARY KEY REFERENCES topics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL,
  terms TEXT NOT NULL,
  visual TEXT NOT NULL,
  dropped INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  mapped_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopic_map (
  subtopic_key TEXT PRIMARY KEY REFERENCES subtopics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supply (
  term TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  hits INTEGER NOT NULL,
  probed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  usd REAL NOT NULL,
  at TEXT NOT NULL
);
`

export type Store = DatabaseSync

export function openStore(file: string = path.join(libraryDir(), 'figures.db'), repoRoot: string = process.cwd()): Store {
  if (file !== ':memory:') {
    const abs = path.resolve(file)
    const rel = path.relative(path.resolve(repoRoot), abs)
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw new Error(`The figure library must live outside the repository, not at ${abs}`)
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
  }
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

/** Parses a JSON column, falling back rather than throwing on a damaged row. */
export function readJson<T>(text: unknown, fallback: T): T {
  try {
    return JSON.parse(String(text)) as T
  } catch {
    return fallback
  }
}
```

- [ ] **Step 5: Run the test and the type check**

Run: `npx vitest run scripts/figure-library/store.test.ts && npx tsc --noEmit -p .`
Expected: 3 passed; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add scripts/figure-library/node-sqlite.d.ts scripts/figure-library/store.ts scripts/figure-library/store.test.ts
git commit -m "feat(figure-library): local staging store outside the repo"
```

---

### Task 2: Spend ledger and budget guard

**Files:**
- Create: `scripts/figure-library/spend.ts`
- Test: `scripts/figure-library/spend.test.ts`

**Interfaces:**
- Consumes: `Store`, `openStore` (Task 1).
- Produces: `PRICES`, `DEFAULT_CAP_USD = 600`, `class BudgetExceeded extends Error`, `costUsd(model, inputTokens, outputTokens): number`, `capUsd(): number`, `totalSpend(db, job?): number`, `recordSpend(db, { job, model, inputTokens, outputTokens }): number`, `assertBudget(db, { job, estimateUsd, jobCapUsd, cap? }): void`, `checkBudget(db, { job, jobCapUsd, cap? }): void`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/spend.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { openStore } from './store'
import { BudgetExceeded, assertBudget, capUsd, checkBudget, costUsd, recordSpend, totalSpend } from './spend'

const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
afterEach(() => { delete process.env.FIGURE_LIBRARY_CAP_USD })

describe('what a model call costs', () => {
  it('prices Haiku on its EU profile', () => {
    expect(costUsd(HAIKU, 1_000_000, 100_000)).toBeCloseTo(1.65, 6)
  })
  it('refuses to guess the price of a model it has no price for', () => {
    expect(() => costUsd('some-new-model', 1, 1)).toThrow(/No price/)
  })
})

describe('the $600 cap', () => {
  it('can be lowered by the environment but never raised', () => {
    expect(capUsd()).toBe(600)
    process.env.FIGURE_LIBRARY_CAP_USD = '100'
    expect(capUsd()).toBe(100)
    process.env.FIGURE_LIBRARY_CAP_USD = '900'
    expect(capUsd()).toBe(600)
  })

  it('refuses a job whose estimate would pass the library cap or its own', () => {
    const db = openStore(':memory:')
    recordSpend(db, { job: 'earlier', model: HAIKU, inputTokens: 1_000_000, outputTokens: 0 }) // $1.10
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 1, jobCapUsd: 34, cap: 2 })).toThrow(BudgetExceeded)
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 35, jobCapUsd: 34, cap: 600 })).toThrow(BudgetExceeded)
    expect(() => assertBudget(db, { job: 'p0-map', estimateUsd: 10, jobCapUsd: 34, cap: 600 })).not.toThrow()
  })

  it('stops a job the moment it has crossed its cap', () => {
    const db = openStore(':memory:')
    recordSpend(db, { job: 'p0-map', model: HAIKU, inputTokens: 0, outputTokens: 1_000_000 }) // $5.50
    expect(totalSpend(db, 'p0-map')).toBeCloseTo(5.5, 6)
    expect(() => checkBudget(db, { job: 'p0-map', jobCapUsd: 5 })).toThrow(BudgetExceeded)
    expect(() => checkBudget(db, { job: 'p0-map', jobCapUsd: 6 })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/spend.test.ts`
Expected: FAIL, "Failed to resolve import ./spend".

- [ ] **Step 3: Implement**

```ts
// scripts/figure-library/spend.ts
import type { Store } from './store'

/** USD per million tokens, on-demand, EU inference profiles (regional pricing). */
export const PRICES: Record<string, { input: number; output: number }> = {
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.1, output: 5.5 },
  'eu.anthropic.claude-sonnet-5-5': { input: 2.2, output: 11 },
}

/** The user's hard cap on model spend for the whole library (spec section 8). */
export const DEFAULT_CAP_USD = 600

export class BudgetExceeded extends Error {}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model]
  if (!p) throw new Error(`No price recorded for ${model}; add it to PRICES before spending on it`)
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

/** The cap in force. The environment may lower it, never raise it. */
export function capUsd(): number {
  const v = Number(process.env.FIGURE_LIBRARY_CAP_USD)
  return Number.isFinite(v) && v > 0 ? Math.min(v, DEFAULT_CAP_USD) : DEFAULT_CAP_USD
}

export function totalSpend(db: Store, job?: string): number {
  const row = (job
    ? db.prepare('SELECT COALESCE(SUM(usd), 0) AS t FROM spend WHERE job = ?').get(job)
    : db.prepare('SELECT COALESCE(SUM(usd), 0) AS t FROM spend').get()) as { t: number }
  return Number(row.t)
}

export function recordSpend(db: Store, e: { job: string; model: string; inputTokens: number; outputTokens: number }): number {
  const usd = costUsd(e.model, e.inputTokens, e.outputTokens)
  db.prepare('INSERT INTO spend (job, model, input_tokens, output_tokens, usd, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(e.job, e.model, e.inputTokens, e.outputTokens, usd, new Date().toISOString())
  return usd
}

/** Refuses to start a job whose estimate would take the library past its cap, or the job past its own. */
export function assertBudget(db: Store, o: { job: string; estimateUsd: number; jobCapUsd: number; cap?: number }): void {
  const cap = o.cap ?? capUsd()
  const spent = totalSpend(db)
  const jobSpent = totalSpend(db, o.job)
  if (spent + o.estimateUsd > cap) {
    throw new BudgetExceeded(`Spent $${spent.toFixed(2)} of $${cap}; this job's estimate of $${o.estimateUsd.toFixed(2)} would pass the cap.`)
  }
  if (jobSpent + o.estimateUsd > o.jobCapUsd) {
    throw new BudgetExceeded(`${o.job} has spent $${jobSpent.toFixed(2)} of its $${o.jobCapUsd}; an estimate of $${o.estimateUsd.toFixed(2)} more would pass it.`)
  }
}

/** Checked after every call: stops a job the moment it crosses either cap. */
export function checkBudget(db: Store, o: { job: string; jobCapUsd: number; cap?: number }): void {
  const cap = o.cap ?? capUsd()
  const spent = totalSpend(db)
  const jobSpent = totalSpend(db, o.job)
  if (spent > cap || jobSpent > o.jobCapUsd) {
    throw new BudgetExceeded(`Stopped: library spend $${spent.toFixed(2)} (cap $${cap}), ${o.job} $${jobSpent.toFixed(2)} (cap $${o.jobCapUsd}).`)
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/spend.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/figure-library/spend.ts scripts/figure-library/spend.test.ts
git commit -m "feat(figure-library): spend ledger and a guard that holds the \$600 cap"
```

---

### Task 3: Subject keys and level bands

**Files:**
- Create: `scripts/figure-library/subjects.ts`
- Create: `scripts/figure-library/levels.ts`
- Test: `scripts/figure-library/subjects.test.ts`
- Test: `scripts/figure-library/levels.test.ts`

**Interfaces:**
- Produces: `subjectKey(name: string): string` (returns `'other'` when nothing matches); `type Band = 'P' | 'LS' | 'UP' | 'AL'`; `levelBand(book: string): { band: Band; certain: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/figure-library/subjects.test.ts
import { describe, it, expect } from 'vitest'
import { subjectKey } from './subjects'

// Real names from the textbooks table and the WAEC, JAMB and Checkpoint syllabi.
const CASES: [string, string][] = [
  ['Advanced Mathematics S6 SB (1)', 'mathematics'],
  ['Sub Maths S4 Adapted SB 2022 LFK, HLP and HGL', 'mathematics'],
  ['Mathematcs for Accounting Option', 'mathematics'],
  ['NERDC Senior Secondary 1 — Further Mathematics', 'mathematics'],
  ['Cambridge International AS and A Level Mathematics Probability Statistics 1 Coursebook', 'mathematics'],
  ['S1 Chemistry SB', 'chemistry'],
  ['IGCSE-Physics-Coursebook-by-David-Sang', 'physics'],
  ['Cambridge IGCSE Biology MARRY JONES 4th Ed', 'biology'],
  ['P1-SET-PB. (1)', 'science'],
  ['NERDC Junior Secondary 2 — Intermediate Science', 'science'],
  ['Cambridge Primary Science 3 Learners', 'science'],
  ['Ibidukikije N3', 'science'],
  ['Geography and Environment', 'geography'],
  ['Cambridge IGCSE® and O Level Environmental Management Coursebook', 'geography'],
  ['History and Citizenship SB S2', 'history'],
  ['NERDC Primary 5 — Nigerian History', 'history'],
  ['NERDC Senior Secondary 2 — Citizenship and Heritage Studies', 'social-studies'],
  ['GENERAL EDU-GSCS-S4-SB', 'social-studies'],
  ['P3-SST-PB', 'social-studies'],
  ['Civic Education', 'social-studies'],
  ['Government', 'social-studies'],
  ['NERDC Junior Secondary 1 — Christian Religious Studies', 'religion'],
  ['Religion and Ethics', 'religion'],
  ['Economics S4 SB', 'economics'],
  ['Financial Accounting Experimental Version', 'accounting'],
  ['Principles of Accounts', 'accounting'],
  ['Book Keeping', 'accounting'],
  ['Entrepreneurship S1', 'business'],
  ['Office Practice', 'business'],
  ['NERDC Senior Secondary 3 — Marketing', 'business'],
  ['ICT S4 Adapted SB 2022', 'computing'],
  ['ICT in Accounting', 'computing'],
  ['Cambridge International AS A Level IT Coursebook with Digital Access', 'computing'],
  ['Data Processing', 'computing'],
  ['Click Start Computing for Schools 6 (syllabus outline)', 'computing'],
  ['PES TG in Accounting Experimental Version', 'physical-education'],
  ['Physical and Health Education', 'physical-education'],
  ['Agricultural Science', 'agriculture'],
  ['Animal Husbandry', 'agriculture'],
  ['NERDC Junior Secondary 1 — Trade: Livestock Farming', 'vocational'],
  ['Auto Mechanics', 'vocational'],
  ['Catering Craft Practice', 'home-science'],
  ['Home Economics', 'home-science'],
  ['GENERAL EDU-Literature in english-S6-SB', 'literature'],
  ['Read Aloud Stories Term 1', 'english'],
  ['Use of English', 'english'],
  ['English as a Second Language', 'english'],
  ['FRENCH S4 LKK SB', 'french'],
  ['Cambridge IGCSE™ German Second', 'german'],
  ['NERDC Junior Secondary 1 — Arabic Language', 'arabic'],
  ['Kiswahili', 'kiswahili'],
  ['NERDC Senior Secondary 1 — Yoruba', 'nigerian-languages'],
  ['Music S2 SB', 'music'],
  ['Fine Art and Crafts S1 SB', 'art'],
  ['NERDC Primary 1 — Cultural and Creative Arts', 'art'],
  ['Visual Arts', 'art'],
  ['Technical Drawing', 'technical-drawing'],
  ['Psychology', 'psychology'],
]

describe('the subject a book or syllabus belongs to', () => {
  it.each(CASES)('%s → %s', (name, key) => {
    expect(subjectKey(name)).toBe(key)
  })
  it('says "other" rather than guessing', () => {
    expect(subjectKey('Something nobody teaches')).toBe('other')
  })
})
```

```ts
// scripts/figure-library/levels.test.ts
import { describe, it, expect } from 'vitest'
import { levelBand } from './levels'

const CASES: [string, string][] = [
  ['Mathematics P2 SB', 'P'],
  ['P1-SET-PB. (1)', 'P'],
  ['NERDC Primary 4 — French', 'P'],
  ['Cambridge Primary Mathematics Learner’s Book 1, 2nd Edition', 'P'],
  ['Click Start Computing for Schools 6 (syllabus outline)', 'P'],
  ['Read Aloud Stories Term 2', 'P'],
  ['S1 Chemistry SB', 'LS'],
  ['History and Citizenship SB S2', 'LS'],
  ['NERDC Junior Secondary 3 — Mathematics', 'LS'],
  ['Cambridge Lower Secondary Science 8', 'LS'],
  ['Cambridge Lower Secondary Mathematics Stage 9 (syllabus outline)', 'LS'],
  ['GENERAL EDU-GSCS-S4-SB', 'UP'],
  ['English S.5', 'UP'],
  ['Physics Students Book Senior Five', 'UP'],
  ['NERDC Senior Secondary 2 — Physics', 'UP'],
  ['Cambridge IGCSE English as a Second Language Workbook', 'UP'],
  ['Cambridge IGCSE® and O Level Additional Mathematics Coursebook (Sue Pemberton)', 'UP'],
  ['Cambridge International AS Level History International History, 1870–1945 Coursebook', 'AL'],
  ['Cambridge International AS & A Level Physics Coursebook', 'AL'],
]

describe('the level a book teaches at', () => {
  it.each(CASES)('%s → %s', (book, band) => {
    expect(levelBand(book)).toEqual({ band, certain: true })
  })
  it('falls back to upper secondary, and says it guessed', () => {
    // Rwanda's accounting-option books carry no level marker; they are S4-S6.
    expect(levelBand('Taxation Experimental Version')).toEqual({ band: 'UP', certain: false })
  })
})
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run scripts/figure-library/subjects.test.ts scripts/figure-library/levels.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement `subjects.ts`**

```ts
// scripts/figure-library/subjects.ts
/**
 * One subject key per book or syllabus subject, so concepts can be shared
 * across curricula. canonicalSubject() is for display and keeps NERDC's class
 * in the name (307 groups); this needs about 40.
 *
 * Order matters: trades before agriculture, agriculture before science
 * ("Agricultural Science"), PE and ICT before accounting ("PES in
 * Accounting", "ICT in Accounting"), literature before English. "Home
 * Economics" is caught before the economics rule.
 */
const RULES: [RegExp, string][] = [
  [/\btrade:|auto mechanic|garment making/i, 'vocational'],
  [/pre ?vocational/i, 'vocational'],
  [/physical (and health )?education|\bpes\b|\bsports?\b/i, 'physical-education'],
  [/\bict\b|information (and communication )?technology|computer|computing|digital (technolog|literacy)|data processing|\bit (coursebook|for)\b/i, 'computing'],
  [/math|statistic|probabilit/i, 'mathematics'],
  [/biolog/i, 'biology'],
  [/chemi/i, 'chemistry'],
  [/physic/i, 'physics'],
  [/geograph|environmental management/i, 'geography'],
  // Before science: "Agricultural Science" is agriculture.
  [/agricult|husbandry|horticult|livestock/i, 'agriculture'],
  [/basic science|intermediate science|elementary technology|\bset\b|\bscience\b|ibidukikije/i, 'science'],
  [/histor/i, 'history'],
  [/citizenship|civic|government|social studies|\bsst\b|global perspective|\bgscs\b|general studies/i, 'social-studies'],
  [/religio|christian|islamic|ethic/i, 'religion'],
  [/econom/i, 'economics'],
  [/accounti|accounts|book ?keeping|taxation/i, 'accounting'],
  [/business|commerce|entrep|marketing|office practice/i, 'business'],
  [/home (science|economics)|food and nutrition|catering/i, 'home-science'],
  [/literat/i, 'literature'],
  [/english|\besl\b|read aloud/i, 'english'],
  [/french/i, 'french'],
  [/german/i, 'german'],
  [/arabic/i, 'arabic'],
  [/kiswahili|swahili/i, 'kiswahili'],
  [/kinyarwanda/i, 'kinyarwanda'],
  [/hausa|igbo|yoruba|nigerian languages/i, 'nigerian-languages'],
  [/music|dance|drama/i, 'music'],
  [/technical drawing/i, 'technical-drawing'],
  [/\bfine arts?\b|\bcrafts?\b|visual arts|creative arts|\bart\b/i, 'art'],
  [/psycholog/i, 'psychology'],
]

export function subjectKey(name: string): string {
  const n = String(name ?? '')
  if (/home economics/i.test(n)) return 'home-science'
  for (const [pattern, key] of RULES) if (pattern.test(n)) return key
  return 'other'
}
```

- [ ] **Step 4: Implement `levels.ts`**

```ts
// scripts/figure-library/levels.ts
export type Band = 'P' | 'LS' | 'UP' | 'AL'

const RWANDA_SENIOR: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

/**
 * The level band a book teaches at (spec 5.1). `certain: false` means no
 * level marker was found and upper secondary was assumed; the export lists
 * those books so they can be checked.
 */
export function levelBand(book: string): { band: Band; certain: boolean } {
  const n = String(book ?? '').toLowerCase()
  const sure = (band: Band) => ({ band, certain: true })
  // IGCSE first: "English as a Second Language" contains "as" but is not AS Level.
  if (/igcse|\bo level\b/.test(n)) return sure('UP')
  if (/\bas\b.*\blevel\b|\ba level\b/.test(n)) return sure('AL')
  if (/senior secondary/.test(n)) return sure('UP')
  if (/junior secondary|lower secondary/.test(n)) return sure('LS')
  const senior = n.match(/\bsenior (one|two|three|four|five|six)\b/)?.[1]
  const rwandaS = senior ? RWANDA_SENIOR[senior] : Number(n.match(/\bs\.?\s?([1-6])\b/)?.[1] ?? NaN)
  if (Number.isInteger(rwandaS)) return sure(rwandaS <= 3 ? 'LS' : 'UP')
  if (/\bp\s?[1-6]\b|\bprimary\b|read aloud/.test(n)) return sure('P')
  const stage = Number(n.match(/\b(?:stage|book|learners?|science|mathematics|computing|schools)\s*(\d{1,2})\b/)?.[1] ?? NaN)
  if (Number.isInteger(stage)) return sure(stage <= 6 ? 'P' : stage <= 9 ? 'LS' : 'UP')
  return { band: 'UP', certain: false }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/figure-library/subjects.test.ts scripts/figure-library/levels.test.ts`
Expected: all pass. If a case fails, fix the rule, never the test. Every case is a real name.

- [ ] **Step 6: Commit**

```bash
git add scripts/figure-library/subjects.ts scripts/figure-library/subjects.test.ts scripts/figure-library/levels.ts scripts/figure-library/levels.test.ts
git commit -m "feat(figure-library): subject keys and level bands for every book and syllabus"
```

---

### Task 4: Figure kinds

**Files:**
- Create: `scripts/figure-library/figureKinds.ts`
- Test: `scripts/figure-library/figureKinds.test.ts`

**Interfaces:**
- Produces: `interface FigureKind { id: string; drawn: boolean; label: string }`, `FIGURE_KINDS: readonly FigureKind[]`, `KIND_BY_ID: ReadonlyMap<string, FigureKind>`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/figureKinds.test.ts
import { describe, it, expect } from 'vitest'
import { FIGURE_KINDS, KIND_BY_ID } from './figureKinds'

describe('the closed list of figure kinds', () => {
  it('has unique, well-formed ids', () => {
    const ids = FIGURE_KINDS.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(\.[a-z-]+)?$/)
  })
  it('has both drawn and real kinds, and enough of each to give variety', () => {
    expect(FIGURE_KINDS.filter((k) => k.drawn).length).toBeGreaterThanOrEqual(30)
    expect(FIGURE_KINDS.filter((k) => !k.drawn).length).toBeGreaterThanOrEqual(8)
  })
  it('looks kinds up by id', () => {
    expect(KIND_BY_ID.get('physics.circuit')?.drawn).toBe(true)
    expect(KIND_BY_ID.get('photo.micrograph')?.drawn).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/figureKinds.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

```ts
// scripts/figure-library/figureKinds.ts
/**
 * Every kind of educational figure the library makes or finds (spec 5.1).
 * Drawn kinds are generated from data with computed answers; real kinds come
 * from openly licensed collections. Drawn families are designed per kind in P3.
 */
export interface FigureKind {
  id: string
  drawn: boolean
  label: string
}

export const FIGURE_KINDS: readonly FigureKind[] = [
  { id: 'graph.line', drawn: true, label: 'Line graph: motion, rates, functions, change over time' },
  { id: 'graph.bar', drawn: true, label: 'Bar chart, column chart or histogram' },
  { id: 'graph.pie', drawn: true, label: 'Pie chart' },
  { id: 'graph.scatter', drawn: true, label: 'Scatter graph, with or without a line of best fit' },
  { id: 'graph.stats', drawn: true, label: 'Box plot, cumulative frequency curve or stem-and-leaf diagram' },
  { id: 'table.data', drawn: true, label: 'Table of data to read, complete or calculate from' },
  { id: 'maths.number', drawn: true, label: 'Number line, place-value chart, fraction or array model' },
  { id: 'maths.geometry', drawn: true, label: 'Shapes, angles, polygons, circles, constructions, transformations' },
  { id: 'maths.coordinate', drawn: true, label: 'Coordinate grid with points, lines, vectors or regions' },
  { id: 'maths.measure', drawn: true, label: 'Clock, ruler, scale, protractor or money to read' },
  { id: 'maths.solid', drawn: true, label: '3D solid, net, plan or elevation' },
  { id: 'maths.probability', drawn: true, label: 'Tree diagram, Venn diagram, two-way table or sample space' },
  { id: 'physics.circuit', drawn: true, label: 'Electrical circuit diagram' },
  { id: 'physics.ray', drawn: true, label: 'Ray diagram: mirror, lens, refraction' },
  { id: 'physics.force', drawn: true, label: 'Force or free-body diagram, moments, levers, pulleys' },
  { id: 'physics.wave', drawn: true, label: 'Waveform or wavefront diagram' },
  { id: 'physics.field', drawn: true, label: 'Magnetic or electric field pattern' },
  { id: 'instrument.reading', drawn: true, label: 'Measuring instrument to read: meter, thermometer, burette, cylinder, balance' },
  { id: 'chem.structure', drawn: true, label: 'Structural or displayed formula of a molecule' },
  { id: 'chem.particle', drawn: true, label: 'Particle diagram or dot-and-cross bonding diagram' },
  { id: 'chem.energy', drawn: true, label: 'Energy profile or enthalpy diagram' },
  { id: 'chem.chromatogram', drawn: true, label: 'Paper or thin-layer chromatogram' },
  { id: 'bio.genetics', drawn: true, label: 'Punnett square or family pedigree' },
  { id: 'bio.ecology', drawn: true, label: 'Food chain, food web or ecological pyramid' },
  { id: 'bio.key', drawn: true, label: 'Dichotomous key' },
  { id: 'diagram.template', drawn: true, label: 'Labelled diagram from a template, with varied parts to identify (cell, heart, flower, eye)' },
  { id: 'process.flow', drawn: true, label: 'Flow or cycle diagram of a process (water cycle, digestion, manufacturing)' },
  { id: 'geo.map', drawn: true, label: 'Map: location, choropleth, route, or contour (topographic) map' },
  { id: 'geo.climate', drawn: true, label: 'Climate graph or population pyramid' },
  { id: 'geo.section', drawn: true, label: 'Cross-section or profile: land, river, soil, rock layers' },
  { id: 'timeline', drawn: true, label: 'Timeline of events or periods' },
  { id: 'cs.logic', drawn: true, label: 'Logic gate circuit or truth table' },
  { id: 'cs.structure', drawn: true, label: 'Tree, stack, queue, network topology, ER or state diagram' },
  { id: 'cs.code', drawn: true, label: 'Short code or pseudocode with a trace table' },
  { id: 'econ.curve', drawn: true, label: 'Economics diagram: supply and demand, costs, PPF, AD/AS' },
  { id: 'business.document', drawn: true, label: 'Business or accounting document: income statement, balance sheet, invoice, organisation chart' },
  { id: 'text.notice', drawn: true, label: 'Notice, timetable, menu, sign, form or advert to read' },
  { id: 'music.notation', drawn: true, label: 'Music notation: rhythms, notes, scales, intervals' },
  { id: 'photo.specimen', drawn: false, label: 'Photo of a real organism, rock, mineral, soil or material' },
  { id: 'photo.micrograph', drawn: false, label: 'Microscope image of cells, tissues, microbes or crystals' },
  { id: 'photo.landscape', drawn: false, label: 'Photo or satellite image of a landform, environment, settlement or weather system' },
  { id: 'photo.apparatus', drawn: false, label: 'Photo of laboratory apparatus, an experiment in progress, or equipment' },
  { id: 'photo.object', drawn: false, label: 'Photo of a manufactured object, tool, machine, instrument or technology' },
  { id: 'photo.everyday', drawn: false, label: 'Everyday scene or object, for language and primary topics' },
  { id: 'diagram.reference', drawn: false, label: 'Published labelled scientific or technical diagram (for example a Wikimedia anatomy diagram)' },
  { id: 'source.historical', drawn: false, label: 'Historical photo, document, poster, cartoon or map' },
  { id: 'artwork', drawn: false, label: 'Painting, sculpture, craft, textile or building as art' },
]

export const KIND_BY_ID: ReadonlyMap<string, FigureKind> = new Map(FIGURE_KINDS.map((k) => [k.id, k]))
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/figureKinds.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/figure-library/figureKinds.ts scripts/figure-library/figureKinds.test.ts
git commit -m "feat(figure-library): the closed list of figure kinds"
```

---

### Task 5: Model calls with spend and retries

**Files:**
- Create: `scripts/figure-library/claude.ts`
- Test: `scripts/figure-library/claude.test.ts`

**Interfaces:**
- Consumes: `Store` (Task 1); `recordSpend`, `checkBudget`, `BudgetExceeded` (Task 2).
- Produces: `HAIKU`, `interface ModelReply { text; inputTokens; outputTokens }`, `type SendFn = (model: string, prompt: string, maxTokens: number) => Promise<ModelReply>`, `loadEnv(root?): Record<string, string>`, `bedrockSender(env?): SendFn`, `extractJson(text): unknown`, `askJson(o): Promise<unknown>`, `runPool<T>(items, workers, fn): Promise<void>`, `sleep(ms)`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/claude.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { BudgetExceeded, totalSpend } from './spend'
import { askJson, extractJson, runPool, type SendFn } from './claude'

const noWait = async () => {}

describe('reading JSON out of a model reply', () => {
  it('takes it from inside a code fence or surrounding words', () => {
    const fence = '`'.repeat(3)
    expect(extractJson(`Here:\n${fence}json\n{"a":1}\n${fence}`)).toEqual({ a: 1 })
    expect(extractJson('{"concepts":[]} done')).toEqual({ concepts: [] })
  })
  it('refuses a reply with no JSON object', () => {
    expect(() => extractJson('sorry')).toThrow(/No JSON/)
  })
})

describe('asking the model for JSON', () => {
  it('records what every call cost, including retries', async () => {
    const db = openStore(':memory:')
    let n = 0
    const send: SendFn = async () => (++n === 1
      ? { text: 'not json', inputTokens: 1000, outputTokens: 100 }
      : { text: '{"ok":true}', inputTokens: 1000, outputTokens: 100 })
    expect(await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 200, send, wait: noWait })).toEqual({ ok: true })
    expect(totalSpend(db, 't')).toBeCloseTo(2 * (1000 * 1.1 + 100 * 5.5) / 1e6, 9)
  })

  it('waits and retries when Bedrock is throttling', async () => {
    const db = openStore(':memory:')
    let n = 0
    const send: SendFn = async () => {
      if (++n < 3) throw Object.assign(new Error('Too many requests'), { name: 'ThrottlingException' })
      return { text: '{"ok":1}', inputTokens: 10, outputTokens: 10 }
    }
    expect(await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, wait: noWait })).toEqual({ ok: 1 })
  })

  it('counts a call with no usage figures at the worst case, never as free', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{}', inputTokens: 0, outputTokens: 0 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'x'.repeat(3000), maxTokens: 1000, send, wait: noWait })
    expect(totalSpend(db, 't')).toBeCloseTo((1000 * 1.1 + 1000 * 5.5) / 1e6, 9)
  })

  it('stops the job once it crosses its cap', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{}', inputTokens: 1_000_000, outputTokens: 0 })
    await expect(askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 10, send, wait: noWait })).rejects.toThrow(BudgetExceeded)
  })
})

describe('running work a few at a time', () => {
  it('does every item, never more than the workers at once', async () => {
    let live = 0, peak = 0
    const done: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (i) => {
      live++; peak = Math.max(peak, live)
      await new Promise((r) => setTimeout(r, 5))
      done.push(i); live--
    })
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(peak).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/claude.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

```ts
// scripts/figure-library/claude.ts
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { Store } from './store'
import { checkBudget, recordSpend } from './spend'

export const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

export interface ModelReply {
  text: string
  inputTokens: number
  outputTokens: number
}

export type SendFn = (model: string, prompt: string, maxTokens: number) => Promise<ModelReply>

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The repo's .env and .env.local, with the process environment winning. */
export function loadEnv(root = process.cwd()): Record<string, string> {
  const env: Record<string, string> = {}
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...(process.env as Record<string, string>) }
}

export function bedrockSender(env: Record<string, string> = loadEnv()): SendFn {
  const client = new BedrockRuntimeClient({
    region: env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
  return async (model, prompt, maxTokens) => {
    const res = await client.send(new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    }))
    const body = JSON.parse(new TextDecoder().decode(res.body))
    return {
      text: (Array.isArray(body.content) ? body.content : []).map((c: { text?: string }) => c.text ?? '').join(''),
      inputTokens: Number(body.usage?.input_tokens ?? 0),
      outputTokens: Number(body.usage?.output_tokens ?? 0),
    }
  }
}

export function extractJson(text: string): unknown {
  const cleaned = String(text).replace(/`{3}(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in the reply')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const THROTTLED = /throttl|too many requests|rate exceeded|serviceunavailable|\b503\b|\b429\b/i

/**
 * One model call that must come back as JSON. Every reply is paid for and
 * recorded before it is parsed, and the budget is checked after each, so a
 * run can never spend past its cap by more than one call.
 */
export async function askJson(o: {
  db: Store
  job: string
  jobCapUsd: number
  prompt: string
  maxTokens: number
  send: SendFn
  model?: string
  attempts?: number
  wait?: (ms: number) => Promise<void>
}): Promise<unknown> {
  const model = o.model ?? HAIKU
  const wait = o.wait ?? sleep
  const attempts = o.attempts ?? 4
  let last: unknown = null
  for (let i = 0; i < attempts; i++) {
    let reply: ModelReply
    try {
      reply = await o.send(model, o.prompt, o.maxTokens)
    } catch (err) {
      last = err
      const e = err as { name?: string; message?: string }
      if (THROTTLED.test(`${e?.name ?? ''} ${e?.message ?? ''}`)) {
        await wait(1000 * 2 ** i)
        continue
      }
      throw err
    }
    // A reply without usage figures is counted at its worst case, never as free.
    recordSpend(o.db, {
      job: o.job,
      model,
      inputTokens: reply.inputTokens || Math.ceil(o.prompt.length / 3),
      outputTokens: reply.outputTokens || o.maxTokens,
    })
    checkBudget(o.db, { job: o.job, jobCapUsd: o.jobCapUsd })
    try {
      return extractJson(reply.text)
    } catch (err) {
      last = err
    }
  }
  throw last instanceof Error ? last : new Error('The model gave no usable reply')
}

export async function runPool<T>(items: readonly T[], workers: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }))
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/claude.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/figure-library/claude.ts scripts/figure-library/claude.test.ts
git commit -m "feat(figure-library): model calls that record spend and respect the cap"
```

---

### Task 6: Curriculum export

**Files:**
- Create: `scripts/figure-library/curriculum.ts`
- Create: `scripts/figure-library/export-curriculum.ts`
- Test: `scripts/figure-library/curriculum.test.ts`

**Interfaces:**
- Consumes: `subjectKey` (Task 3), `levelBand`, `Band` (Task 3), `openStore` (Task 1), `loadEnv` (Task 5); `WAEC_SUBJECTS`, `JAMB_UTME_SUBJECTS` from `lib/nigeria-exam-syllabi.ts`; `CHECKPOINT_SUBJECTS` from `lib/cambridge-checkpoint.ts`.
- Produces: `type Source`, `interface StagedTopic { key; source; textbookId: number | null; book; subject; band; name }`, `interface StagedSubtopic { key; topicKey; name }`, `displayName(name): string`, `curriculumRows(input): { topics; subtopics; unmapped: string[]; uncertain: string[] }`. Staged keys: `db:<topic_id>`, `db:<subtopic_id>`, `waec:<subject>:<i>`, `jamb:<subject>:<i>`, `checkpoint:<programme>:<code>:<i>`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/curriculum.test.ts
import { describe, it, expect } from 'vitest'
import { curriculumRows, displayName } from './curriculum'

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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/curriculum.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `curriculum.ts`**

```ts
// scripts/figure-library/curriculum.ts
import { subjectKey } from './subjects'
import { levelBand, type Band } from './levels'

export type Source = 'rwanda' | 'cambridge' | 'nerdc' | 'waec' | 'jamb' | 'checkpoint'

export interface StagedTopic {
  key: string
  source: Source
  textbookId: number | null
  book: string
  subject: string
  band: Band
  name: string
}

export interface StagedSubtopic {
  key: string
  topicKey: string
  name: string
}

export interface DbBook { textbook_id: number; textbook_name: string; curriculum: number }
export interface DbTopic { topic_id: number; textbook_id: number; topic: string }
export interface DbSubtopic { subtopic_id: number; topic_id: number; subtopic: string }
export interface SyllabusSubject { name: string; topics: readonly string[] }
export interface CheckpointSyllabus { programme: 'primary' | 'lower-secondary'; name: string; code: string; strands: readonly string[] }

// Curricula 3 and 4 are WAEC and JAMB past-paper banks filed by year; their
// real topics come from the syllabus modules instead.
const SOURCE_OF: Record<number, Source> = { 0: 'rwanda', 1: 'cambridge', 2: 'nerdc' }

/** A name as a prompt shows it. The stored name keeps every character, since lookups need the exact string. */
export function displayName(name: string): string {
  return String(name ?? '')
    .replace(/\\b$/, '')
    .replace(/[\x00-\x1f]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function curriculumRows(input: {
  books: readonly DbBook[]
  topics: readonly DbTopic[]
  subtopics: readonly DbSubtopic[]
  waec: readonly SyllabusSubject[]
  jamb: readonly SyllabusSubject[]
  checkpoint: readonly CheckpointSyllabus[]
}): { topics: StagedTopic[]; subtopics: StagedSubtopic[]; unmapped: string[]; uncertain: string[] } {
  const bookById = new Map(input.books.map((b) => [Number(b.textbook_id), b]))
  const topics: StagedTopic[] = []
  const unmapped = new Set<string>()
  const uncertain = new Set<string>()

  for (const t of input.topics) {
    const book = bookById.get(Number(t.textbook_id))
    const source = book ? SOURCE_OF[Number(book.curriculum)] : undefined
    if (!book || !source || !displayName(t.topic)) continue
    const subject = subjectKey(book.textbook_name)
    if (subject === 'other') unmapped.add(book.textbook_name)
    const level = levelBand(book.textbook_name)
    if (!level.certain) uncertain.add(book.textbook_name)
    topics.push({ key: `db:${t.topic_id}`, source, textbookId: Number(book.textbook_id), book: book.textbook_name, subject, band: level.band, name: String(t.topic) })
  }

  const staged = new Set(topics.map((t) => t.key))
  const subtopics = input.subtopics
    .filter((s) => staged.has(`db:${s.topic_id}`) && displayName(s.subtopic))
    .map((s) => ({ key: `db:${s.subtopic_id}`, topicKey: `db:${s.topic_id}`, name: String(s.subtopic) }))

  for (const [source, list] of [['waec', input.waec], ['jamb', input.jamb]] as const) {
    for (const s of list) {
      const subject = subjectKey(s.name)
      if (subject === 'other') unmapped.add(s.name)
      s.topics.forEach((name, i) => topics.push({ key: `${source}:${s.name}:${i}`, source, textbookId: null, book: `${source.toUpperCase()} ${s.name}`, subject, band: 'UP', name }))
    }
  }

  for (const c of input.checkpoint) {
    const subject = subjectKey(c.name)
    if (subject === 'other') unmapped.add(c.name)
    c.strands.forEach((name, i) => topics.push({
      key: `checkpoint:${c.programme}:${c.code}:${i}`,
      source: 'checkpoint',
      textbookId: null,
      book: `Checkpoint ${c.name} ${c.code}`,
      subject,
      band: c.programme === 'primary' ? 'P' : 'LS',
      name,
    }))
  }

  return { topics, subtopics, unmapped: [...unmapped].sort(), uncertain: [...uncertain].sort() }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/curriculum.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Implement the export script**

```ts
// scripts/figure-library/export-curriculum.ts
// Run: npx jiti scripts/figure-library/export-curriculum.ts
// Reads production with SELECT only, and writes the staging store.
import { Pool } from 'pg'
import { openStore } from './store'
import { loadEnv } from './claude'
import { curriculumRows } from './curriculum'
import { WAEC_SUBJECTS, JAMB_UTME_SUBJECTS } from '../../lib/nigeria-exam-syllabi'
import { CHECKPOINT_SUBJECTS } from '../../lib/cambridge-checkpoint'

async function main() {
  const env = loadEnv()
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const books = (await pool.query('SELECT textbook_id, textbook_name, curriculum FROM textbooks WHERE curriculum IN (0, 1, 2)')).rows
  const topics = (await pool.query(
    'SELECT topic_id, textbook_id, topic FROM topics WHERE textbook_id IN (SELECT textbook_id FROM textbooks WHERE curriculum IN (0, 1, 2))',
  )).rows
  const subtopics = (await pool.query(
    'SELECT subtopic_id, topic_id, subtopic FROM subtopics WHERE topic_id IN (SELECT topic_id FROM topics WHERE textbook_id IN (SELECT textbook_id FROM textbooks WHERE curriculum IN (0, 1, 2)))',
  )).rows
  await pool.end()

  const rows = curriculumRows({ books, topics, subtopics, waec: WAEC_SUBJECTS, jamb: JAMB_UTME_SUBJECTS, checkpoint: CHECKPOINT_SUBJECTS })
  const db = openStore()
  const upTopic = db.prepare(`INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET source = excluded.source, textbook_id = excluded.textbook_id, book = excluded.book,
      subject = excluded.subject, band = excluded.band, name = excluded.name`)
  const upSub = db.prepare(`INSERT INTO subtopics (key, topic_key, name) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET topic_key = excluded.topic_key, name = excluded.name`)
  db.exec('BEGIN')
  for (const t of rows.topics) upTopic.run(t.key, t.source, t.textbookId, t.book, t.subject, t.band, t.name)
  for (const s of rows.subtopics) upSub.run(s.key, s.topicKey, s.name)
  db.exec('COMMIT')

  const bySource = new Map<string, number>()
  for (const t of rows.topics) bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1)
  console.log(`staged ${rows.topics.length} topics and ${rows.subtopics.length} subtopics`)
  for (const [source, n] of bySource) console.log(`  ${source}: ${n}`)
  console.log(`subjects: ${new Set(rows.topics.map((t) => t.subject)).size}`)
  if (rows.uncertain.length) console.log(`level assumed upper secondary for ${rows.uncertain.length} books:\n  ${rows.uncertain.join('\n  ')}`)
  if (rows.unmapped.length) {
    console.log(`NO SUBJECT for ${rows.unmapped.length} names; add rules to subjects.ts (with a test) and rerun:\n  ${rows.unmapped.join('\n  ')}`)
    process.exitCode = 1
  }
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
```

- [ ] **Step 6: Run it against production (read-only)**

Run: `npx jiti scripts/figure-library/export-curriculum.ts`
Expected: about 3,889 topics (rwanda 1,377, cambridge 1,098, nerdc 1,056, waec 210, jamb 116, checkpoint 32) and about 12,424 subtopics. Exit code 0.
If any name has no subject: add a rule and a test case to `subjects.ts` / `subjects.test.ts` and rerun until the list is empty. Read the "level assumed" list: any book there that is clearly Primary or Lower Secondary gets a rule and a test in `levels.ts`.

- [ ] **Step 7: Commit**

```bash
git add scripts/figure-library/curriculum.ts scripts/figure-library/curriculum.test.ts scripts/figure-library/export-curriculum.ts scripts/figure-library/subjects.ts scripts/figure-library/subjects.test.ts scripts/figure-library/levels.ts scripts/figure-library/levels.test.ts
git commit -m "feat(figure-library): stage every topic and subtopic from the database and syllabi"
```

---

### Task 7: Concept vocabulary

**Files:**
- Create: `scripts/figure-library/concepts.ts`
- Create: `scripts/figure-library/build-concepts.ts`
- Test: `scripts/figure-library/concepts.test.ts`

**Interfaces:**
- Consumes: `Band` (Task 3); `openStore`, `readJson` (Task 1); `assertBudget`, `costUsd`, `totalSpend`, `BudgetExceeded` (Task 2); `askJson`, `bedrockSender`, `runPool`, `HAIKU` (Task 5); `displayName` (Task 6).
- Produces: `interface Concept { id: string; subject: string; name: string; bands: Band[]; aliases: string[] }`, `slug(s): string`, `uniqueNames(names): string[]`, `chunk<T>(xs, size): T[][]`, `conceptPrompt(subject, names, existing): string`, `parseConcepts(subject, raw): Concept[]`, `mergeConcepts(lists): Concept[]`, `loadConcepts(db): Map<string, Concept[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/concepts.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { chunk, conceptPrompt, loadConcepts, mergeConcepts, parseConcepts, slug, uniqueNames, type Concept } from './concepts'

describe('names sent to the concept builder', () => {
  it('drops repeats regardless of case and spacing, sorted', () => {
    expect(uniqueNames(['Cells', ' cells ', 'Atoms', 'CELLS'])).toEqual(['Atoms', 'Cells'])
  })
  it('splits a large subject into chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('makes clean ids', () => {
    expect(slug('Rivers: Erosion & Transport')).toBe('rivers-erosion-transport')
  })
})

describe('the concept prompt', () => {
  it('passes on the ids earlier chunks made, so a large subject does not fork them', () => {
    const existing: Concept[] = [{ id: 'mathematics.simultaneous-equations', subject: 'mathematics', name: 'Simultaneous equations', bands: ['UP'], aliases: [] }]
    const p = conceptPrompt('mathematics', ['Solving pairs of equations'], existing)
    expect(p).toContain('simultaneous-equations: Simultaneous equations')
    expect(p).toContain('- Solving pairs of equations')
  })
})

describe('parsing concepts', () => {
  it('prefixes ids with the subject and keeps only valid bands', () => {
    const got = parseConcepts('biology', { concepts: [
      { id: 'Photosynthesis', name: 'Photosynthesis', bands: ['ls', 'UP', 'X'], aliases: ['light reactions'] },
      { id: '', name: '', bands: ['P'] },
      { id: 'no-bands', name: 'No bands', bands: [] },
    ] })
    expect(got).toEqual([{ id: 'biology.photosynthesis', subject: 'biology', name: 'Photosynthesis', bands: ['LS', 'UP'], aliases: ['light reactions'] }])
  })
  it('returns nothing for a reply without a concepts list', () => {
    expect(parseConcepts('biology', { something: 1 })).toEqual([])
  })
  it('merges chunks by id, joining bands and aliases', () => {
    const a: Concept = { id: 'b.x', subject: 'b', name: 'X', bands: ['LS'], aliases: ['one'] }
    const b: Concept = { id: 'b.x', subject: 'b', name: 'X', bands: ['UP'], aliases: ['two'] }
    expect(mergeConcepts([[a], [b]])).toEqual([{ id: 'b.x', subject: 'b', name: 'X', bands: ['LS', 'UP'], aliases: ['one', 'two'] }])
  })
  it('loads stored concepts grouped by subject', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO concepts (id, subject, name, bands, aliases) VALUES ('biology.cells', 'biology', 'Cells', '[\"LS\"]', '[]')").run()
    expect(loadConcepts(db).get('biology')?.map((c) => c.id)).toEqual(['biology.cells'])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/concepts.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `concepts.ts`**

```ts
// scripts/figure-library/concepts.ts
import type { Band } from './levels'
import { readJson, type Store } from './store'

export interface Concept {
  id: string
  subject: string
  name: string
  bands: Band[]
  aliases: string[]
}

const BANDS: readonly Band[] = ['P', 'LS', 'UP', 'AL']

export function slug(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of names) {
    const name = String(raw ?? '').trim()
    const key = name.toLowerCase().replace(/\s+/g, ' ')
    if (name && !seen.has(key)) seen.set(key, name)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export function conceptPrompt(subject: string, names: readonly string[], existing: readonly Concept[]): string {
  const local = (id: string) => id.slice(subject.length + 1)
  return [
    `You are building the controlled list of CONCEPTS for the school subject "${subject}".`,
    'Below are topic and subtopic names from several curricula (Rwanda, Cambridge, Nigeria NERDC, WAEC, JAMB).',
    'A concept is one teachable idea that a figure could illustrate, at the grain of a textbook section:',
    '"photosynthesis", "cell structure", "simultaneous equations", "rivers: erosion and transport".',
    'Not a whole chapter ("Biology") and not a single fact ("chlorophyll is green").',
    'Merge names that mean the same thing across curricula. Every name below must fit at least one concept.',
    existing.length
      ? `Concepts already listed for this subject. Reuse one when a name fits it, and do not list it again:\n${existing.map((c) => `${local(c.id)}: ${c.name}`).join('\n')}`
      : '',
    '',
    'NAMES:',
    ...names.map((n) => `- ${n}`),
    '',
    'For each NEW concept give: id (lowercase words joined by hyphens, unique), name, bands (where it is taught: P primary, LS lower secondary, UP upper secondary / IGCSE / WAEC / JAMB, AL AS and A Level), aliases (other names for it, up to 5).',
    'Reply with JSON only: {"concepts":[{"id":"","name":"","bands":[""],"aliases":[""]}]}',
  ].filter(Boolean).join('\n')
}

export function parseConcepts(subject: string, raw: unknown): Concept[] {
  const list = (raw as { concepts?: unknown } | null)?.concepts
  if (!Array.isArray(list)) return []
  const out = new Map<string, Concept>()
  for (const item of list) {
    const c = (item ?? {}) as Record<string, unknown>
    const id = slug(String(c.id || c.name || ''))
    const name = String(c.name ?? '').trim()
    const bands = (Array.isArray(c.bands) ? c.bands : [])
      .map((b) => String(b).toUpperCase())
      .filter((b): b is Band => (BANDS as readonly string[]).includes(b))
    if (id.length < 2 || !name || !bands.length) continue
    const aliases = (Array.isArray(c.aliases) ? c.aliases : []).map((a) => String(a).trim()).filter(Boolean).slice(0, 5)
    const key = `${subject}.${id}`
    if (!out.has(key)) out.set(key, { id: key, subject, name, bands: [...new Set(bands)], aliases })
  }
  return [...out.values()]
}

export function mergeConcepts(lists: readonly (readonly Concept[])[]): Concept[] {
  const out = new Map<string, Concept>()
  for (const list of lists) {
    for (const c of list) {
      const have = out.get(c.id)
      if (!have) {
        out.set(c.id, { ...c, bands: [...c.bands], aliases: [...c.aliases] })
        continue
      }
      have.bands = BANDS.filter((b) => have.bands.includes(b) || c.bands.includes(b))
      have.aliases = [...new Set([...have.aliases, ...c.aliases])].slice(0, 8)
    }
  }
  return [...out.values()]
}

export function loadConcepts(db: Store): Map<string, Concept[]> {
  const rows = db.prepare('SELECT id, subject, name, bands, aliases FROM concepts ORDER BY id').all() as Record<string, string>[]
  const out = new Map<string, Concept[]>()
  for (const r of rows) {
    const c: Concept = { id: r.id, subject: r.subject, name: r.name, bands: readJson<Band[]>(r.bands, []), aliases: readJson<string[]>(r.aliases, []) }
    out.set(c.subject, [...(out.get(c.subject) ?? []), c])
  }
  return out
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/concepts.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Implement the build script**

```ts
// scripts/figure-library/build-concepts.ts
// Run: npx jiti scripts/figure-library/build-concepts.ts [--subject=biology] [--redo]
import { openStore } from './store'
import { BudgetExceeded, assertBudget, costUsd, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender, runPool } from './claude'
import { displayName } from './curriculum'
import { chunk, conceptPrompt, loadConcepts, mergeConcepts, parseConcepts, uniqueNames, type Concept } from './concepts'

const JOB = 'p0-concepts'
const JOB_CAP_USD = 6
const CHUNK = 900
// About 8 tokens a name plus the earlier concepts and instructions; up to 9k tokens out.
const estimateChunk = (names: number) => costUsd(HAIKU, names * 8 + 4000, 9000)

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']))
  const db = openStore()
  const have = loadConcepts(db)
  const subjects = (db.prepare('SELECT DISTINCT subject FROM topics ORDER BY subject').all() as { subject: string }[])
    .map((r) => r.subject)
    .filter((s) => (!args.subject || s === args.subject) && (args.redo === 'true' || !have.has(s)))

  const namesOf = (subject: string) => uniqueNames([
    ...(db.prepare('SELECT name FROM topics WHERE subject = ?').all(subject) as { name: string }[]).map((r) => displayName(r.name)),
    ...(db.prepare('SELECT s.name FROM subtopics s JOIN topics t ON t.key = s.topic_key WHERE t.subject = ?').all(subject) as { name: string }[]).map((r) => displayName(r.name)),
  ])
  const work = subjects.map((s) => ({ subject: s, chunks: chunk(namesOf(s), CHUNK) }))
  const estimate = work.reduce((sum, w) => sum + w.chunks.reduce((s, c) => s + estimateChunk(c.length), 0), 0)
  console.log(`${work.length} subjects, ${work.reduce((s, w) => s + w.chunks.length, 0)} calls, estimate $${estimate.toFixed(2)}`)
  assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })

  const send = bedrockSender()
  const insert = db.prepare('INSERT OR REPLACE INTO concepts (id, subject, name, bands, aliases) VALUES (?, ?, ?, ?, ?)')
  const failures: string[] = []
  try {
    await runPool(work, 4, async ({ subject, chunks }) => {
      let concepts: Concept[] = []
      for (const names of chunks) {
        try {
          const raw = await askJson({ db, job: JOB, jobCapUsd: JOB_CAP_USD, prompt: conceptPrompt(subject, names, concepts), maxTokens: 16000, send })
          concepts = mergeConcepts([concepts, parseConcepts(subject, raw)])
        } catch (err) {
          if (err instanceof BudgetExceeded) throw err
          failures.push(`${subject}: ${String((err as Error)?.message ?? err).slice(0, 120)}`)
          return
        }
      }
      db.exec('BEGIN')
      for (const c of concepts) insert.run(c.id, c.subject, c.name, JSON.stringify(c.bands), JSON.stringify(c.aliases))
      db.exec('COMMIT')
      console.log(`  ${subject}: ${concepts.length} concepts`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(`STOPPED BY BUDGET: ${err.message}`)
    process.exitCode = 2
  }
  if (failures.length) { console.log(`failed (rerun to retry):\n  ${failures.join('\n  ')}`); process.exitCode = process.exitCode || 1 }
  console.log(`${JOB} spend $${totalSpend(db, JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
```

- [ ] **Step 6: Try it on one subject, then read the result**

Run: `npx jiti scripts/figure-library/build-concepts.ts --subject=geography`
Expected: "geography: N concepts", with N roughly 40–150, and spend under $0.20.
Read the list:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('C:/Users/Stephen/figure-library/figures.db');for(const r of db.prepare(\"SELECT id,name,bands FROM concepts WHERE subject='geography' ORDER BY id\").all())console.log(r.id,'|',r.name,'|',r.bands)"
```

The grain should be textbook sections ("rivers-erosion-and-transport", "climate-graphs", "population-pyramids"): not whole chapters, not single facts. If the grain is wrong, adjust the wording in `conceptPrompt`, rerun with `--subject=geography --redo`, and add a test pinning the new wording.

- [ ] **Step 7: Build every subject**

Run: `npx jiti scripts/figure-library/build-concepts.ts`
Expected: one line per subject, no failures, `p0-concepts` spend under $6. If any subject failed, rerun the same command; only unfinished subjects are sent.

- [ ] **Step 8: Commit**

```bash
git add scripts/figure-library/concepts.ts scripts/figure-library/concepts.test.ts scripts/figure-library/build-concepts.ts
git commit -m "feat(figure-library): concept list per subject, shared across curricula"
```

---

### Task 8: Topic mapping

**Files:**
- Create: `scripts/figure-library/topicMap.ts`
- Create: `scripts/figure-library/map-topics.ts`
- Test: `scripts/figure-library/topicMap.test.ts`

**Interfaces:**
- Consumes: `Concept`, `loadConcepts` (Task 7); `FigureKind`, `FIGURE_KINDS` (Task 4); `Band` (Task 3); `Store`, `openStore` (Task 1); spend functions (Task 2); `askJson`, `bedrockSender`, `runPool`, `HAIKU` (Task 5); `displayName` (Task 6).
- Produces: `MAX_SUBTOPICS = 60`, `interface TopicInput`, `interface TopicMap { concepts; kinds; terms; visual; subtopics: { concepts; kinds }[]; dropped }`, `conceptsForBand(all, band): Concept[]`, `topicPrompt(t, concepts, kinds): string`, `parseTopicMap(raw, subject, valid, subtopicCount): TopicMap | null`, `topicsToMap(db, { limit?, subject?, redo? }): StagedRow[]`, `saveTopicMap(db, topicKey, subtopicKeys, map, model): void`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/topicMap.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { FIGURE_KINDS } from './figureKinds'
import type { Concept } from './concepts'
import { MAX_SUBTOPICS, conceptsForBand, parseTopicMap, saveTopicMap, topicPrompt, topicsToMap } from './topicMap'

const concepts: Concept[] = [
  { id: 'geography.rivers', subject: 'geography', name: 'Rivers', bands: ['LS', 'UP'], aliases: [] },
  { id: 'geography.climate', subject: 'geography', name: 'Climate', bands: ['UP'], aliases: [] },
]
const valid = { concepts: new Set(concepts.map((c) => c.id)), kinds: new Set(FIGURE_KINDS.map((k) => k.id)) }

describe('the topic prompt', () => {
  it('lists subtopics by number, or says there are none', () => {
    // Every NERDC, WAEC, JAMB and Checkpoint topic has no subtopics.
    const withSubs = topicPrompt({ subject: 'geography', band: 'LS', book: 'Geography S2', name: 'Rivers', subtopics: ['Erosion', 'Deposition'] }, concepts, FIGURE_KINDS)
    expect(withSubs).toContain('0. Erosion\n1. Deposition')
    expect(withSubs).toContain('rivers: Rivers')
    expect(withSubs).toContain('physics.circuit: Electrical circuit diagram (drawn)')
    const none = topicPrompt({ subject: 'geography', band: 'UP', book: 'WAEC Geography', name: 'Rivers', subtopics: [] }, concepts, FIGURE_KINDS)
    expect(none).toContain('SUBTOPICS: none')
  })
  it('sends at most 60 subtopics', () => {
    const many = Array.from({ length: 70 }, (_, i) => `Sub ${i}`)
    const p = topicPrompt({ subject: 'geography', band: 'LS', book: 'B', name: 'T', subtopics: many }, concepts, FIGURE_KINDS)
    expect(p).toContain(`${MAX_SUBTOPICS - 1}. Sub ${MAX_SUBTOPICS - 1}`)
    expect(p).not.toContain(`${MAX_SUBTOPICS}. Sub ${MAX_SUBTOPICS}`)
  })
  it('narrows concepts to the topic level only when enough remain', () => {
    expect(conceptsForBand(concepts, 'LS')).toEqual(concepts)
  })
})

describe('parsing a topic plan', () => {
  it('keeps valid ids, counts the ones it dropped, and cleans search terms', () => {
    const map = parseTopicMap({
      concepts: ['rivers', 'geography.climate', 'made-up'],
      kinds: ['geo.section', 'photo.landscape', 'not-a-kind'],
      terms: ['Oxbow Lake aerial', 'oxbow lake aerial', 'x'],
      visual: 'high',
      subtopics: [{ i: 0, concepts: ['rivers'], kinds: ['geo.section'] }, { i: 9, concepts: ['rivers'], kinds: [] }],
    }, 'geography', valid, 2)
    expect(map).toEqual({
      concepts: ['geography.rivers', 'geography.climate'],
      kinds: ['geo.section', 'photo.landscape'],
      terms: ['oxbow lake aerial'],
      visual: 'high',
      subtopics: [{ concepts: ['geography.rivers'], kinds: ['geo.section'] }, { concepts: [], kinds: [] }],
      dropped: 2,
    })
  })
  it('expects no subtopics for a topic that has none', () => {
    const map = parseTopicMap({ concepts: ['rivers'], kinds: ['geo.map'], terms: [], visual: 'medium', subtopics: [] }, 'geography', valid, 0)
    expect(map?.subtopics).toEqual([])
  })
  it('refuses a plan with no valid concept or no valid kind', () => {
    expect(parseTopicMap({ concepts: ['made-up'], kinds: ['geo.map'] }, 'geography', valid, 0)).toBeNull()
    expect(parseTopicMap({ concepts: ['rivers'], kinds: ['nope'] }, 'geography', valid, 0)).toBeNull()
    expect(parseTopicMap(null, 'geography', valid, 0)).toBeNull()
  })
})

describe('resuming a run', () => {
  it('maps only topics that have no plan yet', () => {
    const db = openStore(':memory:')
    for (const k of ['db:1', 'db:2', 'db:3']) {
      db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'Geography S2', 'geography', 'LS', ?)").run(k, `Topic ${k}`)
    }
    db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('db:100', 'db:1', 'Erosion')").run()
    saveTopicMap(db, 'db:1', ['db:100'], { concepts: ['geography.rivers'], kinds: ['geo.map'], terms: [], visual: 'high', subtopics: [{ concepts: [], kinds: ['geo.map'] }], dropped: 0 }, 'test')
    expect(topicsToMap(db, {}).map((t) => t.key)).toEqual(['db:2', 'db:3'])
    expect(topicsToMap(db, { limit: 1 }).map((t) => t.key)).toEqual(['db:2'])
    expect(topicsToMap(db, { redo: true }).map((t) => t.key)).toEqual(['db:1', 'db:2', 'db:3'])
    expect((db.prepare("SELECT kinds FROM subtopic_map WHERE subtopic_key = 'db:100'").get() as { kinds: string }).kinds).toBe('["geo.map"]')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/topicMap.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `topicMap.ts`**

```ts
// scripts/figure-library/topicMap.ts
import type { Concept } from './concepts'
import type { FigureKind } from './figureKinds'
import type { Band } from './levels'
import type { Store } from './store'

export const MAX_SUBTOPICS = 60

const BAND_LABEL: Record<Band, string> = {
  P: 'Primary',
  LS: 'Lower secondary',
  UP: 'Upper secondary (IGCSE, WAEC, JAMB, Rwanda S4-S6, NERDC SSS)',
  AL: 'AS and A Level',
}

export interface TopicInput {
  subject: string
  band: Band
  book: string
  name: string
  subtopics: readonly string[]
}

export interface TopicMap {
  concepts: string[]
  kinds: string[]
  terms: string[]
  visual: 'high' | 'medium' | 'low'
  subtopics: { concepts: string[]; kinds: string[] }[]
  dropped: number
}

export interface StagedRow {
  key: string
  subject: string
  band: Band
  book: string
  name: string
}

/** Concepts taught at the topic's level, unless that leaves too few to choose from. */
export function conceptsForBand(all: readonly Concept[], band: Band): Concept[] {
  const fit = all.filter((c) => c.bands.includes(band))
  return fit.length >= 20 ? fit : [...all]
}

export function topicPrompt(t: TopicInput, concepts: readonly Concept[], kinds: readonly FigureKind[]): string {
  const subs = t.subtopics.slice(0, MAX_SUBTOPICS)
  const local = (id: string) => id.slice(t.subject.length + 1)
  return [
    'Plan the figures for one school topic.',
    `SUBJECT: ${t.subject}`,
    `LEVEL: ${BAND_LABEL[t.band]}`,
    `BOOK: ${t.book}`,
    `TOPIC: ${t.name}`,
    subs.length ? `SUBTOPICS:\n${subs.map((s, i) => `${i}. ${s}`).join('\n')}` : 'SUBTOPICS: none',
    '',
    `CONCEPTS for this subject (id: name):\n${concepts.map((c) => `${local(c.id)}: ${c.name}`).join('\n')}`,
    '',
    `FIGURE KINDS (id: what it is; drawn = drawn from data, real = a real image):\n${kinds.map((k) => `${k.id}: ${k.label} (${k.drawn ? 'drawn' : 'real'})`).join('\n')}`,
    '',
    'Choose:',
    '- concepts: the concept ids this topic teaches (1 to 8).',
    '- kinds: every figure kind that could carry a good exam-style question on this topic at this level. A kind fits only if a student could answer a real question about the topic from that figure. Aim for 6 to 15; include drawn kinds wherever they truly fit.',
    '- terms: up to 8 short search terms for finding REAL educational images for this topic on Wikimedia Commons, for example "onion cell micrograph" or "oxbow lake aerial". Empty if no real kind fits.',
    '- visual: "high" if this topic is naturally taught with figures, "medium" if partly, "low" if it is mostly words (for example essay writing).',
    '- subtopics: for each subtopic by number, its concept ids and kinds.',
    'Reply with JSON only: {"concepts":[],"kinds":[],"terms":[],"visual":"","subtopics":[{"i":0,"concepts":[],"kinds":[]}]}',
  ].join('\n')
}

export function parseTopicMap(
  raw: unknown,
  subject: string,
  valid: { concepts: ReadonlySet<string>; kinds: ReadonlySet<string> },
  subtopicCount: number,
): TopicMap | null {
  const r = (raw ?? {}) as Record<string, unknown>
  let dropped = 0
  const pick = (xs: unknown, accept: (s: string) => string | null): string[] => {
    const out: string[] = []
    for (const x of Array.isArray(xs) ? xs : []) {
      const v = accept(String(x).trim())
      if (!v) dropped++
      else if (!out.includes(v)) out.push(v)
    }
    return out
  }
  const concept = (s: string) => {
    const id = s.startsWith(`${subject}.`) ? s : `${subject}.${s}`
    return valid.concepts.has(id) ? id : null
  }
  const kind = (s: string) => (valid.kinds.has(s) ? s : null)

  const concepts = pick(r.concepts, concept).slice(0, 8)
  const kinds = pick(r.kinds, kind)
  if (!concepts.length || !kinds.length) return null

  const terms = (Array.isArray(r.terms) ? r.terms : [])
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 60)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 8)
  const visual = r.visual === 'high' || r.visual === 'low' ? r.visual : 'medium'
  const subtopics = Array.from({ length: subtopicCount }, () => ({ concepts: [] as string[], kinds: [] as string[] }))
  for (const s of Array.isArray(r.subtopics) ? r.subtopics : []) {
    const item = (s ?? {}) as Record<string, unknown>
    const i = Number(item.i)
    if (!Number.isInteger(i) || i < 0 || i >= subtopicCount) continue
    subtopics[i] = { concepts: pick(item.concepts, concept), kinds: pick(item.kinds, kind) }
  }
  return { concepts, kinds, terms, visual, subtopics, dropped }
}

/** Topics with no plan yet, so a stopped run resumes where it left off. */
export function topicsToMap(db: Store, o: { limit?: number; subject?: string; redo?: boolean }): StagedRow[] {
  const where = [o.redo ? '1 = 1' : 'm.topic_key IS NULL', o.subject ? 't.subject = ?' : '1 = 1'].join(' AND ')
  const sql = `SELECT t.key, t.subject, t.band, t.book, t.name FROM topics t LEFT JOIN topic_map m ON m.topic_key = t.key WHERE ${where} ORDER BY t.subject, t.key${o.limit ? ` LIMIT ${Math.max(1, Math.floor(o.limit))}` : ''}`
  return (o.subject ? db.prepare(sql).all(o.subject) : db.prepare(sql).all()) as StagedRow[]
}

export function saveTopicMap(db: Store, topicKey: string, subtopicKeys: readonly string[], map: TopicMap, model: string): void {
  db.exec('BEGIN')
  db.prepare(`INSERT OR REPLACE INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(topicKey, JSON.stringify(map.concepts), JSON.stringify(map.kinds), JSON.stringify(map.terms), map.visual, map.dropped, model, new Date().toISOString())
  const sub = db.prepare('INSERT OR REPLACE INTO subtopic_map (subtopic_key, concepts, kinds) VALUES (?, ?, ?)')
  map.subtopics.forEach((s, i) => { if (subtopicKeys[i]) sub.run(subtopicKeys[i], JSON.stringify(s.concepts), JSON.stringify(s.kinds)) })
  db.exec('COMMIT')
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/topicMap.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Implement the mapping script**

```ts
// scripts/figure-library/map-topics.ts
// Run: npx jiti scripts/figure-library/map-topics.ts [--limit=20] [--subject=geography] [--redo]
import { openStore } from './store'
import { BudgetExceeded, assertBudget, costUsd, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender, runPool } from './claude'
import { displayName } from './curriculum'
import { loadConcepts } from './concepts'
import { FIGURE_KINDS } from './figureKinds'
import { MAX_SUBTOPICS, conceptsForBand, parseTopicMap, saveTopicMap, topicPrompt, topicsToMap, type TopicMap } from './topicMap'

const JOB = 'p0-map'
const JOB_CAP_USD = 34
const RETRY_NOTE = '\nYour last reply used ids that are not in the lists, or none at all. Use only ids from the CONCEPTS and FIGURE KINDS lists above.'

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']))
  const db = openStore()
  const conceptsBySubject = loadConcepts(db)
  const validKinds = new Set(FIGURE_KINDS.map((k) => k.id))
  const todo = topicsToMap(db, { limit: args.limit ? Number(args.limit) : undefined, subject: args.subject, redo: args.redo === 'true' })
  const estimate = todo.length * costUsd(HAIKU, 4500, 700)
  console.log(`${todo.length} topics to map, estimate $${estimate.toFixed(2)}`)
  assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })

  const send = bedrockSender()
  const subsOf = db.prepare('SELECT key, name FROM subtopics WHERE topic_key = ? ORDER BY key')
  const failures: string[] = []
  const truncated: string[] = []
  let done = 0
  try {
    await runPool(todo, 6, async (t) => {
      const concepts = conceptsForBand(conceptsBySubject.get(t.subject) ?? [], t.band)
      if (!concepts.length) { failures.push(`${t.key} (${t.subject}): no concepts; run build-concepts first`); return }
      const subs = subsOf.all(t.key) as { key: string; name: string }[]
      if (subs.length > MAX_SUBTOPICS) truncated.push(`${t.key} (${subs.length} subtopics)`)
      const count = Math.min(subs.length, MAX_SUBTOPICS)
      const prompt = topicPrompt({ subject: t.subject, band: t.band, book: t.book, name: displayName(t.name), subtopics: subs.map((s) => displayName(s.name)) }, concepts, FIGURE_KINDS)
      const valid = { concepts: new Set(concepts.map((c) => c.id)), kinds: validKinds }
      let map: TopicMap | null = null
      try {
        for (let attempt = 0; attempt < 2 && !map; attempt++) {
          const raw = await askJson({ db, job: JOB, jobCapUsd: JOB_CAP_USD, prompt: attempt ? prompt + RETRY_NOTE : prompt, maxTokens: 2500, send })
          map = parseTopicMap(raw, t.subject, valid, count)
        }
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        failures.push(`${t.key}: ${String((err as Error)?.message ?? err).slice(0, 120)}`)
        return
      }
      if (!map) { failures.push(`${t.key}: no valid concept or kind after a retry`); return }
      saveTopicMap(db, t.key, subs.slice(0, count).map((s) => s.key), map, HAIKU)
      if (++done % 100 === 0) console.log(`  ${done}/${todo.length}, spend $${totalSpend(db, JOB).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(`STOPPED BY BUDGET: ${err.message}`)
    process.exitCode = 2
  }
  console.log(`mapped ${done}; failed ${failures.length}; subtopics cut at ${MAX_SUBTOPICS} on ${truncated.length} topics`)
  if (failures.length) console.log(`failed (rerun to retry):\n  ${failures.slice(0, 50).join('\n  ')}`)
  if (truncated.length) console.log(`cut:\n  ${truncated.join('\n  ')}`)
  console.log(`${JOB} spend $${totalSpend(db, JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
```

- [ ] **Step 6: Map 20 topics and read them before the full run**

Run: `npx jiti scripts/figure-library/map-topics.ts --limit=20`
Expected: "mapped 20", spend under $0.25.
Read them:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('C:/Users/Stephen/figure-library/figures.db');for(const r of db.prepare('SELECT t.name,t.band,m.kinds,m.terms,m.visual,m.dropped FROM topic_map m JOIN topics t ON t.key=m.topic_key LIMIT 20').all())console.log(r.band,'|',r.name,'|',r.visual,'|',r.kinds,'|',r.terms,'| dropped',r.dropped)"
```

Check, for each topic:
- the kinds are ones a teacher would actually use for it;
- the search terms would find educational images, not decoration;
- `dropped` is mostly 0.

If kinds are padded with poor fits, tighten the "kinds" instruction in `topicPrompt`, add a test pinning the new wording, rerun with `--limit=20 --redo`, and read them again.

- [ ] **Step 7: Map everything**

Run: `npx jiti scripts/figure-library/map-topics.ts`
Expected: about 3,889 mapped, a handful of failures at most, `p0-map` spend under $34. Rerun the same command to retry failures: only unmapped topics are sent.

- [ ] **Step 8: Commit**

```bash
git add scripts/figure-library/topicMap.ts scripts/figure-library/topicMap.test.ts scripts/figure-library/map-topics.ts
git commit -m "feat(figure-library): map every topic and subtopic to concepts and figure kinds"
```

---

### Task 9: Real-image supply probe

**Files:**
- Create: `scripts/figure-library/wikimedia.ts`
- Create: `scripts/figure-library/probe-supply.ts`
- Test: `scripts/figure-library/wikimedia.test.ts`

**Interfaces:**
- Consumes: `Store`, `openStore`, `readJson` (Task 1); `sleep` (Task 5).
- Produces: `USER_AGENT`, `searchUrl(term, filetype: 'bitmap' | 'drawing'): string`, `parseHits(body): number`, `type FetchFn`, `countImages(term, fetchFn?, wait?): Promise<number>`, `termsToProbe(db, redo?): string[]`, `saveSupply(db, term, hits): void`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/wikimedia.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { USER_AGENT, countImages, parseHits, saveSupply, searchUrl, termsToProbe, type FetchFn } from './wikimedia'

const noWait = async () => {}

describe('counting candidate images on Wikimedia Commons', () => {
  it('searches files of one type and asks only for the total', () => {
    const url = new URL(searchUrl('oxbow lake', 'bitmap'))
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php')
    expect(url.searchParams.get('srsearch')).toBe('oxbow lake filetype:bitmap')
    expect(url.searchParams.get('srnamespace')).toBe('6')
    expect(url.searchParams.get('srlimit')).toBe('1')
  })

  it('reads the total, and refuses a reply without one', () => {
    expect(parseHits({ query: { searchinfo: { totalhits: 412 } } })).toBe(412)
    expect(() => parseHits({ error: { code: 'x' } })).toThrow(/total/)
  })

  it('adds photos and drawings, identifies itself, and retries a rate limit', async () => {
    const seen: string[] = []
    let calls = 0
    const fetchFn: FetchFn = async (url, init) => {
      seen.push(init.headers['User-Agent'])
      calls++
      if (calls === 1) return { ok: false, status: 429, json: async () => ({}) }
      const hits = url.includes('bitmap') ? 300 : 40
      return { ok: true, status: 200, json: async () => ({ query: { searchinfo: { totalhits: hits } } }) }
    }
    expect(await countImages('oxbow lake', fetchFn, noWait)).toBe(340)
    expect(new Set(seen)).toEqual(new Set([USER_AGENT]))
  })

  it('probes each search term once, across all topics, and skips ones already counted', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'rwanda', 'B', 'geography', 'LS', 'Rivers'), ('db:2', 'rwanda', 'B', 'geography', 'LS', 'Coasts')").run()
    db.prepare(`INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES
      ('db:1', '[]', '[]', '["oxbow lake","meander"]', 'high', 'm', 'now'),
      ('db:2', '[]', '[]', '["meander","spit"]', 'high', 'm', 'now')`).run()
    saveSupply(db, 'meander', 5000)
    expect(termsToProbe(db)).toEqual(['oxbow lake', 'spit'])
    expect(termsToProbe(db, true)).toEqual(['meander', 'oxbow lake', 'spit'])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/wikimedia.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `wikimedia.ts`**

```ts
// scripts/figure-library/wikimedia.ts
import { readJson, type Store } from './store'
import { sleep } from './claude'

/** Wikimedia asks every API client to identify itself with a contact. The site, never the account email. */
export const USER_AGENT = 'StudySquareFigureLibrary/0.1 (https://www.studysquare.org)'

export function searchUrl(term: string, filetype: 'bitmap' | 'drawing'): string {
  const q = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${term} filetype:${filetype}`,
    srnamespace: '6',
    srlimit: '1',
    srinfo: 'totalhits',
    srprop: '',
    format: 'json',
    formatversion: '2',
  })
  return `https://commons.wikimedia.org/w/api.php?${q}`
}

export function parseHits(body: unknown): number {
  const hits = (body as { query?: { searchinfo?: { totalhits?: unknown } } } | null)?.query?.searchinfo?.totalhits
  if (typeof hits !== 'number') throw new Error('No total in the Wikimedia reply')
  return hits
}

export type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/** Photos plus drawings for one term. One request at a time; rate limits are waited out. */
export async function countImages(term: string, fetchFn: FetchFn = fetch as unknown as FetchFn, wait: (ms: number) => Promise<void> = sleep): Promise<number> {
  let total = 0
  for (const filetype of ['bitmap', 'drawing'] as const) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(searchUrl(term, filetype), { headers: { 'User-Agent': USER_AGENT } })
      if (res.ok) { total += parseHits(await res.json()); break }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) { await wait(2000 * 2 ** attempt); continue }
      throw new Error(`Wikimedia search failed (${res.status}) for "${term}"`)
    }
  }
  return total
}

/** Every search term any topic asked for, once, minus those already counted. */
export function termsToProbe(db: Store, redo = false): string[] {
  const all = new Set<string>()
  for (const r of db.prepare('SELECT terms FROM topic_map').all() as { terms: string }[]) {
    for (const t of readJson<string[]>(r.terms, [])) all.add(String(t).trim().toLowerCase())
  }
  const done = redo ? new Set<string>() : new Set((db.prepare('SELECT term FROM supply').all() as { term: string }[]).map((r) => r.term))
  return [...all].filter((t) => t && !done.has(t)).sort()
}

export function saveSupply(db: Store, term: string, hits: number): void {
  db.prepare('INSERT OR REPLACE INTO supply (term, source, hits, probed_at) VALUES (?, ?, ?, ?)')
    .run(term.trim().toLowerCase(), 'wikimedia', hits, new Date().toISOString())
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/wikimedia.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Implement the probe script**

```ts
// scripts/figure-library/probe-supply.ts
// Run: npx jiti scripts/figure-library/probe-supply.ts [--limit=200] [--redo]
// Free: Wikimedia's search API. One request at a time, 250 ms apart.
import { openStore } from './store'
import { sleep } from './claude'
import { countImages, saveSupply, termsToProbe } from './wikimedia'

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']))
  const db = openStore()
  const all = termsToProbe(db, args.redo === 'true')
  const todo = args.limit ? all.slice(0, Number(args.limit)) : all
  console.log(`${todo.length} search terms to count (about ${Math.ceil(todo.length * 1.2 / 60)} minutes)`)
  let done = 0
  const failed: string[] = []
  for (const term of todo) {
    try {
      saveSupply(db, term, await countImages(term))
      done++
    } catch (err) {
      failed.push(`${term}: ${String((err as Error)?.message ?? err).slice(0, 100)}`)
    }
    if ((done + failed.length) % 200 === 0) console.log(`  ${done + failed.length}/${todo.length}`)
    await sleep(250)
  }
  console.log(`counted ${done}; failed ${failed.length}`)
  if (failed.length) { console.log(`failed (rerun to retry):\n  ${failed.slice(0, 30).join('\n  ')}`); process.exitCode = 1 }
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
```

- [ ] **Step 6: Try 20 terms, then run the rest in the background**

Run: `npx jiti scripts/figure-library/probe-supply.ts --limit=20`
Expected: "counted 20; failed 0". Spot-check two terms by hand at commons.wikimedia.org: the totals should be the right order of magnitude.

Then run `npx jiti scripts/figure-library/probe-supply.ts` in the background. Expect 1–3 hours, depending on how many distinct terms the mapping produced. If it stops, rerun it; it skips terms already counted.

- [ ] **Step 7: Commit**

```bash
git add scripts/figure-library/wikimedia.ts scripts/figure-library/wikimedia.test.ts scripts/figure-library/probe-supply.ts
git commit -m "feat(figure-library): count real candidate images per search term"
```

---

### Task 10: Feasibility assessment and report

**Files:**
- Create: `scripts/figure-library/feasibility.ts`
- Create: `scripts/figure-library/report.ts`
- Test: `scripts/figure-library/feasibility.test.ts`

**Interfaces:**
- Consumes: `FigureKind`, `KIND_BY_ID` (Task 4); `Store`, `openStore`, `readJson`, `libraryDir` (Task 1); `totalSpend` (Task 2).
- Produces: `TARGET_TOPIC = 50`, `TARGET_SUBTOPIC = 10`, `SURVIVAL = 0.15`, `PER_UNIT = 10`, `TERM_CAP = 2000`, `type Status = 'ready' | 'thin' | 'hard'`, `interface PlanRow`, `interface Assessment`, `assess(plan, hits, kinds): Assessment`, `subtopicOk(kindsMapped, topicStatus): boolean`, `summarise(rows): Summary`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/figure-library/feasibility.test.ts
import { describe, it, expect } from 'vitest'
import { KIND_BY_ID } from './figureKinds'
import { assess, subtopicOk, summarise, type PlanRow } from './feasibility'

const plan = (kinds: string[], terms: string[] = []): PlanRow => ({ key: 'k', source: 'rwanda', subject: 'geography', band: 'LS', name: 'Rivers', kinds, terms, visual: 'high' })
const hits = (table: Record<string, number>) => (t: string) => table[t]

describe('whether a topic can reach 50 figures with variety', () => {
  it('is ready with six or more kinds that can actually supply figures', () => {
    const a = assess(plan(['geo.map', 'geo.section', 'graph.line', 'photo.landscape', 'photo.specimen', 'table.data'], ['oxbow lake', 'meander']), hits({ 'oxbow lake': 400, meander: 900 }), KIND_BY_ID)
    expect(a).toMatchObject({ drawnKinds: 4, realKinds: 2, realEstimate: 195, realUnits: 2, variety: 6, status: 'ready' })
  })

  it('does not count a real kind that has too few candidate images', () => {
    const a = assess(plan(['geo.map', 'photo.landscape', 'photo.specimen'], ['rare term']), hits({ 'rare term': 30 }), KIND_BY_ID)
    expect(a).toMatchObject({ realEstimate: 5, realUnits: 0, variety: 1, status: 'hard' })
  })

  it('caps one broad term so it cannot carry a topic alone', () => {
    const a = assess(plan(['photo.landscape'], ['water']), hits({ water: 3_000_000 }), KIND_BY_ID)
    expect(a.realEstimate).toBe(300)
  })

  it('treats a term not yet counted as no supply', () => {
    const a = assess(plan(['photo.landscape'], ['unprobed']), hits({}), KIND_BY_ID)
    expect(a.realEstimate).toBe(0)
  })

  it('calls three to five sources thin', () => {
    expect(assess(plan(['geo.map', 'geo.section', 'graph.line']), hits({}), KIND_BY_ID).status).toBe('thin')
  })
})

describe('subtopics', () => {
  it('need two kinds of their own and a topic that is not hard', () => {
    expect(subtopicOk(2, 'ready')).toBe(true)
    expect(subtopicOk(1, 'ready')).toBe(false)
    expect(subtopicOk(3, 'hard')).toBe(false)
  })
})

describe('the summary', () => {
  it('counts by status, subject and source', () => {
    const s = summarise([
      { plan: plan(['geo.map']), assessment: { key: 'a', drawnKinds: 6, realKinds: 0, realEstimate: 0, realUnits: 0, variety: 6, status: 'ready' } },
      { plan: { ...plan(['geo.map']), subject: 'english', source: 'waec' }, assessment: { key: 'b', drawnKinds: 1, realKinds: 0, realEstimate: 0, realUnits: 0, variety: 1, status: 'hard' } },
    ])
    expect(s.byStatus).toEqual({ ready: 1, thin: 0, hard: 1 })
    expect(s.bySubject.english).toEqual({ ready: 0, thin: 0, hard: 1 })
    expect(s.bySource.rwanda).toEqual({ ready: 1, thin: 0, hard: 0 })
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/figure-library/feasibility.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `feasibility.ts`**

```ts
// scripts/figure-library/feasibility.ts
import type { FigureKind } from './figureKinds'

export const TARGET_TOPIC = 50
export const TARGET_SUBTOPIC = 10
/** Share of Wikimedia hits expected to survive filtering, screening and checking. 15% until the pilot measures it. */
export const SURVIVAL = 0.15
/** Approved real images a real kind needs before it counts as a source of variety. */
export const PER_UNIT = 10
/** One broad term can return millions of hits; none counts for more than this. */
export const TERM_CAP = 2000

export type Status = 'ready' | 'thin' | 'hard'

export interface PlanRow {
  key: string
  source: string
  subject: string
  band: string
  name: string
  kinds: string[]
  terms: string[]
  visual: string
}

export interface Assessment {
  key: string
  drawnKinds: number
  realKinds: number
  realEstimate: number
  realUnits: number
  variety: number
  status: Status
}

/**
 * Variety is what decides it. Drawn kinds can supply any number of figures,
 * but the spec caps any one family at 25% of a topic and asks for six or more
 * sources, so six usable kinds is "ready". Real kinds count only when enough
 * candidates exist to survive the pipeline.
 */
export function assess(plan: PlanRow, hits: (term: string) => number | undefined, kinds: ReadonlyMap<string, FigureKind>): Assessment {
  const drawnKinds = plan.kinds.filter((k) => kinds.get(k)?.drawn === true).length
  const realKinds = plan.kinds.filter((k) => kinds.get(k)?.drawn === false).length
  const realEstimate = Math.round(plan.terms.reduce((sum, t) => sum + Math.min(hits(t) ?? 0, TERM_CAP), 0) * SURVIVAL)
  const realUnits = Math.min(realKinds, Math.floor(realEstimate / PER_UNIT))
  const variety = drawnKinds + realUnits
  const status: Status = variety >= 6 ? 'ready' : variety >= 3 ? 'thin' : 'hard'
  return { key: plan.key, drawnKinds, realKinds, realEstimate, realUnits, variety, status }
}

export function subtopicOk(kindsMapped: number, topicStatus: Status): boolean {
  return topicStatus !== 'hard' && kindsMapped >= 2
}

export interface Summary {
  topics: number
  byStatus: Record<Status, number>
  bySubject: Record<string, Record<Status, number>>
  bySource: Record<string, Record<Status, number>>
}

export function summarise(rows: readonly { plan: PlanRow; assessment: Assessment }[]): Summary {
  const empty = (): Record<Status, number> => ({ ready: 0, thin: 0, hard: 0 })
  const s: Summary = { topics: rows.length, byStatus: empty(), bySubject: {}, bySource: {} }
  for (const { plan, assessment } of rows) {
    s.byStatus[assessment.status]++
    ;(s.bySubject[plan.subject] ??= empty())[assessment.status]++
    ;(s.bySource[plan.source] ??= empty())[assessment.status]++
  }
  return s
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/figure-library/feasibility.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Implement the report script**

```ts
// scripts/figure-library/report.ts
// Run: npx jiti scripts/figure-library/report.ts
// Writes <FIGURE_LIBRARY_DIR>/reports/p0-feasibility.json and .md
import fs from 'node:fs'
import path from 'node:path'
import { libraryDir, openStore, readJson } from './store'
import { totalSpend } from './spend'
import { KIND_BY_ID } from './figureKinds'
import { assess, subtopicOk, summarise, type PlanRow } from './feasibility'

function main() {
  const db = openStore()
  const hitsByTerm = new Map((db.prepare('SELECT term, hits FROM supply').all() as { term: string; hits: number }[]).map((r) => [r.term, r.hits]))
  const rows = db.prepare(`SELECT t.key, t.source, t.subject, t.band, t.name, m.kinds, m.terms, m.visual
    FROM topics t JOIN topic_map m ON m.topic_key = t.key ORDER BY t.subject, t.key`).all() as Record<string, string>[]
  const unmapped = (db.prepare('SELECT COUNT(*) AS n FROM topics t LEFT JOIN topic_map m ON m.topic_key = t.key WHERE m.topic_key IS NULL').get() as { n: number }).n
  const assessed = rows.map((r) => {
    const plan: PlanRow = { key: r.key, source: r.source, subject: r.subject, band: r.band, name: r.name, kinds: readJson(r.kinds, []), terms: readJson(r.terms, []), visual: r.visual }
    return { plan, assessment: assess(plan, (t) => hitsByTerm.get(t), KIND_BY_ID) }
  })
  const statusOf = new Map(assessed.map((a) => [a.plan.key, a.assessment.status]))
  const subRows = db.prepare('SELECT s.topic_key, sm.kinds FROM subtopics s LEFT JOIN subtopic_map sm ON sm.subtopic_key = s.key').all() as { topic_key: string; kinds: string | null }[]
  const subOk = subRows.filter((s) => subtopicOk(readJson<string[]>(s.kinds, []).length, statusOf.get(s.topic_key) ?? 'hard')).length
  const termsUnprobed = new Set(assessed.flatMap((a) => a.plan.terms).filter((t) => !hitsByTerm.has(t))).size
  const summary = summarise(assessed)
  const short = assessed.filter((a) => a.assessment.status !== 'ready')

  const dir = path.join(libraryDir(), 'reports')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'p0-feasibility.json'), JSON.stringify({ summary, unmapped, subtopics: { total: subRows.length, ok: subOk }, termsUnprobed, topics: assessed }, null, 1))

  const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0}%`
  const md = [
    '# P0 feasibility report',
    '',
    `Topics mapped: ${summary.topics} (not mapped: ${unmapped}). Ready: ${summary.byStatus.ready} (${pct(summary.byStatus.ready, summary.topics)}), thin: ${summary.byStatus.thin}, hard: ${summary.byStatus.hard}.`,
    `Subtopics with at least two kinds under a feasible topic: ${subOk} of ${subRows.length} (${pct(subOk, subRows.length)}).`,
    `Search terms not yet counted on Wikimedia: ${termsUnprobed}. Model spend so far: $${totalSpend(db).toFixed(2)}.`,
    '',
    '## By subject',
    '',
    '| Subject | Ready | Thin | Hard |',
    '|---|---|---|---|',
    ...Object.entries(summary.bySubject).sort((a, b) => a[0].localeCompare(b[0])).map(([s, c]) => `| ${s} | ${c.ready} | ${c.thin} | ${c.hard} |`),
    '',
    '## Topics not ready',
    '',
    '| Subject | Level | Topic | Drawn kinds | Real units | Visual |',
    '|---|---|---|---|---|---|',
    ...short.map(({ plan, assessment }) => `| ${plan.subject} | ${plan.band} | ${plan.name.replace(/\|/g, '/')} | ${assessment.drawnKinds} | ${assessment.realUnits} | ${plan.visual} |`),
  ].join('\n')
  fs.writeFileSync(path.join(dir, 'p0-feasibility.md'), md)
  console.log(md.split('\n').slice(0, 6).join('\n'))
  console.log(`\nwritten to ${dir}`)
  db.close()
}

main()
```

- [ ] **Step 6: Run the full suite and the type check**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: every test passes (the previous total plus this plan's tests); tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add scripts/figure-library/feasibility.ts scripts/figure-library/feasibility.test.ts scripts/figure-library/report.ts
git commit -m "feat(figure-library): feasibility of 50 figures per topic, with a report"
```

---

### Task 11: Run P0 and report to the user

**Files:** none in the repo. Outputs go to `C:/Users/Stephen/figure-library/` (`figures.db`, `reports/`).

**Interfaces:**
- Consumes: every script above.

- [ ] **Step 1: Confirm everything has run in order**

The export (Task 6, Step 6), concepts (Task 7, Step 7), mapping (Task 8, Step 7) and probe (Task 9, Step 6) have each finished with no failures left after reruns. Check spend:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('C:/Users/Stephen/figure-library/figures.db');console.log(db.prepare('SELECT job, ROUND(SUM(usd),2) usd, COUNT(*) calls FROM spend GROUP BY job').all())"
```

Expected: `p0-concepts` ≤ $6, `p0-map` ≤ $34, total ≤ $40.

- [ ] **Step 2: Produce the report**

Run: `npx jiti scripts/figure-library/report.ts`
Expected: the summary lines print and the two report files are written. "Search terms not yet counted" is 0.

- [ ] **Step 3: Read the topics that are not ready**

Open `C:/Users/Stephen/figure-library/reports/p0-feasibility.md`. Sort the not-ready topics into three groups:
1. **Mapping misses:** a topic that clearly has figures but got few kinds. Remap those with `--redo` after checking the prompt.
2. **Text-led topics** (essay writing, literary appreciation, grammar, religious texts), where `visual` is "low".
3. **Real-image gaps:** good kinds, but too few Wikimedia candidates.

- [ ] **Step 4: Publish the report for the user**

Build an artifact page from `p0-feasibility.json`:
- the headline figures: ready, thin and hard topics, and subtopics covered;
- a table by subject;
- the three groups from Step 3, with the options for each (more drawn kinds, a lower target the user approves, other real-image sources).

Follow the artifact-design skill. Give the user the link and a short summary. Ask them to decide on the hard and thin topics; per spec section 3, none is quietly left short.

- [ ] **Step 5: Record the outcome in the spec**

Add a short "P0 result" paragraph under section 9 of `docs/superpowers/specs/2026-10-10-figure-library-design.md`: the ready, thin and hard counts, the spend, and the user's decision on exceptions.

```bash
git add docs/superpowers/specs/2026-10-10-figure-library-design.md
git commit -m "docs: P0 feasibility result for the figure library"
```
