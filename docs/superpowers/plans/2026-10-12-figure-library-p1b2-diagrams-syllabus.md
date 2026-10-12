# Figure Library P1b.2: Diagrams First, Judged Against the Syllabus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-run the real-image pilot so that it finds the images a teacher would use, for the same six topics:
- labelled, textbook-style diagrams first, then photos of what the syllabus covers;
- every image judged against the topic's syllabus points and the learners' world;
- questions that ask only what the syllabus teaches.

**Why:** The user's review of the P1b sheet on 2026-10-12:
- Some images are decorative rather than educational, and the user wants "diagrams like the first 2".
- Some cell images are at the wrong level.
- The landforms are "way out of league", and learners "will never have seen those things".
- Cold War is fine "as long as it's part of the curriculum and we're not asking things they wouldn't know".
- Lab safety and classification work.

The causes:
- The harvest searched bitmaps only, but Commons' labelled diagrams are mostly SVG drawings.
- The screener saw only the topic name, never its syllabus points.
- The writer was not bound to the syllabus.

**Architecture:** Five changes to P1b's pipeline, each tested. Then a round-two run on the same six topics, with Sonnet as the only writer (P1b's decision).
- Haiku makes search terms for each topic from its syllabus points: diagrams first, then photos of local or named examples.
- The harvest includes SVG diagrams, rendered to PNG by Wikimedia.
- The screen sees the syllabus points. It judges `in_syllabus` and `unfamiliar_example`, and records the image type.
- The writer and its check see the syllabus points, and ask only what they teach.
- The sheet shows round two: diagrams first, with an image-type badge.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, sections 5.3, 5.5 and 9 (including the P1b result).

## Global Constraints

- Everything in the P1b plan's Global Constraints still holds: licences, people, Wikimedia etiquette, local files, no production database, local commits, attribution lines.
- New job caps: `p1b2-terms` $0.50, `p1b2-screen` $3, `p1b2-write-sonnet` $3, `p1b2-blind` $1.50. P1 then stays within spec 8's $25: P1a $8.73, P1b $5.30, P1b.2 at most $8.
- Sonnet is the only writer (P1b decision, spec 5.3 fallback).

## Review Focus

1. **An SVG diagram with a small nominal size.** Expected: kept, since it is vector. Pinned in Task 2 (`test_reject_reason_keeps_a_vector_diagram`).
2. **A screening reply missing `in_syllabus`, `unfamiliar_example` or `image_type`.** Expected: refused. Pinned in Task 3.
3. **Round-one questions surviving into round two.** Expected: cleared before writing, while drawn figures' questions are untouched. Pinned in Task 4 (`clears real-image questions only`).
4. **A topic with no syllabus terms yet.** Expected: the harvest falls back to the concept map's terms. Pinned in Task 2 (`test_falls_back_to_the_concept_map_terms`).

---

### Task 1: Search terms from the syllabus

**Files:**
- Modify: `scripts/figure-library/schema.sql` (append `search_terms`)
- Create: `scripts/figure-library/terms.ts`, `scripts/figure-library/make-terms.ts`
- Test: `scripts/figure-library/terms.test.ts`

**Interfaces:**
- Produces:
  - Table `search_terms(topic_key, term, kind 'diagram'|'photo', model, at)`, primary key `(topic_key, term)`, where insertion order is the search order.
  - `TERMS_JOB = 'p1b2-terms'`, plus `topicsForTerms(db, keys)`, `termsPrompt(t)`, `parseTerms(raw) -> {diagrams, photos}` and `saveTerms(db, key, model, terms)`.
  - CLI: `npx jiti scripts/figure-library/make-terms.ts --keys=db:2,db:36 [--dry]`.

- [ ] **Step 1: Write the failing tests.** Create `scripts/figure-library/terms.test.ts`:

```ts
// scripts/figure-library/terms.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { parseTerms, saveTerms, termsPrompt, topicsForTerms } from './terms'

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1098', 'rwanda', 'Geography S1', 'geography', 'LS', 'Forms of relief')").run()
  for (const [k, n] of [['s1', 'Relief'], ['s2', 'Forms of relief']]) db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES (?, 'db:1098', ?)").run(k, n)
  return db
}

describe('search terms from the syllabus', () => {
  it('asks for diagrams and local photos, naming the syllabus points and where the learners are', () => {
    const [t] = topicsForTerms(store(), ['db:1098', 'db:none'])
    expect(t).toEqual({ key: 'db:1098', subject: 'geography', band: 'LS', source: 'rwanda', topic: 'Forms of relief', subtopics: ['Relief', 'Forms of relief'] })
    const p = termsPrompt(t)
    for (const part of ['Topic: Forms of relief.', 'Syllabus points: Relief; Forms of relief.', 'learners in Rwanda', 'labelled diagrams', 'East Africa']) expect(p).toContain(part)
  })

  it('keeps short distinct terms, and refuses a reply without enough diagrams', () => {
    expect(parseTerms({ diagrams: ['fold mountain diagram', 'Fold mountain diagram', 'rift valley diagram', 'plateau diagram', ''], photos: ['Virunga volcanoes', 'x'.repeat(80)] }))
      .toEqual({ diagrams: ['fold mountain diagram', 'rift valley diagram', 'plateau diagram'], photos: ['Virunga volcanoes'] })
    expect(() => parseTerms({ diagrams: ['a diagram'], photos: [] })).toThrow(/diagram/)
    expect(() => parseTerms(null)).toThrow()
  })

  it('stores the terms in search order, diagrams first, replacing earlier ones', () => {
    const db = store()
    saveTerms(db, 'db:1098', 'haiku', { diagrams: ['plateau diagram', 'rift valley diagram', 'fold mountain diagram'], photos: ['Virunga volcanoes'] })
    saveTerms(db, 'db:1098', 'haiku', { diagrams: ['plateau diagram', 'rift valley diagram', 'escarpment diagram'], photos: ['Lake Kivu', 'plateau diagram'] })
    expect(db.prepare('SELECT term, kind FROM search_terms ORDER BY rowid').all()).toEqual([
      { term: 'plateau diagram', kind: 'diagram' }, { term: 'rift valley diagram', kind: 'diagram' },
      { term: 'escarpment diagram', kind: 'diagram' }, { term: 'Lake Kivu', kind: 'photo' },
    ])
  })
})
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/terms.test.ts` → FAIL: `./terms` cannot be found.

- [ ] **Step 3: Append to `schema.sql`:**

```sql
-- Search terms made for a topic from its syllabus points (P1b.2): diagrams first, then
-- photos. Row order is the order the harvest searches them in.
CREATE TABLE IF NOT EXISTS search_terms (
  topic_key TEXT NOT NULL REFERENCES topics(key),
  term TEXT NOT NULL,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (topic_key, term)
);
```

- [ ] **Step 4: Write `scripts/figure-library/terms.ts`:**

```ts
// scripts/figure-library/terms.ts
import type { Store } from './store'
import { LEVELS } from './review'

export const TERMS_JOB = 'p1b2-terms'

/** Where a source's learners are: examples from their world teach better than distant ones. */
const WHERE: Record<string, string> = {
  rwanda: 'Rwanda',
  cambridge: 'Rwanda and East Africa, on the Cambridge curriculum',
  checkpoint: 'Rwanda and East Africa, on the Cambridge curriculum',
  nerdc: 'Nigeria',
  waec: 'West Africa',
  jamb: 'Nigeria',
}

export interface TermsItem { key: string; subject: string; band: string; source: string; topic: string; subtopics: string[] }
export interface Terms { diagrams: string[]; photos: string[] }

export function topicsForTerms(db: Store, keys: readonly string[]): TermsItem[] {
  const topic = db.prepare('SELECT key, subject, band, source, name FROM topics WHERE key = ?')
  const subs = db.prepare('SELECT name FROM subtopics WHERE topic_key = ? ORDER BY key')
  return keys.flatMap((key) => {
    const t = topic.get(key) as { key: string; subject: string; band: string; source: string; name: string } | undefined
    if (!t) return []
    return [{ key: t.key, subject: t.subject, band: t.band, source: t.source, topic: t.name, subtopics: (subs.all(key) as { name: string }[]).map((s) => s.name) }]
  })
}

export function termsPrompt(t: TermsItem): string {
  return [
    'Find teaching images on Wikimedia Commons for this syllabus topic.',
    `Subject: ${t.subject}. Level: ${LEVELS[t.band] ?? t.band}, for learners in ${WHERE[t.source] ?? 'Africa'}. Topic: ${t.topic}.`,
    ...(t.subtopics.length ? [`Syllabus points: ${t.subtopics.join('; ')}.`] : []),
    '',
    'Give search terms that find:',
    '- diagrams: 8 terms for labelled diagrams or textbook-style drawings of what these points teach (for example "plant cell labelled diagram").',
    '- photos: 6 terms for photographs of real examples the syllabus covers, that a learner here may meet or will be taught by name. For geography, prefer examples from Rwanda and East Africa; for history, the events, places and sources these points cover.',
    "Each term short (2 to 5 words), in English and specific. Never a person's name on its own.",
    '',
    'Reply with JSON only: {"diagrams": [string], "photos": [string]}',
  ].join('\n')
}

/** Short, distinct terms; a reply with fewer than three diagram terms is refused. */
export function parseTerms(raw: unknown): Terms {
  if (!raw || typeof raw !== 'object') throw new Error('The reply is not a JSON object')
  const clean = (list: unknown): string[] => {
    const out: string[] = []
    for (const t of Array.isArray(list) ? list : []) {
      const term = String(t ?? '').trim()
      if (term && term.length <= 60 && !out.some((o) => o.toLowerCase() === term.toLowerCase())) out.push(term)
    }
    return out.slice(0, 12)
  }
  const r = raw as { diagrams?: unknown; photos?: unknown }
  const terms = { diagrams: clean(r.diagrams), photos: clean(r.photos) }
  if (terms.diagrams.length < 3) throw new Error('The reply has fewer than three diagram terms')
  return terms
}

/** Replaces a topic's terms, diagrams first; a term in both lists is kept once, as a diagram. */
export function saveTerms(db: Store, key: string, model: string, terms: Terms): void {
  const at = new Date().toISOString()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM search_terms WHERE topic_key = ?').run(key)
    const put = db.prepare('INSERT OR IGNORE INTO search_terms (topic_key, term, kind, model, at) VALUES (?, ?, ?, ?, ?)')
    for (const term of terms.diagrams) put.run(key, term, 'diagram', model, at)
    for (const term of terms.photos) put.run(key, term, 'photo', model, at)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
```

- [ ] **Step 5: Write `scripts/figure-library/make-terms.ts`:**

```ts
// scripts/figure-library/make-terms.ts
// Run: npx jiti scripts/figure-library/make-terms.ts --keys=db:2,db:36 [--dry]
// Haiku makes each topic's Wikimedia search terms from its syllabus points (P1b.2).
import { openStore } from './store'
import { parseArgs } from './args'
import { assertBudget, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender } from './claude'
import { TERMS_JOB, parseTerms, saveTerms, termsPrompt, topicsForTerms } from './terms'

const JOB_CAP_USD = 0.5
const PER_TOPIC_USD = 0.004

async function main() {
  const args = parseArgs(process.argv.slice(2), { keys: 'string', dry: 'flag' })
  if (!args.keys) throw new Error('--keys=db:2,db:36 is needed')
  const db = openStore()
  const items = topicsForTerms(db, String(args.keys).split(',').map((s) => s.trim()).filter(Boolean))
  const estimate = items.length * PER_TOPIC_USD
  console.log(`${items.length} topics, estimate $${estimate.toFixed(3)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: TERMS_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  try {
    for (const t of items) {
      const terms = parseTerms(await askJson({ db, job: TERMS_JOB, jobCapUsd: JOB_CAP_USD, prompt: termsPrompt(t), maxTokens: 800, send, model: HAIKU }))
      saveTerms(db, t.key, HAIKU, terms)
      console.log(`${t.key} ${t.topic}\n  diagrams: ${terms.diagrams.join('; ')}\n  photos: ${terms.photos.join('; ')}`)
    }
  } finally {
    console.log(`${TERMS_JOB} spend $${totalSpend(db, TERMS_JOB).toFixed(3)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 6: Run them, the suite and tsc.** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → all pass.

- [ ] **Step 7: Commit.** `git commit -m "feat(figure-library): search terms made from each topic's syllabus points"`

---

### Task 2: Harvest diagrams too, and use the syllabus terms

**Files:**
- Modify: `scripts/figgen/real/commons.py`, `rules.py`, `harvest.py` and `choose.py`
- Test: `scripts/figgen/tests/test_real_rules.py`, `scripts/figgen/tests/test_real_harvest.py`

**Interfaces:**
- Produces:
  - `search_url` finds `filetype:bitmap|drawing`.
  - `reject_reason` keeps `image/svg+xml` whatever its nominal size, and catches translated `.svg` copies.
  - `harvest.topic_terms(db, key)` returns the syllabus terms (diagrams first), or else the concept map's terms. The figure spec gains `mime`.
  - `choose(db, per_topic, seed, diagrams_first=False)`. With `diagrams_first`, about two thirds of each topic's pick are diagrams (`image_type` from the screening detail). Its CLI gains `--diagrams-first` and `--out NAME`.

- [ ] **Step 1: Write the failing tests.** Add to `test_real_rules.py`:

```python
def test_reject_reason_keeps_a_vector_diagram():
    svg = candidate(mime="image/svg+xml", width=649, height=475, title="File:Plant cell structure-en.svg")
    assert reject_reason(svg) is None  # vector: any size renders sharp
    assert reject_reason(candidate(mime="image/svg+xml", title="File:Plant cell structure-zh.svg")) == "a translated copy"


def test_search_url_finds_diagrams_too():
    assert "filetype%3Abitmap%7Cdrawing" in search_url("plant cell diagram")
```

Add to `test_real_harvest.py`:

```python
from figgen.real.harvest import topic_terms


def test_searches_the_syllabus_terms_first(db, tmp_path):
    db.execute("INSERT INTO search_terms (topic_key, term, kind, model, at) VALUES "
               "('db:2', 'plant cell', 'diagram', 'm', 'now'), ('db:2', 'cell micrograph', 'photo', 'm', 'now')")
    db.commit()
    assert topic_terms(db, "db:2") == ["plant cell", "cell micrograph"]
    fetch = FakeFetch()
    fetch.searched = []
    original = fetch.json
    fetch.json = lambda url: (fetch.searched.append(url), original(url))[1]
    harvest_topic(db, tmp_path / "lib", fetch, "db:2", "photo.micrograph", want=10)
    assert "plant+cell" in fetch.searched[0]
    assert json.loads(db.execute("SELECT spec FROM figures WHERE id = 'wikimedia/5'").fetchone()[0])["mime"] == "image/jpeg"


def test_falls_back_to_the_concept_map_terms(db):
    assert topic_terms(db, "db:2") == ["cell micrograph", "plant cell"]


def test_choose_can_put_diagrams_first(db, tmp_path):
    harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'm', 1, 'a', '{\"image_type\": \"photo\"}', 'now'), ('wikimedia/5', 'm', 1, 'b', '{\"image_type\": \"diagram\"}', 'now')")
    db.commit()
    assert choose(db, per_topic=1, diagrams_first=True) == ["wikimedia/5"]
    assert sorted(choose(db, per_topic=2, diagrams_first=True)) == ["wikimedia/1", "wikimedia/5"]
```

- [ ] **Step 2: Run them.** `python -m pytest scripts/figgen/tests/test_real_rules.py scripts/figgen/tests/test_real_harvest.py -q` → FAIL. The vector diagram is "too small", the URL has no `drawing`, and `topic_terms` cannot be imported.

- [ ] **Step 3: Implement.**
  - `commons.py`: `"gsrsearch": f"{term} filetype:bitmap|drawing"`.
  - `rules.py`:
    - add `"image/svg+xml"` to `TYPES`;
    - change the size check to `if c["mime"] != "image/svg+xml" and min(c["width"], c["height"]) < MIN_SHORT_SIDE:` with the comment `# a vector diagram renders sharp at any size`;
    - add `svg` to `TRANSLATED`'s extension list: `(?:jpe?g|png|tiff?|webp|gif|svg)`.
  - `harvest.py`: add

```python
def topic_terms(db, key: str) -> list[str]:
    """The topic's search terms: those made from its syllabus points (diagrams first), else the concept map's."""
    rows = db.execute("SELECT term FROM search_terms WHERE topic_key = ? "
                      "ORDER BY CASE kind WHEN 'diagram' THEN 0 ELSE 1 END, rowid", (key,)).fetchall()
    if rows:
        return [r[0] for r in rows]
    return json.loads(db.execute("SELECT terms FROM topic_map WHERE topic_key = ?", (key,)).fetchone()[0])
```

  In `harvest_topic`, call `terms = topic_terms(db, key)`, and add `"mime": c["mime"]` to the stored spec.
  - `choose.py`: replace `choose` with

```python
def choose(db, per_topic: int = 10, seed: int = 2026, diagrams_first: bool = False) -> list[str]:
    """Up to `per_topic` kept images from each topic, drawn at random but the same every time. With
    `diagrams_first`, about two thirds are diagrams, the rest photos and other kinds."""
    rng = random.Random(seed)
    out: list[str] = []
    keys = [r[0] for r in db.execute("SELECT DISTINCT ft.topic_key FROM figure_topics ft JOIN screenings s "
                                     "ON s.figure_id = ft.figure_id WHERE s.keep = 1 ORDER BY ft.topic_key")]
    for key in keys:
        rows = db.execute("SELECT ft.figure_id, s.detail FROM figure_topics ft JOIN screenings s ON s.figure_id = ft.figure_id "
                          "WHERE s.keep = 1 AND ft.topic_key = ? ORDER BY ft.figure_id", (key,)).fetchall()
        ids = [r[0] for r in rows]
        if not diagrams_first:
            out += sorted(rng.sample(ids, min(per_topic, len(ids))))
            continue
        diagrams = [r[0] for r in rows if (json.loads(r[1] or "{}") or {}).get("image_type") == "diagram"]
        others = [i for i in ids if i not in set(diagrams)]
        picked = rng.sample(diagrams, min(len(diagrams), max(1, round(per_topic * 2 / 3))))
        picked += rng.sample(others, min(per_topic - len(picked), len(others)))
        rest = [d for d in diagrams if d not in picked]
        picked += rng.sample(rest, min(per_topic - len(picked), len(rest)))
        out += sorted(picked)
    return out
```

  Add `import json` to `choose.py`. In its `main`, add `ap.add_argument("--diagrams-first", action="store_true")` and `ap.add_argument("--out", default="p1b-compare.txt")`, call `choose(db, a.per_topic, diagrams_first=a.diagrams_first)`, and write to `library_dir() / "reports" / a.out`.

- [ ] **Step 4: Run them, then the Python suite.** `python -m pytest scripts/figgen -q` → all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(figgen): harvest diagrams too, searching each topic's syllabus terms first"`

---

### Task 3: A screen that knows the syllabus and the learners

**Files:**
- Modify: `scripts/figure-library/screen.ts`, `scripts/figure-library/screen-real.ts`
- Test: `scripts/figure-library/screen.test.ts`

**Interfaces:**
- Produces:
  - `ScreenItem` gains `subtopics: string[]` and `Screening` gains `type: 'diagram'|'photo'|'micrograph'|'map'|'other'`.
  - The judgements change:
    - `on_topic` → `in_syllabus` ("not in the syllabus");
    - new `unfamiliar_example` ("an unfamiliar example").
  - The reply carries `image_type`.
  - `SCREEN_JOB = 'p1b2-screen'`, cap $3.

- [ ] **Step 1: Update the tests first.** In `screen.test.ts`:
  - **The item fixture:** gains `subtopics: ['Animal and plant cells', 'Specialised cells']`.
  - **`good`:** becomes `{ shows: 'Onion epidermis cells with nuclei', image_type: 'micrograph', topic_fit: 'a light micrograph of plant cells', educational: true, in_syllabus: true, clear: true, beyond_level: false, unfamiliar_example: false, person_is_subject: false, mostly_text: false, foreign_labels: false, decorative: false }`.
  - **The expected `parseScreen(good)`:** becomes `{ keep: true, shows: 'Onion epidermis cells with nuclei', reasons: [], type: 'micrograph' }`. The `person_is_subject` case expects `type: 'micrograph'` too.
  - **The prompt test's list:** gains `'Syllabus points: Animal and plant cells; Specialised cells.'`, `'in_syllabus'`, `'unfamiliar_example'` and `'image_type'`.
  - **The "no values" regex:** uses the new judgement names.
  - **The store fixture:** gains `INSERT INTO subtopics (key, topic_key, name) VALUES ('s1', 'db:2', 'Animal and plant cells')`, and the `toScreen` expectation gains `subtopics: ['Animal and plant cells']`.
  - **New cases:**

```ts
  it('rejects what the syllabus does not cover and distant examples, and records the image type', () => {
    expect(parseScreen({ ...good, in_syllabus: false }).reasons).toEqual(['not in the syllabus'])
    expect(parseScreen({ ...good, unfamiliar_example: true }).reasons).toEqual(['an unfamiliar example'])
    expect(parseScreen({ ...good, image_type: 'Diagram' }).type).toBe('diagram')
    expect(parseScreen({ ...good, image_type: 'painting' }).type).toBe('other')
    expect(() => parseScreen({ ...good, in_syllabus: undefined })).toThrow(/in_syllabus/)
  })
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/screen.test.ts` → FAIL.

- [ ] **Step 3: Implement in `screen.ts`.**
  - `SCREEN_JOB = 'p1b2-screen'`.
  - `ScreenItem` gains `subtopics: string[]`; `Screening` gains `type: string`.
  - `CHECKS` becomes:

```ts
const CHECKS: [string, boolean, string][] = [
  ['educational', true, 'not educational'],
  ['in_syllabus', true, 'not in the syllabus'],
  ['clear', true, 'not clear enough'],
  ['beyond_level', false, 'beyond this level'],
  ['unfamiliar_example', false, 'an unfamiliar example'],
  ['person_is_subject', false, 'a person is the subject'],
  ['mostly_text', false, 'mostly text'],
  ['foreign_labels', false, 'labels not in English'],
  ['decorative', false, 'decorative'],
]
const TYPES = ['diagram', 'photo', 'micrograph', 'map']
```

  `screenPrompt` becomes:

```ts
export function screenPrompt(item: ScreenItem): string {
  // No example values: Nova Lite copied a filled-in example reply word for word. The screener
  // describes and weighs the image against the syllabus points before each judgement.
  return [
    `This image may be used in a ${item.subject} quiz for learners at ${LEVELS[item.band] ?? item.band} in Rwanda and East Africa, on the topic "${item.topic}".`,
    ...(item.subtopics.length ? [`Syllabus points: ${item.subtopics.join('; ')}.`] : []),
    `Its file is called "${item.title}".${item.description ? ` Its description says: "${item.description.slice(0, 300)}"` : ''}`,
    '',
    'Look at the image, then answer in this order:',
    '1. shows: one sentence on what the image actually shows.',
    '2. image_type: diagram (a drawing or labelled diagram), photo, micrograph, map, or other.',
    '3. topic_fit: one sentence on which syllabus point it teaches, if any, and whether a teacher of these learners would use it.',
    '4. Each judgement below, true or false, from what you see:',
    '- educational: it clearly shows something these learners study, well enough to ask a question about. A plain picture of an object with nothing to learn from it beyond its name is not educational.',
    '- in_syllabus: it shows something these syllabus points teach, at this level.',
    '- clear: sharp and well lit, with the thing that matters large enough to see.',
    '- beyond_level: a figure from a research paper (often several labelled panels), specialist or medical detail, or anything beyond what these learners study.',
    '- unfamiliar_example: a particular place, landscape or case from far away that the syllabus does not name, where a diagram or an example from Rwanda or East Africa would teach the same thing.',
    '- person_is_subject: one or more identifiable people are the main subject (a portrait, a selfie, people posing or working as the focus).',
    '- mostly_text: it is mainly words or a table.',
    '- foreign_labels: it has labels or captions in a language other than English.',
    '- decorative: a logo, an icon, clip art, an advert or a decoration.',
    '',
    'Reply with JSON only: an object with these keys in this order, each judgement a JSON true or false of your own:',
    '{"shows": string, "image_type": string, "topic_fit": string, "educational": boolean, "in_syllabus": boolean, "clear": boolean, "beyond_level": boolean, "unfamiliar_example": boolean, "person_is_subject": boolean, "mostly_text": boolean, "foreign_labels": boolean, "decorative": boolean}',
  ].join('\n')
}
```

  In `parseScreen`, after `shows`:

```ts
  const said = String(r.image_type ?? '').trim().toLowerCase()
  const type = TYPES.includes(said) ? said : 'other'
  return { keep: reasons.length === 0, shows: shows.slice(0, 300), reasons, type }
```

  `toScreen` also returns each figure's syllabus points:

```ts
export function toScreen(db: Store, o: { limit?: number } = {}): ScreenItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.spec, f.preview, MIN(ft.topic_key) AS topic_key FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id
    WHERE f.origin <> 'drawn' AND f.status = 'candidate' AND f.id NOT IN (SELECT figure_id FROM screenings)
    GROUP BY f.id ORDER BY f.id LIMIT ?`).all(o.limit ?? 1_000_000) as { id: string; subject: string; band: string; spec: string; preview: string; topic_key: string }[]
  const topicName = db.prepare('SELECT name FROM topics WHERE key = ?')
  const subs = db.prepare('SELECT name FROM subtopics WHERE topic_key = ? ORDER BY key')
  return rows.map((r) => {
    const spec = readJson<{ title?: string; description?: string }>(r.spec, {})
    return {
      figureId: r.id, subject: r.subject, band: r.band, topic: (topicName.get(r.topic_key) as { name: string }).name,
      subtopics: (subs.all(r.topic_key) as { name: string }[]).map((s) => s.name),
      title: spec.title ?? '', description: spec.description ?? '', preview: r.preview,
    }
  })
}
```

  In `screen-real.ts`, set `JOB_CAP_USD = 3`, with the comment `/** Round two (P1b.2) screens about 1,000 images with Haiku. */`.

- [ ] **Step 4: Run them, the suite and tsc.** → all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(figure-library): the screen judges the syllabus points, distant examples and the image type"`

---

### Task 4: Questions bound to the syllabus

**Files:**
- Modify: `scripts/figure-library/write.ts`, `scripts/figure-library/write-real.ts`
- Test: `scripts/figure-library/write.test.ts`

**Interfaces:**
- Produces:
  - `WriteItem` gains `subtopics: string[]`, and `toWrite` fills it in.
  - `writePrompt` and `checkPrompt` name the syllabus points and keep to them.
  - `clearWritten(db) -> number` deletes non-drawn figures' rows in `figure_questions` and `question_checks`.
  - `write-real.ts` jobs are `p1b2-write-<tag>`, and it gains `--reset`.

- [ ] **Step 1: Update the tests first.** In `write.test.ts`:
  - **The item fixture:** gains `subtopics: ['Animal and plant cells', 'Specialised cells']`.
  - **The prompt test's list:** gains `'Syllabus points: Animal and plant cells; Specialised cells.'` and `'Ask only what these syllabus points teach'`.
  - **The store fixture:** gains a subtopic row `('s1', 'db:2', 'Animal and plant cells')`.
  - **New cases:**

```ts
  it('tells the checker the syllabus points', () => {
    const { questions } = parseWritten({ questions: [mcq] }, 'wikimedia/1')
    expect(checkPrompt(item, questions)).toContain('it tests something these syllabus points teach')
  })

  it('reads each image with its syllabus points', () => {
    expect(toWrite(store(), { writer: HAIKU })[0].subtopics).toEqual(['Animal and plant cells'])
  })

  it('clears real-image questions only, before a new round', () => {
    const db = store()
    const { questions } = parseWritten({ questions: [mcq] }, 'wikimedia/1')
    saveWritten(db, { figureId: 'wikimedia/1', writer: HAIKU, band: 'UP', questions, checks: [{ keep: true, reason: '' }] })
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, status, created_at) VALUES ('drawn/x/1', 'drawn', 'x', 'graph.bar', 'biology', 'UP', 'a.svg', 'stored', 'now')`).run()
    db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, answer, model) VALUES ('drawn/x/1#1', 'drawn/x/1', 1, 'UP', 'short', 's', '1', 'code')`).run()
    expect(clearWritten(db)).toBe(1)
    expect(db.prepare('SELECT id FROM figure_questions').all()).toEqual([{ id: 'drawn/x/1#1' }])
    expect(db.prepare('SELECT COUNT(*) AS n FROM question_checks').get()).toEqual({ n: 0 })
  })
```

- [ ] **Step 2: Run them.** → FAIL.

- [ ] **Step 3: Implement in `write.ts`.**
  - **`WriteItem`:** gains `subtopics: string[]`.
  - **`writePrompt`:** after the `Topic:` line, insert `...(item.subtopics.length ? [\`Syllabus points: ${item.subtopics.join('; ')}.\`] : []),`. As the first rule, add `'- Ask only what these syllabus points teach at this level. Never a fact a learner here would not have been taught.',`.
  - **`checkPrompt`:** after its first line, insert the same syllabus line. Change the third rule to `'- it tests something these syllabus points teach, at this level; it is not trivia, and its answer is not a word printed on the image.',`.
  - **`toWrite`:** returns subtopics. Select `MIN(ft.topic_key) AS topic_key` with the topic name, then map with a `subs` statement, as in `toScreen`.
  - **New function:**

```ts
/** Clears real-image questions and their checks before a new round; drawn figures' questions stay. Returns how many questions went. */
export function clearWritten(db: Store): number {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM figure_questions q JOIN figures f ON f.id = q.figure_id WHERE f.origin <> 'drawn'").get() as { n: number }).n
  db.exec('BEGIN')
  try {
    db.prepare("DELETE FROM figure_questions WHERE figure_id IN (SELECT id FROM figures WHERE origin <> 'drawn')").run()
    db.prepare("DELETE FROM question_checks WHERE figure_id IN (SELECT id FROM figures WHERE origin <> 'drawn')").run()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return Number(n)
}
```

  In `write-real.ts`:
  - set `const job = \`p1b2-write-${tag}\``;
  - add `reset: 'flag'` to the arguments;
  - after `openStore`, add `if (args.reset && !args.dry) console.log(\`${clearWritten(db)} earlier real-image questions cleared\`)`;
  - import `clearWritten`.

- [ ] **Step 4: Run them, the suite and tsc.** → all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(figure-library): questions on real images keep to the syllabus points"`

---

### Task 5: Review job by name, and the round-two sheet

**Files:**
- Modify: `scripts/figure-library/review-real.ts`, `scripts/figgen/real/real_sheet.py`
- Test: `scripts/figgen/tests/test_real_sheet.py`

**Interfaces:**
- Produces:
  - `review-real.ts --job=<name>`, defaulting to `p1b-blind-<tag>`.
  - `build_real_sheet(db, lib, per_topic=12, jobs=None)`. `jobs` maps writer to review job and defaults to round one's two jobs. Only those writers are shown.
  - Each card shows an image-type badge, and diagrams come first in each topic.
  - CLI `--round 2` shows Sonnet with job `p1b2-blind`.

- [ ] **Step 1: Write the failing test.** Add to `test_real_sheet.py`:

```python
def test_round_two_shows_only_its_writer_and_the_image_type(tmp_path):
    db, lib = setup(tmp_path)
    db.execute("UPDATE screenings SET detail = '{\"image_type\": \"diagram\"}' WHERE figure_id = 'wikimedia/1'")
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1b2-blind', 'wikimedia/1', 'm', 0, ?, 'now')",
               (json.dumps({"figureClear": True, "educational": True, "questions": [{"keyCorrect": False, "answerable": True, "singleAnswer": True}]}),))
    db.commit()
    page = build_real_sheet(db, lib, jobs={SONNET: "p1b2-blind"})
    assert '<span class="type">diagram</span>' in page
    assert "Haiku" not in page.split("<main>")[1].split("</table>")[1]  # no Haiku questions on the cards
    assert "blind review failed" in page and "0/1" in page
```

- [ ] **Step 2: Run it.** → FAIL: there is no `jobs` parameter.

- [ ] **Step 3: Implement.**
  - **`review-real.ts`:** add `job: 'string'` to `parseArgs`, and use `const job = args.job ? String(args.job) : \`p1b-blind-${tag}\``.
  - **`real_sheet.py`:**
    - `build_real_sheet(db, lib, per_topic=12, jobs=None)`, with `jobs = jobs or {HAIKU: "p1b-blind-haiku", SONNET: "p1b-blind-sonnet"}`.
    - Pass `jobs` into `card` and `verdict_html` instead of the module `JOBS`. The comparison table's rows and the cards' writers loop over `jobs`.
    - The funnel's "questions written" uses the first writer in `jobs`.
    - In `card`, read `json.loads(f["detail"] or "{}").get("image_type", "")`. When it is set, add `<span class="type">{escape(type)}</span>` before the credit. Add `detail` to the passed-images query: `SELECT f.*, s.shows, s.detail ...`.
    - Order the passed images with diagrams first: `ORDER BY (json_extract(s.detail, '$.image_type') = 'diagram') DESC, EXISTS (...) DESC, f.id`.
    - Add CSS `.type{align-self:flex-start;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);border:1px solid var(--rule);border-radius:3px;padding:0 6px}`.
    - In `main`, add `--round` (int, default 1): `jobs = {SONNET: "p1b2-blind"} if a.round == 2 else None`, and default the output name to `p1b{'2' if a.round == 2 else ''}-samples.html`.
    - The lede states round two's process when `jobs` has only Sonnet: "Haiku made search terms from each topic's syllabus points, diagrams first; Haiku screened every image against those points and the learners' world; Sonnet wrote questions bound to the points and Sonnet answered them blind."
- [ ] **Step 4: Run them, the suites and tsc.** → all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(figure-library): review job by name; round-two sheet with image types, diagrams first"`

---

### Task 6: Round two

- [ ] **Step 1:** `npx jiti scripts/figure-library/make-terms.ts --keys=db:2,db:36,db:1098,db:162,db:948,db:579`. Read the terms printed for each topic.
- [ ] **Step 2:** `python -u scripts/figgen/real/harvest.py --per-topic 160`. That is about 60 new per topic, from the syllabus terms (diagrams first). Then look at several new diagrams.
- [ ] **Step 3:** Run `npx jiti scripts/figure-library/screen-real.ts --redo` (dry first). Every real image is re-screened against its syllabus points. Look at kept and rejected images per topic, especially landforms and cells.
- [ ] **Step 4:** Run `python scripts/figgen/real/choose.py --per-topic 15 --diagrams-first --out p1b2-write.txt`, then `npx jiti scripts/figure-library/write-real.ts --writer=sonnet --reset --ids=<library>/reports/p1b2-write.txt`.
- [ ] **Step 5:** Run `npx jiti scripts/figure-library/review-real.ts --writer=sonnet --job=p1b2-blind --ids=<library>/reports/p1b2-write.txt`.
- [ ] **Step 6:** Build the sheet with `python scripts/figgen/real/real_sheet.py --round 2 --per-topic 15 --out <scratchpad>/p1b2-samples.html`. Read its text, look at images, and publish it as a new artifact.
- [ ] **Step 7:** Record the P1b.2 result in the spec. Commit with `git commit -m "docs: P1b.2 result"`.
