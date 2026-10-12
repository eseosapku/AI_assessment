# Figure Library P3a: The Maths Wave's Families and Sample Sheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Maths wave's drawn families are built and linked to the topics they serve by concept, and shown to the user on a sample sheet before anything is generated at scale. The wave has 28 new families and 9 pilot families with reworded questions.

**Architecture:**
- **Linking by concept.** Each family declares the P0 concepts it serves (`CONCEPTS`) and the levels it draws for (`BANDS`). A new linker in `scripts/figgen/link.py` joins an instance to every topic at the instance's level whose mapped concepts it shares, replacing the pilot's hand-made list for families that declare concepts.
- **A wording of its own.** A shared test requires most instances of a Maths family to carry a question wording no other instance has. The quiz route removes a repeated wording (P2a), so a family whose figures all ask "What is the median?" gives one figure per quiz.
- **The sample sheet.** It is drawn straight from the family code (`scripts/figgen/wave_sheet.py`) and reads the store only to count the topics each family serves. Nothing is written to the store and nothing is spent.
- **Generation and review wait for the user's approval** (P3b). The approved pilot figures in the store stay as they are, so local quizzes (P2a) keep working meanwhile.

**Tech Stack:** Python 3.12, matplotlib 3.11, numpy, pytest (`python -m pytest scripts/figgen -q`), sqlite3 (read-only here).

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`: section 3 (success criteria), 5.2 (drawn figures), 9 (P3: "in waves by subject … each wave starts with samples for the user").

## Global Constraints

- **Cost and store.**
  - No model spend. No writes to the staging store in this plan: the linker opens it read-only. No production database access.
- **Answers.**
  - Every answer is computed by the code that drew the figure, and an answer test recomputes it independently over 1,000 seeds.
  - An MCQ has exactly one correct option: no two options equivalent (3/4 and 6/8, 0.5 and 1/2), and no distractor also true of the figure.
  - Short answers:
    - at most 40 characters;
    - every form a student may fairly write is accepted (with and without the unit; "cm²", "cm2" and "cm^2"; a fraction in its lowest terms and the decimal where it terminates; "065°", "065" and "65" for a bearing);
    - never a key that differs from a wrong answer only by case.
- **Readable.**
  - Every value a question asks for can be read exactly off the drawing (on a gridline, a tick or a printed label).
  - No two pieces of text overlap, which the existing `test_no_two_pieces_of_text_overlap` checks for every family.
  - One exam-paper style (`core.py`).
- **Level** (the user's bar, 2026-10-12): numbers, vocabulary and methods suit the band drawn for.
  - Primary uses whole numbers and simple fractions, and no negative numbers below Stage 6.
  - Contexts are ones learners in Rwanda know: names such as Aline, Eric, Grace, Uwase, Mugisha and Divine; prices in Rwandan francs (RWF); mangoes, beans, maize, bicycles, motorbikes, the market, the health centre.
  - Real places are never given invented measurements.
- **Variety** (spec 3.4): `sample()` varies the key numbers. The existing `test_figures_vary_from_seed_to_seed` holds, at 40 different figures in 60 seeds unless a family sets `MIN_VARIETY`.
- **Commits.**
  - Commits stay local on `aws_deploy`. The three unrelated working-tree files stay out of them.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **An MCQ with two defensible answers.**
   - A fraction model offering 3/4 and 6/8.
   - A transformation also describable another way (a symmetric shape reflected is also rotated).
   - A parallel-lines angle given by two angle facts.
   - Expected: exactly one option is right. Pinned per family in Tasks 3–8 ("options pairwise not equivalent", "no distractor maps A onto B", "the shape has no symmetry").
2. **A value that cannot be read exactly:** a curve read between gridlines, a point off the grid, a ruler end between millimetre ticks. Expected: every value asked for lies on a gridline or tick. Pinned per family by a "reads exactly" assertion in its answer test.
3. **The wrong level:** negative numbers or decimals in a Primary figure, or trigonometry offered to Lower Secondary. Expected: band-specific ranges. Pinned per family: "a P instance uses whole numbers only" and the like.
4. **A family linked to topics it does not suit**, or to none at a level it declares. Expected: links only through specific concepts, and every declared level reaches at least three topics in the real store. Pinned in Task 1 (linker tests) and Task 10 (the link report against the real store, with the family's bands or concepts corrected where it fails).
5. **Short answers marked wrong for a fair form:** "15 cm²" against "15", "0.75" against "3/4", "65" against "065°". Expected: accepted. Pinned per family by its `accepted` assertions.

## File Structure

- `scripts/figgen/link.py` (new): the topic index from the store, an instance's topics, and concept validation.
- `scripts/figgen/generate.py` (modify): families with `CONCEPTS` link through `link.py`, and the band comes from the instance; P3b uses this.
- `scripts/figgen/wave_sheet.py` (new): the sample sheet for one subject's wave.
- `scripts/figgen/families/*.py`: 28 new modules; 9 modified (`angles`, `bar_chart`, `box_plot`, `coordinates`, `line_graph`, `number_line`, `pie_chart`, `scatter_graph`, `tree_diagram`).
- `scripts/figgen/families/__init__.py` (modify): registers the new families.
- `scripts/figgen/tests/test_link.py`, `test_wave_sheet.py` (new). `test_families_common.py`, `test_families_answers.py` and `test_generate.py` (modify).

---

### Task 1: Linking families to topics by concept

**Files:** create `scripts/figgen/link.py` and `scripts/figgen/tests/test_link.py`; modify `scripts/figgen/generate.py` and `scripts/figgen/tests/test_generate.py`.

**Interfaces (produces):**
- `topic_index(db) -> TopicIndex`, with `TopicIndex = list[dict]`. Each dict holds `key`, `band`, `subject`, `name` and `concepts` (a frozenset). It covers every topic mapped and not dropped.
- `concepts_of(m, params) -> frozenset[str]`: `m.concepts_for(params)` when the family defines it, else `frozenset(m.CONCEPTS)`.
- `band_of(m, params) -> str`: `params["band"]` when present, else `m.BANDS[0]`.
- `topics_for(index, m, params) -> list[str]`: keys of topics at `band_of(m, params)` sharing a concept with `concepts_of(m, params)`, sorted.
- `unknown_concepts(db, m) -> list[str]`: declared concepts the store does not have.
- `link_report(db, families) -> dict[str, dict[str, int]]`: `family -> {band: topics reached}`, using every concept the family declares.

- [ ] **Step 1: Failing tests.** Create `scripts/figgen/tests/test_link.py`:

```python
"""A family reaches the topics that teach what it draws, at the level it draws for."""
import json
import types

from figgen.link import band_of, concepts_of, link_report, topic_index, topics_for, unknown_concepts
from figgen.store import open_store


def store(tmp_path):
    db = open_store(tmp_path / "figures.db")
    rows = [("db:1", "P", "Fractions", ["mathematics.fractions", "mathematics.decimals"], 0),
            ("db:2", "LS", "Fractions and decimals", ["mathematics.fractions"], 0),
            ("db:3", "P", "Time", ["mathematics.time-general"], 0),
            ("db:4", "P", "Fractions again", ["mathematics.fractions"], 1)]  # dropped by the map
    for key, band, name, concepts, dropped in rows:
        db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'x', 'B', 'mathematics', ?, ?)", (key, band, name))
        db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
                   "VALUES (?, ?, '[]', '[]', 'high', ?, 'm', 'now')", (key, json.dumps(concepts), dropped))
    for cid in ("mathematics.fractions", "mathematics.decimals", "mathematics.time-general"):
        db.execute("INSERT INTO concepts (id, subject, name, bands) VALUES (?, 'mathematics', ?, '[]')", (cid, cid))
    db.commit()
    return db


def family(**kw):
    base = dict(ID="f", BANDS=("P", "LS"), CONCEPTS=("mathematics.fractions",))
    return types.SimpleNamespace(**{**base, **kw})


def test_an_instance_reaches_topics_at_its_own_level_that_share_a_concept(tmp_path):
    index = topic_index(store(tmp_path))
    m = family()
    assert topics_for(index, m, {"band": "P"}) == ["db:1"]
    assert topics_for(index, m, {"band": "LS"}) == ["db:2"]
    assert topics_for(index, m, {}) == ["db:1"]  # no band in the params: the family's first


def test_a_family_may_narrow_its_concepts_per_instance(tmp_path):
    index = topic_index(store(tmp_path))
    m = family(CONCEPTS=("mathematics.fractions", "mathematics.time-general"),
               concepts_for=lambda p: frozenset({"mathematics.time-general"}) if p.get("clock") else frozenset({"mathematics.fractions"}))
    assert topics_for(index, m, {"band": "P", "clock": True}) == ["db:3"]
    assert concepts_of(m, {}) == frozenset({"mathematics.fractions"})
    assert band_of(m, {"band": "LS"}) == "LS"


def test_unknown_concepts_are_named_and_reach_is_reported_per_level(tmp_path):
    db = store(tmp_path)
    assert unknown_concepts(db, family(CONCEPTS=("mathematics.fractions", "mathematics.nope"))) == ["mathematics.nope"]
    assert link_report(db, {"f": family()}) == {"f": {"P": 1, "LS": 1}}
```

- [ ] **Step 2: Run them.** `python -m pytest scripts/figgen/tests/test_link.py -q` → FAIL: no module `figgen.link`.

- [ ] **Step 3: Implement** `scripts/figgen/link.py`:

```python
"""Which topics a drawn figure serves: those at its level that teach a concept it draws (spec 5.2).

A family names the P0 concepts it serves; a topic carries the concepts the P0 map gave it. An
instance reaches every topic at its own level sharing one, so a bar chart for Lower Secondary
serves every Lower Secondary topic on bar charts in every book, not one pilot topic.
"""
from __future__ import annotations

import json
import sqlite3

TopicIndex = list[dict]


def topic_index(db: sqlite3.Connection) -> TopicIndex:
    rows = db.execute("SELECT t.key, t.band, t.subject, t.name, m.concepts FROM topics t "
                      "JOIN topic_map m ON m.topic_key = t.key WHERE m.dropped = 0 ORDER BY t.key").fetchall()
    return [{"key": r["key"], "band": r["band"], "subject": r["subject"], "name": r["name"],
             "concepts": frozenset(json.loads(r["concepts"] or "[]"))} for r in rows]


def concepts_of(m, params: dict) -> frozenset[str]:
    narrow = getattr(m, "concepts_for", None)
    return frozenset(narrow(params)) if narrow else frozenset(m.CONCEPTS)


def band_of(m, params: dict) -> str:
    return params.get("band") or m.BANDS[0]


def topics_for(index: TopicIndex, m, params: dict) -> list[str]:
    band, concepts = band_of(m, params), concepts_of(m, params)
    return sorted(t["key"] for t in index if t["band"] == band and t["concepts"] & concepts)


def unknown_concepts(db: sqlite3.Connection, m) -> list[str]:
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    return [c for c in m.CONCEPTS if c not in known]


def link_report(db: sqlite3.Connection, families: dict) -> dict[str, dict[str, int]]:
    index = topic_index(db)
    out = {}
    for fid, m in families.items():
        concepts = frozenset(m.CONCEPTS)
        out[fid] = {b: sum(1 for t in index if t["band"] == b and t["concepts"] & concepts) for b in m.BANDS}
    return out
```

- [ ] **Step 4: Generator.** In `generate.py`, a family with `CONCEPTS` links through `link.py`:
  - Build `index = topic_index(db)` once in `main` and pass it to `generate_family(..., index=None)`.
  - Validate the family with `unknown_concepts` before drawing, and raise naming them.
  - Per instance:

```python
        if hasattr(m, "CONCEPTS"):
            keys, band = topics_for(index, m, params), band_of(m, params)
            if not keys:  # serves no topic at its level: not worth storing
                continue
            subject = m.SUBJECT
        else:
            keys = topics_for_pilot(m.ID, params)
            first = topic(db, keys[0])
            ...existing band check...
            subject, band = first["subject"], first["band"]
```

  - Import the pilot's `topics_for` as `topics_for_pilot`.
  - Add to `test_generate.py`, written first: "a family with concepts is linked by concept, at its instance's band, and skips an instance that reaches no topic". Use a fake module with `CONCEPTS`, and the temp store pattern already used there.

- [ ] **Step 5: Run** `python -m pytest scripts/figgen -q` → pass. **Commit:** `feat(figgen): drawn families reach their topics by concept and level`.

---

### Task 2: A wording of its own, and the pilot's Maths families reworded

**Files:** modify `scripts/figgen/tests/test_families_common.py`, `scripts/figgen/tests/test_families_answers.py`, and the nine Maths families.

**The rule** (written first, in `test_families_common.py`):

```python
WORDED_SUBJECTS = {"mathematics"}  # waves done; each later wave adds its subject


@pytest.mark.parametrize("fid", sorted(f for f, m in FAMILIES.items() if m.SUBJECT in WORDED_SUBJECTS))
def test_most_figures_have_a_wording_of_their_own(fid):
    """The quiz route removes a repeated wording, figure or not (P2a): a family whose figures all
    ask "What is the median?" gives one figure a quiz. Of 30 figures, 27 must each carry a stem
    no other of the 30 has."""
    m = FAMILIES[fid]
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", sorted(f for f, m in FAMILIES.items() if m.SUBJECT in WORDED_SUBJECTS))
def test_declares_its_concepts(fid):
    m = FAMILIES[fid]
    assert m.CONCEPTS and all(c.startswith(f"{m.SUBJECT}.") for c in m.CONCEPTS)
```

**Rewording.** Each of the nine families keeps its questions and adds or reshapes at least one so it names something only this figure has. Every new or changed question gets its answer assertion in `test_families_answers.py` first. The nine:
- **bar_chart:** "How many more students chose Walk than Bus?" with names from the chart.
- **box_plot:** "What percentage of the marks are above 51?", with Q3 named, giving 25.
- **line_graph:** "By how much did the temperature rise between 09:00 and 12:00?"
- **number_line:** "What number is halfway between −3 and 5?"
- **pie_chart:** already names categories; check that it passes.
- **scatter_graph:** "Which point does not fit the trend? (the student who scored 34 in test A)".
- **angles:** "The other angles are 60° and 45°. Find x."
- **coordinates:** names the point's letter and its coordinates' partner.
- **tree_diagram:** names the events and their probabilities.

**Concepts and bands** for the nine (each a specific concept from the P0 map; a multi-band family puts `band` in its params and sets ranges by band):

| Family | BANDS | CONCEPTS (each `mathematics.` + …) |
|---|---|---|
| bar_chart | P, LS | bar-charts-dual-compound, tally-charts-bar-charts, statistical-graphs-presentation-reading, data-examining, infographics |
| pie_chart | LS, UP | pie-charts, statistical-graphs-presentation-reading |
| line_graph | P, LS, UP | line-graphs-interpreting, time-series-graphs, statistical-graphs-presentation-reading |
| scatter_graph | LS, UP | scatter-graphs, relationships-data, coefficient-correlation, regression-lines |
| box_plot | UP | quartiles, dispersion-measures, averages-types |
| number_line | P, LS | number-line, intervals-closed-line, adding-subtracting-integers, negative-numbers-problems, integers |
| angles | LS | angles-at-a-point, calculating-angles, lines-intersecting |
| coordinates | P, LS | grid, position-and-direction, ordered-pair, point-location-space, position-describing |
| tree_diagram | LS, UP | tree-diagram, combined-events, probability-independent-events-multiplication, conditional-probability |

- [ ] Steps:
  1. Add the two tests (RED for the families not yet reworded).
  2. Reword one family at a time, answer test first.
  3. Run `python -m pytest scripts/figgen -q` → pass.
  4. Look at seeds 1 and 2 of each family as PNG (Read the image) before committing.
  5. **Commit:** `feat(figgen): the pilot's maths families give each figure a wording of its own`.

---

### Tasks 3–8: The new families

**Every family:**
- Is a module in `scripts/figgen/families/` declaring:
  - `ID`, `KIND`, `SUBJECT = "mathematics"`, `BANDS` and `CONCEPTS`;
  - `sample(rng) -> dict` (with `band` when there is more than one);
  - `draw(params) -> Figure`;
  - `questions(params, rng) -> list[Question]`, built with `core.mcq` and `core.short`.
- Is registered in `families/__init__.py`.
- Passes every shared test: kind and levels, determinism, well-formed questions, variety, valid SVG and PNG, no overlapping text, a wording of its own, and its concepts.
- **Order per family:**
  1. The answer test in `test_families_answers.py`, recomputing every answer from the params over 1,000 seeds, including the family's invariants below. Run it and see it fail.
  2. The module.
  3. Green.
  4. Read the PNG of seeds 1, 2 and 3 for one instance of each band, and fix what looks wrong: a clipped label, an unreadable value, a cramped layout.
- **One commit per task:** `feat(figgen): maths wave families: <group>`.
- Concepts are given without the `mathematics.` prefix, which the module adds.

#### Task 3: Number, pattern and pictogram (Primary and Lower Secondary)

- **place_value** (`maths.number`; P)
  - **Draws:** a place-value chart (Th H T O at Stages 1–4; up to millions at Stages 5–6), digits in columns.
  - **Asks:**
    - "What is the value of the digit 7 in 47,302?" (short, with and without commas);
    - "Which number does the chart show?" (MCQ; distractors: two digits swapped, a zero dropped, the columns read right to left);
    - "What number is 1,000 more than …?" (short).
  - **Invariants:** no leading zero; the asked digit appears once.
  - **Concepts:** place-value, numbers-forming-reading, reading-numbers-up-to-2000, whole-numbers-beyond-1000000, counting-reading-writing-numbers, number-and-numeration, comparing-and-ordering-numbers.
- **fraction_model** (`maths.number`; P, LS)
  - **Draws:** a bar or circle in equal parts, some shaded.
  - **Asks:**
    - "What fraction of the shape is shaded?" (MCQ; options pairwise not equivalent; the correct one in lowest terms);
    - "How many more parts must be shaded so that 3/4 of the shape is shaded?" (short; the target varies);
    - at LS, "What percentage is not shaded?" (short; "25", "25%").
  - **Invariants:** parts ≤ 12 at P; the target is reachable.
  - **Concepts:** fractions, fractions-equivalent-shading, fractions-exploring-models, fractions-denominator, ordering-comparing-fractions, decimal-fractions-illustration, fractions-percentages.
- **pattern_sequence** (`maths.number`; P, LS)
  - **Draws:** the first three patterns of matchsticks or dots (squares in a row, triangles, an L of dots).
  - **Asks:**
    - "How many matchsticks are in pattern 4?" (short);
    - "How many are in pattern 10?" (short);
    - at LS, "Which expression gives the number in pattern n?" (MCQ: 3n + 1 against n + 3, 4n, 3n − 1).
  - **Invariants:** counts follow a linear rule an + b, with a ∈ 2–6.
  - **Concepts:** sequences-simple, investigating-patterns, sequences-arithmetic-general-term, expressions-sequences-equivalent, sequences-functions, numbers-and-sequences, sequences-whole-numbers-fractions-decimals.
- **pictogram** (`graph.bar`; P)
  - **Draws:** four or five rows (days, classes, fruits) with symbols and a key (one symbol = 2, 4 or 5), including half symbols when the key is even.
  - **Asks:**
    - "How many mangoes were sold on Tuesday?";
    - "How many more on Friday than Monday?";
    - "How many in total?" (short).
  - **Invariants:** every count is a multiple of half the key; the key's symbol matches.
  - **Concepts:** pictograms-pictographs, papygram, tally-charts-bar-charts, data-general, statistics-general, questions-surveys, blended-handling-data-concepts.

#### Task 4: Measure (Primary)

- **clock** (`maths.measure`; P)
  - **Draws:** an analogue face with hands at 5-minute marks (Stages 1–3: o'clock, half past, quarter to and past).
  - **Asks:**
    - "What time does the clock show?" (MCQ; distractors: hands swapped, five minutes off, the hour hand misread);
    - "Grace's lesson starts at this time and lasts 45 minutes. At what time does it end?" (short, "10:20" and "10.20"; the duration varies);
    - "How many minutes until 11 o'clock?"
  - **Invariants:** the hour hand sits proportionally between hours.
  - **Concepts:** time-general, time-hour-months-days, time-intervals-duration, addition-subtraction-time-problems, time-unit-conversion.
- **ruler** (`maths.measure`; P, LS)
  - **Draws:** a centimetre ruler with millimetre ticks and an object (pencil, nail, crayon, key, eraser) above it, not always starting at 0.
  - **Asks:**
    - "How long is the pencil?" ("7.4", "7.4 cm", "74 mm");
    - "How much longer is it than 5 cm?";
    - at LS, "in millimetres".
  - **Invariants:** both ends on millimetre ticks.
  - **Concepts:** length-measurement, lines-drawing-measuring, measurement-general, unit-conversion-length, length-capacity-mass-revision.

#### Task 5: Geometry I (Lower Secondary)

- **parallel_lines** (`maths.geometry`; LS)
  - **Draws:** two parallel lines (arrow marks) cut by a transversal; one angle given, x marked.
  - **Asks:**
    - "One angle is 64°. Find the angle x." (short, "116", "116°");
    - "Which fact gives x?" (MCQ: corresponding, alternate, co-interior, vertically opposite).
  - **Invariants:** exactly one single-step fact relates the two marked angles. The layout table lists, for each placement, the fact, and the test checks no second fact applies.
  - **Concepts:** calculating-angles, lines-intersecting, lines-relationships, lines-2d.
- **polygon_angles** (`maths.geometry`; LS, UP)
  - **Draws:** an irregular pentagon or hexagon with all but one interior angle labelled; or a regular polygon with one exterior angle.
  - **Asks:**
    - "Four of the angles of this pentagon are 100°, 120°, 95° and 110°. Find x." (short);
    - "What is the sum of the interior angles?" (short);
    - for a regular polygon, "How many sides does it have?"
  - **Invariants:** the angles sum to (n − 2) × 180, each 60–170, and the drawing is convex with the angles as labelled within 15°.
  - **Concepts:** polygons, symmetry-polygons, calculating-angles, triangle-exterior-angle, 2d-shapes.
- **area_shapes** (`maths.geometry`; P, LS)
  - **Draws:** P: a rectilinear shape on a centimetre grid; LS: a labelled L-shape, triangle, parallelogram or trapezium.
  - **Asks:**
    - "What is the area of this shape?" ("24", "24 cm²", "24 cm2");
    - "What is its perimeter?";
    - the stem names a dimension: "The garden is 12 m long …".
  - **Invariants:** whole-number dimensions; the area and perimeter are recomputed.
  - **Concepts:** perimeter-2d-shapes, parallelogram-trapezium-area, shapes-square-rectangle-triangle, mensuration, problem-solving-areas-volumes, grid, hectares.
- **bearings** (`maths.geometry`; LS, UP)
  - **Draws:** two or three points (a school S, a market M, a health centre H) with north lines and a marked angle.
  - **Asks:**
    - "What is the bearing of M from S?" ("065°", "065", "65");
    - "The bearing of M from S is 065°. What is the bearing of S from M?"
  - **Invariants:** bearings between 001 and 359; the back bearing is ±180.
  - **Concepts:** bearings, regular-polygons-bearings, scale-drawing-concept, scale-drawings-actual-distance.

#### Task 6: Geometry II and solids

- **right_triangle** (`maths.geometry`; LS, UP)
  - **Draws:** a right-angled triangle with two sides, or a side and an angle, labelled.
  - **Asks:**
    - LS, Pythagoras: "Find x." (exact for triples, else "Give your answer to 1 decimal place");
    - UP, trigonometry: "Find the angle θ to 1 decimal place" or "Find x".
    - The stem names the given sides.
  - **Invariants:** the hypotenuse is longest; the drawing is proportional within 10%.
  - **Concepts:** right-angled-triangles, pythagorean-triples, tangent-acute-angle, trigonometric-concepts, trigonometric-ratios-exact.
- **circle_theorem** (`maths.geometry`; LS, UP)
  - **Draws:** a circle with centre O and one theorem: angle at the centre, angle in a semicircle, cyclic quadrilateral, same segment, tangent and radius, or isosceles triangle from radii. LS draws only the semicircle, tangent and radii cases.
  - **Asks:**
    - "Angle ABC is 38°. Find the angle x." (short);
    - "Which theorem gives x?" (MCQ).
  - **Invariants:** points lie on the circle; the given angle is between 20° and 80°; exactly one theorem applies to the pair marked.
  - **Concepts:** circle-theorems, angles-centre-circumference-circle, angle-in-semicircle, angles-cyclic-quadrilateral, angles-same-segment, circle-tangent, chords-properties, circle-elements.
- **cuboid** (`maths.solid`; P, LS)
  - **Draws:** a cuboid in oblique projection with three labelled edges (P: made of cubes, countable).
  - **Asks:**
    - "A box is 6 cm long, 4 cm wide and 3 cm tall. What is its volume?" ("72", "72 cm³", "72 cm3");
    - surface area (LS);
    - "How many 1 cm cubes fit?" (P).
  - **Invariants:** whole-number edges, 2–12.
  - **Concepts:** volume-cubes-cuboids, cubes-cuboids, cuboid-dimension, surface-area-cubes-cuboids, prism-volume, 3d-shapes, solids-properties.
- **nets** (`maths.solid`; P, LS)
  - **Draws:** a net on a grid: cube (one of the 11 nets), cuboid, triangular prism, square-based pyramid or tetrahedron.
  - **Asks:**
    - "Which solid does this net fold into?" (MCQ);
    - "How many faces, edges or vertices does it have?";
    - at LS, "The squares are 3 cm. What is the area of the net?" (short).
  - **Invariants:** the cube nets are the 11 true ones; area recomputed.
  - **Concepts:** shapes-nets, construction-polygons-nets, 3d-shapes, solids-properties, surface-area-triangular-prisms-pyramids.

#### Task 7: Graphs and the coordinate plane

- **linear_graph** (`maths.coordinate`; LS, UP)
  - **Draws:** one straight line on a grid (UP: sometimes two, for simultaneous equations).
  - **Asks:**
    - "The line passes through (0, 3) and (2, 7). What is its gradient?" ("2"; fractions in lowest terms with the decimal);
    - "What is the y-intercept?";
    - "Which is the equation of the line?" (MCQ: m and c swapped, a sign wrong);
    - UP: "Use the graph to solve the simultaneous equations" (MCQ of pairs).
  - **Invariants:** the gradient is a fraction with denominator ≤ 3; the line passes through two lattice points inside the grid; the intersection is a lattice point.
  - **Concepts:** linear-functions, gradient-function, intercepts, linear-equation-gradient-intercept, plotting-graphs, simultaneous-equations-graphical, two-variables-equation.
- **quadratic_graph** (`maths.coordinate`; LS, UP)
  - **Draws:** y = a(x − p)(x − q), with a = ±1, on a grid, with its equation printed.
  - **Asks:**
    - "Use the graph to solve x² − 2x − 3 = 0" (MCQ of root pairs);
    - "What are the coordinates of the turning point?" (MCQ);
    - "What is the y-intercept?";
    - UP: "For which values of x is y < 0?" (MCQ).
  - **Invariants:** integer roots in −5 to 5; the turning point on a gridline (p + q even).
  - **Concepts:** functions-quadratic-graphs, quadratic-equations-graphical-method, quadratic-graphs-review, parabola, quadratic-equations-roots, quadratic-inequalities.
- **conversion_graph** (`graph.line`; LS, UP)
  - **Draws:** a straight conversion line: kilometres and miles, litres and gallons, kilograms and pounds, °C and °F.
  - **Asks:**
    - "Use the graph to change 40 km to miles." (short);
    - the reverse;
    - "About how many km is 100 miles?" (multiply up).
  - **Invariants:** each asked value lies on a gridline (rates rounded to the grid, labelled "approximately"). No money (exchange rates go out of date).
  - **Concepts:** conversion-graphs, converting-miles-kilometres, proportion-direct-inverse.
- **travel_graph** (`graph.line`; LS, UP)
  - **Draws:** a distance–time graph of a journey (Eric cycles to the market, stops, returns), with times on the x-axis.
  - **Asks:**
    - "How far from home was Eric at 10:30?";
    - "How long did he stop?";
    - "What was his speed on the way back, in km/h?"
  - **Invariants:** every corner is on a grid point; speeds are whole numbers.
  - **Concepts:** kinematic-graphs, rates, rates-of-change, speed-distance-time.
- **transformation** (`maths.coordinate`; LS, UP)
  - **Draws:** shape A and its image B on a coordinate grid.
  - **Asks:**
    - "Describe the single transformation that maps A onto B." (MCQ: a reflection in a named line, a rotation with angle, direction and centre, a translation by a vector, an enlargement with scale factor and centre);
    - "What are the coordinates of the image of vertex P?" (short: "(4, 1)", "(4,1)", "4, 1").
  - **Invariants:** the shapes have no symmetry; the test checks each distractor's transformation does not map A onto B; everything is on the grid.
  - **Concepts:** reflection-definition, rotation-angle-centre, rotation-introduction, translation-definition, enlargement-definition, enlargement-locating-scale-factor, isometries-introduction, position-transformation.
- **vectors_grid** (`maths.coordinate`; LS, UP)
  - **Draws:** two or three vectors as arrows on a grid, named a, b and c.
  - **Asks:**
    - "Which is the column vector a?" (MCQ, written "(3, −2)" as column-vector text);
    - "What is a + b?";
    - UP: "What is the magnitude of a? Give your answer to 1 decimal place."
  - **Invariants:** integer components −5 to 5; the vector is not zero.
  - **Concepts:** column-vector-definition, vectors, vectors-column-addition-subtraction, vector-magnitude, vectors-equivalent, vector-scalar-multiplication.
- **inequality_region** (`maths.coordinate`; LS, UP)
  - **Draws:** LS: a region bounded by vertical and horizontal lines; UP: also one sloping line, the unwanted side shaded.
  - **Asks:**
    - "Which inequalities describe region R?" (MCQ: one sign reversed, ≤ for <);
    - "Which of these points lies in R?" (MCQ of lattice points).
  - **Invariants:** a solid line means ≤ or ≥, a dashed line < or >; exactly one listed point lies in R.
  - **Concepts:** regions-plane, simultaneous-linear-inequalities-solving, inequalities-forming-solving, linear-inequalities-solving.

#### Task 8: Statistics and probability

- **venn** (`maths.probability`; P, LS, UP)
  - **Draws:** two sets (UP: sometimes three) with counts in regions and outside, in a context (football and netball, mangoes and avocados).
  - **Asks:**
    - "How many students play football but not netball?";
    - "How many were asked?";
    - LS and UP: "What is the probability that a student chosen plays both?" ("4/25", "0.16").
  - **Invariants:** counts 0–20 at P, 0–40 above.
  - **Concepts:** venn-carroll-diagrams, intersection-sets, complement-of-set, set-notation, sets-problems, combined-events, conditional-probability.
- **two_way_table** (`table.data`; LS, UP)
  - **Draws:** a two-way table (boys and girls by transport, lunch or club) with totals and some cells blank.
  - **Asks:**
    - "How many girls walk to school?" (a blank cell, recomputed);
    - "What fraction of the students are boys who cycle?";
    - UP: "Given that a student is a girl, what is the probability she walks?"
  - **Invariants:** exactly the information needed is given; the blanks are determined.
  - **Concepts:** frequency-distribution-table, calculating-probabilities, conditional-probability, statistical-data-interpretation, data-examining.
- **frequency_table** (`table.data`; P, LS, UP)
  - **Draws:** ungrouped (goals, siblings, shoe sizes); UP: also grouped, with class intervals.
  - **Asks:**
    - "What is the mode?" (P);
    - "How many families were asked?";
    - LS: "What is the mean? Give your answer to 1 decimal place." and "What is the median?";
    - UP grouped: "What is the modal class?" (MCQ) and "an estimate of the mean" (to 1 d.p.).
  - **Invariants:** a single mode; the median is unambiguous.
  - **Concepts:** frequency-distribution-table, central-tendencies-ungrouped-data, arithmetic-mean, mode-finding, median, calculating-statistics-grouped-data, grouped-data-definition, class-boundaries.
- **stem_leaf** (`graph.stats`; LS, UP)
  - **Draws:** a stem-and-leaf diagram with a key ("3 | 4 means 34 kg"), 12–25 values.
  - **Asks:**
    - "What is the median mass?";
    - "What is the range?";
    - "How many students weigh more than 45 kg?"
  - **Invariants:** leaves are sorted; a single mode where the mode is asked.
  - **Concepts:** stem-leaf-diagrams, median, range, mode-finding, rank-order-list.
- **cumulative_frequency** (`graph.stats`; UP)
  - **Draws:** a cumulative frequency curve through points at the class ends, on a fine grid; the total is a multiple of 4.
  - **Asks:**
    - "Use the graph to estimate the median";
    - "Use the graph to estimate the interquartile range";
    - "How many scored more than 60?"
  - **Invariants:** the curve passes exactly through grid points at n/4, n/2 and 3n/4, with the curve built monotone through them.
  - **Concepts:** cumulative-distribution-function, quartiles, dispersion-measures, calculating-statistics-grouped-data.
- **histogram** (`graph.bar`; LS, UP)
  - **Draws:** LS: equal widths with frequency on the y-axis; UP: unequal widths with frequency density.
  - **Asks:**
    - "How many seedlings are between 20 and 30 cm tall?" (frequency density × width);
    - "Which class has the most?" (MCQ);
    - "How many altogether?"
  - **Invariants:** the densities are on gridlines; the frequencies are whole numbers.
  - **Concepts:** histogram, frequency-polygons, grouped-data-definition, class-boundaries.
- **sample_space** (`maths.probability`; LS, UP)
  - **Draws:** a grid of outcomes for two dice or two spinners (numbers vary), showing the sum or product.
  - **Asks:**
    - "What is the probability that the total is 7?" (lowest terms, with the decimal where it terminates);
    - "How many outcomes give a product greater than 12?"
  - **Invariants:** the outcomes are recounted from the grid.
  - **Concepts:** die-toss-outcomes-representing, chance-experiments, calculating-probabilities, combined-events, probability-experimental-theoretical, cartesian-product, probability-independent-events-multiplication.

---

### Task 9: The wave's sample sheet

**Files:** create `scripts/figgen/wave_sheet.py` and `scripts/figgen/tests/test_wave_sheet.py`.

**Produces:** `build_wave_sheet(families, per_family, index, before) -> str` (HTML) and a CLI: `python scripts/figgen/wave_sheet.py --subject mathematics --per-family 3 --out <file>`.
- Each family gets:
  - `per_family` figures drawn from seeds 1…n, spread across its bands (one band each in turn), embedded as PNG data URIs;
  - their questions with the key marked;
  - its kind, levels, concepts, and the number of topics it reaches at each level with up to five names.
- A coverage table: the subject's mapped topics by how many families reach them (0, 1–2, 3–5, 6 or more), before this wave (`before`, the families already approved in the store) and with it.
- The page follows the artifact contract: a `<title>`, colour tokens with dark mode, and no horizontal scroll at phone width (reuse `sample_sheet.CSS` and add tokens).
- Writes nothing to the store.

- [ ] **Step 1: Failing tests.** In `test_wave_sheet.py`:
  - "every family's figures, questions and keys appear, and each level it draws for is shown", using two real families and a fake index;
  - "the coverage table counts topics by families reaching them": with the same fake index, a topic reached by one family is counted in 1–2;
  - "a family reaching no topic at a level it declares is flagged on the sheet".
- [ ] **Step 2: Run** → FAIL: no module.
- [ ] **Step 3: Implement**, reusing `sample_sheet.card`'s layout but from in-memory questions.
- [ ] **Step 4: Run** `python -m pytest scripts/figgen -q` → pass. **Commit:** `feat(figgen): a sample sheet for a subject's wave, drawn from code`.

---

### Task 10: Run it, look at it, and hand it to the user

- [ ] **Link report against the real store, read-only.** For each Maths family and level, count the topics reached (`link_report`). Any declared level reaching fewer than three topics gets its concepts widened to the specific P0 concepts those topics carry, or the level dropped. Record each change as a ruling.
- [ ] **Look.** Read seeds 1–3 of every family as PNG, and fix what a student would trip on: a clipped label, an ambiguous mark, a value off a gridline, a cramped layout. Re-run the tests after each fix.
- [ ] **Sheet.** `python scripts/figgen/wave_sheet.py --subject mathematics --per-family 3 --out <scratchpad>/maths-wave.html`, then publish it as an artifact for the user, with the coverage table showing what the wave adds.
- [ ] **Record.** Add a P3a result under P3 in the spec: families, levels, the coverage change for Maths, and $0 spent. **Commit:** `docs: P3a result`.
- [ ] **Next (P3b, after the user's verdict on the sheet):**
  - Fix what they flag.
  - `generate.py --redo` for the nine reworded families, and new families at 30 each.
  - The blind review: Sonnet at the existing protocol, about $10 for 37 families × 30.
  - `review-drawn.ts --approve`, then generation to each topic's drawn share.
  - Coverage report.
