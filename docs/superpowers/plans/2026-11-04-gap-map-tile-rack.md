# Gap Map Tile Rack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gap Map wall with the tile rack: illustrated chapter tiles where a chapter with gaps lifts out of its slot, a chapter page with a path of section plates, Kana guiding, and gaps that close on the latest attempt.

**Architecture:** The existing API gains fields without losing any. A new pure model (`lib/studylab/rack.ts`) turns its response into trays, chapters and sections, so all rules are unit-tested and the components only draw. Both views live on the existing `/studylab/gap-map` route, with the chapter chosen by `?chapter=<topicId>&section=<subtopicId>`, so `GapMap.tsx` stays mounted and keeps its study and quiz actions.

**Tech Stack:** Next.js 16.3 App Router (client components), TypeScript, Postgres via `@/lib/db`, Tailwind 3 with `ss-*` tokens plus one plain CSS file, Vitest (node environment, `*.test.ts` only), `playwright-core` for checks by screenshot.

**Spec:** `docs/superpowers/specs/2026-11-04-gap-map-tile-rack-design.md`. Read it first. The look comes from the approved mockup, `.superpowers/brainstorm/43-1793726521/content/flat.html` (view its source for exact CSS values and the `plate()` drawing).

## Global Constraints

- Work on `aws_deploy` in the main repo. No worktrees. Never `git stash`.
- Never push. Commit per task, and stage named files only: the tree holds many unrelated changes under `scripts/figgen/`, so never `git add -A` or `git add .`.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `.env` points at the live database, and the dev server uses it. **Never write to it from this plan.** Do not run the migration or the backfill, not even the backfill's measuring mode: both need the owner's say-so at that moment (see Release Checklist). Read-only counts of curriculum tables are fine.
- Screenshot checks stub every `/api/**` call, so a click can never save a real result.
- The dev server is already on port 3107 (`npx next dev --webpack -p 3107`). Do not stop it or start a second. Do not touch the owner's Playwright window, or the picture run (`draw.js`, `server.js` on 3120).
- This Next.js differs from training data. Before writing UI, read `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`.
- Bands: 80 and up solid, 50 to 79 shaky, under 50 gap. It takes 3 questions to count as an attempt.
- Keep the existing API fields, because `/api/studylab/persona` reads them. Keep the `/studylab/gap-map` route. Tour anchors stay `gapmap-canvas` and `gapmap-legend`.
- Colours come from `ss-*` tokens. Opacity modifiers do not work on them (`bg-ss-chip/50` renders nothing), so set alpha inline. Tile backgrounds use `subjectStyle()` with the `ss-lesson` class, which handles dark mode.
- Kana is the real `components/studylab/kana/Kana.tsx`, using its existing poses. Nothing the page itself needs may depend on motion. Under `prefers-reduced-motion` there is no tilt animation or bob, and the state still shows.
- Phone tap targets at least 44 px. Tile names 13 to 14 px. No text under a tile except its name.
- Copy, plain and exactly as written in the steps below. No em dashes.

## Review Focus

1. Code deployed before the migration has run. Saving a quiz must not lose the student's score, and the Gap Map must still load, reading from `accuracy`. Pinned in Tasks 1 and 4.
2. A stale or foreign link such as `?chapter=999999`. It shows the subjects page, with no crash and no empty chapter. Pinned in Tasks 5 and 7.
3. A picture that fails to load, because the host is down or the file is missing. It shows the plain tile, never a broken image. Pinned in Task 6.
4. Size extremes: a 140-character chapter name, a subject with 120 sections, a chapter with 14 sections. Text clamps, the page never scrolls sideways, and the path still shows 3 plates in full. Pinned in Tasks 5, 6 and 7.
5. A `?focus=` name found in several chapters, such as "Introduction". It lands on the one with a gap, then the first in book order. Pinned in Task 5.

---

### Task 1: Score a section on its latest attempt

**Files:**
- Create: `migrations/add-mastery-latest.sql`
- Create: `lib/studylab/mastery-latest.ts`, `lib/studylab/mastery-latest.test.ts`
- Create: `lib/studylab/mastery-write.ts`, `lib/studylab/mastery-write.test.ts`
- Modify: `app/api/save-result/route.ts:55-86` (local `upsertMasteryBucket` moves out)
- Modify: `lib/studylab/stepLocks.ts:27-41`, `lib/studylab/stepLocks.test.ts`

**Interfaces:**
- Produces, from `mastery-latest.ts` (no server imports, the client uses it):
  - `SOLID_FROM = 80`, `GAP_BELOW = 50`, `MIN_COUNTED_QUESTIONS = 3`
  - `type SectionBand = 'none' | 'gap' | 'shaky' | 'solid' | 'gold'`
  - `interface LatestColumns { last_accuracy: number | null; lowest_accuracy: number | null; pending_correct: number; pending_total: number }`
  - `nextLatest(prev: Partial<LatestColumns> | null | undefined, previousAverage: number | null, addCorrect: number, addTotal: number): LatestColumns`
  - `readLatest(row: { attempts?: unknown; accuracy?: unknown; last_accuracy?: unknown; lowest_accuracy?: unknown }): { score: number | null; lowest: number | null }`
  - `bandFor(score: number | null, lowest: number | null): SectionBand`
- Produces, from `mastery-write.ts`:
  - `writeMasteryBucket(database: Database, userId: string, textbookId: number, topicId: number, subtopicId: number, addCorrect: number, addTotal: number, nowIso: string): Promise<void>`

- [ ] **Step 1: Write the failing tests for `mastery-latest.ts`**

```ts
const fresh = { last_accuracy: 30, lowest_accuracy: 30, pending_correct: 0, pending_total: 0 }
it('a retake counts on its own', () => expect(nextLatest(fresh, 30, 10, 10)).toEqual({ last_accuracy: 100, lowest_accuracy: 30, pending_correct: 0, pending_total: 0 }))
it('one or two questions do not count yet', () => expect(nextLatest(fresh, 30, 1, 1)).toEqual({ last_accuracy: 30, lowest_accuracy: 30, pending_correct: 1, pending_total: 1 }))
it('small amounts gather, then count together', () => expect(nextLatest({ pending_correct: 2, pending_total: 2 }, null, 0, 1)).toEqual({ last_accuracy: 66.67, lowest_accuracy: 66.67, pending_correct: 0, pending_total: 0 }))
it('a real attempt ignores and clears the pile', () => expect(nextLatest({ pending_correct: 0, pending_total: 2 }, null, 10, 10)).toMatchObject({ last_accuracy: 100, pending_total: 0 }))
it('an old row takes its average as the lowest so far', () => expect(nextLatest(null, 42, 9, 10)).toMatchObject({ last_accuracy: 90, lowest_accuracy: 42 }))
it('a later bad attempt lowers both', () => expect(nextLatest({ last_accuracy: 90, lowest_accuracy: 42 }, 60, 3, 10)).toMatchObject({ last_accuracy: 30, lowest_accuracy: 30 }))
it('reads pg strings', () => expect(readLatest({ attempts: 13, accuracy: '65.00', last_accuracy: '100.00', lowest_accuracy: '30.00' })).toEqual({ score: 100, lowest: 30 }))
it('falls back to the average', () => expect(readLatest({ attempts: 10, accuracy: '65.00' })).toEqual({ score: 65, lowest: 65 }))
it('no attempts means no score', () => expect(readLatest({ attempts: 0, accuracy: 0 })).toEqual({ score: null, lowest: null }))
it.each([[null, null, 'none'], [49, 49, 'gap'], [50, 50, 'shaky'], [79, 42, 'shaky'], [80, 80, 'solid'], [80, 50, 'solid'], [88, 42, 'gold'], [60, 42, 'shaky']])('band %s %s', (s, l, b) => expect(bandFor(s, l)).toBe(b))
it('stays in step with the admin line', () => expect(GAP_BELOW).toBe(GAP_THRESHOLD)) // import GAP_THRESHOLD from '@/lib/admin/gap-metrics' in the test only
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/studylab/mastery-latest.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/studylab/mastery-latest.ts`**

Round to 2 decimals. `nextLatest`: an `addTotal` of 3 or more is an attempt by itself and clears the pile; less is added to the pile, and the pile counts once it reaches 3. A counted score sets `lowest_accuracy = min(prev.lowest_accuracy ?? previousAverage ?? score, score)`. Parse with `masteryNumber` from `lib/studylab/mastery-numbers.ts`.

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run lib/studylab/mastery-latest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `writeMasteryBucket`**

Use a fake `Database` whose `query` is a `vi.fn()` routed by SQL text.
- `it('writes the average as today, then the latest columns')`: existing row `{attempts:10, correct:3, accuracy:'30.00'}` plus 10 of 10. The INSERT params have attempts 20, correct 13, accuracy 65. The following UPDATE params include last 100 and lowest 30.
- `it('keeps the score when the new columns are missing')`: the UPDATE rejects with `column "last_accuracy" does not exist`. The call still resolves, and the INSERT ran.
- `it('does nothing for zero questions')`: `addTotal` 0 makes no queries.

- [ ] **Step 6: Run them and see them fail**

Run: `npx vitest run lib/studylab/mastery-write.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement `writeMasteryBucket`, write the migration, and switch `save-result`**

Move today's logic across unchanged, except `SELECT *` for the existing row. After the upsert, a separate `UPDATE topic_mastery SET last_accuracy, lowest_accuracy, pending_correct, pending_total` runs in its own `try/catch` that `console.warn`s. Say in a comment why they are separate: a deploy ahead of the migration must not lose a student's score. `previousAverage` is the row's `accuracy` before this attempt, or null if there was no row.

`migrations/add-mastery-latest.sql` uses `ADD COLUMN IF NOT EXISTS`, and is additive only: `last_accuracy DECIMAL(5,2)`, `lowest_accuracy DECIMAL(5,2)`, `pending_correct REAL NOT NULL DEFAULT 0`, `pending_total REAL NOT NULL DEFAULT 0`. Do not run it.

- [ ] **Step 8: Move lesson locks to the latest score, test first**

Add to `stepLocks.test.ts`: a row `{ subtopic_id: 7, attempts: 13, accuracy: 65, last_accuracy: 30, lowest_accuracy: 30 }` locks with accuracy 30; a row `{ subtopic_id: 7, attempts: 13, accuracy: 38, last_accuracy: 90, lowest_accuracy: 38 }` does not lock. Existing rows have no `attempts`, and must keep passing. In `stepLocks.ts` use `SELECT *` and `readLatest({ attempts: 1, ...row }).score`.

Run: `npx vitest run lib/studylab/stepLocks.test.ts lib/studylab/stepLocks.keep.test.ts lib/studylab/mastery-write.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-11-04-gap-map-tile-rack-design.md docs/superpowers/plans/2026-11-04-gap-map-tile-rack.md migrations/add-mastery-latest.sql lib/studylab/mastery-latest.ts lib/studylab/mastery-latest.test.ts lib/studylab/mastery-write.ts lib/studylab/mastery-write.test.ts app/api/save-result/route.ts lib/studylab/stepLocks.ts lib/studylab/stepLocks.test.ts
git commit -m "feat(gap-map): judge a section on its latest attempt"
```

### Task 2: Backfill script, written and not run

**Files:**
- Modify: `lib/studylab/mastery-write.ts`, `app/api/save-result/route.ts:128-172` (the per-question scoring moves out)
- Create: `lib/studylab/mastery-replay.ts`, `lib/studylab/mastery-replay.test.ts`
- Create: `scripts/backfill-mastery-latest.ts`

**Interfaces:**
- Consumes: `nextLatest`, `LatestColumns` (Task 1).
- Produces:
  - `scoreQuestions(questions: unknown, answers: unknown, longformGrades: unknown): { sections: Map<number, { correct: number; total: number }>; chapters: Map<number, { correct: number; total: number }>; scoredAny: boolean }`, in `mastery-write.ts`
  - `replayResults(results: { questions_data: unknown; answers: unknown; longform_grades: unknown }[]): Map<string, LatestColumns>`, keyed `` `${topicId}:${subtopicId}` `` with the same zeros `save-result` writes (section `0:sid`, chapter `tid:0`). Input is oldest first.

- [ ] **Step 1: Write the failing tests**

- `it('replays attempts in order')`: section 7 scoring 3 of 10 and then 10 of 10 gives `'0:7'` last 100, lowest 30.
- `it('chapter questions key on the chapter')`: untagged by section, `topic_id` 4, gives `'4:0'`.
- `it('reads questions_data stored as a JSON string')`.
- `it('skips a result it cannot parse and carries on')`.
- `it('untagged questions place nothing')`: gives an empty map.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/studylab/mastery-replay.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Extract `scoreQuestions`, then implement `replayResults`**

`save-result` must behave identically after the extraction: it calls `scoreQuestions`, then `writeMasteryBucket` for each bucket, and keeps its legacy fallback. Each replayed bucket calls `nextLatest(prev, null, correct, total)`.

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run lib/studylab/mastery-replay.test.ts lib/studylab/mastery-write.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/backfill-mastery-latest.ts`**

Follow `scripts/backfill-gap-map-history.ts` for shape and doc comment. Read-only unless `--apply --yes-production`; `--log=<file>` records old values. It leaves out exam-prep books (curricula 3 and 4). It updates only rows where `last_accuracy IS NULL`, so a re-run cannot overwrite newer attempts, and never touches `attempts`, `correct` or `accuracy`. Rows with no replayable history stay NULL, and `readLatest` then gives them `accuracy`, as the spec requires. It prints totals only, no student data: results read, rows that would change, rows left on the average, and how many would show gold. **Do not run it.**

Run: `npx tsc --noEmit`
Expected: no new errors in these files.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/mastery-write.ts lib/studylab/mastery-replay.ts lib/studylab/mastery-replay.test.ts app/api/save-result/route.ts scripts/backfill-mastery-latest.ts
git commit -m "feat(gap-map): a backfill for latest scores, not yet run"
```

### Task 3: Picture map

**Files:**
- Create: `lib/studylab/gap-art.ts`, `lib/studylab/gap-art.test.ts`, `lib/studylab/gap-art-map.json`
- Create: `scripts/build-gap-art.ts`
- Modify: `lib/figure-src.ts:13`, `.gitignore`

**Interfaces:**
- Produces:
  - `keptPictures(topics: { id: string; topicIds: number[] }[], progress: { id: string; v: number }[], verdicts: { id: string; verdict: string; of?: number }[]): Record<string, string>`, mapping topic id to `"<id>.v<N>"`
  - `artPathFor(topicId: number, map?: Record<string, string>): string | null`, returning `/gap-art/<id>.v<N>.svg`. Server only: it imports the JSON, so only the API route may import it.

- [ ] **Step 1: Write the failing tests**

- `it('ships a drawing whose last verdict is keep on its newest version')`.
- `it('leaves out a drawing whose last verdict is redo')`.
- `it('leaves out a keep given to an older version')`: progress v1 and v2, verdict keep `of: 1`.
- `it('leaves out a drawing with no verdict')`.
- `it('maps every topic id of a shared drawing')`: `topicIds: [3, 9]` gives both keys.
- `it('artPathFor gives the path, or null')`.
- In `lib/figure-src.test.ts` (create it if absent): `figureSrc('/gap-art/x.v1.svg', 'https://cdn.example')` is `https://cdn.example/gap-art/x.v1.svg`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/studylab/gap-art.test.ts lib/figure-src.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement, add `'/gap-art/'` to `FIGURE_PREFIXES`, and add `public/gap-art/` to `.gitignore`**

The rule is the one at `.superpowers/gap-art/server.js:19-25`: the last verdict per id counts only if `of` equals the newest version.

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run lib/studylab/gap-art.test.ts lib/figure-src.test.ts`
Expected: PASS.

- [ ] **Step 5: Write and run `scripts/build-gap-art.ts`**

Run with `JITI_ALIAS='{"@":"C:/Users/Stephen/AI_assessment"}' npx jiti scripts/build-gap-art.ts [--dev]`. It reads `topics.json`, `progress.jsonl` and `verdicts.jsonl` from `.superpowers/gap-art/`, using `readLines` and `sanitise` from `shared.js` (`sanitise(text)` returns `{ ok, svg }`). A kept file that fails `sanitise` is left out and listed. It writes `lib/studylab/gap-art-map.json` with sorted keys, and the files to `.superpowers/gap-art/publish/gap-art/`. `--dev` also copies them to `public/gap-art/`. It prints kept count, total bytes, and how many of the 3,531 chapters have a picture.

Expected: runs clean, map under 300 KB, `git status` shows no files under `public/gap-art/`.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/gap-art.ts lib/studylab/gap-art.test.ts lib/studylab/gap-art-map.json lib/figure-src.ts lib/figure-src.test.ts .gitignore scripts/build-gap-art.ts
git commit -m "feat(gap-map): map kept pictures to chapters"
```

### Task 4: Gap Map API

**Files:**
- Modify: `app/api/studylab/gap-map/route.ts:11-46, 217-222, 321-340, 364-423`
- Modify: `lib/studylab/wall.ts:93-96, 237`, `lib/studylab/wall.test.ts`
- Create: `app/api/studylab/gap-map/route.test.ts`

**Interfaces:**
- Consumes: `readLatest` (Task 1), `artPathFor` (Task 3).
- Produces, added to the response with every existing field kept:
  - each subtopic: `score: number | null`, `lowest: number | null`
  - each topic: `score: number | null`, `lowest: number | null` (whole-chapter evidence only, null if none), `art: string | null`

- [ ] **Step 1: Write the failing route tests**

Mock `@/lib/db` with `db.query` routed by SQL text, as other route tests mock their dependencies.
- `it('orders chapters and sections by id, not name')`: the SQL contains `ORDER BY topic_id` and `ORDER BY subtopic_id`.
- `it('reads a section from its latest score')`: a mastery row with `accuracy: '65'`, `last_accuracy: '100'`, `lowest_accuracy: '30'` gives `score: 100, lowest: 30`, and `accuracy` and `status` as they are today.
- `it('still works before the migration')`: a row with no new columns gives `score: 65, lowest: 65`.
- `it('keeps a whole-chapter score even when the chapter has sections')`: a chapter row `{topic_id: 4, subtopic_id: 0, attempts: 10, accuracy: '40'}` on a chapter with untried sections gives topic `score: 40`.
- `it('gives an untried section null scores')`.
- `it('keeps the old fields')`: `summary.overall_mastery`, `topic_level_only` and `assessments` are all present.
- `it('gives a chapter its picture')`: with `@/lib/studylab/gap-art` mocked so `artPathFor` returns `/gap-art/x.v1.svg`, the topic's `art` is that path; returning null gives null.

- [ ] **Step 2: Add the failing `wall.test.ts` cases**

- `tilesForSubject` on a section with `accuracy: null` gives tile `accuracy` null, not 0.
- `unplacedQuizzes` leaves out a subject with chapter-level evidence and no section evidence.

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run app/api/studylab/gap-map/route.test.ts lib/studylab/wall.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

Sort by id in both queries. `SELECT *` from `topic_mastery`, with a comment saying why (Review Focus 1). For a section, use `readLatest(m)`; when there is only `subAgg` evidence, `score` and `lowest` are that average. For a chapter's `score`, in order: its mastery row, then `focusedTopicAgg`, then (no sections only) `topicAgg`. `art` is `artPathFor(t.id)`. Do not change the status, accuracy or summary logic. In `wall.ts`, `asNumberOrNull` returns null for null, undefined and `''`.

- [ ] **Step 5: Run them and see them pass**

Run: `npx vitest run app/api/studylab/gap-map/route.test.ts lib/studylab/wall.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/studylab/gap-map/route.ts app/api/studylab/gap-map/route.test.ts lib/studylab/wall.ts lib/studylab/wall.test.ts
git commit -m "feat(gap-map): book order, latest scores and pictures in the API"
```

### Task 5: The rack model

**Files:**
- Create: `lib/studylab/rack.ts`, `lib/studylab/rack.test.ts`, `lib/studylab/rack.fixture.json`

**Interfaces:**
- Consumes: `bandFor`, `SectionBand` (Task 1); the API fields (Task 4); `pickRequestedSubject` (`wall.ts`).
- Produces. No server imports:

```ts
export type ChapterState = 'gap' | 'gold' | 'shaky' | 'solid' | 'none'
export interface RackSection { key: string; subtopicId: number | null; name: string; band: SectionBand; score: number | null; lowest: number | null; lastAssessed: string | null }
export interface RackChapter { topicId: number; textbookId: number; name: string; bookName: string; curriculumSlug: string | null; art: string | null; hasSections: boolean; sections: RackSection[]; wholeChapter: { band: SectionBand; score: number; lowest: number } | null; state: ChapterState; gapCount: number; triedCount: number }
export interface RackTray { key: string; subject: string; chapters: RackChapter[]; squares: SectionBand[]; gapCount: number; triedCount: number; totalCount: number }
export interface RackPick { chapter: RackChapter; section: RackSection | null; score: number }
export type RackSnapshot = Record<string, { state: ChapterState; bands: Record<string, SectionBand> }>
export interface SheetLine { lead: string; rest: string; actions: ('teach' | 'retake' | 'quiz')[] }

export function cleanChapterName(raw: string): string
export function buildRack(textbooks: readonly unknown[], canonicalise?: (s: string) => string): RackTray[]
export function totalGaps(trays: readonly RackTray[]): number
export function nextFix(trays: readonly RackTray[]): RackPick | null
export function kanaHomeLine(trays: readonly RackTray[], pick: RackPick | null): string
export function visibleTrays(trays: readonly RackTray[], showAll: boolean, limit?: number): { shown: RackTray[]; hidden: number }
export function squareSize(count: number): number
export function findChapter(trays: readonly RackTray[], topicId: number): { tray: RackTray; chapter: RackChapter } | null
export function sectionToStart(chapter: RackChapter, wanted?: number | null): RackSection | null
export function chapterLabel(chapter: RackChapter): string
export function sectionLabel(section: RackSection): string
export function aboutLine(chapter: RackChapter): string | null
export function sheetLine(chapter: RackChapter, section: RackSection | null, cheer?: { name: string; next: RackSection | null } | null): SheetLine
export function resolveDeepLink(trays: readonly RackTray[], textbooks: readonly unknown[], want: { chapter?: string | null; section?: string | null; subject?: string | null; focus?: string | null; assessment?: string | null }): { topicId: number | null; subtopicId: number | null; trayKey: string | null }
export function snapshotRack(trays: readonly RackTray[]): RackSnapshot
export function changesSince(before: RackSnapshot | null, trays: readonly RackTray[]): { dropped: number[]; gold: string[] }
```

- [ ] **Step 1: Write the fixture**

`rack.fixture.json` is a full API response body (`{ "data": { textbooks, summary, unlinked_results } }`) for a sample student:
- **Mathematics book.** Algebra: Expanding brackets 73, Factorising 44, Quadratic equations 22, Simultaneous equations untried. Number: Types of number with score 86, lowest 38. Geometry untried.
- **Biology book.** Movement into and out of cells: Osmosis 34, Diffusion 61, Active transport untried. Enzymes: all 88.
- **Chemistry book.** The Periodic Table: sections untried, whole-chapter score 40. Atoms: no sections, score 74. A chapter named with 140 characters, untried.
- **A name-only "Geography" bucket** with `id: null`, no topics, and 3 assessments.

That gives 4 gaps across 3 trays, and Kana's pick is Quadratic equations.

- [ ] **Step 2: Write the failing tests**

```ts
const trays = buildRack(fixture.data.textbooks) // the fixture's books are named Mathematics, Biology and Chemistry
it('counts gaps', () => expect(totalGaps(trays)).toBe(4))
it('picks the lowest', () => expect(nextFix(trays)?.section?.name).toBe('Quadratic equations'))
it('says it', () => expect(kanaHomeLine(trays, nextFix(trays))).toBe("Tiles sticking up have gaps, and you have 4. Let's start with Quadratic equations, it's your lowest."))
it('celebrates', () => expect(kanaHomeLine([], null)).toBe('Every tile is back in its slot. Pick something new to try.'))
```

And:
- **State table:** one test per row of the spec's table, on fixture chapters: Algebra gap with `gapCount` 2; Number gold; Atoms shaky; Enzymes solid; Geometry none.
- **Whole-chapter rule:** The Periodic Table is `gap`, `gapCount` 1, `wholeChapter.score` 40. The same chapter with one section tried at 90 has `wholeChapter` null and is `solid`.
- **Atoms:** `hasSections` false, one synthesised section with `subtopicId` null.
- **Tray order:** gaps `A(1 at 20) B(3 at 40) C(2 at 30) D(0)` give A, B, C, D.
- **Tie in `nextFix`:** equal scores go to the newer `lastAssessed`, then book order.
- **Two books with one subject** merge into one tray, in order, when `canonicalise` gives them one name. The bucket with no chapters makes no tray.
- **Junk:** `buildRack([null, {}, { topics: 'x' }, { name: 'X', topics: [null] }])` does not throw.
- **`cleanChapterName`:** `'Chapter 1: Cells'` gives `'Cells'`, `'Unit 3 - Waves'` gives `'Waves'`, `'Unit conversions'` and `'Term limits'` are unchanged, `'Chapter 1'` is unchanged. Do not copy the old pattern from `export-topics.js`: it strips the start of "Unit conversions" because it has no word boundary after the numeral.
- **`visibleTrays`:** 8 trays and `showAll` false give 6 shown, 2 hidden; true gives 8 shown, 0 hidden.
- **`squareSize`:** 49 gives 13, 50 gives 9, 100 gives 9, 120 gives 6.
- **`chapterLabel`:** `'Algebra, 2 gaps: Factorising, Quadratic equations'`, `'Number, a gap you closed'`, `'Atoms, shaky'`, `'Enzymes, solid'`, `'Geometry, not tried yet'`.
- **`sectionLabel`:** `'Osmosis, 34%, a gap'`, `'Active transport, not tried yet'`, `'Types of number, gap closed, 38% to 86%'`.
- **`aboutLine`:** three names give `'Covers Osmosis, Diffusion and Active transport'`; more than three give the first three plus `' and more'`; none gives null. Names are used as stored.
- **`sectionToStart`:** the wanted id wins if it is in the chapter; otherwise the lowest gap, then the first untried, then the first. A whole-chapter gap with nothing tried gives null.
- **`sheetLine`:**
  - gap: lead `'Osmosis'`, rest `' is on 34%. Want me to teach it, then you retake it?'`, actions teach and retake
  - solid: lead `'Enzymes'`, rest `' is solid at 88%. Retake it any time to keep it that way.'`, actions retake and teach
  - untried: rest `' is new to us. A short quiz shows where you stand.'`, actions teach and quiz
  - gold: lead `'You closed this gap.'`, rest `' 38% to 86%, well done.'`, no actions
  - whole chapter: lead `'This chapter'`, rest `' is on 40%. Want me to teach it, then you retake it?'`
  - cheer with next: lead `'Nice, Osmosis is gold now.'`, rest `' Next up, Factorising.'`
  - cheer without next: lead `'Nice, that was the last gap here.'`, rest `' Go back and watch this tile drop into its slot.'`
- **`resolveDeepLink`:**
  - `chapter` found with `section` gives both ids
  - `chapter: '999999'` gives all null
  - `chapter: 'abc'` gives all null
  - `subject` with `focus: 'Factorising'` gives Algebra and that section
  - `assessment` beats `subject`, as `pickRequestedSubject` does
  - `focus` that matches nothing gives `trayKey` only
  - `focus: 'Introduction'` present in two chapters picks the one with a gap, else the first in book order
  - an exact name beats a partial match
- **`changesSince`:** null before gives empty lists; a chapter going gap to shaky is in `dropped`; gap to gap is not; a section going gap to gold is in `gold`.

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run lib/studylab/rack.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `lib/studylab/rack.ts`**

Build on `tilesForSubject`'s habit of loose input. Band each section with `bandFor(score, lowest)`. Tray `squares` hold one band per section, one per chapter with no sections. Tray order: the tray holding the lowest gap, then gap trays by `gapCount` descending, then trays with anything tried, then the rest, then name. `key` for a section is `s<subtopicId>`, or `t<topicId>` for a synthesised one.

- [ ] **Step 5: Run them and see them pass**

Run: `npx vitest run lib/studylab/rack.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/rack.ts lib/studylab/rack.test.ts lib/studylab/rack.fixture.json
git commit -m "feat(gap-map): the rack model"
```

### Task 6: Your-subjects page

**Files:**
- Create: `components/studylab/rack/rack.css`, `RackHome.tsx`, `ChapterTile.tsx`
- Create: `scripts/dev/shoot-gap-map.mjs`
- Modify: `components/studylab/GapMap.tsx`
- Modify: `lib/product-tour.ts:191-216`

**Interfaces:**
- Consumes: everything in Task 5; `unplacedQuizzes` (`wall.ts`), `canonicalSubject` (`lib/canonical-subject.ts`), `subjectStyle`, `Kana`, `figureSrc`.
- Produces:
  - `<RackHome trays={RackTray[]} unplaced={UnplacedSubject[]} unlinked={UnlinkedResults | null} droppedTopicIds={number[]} focusTrayKey={string | null} />`
  - `<ChapterArt chapter={RackChapter} subject={string} />` in `ChapterTile.tsx`, also used by Task 7: picture, or the plain tile on missing art or load error
  - `node scripts/dev/shoot-gap-map.mjs <name> <width> <height> "<query>" [--dark] [--no-art]`: stubs `**/api/**` with `{}` and `/api/studylab/gap-map*` with `rack.fixture.json`, sets `localStorage.user` (id, class, country, gender) and the `ss-tour-seen-*` keys, opens `http://localhost:3107/studylab/gap-map<query>`, saves `.superpowers/gap-art/shots/<name>.png`, and prints JSON: page overflow, broken images, and (when present) stops in full, sheet gap, Kana plate vs sheet. The stub fills each topic's `art` from `public/gap-art/` in turn, so tiles show real kept drawings (run `build-gap-art.ts --dev` first). Chromium is at `C:/Users/Stephen/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe`. `--no-art` aborts `**/gap-art/**`.

UI is checked by screenshot: this repo has no component tests (Vitest is node-only).

- [ ] **Step 1: Read the two Next docs in Global Constraints, the mockup's source, and `KnowledgeWall.tsx:100-150`** (the wording of the unplaced-quizzes row)

- [ ] **Step 2: Write `rack.css`, `ChapterTile.tsx`, `RackHome.tsx`**

Import `rack.css` from `GapMap.tsx`. Use `ss-rack-*` class names. Take sizes and shapes from the mockup's `.tray .t .slot .tile .pill .mk .perch .subj .squares .hi .say`, with `--ss-*` tokens instead of its variables, and a `--rack-gold` set for light and dark.
- A tile is a `next/link` to `?chapter=<topicId>`, with `aria-label={chapterLabel(chapter)}`, flex 128 to 172 px, 108 px on a phone, and its name clamped to 2 lines.
- `<img>` with `alt=""`, `src={figureSrc(chapter.art)}`, `loading="lazy"`, and `onError` switching to the plain tile (subject colour plus the logo's four squares).
- Kana: pose `point` at 104 px in the bubble (`celebrate` with no gaps), small on the picked tile. "Let's fix it" links to the pick's `?chapter=&section=`.
- No trays at all: Kana pose `wave` says `Take your first quiz and I'll show you where your gaps are.` with a link to `/practice`.
- A tile in `droppedTopicIds` starts lifted and transitions into its slot once, after mount.
- `focusTrayKey` scrolls that tray into view.
- Each tray starts with its subject card: name, the grid of `squares` sized by `squareSize`, `6 of 16 tried`, and `2 gaps` if any. Tiles scroll sideways and grow to fill short rows.
- `visibleTrays` limits to 6, and the rest sit behind a `Show all subjects` button.
- Unplaced quizzes are a quiet row at the bottom: `Geography, 3 quizzes, average 61%`. Keep `KnowledgeWall`'s wording for results with no quiz behind them.

- [ ] **Step 3: Rewire `GapMap.tsx`**

Keep the fetch, `startStudy`, `canTakeQuiz`, `takeQuiz` and the error banner. Replace the header, `SubjectPicker`, `OverallProgress` and the wall with a visually hidden `<h1>Gap Map</h1>` and `RackHome`. Drop the `warning` banner, since Kana's empty state says the same thing. `nodeFor` takes `(chapter, section)`, with `subject: chapter.bookName` (the existing comment explains why it must be the book's name). Show `data-tour="gapmap-canvas"` on the scrolling area, `data-tour="gapmap-legend"` on the first tray, and `<ProductTour id="gapmap" />` only when no chapter is open. In this task an open `?chapter=` may render a placeholder.

- [ ] **Step 4: Update the tour copy**

Anchors unchanged. Steps:
1. `'Your chapters as tiles'`: `'Every chapter of your subjects is a tile, in book order. Tiles sticking up have gaps, and Kana points you to the lowest one.'`
2. `'Every tile carries a mark, not just a colour'`: `'A tick means you are getting these right, a dash means shaky, a gold star means a gap you closed, and a faded picture means no quiz has covered it yet, which is not the same as being bad at it.'`
3. `'Tap a tile to fix it'`: `'Each tile opens a path of its sections. Kana can teach you one, then you retake it and watch the tile drop back into its slot. Find the gap, study it, prove it closed.'`

Run: `npx vitest run lib/product-tour.test.ts`
Expected: PASS.

- [ ] **Step 5: Check by eye and by measure**

Run the script at 1440x900, at 390x844, at 1440x900 with `--dark`, and at 1440x900 with `--no-art`. View each picture beside `.superpowers/brainstorm/43-1793726521/content/flat-home.png`.
Expected in every run: page overflow 0, broken images 0, gap tiles visibly lifted with a pill, names under tiles and nothing else, the 140-character name clamped, the Geography row showing "3 quizzes". `--no-art` shows plain tiles only.

- [ ] **Step 6: Commit**

```bash
git add components/studylab/rack/rack.css components/studylab/rack/RackHome.tsx components/studylab/rack/ChapterTile.tsx scripts/dev/shoot-gap-map.mjs components/studylab/GapMap.tsx lib/product-tour.ts
git commit -m "feat(gap-map): the tile rack replaces the wall"
```

### Task 7: Chapter page

**Files:**
- Create: `components/studylab/rack/ChapterPage.tsx`, `SectionPath.tsx`, `Plate.tsx`, `KanaSheet.tsx`
- Modify: `components/studylab/GapMap.tsx`, `components/studylab/rack/rack.css`

**Interfaces:**
- Consumes: Task 5 model; `ChapterArt` (Task 6).
- Produces:
  - `<ChapterPage chapter={RackChapter} subject={string} selected={RackSection | null} cheer={{ name: string; next: RackSection | null } | null} busy={boolean} onSelect={(s: RackSection) => void} onTeach={() => void} onQuiz={(count?: number) => void} lostMarks={ReactNode} tryIt={ReactNode} />`. Tasks 8 and 9 fill the two slots.
  - sessionStorage key `gapRackBefore`: a `RackSnapshot`, written just before leaving for a lesson or quiz, read and cleared once on load.

- [ ] **Step 1: Write the components**

Layout from the mockup's `.chap .col .mid .info .side-card .tryit .path .stop .plate .on-plate .lb .sheet`, sized as the spec's Layout section says: columns `minmax(300px,1fr) minmax(0,2fr) minmax(340px,1fr)`; the path scrolls inside the middle column with `container-type:size`, stops `28cqh` tall, plates `min(calc(28cqh * 1.14), 44cqw)` wide, soft top and bottom fades; sheet `flex:none`, centred, max 640 px. Fill the height of `GapMap`'s flex column rather than `100vh`. Under 1320 px, two columns with the practice card below. Under 700 px, one column with plates 132 px and the sheet fixed above `SideNav`'s bottom bar.

`Plate.tsx` is the mockup's `plate()` drawing, with the logo's squares lit by band. Plates are `<button aria-pressed aria-label={sectionLabel(s)}>`. Beside each plate: its name, then `73%, shaky`, `44%, a gap`, `88%, solid`, `✦ Gap closed, 38 → 86%` or `Not tried yet`. Kana stands on the selected plate.

The left column's chapter card holds `ChapterArt`, the name, `aboutLine`, then the subject, `3 of 4 tried` and `2 gaps`. If `wholeChapter` is set, it also shows that score. Kana's sheet draws `sheetLine`, with `Teach me this`, `Retake` and `Quiz me` for its actions.

On opening, scroll only if Kana's plate is not in full view. On a phone, scroll so it sits clear above the sheet.

- [ ] **Step 2: Wire it into `GapMap.tsx`**

Read `chapter` and `section` from `useSearchParams`, and show `ChapterPage` when `findChapter` finds it, or else the subjects page.
- Deep links: on load, if `subject`, `focus` or `assessment` is present, call `resolveDeepLink`. With a chapter, `router.replace('?chapter=&section=')`, so Back does not loop. With only a tray, pass `focusTrayKey`.
- Back link `Gap Map` is a `next/link` to `/studylab/gap-map`. Selecting a plate uses `router.replace`, so Back leaves the chapter in one step.
- `takeQuiz(d, count = 10)` gains a count. Before `startStudy` and `takeQuiz` navigate away, write `gapRackBefore`.
- On load, `changesSince` gives `dropped` for the home tiles and `gold` for Kana's cheer. Keep them in state, and clear each after its first use.

- [ ] **Step 3: Check by eye and by measure**

Run the script with `"?chapter=<Algebra id>"` at 1920x1080, 1440x900, 1280x720, 390x844, and 1440x900 `--dark`. View them beside `.superpowers/brainstorm/43-1793726521/content/flat-chapter-wide.png` and `flat-chapter.png`. Then run a throwaway headless script for the rest. It keeps every `/api/**` stubbed.

Expected:
- 3 stops in full at each desktop size, and sheet gap at least 0. On the phone, Kana's plate ends above the sheet's top.
- A fixture chapter given 14 sections still shows 3 in full and scrolls.
- `?chapter=999999` shows the subjects page.
- `?subject=Mathematics&focus=Factorising` lands on Algebra with Factorising selected, and Back does not return to the deep link.
- Tab reaches every plate, and Enter selects it.
- Clicking Retake sends `/api/generate-assessment` a body with `count: 10` and `subtopic_ids: [<id>]`. Clicking Teach me this sends `/api/studylab` a body with `origin: 'gap'` and that `subtopic_id`.
- With `gapRackBefore` seeded from the fixture and the fixture's Algebra sections raised to 90, the home tile has moved into its slot and Kana cheers on the chapter page.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/rack/ChapterPage.tsx components/studylab/rack/SectionPath.tsx components/studylab/rack/Plate.tsx components/studylab/rack/KanaSheet.tsx components/studylab/rack/rack.css components/studylab/GapMap.tsx
git commit -m "feat(gap-map): the chapter page, with its path of plates"
```

### Task 8: Where you lost marks

**Files:**
- Create: `lib/studylab/lost-marks.ts`, `lib/studylab/lost-marks.test.ts`
- Create: `app/api/studylab/gap-map/lost-marks/route.ts`, `route.test.ts`
- Create: `components/studylab/rack/LostMarks.tsx`
- Modify: `components/studylab/GapMap.tsx`

**Interfaces:**
- Produces:
  - `interface LostMark { question: string; said: string; right: string }`
  - `lostMarksFrom(results: { answers: unknown; questions_data: unknown }[], where: { subtopicIds: number[]; topicId: number }, limit?: number): LostMark[]`, with results newest first and `limit` default 2
  - `GET /api/studylab/gap-map/lost-marks?user_id=&topic_id=&subtopic_ids=1,2` returns `{ data: LostMark[] }`
  - `<LostMarks userId={string} chapter={RackChapter} />`

- [ ] **Step 1: Write the failing tests**

Fixture questions have the app's shape: `{ type: 'mcq', question, options, correct_answer, subtopic_id, topic_id }`.
- `it('returns a wrong answer in this chapter')`: `{ question, said: options[picked], right: options[correct_answer] }`.
- `it('leaves out a right answer')`, `it('leaves out an unanswered question')`, `it('leaves out another chapter')`.
- `it('matches by chapter when the question has no section')`.
- `it('reads answers.mcq and flat answers')`, `it('reads JSON strings')`, `it('skips a result it cannot parse')`.
- `it.each` leaving out questions that will not read as one line: has `image_url`, `figureGroup` or `passage`; not mcq; question over 140 characters; an option over 80 characters; contains `$` or a backslash.
- `it('does not repeat a question')`, `it('stops at the limit')`.
- Route: `it('refuses a bad user_id')` with 400; `it('refuses a bad topic_id')` with 400; `it('asks for this student only')`: the SQL has `user_id = $1` and `LIMIT 40`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/studylab/lost-marks.test.ts app/api/studylab/gap-map/lost-marks/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Answer lookup matches `save-result` (`answers.mcq ?? answers`, by index, number or string key). The route uses `UUID_RE` from the gap-map route, and selects `answers, questions_data FROM results WHERE user_id = $1 AND questions_data IS NOT NULL ORDER BY created_at DESC LIMIT 40`.

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run lib/studylab/lost-marks.test.ts app/api/studylab/gap-map/lost-marks/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Build `LostMarks.tsx`**

It asks only about the chapter's sections that are gap or shaky, or the whole chapter when `hasSections` is false or `wholeChapter` is set. Plain React text, no HTML injection. It renders nothing while loading, on error, or when the list is empty. Heading `Where you lost marks`; lines `✕ You said: …` and `✓ …`, with the icons carrying the meaning as well as the colour. Pass it in `ChapterPage`'s `lostMarks` slot.

Check with the script, stubbing the new route with two items and then with `{ data: [] }`.
Expected: the card shows, then is gone with no gap left behind.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/lost-marks.ts lib/studylab/lost-marks.test.ts app/api/studylab/gap-map/lost-marks/route.ts app/api/studylab/gap-map/lost-marks/route.test.ts components/studylab/rack/LostMarks.tsx components/studylab/GapMap.tsx
git commit -m "feat(gap-map): show the questions a student lost marks on"
```

### Task 9: Try it with me first

**Files:**
- Create: `lib/studylab/practice-card.ts`, `lib/studylab/practice-card.test.ts`
- Create: `components/studylab/rack/TryIt.tsx`
- Modify: `components/studylab/GapMap.tsx`

**Interfaces:**
- Consumes: `scenesFor` from `lib/studylab/engines`, `examplesOf` from `lib/studylab/engines/examples.ts`; `onQuiz(count)` (Task 7).
- Produces:
  - `pickPracticeCard(names: readonly string[]): { engineId: string; example: SceneExample } | null`
  - `<TryIt names={string[]} subject={string} onQuiz={(count: number) => void} busy={boolean} />`, loaded with `next/dynamic` and `ssr: false` so the 60 engines stay out of the page's first load.

- [ ] **Step 1: Write the failing tests**

These results come from running `scenesFor` on 2026-11-04:

```ts
it('finds the brackets card', () => expect(pickPracticeCard(['Expanding brackets'])?.engineId).toBe('area-grid'))
it('finds it through another section', () => expect(pickPracticeCard(['Factorising', 'Expanding brackets', 'Algebra'])?.engineId).toBe('area-grid'))
it('finds nothing rather than a guess', () => expect(pickPracticeCard(['Quadratic equations', 'Algebra'])).toBeNull())
it('never gives chemistry to algebra', () => expect(pickPracticeCard(['Equations'])?.engineId).not.toBe('equation-balancer'))
it('finds nothing for no match', () => expect(pickPracticeCard(['Kingdom of Buganda'])).toBeNull())
it('wants the example to fit', () => {
  const card = pickPracticeCard(['Plant nutrition'])
  expect(card === null || /plant|nutrition/i.test(card.example.prompt)).toBe(true)
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/studylab/practice-card.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `pickPracticeCard`**

For each name in order, for each engine `scenesFor(name)` returns, take the first example whose `prompt` shares a word with the name. Sharing means a word of 5 letters or more with the same first 5 letters (`expanding` and `expand`). Otherwise move on. Null if nothing fits.

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run lib/studylab/practice-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Build `TryIt.tsx` and pass it in `ChapterPage`'s `tryIt` slot**

Render the live card as `app/dev/scenes/page.tsx` does: `ReactFlowProvider`, `CanvasContext.Provider value={noop}`, `ActivityNode` with `data={{ spec }}`, spec `{ pattern: 'scene', prompt, payload: { engine, config }, success: { kind: 'scene' }, intent: { goal, isolates: 'position', apparatus: 'scene:<id>', why } }`, inside `subjectStyle(subject)`, importing the same two CSS files. Key it by engine and example. `names` is the selected section, then the chapter's other sections, then the chapter. Heading `Try it with me first`, with a small Kana.

With no card: heading `A quick one to warm up`, text `Five quick questions show me where you stand.`, button `Quiz me`, calling `onQuiz(5)`.

- [ ] **Step 6: Check the card at real width**

Take a screenshot of the Algebra chapter at 1920x1080 and at 1440x900 (right column 394 and 340 px), and play the card in the headless browser, logging requests.
Expected: nothing is clipped, it can be used, and no request goes to `/api/save-result`.

If it is clipped or hard to read at 340 px, do not shrink it. Show the prompt and a `Try it` button in the panel, opening the card in a 460-px-wide `<dialog>`. Report which way it went.

- [ ] **Step 7: Measure how often a card appears**

Use a temporary `lib/studylab/__measure.test.ts`, deleted afterwards and never committed: a read-only query of `topics` and `subtopics` (curriculum tables only, leaving out curricula 3 and 4), running `pickPracticeCard` per chapter with its section names and then its own. Report the percentage of the 3,531 chapters with a card, for the owner.

- [ ] **Step 8: Commit**

```bash
git add lib/studylab/practice-card.ts lib/studylab/practice-card.test.ts components/studylab/rack/TryIt.tsx components/studylab/GapMap.tsx
git commit -m "feat(gap-map): a real practice card on the chapter page"
```

### Task 10: Clear out the old wall and check the whole thing

**Files:**
- Delete: `components/studylab/KnowledgeWall.tsx`
- Modify: `lib/studylab/wall.ts`, `lib/studylab/wall.test.ts`, `components/studylab/GapMap.tsx`

**Interfaces:**
- `wall.ts` keeps `tilesForSubject`, `unplacedQuizzes`, `pickRequestedSubject`, `unlinkedSummary` and their types. `UnlinkedResults` moves there from `KnowledgeWall.tsx`.

- [ ] **Step 1: Remove what nothing uses**

Delete `KnowledgeWall.tsx`, then in `wall.ts` delete `buildWall`, `wallSummary`, `priorityTiles`, `groupByTopic`, `tileMatches`, `filterWall` and the types only they used, along with their tests. Delete the leftovers at the top of `GapMap.tsx`. Confirm nothing else imports them with a search.

- [ ] **Step 2: Run everything once**

Run: `npx vitest run`
Expected: all pass. If an unrelated test fails, report it with its output and do not fix it here.

Run: `npx tsc --noEmit`
Expected: no errors in files this plan touched.

- [ ] **Step 3: Final look**

Run the script for both pages at 1920x1080, 1440x900, 390x844, and dark at 1440x900.
Expected: matches the mockup. Go through "Why", "Goals" and "Would make this a failure" in the spec, and confirm each against the pictures. List anything that does not hold.

- [ ] **Step 4: Commit**

```bash
git add -u components/studylab/KnowledgeWall.tsx lib/studylab/wall.ts lib/studylab/wall.test.ts components/studylab/GapMap.tsx
git commit -m "chore(gap-map): remove the old wall"
```

---

## Release Checklist

Not part of the build. Each line needs the owner's go at that moment, and comes in this order:

1. Run `migrations/add-mastery-latest.sql` on the live database. Additive, and old code ignores the columns.
2. Run `scripts/backfill-mastery-latest.ts` in measuring mode, show the owner the totals, then `--apply --yes-production --log=<file>`.
3. Run `scripts/build-gap-art.ts` on the owner's latest verdicts, then upload `.superpowers/gap-art/publish/gap-art/` to the figure host under `gap-art/`, as `image/svg+xml` with a long cache time (file names carry their version). Commit the refreshed map.
4. Decide with the owner when enough pictures are kept to go live. Mostly plain tiles should not go in front of students.
5. Before pushing: check the Amplify size limit and boot-test a database route (see the amplify-size-limit memory). Then push with the owner's yes (see the push-account memory).
