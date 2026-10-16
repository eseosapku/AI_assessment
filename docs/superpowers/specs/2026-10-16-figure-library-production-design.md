# Figure library in production quizzes, with no repeated figure-and-question

Date: 2026-10-16. Builds on `2026-10-10-figure-library-design.md` sections 5.4 and 5.6 (P2b).

## 1. Goal

Production quizzes draw figures from the figure library, with images served from CloudFront, and a
student is never shown the same figure with the same question twice.

The user's words: "if I go [to] the same image it would come with the same question, so we need a
workaround". This must be in place before the next push.

**Success means:**
- A quiz on any topic the library reaches can take library figures in production.
- For a signed-in student, no (figure, question) pair they were shown in their recent quizzes comes
  back, in any quiz type. Retakes keep replaying their own paper, by design.
- A seen figure may come back only with a question the student has not had on it. If it has none, it
  is not used.
- Nothing existing changes in the database: the migration only adds tables.

## 2. What is there now

- **The library** has 323,535 approved figures, 318,330 of them linked to 1,655 production topics
  (`db:<topic id>`), with 980,146 questions (1–6 per figure, mostly 3–4) and 1.86 million topic links.
  - Images: every drawn asset and every approved real image is in
    `s3://studysquare-figures-…/figure-library/assets/…`, served at
    `https://dtj4jtk2hgh9l.cloudfront.net/figure-library/assets/…`.
  - Rows: only in the local SQLite store. `lib/figure-library/local-source.ts` reads it on this machine
    only.
- **The JSON banks** (textbook, rwanda, library, books, checkpoint) hold at most one question of each
  kind per figure, so on an MCQ quiz a figure has exactly one question. This is the direct cause of the
  repeats.
- **History.** `seenFromRows` and `orderForStudent` (`lib/student-figure-history.ts`) put unseen
  figures first but let 2 repeats through. The route reads history only for textbook quizzes, and only
  the student's last 30 quizzes on the same textbook.

## 3. Design

### 3.1 Postgres tables (one additive migration)

`migrations/add-figure-library.sql`, using `CREATE TABLE IF NOT EXISTS` and nothing else:

- **`figure_library`**
  - `id text primary key` (the staging id, e.g. `drawn/bar_chart/241`)
  - `origin text`, `family text`, `kind text`, `subject text`, `band text`
  - `asset text`: the path under the asset base, e.g. `assets/drawn/bar_chart/241.svg`
  - `preview text`, `width int`, `height int`
  - `credit text` (real images), `shows text`, `book text`, `topic text`
  - `published_at timestamptz default now()`
- **`figure_library_topics`**: `(figure_id text, topic_id int)`, primary key `(topic_id, figure_id)`.
  This key serves the quiz lookup by topic.
- **`figure_library_questions`**
  - `id text primary key`, `figure_id text`, `n int`, `kind text`
  - `stem text`, `options jsonb`, `answer text`, `accepted jsonb`
  - `explanation text`, `tolerance real`
  - index on `figure_id`

Estimated size: about 0.7–1 GB with indexes. Before applying, the user confirms the RDS instance has
the free storage; it shows in the RDS console, and this IAM key cannot read it.

### 3.2 Publish script

`scripts/figure-library/publish.ts`:

- **What it copies.** Approved figures that reach at least one `db:` topic, their topic links (`db:`
  only, as integer topic ids), and their questions. It reads the staging store read-only.
- **How it writes.**
  - Batches of 2,000, each in a transaction, with `INSERT … ON CONFLICT DO NOTHING`. A re-run adds only
    what is new, so it can resume after a dropped connection.
  - It never updates or deletes, and it touches only the three new tables.
- **Modes.**
  - `--dry-run` (the default) prints the row counts and an estimated size, and writes nothing.
  - `--apply --yes-production` writes. Both flags are required, and it prints the database host's
    provider (never the URL) before starting.
- **Same filter as the app.** Short answers that only a sentence can give are dropped, exactly as
  `local-source.ts` drops them, so the published questions match what a local quiz would ask.

### 3.3 A Postgres source for the quiz route

`lib/figure-library/pg-source.ts`:

- **`libraryFiguresPg(db, { topicIds, excludeIds, limit = 300 })`** returns the same shape as
  `libraryFigures`: `{ figures: LibraryFigure[], questions: Map<id, VettedQuestion[]> }`.
  - It takes one random sample of up to `limit` approved figures linked to the quiz's topics, leaving
    out the figure ids the student has seen.
  - A second query fetches the questions for those ids.
  - Each figure's `localPath` is `${FIGURE_ASSET_BASE}/${asset}`, a full CloudFront URL, so
    `figureSrc` leaves it alone.
- **Switching it on.** `libraryEnabled()` becomes source-aware:
  - `FIGURE_LIBRARY_SOURCE=postgres` together with `FIGURE_ASSET_BASE` uses Postgres;
  - the existing `FIGURE_LIBRARY_DIR` together with `FIGURE_ASSET_BASE` keeps the local store for
    development;
  - neither means off, as now.
- **Failure costs nothing.** A failed or slow lookup (2 s timeout) is logged and the quiz is built
  from the banks, as today.

### 3.4 The no-repeat rule

- **History for every signed-in quiz.**
  - The route reads the student's last 50 quizzes of any type and any book: each question's
    `image_url` and text.
  - It now runs whenever there is a `userId`, not only for textbook quizzes.
  - One query, and a failure costs nothing.
- **Pairs, not wordings.**
  - `SeenFigures` gains `pairs: Set<string>`, built from `image|questionKey(text)`.
  - "Fresh" now means the pair has not been seen. A drawn family asks "What is the median?" of a
    thousand different figures, so a wording seen on one figure is not a repeat on another.
- **Library.**
  - Seen figures are excluded in the SQL sample.
  - In `pickLibraryFigures`, a figure is taken only with a question whose pair is unseen (and whose
    wording is not already on the paper, as now).
- **Banks.** `orderForStudent`'s default `maxRepeats` becomes 0. A bank figure whose allowed questions
  have all been seen with it is not used, and the quiz takes a library figure or a text question in its
  place.
- **Not covered.** Retakes replay their own paper, as now. Students who are not signed in have no
  history; random sampling over about 1,000 variants per family makes a repeat unlikely.

### 3.5 Settings and rollout

1. Apply the migration (additive).
2. Run the publish dry run, then the real publish with the user's go-ahead.
3. The user sets three variables in Amplify:
   - `NEXT_PUBLIC_FIGURE_BASE_URL=https://dtj4jtk2hgh9l.cloudfront.net`
   - `FIGURE_LIBRARY_SOURCE=postgres`
   - `FIGURE_ASSET_BASE=https://dtj4jtk2hgh9l.cloudfront.net/figure-library`
4. Before pushing:
   - build locally and check the Amplify size estimate (no data files are added to the bundle);
   - boot-test a database route.
5. Push. Verify on studysquare.org:
   - a CloudFront image loads;
   - a quiz with a test account the user controls shows library figures;
   - a second quiz on the same topic repeats no pair.
6. Then remove `public/textbook-images` from the repository (a separate commit, after checking that
   images load from CloudFront).

## 4. Testing

- **`student-figure-history.test.ts`:**
  - pairs are built from rows;
  - a seen pair is not fresh, but the same wording on another figure is;
  - `maxRepeats` 0 drops figures with only seen pairs.
- **`pick.test.ts`:**
  - no pick ever returns a seen pair;
  - a seen figure is taken only with a new question;
  - a figure whose questions are all seen is skipped.
- **`pg-source.test.ts`**, with a fake query client:
  - the SQL excludes the seen ids and limits the sample;
  - rows map to `LibraryFigure` with CloudFront URLs;
  - question rows map through `toVetted` with the open-phrase filter;
  - a thrown error or timeout yields an empty result.
- **`publish.test.ts`:**
  - staging rows map to insert rows;
  - only `db:` links are kept;
  - dry-run writes nothing (fake client);
  - batches are sized.
- **Route.** The history query now runs for non-textbook quizzes. It is covered by extracting it into
  `lib/student-figure-history.ts` (`readSeenFigures(db, userId)`) with a fake client test.

## 5. Out of scope

- Moving the JSON banks into Postgres.
- An admin view of library coverage.
- Rewriting git history to shrink clones. That is a separate decision with the other developer.
