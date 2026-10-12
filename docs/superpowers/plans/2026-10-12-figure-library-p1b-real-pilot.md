# Figure Library P1b: Real-Image Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harvest about 600 real educational images for six pilot topics from Wikimedia Commons and filter them by licence, size, people and near-copies. Screen each with Nova Lite, then write and check questions on the survivors with Haiku. Run the same 60 images through Sonnet and blind-review both writers' questions. Decide Haiku versus Sonnet by spec 5.5's rule, and give the user a sample sheet of the real images.

**Architecture:** Python (`scripts/figgen/real/`) does the network and image work with Pillow: search, the rule filter, download, perceptual hash, WebP storage. It saves candidates to the staging store with their licence and credit. TypeScript (`scripts/figure-library/`) does every model call through the existing ledger and caps:
- screening with Nova Lite on a 512 px copy;
- writing, plus a separate strict check, by Haiku or Sonnet on the full image;
- the blind review from P1a, generalised to real images and to one writer's questions at a time.

A Python sheet shows the results.

**Tech Stack:** Python 3.12, Pillow 10.2 (WebP), urllib, sqlite3; Node `node:sqlite`, vitest, jiti, `@aws-sdk/client-bedrock-runtime`. Models:
- Nova Lite `eu.amazon.nova-lite-v1:0`, $0.078 / $0.312 per M.
- Haiku 4.5 `eu.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Sonnet 5.5 `eu.anthropic.claude-sonnet-5-5`.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. Real images are in section 5.3; the pilot comparison in 5.5; P1 in section 9.

## Global Constraints

- Model spend never passes $600 in total. Job caps for this plan:

  | Job | Cap |
  |---|---|
  | `p1b-screen` | $1 |
  | `p1b-write-haiku` | $6 |
  | `p1b-write-sonnet` | $3 |
  | `p1b-blind-haiku` | $2 |
  | `p1b-blind-sonnet` | $2 |

  P1a spent $8.73, so P1 stays within spec 8's $25.
- Licences:
  - Public domain, CC0, CC BY or CC BY-SA, any version. Never NC or ND (spec 3.5).
  - Every stored image keeps its author, licence, licence link and file page, plus a credit line.
  - Wikimedia's `extmetadata` is read from the file's own page, which satisfies "re-checked on the file's source page".
- Out of scope (spec section 4): photos where an identifiable person is the subject; logos and decoration; AI-generated images. No OpenStax.
- Wikimedia etiquette:
  - User-Agent `StudySquareFigureLibrary/0.1 (https://www.studysquare.org)`.
  - One request at a time, at least 250 ms apart.
  - Back off on 429 and 5xx.
- Library files stay outside the repository (`FIGURE_LIBRARY_DIR`). Real images go under `assets/wikimedia/<pageid>.webp`, with a `-512.jpg` copy beside each.
- Pipeline runs never write to the production database. Never print secrets.
- Commits stay local on `aws_deploy`. Leave out `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, and the `data/audit/paper-style.json` deletion. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- tsc is strict, target ES2017. vitest runs in node.

## Review Focus

1. **A file whose licence, author or size cannot be confirmed.** Expected: it is turned away before download and never stored. Pinned in Task 2 (`test_reject_reason_*`).
2. **A translated or resized copy of an image already held.** Expected: the near-copy is not stored. Pinned in Task 3 (`test_a_near_copy_is_not_stored`) and Task 2 (`test_dhash_*`).
3. **A screening or check reply that leaves out a judgement.** Expected: it is refused, never read as a keep. Pinned in Task 5 (`refuses a screening that leaves out a judgement`) and Task 6 (`refuses a check that skips a question`).
4. **Two writers' questions on the same image.** Expected: each is reviewed alone, and one writer's failure never rejects the image for the other. Pinned in Task 7 (`reviews one writer's questions at a time, without rejecting the image`).
5. **A harvest or writing run stopped and started again.** Expected: nothing is downloaded, paid for or stored twice. Pinned in Task 3 (`test_a_finished_topic_fetches_nothing_again`, `test_a_second_run_downloads_nothing_already_held`; a turned-away near-copy is fetched again, since nothing records it) and Task 6 (`does not write twice for the same writer`).

## Pilot topics

One topic for each kind of real image, across six subjects:

| Topic | What | Kind |
|---|---|---|
| db:2 | Cambridge IGCSE Biology, Cells | photo.micrograph |
| db:36 | Rwanda S1–S3 Biology, Classification of Kingdom Animalia | photo.specimen |
| db:1098 | Rwanda S1–S3 Geography, Forms of relief | photo.landscape |
| db:162 | Cambridge IGCSE History, The Cold War 1945–75 | source.historical |
| db:948 | Rwanda S1–S3 Chemistry, Laboratory safety and apparatus | photo.apparatus |
| db:579 | Cambridge Primary Science, The life cycle of flowering plants | photo.specimen |

## File Structure

| File | Responsibility |
|---|---|
| `scripts/figure-library/schema.sql` | Gains `screenings` and `question_checks` (Task 1) |
| `scripts/figgen/real/__init__.py` | Package marker |
| `scripts/figgen/real/rules.py` | Licence, size, people, logo and translated-copy checks before download (Task 2) |
| `scripts/figgen/real/hashing.py` | 64-bit difference hash and distance (Task 2) |
| `scripts/figgen/real/commons.py` | Wikimedia search URL, response parsing, polite fetcher (Task 2) |
| `scripts/figgen/store.py` | Gains `save_real` (Task 3) |
| `scripts/figgen/real/harvest.py` | Harvests pilot topics into the store and asset folder (Task 3) |
| `scripts/figgen/real/choose.py` | Chooses the 60-image comparison set (Task 3) |
| `scripts/figure-library/claude.ts` | Gains Nova request and reply shapes (Task 4) |
| `scripts/figure-library/spend.ts` | Gains the Nova Lite price (Task 4) |
| `scripts/figure-library/screen.ts`, `screen-real.ts` | Nova Lite screening (Task 5) |
| `scripts/figure-library/write.ts`, `write-real.ts` | Writing and checking questions on real images (Task 6) |
| `scripts/figure-library/review.ts`, `review-real.ts` | Blind review by writer, clean rates, the comparison (Task 7) |
| `scripts/figgen/real/real_sheet.py` | The real-image sample sheet (Task 8) |

---

### Task 1: Tables for screenings and question checks

**Files:**
- Modify: `scripts/figure-library/schema.sql` (append)
- Test: `scripts/figure-library/store.test.ts`

**Interfaces:**
- Produces:
  - `screenings(figure_id PK → figures, model, keep, shows, detail, at)`.
  - `question_checks(question_id PK, figure_id → figures, writer, keep, reason, question, at)`.
  - Only kept questions go into `figure_questions`. Every written question, and an image that got none (`#<writer>#0`), is recorded in `question_checks`.

- [ ] **Step 1: Write the failing test.** In `store.test.ts`, inside `describe('the staging store', ...)`:

```ts
  it('has tables for real-image screenings and question checks', () => {
    const db = openStore(':memory:')
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['screenings', 'question_checks']))
    db.close()
  })
```

- [ ] **Step 2: Run it.** `npx vitest run scripts/figure-library/store.test.ts` → FAIL: the two tables are missing.

- [ ] **Step 3: Append to `schema.sql`:**

```sql
-- What the screener saw in a real image and whether it kept it (spec 5.3 step 3).
CREATE TABLE IF NOT EXISTS screenings (
  figure_id TEXT PRIMARY KEY REFERENCES figures(id),
  model TEXT NOT NULL,
  keep INTEGER NOT NULL,
  shows TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL,
  at TEXT NOT NULL
);
-- Every question a model wrote and its checker's verdict (spec 5.3 step 6). Only kept
-- questions go into figure_questions; an image that got none has a row ending "#0".
CREATE TABLE IF NOT EXISTS question_checks (
  question_id TEXT PRIMARY KEY,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  writer TEXT NOT NULL,
  keep INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  at TEXT NOT NULL
);
```

- [ ] **Step 4: Run it again.** `npx vitest run scripts/figure-library/store.test.ts` → PASS, 9 tests. Also run `python -m pytest scripts/figgen/tests/test_store.py -q` → PASS, since Python creates the same file.

- [ ] **Step 5: Commit.** `git add scripts/figure-library/schema.sql scripts/figure-library/store.test.ts && git commit -m "feat(figure-library): tables for screenings and question checks"`

---

### Task 2: Rules, hashing and the Wikimedia client

**Files:**
- Create: `scripts/figgen/real/__init__.py`, `rules.py`, `hashing.py`, `commons.py`
- Test: `scripts/figgen/tests/test_real_rules.py`, with a shared drawing helper in `scripts/figgen/tests/pictures.py`

**Interfaces:**
- Produces:
  - `rules.licence_ok(name) -> bool` and `rules.reject_reason(candidate) -> str | None`.
  - `hashing.dhash(img) -> int`, `hashing.distance(a, b) -> int`, and `MIN_DISTANCE = 6`.
  - `commons.search_url(term, limit=25) -> str`, `commons.parse_search(data, term) -> list[dict]`, and `commons.Fetcher(gap=0.25)` with `.json(url)` and `.bytes(url)`.
  - A candidate dict has these keys: `pageid, title, term, width, height, mime, thumb, page, licence, licence_url, author, description, restrictions, categories`.

- [ ] **Step 1: Write the failing tests.** Create `scripts/figgen/tests/pictures.py`, a helper the image tests share (pytest puts the tests folder on the path):

```python
"""Pictures for the image tests: random ellipses, different for each seed, the same every time."""
import random

from PIL import Image, ImageDraw


def picture(seed: int, size=(640, 480)) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    for _ in range(25):
        x, y = rng.randrange(size[0]), rng.randrange(size[1])
        d.ellipse((x, y, x + rng.randrange(20, 160), y + rng.randrange(20, 160)), fill=tuple(rng.randrange(256) for _ in range(3)))
    return img
```

Then create `scripts/figgen/tests/test_real_rules.py`:

```python
import io

from PIL import Image
from pictures import picture

from figgen.real.commons import parse_search, search_url
from figgen.real.hashing import MIN_DISTANCE, dhash, distance
from figgen.real.rules import licence_ok, reject_reason


def candidate(**over):
    c = {"pageid": 1, "title": "File:Onion cells.jpg", "term": "onion cells", "width": 2000, "height": 1500,
         "mime": "image/jpeg", "thumb": "https://upload.wikimedia.org/x.jpg", "page": "https://commons.wikimedia.org/wiki/File:x",
         "licence": "CC BY-SA 4.0", "licence_url": "https://creativecommons.org/licenses/by-sa/4.0", "author": "A. Botanist",
         "description": "Onion epidermis", "restrictions": "", "categories": ["Onion cells", "Light microscopy micrographs"]}
    c.update(over)
    return c


def test_licences_on_the_whitelist():
    for name in ("CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0 de", "CC0", "Public domain", "PD-US", "cc-by-sa-3.0"):
        assert licence_ok(name), name
    for name in ("CC BY-NC 4.0", "CC BY-ND 2.0", "GFDL", "Attribution", "", "Fair use"):
        assert not licence_ok(name), name


def test_reject_reason_keeps_a_good_file():
    assert reject_reason(candidate()) is None


def test_reject_reason_turns_away_what_cannot_be_used():
    assert reject_reason(candidate(licence="CC BY-NC 2.0")).startswith("licence")
    assert reject_reason(candidate(width=800, height=500)).startswith("too small")
    assert reject_reason(candidate(author="")) == "no author to credit"
    assert reject_reason(candidate(author="", licence="Public domain")) is None
    assert reject_reason(candidate(categories=["Portraits of scientists"])).startswith("category")
    assert reject_reason(candidate(categories=["Logos of universities"])).startswith("category")
    assert reject_reason(candidate(categories=["Specimens in museums"])) is None  # "men" inside a word is not people
    assert reject_reason(candidate(title="File:Plant cell structure-zh.jpg")) == "a translated copy"
    assert reject_reason(candidate(title="File:Onion cells x400 red.jpg")) is None
    assert reject_reason(candidate(title="File:Plant cell-en.jpg")) is None
    assert reject_reason(candidate(mime="image/gif")).startswith("file type")
    assert reject_reason(candidate(restrictions="trademarked")).startswith("restricted")


def test_dhash_matches_a_resized_copy_and_parts_different_images():
    a = picture(1)
    assert distance(dhash(a), dhash(a.resize((320, 240)))) < MIN_DISTANCE
    assert distance(dhash(a), dhash(picture(2))) >= MIN_DISTANCE


def test_dhash_matches_a_recompressed_copy():
    a = picture(3)
    buf = io.BytesIO()
    a.save(buf, "JPEG", quality=60)
    assert distance(dhash(a), dhash(Image.open(io.BytesIO(buf.getvalue())))) < MIN_DISTANCE


def test_search_url_asks_for_licence_size_and_categories():
    url = search_url("animal cell micrograph", 20)
    for part in ("generator=search", "filetype%3Abitmap", "gsrlimit=20", "extmetadata", "iiurlwidth=1280", "categories"):
        assert part in url


def test_parse_search_reads_licence_author_and_size():
    data = {"query": {"pages": [{
        "pageid": 42, "title": "File:Hydra micrograph.jpg",
        "imageinfo": [{"width": 2576, "height": 1932, "mime": "image/jpeg", "thumburl": "https://upload.wikimedia.org/t/1280px-h.jpg",
                       "url": "https://upload.wikimedia.org/h.jpg", "descriptionurl": "https://commons.wikimedia.org/wiki/File:Hydra_micrograph.jpg",
                       "extmetadata": {"LicenseShortName": {"value": "CC BY 4.0"}, "LicenseUrl": {"value": "https://creativecommons.org/licenses/by/4.0"},
                                       "Artist": {"value": '<a href="//commons.wikimedia.org/wiki/User:K">K&amp;ulawik</a>'},
                                       "ImageDescription": {"value": "Section of <i>Hydra</i>"}, "Restrictions": {"value": ""}}}],
        "categories": [{"title": "Category:Cells"}, {"title": "Category:Light microscopy micrographs"}]}]}}
    (c,) = parse_search(data, "cells")
    assert (c["pageid"], c["width"], c["height"], c["licence"]) == (42, 2576, 1932, "CC BY 4.0")
    assert c["author"] == "K&ulawik" and c["description"] == "Section of Hydra"
    assert c["thumb"].endswith("1280px-h.jpg") and c["page"].endswith("File:Hydra_micrograph.jpg")
    assert c["categories"] == ["Cells", "Light microscopy micrographs"] and c["term"] == "cells"


def test_parse_search_survives_an_empty_reply():
    assert parse_search({}, "x") == []
```

- [ ] **Step 2: Run them.** `python -m pytest scripts/figgen/tests/test_real_rules.py -q` → FAIL: `No module named 'figgen.real'`.

- [ ] **Step 3: Write the package.**

`scripts/figgen/real/__init__.py`:

```python
"""Real images for the figure library: harvest, filter and store (spec 5.3)."""
```

`scripts/figgen/real/rules.py`:

```python
"""Checks on a Wikimedia file before anything is downloaded or paid for (spec 5.3, step 2)."""
from __future__ import annotations

import re

# Public domain, CC0, CC BY and CC BY-SA in any version; never NC or ND (spec 3.5).
LICENCE = re.compile(r"^(?:cc0|cc-zero|public domain|pd(?:\b|-)|cc[ -]by(?:-sa)?[ -]\d)", re.I)
BANNED = re.compile(r"(?:\b|-)(?:nc|nd)\b|non-?commercial|no ?deriv", re.I)
FREE_WITHOUT_AUTHOR = re.compile(r"^(?:cc0|cc-zero|public domain|pd(?:\b|-))", re.I)
# The subject is a person, or the file is a logo or decoration (spec section 4).
PEOPLE = re.compile(r"portrait|selfie|\bpeople\b|\bmen\b|\bwomen\b|\bpersons?\b|\blogos?\b|\bicons?\b|clip ?art|"
                    r"\bemblems?\b|coats? of arms|\bsignatures?\b", re.I)
# A translated copy of a diagram, such as "...-zh.jpg", has labels that are not in English.
LANGS = ("zh|fr|es|de|ru|ar|ja|ko|it|pt|nl|pl|uk|fa|tr|he|cs|sv|fi|hu|vi|id|ca|el|ro|bg|sr|hr|th|hi|bn|ta|da|nb|"
         "sk|sl|lt|lv|et|eu|gl|ms|sw|rw")
TRANSLATED = re.compile(rf"[-_(](?:{LANGS})(?:-[a-z]{{2,4}})?\)?\.(?:jpe?g|png|tiff?|webp|gif)$", re.I)
MIN_SHORT_SIDE = 600  # spec 5.3: at least 600 px on the short side
TYPES = ("image/jpeg", "image/png", "image/webp", "image/tiff")


def licence_ok(name: str) -> bool:
    name = name.strip()
    return bool(name) and bool(LICENCE.search(name)) and not BANNED.search(name)


def reject_reason(c: dict) -> str | None:
    """Why a candidate is turned away before download, or None to keep it."""
    if not licence_ok(c["licence"]):
        return f"licence {c['licence'] or 'missing'}"
    if c["restrictions"]:
        return f"restricted: {c['restrictions']}"
    if not c["author"] and not FREE_WITHOUT_AUTHOR.search(c["licence"]):
        return "no author to credit"
    if min(c["width"], c["height"]) < MIN_SHORT_SIDE:
        return f"too small ({c['width']}x{c['height']})"
    if c["mime"] not in TYPES:
        return f"file type {c['mime']}"
    hits = [cat for cat in c["categories"] if PEOPLE.search(cat)]
    if hits:
        return f"category {hits[0]}"
    if TRANSLATED.search(c["title"]):
        return "a translated copy"
    return None
```

`scripts/figgen/real/hashing.py`:

```python
"""Perceptual hashes, to keep near-copies out (spec 5.3: a distance of 6 or more from anything held)."""
from __future__ import annotations

from PIL import Image

MIN_DISTANCE = 6


def dhash(img: Image.Image) -> int:
    """64-bit difference hash: does each pixel of a 9x8 grey copy get brighter towards its right?"""
    grey = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(grey.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | int(px[row * 9 + col] < px[row * 9 + col + 1])
    return bits


def distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")
```

`scripts/figgen/real/commons.py`:

```python
"""Wikimedia Commons: search for files and read their licence, author and size (spec 5.3, step 1)."""
from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "StudySquareFigureLibrary/0.1 (https://www.studysquare.org)"
FIELDS = "LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|AttributionRequired|Restrictions|UsageTerms"


def search_url(term: str, limit: int = 25) -> str:
    params = {
        "action": "query", "format": "json", "formatversion": "2", "generator": "search",
        "gsrsearch": f"{term} filetype:bitmap", "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo|categories", "cllimit": "max", "clshow": "!hidden",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1280", "iiextmetadatafilter": FIELDS,
    }
    return API + "?" + urllib.parse.urlencode(params)


def plain(text) -> str:
    """One of Wikimedia's HTML fields as plain text."""
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", str(text or ""))).split())


def parse_search(data: dict, term: str) -> list[dict]:
    out = []
    for page in (data.get("query") or {}).get("pages", []):
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}

        def value(key: str) -> str:
            return plain((meta.get(key) or {}).get("value", ""))

        out.append({
            "pageid": page["pageid"], "title": page["title"], "term": term,
            "width": int(info.get("width") or 0), "height": int(info.get("height") or 0), "mime": info.get("mime", ""),
            "thumb": info.get("thumburl") or info.get("url", ""), "page": info.get("descriptionurl", ""),
            "licence": value("LicenseShortName"), "licence_url": value("LicenseUrl"), "author": value("Artist")[:160],
            "description": value("ImageDescription")[:500], "restrictions": value("Restrictions"),
            "categories": [c["title"].removeprefix("Category:") for c in page.get("categories", [])],
        })
    return out


class Fetcher:
    """One request at a time, at least `gap` seconds apart, backing off when Wikimedia is busy."""

    def __init__(self, gap: float = 0.25):
        self.gap, self.last = gap, 0.0

    def _get(self, url: str) -> bytes:
        for attempt in range(4):
            wait = self.last + self.gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=60) as res:
                    return res.read()
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 * 2 ** attempt)
                    continue
                raise
            finally:
                self.last = time.monotonic()
        raise RuntimeError(f"Gave up on {url}")

    def json(self, url: str) -> dict:
        return json.loads(self._get(url))

    def bytes(self, url: str) -> bytes:
        return self._get(url)
```

- [ ] **Step 4: Run them.** `python -m pytest scripts/figgen/tests/test_real_rules.py -q` → PASS, 9 passed.

- [ ] **Step 5: Commit.** `git add scripts/figgen/real scripts/figgen/tests/test_real_rules.py scripts/figgen/tests/pictures.py && git commit -m "feat(figgen): licence and size rules, near-copy hashing, and a polite Wikimedia client"`

---

### Task 3: Harvest into the store, and the comparison set

**Files:**
- Modify: `scripts/figgen/store.py` (add `save_real`)
- Create: `scripts/figgen/real/harvest.py`, `scripts/figgen/real/choose.py`
- Test: `scripts/figgen/tests/test_real_harvest.py`

**Interfaces:**
- Consumes: Task 2's modules; `open_store`, `topic` and `library_dir` (P1a).
- Produces:
  - `store.save_real(db, *, figure_id, origin, kind, subject, band, topic_key, asset, preview, width, height, spec, licence, author, source_url, credit, phash)`.
  - `harvest.PILOT: dict[str, str]`, mapping topic key to figure kind.
  - `harvest.harvest_topic(db, lib, fetch, key, kind, want, per_term=25) -> {"topic", "have", "turned"}`.
  - `choose.choose(db, per_topic=10, seed=2026) -> list[str]`.
  - A figure id is `wikimedia/<pageid>`. Its asset is `assets/wikimedia/<pageid>.webp`, at most 1200 px, and its preview is `assets/wikimedia/<pageid>-512.jpg`.
  - `figures.spec` holds `{pageid, title, term, description, categories, licence_url}`.

- [ ] **Step 1: Write the failing tests.** Create `scripts/figgen/tests/test_real_harvest.py`:

```python
import io
import json

import pytest
from PIL import Image
from pictures import picture

from figgen.real.choose import choose
from figgen.real.harvest import harvest_topic
from figgen.store import open_store


def page(pageid, title, licence="CC BY 4.0", width=2000, height=1500, author="A. Person", cats=("Cells",)):
    return {"pageid": pageid, "title": f"File:{title}.jpg",
            "imageinfo": [{"width": width, "height": height, "mime": "image/jpeg", "thumburl": f"https://img/{pageid}.jpg",
                           "descriptionurl": f"https://commons.wikimedia.org/wiki/File:{title}.jpg",
                           "extmetadata": {"LicenseShortName": {"value": licence}, "LicenseUrl": {"value": "https://cc/by"},
                                           "Artist": {"value": author}, "ImageDescription": {"value": title}}}],
            "categories": [{"title": f"Category:{c}"} for c in cats]}


class FakeFetch:
    """Search replies by term, and an image for each file; file 4 is a resized copy of file 1."""

    def __init__(self):
        self.downloads = 0
        self.pages = {
            "cell micrograph": [page(1, "Onion cells"), page(2, "Cheek cells", licence="CC BY-NC 2.0"),
                                page(3, "Tiny cells", width=500, height=400), page(4, "Onion cells copy")],
            "plant cell": [page(5, "Leaf cells"), page(6, "Portrait of Hooke", cats=("Portraits of scientists",))],
        }

    def json(self, url):
        for term, pages in self.pages.items():
            if term.replace(" ", "+") in url or term.replace(" ", "%20") in url:
                return {"query": {"pages": pages}}
        return {}

    def bytes(self, url):
        self.downloads += 1
        pageid = int(url.rsplit("/", 1)[1].split(".")[0])
        img = picture(1, (1600, 1200)) if pageid in (1, 4) else picture(pageid, (1600, 1200))
        if pageid == 4:
            img = img.resize((1400, 1050))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
        return buf.getvalue()


@pytest.fixture
def db(tmp_path):
    store = open_store(tmp_path / "figures.db")
    store.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')")
    store.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES "
                  "('db:2', '[]', '[\"photo.micrograph\"]', '[\"cell micrograph\", \"plant cell\"]', 'mostly real', 'm', 'now')")
    store.commit()
    return store


def test_harvests_usable_files_with_their_credit(db, tmp_path):
    lib = tmp_path / "lib"
    r = harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=10)
    assert r["have"] == 2  # onion and leaf cells; the NC licence, the tiny file, the copy and the portrait are turned away
    rows = db.execute("SELECT * FROM figures ORDER BY id").fetchall()
    assert [row["id"] for row in rows] == ["wikimedia/1", "wikimedia/5"]
    onion = rows[0]
    assert (onion["origin"], onion["kind"], onion["subject"], onion["band"], onion["status"]) == ("wikimedia", "photo.micrograph", "biology", "UP", "candidate")
    assert onion["licence"] == "CC BY 4.0" and onion["author"] == "A. Person"
    assert onion["credit"] == "Onion cells by A. Person, CC BY 4.0, via Wikimedia Commons"
    assert onion["source_url"].endswith("File:Onion cells.jpg")
    assert json.loads(onion["spec"])["licence_url"] == "https://cc/by"
    big = Image.open(lib / onion["asset"])
    assert big.format == "WEBP" and max(big.size) <= 1200
    assert Image.open(lib / onion["preview"]).size[0] <= 512
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:2'").fetchone()[0] == 2
    assert r["turned"]["licence"] == 1 and r["turned"]["too"] == 1 and r["turned"]["category"] == 1


def test_a_near_copy_is_not_stored(db, tmp_path):
    r = harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    assert r["turned"].get("a", 0) == 1  # "a near-copy of an image already held"
    assert db.execute("SELECT COUNT(*) FROM figures WHERE id = 'wikimedia/4'").fetchone()[0] == 0
    assert not (tmp_path / "lib" / "assets" / "wikimedia" / "4.webp").exists()


def test_stops_at_the_number_wanted(db, tmp_path):
    assert harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=1)["have"] == 1


def test_a_finished_topic_fetches_nothing_again(db, tmp_path):
    lib = tmp_path / "lib"
    harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=2)
    again = FakeFetch()
    r = harvest_topic(db, lib, again, "db:2", "photo.micrograph", want=2)
    assert r["have"] == 2 and again.downloads == 0


def test_a_second_run_downloads_nothing_already_held(db, tmp_path):
    # Only the near-copy is fetched again: it was turned away, so nothing records it.
    lib = tmp_path / "lib"
    harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=10)
    again = FakeFetch()
    harvest_topic(db, lib, again, "db:2", "photo.micrograph", want=10)
    assert again.downloads == 1
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 2


def test_choose_takes_the_same_screened_images_every_time(db, tmp_path):
    harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'm', 1, 'cells', '{}', 'now'), ('wikimedia/5', 'm', 0, 'blurred', '{}', 'now')")
    db.commit()
    assert choose(db, per_topic=10) == ["wikimedia/1"] == choose(db, per_topic=10)
```

- [ ] **Step 2: Run them.** `python -m pytest scripts/figgen/tests/test_real_harvest.py -q` → FAIL: `No module named 'figgen.real.harvest'`.

- [ ] **Step 3: Add `save_real` to `scripts/figgen/store.py`:**

```python
def save_real(db: sqlite3.Connection, *, figure_id: str, origin: str, kind: str, subject: str, band: str,
              topic_key: str, asset: str, preview: str, width: int, height: int, spec: dict, licence: str,
              author: str, source_url: str, credit: str, phash: str) -> None:
    """One real image, a candidate for screening, with its licence and credit (spec 5.3). Saving it again changes nothing."""
    now = datetime.now(timezone.utc).isoformat()
    with db:
        db.execute(
            """INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, width, height, spec,
                                    licence, author, source_url, credit, phash, status, created_at)
               VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?)
               ON CONFLICT(id) DO NOTHING""",
            (figure_id, origin, kind, subject, band, asset, preview, width, height, json.dumps(spec, sort_keys=True),
             licence, author, source_url, credit, phash, now))
        db.execute("INSERT OR IGNORE INTO figure_topics (figure_id, topic_key) VALUES (?, ?)", (figure_id, topic_key))
```

- [ ] **Step 4: Write `scripts/figgen/real/harvest.py`:**

```python
"""Harvests the real-image pilot from Wikimedia Commons into the staging store (spec 5.3, steps 1, 2 and 4).

Run from the repo root:  python scripts/figgen/real/harvest.py [--per-topic 100] [--per-term 25] [--topics db:2,db:36]

Each kept file is stored at <FIGURE_LIBRARY_DIR>/assets/wikimedia/<pageid>.webp (at most 1200 px) with a 512 px
JPEG beside it, for screening and sample sheets. Resumable: files already held are never fetched again.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from PIL import Image  # noqa: E402

from figgen.real.commons import Fetcher, parse_search, search_url  # noqa: E402
from figgen.real.hashing import MIN_DISTANCE, dhash, distance  # noqa: E402
from figgen.real.rules import reject_reason  # noqa: E402
from figgen.store import library_dir, open_store, save_real, topic  # noqa: E402

# Pilot topics (P1b), one for each kind of real image: topic key -> figure kind.
PILOT = {
    "db:2": "photo.micrograph",     # Cambridge IGCSE Biology: Cells
    "db:36": "photo.specimen",      # Rwanda S1-S3 Biology: Classification of Kingdom Animalia
    "db:1098": "photo.landscape",   # Rwanda S1-S3 Geography: Forms of relief
    "db:162": "source.historical",  # Cambridge IGCSE History: The Cold War, 1945-75
    "db:948": "photo.apparatus",    # Rwanda S1-S3 Chemistry: Laboratory safety and apparatus
    "db:579": "photo.specimen",     # Cambridge Primary Science: The life cycle of flowering plants
}


def figure_id(pageid: int) -> str:
    return f"wikimedia/{pageid}"


def store_image(lib: Path, fid: str, data: bytes) -> tuple[str, str, int, int, int]:
    """Writes the WebP (at most 1200 px) and the 512 px JPEG; returns (asset, preview, width, height, hash)."""
    img = Image.open(io.BytesIO(data))
    img.load()
    img = img.convert("RGB")
    h = dhash(img)
    big, small = img.copy(), img.copy()
    big.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    small.thumbnail((512, 512), Image.Resampling.LANCZOS)
    asset, preview = f"assets/{fid}.webp", f"assets/{fid}-512.jpg"
    (lib / asset).parent.mkdir(parents=True, exist_ok=True)
    big.save(lib / asset, "WEBP", quality=85)
    small.save(lib / preview, "JPEG", quality=82)
    return asset, preview, big.width, big.height, h


def credit_line(c: dict) -> str:
    name = c["title"].removeprefix("File:").rsplit(".", 1)[0]
    return f"{name} by {c['author'] or 'an unknown author'}, {c['licence']}, via Wikimedia Commons"


def harvest_topic(db, lib: Path, fetch, key: str, kind: str, want: int, per_term: int = 25) -> dict:
    """Fills one topic up to `want` stored candidates from its search terms, turning away what cannot be used."""
    t = topic(db, key)
    terms = json.loads(db.execute("SELECT terms FROM topic_map WHERE topic_key = ?", (key,)).fetchone()[0])
    have = db.execute("SELECT COUNT(*) FROM figure_topics ft JOIN figures f ON f.id = ft.figure_id "
                      "WHERE ft.topic_key = ? AND f.origin = 'wikimedia'", (key,)).fetchone()[0]
    hashes = [int(r[0], 16) for r in db.execute("SELECT phash FROM figures WHERE phash IS NOT NULL")]
    turned: dict[str, int] = {}
    for term in terms:
        if have >= want:
            break
        for c in parse_search(fetch.json(search_url(term, per_term)), term):
            if have >= want:
                break
            fid = figure_id(c["pageid"])
            if db.execute("SELECT 1 FROM figures WHERE id = ?", (fid,)).fetchone():
                continue  # held already, from this topic or another
            why = reject_reason(c)
            stored = None
            if why is None:
                try:
                    stored = store_image(lib, fid, fetch.bytes(c["thumb"]))
                except Exception as e:  # a file that will not download or open is skipped, and counted
                    why = f"unreadable {type(e).__name__}"
            if stored and any(distance(stored[4], x) < MIN_DISTANCE for x in hashes):
                why = "a near-copy of an image already held"
                (lib / stored[0]).unlink(missing_ok=True)
                (lib / stored[1]).unlink(missing_ok=True)
            if why:
                turned[why.split(" ")[0]] = turned.get(why.split(" ")[0], 0) + 1
                continue
            asset, preview, width, height, h = stored
            save_real(db, figure_id=fid, origin="wikimedia", kind=kind, subject=t["subject"], band=t["band"],
                      topic_key=key, asset=asset, preview=preview, width=width, height=height,
                      spec={"pageid": c["pageid"], "title": c["title"], "term": term, "description": c["description"],
                            "categories": c["categories"][:20], "licence_url": c["licence_url"]},
                      licence=c["licence"], author=c["author"], source_url=c["page"], credit=credit_line(c),
                      phash=f"{h:016x}")
            hashes.append(h)
            have += 1
    return {"topic": key, "have": have, "turned": turned}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Harvest the P1b real-image pilot from Wikimedia Commons")
    ap.add_argument("--per-topic", type=int, default=100)
    ap.add_argument("--per-term", type=int, default=25)
    ap.add_argument("--topics", default="", help="comma-separated topic keys; the pilot's six when left out")
    a = ap.parse_args(argv)
    keys = [k.strip() for k in a.topics.split(",") if k.strip()] or list(PILOT)
    unknown = [k for k in keys if k not in PILOT]
    if unknown:
        ap.error(f"not pilot topics: {', '.join(unknown)}")
    lib, db, fetch = library_dir(), open_store(), Fetcher()
    for key in keys:
        r = harvest_topic(db, lib, fetch, key, PILOT[key], a.per_topic, a.per_term)
        print(f"{key:8s} {r['have']:4d} held; turned away: {r['turned']}")
    total = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'wikimedia'").fetchone()[0]
    print(f"{total} real candidates in the store at {lib}")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Write `scripts/figgen/real/choose.py`:**

```python
"""Chooses the comparison set: the same screened images go to both writers (spec 5.5).

Run from the repo root:  python scripts/figgen/real/choose.py [--per-topic 10]
Writes the figure ids, one per line, to <FIGURE_LIBRARY_DIR>/reports/p1b-compare.txt.
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from figgen.store import library_dir, open_store  # noqa: E402


def choose(db, per_topic: int = 10, seed: int = 2026) -> list[str]:
    """Up to `per_topic` kept images from each topic, drawn at random but the same every time."""
    rng = random.Random(seed)
    out: list[str] = []
    keys = [r[0] for r in db.execute("SELECT DISTINCT ft.topic_key FROM figure_topics ft JOIN screenings s "
                                     "ON s.figure_id = ft.figure_id WHERE s.keep = 1 ORDER BY ft.topic_key")]
    for key in keys:
        ids = [r[0] for r in db.execute("SELECT ft.figure_id FROM figure_topics ft JOIN screenings s ON s.figure_id = "
                                        "ft.figure_id WHERE s.keep = 1 AND ft.topic_key = ? ORDER BY ft.figure_id", (key,))]
        out += sorted(rng.sample(ids, min(per_topic, len(ids))))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Choose the P1b comparison set")
    ap.add_argument("--per-topic", type=int, default=10)
    a = ap.parse_args(argv)
    db = open_store()
    ids = choose(db, a.per_topic)
    out = library_dir() / "reports" / "p1b-compare.txt"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(ids) + "\n", encoding="utf-8")
    print(f"Wrote {len(ids)} figure ids to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run them, then the Python suite.** `python -m pytest scripts/figgen/tests/test_real_harvest.py -q && python -m pytest scripts/figgen -q` → PASS, 6 passed, then the whole suite.

- [ ] **Step 7: Commit.** `git add scripts/figgen/store.py scripts/figgen/real scripts/figgen/tests/test_real_harvest.py && git commit -m "feat(figgen): harvest real images into the staging store, and choose the comparison set"`

---

### Task 4: Nova Lite in the model call

**Files:**
- Modify: `scripts/figure-library/claude.ts`, `scripts/figure-library/spend.ts`
- Test: `scripts/figure-library/claude.test.ts`

**Interfaces:**
- Produces:
  - `NOVA_LITE = 'eu.amazon.nova-lite-v1:0'`.
  - `requestBody` builds the Nova shape for Nova models: `{schemaVersion: 'messages-v1', messages: [{role, content: [{image: {format, source: {bytes}}}, {text}]}], inferenceConfig: {maxTokens, temperature: 0}}`.
  - `readReply(model, body) -> ModelReply` reads either shape. Nova returns `output.message.content[].text`, `usage.inputTokens` / `usage.outputTokens`, and `stopReason`.
  - `PRICES[NOVA_LITE] = {input: 0.078, output: 0.312}`.

- [ ] **Step 1: Write the failing tests.** In `claude.test.ts`, add `NOVA_LITE, readReply` to the import from `./claude`, and add:

```ts
describe('Nova Lite', () => {
  it('gets the Nova request shape, images first', () => {
    expect(requestBody(NOVA_LITE, 'judge this', 300, [{ mediaType: 'image/jpeg', data: 'abc' }])).toEqual({
      schemaVersion: 'messages-v1',
      messages: [{ role: 'user', content: [{ image: { format: 'jpeg', source: { bytes: 'abc' } } }, { text: 'judge this' }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    })
  })

  it('reads a Nova reply, and a Claude reply, into one shape', () => {
    expect(readReply(NOVA_LITE, { output: { message: { content: [{ text: '{"ok":' }, { text: 'true}' }] } }, stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 6 } }))
      .toEqual({ text: '{"ok":true}', inputTokens: 10, outputTokens: 6, truncated: false })
    expect(readReply(NOVA_LITE, { output: { message: { content: [] } }, stopReason: 'max_tokens', usage: {} }).truncated).toBe(true)
    expect(readReply(HAIKU, { content: [{ text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 1 } }))
      .toEqual({ text: 'hi', inputTokens: 3, outputTokens: 1, truncated: false })
  })

  it('has a price, so its spend is recorded', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{"ok":1}', inputTokens: 1000, outputTokens: 100 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, model: NOVA_LITE, wait: noWait })
    expect(totalSpend(db, 't')).toBeCloseTo((1000 * 0.078 + 100 * 0.312) / 1e6, 12)
  })
})
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/claude.test.ts` → FAIL: `readReply` is not a function, and `NOVA_LITE` is undefined.

- [ ] **Step 3: Implement.**

In `spend.ts`, add to `PRICES`:

```ts
  // Nova Lite, eu-west-1 on-demand: used to screen real images (spec 5.3 step 3).
  'eu.amazon.nova-lite-v1:0': { input: 0.078, output: 0.312 },
```

In `claude.ts`, under `SONNET`:

```ts
export const NOVA_LITE = 'eu.amazon.nova-lite-v1:0'
const isNova = (model: string) => /nova/.test(model)
```

At the top of `requestBody`, before the Claude shape:

```ts
  if (isNova(model)) {
    return {
      schemaVersion: 'messages-v1',
      messages: [{
        role: 'user',
        content: [...images.map((i) => ({ image: { format: i.mediaType.split('/')[1], source: { bytes: i.data } } })), { text: prompt }],
      }],
      inferenceConfig: { maxTokens, temperature: 0 },
    }
  }
```

Add, and use it in `bedrockSender` in place of the inline reply parsing (`return readReply(model, JSON.parse(new TextDecoder().decode(res.body)))`):

```ts
/** A Bedrock reply as text, token counts and whether it was cut off, from Claude's shape or Nova's. */
export function readReply(model: string, body: any): ModelReply {
  if (isNova(model)) {
    const content = body?.output?.message?.content
    return {
      text: (Array.isArray(content) ? content : []).map((c: { text?: string }) => c.text ?? '').join(''),
      inputTokens: Number(body?.usage?.inputTokens ?? 0),
      outputTokens: Number(body?.usage?.outputTokens ?? 0),
      truncated: body?.stopReason === 'max_tokens',
    }
  }
  return {
    text: (Array.isArray(body?.content) ? body.content : []).map((c: { text?: string }) => c.text ?? '').join(''),
    inputTokens: Number(body?.usage?.input_tokens ?? 0),
    outputTokens: Number(body?.usage?.output_tokens ?? 0),
    truncated: body?.stop_reason === 'max_tokens',
  }
}
```

- [ ] **Step 4: Run them, the suite and tsc.** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → all pass; tsc prints nothing.

- [ ] **Step 5: Commit.** `git add scripts/figure-library/claude.ts scripts/figure-library/claude.test.ts scripts/figure-library/spend.ts && git commit -m "feat(figure-library): Nova Lite request and reply shapes, with its price"`

---

### Task 5: Screening with Nova Lite

**Files:**
- Create: `scripts/figure-library/screen.ts`, `scripts/figure-library/screen-real.ts`
- Modify: `scripts/figure-library/review.ts` (export `LEVELS`; `previewImage` reads the type from the extension)
- Test: `scripts/figure-library/screen.test.ts`, `scripts/figure-library/review.test.ts`

**Interfaces:**
- Consumes: `NOVA_LITE`, `askJson`, `bedrockSender` and `runPool` (Task 4); the `screenings` table (Task 1); `LEVELS` and `previewImage` from review.ts.
- Produces:
  - `SCREEN_JOB = 'p1b-screen'` and types `ScreenItem` and `Screening {keep, shows, reasons}`.
  - `screenPrompt(item)`.
  - `parseScreen(raw)`: keep is worked out in code, and the call throws on any missing judgement.
  - `toScreen(db, {limit?})` and `saveScreen(db, {figureId, model, screening, detail})`. Status becomes `screened`, or `rejected` with the reasons.
  - `previewImage` returns `image/jpeg` for `.jpg` and `image/webp` for `.webp`.
  - CLI: `npx jiti scripts/figure-library/screen-real.ts [--limit=N] [--dry] [--workers=6]`.

- [ ] **Step 1: Write the failing tests.** Create `scripts/figure-library/screen.test.ts`:

```ts
// scripts/figure-library/screen.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { parseScreen, saveScreen, screenPrompt, toScreen, type ScreenItem } from './screen'

const item: ScreenItem = {
  figureId: 'wikimedia/1', subject: 'biology', band: 'UP', topic: 'Cells', title: 'File:Onion cells.jpg',
  description: 'Onion epidermis under a light microscope', preview: 'assets/wikimedia/1-512.jpg',
}
const good = { shows: 'Onion epidermis cells with nuclei', educational: true, on_topic: true, clear: true, person_is_subject: false, mostly_text: false, foreign_labels: false, decorative: false }

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')").run()
  for (const n of [1, 2]) {
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, preview, spec, licence, author, source_url, credit, status, created_at)
      VALUES (?, 'wikimedia', 'photo.micrograph', 'biology', 'UP', ?, ?, ?, 'CC BY 4.0', 'A', 'https://x', 'c', 'candidate', 'now')`)
      .run(`wikimedia/${n}`, `assets/wikimedia/${n}.webp`, `assets/wikimedia/${n}-512.jpg`, JSON.stringify({ title: `File:${n}.jpg`, description: 'cells' }))
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(`wikimedia/${n}`)
  }
  return db
}

describe('the screening prompt', () => {
  it('names the subject, level, topic and file, and asks every judgement', () => {
    const p = screenPrompt(item)
    for (const part of ['biology', 'Upper Secondary', '"Cells"', 'Onion cells.jpg', 'person_is_subject', 'foreign_labels', 'decorative']) expect(p).toContain(part)
  })
})

describe('reading a screening', () => {
  it('keeps an image only when every judgement is right', () => {
    expect(parseScreen(good)).toEqual({ keep: true, shows: 'Onion epidermis cells with nuclei', reasons: [] })
    expect(parseScreen({ ...good, person_is_subject: true })).toEqual({ keep: false, shows: good.shows, reasons: ['a person is the subject'] })
    expect(parseScreen({ ...good, clear: false, foreign_labels: true }).reasons).toEqual(['not clear enough', 'labels not in English'])
  })

  it('refuses a screening that leaves out a judgement', () => {
    const { decorative: _gone, ...partial } = good
    expect(() => parseScreen(partial)).toThrow(/decorative/)
    expect(() => parseScreen({ ...good, shows: '' })).toThrow(/shows/)
    expect(() => parseScreen(null)).toThrow()
  })
})

describe('screening in the store', () => {
  it('lists candidates not yet screened, and records each verdict once', () => {
    const db = store()
    expect(toScreen(db).map((i) => i.figureId)).toEqual(['wikimedia/1', 'wikimedia/2'])
    expect(toScreen(db)[0]).toMatchObject({ topic: 'Cells', title: 'File:1.jpg', preview: 'assets/wikimedia/1-512.jpg' })
    saveScreen(db, { figureId: 'wikimedia/1', model: 'nova', screening: parseScreen(good), detail: good })
    saveScreen(db, { figureId: 'wikimedia/2', model: 'nova', screening: parseScreen({ ...good, educational: false }), detail: {} })
    expect(toScreen(db)).toEqual([])
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/1'").get()).toEqual({ status: 'screened', reason: null })
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/2'").get()).toEqual({ status: 'rejected', reason: 'not educational' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM screenings').get()).toEqual({ n: 2 })
  })
})
```

In `review.test.ts`, add to `describe('the figure image for the reviewer', ...)`:

```ts
  it('reads a JPEG or WebP as what it is', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-prev-'))
    fs.mkdirSync(path.join(lib, 'assets/wikimedia'), { recursive: true })
    fs.writeFileSync(path.join(lib, 'assets/wikimedia/1-512.jpg'), Buffer.from([1]))
    fs.writeFileSync(path.join(lib, 'assets/wikimedia/1.webp'), Buffer.from([1]))
    expect(previewImage(lib, { preview: 'assets/wikimedia/1-512.jpg' })?.mediaType).toBe('image/jpeg')
    expect(previewImage(lib, { preview: 'assets/wikimedia/1.webp' })?.mediaType).toBe('image/webp')
  })
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/screen.test.ts scripts/figure-library/review.test.ts` → FAIL: `./screen` cannot be found, and the JPEG comes back as `image/png`.

- [ ] **Step 3: Implement.**

In `review.ts`, change `const LEVELS` to `export const LEVELS`, and replace `previewImage` with:

```ts
const IMAGE_TYPES: Record<string, ImageInput['mediaType']> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** The figure's image for a model, typed by its extension, or null when missing: then nothing is sent or paid for. */
export function previewImage(lib: string, item: Pick<ReviewItem, 'preview'>): ImageInput | null {
  if (!item.preview) return null
  const file = path.join(lib, item.preview)
  const mediaType = IMAGE_TYPES[path.extname(file).toLowerCase()]
  if (!mediaType || !fs.existsSync(file)) return null
  return { mediaType, data: fs.readFileSync(file).toString('base64') }
}
```

Create `scripts/figure-library/screen.ts`:

```ts
// scripts/figure-library/screen.ts
import { readJson, type Store } from './store'
import { LEVELS } from './review'

export const SCREEN_JOB = 'p1b-screen'
/** A 512 px image (about 600 tokens) and a short prompt to Nova Lite, with a sentence back. */
export const SCREEN_USD_PER_ITEM = 0.0003

export interface ScreenItem { figureId: string; subject: string; band: string; topic: string; title: string; description: string; preview: string }
export interface Screening { keep: boolean; shows: string; reasons: string[] }

/** Each judgement, the answer that keeps the image, and the reason recorded when it does not. */
const CHECKS: [string, boolean, string][] = [
  ['educational', true, 'not educational'],
  ['on_topic', true, 'off the topic'],
  ['clear', true, 'not clear enough'],
  ['person_is_subject', false, 'a person is the subject'],
  ['mostly_text', false, 'mostly text'],
  ['foreign_labels', false, 'labels not in English'],
  ['decorative', false, 'decorative'],
]

export function screenPrompt(item: ScreenItem): string {
  return [
    `This image may be used in a ${item.subject} quiz for learners at ${LEVELS[item.band] ?? item.band}, on the topic "${item.topic}".`,
    `Its file is called "${item.title}".${item.description ? ` Its description says: "${item.description.slice(0, 300)}"` : ''}`,
    '',
    'Look at the image and judge it:',
    '- educational: it clearly shows something learners of this topic study (an organism, a cell, a landform, apparatus, a historical source, a process), well enough to ask a question about.',
    '- on_topic: it fits this topic, not only the subject in general.',
    '- clear: sharp and well lit, with the thing that matters large enough to see.',
    '- person_is_subject: an identifiable person is the main subject (a portrait, a selfie, a posed group).',
    '- mostly_text: it is mainly words or a table.',
    '- foreign_labels: it has labels or captions in a language other than English.',
    '- decorative: a logo, an icon, clip art, an advert or a decoration.',
    '',
    'Reply with JSON only: {"shows":"one sentence on what the image shows","educational":true,"on_topic":true,"clear":true,"person_is_subject":false,"mostly_text":false,"foreign_labels":false,"decorative":false}',
  ].join('\n')
}

/** The screener's reply. Whether to keep is worked out here; a reply missing any judgement is refused, never read as a keep. */
export function parseScreen(raw: unknown): Screening {
  if (!raw || typeof raw !== 'object') throw new Error('The screening is not a JSON object')
  const r = raw as Record<string, unknown>
  const reasons: string[] = []
  for (const [key, keeps, why] of CHECKS) {
    if (typeof r[key] !== 'boolean') throw new Error(`The screening has no ${key} judgement`)
    if (r[key] !== keeps) reasons.push(why)
  }
  const shows = String(r.shows ?? '').trim()
  if (!shows) throw new Error('The screening does not say what the image shows')
  return { keep: reasons.length === 0, shows: shows.slice(0, 300), reasons }
}

/** Real candidates not yet screened, with their topic, oldest first. */
export function toScreen(db: Store, o: { limit?: number } = {}): ScreenItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.spec, f.preview, MIN(t.name) AS topic FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.origin <> 'drawn' AND f.status = 'candidate' AND f.id NOT IN (SELECT figure_id FROM screenings)
    GROUP BY f.id ORDER BY f.id LIMIT ?`).all(o.limit ?? 1_000_000) as { id: string; subject: string; band: string; spec: string; preview: string; topic: string }[]
  return rows.map((r) => {
    const spec = readJson<{ title?: string; description?: string }>(r.spec, {})
    return { figureId: r.id, subject: r.subject, band: r.band, topic: r.topic, title: spec.title ?? '', description: spec.description ?? '', preview: r.preview }
  })
}

/** Records one screening, replacing any earlier one; the figure becomes screened, or rejected with the reasons. */
export function saveScreen(db: Store, o: { figureId: string; model: string; screening: Screening; detail: unknown }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(figure_id) DO UPDATE SET model = excluded.model, keep = excluded.keep, shows = excluded.shows, detail = excluded.detail, at = excluded.at`)
      .run(o.figureId, o.model, o.screening.keep ? 1 : 0, o.screening.shows, JSON.stringify(o.detail ?? null), new Date().toISOString())
    db.prepare('UPDATE figures SET status = ?, reason = ? WHERE id = ?')
      .run(o.screening.keep ? 'screened' : 'rejected', o.screening.keep ? null : o.screening.reasons.join('; '), o.figureId)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
```

Create `scripts/figure-library/screen-real.ts`:

```ts
// scripts/figure-library/screen-real.ts
// Run: npx jiti scripts/figure-library/screen-real.ts [--limit=N] [--dry] [--workers=6]
// Screens real candidates with Nova Lite on their 512 px copy (spec 5.3 step 3). Resumable.
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { NOVA_LITE, askJson, bedrockSender, runPool } from './claude'
import { previewImage } from './review'
import { SCREEN_JOB, SCREEN_USD_PER_ITEM, parseScreen, saveScreen, screenPrompt, toScreen } from './screen'

const JOB_CAP_USD = 1
const MAX_UNUSABLE = 15

async function main() {
  const args = parseArgs(process.argv.slice(2), { limit: 'int', dry: 'flag', workers: 'int' })
  const db = openStore()
  const lib = libraryDir()
  const items = toScreen(db, { limit: args.limit as number | undefined })
  const estimate = items.length * SCREEN_USD_PER_ITEM
  console.log(`${items.length} images to screen, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: SCREEN_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  const unusable: string[] = []
  const reasons: Record<string, number> = {}
  let kept = 0
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 6, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no preview file`)
        return
      }
      try {
        const raw = await askJson({ db, job: SCREEN_JOB, jobCapUsd: JOB_CAP_USD, prompt: screenPrompt(item), images: [image], maxTokens: 400, send, model: NOVA_LITE })
        const screening = parseScreen(raw)
        saveScreen(db, { figureId: item.figureId, model: NOVA_LITE, screening, detail: raw })
        if (screening.keep) kept++
        for (const r of screening.reasons) reasons[r] = (reasons[r] ?? 0) + 1
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} screenings failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 50 === 0) console.log(`  ${done}/${items.length} screened, $${totalSpend(db, SCREEN_JOB).toFixed(3)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    console.log(`Screened ${done}: kept ${kept}. Reasons for rejecting: ${JSON.stringify(reasons)}`)
    if (unusable.length) console.log(`${unusable.length} not screened (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`${SCREEN_JOB} spend $${totalSpend(db, SCREEN_JOB).toFixed(3)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 4: Run them, the suite and tsc.** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → all pass; tsc prints nothing.

- [ ] **Step 5: Commit.** `git add scripts/figure-library/screen.ts scripts/figure-library/screen-real.ts scripts/figure-library/screen.test.ts scripts/figure-library/review.ts scripts/figure-library/review.test.ts && git commit -m "feat(figure-library): screen real images with Nova Lite"`

---

### Task 6: Writing and checking questions on real images

**Files:**
- Create: `scripts/figure-library/write.ts`, `scripts/figure-library/write-real.ts`
- Test: `scripts/figure-library/write.test.ts`

**Interfaces:**
- Consumes: `HAIKU`, `SONNET`, `askJson` and `runPool`; the `screenings` and `question_checks` tables; `LEVELS` and `previewImage`.
- Produces:
  - Types `WriteItem {figureId, subject, band, topic, shows, image}`, `Written {kind, stem, options, answer, accepted, explanation}` and `Check {keep, reason}`.
  - `writerTag(model)`, which returns `'haiku' | 'sonnet' | 'model'`.
  - `writePrompt(item)`.
  - `parseWritten(raw, seed) -> {questions, refused}`. It validates in code and shuffles MCQ options by a seeded order, so the answer is not always A.
  - `checkPrompt(item, questions)` and `parseChecked(raw, count) -> Check[]`. The latter throws if it is missing a verdict.
  - `toWrite(db, {writer, figureIds?, limit?})` selects screened-kept images that have no `question_checks` row for that writer.
  - `saveWritten(db, {figureId, writer, band, questions, checks, refused?}) -> kept`. Kept questions go into `figure_questions` (id `<fig>#<tag>#<i>`, model = writer); every question goes into `question_checks`.
  - CLI: `npx jiti scripts/figure-library/write-real.ts [--writer=haiku|sonnet] [--ids=<file>] [--limit=N] [--dry] [--workers=4]`. Jobs are `p1b-write-haiku` (cap $6) and `p1b-write-sonnet` (cap $3).

- [ ] **Step 1: Write the failing tests.** Create `scripts/figure-library/write.test.ts`:

```ts
// scripts/figure-library/write.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { HAIKU, SONNET } from './claude'
import { checkPrompt, parseChecked, parseWritten, saveWritten, toWrite, writePrompt, writerTag, type WriteItem } from './write'

const item: WriteItem = { figureId: 'wikimedia/1', subject: 'biology', band: 'UP', topic: 'Cells', shows: 'Onion epidermis cells with nuclei', image: 'assets/wikimedia/1.webp' }
const mcq = { kind: 'mcq', stem: 'Look at the micrograph. What is the dark dot in each cell?', options: ['Nucleus', 'Vacuole', 'Chloroplast', 'Cell wall'], answer: 0, explanation: 'It holds the DNA.' }
const short = { kind: 'short', stem: 'Look at the micrograph. What surrounds each plant cell?', answer: 'cell wall', accepted: ['a cell wall', 'cell wall'], explanation: '' }

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')").run()
  for (const [n, keep] of [[1, 1], [2, 1], [3, 0]] as const) {
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, preview, spec, status, created_at)
      VALUES (?, 'wikimedia', 'photo.micrograph', 'biology', 'UP', ?, ?, '{}', ?, 'now')`).run(`wikimedia/${n}`, `assets/wikimedia/${n}.webp`, `assets/wikimedia/${n}-512.jpg`, keep ? 'screened' : 'rejected')
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(`wikimedia/${n}`)
    db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES (?, 'nova', ?, 'cells', '{}', 'now')").run(`wikimedia/${n}`, keep)
  }
  return db
}

describe('the writing prompt', () => {
  it('sets the subject, level, topic and what the image shows, and the house rules', () => {
    const p = writePrompt(item)
    for (const part of ['biology', 'Upper Secondary', 'Topic: Cells.', 'Onion epidermis cells with nuclei', 'never the answer', 'four options', 'at most four words', '{"questions": []}']) expect(p).toContain(part)
  })
})

describe('reading what was written', () => {
  it('keeps well-formed questions, with the options in a seeded order', () => {
    const { questions, refused } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    expect(refused).toEqual([])
    const [m, s] = questions
    expect(m.options[Number(m.answer)]).toBe('Nucleus')
    expect([...m.options].sort()).toEqual(['Cell wall', 'Chloroplast', 'Nucleus', 'Vacuole'])
    expect(parseWritten({ questions: [mcq] }, 'wikimedia/1').questions[0]).toEqual(m)  // the same order every time
    expect(s).toEqual({ kind: 'short', stem: short.stem, options: [], answer: 'cell wall', accepted: ['cell wall', 'a cell wall'], explanation: '' })
  })

  it('refuses malformed questions and says why', () => {
    const { questions, refused } = parseWritten({ questions: [
      { ...mcq, options: ['A', 'A', 'B', 'C'] }, { ...mcq, answer: 4 }, { ...short, answer: 'the wall around the cell' }, { ...short, kind: 'essay' }, { ...mcq, stem: '' },
    ] }, 'x')
    expect(questions).toEqual([])
    expect(refused).toHaveLength(3)  // only the first three are read
  })

  it('accepts an image with no good question, and refuses a reply with no list', () => {
    expect(parseWritten({ questions: [] }, 'x')).toEqual({ questions: [], refused: [] })
    expect(() => parseWritten({}, 'x')).toThrow(/questions/)
  })
})

describe('the check', () => {
  it('shows each question with its key', () => {
    const { questions } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    const p = checkPrompt(item, questions)
    expect(p).toContain(`Key: ${String.fromCharCode(65 + Number(questions[0].answer))}`)
    expect(p).toContain('Key: cell wall (also accepted: a cell wall)')
  })

  it('reads a verdict for every question, and refuses a check that skips a question', () => {
    expect(parseChecked({ verdicts: [{ n: 1, keep: true }, { n: 2, keep: false, reason: 'not visible' }] }, 2))
      .toEqual([{ keep: true, reason: '' }, { keep: false, reason: 'not visible' }])
    expect(() => parseChecked({ verdicts: [{ n: 1, keep: true }] }, 2)).toThrow(/question 2/)
    expect(() => parseChecked({ verdicts: [{ n: 1, keep: 'yes' }] }, 1)).toThrow(/question 1/)
  })
})

describe('writing in the store', () => {
  it('lists kept images not yet written by this writer, and saves only kept questions', () => {
    const db = store()
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/1', 'wikimedia/2'])
    const { questions } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    expect(saveWritten(db, { figureId: 'wikimedia/1', writer: HAIKU, band: 'UP', questions, checks: [{ keep: true, reason: '' }, { keep: false, reason: 'not visible' }] })).toBe(1)
    expect(db.prepare('SELECT id, n, kind, model FROM figure_questions').all()).toEqual([{ id: 'wikimedia/1#haiku#1', n: 1, kind: 'mcq', model: HAIKU }])
    expect(db.prepare('SELECT question_id, keep, reason FROM question_checks ORDER BY question_id').all())
      .toEqual([{ question_id: 'wikimedia/1#haiku#1', keep: 1, reason: '' }, { question_id: 'wikimedia/1#haiku#2', keep: 0, reason: 'not visible' }])
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/2'])
    expect(toWrite(db, { writer: SONNET, figureIds: ['wikimedia/1'] }).map((i) => i.figureId)).toEqual(['wikimedia/1'])
  })

  it('does not write twice for the same writer, even when the image got no question', () => {
    const db = store()
    saveWritten(db, { figureId: 'wikimedia/2', writer: HAIKU, band: 'UP', questions: [], checks: [], refused: ['Q1: kind must be mcq or short'] })
    expect(db.prepare("SELECT question_id, keep, reason FROM question_checks").get())
      .toEqual({ question_id: 'wikimedia/2#haiku#0', keep: 0, reason: 'Q1: kind must be mcq or short' })
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/1'])
  })

  it('names each writer', () => {
    expect([writerTag(HAIKU), writerTag(SONNET), writerTag('other')]).toEqual(['haiku', 'sonnet', 'model'])
  })
})
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/write.test.ts` → FAIL: `./write` cannot be found.

- [ ] **Step 3: Write `scripts/figure-library/write.ts`:**

```ts
// scripts/figure-library/write.ts
import type { Store } from './store'
import { LEVELS } from './review'

export interface WriteItem { figureId: string; subject: string; band: string; topic: string; shows: string; image: string }
export interface Written { kind: 'mcq' | 'short'; stem: string; options: string[]; answer: string; accepted: string[]; explanation: string }
export interface Check { keep: boolean; reason: string }

export const writerTag = (model: string) => (/sonnet/.test(model) ? 'sonnet' : /haiku/.test(model) ? 'haiku' : 'model')

const letter = (i: number) => String.fromCharCode(65 + i)

/** The house rules from the vetted-question pipeline, for a real image (spec 5.3 step 5). */
export function writePrompt(item: WriteItem): string {
  return [
    `Write up to three questions for a ${item.subject} quiz, answered by a learner at ${LEVELS[item.band] ?? item.band}.`,
    `Topic: ${item.topic}.`,
    `The image is attached. It shows: ${item.shows}`,
    '',
    'Rules:',
    `- Each question is about something the image shows, and is answered by looking at it and knowing the ${item.subject} of this topic at this level.`,
    '- Ask what a learner would be asked: what it is, what a part is or does, what process or idea it shows, what would happen, or what can be seen or read in it. Never trivia (counting things, colours for their own sake), and never something only an expert could tell from this image.',
    '- A word printed on the image is never the answer.',
    '- Multiple choice: four options, exactly one right, the wrong ones plausible to a learner. Give "answer" as the index of the right option.',
    '- Short answer: one word, a number or a short phrase of at most four words, with every fair way of writing it in "accepted".',
    '- Begin with one short sentence that sets it up, such as "Look at the photograph." Keep each question under 30 words.',
    '- Fewer good questions are better than three weak ones. If the image cannot carry a good question on this topic, return {"questions": []}.',
    '',
    'Return JSON only, shaped like this:',
    '{"questions":[{"kind":"mcq","stem":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"kind":"short","stem":"...","answer":"...","accepted":["..."],"explanation":"..."}]}',
  ].join('\n')
}

/** A seeded order, so the right option lands anywhere but always in the same place for the same question. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619) >>> 0
  const next = () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = Math.imul(h ^ (h >>> 15), h | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The writer's reply, checked in code: at most three questions, each well formed, or refused with a reason. */
export function parseWritten(raw: unknown, seed: string): { questions: Written[]; refused: string[] } {
  const list = raw && typeof raw === 'object' ? (raw as { questions?: unknown }).questions : undefined
  if (!Array.isArray(list)) throw new Error('The reply has no questions list')
  const questions: Written[] = []
  const refused: string[] = []
  list.slice(0, 3).forEach((q, i) => {
    const r = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>
    const stem = String(r.stem ?? '').trim()
    const explanation = String(r.explanation ?? '').trim()
    if (!stem || stem.length > 300) {
      refused.push(`Q${i + 1}: no stem, or one too long`)
    } else if (r.kind === 'mcq') {
      const options = Array.isArray(r.options) ? r.options.map((o) => String(o).trim()) : []
      const answer = Number(r.answer)
      if (options.length !== 4 || options.some((o) => !o) || new Set(options.map((o) => o.toLowerCase())).size !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) {
        refused.push(`Q${i + 1}: needs four different options and the index of the right one`)
      } else {
        const order = shuffled([0, 1, 2, 3], `${seed}#${i}`)
        questions.push({ kind: 'mcq', stem, options: order.map((k) => options[k]), answer: String(order.indexOf(answer)), accepted: [], explanation })
      }
    } else if (r.kind === 'short') {
      const answer = String(r.answer ?? '').trim()
      if (!answer || answer.length > 40 || answer.split(/\s+/).length > 4) {
        refused.push(`Q${i + 1}: a short answer must be at most four words`)
      } else {
        const forms = [answer, ...(Array.isArray(r.accepted) ? r.accepted.map((a) => String(a).trim()) : [])]
        questions.push({ kind: 'short', stem, options: [], answer, accepted: forms.filter((a, k) => a && forms.indexOf(a) === k), explanation })
      }
    } else {
      refused.push(`Q${i + 1}: kind must be mcq or short`)
    }
  })
  return { questions, refused }
}

/** The strict check, a separate call by the same model, which sees each key (spec 5.3 step 6). */
export function checkPrompt(item: WriteItem, questions: Written[]): string {
  const list = questions.map((q, i) => q.kind === 'mcq'
    ? `${i + 1}. [multiple choice] ${q.stem}\n${q.options.map((o, k) => `   ${letter(k)}) ${o}`).join('\n')}\n   Key: ${letter(Number(q.answer))}`
    : `${i + 1}. [short answer] ${q.stem}\n   Key: ${q.answer}${q.accepted.length > 1 ? ` (also accepted: ${q.accepted.slice(1).join('; ')})` : ''}`,
  ).join('\n\n')
  return [
    `You are a strict checker for a ${item.subject} quiz at ${LEVELS[item.band] ?? item.band}, on the topic "${item.topic}". The image is attached.`,
    'Keep a question only if all of these hold:',
    '- the image clearly shows what the question needs, and a learner at this level could answer from the image and their knowledge;',
    '- the key is right, and for multiple choice no other option is also right;',
    '- it is about this topic, it is not trivia, and its answer is not a word printed on the image.',
    'Otherwise drop it, and say why in a few words.',
    '',
    list,
    '',
    'Reply with JSON only: {"verdicts":[{"n":1,"keep":true,"reason":""}]}',
  ].join('\n')
}

/** A verdict for every question, or the check is refused: a missing verdict is never read as a keep. */
export function parseChecked(raw: unknown, count: number): Check[] {
  const list = raw && typeof raw === 'object' ? (raw as { verdicts?: unknown }).verdicts : undefined
  if (!Array.isArray(list)) throw new Error('The check has no verdicts list')
  return Array.from({ length: count }, (_, i) => {
    const v = (list as Record<string, unknown>[]).find((x) => x && Number(x.n) === i + 1)
    if (!v || typeof v.keep !== 'boolean') throw new Error(`The check does not judge question ${i + 1}`)
    return { keep: v.keep, reason: String(v.reason ?? '') }
  })
}

/** Screened-kept images this writer has not written for yet. */
export function toWrite(db: Store, o: { writer: string; figureIds?: readonly string[]; limit?: number }): WriteItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.asset, s.shows, MIN(t.name) AS topic FROM figures f
    JOIN screenings s ON s.figure_id = f.id AND s.keep = 1
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.id NOT IN (SELECT figure_id FROM question_checks WHERE writer = ?)
    GROUP BY f.id ORDER BY f.id`).all(o.writer) as { id: string; subject: string; band: string; asset: string; shows: string; topic: string }[]
  const wanted = o.figureIds ? new Set(o.figureIds) : null
  return rows.filter((r) => !wanted || wanted.has(r.id)).slice(0, o.limit ?? rows.length)
    .map((r) => ({ figureId: r.id, subject: r.subject, band: r.band, topic: r.topic, shows: r.shows, image: r.asset }))
}

/** Saves one image's questions: kept ones into figure_questions, every one (or the lack of one) into question_checks. */
export function saveWritten(db: Store, o: { figureId: string; writer: string; band: string; questions: Written[]; checks: Check[]; refused?: string[] }): number {
  const tag = writerTag(o.writer)
  const at = new Date().toISOString()
  let kept = 0
  db.exec('BEGIN')
  try {
    const check = db.prepare(`INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(question_id) DO UPDATE SET keep = excluded.keep, reason = excluded.reason, question = excluded.question, at = excluded.at`)
    const put = db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    db.prepare('DELETE FROM figure_questions WHERE figure_id = ? AND model = ?').run(o.figureId, o.writer)
    if (!o.questions.length) {
      check.run(`${o.figureId}#${tag}#0`, o.figureId, o.writer, 0, (o.refused ?? []).join('; ') || 'no question written', '{}', at)
    }
    o.questions.forEach((q, i) => {
      const id = `${o.figureId}#${tag}#${i + 1}`
      const c = o.checks[i] ?? { keep: false, reason: 'not checked' }
      check.run(id, o.figureId, o.writer, c.keep ? 1 : 0, c.reason, JSON.stringify(q), at)
      if (c.keep) put.run(id, o.figureId, ++kept, o.band, q.kind, q.stem, JSON.stringify(q.options), q.answer, JSON.stringify(q.accepted), q.explanation, o.writer)
    })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return kept
}
```

- [ ] **Step 4: Write `scripts/figure-library/write-real.ts`:**

```ts
// scripts/figure-library/write-real.ts
// Run: npx jiti scripts/figure-library/write-real.ts [--writer=haiku|sonnet] [--ids=<file>] [--limit=N] [--dry] [--workers=4]
// Writes questions for screened real images, then checks them in a separate strict call by the
// same model (spec 5.3 steps 5 and 6). Resumable: an image is written once per writer.
import fs from 'node:fs'
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { HAIKU, SONNET, askJson, bedrockSender, runPool } from './claude'
import { previewImage } from './review'
import { checkPrompt, parseChecked, parseWritten, saveWritten, toWrite, writePrompt } from './write'

const MODELS = { haiku: HAIKU, sonnet: SONNET } as const
const CAPS = { haiku: 6, sonnet: 3 } as const
/** A 1,200 px image (about 1,500 tokens) twice, two prompts, and the questions and verdicts back. */
const PER_ITEM = { haiku: 0.012, sonnet: 0.03 } as const
const MAX_UNUSABLE = 10

async function main() {
  const args = parseArgs(process.argv.slice(2), { writer: 'string', ids: 'string', limit: 'int', dry: 'flag', workers: 'int' })
  const tag = String(args.writer ?? 'haiku')
  if (tag !== 'haiku' && tag !== 'sonnet') throw new Error('--writer must be haiku or sonnet')
  const model = MODELS[tag]
  const job = `p1b-write-${tag}`
  const cap = CAPS[tag]
  const ids = args.ids ? fs.readFileSync(String(args.ids), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : undefined
  const db = openStore()
  const lib = libraryDir()
  const items = toWrite(db, { writer: model, figureIds: ids, limit: args.limit as number | undefined })
  const estimate = items.length * PER_ITEM[tag]
  console.log(`${items.length} images to write for (${tag}), estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job, estimateUsd: estimate, jobCapUsd: cap })
  const send = bedrockSender()
  const unusable: string[] = []
  let written = 0
  let kept = 0
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, { preview: item.image })
      if (!image) {
        unusable.push(`${item.figureId}: no image file`)
        return
      }
      try {
        const { questions, refused } = parseWritten(
          await askJson({ db, job, jobCapUsd: cap, prompt: writePrompt(item), images: [image], maxTokens: 2000, send, model }), item.figureId)
        const checks = questions.length
          ? parseChecked(await askJson({ db, job, jobCapUsd: cap, prompt: checkPrompt(item, questions), images: [image], maxTokens: 1000, send, model }), questions.length)
          : []
        written += questions.length
        kept += saveWritten(db, { figureId: item.figureId, writer: model, band: item.band, questions, checks, refused })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} images failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 20 === 0) console.log(`  ${done}/${items.length} written, $${totalSpend(db, job).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    console.log(`Wrote for ${done} images: ${written} questions, ${kept} kept by the check.`)
    if (unusable.length) console.log(`${unusable.length} not written (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`${job} spend $${totalSpend(db, job).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 5: Run them, the suite and tsc.** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → all pass; tsc prints nothing.

- [ ] **Step 6: Commit.** `git add scripts/figure-library/write.ts scripts/figure-library/write-real.ts scripts/figure-library/write.test.ts && git commit -m "feat(figure-library): write and check questions on real images, by Haiku or Sonnet"`

---

### Task 7: Blind review by writer, and the comparison

**Files:**
- Modify: `scripts/figure-library/review.ts`
- Create: `scripts/figure-library/review-real.ts`
- Test: `scripts/figure-library/review.test.ts`

**Interfaces:**
- Consumes: kept questions from Task 6 (`figure_questions.model` = the writer).
- Produces:
  - `itemsToReview(db, {job, size, families?, figureIds?, writer?})`. Given `figureIds`, it reviews those figures, using the full image (`asset`) for real ones and only that writer's questions. Figures with no questions from that writer are left out.
  - `saveVerdict(db, {..., mark?: boolean})`. With `mark: false`, the figure's status is left alone.
  - `cleanRate(db, job) -> {figures, questions, clean, rate}`.
  - `regrade(db, job, writer?)`.
  - CLI: `npx jiti scripts/figure-library/review-real.ts --writer=haiku|sonnet --ids=<file> [--dry]` and `--compare`. Jobs are `p1b-blind-haiku` and `p1b-blind-sonnet` (cap $2 each).
  - The comparison rule (spec 5.5): Haiku is accepted if its clean rate is at least 90% of Sonnet's.

- [ ] **Step 1: Write the failing tests.** In `review.test.ts`, add `cleanRate` to the import from `./review`, and add:

```ts
describe('real images, one writer at a time', () => {
  function realStore(): Store {
    const db = store()
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, preview, spec, status, created_at)
      VALUES ('wikimedia/9', 'wikimedia', 'photo.micrograph', 'biology', 'UP', 'assets/wikimedia/9.webp', 'assets/wikimedia/9-512.jpg', '{}', 'screened', 'now')`).run()
    for (const [id, n, model, answer] of [['wikimedia/9#haiku#1', 1, 'haiku-model', '0'], ['wikimedia/9#sonnet#1', 1, 'sonnet-model', '1']] as const) {
      db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model)
        VALUES (?, 'wikimedia/9', ?, 'UP', 'mcq', 'What is it?', '["Nucleus","Vacuole","Wall","Membrane"]', ?, '[]', ?)`).run(id, n, answer, model)
    }
    return db
  }

  it("reviews one writer's questions at a time, without rejecting the image", () => {
    const db = realStore()
    const [h] = itemsToReview(db, { job: 'h', size: 30, figureIds: ['wikimedia/9'], writer: 'haiku-model' })
    expect(h.preview).toBe('assets/wikimedia/9.webp')  // the full image, not the 512 px copy
    expect(h.questions.map((q) => q.answer)).toEqual(['0'])
    const [s] = itemsToReview(db, { job: 's', size: 30, figureIds: ['wikimedia/9'], writer: 'sonnet-model' })
    expect(s.questions.map((q) => q.answer)).toEqual(['1'])
    const failed = parseVerdict({ questions: [{ n: 1, own_answer: 'B', answerable: true, single_answer: true }], figure_clear: true, educational: true }, h)
    saveVerdict(db, { job: 'h', model: 'm', figureId: 'wikimedia/9', verdict: failed, mark: false })
    expect(db.prepare("SELECT status FROM figures WHERE id = 'wikimedia/9'").get()).toEqual({ status: 'screened' })
    expect(itemsToReview(db, { job: 'h', size: 30, figureIds: ['wikimedia/9'], writer: 'haiku-model' })).toEqual([])
    expect(itemsToReview(db, { job: 'x', size: 30, figureIds: ['wikimedia/9'], writer: 'nobody' })).toEqual([])
  })

  it('counts clean questions, the measure the writers are compared on', () => {
    const db = realStore()
    const [s] = itemsToReview(db, { job: 's', size: 30, figureIds: ['wikimedia/9'], writer: 'sonnet-model' })
    saveVerdict(db, { job: 's', model: 'm', figureId: 'wikimedia/9', verdict: parseVerdict({ questions: [{ n: 1, own_answer: 'B', answerable: true, single_answer: true }], figure_clear: true, educational: true }, s), mark: false })
    expect(cleanRate(db, 's')).toEqual({ figures: 1, questions: 1, clean: 1, rate: 1 })
    expect(cleanRate(db, 'none')).toEqual({ figures: 0, questions: 0, clean: 0, rate: 0 })
  })
})
```

- [ ] **Step 2: Run them.** `npx vitest run scripts/figure-library/review.test.ts` → FAIL: `cleanRate` is not a function, and the `figureIds` path returns nothing.

- [ ] **Step 3: Implement in `review.ts`.**

Replace `itemsToReview` with:

```ts
/**
 * Figures to review in a job, leaving out any already reviewed, so a stopped run carries on
 * without paying twice. Drawn families: up to `size` per family, earliest seeds first,
 * rejected ones included. Given `figureIds` (real images): those figures, with the full
 * image and only the questions `writer` wrote; one with none from that writer is left out.
 */
export function itemsToReview(db: Store, o: { job: string; size: number; families?: readonly string[]; figureIds?: readonly string[]; writer?: string }): ReviewItem[] {
  const reviewed = db.prepare('SELECT 1 FROM reviews WHERE job = ? AND figure_id = ?')
  const questionsOf = db.prepare(`SELECT n, kind, stem, options, answer, accepted FROM figure_questions
    WHERE figure_id = ? AND (? IS NULL OR model = ?) ORDER BY n`)
  const toItem = (f: { id: string; family: string; subject: string; band: string; preview: string | null }): ReviewItem => ({
    figureId: f.id, family: f.family, subject: f.subject, band: f.band, preview: f.preview ?? '',
    questions: (questionsOf.all(f.id, o.writer ?? null, o.writer ?? null) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string }[])
      .map((q) => ({ n: q.n, kind: q.kind, stem: q.stem, options: readJson<string[]>(q.options, []), answer: q.answer, accepted: readJson<string[]>(q.accepted, []) })),
  })
  if (o.figureIds) {
    const pick = db.prepare(`SELECT id, COALESCE(family, origin) AS family, subject, band,
      CASE WHEN origin = 'drawn' THEN preview ELSE asset END AS preview FROM figures WHERE id = ?`)
    return o.figureIds.flatMap((id) => {
      const f = pick.get(id) as { id: string; family: string; subject: string; band: string; preview: string | null } | undefined
      if (!f || reviewed.get(o.job, id)) return []
      const item = toItem(f)
      return item.questions.length ? [item] : []
    })
  }
  const families = o.families?.length
    ? o.families
    : (db.prepare("SELECT DISTINCT family FROM figures WHERE origin = 'drawn' ORDER BY family").all() as { family: string }[]).map((r) => r.family)
  const pick = db.prepare("SELECT id, family, subject, band, preview FROM figures WHERE origin = 'drawn' AND family = ? ORDER BY seed LIMIT ?")
  const items: ReviewItem[] = []
  for (const family of families) {
    for (const f of pick.all(family, o.size) as { id: string; family: string; subject: string; band: string; preview: string | null }[]) {
      if (!reviewed.get(o.job, f.id)) items.push(toItem(f))
    }
  }
  return items
}
```

In `saveVerdict`, change the options type to `{ job: string; model: string; figureId: string; verdict: Verdict; mark?: boolean }`, and wrap the two status updates in `if (o.mark !== false) { ... }`, with the comment `// A comparison of writers judges questions, not the image: it leaves the figure's status alone.`

In `regrade`, add an optional `writer?: string` parameter, and select the figure's questions with `WHERE figure_id = ? AND (? IS NULL OR model = ?)`, called as `.all(r.id, writer ?? null, writer ?? null)`.

Add:

```ts
/** Questions in a job that pass on every count: the measure two writers are compared on (spec 5.5). */
export function cleanRate(db: Store, job: string): { figures: number; questions: number; clean: number; rate: number } {
  const rows = db.prepare('SELECT detail FROM reviews WHERE job = ?').all(job) as { detail: string }[]
  let questions = 0
  let clean = 0
  for (const r of rows) {
    const v = readJson<Partial<Verdict>>(r.detail, {})
    for (const q of v.questions ?? []) {
      questions++
      if (v.figureClear && v.educational && q.keyCorrect && q.answerable && q.singleAnswer) clean++
    }
  }
  return { figures: rows.length, questions, clean, rate: questions ? clean / questions : 0 }
}
```

- [ ] **Step 4: Write `scripts/figure-library/review-real.ts`:**

```ts
// scripts/figure-library/review-real.ts
// Run: npx jiti scripts/figure-library/review-real.ts --writer=haiku|sonnet --ids=<file> [--dry] [--workers=4]
//      npx jiti scripts/figure-library/review-real.ts --compare
// The blind review of one writer's questions on the comparison images (spec 5.5): Sonnet
// answers without the keys, code compares. --compare applies the rule: Haiku is accepted if
// its clean rate is at least 90% of Sonnet's.
import fs from 'node:fs'
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { HAIKU, SONNET, askJson, bedrockSender, runPool } from './claude'
import { REVIEW_SIZE, REVIEW_USD_PER_ITEM, cleanRate, itemsToReview, notedPasses, parseVerdict, previewImage, reviewPrompt, saveVerdict } from './review'

const MODELS = { haiku: HAIKU, sonnet: SONNET } as const
const JOB_CAP_USD = 2
const MAX_UNUSABLE = 10

function compare(db: ReturnType<typeof openStore>): void {
  const h = cleanRate(db, 'p1b-blind-haiku')
  const s = cleanRate(db, 'p1b-blind-sonnet')
  const pct = (r: number) => `${(100 * r).toFixed(1)}%`
  console.log(`Haiku:  ${h.clean}/${h.questions} questions clean on ${h.figures} images (${pct(h.rate)})`)
  console.log(`Sonnet: ${s.clean}/${s.questions} questions clean on ${s.figures} images (${pct(s.rate)})`)
  if (!h.questions || !s.questions) return void console.log('Not decided: review both writers first.')
  const ok = h.rate >= 0.9 * s.rate
  console.log(`Haiku is ${pct(s.rate ? h.rate / s.rate : 1)} of Sonnet's clean rate: ${ok ? 'ACCEPTED (at least 90%)' : 'NOT ACCEPTED (under 90%)'}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { writer: 'string', ids: 'string', dry: 'flag', workers: 'int', compare: 'flag' })
  const db = openStore()
  if (args.compare) {
    compare(db)
    db.close()
    return
  }
  const tag = String(args.writer ?? '')
  if (tag !== 'haiku' && tag !== 'sonnet') throw new Error('--writer must be haiku or sonnet')
  if (!args.ids) throw new Error('--ids=<file> is needed: the comparison images')
  const job = `p1b-blind-${tag}`
  const ids = fs.readFileSync(String(args.ids), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const lib = libraryDir()
  const items = itemsToReview(db, { job, size: REVIEW_SIZE, figureIds: ids, writer: MODELS[tag] })
  const estimate = items.length * REVIEW_USD_PER_ITEM
  console.log(`${items.length} images of ${tag} questions to review, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  const unusable: string[] = []
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no image file`)
        return
      }
      try {
        const raw = await askJson({ db, job, jobCapUsd: JOB_CAP_USD, prompt: reviewPrompt(item), images: [image], maxTokens: 2500, send, model: SONNET })
        saveVerdict(db, { job, model: SONNET, figureId: item.figureId, verdict: parseVerdict(raw, item), mark: false })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} reviews failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      done++
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    const c = cleanRate(db, job)
    console.log(`${job}: ${c.clean}/${c.questions} questions clean on ${c.figures} images`)
    const noted = notedPasses(db, job)
    if (noted.length) console.log(`${noted.length} passes carry a reviewer's concern:\n  ${noted.map((n) => `${n.figureId}: ${n.notes}`).join('\n  ')}`)
    if (unusable.length) console.log(`${unusable.length} not reviewed (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`Reviewed ${done} this run. ${job} spend $${totalSpend(db, job).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 5: Run them, the suite and tsc.** `npx vitest run scripts/figure-library && npx tsc --noEmit -p .` → all pass; tsc prints nothing.

- [ ] **Step 6: Commit.** `git add scripts/figure-library/review.ts scripts/figure-library/review.test.ts scripts/figure-library/review-real.ts && git commit -m "feat(figure-library): blind-review one writer's questions on real images, and compare writers"`

---

### Task 8: The real-image sample sheet

**Files:**
- Create: `scripts/figgen/real/real_sheet.py`
- Test: `scripts/figgen/tests/test_real_sheet.py`

**Interfaces:**
- Consumes: figures with `origin='wikimedia'`, `screenings`, `figure_questions` by writer, `question_checks`, and reviews in jobs `p1b-blind-haiku` and `p1b-blind-sonnet`.
- Produces:
  - `build_real_sheet(db, lib, per_topic=12) -> str`: a page following the artifact page contract.
  - The page shows: the funnel (harvested, screened, written, kept); the writer comparison; for each topic, the images that passed with their credit line and questions; and a strip of screened-out images with their reasons.
  - CLI: `python scripts/figgen/real/real_sheet.py [--per-topic 12] [--out PATH]`.

- [ ] **Step 1: Write the failing tests.** Create `scripts/figgen/tests/test_real_sheet.py`:

```python
import json

from PIL import Image

from figgen.real.real_sheet import HAIKU, SONNET, build_real_sheet
from figgen.store import open_store, save_real


def setup(tmp_path):
    db = open_store(tmp_path / "figures.db")
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')")
    db.commit()
    lib = tmp_path / "lib"
    (lib / "assets/wikimedia").mkdir(parents=True)
    for n in (1, 2):
        Image.new("RGB", (40, 30), "white").save(lib / f"assets/wikimedia/{n}-512.jpg", "JPEG")
        save_real(db, figure_id=f"wikimedia/{n}", origin="wikimedia", kind="photo.micrograph", subject="biology", band="UP",
                  topic_key="db:2", asset=f"assets/wikimedia/{n}.webp", preview=f"assets/wikimedia/{n}-512.jpg", width=40, height=30,
                  spec={"title": f"File:Cells {n}.jpg", "licence_url": "https://creativecommons.org/licenses/by/4.0"},
                  licence="CC BY 4.0", author="Anne & <Bob>", source_url=f"https://commons.wikimedia.org/wiki/File:Cells_{n}.jpg",
                  credit=f"Cells {n} by Anne & <Bob>, CC BY 4.0, via Wikimedia Commons", phash="0")
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'nova', 1, 'Onion cells with nuclei', '{}', 'now'), ('wikimedia/2', 'nova', 0, 'A blurred slide', '{}', 'now')")
    db.execute("UPDATE figures SET status = 'rejected', reason = 'not clear enough' WHERE id = 'wikimedia/2'")
    for model, tag, answer in ((HAIKU, "haiku", "0"), (SONNET, "sonnet", "2")):
        db.execute("INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model) VALUES "
                   "(?, 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dark dot?', '[\"Nucleus\",\"Vacuole\",\"Wall\",\"Membrane\"]', ?, '[]', ?)",
                   (f"wikimedia/1#{tag}#1", answer, model))
        db.execute("INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at) VALUES (?, 'wikimedia/1', ?, 1, '', '{}', 'now')",
                   (f"wikimedia/1#{tag}#1", model))
    verdict = {"pass": True, "figureClear": True, "educational": True, "problems": [],
               "questions": [{"n": 1, "keyCorrect": True, "answerable": True, "singleAnswer": True, "ownAnswer": "A", "key": "A) Nucleus", "problem": ""}]}
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1b-blind-haiku', 'wikimedia/1', 'm', 1, ?, 'now')", (json.dumps(verdict),))
    db.commit()
    return db, lib


def test_the_sheet_shows_each_passing_image_with_its_credit_and_questions(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "<title>" in page[:8000]
    assert "Anne &amp; &lt;Bob&gt;" in page and "<Bob>" not in page
    assert 'href="https://creativecommons.org/licenses/by/4.0"' in page and "CC BY 4.0" in page
    assert 'href="https://commons.wikimedia.org/wiki/File:Cells_1.jpg"' in page
    assert "What is the dark dot?" in page and '<li class="key">Nucleus</li>' in page
    assert "Onion cells with nuclei" in page


def test_the_sheet_shows_what_screening_turned_away(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "not clear enough" in page and page.count("data:image/jpeg;base64,") == 2


def test_the_sheet_compares_the_writers(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "1/1" in page  # Haiku: one clean question of one
    assert "Sonnet" in page and '<li class="key">Wall</li>' in page
```

- [ ] **Step 2: Run them.** `python -m pytest scripts/figgen/tests/test_real_sheet.py -q` → FAIL: `No module named 'figgen.real.real_sheet'`.

- [ ] **Step 3: Write `scripts/figgen/real/real_sheet.py`:**

```python
"""The real-image sample sheet (P1b): what passed, with credits and questions, what was turned away, and the writers compared.

Run from the repo root:  python scripts/figgen/real/real_sheet.py [--per-topic 12] [--out PATH]
Writes one self-contained page (images inlined as 512 px JPEGs), by default to
<FIGURE_LIBRARY_DIR>/reports/p1b-samples.html. It follows the artifact page contract.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from html import escape
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from figgen.store import library_dir, open_store  # noqa: E402

# The writers' model ids, as scripts/figure-library/claude.ts names them.
HAIKU = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
SONNET = "eu.anthropic.claude-sonnet-5-5"
JOBS = {HAIKU: "p1b-blind-haiku", SONNET: "p1b-blind-sonnet"}
NAMES = {HAIKU: "Haiku", SONNET: "Sonnet"}
LEVELS = {"P": "Primary", "LS": "Lower Secondary", "UP": "Upper Secondary", "AL": "A Level"}

CSS = """
:root{--paper:#f4f3ee;--card:#ffffff;--ink:#1c1e21;--muted:#5d6369;--rule:#dad6cb;--key:#1b6843;--key-bg:#e0efe5;
--fail:#a1301c;--fail-bg:#f5e2dc;--accent:#2f5d8a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#141619;--card:#1d2024;--ink:#e6e4df;
--muted:#a0a5ab;--rule:#31353a;--key:#80d0a3;--key-bg:#1a3024;--fail:#ee917d;--fail-bg:#391e19;--accent:#8fb8e3;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#141619;--card:#1d2024;--ink:#e6e4df;--muted:#a0a5ab;--rule:#31353a;--key:#80d0a3;
--key-bg:#1a3024;--fail:#ee917d;--fail-bg:#391e19;--accent:#8fb8e3;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding-inline:16px;padding-block:32px 72px;display:flex;flex-direction:column;gap:40px}
h1,h2{font-family:"Newsreader",Georgia,"Times New Roman",serif;font-weight:600;text-wrap:balance;margin:0;line-height:1.15}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
a{color:var(--accent)}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--muted);margin:0 0 8px}
.lede{max-width:70ch;color:var(--muted);margin:12px 0 0}
.funnel{display:flex;flex-wrap:wrap;gap:12px;margin:0;padding:0;list-style:none}
.funnel li{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:10px 14px;min-width:0}
.funnel b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.table-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule)}
th{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tr:last-child td{border-bottom:0}
.topic{display:flex;flex-direction:column;gap:16px}
.meta{color:var(--muted);font-size:14px;margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:20px}
.card{margin:0;background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:14px;display:flex;
flex-direction:column;gap:10px;min-width:0}
.card img{display:block;width:100%;height:auto;border-radius:3px;background:#fff}
.credit{font-size:12px;color:var(--muted);margin:0;overflow-wrap:anywhere}
.shows{font-size:13px;font-style:italic;color:var(--muted);margin:0}
.writer{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:4px 0 0}
.verdict{font-weight:600;padding:0 6px;border-radius:3px;font-size:12px}
.verdict.pass{color:var(--key);background:var(--key-bg)}
.verdict.fail{color:var(--fail);background:var(--fail-bg)}
ol.qs{margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:10px}
ol.qs p{margin:0}
ol.opts{margin:4px 0 0;padding-left:1.6em;list-style:upper-alpha;display:grid;gap:2px}
ol.opts li{padding:1px 6px;border-radius:3px}
ol.opts li.key{color:var(--key);background:var(--key-bg);font-weight:600}
.ans{color:var(--key);font-weight:600}
.out{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:12px}
.out figure{margin:0;font-size:12px;color:var(--muted);min-width:0}
.out img{width:100%;height:auto;border-radius:3px;opacity:.85}
.out figcaption{color:var(--fail);margin-top:4px}
"""


def image(lib: Path, key: str | None) -> str:
    file = lib / key if key else None
    if not file or not file.exists():
        return '<p class="credit">image missing</p>'
    return f'<img src="data:image/jpeg;base64,{base64.b64encode(file.read_bytes()).decode()}" alt="" loading="lazy">'


def questions_html(db, figure_id: str, model: str) -> str:
    items = []
    for q in db.execute("SELECT kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? AND model = ? ORDER BY n",
                        (figure_id, model)):
        if q["kind"] == "mcq":
            key = int(q["answer"])
            opts = "".join(f'<li class="key">{escape(o)}</li>' if i == key else f"<li>{escape(o)}</li>"
                           for i, o in enumerate(json.loads(q["options"])))
            items.append(f'<li><p>{escape(q["stem"])}</p><ol class="opts">{opts}</ol></li>')
        else:
            also = json.loads(q["accepted"])[1:]
            extra = f' <span class="credit">(also: {escape("; ".join(also))})</span>' if also else ""
            items.append(f'<li><p>{escape(q["stem"])}</p><p class="ans">Answer: {escape(q["answer"])}{extra}</p></li>')
    return f'<ol class="qs">{"".join(items)}</ol>' if items else '<p class="credit">No question kept.</p>'


def verdict_html(db, figure_id: str, model: str) -> str:
    row = db.execute("SELECT pass FROM reviews WHERE job = ? AND figure_id = ?", (JOBS[model], figure_id)).fetchone()
    if row is None:
        return ""
    return f' <span class="verdict {"pass" if row["pass"] else "fail"}">blind review {"passed" if row["pass"] else "failed"}</span>'


def clean(db, job: str) -> tuple[int, int, int]:
    figures = questions = good = 0
    for (detail,) in db.execute("SELECT detail FROM reviews WHERE job = ?", (job,)):
        v = json.loads(detail)
        figures += 1
        for q in v.get("questions", []):
            questions += 1
            good += int(bool(v.get("figureClear") and v.get("educational") and q.get("keyCorrect") and q.get("answerable") and q.get("singleAnswer")))
    return figures, questions, good


def card(db, lib: Path, f) -> str:
    spec = json.loads(f["spec"] or "{}")
    title = spec.get("title", "").removeprefix("File:").rsplit(".", 1)[0]
    licence = escape(f["licence"] or "")
    lic = f'<a href="{escape(spec["licence_url"])}">{licence}</a>' if spec.get("licence_url") else licence
    credit = (f'<p class="credit">{escape(title)} by {escape(f["author"] or "an unknown author")} &middot; {lic} &middot; '
              f'<a href="{escape(f["source_url"] or "")}">Wikimedia Commons</a></p>')
    parts = [image(lib, f["preview"]), credit, f'<p class="shows">Screener: {escape(f["shows"])}</p>']
    for model in (HAIKU, SONNET):
        if db.execute("SELECT 1 FROM question_checks WHERE figure_id = ? AND writer = ?", (f["id"], model)).fetchone():
            parts.append(f'<p class="writer">{NAMES[model]}{verdict_html(db, f["id"], model)}</p>{questions_html(db, f["id"], model)}')
    return f'<figure class="card">{"".join(parts)}</figure>'


def build_real_sheet(db, lib: Path, per_topic: int = 12) -> str:
    harvested = db.execute("SELECT COUNT(*) FROM figures WHERE origin <> 'drawn'").fetchone()[0]
    screened = db.execute("SELECT COUNT(*), COALESCE(SUM(keep), 0) FROM screenings").fetchone()
    written = db.execute("SELECT COUNT(*), COALESCE(SUM(keep), 0) FROM question_checks WHERE writer = ? AND question_id NOT LIKE '%#0'",
                         (HAIKU,)).fetchone()
    with_q = db.execute("SELECT COUNT(DISTINCT figure_id) FROM figure_questions WHERE model = ?", (HAIKU,)).fetchone()[0]
    funnel = [("harvested", harvested), ("kept by the screen", screened[1]), ("questions Haiku wrote", written[0]),
              ("kept by its check", written[1]), ("images with a kept question", with_q)]
    rows = []
    for model in (HAIKU, SONNET):
        figures, questions, good = clean(db, JOBS[model])
        rate = f"{100 * good / questions:.0f}%" if questions else "&ndash;"
        rows.append(f"<tr><td>{NAMES[model]}</td><td>{figures}</td><td>{good}/{questions}</td><td>{rate}</td></tr>")
    sections = []
    for t in db.execute("SELECT DISTINCT t.key, t.name, t.subject, t.band FROM topics t JOIN figure_topics ft ON ft.topic_key = t.key "
                        "JOIN figures f ON f.id = ft.figure_id WHERE f.origin <> 'drawn' ORDER BY t.subject, t.name").fetchall():
        passed = db.execute(
            "SELECT f.*, s.shows FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN screenings s ON s.figure_id = f.id "
            "WHERE ft.topic_key = ? AND s.keep = 1 AND EXISTS (SELECT 1 FROM figure_questions q WHERE q.figure_id = f.id) "
            "ORDER BY EXISTS (SELECT 1 FROM reviews r WHERE r.figure_id = f.id AND r.job LIKE 'p1b-blind-%') DESC, f.id LIMIT ?",
            (t["key"], per_topic)).fetchall()
        out = db.execute(
            "SELECT f.preview, f.reason FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN screenings s ON s.figure_id = f.id "
            "WHERE ft.topic_key = ? AND s.keep = 0 ORDER BY f.id LIMIT 8", (t["key"],)).fetchall()
        counts = db.execute("SELECT COUNT(*), COALESCE(SUM(s.keep), 0) FROM figure_topics ft JOIN screenings s ON s.figure_id = ft.figure_id "
                            "WHERE ft.topic_key = ?", (t["key"],)).fetchone()
        strip = "".join(f'<figure>{image(lib, o["preview"])}<figcaption>{escape(o["reason"] or "")}</figcaption></figure>' for o in out)
        sections.append(
            f'<section class="topic"><h2>{escape(t["name"])}</h2>'
            f'<p class="meta">{escape(t["subject"])} &middot; {LEVELS.get(t["band"], t["band"])} &middot; '
            f'{counts[1]} of {counts[0]} images kept by the screen</p>'
            f'<div class="cards">{"".join(card(db, lib, f) for f in passed)}</div>'
            + (f'<p class="meta">Turned away by the screen:</p><div class="out">{strip}</div>' if strip else "") + "</section>")
    stats = "".join(f"<li><b>{n}</b>{escape(label)}</li>" for label, n in funnel)
    return f"""<title>Real Image Samples</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>{CSS}</style>
<main>
<header><p class="eyebrow">StudySquare figure library &middot; pilot P1b</p><h1>Real image samples</h1>
<p class="lede">Openly licensed images from Wikimedia Commons for six pilot topics. Files with the wrong licence, too small,
of a person, or a near-copy were turned away before download; Nova Lite then screened every image for the topic and level.
Haiku wrote questions on each image that passed and checked them in a second call. On a comparison set, Sonnet wrote too,
and Sonnet answered both writers' questions blind, without the keys. Correct options are marked in green. Each image
carries its credit: author, licence and source.</p></header>
<ul class="funnel">{stats}</ul>
<div class="table-wrap"><table><thead><tr><th>Writer</th><th>Images reviewed</th><th>Clean questions</th><th>Clean rate</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
{"".join(sections)}
</main>
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Write the P1b real-image sample sheet")
    ap.add_argument("--per-topic", type=int, default=12)
    ap.add_argument("--out", default="")
    a = ap.parse_args(argv)
    lib = library_dir()
    db = open_store()
    out = Path(a.out) if a.out else lib / "reports" / "p1b-samples.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_real_sheet(db, lib, a.per_topic), encoding="utf-8")
    db.close()
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run them, then the Python suite.** `python -m pytest scripts/figgen/tests/test_real_sheet.py -q && python -m pytest scripts/figgen -q` → PASS, 3 passed, then the whole suite.

- [ ] **Step 5: Commit.** `git add scripts/figgen/real/real_sheet.py scripts/figgen/tests/test_real_sheet.py && git commit -m "feat(figgen): real-image sample sheet with credits, questions and the writer comparison"`

---

### Task 9: Run the pilot

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-figure-library-design.md` (the P1b result)
- Writes outside the repo: the staging store, `assets/wikimedia/**`, and `reports/p1b-compare.txt`

- [ ] **Step 1: Harvest.** Run `python scripts/figgen/real/harvest.py --per-topic 100`.
  - Expected: six lines of `<key> N held; turned away: {...}`, about 600 in all. A topic short of 100 is re-run with `--per-term 50 --topics=<key>`.
- [ ] **Step 2: Look before paying.** View about five images from each topic. Rules that let through people, logos or translated copies get fixed, with a test, before screening.
- [ ] **Step 3: Screen.** Run `npx jiti scripts/figure-library/screen-real.ts --dry`, then without `--dry`.
  - Expected: about 600 screened, about $0.20, kept and rejected counts, and the reasons.
  - View ten kept and ten rejected images, to judge the screen.
- [ ] **Step 4: Choose the comparison set.** Run `python scripts/figgen/real/choose.py --per-topic 10` → 60 ids.
- [ ] **Step 5: Haiku on every kept image.** Run `npx jiti scripts/figure-library/write-real.ts --writer=haiku` (dry first). Expected: under $6.
- [ ] **Step 6: Sonnet on the comparison set.** Run `npx jiti scripts/figure-library/write-real.ts --writer=sonnet --ids=<library>/reports/p1b-compare.txt`. Expected: under $3.
- [ ] **Step 7: Blind review of both writers on the 60.**
  - Run `review-real.ts --writer=haiku --ids=…`, then `--writer=sonnet --ids=…`.
  - Then run `--compare`, which prints both clean rates and the decision (spec 5.5).
  - Read every noted pass and every failure. A failure caused by the image goes back to the screen as a finding; a failure caused by a question counts against its writer.
- [ ] **Step 8: Sample sheet.** Run `python scripts/figgen/real/real_sheet.py --out "<scratchpad>/p1b-samples.html"`. Read its text with the image data stripped out, look at some images, and publish it with the Artifact tool (icon `photo`).
- [ ] **Step 9: Record the result and commit.**
  - Add a `**P1b result (date), real images:**` entry under P1 in the spec. It covers the funnel counts, screen reasons, both writers' clean rates and the decision, spend, the sheet link, and what P4 inherits.
  - Commit with `git commit -m "docs: P1b real-image pilot result"`.
